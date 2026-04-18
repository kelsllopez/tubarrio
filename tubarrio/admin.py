import json
from django.contrib import admin
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.core.cache import cache
from import_export.admin import ImportExportModelAdmin
from import_export import resources, fields
from import_export.widgets import ForeignKeyWidget
from .models import Negocio, ImagenNegocio


# ─── CLASE BASE CON BOTONES PERSONALIZADOS ─────────────────────────────────────
class CustomImportExportAdmin(ImportExportModelAdmin):
    """Admin base con botones Import/Export estilizados"""
    
    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['custom_css'] = """
        <style>
            .object-tools .import_link {
                background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
                border: none !important;
                color: white !important;
                font-weight: 600 !important;
                padding: 10px 20px !important;
                border-radius: 30px !important;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3) !important;
                margin-right: 10px !important;
                transition: all 0.2s ease !important;
            }
            .object-tools .import_link:hover {
                background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4) !important;
            }
            .object-tools .import_link::before { content: "📥 " !important; }
            
            .object-tools .export_link {
                background: linear-gradient(135deg, #22c55e, #16a34a) !important;
                border: none !important;
                color: white !important;
                font-weight: 600 !important;
                padding: 10px 20px !important;
                border-radius: 30px !important;
                box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3) !important;
                margin-right: 10px !important;
                transition: all 0.2s ease !important;
            }
            .object-tools .export_link:hover {
                background: linear-gradient(135deg, #16a34a, #15803d) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 6px 16px rgba(34, 197, 94, 0.4) !important;
            }
            .object-tools .export_link::before { content: "📤 " !important; }
            
            .object-tools .addlink {
                background: linear-gradient(135deg, #F59E0B, #d97706) !important;
                border: none !important;
                color: white !important;
                font-weight: 600 !important;
                padding: 10px 20px !important;
                border-radius: 30px !important;
                box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3) !important;
                transition: all 0.2s ease !important;
            }
            .object-tools .addlink:hover {
                background: linear-gradient(135deg, #d97706, #b45309) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4) !important;
            }
            .addlink::before { content: "➕ " !important; }
            
            .object-tools {
                display: flex !important;
                gap: 8px !important;
                flex-wrap: wrap !important;
            }
            .object-tools a { text-decoration: none !important; }
            
            .inline-image-preview {
                max-width: 150px;
                max-height: 150px;
                border-radius: 8px;
                border: 2px solid #e2e8f0;
                margin-top: 8px;
            }
        </style>
        """
        return super().changelist_view(request, extra_context)


# ─── RESOURCES ─────────────────────────────────────────────────────────────────
class NegocioResource(resources.ModelResource):
    class Meta:
        model = Negocio
        fields = ('id', 'nombre', 'tipo', 'descripcion', 'direccion', 'comuna', 'ciudad',
                  'latitud', 'longitud', 'dias_atencion', 'domicilio', 'whatsapp', 
                  'instagram', 'facebook', 'verificado', 'visitas', 'estado', 
                  'fecha_creacion', 'fecha_modificacion')
        export_order = fields
        import_id_fields = ['id']


class ImagenNegocioResource(resources.ModelResource):
    negocio = fields.Field(
        column_name='negocio',
        attribute='negocio',
        widget=ForeignKeyWidget(Negocio, field='nombre')
    )
    
    class Meta:
        model = ImagenNegocio
        fields = ('id', 'negocio', 'imagen', 'fecha')
        import_id_fields = ['id']


# ─── INLINE PARA IMÁGENES (DENTRO DE NEGOCIO) ──────────────────────────────────
class ImagenNegocioInline(admin.TabularInline):
    model = ImagenNegocio
    extra = 1
    fields = ('imagen_preview', 'imagen', 'fecha')
    readonly_fields = ('imagen_preview', 'fecha')
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('negocio')
    
    @admin.display(description='Vista previa')
    def imagen_preview(self, obj):
        if obj and obj.pk and obj.imagen:
            return format_html(
                '<img src="{}" class="inline-image-preview" style="max-width:200px;max-height:200px;border-radius:8px;border:2px solid #e2e8f0;"/>',
                obj.imagen.url
            )
        return mark_safe('<span style="color:#888;">—</span>')


# ─── NEGOCIO ADMIN (CON IMÁGENES DENTRO) ───────────────────────────────────────
@admin.register(Negocio)
class NegocioAdmin(CustomImportExportAdmin):
    resource_class = NegocioResource

    class Media:
        css = {'all': ('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',)}
        js = ('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',)

    list_display = (
        'nombre', 'tipo', 'comuna', 'domicilio', 'estado', 
        'verificado', 'visitas', 'ver_mapa_mini', 'fecha_creacion'
    )
    list_filter = ('estado', 'tipo', 'verificado', 'comuna')
    search_fields = ('nombre', 'direccion', 'comuna')
    ordering = ('-fecha_creacion',)
    list_per_page = 25
    list_editable = ('estado', 'verificado')
    date_hierarchy = 'fecha_creacion'
    
    # ✅ LAS IMÁGENES APARECEN DENTRO DEL FORMULARIO DE NEGOCIO
    inlines = [ImagenNegocioInline]
    
    actions = [
        'aprobar_negocios', 
        'marcar_como_pendiente', 
        'marcar_como_verificado',
        'marcar_como_no_verificado',
        'resetear_visitas'
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).only(
            'id', 'nombre', 'tipo', 'direccion', 'comuna', 'ciudad',
            'latitud', 'longitud', 'domicilio', 'estado', 'verificado',
            'visitas', 'fecha_creacion', 'fecha_modificacion', 'descripcion',
            'dias_atencion', 'whatsapp', 'instagram', 'facebook'
        ).prefetch_related('imagenes')

    def get_readonly_fields(self, request, obj=None):
        readonly = ['fecha_creacion', 'fecha_modificacion', 'visitas']
        if obj and obj.pk:
            readonly.append('mapa_preview')
        return readonly

    def get_fieldsets(self, request, obj=None):
        fieldsets = [
            ('📋 Información básica', {
                'fields': (('nombre', 'tipo'), 'descripcion')
            }),
            ('📍 Ubicación', {
                'fields': ('direccion', ('comuna', 'ciudad'), ('latitud', 'longitud'))
            }),
            ('🕒 Atención', {
                'fields': ('dias_atencion', 'domicilio')
            }),
            ('📱 Contacto y redes', {
                'fields': ('whatsapp', 'instagram', 'facebook'),
                'classes': ('wide',)
            }),
            ('📊 Métricas y estado', {
                'fields': (
                    ('estado', 'verificado'), 
                    'visitas', 
                    ('fecha_creacion', 'fecha_modificacion')
                )
            }),
        ]
        
        if obj and obj.pk:
            fieldsets[1][1]['fields'] = (
                'direccion', 
                ('comuna', 'ciudad'), 
                ('latitud', 'longitud'), 
                'mapa_preview'
            )
        
        return fieldsets

    @admin.display(description='🗺️ Mapa')
    def ver_mapa_mini(self, obj):
        if not obj.latitud or not obj.longitud:
            return mark_safe('<span style="color:#555;font-size:0.8rem;">—</span>')
        url = f"https://www.openstreetmap.org/?mlat={obj.latitud}&mlon={obj.longitud}#map=17/{obj.latitud}/{obj.longitud}"
        return format_html(
            '<a href="{}" target="_blank" style="background:#C4501A;color:white;padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;text-decoration:none;">📍 Ver</a>',
            url
        )

    @admin.action(description='✅ Aprobar negocios seleccionados')
    def aprobar_negocios(self, request, queryset):
        updated = queryset.update(estado='aprobado')
        cache.delete('dashboard_stats')
        self.message_user(request, f'✅ {updated} negocio(s) aprobado(s).')

    @admin.action(description='⏳ Marcar como pendiente')
    def marcar_como_pendiente(self, request, queryset):
        updated = queryset.update(estado='pendiente')
        cache.delete('dashboard_stats')
        self.message_user(request, f'⏳ {updated} negocio(s) marcado(s) como pendiente(s).')

    @admin.action(description='✓ Marcar como verificado')
    def marcar_como_verificado(self, request, queryset):
        updated = queryset.update(verificado=True)
        cache.delete('dashboard_stats')
        self.message_user(request, f'✓ {updated} negocio(s) verificado(s).')

    @admin.action(description='✗ Marcar como NO verificado')
    def marcar_como_no_verificado(self, request, queryset):
        updated = queryset.update(verificado=False)
        cache.delete('dashboard_stats')
        self.message_user(request, f'✗ {updated} negocio(s) desmarcado(s).')

    @admin.action(description='🔄 Resetear contador de visitas')
    def resetear_visitas(self, request, queryset):
        updated = queryset.update(visitas=0)
        cache.delete('dashboard_stats')
        self.message_user(request, f'🔄 Visitas reseteadas para {updated} negocio(s).')

    @admin.display(description='🗺️ Ubicación en mapa')
    def mapa_preview(self, obj):
        if not obj or not obj.pk or not obj.latitud or not obj.longitud:
            return mark_safe(
                '<div style="padding:1rem;color:#888;background:#1a1a1a;border-radius:8px;border:1px dashed #444;">'
                '📍 Guarda latitud y longitud para ver el mapa</div>'
            )
        
        nombre = (obj.nombre or '').replace('"', '&quot;').replace("'", "&#39;")
        direccion = (obj.direccion or '').replace('"', '&quot;').replace("'", "&#39;")
        lat, lng = float(obj.latitud), float(obj.longitud)
        
        popup_text = f"{nombre}<br>{direccion}"
        if obj.comuna:
            popup_text += f", {obj.comuna}"
        if obj.ciudad:
            popup_text += f", {obj.ciudad}"
        
        html = f'''
            <div id="mapa-negocio" style="height:380px;border-radius:12px;overflow:hidden;border:2px solid #444;margin-top:8px;"></div>
            <p style="color:#888;font-size:0.8rem;margin-top:6px;">💡 Haz clic en el mapa para mover el marcador</p>
            <script>
            (function() {{
                if (typeof L === "undefined") return;
                setTimeout(function() {{
                    var map = L.map("mapa-negocio").setView([{lat}, {lng}], 16);
                    L.tileLayer("https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png", {{attribution: "© OpenStreetMap"}}).addTo(map);
                    var marker = L.marker([{lat}, {lng}], {{draggable: true}}).addTo(map);
                    marker.bindPopup("{popup_text}").openPopup();
                    function actualizarCampos(latlng) {{
                        document.getElementById("id_latitud").value = latlng.lat.toFixed(10);
                        document.getElementById("id_longitud").value = latlng.lng.toFixed(10);
                    }}
                    marker.on("dragend", function(e) {{ actualizarCampos(e.target.getLatLng()); }});
                    map.on("click", function(e) {{ marker.setLatLng(e.latlng); actualizarCampos(e.latlng); }});
                }}, 100);
            }})();
            </script>
        '''
        return mark_safe(html)


# ─── QUITAR IMAGENNEGOCIO DEL MENÚ DEL ADMIN ───────────────────────────────────
# ❌ NO REGISTRAMOS ImagenNegocio por separado
# admin.site.register(ImagenNegocio, ImagenNegocioAdmin)  ← ESTO NO VA


# ─── DASHBOARD ─────────────────────────────────────────────────────────────────
MESES_ES = {
    1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
    7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
}

TIPO_LABELS = {
    'mini_market': 'Mini Market',
    'belleza': 'Belleza',
    'comida': 'Comida',
    'panaderia': 'Panadería',
    'servicios': 'Servicios',
    'emprendimiento': 'Emprendimiento'
}

original_index = admin.site.__class__.index


def get_dashboard_stats():
    stats = cache.get('dashboard_stats')
    if stats:
        return stats
    
    total = Negocio.objects.count()
    aprobados = Negocio.objects.filter(estado='aprobado').count()
    pendientes = Negocio.objects.filter(estado='pendiente').count()
    con_gps = Negocio.objects.exclude(latitud=None).exclude(longitud=None).count()
    
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
    ] or [{'mes': MESES_ES[timezone.now().month], 'total': 0}]
    
    por_tipo_qs = Negocio.objects.values('tipo').annotate(total=Count('id')).order_by('-total')
    por_tipo = [
        {'tipo': TIPO_LABELS.get(item['tipo'], item['tipo']), 'total': item['total']}
        for item in por_tipo_qs
    ] or [{'tipo': 'Sin datos', 'total': 0}]
    
    ultimos_negocios = list(
        Negocio.objects.only('id', 'nombre', 'tipo', 'estado')
        .order_by('-fecha_creacion')[:7]
    )
    
    stats = {
        'total': total,
        'aprobados': aprobados,
        'pendientes': pendientes,
        'con_gps': con_gps,
        'por_mes': por_mes,
        'por_tipo': por_tipo,
        'ultimos_negocios': ultimos_negocios
    }
    
    cache.set('dashboard_stats', stats, 600)
    return stats


def custom_index(self, request, extra_context=None):
    extra_context = extra_context or {}
    
    cache_key = 'dashboard_html_context'
    cached_context = cache.get(cache_key)
    
    if cached_context:
        extra_context.update(cached_context)
    else:
        stats = get_dashboard_stats()
        context_data = {
            'total_negocios': stats['total'],
            'aprobados': stats['aprobados'],
            'pendientes': stats['pendientes'],
            'con_ubicacion': stats['con_gps'],
            'ultimos_negocios': stats['ultimos_negocios'],
            'por_mes': json.dumps(stats['por_mes']),
            'por_tipo': json.dumps(stats['por_tipo']),
            'title': 'TuBarrio Analytics'
        }
        extra_context.update(context_data)
        cache.set(cache_key, context_data, 300)
    
    return original_index(self, request, extra_context)


admin.site.__class__.index = custom_index