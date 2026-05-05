/**
 * Main App Entry Point
 * Orchestrates WebSocket, WebRTC, and UI modules
 */
window.ENV = {
  STUN_URL: 'stun:stun.l.google.com:19302',
  TURN_URL: '',   // e.g. 'turn:localhost:3478'
  TURN_USER: 'nexcall',
  TURN_PASS: 'nexcall123',
  WS_HOST: location.host,
};

const app = (() => {
  // Parse room info from URL
  const pathParts = location.pathname.split('/');
  const roomId = pathParts[pathParts.length - 1];
  const userId = 'u_' + Math.random().toString(36).substring(2, 8);

  let socket = null;
  let rtc = null;
  let micEnabled = true;
  let camEnabled = true;
  let peerId = null;

  async function init() {
    UI.init();
    UI.setRoomId(roomId);
    UI.setStatus('Requesting camera & microphone...');

    // Init WebRTC manager
    rtc = new WebRTCManager(null, {
      stunUrl: window.ENV.STUN_URL,
      turnUrl: window.ENV.TURN_URL,
      turnUser: window.ENV.TURN_USER,
      turnPass: window.ENV.TURN_PASS,
    });

    // Get local media
    try {
      await rtc.initLocalStream();
    } catch (e) {
      UI.setStatus('Could not access camera/mic: ' + e.message, 'error');
      return;
    }

    UI.setLocalStream(rtc.localStream);
    UI.setStatus('Connecting to room...');

    // Init WebSocket
    socket = new SignalingSocket(roomId, userId);
    rtc.socket = socket;

    // WebSocket events
    socket.on('open', () => {
      console.log('[APP] WS open');
    });

    socket.on('room_joined', async (msg) => {
      const peers = msg.data.peers || [];
      UI.setStatus(`Room joined. Users here: ${peers.length}`, 'info');
      console.log('[APP] Room joined, existing peers:', peers);

      if (peers.length > 0) {
        // Someone is already in the room — initiate call
        peerId = peers[0];
        UI.setRemotePeerId(peerId);
        UI.setStatus('Initiating call with peer...');
        await rtc.createOffer(peerId);
      } else {
        UI.setStatus('Waiting for peer to join...');
      }
    });

    socket.on('user_joined', async (msg) => {
      peerId = msg.data.user_id;
      UI.setRemotePeerId(peerId);
      UI.setStatus('Peer joined! Setting up connection...');
      console.log('[APP] Peer joined:', peerId);
      // The joining peer will initiate offer
    });

    socket.on('offer', async (msg) => {
      console.log('[APP] Received offer from', msg.from);
      peerId = msg.from;
      UI.setRemotePeerId(peerId);
      UI.setStatus('Received call offer, answering...');
      await rtc.handleOffer(msg.data, msg.from);
    });

    socket.on('answer', async (msg) => {
      console.log('[APP] Received answer from', msg.from);
      await rtc.handleAnswer(msg.data);
      UI.setStatus('Answer received, finalizing connection...');
    });

    socket.on('candidate', async (msg) => {
      console.log('[APP] Received ICE candidate');
      await rtc.handleCandidate(msg.data);
    });

    socket.on('user_left', (msg) => {
      console.log('[APP] Peer left:', msg.data.user_id);
      if (msg.data.user_id === peerId) {
        peerId = null;
        UI.setConnected(false);
        UI.showRemoteWaiting();
        UI.setStatus('Peer has left the room. Waiting for new peer...', 'info');
        UI.showToast('Peer disconnected');
      }
    });

    socket.on('error', () => {
      UI.setStatus('WebSocket error. Please refresh.', 'error');
    });

    socket.on('close', () => {
      UI.setConnected(false);
    });

    // WebRTC events
    rtc.on('localStream', (stream) => {
      UI.setLocalStream(stream);
    });

    rtc.on('remoteStream', (stream) => {
      UI.setRemoteStream(stream);
      UI.setConnected(true);
      UI.setStatus('Connected!', 'done');
      UI.showToast('🎉 Connected to peer');
    });

    rtc.on('connectionState', (state) => {
      console.log('[APP] Connection state:', state);
      if (state === 'connected') {
        UI.setConnected(true);
        UI.setStatus('', 'done');
      } else if (state === 'failed' || state === 'disconnected') {
        UI.setConnected(false);
        UI.setStatus('Connection lost. Waiting...', 'error');
      }
    });

    rtc.on('iceState', (state) => {
      if (state === 'checking') UI.setStatus('Establishing connection...', 'info');
      if (state === 'connected') UI.setStatus('', 'done');
      if (state === 'failed') UI.setStatus('ICE failed — check TURN config', 'error');
    });

    rtc.on('error', (err) => {
      UI.showToast('Error: ' + err.message);
      console.error('[APP] RTC error:', err);
    });

    socket.connect();
  }

  function toggleMic() {
    micEnabled = rtc ? rtc.toggleMic() : !micEnabled;
    UI.updateMicBtn(micEnabled);
    UI.showToast(micEnabled ? 'Microphone on' : 'Microphone muted');
  }

  function toggleCam() {
    camEnabled = rtc ? rtc.toggleCam() : !camEnabled;
    UI.updateCamBtn(camEnabled);
    UI.showToast(camEnabled ? 'Camera on' : 'Camera off');
  }

  function endCall() {
    if (rtc) rtc.stopAll();
    if (socket) socket.close();
    window.location.href = '/';
  }

  // Start
  init();

  return { toggleMic, toggleCam, endCall };
})();
