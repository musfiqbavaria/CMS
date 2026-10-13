"""Per-site progress socket. JWT via ?token= (no session cookie with JWT auth)."""

import json
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from apps.core.channels_auth import admin_user_from_token_sync


@database_sync_to_async
def admin_user_from_token(raw: str):
    return admin_user_from_token_sync(raw)


class SiteProgressConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query = parse_qs(self.scope.get("query_string", b"").decode())
        token = (query.get("token") or [None])[0]
        user = await admin_user_from_token(token) if token else None
        if user is None:
            await self.close(code=4401)
            return
        self.group = f"site_{self.scope['url_route']['kwargs']['site_id']}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({"stage": "connected"}))

    async def disconnect(self, code):
        group = getattr(self, "group", None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def site_progress(self, event):
        await self.send(
            text_data=json.dumps({k: v for k, v in event.items() if k != "type"})
        )
