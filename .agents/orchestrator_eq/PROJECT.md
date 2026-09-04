# Project: GodMode Extension - 10-Band Graphic Audio Equalizer & Real-Time Spectrum Analyzer

## Architecture

The GodMode Extension architecture is extended to incorporate a professional 10-Band Graphic Audio Equalizer Engine (R1), a Real-Time Output Frequency Spectrum Analyser with HTML5 Canvas visualizers (R2), full UI control & storage sync (R3), and cross-browser compatibility hardening with an expanded Tier 1 automated test suite (R4).

### 1. Web Audio API Graph Topology
```
┌─────────────────────────────────────────────────────────────────────────┐
│                       YouTube <video> Element                           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   MediaElementAudioSourceNode                           │
│     (WeakMap cached, crossOrigin="anonymous", WebKit gesture unlocked)   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       GainNode (Volume: 100%–600%)                      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    10-Band BiquadFilterNode Chain                       │
│                                                                         │
│  [32Hz] ──► [64Hz] ──► [125Hz] ──► [250Hz] ──► [500Hz]                 │
│ (lowshelf)  (peaking)  (peaking)   (peaking)   (peaking)                │
│                                                                         │
│  ──► [1kHz] ──► [2kHz] ──► [4kHz] ──► [8kHz] ──► [16kHz]               │
│     (peaking)  (peaking)  (peaking)  (peaking)  (highshelf)              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            AnalyserNode                                 │
│          (fftSize: 128, smoothing: 0.8, getByteFrequencyData)           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       AudioContext.destination                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Multi-Tier Storage Schema & Sync (`utils/storage.js`)
`DEFAULT_SETTINGS.volumeBooster` schema extension:
```javascript
volumeBooster: {
  volumeLevel: 100,                        // 100% to 600%
  bassLevel: 0,                            // 0dB to 20dB
  eqEnabled: true,                         // Master EQ toggle
  preset: 'Flat',                          // Preset profile identifier
  eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]  // 10 band gains in dB (-12dB to +12dB)
}
```
Synchronization uses 3-Tier Cascade (`chrome.storage.sync` → `chrome.storage.local` → `memorySettingsCache`) managed by `StorageUtil.updateVolumeBoosterSetting()`.

### 3. Real-Time Canvas Spectrum IPC Stream
- **Header Popover**: Direct zero-latency access to `VolumeBooster.getFrequencyData()` in the content script context.
- **Popup & Options Dashboard**: IPC port stream (`chrome.runtime.connect`) from YouTube content script to extension window contexts.
- **Rendering Engine**: HTML5 Canvas with 60 FPS `requestAnimationFrame` loop, glowing gradient vertical bars (`#2563eb` → `#7c3aed` → `#a855f7` → `#ec4899`), neon shadow blur, peak-hold indicator caps (15-frame hold + 2.5px/frame decay), and `cancelAnimationFrame` lifecycle teardown.

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1.1 10-Band Filter Chain | 10 BiquadFilterNodes (32Hz lowshelf, 64Hz-8kHz peaking Q=1.414, 16kHz highshelf) with -12dB to +12dB individual gains | M1 | Survey |
| 2 | R1.2 Equalizer Presets | 9 Preset Profiles (Flat, Bass Boost, Vocal Booster, Treble Boost, Rock, Pop, Acoustic, Electronic, Custom) with exact dB gain arrays | M1 | Survey |
| 3 | R1.3 Audio Engine Core | AudioEngine & VolumeBooster integration, node graph construction, gain clamping, state management | M1 | Survey |
| 4 | R2.1 AnalyserNode | AnalyserNode integration (fftSize 128, smoothing 0.8) and `getByteFrequencyData` byte array extraction | M2 | Survey |
| 5 | R2.2 HTML5 Canvas Visualizer | Canvas visualizer rendering engine with glowing gradient bars, 60 FPS animation, peak-hold falloff caps in Popup, Options, Header | M2 | Survey |
| 6 | R2.3 Spectrum IPC Stream | Non-blocking IPC port connection streaming 64-byte frequency arrays to Popup and Options windows when visible | M2 | Survey |
| 7 | R3.1 Equalizer UI Controls | 10-band gain sliders (-12dB to +12dB), preset selector dropdown, reset button in Popup, Options Dashboard & Header Popover | M3 | Survey |
| 8 | R3.2 Storage Sync & Integration | Extend `StorageUtil.updateVolumeBoosterSetting()`, deep-clone array merge, 3-tier cascade persistence, cross-context `chrome.storage.onChanged` sync | M3 | Survey |
| 9 | R4.1 Cross-Browser Compatibility | Safari WebKit AudioContext 6-event gesture unlock, `crossOrigin="anonymous"` handling, WeakMap audio node caching | M4 | Survey |
| 10| R4.2 Automated Tier 1 Tests | Unit test suite additions in `tests/tier1/` for 10 filter nodes, gain clamping, preset switching, spectrum byte extraction, storage sync | M4 | Survey |
| 11| R4.3 Test Pass & Syntax Verification | 100% `npm test` pass rate across all tiers and `node -c` static syntax verification across all 84+ JavaScript project files | M4 | Survey |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | 10-Band Graphic Equalizer Engine & Presets (R1) | `utils/audio-engine.js`, `content/js/volume-booster.js` | None | DONE |
| M2 | Real-Time Spectrum Analyzer & Visualizers (R2) | `utils/audio-engine.js`, `content/js/volume-booster.js`, `background/background.js`, `popup/popup.js`, `options/options.js`, `content/js/header-button.js` | M1 | PLANNED |
| M3 | UI Control, Storage & Header Popover Integration (R3) | `utils/storage.js`, `popup/popup.html/css/js`, `options/options.html/css/js`, `content/js/header-button.js`, `content/css/header-button.css` | M1, M2 | PLANNED |
| M4 | Multi-Browser Compatibility & Automated Test Suite (R4) | `tests/tier1/audio-engine.test.js`, `utils/audio-engine.js`, `content/js/volume-booster.js` | M1, M2, M3 | PLANNED |

---

## Interface Contracts

### AudioEngine ↔ VolumeBooster
- `AudioEngine.setEqGains(gainsArray)`: Takes array of 10 numbers, clamps each to `[-12, +12]`, updates `eqNodes[i].gain.value`. Returns `boolean`.
- `AudioEngine.setEqPreset(presetName)`: Sets preset name, applies preset dB values to filter nodes. Returns `boolean`.
- `AudioEngine.getFrequencyData()`: Returns `Uint8Array` of length 64 from `analyserNode.getByteFrequencyData()`.

### VolumeBooster / StorageUtil ↔ Extension UI
- `StorageUtil.updateVolumeBoosterSetting(key, value)`: Key is `'volumeLevel'`, `'bassLevel'`, `'eqEnabled'`, `'preset'`, or `'eqGains'`. Returns Promise resolving when storage is saved.
- IPC Spectrum Message: `{ action: 'spectrum_data', data: Array<number> }`. Sent via `Port.postMessage` from content script streamer loop.

---

## Code Layout & Module Write Ownership

| Module / File | Primary Scope | Assigned Milestone |
|---|---|---|
| `utils/audio-engine.js` | Web Audio graph, BiquadFilterNodes, AnalyserNode, WebKit gesture unlock | M1, M2, M4 |
| `content/js/volume-booster.js` | YouTube DOM video interception, EQ proxy methods, spectrum IPC streamer | M1, M2 |
| `background/background.js` | Extension service worker, IPC port message router | M2 |
| `utils/storage.js` | Default settings schema, settings merge, 3-tier cascade sync | M3 |
| `popup/popup.html`, `popup.css`, `popup.js` | Extension popup 10-band UI sliders, preset dropdown, spectrum canvas | M2, M3 |
| `options/options.html`, `options.css`, `options.js` | Options Dashboard EQ card, sliders, preset selector, spectrum canvas | M2, M3 |
| `content/js/header-button.js`, `content/css/header-button.css` | YouTube topbar popover dialog, EQ sliders, preset selector, spectrum canvas | M2, M3 |
| `tests/tier1/audio-engine.test.js` | Tier 1 automated unit tests for 10-band EQ, presets, analyser, storage sync | M4 |
