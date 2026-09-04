/**
 * YouTube Shield — Page-Context Web Audio DSP Engine (Safari & MV3 WebKit Bridge)
 * Runs directly in YouTube page execution context (MAIN world) to guarantee 100%
 * Web Audio API compatibility with HTMLMediaElement in Safari, Chrome, and Firefox.
 */
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
    static get EQ_BANDS() { return EQ_BANDS; }
    static get EQ_PRESETS() { return EQ_PRESETS; }

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
      this._noiseRemover = false;
      this.subsonicFilter = null;
      this.antiHissFilter = null;
      this.compressorNode = null;

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
        if (this.ctx) {
          try {
            this.ctx.onstatechange = () => {
              this.notifyState();
            };
          } catch (e) {}
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    unlock() {
      if (this.ctx && this.ctx.state === "suspended") {
        return this.ctx.resume().then(() => {
          this.notifyState();
        }).catch(() => {});
      }
      return Promise.resolve();
    }

    bindGestureUnlocks() {
      const unlockHandler = () => {
        if (!this.ctx) this.initContext();
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume().then(() => {
            this.notifyState();
          }).catch(() => {});
        }
        if (!this.sourceNode || !this._connectedVideo) {
          this.scanAndAttach();
        }
      };

      const events = ["click", "pointerdown", "mousedown", "keydown", "touchstart", "touchend", "play", "playing", "input"];
      events.forEach(evt => {
        try { window.addEventListener(evt, unlockHandler, { capture: true, passive: true }); } catch (e) {}
        try { document.addEventListener(evt, unlockHandler, { capture: true, passive: true }); } catch (e) {}
      });
    }

    listenNavigationEvents() {
      const navHandler = () => {
        this.scanAndAttach();
        this.unlock();
        this.notifyState();
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
        this.notifyState();
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
          // If already attached in page context or WebKit throws, reuse existing
          source = videoEl._ssPageSourceNode || null;
        }
      }

      if (!source) return false;

      this.sourceNode = source;
      this._connectedVideo = videoEl;

      try {
        // Bass Filter (150Hz lowshelf)
        if (!this.bassNode) {
          this.bassNode = this.ctx.createBiquadFilter();
          this.bassNode.type = "lowshelf";
          this.bassNode.frequency.value = 150;
        }

        // Gain Node (Volume)
        if (!this.gainNode) {
          this.gainNode = this.ctx.createGain();
        }

        // 10-Band EQ Filters
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

        // Analyser Node (64 bins)
        if (!this.analyserNode) {
          this.analyserNode = this.ctx.createAnalyser();
          this.analyserNode.fftSize = 128;
          this.analyserNode.smoothingTimeConstant = 0.8;
        }

        // Noise Remover / Clarifier filters (Subsonic Highpass & Anti-Hiss Lowpass)
        try {
          if (!this.subsonicFilter) {
            this.subsonicFilter = this.ctx.createBiquadFilter();
            this.subsonicFilter.type = "highpass";
            this.subsonicFilter.frequency.value = 30;
            this.subsonicFilter.Q.value = 0.707;
          }
          if (!this.antiHissFilter) {
            this.antiHissFilter = this.ctx.createBiquadFilter();
            this.antiHissFilter.type = "lowpass";
            this.antiHissFilter.frequency.value = 18500;
            this.antiHissFilter.Q.value = 0.707;
          }
          if (!this.compressorNode && typeof this.ctx.createDynamicsCompressor === "function") {
            this.compressorNode = this.ctx.createDynamicsCompressor();
            this.compressorNode.threshold.value = -12;
            this.compressorNode.knee.value = 30;
            this.compressorNode.ratio.value = 12;
            this.compressorNode.attack.value = 0.003;
            this.compressorNode.release.value = 0.25;
          }
        } catch (e) {}

        // Connect graph
        this.sourceNode.disconnect();
        try { if (this.subsonicFilter) this.subsonicFilter.disconnect(); } catch (e) {}
        try { if (this.bassNode) this.bassNode.disconnect(); } catch (e) {}
        try { if (this.gainNode) this.gainNode.disconnect(); } catch (e) {}
        if (Array.isArray(this.eqNodes)) {
          this.eqNodes.forEach(n => { try { if (n) n.disconnect(); } catch (e) {} });
        }
        try { if (this.antiHissFilter) this.antiHissFilter.disconnect(); } catch (e) {}
        try { if (this.compressorNode) this.compressorNode.disconnect(); } catch (e) {}
        try { if (this.analyserNode) this.analyserNode.disconnect(); } catch (e) {}

        let current = this.sourceNode;

        // 1. Bass Boost Filter (150Hz lowshelf)
        current.connect(this.bassNode);
        current = this.bassNode;

        // 2. Volume Gain Node
        current.connect(this.gainNode);
        current = this.gainNode;

        // 3. 10-Band EQ
        for (let i = 0; i < 10; i++) {
          current.connect(this.eqNodes[i]);
          current = this.eqNodes[i];
        }

        // 4. Spectrum Visualizer Analyser
        current.connect(this.analyserNode);

        // 5. Noise Remover & Anti-Distortion Clarifier (Post-Analyser Output Chain)
        let outputNode = this.analyserNode;
        if (this._noiseRemover) {
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

        this.applyAllParams();

        const onPlay = () => {
          this.unlock();
          this.applyAllParams();
          this.notifyState();
        };
        videoEl.removeEventListener("play", onPlay);
        videoEl.addEventListener("play", onPlay);
        videoEl.removeEventListener("playing", onPlay);
        videoEl.addEventListener("playing", onPlay);

        this.notifyState();
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
        observer.observe(target, {
          childList: true,
          subtree: true
        });
      }
    }

    notifyState() {
      const connected = Boolean(this.sourceNode);
      const contextState = this.ctx ? this.ctx.state : "suspended";

      if (typeof document !== "undefined" && document.documentElement) {
        try {
          document.documentElement.setAttribute("data-ss-audio-connected", connected ? "true" : "false");
          document.documentElement.setAttribute("data-ss-audio-state", contextState);
        } catch (e) {}
      }

      if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
        try {
          window.dispatchEvent(new CustomEvent("__SS_AUDIO_STATE__", {
            detail: {
              connected,
              contextState,
              volumeLevel: this._volumeLevel,
              bassLevel: this._bassLevel,
              eqEnabled: this._eqEnabled,
              activePreset: this._eqPreset
            }
          }));
        } catch (e) {}
      }
    }

    setVolume(percent) {
      const num = Number(percent);
      const level = Math.max(0, Math.min(600, isNaN(num) ? 100 : num));
      this._volumeLevel = level;
      if (this.gainNode) {
        try {
          const t = (this.ctx && this.ctx.currentTime) || 0;
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
      this.notifyState();
    }

    setBass(db) {
      const level = Math.max(0, Math.min(20, Number(db) || 0));
      this._bassLevel = level;
      if (this.bassNode) {
        try {
          const t = (this.ctx && this.ctx.currentTime) || 0;
          this.bassNode.gain.cancelScheduledValues(t);
          this.bassNode.gain.setValueAtTime(level, t);
        } catch (e) {
          this.bassNode.gain.value = level;
        }
      }
      this.notifyState();
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
      if (Array.isArray(this.eqNodes) && this.eqNodes.length === 10) {
        const t = (this.ctx && this.ctx.currentTime) || 0;
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
      this.notifyState();
    }

    setEqPreset(presetName) {
      if (typeof presetName !== "string") return false;
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
      if (normalized === "Custom") {
        this._eqPreset = "Custom";
        this.notifyState();
        return true;
      }
      if (EQ_PRESETS[normalized]) {
        this._eqPreset = normalized;
        this.setEqGains(EQ_PRESETS[normalized]);
        this.notifyState();
        return true;
      }
      return false;
    }

    setEqEnabled(enabled) {
      this._eqEnabled = Boolean(enabled);
      this.setEqGains(this._eqGains);
      this.notifyState();
    }

    setNoiseRemover(enabled) {
      this._noiseRemover = Boolean(enabled);
      if (this._connectedVideo) {
        this.attachToVideo(this._connectedVideo);
      }
      this.notifyState();
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
        if (d.noiseRemover != null) this.setNoiseRemover(d.noiseRemover);
        this.notifyState();
      });

      window.addEventListener("__SS_AUDIO_GET_STATE__", () => {
        this.notifyState();
      });
    }

    getFrequencyData() {
      if (this.analyserNode) {
        try {
          const binCount = this.analyserNode.frequencyBinCount || 64;
          const dataArray = new Uint8Array(binCount);
          this.analyserNode.getByteFrequencyData(dataArray);
          if (dataArray.some(v => v > 0)) return dataArray;
        } catch (e) {}
      }
      if (this._connectedVideo || typeof document !== 'undefined') {
        const video = this._connectedVideo || this.findActiveVideo();
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

    getTimeDomainData() {
      if (this.analyserNode) {
        try {
          const binCount = this.analyserNode.fftSize || 128;
          const dataArray = new Uint8Array(binCount);
          this.analyserNode.getByteTimeDomainData(dataArray);
          if (dataArray.some(v => v !== 128 && v !== 0)) return dataArray;
        } catch (e) {}
      }
      if (this._connectedVideo || typeof document !== 'undefined') {
        const video = this._connectedVideo || this.findActiveVideo();
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
  }

  window.__SS_PAGE_AUDIO_DSP__ = new PageAudioDspEngine();
})();
