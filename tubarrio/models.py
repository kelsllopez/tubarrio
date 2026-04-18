from django.db import models
from cloudinary.models import CloudinaryField


class Negocio(models.Model):

    TIPO_CHOICES = [
        ('mini_market', 'Mini Market'),
        ('belleza', 'Belleza'),
        ('comida', 'Comida'),
        ('panaderia', 'Panadería'),
        ('servicios', 'Servicios'),
        ('emprendimiento', 'Emprendimiento'),
    ]

    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('aprobado', 'Aprobado'),
    ]

    DOMICILIO_CHOICES = [
        ('no', 'No, solo en mi local'),
        ('si', 'Sí, voy al domicilio'),
        ('ambos', 'Ambas opciones'),
    ]

    # 🧾 Información básica
    nombre = models.CharField(max_length=100)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    descripcion = models.TextField(blank=True)

    # 📍 Ubicación
    direccion = models.CharField(max_length=200)
    comuna = models.CharField(max_length=100, blank=True)
    ciudad = models.CharField(max_length=100, default='Chile')
    latitud = models.FloatField(blank=True, null=True)
    longitud = models.FloatField(blank=True, null=True)

    # 🕒 Atención
    dias_atencion = models.CharField(max_length=100)
    domicilio = models.CharField(
        max_length=10,
        choices=DOMICILIO_CHOICES,
        default='no',
        help_text='¿Atendés a domicilio?'
    )

    # 📱 Contacto
    whatsapp = models.CharField(max_length=50, blank=True, null=True)
    instagram = models.URLField(blank=True, null=True)
    facebook = models.URLField(blank=True, null=True)

    # ✔️ Confianza
    verificado = models.BooleanField(default=False)

    # 📊 Métricas
    visitas = models.IntegerField(default=0)

    # 🔄 Estado
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='pendiente')

    # ⏱️ Fechas
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['estado', '-fecha_creacion']),
            models.Index(fields=['estado', 'tipo']),
            models.Index(fields=['tipo']),
            models.Index(fields=['fecha_creacion']),
            models.Index(fields=['estado', '-fecha_modificacion']),
            models.Index(fields=['verificado']),
            models.Index(fields=['comuna']),
        ]

    def __str__(self):
        return self.nombre


# 📸 MÚLTIPLES IMÁGENES (AHORA CON CLOUDINARY)
class ImagenNegocio(models.Model):
    negocio = models.ForeignKey(
        Negocio,
        on_delete=models.CASCADE,
        related_name='imagenes'
    )
    # ✅ CloudinaryField - Las imágenes se guardan automáticamente en Cloudinary
    imagen = CloudinaryField(
        'imagen',
        folder='tubarrio/negocios/',  # Carpeta en Cloudinary
        transformation={
            'quality': 'auto:good',    # Calidad automática
            'fetch_format': 'auto',    # WebP si el navegador lo soporta
            'width': 1200,             # Ancho máximo
            'height': 1200,            # Alto máximo
            'crop': 'limit',           # Mantener proporción
        },
        resource_type='image',
        blank=False,
        null=False,
    )
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Imagen de negocio'
        verbose_name_plural = 'Imágenes de negocios'
        ordering = ['-fecha']

    def __str__(self):
        return f"Imagen de {self.negocio.nombre}"
    
    # ✅ Método para obtener URL optimizada
    def get_thumbnail_url(self, width=300, height=300):
        """Devuelve URL de thumbnail optimizado"""
        if self.imagen:
            return self.imagen.build_url(
                width=width,
                height=height,
                crop='fill',
                quality='auto:good',
                fetch_format='auto'
            )
        return None
    
    # ✅ Método para obtener URL de preview
    def get_preview_url(self):
        """Devuelve URL de preview para el admin"""
        return self.get_thumbnail_url(200, 200)