from fastapi import WebSocket
from typing import Dict, Optional
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # { room_id: { user_id: WebSocket } }
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
        self.rooms[room_id][user_id] = websocket
        logger.info(f"Connected: {user_id} in room {room_id}")

    def disconnect(self, room_id: str, user_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].pop(user_id, None)
            if not self.rooms[room_id]:
                del self.rooms[room_id]
        logger.info(f"Disconnected: {user_id} from room {room_id}")

    async def send_personal(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

    async def send_to_user(self, room_id: str, user_id: str, message: dict):
        if room_id in self.rooms and user_id in self.rooms[room_id]:
            ws = self.rooms[room_id][user_id]
            try:
                await ws.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending to user {user_id}: {e}")

    async def broadcast_to_room(
        self,
        room_id: str,
        message: dict,
        exclude_user: Optional[str] = None
    ):
        if room_id not in self.rooms:
            return
        disconnected = []
        for uid, ws in self.rooms[room_id].items():
            if uid == exclude_user:
                continue
            try:
                await ws.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting to {uid}: {e}")
                disconnected.append(uid)
        for uid in disconnected:
            self.rooms[room_id].pop(uid, None)

    def get_connection_count(self) -> int:
        return sum(len(users) for users in self.rooms.values())
