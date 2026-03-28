import json
from django.contrib import admin
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncMonth
from .models import Negocio


@admin.register(Negocio)
class NegocioAdmin(admin.ModelAdmin):

    class Media:
        css = {'all': ('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',)}
        js = ('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',)

    list_display = (
        'nombre', 'tipo', 'direccion', 'estado', 'ver_mapa_mini', 'fecha_creacion'
    )
    list_filter = ('tipo', 'estado', 'fecha_creacion')
    search_fields = ('nombre', 'direccion', 'descripcion')
    ordering = ('-fecha_creacion',)

    actions = ['aprobar_negocios']

    def get_readonly_fields(self, request, obj=None):
        """
        Solo agrega mapa_preview como readonly si el objeto YA existe (edición).
        En creación (obj=None) lo omitimos para evitar el crash de Jazzmin.
        """
        if obj and obj.pk:
            return ('mapa_preview',)
        return ()

    def get_fieldsets(self, request, obj=None):
        """
        En creación, quitamos mapa_preview del fieldset de Ubicación.
        En edición lo mostramos normalmente con el mapa interactivo.
        """
        if obj and obj.pk:
            return (
                ('Información básica', {
                    'fields': ('nombre', 'tipo', 'descripcion')
                }),
                ('Ubicación', {
                    'fields': ('ciudad', 'comuna', 'direccion', 'latitud', 'longitud', 'mapa_preview')
                }),
                ('Atención', {
                    'fields': ('dias_atencion',)
                }),
                ('Contacto (opcional)', {
                    'fields': ('whatsapp', 'instagram', 'facebook')
                }),
                ('Estado', {
                    'fields': ('estado',)
                }),
            )
        else:
            # Creación: sin mapa_preview para evitar el crash de Jazzmin
            return (
                ('Información básica', {
                    'fields': ('nombre', 'tipo', 'descripcion')
                }),
                ('Ubicación', {
                    'fields': ('ciudad', 'comuna', 'direccion', 'latitud', 'longitud')
                }),
                ('Atención', {
                    'fields': ('dias_atencion',)
                }),
                ('Contacto (opcional)', {
                    'fields': ('whatsapp', 'instagram', 'facebook')
                }),
                ('Estado', {
                    'fields': ('estado',)
                }),
            )

    def aprobar_negocios(self, request, queryset):
        queryset.update(estado='aprobado')
    aprobar_negocios.short_description = "Aprobar negocios seleccionados"

    def mapa_preview(self, obj):
        if not obj or not obj.pk or not obj.latitud or not obj.longitud:
            return mark_safe(
                '<div style="padding:1rem;color:#888;background:#1a1a1a;'
                'border-radius:8px;border:1px dashed #444;">'
                '📍 Guarda latitud y longitud para ver el mapa</div>'
            )

        nombre    = (obj.nombre or '').replace('"', '&quot;').replace("'", "&#39;")
        direccion = (obj.direccion or '').replace('"', '&quot;').replace("'", "&#39;")
        lat = float(obj.latitud)
        lng = float(obj.longitud)

        html = (
            '<div id="mapa-negocio" style="height:380px;border-radius:12px;'
            'overflow:hidden;border:2px solid #444;margin-top:8px;"></div>'
            '<p style="color:#888;font-size:0.8rem;margin-top:6px;">'
            '💡 Haz clic en el mapa para mover el marcador y actualizar las coordenadas'
            '</p>'
            '<script>'
            'document.addEventListener("DOMContentLoaded", function() {'
            '  var map = L.map("mapa-negocio").setView([' + str(lat) + ', ' + str(lng) + '], 16);'
            '  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {'
            '    attribution: "© OpenStreetMap"'
            '  }).addTo(map);'
            '  var marker = L.marker([' + str(lat) + ', ' + str(lng) + '], {draggable: true}).addTo(map);'
            '  marker.bindPopup("<b>' + nombre + '</b><br>' + direccion + '").openPopup();'
            '  function actualizarCampos(latlng) {'
            '    var latField = document.getElementById("id_latitud");'
            '    var lngField = document.getElementById("id_longitud");'
            '    if (latField) latField.value = latlng.lat.toFixed(10);'
            '    if (lngField) lngField.value = latlng.lng.toFixed(10);'
            '  }'
            '  marker.on("dragend", function(e) { actualizarCampos(e.target.getLatLng()); });'
            '  map.on("click", function(e) { marker.setLatLng(e.latlng); actualizarCampos(e.latlng); });'
            '});'
            '</script>'
        )
        return mark_safe(html)

    mapa_preview.short_description = "🗺️ Ubicación en mapa"

    def ver_mapa_mini(self, obj):
        if not obj.latitud or not obj.longitud:
            return format_html('<span style="color:#555;font-size:0.8rem;">—</span>')
        url = (
            f"https://www.openstreetmap.org/?mlat={obj.latitud}"
            f"&mlon={obj.longitud}#map=17/{obj.latitud}/{obj.longitud}"
        )
        return format_html(
            '<a href="{}" target="_blank" style="background:#C4501A;color:white;'
            'padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;'
            'text-decoration:none;">📍 Ver</a>',
            url
        )
    ver_mapa_mini.short_description = "Mapa"


# ── Dashboard con datos reales para los gráficos ──────────
MESES_ES = {
    1:'Ene', 2:'Feb', 3:'Mar', 4:'Abr', 5:'May', 6:'Jun',
    7:'Jul', 8:'Ago', 9:'Sep', 10:'Oct', 11:'Nov', 12:'Dic'
}

TIPO_LABELS = {
    'mini_market': 'Mini Market',
    'peluqueria':  'Peluquería',
    'comida':      'Comida',
    'otros':       'Otros',
}

original_index = admin.site.__class__.index

def custom_index(self, request, extra_context=None):
    extra_context = extra_context or {}

    total      = Negocio.objects.count()
    aprobados  = Negocio.objects.filter(estado='aprobado').count()
    pendientes = Negocio.objects.filter(estado='pendiente').count()
    con_gps    = Negocio.objects.exclude(latitud=None).exclude(longitud=None).count()

    from datetime import timedelta
    hace_6_meses = timezone.now() - timedelta(days=180)
    por_mes_qs = (
        Negocio.objects
        .filter(fecha_creacion__gte=hace_6_meses)
        .annotate(mes=TruncMonth('fecha_creacion'))
        .values('mes')
        .annotate(total=Count('id'))
        .order_by('mes')
    )
    por_mes = [
        {'mes': MESES_ES[item['mes'].month], 'total': item['total']}
        for item in por_mes_qs
    ]
    if not por_mes:
        por_mes = [{'mes': 'Mar', 'total': total}]

    por_tipo_qs = (
        Negocio.objects
        .values('tipo')
        .annotate(total=Count('id'))
        .order_by('-total')
    )
    por_tipo = [
        {'tipo': TIPO_LABELS.get(item['tipo'], item['tipo']), 'total': item['total']}
        for item in por_tipo_qs
    ]
    if not por_tipo:
        por_tipo = [{'tipo': 'Sin datos', 'total': 0}]

    extra_context.update({
        'total_negocios':   total,
        'aprobados':        aprobados,
        'pendientes':       pendientes,
        'con_ubicacion':    con_gps,
        'ultimos_negocios': Negocio.objects.order_by('-fecha_creacion')[:7],
        'por_mes':          json.dumps(por_mes),
        'por_tipo':         json.dumps(por_tipo),
        'today':            timezone.now().strftime('%d de %B, %Y'),
    })
    return original_index(self, request, extra_context)

admin.site.__class__.index = custom_index