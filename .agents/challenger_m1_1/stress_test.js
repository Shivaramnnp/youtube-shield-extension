/**
 * Empirical Stress Test Harness for M1 (10-Band Graphic Equalizer Engine & Presets)
 * Executed by Challenger 1 (`challenger_m1_1`)
 */

const assert = require('assert');

// Mock Browser Environment
require('../../tests/harness/mock-extension-env');

const AudioEngine = require('../../utils/audio-engine');
const VolumeBooster = require('../../content/js/volume-booster');

let passCount = 0;
let failCount = 0;
const findings = [];

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    findings.push({ name, error: err.message, stack: err.stack });
    failCount++;
  }
}

console.log('================================================================');
console.log('      EMPIRICAL CHALLENGER STRESS TEST SUITE — MILESTONE M1     ');
console.log('================================================================\n');

// Section 1: Gain Clamping Bounds
console.log('--- Section 1: Gain Clamping Bounds ---');

runTest('1.1 setEqGains handles extreme numerical bounds (-100, +100, Infinity, -Infinity)', () => {
  const gains = [-100, 100, Infinity, -Infinity, 999999, -999999, 12, -12, 12.0001, -12.0001];
  const res = AudioEngine.setEqGains(gains);
  assert.strictEqual(res, true, 'setEqGains returns true for array input');
  
  const result = AudioEngine.getEqGains();
  assert.strictEqual(result[0], -12, '-100 clamped to -12');
  assert.strictEqual(result[1], 12, '+100 clamped to +12');
  assert.strictEqual(result[2], 12, 'Infinity clamped to +12');
  assert.strictEqual(result[3], -12, '-Infinity clamped to -12');
  assert.strictEqual(result[4], 12, '999999 clamped to +12');
  assert.strictEqual(result[5], -12, '-999999 clamped to -12');
  assert.strictEqual(result[6], 12, '12 stays 12');
  assert.strictEqual(result[7], -12, '-12 stays -12');
  assert.strictEqual(result[8], 12, '12.0001 clamped to +12');
  assert.strictEqual(result[9], -12, '-12.0001 clamped to -12');
});

runTest('1.2 setEqGains handles non-numeric types (NaN, null, undefined, strings, objects)', () => {
  const gains = [NaN, null, undefined, "10", "-100", "abc", "12.5", {}, [], true];
  const res = AudioEngine.setEqGains(gains);
  assert.strictEqual(res, true, 'setEqGains returns true');

  const result = AudioEngine.getEqGains();
  assert.strictEqual(result[0], 0, 'NaN defaults to 0');
  assert.strictEqual(result[1], 0, 'null defaults to 0');
  assert.strictEqual(result[2], 0, 'undefined defaults to 0');
  assert.strictEqual(result[3], 10, '"10" parses to 10');
  assert.strictEqual(result[4], -12, '"-100" parses to -100 and clamps to -12');
  assert.strictEqual(result[5], 0, '"abc" (NaN) defaults to 0');
  assert.strictEqual(result[6], 12, '"12.5" parses to 12.5 and clamps to 12');
  assert.strictEqual(result[7], 0, '{} (NaN) defaults to 0');
  assert.strictEqual(result[8], 0, '[] (0) defaults to 0');
  assert.strictEqual(result[9], 1, 'true (1) parses to 1');
});

runTest('1.3 setEqGains handles non-array and improperly sized inputs gracefully', () => {
  const invalidInputs = [null, undefined, 123, "not an array", {}, true, Symbol('test')];
  for (const input of invalidInputs) {
    assert.doesNotThrow(() => {
      const res = AudioEngine.setEqGains(input);
      assert.strictEqual(res, false, `setEqGains returned false for invalid input ${typeof input}`);
    }, `setEqGains did not throw for ${typeof input}`);
  }

  // Test short array
  assert.doesNotThrow(() => {
    const res = AudioEngine.setEqGains([5, 10]);
    assert.strictEqual(res, true, 'short array processed');
    const gains = AudioEngine.getEqGains();
    assert.strictEqual(gains[0], 5, 'band 0 updated');
    assert.strictEqual(gains[1], 10, 'band 1 updated');
    assert.strictEqual(gains[2], 0, 'unfilled band 2 defaults to 0 via undefined conversion');
  });

  // Test long array
  assert.doesNotThrow(() => {
    const res = AudioEngine.setEqGains([1,2,3,4,5,6,7,8,9,10,11,12,13,14]);
    assert.strictEqual(res, true, 'long array processed');
    const gains = AudioEngine.getEqGains();
    assert.strictEqual(gains.length, 10, 'gains array size strictly 10');
    assert.strictEqual(gains[9], 10, '10th element clamped/assigned');
  });
});

runTest('1.4 setEqBandGain index validation behavior for non-numeric/null indices', () => {
  AudioEngine.resetEq();

  // Test explicit out-of-bound numbers
  const outOfBounds = [-1, 10, 10.5, 999, -999, NaN, undefined, "abc"];
  for (const idx of outOfBounds) {
    const res = AudioEngine.setEqBandGain(idx, 5);
    assert.strictEqual(res, false, `setEqBandGain returned false for index: ${idx}`);
  }

  // Check behavior for null, false, "" (JS coercions where Number(x) === 0)
  const coercedZeroIndices = [null, false, ""];
  for (const idx of coercedZeroIndices) {
    const res = AudioEngine.setEqBandGain(idx, 5);
    console.log(`    Notice: setEqBandGain(${JSON.stringify(idx)}, 5) returned ${res} (coerced index to 0)`);
  }

  // Valid indices with extreme gains
  const res0 = AudioEngine.setEqBandGain(0, 100);
  assert.strictEqual(res0, true);
  assert.strictEqual(AudioEngine.getEqGains()[0], 12, 'Band 0 clamped to 12');

  const res9 = AudioEngine.setEqBandGain(9, -100);
  assert.strictEqual(res9, true);
  assert.strictEqual(AudioEngine.getEqGains()[9], -12, 'Band 9 clamped to -12');

  const res3 = AudioEngine.setEqBandGain("3", "6");
  assert.strictEqual(res3, true);
  assert.strictEqual(AudioEngine.getEqGains()[3], 6, 'String index "3" and string gain "6" handled');
});

runTest('1.5 getEqGains immutability stress test', () => {
  AudioEngine.resetEq();
  const gains1 = AudioEngine.getEqGains();
  gains1[0] = 12;
  gains1.push(99);
  
  const gains2 = AudioEngine.getEqGains();
  assert.strictEqual(gains2[0], 0, 'Internal gains not mutated');
  assert.strictEqual(gains2.length, 10, 'Internal gains length not altered');
});

// Section 2: Preset Robustness
console.log('\n--- Section 2: Preset Robustness ---');

runTest('2.1 AudioEngine.setEqPreset unknown and invalid preset handling', () => {
  const invalidPresets = [
    'UnknownPreset', 'NonExistent', '', '   ', 'INVALID',
    null, undefined, 123, {}, [], true, Symbol('preset')
  ];

  for (const preset of invalidPresets) {
    assert.doesNotThrow(() => {
      const res = AudioEngine.setEqPreset(preset);
      assert.strictEqual(res, false, `AudioEngine.setEqPreset returned false for invalid preset: ${String(preset)}`);
    }, `setEqPreset did not throw for preset ${String(preset)}`);
  }
});

runTest('2.2 setEqPreset case insensitivity and whitespace normalization', () => {
  const testCases = [
    { input: 'flat', expectedName: 'Flat', expectedGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { input: '  BASS BOOST  ', expectedName: 'Bass Boost', expectedGains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
    { input: 'vocal_booster', expectedName: 'Vocal Booster', expectedGains: [-2, -1, 0, 2, 4, 5, 4, 2, 0, -1] },
    { input: 'TREBLE_BOOST', expectedName: 'Treble Boost', expectedGains: [0, 0, 0, 0, 0, 1, 3, 5, 7, 8] },
    { input: 'RoCK', expectedName: 'Rock', expectedGains: [5, 4, 3, 1, -1, -1, 0, 2, 4, 5] },
    { input: 'pop', expectedName: 'Pop', expectedGains: [-1, 2, 4, 5, 4, 0, -1, 1, 3, 4] },
    { input: 'ACOUSTIC', expectedName: 'Acoustic', expectedGains: [3, 2, 1, 2, 3, 3, 2, 3, 2, 1] },
    { input: 'electronic', expectedName: 'Electronic', expectedGains: [6, 5, 2, 0, -2, 2, 1, 2, 4, 5] },
    { input: ' custom ', expectedName: 'Custom', expectedGains: null }
  ];

  for (const tc of testCases) {
    const res = AudioEngine.setEqPreset(tc.input);
    assert.strictEqual(res, true, `setEqPreset returned true for '${tc.input}'`);
    assert.strictEqual(AudioEngine.getEqPreset(), tc.expectedName, `Preset name is '${tc.expectedName}'`);
    if (tc.expectedGains) {
      assert.deepStrictEqual(AudioEngine.getEqGains(), tc.expectedGains, `Gains match for '${tc.input}'`);
    }
  }
});

runTest('2.3 Tight loop preset switching (100,000 iterations)', () => {
  const presets = ['Flat', 'Bass Boost', 'Vocal Booster', 'Treble Boost', 'Rock', 'Pop', 'Acoustic', 'Electronic'];
  const startTime = Date.now();

  assert.doesNotThrow(() => {
    for (let i = 0; i < 100000; i++) {
      const preset = presets[i % presets.length];
      AudioEngine.setEqPreset(preset);
    }
  }, 'Tight loop switching does not throw');

  const duration = Date.now() - startTime;
  console.log(`    (Executed 100,000 preset switches in ${duration} ms)`);
  
  assert.strictEqual(AudioEngine.getEqPreset(), presets[99999 % presets.length], 'Final preset matches loop expectation');
});

runTest('2.4 Preset detection (_detectPreset) on custom gain changes', () => {
  AudioEngine.setEqPreset('Bass Boost');
  assert.strictEqual(AudioEngine.getEqPreset(), 'Bass Boost');

  AudioEngine.setEqGains([5, 4, 3, 1, -1, -1, 0, 2, 4, 5]);
  assert.strictEqual(AudioEngine.getEqPreset(), 'Rock', 'Auto-detected Rock preset');

  AudioEngine.setEqBandGain(0, 5.5);
  assert.strictEqual(AudioEngine.getEqPreset(), 'Custom', 'Switched to Custom profile');
});

// Section 3: VolumeBooster Integration & Proxying
console.log('\n--- Section 3: VolumeBooster Proxying & Fallback ---');

runTest('3.1 VolumeBooster proxying clamping & preset validation', () => {
  VolumeBooster.resetEq();
  assert.strictEqual(VolumeBooster.getEqPreset(), 'Flat');

  // Proxy setEqGains with invalid bounds
  const res = VolumeBooster.setEqGains([50, -50, NaN, null, "10", 0, 0, 0, 0, 0]);
  assert.strictEqual(res, true);
  const gains = VolumeBooster.getEqGains();
  assert.strictEqual(gains[0], 12, 'VolumeBooster 50 clamped to 12');
  assert.strictEqual(gains[1], -12, 'VolumeBooster -50 clamped to -12');
  assert.strictEqual(gains[2], 0, 'VolumeBooster NaN defaults to 0');
  assert.strictEqual(gains[3], 0, 'VolumeBooster null defaults to 0');
  assert.strictEqual(gains[4], 10, 'VolumeBooster "10" parsed to 10');

  // Test VolumeBooster invalid preset handling vs AudioEngine sync
  AudioEngine.setEqPreset('Flat');
  const invPresetResult = VolumeBooster.setEqPreset('FakePreset');
  
  if (invPresetResult === true && VolumeBooster.getEqPreset() === 'FakePreset' && AudioEngine.getEqPreset() === 'Flat') {
    throw new Error(`DESYNC BUG: VolumeBooster.setEqPreset('FakePreset') returned true and set _eqPreset to 'FakePreset', but AudioEngine.setEqPreset('FakePreset') returned false and remained 'Flat'.`);
  }
  
  assert.strictEqual(invPresetResult, false, 'VolumeBooster.setEqPreset returns false for invalid preset');
  assert.strictEqual(VolumeBooster.getEqPreset(), AudioEngine.getEqPreset(), 'VolumeBooster getEqPreset stays in sync with AudioEngine');
});

runTest('3.2 VolumeBooster standalone fallback mode without AudioEngine', () => {
  const origAE = AudioEngine;
  
  try {
    // Override audio engine proxy in VolumeBooster by setting global/window AudioEngine to null
    global.AudioEngine = null;
    if (typeof window !== 'undefined') window.AudioEngine = null;

    const standaloneBooster = new VolumeBooster.constructor();
    assert.strictEqual(standaloneBooster.setEqPreset('Rock'), true, 'Standalone setEqPreset Rock returns true');
    assert.strictEqual(standaloneBooster.getEqPreset(), 'Rock', 'Standalone getEqPreset is Rock');
    assert.deepStrictEqual(standaloneBooster.getEqGains(), [5, 4, 3, 1, -1, -1, 0, 2, 4, 5], 'Standalone gains match Rock');

    standaloneBooster.setEqBandGain(2, 10);
    assert.strictEqual(standaloneBooster.getEqPreset(), 'Custom', 'Standalone switches to Custom on band edit');
    assert.strictEqual(standaloneBooster.getEqGains()[2], 10, 'Band 2 updated to 10');

    const inv = standaloneBooster.setEqPreset('NonExistent');
    if (inv === true && standaloneBooster.getEqPreset() === 'NonExistent') {
      throw new Error(`FALLBACK DESYNC BUG: Standalone VolumeBooster.setEqPreset('NonExistent') returned true and set _eqPreset to 'NonExistent'.`);
    }
    assert.strictEqual(inv, false, 'Standalone setEqPreset returns false for invalid preset');
  } finally {
    global.AudioEngine = origAE;
    if (typeof window !== 'undefined') window.AudioEngine = origAE;
  }
});

console.log('\n================================================================');
console.log(` RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
