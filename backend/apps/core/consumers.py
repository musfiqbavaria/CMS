"""WebSocket echo consumer: proves Daphne + Channels + Redis layer."""

import json

from channels.generic.websocket import AsyncWebsocketConsumer


class EchoConsumer(AsyncWebsocketConsumer):
    async def connect(self) -> None:
        await self.accept()
        await self.send(
            text_data=json.dumps({"status": "connected", "channel": "echo"})
        )

    async def receive(self, text_data=None, bytes_data=None, **kwargs) -> None:
        payload = text_data if text_data is not None else ""
        await self.send(text_data=json.dumps({"echo": payload}))
