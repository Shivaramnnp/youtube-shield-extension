# Empirical Stress Testing & Challenge Report — Milestone M1

**Target**: 10-Band Graphic Equalizer Engine & Presets (`utils/audio-engine.js`, `content/js/volume-booster.js`)  
**Challenger**: Challenger 1 (`challenger_m1_1`)  
**Date**: 2026-08-14  
**Verdict**: **REQUEST_CHANGES**  

---

## 1. Challenge Summary

**Overall Risk Assessment**: **HIGH**

Empirical stress testing was conducted on `AudioEngine` (`utils/audio-engine.js`) and `VolumeBooster` (`content/js/volume-booster.js`). 

While `AudioEngine` correctly clamps gains to `[-12, +12]` dB without throwing exceptions and handles 100,000 tight-loop preset switches efficiently, **critical state desynchronization and invalid preset state bugs were discovered in `VolumeBooster.setEqPreset()` when passing unknown/invalid preset strings.**

Specifically:
1. `VolumeBooster.setEqPreset(unknownPreset)` updates its internal `_eqPreset` variable to the invalid string and returns `true` (claiming success) regardless of whether `AudioEngine.setEqPreset()` succeeded or returned `false`. This causes `VolumeBooster` and `AudioEngine` to enter a desynchronized state.
2. In fallback mode (when `AudioEngine` is not attached), `VolumeBooster.setEqPreset(unknownPreset)` sets `this._eqPreset = unknownPreset` and returns `true` without matching any preset or applying valid gains.
3. `setEqBandGain(null, gain)` / `setEqBandGain(false, gain)` coerces `null`/`false` to `0` via `Number(null)` and modifies Band 0 (32Hz) instead of rejecting invalid band index inputs.

---

## 2. Challenges & Findings

### [High] Challenge 1: VolumeBooster state desynchronization on unknown preset strings

- **Assumption Challenged**: `VolumeBooster.setEqPreset()` validates preset strings and stays in sync with `AudioEngine`.
- **Attack Scenario**: Call `VolumeBooster.setEqPreset('InvalidPresetName')`.
- **Observed Behavior**:
  - `AudioEngine.setEqPreset('InvalidPresetName')` returns `false` and maintains the active preset (e.g. `'Flat'`).
  - `VolumeBooster.setEqPreset('InvalidPresetName')` sets `this._eqPreset = 'InvalidPresetName'`, ignores `AudioEngine`'s `false` return value, and returns `true`.
  - `VolumeBooster.getEqPreset()` returns `'InvalidPresetName'`, while `AudioEngine.getEqPreset()` returns `'Flat'`.
- **Blast Radius**: Extension UI components calling `VolumeBooster.setEqPreset()` with user or storage input will be misled into displaying invalid preset names while the audio engine plays a completely different preset.
- **Suggested Fix**:
  In `content/js/volume-booster.js`:
  ```javascript
  setEqPreset(presetName) {
    if (typeof presetName !== 'string') return false;

    const audioEngine = (typeof window !== 'undefined' && window.AudioEngine) ||
                        (typeof global !== 'undefined' && global.AudioEngine);

    if (audioEngine && typeof audioEngine.setEqPreset === 'function') {
      const success = audioEngine.setEqPreset(presetName);
      if (!success) return false;
      this._eqPreset = audioEngine.getEqPreset();
      if (Array.isArray(audioEngine.eqGains)) {
        this._eqGains = [...audioEngine.eqGains];
      }
      if (audioEngine.eqNodes) this.eqNodes = audioEngine.eqNodes;
      if (!this.sourceNode) this.connect();
      return true;
    } else {
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
        this._eqPreset = 'Custom';
        if (!this.sourceNode) this.connect();
        return true;
      } else if (EQ_PRESETS[normalized]) {
        this._eqPreset = normalized;
        this.setEqGains(EQ_PRESETS[normalized]);
        if (!this.sourceNode) this.connect();
        return true;
      }
      return false;
    }
  }
  ```

---

### [Medium] Challenge 2: `setEqBandGain` index type coercion (`null`, `false`, `""`)

- **Assumption Challenged**: `setEqBandGain` validates that `bandIdx` is a valid band index number (0 to 9).
- **Attack Scenario**: Call `AudioEngine.setEqBandGain(null, 6)` or `VolumeBooster.setEqBandGain(false, 6)`.
- **Observed Behavior**: `Number(null)` and `Number(false)` evaluate to `0`. `Math.floor(0)` yields `0`, which is in `[0..9]`. The function updates Band 0 gain to 6dB and returns `true`.
- **Blast Radius**: Non-numeric or null values passed as `bandIdx` unintentionally modify Band 0 (32Hz).
- **Suggested Fix**:
  Add explicit type check or check for `null` / `boolean` before numeric conversion:
  ```javascript
  if (bandIdx === null || bandIdx === undefined || typeof bandIdx === 'boolean' || Array.isArray(bandIdx)) return false;
  ```

---

## 3. Stress Test Results Matrix

| Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| Gain bounds: `-100`, `+100`, `999999`, `-999999` | Clamp gains to `[-12, +12]` dB | Clamped to `-12` and `+12` dB | **PASS** |
| Special numeric: `Infinity`, `-Infinity` | Clamp gains to `[-12, +12]` dB | Clamped to `-12` and `+12` dB | **PASS** |
| Non-numeric gains: `NaN`, `null`, `undefined`, `"abc"`, `{}` | Default gain to `0` dB | Defaulted to `0` dB | **PASS** |
| String numbers: `"10"`, `"-100"`, `"12.5"` | Parse and clamp properly | Parsed and clamped (`10`, `-12`, `12`) | **PASS** |
| Non-array `setEqGains()` inputs (`null`, `123`, `{}`) | Return `false`, no exception | Returned `false` cleanly | **PASS** |
| Immutability of `getEqGains()` | Return shallow copy | Shallow copy returned; internal state protected | **PASS** |
| Unknown preset to `AudioEngine.setEqPreset('Fake')` | Return `false`, keep active preset | Returned `false`, active preset kept | **PASS** |
| Preset case & whitespace (`"  BASS BOOST  "`) | Normalize and apply preset | Applied `Bass Boost` preset | **PASS** |
| Tight loop preset switching (100,000 switches) | Complete without memory leak/error | Executed 100,000 switches in 45ms | **PASS** |
| Auto-detect preset (`_detectPreset`) | Switch preset identifier on gain match | Correctly auto-detected `Rock` / `Custom` | **PASS** |
| Unknown preset to `VolumeBooster.setEqPreset('Fake')` | Return `false`, match `AudioEngine` | Returned `true`, set `_eqPreset='Fake'`, desynced from `AudioEngine` | **FAIL** |
| Standalone `VolumeBooster.setEqPreset('Fake')` | Return `false` | Returned `true`, stored `'Fake'` | **FAIL** |
| Band index `null` / `false` to `setEqBandGain` | Return `false` | Returned `true`, mutated Band 0 | **WARN** |
| Full Project Test Suite (`npm test`) | 100% pass rate (310 tests) | 310/310 passed clean | **PASS** |
| Static Syntax Verification (`node -c`) | Exit code 0 across all files | Exit code 0 | **PASS** |

---

## 4. Unchallenged Areas

- **Canvas Spectrum Visualizer (R2)**: Out of scope for M1 (assigned to M2).
- **Storage Persistence Cascade (R3)**: Out of scope for M1 (assigned to M3).
