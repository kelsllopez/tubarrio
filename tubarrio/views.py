import urllib.parse
import urllib.request
import json

from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from .models import Negocio
from rest_framework import viewsets
from .serializers import NegocioSerializer


# ── Geocodificación automática con Nominatim ──────────────────────────────────
def geocode(direccion, comuna='', ciudad='Chile'):
    """Convierte dirección en lat/lng usando OpenStreetMap Nominatim."""
    texto = ', '.join(filter(None, [direccion, comuna, ciudad]))
    query = urllib.parse.quote(texto)
    url   = f'https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1'
    req   = urllib.request.Request(url, headers={'User-Agent': 'TuBarrio/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=4) as r:
            data = json.loads(r.read())
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception:
        pass
    return None, None


# ── Vista principal — mapa ────────────────────────────────────────────────────
def index(request):
    qs = Negocio.objects.filter(estado='aprobado').order_by('-fecha_creacion')

    negocios_json = json.dumps([
        {
            'id':          n.id,
            'nombre':      n.nombre,
            'cat':         n.tipo,
            'dir':         n.direccion,
            'dias':        n.dias_atencion or '',
            'whatsapp':    n.whatsapp     or '',
            'wsp_publico': 'si' if n.whatsapp else 'no',
            'instagram':   n.instagram    or '',
            'facebook':    n.facebook     or '',
            'lat':         n.latitud,
            'lng':         n.longitud,
        }
        for n in qs
    ], ensure_ascii=False)

    return render(request, '1.html', {'negocios_json': negocios_json})


# ── API JSON para polling cada 30 s ──────────────────────────────────────────
@require_GET
def api_negocios(request):
    qs = Negocio.objects.filter(estado='aprobado').order_by('-fecha_creacion')

    data = [
        {
            'id':          n.id,
            'nombre':      n.nombre,
            'cat':         n.tipo,
            'dir':         n.direccion,
            'dias':        n.dias_atencion or '',
            'whatsapp':    n.whatsapp     or '',
            'wsp_publico': 'si' if n.whatsapp else 'no',
            'instagram':   n.instagram    or '',
            'facebook':    n.facebook     or '',
            'lat':         n.latitud,
            'lng':         n.longitud,
        }
        for n in qs
    ]
    return JsonResponse(data, safe=False)


# ── Formulario de registro ────────────────────────────────────────────────────
def ingresa_tu_negocio(request):
    if request.method == 'POST':
        direccion = request.POST.get('direccion', '').strip()
        comuna    = request.POST.get('comuna',    '').strip()
        ciudad    = request.POST.get('ciudad',    'Chile').strip()

        lat_raw = request.POST.get('latitud',  '').strip()
        lng_raw = request.POST.get('longitud', '').strip()

        try:
            latitud  = float(lat_raw) if lat_raw else None
            longitud = float(lng_raw) if lng_raw else None
        except ValueError:
            latitud = longitud = None

        if latitud is None or longitud is None:
            latitud, longitud = geocode(direccion, comuna, ciudad)

        Negocio.objects.create(
            nombre        = request.POST.get('nombre',        '').strip(),
            tipo          = request.POST.get('tipo',          'otros'),
            direccion     = direccion,
            dias_atencion = request.POST.get('dias_atencion', '').strip(),
            whatsapp      = request.POST.get('whatsapp',     '').strip() or None,
            instagram     = request.POST.get('instagram',    '').strip() or None,
            facebook      = request.POST.get('facebook',     '').strip() or None,
            comuna        = comuna,
            ciudad        = ciudad,
            latitud       = latitud,
            longitud      = longitud,
            estado        = 'pendiente',
        )
        return redirect('index')

    return render(request, 'negocio.html')


# ── ViewSet DRF ────────────────────────────────────────────────────────────────
class NegocioViewSet(viewsets.ModelViewSet):
    queryset = Negocio.objects.all()
    serializer_class = NegocioSerializer