# Technical Survey Report: Audio Engine & Equalizer Infrastructure

**Target Component:** Audio Engine & Equalizer (R1 10-Band Graphic Equalizer Engine & R2 Real-Time Output Frequency Spectrum Analyser)  
**Project:** GodMode Extension (Shorts Shield)  
**Author:** Explorer 1 (`teamwork_preview_explorer`)  
**Date:** 2026-08-14  

---

## 1. Executive Summary

This report presents a thorough technical survey and architectural specification for extending the GodMode Extension with a **Professional 10-Band Graphic Audio Equalizer** and a **Real-Time Output Frequency Spectrum Analyser**. 

### Core Architectural Discoveries:
1. **Existing Audio Subsystem**: The current audio architecture centers around `utils/audio-engine.js` (`AudioEngineClass` singleton) and `content/js/volume-booster.js` (`VolumeBoosterClass` singleton). The processing graph currently connects:  
   `MediaElementSource → BiquadFilter (150Hz lowshelf bass) → GainNode (volume 100%–600%) → AudioContext.destination`.
2. **Safari WebKit Compatibility**: The existing codebase features a 6-event gesture unlock mechanism (`play`, `playing`, `click`, `touchstart`, `pointerdown`, `keydown`) and `WeakMap` node caching (`_attachedSourceMap`) attached to `<video>` elements, preventing `InvalidStateError` when re-attaching media element sources during YouTube SPA navigation.
3. **Graph Topology Extension Plan**: The updated Web Audio API graph will seamlessly chain 10 `BiquadFilterNode` instances and an `AnalyserNode`:  
   `MediaElementSource → GainNode (Volume) → 10 BiquadFilterNodes (32Hz–16kHz) → AnalyserNode → AudioContext.destination`.
4. **IPC Frequency Streaming**: Frequency data from `AnalyserNode.getByteFrequencyData()` in the content script will be communicated to the Popup and Options UI via non-blocking Chrome Extension messaging (`chrome.runtime.connect` port streaming / `chrome.tabs.sendMessage`), driving 60 FPS HTML5 Canvas visualizers with glowing gradient bars and peak-hold indicators.

---

## 2. Existing Audio Infrastructure Analysis

A precise line-by-line audit of the existing audio codebase was conducted across source files.

| File Path | Class / Singleton | Primary Responsibilities | Key Line Ranges |
|---|---|---|---|
| `utils/audio-engine.js` | `AudioEngineClass` (`AudioEngine`) | Core Web Audio API context manager, node routing, volume & bass gain nodes, synthesized gaming UI sound effects. | Lines 6–330 |
| `content/js/volume-booster.js` | `VolumeBoosterClass` (`VolumeBooster`) | Intercepts YouTube `<video>` elements, handles SPA navigation (`yt-navigate-finish`), proxies to `AudioEngine`. | Lines 10–322 |
| `utils/storage.js` | `StorageUtil` | 3-tier cascade storage (`chrome.storage.sync` → `local` → `memoryCache`) for `volumeBooster` settings. | Lines 30–33, 88, 257–265 |
| `content/js/main.js` | IIFE Content Orchestrator | Initializes `VolumeBooster.enable()`, sets volume/bass from storage, handles storage update listeners. | Lines 108–114 |
| `popup/popup.html` & `popup.js` | Popup UI | Volume (100%–600%) & Bass (0–20dB) range sliders, storage sync. | `popup.html`: 94–110; `popup.js`: 152–185 |
| `options/options.html` & `options.js` | Dashboard Settings | Audio Enhancements section with volume/bass sliders. | `options.html`: 139–164; `options.js`: 74–84, 494–522 |
| `content/js/header-button.js` | Header Popover | Embedded volume and bass boost sliders inside YouTube header menu dialog. | Lines 293–309, 429–459 |

### Detailed Findings on Node Management & Safari Quirks:
- **MediaElementSource Reuse**: Chrome and Safari throw `InvalidStateError: HTMLMediaElement already connected to MediaElementSource` if `createMediaElementSource()` is called twice on the same `<video>` element. `utils/audio-engine.js` (lines 151–164) correctly solves this using `this._attachedSourceMap.get(videoEl) || videoEl._ssMediaSourceNode`.
- **CORS Handling**: `attachToVideo` sets `videoEl.setAttribute('crossorigin', 'anonymous')` and `videoEl.crossOrigin = 'anonymous'` prior to source creation (lines 140–147), preventing silent WebKit audio drops.
- **Gesture Unlock**: Safari suspends `AudioContext` until a user gesture occurs. `attachGestureUnlock()` (lines 72–101) attaches listeners to 6 events across `window`, `document`, and `video`.

---

## 3. R1 Technical Specification: 10-Band Graphic Equalizer Engine

### 3.1 Web Audio API Graph Topology

The Web Audio graph will be restructured to route audio through 10 individual `BiquadFilterNode` instances in series, followed by the `GainNode` and `AnalyserNode`.

```
                    ┌───────────────────────────────┐
                    │     YouTube <video> Element   │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ MediaElementAudioSourceNode   │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │        GainNode (Volume)       │
                    │         (0% to 600%)          │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    10-Band BiquadFilterNode Chain                       │
│                                                                         │
│  [32Hz] ──► [64Hz] ──► [125Hz] ──► [250Hz] ──► [500Hz]                 │
│  (lowshelf) (peaking)  (peaking)   (peaking)   (peaking)                │
│                                                                         │
│  ──► [1kHz] ──► [2kHz] ──► [4kHz] ──► [8kHz] ──► [16kHz]               │
│     (peaking)  (peaking)  (peaking)  (peaking)  (highshelf)              │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────────────┐
                    │         AnalyserNode          │
                    │ (fftSize: 128, smoothing 0.8) │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │    AudioContext.destination   │
                    └───────────────┬───────────────┘
```

### 3.2 Filter Frequency & Node Specs

| Band # | Center Frequency ($f_0$) | BiquadFilter Type | Quality Factor ($Q$) | Gain Range |
|---|---|---|---|---|
| **Band 1** | **32 Hz** | `lowshelf` | $Q = 1.0$ (or $0.707$) | $-12\text{ dB}$ to $+12\text{ dB}$ |
| **Band 2** | **64 Hz** | `peaking` | $Q = 1.414$ | $-12\text{ dB}$ to $+12\text{ dB}$ |
| **Band 3** | **125 Hz** | `peaking` | $Q = 1.414$ | $-12\text{ dB}$ to $+12\text{ dB}$ |
| **Band 4** | **250 Hz** | `peaking` | $Q = 1.414$ | $-12\text{ dB}$ to $+12\text{ dB}$ |
| **Band 5** | **500 Hz** | `peaking` | $Q = 1.414$ | $-12\text{ dB}$ to $+12\text{ dB}$ |
| **Band 6** | **1 kHz (1000 Hz)** | `peaking` | $Q = 1.414$ | $-12\text{ dB}$ to $+12\text{ dB}$ |
| **Band 7** | **2 kHz (2000 Hz)** | `peaking` | $Q = 1.414$ | $-12\text{ dB}$ to $+12\text{ dB}$ |
| **Band 8** | **4 kHz (4000 Hz)** | `peaking` | $Q = 1.414$ | $-12\text{ dB}$ to $+12\text{ dB}$ |
| **Band 9** | **8 kHz (8000 Hz)** | `peaking` | $Q = 1.414$ | $-12\text{ dB}$ to $+12\text{ dB}$ |
| **Band 10** | **16 kHz (16000 Hz)** | `highshelf` | $Q = 1.0$ (or $0.707$) | $-12\text{ dB}$ to $+12\text{ dB}$ |

*Design Rationale for Filter Types*: Utilizing `lowshelf` for 32Hz and `highshelf` for 16kHz provides smooth sub-bass extension and crisp high-frequency air, while the 8 middle bands use `peaking` filters with standard 1-octave bandwidth ($Q = \sqrt{2} \approx 1.414$) to avoid unwanted phase interference between adjacent bands.

### 3.3 Preset EQ Profiles Specification

The engine will support 9 preset profiles. The table below defines the exact gain values in dB for bands `[32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz]`:

| Preset Profile | 32Hz | 64Hz | 125Hz | 250Hz | 500Hz | 1kHz | 2kHz | 4kHz | 8kHz | 16kHz | Profile Description |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Flat** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | Neutral response (0 dB across all bands) |
| **Bass Boost** | +9 | +7 | +5 | +3 | +1 | 0 | 0 | 0 | 0 | 0 | Deep bass amplification for punchy low-end |
| **Vocal Booster** | -2 | -1 | +1 | +3 | +5 | +6 | +5 | +3 | +1 | -1 | Enhanced mid frequencies (500Hz–2kHz) for voice clarity |
| **Treble Boost** | 0 | 0 | 0 | 0 | 0 | +1 | +3 | +5 | +7 | +9 | Crisp high-frequency boost for detail & brightness |
| **Rock** | +5 | +4 | +3 | +1 | -1 | -1 | +1 | +3 | +4 | +5 | Classic V-shaped curve (boosted bass & treble) |
| **Pop** | -1 | +1 | +3 | +4 | +4 | +3 | +2 | +1 | +1 | -1 | Smooth warm mid-bass boost for pop & vocal tracks |
| **Acoustic** | +3 | +3 | +2 | +1 | +2 | +3 | +3 | +4 | +3 | +2 | Natural response with mild vocal & instrumental emphasis |
| **Electronic** | +6 | +5 | +2 | 0 | -2 | +2 | +1 | +4 | +5 | +6 | Strong sub-bass & synth presence for EDM / electronic |
| **Custom** | *User* | *User* | *User* | *User* | *User* | *User* | *User* | *User* | *User* | *User* | User-defined custom slider configuration |

### 3.4 Preset Selection & State Synchronization Flow
1. **Preset Dropdown Change**: Selecting a preset profile (e.g. "Bass Boost") immediately sets `eqGains` to the predefined array, updates all 10 filter nodes' `gain.value`, updates all 10 UI sliders in Popup / Options / Header, and saves `{ equalizer: { preset: 'Bass Boost', gains: [...] } }` to `chrome.storage`.
2. **Individual Slider Adjustment**: When the user adjusts any single slider manually, the `preset` state automatically switches to `"Custom"`, updating the preset selector dropdown accordingly.

---

## 4. R2 Technical Specification: Real-Time Output Frequency Spectrum Analyser

### 4.1 AnalyserNode Configuration
- **`fftSize`**: `128` (provides 64 frequency bins, perfect for 16–32 visualizer bars) or `256` (128 bins).
- **`smoothingTimeConstant`**: `0.8` (provides smooth bar transitions without rapid flickering).
- **`minDecibels`**: `-90 dB`
- **`maxDecibels`**: `-10 dB`
- **Data Array**: `Uint8Array` of size `analyserNode.frequencyBinCount` (64 bytes for `fftSize = 128`).

### 4.2 Frequency Data IPC Transfer Architecture

Because the `AudioContext` and `AnalyserNode` live in the YouTube content script context while the Popup (`popup.html`) and Options Dashboard (`options.html`) run in separate extension window contexts, real-time frequency data needs an efficient streaming mechanism:

```
┌─────────────────────────────────────────────────────────────┐
│                 YouTube Content Script Context              │
│                                                             │
│  AnalyserNode.getByteFrequencyData(frequencyDataArray)     │
│                             │                               │
│                             ▼                               │
│  Port Streamer Listener (chrome.runtime.onConnect)           │
└─────────────────────────────┬───────────────────────────────┘
                              │ 30-60 FPS Port Messages
                              │ ({ action: 'spectrum_data', data: Array })
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Popup / Options Extension Context           │
│                                                             │
│  Port Listener (port.onMessage)                             │
│                             │                               │
│                             ▼                               │
│  HTML5 Canvas Spectrum Visualizer (requestAnimationFrame)   │
└─────────────────────────────────────────────────────────────┘
```

1. **Port Connection**: When Popup or Options page opens, it connects a long-lived Port (`chrome.tabs.connect(tabId, { name: "ss-spectrum-stream" })` or `chrome.runtime.connect`).
2. **Streaming Loop**: The content script runs a `requestAnimationFrame` loop *only while an active port is connected*, reading `analyserNode.getByteFrequencyData(data)` and posting the byte array.
3. **Power Efficiency**: When neither Popup nor Options page is open, the port disconnects, automatically pausing the content script's `requestAnimationFrame` streaming loop to eliminate CPU overhead.

### 4.3 HTML5 Canvas Visualizer Rendering Engine
- **Canvas Size**: 
  - Popup: `300px × 64px` (or `280px × 60px`)
  - Options Dashboard: `480px × 120px`
  - Header Popover: `260px × 50px`
- **Visual Features**:
  - **Glowing Gradient Bars**: Linear vertical gradients from cyan/blue (`#2563eb`) to purple (`#a855f7`) to pink (`#ec4899`).
  - **Peak-Hold Indicators**: Small horizontal caps on top of each bar that slowly fall down (`peak -= 1.5px/frame`), creating a polished professional audio meter effect.
  - **Responsive Bar Spacing**: Renders 16–32 consolidated bars calculated by averaging groups of frequency bins.

---

## 5. Impact Analysis & Source File Modification Plan

### 5.1 Source File Audit & Creation Map

```
shorts-shield/
├── utils/
│   ├── audio-engine.js               # [MODIFY] Add 10 BiquadFilterNodes, AnalyserNode, preset definitions
│   └── storage.js                    # [MODIFY] Add DEFAULT_SETTINGS.equalizer schema & merge helpers
├── content/js/
│   ├── volume-booster.js            # [MODIFY] Add EQ proxy methods & spectrum port messaging listener
│   └── header-button.js             # [MODIFY] Add 10-band EQ UI sliders, preset selector & canvas visualizer
├── popup/
│   ├── popup.html                   # [MODIFY] Add EQ controls markup & spectrum canvas
│   ├── popup.css                    # [MODIFY] Add styling for EQ sliders & visualizer canvas
│   └── popup.js                     # [MODIFY] Wire EQ sliders, preset selector, and canvas spectrum renderer
├── options/
│   ├── options.html                 # [MODIFY] Add Graphic Equalizer & Spectrum Analyser section
│   ├── options.css                  # [MODIFY] Add dashboard styles for 10-band sliders & canvas
│   └── options.js                   # [MODIFY] Wire dashboard EQ controls & spectrum renderer
└── tests/
    └── tier1/
        └── audio-engine.test.js     # [MODIFY] Add unit tests for 10-band EQ & spectrum byte extraction
```

### 5.2 Specific Line Locations & Code Additions

#### 1. `utils/audio-engine.js`
- **Lines 10–18**: Add class properties:
  ```javascript
  this.eqFrequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  this.eqNodes = [];
  this.analyserNode = null;
  this.eqPreset = 'Flat';
  this.eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  ```
- **Lines 170–210 (`attachToVideo`)**: Construct 10 `BiquadFilterNode` instances:
  ```javascript
  // Create Gain Node (Volume)
  if (!this.gainNode) this.gainNode = this.ctx.createGain();

  // Create 10-Band EQ Filters
  if (this.eqNodes.length === 0) {
    this.eqNodes = this.eqFrequencies.map((freq, idx) => {
      const filter = this.ctx.createBiquadFilter();
      if (idx === 0) {
        filter.type = 'lowshelf';
      } else if (idx === 9) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1.414;
      }
      filter.frequency.value = freq;
      filter.gain.value = Math.max(-12, Math.min(12, Number(this.eqGains[idx]) || 0));
      return filter;
    });
  }

  // Create AnalyserNode
  if (!this.analyserNode) {
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 128;
    this.analyserNode.smoothingTimeConstant = 0.8;
  }
  ```
- **Routing Graph**:
  ```javascript
  // Connect: source -> gainNode -> eqNodes[0] .. eqNodes[9] -> analyserNode -> destination
  let lastNode = this.sourceNode;
  lastNode.connect(this.gainNode);
  lastNode = this.gainNode;
  for (const filter of this.eqNodes) {
    lastNode.connect(filter);
    lastNode = filter;
  }
  lastNode.connect(this.analyserNode);
  this.analyserNode.connect(this.ctx.destination);
  ```
- **Add Equalizer Helper Methods**:
  - `setEqGains(gainsArray)`: Clamps values to `[-12, +12]` dB and updates `this.eqNodes[i].gain.value`.
  - `setEqPreset(presetName)`: Sets preset and updates gains.
  - `getFrequencyData()`: Returns `Uint8Array` from `this.analyserNode.getByteFrequencyData()`.

#### 2. `utils/storage.js`
- **Lines 30–34**: Extend `DEFAULT_SETTINGS`:
  ```javascript
  volumeBooster: {
    volumeLevel: 100,  // 100% = normal, max 600%
    bassLevel: 0        // 0dB = flat, max +20dB
  },
  equalizer: {
    enabled: true,
    preset: 'Flat',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }
  ```
- **Lines 82–92 (`buildMergedSettings`)**: Merge `equalizer` settings:
  ```javascript
  merged.equalizer = {
    ...DEFAULT_SETTINGS.equalizer,
    ...(stored.equalizer || {})
  };
  if (!Array.isArray(merged.equalizer.gains) || merged.equalizer.gains.length !== 10) {
    merged.equalizer.gains = [...DEFAULT_SETTINGS.equalizer.gains];
  }
  ```
- **Lines 256–265**: Add helper method `updateEqualizerSetting(key, value)`.

#### 3. `content/js/volume-booster.js`
- **Lines 220–265**: Proxy methods:
  ```javascript
  setEqGains(gains) {
    const audioEngine = window.AudioEngine;
    if (audioEngine && typeof audioEngine.setEqGains === 'function') {
      audioEngine.setEqGains(gains);
    }
  }
  setEqPreset(preset) {
    const audioEngine = window.AudioEngine;
    if (audioEngine && typeof audioEngine.setEqPreset === 'function') {
      audioEngine.setEqPreset(preset);
    }
  }
  getFrequencyData() {
    const audioEngine = window.AudioEngine;
    if (audioEngine && typeof audioEngine.getFrequencyData === 'function') {
      return audioEngine.getFrequencyData();
    }
    return new Uint8Array(64);
  }
  ```
- Add IPC message / Port streaming listener (`chrome.runtime.onConnect` or `chrome.runtime.onMessage`) for spectrum data request.

#### 4. `popup/popup.html` & `options/options.html`
- Insert Graphic Equalizer card containing:
  - Dropdown selector `#eq-preset-select` with 9 preset choices.
  - 10 vertical range sliders (or grid sliders) `#eq-slider-0` through `#eq-slider-9` labeled `32Hz` to `16kHz`.
  - Button `#btn-eq-reset` to revert to Flat.
  - HTML5 `<canvas id="eq-spectrum-canvas" width="300" height="70"></canvas>`.

---

## 6. Multi-Browser Compatibility & Edge Case Mitigation

1. **Safari WebKit AudioContext Suspension**:
   - Safari enforces strict autoplay and AudioContext suspension policy.
   - *Mitigation*: Preserve the multi-event gesture unlock mechanism (`play`, `playing`, `click`, `touchstart`, `pointerdown`, `keydown`) in `AudioEngine.attachGestureUnlock()`.
2. **CORS MediaElementSource Errors**:
   - Loading cross-origin videos without proper CORS configuration causes `createMediaElementSource()` to output silence.
   - *Mitigation*: Continue applying `videoEl.setAttribute('crossorigin', 'anonymous')` and `videoEl.crossOrigin = 'anonymous'` prior to node attachment.
3. **Node Re-attachment Exception**:
   - `createMediaElementSource` can only be invoked once per HTMLMediaElement.
   - *Mitigation*: Maintain `_attachedSourceMap` (`WeakMap`) and `videoEl._ssMediaSourceNode` for source node caching.
4. **Memory Leaks & CPU Usage during Inactivity**:
   - Spectrum visualizer `requestAnimationFrame` loops can drain CPU if left running continuously.
   - *Mitigation*: Port-driven activation ensures the content script spectrum animation loop is only active when Popup or Options window is open.

---

## 7. Verification Strategy & Test Plan

To maintain the project's **100% clean test suite standard** (`npm test` passes 303+ tests, `node -c` checks all JS files):

1. **Unit Testing (`tests/tier1/audio-engine.test.js`)**:
   - Test 10 `BiquadFilterNode` creation with correct frequencies (`32Hz`..`16kHz`) and filter types (`lowshelf`, `peaking`, `highshelf`).
   - Test gain clamping: ensure gains below `-12dB` clamp to `-12dB` and gains above `+12dB` clamp to `+12dB`.
   - Test preset switching: verify selecting `'Bass Boost'` correctly loads `[9, 7, 5, 3, 1, 0, 0, 0, 0, 0]`.
   - Test `getFrequencyData()`: verify it returns a valid `Uint8Array` of length 64 without throwing errors.
2. **Static Syntax Verification**:
   - Run `node tests/syntax/syntax-checker.js` to ensure 100% clean syntax validation on all updated JS files.
3. **Regression Testing**:
   - Run full test suite via `npm test` and verify zero test failures across all 4 tiers.

---

## 8. Conclusion & Actionable Summary

This survey confirms that the existing audio infrastructure (`utils/audio-engine.js` and `content/js/volume-booster.js`) provides a solid foundation for implementing the 10-Band Graphic Equalizer Engine (R1) and Real-Time Spectrum Analyser (R2). 

All design choices, Web Audio graph topological connections, preset gain arrays, IPC message streaming methods, and file locations identified in this report are fully specified and ready for implementation.
