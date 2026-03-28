"""
asgi.py — reemplaza el tuyo con este.
Combina HTTP (Django) + WebSocket (Channels) en un solo proceso.
"""
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "projecto.settings")  # ← cambia "tuproyecto"

django_asgi_app = get_asgi_application()

# Importar después de configurar el entorno Django
from tubarrio.routing import websocket_urlpatterns  # ← cambia "tuapp" por tu app

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})