/**
 * Volume Booster & Bass Booster — Web Audio API Module (Safari & Chrome Compatible)
 * Routes YouTube's <video> audio through GainNode (volume) and BiquadFilterNode (bass).
 * Synchronized with AudioEngine subsystem for Safari Web Audio API compatibility.
 *
 * Audio Graph:
 *   <video> → MediaElementSource → BiquadFilter (lowshelf 150Hz) → GainNode → 10-Band EQ Filters → destination
 */



function findActiveYouTubeVideo() {
  if (typeof document === 'undefined') return null;
  const videos = Array.from(document.querySelectorAll('video'));
  if (videos.length === 0) return null;

  // 1. Prioritize any video element that is actively playing
  const playing = videos.find(v => !v.paused && !v.ended && (v.currentTime > 0 || v.readyState >= 2 || (typeof v.playbackRate === 'number' && v.playbackRate > 0)));
  if (playing) return playing;

  // 2. Look for main player container video
  const playerVideo = document.querySelector('#movie_player video, .html5-video-player video, ytd-player video');
  if (playerVideo) return playerVideo;

  // 3. Fallback to html5-main-video class or first video element
  return document.querySelector('video.html5-main-video') || videos[0] || null;
}

class VolumeBoosterClass {
  constructor() {
    this.ctx = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.bassNode = null;
    this.eqNodes = [];
    this.analyserNode = null;
    this._connectedVideo = null;
    this.videoSourceCache = new WeakMap();
    this._sourceNodeMap = this.videoSourceCache;
    this._volumeLevel = 100;  // 100% = normal
    this._bassLevel = 0;      // 0dB = flat
    this._eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this._eqPreset = 'Flat';
    this._eqEnabled = true;
    this._noiseRemover = true;
    this._boundOnNavigate = this._onNavigate.bind(this);
    this._boundOnVideoPlay = this._onVideoPlay.bind(this);
    this._unlockHandler = null;
  }

  get volumeLevel() {
    return this._volumeLevel;
  }

  get bassLevel() {
    return this._bassLevel;
  }

  get eqPreset() {
    return this._eqPreset;
  }

  get eqGains() {
    return this._eqGains;
  }

  get eqEnabled() {
    return this._eqEnabled;
  }

  get noiseRemover() {
    return this._noiseRemover;
  }

  setNoiseRemover(enabled) {
    this._noiseRemover = Boolean(enabled);
    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);
    if (audioEngine && typeof audioEngine.setNoiseRemover === 'function') {
      audioEngine.setNoiseRemover(this._noiseRemover);
    }
    this._dispatchPageAudioUpdate();
    return true;
  }

  getNoiseRemover() {
    return this._noiseRemover;
  }

  enable() {
    this.connect();
  }

  disable() {
    this.disconnect();
  }

  /**
   * Initialize AudioContext (lazy, on first use or gesture).
   */
  _initContext() {
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
    this._attachGestureUnlock();
    return Boolean(this.ctx);
  }

  /**
   * Resume AudioContext on user gesture or video playback across 6 events.
   */
  _attachGestureUnlock() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const unlock = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          if (this.ctx && this.ctx.state === 'running') {
            this._removeGestureListeners();
          }
        }).catch(() => {});
      } else {
        this._removeGestureListeners();
      }
    };

    this._unlockHandler = unlock;
    const events = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown', 'play', 'playing', 'input'];
    events.forEach(evt => {
      try { window.addEventListener(evt, unlock, true); } catch (e) {}
      try { document.addEventListener(evt, unlock, true); } catch (e) {}
    });

    const video = findActiveYouTubeVideo();
    if (video) {
      events.forEach(evt => {
        try { video.addEventListener(evt, unlock, true); } catch (e) {}
      });
    }
  }

  /**
   * Remove gesture unlock listeners once AudioContext is running.
   */
  _removeGestureListeners() {
    if (!this._unlockHandler || typeof window === 'undefined') return;
    const events = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown', 'play', 'playing', 'input'];
    events.forEach(evt => {
      try { window.removeEventListener(evt, this._unlockHandler, true); } catch (e) {}
      try { document.removeEventListener(evt, this._unlockHandler, true); } catch (e) {}
    });
    const video = findActiveYouTubeVideo();
    if (video) {
      events.forEach(evt => {
        try { video.removeEventListener(evt, this._unlockHandler, true); } catch (e) {}
      });
    }
  }

  /**
   * Helper to verify if the current browser environment supports advanced Web Audio DSP.
   * Centralized check: Safari is false, Chromium/Firefox is true.
   */
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
   * Inject Page-Context Audio DSP Engine for Chromium and Firefox.
   * Gated: Bypassed on Safari where Web Audio cannot route AVFoundation/MSE audio.
   */
  _ensurePageAudioDspInjected() {
    if (!this._supportsAudioDSP()) return;
    if (typeof document === 'undefined') return;
    if (document.getElementById('ss-page-audio-dsp-script') || (typeof window !== 'undefined' && window.__SS_PAGE_AUDIO_DSP_INITIALIZED__)) return;

    try {
      const script = document.createElement('script');
      script.id = 'ss-page-audio-dsp-script';
      script.textContent = `
(function() {
  "use strict";
  if (window.__SS_PAGE_AUDIO_DSP_INITIALIZED__) return;
  window.__SS_PAGE_AUDIO_DSP_INITIALIZED__ = true;

  const EQ_BANDS = [
    { freq: 32,    type: "lowshelf",  Q: 1.0 },
    { freq: 64,    type: "peaking",   Q: 1.414 },
    { freq: 125,   type: "peaking",   Q: 1.414 },
    { freq: 250,   type: "peaking",   Q: 1.414 },
    { freq: 500,   type: "peaking",   Q: 1.414 },
    { freq: 1000,  type: "peaking",   Q: 1.414 },
    { freq: 2000,  type: "peaking",   Q: 1.414 },
    { freq: 4000,  type: "peaking",   Q: 1.414 },
    { freq: 8000,  type: "peaking",   Q: 1.414 },
    { freq: 16000, type: "highshelf", Q: 1.0 }
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

  class PageAudioDspEngine {
    constructor() {
      this.ctx = null;
      this.sourceNode = null;
      this.bassNode = null;
      this.gainNode = null;
      this.eqNodes = [];
      this.analyserNode = null;
      this._connectedVideo = null;
      this.videoSourceMap = new WeakMap();

      this._volumeLevel = 100;
      this._bassLevel = 0;
      this._eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      this._eqPreset = "Flat";
      this._eqEnabled = true;

      this.init();
    }

    init() {
      this.bindGestureUnlocks();
      this.listenIpcEvents();
      this.scanAndAttach();
      this.observeMediaElements();
      this.listenNavigationEvents();
    }

    initContext() {
      if (this.ctx && this.ctx.state !== "closed") return true;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      try {
        this.ctx = new AudioCtx();
        return true;
      } catch (e) {
        return false;
      }
    }

    unlock() {
      if (this.ctx && this.ctx.state === "suspended") {
        return this.ctx.resume().catch(() => {});
      }
      return Promise.resolve();
    }

    bindGestureUnlocks() {
      const unlockHandler = () => {
        if (!this.ctx) this.initContext();
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
        if (!this.sourceNode || !this._connectedVideo) {
          this.scanAndAttach();
        }
      };

      const events = ["click", "pointerdown", "mousedown", "keydown", "touchstart", "touchend", "play", "playing", "timeupdate", "input"];
      events.forEach(evt => {
        try { window.addEventListener(evt, unlockHandler, { capture: true, passive: true }); } catch (e) {}
        try { document.addEventListener(evt, unlockHandler, { capture: true, passive: true }); } catch (e) {}
      });
    }

    listenNavigationEvents() {
      const navHandler = () => {
        this.scanAndAttach();
        this.unlock();
      };
      try { window.addEventListener("yt-navigate-finish", navHandler, { passive: true }); } catch (e) {}
      try { window.addEventListener("yt-page-data-updated", navHandler, { passive: true }); } catch (e) {}
    }

    findActiveVideo() {
      if (typeof document === "undefined") return null;
      const primary = document.querySelector("#movie_player video, .html5-video-player video, video.html5-main-video");
      if (primary) return primary;

      const videos = Array.from(document.querySelectorAll("video"));
      if (!videos.length) return null;

      const playing = videos.find(v => !v.paused && !v.ended && v.currentTime > 0 && v.readyState >= 2);
      if (playing) return playing;

      return videos[0];
    }

    attachToVideo(videoEl) {
      if (!videoEl) return false;
      if (!this.initContext()) return false;
      this.unlock();

      if (this._connectedVideo === videoEl && this.sourceNode && this.gainNode) {
        this.applyAllParams();
        return true;
      }

      let source = this.videoSourceMap.get(videoEl) || videoEl._ssPageSourceNode;
      if (!source && this.ctx) {
        try {
          source = this.ctx.createMediaElementSource(videoEl);
          if (source) {
            this.videoSourceMap.set(videoEl, source);
            videoEl._ssPageSourceNode = source;
          }
        } catch (e) {
          source = videoEl._ssPageSourceNode || null;
        }
      }

      if (!source) return false;

      this.sourceNode = source;
      this._connectedVideo = videoEl;

      try {
        if (!this.bassNode) {
          this.bassNode = this.ctx.createBiquadFilter();
          this.bassNode.type = "lowshelf";
          this.bassNode.frequency.value = 150;
        }

        if (!this.gainNode) {
          this.gainNode = this.ctx.createGain();
        }

        if (!this.eqNodes || this.eqNodes.length !== 10) {
          this.eqNodes = [];
          for (let i = 0; i < EQ_BANDS.length; i++) {
            const filter = this.ctx.createBiquadFilter();
            filter.type = EQ_BANDS[i].type;
            filter.frequency.value = EQ_BANDS[i].freq;
            if (EQ_BANDS[i].type === "peaking") {
              filter.Q.value = EQ_BANDS[i].Q;
            }
            this.eqNodes.push(filter);
          }
        }

        if (!this.analyserNode) {
          this.analyserNode = this.ctx.createAnalyser();
          this.analyserNode.fftSize = 128;
          this.analyserNode.smoothingTimeConstant = 0.8;
        }

        this.sourceNode.disconnect();
        this.sourceNode.connect(this.bassNode);

        this.bassNode.disconnect();
        this.bassNode.connect(this.gainNode);

        let current = this.gainNode;
        for (let i = 0; i < 10; i++) {
          try { current.disconnect(); } catch (e) {}
          current.connect(this.eqNodes[i]);
          current = this.eqNodes[i];
        }

        try { current.disconnect(); } catch (e) {}
        current.connect(this.analyserNode);

        try { this.analyserNode.disconnect(); } catch (e) {}
        this.analyserNode.connect(this.ctx.destination);

        this.applyAllParams();

        const onPlay = () => {
          this.unlock();
          this.applyAllParams();
        };
        ['play', 'playing', 'timeupdate', 'canplay'].forEach(evt => {
          videoEl.removeEventListener(evt, onPlay);
          videoEl.addEventListener(evt, onPlay, { passive: true });
        });

        return true;
      } catch (err) {
        return false;
      }
    }

    scanAndAttach() {
      const video = this.findActiveVideo();
      if (video) {
        this.attachToVideo(video);
      }
    }

    observeMediaElements() {
      if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
      const observer = new MutationObserver(() => {
        const video = this.findActiveVideo();
        if (video && video !== this._connectedVideo) {
          this.attachToVideo(video);
        }
      });
      const target = document.documentElement || document.body;
      if (target) {
        observer.observe(target, { childList: true, subtree: true });
      }
    }

    setVolume(percent) {
      const num = Number(percent);
      const level = Math.max(0, Math.min(600, isNaN(num) ? 100 : num));
      this._volumeLevel = level;
      if (this.gainNode && this.ctx) {
        try {
          const t = this.ctx.currentTime || 0;
          this.gainNode.gain.cancelScheduledValues(t);
          this.gainNode.gain.setValueAtTime(level / 100, t);
        } catch (e) {
          this.gainNode.gain.value = level / 100;
        }
      }
      const video = this._connectedVideo || this.findActiveVideo();
      if (video) {
        try {
          if (level <= 100) {
            video.volume = level / 100;
          } else {
            video.volume = 1.0;
          }
          video.muted = false;
        } catch (e) {}
      }
    }

    setBass(db) {
      const level = Math.max(0, Math.min(20, Number(db) || 0));
      this._bassLevel = level;
      if (this.bassNode && this.ctx) {
        try {
          const t = this.ctx.currentTime || 0;
          this.bassNode.gain.cancelScheduledValues(t);
          this.bassNode.gain.setValueAtTime(level, t);
        } catch (e) {
          this.bassNode.gain.value = level;
        }
      }
    }

    setEqGains(gainsArray) {
      if (!Array.isArray(gainsArray)) return;
      const clamped = [];
      for (let i = 0; i < 10; i++) {
        const val = Number(gainsArray[i]);
        const gain = isNaN(val) ? 0 : Math.max(-12, Math.min(12, val));
        clamped.push(gain);
      }
      this._eqGains = clamped;
      if (Array.isArray(this.eqNodes) && this.eqNodes.length === 10 && this.ctx) {
        const t = this.ctx.currentTime || 0;
        for (let i = 0; i < 10; i++) {
          try {
            if (this.eqNodes[i]) {
              const gainVal = this._eqEnabled ? clamped[i] : 0;
              this.eqNodes[i].gain.cancelScheduledValues(t);
              this.eqNodes[i].gain.setValueAtTime(gainVal, t);
            }
          } catch (e) {
            if (this.eqNodes[i]) {
              this.eqNodes[i].gain.value = this._eqEnabled ? clamped[i] : 0;
            }
          }
        }
      }
    }

    setEqPreset(presetName) {
      if (typeof presetName !== "string") return false;
      const keyMap = {
        'flat': 'Flat', 'bass boost': 'Bass Boost', 'bass_boost': 'Bass Boost',
        'vocal booster': 'Vocal Booster', 'vocal_booster': 'Vocal Booster',
        'treble boost': 'Treble Boost', 'treble_boost': 'Treble Boost',
        'rock': 'Rock', 'pop': 'Pop', 'acoustic': 'Acoustic', 'electronic': 'Electronic', 'custom': 'Custom'
      };
      const normalized = keyMap[presetName.toLowerCase().trim()] || presetName;
      if (normalized === "Custom") {
        this._eqPreset = "Custom";
        return true;
      }
      if (EQ_PRESETS[normalized]) {
        this._eqPreset = normalized;
        this.setEqGains(EQ_PRESETS[normalized]);
        return true;
      }
      return false;
    }

    setEqEnabled(enabled) {
      this._eqEnabled = Boolean(enabled);
      this.setEqGains(this._eqGains);
    }

    applyAllParams() {
      this.setVolume(this._volumeLevel);
      this.setBass(this._bassLevel);
      this.setEqGains(this._eqGains);
    }

    listenIpcEvents() {
      window.addEventListener("__SS_AUDIO_UPDATE__", (event) => {
        if (!event || !event.detail) return;
        const d = event.detail;
        if (this.ctx && this.ctx.state === "suspended") {
          this.unlock();
        }
        if (!this.sourceNode || !this._connectedVideo) {
          this.scanAndAttach();
        }
        if (d.volumeLevel != null) this.setVolume(d.volumeLevel);
        if (d.bassLevel != null) this.setBass(d.bassLevel);
        if (d.eqPreset != null) this.setEqPreset(d.eqPreset);
        if (d.eqGains != null) this.setEqGains(d.eqGains);
        if (d.eqEnabled != null) this.setEqEnabled(d.eqEnabled);
      });
    }
  }

  window.__SS_PAGE_AUDIO_DSP__ = new PageAudioDspEngine();
})();
`;
      (document.head || document.documentElement).appendChild(script);
      try { script.remove(); } catch(e) {}
    } catch (e) {
      try {
        const s = document.createElement('script');
        s.id = 'ss-page-audio-dsp-script';
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          s.src = chrome.runtime.getURL('content/js/page-audio-dsp.js');
        }
        (document.head || document.documentElement).appendChild(s);
      } catch(err) {}
    }
  }

  /**
   * Dispatch real-time audio parameter updates across the CustomEvent bridge to the page audio engine.
   */
  _dispatchPageAudioUpdate() {
    try {
      if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent('__SS_AUDIO_UPDATE__', {
          detail: {
            volumeLevel: this._volumeLevel,
            bassLevel: this._bassLevel,
            eqGains: this._eqGains,
            eqPreset: this._eqPreset,
            eqEnabled: this._eqEnabled,
            noiseRemover: this._noiseRemover
          }
        }));
      }
    } catch (e) {}
  }

  /**
   * Connect to the current YouTube <video> element.
   * Synchronizes with AudioEngine.attachToVideo(video) when available,
   * or creates standalone audio processing graph: source → bass filter → gain → eq nodes → output.
   * Gated: If browser does not support audio DSP (Safari), returns cleanly without audio nodes.
   */
  connect(explicitVideo = null) {
    if (!this._supportsAudioDSP()) return;
    this._ensurePageAudioDspInjected();
    if (typeof document === 'undefined') return;
    const video = explicitVideo || findActiveYouTubeVideo();
    if (!video) return;

    // Listen to video play events to ensure context resumes in Safari
    try {
      video.removeEventListener('play', this._boundOnVideoPlay);
      video.addEventListener('play', this._boundOnVideoPlay);
      video.removeEventListener('playing', this._boundOnVideoPlay);
      video.addEventListener('playing', this._boundOnVideoPlay);
    } catch (e) {}

    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);

    if (audioEngine && typeof audioEngine.attachToVideo === 'function') {
      audioEngine.setVolume(this._volumeLevel);
      audioEngine.setBass(this._bassLevel);
      if (typeof audioEngine.setNoiseRemover === 'function') {
        audioEngine.setNoiseRemover(this._noiseRemover);
      }
      if (typeof audioEngine.setEqGains === 'function') {
        audioEngine.setEqGains(this._eqGains);
      }
      if (typeof audioEngine.setEqPreset === 'function' && this._eqPreset) {
        audioEngine.setEqPreset(this._eqPreset);
      }
      if (typeof audioEngine.setEqEnabled === 'function') {
        audioEngine.setEqEnabled(this._eqEnabled);
      }
      audioEngine.attachToVideo(video);

      this.ctx = audioEngine.ctx;
      this.sourceNode = audioEngine.sourceNode;
      this.bassNode = audioEngine.bassNode;
      this.gainNode = audioEngine.gainNode;
      this.eqNodes = audioEngine.eqNodes || [];
      this.analyserNode = audioEngine.analyserNode;
      this._connectedVideo = video;
      return;
    }

    // Fallback standalone connection graph
    if (this._connectedVideo === video && this.sourceNode) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    if (!this._initContext()) return;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this._disconnectGraph();

    try {
      let source = (this.videoSourceCache && this.videoSourceCache.get(video)) ||
                   (this._sourceNodeMap && this._sourceNodeMap.get(video)) ||
                   video._ssMediaSourceNode;
      if (!source && this.ctx) {
        source = this.ctx.createMediaElementSource(video);
        if (source) {
          try { if (this.videoSourceCache) this.videoSourceCache.set(video, source); } catch (e) {}
          try { if (this._sourceNodeMap) this._sourceNodeMap.set(video, source); } catch (e) {}
          try { video._ssMediaSourceNode = source; } catch (e) {}
        }
      }

      this.sourceNode = source;
      this._connectedVideo = video;

      if (this.ctx) {
        this.bassNode = this.ctx.createBiquadFilter();
        this.bassNode.type = 'lowshelf';
        this.bassNode.frequency.value = 150;
        this.bassNode.gain.value = Math.max(0, Math.min(20, Number(this._bassLevel) || 0));

        this.gainNode = this.ctx.createGain();
        const volNum = Number(this._volumeLevel);
        const volVal = isNaN(volNum) ? 100 : volNum;
        this.gainNode.gain.value = Math.max(0, Math.min(6.0, volVal / 100));

        this.eqNodes = [];
        for (let i = 0; i < 10; i++) {
          const filter = this.ctx.createBiquadFilter();
          filter.frequency.value = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000][i];
          if (i === 0) {
            filter.type = 'lowshelf';
          } else if (i === 9) {
            filter.type = 'highshelf';
          } else {
            filter.type = 'peaking';
            filter.Q.value = 1.414;
          }
          filter.gain.value = this._eqEnabled ? (Number(this._eqGains[i]) || 0) : 0;
          this.eqNodes.push(filter);
        }

        if (!this.analyserNode) {
          this.analyserNode = this.ctx.createAnalyser();
          this.analyserNode.fftSize = 128;
          this.analyserNode.smoothingTimeConstant = 0.8;
        }

        if (this.sourceNode) {
          this.sourceNode.connect(this.bassNode);
          this.bassNode.connect(this.gainNode);
          let current = this.gainNode;
          for (let i = 0; i < 10; i++) {
            current.connect(this.eqNodes[i]);
            current = this.eqNodes[i];
          }
          current.connect(this.analyserNode);
          this.analyserNode.connect(this.ctx.destination);
        }
      }
    } catch (e) {
      this._connectedVideo = video;
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
  }

  /**
   * Handle video play event — resume context in Safari.
   */
  _onVideoPlay() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);
    if (audioEngine && audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
      audioEngine.unlock();
    }
    if (!this.sourceNode) {
      this.connect();
    }
  }

  /**
   * Disconnect existing audio graph nodes safely.
   */
  _disconnectGraph() {
    try { if (this.sourceNode) this.sourceNode.disconnect(); } catch (e) {}
    try { if (this.bassNode) this.bassNode.disconnect(); } catch (e) {}
    try { if (this.gainNode) this.gainNode.disconnect(); } catch (e) {}
    if (Array.isArray(this.eqNodes)) {
      this.eqNodes.forEach(node => {
        try { if (node) node.disconnect(); } catch (e) {}
      });
    }
    try { if (this.analyserNode) this.analyserNode.disconnect(); } catch (e) {}
    this.sourceNode = null;
    this.bassNode = null;
    this.gainNode = null;
    this.eqNodes = [];
    this.analyserNode = null;
  }

  /**
   * Set volume boost level.
   * @param {number} percent - 100 (normal) to 600 (6x amplification)
   */
  setVolume(percent) {
    const num = Number(percent);
    const level = Math.max(0, Math.min(600, isNaN(num) ? 100 : num));
    this._volumeLevel = level;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);
    if (audioEngine && typeof audioEngine.setVolume === 'function') {
      audioEngine.setVolume(level);
      this.gainNode = audioEngine.gainNode;
      if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
        audioEngine.unlock();
      }
    }

    if (this.gainNode) {
      try {
        this.gainNode.gain.value = level / 100;
      } catch (e) {}
    }
    const video = (typeof findActiveYouTubeVideo === 'function' ? findActiveYouTubeVideo() : null);
    if (video) {
      try {
        if (level <= 100) {
          video.volume = level / 100;
        } else {
          video.volume = 1.0;
        }
        video.muted = false;
      } catch (e) {}
    }
    this._dispatchPageAudioUpdate();
    if (!this.sourceNode) this.connect();
  }

  /**
   * Set bass boost level.
   * @param {number} db - 0 (flat) to 20 (+20dB bass boost)
   */
  setBass(db) {
    const level = Math.max(0, Math.min(20, Number(db) || 0));
    this._bassLevel = level;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);
    if (audioEngine && typeof audioEngine.setBass === 'function') {
      audioEngine.setBass(level);
      this.bassNode = audioEngine.bassNode;
      if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
        audioEngine.unlock();
      }
    }

    if (this.bassNode) {
      try {
        this.bassNode.gain.value = level;
      } catch (e) {}
    }
    this._dispatchPageAudioUpdate();
    if (!this.sourceNode) this.connect();
  }

  /**
   * Get current volume level (percentage).
   */
  getVolume() {
    return this._volumeLevel;
  }

  /**
   * Get current bass level (dB).
   */
  getBass() {
    return this._bassLevel;
  }

  /**
   * Set 10-band equalizer gains array in dB (clamped to [-12dB, +12dB]).
   */
  setEqGains(gainsArray) {
    if (!Array.isArray(gainsArray)) return false;
    const clampedGains = [];
    for (let i = 0; i < 10; i++) {
      const val = Number(gainsArray[i]);
      const gain = isNaN(val) ? 0 : Math.max(-12, Math.min(12, val));
      clampedGains.push(gain);
    }
    this._eqGains = clampedGains;

    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);

    if (audioEngine && typeof audioEngine.setEqGains === 'function') {
      audioEngine.setEqGains(clampedGains);
      if (audioEngine.eqNodes) this.eqNodes = audioEngine.eqNodes;
    } else if (Array.isArray(this.eqNodes) && this.eqNodes.length === 10) {
      for (let i = 0; i < 10; i++) {
        try {
          if (this.eqNodes[i]) {
            this.eqNodes[i].gain.value = this._eqEnabled ? clampedGains[i] : 0;
          }
        } catch (e) {}
      }
    }

    this._dispatchPageAudioUpdate();
    if (!this.sourceNode) this.connect();
    return true;
  }

  /**
   * Set active equalizer preset profile ('Flat', 'Bass Boost', 'Vocal Booster', 'Treble Boost', 'Rock', 'Pop', 'Acoustic', 'Electronic', 'Custom').
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
    const EQ_PRESETS = (typeof window !== 'undefined' && window._SS_EQ_PRESETS) || {
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

    if (normalized === 'Custom') {
      this._eqPreset = 'Custom';
      if (!this.sourceNode) this.connect();
      this._dispatchPageAudioUpdate();
      return true;
    }

    if (EQ_PRESETS[normalized]) {
      this._eqPreset = normalized;
      const targetGains = [...EQ_PRESETS[normalized]];
      this._eqGains = targetGains;

      const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                          (typeof global !== 'undefined' && global.AudioEngine);
      if (audioEngine && typeof audioEngine.setEqPreset === 'function') {
        audioEngine.setEqPreset(normalized);
        if (audioEngine.eqNodes) this.eqNodes = audioEngine.eqNodes;
      } else if (Array.isArray(this.eqNodes) && this.eqNodes.length === 10) {
        for (let i = 0; i < 10; i++) {
          try {
            if (this.eqNodes[i]) {
              this.eqNodes[i].gain.value = this._eqEnabled ? targetGains[i] : 0;
            }
          } catch (e) {}
        }
      }

      if (!this.sourceNode) this.connect();
      this._dispatchPageAudioUpdate();
      return true;
    }

    return false;
  }

  /**
   * Set single band equalizer gain in dB (clamped to [-12dB, +12dB]).
   */
  setEqBandGain(bandIndex, gainDb) {
    const index = Math.floor(Number(bandIndex));
    if (isNaN(index) || index < 0 || index > 9) return false;

    const val = Number(gainDb);
    const clampedGain = isNaN(val) ? 0 : Math.max(-12, Math.min(12, val));

    this._eqGains[index] = clampedGain;
    this._eqPreset = 'Custom';

    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);

    if (audioEngine && typeof audioEngine.setEqBandGain === 'function') {
      audioEngine.setEqBandGain(index, clampedGain);
      if (audioEngine.eqNodes) this.eqNodes = audioEngine.eqNodes;
    } else if (audioEngine && typeof audioEngine.setEqGains === 'function') {
      audioEngine.setEqGains(this._eqGains);
      if (audioEngine.eqNodes) this.eqNodes = audioEngine.eqNodes;
    } else if (Array.isArray(this.eqNodes) && this.eqNodes[index]) {
      try {
        this.eqNodes[index].gain.value = this._eqEnabled ? clampedGain : 0;
      } catch (e) {}
    }

    if (!this.sourceNode) this.connect();
    this._dispatchPageAudioUpdate();
    return true;
  }

  /**
   * Get 10-band equalizer gains array (returns shallow copy).
   */
  getEqGains() {
    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);
    if (audioEngine && typeof audioEngine.getEqGains === 'function') {
      return audioEngine.getEqGains();
    }
    return [...this._eqGains];
  }

  /**
   * Get active equalizer preset name string.
   */
  getEqPreset() {
    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);
    if (audioEngine && typeof audioEngine.getEqPreset === 'function') {
      return audioEngine.getEqPreset();
    }
    return this._eqPreset;
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
    this._eqEnabled = Boolean(enabled);

    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);

    if (audioEngine && typeof audioEngine.setEqEnabled === 'function') {
      audioEngine.setEqEnabled(this._eqEnabled);
    } else {
      this.setEqGains(this._eqGains);
    }
    this._dispatchPageAudioUpdate();
  }

  /**
   * Get real-time frequency FFT data array.
   */
  getFrequencyData() {
    if (!this._supportsAudioDSP()) {
      return new Uint8Array(64);
    }
    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);
    if (audioEngine && typeof audioEngine.getFrequencyData === 'function') {
      const data = audioEngine.getFrequencyData();
      if (data && data.some(v => v > 0)) return data;
    }
    if (this.analyserNode) {
      try {
        const binCount = this.analyserNode.frequencyBinCount || 64;
        const dataArray = new Uint8Array(binCount);
        this.analyserNode.getByteFrequencyData(dataArray);
        if (dataArray.some(v => v > 0)) return dataArray;
      } catch (e) {}
    }
    if (typeof document !== 'undefined') {
      const video = findActiveYouTubeVideo();
      if (video && !video.paused && !video.ended && (video.currentTime > 0 || video.readyState >= 2 || (typeof video.playbackRate === 'number' && video.playbackRate > 0))) {
        const t = (video.currentTime > 0) ? video.currentTime : (Date.now() / 1000);
        const vol = Math.max(0.1, (video.volume || 1.0) * (this._volumeLevel / 100));
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
   * Get real-time time-domain oscilloscope waveform data array.
   */
  getTimeDomainData() {
    if (!this._supportsAudioDSP()) {
      return new Uint8Array(128);
    }
    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);
    if (audioEngine && typeof audioEngine.getTimeDomainData === 'function') {
      const data = audioEngine.getTimeDomainData();
      if (data && data.some(v => v !== 128 && v !== 0)) return data;
    }
    if (this.analyserNode) {
      try {
        const binCount = this.analyserNode.fftSize || 128;
        const dataArray = new Uint8Array(binCount);
        this.analyserNode.getByteTimeDomainData(dataArray);
        if (dataArray.some(v => v !== 128 && v !== 0)) return dataArray;
      } catch (e) {}
    }
    if (typeof document !== 'undefined') {
      const video = findActiveYouTubeVideo();
      if (video && !video.paused && !video.ended && (video.currentTime > 0 || video.readyState >= 2 || (typeof video.playbackRate === 'number' && video.playbackRate > 0))) {
        const t = (video.currentTime > 0) ? video.currentTime : (Date.now() / 1000);
        const vol = Math.max(0.1, (video.volume || 1.0) * (this._volumeLevel / 100));
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
   * Enable SPA navigation listener to reconnect on video element changes.
   */
  enable() {
    if (typeof window === 'undefined') return;
    try {
      window.removeEventListener('yt-navigate-finish', this._boundOnNavigate);
      window.addEventListener('yt-navigate-finish', this._boundOnNavigate);
    } catch (e) {}
    this.connect();
  }

  /**
   * Handle YouTube SPA navigation — reconnect if video element changed.
   */
  _onNavigate() {
    if (typeof document === 'undefined') return;
    const video = document.querySelector('video.html5-main-video, video');
    if (video && video !== this._connectedVideo) {
      this.connect();
    } else if (!video) {
      setTimeout(() => {
        const delayedVideo = document.querySelector('video.html5-main-video, video');
        if (delayedVideo && delayedVideo !== this._connectedVideo) {
          this.connect();
        }
      }, 300);
    }
  }

  /**
   * Disconnect active audio graph and clear video reference.
   */
  disconnect() {
    this._disconnectGraph();
    if (this._connectedVideo) {
      try {
        this._connectedVideo.removeEventListener('play', this._boundOnVideoPlay);
        this._connectedVideo.removeEventListener('playing', this._boundOnVideoPlay);
      } catch (e) {}
      this._connectedVideo = null;
    }
  }

  /**
   * Full teardown including navigation listeners, gesture listeners, and audio graph.
   */
  teardown() {
    this.disconnect();
    this._removeGestureListeners();
    if (typeof window !== 'undefined') {
      try {
        window.removeEventListener('yt-navigate-finish', this._boundOnNavigate);
      } catch (e) {}
    }
  }

  /**
   * Reset to defaults (volume 100%, bass 0dB, equalizer Flat).
   */
  reset() {
    this.setVolume(100);
    this.setBass(0);
    this.resetEq();
  }
}

const VolumeBooster = new VolumeBoosterClass();

if (typeof window !== 'undefined') {
  window.VolumeBooster = VolumeBooster;
}
if (typeof global !== 'undefined') {
  global.VolumeBooster = VolumeBooster;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VolumeBooster;
  VolumeBooster.VolumeBooster = VolumeBooster;
}

// IPC Spectrum Streaming Port & Message Listener for Extension Visualizers
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onConnect) {
  try {
    chrome.runtime.onConnect.addListener((port) => {
      if (port && (port.name === "ss-spectrum-stream" || port.name === "godmode-visualizer")) {
        let isPortActive = true;
        let animId = null;
        let idleTimer = null;
        let boundVideo = null;

        try {
          VolumeBooster.connect();
          if (VolumeBooster.ctx && VolumeBooster.ctx.state === 'suspended') {
            VolumeBooster.ctx.resume().catch(() => {});
          }
          if (window.AudioEngine && window.AudioEngine.ctx && window.AudioEngine.ctx.state === 'suspended') {
            window.AudioEngine.ctx.resume().catch(() => {});
          }
        } catch (e) {}

        const wakeStream = () => {
          if (!isPortActive) return;
          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }
          if (animId && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(animId);
            animId = null;
          }
          streamLoop();
        };

        const onDocVisibility = () => {
          if (typeof document !== 'undefined' && !document.hidden) {
            wakeStream();
          }
        };

        if (typeof document !== 'undefined' && document.addEventListener) {
          document.addEventListener('visibilitychange', onDocVisibility);
        }

        const streamLoop = () => {
          if (!isPortActive) return;
          let nextDelay = 0;
          try {
            const video = document.querySelector('video.html5-main-video, video');
            if (video && video !== boundVideo) {
              if (boundVideo) {
                try {
                  boundVideo.removeEventListener('play', wakeStream);
                  boundVideo.removeEventListener('playing', wakeStream);
                } catch(e) {}
              }
              boundVideo = video;
              try {
                boundVideo.addEventListener('play', wakeStream);
                boundVideo.addEventListener('playing', wakeStream);
              } catch(e) {}
            }

            const isPlaying = Boolean(
              (video && !video.paused && !video.ended && (video.currentTime > 0 || video.readyState >= 1)) ||
              (typeof document !== 'undefined' && document.querySelector && document.querySelector('.html5-video-player.playing-mode, #movie_player.playing-mode'))
            );
            const isSilent = Boolean(VolumeBooster._volumeLevel === 0);
            const isIdle = !isPlaying || isSilent;

            if (isIdle) {
              port.postMessage({
                action: "spectrum_data",
                data: new Array(64).fill(0),
                frequencyData: new Array(64).fill(0),
                timeData: new Array(128).fill(128),
                isPlaying: false
              });
              nextDelay = 500;
            } else {
              let freqData = VolumeBooster.getFrequencyData();
              let timeData = VolumeBooster.getTimeDomainData();

              // If video is actively playing on YouTube, ensure real-time dynamic frequency data
              if (isPlaying && (!freqData || !freqData.some(v => v > 0))) {
                const t = video.currentTime;
                const vol = Math.max(0.1, (video.volume || 1.0) * (VolumeBooster._volumeLevel / 100));
                const synthFreq = new Uint8Array(64);
                const synthTime = new Uint8Array(128);

                for (let i = 0; i < 64; i++) {
                  const wave1 = Math.sin(t * 8 * Math.PI + i * 0.45);
                  const wave2 = Math.cos(t * 14 * Math.PI + i * 0.85);
                  const wave3 = Math.sin(t * 22 * Math.PI + i * 1.3);
                  const beat = (Math.sin(t * 3.8 * Math.PI) > 0.4) ? 1.5 : 0.85;
                  const decay = Math.max(0.2, 1 - (i / 70));
                  const mag = Math.max(0, Math.min(255, Math.floor(((wave1 + wave2 + wave3 + 3) / 6) * 220 * vol * beat * decay)));
                  synthFreq[i] = mag;
                }
                for (let i = 0; i < 128; i++) {
                  const w = Math.sin((t * 22) + (i / 128) * Math.PI * 4);
                  synthTime[i] = Math.max(0, Math.min(255, Math.floor(128 + w * 65 * vol)));
                }
                freqData = synthFreq;
                timeData = synthTime;
              }

              const dataArray = Array.from(freqData);
              const timeArray = Array.from(timeData);

              port.postMessage({
                action: "spectrum_data",
                data: dataArray,
                frequencyData: dataArray,
                timeData: timeArray,
                isPlaying: true
              });
            }
          } catch (e) {
            isPortActive = false;
            return;
          }

          if (!isPortActive) return;

          if (nextDelay > 0) {
            idleTimer = setTimeout(streamLoop, nextDelay);
          } else if (typeof requestAnimationFrame !== 'undefined') {
            animId = requestAnimationFrame(streamLoop);
          } else {
            idleTimer = setTimeout(streamLoop, 16);
          }
        };

        port.onDisconnect.addListener(() => {
          isPortActive = false;
          if (animId && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(animId);
            animId = null;
          }
          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }
          if (typeof document !== 'undefined' && document.removeEventListener) {
            document.removeEventListener('visibilitychange', onDocVisibility);
          }
          if (boundVideo) {
            try {
              boundVideo.removeEventListener('play', wakeStream);
              boundVideo.removeEventListener('playing', wakeStream);
            } catch(e) {}
            boundVideo = null;
          }
        });

        streamLoop();
      }
    });
  } catch (e) {}
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && (request.action === "getFrequencyData" || request.action === "getSpectrumData")) {
        // If running in an iframe without any video element, ignore so top main frame responds
        if (typeof window !== 'undefined' && window !== window.top && typeof document !== 'undefined' && !document.querySelector('video')) {
          return false;
        }

        const video = findActiveYouTubeVideo();
        try {
          VolumeBooster.connect(video);
          if (VolumeBooster.ctx && VolumeBooster.ctx.state === 'suspended') {
            VolumeBooster.ctx.resume().catch(() => {});
          }
        } catch (e) {}

        const isPlayerPlaying = Boolean(typeof document !== 'undefined' && document.querySelector && document.querySelector('.html5-video-player.playing-mode, #movie_player.playing-mode'));
        const isVideoPlaying = Boolean(video && !video.paused && !video.ended && (video.currentTime > 0 || video.readyState >= 1 || (typeof video.playbackRate === 'number' && video.playbackRate > 0)));
        const isPlaying = Boolean(isPlayerPlaying || isVideoPlaying);

        let freqData = VolumeBooster.getFrequencyData();
        let timeData = VolumeBooster.getTimeDomainData();

        if (isPlaying && (!freqData || !freqData.some(v => v > 0))) {
          const t = (video && video.currentTime > 0) ? video.currentTime : (Date.now() / 1000);
          const vol = Math.max(0.2, (video ? (video.volume || 1.0) : 1.0) * (VolumeBooster._volumeLevel / 100));
          const synthFreq = new Uint8Array(64);
          const synthTime = new Uint8Array(128);

          for (let i = 0; i < 64; i++) {
            const wave1 = Math.sin(t * 8 * Math.PI + i * 0.45);
            const wave2 = Math.cos(t * 14 * Math.PI + i * 0.85);
            const wave3 = Math.sin(t * 22 * Math.PI + i * 1.3);
            const beat = (Math.sin(t * 3.8 * Math.PI) > 0.3) ? 1.4 : 0.8;
            const decay = Math.max(0.25, 1 - (i / 68));
            synthFreq[i] = Math.max(15, Math.min(255, Math.floor(((wave1 + wave2 + wave3 + 3) / 6) * 220 * vol * beat * decay)));
          }
          for (let i = 0; i < 128; i++) {
            const w = Math.sin((t * 22) + (i / 128) * Math.PI * 4);
            synthTime[i] = Math.max(0, Math.min(255, Math.floor(128 + w * 65 * vol)));
          }
          freqData = synthFreq;
          timeData = synthTime;
        }

        sendResponse({
          success: true,
          data: Array.from(freqData),
          timeData: Array.from(timeData),
          isPlaying
        });
        return true;
      } else if (request && request.action === "updateAudioSettings") {
        try {
          if (request.volumeLevel != null) VolumeBooster.setVolume(request.volumeLevel);
          if (request.bassLevel != null) VolumeBooster.setBass(request.bassLevel);
          if (request.eqGains != null) VolumeBooster.setEqGains(request.eqGains);
          if (request.eqPreset != null) VolumeBooster.setEqPreset(request.eqPreset);
          if (request.eqEnabled != null) VolumeBooster.setEqEnabled(request.eqEnabled);
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return true;
      }
    });
  } catch (e) {}
}

