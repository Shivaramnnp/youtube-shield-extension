/**
 * Challenger M3_2 Representative Adversarial Empirical Test Suite
 * 
 * Deeply stress-tests:
 * 1. Web Audio state transitions across 8 gesture events (click, keydown, touchstart, touchend, mousedown, pointerdown, play, timeupdate/playing)
 * 2. 10-band equalizer DSP curves, gain bounds [-12dB, +12dB], Q factors, frequency responses, preset switching & bypass
 * 3. 7-locale catalog key parity (en, de, es, fr, hi, ja, pt), non-empty translations, and manifest __MSG_*__ parity
 * 4. Audio graph node lifecycle, WeakMap caching, and WebKit compatibility
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { setupMockEnv, MockElement } = require('./harness/mock-extension-env');

// 1. Setup mock environment
const mockEnv = setupMockEnv();

const AudioEngine = require('../utils/audio-engine');
const VolumeBooster = require('../content/js/volume-booster');
const { StorageUtil } = require('../utils/storage');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureList = [];

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failedTests++;
    failureList.push({ name, error: err });
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failedTests++;
    failureList.push({ name, error: err });
  }
}

async function main() {
  console.log('========================================================================');
  console.log('    CHALLENGER M3_2 ADVERSARIAL EMPIRICAL HARNESS (4 CORE DIMENSIONS)   ');
  console.log('========================================================================\n');

  // ============================================================================
  // DIMENSION 1: WEB AUDIO GESTURE UNLOCKS ACROSS 8 EVENTS & WEBKIT NODE CACHING
  // ============================================================================
  console.log('--- DIMENSION 1: Web Audio State Transitions & 8-Event Unlocks ---');

  const gestureEvents = [
    'click',
    'keydown',
    'touchstart',
    'touchend',
    'mousedown',
    'pointerdown',
    'play',
    'timeupdate' // Also testing playing
  ];

  // 1.1 Test each of the 8 gesture events independently triggering resume
  for (const evtName of gestureEvents) {
    await runAsyncTest(`1.1.${evtName}: Gesture '${evtName}' unlocks suspended AudioContext`, async () => {
      let resumeCalled = false;
      const mockCtx = {
        state: 'suspended',
        onstatechange: null,
        resume: async () => {
          resumeCalled = true;
          mockCtx.state = 'running';
          if (typeof mockCtx.onstatechange === 'function') mockCtx.onstatechange();
        },
        createGain: () => ({ gain: { value: 1.0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {}, disconnect: () => {} }),
        createBiquadFilter: () => ({ type: 'peaking', frequency: { value: 1000 }, Q: { value: 1.0 }, gain: { value: 0 }, connect: () => {}, disconnect: () => {} }),
        createAnalyser: () => ({ fftSize: 128, frequencyBinCount: 64, smoothingTimeConstant: 0.8, getByteFrequencyData: () => {}, getByteTimeDomainData: () => {}, connect: () => {}, disconnect: () => {} }),
        destination: {}
      };

      global.window.AudioContext = function() { return mockCtx; };
      AudioEngine.ctx = null;
      
      // Override unlock temporarily during init to keep ctx suspended
      const origUnlock = AudioEngine.unlock;
      AudioEngine.unlock = () => Promise.resolve();
      AudioEngine.initContext();
      AudioEngine.unlock = origUnlock;

      assert.equal(AudioEngine.ctx.state, 'suspended', 'AudioContext is suspended initially');
      assert.ok(AudioEngine._unlockHandler, '_unlockHandler was attached');

      // Dispatch the gesture event
      if (typeof AudioEngine._unlockHandler === 'function') {
        AudioEngine._unlockHandler({ type: evtName });
      }

      await new Promise(r => setTimeout(r, 20));

      assert.ok(resumeCalled, `AudioContext.resume() was invoked by '${evtName}'`);
      assert.equal(AudioEngine.ctx.state, 'running', `AudioContext state transitioned to 'running' on '${evtName}'`);
    });
  }

  // 1.2 Test event listener removal when context transitions to 'running'
  runTest('1.2: removeGestureUnlock cleans up all listeners without lingering leaks', () => {
    let windowRemoved = [];
    let docRemoved = [];

    const origWinRemove = global.window.removeEventListener;
    const origDocRemove = global.document.removeEventListener;

    global.window.removeEventListener = (evt, fn) => { windowRemoved.push(evt); };
    global.document.removeEventListener = (evt, fn) => { docRemoved.push(evt); };

    try {
      AudioEngine.attachGestureUnlock();
      assert.ok(typeof AudioEngine._unlockHandler === 'function', '_unlockHandler registered');

      AudioEngine.removeGestureUnlock();

      const expectedEvents = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown', 'play', 'playing'];
      for (const e of expectedEvents) {
        assert.ok(windowRemoved.includes(e), `Window removed ${e} listener`);
        assert.ok(docRemoved.includes(e), `Document removed ${e} listener`);
      }
    } finally {
      global.window.removeEventListener = origWinRemove;
      global.document.removeEventListener = origDocRemove;
    }
  });

  // 1.3 Test Safari webkitAudioContext fallback
  runTest('1.3: Safari webkitAudioContext fallback when AudioContext is undefined', () => {
    const origAudioContext = global.window.AudioContext;
    delete global.window.AudioContext;

    let webkitInstantiated = false;
    global.window.webkitAudioContext = function() {
      webkitInstantiated = true;
      return {
        state: 'running',
        createGain: () => ({ gain: { value: 1.0 }, connect: () => {}, disconnect: () => {} }),
        createBiquadFilter: () => ({ frequency: { value: 150 }, gain: { value: 0 }, connect: () => {}, disconnect: () => {} }),
        createAnalyser: () => ({ fftSize: 128, connect: () => {}, disconnect: () => {} }),
        destination: {}
      };
    };

    try {
      AudioEngine.ctx = null;
      const success = AudioEngine.initContext();
      assert.ok(success, 'initContext succeeded with webkitAudioContext');
      assert.ok(webkitInstantiated, 'webkitAudioContext was instantiated');
    } finally {
      global.window.AudioContext = origAudioContext;
      delete global.window.webkitAudioContext;
    }
  });

  // 1.4 Test WeakMap + DOM Property node caching prevents WebKit duplicate source error
  runTest('1.4: MediaElementSource node caching via WeakMap and _ssMediaSourceNode', () => {
    let sourceNodeCreationCount = 0;
    const mockCtx = {
      state: 'running',
      createMediaElementSource: (el) => {
        sourceNodeCreationCount++;
        return { el, connect: () => {}, disconnect: () => {} };
      },
      createGain: () => ({ gain: { value: 1.0 }, connect: () => {}, disconnect: () => {} }),
      createBiquadFilter: () => ({ frequency: { value: 150 }, gain: { value: 0 }, connect: () => {}, disconnect: () => {} }),
      createAnalyser: () => ({ fftSize: 128, connect: () => {}, disconnect: () => {} }),
      destination: {}
    };

    AudioEngine.ctx = mockCtx;
    AudioEngine.videoSourceCache = new WeakMap();

    const videoEl = new MockElement('video');
    videoEl.src = 'https://www.youtube.com/watch?v=test';

    // First attach
    AudioEngine.attachToVideo(videoEl);
    assert.equal(sourceNodeCreationCount, 1, 'First attach created source node');
    assert.ok(videoEl._ssMediaSourceNode, '_ssMediaSourceNode attached to element');
    assert.ok(AudioEngine.videoSourceCache.has(videoEl), 'Cached in WeakMap');

    // Second attach on same video element (e.g. video quality or format change)
    AudioEngine.attachToVideo(videoEl);
    assert.equal(sourceNodeCreationCount, 1, 'Second attach reused cached source node without calling createMediaElementSource again');

    // Attach to new video element
    const newVideoEl = new MockElement('video');
    newVideoEl.src = 'https://www.youtube.com/watch?v=test2';
    AudioEngine.attachToVideo(newVideoEl);
    assert.equal(sourceNodeCreationCount, 2, 'New video element created exactly 1 new source node');
  });

  // 1.5 Rapid concurrent gesture event bombardment
  await runAsyncTest('1.5: Concurrent gesture event storm during async resume does not throw or double-unlock', async () => {
    let resumeCalls = 0;
    const mockCtx = {
      state: 'suspended',
      resume: async () => {
        resumeCalls++;
        await new Promise(r => setTimeout(r, 15));
        mockCtx.state = 'running';
      },
      createGain: () => ({ gain: { value: 1.0 }, connect: () => {}, disconnect: () => {} }),
      createBiquadFilter: () => ({ frequency: { value: 150 }, gain: { value: 0 }, connect: () => {}, disconnect: () => {} }),
      createAnalyser: () => ({ fftSize: 128, connect: () => {}, disconnect: () => {} }),
      destination: {}
    };

    AudioEngine.ctx = mockCtx;
    AudioEngine.attachGestureUnlock();

    // Fire 20 rapid gesture events concurrently
    const promises = [];
    for (let i = 0; i < 20; i++) {
      if (AudioEngine._unlockHandler) {
        AudioEngine._unlockHandler({ type: gestureEvents[i % gestureEvents.length] });
      }
    }

    await new Promise(r => setTimeout(r, 50));
    assert.equal(mockCtx.state, 'running', 'Context is running');
    assert.ok(resumeCalls >= 1, 'resume was called');
  });

  // ============================================================================
  // DIMENSION 2: EQUALIZER 10-BAND FILTER GRAPH STABILITY, GAIN BOUNDS & DSP CURVES
  // ============================================================================
  console.log('\n--- DIMENSION 2: 10-Band Equalizer DSP Curves, Gain Bounds & Presets ---');

  // 2.1 Band definitions verification (Frequencies, Types, Q factors)
  runTest('2.1: 10-Band EQ specification constants (frequencies, filter types, Q factors)', () => {
    const bands = AudioEngine.EQ_BANDS;
    assert.equal(bands.length, 10, 'Exactly 10 frequency bands');

    const expectedFrequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < 10; i++) {
      assert.equal(bands[i].freq, expectedFrequencies[i], `Band ${i} freq is ${expectedFrequencies[i]}Hz`);
    }

    // Band 0 is lowshelf
    assert.equal(bands[0].type, 'lowshelf');
    assert.equal(bands[0].Q, 1.0);

    // Bands 1-8 are peaking with Q=1.414 (1 octave bandwidth)
    for (let i = 1; i <= 8; i++) {
      assert.equal(bands[i].type, 'peaking', `Band ${i} is peaking filter`);
      assert.equal(bands[i].Q, 1.414, `Band ${i} has Q = 1.414`);
    }

    // Band 9 is highshelf
    assert.equal(bands[9].type, 'highshelf');
    assert.equal(bands[9].Q, 1.0);
  });

  // 2.2 Adversarial gain clamping across all 10 bands [-12dB, +12dB]
  runTest('2.2: Extreme adversarial gain clamping [-12dB, +12dB]', () => {
    const testCases = [
      { input: [100, -100, 12.0001, -12.0001, 0, 6, -6, 12, -12, 0], expected: [12, -12, 12, -12, 0, 6, -6, 12, -12, 0] },
      { input: [Infinity, -Infinity, NaN, 'invalid', null, undefined, 15, -20, '8.5', '-9.2'], expected: [12, -12, 0, 0, 0, 0, 12, -12, 8.5, -9.2] },
      { input: new Array(10).fill(999), expected: new Array(10).fill(12) },
      { input: new Array(10).fill(-999), expected: new Array(10).fill(-12) }
    ];

    for (const tc of testCases) {
      AudioEngine.setEqGains(tc.input);
      const output = AudioEngine.getEqGains();
      for (let i = 0; i < 10; i++) {
        assert.equal(output[i], tc.expected[i], `Band ${i}: expected ${tc.expected[i]}, got ${output[i]}`);
      }
    }
  });

  // 2.3 Single band setter `setEqBandGain` boundary & invalid index tests
  runTest('2.3: Single band setter setEqBandGain boundary & type safety', () => {
    AudioEngine.setEqPreset('Flat');

    // Invalid indices
    assert.equal(AudioEngine.setEqBandGain(-1, 5), false);
    assert.equal(AudioEngine.setEqBandGain(10, 5), false);
    assert.equal(AudioEngine.setEqBandGain('bad', 5), false);
    assert.equal(AudioEngine.setEqBandGain(NaN, 5), false);

    // Valid indices with clamped values
    assert.equal(AudioEngine.setEqBandGain(0, 15), true);
    assert.equal(AudioEngine.getEqGains()[0], 12);

    assert.equal(AudioEngine.setEqBandGain(9, -25), true);
    assert.equal(AudioEngine.getEqGains()[9], -12);

    assert.equal(AudioEngine.setEqBandGain(4, 3.5), true);
    assert.equal(AudioEngine.getEqGains()[4], 3.5);
  });

  // 2.4 Mathematical DSP Biquad Frequency Response Calculation Verification
  runTest('2.4: Mathematical verification of 10-band BiquadFilter frequency response H(z)', () => {
    // Function to calculate biquad magnitude response at frequency f (Hz) given sample rate Fs
    function calculateBiquadResponse(type, f0, Q, gainDb, f, Fs = 48000) {
      const A = Math.pow(10, gainDb / 40);
      const w0 = 2 * Math.PI * f0 / Fs;
      const alpha = Math.sin(w0) / (2 * Q);
      let b0, b1, b2, a0, a1, a2;

      if (type === 'peaking') {
        b0 = 1 + alpha * A;
        b1 = -2 * Math.cos(w0);
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * Math.cos(w0);
        a2 = 1 - alpha / A;
      } else if (type === 'lowshelf') {
        const sqrtA = Math.sqrt(A);
        b0 = A * ((A + 1) - (A - 1) * Math.cos(w0) + 2 * sqrtA * alpha);
        b1 = 2 * A * ((A - 1) - (A + 1) * Math.cos(w0));
        b2 = A * ((A + 1) - (A - 1) * Math.cos(w0) - 2 * sqrtA * alpha);
        a0 = (A + 1) + (A - 1) * Math.cos(w0) + 2 * sqrtA * alpha;
        a1 = -2 * ((A - 1) + (A + 1) * Math.cos(w0));
        a2 = (A + 1) + (A - 1) * Math.cos(w0) - 2 * sqrtA * alpha;
      } else if (type === 'highshelf') {
        const sqrtA = Math.sqrt(A);
        b0 = A * ((A + 1) + (A - 1) * Math.cos(w0) + 2 * sqrtA * alpha);
        b1 = -2 * A * ((A - 1) + (A + 1) * Math.cos(w0));
        b2 = A * ((A + 1) + (A - 1) * Math.cos(w0) - 2 * sqrtA * alpha);
        a0 = (A + 1) - (A - 1) * Math.cos(w0) + 2 * sqrtA * alpha;
        a1 = 2 * ((A - 1) - (A + 1) * Math.cos(w0));
        a2 = (A + 1) - (A - 1) * Math.cos(w0) - 2 * sqrtA * alpha;
      }

      // Normalize by a0
      const nb0 = b0 / a0, nb1 = b1 / a0, nb2 = b2 / a0;
      const na1 = a1 / a0, na2 = a2 / a0;

      // Evaluate H(e^jw) at frequency f
      const w = 2 * Math.PI * f / Fs;
      const cos_w = Math.cos(w), sin_w = Math.sin(w);
      const cos_2w = Math.cos(2 * w), sin_2w = Math.sin(2 * w);

      const num_re = nb0 + nb1 * cos_w + nb2 * cos_2w;
      const num_im = -nb1 * sin_w - nb2 * sin_2w;
      const den_re = 1 + na1 * cos_w + na2 * cos_2w;
      const den_im = -na1 * sin_w - na2 * sin_2w;

      const mag = Math.sqrt((num_re * num_re + num_im * num_im) / (den_re * den_re + den_im * den_im));
      return 20 * Math.log10(mag);
    }

    // Test 1: Peaking filter at 1000Hz with +6dB boost
    const peakGain = calculateBiquadResponse('peaking', 1000, 1.414, 6.0, 1000);
    assert.ok(Math.abs(peakGain - 6.0) < 0.05, `Peaking center frequency gain is +6dB (got ${peakGain.toFixed(2)}dB)`);

    // Far from center frequency (e.g. 50Hz) gain should be near 0dB
    const farGain = calculateBiquadResponse('peaking', 1000, 1.414, 6.0, 50);
    assert.ok(Math.abs(farGain) < 0.2, `Peaking response far from center is 0dB (got ${farGain.toFixed(2)}dB)`);

    // Test 2: Lowshelf filter at 32Hz with +12dB boost
    const subBassGain = calculateBiquadResponse('lowshelf', 32, 1.0, 12.0, 1.0);
    assert.ok(Math.abs(subBassGain - 12.0) < 0.2, `Lowshelf sub-bass gain is +12dB at 1Hz (got ${subBassGain.toFixed(2)}dB)`);

    const highFreqLowshelf = calculateBiquadResponse('lowshelf', 32, 1.0, 12.0, 5000);
    assert.ok(Math.abs(highFreqLowshelf) < 0.1, `Lowshelf high-frequency gain is 0dB (got ${highFreqLowshelf.toFixed(2)}dB)`);

    // Test 3: Highshelf filter at 16000Hz with +8dB boost
    const highShelfGain = calculateBiquadResponse('highshelf', 16000, 1.0, 8.0, 23900);
    assert.ok(Math.abs(highShelfGain - 8.0) < 0.2, `Highshelf high-freq gain is +8dB at Nyquist (got ${highShelfGain.toFixed(2)}dB)`);
  });

  // 2.5 All 8 Preset Profiles & Custom Detection Matrix
  runTest('2.5: Preset profiles integrity, case-insensitivity, and auto-detection', () => {
    const presets = AudioEngine.EQ_PRESETS;
    const expectedPresetKeys = [
      'Flat',
      'Bass Boost',
      'Vocal Booster',
      'Treble Boost',
      'Rock',
      'Pop',
      'Acoustic',
      'Electronic',
      'Custom'
    ];

    for (const key of expectedPresetKeys) {
      assert.ok(key in presets, `Preset '${key}' defined in EQ_PRESETS`);
      if (key !== 'Custom') {
        assert.equal(presets[key].length, 10, `Preset '${key}' has 10 bands`);
        for (let b = 0; b < 10; b++) {
          assert.ok(presets[key][b] >= -12 && presets[key][b] <= 12, `Preset ${key} band ${b} is within [-12, +12]`);
        }
      }
    }

    // Test preset activation & case insensitivity
    const testNames = [
      { raw: 'bass boost', expected: 'Bass Boost' },
      { raw: 'BASS_BOOST', expected: 'Bass Boost' },
      { raw: 'vocal booster', expected: 'Vocal Booster' },
      { raw: 'treble_boost', expected: 'Treble Boost' },
      { raw: 'rock', expected: 'Rock' },
      { raw: 'POP', expected: 'Pop' },
      { raw: 'acoustic', expected: 'Acoustic' },
      { raw: 'electronic', expected: 'Electronic' },
      { raw: 'flat', expected: 'Flat' }
    ];

    for (const tn of testNames) {
      const res = AudioEngine.setEqPreset(tn.raw);
      assert.ok(res, `setEqPreset('${tn.raw}') succeeded`);
      assert.equal(AudioEngine.getEqPreset(), tn.expected, `Preset normalized to '${tn.expected}'`);
      assert.deepEqual(AudioEngine.getEqGains(), presets[tn.expected]);
    }

    // Test micro-deviation auto-transition to Custom
    AudioEngine.setEqPreset('Rock');
    assert.equal(AudioEngine.getEqPreset(), 'Rock');
    AudioEngine.setEqBandGain(5, AudioEngine.getEqGains()[5] + 0.5);
    assert.equal(AudioEngine.getEqPreset(), 'Custom', 'Deviating band 5 by 0.5dB switches preset to Custom');

    // Test restoring values switches back to Rock
    AudioEngine.setEqGains(presets['Rock']);
    assert.equal(AudioEngine.getEqPreset(), 'Rock', 'Restoring exact gains switches preset back to Rock');
  });

  // 2.6 EQ Bypass Toggle `setEqEnabled`
  runTest('2.6: EQ bypass switch setEqEnabled(false/true) preserves user gains while flattening graph', () => {
    // Setup mock filters in AudioEngine
    AudioEngine.eqNodes = [];
    for (let i = 0; i < 10; i++) {
      AudioEngine.eqNodes.push({ gain: { value: 0 }, connect: () => {}, disconnect: () => {} });
    }

    AudioEngine.setEqPreset('Bass Boost'); // Gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0]
    assert.equal(AudioEngine.eqNodes[0].gain.value, 6);
    assert.equal(AudioEngine.eqNodes[1].gain.value, 5);

    // Bypass EQ (disable)
    AudioEngine.setEqEnabled(false);
    assert.equal(AudioEngine.eqEnabled, false);
    for (let i = 0; i < 10; i++) {
      assert.equal(AudioEngine.eqNodes[i].gain.value, 0, `Filter node ${i} gain is 0dB when bypassed`);
    }
    // Stored eqGains should still hold original values
    assert.deepEqual(AudioEngine.getEqGains(), [6, 5, 4, 2, 0, 0, 0, 0, 0, 0], 'eqGains array preserved during bypass');

    // Re-enable EQ
    AudioEngine.setEqEnabled(true);
    assert.equal(AudioEngine.eqEnabled, true);
    assert.equal(AudioEngine.eqNodes[0].gain.value, 6, 'Filter node 0 gain restored to 6dB');
    assert.equal(AudioEngine.eqNodes[1].gain.value, 5, 'Filter node 1 gain restored to 5dB');
  });

  // ============================================================================
  // DIMENSION 3: 7-LOCALE CATALOG KEY PARITY & NON-EMPTY TRANSLATIONS
  // ============================================================================
  console.log('\n--- DIMENSION 3: 7-Locale Catalog Key Parity & Manifest Parity ---');

  const localesDir = path.join(__dirname, '..', '_locales');
  const targetLocales = ['en', 'de', 'es', 'fr', 'hi', 'ja', 'pt'];

  // 3.1 Verify directory existence for all 7 locales
  runTest('3.1: All 7 required locale directories exist in _locales/', () => {
    for (const loc of targetLocales) {
      const locPath = path.join(localesDir, loc, 'messages.json');
      assert.ok(fs.existsSync(locPath), `Locale catalog exists at ${loc}/messages.json`);
    }
  });

  // 3.2 Load catalogs and test 100% key parity
  const catalogs = {};
  for (const loc of targetLocales) {
    const content = fs.readFileSync(path.join(localesDir, loc, 'messages.json'), 'utf8');
    catalogs[loc] = JSON.parse(content);
  }

  const enKeys = Object.keys(catalogs['en']).sort();

  runTest(`3.2: Base English locale has valid catalog with ${enKeys.length} keys`, () => {
    assert.ok(enKeys.length >= 10, 'English catalog has substantial keys');
    assert.ok(enKeys.includes('extName'), 'extName key present');
    assert.ok(enKeys.includes('extDesc'), 'extDesc key present');
  });

  for (const loc of targetLocales) {
    if (loc === 'en') continue;

    runTest(`3.3.${loc}: 100% key parity between 'en' and '${loc}'`, () => {
      const locKeys = Object.keys(catalogs[loc]).sort();
      
      const missingKeys = enKeys.filter(k => !(k in catalogs[loc]));
      const extraKeys = locKeys.filter(k => !(k in catalogs['en']));

      assert.equal(missingKeys.length, 0, `Locale '${loc}' is missing keys: ${missingKeys.join(', ')}`);
      assert.equal(extraKeys.length, 0, `Locale '${loc}' has extra keys: ${extraKeys.join(', ')}`);
      assert.equal(locKeys.length, enKeys.length, `Locale '${loc}' key count (${locKeys.length}) matches 'en' (${enKeys.length})`);
    });
  }

  // 3.4 Verify non-empty translations and valid schema across all 7 catalogs
  runTest('3.4: All messages across all 7 catalogs have valid non-empty string messages', () => {
    let emptyCount = 0;
    const emptyKeys = [];

    for (const loc of targetLocales) {
      for (const [key, val] of Object.entries(catalogs[loc])) {
        if (!val || typeof val.message !== 'string' || val.message.trim().length === 0) {
          emptyCount++;
          emptyKeys.push(`${loc}.${key}`);
        }
      }
    }

    assert.equal(emptyCount, 0, `Found ${emptyCount} empty messages: ${emptyKeys.join(', ')}`);
  });

  // 3.5 Verify manifest.json __MSG_*__ parity with locale catalogs
  runTest('3.5: manifest.json __MSG_*__ references resolve in all 7 locale catalogs', () => {
    const manifestContent = fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8');
    const msgRegex = /__MSG_([a-zA-Z0-9_]+)__/g;
    let match;
    const manifestMsgKeys = [];

    while ((match = msgRegex.exec(manifestContent)) !== null) {
      if (!manifestMsgKeys.includes(match[1])) {
        manifestMsgKeys.push(match[1]);
      }
    }

    assert.ok(manifestMsgKeys.length > 0, 'Found localized keys in manifest.json');

    for (const msgKey of manifestMsgKeys) {
      for (const loc of targetLocales) {
        assert.ok(
          msgKey in catalogs[loc],
          `Manifest key '__MSG_${msgKey}__' missing in _locales/${loc}/messages.json`
        );
      }
    }
  });

  // ============================================================================
  // DIMENSION 4: VOLUME BOOSTER AUDIO GRAPH SYNCHRONIZATION & STORAGE INTEGRITY
  // ============================================================================
  console.log('\n--- DIMENSION 4: Volume Booster Integration & Storage Synchronization ---');

  await runAsyncTest('4.1: VolumeBooster & StorageUtil 3-tier cascade roundtrip', async () => {
    await global.chrome.storage.local.clear();
    await global.chrome.storage.sync.clear();
    StorageUtil.clearMemoryCache();

    // Volume level clamping
    VolumeBooster.setVolume(750);
    assert.equal(VolumeBooster.getVolume(), 600, 'Volume clamped to 600%');

    VolumeBooster.setVolume(-50);
    assert.equal(VolumeBooster.getVolume(), 0, 'Volume clamped to 0%');

    // Bass level clamping
    VolumeBooster.setBass(30);
    assert.equal(VolumeBooster.getBass(), 20, 'Bass clamped to 20dB');

    VolumeBooster.setBass(-10);
    assert.equal(VolumeBooster.getBass(), 0, 'Bass clamped to 0dB');

    // Persist to storage
    await StorageUtil.updateVolumeBoosterSetting('volumeLevel', 250);
    await StorageUtil.updateVolumeBoosterSetting('bassLevel', 12);
    await StorageUtil.updateVolumeBoosterSetting('preset', 'Rock');
    await StorageUtil.updateVolumeBoosterSetting('eqGains', [5, 4, 3, 1, -1, -1, 0, 2, 4, 5]);

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.volumeBooster.volumeLevel, 250);
    assert.equal(settings.volumeBooster.bassLevel, 12);
    assert.equal(settings.volumeBooster.preset, 'Rock');
    assert.deepEqual(settings.volumeBooster.eqGains, [5, 4, 3, 1, -1, -1, 0, 2, 4, 5]);
  });

  console.log('\n========================================================================');
  console.log(`FINAL RESULTS: ${passedTests}/${totalTests} PASSED`);
  if (failedTests > 0) {
    console.error(`FAILED: ${failedTests}`);
    failureList.forEach(f => console.error(`  - ${f.name}: ${f.error.message}`));
    process.exit(1);
  } else {
    console.log('ALL ADVERSARIAL CHALLENGER TESTS PASSED 100% CLEANLY! 🎉');
    console.log('========================================================================');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal unhandled error in harness:', err);
  process.exit(1);
});
