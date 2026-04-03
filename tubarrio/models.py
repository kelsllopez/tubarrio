from django.db import models


class Negocio(models.Model):

    TIPO_CHOICES = [
        ('mini_market', 'Mini Market'),
        ('belleza', 'belleza'),
        ('comida', 'Comida'),
        ('panaderia', 'panaderia'),
        ('servicios', 'servicios'),
        ('emprendimiento', 'emprendimiento'),
    ]

    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('aprobado', 'Aprobado'),
    ]

    nombre        = models.CharField(max_length=100)
    tipo          = models.CharField(max_length=20, choices=TIPO_CHOICES)
    direccion     = models.CharField(max_length=200)
    dias_atencion = models.CharField(max_length=100)

    whatsapp      = models.CharField(max_length=50, blank=True, null=True)
    instagram     = models.URLField(blank=True, null=True)
    facebook      = models.URLField(blank=True, null=True)

    comuna        = models.CharField(max_length=100, blank=True)
    ciudad        = models.CharField(max_length=100, blank=True, default='Chile')
    latitud       = models.FloatField(blank=True, null=True)
    longitud      = models.FloatField(blank=True, null=True)

    estado        = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='pendiente')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['estado', '-fecha_creacion']),
            models.Index(fields=['estado', 'tipo']),
            models.Index(fields=['tipo']),
            models.Index(fields=['fecha_creacion']),
            models.Index(fields=['estado', '-fecha_modificacion']),
        ]

    def __str__(self):
        return self.nombre


class GeocodeCache(models.Model):
    """Cache de resultados Nominatim (clave normalizada por dirección+comuna+ciudad)."""

    clave = models.CharField(max_length=512, unique=True, db_index=True)
    latitud = models.FloatField()
    longitud = models.FloatField()
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cache geocodificación'
        verbose_name_plural = 'Caches geocodificación'

    def __str__(self):
        return self.clave[:80]