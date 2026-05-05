from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import logging
import os

from connection_manager import ConnectionManager
from room_service import RoomService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VideoCall Demo", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()
room_service = RoomService()

FRONTEND_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend")

app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_PATH, "static")), name="static")


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "rooms": room_service.get_room_count(),
        "connections": manager.get_connection_count()
    }


@app.get("/")
async def root():
    return FileResponse(os.path.join(FRONTEND_PATH, "index.html"))


@app.get("/room/{room_id}")
async def get_room(room_id: str):
    return FileResponse(os.path.join(FRONTEND_PATH, "room.html"))


@app.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    await manager.connect(websocket, room_id, user_id)
    room_service.join_room(room_id, user_id)

    peers = room_service.get_peers(room_id, user_id)
    await manager.send_personal(websocket, {
        "type": "room_joined",
        "data": {
            "room_id": room_id,
            "user_id": user_id,
            "peers": peers
        }
    })

    await manager.broadcast_to_room(room_id, {
        "type": "user_joined",
        "data": {"user_id": user_id}
    }, exclude_user=user_id)

    logger.info(f"User {user_id} joined room {room_id}. Peers: {peers}")

    try:
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)
            msg_type = message.get("type")
            msg_data = message.get("data", {})
            target_user = message.get("target")

            logger.info(f"[{room_id}] {user_id} -> {msg_type} (target: {target_user})")

            if msg_type in ("offer", "answer", "candidate"):
                payload = {
                    "type": msg_type,
                    "data": msg_data,
                    "from": user_id
                }
                if target_user:
                    await manager.send_to_user(room_id, target_user, payload)
                else:
                    await manager.broadcast_to_room(room_id, payload, exclude_user=user_id)

    except WebSocketDisconnect:
        manager.disconnect(room_id, user_id)
        room_service.leave_room(room_id, user_id)

        await manager.broadcast_to_room(room_id, {
            "type": "user_left",
            "data": {"user_id": user_id}
        })

        logger.info(f"User {user_id} left room {room_id}")
