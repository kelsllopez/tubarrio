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

    def __str__(self):
        return self.nombre