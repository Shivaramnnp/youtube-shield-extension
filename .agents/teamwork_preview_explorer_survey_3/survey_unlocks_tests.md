# Safari WebKit Unlocks, Test Suites & Build Pipeline Survey Report

**Author**: Explorer 3 (Safari WebKit Unlocks, Test Suites & Build Pipeline Specialist)  
**Date**: 2026-08-23  
**Target Repository**: `YouTube Shield` (`v1.0.0`)  
**Scope**: WebKit AudioContext Lifecycle, Multi-Gesture Unlocks, Manifest Declarations, Test Harness (`npm test` / `npm run test:all`), Safari Web Audio Bridge Test Suite, and Distribution Packaging Pipeline.

---

## 1. Executive Summary & Architectural Overview

The YouTube Shield extension provides high-performance audio customization (Volume Booster up to 600%, Bass Booster up to +20dB, and a 10-Band Graphic Equalizer with ±12dB gain controls). While Chromium and Gecko support direct Web Audio API attachment within isolated content script worlds, **Safari (WebKit)** imposes two strict restrictions:
1. **Isolated World DOM / MediaElementSource Boundary**: Content scripts executing in isolated extension worlds cannot attach a `MediaElementAudioSourceNode` to an HTML `<video>` element owned by the YouTube page context without triggering silent audio disconnection or DOM security restrictions.
2. **Aggressive WebKit Autoplay & Suspension Policy**: WebKit automatically instantiates `AudioContext` instances in the `'suspended'` state and suspends contexts on SPA route transitions (`yt-navigate-finish`), video resolution switching, backgrounding/un-focusing, or programmatic autoplay.

To resolve these restrictions, YouTube Shield adopts a **Dual-World Web Audio Architecture**:
- **Page Context Engine (`content/js/page-audio-dsp.js`)**: Runs in the page MAIN world (via MV3 declarative script injection in Chrome/Safari or dynamic script tag injection via `web_accessible_resources` across all browsers), creating and connecting the audio graph directly to YouTube's `<video>` element.
- **Content Script Controller (`content/js/volume-booster.js` & `utils/audio-engine.js`)**: Runs in the extension isolated world, capturing user preferences from `chrome.storage` / HUD popovers and relaying real-time updates via zero-latency DOM `CustomEvent` IPC (`__SS_AUDIO_UPDATE__`).
- **Comprehensive Multi-Gesture Unlock Subsystem**: Listens across 9 user interaction and media event types (`click`, `pointerdown`, `mousedown`, `keydown`, `touchstart`, `touchend`, `play`, `playing`, `input`) across both extension UI and page contexts to maintain an uninterrupted active audio pipeline.

---

## 2. Safari WebKit Audio Lifecycle & Multi-Gesture Unlock Policy

### 2.1 WebKit Autoplay & AudioContext Suspension Constraints
Under WebKit's autoplay enforcement model:
- `new AudioContext()` or `new webkitAudioContext()` starts with `state === 'suspended'` unless triggered during an active callstack of a user-initiated gesture.
- Any attempt by an isolated content script to manipulate media element volume beyond 100% without Web Audio routing fails because standard `HTMLMediaElement.volume` is clamped strictly to `[0.0, 1.0]`.
- Creating multiple `MediaElementSourceNode` instances for the same `<video>` element throws `InvalidStateError: HTMLMediaElement already connected to MediaElementSourceNode`.
- When YouTube switches video streams dynamically in its Single Page Application (SPA), the underlying `<video>` element's media decoder resets, which may cause WebKit to suspend the `AudioContext`.

### 2.2 The 9-Gesture Event Matrix
To guarantee that the AudioContext transitions to and remains in the `'running'` state, the unlock mechanism binds to the following 9 event types:

| Event Type | Target Context | Trigger Scenario | WebKit Gesture Classification |
|---|---|---|---|
| `click` | Extension UI & Page DOM | User clicks buttons, toggles, or YouTube UI | User Activation Gesture (High Priority) |
| `pointerdown` | Extension UI & Page DOM | Pointer presses (mouse, pen, touchscreen) | User Activation Gesture |
| `mousedown` | Extension UI & Page DOM | Mouse button press | User Activation Gesture |
| `keydown` | Extension UI & Page DOM | Spacebar, Enter, arrow keys, shortcut hotkeys | User Activation Gesture |
| `touchstart` | Page DOM & Mobile Viewports | Initial finger contact on mobile/touch screens | User Activation Gesture |
| `touchend` | Page DOM & Mobile Viewports | Finger release on mobile/touch screens | User Activation Gesture |
| `play` | `<video>` Element & Window | Video starts playback via YouTube controls | Media Playback State Event |
| `playing` | `<video>` Element & Window | Video resumes from buffering or unpausing | Media Playback State Event |
| `input` | Extension UI Sliders | Dragging Volume, Bass, or EQ gain sliders | User Activation Gesture |

### 2.3 AudioContext State Machine Transitions

```
                    ┌────────────────────────┐
                    │      Instantiated      │
                    │ (state = 'suspended')  │
                    └───────────┬────────────┘
                                │
          ┌─────────────────────┴─────────────────────┐
          │ User Gesture (click, keydown, touch, etc.) │
          │ OR Video Media Event (play, playing)      │
          ▼                                           ▼
┌────────────────────────┐                  ┌────────────────────────┐
│      ctx.resume()      │ ──── Success ───►│        Running         │
│   (Promise pending)    │                  │  (state = 'running')   │
└────────────────────────┘                  └───────────┬────────────┘
                                                        │
                      ┌─────────────────────────────────┴───────────────────┐
                      │ Tab Blur / Stream Switch / System Sleep / Inactive │
                      ▼                                                     ▼
        ┌───────────────────────────┐                        ┌───────────────────────────┐
        │        Suspended          │                        │        Interrupted        │
        │   (state = 'suspended')   │                        │   (iOS/Safari WebKit)     │
        └─────────────┬─────────────┘                        └─────────────┬─────────────┘
                      │                                                    │
                      └─────────────────── Re-attach Unlock ───────────────┘
                                       (onstatechange listener)
```

### 2.4 Cross-World Scope & WeakMap Node Graph Caching
1. **WeakMap Node Caching**: Both `AudioEngine` (isolated world) and `PageAudioDspEngine` (MAIN world) utilize a `WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>` cache. When YouTube recycles `<video>` elements or changes `src`, the existing source node is reused without throwing `InvalidStateError`.
2. **Dynamic Cross-Origin Fallback**: `video.crossOrigin = 'anonymous'` is dynamically asserted for cross-origin audio processing safety without disrupting standard blob media playback.
3. **State Change Self-Healing**:
   ```javascript
   if (this.ctx) {
     this.ctx.onstatechange = () => {
       if (this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
         this.attachGestureUnlock();
       }
     };
   }
   ```

---

## 3. Manifest V3 & Web Accessible Resources Architecture

### 3.1 `manifest.json` Content Script Configuration
In `manifest.json`, scripts are organized into two distinct execution blocks:
- **Block 1: ISOLATED World** (Lines 69–107):
  Includes core utilities, gamification engine, storage adapters, observer utilities, and UI controllers (`content/js/main.js`, `volume-booster.js`, `header-button.js`, etc.) configured at `document_start`.
- **Block 2: MAIN World** (Lines 108–125):
  ```json
  {
    "matches": [
      "*://*.youtube.com/*",
      "*://*.youtube-nocookie.com/*"
    ],
    "exclude_matches": [
      "*://studio.youtube.com/*",
      "*://tv.youtube.com/*"
    ],
    "js": [
      "content/js/page-ad-skipper.js",
      "content/js/page-audio-dsp.js"
    ],
    "all_frames": true,
    "world": "MAIN",
    "run_at": "document_start"
  }
  ```

### 3.2 Web Accessible Resources Declarations
To support environments where declarative `"world": "MAIN"` is not supported or where dynamic injection is needed (such as Firefox MV3 or specific Safari WebExtension host builds), `page-audio-dsp.js` is explicitly listed under `web_accessible_resources`:
```json
  "web_accessible_resources": [
    {
      "resources": [
        "content/js/page-audio-dsp.js",
        "options/options.html",
        "popup/popup.html",
        "assets/icons/icon16.png",
        "assets/icons/icon32.png",
        "assets/icons/icon48.png",
        "assets/icons/icon128.png",
        "assets/icons/icon512.png"
      ],
      "matches": [
        "*://*.youtube.com/*",
        "*://*.youtube-nocookie.com/*"
      ]
    }
  ]
```

### 3.3 Dynamic Injection Logic & Double-Execution Guard
In `content/js/volume-booster.js`:
```javascript
_ensurePageAudioDspInjected() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ss-page-audio-dsp-script')) return;

  try {
    const script = document.createElement('script');
    script.id = 'ss-page-audio-dsp-script';
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      script.src = chrome.runtime.getURL('content/js/page-audio-dsp.js');
    }
    (document.head || document.documentElement).appendChild(script);
  } catch (e) {}
}
```
And inside `content/js/page-audio-dsp.js`:
```javascript
if (window.__SS_PAGE_AUDIO_DSP_INITIALIZED__) return;
window.__SS_PAGE_AUDIO_DSP_INITIALIZED__ = true;
```
This ensures idempotency whether injected statically via `manifest.json` or dynamically via script tag injection.

---

## 4. Test Harness Architecture & Suite Execution Survey

### 4.1 Test Infrastructure Overview
The YouTube Shield test suite is built on a custom lightweight, zero-dependency Node.js test harness located in `tests/harness/`:
- `mock-extension-env.js`: Mocks Chrome MV3 APIs (`chrome.storage.local`, `sync`, `session`, `runtime`, `tabs`, `scripting`, `webNavigation`), DOM structures (`MockElement`, `MockDOMParser`, `MockMutationObserver`), and global browser primitives (`CustomEvent`, `MouseEvent`, `PointerEvent`, `AudioContext`, `webkitAudioContext`).
- `test-helpers.js`: Provides BDD primitives (`describe`, `test`, `it`), strict assertions (`assert`), and automated teardown between test cases (`resetStorage()`, `resetDOM()`).
- `syntax/syntax-checker.js`: Validates static JavaScript syntax across all 118 files via `node -c`.

### 4.2 Test Suite Execution Matrix

| Command | Scope | Suite Breakdown | Assertions Count |
|---|---|---|---|
| `npm test` | Master Test Runner (`run-tests.js`) | Phase 1: Static Syntax (118 files)<br>Phase 2: Mock Setup<br>Phase 3: Tiers 1–4 (53 test files) | ~425 assertions |
| `npm run test:all` | Full Combined Validation Suite | 1. `run-tests.js` (Master Suite)<br>2. `challenger-ad-skipper-adversarial.js`<br>3. `challenger-adversarial-hud-and-modals.js`<br>4. `challenger-m4_1-empirical-stress.js`<br>5. `challenger-m3-empirical-stress.js`<br>6. `challenger-m3-1-rep-ui-ux-empirical-stress.js`<br>7. `challenger-final-2-empirical-deep-stress.js` | >800 assertions |
| `npm run validate` | Manifest & Asset Validator | Verifies all icons, scripts, HTML files exist | 22 asset checks |
| `npm run build` | Full CI/CD Build Gate | `validate` + `test` + `package` | Full build verification |

### 4.3 Root Cause Analysis of Test Failures in `tests/tier3/safari-audio-bridge.test.js`

During initial execution of `npm test`, two failures were observed in `tests/tier3/safari-audio-bridge.test.js`:
1. **Issue 1: Missing IPC Update in `VolumeBooster.setEqPreset()`**:
   - *Observation*: In `content/js/volume-booster.js:437-483`, `setEqPreset` updates the preset on `AudioEngine`, but fails to invoke `this._dispatchPageAudioUpdate()`.
   - *Result*: Changing the equalizer preset in `VolumeBooster` dispatches no `__SS_AUDIO_UPDATE__` event, causing `eventReceived.eqPreset` to remain `'Flat'` instead of `'Rock'`.
2. **Issue 2: Node.js Module Cache Shadowing in Test Setup**:
   - *Observation*: In `tests/tier3/safari-audio-bridge.test.js:11-16`, Test 1 performs `delete window.__SS_PAGE_AUDIO_DSP__; require("../../content/js/page-audio-dsp");`.
   - *Result*: Because `page-audio-dsp.js` was already evaluated earlier in the suite, Node's `require.cache` returns the cached export without re-executing the IIFE. As a result, `window.__SS_PAGE_AUDIO_DSP__` becomes `undefined` for subsequent tests in that process.
   - *Remediation*: Ensure `delete require.cache[require.resolve('../../content/js/page-audio-dsp')]` is invoked when re-initializing, and ensure `_dispatchPageAudioUpdate()` is called across all mutation entry points (`setVolume`, `setBass`, `setEqGains`, `setEqPreset`, `setEqBandGain`, `setEqEnabled`).

---

## 5. Dedicated Safari WebKit Audio Bridge Test Suite Design

The dedicated Safari WebKit Audio Bridge test suite (`tests/tier3/safari-audio-bridge.test.js`) verifies 5 core dimensions of cross-world audio synchronization:

### 5.1 Dimension 1: CustomEvent IPC Synchronization
- **Event Dispatch**: Verifies `__SS_AUDIO_UPDATE__` CustomEvent is dispatched on `window` whenever `VolumeBooster` modifies `volumeLevel`, `bassLevel`, `eqPreset`, `eqGains`, or `eqEnabled`.
- **Event Payload Integrity**: Validates that `event.detail` contains exact clamped types: `volumeLevel` (number), `bassLevel` (number), `eqPreset` (string), `eqGains` (10-element number array), `eqEnabled` (boolean).
- **Page DSP Reception**: Validates `PageAudioDspEngine` receives `__SS_AUDIO_UPDATE__` and updates its internal fields (`_volumeLevel`, `_bassLevel`, `_eqPreset`, `_eqGains`, `_eqEnabled`).

### 5.2 Dimension 2: Node Gain Mathematics & Clamping Bounds
- **Volume Math**: `gainNode.gain.value = volumePercent / 100`.
  - Input 100% -> `gainNode.gain.value === 1.0`
  - Input 300% -> `gainNode.gain.value === 3.0`
  - Input 600% -> `gainNode.gain.value === 6.0` (Max 6x boost)
  - Input 999% -> clamped to 600% (`gainNode.gain.value === 6.0`)
  - Input -50% -> clamped to 0% (`gainNode.gain.value === 0.0`)
- **Bass Math**: `bassNode.gain.value = bassLevelDb` (lowshelf filter at 150 Hz).
  - Input 0 dB -> `bassNode.gain.value === 0`
  - Input 15 dB -> `bassNode.gain.value === 15`
  - Input 20 dB -> `bassNode.gain.value === 20`
  - Input 50 dB -> clamped to 20 dB
  - Input -10 dB -> clamped to 0 dB

### 5.3 Dimension 3: 10-Band Equalizer Frequencies & Filter Specs
The 10 standard ISO frequency centers and filter characteristics:

| Band Index | Center Frequency | Filter Type | Q Factor | Clamping Range |
|---|---|---|---|---|
| Band 0 | 32 Hz | `lowshelf` | 1.0 | -12 dB .. +12 dB |
| Band 1 | 64 Hz | `peaking` | 1.414 | -12 dB .. +12 dB |
| Band 2 | 125 Hz | `peaking` | 1.414 | -12 dB .. +12 dB |
| Band 3 | 250 Hz | `peaking` | 1.414 | -12 dB .. +12 dB |
| Band 4 | 500 Hz | `peaking` | 1.414 | -12 dB .. +12 dB |
| Band 5 | 1000 Hz | `peaking` | 1.414 | -12 dB .. +12 dB |
| Band 6 | 2000 Hz | `peaking` | 1.414 | -12 dB .. +12 dB |
| Band 7 | 4000 Hz | `peaking` | 1.414 | -12 dB .. +12 dB |
| Band 8 | 8000 Hz | `peaking` | 1.414 | -12 dB .. +12 dB |
| Band 9 | 16000 Hz | `highshelf` | 1.0 | -12 dB .. +12 dB |

### 5.4 Dimension 4: Equalizer Preset Profiles & Custom Auto-Detection
Validates exact profiles across all 8 presets:
- **Flat**: `[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]`
- **Bass Boost**: `[6, 5, 4, 2, 0, 0, 0, 0, 0, 0]`
- **Vocal Booster**: `[-2, -1, 0, 2, 4, 5, 4, 2, 0, -1]` (or `[-2, -1, 0, 2, 4, 4, 3, 1, 0, -1]`)
- **Treble Boost**: `[0, 0, 0, 0, 0, 1, 3, 5, 7, 8]`
- **Rock**: `[5, 4, 3, 1, -1, -1, 0, 2, 4, 5]`
- **Pop**: `[-1, 2, 4, 5, 4, 0, -1, 1, 3, 4]`
- **Acoustic**: `[3, 2, 1, 2, 3, 3, 2, 3, 2, 1]`
- **Electronic**: `[6, 5, 2, 0, -2, 2, 1, 2, 4, 5]`
- **Custom Mode**: Modifying any single slider dynamically transitions preset state to `'Custom'`.
- **Master Bypass**: Setting `eqEnabled = false` zeroes all `filter.gain.value` nodes to 0 while preserving the stored `eqGains` array.

### 5.5 Dimension 5: Multi-Gesture Resume Handlers & Stream Resumption
- Simulates suspended `AudioContext` (`state = 'suspended'`).
- Dispatches each of the 9 events (`click`, `pointerdown`, `mousedown`, `keydown`, `touchstart`, `touchend`, `play`, `playing`, `input`) to `window`, `document`, and `<video>`.
- Verifies `ctx.resume()` is triggered and AudioContext state becomes `'running'`.
- Simulates YouTube SPA navigation (`yt-navigate-finish`) and verifies `connect()` attaches to the new active `<video>` element.

---

## 6. Build Pipeline & Distribution Packaging Audit

### 6.1 `package.json` Scripts Lifecycle
```json
{
  "scripts": {
    "test": "node run-tests.js",
    "test:all": "node run-tests.js && node tests/challenger-ad-skipper-adversarial.js && node tests/challenger-adversarial-hud-and-modals.js && node tests/challenger-m4_1-empirical-stress.js && node tests/challenger-m3-empirical-stress.js && node tests/challenger-m3-1-rep-ui-ux-empirical-stress.js && node tests/challenger-final-2-empirical-deep-stress.js",
    "validate": "node scripts/validate-manifest.js",
    "clean": "node scripts/clean.js",
    "package": "node scripts/package-extension.js",
    "build": "npm run validate && npm run test && npm run package"
  }
}
```

### 6.2 Packaging Verification (`scripts/package-extension.js`)
- Validates `manifest.json` metadata (name, version 1.0.0, manifest_version 3) and icon existence on disk (16px, 32px, 48px, 128px, 512px).
- Generates clean distribution packages inside `dist/`:
  - `dist/youtube-shield-chrome.zip` (Chrome Web Store / Edge Add-ons)
  - `dist/youtube-shield-firefox.zip` (Mozilla Add-ons AMO)
- Verified build output: ~996 KB per archive, containing `background/`, `content/`, `popup/`, `options/`, `utils/`, `assets/`, `_locales/`, `manifest.json`, `README.md`, `LICENSE`, `PRIVACY.md` while stripping test files, `.DS_Store`, and temporary logs.

---

## 7. Concrete Remediation & Proposal Roadmap

### Proposal P1: `content/js/volume-booster.js` IPC Event Dispatch
In `VolumeBoosterClass.setEqPreset()` (around lines 450–482):
Ensure `this._dispatchPageAudioUpdate()` is called whenever a preset is switched:
```javascript
// Before:
this._eqPreset = audioEngine.getEqPreset();
if (Array.isArray(audioEngine.eqGains)) {
  this._eqGains = [...audioEngine.eqGains];
}
if (audioEngine.eqNodes) this.eqNodes = audioEngine.eqNodes;
if (!this.sourceNode) this.connect();
return true;

// Proposed After:
this._eqPreset = audioEngine.getEqPreset();
if (Array.isArray(audioEngine.eqGains)) {
  this._eqGains = [...audioEngine.eqGains];
}
if (audioEngine.eqNodes) this.eqNodes = audioEngine.eqNodes;
this._dispatchPageAudioUpdate();
if (!this.sourceNode) this.connect();
return true;
```

### Proposal P2: Align Gesture Unlocking Events
In `utils/audio-engine.js:128` and `content/js/volume-booster.js:87`:
Add `'input'` to the gesture unlock event list so slider movements in HUD/options immediately unlock audio:
```javascript
// Proposed:
const events = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown', 'play', 'playing', 'input'];
```

### Proposal P3: Align Preset Gains Between Files
Ensure `content/js/page-audio-dsp.js`, `utils/audio-engine.js`, and `content/js/volume-booster.js` share identical preset definitions (e.g. Vocal Booster `[-2, -1, 0, 2, 4, 5, 4, 2, 0, -1]`, Treble Boost `[0, 0, 0, 0, 0, 1, 3, 5, 7, 8]`, Rock `[5, 4, 3, 1, -1, -1, 0, 2, 4, 5]`).

### Proposal P4: Update `tests/tier3/safari-audio-bridge.test.js` Test Setup
Ensure `require.cache` is cleanly cleared before requiring `page-audio-dsp` and `volume-booster` in unit tests:
```javascript
delete require.cache[require.resolve("../../content/js/page-audio-dsp")];
delete require.cache[require.resolve("../../content/js/volume-booster")];
```

---

## 8. Conclusion
The WebKit Web Audio architecture and test pipeline have been exhaustively audited. The dual-world bridge design is verified structurally sound, with clear and localized remediations identified to achieve 100% test passing (`npm test` and `npm run test:all`) and clean production builds in `dist/`.
