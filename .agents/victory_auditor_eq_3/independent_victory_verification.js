/**
 * Independent Victory Verification Test Suite (Generation 3)
 * Author: Victory Auditor EQ Gen 3
 * Evaluates R1, R2, R3, R4 under adversarial conditions.
 */

const assert = require('assert');
const path = require('path');

// Setup mock extension environment
const { setupMockEnv } = require('../../tests/harness/mock-extension-env');
setupMockEnv();

const AudioEngine = require('../../utils/audio-engine');
const VolumeBooster = require('../../content/js/volume-booster');
const { StorageUtil, DEFAULT_SETTINGS } = require('../../utils/storage');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    testsPassed++;
    console.log(`  ✓ [AUDIT-PASS] ${name}`);
  } catch (err) {
    testsFailed++;
    console.error(`  ❌ [AUDIT-FAIL] ${name}:`, err.message);
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    testsPassed++;
    console.log(`  ✓ [AUDIT-PASS] ${name}`);
  } catch (err) {
    testsFailed++;
    console.error(`  ❌ [AUDIT-FAIL] ${name}:`, err.message);
  }
}

async function runIndependentAudit() {
  console.log('================================================================');
  console.log('  INDEPENDENT VICTORY AUDIT TEST SUITE (GENERATION 3)          ');
  console.log('================================================================\n');

  // --- SECTION 1: R1 10-Band Equalizer Engine & Presets ---
  console.log('--- SECTION 1: R1 10-Band Graphic Equalizer Engine & Presets ---');

  runTest('R1.1: AudioEngine exposes exactly 10 EQ_BANDS with standard frequencies & types', () => {
    assert.ok(Array.isArray(AudioEngine.EQ_BANDS), 'EQ_BANDS is an array');
    assert.strictEqual(AudioEngine.EQ_BANDS.length, 10, 'Exactly 10 frequency bands');
    
    const expectedFreqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const expectedTypes = ['lowshelf', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'highshelf'];

    for (let i = 0; i < 10; i++) {
      assert.strictEqual(AudioEngine.EQ_BANDS[i].freq, expectedFreqs[i], `Band ${i} frequency must be ${expectedFreqs[i]}Hz`);
      assert.strictEqual(AudioEngine.EQ_BANDS[i].type, expectedTypes[i], `Band ${i} type must be ${expectedTypes[i]}`);
      if (i >= 1 && i <= 8) {
        assert.strictEqual(AudioEngine.EQ_BANDS[i].Q, 1.414, `Peaking band ${i} Q factor must be 1.414`);
      }
    }
  });

  runTest('R1.2: AudioEngine exposes all 9 preset profiles with exact gain vectors', () => {
    const PRESETS = AudioEngine.EQ_PRESETS;
    assert.ok(PRESETS, 'EQ_PRESETS defined');
    
    const expectedPresets = {
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

    for (const [preset, expectedGains] of Object.entries(expectedPresets)) {
      assert.ok(preset in PRESETS, `Preset '${preset}' exists in EQ_PRESETS`);
      if (expectedGains) {
        assert.deepStrictEqual(PRESETS[preset], expectedGains, `Preset '${preset}' gains match specification`);
      }
    }
  });

  runTest('R1.3: AudioEngine graph construction wires 10 BiquadFilterNodes in sequence', () => {
    const origCtx = window.AudioContext;
    const filterNodes = [];

    class MockFilterNode {
      constructor() {
        this.type = 'peaking';
        this.frequency = { value: 0 };
        this.Q = { value: 1 };
        this.gain = { value: 0 };
        this.connectedTo = null;
        filterNodes.push(this);
      }
      connect(target) { this.connectedTo = target; }
      disconnect() { this.connectedTo = null; }
    }

    class MockAudioContext {
      constructor() { this.state = 'suspended'; this.destination = { id: 'destination' }; }
      resume() { this.state = 'running'; return Promise.resolve(); }
      createMediaElementSource() { return { connect(target) { this.target = target; }, disconnect() {} }; }
      createGain() { return { gain: { value: 1.0 }, connect(target) { this.target = target; }, disconnect() {} }; }
      createBiquadFilter() { return new MockFilterNode(); }
      createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, frequencyBinCount: 64, connect() {}, disconnect() {} }; }
    }

    try {
      window.AudioContext = MockAudioContext;
      AudioEngine.ctx = null;
      AudioEngine.eqNodes = [];

      const video = document.createElement('video');
      video.src = 'https://www.youtube.com/watch?v=independent_audit';
      AudioEngine.attachToVideo(video);

      assert.strictEqual(AudioEngine.eqNodes.length, 10, '10 EQ filter nodes in graph');
      assert.strictEqual(filterNodes.length, 11, '11 BiquadFilterNodes total (1 bass + 10 EQ)');

      // Verify node parameters
      for (let i = 0; i < 10; i++) {
        assert.strictEqual(AudioEngine.eqNodes[i].frequency.value, AudioEngine.EQ_BANDS[i].freq);
        assert.strictEqual(AudioEngine.eqNodes[i].type, AudioEngine.EQ_BANDS[i].type);
      }
    } finally {
      window.AudioContext = origCtx;
    }
  });

  runTest('R1.4: Adversarial gain clamping across all 10 bands strictly enforces [-12dB, +12dB]', () => {
    // Extreme values
    AudioEngine.setEqGains([999, -999, 12.01, -12.01, NaN, Infinity, -Infinity, 'invalid', null, undefined]);
    const clamped = AudioEngine.getEqGains();

    assert.strictEqual(clamped[0], 12, '999dB clamped to +12dB');
    assert.strictEqual(clamped[1], -12, '-999dB clamped to -12dB');
    assert.strictEqual(clamped[2], 12, '12.01dB clamped to +12dB');
    assert.strictEqual(clamped[3], -12, '-12.01dB clamped to -12dB');
    assert.strictEqual(clamped[4], 0, 'NaN defaults to 0dB');
    assert.strictEqual(clamped[5], 12, 'Infinity clamped to +12dB');
    assert.strictEqual(clamped[6], -12, '-Infinity clamped to -12dB');
    assert.strictEqual(clamped[7], 0, 'invalid string defaults to 0dB');
    assert.strictEqual(clamped[8], 0, 'null defaults to 0dB');
    assert.strictEqual(clamped[9], 0, 'undefined defaults to 0dB');
  });

  runTest('R1.5: Preset switching updates active preset name and filter node gains', () => {
    const presetsToTest = ['Flat', 'Bass Boost', 'Vocal Booster', 'Treble Boost', 'Rock', 'Pop', 'Acoustic', 'Electronic'];
    for (const presetName of presetsToTest) {
      const ok = AudioEngine.setEqPreset(presetName);
      assert.strictEqual(ok, true, `setEqPreset('${presetName}') returns true`);
      assert.strictEqual(AudioEngine.getEqPreset(), presetName, `active preset is '${presetName}'`);
      assert.deepStrictEqual(AudioEngine.getEqGains(), AudioEngine.EQ_PRESETS[presetName], `gains match '${presetName}'`);
    }

    // Invalid preset name
    const invalidOk = AudioEngine.setEqPreset('NonExistentPreset');
    assert.strictEqual(invalidOk, false, 'Invalid preset returns false');
    assert.strictEqual(AudioEngine.getEqPreset(), 'Electronic', 'Active preset preserved on invalid call');
  });

  runTest('R1.6: Single band gain tweak automatically transitions preset to Custom', () => {
    AudioEngine.setEqPreset('Flat');
    assert.strictEqual(AudioEngine.getEqPreset(), 'Flat');

    AudioEngine.setEqBandGain(5, 4.5);
    assert.strictEqual(AudioEngine.getEqPreset(), 'Custom', 'Preset auto-switched to Custom');
    assert.strictEqual(AudioEngine.getEqGains()[5], 4.5, 'Band 5 updated to +4.5dB');

    // Manually matching a predefined preset auto-detects it
    AudioEngine.setEqGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.strictEqual(AudioEngine.getEqPreset(), 'Flat', 'Auto-detected Flat preset');

    AudioEngine.setEqGains([6, 5, 4, 2, 0, 0, 0, 0, 0, 0]);
    assert.strictEqual(AudioEngine.getEqPreset(), 'Bass Boost', 'Auto-detected Bass Boost preset');
  });

  runTest('R1.7: Master EQ toggle bypasses filter gain without discarding stored user settings', () => {
    AudioEngine.setEqPreset('Rock');
    const storedGains = AudioEngine.getEqGains();

    AudioEngine.setEqEnabled(false);
    assert.strictEqual(AudioEngine.eqEnabled, false, 'eqEnabled is false');
    assert.deepStrictEqual(AudioEngine.getEqGains(), storedGains, 'Stored gains intact when disabled');

    // Filter nodes should output 0 gain when bypassed
    if (AudioEngine.eqNodes && AudioEngine.eqNodes[0]) {
      assert.strictEqual(AudioEngine.eqNodes[0].gain.value, 0, 'Filter node gain is 0dB when bypassed');
    }

    AudioEngine.setEqEnabled(true);
    assert.strictEqual(AudioEngine.eqEnabled, true, 'eqEnabled is true');
    assert.deepStrictEqual(AudioEngine.getEqGains(), storedGains, 'Stored gains active when re-enabled');
    if (AudioEngine.eqNodes && AudioEngine.eqNodes[0]) {
      assert.strictEqual(AudioEngine.eqNodes[0].gain.value, storedGains[0], 'Filter node gain restored');
    }
  });

  runTest('R1.8: Immutability check - external array mutation does not corrupt AudioEngine state', () => {
    AudioEngine.setEqPreset('Flat');
    const gains = AudioEngine.getEqGains();
    gains[0] = 12;
    gains[1] = -12;

    assert.strictEqual(AudioEngine.getEqGains()[0], 0, 'Internal gains shielded from mutation');
    assert.strictEqual(AudioEngine.getEqGains()[1], 0, 'Internal gains shielded from mutation');
  });

  // --- SECTION 2: R2 Spectrum Analyzer & Canvas Visualizer ---
  console.log('\n--- SECTION 2: R2 Real-Time Spectrum Analyzer & Visualizers ---');

  runTest('R2.1: AnalyserNode initialization (fftSize: 128, smoothingTimeConstant: 0.8)', () => {
    const origCtx = window.AudioContext;
    let analyserCreated = false;

    class MockAnalyser {
      constructor() {
        this.fftSize = 128;
        this.smoothingTimeConstant = 0.8;
        this.frequencyBinCount = 64;
        analyserCreated = true;
      }
      getByteFrequencyData(arr) { arr.fill(200); }
      connect() {}
      disconnect() {}
    }

    class MockAudioContext {
      constructor() { this.state = 'running'; this.destination = {}; }
      createMediaElementSource() { return { connect() {}, disconnect() {} }; }
      createGain() { return { gain: { value: 1.0 }, connect() {}, disconnect() {} }; }
      createBiquadFilter() { return { type: 'peaking', frequency: { value: 1000 }, Q: { value: 1.414 }, gain: { value: 0 }, connect() {}, disconnect() {} }; }
      createAnalyser() { return new MockAnalyser(); }
    }

    try {
      window.AudioContext = MockAudioContext;
      AudioEngine.ctx = null;
      AudioEngine.analyserNode = null;

      const video = document.createElement('video');
      AudioEngine.attachToVideo(video);

      assert.ok(analyserCreated, 'AnalyserNode created on attachToVideo');
      assert.strictEqual(AudioEngine.analyserNode.fftSize, 128, 'fftSize is 128');
      assert.strictEqual(AudioEngine.analyserNode.smoothingTimeConstant, 0.8, 'smoothingTimeConstant is 0.8');

      const freqData = AudioEngine.getFrequencyData();
      assert.ok(freqData instanceof Uint8Array, 'Returns Uint8Array');
      assert.strictEqual(freqData.length, 64, 'Length is 64 frequency bins');
      assert.strictEqual(freqData[0], 200, 'Frequency data extracted correctly');
    } finally {
      window.AudioContext = origCtx;
    }
  });

  runTest('R2.2: VolumeBooster getFrequencyData proxies seamlessly or returns fallback 64-byte array', () => {
    const data = VolumeBooster.getFrequencyData();
    assert.ok(data instanceof Uint8Array, 'VolumeBooster returns Uint8Array');
    assert.strictEqual(data.length, 64, 'VolumeBooster frequency array length is 64');
  });

  // --- SECTION 3: R3 UI Controls, Storage & Header Popover Integration ---
  console.log('\n--- SECTION 3: R3 UI Controls, Storage & Header Popover Integration ---');

  await runAsyncTest('R3.1: StorageUtil 3-tier cascade saves and syncs 10-band EQ settings', async () => {
    // Check initial defaults
    const settings = await StorageUtil.getSettings();
    assert.ok(settings.volumeBooster, 'volumeBooster exists in settings');
    assert.strictEqual(settings.volumeBooster.eqEnabled, true, 'eqEnabled is true');
    assert.strictEqual(settings.volumeBooster.preset, 'Flat', 'preset is Flat');
    assert.strictEqual(settings.volumeBooster.eqGains.length, 10, 'eqGains has 10 elements');

    // Update eqGains
    const customGains = [2, 4, 6, 8, 10, -2, -4, -6, -8, -10];
    await StorageUtil.updateVolumeBoosterSetting('eqGains', customGains);
    await StorageUtil.updateVolumeBoosterSetting('preset', 'Custom');
    await StorageUtil.updateVolumeBoosterSetting('eqEnabled', false);

    const updated = await StorageUtil.getSettings();
    assert.deepStrictEqual(updated.volumeBooster.eqGains, customGains, 'eqGains synced and persisted');
    assert.strictEqual(updated.volumeBooster.preset, 'Custom', 'preset synced and persisted');
    assert.strictEqual(updated.volumeBooster.eqEnabled, false, 'eqEnabled synced and persisted');

    // Reset settings
    await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS });
  });

  // --- SECTION 4: R4 Multi-Browser Compatibility & Hardening ---
  console.log('\n--- SECTION 4: R4 Multi-Browser Compatibility & Hardening ---');

  await runAsyncTest('R4.1: Safari WebKit 6-Event Gesture Unlocking on window, document, and video', async () => {
    const gestureEvents = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown'];
    
    for (const evtName of gestureEvents) {
      let resumed = false;
      class MockContext {
        constructor() { this.state = 'suspended'; this.destination = {}; }
        resume() { resumed = true; this.state = 'running'; return Promise.resolve(); }
      }

      const origCtx = window.AudioContext;
      try {
        window.AudioContext = MockContext;
        AudioEngine.ctx = null;
        AudioEngine.initContext();
        AudioEngine.ctx.state = 'suspended';
        AudioEngine.attachGestureUnlock();

        const evt = new Event(evtName, { bubbles: true });
        window.dispatchEvent(evt);

        await new Promise(r => setTimeout(r, 10));
        assert.ok(resumed, `Gesture event '${evtName}' successfully resumed context`);
      } finally {
        window.AudioContext = origCtx;
      }
    }
  });

  runTest('R4.2: CORS anonymous handling & blob: protection', () => {
    const origCtx = window.AudioContext;
    class MockContext {
      constructor() { this.state = 'running'; this.destination = {}; }
      createMediaElementSource() { return { connect() {}, disconnect() {} }; }
      createGain() { return { gain: { value: 1.0 }, connect() {}, disconnect() {} }; }
      createBiquadFilter() { return { type: 'peaking', frequency: { value: 1000 }, Q: { value: 1.414 }, gain: { value: 0 }, connect() {}, disconnect() {} }; }
      createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, connect() {}, disconnect() {} }; }
    }

    try {
      window.AudioContext = MockContext;
      AudioEngine.ctx = null;

      // Regular video URL
      const regVideo = document.createElement('video');
      regVideo.src = 'https://r1---sn-example.googlevideo.com/videoplayback?id=123';
      AudioEngine.attachToVideo(regVideo);
      assert.strictEqual(regVideo.getAttribute('crossorigin'), 'anonymous', 'crossorigin attribute set on standard video');
      assert.strictEqual(regVideo.crossOrigin, 'anonymous', 'crossOrigin property set on standard video');

      // Blob URL
      const blobVideo = document.createElement('video');
      blobVideo.src = 'blob:https://www.youtube.com/abc-123';
      AudioEngine.attachToVideo(blobVideo);
      assert.strictEqual(blobVideo.hasAttribute('crossorigin'), false, 'crossorigin attribute NOT set on blob URL');
    } finally {
      window.AudioContext = origCtx;
    }
  });

  runTest('R4.3: WeakMap videoSourceCache node caching guarantees idempotency', () => {
    let sourceNodeCreations = 0;
    class MockContext {
      constructor() { this.state = 'running'; this.destination = {}; }
      createMediaElementSource() { sourceNodeCreations++; return { connect() {}, disconnect() {} }; }
      createGain() { return { gain: { value: 1.0 }, connect() {}, disconnect() {} }; }
      createBiquadFilter() { return { type: 'peaking', frequency: { value: 1000 }, Q: { value: 1.414 }, gain: { value: 0 }, connect() {}, disconnect() {} }; }
      createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, connect() {}, disconnect() {} }; }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockContext;
      AudioEngine.ctx = null;
      AudioEngine.videoSourceCache = new WeakMap();

      const video = document.createElement('video');
      video.src = 'https://www.youtube.com/watch?v=cache_test';

      AudioEngine.attachToVideo(video);
      assert.strictEqual(sourceNodeCreations, 1, 'First attach creates MediaElementSource');
      assert.ok(AudioEngine.videoSourceCache.has(video), 'WeakMap contains video key');

      AudioEngine.attachToVideo(video);
      assert.strictEqual(sourceNodeCreations, 1, 'Second attach on same video reuses cached node');
    } finally {
      window.AudioContext = origCtx;
    }
  });

  runTest('R4.4: Full AudioEngine & VolumeBooster teardown disconnects all graph nodes & cleans state', () => {
    let disconnectedCount = 0;
    class MockNode {
      connect() {}
      disconnect() { disconnectedCount++; }
    }
    class MockContext {
      constructor() { this.state = 'running'; this.destination = {}; }
      createMediaElementSource() { return new MockNode(); }
      createGain() { return { gain: { value: 1.0 }, connect() {}, disconnect() { disconnectedCount++; } }; }
      createBiquadFilter() { return { type: 'peaking', frequency: { value: 1000 }, Q: { value: 1.414 }, gain: { value: 0 }, connect() {}, disconnect() { disconnectedCount++; } }; }
      createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, frequencyBinCount: 64, getByteFrequencyData() {}, connect() {}, disconnect() { disconnectedCount++; } }; }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockContext;
      AudioEngine.ctx = null;
      AudioEngine.sourceNode = null;
      AudioEngine.bassNode = null;
      AudioEngine.gainNode = null;
      AudioEngine.eqNodes = [];
      AudioEngine.analyserNode = null;

      const video = document.createElement('video');
      AudioEngine.attachToVideo(video);
      assert.strictEqual(AudioEngine.eqNodes.length, 10);

      AudioEngine.teardown();
      assert.strictEqual(AudioEngine.sourceNode, null, 'sourceNode nulled');
      assert.strictEqual(AudioEngine.bassNode, null, 'bassNode nulled');
      assert.strictEqual(AudioEngine.gainNode, null, 'gainNode nulled');
      assert.strictEqual(AudioEngine.eqNodes.length, 0, 'eqNodes cleared');
      assert.strictEqual(AudioEngine.analyserNode, null, 'analyserNode nulled');
      assert.ok(disconnectedCount >= 12, `At least 12 nodes disconnected (disconnected: ${disconnectedCount})`);
    } finally {
      window.AudioContext = origCtx;
    }
  });

  console.log('\n================================================================');
  console.log('                 INDEPENDENT AUDIT SUMMARY                      ');
  console.log('================================================================');
  console.log(`  Total Independent Checks : ${testsPassed + testsFailed}`);
  console.log(`  Passed                   : ${testsPassed}`);
  console.log(`  Failed                   : ${testsFailed}`);
  console.log('================================================================');

  if (testsFailed > 0) {
    console.error('\n❌ INDEPENDENT AUDIT FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ INDEPENDENT AUDIT VERDICT: 100% CLEAN & VERIFIED');
    process.exit(0);
  }
}

runIndependentAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
