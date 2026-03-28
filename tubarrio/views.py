from django.shortcuts import render, redirect
from django.http import JsonResponse
from .models import Negocio
import urllib.request
import json
from .serializers import NegocioSerializer
from rest_framework import viewsets

def index(request):
    negocios = Negocio.objects.filter(estado='aprobado')
    return render(request, '1.html', {'negocios': negocios})

 
def ingresa_tu_negocio(request):
    if request.method == 'POST':
 
        # Coordenadas geocodificadas desde el formulario
        lat_raw = request.POST.get('latitud', '').strip()
        lng_raw = request.POST.get('longitud', '').strip()
 
        try:
            latitud = float(lat_raw) if lat_raw else None
        except ValueError:
            latitud = None
 
        try:
            longitud = float(lng_raw) if lng_raw else None
        except ValueError:
            longitud = None
 
        Negocio.objects.create(
            nombre        = request.POST.get('nombre', '').strip(),
            tipo          = request.POST.get('tipo', 'otros'),
            direccion     = request.POST.get('direccion', '').strip(),
            dias_atencion = request.POST.get('dias_atencion', '').strip(),
            descripcion   = request.POST.get('descripcion', '').strip() or None,
            whatsapp      = request.POST.get('whatsapp', '').strip() or None,
            instagram     = request.POST.get('instagram', '').strip() or None,
            facebook      = request.POST.get('instagram', '').strip() or None,
            comuna        = request.POST.get('comuna', '').strip(),
            ciudad        = request.POST.get('ciudad', '').strip(),          
            latitud       = latitud,
            longitud      = longitud,
            estado        = 'pendiente',
        )
        return render(request, 'negocio.html', {'enviado': True})
 
    return render(request, 'negocio.html')
 

def geocode(direccion):
    """Usa Nominatim (OpenStreetMap) gratis, sin API key"""
    query = urllib.parse.quote(f"{direccion}, Chile")
    url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1"
    req = urllib.request.Request(url, headers={'User-Agent': 'TuBarrio/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=3) as r:
            data = json.loads(r.read())
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
    except:
        pass
    return None, None

def api_negocios(request):
    qs = Negocio.objects.filter(estado='aprobado')
    result = []

    for n in qs:
        lat, lng = n.latitud, n.longitud

        if lat is None or lng is None:
            direccion_completa = f"{n.direccion}, {n.comuna}, {n.ciudad}, Chile"
            lat, lng = geocode(direccion_completa)

            if lat is not None:
                n.latitud = lat
                n.longitud = lng
                n.save(update_fields=['latitud', 'longitud'])

        result.append({
            'id': n.id,
            'nombre': n.nombre,
            'cat': n.tipo,
            'dir': n.direccion,
            'comuna': n.comuna,
            'ciudad': n.ciudad,
            'dias': n.dias_atencion,
            'descripcion': n.descripcion or '',
            'instagram': n.instagram or '',
            'facebook': n.facebook or '',
            'lat': float(lat) if lat is not None else None,
            'lng': float(lng) if lng is not None else None,
        })

    return JsonResponse(result, safe=False)


class NegocioViewSet(viewsets.ModelViewSet):
    queryset = Negocio.objects.all()
    serializer_class = NegocioSerializer