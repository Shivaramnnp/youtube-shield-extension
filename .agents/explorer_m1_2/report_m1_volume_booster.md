# M1 Detailed Technical Exploration Report: Volume Booster EQ Proxying & DOM Interception

**Agent ID**: `explorer_m1_2` (teamwork_preview_explorer)  
**Milestone**: M1 — 10-Band Graphic Equalizer Engine & Presets  
**Target Module**: `content/js/volume-booster.js`  
**Related Modules**: `utils/audio-engine.js`, `content/js/main.js`, `content/js/header-button.js`  
**Date**: 2026-08-14  

---

## 1. Executive Summary & Objective

This report details the technical investigation and step-by-step implementation guide for Milestone M1 (`content/js/volume-booster.js`). 
`VolumeBoosterClass` serves as the primary YouTube DOM audio interception layer in the content script context. It intercepts YouTube `<video>` elements, establishes a Web Audio API node graph, and proxies all volume, bass, and 10-band equalizer operations to `AudioEngine` (or falls back to an internal standalone 10-band BiquadFilterNode chain if `AudioEngine` is absent).

Key design achievements specified in this report:
1. **EQ Proxy API Exposure**: Seamlessly exposes `setEqGains(gainsArray)`, `setEqPreset(presetName)`, `setEqBandGain(bandIndex, gainDb)`, `getEqGains()`, `getEqPreset()`, and `setEqEnabled(enabled)`.
2. **Dual-Mode Graph Support**: Proxies directly to `AudioEngine` when loaded on YouTube pages, while building a full standalone 10-band filter graph (32Hz lowshelf, 64Hz-8kHz peaking, 16kHz highshelf) in fallback environments.
3. **Safari WebKit Safety & WeakMap Caching**: Utilizes `_sourceNodeMap` (`WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>`) and `video._ssMediaSourceNode` property fallback to guarantee single-source node reuse, eliminating WebKit `InvalidStateError` DOMExceptions during dynamic media source updates.
4. **SPA Navigation Continuity**: Binds to YouTube's custom `yt-navigate-finish` event with async DOM polling fallbacks to ensure EQ gain profiles and active presets persist across video transitions (e.g. watch page to Shorts) without audio dropouts or setting resets.

---

## 2. Examination of `VolumeBoosterClass` Architecture & Proxying Mechanism

### 2.1 Existing Operations & Proxying Pattern
Currently, `VolumeBoosterClass` in `content/js/volume-booster.js` manages volume (`setVolume`) and bass (`setBass`) by delegating to `window.AudioEngine` (or `global.AudioEngine`):

```javascript
setVolume(percent) {
  const num = Number(percent);
  const level = Math.max(0, Math.min(600, isNaN(num) ? 100 : num));
  this._volumeLevel = level;

  const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                      (typeof global !== 'undefined' && global.AudioEngine);
  if (audioEngine && typeof audioEngine.setVolume === 'function') {
    audioEngine.setVolume(level);
    this.gainNode = audioEngine.gainNode;
  }

  if (this.gainNode) {
    try {
      this.gainNode.gain.value = level / 100;
    } catch (e) {}
  }
  if (!this.sourceNode) this.connect();
}
```

This pattern has three core characteristics:
1. **State Ownership**: `VolumeBooster` holds authoritative settings in instance state (`this._volumeLevel`, `this._bassLevel`, `this._eqGains`, `this._eqPreset`, `this._eqEnabled`).
2. **AudioEngine Delegation**: If `AudioEngine` is present on the window/global scope, operations are passed down to `AudioEngine`, and internal node references (`ctx`, `sourceNode`, `gainNode`, `bassNode`, `eqNodes`) are synchronized.
3. **Standalone Fallback**: If `AudioEngine` is absent (e.g., in unit testing or isolated script context), `VolumeBooster` constructs and controls its own internal Web Audio nodes graph directly.

---

## 3. Detail of New EQ Proxy Methods Specification

### 3.1 Equalizer Presets & Frequency Definitions
`content/js/volume-booster.js` will define standard 10-band frequencies and preset gain profiles:

- **10-Band Frequencies & Filter Types**:
  - Band 0 (32 Hz): `lowshelf`
  - Band 1 (64 Hz): `peaking` (Q = 1.414)
  - Band 2 (125 Hz): `peaking` (Q = 1.414)
  - Band 3 (250 Hz): `peaking` (Q = 1.414)
  - Band 4 (500 Hz): `peaking` (Q = 1.414)
  - Band 5 (1 kHz): `peaking` (Q = 1.414)
  - Band 6 (2 kHz): `peaking` (Q = 1.414)
  - Band 7 (4 kHz): `peaking` (Q = 1.414)
  - Band 8 (8 kHz): `peaking` (Q = 1.414)
  - Band 9 (16 kHz): `highshelf`

- **9 Preset Profiles**:
  - `Flat`: `[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]`
  - `Bass Boost`: `[6, 5, 4, 2, 0, 0, 0, 0, 0, 0]`
  - `Vocal Booster`: `[-2, -1, 1, 3, 4, 4, 3, 1, 0, -1]`
  - `Treble Boost`: `[0, 0, 0, 0, 0, 1, 2, 4, 5, 6]`
  - `Rock`: `[5, 3, 1, 0, -1, -1, 0, 2, 4, 5]`
  - `Pop`: `[-1, 1, 3, 4, 4, 3, 1, 0, 1, 2]`
  - `Acoustic`: `[3, 2, 1, 1, 2, 2, 3, 3, 2, 1]`
  - `Electronic`: `[4, 4, 2, 0, -2, 2, 1, 2, 4, 5]`
  - `Custom`: Retains custom array.

### 3.2 Method Specifications

#### 1. `setEqGains(gainsArray)`
- **Purpose**: Applies an array of 10 dB gain values (`-12.0dB` to `+12.0dB`).
- **Logic**:
  - Validates `gainsArray` input (must be Array).
  - Clamps each band element between `-12` and `+12` dB.
  - Updates `this._eqGains`.
  - Delegates to `AudioEngine.setEqGains(clampedGains)` if available.
  - If standalone fallback, sets `this.eqNodes[i].gain.value = clampedGains[i]` (or `0` if `_eqEnabled` is false).
  - If `!this.sourceNode`, invokes `this.connect()`.
  - Returns `boolean`.

#### 2. `setEqPreset(presetName)`
- **Purpose**: Sets active preset profile and updates gains array.
- **Logic**:
  - Sets `this._eqPreset = presetName`.
  - If presetName is in `EQ_PRESETS` and not `'Custom'`, updates `this._eqGains` to preset gain array.
  - Delegates to `AudioEngine.setEqPreset(presetName)` if available.
  - If standalone, invokes `this.setEqGains(presetGains)`.
  - If `!this.sourceNode`, invokes `this.connect()`.
  - Returns `boolean`.

#### 3. `setEqBandGain(bandIndex, gainDb)`
- **Purpose**: Modifies a single band gain slider (0 to 9) and switches preset to `'Custom'`.
- **Logic**:
  - Validates `bandIndex` (integer 0..9). Clamps `gainDb` between `-12` and `+12` dB.
  - Updates `this._eqGains[bandIndex] = clampedGain`.
  - Sets `this._eqPreset = 'Custom'`.
  - Delegates to `AudioEngine.setEqBandGain(bandIndex, clampedGain)` or `AudioEngine.setEqGains(this._eqGains)` if available.
  - If standalone, updates `this.eqNodes[bandIndex].gain.value = clampedGain`.
  - If `!this.sourceNode`, invokes `this.connect()`.
  - Returns `boolean`.

#### 4. `getEqGains()`
- **Purpose**: Returns a shallow copy of active 10-band gains array `[...this._eqGains]` to prevent direct mutation.

#### 5. `getEqPreset()`
- **Purpose**: Returns current active preset name string `this._eqPreset`.

#### 6. `setEqEnabled(enabled)`
- **Purpose**: Master toggle for EQ filter processing.
- **Logic**:
  - Updates `this._eqEnabled = Boolean(enabled)`.
  - Delegates to `AudioEngine.setEqEnabled(enabled)` if available.
  - If standalone, sets filter node gains to 0 dB when disabled, or restores `this._eqGains` when enabled.

---

## 4. SPA Navigation Handling (`yt-navigate-finish`) & WeakMap Video Caching

### 4.1 WeakMap Single-Source Node Caching Strategy
In WebKit (Safari), calling `createMediaElementSource(video)` on a `<video>` element that already has an active `MediaElementAudioSourceNode` throws an uncatchable `InvalidStateError`.
`VolumeBoosterClass` uses `this._sourceNodeMap = new WeakMap()` combined with `video._ssMediaSourceNode`:

```javascript
let source = this._sourceNodeMap.get(video) || video._ssMediaSourceNode;
if (!source && this.ctx) {
  source = this.ctx.createMediaElementSource(video);
  if (source) {
    try { this._sourceNodeMap.set(video, source); } catch (e) {}
    try { video._ssMediaSourceNode = source; } catch (e) {}
  }
}
```

- **Garbage Collection**: When YouTube removes old video DOM elements during SPA navigation, `WeakMap` releases node references automatically.
- **Node Reuse**: When YouTube reuses the `<video>` element on navigation, `_sourceNodeMap.get(video)` returns the existing `MediaElementAudioSourceNode`, completely eliminating `InvalidStateError`.

### 4.2 YouTube SPA Event Interception (`yt-navigate-finish`)
YouTube is a Single Page Application (SPA). Navigating between pages (e.g. `/` to `/watch?v=...` to `/shorts/...`) does not reload the page or script context.
`VolumeBooster.enable()` registers an event listener for YouTube's custom navigation event:

```javascript
enable() {
  if (typeof window === 'undefined') return;
  try {
    window.removeEventListener('yt-navigate-finish', this._boundOnNavigate);
    window.addEventListener('yt-navigate-finish', this._boundOnNavigate);
  } catch (e) {}
  this.connect();
}

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
```

- **Setting Continuity**: Because settings (`_volumeLevel`, `_bassLevel`, `_eqGains`, `_eqPreset`) are stored on the persistent `VolumeBooster` instance, every call to `connect()` during SPA navigation automatically re-applies the active volume, bass, and EQ profile to the new audio graph chain.

---

## 5. Step-by-Step Implementation Guide for Worker Agent

The Worker agent should apply the following modifications to `/Users/shivarampatel/Desktop/shorts-shield/content/js/volume-booster.js`:

### Step 1: Add EQ Preset Definitions & Frequencies Constants
Insert near top of `content/js/volume-booster.js` (after class description header):

```javascript
const EQ_PRESETS = {
  'Flat':           [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost':     [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  'Vocal Booster':  [-2, -1, 1, 3, 4, 4, 3, 1, 0, -1],
  'Treble Boost':   [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
  'Rock':           [5, 3, 1, 0, -1, -1, 0, 2, 4, 5],
  'Pop':            [-1, 1, 3, 4, 4, 3, 1, 0, 1, 2],
  'Acoustic':       [3, 2, 1, 1, 2, 2, 3, 3, 2, 1],
  'Electronic':     [4, 4, 2, 0, -2, 2, 1, 2, 4, 5],
  'Custom':         null
};

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
```

### Step 2: Initialize Constructor State Properties
In `VolumeBoosterClass.constructor`:

```javascript
class VolumeBoosterClass {
  constructor() {
    this.ctx = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.bassNode = null;
    this.eqNodes = [];
    this._connectedVideo = null;
    this._sourceNodeMap = new WeakMap();
    this._volumeLevel = 100;  // 100% = normal
    this._bassLevel = 0;      // 0dB = flat
    this._eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this._eqPreset = 'Flat';
    this._eqEnabled = true;
    this._boundOnNavigate = this._onNavigate.bind(this);
    this._boundOnVideoPlay = this._onVideoPlay.bind(this);
    this._unlockHandler = null;
  }
```

### Step 3: Update `connect()` Method for AudioEngine Integration & Standalone Fallback
In `connect()`:

```javascript
  connect() {
    if (typeof document === 'undefined') return;
    const video = document.querySelector('video.html5-main-video, video');
    if (!video) return;

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
      this._connectedVideo = video;
      return;
    }

    // Standalone fallback graph
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
      if (!video.hasAttribute('crossorigin') && video.src && !video.src.startsWith('blob:')) {
        video.setAttribute('crossorigin', 'anonymous');
      }
      if (video.crossOrigin !== 'anonymous' && video.src && !video.src.startsWith('blob:')) {
        try { video.crossOrigin = 'anonymous'; } catch (e) {}
      }

      let source = this._sourceNodeMap.get(video) || video._ssMediaSourceNode;
      if (!source && this.ctx) {
        source = this.ctx.createMediaElementSource(video);
        if (source) {
          try { this._sourceNodeMap.set(video, source); } catch (e) {}
          try { video._ssMediaSourceNode = source; } catch (e) {}
        }
      }

      this.sourceNode = source;
      this._connectedVideo = video;

      if (this.ctx) {
        this.gainNode = this.ctx.createGain();
        const volNum = Number(this._volumeLevel);
        const volVal = isNaN(volNum) ? 100 : volNum;
        this.gainNode.gain.value = Math.max(0, Math.min(6.0, volVal / 100));

        this.bassNode = this.ctx.createBiquadFilter();
        this.bassNode.type = 'lowshelf';
        this.bassNode.frequency.value = 150;
        this.bassNode.gain.value = Math.max(0, Math.min(20, Number(this._bassLevel) || 0));

        this.eqNodes = [];
        for (let i = 0; i < 10; i++) {
          const filter = this.ctx.createBiquadFilter();
          filter.frequency.value = EQ_FREQUENCIES[i];
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

        if (this.sourceNode) {
          this.sourceNode.connect(this.gainNode);
          this.gainNode.connect(this.bassNode);
          
          let lastNode = this.bassNode;
          for (let i = 0; i < 10; i++) {
            lastNode.connect(this.eqNodes[i]);
            lastNode = this.eqNodes[i];
          }
          lastNode.connect(this.ctx.destination);
        }
      }
    } catch (e) {
      this._connectedVideo = video;
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
  }
```

### Step 4: Implement EQ Proxy Methods in `VolumeBoosterClass`

```javascript
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

    if (!this.sourceNode) this.connect();
    return true;
  }

  setEqPreset(presetName) {
    if (typeof presetName !== 'string') return false;
    this._eqPreset = presetName;

    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);

    if (audioEngine && typeof audioEngine.setEqPreset === 'function') {
      audioEngine.setEqPreset(presetName);
      if (Array.isArray(audioEngine.eqGains)) {
        this._eqGains = [...audioEngine.eqGains];
      }
      if (audioEngine.eqNodes) this.eqNodes = audioEngine.eqNodes;
    } else {
      const presetGains = EQ_PRESETS[presetName];
      if (presetGains) {
        this.setEqGains(presetGains);
      }
    }

    if (!this.sourceNode) this.connect();
    return true;
  }

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
    return true;
  }

  getEqGains() {
    return [...this._eqGains];
  }

  getEqPreset() {
    return this._eqPreset;
  }

  setEqEnabled(enabled) {
    this._eqEnabled = Boolean(enabled);

    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);

    if (audioEngine && typeof audioEngine.setEqEnabled === 'function') {
      audioEngine.setEqEnabled(this._eqEnabled);
    } else {
      this.setEqGains(this._eqGains);
    }
  }
```

### Step 5: Update `reset()` Method
```javascript
  reset() {
    this.setVolume(100);
    this.setBass(0);
    this.setEqPreset('Flat');
  }
```

---

## 6. Verification Method

To independently verify the implementation:

1. **Static Syntax Verification**:
   ```bash
   node -c content/js/volume-booster.js utils/audio-engine.js content/js/main.js
   ```
   Must execute cleanly with return code `0`.

2. **Automated Unit Tests**:
   ```bash
   npm test
   ```
   Must execute with 100% test pass rate across all 303+ test cases.

3. **EQ Proxy Functional Invalidation Checks**:
   - Verify `VolumeBooster.setEqGains([-12, -6, 0, 3, 6, 9, 12, 6, 0, -6])` updates `_eqGains` array and node filter gains.
   - Verify `VolumeBooster.getEqGains()` returns a new array copy (modifying returned array does not corrupt internal state).
   - Verify `VolumeBooster.setEqPreset('Bass Boost')` loads exact preset array `[6, 5, 4, 2, 0, 0, 0, 0, 0, 0]`.
   - Verify `VolumeBooster.setEqBandGain(3, 8)` sets band 3 gain to 8dB and sets preset to `'Custom'`.
   - Verify YouTube SPA navigation re-connects video without throwing Safari `InvalidStateError` or resetting EQ gains.
