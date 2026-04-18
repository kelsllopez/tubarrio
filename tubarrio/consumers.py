import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core import serializers


class NegociosConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer para emitir actualizaciones de negocios en tiempo real.
    Todos los clientes conectados se unen al grupo 'negocios_live'.
    Cuando se crea/edita un negocio, se llama channel_layer.group_send()
    y todos los browsers reciben el evento al instante.
    """

    GROUP_NAME = "negocios_live"

    async def connect(self):
        # Unir al grupo compartido
        await self.channel_layer.group_add(self.GROUP_NAME, self.channel_name)
        await self.accept()

        negocios = await self.get_negocios()
        await self.send(text_data=json.dumps({
            "type": "snapshot",
            "negocios": negocios,
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.GROUP_NAME, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        pass

    async def negocio_nuevo(self, event):
        """Un negocio nuevo fue creado."""
        await self.send(text_data=json.dumps({
            "type": "negocio_nuevo",
            "negocio": event["negocio"],
        }))

    async def negocio_actualizado(self, event):
        """Un negocio existente fue modificado."""
        await self.send(text_data=json.dumps({
            "type": "negocio_actualizado",
            "negocio": event["negocio"],
        }))

    async def negocio_eliminado(self, event):
        """Un negocio fue eliminado."""
        await self.send(text_data=json.dumps({
            "type": "negocio_eliminado",
            "id": event["id"],
        }))


    @database_sync_to_async
    def get_negocios(self):    
        from .models import Negocio  
        qs = Negocio.objects.filter(activo=True)
        return [negocio_to_dict(n) for n in qs]


def negocio_to_dict(n):
    return {
        "id":          n.id,
        "nombre":      n.nombre,
        "cat":         n.tipo,
        "dir":         n.direccion,
        "dias":        n.dias_atencion or "",
        "instagram":   n.instagram or "",
        "facebook":    n.facebook or "",
        "whatsapp":    n.whatsapp or "",
        "wsp_publico": n.wsp_publico or "no",
        "lat":         float(n.latitud) if n.latitud else None,
        "lng":         float(n.longitud) if n.longitud else None,
    }