/**
 * WebSocket Signaling Module
 * Manages WS connection and message routing
 */
class SignalingSocket {
  constructor(roomId, userId) {
    this.roomId = roomId;
    this.userId = userId;
    this.ws = null;
    this.handlers = {};
    this.reconnectAttempts = 0;
    this.maxReconnect = 3;
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.ENV?.WS_HOST || location.host;
    const url = `${proto}://${host}/ws/${this.roomId}/${this.userId}`;

    console.log('[WS] Connecting to', url);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
      this._emit('open');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[WS] Received:', msg.type, msg);
        this._emit(msg.type, msg);
        this._emit('message', msg);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    this.ws.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason);
      this._emit('close', event);
      if (this.reconnectAttempts < this.maxReconnect && event.code !== 1000) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      this._emit('error', err);
    };
  }

  send(type, data, target = null) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Not connected, cannot send:', type);
      return;
    }
    const msg = { type, data };
    if (target) msg.target = target;
    this.ws.send(JSON.stringify(msg));
    console.log('[WS] Sent:', type, target ? `-> ${target}` : '');
  }

  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
  }

  off(event, handler) {
    if (!this.handlers[event]) return;
    this.handlers[event] = this.handlers[event].filter(h => h !== handler);
  }

  _emit(event, data) {
    (this.handlers[event] || []).forEach(h => h(data));
  }

  close() {
    if (this.ws) {
      this.ws.close(1000, 'User left');
      this.ws = null;
    }
  }
}
