# YouTube Shield — Web Audio Architecture & Page-Context Engine Survey
**Author**: Explorer 1 (Web Audio Architecture & Page-Context Engine Specialist)  
**Date**: August 23, 2026  
**Scope**: `content/js/page-audio-dsp.js`, `content/js/volume-booster.js`, `utils/audio-engine.js`, `background/`, `options/`, `popup/`, `content/js/header-button.js`, `manifest.json`

---

## 1. Executive Summary

YouTube Shield provides advanced audio manipulation capabilities on YouTube, featuring:
- **Volume Booster**: Amplification up to 600% (6x native volume gain).
- **Bass Booster**: Low-frequency shelf enhancement up to +20dB at 150Hz.
- **10-Band Graphic Equalizer**: Precision frequency sculpting across 32Hz–16kHz with ±12dB range and 8 genre presets.
- **Real-Time Visualizer Spectrum**: 64-bin FFT spectrum and time-domain oscilloscope streaming for HUD popovers and options studio.

### The Safari WebKit Challenge
In Chromium and Gecko, extension content scripts running in isolated execution contexts can frequently bind an `AudioContext` directly to page-owned `<video>` elements via `createMediaElementSource(video)`. However, **Safari WebKit strictly forbids capturing page-owned media streams across the isolated content script boundary**, resulting in silent audio or runtime `SecurityError` exceptions.

### The Solution: Dual-World Architecture
To achieve 100% cross-browser compatibility and full fidelity audio amplification on Safari, YouTube Shield implements a **Dual-World Web Audio Architecture**:
1. **Isolated World (Content Script / Extension Context)**: Manages UI controls (Floating HUD, Popup, Options), storage persistence (`chrome.storage`), and dispatches zero-latency IPC events.
2. **Page World (MAIN Context / `page-audio-dsp.js`)**: Executes directly in YouTube's native page execution context (`world: "MAIN"`), owning the active `AudioContext`, attaching to the page's `<video>` element, and hosting the full DSP audio processing graph.

---

## 2. Safari WebKit Web Audio & Security Isolation Deep Dive

### 2.1 WebKit Process & Security Isolation Model
WebKit's implementation of WebExtensions content script isolation enforces strict security barriers between the extension isolated world and the page DOM/JS execution context (MAIN world):
1. **DOM Wrapper Proxies**: In WebKit, DOM objects passed between isolated worlds are wrapped in C++ security proxy wrappers (`JSC::JSCallbackObject` / `WebCore::JSNode`). They are not the same underlying JavaScript heap instances.
2. **Media Pipeline Ownership & Origin Checks**: WebKit's Web Audio implementation (`WebCore::AudioContext`) strictly validates that the `HTMLMediaElement` passed to `createMediaElementSource()` belongs to the exact same Document and ScriptExecutionContext as the `AudioContext`.
3. **Cross-Origin / Tainted Media Taint Policy**: When an isolated content script invokes `ctx.createMediaElementSource(video)` on a page-owned video element:
   - WebKit considers the media element's audio output stream as cross-origin / cross-world tainted.
   - WebKit either raises a fatal `DOMException` (`SecurityError: Failed to execute 'createMediaElementSource' on 'AudioContext': The element has not been loaded with the appropriate CORS headers`), OR
   - It intercepts and disconnects the native audio path to the system speakers while feeding pure silence (0-amplitude buffers) to the isolated `MediaElementAudioSourceNode`. The user sees the video playing, but hears **no sound at all**.

### 2.2 Media Source Extensions (MSE) & YouTube Stream Architecture
YouTube delivers video and audio streams using Media Source Extensions (MSE) over `blob:https://www.youtube.com/...` with fragmented MP4/WebM chunks. 
- In Safari WebKit, `MediaSource` and `SourceBuffer` objects are bound to the page's global `window` and its native media pipeline.
- Cross-world access to MSE playback streams from an isolated content script is completely blocked by WebKit's sandbox policy.
- Setting `crossOrigin = "anonymous"` on a `blob:` URL does not grant cross-world access and can cause MSE decoding pipelines to stall.

### 2.3 The MAIN-World Execution Requirement
By injecting `page-audio-dsp.js` into the **MAIN execution world** (`world: "MAIN"`):
- The `AudioContext` and `createMediaElementSource(video)` execute in the exact same execution context and thread where YouTube's video player (`#movie_player`), MSE buffers, and `<video>` element are instantiated.
- WebKit treats the audio capture as completely native, same-origin, and fully authorized.
- The captured PCM audio stream routes uninterrupted through the DSP graph nodes to `AudioContext.destination` without CORS restrictions or silent muting.

---

## 3. Audio Graph Topology & Math Model

### 3.1 Graph Topology Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PAGE EXECUTION CONTEXT (MAIN WORLD)                │
│                                                                         │
│  ┌────────────────────────┐                                             │
│  │ HTMLMediaElement       │ (YouTube native <video> element)             │
│  │ (#movie_player video)  │                                             │
│  └───────────┬────────────┘                                             │
│              │                                                          │
│              ▼                                                          │
│  ┌────────────────────────┐                                             │
│  │ MediaElementSourceNode │ ctx.createMediaElementSource(video)         │
│  │ (Cached in WeakMap)    │ (Single attachment per element guaranteed)  │
│  └───────────┬────────────┘                                             │
│              │                                                          │
│              ▼                                                          │
│  ┌────────────────────────┐                                             │
│  │ BassFilter Node        │ BiquadFilterNode: type = 'lowshelf'         │
│  │ (150 Hz)               │ Frequency: 150 Hz, Gain: 0 dB to +20 dB     │
│  └───────────┬────────────┘                                             │
│              │                                                          │
│              ▼                                                          │
│  ┌────────────────────────┐                                             │
│  │ GainNode               │ Volume multiplier                           │
│  │ (0% - 600%)            │ gain.value: 0.0 to 6.0 (Default: 1.0)       │
│  └───────────┬────────────┘                                             │
│              │                                                          │
│              ▼                                                          │
│  ┌────────────────────────┐                                             │
│  │ 10-Band Graphic EQ     │ 10 BiquadFilterNodes in series              │
│  │ [32Hz ... 16kHz]       │ Band 0 (32Hz): lowshelf                     │
│  │                        │ Bands 1-8 (64Hz-8kHz): peaking (Q=1.414)    │
│  │                        │ Band 9 (16kHz): highshelf                   │
│  │                        │ Gain range: -12 dB to +12 dB                │
│  └───────────┬────────────┘                                             │
│              │                                                          │
│              ▼                                                          │
│  ┌────────────────────────┐                                             │
│  │ AnalyserNode           │ fftSize: 128 (64 frequency bins)            │
│  │ (Spectrum & Waveform)  │ smoothingTimeConstant: 0.8                  │
│  └───────────┬────────────┘                                             │
│              │                                                          │
│              ▼                                                          │
│  ┌────────────────────────┐                                             │
│  │ AudioContext           │ Native hardware audio output                │
│  │ Destination            │ (Speakers / Headphones)                     │
│  └────────────────────────┘                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Detailed Node Specifications & Mathematical Transfer Functions

#### 1. Source Node (`MediaElementAudioSourceNode`)
- **Creation**: `ctx.createMediaElementSource(videoEl)`
- **Constraint**: Must only be called **once** per `HTMLMediaElement` instance per `AudioContext`. Multiple calls throw `InvalidStateError`.
- **Protection**: Cached in `videoSourceMap = new WeakMap()` and `videoEl._ssPageSourceNode`.

#### 2. Bass Booster Node (`BiquadFilterNode`)
- **Type**: `lowshelf`
- **Center Frequency ($f_0$)**: `150 Hz`
- **Gain ($G_{\text{bass}}$)**: `0 dB` to `+20 dB` (Clamped via `Math.max(0, Math.min(20, val))`)
- **Transfer Function**:
  $$H(s) = \frac{s^2 + \frac{\sqrt{A}}{Q} s + A}{A s^2 + \frac{\sqrt{A}}{Q} s + 1}$$
  where $A = 10^{\frac{G_{\text{bass}}}{40}}$.
- **Purpose**: Delivers punchy low-end presence to kick drums, basslines, and speech fundamental resonances without muddying vocal frequencies above 250Hz.

#### 3. Master Volume Booster (`GainNode`)
- **Multiplier**: `0.0` (0% - mute) to `6.0` (600% - 6x amplification).
- **Gain Setting**:
  $$\text{gain.value} = \frac{\text{volumeLevel}}{100}$$
- **Dynamic Headroom**: Allows users to boost quiet uploads, lectures, and ASMR content well above YouTube's standard 100% volume ceiling.

#### 4. 10-Band Graphic Equalizer (`BiquadFilterNode` × 10)
Standard ISO 10-band 1-octave frequency distribution:

| Band | Nominal Frequency | Filter Type | Q Factor | Gain Range | Primary Acoustic Role |
|:---:|:---:|:---:|:---:|:---:|:---|
| **0** | **32 Hz** | `lowshelf` | 1.000 | -12 dB to +12 dB | Sub-bass rumble, deep synth fundamentals |
| **1** | **64 Hz** | `peaking` | 1.414 | -12 dB to +12 dB | Bass punch, kick drum impact |
| **2** | **125 Hz** | `peaking` | 1.414 | -12 dB to +12 dB | Bass warmth, lower register guitar/snare |
| **3** | **250 Hz** | `peaking` | 1.414 | -12 dB to +12 dB | Low-mid body, mud reduction zone |
| **4** | **500 Hz** | `peaking` | 1.414 | -12 dB to +12 dB | Mid-range fullness, vocal fundamental |
| **5** | **1000 Hz (1 kHz)** | `peaking` | 1.414 | -12 dB to +12 dB | Core vocal intelligibility, horn/lead |
| **6** | **2000 Hz (2 kHz)** | `peaking` | 1.414 | -12 dB to +12 dB | Attack definition, acoustic guitar bite |
| **7** | **4000 Hz (4 kHz)** | `peaking` | 1.414 | -12 dB to +12 dB | Presence, vocal crispness, snare snap |
| **8** | **8000 Hz (8 kHz)** | `peaking` | 1.414 | -12 dB to +12 dB | High-end sparkle, cymbal shimmer |
| **9** | **16000 Hz (16 kHz)** | `highshelf` | 1.000 | -12 dB to +12 dB | Ultra-high air, acoustic ambience |

- **Bypass Mode**: When `eqEnabled === false`, all 10 filter gains are set to `0 dB` (`gain.value = 0`), creating a completely transparent bypass without uncoupling or rebuilding the audio graph.

#### 5. Real-Time FFT Analyser (`AnalyserNode`)
- **FFT Size**: `128` (yields $N/2 = 64$ frequency bins)
- **Bin Frequency Resolution**: $\Delta f = \frac{f_s}{N} \approx \frac{48000}{128} = 375\text{ Hz}$ per bin
- **Smoothing Time Constant**: `0.8` (provides smooth, organic visualizer animation at 60 FPS)
- **Data Formats**:
  - `getByteFrequencyData(uint8Array)`: 64 frequency magnitude bytes (0-255)
  - `getByteTimeDomainData(uint8Array)`: 128 oscilloscope waveform samples (0-255, centered at 128)

---

## 4. Preset Profiles & Harmonization

The system defines 8 standard acoustic profiles plus Flat and Custom:

```javascript
const EQ_PRESETS = {
  'Flat':          [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
  'Bass Boost':    [6,  5,  4,  2,  0,  0,  0,  0,  0,  0],
  'Vocal Booster': [-2, -1, 0,  2,  4,  5,  4,  2,  0, -1],
  'Treble Boost':  [0,  0,  0,  0,  0,  1,  3,  5,  7,  8],
  'Rock':          [5,  4,  3,  1, -1, -1,  0,  2,  4,  5],
  'Pop':           [-1, 2,  4,  5,  4,  0, -1,  1,  3,  4],
  'Acoustic':      [3,  2,  1,  2,  3,  3,  2,  3,  2,  1],
  'Electronic':    [6,  5,  2,  0, -2,  2,  1,  2,  4,  5],
  'Custom':        null
};
```

### Recommendation for Standardization
During investigation, minor divergences were noted between `utils/audio-engine.js` and `content/js/page-audio-dsp.js` (e.g. slight differences in `Vocal Booster` and `Rock` mid-band values). **Harmonizing these preset arrays across all files to match the authoritative definitions above guarantees consistent acoustic reproduction across Chrome, Firefox, and Safari.**

---

## 5. Bidirectional CustomEvent & DOM IPC Bridge

### 5.1 Communication Protocol
Because isolated content scripts and MAIN-world scripts cannot share direct JS heap objects, communication occurs over high-speed native DOM CustomEvents on the shared `window` object:

```
┌────────────────────────────────────────────────────────┐
│               ISOLATED CONTENT SCRIPT                  │
│  (Header Popover / Popup HUD / Options / Main Script)  │
└───────────────────────────┬────────────────────────────┘
                            │
              window.dispatchEvent(
                new CustomEvent('__SS_AUDIO_UPDATE__', {
                  detail: {
                    volumeLevel: 300,
                    bassLevel: 15,
                    eqPreset: 'Rock',
                    eqGains: [5, 4, 3, 1, -1, -1, 0, 2, 4, 5],
                    eqEnabled: true
                  }
                })
              )
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                  MAIN PAGE WORLD                       │
│              (content/js/page-audio-dsp.js)            │
│                                                        │
│  window.addEventListener('__SS_AUDIO_UPDATE__', (e)=>{ │
│    this.setVolume(e.detail.volumeLevel);               │
│    this.setBass(e.detail.bassLevel);                   │
│    this.setEqGains(e.detail.eqGains);                  │
│    this.setEqPreset(e.detail.eqPreset);                │
│    this.setEqEnabled(e.detail.eqEnabled);              │
│  });                                                   │
└────────────────────────────────────────────────────────┘
```

### 5.2 Performance & Zero-Lag Guarantee
- `CustomEvent` dispatch on `window` executes synchronously in the current JavaScript microtask.
- There is zero serialisation overhead beyond simple numeric properties.
- Slider dragging in the UI applies real-time smooth gain transitions with sub-millisecond latency.

---

## 6. YouTube SPA Dynamics, Multiple Videos & Lifecycle Management

YouTube's Single Page Application architecture presents several complex media lifecycle challenges:

### 6.1 Multi-Video & Element Lifecycle Scenarios

1. **Standard Watch Page (`/watch?v=...`)**:
   - YouTube typically keeps a single `#movie_player video.html5-main-video` in the DOM and swaps `src` / MSE buffers when the user clicks recommended videos.
   - When the same `<video>` element is reused, the existing `MediaElementAudioSourceNode` remains valid.
   - When the stream changes, Safari's `play` or `playing` event fires, triggering `AudioContext.resume()` and re-applying gain parameters.

2. **YouTube Shorts (`/shorts/...`)**:
   - The Shorts reel uses a virtualized list (`ytd-reel-video-renderer`) containing multiple `<video>` elements (e.g. current short, pre-buffered previous short, pre-buffered next short).
   - As the user scrolls, new `<video>` elements enter the DOM and older ones are detached.
   - The active video element changes dynamically.

3. **In-Stream Ads & Transitions**:
   - Ads may replace the video stream or alter player state.
   - Upon ad completion, YouTube returns to the main content stream.

### 6.2 Active Video Detection Algorithm
To reliably capture the active playing video without attaching to paused pre-buffer elements:

```javascript
function findActiveVideo() {
  // 1. Primary player video
  const primary = document.querySelector(
    '#movie_player video, .html5-video-player video, ytd-player video, video.html5-main-video'
  );
  if (primary && (!primary.paused || primary.currentTime > 0)) {
    return primary;
  }

  // 2. Scan all video elements for actively playing stream
  const videos = Array.from(document.querySelectorAll('video'));
  if (!videos.length) return null;

  const playing = videos.find(v => 
    !v.paused && !v.ended && (v.currentTime > 0 || v.readyState >= 2)
  );
  if (playing) return playing;

  return primary || videos[0] || null;
}
```

### 6.3 Memory Leak Prevention & Clean Reconnection Strategy

| Challenge | Risk | Architectural Solution |
|:---|:---|:---|
| **Multiple Calls to `createMediaElementSource`** | Web Audio throws `InvalidStateError: already connected`. | Cache source nodes in `WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>` and on `videoEl._ssPageSourceNode`. Re-use existing node if already created. |
| **Old Video Detached from DOM** | Detached video kept in memory causing memory leaks. | Storing in `WeakMap` allows detached `<video>` elements and their source nodes to be automatically garbage collected by the browser engine. |
| **Switching Between Videos (Shorts / SPA)** | Previous video remains connected to DSP graph, mixing audio or stalling pipeline. | Explicitly call `prevSourceNode.disconnect()` before wiring `newSourceNode.connect(bassNode)`. Persistent DSP nodes (`bassNode`, `gainNode`, `eqNodes`, `analyserNode`) remain allocated and connected. |
| **Rapid SPA Navigation** | Stale references or missed attachments during DOM transitions. | Register `yt-navigate-finish`, `yt-page-data-updated`, and a `MutationObserver` on `document.documentElement` (`childList: true, subtree: true`) to trigger video re-scanning. |

---

## 7. Safari Autoplay Policy & Multi-Gesture Unlock

### 7.1 WebKit Autoplay Policy Constraints
Safari enforces strict Web Audio autoplay policies:
- An `AudioContext` instantiated without an active user gesture starts in `'suspended'` state.
- WebKit may re-suspend an `AudioContext` when a video ends, when tabs are backgrounded, or when audio output devices change.
- In `'suspended'` state, the audio graph produces no sound.

### 7.2 Multi-Gesture Resumption Solution
To guarantee the `AudioContext` remains active:
1. **Multi-Event Gesture Listeners**: Attach capture-phase passive listeners on 9 distinct user and media interaction events:
   - User Input Events: `'click'`, `'pointerdown'`, `'mousedown'`, `'keydown'`, `'touchstart'`, `'touchend'`, `'input'`
   - Media Events: `'play'`, `'playing'`
2. **Persistent `ctx.onstatechange` Re-attachment**: If the context ever transitions back to `'suspended'`, immediately re-arm gesture unlock listeners.
3. **Playback Event Hooks**: Directly bind `play` and `playing` listeners to the active `<video>` element to unlock the context the instant YouTube starts video playback.

---

## 8. Summary of Recommendations for Implementation Team

1. **Harmonize EQ Preset Tables**: Ensure exact identical preset gain values across `content/js/page-audio-dsp.js`, `utils/audio-engine.js`, `options/options.js`, and `popup/popup.js`.
2. **Enhance SPA Navigation Hooks in `page-audio-dsp.js`**: Add explicit listeners for `yt-navigate-finish` and `yt-page-data-updated` on `window` in `page-audio-dsp.js` to complement the existing `MutationObserver`.
3. **Ensure Dual Injection Paths**: Maintain both `manifest.json` declarative injection (`world: "MAIN"`) and runtime programmatic fallback injection (`_ensurePageAudioDspInjected` via `<script>` tag with `chrome.runtime.getURL('content/js/page-audio-dsp.js')`) to support all browser environments.
4. **Validate Test Coverage**: Maintain 100% pass rate across `npm test` (Tier 1-4 suites) and adversarial challenger suites (`npm run test:all`).

---
