/**
 * WebRTC Module
 * Handles peer connection, media streams, and negotiation
 */
class WebRTCManager {
  constructor(signalingSocket, config) {
    this.socket = signalingSocket;
    this.config = config;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.peerId = null;
    this.handlers = {};
    this.iceCandidateQueue = [];
    this.isSettingRemoteDesc = false;
  }

  get iceConfig() {
    return {
      iceServers: [
        { urls: this.config.stunUrl || 'stun:stun.l.google.com:19302' },
        ...(this.config.turnUrl ? [{
          urls: this.config.turnUrl,
          username: this.config.turnUser,
          credential: this.config.turnPass,
        }] : [])
      ]
    };
  }

  async initLocalStream(videoEnabled = true, audioEnabled = true) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
        audio: audioEnabled
      });
      this._emit('localStream', this.localStream);
      return this.localStream;
    } catch (e) {
      console.error('[RTC] getUserMedia error:', e);
      this._emit('error', { type: 'media', message: e.message });
      throw e;
    }
  }

  createPeerConnection(peerId) {
    if (this.peerConnection) {
      console.warn('[RTC] Closing existing peer connection');
      this.peerConnection.close();
    }

    this.peerId = peerId;
    this.peerConnection = new RTCPeerConnection(this.iceConfig);
    console.log('[RTC] Created peer connection for', peerId);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // ICE candidate handler
    this.peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        console.log('[RTC] ICE candidate:', candidate.type);
        this.socket.send('candidate', { candidate: candidate.toJSON() }, peerId);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      console.log('[RTC] ICE state:', state);
      this._emit('iceState', state);
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('[RTC] Connection state:', state);
      this._emit('connectionState', state);
    };

    this.peerConnection.ontrack = (event) => {
      console.log('[RTC] Remote track received:', event.track.kind);
      this.remoteStream = event.streams[0];
      this._emit('remoteStream', this.remoteStream);
    };

    return this.peerConnection;
  }

  async createOffer(peerId) {
    this.createPeerConnection(peerId);
    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await this.peerConnection.setLocalDescription(offer);
      console.log('[RTC] Created offer');
      this.socket.send('offer', { sdp: this.peerConnection.localDescription }, peerId);
    } catch (e) {
      console.error('[RTC] createOffer error:', e);
      this._emit('error', { type: 'offer', message: e.message });
    }
  }

  async handleOffer(offer, fromId) {
    this.createPeerConnection(fromId);
    try {
      this.isSettingRemoteDesc = true;
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer.sdp));
      this.isSettingRemoteDesc = false;
      await this._drainCandidateQueue();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('[RTC] Created answer');
      this.socket.send('answer', { sdp: this.peerConnection.localDescription }, fromId);
    } catch (e) {
      console.error('[RTC] handleOffer error:', e);
      this._emit('error', { type: 'answer', message: e.message });
    }
  }

  async handleAnswer(answer) {
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer.sdp));
      console.log('[RTC] Remote description set (answer)');
      await this._drainCandidateQueue();
    } catch (e) {
      console.error('[RTC] handleAnswer error:', e);
    }
  }

  async handleCandidate(data) {
    if (!this.peerConnection) return;
    const candidate = new RTCIceCandidate(data.candidate);
    if (this.isSettingRemoteDesc || !this.peerConnection.remoteDescription) {
      console.log('[RTC] Queuing ICE candidate');
      this.iceCandidateQueue.push(candidate);
    } else {
      try {
        await this.peerConnection.addIceCandidate(candidate);
      } catch (e) {
        console.error('[RTC] addIceCandidate error:', e);
      }
    }
  }

  async _drainCandidateQueue() {
    while (this.iceCandidateQueue.length) {
      const candidate = this.iceCandidateQueue.shift();
      try {
        await this.peerConnection.addIceCandidate(candidate);
        console.log('[RTC] Drained queued ICE candidate');
      } catch (e) {
        console.error('[RTC] Drain candidate error:', e);
      }
    }
  }

  toggleMic() {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      return track.enabled;
    }
    return false;
  }

  toggleCam() {
    if (!this.localStream) return false;
    const track = this.localStream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      return track.enabled;
    }
    return false;
  }

  stopAll() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
  }

  _emit(event, data) {
    (this.handlers[event] || []).forEach(h => h(data));
  }
}
