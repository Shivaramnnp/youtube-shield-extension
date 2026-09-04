/**
 * Challenger 1: Empirical Adversarial Probe & Stress Harness
 * Web Audio DSP Parameter Handling, Gain Math, and Boundary Conditions
 *
 * Exhaustively probes:
 * 1. Volume clamping [0..600%] & raw multiplier [0.0..6.0] with invalid/adversarial inputs.
 * 2. Bass clamping [0..20dB] with invalid/adversarial inputs.
 * 3. 10-Band EQ gain clamping [-12..+12dB], band indices, array lengths, and invalid values.
 * 4. EQ Preset handling, case-insensitivity, and auto-detection of 'Custom' vs presets.
 * 5. Master EQ bypass toggling (state preservation in software vs 0dB on hardware nodes).
 * 6. 1,000+ rapid slider toggling, high-frequency interleaved updates, and random fuzzing.
 * 7. Bidirectional CustomEvent IPC Bridge (__SS_AUDIO_UPDATE__ & __SS_AUDIO_STATE__).
 * 8. Multi-Gesture 9-event WebKit AudioContext unlock & lifecycle transitions.
 * 9. AnalyserNode byte frequency and time-domain data extraction.
 * 10. Sound effect synthesis lifecycle & node garbage collection.
 */

const { setupMockEnv } = require('./harness/mock-extension-env');

let passedAssertions = 0;
let failedAssertions = 0;
const failureList = [];

function assert(condition, message) {
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failedAssertions++;
    failureList.push(message);
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passedAssertions++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failedAssertions++;
    const fullMsg = `${message} — Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`;
    failureList.push(fullMsg);
    console.error(`  ❌ [FAIL] ${fullMsg}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    passedAssertions++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failedAssertions++;
    const fullMsg = `${message} — Expected: ${expectedStr}, Actual: ${actualStr}`;
    failureList.push(fullMsg);
    console.error(`  ❌ [FAIL] ${fullMsg}`);
  }
}

function doesNotThrow(fn, message) {
  try {
    fn();
    passedAssertions++;
    console.log(`  ✓ [PASS] ${message}`);
  } catch (e) {
    failedAssertions++;
    const fullMsg = `${message} — Threw: ${e.message}`;
    failureList.push(fullMsg);
    console.error(`  ❌ [FAIL] ${fullMsg}`);
  }
}

class MockParam {
  constructor(initial = 0) {
    this.value = initial;
  }
  setValueAtTime(val) {
    this.value = val;
  }
  exponentialRampToValueAtTime(val) {
    this.value = val;
  }
}

class MockAudioNode {
  constructor() {
    this.connectedTo = [];
  }
  connect(target) {
    this.connectedTo.push(target);
  }
  disconnect() {
    this.connectedTo = [];
  }
}

class MockGainNode extends MockAudioNode {
  constructor(gain = 1.0) {
    super();
    this.gain = new MockParam(gain);
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor(type = 'peaking', freq = 1000, Q = 1.414, gain = 0) {
    super();
    this.type = type;
    this.frequency = new MockParam(freq);
    this.Q = new MockParam(Q);
    this.gain = new MockParam(gain);
  }
}

class MockAnalyserNode extends MockAudioNode {
  constructor() {
    super();
    this.fftSize = 128;
    this.smoothingTimeConstant = 0.8;
    this.frequencyBinCount = 64;
  }
  getByteFrequencyData(arr) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 255);
    }
  }
  getByteTimeDomainData(arr) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = 128;
    }
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super();
    this.type = 'sine';
    this.frequency = new MockParam(440);
    this.onended = null;
  }
  start() {}
  stop() {
    if (typeof this.onended === 'function') {
      setTimeout(() => this.onended(), 1);
    }
  }
}

class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = new MockAudioNode();
    this.onstatechange = null;
  }
  resume() {
    this.state = 'running';
    if (this.onstatechange) this.onstatechange();
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    if (this.onstatechange) this.onstatechange();
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    if (this.onstatechange) this.onstatechange();
    return Promise.resolve();
  }
  createGain() {
    return new MockGainNode(1.0);
  }
  createBiquadFilter() {
    return new MockBiquadFilterNode('lowshelf', 150, 1.0, 0);
  }
  createAnalyser() {
    return new MockAnalyserNode();
  }
  createOscillator() {
    return new MockOscillatorNode();
  }
  createMediaElementSource(el) {
    return new MockAudioNode();
  }
}

async function runDspAdversarialProbes() {
  console.log("==========================================================================");
  console.log("=== CHALLENGER 1: WEB AUDIO DSP PARAMETER & ADVERSARIAL STRESS PROBE ===");
  console.log("==========================================================================");

  const env = setupMockEnv();
  window.AudioContext = MockAudioContext;
  window.webkitAudioContext = MockAudioContext;
  global.AudioContext = MockAudioContext;
  global.webkitAudioContext = MockAudioContext;

  // Load modules
  delete require.cache[require.resolve('../utils/audio-engine')];
  delete require.cache[require.resolve('../content/js/volume-booster')];
  const AudioEngine = require('../utils/audio-engine');
  const VolumeBooster = require('../content/js/volume-booster');
  
  // Clean reload of PageAudioDsp
  delete window.__SS_PAGE_AUDIO_DSP_INITIALIZED__;
  delete window.__SS_PAGE_AUDIO_DSP__;
  try {
    delete require.cache[require.resolve('../content/js/page-audio-dsp')];
  } catch (e) {}
  require('../content/js/page-audio-dsp');
  const PageAudioDsp = window.__SS_PAGE_AUDIO_DSP__;

  // Initialize contexts
  AudioEngine.initContext();
  VolumeBooster._initContext();
  PageAudioDsp.initContext();

  const mockVideo = document.createElement('video');
  mockVideo.className = 'html5-main-video';
  document.body.appendChild(mockVideo);

  AudioEngine.attachToVideo(mockVideo);
  VolumeBooster.connect(mockVideo);
  PageAudioDsp.attachToVideo(mockVideo);

  // =========================================================================
  // SECTION 1: VOLUME CLAMPING & MULTIPLIER INTERPRETATION [0..600% / 0.0..6.0]
  // =========================================================================
  console.log("\n--- SECTION 1: Volume Clamping & Multiplier Adversarial Probes ---");

  const volumeTestCases = [
    // [input, expectedPercent, expectedGain, description]
    [100, 100, 1.0, "Normal 100%"],
    [0, 0, 0.0, "Mute 0%"],
    [300, 300, 3.0, "Boost 300%"],
    [600, 600, 6.0, "Max boost 600%"],
    [1.0, 100, 1.0, "Raw multiplier 1.0 -> 100%"],
    [2.5, 250, 2.5, "Raw multiplier 2.5 -> 250%"],
    [6.0, 600, 6.0, "Raw multiplier 6.0 -> 600%"],
    [0.5, 50, 0.5, "Raw multiplier 0.5 -> 50%"],
    // Boundary & Over-range
    [601, 600, 6.0, "Over-range 601% clamped to 600%"],
    [1000, 600, 6.0, "Over-range 1000% clamped to 600%"],
    [999999, 600, 6.0, "Extreme 999999% clamped to 600%"],
    [Infinity, 600, 6.0, "Infinity clamped to 600%"],
    [15.0, 15, 0.15, "15.0 treated as 15% (multiplier > 10)"],
    // Under-range & Negative
    [-1, 0, 0.0, "Negative -1% clamped to 0%"],
    [-100, 0, 0.0, "Negative -100% clamped to 0%"],
    [-9999, 0, 0.0, "Extreme negative clamped to 0%"],
    [-Infinity, 0, 0.0, "-Infinity clamped to 0%"],
    // Invalid / Type Stress
    [NaN, 100, 1.0, "NaN falls back safely to default 100%"],
    [null, 0, 0.0, "null converts via Number(null)=0 -> 0%"],
    [undefined, 100, 1.0, "undefined falls back to default 100%"],
    ["", 0, 0.0, "Empty string converts to 0%"],
    ["450", 450, 4.5, "String '450' parses to 450%"],
    ["invalid_string", 100, 1.0, "Invalid string falls back to 100%"],
    [{}, 100, 1.0, "Object {} falls back to 100%"],
    [[], 0, 0.0, "Array [] converts to 0%"]
  ];

  for (const [input, expPct, expGain, desc] of volumeTestCases) {
    // 1. AudioEngine
    AudioEngine.setVolume(input);
    assertEqual(AudioEngine._volumeLevel, expPct, `AudioEngine: ${desc} -> _volumeLevel`);
    if (AudioEngine.gainNode) {
      assert(Math.abs(AudioEngine.gainNode.gain.value - expGain) < 0.0001, `AudioEngine: ${desc} -> GainNode.value matches ${expGain}`);
    }

    // 2. VolumeBooster
    VolumeBooster.setVolume(input);
    assertEqual(VolumeBooster.getVolume(), expPct, `VolumeBooster: ${desc} -> getVolume()`);
    if (VolumeBooster.gainNode) {
      assert(Math.abs(VolumeBooster.gainNode.gain.value - expGain) < 0.0001, `VolumeBooster: ${desc} -> GainNode.value matches ${expGain}`);
    }

    // 3. PageAudioDsp
    PageAudioDsp.setVolume(input);
    assertEqual(PageAudioDsp._volumeLevel, expPct, `PageAudioDsp: ${desc} -> _volumeLevel`);
    if (PageAudioDsp.gainNode) {
      assert(Math.abs(PageAudioDsp.gainNode.gain.value - expGain) < 0.0001, `PageAudioDsp: ${desc} -> GainNode.value matches ${expGain}`);
    }
  }

  // =========================================================================
  // SECTION 2: BASS CLAMPING & LOWSHELF FILTER PROBES [0..20dB]
  // =========================================================================
  console.log("\n--- SECTION 2: Bass Clamping & BiquadFilter Node Probes ---");

  const bassTestCases = [
    // [input, expectedDb, description]
    [0, 0, "Flat 0dB bass"],
    [10, 10, "10dB bass boost"],
    [20, 20, "Max 20dB bass boost"],
    // Over-range
    [21, 20, "Over-range 21dB clamped to 20dB"],
    [50, 20, "Over-range 50dB clamped to 20dB"],
    [999, 20, "Extreme 999dB clamped to 20dB"],
    [Infinity, 20, "Infinity clamped to 20dB"],
    // Under-range & Negative
    [-1, 0, "Negative -1dB clamped to 0dB"],
    [-20, 0, "Negative -20dB clamped to 0dB"],
    [-999, 0, "Extreme negative clamped to 0dB"],
    [-Infinity, 0, "-Infinity clamped to 0dB"],
    // Invalid / Type Stress
    [NaN, 0, "NaN falls back to 0dB"],
    [null, 0, "null falls back to 0dB"],
    [undefined, 0, "undefined falls back to 0dB"],
    ["", 0, "Empty string falls back to 0dB"],
    ["16", 16, "String '16' parses to 16dB"],
    ["bad_str", 0, "Invalid string falls back to 0dB"],
    [{}, 0, "Object {} falls back to 0dB"],
    [[], 0, "Array [] falls back to 0dB"]
  ];

  for (const [input, expDb, desc] of bassTestCases) {
    // 1. AudioEngine
    AudioEngine.setBass(input);
    assertEqual(AudioEngine._bassLevel, expDb, `AudioEngine: ${desc} -> _bassLevel`);
    if (AudioEngine.bassNode) {
      assertEqual(AudioEngine.bassNode.type, "lowshelf", "AudioEngine bassNode is lowshelf");
      assertEqual(AudioEngine.bassNode.frequency.value, 150, "AudioEngine bassNode freq is 150Hz");
      assertEqual(AudioEngine.bassNode.gain.value, expDb, `AudioEngine: ${desc} -> bassNode.gain.value`);
    }

    // 2. VolumeBooster
    VolumeBooster.setBass(input);
    assertEqual(VolumeBooster.getBass(), expDb, `VolumeBooster: ${desc} -> getBass()`);
    if (VolumeBooster.bassNode) {
      assertEqual(VolumeBooster.bassNode.gain.value, expDb, `VolumeBooster: ${desc} -> bassNode.gain.value`);
    }

    // 3. PageAudioDsp
    PageAudioDsp.setBass(input);
    assertEqual(PageAudioDsp._bassLevel, expDb, `PageAudioDsp: ${desc} -> _bassLevel`);
    if (PageAudioDsp.bassNode) {
      assertEqual(PageAudioDsp.bassNode.gain.value, expDb, `PageAudioDsp: ${desc} -> bassNode.gain.value`);
    }
  }

  // =========================================================================
  // SECTION 3: 10-BAND EQ GAIN CLAMPING & BOUNDARY CONDITIONS [-12..+12dB]
  // =========================================================================
  console.log("\n--- SECTION 3: 10-Band EQ Clamping, Band Index & Boundary Probes ---");

  // Verify Band frequencies and types
  const expectedFreqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  assertEqual(AudioEngine.EQ_BANDS.length, 10, "10 EQ bands defined in AudioEngine");
  assertEqual(PageAudioDsp.constructor.EQ_BANDS.length, 10, "10 EQ bands defined in PageAudioDspEngine");

  for (let i = 0; i < 10; i++) {
    assertEqual(AudioEngine.EQ_BANDS[i].freq, expectedFreqs[i], `Band ${i} frequency is ${expectedFreqs[i]}Hz`);
    if (i === 0) {
      assertEqual(AudioEngine.EQ_BANDS[i].type, 'lowshelf', "Band 0 type is lowshelf");
    } else if (i === 9) {
      assertEqual(AudioEngine.EQ_BANDS[i].type, 'highshelf', "Band 9 type is highshelf");
    } else {
      assertEqual(AudioEngine.EQ_BANDS[i].type, 'peaking', `Band ${i} type is peaking`);
      assertEqual(AudioEngine.EQ_BANDS[i].Q, 1.414, `Band ${i} Q is 1.414`);
    }
  }

  // Individual Band Clamping Probe
  for (let band = 0; band < 10; band++) {
    const bandTestCases = [
      [0, 0, "Flat 0dB"],
      [6, 6, "+6dB boost"],
      [-6, -6, "-6dB cut"],
      [12, 12, "+12dB max boost"],
      [-12, -12, "-12dB max cut"],
      [13, 12, "Over-range +13dB clamped to +12dB"],
      [999, 12, "Extreme +999dB clamped to +12dB"],
      [Infinity, 12, "+Infinity clamped to +12dB"],
      [-13, -12, "Under-range -13dB clamped to -12dB"],
      [-999, -12, "Extreme -999dB clamped to -12dB"],
      [-Infinity, -12, "-Infinity clamped to -12dB"],
      [NaN, 0, "NaN defaults to 0dB"],
      [null, 0, "null defaults to 0dB"],
      [undefined, 0, "undefined defaults to 0dB"],
      ["8", 8, "String '8' parses to 8dB"],
      ["-10", -10, "String '-10' parses to -10dB"],
      ["invalid", 0, "Invalid string defaults to 0dB"]
    ];

    for (const [gainIn, expGain, desc] of bandTestCases) {
      // AudioEngine
      AudioEngine.setEqBandGain(band, gainIn);
      assertEqual(AudioEngine.eqGains[band], expGain, `AudioEngine Band ${band}: ${desc} -> eqGains[${band}]`);
      if (AudioEngine.eqNodes && AudioEngine.eqNodes[band]) {
        assertEqual(AudioEngine.eqNodes[band].gain.value, expGain, `AudioEngine Band ${band}: node.gain.value matches ${expGain}`);
      }

      // VolumeBooster
      VolumeBooster.setEqBandGain(band, gainIn);
      assertEqual(VolumeBooster.getEqGains()[band], expGain, `VolumeBooster Band ${band}: ${desc} -> getEqGains()[${band}]`);
      if (VolumeBooster.eqNodes && VolumeBooster.eqNodes[band]) {
        assertEqual(VolumeBooster.eqNodes[band].gain.value, expGain, `VolumeBooster Band ${band}: node.gain.value matches ${expGain}`);
      }
    }
  }

  // Band Index Boundaries & Adversarial Index Values
  const invalidIndices = [-1, -100, 10, 11, 50, 999, NaN, "foo", null, undefined, {}, []];
  for (const badIdx of invalidIndices) {
    const resEngine = AudioEngine.setEqBandGain(badIdx, 5);
    assertEqual(resEngine, false, `AudioEngine rejects invalid band index ${JSON.stringify(badIdx)}`);

    const resVb = VolumeBooster.setEqBandGain(badIdx, 5);
    assertEqual(resVb, false, `VolumeBooster rejects invalid band index ${JSON.stringify(badIdx)}`);
  }

  // Full Array Clamping & Invalid Inputs in setEqGains
  const arrayStressCases = [
    {
      input: [15, -20, 99, -100, NaN, null, undefined, "10", "-5", 0],
      expected: [12, -12, 12, -12, 0, 0, 0, 10, -5, 0],
      desc: "Mixed extreme/NaN/null/string array correctly clamped to [-12..+12]"
    },
    {
      input: [0, 0, 0],
      expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      desc: "Short 3-element array fills missing bands with 0dB safely"
    }
  ];

  for (const { input, expected, desc } of arrayStressCases) {
    AudioEngine.setEqGains(input);
    assertDeepEqual(AudioEngine.getEqGains(), expected, `AudioEngine: ${desc}`);

    VolumeBooster.setEqGains(input);
    assertDeepEqual(VolumeBooster.getEqGains(), expected, `VolumeBooster: ${desc}`);

    PageAudioDsp.setEqGains(input);
    assertDeepEqual(PageAudioDsp._eqGains, expected, `PageAudioDsp: ${desc}`);
  }

  // Non-array inputs to setEqGains
  const nonArrayInputs = [null, undefined, "invalid", 123, {}, true];
  for (const nonArr of nonArrayInputs) {
    assertEqual(AudioEngine.setEqGains(nonArr), false, `AudioEngine.setEqGains rejects ${typeof nonArr}`);
    assertEqual(VolumeBooster.setEqGains(nonArr), false, `VolumeBooster.setEqGains rejects ${typeof nonArr}`);
    doesNotThrow(() => PageAudioDsp.setEqGains(nonArr), `PageAudioDsp.setEqGains safely handles ${typeof nonArr}`);
  }

  // =========================================================================
  // SECTION 4: PRESET SWITCHING, NORMALIZATION & AUTO-DETECTION
  // =========================================================================
  console.log("\n--- SECTION 4: Preset Switching, Normalization & Detection ---");

  const presetList = [
    'Flat', 'Bass Boost', 'Vocal Booster', 'Treble Boost', 'Rock', 'Pop', 'Acoustic', 'Electronic'
  ];

  for (const preset of presetList) {
    // 1. Exact preset name
    assert(AudioEngine.setEqPreset(preset), `AudioEngine.setEqPreset('${preset}') succeeds`);
    assertEqual(AudioEngine.getEqPreset(), preset, `AudioEngine preset is '${preset}'`);
    assertDeepEqual(AudioEngine.getEqGains(), AudioEngine.EQ_PRESETS[preset], `AudioEngine gains match '${preset}'`);

    assert(VolumeBooster.setEqPreset(preset), `VolumeBooster.setEqPreset('${preset}') succeeds`);
    assertEqual(VolumeBooster.getEqPreset(), preset, `VolumeBooster preset is '${preset}'`);
    assertDeepEqual(VolumeBooster.getEqGains(), AudioEngine.EQ_PRESETS[preset], `VolumeBooster gains match '${preset}'`);

    assert(PageAudioDsp.setEqPreset(preset), `PageAudioDsp.setEqPreset('${preset}') succeeds`);
    assertEqual(PageAudioDsp._eqPreset, preset, `PageAudioDsp preset is '${preset}'`);
    assertDeepEqual(PageAudioDsp._eqGains, AudioEngine.EQ_PRESETS[preset], `PageAudioDsp gains match '${preset}'`);

    // 2. Case-insensitive / slug aliases
    const lowerSlug = preset.toLowerCase().replace(/\s+/g, '_');
    const upperStr = preset.toUpperCase();
    assert(AudioEngine.setEqPreset(lowerSlug), `AudioEngine handles slug alias '${lowerSlug}'`);
    assertEqual(AudioEngine.getEqPreset(), preset, `Normalized preset is '${preset}'`);

    assert(VolumeBooster.setEqPreset(upperStr), `VolumeBooster handles uppercase '${upperStr}'`);
    assertEqual(VolumeBooster.getEqPreset(), preset, `Normalized preset is '${preset}'`);
  }

  // Preset Auto-detection to 'Custom' when single band altered
  AudioEngine.setEqPreset('Rock');
  assertEqual(AudioEngine.getEqPreset(), 'Rock', "Started at Rock");
  AudioEngine.setEqBandGain(4, 9); // Alter band 4
  assertEqual(AudioEngine.getEqPreset(), 'Custom', "AudioEngine auto-transitioned to 'Custom' after band edit");

  VolumeBooster.setEqPreset('Pop');
  assertEqual(VolumeBooster.getEqPreset(), 'Pop', "Started at Pop");
  VolumeBooster.setEqBandGain(0, 10);
  assertEqual(VolumeBooster.getEqPreset(), 'Custom', "VolumeBooster auto-transitioned to 'Custom' after band edit");

  // resetEq() restores 'Flat' preset and all 0s
  AudioEngine.resetEq();
  assertEqual(AudioEngine.getEqPreset(), 'Flat', "AudioEngine.resetEq() restores 'Flat'");
  assertDeepEqual(AudioEngine.getEqGains(), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "AudioEngine.resetEq() zeroes gains");

  VolumeBooster.resetEq();
  assertEqual(VolumeBooster.getEqPreset(), 'Flat', "VolumeBooster.resetEq() restores 'Flat'");
  assertDeepEqual(VolumeBooster.getEqGains(), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "VolumeBooster.resetEq() zeroes gains");

  // Invalid preset names
  const invalidPresets = ['Dubstep', 'NonExistent', '', 12345, null, undefined, {}];
  for (const badPreset of invalidPresets) {
    assertEqual(AudioEngine.setEqPreset(badPreset), false, `AudioEngine.setEqPreset rejects ${JSON.stringify(badPreset)}`);
    assertEqual(VolumeBooster.setEqPreset(badPreset), false, `VolumeBooster.setEqPreset rejects ${JSON.stringify(badPreset)}`);
    assertEqual(PageAudioDsp.setEqPreset(badPreset), false, `PageAudioDsp.setEqPreset rejects ${JSON.stringify(badPreset)}`);
  }

  // =========================================================================
  // SECTION 5: MASTER EQ BYPASS TOGGLING (setEqEnabled)
  // =========================================================================
  console.log("\n--- SECTION 5: Master EQ Bypass Toggling & State Invariant Probes ---");

  // Set initial distinct preset
  AudioEngine.setEqPreset('Rock');
  const rockGains = AudioEngine.EQ_PRESETS['Rock'];
  assertEqual(AudioEngine.getEqPreset(), 'Rock', "Set EQ preset to Rock");

  // 1. Bypass EQ (eqEnabled = false)
  AudioEngine.setEqEnabled(false);
  assertEqual(AudioEngine.eqEnabled, false, "AudioEngine eqEnabled is false");
  // Stored software state MUST remain 'Rock' with rock gains
  assertDeepEqual(AudioEngine.getEqGains(), rockGains, "Software eqGains preserved while bypassed");
  assertEqual(AudioEngine.getEqPreset(), 'Rock', "Software eqPreset preserved while bypassed");
  // Hardware BiquadFilter nodes MUST have 0dB gain
  if (AudioEngine.eqNodes) {
    for (let i = 0; i < 10; i++) {
      assertEqual(AudioEngine.eqNodes[i].gain.value, 0, `Hardware eqNode[${i}] gain is 0dB when bypassed`);
    }
  }

  // 2. Re-enable EQ (eqEnabled = true)
  AudioEngine.setEqEnabled(true);
  assertEqual(AudioEngine.eqEnabled, true, "AudioEngine eqEnabled is true");
  assertDeepEqual(AudioEngine.getEqGains(), rockGains, "Software eqGains intact when re-enabled");
  if (AudioEngine.eqNodes) {
    for (let i = 0; i < 10; i++) {
      assertEqual(AudioEngine.eqNodes[i].gain.value, rockGains[i], `Hardware eqNode[${i}] gain restored to ${rockGains[i]}dB`);
    }
  }

  // 3. Repeat for VolumeBooster & PageAudioDsp
  VolumeBooster.setEqPreset('Bass Boost');
  const bassBoostGains = AudioEngine.EQ_PRESETS['Bass Boost'];
  VolumeBooster.setEqEnabled(false);
  assertEqual(VolumeBooster._eqEnabled, false, "VolumeBooster eqEnabled is false");
  assertDeepEqual(VolumeBooster.getEqGains(), bassBoostGains, "VolumeBooster software eqGains preserved");

  VolumeBooster.setEqEnabled(true);
  assertEqual(VolumeBooster._eqEnabled, true, "VolumeBooster eqEnabled is true");
  assertDeepEqual(VolumeBooster.getEqGains(), bassBoostGains, "VolumeBooster software eqGains restored");

  // Rapid 1,000 Cycle Bypass Toggle Invariant Stress
  let toggleError = false;
  for (let c = 0; c < 1000; c++) {
    const enable = (c % 2 === 0);
    AudioEngine.setEqEnabled(enable);
    if (AudioEngine.eqEnabled !== enable) {
      console.log(`Bypass toggle failed at cycle ${c}: eqEnabled mismatch`);
      toggleError = true;
    }
    if (enable) {
      if (AudioEngine.eqNodes[0].gain.value !== rockGains[0]) {
        console.log(`Bypass toggle failed at cycle ${c} (enable=true): expected ${rockGains[0]}, got ${AudioEngine.eqNodes[0].gain.value}`);
        toggleError = true;
        break;
      }
    } else {
      if (AudioEngine.eqNodes[0].gain.value !== 0) {
        console.log(`Bypass toggle failed at cycle ${c} (enable=false): expected 0, got ${AudioEngine.eqNodes[0].gain.value}`);
        toggleError = true;
        break;
      }
    }
  }
  assert(!toggleError, "1,000 rapid bypass toggle iterations executed without state corruption");

  // =========================================================================
  // SECTION 6: 1,000+ RAPID SLIDER UPDATES & RANDOM FUZZ STRESS
  // =========================================================================
  console.log("\n--- SECTION 6: 1,000+ Rapid Updates & Fuzz Stress Harness ---");

  const fuzzPresets = Object.keys(AudioEngine.EQ_PRESETS);
  let fuzzFaults = 0;

  const tStart = Date.now();
  for (let i = 0; i < 1500; i++) {
    try {
      // 1. Rapid Volume Fuzz
      const randVol = (i % 5 === 0) ? (Math.random() * 1000 - 200) : (i % 7 === 0) ? NaN : (i % 11 === 0) ? "450" : (Math.random() * 600);
      VolumeBooster.setVolume(randVol);
      const curVol = VolumeBooster.getVolume();
      if (isNaN(curVol) || curVol < 0 || curVol > 600) fuzzFaults++;

      // 2. Rapid Bass Fuzz
      const randBass = (i % 6 === 0) ? (Math.random() * 50 - 15) : (i % 8 === 0) ? null : (i % 13 === 0) ? "18" : (Math.random() * 20);
      VolumeBooster.setBass(randBass);
      const curBass = VolumeBooster.getBass();
      if (isNaN(curBass) || curBass < 0 || curBass > 20) fuzzFaults++;

      // 3. Rapid EQ Band Gain Fuzz
      const randBand = Math.floor(Math.random() * 12) - 1; // includes -1 and 10, 11 (invalid)
      const randGain = (Math.random() * 40) - 20; // -20dB to +20dB
      VolumeBooster.setEqBandGain(randBand, randGain);
      const curGains = VolumeBooster.getEqGains();
      for (let b = 0; b < 10; b++) {
        if (isNaN(curGains[b]) || curGains[b] < -12 || curGains[b] > 12) fuzzFaults++;
      }

      // 4. Rapid Preset Switching
      if (i % 10 === 0) {
        const randPreset = fuzzPresets[Math.floor(Math.random() * fuzzPresets.length)];
        VolumeBooster.setEqPreset(randPreset);
      }

      // 5. Rapid Bypass Toggle
      if (i % 15 === 0) {
        VolumeBooster.setEqEnabled(i % 30 === 0);
      }
    } catch (err) {
      fuzzFaults++;
    }
  }
  const tElapsed = Date.now() - tStart;

  assertEqual(fuzzFaults, 0, `1,500 rapid interleaved fuzz updates produced 0 faults / 0 bounds violations in ${tElapsed}ms`);

  // =========================================================================
  // SECTION 7: BIDIRECTIONAL CUSTOMEVENT IPC BRIDGE
  // =========================================================================
  console.log("\n--- SECTION 7: CustomEvent IPC Bridge Probes ---");

  let interceptedUpdates = [];
  const updateListener = (e) => {
    interceptedUpdates.push(e.detail);
  };
  window.addEventListener('__SS_AUDIO_UPDATE__', updateListener);

  let interceptedStates = [];
  const stateListener = (e) => {
    interceptedStates.push(e.detail);
  };
  window.addEventListener('__SS_AUDIO_STATE__', stateListener);

  try {
    // Isolated world dispatches update via VolumeBooster
    VolumeBooster.setVolume(350);
    VolumeBooster.setBass(14);
    VolumeBooster.setEqPreset('Acoustic');
    VolumeBooster.setEqEnabled(true);

    assert(interceptedUpdates.length >= 4, `__SS_AUDIO_UPDATE__ received ${interceptedUpdates.length} events`);
    const lastUpdate = interceptedUpdates[interceptedUpdates.length - 1];
    assertEqual(lastUpdate.volumeLevel, 350, "IPC update volumeLevel is 350%");
    assertEqual(lastUpdate.bassLevel, 14, "IPC update bassLevel is 14dB");
    assertEqual(lastUpdate.eqPreset, "Acoustic", "IPC update eqPreset is Acoustic");
    assertEqual(lastUpdate.eqEnabled, true, "IPC update eqEnabled is true");

    // Page world receives and notifies state
    PageAudioDsp.setVolume(lastUpdate.volumeLevel);
    PageAudioDsp.setBass(lastUpdate.bassLevel);
    PageAudioDsp.setEqPreset(lastUpdate.eqPreset);
    PageAudioDsp.notifyState();

    assert(interceptedStates.length >= 1, `__SS_AUDIO_STATE__ received ${interceptedStates.length} events`);
    const lastState = interceptedStates[interceptedStates.length - 1];
    assertEqual(lastState.connected, true, "IPC state connected is true");
    assertEqual(lastState.volumeLevel, 350, "IPC state volumeLevel is 350");
    assertEqual(lastState.bassLevel, 14, "IPC state bassLevel is 14");
    assertEqual(lastState.activePreset, "Acoustic", "IPC state activePreset is Acoustic");

    // Check DOM attributes
    assertEqual(document.documentElement.getAttribute('data-ss-audio-connected'), 'true', "DOM attr data-ss-audio-connected is 'true'");
    assertEqual(document.documentElement.getAttribute('data-ss-audio-state'), PageAudioDsp.ctx.state, `DOM attr data-ss-audio-state is '${PageAudioDsp.ctx.state}'`);
  } finally {
    window.removeEventListener('__SS_AUDIO_UPDATE__', updateListener);
    window.removeEventListener('__SS_AUDIO_STATE__', stateListener);
  }

  // =========================================================================
  // SECTION 8: 9-EVENT WEBKIT AUDIOCONTEXT UNLOCK & LIFECYCLE
  // =========================================================================
  console.log("\n--- SECTION 8: 9-Event WebKit AudioContext Unlock Probes ---");

  const unlockEvents = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown', 'play', 'playing', 'input'];

  for (const evtName of unlockEvents) {
    let resumed = false;
    AudioEngine.ctx = {
      state: 'suspended',
      resume: () => {
        resumed = true;
        AudioEngine.ctx.state = 'running';
        return Promise.resolve();
      }
    };

    AudioEngine.attachGestureUnlock();

    const evt = new Event(evtName, { bubbles: true });
    window.dispatchEvent(evt);

    await new Promise(r => setTimeout(r, 5));
    assert(resumed, `AudioContext resumed on gesture event '${evtName}'`);
    assertEqual(AudioEngine.ctx.state, 'running', `AudioContext state transitioned to 'running' on '${evtName}'`);
  }

  // =========================================================================
  // SECTION 9: ANALYSERNODE FFT & TIME-DOMAIN BYTE EXTRACTION
  // =========================================================================
  console.log("\n--- SECTION 9: AnalyserNode Byte Extraction Probes ---");

  AudioEngine.initContext();
  AudioEngine.attachToVideo(mockVideo);

  const freqData = AudioEngine.getFrequencyData();
  assert(freqData instanceof Uint8Array, "getFrequencyData() returns Uint8Array instance");
  assertEqual(freqData.length, 64, "getFrequencyData() returns exactly 64 frequency bins");

  const timeData = AudioEngine.getTimeDomainData();
  assert(timeData instanceof Uint8Array, "getTimeDomainData() returns Uint8Array instance");
  assertEqual(timeData.length, 128, "getTimeDomainData() returns exactly 128 waveform points");

  const vbFreqData = VolumeBooster.getFrequencyData();
  assert(vbFreqData instanceof Uint8Array, "VolumeBooster.getFrequencyData() returns Uint8Array");
  assertEqual(vbFreqData.length, 64, "VolumeBooster.getFrequencyData() returns 64 bins");

  const vbTimeData = VolumeBooster.getTimeDomainData();
  assert(vbTimeData instanceof Uint8Array, "VolumeBooster.getTimeDomainData() returns Uint8Array");
  assertEqual(vbTimeData.length, 128, "VolumeBooster.getTimeDomainData() returns 128 points");

  // =========================================================================
  // SECTION 10: TONE SYNTHESIZER LIFECYCLE & CLEANUP
  // =========================================================================
  console.log("\n--- SECTION 10: Sound Effects Tone Synthesis & Cleanup ---");

  doesNotThrow(() => AudioEngine.playLevelUp(), "AudioEngine.playLevelUp() executes without throwing");
  doesNotThrow(() => AudioEngine.playBadgeUnlock(), "AudioEngine.playBadgeUnlock() executes without throwing");
  doesNotThrow(() => AudioEngine.playAlarm(), "AudioEngine.playAlarm() executes without throwing");
  doesNotThrow(() => AudioEngine.playClick(), "AudioEngine.playClick() executes without throwing");

  // Verify disconnect and teardown safety
  doesNotThrow(() => AudioEngine.disconnect(), "AudioEngine.disconnect() clears nodes cleanly");
  doesNotThrow(() => AudioEngine.teardown(), "AudioEngine.teardown() executes cleanly");
  doesNotThrow(() => VolumeBooster.disconnect(), "VolumeBooster.disconnect() clears nodes cleanly");
  doesNotThrow(() => VolumeBooster.teardown(), "VolumeBooster.teardown() executes cleanly");

  console.log("\n==========================================================================");
  console.log(`TOTAL CHALLENGER 1 ADVERSARIAL PROBE ASSERTIONS: ${passedAssertions + failedAssertions}`);
  console.log(`PASSED: ${passedAssertions}`);
  console.log(`FAILED: ${failedAssertions}`);
  console.log("==========================================================================");

  if (failedAssertions > 0) {
    console.error("Failures encountered:");
    failureList.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log("ALL CHALLENGER 1 ADVERSARIAL STRESS PROBES PASSED WITH 100% SUCCESS! ✅\n");
    process.exit(0);
  }
}

runDspAdversarialProbes().catch(err => {
  console.error("FATAL ERROR IN CHALLENGER 1 HARNESS:", err);
  process.exit(1);
});
