from django.urls import path
from . import views
from rest_framework.routers import DefaultRouter
from .views import NegocioViewSet

router = DefaultRouter()
router.register(r'negocios', NegocioViewSet)

urlpatterns = [
    path('', views.index, name='index'),
    path('ingresa_tu_negocio/', views.ingresa_tu_negocio, name='ingresa_tu_negocio'),
    path('api/negocios/', views.api_negocios, name='api_negocios'),
    path('api/healthz/', views.healthz, name='healthz'),
]

urlpatterns += router.urls