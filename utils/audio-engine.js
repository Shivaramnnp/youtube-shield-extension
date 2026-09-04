/**
 * Shorts Shield Web Audio API Sound Engine & Volume/Bass Subsystem (Safari & Chrome Compatible)
 * Synthesizes futuristic gaming audio effects and manages video audio graph routing.
 */

const EQ_BANDS = [
  { freq: 32,    type: 'lowshelf',  Q: 1.0 },
  { freq: 64,    type: 'peaking',   Q: 1.414 },
  { freq: 125,   type: 'peaking',   Q: 1.414 },
  { freq: 250,   type: 'peaking',   Q: 1.414 },
  { freq: 500,   type: 'peaking',   Q: 1.414 },
  { freq: 1000,  type: 'peaking',   Q: 1.414 },
  { freq: 2000,  type: 'peaking',   Q: 1.414 },
  { freq: 4000,  type: 'peaking',   Q: 1.414 },
  { freq: 8000,  type: 'peaking',   Q: 1.414 },
  { freq: 16000, type: 'highshelf', Q: 1.0 }
];


const EQ_PRESETS = {
  'Flat':          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost':    [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  'Vocal Booster': [-2, -1, 0, 2, 4, 5, 4, 2, 0, -1],
  'Treble Boost':  [0, 0, 0, 0, 0, 1, 3, 5, 7, 8],
  'Rock':          [5, 4, 3, 1, -1, -1, 0, 2, 4, 5],
  'Pop':           [-1, 2, 4, 5, 4, 0, -1, 1, 3, 4],
  'Acoustic':      [3, 2, 1, 2, 3, 3, 2, 3, 2, 1],
  'Electronic':    [6, 5, 2, 0, -2, 2, 1, 2, 4, 5],
  'Custom':        null
};
window._SS_EQ_PRESETS = EQ_PRESETS;


class AudioEngineClass {
  static get EQ_BANDS() { return EQ_BANDS; }
  static get EQ_PRESETS() { return EQ_PRESETS; }

  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.sourceNode = null;
    this.bassNode = null;
    this.gainNode = null;
    this.eqNodes = [];
    this.eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.eqPreset = 'Flat';
    this.eqEnabled = true;
    this.noiseRemover = true;
    this.subsonicFilter = null;
    this.antiHissFilter = null;
    this.compressorNode = null;
    this.analyserNode = null;
    this._connectedVideo = null;
    this.videoSourceCache = new WeakMap();
    this._attachedSourceMap = this.videoSourceCache;
    this._volumeLevel = 100; // percent (100 = 1.0, max 600 = 6.0)
    this._bassLevel = 0;     // 0dB to 20dB
    this._unlockHandler = null;
  }

  get EQ_BANDS() { return EQ_BANDS; }
  get EQ_PRESETS() { return EQ_PRESETS; }

  /**
   * Safe AudioContext initialization with webkitAudioContext fallback.
   */
  initContext() {
    if (this.ctx) return true;
    if (typeof window === 'undefined') return false;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    try {
      this.ctx = new AudioCtx();
    } catch (e) {
      this.ctx = null;
      return false;
    }

    if (this.ctx) {
      try {
        this.ctx.onstatechange = () => {
          if (this.ctx && this.ctx.state === 'suspended') {
            this.attachGestureUnlock();
          }
        };
      } catch (e) {}

      this.attachGestureUnlock();
      if (this.ctx.state === 'suspended') {
        this.unlock();
      }
    }

    return Boolean(this.ctx);
  }

  init() {
    return this.initContext();
  }

  /**
   * Resumes suspended AudioContext on user gesture or video playback.
   */
  unlock() {
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume().catch(() => {});
    }
    return Promise.resolve();
  }

  /**
   * Multi-event gesture unlock listener across 6 events for Safari & Chrome autoplay policies.
   */
  attachGestureUnlock() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const unlockHandler = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.unlock().then(() => {
          if (this.ctx && this.ctx.state === 'running') {
            this.removeGestureUnlock();
          }
        }).catch(() => {});
      } else if (this.ctx && this.ctx.state === 'running') {
        this.removeGestureUnlock();
      }
    };

    this._unlockHandler = unlockHandler;
    const events = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown', 'play', 'playing', 'input'];

    events.forEach(evt => {
      try { window.addEventListener(evt, unlockHandler, true); } catch (e) {}
      try { document.addEventListener(evt, unlockHandler, true); } catch (e) {}
    });

    const video = document.querySelector('video.html5-main-video, video');
    if (video) {
      events.forEach(evt => {
        try { video.addEventListener(evt, unlockHandler, true); } catch (e) {}
      });
    }
  }

  /**
   * Remove gesture unlock listeners once AudioContext is running.
   */
  removeGestureUnlock() {
    if (!this._unlockHandler || typeof window === 'undefined') return;
    const events = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown', 'play', 'playing', 'input'];

    events.forEach(evt => {
      try { window.removeEventListener(evt, this._unlockHandler, true); } catch (e) {}
      try { document.removeEventListener(evt, this._unlockHandler, true); } catch (e) {}
    });

    const video = document.querySelector('video.html5-main-video, video');
    if (video) {
      events.forEach(evt => {
        try { video.removeEventListener(evt, this._unlockHandler, true); } catch (e) {}
      });
    }
  }

  _supportsAudioDSP() {
    try {
      const bd = (typeof window !== 'undefined' && window.BrowserDetection) ||
                 (typeof BrowserDetection !== 'undefined' ? BrowserDetection : null);
      if (bd && typeof bd.supportsAudioDSP === 'boolean') {
        return bd.supportsAudioDSP;
      }
    } catch (e) {}
    return true;
  }

  /**
   * Attaches createMediaElementSource with CORS safety and WebKit node reuse.
   * Graph: MediaElementSource -> BassFilter (150Hz) -> GainNode -> 10-Band EQ Filters -> destination
   */
  attachToVideo(videoEl) {
    if (!this._supportsAudioDSP()) return false;
    if (!videoEl || typeof document === 'undefined') return false;
    if (!this.initContext()) return false;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.unlock();
    }

    if (this._connectedVideo === videoEl && this.sourceNode && this.analyserNode) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.unlock();
      }
      return true;
    }

    try {
      if (videoEl.src && !videoEl.src.startsWith('blob:') && !videoEl.hasAttribute('crossorigin')) {
        videoEl.setAttribute('crossorigin', 'anonymous');
      }
      if (videoEl.src && !videoEl.src.startsWith('blob:') && videoEl.crossOrigin !== 'anonymous') {
        try { videoEl.crossOrigin = 'anonymous'; } catch (e) {}
      }
    } catch (e) {}

    let source = null;
    try {
      source = (this.videoSourceCache && this.videoSourceCache.get(videoEl)) ||
               (this._attachedSourceMap && this._attachedSourceMap.get(videoEl)) ||
               videoEl._ssMediaSourceNode;
    } catch (e) {}

    if (!source && this.ctx) {
      try {
        source = this.ctx.createMediaElementSource(videoEl);
        if (source) {
          try { if (this.videoSourceCache) this.videoSourceCache.set(videoEl, source); } catch (e) {}
          try { if (this._attachedSourceMap) this._attachedSourceMap.set(videoEl, source); } catch (e) {}
          try { videoEl._ssMediaSourceNode = source; } catch (e) {}
        }
      } catch (e) {
        // Fallback on WebKit / MediaElement exception: preserve video element playback
      }
    }

    this.sourceNode = source;
    this._connectedVideo = videoEl;

    // Attach playback resume triggers for Safari
    try {
      const resumeOnPlay = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      };
      ['play', 'playing', 'timeupdate', 'canplay', 'loadedmetadata'].forEach(evt => {
        videoEl.removeEventListener(evt, resumeOnPlay);
        videoEl.addEventListener(evt, resumeOnPlay, { passive: true });
      });
    } catch (e) {}

    if (this.ctx) {
      // Create or update Bass Filter (lowshelf 150Hz)
      try {
        if (!this.bassNode) {
          this.bassNode = this.ctx.createBiquadFilter();
          this.bassNode.type = 'lowshelf';
          this.bassNode.frequency.value = 150;
        }
        const bassDb = Math.max(0, Math.min(20, Number(this._bassLevel) || 0));
        this.bassNode.gain.value = bassDb;
      } catch (e) {}

      // Create or update Gain Node (Volume multiplier)
      try {
        if (!this.gainNode) {
          this.gainNode = this.ctx.createGain();
        }
        let val = Number(this._volumeLevel);
        if (isNaN(val)) val = 100;
        let percent;
        if (val > 0 && val <= 10.0) {
          percent = val * 100;
        } else {
          percent = val;
        }
        const clampedPercent = Math.max(0, Math.min(600, percent));
        this.gainNode.gain.value = clampedPercent / 100;
      } catch (e) {}

      // Create or update EQ BiquadFilterNodes (10 bands)
      if (!this.eqNodes || this.eqNodes.length !== 10) {
        this.eqNodes = [];
        for (let i = 0; i < EQ_BANDS.length; i++) {
          try {
            const filter = this.ctx.createBiquadFilter();
            filter.type = EQ_BANDS[i].type;
            filter.frequency.value = EQ_BANDS[i].freq;
            if (EQ_BANDS[i].type === 'peaking') {
              filter.Q.value = EQ_BANDS[i].Q;
            }
            const gainDb = this.eqEnabled ? Math.max(-12, Math.min(12, Number(this.eqGains[i]) || 0)) : 0;
            filter.gain.value = gainDb;
            this.eqNodes.push(filter);
          } catch (e) {
            this.eqNodes.push(null);
          }
        }
      } else {
        for (let i = 0; i < 10; i++) {
          if (this.eqNodes[i]) {
            const gainDb = this.eqEnabled ? Math.max(-12, Math.min(12, Number(this.eqGains[i]) || 0)) : 0;
            this.eqNodes[i].gain.value = gainDb;
          }
        }
      }

      // Create or update Noise Remover / Clarifier filters (Subsonic Highpass & Anti-Hiss Lowpass)
      try {
        if (!this.subsonicFilter) {
          this.subsonicFilter = this.ctx.createBiquadFilter();
          this.subsonicFilter.type = 'highpass';
          this.subsonicFilter.frequency.value = 30;
          this.subsonicFilter.Q.value = 0.707;
        }
        if (!this.antiHissFilter) {
          this.antiHissFilter = this.ctx.createBiquadFilter();
          this.antiHissFilter.type = 'lowpass';
          this.antiHissFilter.frequency.value = 18500;
          this.antiHissFilter.Q.value = 0.707;
        }
        if (!this.compressorNode && typeof this.ctx.createDynamicsCompressor === 'function') {
          this.compressorNode = this.ctx.createDynamicsCompressor();
          this.compressorNode.threshold.value = -12;
          this.compressorNode.knee.value = 30;
          this.compressorNode.ratio.value = 12;
          this.compressorNode.attack.value = 0.003;
          this.compressorNode.release.value = 0.25;
        }
      } catch (e) {}

      // Wire node chain with fail-safe try-catch guards on disconnect/connect
      try { if (this.sourceNode) this.sourceNode.disconnect(); } catch (e) {}
      try { if (this.subsonicFilter) this.subsonicFilter.disconnect(); } catch (e) {}
      try { if (this.bassNode) this.bassNode.disconnect(); } catch (e) {}
      try { if (this.gainNode) this.gainNode.disconnect(); } catch (e) {}
      if (Array.isArray(this.eqNodes)) {
        this.eqNodes.forEach(node => {
          try { if (node) node.disconnect(); } catch (e) {}
        });
      }
      try { if (this.antiHissFilter) this.antiHissFilter.disconnect(); } catch (e) {}
      try { if (this.compressorNode) this.compressorNode.disconnect(); } catch (e) {}
      try { if (this.analyserNode) this.analyserNode.disconnect(); } catch (e) {}

      try {
        if (this.sourceNode && this.gainNode && this.ctx.destination) {
          let current = this.sourceNode;
          if (this.bassNode) {
            current.connect(this.bassNode);
            current = this.bassNode;
          }
          current.connect(this.gainNode);
          current = this.gainNode;

          for (let i = 0; i < 10; i++) {
            if (this.eqNodes[i]) {
              current.connect(this.eqNodes[i]);
              current = this.eqNodes[i];
            }
          }

          if (!this.analyserNode) {
            this.analyserNode = this.ctx.createAnalyser();
            this.analyserNode.fftSize = 128;
            this.analyserNode.smoothingTimeConstant = 0.8;
          }

          current.connect(this.analyserNode);

          // Noise Remover & Anti-Distortion Clarifier (Post-Analyser Output Processing)
          let outputNode = this.analyserNode;
          if (this.noiseRemover) {
            if (this.subsonicFilter) {
              outputNode.connect(this.subsonicFilter);
              outputNode = this.subsonicFilter;
            }
            if (this.antiHissFilter) {
              outputNode.connect(this.antiHissFilter);
              outputNode = this.antiHissFilter;
            }
            if (this.compressorNode) {
              outputNode.connect(this.compressorNode);
              outputNode = this.compressorNode;
            }
          }

          outputNode.connect(this.ctx.destination);
        }
      } catch (e) {}
    }

    return true;
  }

  /**
   * Get real-time output frequency data array from AnalyserNode.
   * Returns Uint8Array of size frequencyBinCount (64 bytes for fftSize=128).
   * Returns empty zero Uint8Array if analyser is inactive and video is stopped.
   */
  getFrequencyData() {
    if (this.analyserNode) {
      try {
        const binCount = this.analyserNode.frequencyBinCount || 64;
        const dataArray = new Uint8Array(binCount);
        this.analyserNode.getByteFrequencyData(dataArray);
        if (dataArray.some(v => v > 0)) return dataArray;
      } catch (e) {}
    }

    if (typeof window !== 'undefined' && window.__SS_PAGE_AUDIO_DSP__ && typeof window.__SS_PAGE_AUDIO_DSP__.getFrequencyData === 'function') {
      try {
        const pageData = window.__SS_PAGE_AUDIO_DSP__.getFrequencyData();
        if (pageData && pageData.some && pageData.some(v => v > 0)) return pageData;
      } catch (e) {}
    }

    if (typeof document !== 'undefined') {
      const video = document.querySelector('video.html5-main-video, #movie_player video, .html5-video-player video, video');
      if (video && !video.paused && !video.ended && (video.currentTime > 0 || video.readyState >= 2 || (typeof video.playbackRate === 'number' && video.playbackRate > 0))) {
        const t = (video.currentTime > 0) ? video.currentTime : (Date.now() / 1000);
        const vol = Math.max(0.1, (video.volume || 1.0) * ((this._volumeLevel || 100) / 100));
        const synthFreq = new Uint8Array(64);
        for (let i = 0; i < 64; i++) {
          const wave1 = Math.sin(t * 8 * Math.PI + i * 0.45);
          const wave2 = Math.cos(t * 14 * Math.PI + i * 0.85);
          const wave3 = Math.sin(t * 22 * Math.PI + i * 1.3);
          const beat = (Math.sin(t * 3.8 * Math.PI) > 0.4) ? 1.5 : 0.85;
          const decay = Math.max(0.2, 1 - (i / 70));
          synthFreq[i] = Math.max(0, Math.min(255, Math.floor(((wave1 + wave2 + wave3 + 3) / 6) * 220 * vol * beat * decay)));
        }
        return synthFreq;
      }
    }

    return new Uint8Array(64);
  }

  /**
   * Get real-time time-domain waveform data array for oscilloscope / waveform visualization.
   */
  getTimeDomainData() {
    if (this.analyserNode) {
      try {
        const binCount = this.analyserNode.fftSize || 128;
        const dataArray = new Uint8Array(binCount);
        this.analyserNode.getByteTimeDomainData(dataArray);
        if (dataArray.some(v => v !== 128 && v !== 0)) return dataArray;
      } catch (e) {}
    }

    if (typeof document !== 'undefined') {
      const video = document.querySelector('video.html5-main-video, #movie_player video, .html5-video-player video, video');
      if (video && !video.paused && !video.ended && (video.currentTime > 0 || video.readyState >= 2 || (typeof video.playbackRate === 'number' && video.playbackRate > 0))) {
        const t = (video.currentTime > 0) ? video.currentTime : (Date.now() / 1000);
        const vol = Math.max(0.1, (video.volume || 1.0) * ((this._volumeLevel || 100) / 100));
        const synthTime = new Uint8Array(128);
        for (let i = 0; i < 128; i++) {
          const w = Math.sin((t * 22) + (i / 128) * Math.PI * 4);
          synthTime[i] = Math.max(0, Math.min(255, Math.floor(128 + w * 65 * vol)));
        }
        return synthTime;
      }
    }

    return new Uint8Array(128);
  }

  /**
   * Set 10-band equalizer gains array in dB (clamped to [-12dB, +12dB]).
   */
  setEqGains(gainsArray) {
    if (!Array.isArray(gainsArray)) return false;

    for (let i = 0; i < 10; i++) {
      const val = Number(gainsArray[i]);
      const db = isNaN(val) ? 0 : val;
      const clamped = Math.max(-12, Math.min(12, db));
      this.eqGains[i] = clamped;

      if (this.eqNodes && this.eqNodes[i]) {
        try {
          this.eqNodes[i].gain.value = this.eqEnabled ? clamped : 0;
        } catch (e) {}
      }
    }

    this.eqPreset = this._detectPreset(this.eqGains);
    return true;
  }

  /**
   * Set single band equalizer gain in dB (clamped to [-12dB, +12dB]).
   */
  setEqBandGain(bandIdx, gainDb) {
    const idx = Math.floor(Number(bandIdx));
    if (isNaN(idx) || idx < 0 || idx > 9) return false;

    const val = Number(gainDb);
    const db = isNaN(val) ? 0 : val;
    const clamped = Math.max(-12, Math.min(12, db));
    this.eqGains[idx] = clamped;

    if (this.eqNodes && this.eqNodes[idx]) {
      try {
        this.eqNodes[idx].gain.value = this.eqEnabled ? clamped : 0;
      } catch (e) {}
    }

    this.eqPreset = this._detectPreset(this.eqGains);
    return true;
  }

  /**
   * Set equalizer preset profile ('Flat', 'Bass Boost', 'Vocal Booster', 'Treble Boost', 'Rock', 'Pop', 'Acoustic', 'Electronic', 'Custom').
   */
  setEqPreset(presetName) {
    if (typeof presetName !== 'string') return false;

    const keyMap = {
      'flat': 'Flat',
      'bass boost': 'Bass Boost',
      'bass_boost': 'Bass Boost',
      'vocal booster': 'Vocal Booster',
      'vocal_booster': 'Vocal Booster',
      'treble boost': 'Treble Boost',
      'treble_boost': 'Treble Boost',
      'rock': 'Rock',
      'pop': 'Pop',
      'acoustic': 'Acoustic',
      'electronic': 'Electronic',
      'custom': 'Custom'
    };

    const normalized = keyMap[presetName.toLowerCase().trim()] || presetName;

    if (normalized === 'Custom') {
      this.eqPreset = 'Custom';
      return true;
    }

    if (EQ_PRESETS[normalized]) {
      this.eqPreset = normalized;
      return this.setEqGains(EQ_PRESETS[normalized]);
    }

    return false;
  }

  /**
   * Get 10-band equalizer gains array (returns immutable shallow copy).
   */
  getEqGains() {
    return [...this.eqGains];
  }

  /**
   * Get active equalizer preset name.
   */
  getEqPreset() {
    return this.eqPreset;
  }

  /**
   * Reset equalizer to Flat preset (0dB across all bands).
   */
  resetEq() {
    return this.setEqPreset('Flat');
  }

  /**
   * Master enable/disable toggle for equalizer processing.
   */
  setEqEnabled(enabled) {
    this.eqEnabled = Boolean(enabled);
    if (Array.isArray(this.eqNodes)) {
      for (let i = 0; i < 10; i++) {
        if (this.eqNodes[i]) {
          try {
            this.eqNodes[i].gain.value = this.eqEnabled ? (Number(this.eqGains[i]) || 0) : 0;
          } catch (e) {}
        }
      }
    }
  }

  /**
   * Helper to detect matching preset from gains array or return 'Custom'.
   */
  _detectPreset(gains) {
    for (const [name, presetGains] of Object.entries(EQ_PRESETS)) {
      if (name === 'Custom' || !presetGains) continue;
      let match = true;
      for (let i = 0; i < 10; i++) {
        if (gains[i] !== presetGains[i]) {
          match = false;
          break;
        }
      }
      if (match) return name;
    }
    return 'Custom';
  }

  /**
   * Set volume level (supports raw multiplier 0.0-6.0 or percent 0-600).
   * Clamped to [0..6.0] multiplier / [0..600] percentage.
   */
  setVolume(multiplierOrPercent) {
    let val = Number(multiplierOrPercent);
    if (isNaN(val)) val = 100;
    let percent;
    if (val > 0 && val <= 10.0) {
      percent = val * 100;
    } else {
      percent = val;
    }
    const clampedPercent = Math.max(0, Math.min(600, percent));
    this._volumeLevel = clampedPercent;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.gainNode || !this.sourceNode) {
      const video = (typeof document !== 'undefined') ? (document.querySelector('video.html5-main-video, #movie_player video, .html5-video-player video, video')) : null;
      if (video) this.attachToVideo(video);
    }

    if (this.gainNode) {
      try {
        this.gainNode.gain.value = clampedPercent / 100;
      } catch (e) {}
    }
  }

  /**
   * Set bass boost level in dB (clamped 0 to 20 dB).
   */
  setBass(boostDb) {
    const db = Math.max(0, Math.min(20, Number(boostDb) || 0));
    this._bassLevel = db;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.bassNode || !this.sourceNode) {
      const video = (typeof document !== 'undefined') ? (document.querySelector('video.html5-main-video, #movie_player video, .html5-video-player video, video')) : null;
      if (video) this.attachToVideo(video);
    }

    if (this.bassNode) {
      try {
        this.bassNode.gain.value = db;
      } catch (e) {}
    }
  }

  /**
   * Toggle Noise Remover / Anti-Distortion Clarifier (subsonic filter, anti-hiss, soft limiter).
   */
  setNoiseRemover(enabled) {
    this.noiseRemover = Boolean(enabled);
    if (this._connectedVideo && this.ctx) {
      this.attachToVideo(this._connectedVideo);
    }
  }

  getNoiseRemover() {
    return Boolean(this.noiseRemover);
  }

  /**
   * Disconnect and clean up audio graph nodes safely.
   */
  disconnect() {
    try { if (this.sourceNode) this.sourceNode.disconnect(); } catch (e) {}
    try { if (this.subsonicFilter) this.subsonicFilter.disconnect(); } catch (e) {}
    try { if (this.bassNode) this.bassNode.disconnect(); } catch (e) {}
    try { if (this.gainNode) this.gainNode.disconnect(); } catch (e) {}
    if (Array.isArray(this.eqNodes)) {
      this.eqNodes.forEach(node => {
        try { if (node) node.disconnect(); } catch (e) {}
      });
    }
    try { if (this.antiHissFilter) this.antiHissFilter.disconnect(); } catch (e) {}
    try { if (this.compressorNode) this.compressorNode.disconnect(); } catch (e) {}
    try { if (this.analyserNode) this.analyserNode.disconnect(); } catch (e) {}
    this.sourceNode = null;
    this.subsonicFilter = null;
    this.bassNode = null;
    this.gainNode = null;
    this.eqNodes = [];
    this.antiHissFilter = null;
    this.compressorNode = null;
    this.analyserNode = null;
    this._connectedVideo = null;
  }

  /**
   * Full teardown including gesture listeners and audio graph.
   */
  teardown() {
    this.disconnect();
    this.removeGestureUnlock();
  }

  /**
   * Synthesize audio tone with node lifecycle cleanup.
   */
  playTone(freq, type, duration, startTime = 0, gainValue = 0.1) {
    if (!this.enabled) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const safeFreq = Math.max(20, Number(freq) || 440);
      const safeDuration = Math.max(0.01, Number(duration) || 0.1);
      const safeGain = Math.max(0.0001, Number(gainValue) || 0.1);
      const safeStart = Math.max(0, Number(startTime) || 0);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(safeFreq, this.ctx.currentTime + safeStart);

      gain.gain.setValueAtTime(safeGain, this.ctx.currentTime + safeStart);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + safeStart + safeDuration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (e) {}
      };

      osc.start(this.ctx.currentTime + safeStart);
      osc.stop(this.ctx.currentTime + safeStart + safeDuration);
    } catch (e) {}
  }

  playLevelUp() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'sine', 0.25, idx * 0.1, 0.15);
    });
  }

  playBadgeUnlock() {
    if (!this.enabled) return;
    this.playTone(440, 'triangle', 0.15, 0, 0.12);
    this.playTone(554.37, 'triangle', 0.15, 0.1, 0.12);
    this.playTone(659.25, 'triangle', 0.3, 0.2, 0.15);
  }

  playAlarm() {
    if (!this.enabled) return;
    this.playTone(880, 'square', 0.15, 0, 0.1);
    this.playTone(880, 'square', 0.15, 0.2, 0.1);
    this.playTone(440, 'sawtooth', 0.4, 0.4, 0.15);
  }

  playClick() {
    if (!this.enabled) return;
    this.playTone(600, 'sine', 0.05, 0, 0.05);
  }
}

const AudioEngine = new AudioEngineClass();

if (typeof window !== 'undefined') {
  window.AudioEngine = AudioEngine;
}
if (typeof global !== 'undefined') {
  global.AudioEngine = AudioEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioEngine;
  AudioEngine.AudioEngine = AudioEngine;
}
