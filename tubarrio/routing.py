from django.urls import re_path
from . import consumers  # ajusta al nombre de tu app

websocket_urlpatterns = [
    re_path(r"^ws/negocios/$", consumers.NegociosConsumer.as_asgi()),
]