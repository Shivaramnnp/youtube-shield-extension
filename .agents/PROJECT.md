# Project: YouTube Shield Safari Web Audio, Volume Booster & Equalizer Remediation

## Architecture
YouTube Shield employs a **Dual-World Web Audio Architecture** to support Chromium, Gecko (Firefox), and WebKit (Safari):
- **MAIN World Engine (`content/js/page-audio-dsp.js`)**: Executes in YouTube's page execution context to access native `<video>` elements directly, bypassing Safari WebKit's media element cross-world isolation / SecurityError restrictions. Builds and connects the complete Web Audio DSP graph.
- **ISOLATED Content Script (`content/js/volume-booster.js` & `content/js/main.js`)**: Manages extension lifecycle, storage sync (`StorageUtil`), UI controls, and spectrum streaming.
- **Bidirectional CustomEvent IPC Bridge**:
  - `__SS_AUDIO_UPDATE__`: Dispatched from ISOLATED world to `window` with `{ volumeLevel, bassLevel, eqGains, eqPreset, eqEnabled }`.
  - `__SS_AUDIO_STATE__` / DOM attributes (`data-ss-*`): Reflects active DSP status and connection state back to the extension.
- **UI Surfaces**: Header Button popover (`content/js/header-button.js`), Popup HUD (`popup/popup.js`), and Options Studio (`options/options.js`).
- **Audio DSP Graph Topology**:
  `HTMLMediaElement (<video>)` → `MediaElementAudioSourceNode` → `BiquadFilterNode (Bass 150Hz lowshelf/peaking 0..20dB)` → `GainNode (Volume 0.0..6.0 / 0..600%)` → `10-Band BiquadFilterNodes (32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz ±12dB)` → `AnalyserNode (fftSize=128, 64 bins)` → `AudioDestinationNode (ctx.destination)`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Safari WebKit Page-World DSP Controller | Dedicated page-world script injection (`page-audio-dsp.js`) via manifest `"world": "MAIN"` and dynamic `<script>` fallback | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Page-Scope MediaElementSourceNode Attachment | Clean attachment of `createMediaElementSource` to YouTube's `<video>` elements in page context with `WeakMap` caching and SPA element reuse | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Full Audio DSP Node Graph | Sequential wiring: Source → Bass Filter (150Hz) → Gain Node (0-600%) → 10-Band EQ Filters (32Hz-16kHz) → AnalyserNode → ctx.destination | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Bidirectional CustomEvent & DOM IPC Bridge | Zero-latency `__SS_AUDIO_UPDATE__` and `__SS_AUDIO_STATE__` event communication between ISOLATED and MAIN execution contexts | M2 | ORIGINAL_REQUEST §R2 |
| 5 | Real-Time Volume, Bass & EQ Synchronization | Instantaneous sync of volume (100%-600%), bass (0-20dB), 10-band gains (±12dB), preset selection, and master bypass (`eqEnabled`) from Header Popover, Popup HUD, and Options Studio | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Throttled Spectrum Visualizer Streaming | AnalyserNode frequency bin extraction (64 bins Uint8Array) streamed via `ss-spectrum-stream` port with 500ms power-saving idle gating | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Multi-Gesture WebKit AudioContext Unlock | 9-event passive capture listeners (`click`, `pointerdown`, `mousedown`, `keydown`, `touchstart`, `touchend`, `play`, `playing`, `input`) across UI and page contexts | M3 | ORIGINAL_REQUEST §R3 |
| 8 | Stream Switch & SPA Navigation Audio Auto-Resume | Automatic context recovery and node graph reconnection on YouTube stream switches, SPA route changes, and playback transitions | M3 | ORIGINAL_REQUEST §R3 |
| 9 | Dedicated Safari WebKit Audio Bridge Tests | Verification tests covering CustomEvent dispatch, parameter bounds clamping, gain math, and multi-gesture resume handlers | M4 | ORIGINAL_REQUEST §R4 |
| 10 | Master Test Suite & Adversarial Suite Pass | 100% clean execution of `npm test` (422+ assertions) and `npm run test:all` (655+ assertions) with 0 failures | M4 | ORIGINAL_REQUEST §R4 |
| 11 | Production Packaging & Distribution Build | Clean production build via `npm run build` producing verified artifacts in `dist/` | M4 | ORIGINAL_REQUEST §R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Safari Page-Context Web Audio Bridge | `content/js/page-audio-dsp.js`, `manifest.json`, `content/js/volume-booster.js`, audio graph wiring, `WeakMap` node caching | none | IN_PROGRESS |
| M2 | Bidirectional IPC & Audio Controls Sync | CustomEvent IPC (`__SS_AUDIO_UPDATE__`, `__SS_AUDIO_STATE__`), volume/bass/EQ/preset/bypass sync across UI surfaces, spectrum stream | M1 | PLANNED |
| M3 | Multi-Gesture WebKit Unlock & SPA Lifecycle | 9-event gesture unlocking in page and extension contexts, `yt-navigate-finish` stream resume, playback lifecycle | M1, M2 | PLANNED |
| M4 | Cross-Browser Verification, Hardening & Packaging | Dedicated Safari tests, `npm test`, `npm run test:all`, `npm run build`, `dist/` packages | M1, M2, M3 | PLANNED |

## Interface Contracts
### `content/js/volume-booster.js` (ISOLATED) ↔ `content/js/page-audio-dsp.js` (MAIN)
- **Event**: `__SS_AUDIO_UPDATE__`
  - Dispatched on: `window`
  - Payload (`event.detail`):
    ```json
    {
      "volumeLevel": 100..600,
      "bassLevel": 0..20,
      "eqGains": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      "eqPreset": "Flat" | "Bass Boost" | "Vocal Booster" | "Treble Boost" | "Rock" | "Pop" | "Acoustic" | "Electronic" | "Custom",
      "eqEnabled": true | false
    }
    ```
- **Event**: `__SS_AUDIO_STATE__`
  - Dispatched on: `window`
  - Payload (`event.detail`):
    ```json
    {
      "connected": true | false,
      "contextState": "running" | "suspended" | "closed",
      "volumeLevel": number,
      "bassLevel": number,
      "eqEnabled": boolean,
      "activePreset": string
    }
    ```
- **DOM Attributes** on `document.documentElement`:
  - `data-ss-audio-connected`: `"true"` | `"false"`
  - `data-ss-audio-state`: `"running"` | `"suspended"`

## Code Layout
- `content/js/page-audio-dsp.js`: Dedicated MAIN-world Web Audio DSP engine
- `content/js/volume-booster.js`: Extension content script volume controller & IPC bridge
- `content/js/header-button.js`: Header popup UI & volume/bass/EQ slider controls
- `popup/popup.js`: Extension popup UI & audio controls
- `options/options.js`: Options dashboard & audio visualizer studio
- `utils/audio-engine.js`: Shared audio constants, EQ band frequencies, and preset definitions
- `utils/storage.js`: Storage cascade (`sync` → `local` → `memory`)
- `manifest.json` & `manifest-firefox.json`: Extension manifests & web accessible resources
- `tests/tier3/safari-audio-bridge.test.js`: Dedicated Safari WebKit audio bridge test suite
- `run-tests.js` & `tests/`: Test runners and suites
- `build.js` & `dist/`: Production packaging
