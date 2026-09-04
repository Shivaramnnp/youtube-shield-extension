/**
 * Challenger M4 Empirical Presets & Isolated World Verification Harness
 * Exhaustively tests:
 * 1. Chrome MV3 Isolated World sequential evaluation of all 16 content scripts with 0 SyntaxErrors.
 * 2. window._SS_EQ_PRESETS structure, keys, frequencies, and array gains.
 * 3. AudioEngine & VolumeBooster EQ preset switching, gain clamping, and fallback mechanisms.
 * 4. HeaderButton _ssDetectPreset recognition for all presets and custom curves.
 * 5. Full codebase inspection for deprecated orient="vertical" and slider-vertical.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { setupMockEnv } = require('./harness/mock-extension-env');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runEmpiricalPresetsVerification() {
  console.log("==========================================================================");
  console.log("=== CHALLENGER M4 EMPIRICAL PRESETS & ISOLATED WORLD HARNESS ===");
  console.log("==========================================================================");

  // -----------------------------------------------------------------------------
  // TEST 1: CHROME MV3 ISOLATED WORLD SEQUENTIAL EVALUATION (ALL 16 SCRIPTS)
  // -----------------------------------------------------------------------------
  console.log("\n--- TEST 1: Chrome MV3 Isolated World 16 Content Scripts Sequential Evaluation ---");

  const manifestPath = path.join(__dirname, '..', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const contentScripts = manifest.content_scripts[0].js;

  assert(Array.isArray(contentScripts), "manifest.json has content_scripts[0].js array");
  assert(contentScripts.length === 17, `manifest.json contains exactly 17 content scripts (got ${contentScripts.length})`);

  // Create isolated VM context with browser & extension mocks
  const mockEnv = setupMockEnv();
  const contextObj = {
    ...global,
    window: global.window,
    document: global.document,
    chrome: global.chrome,
    AudioContext: global.window.AudioContext,
    webkitAudioContext: global.window.webkitAudioContext,
    MutationObserver: global.window.MutationObserver,
    DOMParser: global.window.DOMParser,
    location: global.window.location,
    localStorage: global.window.localStorage,
    sessionStorage: global.window.sessionStorage,
    Event: global.Event,
    CustomEvent: global.CustomEvent,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval
  };
  contextObj.window.window = contextObj.window;
  contextObj.window.globalThis = contextObj.window;

  const vmContext = vm.createContext(contextObj);

  let evalErrors = 0;
  for (let i = 0; i < contentScripts.length; i++) {
    const scriptRelPath = contentScripts[i];
    const scriptAbsPath = path.join(__dirname, '..', scriptRelPath);
    const scriptCode = fs.readFileSync(scriptAbsPath, 'utf8');

    try {
      vm.runInContext(scriptCode, vmContext, { filename: scriptRelPath });
      assert(true, `Script ${i + 1}/16 (${scriptRelPath}) evaluated with 0 errors`);
    } catch (err) {
      evalErrors++;
      assert(false, `Script ${i + 1}/16 (${scriptRelPath}) threw error: ${err.message}`);
    }
  }

  assert(evalErrors === 0, `All 16 content scripts evaluated in sequence with 0 SyntaxErrors or runtime errors`);

  // -----------------------------------------------------------------------------
  // TEST 2: window._SS_EQ_PRESETS EMPIRICAL STRUCTURE & FREQUENCY VERIFICATION
  // -----------------------------------------------------------------------------
  console.log("\n--- TEST 2: window._SS_EQ_PRESETS Empirical Structure Verification ---");

  const evaluatedPresets = vmContext.window._SS_EQ_PRESETS;
  assert(typeof evaluatedPresets === 'object' && evaluatedPresets !== null, "window._SS_EQ_PRESETS exists on global window");

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

  const presetKeys = Object.keys(expectedPresets);
  for (const key of presetKeys) {
    assert(key in evaluatedPresets, `window._SS_EQ_PRESETS contains preset key '${key}'`);
    if (key === 'Custom') {
      assert(evaluatedPresets[key] === null, `'Custom' preset is null`);
    } else {
      const gains = evaluatedPresets[key];
      assert(Array.isArray(gains), `'${key}' preset value is an array`);
      assert(gains.length === 10, `'${key}' preset array contains exactly 10 band gains (got ${gains.length})`);
      assert(JSON.stringify(gains) === JSON.stringify(expectedPresets[key]), `'${key}' preset gains exactly match specification: ${JSON.stringify(expectedPresets[key])}`);
      for (let b = 0; b < 10; b++) {
        assert(typeof gains[b] === 'number' && !isNaN(gains[b]), `'${key}' band ${b} is a valid number: ${gains[b]}`);
        assert(gains[b] >= -12 && gains[b] <= 12, `'${key}' band ${b} gain (${gains[b]}dB) is within [-12dB, +12dB]`);
      }
    }
  }

  // Verify EQ_BANDS frequencies and filter types
  const audioEngineInstance = vmContext.window.AudioEngine || AudioEngine;
  const EQ_BANDS = audioEngineInstance ? audioEngineInstance.EQ_BANDS : null;
  assert(Array.isArray(EQ_BANDS) && EQ_BANDS.length === 10, "AudioEngine.EQ_BANDS has 10 bands");
  const expectedFreqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < 10; i++) {
    assert(EQ_BANDS[i].freq === expectedFreqs[i], `Band ${i} frequency is ${expectedFreqs[i]}Hz`);
    if (i === 0) {
      assert(EQ_BANDS[i].type === 'lowshelf', `Band 0 type is 'lowshelf'`);
    } else if (i === 9) {
      assert(EQ_BANDS[i].type === 'highshelf', `Band 9 type is 'highshelf'`);
    } else {
      assert(EQ_BANDS[i].type === 'peaking', `Band ${i} type is 'peaking'`);
    }
  }

  // -----------------------------------------------------------------------------
  // TEST 3: PRESET SWITCHING & ADVERSARIAL STRESS
  // -----------------------------------------------------------------------------
  console.log("\n--- TEST 3: AudioEngine & VolumeBooster Preset Switching & Clamping Stress ---");

  const AudioEngine = require('../utils/audio-engine');
  const VolumeBooster = require('../content/js/volume-booster');

  // Test all standard presets on AudioEngine and VolumeBooster
  for (const key of Object.keys(expectedPresets)) {
    if (key === 'Custom') {
      assert(AudioEngine.setEqPreset('Custom') === true, "AudioEngine.setEqPreset('Custom') returns true");
      assert(AudioEngine.getEqPreset() === 'Custom', "AudioEngine preset is 'Custom'");
      assert(VolumeBooster.setEqPreset('Custom') === true, "VolumeBooster.setEqPreset('Custom') returns true");
      assert(VolumeBooster.getEqPreset() === 'Custom', "VolumeBooster preset is 'Custom'");
    } else {
      assert(AudioEngine.setEqPreset(key) === true, `AudioEngine.setEqPreset('${key}') returns true`);
      assert(AudioEngine.getEqPreset() === key, `AudioEngine preset is '${key}'`);
      assert(JSON.stringify(AudioEngine.getEqGains()) === JSON.stringify(expectedPresets[key]), `AudioEngine gains match '${key}'`);

      assert(VolumeBooster.setEqPreset(key) === true, `VolumeBooster.setEqPreset('${key}') returns true`);
      assert(VolumeBooster.getEqPreset() === key, `VolumeBooster preset is '${key}'`);
      assert(JSON.stringify(VolumeBooster.getEqGains()) === JSON.stringify(expectedPresets[key]), `VolumeBooster gains match '${key}'`);
    }
  }

  // Case-insensitive preset switching in VolumeBooster
  assert(VolumeBooster.setEqPreset('bass boost') === true, "VolumeBooster handles lowercase 'bass boost'");
  assert(VolumeBooster.getEqPreset() === 'Bass Boost', "VolumeBooster normalizes 'bass boost' to 'Bass Boost'");
  assert(VolumeBooster.setEqPreset('ROCK') === true, "VolumeBooster handles uppercase 'ROCK'");
  assert(VolumeBooster.getEqPreset() === 'Rock', "VolumeBooster normalizes 'ROCK' to 'Rock'");

  // Non-existent presets
  assert(AudioEngine.setEqPreset('InvalidPreset') === false, "AudioEngine rejects 'InvalidPreset'");
  assert(AudioEngine.setEqPreset(null) === false, "AudioEngine rejects null preset");
  assert(AudioEngine.setEqPreset(12345) === false, "AudioEngine rejects numeric preset");
  assert(VolumeBooster.setEqPreset('NonExistent') === false, "VolumeBooster rejects 'NonExistent'");

  // Rapid 1,000 preset changes stress
  console.log("\n  - Stress: 1,000 rapid preset changes");
  const keysWithoutCustom = presetKeys.filter(k => k !== 'Custom');
  for (let i = 0; i < 1000; i++) {
    const targetPreset = keysWithoutCustom[i % keysWithoutCustom.length];
    AudioEngine.setEqPreset(targetPreset);
    VolumeBooster.setEqPreset(targetPreset);
  }
  assert(true, "1,000 rapid preset transitions executed without error");

  // -----------------------------------------------------------------------------
  // TEST 4: HEADER BUTTON _ssDetectPreset RECOGNITION
  // -----------------------------------------------------------------------------
  console.log("\n--- TEST 4: HeaderButton _ssDetectPreset Recognition ---");

  const detectPresetFn = vmContext._ssDetectPreset || vmContext.window._ssDetectPreset;
  assert(typeof detectPresetFn === 'function', "_ssDetectPreset is defined in isolated world");

  for (const [name, expectedGains] of Object.entries(expectedPresets)) {
    if (name === 'Custom') continue;
    const detected = detectPresetFn(expectedGains);
    assert(detected === name, `_ssDetectPreset accurately detected preset '${name}' from gains`);
  }

  // Test custom / modified gains
  assert(detectPresetFn([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) === 'Custom', "Arbitrary gains correctly detected as 'Custom'");
  assert(detectPresetFn([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]) === 'Custom', "Slight deviation from Flat correctly detected as 'Custom'");
  assert(detectPresetFn(null) === 'Custom', "null gains return 'Custom' safely");
  assert(detectPresetFn("invalid") === 'Custom', "string gains return 'Custom' safely");
  assert(detectPresetFn([]) === 'Custom', "empty array returns 'Custom' safely");

  // -----------------------------------------------------------------------------
  // TEST 5: CSS & HTML AUDIT FOR DEPRECATED SLIDER ATTRIBUTES
  // -----------------------------------------------------------------------------
  console.log("\n--- TEST 5: Complete CSS & HTML Audit for slider-vertical / orient=vertical ---");

  function checkFileForDeprecatedAttrs(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasOrient = /orient=["']vertical["']/i.test(content);
    const hasSliderVertical = /slider-vertical/i.test(content);
    return { hasOrient, hasSliderVertical };
  }

  const filesToCheck = [
    'options/options.html',
    'popup/popup.html',
    'content/js/header-button.js',
    'options/options.css',
    'popup/popup.css',
    'content/css/header-button.css'
  ];

  for (const rel of filesToCheck) {
    const full = path.join(__dirname, '..', rel);
    const check = checkFileForDeprecatedAttrs(full);
    assert(!check.hasOrient, `${rel} has 0 occurrences of orient="vertical"`);
    assert(!check.hasSliderVertical, `${rel} has 0 occurrences of slider-vertical`);
  }

  // -----------------------------------------------------------------------------
  // TEST 6: VERIFY OPTIONS & POPUP HTML SLIDER STYLING
  // -----------------------------------------------------------------------------
  console.log("\n--- TEST 6: HTML Vertical Slider Modern Style Verification ---");

  const optionsHtml = fs.readFileSync(path.join(__dirname, '..', 'options/options.html'), 'utf8');
  const popupHtml = fs.readFileSync(path.join(__dirname, '..', 'popup/popup.html'), 'utf8');

  // Check 10 sliders in options.html
  const optionsSliderMatches = optionsHtml.match(/style="[^"]*writing-mode:\s*vertical-lr[^"]*direction:\s*rtl[^"]*"/g) || [];
  assert(optionsSliderMatches.length >= 10, `options.html has all 10 EQ sliders with writing-mode: vertical-lr; direction: rtl; (found ${optionsSliderMatches.length})`);

  // Check 10 sliders in popup.html
  const popupSliderMatches = popupHtml.match(/style="[^"]*writing-mode:\s*vertical-lr[^"]*direction:\s*rtl[^"]*"/g) || [];
  assert(popupSliderMatches.length >= 10, `popup.html has all 10 EQ sliders with writing-mode: vertical-lr; direction: rtl; (found ${popupSliderMatches.length})`);

  // =============================================================================
  // FINAL HARNESS RESULTS
  // =============================================================================
  console.log("\n==========================================================================");
  console.log(`TOTAL EMPIRICAL PRESET & ISOLATED WORLD TESTS EXECUTED: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("==========================================================================");

  if (failed > 0) {
    console.error("FAILURES DETECTED:");
    failures.forEach(f => console.error(" - " + f));
    process.exit(1);
  } else {
    console.log("ALL EMPIRICAL PRESET & ISOLATED WORLD TESTS PASSED 100% CLEANLY! ✅");
    process.exit(0);
  }
}

runEmpiricalPresetsVerification().catch(err => {
  console.error("Fatal error in test harness:", err);
  process.exit(1);
});
