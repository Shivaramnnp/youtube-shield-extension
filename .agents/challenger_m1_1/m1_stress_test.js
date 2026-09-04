/**
 * Empirical Stress Test Suite for Milestone M1 (Safari Web Audio API Fix)
 * Tests:
 * 1. Extreme/invalid volume inputs (AudioEngine & VolumeBooster)
 * 2. Extreme/invalid bass inputs (AudioEngine & VolumeBooster)
 * 3. Rapid video element re-attachment and simulated YouTube SPA navigations
 * 4. AudioContext state transitions and WebKit exception handling
 */

const { setupMockEnv } = require('../../tests/harness/mock-extension-env');
setupMockEnv();
const assert = require('assert');

// Mock AudioContext implementation for fine-grained control
let mediaElementSourceCalls = 0;
let failCreateMediaSource = false;

class MockGainNode {
  constructor() { this.gain = { value: 1.0 }; }
  connect() {}
  disconnect() {}
}

class MockBiquadFilterNode {
  constructor() {
    this.type = 'lowshelf';
    this.frequency = { value: 150 };
    this.gain = { value: 0 };
  }
  connect() {}
  disconnect() {}
}

class MockMediaElementSourceNode {
  constructor(videoEl) {
    this.mediaElement = videoEl;
  }
  connect() {}
  disconnect() {}
}

class MockAudioContext {
  constructor() {
    this.state = 'suspended';
    this.destination = {};
    this.currentTime = 0;
    this.onstatechange = null;
  }
  resume() {
    this.state = 'running';
    if (typeof this.onstatechange === 'function') {
      try { this.onstatechange(); } catch (e) {}
    }
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    if (typeof this.onstatechange === 'function') {
      try { this.onstatechange(); } catch (e) {}
    }
    return Promise.resolve();
  }
  createMediaElementSource(videoEl) {
    mediaElementSourceCalls++;
    if (failCreateMediaSource) {
      const err = new Error("InvalidStateError: HTMLMediaElement already connected to an audio source");
      err.name = "InvalidStateError";
      throw err;
    }
    return new MockMediaElementSourceNode(videoEl);
  }
  createBiquadFilter() { return new MockBiquadFilterNode(); }
  createGain() { return new MockGainNode(); }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: () => {} },
      connect: () => {},
      disconnect: () => {},
      start: () => {},
      stop: () => {},
      onended: null
    };
  }
}

window.AudioContext = MockAudioContext;
window.webkitAudioContext = MockAudioContext;

const AudioEngine = require('../../utils/audio-engine');
const VolumeBooster = require('../../content/js/volume-booster');

const results = {
  passed: 0,
  failed: 0,
  failures: []
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.failed++;
    results.failures.push({ name, error: err.message, stack: err.stack });
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

console.log('=== STRESS TEST SUITE: Milestone M1 (Safari Web Audio API) ===\n');

console.log('--- Category 1: Volume Input Validation & Extreme Stress Testing ---');

test('AudioEngine.setVolume handling of extreme and invalid inputs', () => {
  AudioEngine.initContext();
  const video = document.createElement('video');
  AudioEngine.attachToVideo(video);
  
  const testCases = [
    { input: -100, expectedGainMin: 0, expectedGainMax: 0, desc: 'negative volume (-100)' },
    { input: -1, expectedGainMin: 0, expectedGainMax: 0, desc: 'negative volume (-1)' },
    { input: -0.5, expectedGainMin: 0, expectedGainMax: 0, desc: 'negative multiplier (-0.5)' },
    { input: 0, expectedGainMin: 0, expectedGainMax: 0, desc: 'zero volume (0)' },
    { input: '0', expectedGainMin: 0, expectedGainMax: 0, desc: 'zero string ("0")' },
    { input: 0.5, expectedGainMin: 0.5, expectedGainMax: 0.5, desc: 'multiplier 0.5 (50%)' },
    { input: 1.0, expectedGainMin: 1.0, expectedGainMax: 1.0, desc: 'multiplier 1.0 (100%)' },
    { input: 2.0, expectedGainMin: 2.0, expectedGainMax: 2.0, desc: 'multiplier 2.0 (200%)' },
    { input: 6.0, expectedGainMin: 6.0, expectedGainMax: 6.0, desc: 'multiplier 6.0 (600%)' },
    { input: 100, expectedGainMin: 1.0, expectedGainMax: 1.0, desc: 'percent 100 (100%)' },
    { input: 200, expectedGainMin: 2.0, expectedGainMax: 2.0, desc: 'percent 200 (200%)' },
    { input: 600, expectedGainMin: 6.0, expectedGainMax: 6.0, desc: 'percent 600 (600%)' },
    { input: 99999, expectedGainMin: 6.0, expectedGainMax: 6.0, desc: 'extreme high percent (99999)' },
    { input: Infinity, expectedGainMin: 6.0, expectedGainMax: 6.0, desc: 'Infinity' },
    { input: -Infinity, expectedGainMin: 0, expectedGainMax: 0, desc: '-Infinity' },
    { input: NaN, expectedGainMin: 1.0, expectedGainMax: 1.0, desc: 'NaN (fallback to default 100%)' },
    { input: null, expectedGainMin: 0, expectedGainMax: 0, desc: 'null (evaluates to Number(null)=0)' },
    { input: undefined, expectedGainMin: 1.0, expectedGainMax: 1.0, desc: 'undefined (fallback to default 100%)' },
    { input: 'invalid_string', expectedGainMin: 1.0, expectedGainMax: 1.0, desc: 'string "invalid_string"' },
    { input: '250', expectedGainMin: 2.5, expectedGainMax: 2.5, desc: 'string "250"' },
    { input: '', expectedGainMin: 0, expectedGainMax: 0, desc: 'empty string ""' }
  ];

  for (const tc of testCases) {
    AudioEngine.setVolume(tc.input);
    const gainVal = AudioEngine.gainNode ? AudioEngine.gainNode.gain.value : null;
    assert.notStrictEqual(gainVal, NaN, `Gain node value for ${tc.desc} should not be NaN`);
    assert.strictEqual(typeof gainVal, 'number', `Gain node value for ${tc.desc} should be a number`);
    assert.ok(gainVal >= tc.expectedGainMin && gainVal <= tc.expectedGainMax,
      `Gain node value for ${tc.desc} was ${gainVal}, expected between ${tc.expectedGainMin} and ${tc.expectedGainMax}`);
  }
});

test('Remediated Bug 2: AudioEngine.setVolume(6.1) multiplier boundary clamping', () => {
  AudioEngine.initContext();
  const video = document.createElement('video');
  AudioEngine.attachToVideo(video);

  // Calling setVolume with 6.1 (raw multiplier slightly above 6.0)
  AudioEngine.setVolume(6.1);
  const gainVal = AudioEngine.gainNode.gain.value;
  console.log(`    Note: setVolume(6.1) resulted in gainNode.gain.value = ${gainVal}`);
  
  assert.strictEqual(gainVal, 6.0, `AudioEngine.setVolume(6.1) should clamp gain to 6.0 (600%), got ${gainVal}`);
});

test('VolumeBooster.setVolume handling of extreme and invalid inputs', () => {
  const testCases = [
    { input: 0, desc: 'VolumeBooster 0%' },
    { input: -50, desc: 'VolumeBooster -50%' },
    { input: 200, desc: 'VolumeBooster 200%' },
    { input: 99999, desc: 'VolumeBooster 99999%' },
    { input: NaN, desc: 'VolumeBooster NaN' },
    { input: null, desc: 'VolumeBooster null' },
    { input: undefined, desc: 'VolumeBooster undefined' },
    { input: '300', desc: 'VolumeBooster "300"' },
    { input: Infinity, desc: 'VolumeBooster Infinity' }
  ];

  for (const tc of testCases) {
    VolumeBooster.setVolume(tc.input);
    const level = VolumeBooster.getVolume();
    assert.strictEqual(typeof level, 'number', `Volume level for ${tc.desc} should be a number`);
    assert.ok(!isNaN(level), `Volume level for ${tc.desc} should not be NaN`);
    assert.ok(level >= 0 && level <= 600, `Volume level for ${tc.desc} should be clamped between 0 and 600, got ${level}`);
  }
});

test('Remediated Bug 1: Check VolumeBooster setVolume(0) zero muting', () => {
  VolumeBooster.setVolume(0);
  const vol = VolumeBooster.getVolume();
  console.log(`    Note: VolumeBooster.setVolume(0) returned volume level = ${vol}`);
  assert.strictEqual(vol, 0, `VolumeBooster.setVolume(0) should set volume level to 0%, got ${vol}%`);
});

console.log('\n--- Category 2: Bass Input Validation & Extreme Stress Testing ---');

test('AudioEngine.setBass handling of extreme and invalid inputs', () => {
  AudioEngine.initContext();
  const video = document.createElement('video');
  AudioEngine.attachToVideo(video);

  const testCases = [
    { input: -10, expectedBassMin: 0, expectedBassMax: 0, desc: 'negative bass (-10)' },
    { input: 0, expectedBassMin: 0, expectedBassMax: 0, desc: 'zero bass (0dB)' },
    { input: 10, expectedBassMin: 10, expectedBassMax: 10, desc: '10dB bass' },
    { input: 20, expectedBassMin: 20, expectedBassMax: 20, desc: '20dB bass' },
    { input: 30, expectedBassMin: 20, expectedBassMax: 20, desc: '30dB bass (clamped to 20dB)' },
    { input: 99999, expectedBassMin: 20, expectedBassMax: 20, desc: '99999dB bass' },
    { input: Infinity, expectedBassMin: 20, expectedBassMax: 20, desc: 'Infinity dB bass' },
    { input: NaN, expectedBassMin: 0, expectedBassMax: 0, desc: 'NaN dB bass' },
    { input: null, expectedBassMin: 0, expectedBassMax: 0, desc: 'null dB bass' },
    { input: undefined, expectedBassMin: 0, expectedBassMax: 0, desc: 'undefined dB bass' },
    { input: '15', expectedBassMin: 15, expectedBassMax: 15, desc: 'string "15"' },
    { input: 'invalid', expectedBassMin: 0, expectedBassMax: 0, desc: 'string "invalid"' }
  ];

  for (const tc of testCases) {
    AudioEngine.setBass(tc.input);
    const bassGain = AudioEngine.bassNode ? AudioEngine.bassNode.gain.value : null;
    assert.notStrictEqual(bassGain, NaN, `Bass node value for ${tc.desc} should not be NaN`);
    assert.strictEqual(typeof bassGain, 'number', `Bass node value for ${tc.desc} should be a number`);
    assert.ok(bassGain >= tc.expectedBassMin && bassGain <= tc.expectedBassMax,
      `Bass node value for ${tc.desc} was ${bassGain}, expected between ${tc.expectedBassMin} and ${tc.expectedBassMax}`);
  }
});

test('VolumeBooster.setBass handling of extreme and invalid inputs', () => {
  const testCases = [
    { input: -5, desc: 'VolumeBooster -5dB' },
    { input: 0, desc: 'VolumeBooster 0dB' },
    { input: 12, desc: 'VolumeBooster 12dB' },
    { input: 25, desc: 'VolumeBooster 25dB' },
    { input: NaN, desc: 'VolumeBooster NaN' },
    { input: null, desc: 'VolumeBooster null' },
    { input: undefined, desc: 'VolumeBooster undefined' },
    { input: '18', desc: 'VolumeBooster "18"' },
    { input: Infinity, desc: 'VolumeBooster Infinity' }
  ];

  for (const tc of testCases) {
    VolumeBooster.setBass(tc.input);
    const bass = VolumeBooster.getBass();
    assert.strictEqual(typeof bass, 'number', `Bass level for ${tc.desc} should be a number`);
    assert.ok(!isNaN(bass), `Bass level for ${tc.desc} should not be NaN`);
    assert.ok(bass >= 0 && bass <= 20, `Bass level for ${tc.desc} should be clamped between 0 and 20, got ${bass}`);
  }
});

console.log('\n--- Category 3: Rapid Re-attachment & YouTube SPA Navigations ---');

test('Rapid attachToVideo calls on identical video element (1000 iterations)', () => {
  const video = document.createElement('video');
  video.src = 'https://www.youtube.com/watch?v=rapid1';
  
  const initialCallCount = mediaElementSourceCalls;
  for (let i = 0; i < 1000; i++) {
    const res = AudioEngine.attachToVideo(video);
    assert.strictEqual(res, true, `Iter ${i}: attachToVideo should return true`);
  }
  const callsMade = mediaElementSourceCalls - initialCallCount;
  assert.ok(callsMade <= 1, `createMediaElementSource should be called at most once due to WeakMap caching, was called ${callsMade} times`);
});

test('Rapid attachToVideo calls across 100 distinct video elements (YouTube SPA navigation simulation)', () => {
  const videos = [];
  for (let i = 0; i < 100; i++) {
    const v = document.createElement('video');
    v.className = 'html5-main-video';
    v.src = `https://www.youtube.com/watch?v=video_${i}`;
    videos.push(v);
  }

  for (let i = 0; i < 100; i++) {
    if (i > 0) {
      videos[i - 1].remove();
    }
    document.body.appendChild(videos[i]);
    AudioEngine.attachToVideo(videos[i]);
    VolumeBooster.connect();
  }

  assert.strictEqual(AudioEngine._connectedVideo, videos[99], 'Connected video should be the latest active video element');
});

test('Fallback when createMediaElementSource throws InvalidStateError on WebKit/Safari', () => {
  failCreateMediaSource = true;
  const video = document.createElement('video');
  video.src = 'https://www.youtube.com/watch?v=error_video';

  let threw = false;
  try {
    const res = AudioEngine.attachToVideo(video);
    assert.strictEqual(res, true, 'attachToVideo should catch internal InvalidStateError and return true without throwing');
  } catch (e) {
    threw = true;
  }
  failCreateMediaSource = false;
  assert.strictEqual(threw, false, 'attachToVideo should never throw unhandled exception to caller on WebKit error');
});

console.log('\n--- Category 4: Safari Web Audio API Gesture Unlock & Lifecycle ---');

test('Multi-event gesture unlock registration and un-suspension lifecycle', async () => {
  AudioEngine.ctx = new MockAudioContext();
  AudioEngine.ctx.state = 'suspended';

  AudioEngine.attachGestureUnlock();

  assert.strictEqual(AudioEngine.ctx.state, 'suspended', 'Context starts suspended');

  // Trigger unlock
  await AudioEngine.unlock();
  assert.strictEqual(AudioEngine.ctx.state, 'running', 'Context transitions to running after unlock()');
});

test('Null and undefined video element robustness', () => {
  assert.doesNotThrow(() => {
    AudioEngine.attachToVideo(null);
    AudioEngine.attachToVideo(undefined);
    AudioEngine.attachToVideo({});
  }, 'attachToVideo handles non-DOM element targets gracefully');
});

console.log('\n===============================================================');
console.log(`RESULTS: ${results.passed} Passed, ${results.failed} Failed`);
if (results.failures.length > 0) {
  console.log('\nFailures:');
  results.failures.forEach(f => console.log(`- ${f.name}: ${f.error}`));
}
console.log('===============================================================\n');

process.exit(results.failed > 0 ? 1 : 0);
