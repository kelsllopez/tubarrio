import urllib.parse
import urllib.request
import json
import hashlib

from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_GET
from django.views.decorators.cache import cache_control
from django.utils.http import http_date
from django.utils.timezone import now
from django.utils.dateparse import parse_datetime
from django.core.cache import cache
from django.db import connection
from django.db import models
from .models import Negocio, GeocodeCache
from .rate_limit import is_rate_limited
from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination
from .serializers import NegocioSerializer


def _geocode_cache_key(direccion: str, comuna: str, ciudad: str) -> str:
    raw = '|'.join((direccion or '', comuna or '', ciudad or '')).strip().lower()
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:64]


# ── Geocodificación automática con Nominatim + cache en BD ───────────────────
def geocode(direccion, comuna='', ciudad='Chile'):
    """Convierte dirección en lat/lng usando OpenStreetMap Nominatim (con cache)."""
    clave = _geocode_cache_key(direccion, comuna, ciudad)
    try:
        cached = GeocodeCache.objects.only('latitud', 'longitud').get(clave=clave)
        return cached.latitud, cached.longitud
    except GeocodeCache.DoesNotExist:
        pass

    texto = ', '.join(filter(None, [direccion, comuna, ciudad]))
    query = urllib.parse.quote(texto)
    url = f'https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1'
    req = urllib.request.Request(url, headers={'User-Agent': 'TuBarrio/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=4) as r:
            data = json.loads(r.read())
            if data:
                lat, lng = float(data[0]['lat']), float(data[0]['lon'])
                GeocodeCache.objects.update_or_create(
                    clave=clave,
                    defaults={'latitud': lat, 'longitud': lng},
                )
                return lat, lng
    except Exception:
        pass
    return None, None


TIPOS_VALIDOS = {
    'mini_market',
    'belleza',
    'comida',
    'panaderia',
    'servicios',
    'emprendimiento',
}

CAT_COLORES = {
    'comida': '#F5A623',
    'mini_market': '#5F8C68',
    'belleza': '#E05C8A',
    'panaderia': '#C0824A',
    'servicios': '#4A90D9',
    'emprendimiento': '#9B59B6',
}

# bbox máximo ~2° (~220 km en latitud media Chile) para evitar queries enormes
BBOX_MAX_SPAN_DEG = 2.0
API_MAX_LIMIT = 2000
API_DEFAULT_LIMIT = 500


def _negocio_dict(n, include_updated: bool = True):
    d = {
        'id': n['id'],
        'nombre': n['nombre'],
        'cat': n['tipo'],
        'color': CAT_COLORES.get(n['tipo'], '#888888'),
        'dir': n['direccion'],
        'dias': n['dias_atencion'] or '',
        'whatsapp': n['whatsapp'] or '',
        'instagram': n['instagram'] or '',
        'facebook': n['facebook'] or '',
        'lat': n['latitud'],
        'lng': n['longitud'],
    }
    if include_updated and 'fecha_modificacion' in n:
        fm = n['fecha_modificacion']
        d['updated_at'] = fm.isoformat() if fm else None
    return d


def _parse_bbox(bbox: str):
    """Devuelve (min_lng, min_lat, max_lng, max_lat) o None si inválido."""
    try:
        parts = [float(x.strip()) for x in bbox.split(',')]
        if len(parts) != 4:
            return None
        min_lng, min_lat, max_lng, max_lat = parts
        if not (-180 <= min_lng <= 180 and -180 <= max_lng <= 180):
            return None
        if not (-90 <= min_lat <= 90 and -90 <= max_lat <= 90):
            return None
        if min_lng > max_lng or min_lat > max_lat:
            return None
        if (max_lng - min_lng) > BBOX_MAX_SPAN_DEG or (max_lat - min_lat) > BBOX_MAX_SPAN_DEG:
            return None
        return min_lng, min_lat, max_lng, max_lat
    except (ValueError, TypeError):
        return None


# ── Vista principal — mapa ────────────────────────────────────────────────────
def index(request):
    qs = (
        Negocio.objects.filter(estado='aprobado')
        .order_by('-fecha_creacion')
        .values(
            'id',
            'nombre',
            'tipo',
            'direccion',
            'dias_atencion',
            'whatsapp',
            'instagram',
            'facebook',
            'latitud',
            'longitud',
            'fecha_modificacion',
        )
    )

    negocios_json = json.dumps(
        [_negocio_dict(n, True) for n in qs],
        ensure_ascii=False,
    )

    return render(request, '1.html', {'negocios_json': negocios_json})


# ── API JSON (polling, incremental, cursor, filtros) ─────────────────────────
#
# GET /api/negocios/
#
# Query params:
#   cat              — categoría (tipo) o 'all'
#   q                — texto en nombre o dirección (icontains)
#   limit            — máximo de filas (1..2000, default 500)
#   bbox             — minLng,minLat,maxLng,maxLat (span máx ~2° por lado)
#   updated_since    — ISO8601: solo negocios con fecha_modificacion > fecha
#   after_id         — paginación estable: id mayor que este, orden por id asc
#   meta=1           — respuesta { results, count, next_after_id, has_more }
#
# Cabeceras respuesta: ETag, Last-Modified, X-Total-Count
# Si If-None-Match coincide con ETag → 304 (salvo meta=1)
#
@require_GET
@cache_control(no_cache=True)
def api_negocios(request):
    if is_rate_limited(request, 'api_negocios', limit=180, window_seconds=60):
        return JsonResponse({'error': 'Demasiadas solicitudes. Intenta en unos segundos.'}, status=429)

    cat = (request.GET.get('cat') or '').strip()
    q = (request.GET.get('q') or '').strip()
    limit_raw = (request.GET.get('limit') or '').strip()
    bbox = (request.GET.get('bbox') or '').strip()
    updated_since_raw = (request.GET.get('updated_since') or '').strip()
    after_id_raw = (request.GET.get('after_id') or '').strip()
    meta = (request.GET.get('meta') or '').strip() in ('1', 'true', 'yes')

    qs = Negocio.objects.filter(estado='aprobado')
    if cat and cat != 'all':
        qs = qs.filter(tipo=cat)
    if q:
        qs = qs.filter(models.Q(nombre__icontains=q) | models.Q(direccion__icontains=q))

    if updated_since_raw:
        dt = parse_datetime(updated_since_raw)
        if dt is not None:
            if dt.tzinfo is None:
                from django.utils import timezone
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            qs = qs.filter(fecha_modificacion__gt=dt)

    bbox_parsed = _parse_bbox(bbox) if bbox else None
    if bbox:
        if bbox_parsed is None:
            return JsonResponse({'error': 'bbox inválido o demasiado grande (max ~2° por lado).'}, status=400)
        min_lng, min_lat, max_lng, max_lat = bbox_parsed
        qs = qs.filter(
            latitud__gte=min_lat,
            latitud__lte=max_lat,
            longitud__gte=min_lng,
            longitud__lte=max_lng,
        )

    use_cursor = bool(after_id_raw)
    try:
        after_id = int(after_id_raw) if after_id_raw else None
    except ValueError:
        after_id = None

    if use_cursor and after_id is not None:
        qs = qs.filter(id__gt=after_id).order_by('id')
    else:
        qs = qs.order_by('-fecha_creacion')

    limit = API_DEFAULT_LIMIT
    if limit_raw:
        try:
            limit = int(limit_raw)
            if limit < 1:
                limit = API_DEFAULT_LIMIT
            limit = min(limit, API_MAX_LIMIT)
        except ValueError:
            limit = API_DEFAULT_LIMIT

    qs = qs.values(
        'id',
        'nombre',
        'tipo',
        'direccion',
        'dias_atencion',
        'whatsapp',
        'instagram',
        'facebook',
        'latitud',
        'longitud',
        'fecha_creacion',
        'fecha_modificacion',
    )[:limit]

    rows = list(qs)
    data = [_negocio_dict(n, True) for n in rows]

    etag_src = '|'.join(
        f"{n['id']}:{(n['fecha_modificacion'].timestamp() if n.get('fecha_modificacion') else 0):.3f}"
        for n in rows
    )
    etag = '"' + hashlib.sha256(etag_src.encode('utf-8')).hexdigest()[:16] + '"'
    if request.headers.get('If-None-Match') == etag and not meta:
        resp = JsonResponse([], safe=False)
        resp.status_code = 304
        resp['ETag'] = etag
        return resp

    cache_key = f"api_negocios:{etag}:{cat}:{q}:{limit_raw}:{bbox}:{updated_since_raw}:{after_id_raw}:m{int(meta)}"
    if not meta:
        cached = cache.get(cache_key)
        if cached is not None:
            resp = JsonResponse(cached, safe=False)
            resp['ETag'] = etag
            return resp

    payload = data
    if meta:
        payload = {
            'results': data,
            'count': len(data),
            'next_after_id': rows[-1]['id'] if rows else None,
            'has_more': len(rows) >= limit,
        }

    if not meta:
        cache.set(cache_key, data, 15)
    resp = JsonResponse(payload, safe=isinstance(payload, list))
    resp['ETag'] = etag
    resp['Last-Modified'] = http_date(now().timestamp())
    resp['X-Total-Count'] = str(len(data))
    return resp


# ── Health check (despliegue / monitoreo) ──────────────────────────────────────
@require_GET
def healthz(request):
    """GET /api/healthz/ — DB y app vivos."""
    try:
        connection.ensure_connection()
        ok = True
    except Exception:
        ok = False
    status = 200 if ok else 503
    return JsonResponse(
        {'ok': ok, 'service': 'tubarrio'},
        status=status,
    )


# ── Formulario de registro ────────────────────────────────────────────────────
def ingresa_tu_negocio(request):
    if request.method == 'POST':
        if is_rate_limited(request, 'ingresa_negocio', limit=10, window_seconds=3600):
            return HttpResponse(
                'Demasiados intentos de registro desde esta IP. Intenta más tarde.',
                status=429,
                content_type='text/plain; charset=utf-8',
            )

        direccion = request.POST.get('direccion', '').strip()
        comuna = request.POST.get('comuna', '').strip()
        ciudad = request.POST.get('ciudad', 'Chile').strip()

        lat_raw = request.POST.get('latitud', '').strip()
        lng_raw = request.POST.get('longitud', '').strip()

        try:
            latitud = float(lat_raw) if lat_raw else None
            longitud = float(lng_raw) if lng_raw else None
        except ValueError:
            latitud = longitud = None

        if latitud is None or longitud is None:
            latitud, longitud = geocode(direccion, comuna, ciudad)

        tipo_recibido = request.POST.get('tipo', '').strip()
        tipo = tipo_recibido if tipo_recibido in TIPOS_VALIDOS else 'emprendimiento'

        wsp_publico = request.POST.get('wsp_publico', 'no').strip()
        whatsapp_raw = request.POST.get('whatsapp', '').strip() or None
        whatsapp = whatsapp_raw if wsp_publico == 'si' else None

        instagram_raw = request.POST.get('instagram', '').strip() or None
        facebook_raw = request.POST.get('facebook', '').strip() or None

        Negocio.objects.create(
            nombre=request.POST.get('nombre', '').strip(),
            tipo=tipo,
            direccion=direccion,
            dias_atencion=request.POST.get('dias_atencion', '').strip(),
            whatsapp=whatsapp,
            instagram=instagram_raw,
            facebook=facebook_raw,
            comuna=comuna,
            ciudad=ciudad or 'Chile',
            latitud=latitud,
            longitud=longitud,
            estado='pendiente',
        )
        return redirect('index')

    return render(request, 'negocio.html')


# ── ViewSet DRF ───────────────────────────────────────────────────────────────
class NegocioPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class NegocioViewSet(viewsets.ModelViewSet):
    queryset = Negocio.objects.filter(estado='aprobado').order_by('-fecha_creacion')
    serializer_class = NegocioSerializer
    pagination_class = NegocioPagination

    def get_queryset(self):
        qs = super().get_queryset()
        cat = (self.request.query_params.get('cat') or '').strip()
        q = (self.request.query_params.get('q') or '').strip()
        since = (self.request.query_params.get('updated_since') or '').strip()
        if cat and cat != 'all':
            qs = qs.filter(tipo=cat)
        if q:
            qs = qs.filter(models.Q(nombre__icontains=q) | models.Q(direccion__icontains=q))
        if since:
            dt = parse_datetime(since)
            if dt is not None:
                if dt.tzinfo is None:
                    from django.utils import timezone
                    dt = timezone.make_aware(dt, timezone.get_current_timezone())
                qs = qs.filter(fecha_modificacion__gt=dt)
        return qs
