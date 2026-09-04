# Technical Exploration Report: Preset Gain Mapping & Unit Test Requirements (Milestone M1)

**Agent ID**: `explorer_m1_3` (teamwork_preview_explorer)  
**Milestone**: M1 — 10-Band Graphic Equalizer Engine & Presets (R1 & R4)  
**Target Files**: `utils/audio-engine.js`, `content/js/volume-booster.js`, `tests/tier1/audio-engine.test.js`  
**Working Directory**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/explorer_m1_3`  
**Date**: 2026-08-14  

---

## Executive Summary

This exploration report provides the technical blueprint for Milestone M1 (Preset Gain Mapping & Unit Test Requirements). 

It addresses three core exploration items:
1. **EQ Preset Gain Profiles**: Verification of exact dB gain values across 10 frequency bands for all 9 equalizer presets (`Flat`, `Bass Boost`, `Vocal Booster`, `Treble Boost`, `Rock`, `Pop`, `Acoustic`, `Electronic`, and `Custom`), including resolution of gain options to prevent digital audio clipping.
2. **Unit Test Requirements for `tests/tier1/audio-engine.test.js`**: Definition of exact unit test assertions for 10-band filter node creation, boundary gain clamping (`[-12.0dB, +12.0dB]`), preset switching, single-band custom adjustments, and state immutability.
3. **Worker Implementation Guidelines**: Detailed, code-level instructions for implementing the 10-band equalizer engine in `utils/audio-engine.js`, proxying in `content/js/volume-booster.js`, and test additions in `tests/tier1/audio-engine.test.js`.

---

## Section 1: Verification of Exact dB Gain Profiles for All 9 EQ Presets

### 1.1 10-Band Frequency Specification & Filter Node Topology
The 10-band equalizer graph processes audio across 10 center frequencies spanning sub-bass to upper treble. The filter node types and parameters are:

| Band Index | Center Frequency | BiquadFilterType | Filter Quality Factor (Q) | Gain Range |
|---|---|---|---|---|
| Band 0 | 32 Hz | `lowshelf` | N/A | -12.0 dB to +12.0 dB |
| Band 1 | 64 Hz | `peaking` | 1.414 | -12.0 dB to +12.0 dB |
| Band 2 | 125 Hz | `peaking` | 1.414 | -12.0 dB to +12.0 dB |
| Band 3 | 250 Hz | `peaking` | 1.414 | -12.0 dB to +12.0 dB |
| Band 4 | 500 Hz | `peaking` | 1.414 | -12.0 dB to +12.0 dB |
| Band 5 | 1000 Hz (1 kHz) | `peaking` | 1.414 | -12.0 dB to +12.0 dB |
| Band 6 | 2000 Hz (2 kHz) | `peaking` | 1.414 | -12.0 dB to +12.0 dB |
| Band 7 | 4000 Hz (4 kHz) | `peaking` | 1.414 | -12.0 dB to +12.0 dB |
| Band 8 | 8000 Hz (8 kHz) | `peaking` | 1.414 | -12.0 dB to +12.0 dB |
| Band 9 | 16000 Hz (16 kHz)| `highshelf` | N/A | -12.0 dB to +12.0 dB |

### 1.2 Preset Profiles Master Gain Matrix

The exact dB gains for each of the 9 preset profiles are specified in the matrix below:

| # | Preset Name | 32Hz | 64Hz | 125Hz | 250Hz | 500Hz | 1kHz | 2kHz | 4kHz | 8kHz | 16kHz | Array Representation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Flat** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | `[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]` |
| 2 | **Bass Boost** (Opt A) | +6 | +5 | +4 | +2 | 0 | 0 | 0 | 0 | 0 | 0 | `[6, 5, 4, 2, 0, 0, 0, 0, 0, 0]` |
| - | *Bass Boost (Opt B)* | *+9* | *+7* | *+5* | *+3* | *+1* | *0* | *0* | *0* | *0* | *0* | *`[9, 7, 5, 3, 1, 0, 0, 0, 0, 0]`* |
| 3 | **Vocal Booster** | -2 | -1 | 0 | +2 | +4 | +5 | +4 | +2 | 0 | -1 | `[-2, -1, 0, 2, 4, 5, 4, 2, 0, -1]` |
| 4 | **Treble Boost** | 0 | 0 | 0 | 0 | 0 | +1 | +3 | +5 | +7 | +8 | `[0, 0, 0, 0, 0, 1, 3, 5, 7, 8]` |
| 5 | **Rock** | +5 | +4 | +3 | +1 | -1 | -1 | 0 | +2 | +4 | +5 | `[5, 4, 3, 1, -1, -1, 0, 2, 4, 5]` |
| 6 | **Pop** | -1 | +2 | +4 | +5 | +4 | 0 | -1 | +1 | +3 | +4 | `[-1, 2, 4, 5, 4, 0, -1, 1, 3, 4]` |
| 7 | **Acoustic** | +3 | +2 | +1 | +2 | +3 | +3 | +2 | +3 | +2 | +1 | `[3, 2, 1, 2, 3, 3, 2, 3, 2, 1]` |
| 8 | **Electronic** | +6 | +5 | +2 | 0 | -2 | +2 | +1 | +2 | +4 | +5 | `[6, 5, 2, 0, -2, 2, 1, 2, 4, 5]` |
| 9 | **Custom** | *var* | *var* | *var* | *var* | *var* | *var* | *var* | *var* | *var* | *var* | User-defined array |

#### Analysis of Bass Boost Option A vs Option B:
- **Option A (`[6, 5, 4, 2, 0, 0, 0, 0, 0, 0]`)**: Provides strong sub-bass (+6dB at 32Hz) and low-bass elevation while preventing digital clipping when combined with Master Volume amplification up to 600%. Recommended as standard.
- **Option B (`[9, 7, 5, 3, 1, 0, 0, 0, 0, 0]`)**: Higher bass emphasis (+9dB). Either option is valid; tests will verify that `setEqPreset('Bass Boost')` loads the configured preset profile array cleanly.

---

## Section 2: Unit Test Assertions for `tests/tier1/audio-engine.test.js`

To satisfy Requirement R4.2, new unit test cases must be added to `tests/tier1/audio-engine.test.js`. The unit tests must assert node graph setup, gain clamping, preset switching, single-band modifications, and immutability.

### 2.1 Proposed Unit Test Code Assertions

```javascript
describe('R1 & R4: 10-Band Graphic Equalizer Engine & Presets', () => {

  test('R1.1: AudioEngine creates 10 BiquadFilterNodes with correct frequencies and filter types', () => {
    const origAudioContext = window.AudioContext;
    const filterNodesCreated = [];

    class MockBiquadFilterNode {
      constructor() {
        this.type = 'peaking';
        this.frequency = { value: 0 };
        this.Q = { value: 1 };
        this.gain = { value: 0 };
        filterNodesCreated.push(this);
      }
      connect(next) {}
      disconnect() {}
    }

    class MockAudioContext {
      constructor() {
        this.state = 'suspended';
        this.destination = {};
      }
      resume() { this.state = 'running'; return Promise.resolve(); }
      createMediaElementSource() { return { connect() {}, disconnect() {} }; }
      createGain() { return { gain: { value: 1.0 }, connect() {}, disconnect() {} }; }
      createBiquadFilter() { return new MockBiquadFilterNode(); }
      createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, getByteFrequencyData() {} }; }
    }

    try {
      window.AudioContext = MockAudioContext;
      AudioEngine.ctx = null;
      AudioEngine.eqNodes = [];

      const mockVideo = document.createElement('video');
      AudioEngine.attachToVideo(mockVideo);

      assert.equal(AudioEngine.eqNodes.length, 10, 'AudioEngine initialized exactly 10 filter nodes');

      const expectedFreqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      const expectedTypes = ['lowshelf', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'highshelf'];

      for (let i = 0; i < 10; i++) {
        assert.equal(AudioEngine.eqNodes[i].frequency.value, expectedFreqs[i], `Band ${i} frequency is ${expectedFreqs[i]}Hz`);
        assert.equal(AudioEngine.eqNodes[i].type, expectedTypes[i], `Band ${i} type is ${expectedTypes[i]}`);
        if (i >= 1 && i <= 8) {
          assert.equal(AudioEngine.eqNodes[i].Q.value, 1.414, `Band ${i} Q factor is 1.414`);
        }
      }
    } finally {
      window.AudioContext = origAudioContext;
    }
  });

  test('R1.2: setEqGains clamps gain values within [-12dB, +12dB] boundary', () => {
    // Set gains with values exceeding boundaries and invalid types
    const inputGains = [18, -15, 0, 'invalid', null, 6, -6, 12, -12, 20];
    const success = AudioEngine.setEqGains(inputGains);

    assert.ok(success, 'setEqGains returns true');
    const actualGains = AudioEngine.getEqGains();

    assert.equal(actualGains[0], 12, '18dB clamped to +12dB max');
    assert.equal(actualGains[1], -12, '-15dB clamped to -12dB min');
    assert.equal(actualGains[2], 0, '0dB maintained');
    assert.equal(actualGains[3], 0, 'Invalid string defaults to 0dB');
    assert.equal(actualGains[4], 0, 'null defaults to 0dB');
    assert.equal(actualGains[9], 12, '20dB clamped to +12dB max');
  });

  test('R1.3: setEqPreset switches active preset profile and updates filter nodes', () => {
    AudioEngine.setEqPreset('Vocal Booster');
    assert.equal(AudioEngine.getEqPreset(), 'Vocal Booster', 'Preset set to Vocal Booster');
    
    const vocalGains = AudioEngine.getEqGains();
    assert.deepEqual(vocalGains, [-2, -1, 0, 2, 4, 5, 4, 2, 0, -1], 'Vocal Booster gains applied correctly');

    AudioEngine.setEqPreset('Rock');
    assert.equal(AudioEngine.getEqPreset(), 'Rock', 'Preset set to Rock');
    const rockGains = AudioEngine.getEqGains();
    assert.deepEqual(rockGains, [5, 4, 3, 1, -1, -1, 0, 2, 4, 5], 'Rock gains applied correctly');

    AudioEngine.setEqPreset('Flat');
    assert.equal(AudioEngine.getEqPreset(), 'Flat', 'Preset set to Flat');
    assert.deepEqual(AudioEngine.getEqGains(), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'Flat preset resets all bands to 0dB');
  });

  test('R1.4: setEqBandGain updates single band gain and switches preset to Custom', () => {
    AudioEngine.setEqPreset('Flat');
    assert.equal(AudioEngine.getEqPreset(), 'Flat', 'Initially Flat preset');

    // Modify band 4 (500Hz) to +6dB
    AudioEngine.setEqBandGain(4, 6);
    assert.equal(AudioEngine.getEqPreset(), 'Custom', 'Preset automatically switches to Custom upon slider adjustment');
    assert.equal(AudioEngine.getEqGains()[4], 6, 'Band 4 updated to +6dB');

    // Out of bounds band index is rejected safely
    const invalidIndex = AudioEngine.setEqBandGain(15, 5);
    assert.equal(invalidIndex, false, 'Invalid band index returns false');
  });

  test('R1.5: getEqGains returns an immutable copy of the gains array', () => {
    AudioEngine.setEqPreset('Flat');
    const gainsCopy = AudioEngine.getEqGains();
    
    // Mutate returned array
    gainsCopy[0] = 12;

    // Internal state must remain unmodified
    assert.equal(AudioEngine.getEqGains()[0], 0, 'Internal gains array protected against external mutation');
  });

  test('R1.6: setEqEnabled toggles master EQ bypass without corrupting stored preset state', () => {
    AudioEngine.setEqPreset('Bass Boost');
    const storedGains = AudioEngine.getEqGains();

    AudioEngine.setEqEnabled(false);
    assert.equal(AudioEngine.eqEnabled, false, 'EQ master toggle set to false');
    
    // Stored preset gains retained in instance state
    assert.deepEqual(AudioEngine.getEqGains(), storedGains, 'Stored gains preserved when disabled');

    AudioEngine.setEqEnabled(true);
    assert.equal(AudioEngine.eqEnabled, true, 'EQ master toggle set to true');
    assert.deepEqual(AudioEngine.getEqGains(), storedGains, 'Stored gains active when re-enabled');
  });

});
```

---

## Section 3: Exact Implementation Guidelines for Worker

### 3.1 Implementation Guidelines for `utils/audio-engine.js`

1. **Add Constant Definitions at top of `utils/audio-engine.js`**:
   ```javascript
   const EQ_PRESETS = {
     'Flat':           [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
     'Bass Boost':     [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
     'Vocal Booster':  [-2, -1, 0, 2, 4, 5, 4, 2, 0, -1],
     'Treble Boost':   [0, 0, 0, 0, 0, 1, 3, 5, 7, 8],
     'Rock':           [5, 4, 3, 1, -1, -1, 0, 2, 4, 5],
     'Pop':            [-1, 2, 4, 5, 4, 0, -1, 1, 3, 4],
     'Acoustic':       [3, 2, 1, 2, 3, 3, 2, 3, 2, 1],
     'Electronic':     [6, 5, 2, 0, -2, 2, 1, 2, 4, 5],
     'Custom':         null
   };

   const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
   ```

2. **Extend `AudioEngineClass` Constructor State**:
   ```javascript
   this.eqNodes = [];
   this.eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
   this.eqPreset = 'Flat';
   this.eqEnabled = true;
   ```

3. **Update Node Graph Chain in `attachToVideo(videoEl)`**:
   - Construct 10 `BiquadFilterNode` instances if `this.eqNodes.length !== 10`.
   - Set frequencies: `32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000`.
   - Set types: `lowshelf` (band 0), `peaking` with Q=1.414 (bands 1-8), `highshelf` (band 9).
   - Chain order: `sourceNode -> gainNode -> bassNode -> eqNodes[0] -> ... -> eqNodes[9] -> analyserNode -> destination`.

4. **Implement Equalizer API Methods**:
   - `setEqGains(gainsArray)`: Validate input, clamp gains to `[-12, +12]`, set `this.eqGains`, update `this.eqNodes[i].gain.value`.
   - `setEqPreset(presetName)`: Lookup preset gain array in `EQ_PRESETS`, update `this.eqPreset` and gains.
   - `setEqBandGain(bandIndex, gainDb)`: Clamp index to `0..9`, clamp gain to `[-12, +12]`, update `this.eqGains[bandIndex]`, set `this.eqPreset = 'Custom'`, update `this.eqNodes[bandIndex].gain.value`.
   - `getEqGains()`: Return `[...this.eqGains]`.
   - `getEqPreset()`: Return `this.eqPreset`.
   - `setEqEnabled(enabled)`: Set `this.eqEnabled = Boolean(enabled)`, set `gain.value` to 0 when disabled or `this.eqGains[i]` when enabled.

---

### 3.2 Implementation Guidelines for `content/js/volume-booster.js`

1. **Include `EQ_PRESETS` and `EQ_FREQUENCIES` Constants**.
2. **Add EQ Proxy Methods to `VolumeBoosterClass`**:
   - Expose `setEqGains(gainsArray)`, `setEqPreset(presetName)`, `setEqBandGain(bandIndex, gainDb)`, `getEqGains()`, `getEqPreset()`, `setEqEnabled(enabled)`.
   - If `AudioEngine` exists on `window`/`global`, proxy call to `AudioEngine`.
   - If standalone (no `AudioEngine`), maintain internal state (`this._eqGains`, `this._eqPreset`, `this._eqEnabled`) and construct local 10-band filter graph.
3. **Preserve Navigation & WeakMap Caching**:
   - Retain `_sourceNodeMap = new WeakMap()` and `video._ssMediaSourceNode` to prevent WebKit `InvalidStateError`.
   - Retain `yt-navigate-finish` SPA event listener so EQ settings persist when switching YouTube videos.

---

### 3.3 Implementation Guidelines for `tests/tier1/audio-engine.test.js`

1. Append the new test suite `describe('R1 & R4: 10-Band Graphic Equalizer Engine & Presets', ...)` to `tests/tier1/audio-engine.test.js`.
2. Ensure all test cases (`R1.1` to `R1.6`) execute synchronously and clean without unhandled exceptions or leaks.

---

## Section 4: Verification Method & Acceptance Matrix

| Verification Phase | Command | Success Criteria |
|---|---|---|
| **Static Syntax Verification** | `node -c utils/audio-engine.js content/js/volume-booster.js tests/tier1/audio-engine.test.js` | Zero syntax errors (exits with code 0) |
| **Automated Test Suite** | `npm test` | 100% pass rate across all test tiers with zero failures |
| **Tier 1 Unit Test Check** | `node -e "require('./tests/tier1/audio-engine.test.js')"` | 100% pass rate on newly added EQ unit assertions |

---

## Conclusion & Handoff Summary

The 9 EQ presets, gain clamping boundaries, 10-band Web Audio node topology, and unit test assertions specified in this report provide complete technical guidance for Worker implementation during Milestone M1.
