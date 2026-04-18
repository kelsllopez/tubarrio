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
from .models import Negocio, ImagenNegocio
from .rate_limit import is_rate_limited
from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination
from .serializers import NegocioSerializer


_geocode_memory_cache = {}


def _geocode_cache_key(direccion: str, comuna: str, ciudad: str) -> str:
    raw = '|'.join((direccion or '', comuna or '', ciudad or '')).strip().lower()
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:64]


def geocode(direccion, comuna='', ciudad='Chile'):
    """
    Convierte dirección en lat/lng usando OpenStreetMap Nominatim.
    Usa caché en memoria y caché de Django.
    """
    clave = _geocode_cache_key(direccion, comuna, ciudad)
    
    cached = cache.get(f'geocode_{clave}')
    if cached:
        return cached['lat'], cached['lng']
    
    if clave in _geocode_memory_cache:
        lat, lng = _geocode_memory_cache[clave]
        cache.set(f'geocode_{clave}', {'lat': lat, 'lng': lng}, timeout=86400 * 30)  # 30 días
        return lat, lng

    texto = ', '.join(filter(None, [direccion, comuna, ciudad]))
    query = urllib.parse.quote(texto)
    url = f'https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1'
    req = urllib.request.Request(url, headers={'User-Agent': 'TuBarrio/1.0'})
    
    try:
        with urllib.request.urlopen(req, timeout=4) as r:
            data = json.loads(r.read())
            if data:
                lat, lng = float(data[0]['lat']), float(data[0]['lon'])
                # Guardar en caché
                _geocode_memory_cache[clave] = (lat, lng)
                cache.set(f'geocode_{clave}', {'lat': lat, 'lng': lng}, timeout=86400 * 30)
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

DOMICILIO_LABELS = {
    'no': 'No, solo en mi local',
    'si': 'Sí, voy al domicilio',
    'ambos': 'Ambas opciones',
}

BBOX_MAX_SPAN_DEG = 2.0
API_MAX_LIMIT = 2000
API_DEFAULT_LIMIT = 500


def _negocio_dict(n, include_updated: bool = True):
    """Convierte un diccionario de negocio al formato esperado por el frontend"""
    d = {
        'id': n['id'],
        'nombre': n['nombre'],
        'cat': n['tipo'],
        'color': CAT_COLORES.get(n['tipo'], '#888888'),
        'dir': n['direccion'],
        'dias': n['dias_atencion'] or '',
        'domicilio': n.get('domicilio', 'no'),
        'domicilio_label': DOMICILIO_LABELS.get(n.get('domicilio', 'no'), 'No especificado'),
        'whatsapp': n['whatsapp'] or '',
        'instagram': n['instagram'] or '',
        'facebook': n['facebook'] or '',
        'lat': n['latitud'],
        'lng': n['longitud'],
        'comuna': n.get('comuna') or '',
        'ciudad': n.get('ciudad') or 'Chile',
        'verificado': n.get('verificado', False),
        'visitas': n.get('visitas', 0),
        'descripcion': n.get('descripcion') or '',
        'imagenes': n.get('imagenes', []),
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


def index(request):
    """Vista principal que muestra el mapa con todos los negocios aprobados"""
    negocios_qs = Negocio.objects.filter(estado='aprobado').prefetch_related('imagenes').order_by('-fecha_creacion')
    
    negocios_data = []
    for negocio in negocios_qs:
        imagenes = []
        for img in negocio.imagenes.all():
            img_url = img.imagen.url
            if img_url.startswith('/'):
                img_url = request.build_absolute_uri(img_url)
            imagenes.append(img_url)
        
        negocios_data.append({
            'id': negocio.id,
            'nombre': negocio.nombre,
            'tipo': negocio.tipo,
            'direccion': negocio.direccion,
            'dias_atencion': negocio.dias_atencion,
            'domicilio': negocio.domicilio,
            'whatsapp': negocio.whatsapp,
            'instagram': negocio.instagram,
            'facebook': negocio.facebook,
            'latitud': negocio.latitud,
            'longitud': negocio.longitud,
            'fecha_modificacion': negocio.fecha_modificacion,
            'comuna': negocio.comuna,
            'ciudad': negocio.ciudad,
            'verificado': negocio.verificado,
            'visitas': negocio.visitas,
            'descripcion': negocio.descripcion,
            'imagenes': imagenes,
        })
    
    negocios_formateados = [_negocio_dict(n, True) for n in negocios_data]
    
    negocios_json = json.dumps(
        negocios_formateados,
        ensure_ascii=False,
        default=str
    )

    return render(request, 'index.html', {'negocios_json': negocios_json})


@require_GET
@cache_control(no_cache=True)
def api_negocios(request):
    """API para polling y actualizaciones en tiempo real"""
    if is_rate_limited(request, 'api_negocios', limit=180, window_seconds=60):
        return JsonResponse({'error': 'Demasiadas solicitudes. Intenta en unos segundos.'}, status=429)

    cat = (request.GET.get('cat') or '').strip()
    q = (request.GET.get('q') or '').strip()
    limit_raw = (request.GET.get('limit') or '').strip()
    bbox = (request.GET.get('bbox') or '').strip()
    updated_since_raw = (request.GET.get('updated_since') or '').strip()
    after_id_raw = (request.GET.get('after_id') or '').strip()
    meta = (request.GET.get('meta') or '').strip() in ('1', 'true', 'yes')

    qs = Negocio.objects.filter(estado='aprobado').prefetch_related('imagenes')
    
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
            return JsonResponse({'error': 'bbox inválido o demasiado grande'}, status=400)
        min_lng, min_lat, max_lng, max_lat = bbox_parsed
        qs = qs.filter(
            latitud__gte=min_lat, latitud__lte=max_lat,
            longitud__gte=min_lng, longitud__lte=max_lng,
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
            limit = max(1, min(limit, API_MAX_LIMIT))
        except ValueError:
            limit = API_DEFAULT_LIMIT

    negocios = qs[:limit]
    
    data = []
    for negocio in negocios:
        imagenes = []
        for img in negocio.imagenes.all():
            img_url = img.imagen.url
            if img_url.startswith('/'):
                img_url = request.build_absolute_uri(img_url)
            imagenes.append(img_url)
        
        data.append({
            'id': negocio.id,
            'nombre': negocio.nombre,
            'tipo': negocio.tipo,
            'direccion': negocio.direccion,
            'dias_atencion': negocio.dias_atencion,
            'domicilio': negocio.domicilio,
            'whatsapp': negocio.whatsapp,
            'instagram': negocio.instagram,
            'facebook': negocio.facebook,
            'latitud': negocio.latitud,
            'longitud': negocio.longitud,
            'fecha_modificacion': negocio.fecha_modificacion,
            'comuna': negocio.comuna,
            'ciudad': negocio.ciudad,
            'verificado': negocio.verificado,
            'visitas': negocio.visitas,
            'descripcion': negocio.descripcion,
            'imagenes': imagenes,
        })
    
    formatted_data = [_negocio_dict(n, True) for n in data]

    etag_src = '|'.join(
        f"{n['id']}:{n['fecha_modificacion'].timestamp() if n.get('fecha_modificacion') else 0:.3f}"
        for n in data
    )
    etag = '"' + hashlib.sha256(etag_src.encode('utf-8')).hexdigest()[:16] + '"'

    if request.headers.get('If-None-Match') == etag and not meta:
        resp = HttpResponse(status=304)
        resp['ETag'] = etag
        return resp

    if meta:
        payload = {'results': formatted_data, 'count': len(formatted_data)}
        resp = JsonResponse(payload)
    else:
        resp = JsonResponse(formatted_data, safe=False)

    resp['ETag'] = etag
    resp['Last-Modified'] = http_date(now().timestamp())
    resp['Access-Control-Allow-Origin'] = '*'
    return resp


@require_GET
def healthz(request):
    """GET /api/healthz/ — DB y app vivos."""
    try:
        connection.ensure_connection()
        ok = True
    except Exception:
        ok = False
    status = 200 if ok else 503
    return JsonResponse({'ok': ok, 'service': 'tubarrio'}, status=status)


def ingresa_tu_negocio(request):
    """Vista para registrar un nuevo negocio"""
    if request.method == 'POST':
        if is_rate_limited(request, 'ingresa_negocio', limit=10, window_seconds=3600):
            return HttpResponse(
                'Demasiados intentos de registro desde esta IP. Intenta más tarde.',
                status=429,
                content_type='text/plain; charset=utf-8',
            )

        nombre = request.POST.get('nombre', '').strip()
        descripcion = request.POST.get('descripcion', '').strip()
        direccion = request.POST.get('direccion', '').strip()
        comuna = request.POST.get('comuna', '').strip()
        ciudad = request.POST.get('ciudad', 'Chile').strip()
        dias_atencion = request.POST.get('dias_atencion', '').strip()
        
        domicilio = request.POST.get('domicilio', 'no').strip()
        if domicilio not in ['no', 'si', 'ambos']:
            domicilio = 'no'
        
        tipo_recibido = request.POST.get('tipo', '').strip()
        tipo = tipo_recibido if tipo_recibido in TIPOS_VALIDOS else 'emprendimiento'
        
        wsp_publico = request.POST.get('wsp_publico', 'no').strip()
        whatsapp_raw = request.POST.get('whatsapp', '').strip() or None
        whatsapp = whatsapp_raw if wsp_publico == 'si' else None
        
        instagram = request.POST.get('instagram', '').strip() or None
        facebook = request.POST.get('facebook', '').strip() or None
        
        lat_raw = request.POST.get('latitud', '').strip()
        lng_raw = request.POST.get('longitud', '').strip()
        try:
            latitud = float(lat_raw) if lat_raw else None
            longitud = float(lng_raw) if lng_raw else None
        except ValueError:
            latitud = longitud = None

        if latitud is None or longitud is None:
            latitud, longitud = geocode(direccion, comuna, ciudad)

        negocio = Negocio.objects.create(
            nombre=nombre,
            tipo=tipo,
            descripcion=descripcion,
            direccion=direccion,
            comuna=comuna,
            ciudad=ciudad or 'Chile',
            latitud=latitud,
            longitud=longitud,
            dias_atencion=dias_atencion,
            domicilio=domicilio,
            whatsapp=whatsapp,
            instagram=instagram,
            facebook=facebook,
            estado='pendiente',
        )
        
        imagenes = request.FILES.getlist('imagenes')
        
        if not imagenes:
            i = 0
            while True:
                imagen_key = f'imagen_{i}'
                if imagen_key in request.FILES:
                    imagenes.append(request.FILES[imagen_key])
                    i += 1
                else:
                    break
        
        for key in request.FILES.keys():
            if key.startswith('imagen_') and key not in [f'imagen_{i}' for i in range(len(imagenes))]:
                imagenes.append(request.FILES[key])
        
        imagenes_guardadas = 0
        for imagen in imagenes:
            if imagen: 
                try:
                    ImagenNegocio.objects.create(
                        negocio=negocio,
                        imagen=imagen
                    )
                    imagenes_guardadas += 1
                except Exception as e:
                    print(f"Error al guardar imagen: {e}")
        
        # Debug: imprimir cuántas imágenes se guardaron
        print(f"📸 Negocio '{nombre}' creado con {imagenes_guardadas} imágenes")
        
        # Si no se guardaron imágenes pero se esperaban, mostrar advertencia
        total_fotos = request.POST.get('total_fotos', '0')
        if total_fotos.isdigit() and int(total_fotos) > 0 and imagenes_guardadas == 0:
            print(f"⚠️ ADVERTENCIA: Se esperaban {total_fotos} fotos pero no se guardó ninguna")
        
        # Limpiar caché del dashboard
        cache.delete('dashboard_stats')
        
        return redirect('index')

    return render(request, 'negocio.html')


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