/**
 * UI Controller Module
 */
const UI = {
  elements: {},

  init() {
    this.elements = {
      localVideo: document.getElementById('localVideo'),
      remoteVideo: document.getElementById('remoteVideo'),
      localOverlay: document.getElementById('localOverlay'),
      remoteOverlay: document.getElementById('remoteOverlay'),
      remoteName: document.getElementById('remoteName'),
      roomIdDisplay: document.getElementById('roomIdDisplay'),
      statusBanner: document.getElementById('statusBanner'),
      statusText: document.getElementById('statusText'),
      spinner: document.querySelector('.spinner'),
      connStatus: document.getElementById('connStatus'),
      connLabel: document.getElementById('connLabel'),
      connDot: document.querySelector('.dot'),
      remoteTile: document.getElementById('remoteTile'),
      btnMic: document.getElementById('btnMic'),
      btnCam: document.getElementById('btnCam'),
      toast: document.getElementById('toast'),
    };
  },

  setRoomId(id) {
    this.elements.roomIdDisplay.textContent = id;
    document.title = `NexCall — ${id}`;
  },

  setStatus(text, type = 'info') {
    const banner = this.elements.statusBanner;
    const spinner = this.elements.spinner;
    this.elements.statusText.textContent = text;
    banner.className = 'status-banner';
    spinner.classList.remove('hidden');
    if (type === 'error') { banner.classList.add('error'); spinner.classList.add('hidden'); }
    if (type === 'success') { banner.classList.add('success'); spinner.classList.add('hidden'); }
    if (type === 'done') banner.classList.add('hidden');
  },

  setConnected(isConnected) {
    const dot = this.elements.connDot;
    const label = this.elements.connLabel;
    dot.className = 'dot ' + (isConnected ? 'dot--connected' : 'dot--waiting');
    label.textContent = isConnected ? 'Connected' : 'Waiting...';
  },

  setLocalStream(stream) {
    this.elements.localVideo.srcObject = stream;
    this.elements.localOverlay.classList.add('hidden');
  },

  setRemoteStream(stream) {
    this.elements.remoteVideo.srcObject = stream;
    this.elements.remoteOverlay.classList.add('hidden');
    this.elements.remoteTile.classList.add('has-stream');
  },

  showRemoteWaiting() {
    this.elements.remoteOverlay.classList.remove('hidden');
    this.elements.remoteTile.classList.remove('has-stream');
    this.elements.remoteVideo.srcObject = null;
  },

  setRemotePeerId(id) {
    this.elements.remoteName.textContent = id.toUpperCase().slice(0, 8);
  },

  updateMicBtn(isEnabled) {
    const btn = this.elements.btnMic;
    btn.querySelector('.icon-mic').classList.toggle('hidden', !isEnabled);
    btn.querySelector('.icon-mic-off').classList.toggle('hidden', isEnabled);
    btn.classList.toggle('muted', !isEnabled);
  },

  updateCamBtn(isEnabled) {
    const btn = this.elements.btnCam;
    btn.querySelector('.icon-cam').classList.toggle('hidden', !isEnabled);
    btn.querySelector('.icon-cam-off').classList.toggle('hidden', isEnabled);
    btn.classList.toggle('muted', !isEnabled);
    if (!isEnabled) {
      this.elements.localOverlay.classList.remove('hidden');
    } else {
      this.elements.localOverlay.classList.add('hidden');
    }
  },

  showToast(msg, duration = 3000) {
    const toast = this.elements.toast;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  },
};

function copyRoomId() {
  const id = document.getElementById('roomIdDisplay').textContent;
  navigator.clipboard.writeText(id).then(() => {
    UI.showToast('Room ID copied!');
  });
}
