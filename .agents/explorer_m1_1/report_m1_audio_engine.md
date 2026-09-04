# Milestone M1: Technical Exploration Report
## 10-Band Graphic Equalizer Engine in `utils/audio-engine.js`

**Author**: Explorer 1 (`teamwork_preview_explorer`)  
**Target Module**: `utils/audio-engine.js` (with delegation in `content/js/volume-booster.js`)  
**Milestone**: M1 (10-Band Graphic Equalizer Engine & Presets)  
**Date**: 2026-08-14  

---

## Executive Summary

This report provides the exact architectural specification, line-level code structure, Web Audio API graph topology, gain clamping logic, preset profile mapping, and a step-by-step worker implementation guide for Milestone M1.

The objective of M1 is to extend `AudioEngineClass` in `utils/audio-engine.js` to manage a 10-Band Graphic Audio Equalizer with individual band gains constrained strictly to `[-12, +12]` dB, 9 preset profiles (`Flat`, `Bass Boost`, `Vocal Booster`, `Treble Boost`, `Rock`, `Pop`, `Acoustic`, `Electronic`, `Custom`), and complete API methods (`setEqGains`, `setEqBandGain`, `setEqPreset`, `getEqGains`, `getEqPreset`, `resetEq`).

---

## 1. Class Structure & Line Locations in `AudioEngineClass`

### 1.1 Summary of File Location
- **File**: `utils/audio-engine.js` (Total lines: ~331)
- **Target Class**: `AudioEngineClass` (Lines 6–317)

### 1.2 Configuration Constants Definition (Insert around Line 5)
Insert static band configuration `EQ_BANDS` and preset table `EQ_PRESETS` before `AudioEngineClass`:

```javascript
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
  'Vocal Booster': [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  'Treble Boost':  [0, 0, 0, 0, 0, 1, 3, 5, 7, 8],
  'Rock':          [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
  'Pop':           [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
  'Acoustic':      [3, 2, 1, 1, 2, 2, 3, 3, 2, 1],
  'Electronic':    [5, 4, 2, 0, -2, 2, 1, 2, 4, 5],
  'Custom':        null // Preserves custom gains
};
```

### 1.3 Constructor Updates (Lines 7–18)
Add properties to store filter node references, numerical gain values, and active preset:

```javascript
class AudioEngineClass {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.sourceNode = null;
    this.bassNode = null;
    this.gainNode = null;
    this.eqNodes = [];                                // Array of 10 BiquadFilterNode instances
    this.eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];   // 10 band gains in dB (-12dB to +12dB)
    this.eqPreset = 'Flat';                          // Current preset identifier
    this._connectedVideo = null;
    this._attachedSourceMap = new WeakMap();
    this._volumeLevel = 100;
    this._bassLevel = 0;
    this._unlockHandler = null;
  }
```

---

## 2. Web Audio API Graph Topology & Routing

### 2.1 Graph Architecture
The extended audio processing graph routes video audio sequentially through volume amplification, legacy bass filtering (for backward compatibility), the 10 equalizer BiquadFilterNodes, and to the AudioContext destination:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        YouTube <video> Element                            │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    MediaElementAudioSourceNode                            │
│      (WeakMap cached, crossOrigin="anonymous", WebKit gesture unlocked)   │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        GainNode (Volume: 100%–600%)                        │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                   (Legacy Bass Filter: BiquadFilterNode 150Hz)            │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                     10-Band BiquadFilterNode Chain                        │
│                                                                           │
│   [0]  32Hz   lowshelf   (gain: eqGains[0])                               │
│   [1]  64Hz   peaking    Q=1.414 (gain: eqGains[1])                       │
│   [2]  125Hz  peaking    Q=1.414 (gain: eqGains[2])                       │
│   [3]  250Hz  peaking    Q=1.414 (gain: eqGains[3])                       │
│   [4]  500Hz  peaking    Q=1.414 (gain: eqGains[4])                       │
│   [5]  1kHz   peaking    Q=1.414 (gain: eqGains[5])                       │
│   [6]  2kHz   peaking    Q=1.414 (gain: eqGains[6])                       │
│   [7]  4kHz   peaking    Q=1.414 (gain: eqGains[7])                       │
│   [8]  8kHz   peaking    Q=1.414 (gain: eqGains[8])                       │
│   [9]  16kHz  highshelf  (gain: eqGains[9])                               │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                   AudioContext.destination / Output                       │
│            *(M2 will insert AnalyserNode prior to destination)*           │
└───────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Node Instantiation & Wiring in `attachToVideo(videoEl)` (Lines 170–213)
Within `attachToVideo(videoEl)`:

```javascript
// 1. Initialize or update EQ BiquadFilterNodes (10 bands)
if (this.ctx && (!this.eqNodes || this.eqNodes.length !== 10)) {
  this.eqNodes = [];
  for (let i = 0; i < EQ_BANDS.length; i++) {
    try {
      const filter = this.ctx.createBiquadFilter();
      filter.type = EQ_BANDS[i].type;
      filter.frequency.value = EQ_BANDS[i].freq;
      if (EQ_BANDS[i].type === 'peaking') {
        filter.Q.value = EQ_BANDS[i].Q;
      }
      const gainDb = Math.max(-12, Math.min(12, Number(this.eqGains[i]) || 0));
      filter.gain.value = gainDb;
      this.eqNodes.push(filter);
    } catch (e) {
      this.eqNodes.push(null);
    }
  }
} else if (this.ctx && this.eqNodes && this.eqNodes.length === 10) {
  for (let i = 0; i < 10; i++) {
    if (this.eqNodes[i]) {
      const gainDb = Math.max(-12, Math.min(12, Number(this.eqGains[i]) || 0));
      this.eqNodes[i].gain.value = gainDb;
    }
  }
}

// 2. Disconnect existing nodes safely
try { if (this.sourceNode) this.sourceNode.disconnect(); } catch (e) {}
try { if (this.bassNode) this.bassNode.disconnect(); } catch (e) {}
try { if (this.gainNode) this.gainNode.disconnect(); } catch (e) {}
if (Array.isArray(this.eqNodes)) {
  this.eqNodes.forEach(node => {
    try { if (node) node.disconnect(); } catch (e) {}
  });
}

// 3. Connect graph chain sequentially
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
    current.connect(this.ctx.destination);
  }
} catch (e) {}
```

---

## 3. Equalizer Control API & Gain Clamping Implementation

### 3.1 Strict Gain Clamping Specification
All gain values set via API methods must be strictly clamped to `[-12, +12]` dB using `Math.max(-12, Math.min(12, Number(val) || 0))`. Invalid inputs (e.g. `NaN`, `null`, `undefined`, non-numeric strings) must default safely to `0` before clamping.

### 3.2 Method Specifications for `AudioEngineClass`

#### `setEqGains(gainsArray)`
- **Purpose**: Applies an array of 10 dB gain values to all 10 equalizer filter bands.
- **Parameters**: `gainsArray` (Array of 10 numbers in dB).
- **Behavior**:
  1. Validates `Array.isArray(gainsArray)`. Returns `false` if invalid.
  2. Iterates over 10 elements. Clamps each value to `[-12, +12]`.
  3. Updates `this.eqGains[i]` and `this.eqNodes[i].gain.value` (if node exists).
  4. Automatically detects whether the gains match an existing preset (e.g. `'Flat'`, `'Rock'`), updating `this.eqPreset` accordingly, or setting `this.eqPreset = 'Custom'`.
- **Returns**: `boolean` (`true` on success, `false` on failure).

```javascript
setEqGains(gainsArray) {
  if (!Array.isArray(gainsArray)) return false;

  for (let i = 0; i < 10; i++) {
    const val = Number(gainsArray[i]);
    const db = isNaN(val) ? 0 : val;
    const clamped = Math.max(-12, Math.min(12, db));
    this.eqGains[i] = clamped;

    if (this.eqNodes && this.eqNodes[i]) {
      try {
        this.eqNodes[i].gain.value = clamped;
      } catch (e) {}
    }
  }

  this.eqPreset = this._detectPreset(this.eqGains);
  return true;
}
```

#### `setEqBandGain(bandIdx, gainDb)`
- **Purpose**: Sets the gain in dB for a single specific equalizer band.
- **Parameters**: `bandIdx` (number, 0–9), `gainDb` (number in dB).
- **Behavior**:
  1. Validates `bandIdx` is an integer within `0..9`. Returns `false` if out of bounds.
  2. Clamps `gainDb` to `[-12, +12]`.
  3. Updates `this.eqGains[bandIdx]` and `this.eqNodes[bandIdx].gain.value`.
  4. Updates `this.eqPreset = this._detectPreset(this.eqGains)`.
- **Returns**: `boolean` (`true` on success, `false` on failure).

```javascript
setEqBandGain(bandIdx, gainDb) {
  const idx = Math.floor(Number(bandIdx));
  if (isNaN(idx) || idx < 0 || idx > 9) return false;

  const val = Number(gainDb);
  const db = isNaN(val) ? 0 : val;
  const clamped = Math.max(-12, Math.min(12, db));
  this.eqGains[idx] = clamped;

  if (this.eqNodes && this.eqNodes[idx]) {
    try {
      this.eqNodes[idx].gain.value = clamped;
    } catch (e) {}
  }

  this.eqPreset = this._detectPreset(this.eqGains);
  return true;
}
```

#### `setEqPreset(presetName)`
- **Purpose**: Sets all 10 band gains according to a pre-defined EQ profile preset.
- **Parameters**: `presetName` (string).
- **Supported Presets**: `'Flat'`, `'Bass Boost'`, `'Vocal Booster'`, `'Treble Boost'`, `'Rock'`, `'Pop'`, `'Acoustic'`, `'Electronic'`, `'Custom'`.
- **Behavior**:
  1. Normalizes string (supports case-insensitivity and aliases like `'bass_boost'`).
  2. If valid preset found in `EQ_PRESETS`, sets `this.eqPreset = resolvedName` and invokes `this.setEqGains(EQ_PRESETS[resolvedName])`.
  3. If `'Custom'`, sets `this.eqPreset = 'Custom'`.
  4. Returns `true` if preset is recognized, `false` otherwise.

```javascript
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
```

#### `getEqGains()`
- **Purpose**: Returns current equalizer gains array.
- **Returns**: `Array<number>` of length 10 (shallow copy `[...this.eqGains]`).

```javascript
getEqGains() {
  return [...this.eqGains];
}
```

#### `getEqPreset()`
- **Purpose**: Returns current preset profile name.
- **Returns**: `string` (e.g. `'Flat'`, `'Rock'`).

```javascript
getEqPreset() {
  return this.eqPreset;
}
```

#### `resetEq()`
- **Purpose**: Resets equalizer to `'Flat'` profile (`[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]`).
- **Returns**: `boolean`.

```javascript
resetEq() {
  return this.setEqPreset('Flat');
}
```

#### Helper Method `_detectPreset(gains)`
- **Purpose**: Checks if a gains array matches any defined preset.

```javascript
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
```

---

## 4. `VolumeBooster` Proxy Integration in `content/js/volume-booster.js`

To ensure full transparency across content script modules, `VolumeBoosterClass` in `content/js/volume-booster.js` must expose proxy delegates:

```javascript
setEqGains(gainsArray) {
  const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                      (typeof global !== 'undefined' && global.AudioEngine);
  if (audioEngine && typeof audioEngine.setEqGains === 'function') {
    return audioEngine.setEqGains(gainsArray);
  }
  return false;
}

setEqBandGain(bandIdx, gainDb) {
  const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                      (typeof global !== 'undefined' && global.AudioEngine);
  if (audioEngine && typeof audioEngine.setEqBandGain === 'function') {
    return audioEngine.setEqBandGain(bandIdx, gainDb);
  }
  return false;
}

setEqPreset(presetName) {
  const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                      (typeof global !== 'undefined' && global.AudioEngine);
  if (audioEngine && typeof audioEngine.setEqPreset === 'function') {
    return audioEngine.setEqPreset(presetName);
  }
  return false;
}

getEqGains() {
  const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                      (typeof global !== 'undefined' && global.AudioEngine);
  if (audioEngine && typeof audioEngine.getEqGains === 'function') {
    return audioEngine.getEqGains();
  }
  return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

getEqPreset() {
  const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                      (typeof global !== 'undefined' && global.AudioEngine);
  if (audioEngine && typeof audioEngine.getEqPreset === 'function') {
    return audioEngine.getEqPreset();
  }
  return 'Flat';
}
```

---

## 5. Step-by-Step Implementation Guide for Worker

### Step 1: File Preparation
- Open `utils/audio-engine.js`.

### Step 2: Insert EQ Constants
- Place `EQ_BANDS` and `EQ_PRESETS` at the top of `utils/audio-engine.js` (above `AudioEngineClass`).

### Step 3: Extend Constructor
- In `AudioEngineClass.constructor()`, add properties:
  `this.eqNodes = [];`
  `this.eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];`
  `this.eqPreset = 'Flat';`

### Step 4: Implement Equalizer API & Preset Detection Methods
- Add `setEqGains(gainsArray)`, `setEqBandGain(bandIdx, gainDb)`, `setEqPreset(presetName)`, `getEqGains()`, `getEqPreset()`, `resetEq()`, and `_detectPreset(gains)` methods to `AudioEngineClass`.

### Step 5: Update Video Node Creation & Routing Graph in `attachToVideo`
- In `attachToVideo(videoEl)`, instantiate 10 `BiquadFilterNode` elements into `this.eqNodes` if not already created.
- Update disconnect routine to disconnect `sourceNode`, `bassNode`, `gainNode`, and all 10 `eqNodes`.
- Update connect routine to connect `sourceNode -> (bassNode) -> gainNode -> eqNodes[0..9] -> destination`.

### Step 6: Update `content/js/volume-booster.js`
- Open `content/js/volume-booster.js`.
- Add proxy delegate methods (`setEqGains`, `setEqBandGain`, `setEqPreset`, `getEqGains`, `getEqPreset`) to `VolumeBoosterClass`.

### Step 7: Static Integrity Verification
- Run `node -c utils/audio-engine.js` and `node -c content/js/volume-booster.js`.
- Run `node -c` check across all JavaScript files.

### Step 8: Test Suite Verification
- Run `npm test` to verify zero regression across existing test suites.

---

## 6. Verification Criteria

| Verification Item | Target Standard | Invalidation Condition |
|---|---|---|
| Filter Count & Types | 10 BiquadFilterNodes (32Hz lowshelf, 64Hz-8kHz peaking Q=1.414, 16kHz highshelf) | Missing node or incorrect Q/frequency |
| Gain Clamping Range | Strict `[-12, +12]` dB bounds | Any gain value exceeding ±12 dB |
| Web Audio API Graph | `Source -> Gain -> eqNodes[0..9] -> Destination` | Audio disconnection or unhandled WebKit error |
| Syntax Verification | `node -c` 100% clean | Any syntax error |
| Automated Test Suite | `npm test` 100% pass | Any test failure or console exception |

---

*Report compiled by Explorer 1 (`teamwork_preview_explorer`). Ready for Worker implementation.*
