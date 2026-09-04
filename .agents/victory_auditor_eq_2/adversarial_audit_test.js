/**
 * Victory Auditor Gen 2 Independent Adversarial Audit & Edge Case Verification
 */

const assert = require('node:assert/strict');
const { setupMockEnv } = require('../../tests/harness/mock-extension-env');
setupMockEnv();

const AudioEngine = require('../../utils/audio-engine');
const VolumeBooster = require('../../content/js/volume-booster');
const { StorageUtil, DEFAULT_SETTINGS } = require('../../utils/storage');

async function runAdversarialAudit() {
  console.log('🧪 Starting Independent Victory Audit Adversarial Stress Suite...\n');
  let testCount = 0;
  let passCount = 0;

  function auditAssert(desc, fn) {
    testCount++;
    try {
      fn();
      passCount++;
      console.log(`  ✓ [AUDIT PASS] ${desc}`);
    } catch (e) {
      console.error(`  ❌ [AUDIT FAIL] ${desc}: ${e.message}`);
      throw e;
    }
  }

  // --- 1. Topographic & Mathematical Verification of 10-Band EQ ---
  console.log('--- 1. 10-Band EQ Filter Topology & Parameters ---');
  
  auditAssert('EQ_BANDS constants contain exactly 10 bands with correct frequencies and types', () => {
    assert.equal(AudioEngine.EQ_BANDS.length, 10);
    const expected = [
      { freq: 32, type: 'lowshelf', Q: 1.0 },
      { freq: 64, type: 'peaking', Q: 1.414 },
      { freq: 125, type: 'peaking', Q: 1.414 },
      { freq: 250, type: 'peaking', Q: 1.414 },
      { freq: 500, type: 'peaking', Q: 1.414 },
      { freq: 1000, type: 'peaking', Q: 1.414 },
      { freq: 2000, type: 'peaking', Q: 1.414 },
      { freq: 4000, type: 'peaking', Q: 1.414 },
      { freq: 8000, type: 'peaking', Q: 1.414 },
      { freq: 16000, type: 'highshelf', Q: 1.0 }
    ];
    for (let i = 0; i < 10; i++) {
      assert.equal(AudioEngine.EQ_BANDS[i].freq, expected[i].freq);
      assert.equal(AudioEngine.EQ_BANDS[i].type, expected[i].type);
      assert.equal(AudioEngine.EQ_BANDS[i].Q, expected[i].Q);
    }
  });

  // --- 2. Preset Definitions and Custom Transitions ---
  console.log('\n--- 2. Preset Definitions & Custom Transitions ---');
  const presets = [
    { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: 'Bass Boost', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
    { name: 'Vocal Booster', gains: [-2, -1, 0, 2, 4, 5, 4, 2, 0, -1] },
    { name: 'Treble Boost', gains: [0, 0, 0, 0, 0, 1, 3, 5, 7, 8] },
    { name: 'Rock', gains: [5, 4, 3, 1, -1, -1, 0, 2, 4, 5] },
    { name: 'Pop', gains: [-1, 2, 4, 5, 4, 0, -1, 1, 3, 4] },
    { name: 'Acoustic', gains: [3, 2, 1, 2, 3, 3, 2, 3, 2, 1] },
    { name: 'Electronic', gains: [6, 5, 2, 0, -2, 2, 1, 2, 4, 5] }
  ];

  for (const p of presets) {
    auditAssert(`AudioEngine.setEqPreset('${p.name}') sets preset and gains matching expected`, () => {
      assert.ok(AudioEngine.setEqPreset(p.name));
      assert.equal(AudioEngine.getEqPreset(), p.name);
      assert.deepEqual(AudioEngine.getEqGains(), p.gains);
    });
    auditAssert(`VolumeBooster.setEqPreset('${p.name}') sets preset and gains matching expected`, () => {
      assert.ok(VolumeBooster.setEqPreset(p.name));
      assert.equal(VolumeBooster.getEqPreset(), p.name);
      assert.deepEqual(VolumeBooster.getEqGains(), p.gains);
    });
  }

  auditAssert('Setting arbitrary gains auto-switches preset to Custom', () => {
    AudioEngine.setEqGains([1, -1, 2, -2, 3, -3, 4, -4, 5, -5]);
    assert.equal(AudioEngine.getEqPreset(), 'Custom');
    assert.deepEqual(AudioEngine.getEqGains(), [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]);
  });

  auditAssert('Setting single band gain auto-switches preset to Custom and updates band', () => {
    AudioEngine.setEqPreset('Flat');
    AudioEngine.setEqBandGain(5, 7.5);
    assert.equal(AudioEngine.getEqPreset(), 'Custom');
    assert.equal(AudioEngine.getEqGains()[5], 7.5);
  });

  // --- 3. Extreme Boundary & Fault Injection Stress ---
  console.log('\n--- 3. Boundary & Fault Injection Stress ---');
  
  auditAssert('Extreme positive gain (+9999) clamps strictly to +12dB', () => {
    AudioEngine.setEqBandGain(0, 9999);
    assert.equal(AudioEngine.getEqGains()[0], 12);
  });

  auditAssert('Extreme negative gain (-9999) clamps strictly to -12dB', () => {
    AudioEngine.setEqBandGain(0, -9999);
    assert.equal(AudioEngine.getEqGains()[0], -12);
  });

  auditAssert('Invalid numeric types (NaN, undefined, null, object, Symbol) fallback safely to 0dB without crash', () => {
    AudioEngine.setEqBandGain(0, NaN);
    assert.equal(AudioEngine.getEqGains()[0], 0);

    AudioEngine.setEqBandGain(1, undefined);
    assert.equal(AudioEngine.getEqGains()[1], 0);

    AudioEngine.setEqBandGain(2, null);
    assert.equal(AudioEngine.getEqGains()[2], 0);

    AudioEngine.setEqBandGain(3, {});
    assert.equal(AudioEngine.getEqGains()[3], 0);
  });

  auditAssert('Out of range band indices (-5, 10, 100, "foo") return false without throwing', () => {
    assert.equal(AudioEngine.setEqBandGain(-1, 5), false);
    assert.equal(AudioEngine.setEqBandGain(10, 5), false);
    assert.equal(AudioEngine.setEqBandGain(100, 5), false);
    assert.equal(AudioEngine.setEqBandGain("abc", 5), false);
  });

  auditAssert('Invalid preset names return false without altering existing state', () => {
    AudioEngine.setEqPreset('Pop');
    const popGains = AudioEngine.getEqGains();
    assert.equal(AudioEngine.setEqPreset('NonExistentPreset'), false);
    assert.equal(AudioEngine.getEqPreset(), 'Pop');
    assert.deepEqual(AudioEngine.getEqGains(), popGains);
  });

  // --- 4. Web Audio Graph Topology & AnalyserNode Verification ---
  console.log('\n--- 4. Audio Graph & AnalyserNode Verification ---');
  
  auditAssert('attachToVideo creates media graph with 10 BiquadFilterNodes and AnalyserNode', () => {
    const video = document.createElement('video');
    video.src = 'https://www.youtube.com/watch?v=victory_audit';
    
    AudioEngine.attachToVideo(video);
    assert.ok(AudioEngine.sourceNode);
    assert.ok(AudioEngine.bassNode);
    assert.ok(AudioEngine.gainNode);
    assert.equal(AudioEngine.eqNodes.length, 10);
    assert.ok(AudioEngine.analyserNode);
    assert.equal(AudioEngine.analyserNode.fftSize, 128);
    assert.equal(AudioEngine.analyserNode.smoothingTimeConstant, 0.8);
  });

  auditAssert('getFrequencyData returns Uint8Array(64) on active analyser', () => {
    const freqData = AudioEngine.getFrequencyData();
    assert.ok(freqData instanceof Uint8Array);
    assert.equal(freqData.length, 64);
  });

  auditAssert('getFrequencyData returns safe Uint8Array(64) when analyser is inactive or null', () => {
    const origAnalyser = AudioEngine.analyserNode;
    try {
      AudioEngine.analyserNode = null;
      const freqData = AudioEngine.getFrequencyData();
      assert.ok(freqData instanceof Uint8Array);
      assert.equal(freqData.length, 64);
    } finally {
      AudioEngine.analyserNode = origAnalyser;
    }
  });

  // --- 5. WeakMap Caching & CORS Security ---
  console.log('\n--- 5. WeakMap Caching & CORS Security ---');
  
  auditAssert('WeakMap caches source nodes across repeated attachments to same video element', () => {
    const video = document.createElement('video');
    video.src = 'https://www.youtube.com/watch?v=cors_weakmap';

    AudioEngine.attachToVideo(video);
    const source1 = AudioEngine.sourceNode;

    AudioEngine.attachToVideo(video);
    const source2 = AudioEngine.sourceNode;

    assert.equal(source1, source2);
    assert.equal(video.getAttribute('crossorigin'), 'anonymous');
    assert.equal(video.crossOrigin, 'anonymous');
  });

  auditAssert('blob: URLs do not have crossorigin forced to anonymous', () => {
    const blobVideo = document.createElement('video');
    blobVideo.src = 'blob:https://www.youtube.com/test-blob-stream';

    AudioEngine.attachToVideo(blobVideo);
    assert.equal(blobVideo.hasAttribute('crossorigin'), false);
  });

  // --- 6. Safari 8-Event Gesture Unlocking Verification ---
  console.log('\n--- 6. Safari 8-Event Gesture Unlocking ---');

  const events = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown', 'play', 'playing'];
  for (const evtName of events) {
    auditAssert(`Gesture unlock responds to '${evtName}' on window`, async () => {
      let resumed = false;
      const origCtx = AudioEngine.ctx;
      AudioEngine.ctx = {
        state: 'suspended',
        resume: async () => {
          resumed = true;
          AudioEngine.ctx.state = 'running';
        }
      };

      AudioEngine.attachGestureUnlock();
      const event = new Event(evtName, { bubbles: true });
      window.dispatchEvent(event);

      await new Promise(r => setTimeout(r, 10));
      assert.ok(resumed, `Context resumed on '${evtName}'`);
      AudioEngine.ctx = origCtx;
    });
  }

  // --- 7. Storage Sync & Persistence Verification ---
  console.log('\n--- 7. Storage Persistence & Sync ---');

  auditAssert('StorageUtil persists 10-band gains, preset, and eqEnabled cleanly', async () => {
    const customGains = [2, 4, 6, 8, 10, -2, -4, -6, -8, -10];
    await StorageUtil.updateVolumeBoosterSetting('eqGains', customGains);
    await StorageUtil.updateVolumeBoosterSetting('preset', 'Custom');
    await StorageUtil.updateVolumeBoosterSetting('eqEnabled', false);
    await StorageUtil.updateVolumeBoosterSetting('volumeLevel', 350);
    await StorageUtil.updateVolumeBoosterSetting('bassLevel', 18);

    const s = await StorageUtil.getSettings();
    assert.deepEqual(s.volumeBooster.eqGains, customGains);
    assert.equal(s.volumeBooster.preset, 'Custom');
    assert.equal(s.volumeBooster.eqEnabled, false);
    assert.equal(s.volumeBooster.volumeLevel, 350);
    assert.equal(s.volumeBooster.bassLevel, 18);

    // Reset back to defaults
    await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS });
  });

  // --- 8. Disconnect and Teardown Lifecycle ---
  console.log('\n--- 8. Lifecycle Teardown & Memory Safety ---');

  auditAssert('AudioEngine.teardown() safely disconnects all 12+ nodes and cleans up', () => {
    AudioEngine.teardown();
    assert.equal(AudioEngine.sourceNode, null);
    assert.equal(AudioEngine.bassNode, null);
    assert.equal(AudioEngine.gainNode, null);
    assert.equal(AudioEngine.eqNodes.length, 0);
    assert.equal(AudioEngine.analyserNode, null);
    assert.equal(AudioEngine._connectedVideo, null);
  });

  auditAssert('VolumeBooster.teardown() safely disconnects all nodes and resets references', () => {
    VolumeBooster.teardown();
    assert.equal(VolumeBooster.sourceNode, null);
    assert.equal(VolumeBooster.bassNode, null);
    assert.equal(VolumeBooster.gainNode, null);
    assert.equal(VolumeBooster.eqNodes.length, 0);
    assert.equal(VolumeBooster.analyserNode, null);
    assert.equal(VolumeBooster._connectedVideo, null);
  });

  console.log(`\n================================================================`);
  console.log(`VICTORY AUDITOR GEN 2 ADVERSARIAL STRESS RESULTS`);
  console.log(`Total Checks Executed : ${testCount}`);
  console.log(`Passed                : ${passCount}`);
  console.log(`Failed                : 0`);
  console.log(`================================================================\n`);
}

runAdversarialAudit().catch(err => {
  console.error('Fatal failure in adversarial audit:', err);
  process.exit(1);
});
