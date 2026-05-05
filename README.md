# 🎥 NexCall — WebRTC Video Call Demo

Real-time 1-to-1 video calling using WebRTC + FastAPI + WebSocket.

---

## 🏗️ Architecture

```
Browser A  ←──── WebSocket signaling ────→  Backend (FastAPI)  ←──── WebSocket ────→  Browser B
     │                                                                                      │
     └──────────────────────── WebRTC P2P Video/Audio Stream ──────────────────────────────┘
                                    (direct, via STUN/TURN)
```

- **Backend**: Relay signals only (offer/answer/ICE candidates) — never touches video
- **Frontend**: WebRTC P2P directly between browsers
- **TURN**: Fallback for NAT traversal (coturn)

---

## 📁 Project Structure

```
videocall/
├── backend/
│   ├── main.py               # FastAPI app + WebSocket endpoint
│   ├── connection_manager.py # WebSocket connection registry
│   ├── room_service.py       # In-memory room management
│   └── requirements.txt
├── frontend/
│   ├── index.html            # Landing page
│   ├── room.html             # Call room page
│   └── static/
│       ├── css/
│       │   ├── main.css      # Landing page styles
│       │   └── room.css      # Room page styles
│       └── js/
│           ├── websocket.js  # WS signaling module
│           ├── webrtc.js     # WebRTC peer connection module
│           ├── ui.js         # UI controller
│           └── app.js        # Main entry point
├── infra/
│   ├── nginx/nginx.conf      # Nginx reverse proxy
│   └── turn/turnserver.conf  # Coturn TURN server config
├── docker/
│   └── Dockerfile.backend
├── docker-compose.yml
└── .env
```

---

## 🚀 Quick Start (Docker)

### Prerequisites
- Docker & Docker Compose installed
- Modern browser (Chrome, Firefox, Edge)

### 1. Clone & start

```bash
cd videocall
docker compose up --build
```

### 2. Open in browser

Open **two tabs** (or two browsers):

```
http://localhost/room/test-room
```

Both tabs → same room → they connect automatically.

---

## 🧪 Local Dev (without Docker)

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

The backend serves the frontend. Open: `http://localhost:8000/room/demo`

---

## 🔌 WebSocket Signaling Protocol

```
Client → Server:
  { "type": "offer",     "data": { "sdp": ... },       "target": "user_id" }
  { "type": "answer",    "data": { "sdp": ... },       "target": "user_id" }
  { "type": "candidate", "data": { "candidate": ... }, "target": "user_id" }

Server → Client:
  { "type": "room_joined", "data": { "room_id": ..., "user_id": ..., "peers": [...] } }
  { "type": "user_joined", "data": { "user_id": ... } }
  { "type": "user_left",   "data": { "user_id": ... } }
  { "type": "offer",       "data": { "sdp": ... }, "from": "user_id" }
  { "type": "answer",      "data": { "sdp": ... }, "from": "user_id" }
  { "type": "candidate",   "data": { "candidate": ... }, "from": "user_id" }
```

---

## 🔐 TURN Server Credentials

Default credentials (for local dev):
- **User**: `nexcall`
- **Password**: `nexcall123`
- **URL**: `turn:localhost:3478`

Change in `.env` and `infra/turn/turnserver.conf`.

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| Camera/mic permission denied | Allow browser permissions |
| Two tabs on same machine don't connect | Should work via loopback; if not, check firewall |
| Black video / no stream | Check DevTools console for ICE failures |
| Works locally but not across network | Configure TURN with your server's public IP |

---

## 📡 Health Check

```
GET http://localhost/health
→ { "status": "ok", "rooms": 1, "connections": 2 }
```

---

## ✅ V1 Feature Checklist

- [x] WebRTC peer-to-peer video + audio
- [x] WebSocket signaling (offer / answer / ICE)
- [x] Room creation via URL `/room/{id}`
- [x] 1-to-1 video call
- [x] Local + remote video display
- [x] Mic / camera toggle
- [x] STUN server (Google)
- [x] TURN server (coturn)
- [x] Docker Compose setup
- [x] Nginx reverse proxy
