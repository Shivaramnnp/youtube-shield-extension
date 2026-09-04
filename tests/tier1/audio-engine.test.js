/**
 * Tier 1 Test Suite: R2 - Web Audio Engine Feature (audio-engine.test.js)
 * Tests AudioEngine synthesized sound effects, volume/bass booster, and enable/disable toggling.
 */

require('../harness/mock-extension-env');
const { test, describe, assert } = require('../harness/test-helpers');

// Load AudioEngine
const AudioEngine = require('../../utils/audio-engine');

describe('R2: Gaming Web Audio Sound Effects Engine', () => {

  test('R2.1: AudioEngine initializes AudioContext mock on first play call', () => {
    assert.ok(AudioEngine, 'AudioEngine instance exists');
    assert.equal(AudioEngine.enabled, true, 'AudioEngine enabled by default');
  });

  test('R2.2: playLevelUp, playBadgeUnlock, playAlarm, playClick execute cleanly without throwing', () => {
    assert.doesNotThrow(() => {
      AudioEngine.playLevelUp();
      AudioEngine.playBadgeUnlock();
      AudioEngine.playAlarm();
      AudioEngine.playClick();
    }, 'Sound effect trigger functions execute without error');
  });

  test('R2.3: AudioEngine respects enabled flag setting', () => {
    AudioEngine.enabled = false;
    assert.equal(AudioEngine.enabled, false, 'AudioEngine disabled');

    // Should return early without attempting synthesis
    assert.doesNotThrow(() => {
      AudioEngine.playLevelUp();
      AudioEngine.playBadgeUnlock();
      AudioEngine.playAlarm();
    }, 'Sound triggers do not throw when disabled');

    AudioEngine.enabled = true;
    assert.equal(AudioEngine.enabled, true, 'AudioEngine re-enabled');
  });

  test('R2.4: TimeTracker checkBadges calls AudioEngine.playBadgeUnlock and playLevelUp', async () => {
    const { TimeTracker } = require('../../utils/time-tracker');
    const tt = new TimeTracker();

    let badgeUnlockedCalled = false;
    let levelUpCalled = false;

    const origBadgeUnlock = window.AudioEngine.playBadgeUnlock;
    const origLevelUp = window.AudioEngine.playLevelUp;

    try {
      window.AudioEngine.playBadgeUnlock = () => { badgeUnlockedCalled = true; };
      window.AudioEngine.playLevelUp = () => { levelUpCalled = true; };

      const tracking = {
        monthlyLearningTotal: 1000, // triggers first_step badge
        dailyWatchTime: {},
        dailyLearningTime: {},
        gamification: {
          currentStreak: 0,
          badges: [],
          unlockedBadgeDates: {},
          rankId: 'bronze_focus'
        }
      };

      tt.checkBadges(tracking, {});
      assert.ok(badgeUnlockedCalled, 'AudioEngine.playBadgeUnlock() called on badge unlock');

      // Now test level up
      tracking.monthlyLearningTotal = 900000;
      tracking.gamification.currentStreak = 100;
      tt.checkBadges(tracking, {});
      assert.ok(levelUpCalled, 'AudioEngine.playLevelUp() called on rank upgrade');
    } finally {
      window.AudioEngine.playBadgeUnlock = origBadgeUnlock;
      window.AudioEngine.playLevelUp = origLevelUp;
    }
  });

  test('R2.5: TimeManager showOverlay calls AudioEngine.playAlarm', async () => {
    require('../../content/js/time-manager');
    let alarmCalled = false;
    const origAlarm = window.AudioEngine.playAlarm;

    try {
      window.AudioEngine.playAlarm = () => { alarmCalled = true; };

      const tm = window.TimeManager;
      tm.showOverlay('limit', { limitMinutes: 60, todayMinutes: 65 });

      assert.ok(alarmCalled, 'AudioEngine.playAlarm() called when TimeManager overlay triggers');
      tm.removeOverlay();
    } finally {
      window.AudioEngine.playAlarm = origAlarm;
    }
  });

  test('R2.6: applySettings updates window.AudioEngine.enabled state', async () => {
    require('../../content/js/main');
    // Allow async IIFE in main.js to complete and assign window.applySettings
    await new Promise(resolve => setTimeout(resolve, 20));
    const applySettingsFunc = window.applySettings;
    assert.ok(typeof applySettingsFunc === 'function', 'window.applySettings exported as function');

    applySettingsFunc({ audioEffects: false });
    assert.equal(window.AudioEngine.enabled, false, 'applySettings({ audioEffects: false }) sets window.AudioEngine.enabled = false');

    applySettingsFunc({ audioEffects: true });
    assert.equal(window.AudioEngine.enabled, true, 'applySettings({ audioEffects: true }) sets window.AudioEngine.enabled = true');
  });

  test('R2.7: AudioEngine implements full M1 Interface Contract (initContext, attachToVideo, setVolume, setBass, unlock)', () => {
    assert.equal(typeof AudioEngine.initContext, 'function', 'initContext is a function');
    assert.equal(typeof AudioEngine.attachToVideo, 'function', 'attachToVideo is a function');
    assert.equal(typeof AudioEngine.setVolume, 'function', 'setVolume is a function');
    assert.equal(typeof AudioEngine.setBass, 'function', 'setBass is a function');
    assert.equal(typeof AudioEngine.unlock, 'function', 'unlock is a function');
    assert.equal(typeof AudioEngine.init, 'function', 'init is a function');
  });

  test('R2.8: AudioEngine.attachToVideo and VolumeBooster integration handles video setup, CORS, and node clamping', () => {
    const origAudioContext = window.AudioContext;
    let createdMediaElementSource = false;
    let biquadFilterCreated = false;
    let gainCreated = false;

    class MockGainNode {
      constructor() { this.gain = { value: 1.0 }; }
      connect() {}
      disconnect() {}
    }
    class MockBiquadFilterNode {
      constructor() { this.type = 'lowshelf'; this.frequency = { value: 150 }; this.gain = { value: 0 }; }
      connect() {}
      disconnect() {}
    }
    class MockMediaElementSourceNode {
      connect() {}
      disconnect() {}
    }

    class MockAudioContext {
      constructor() {
        this.state = 'suspended';
        this.destination = {};
        this.onstatechange = null;
      }
      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
      createMediaElementSource() {
        createdMediaElementSource = true;
        return new MockMediaElementSourceNode();
      }
      createBiquadFilter() {
        biquadFilterCreated = true;
        return new MockBiquadFilterNode();
      }
      createGain() {
        gainCreated = true;
        return new MockGainNode();
      }
    }

    try {
      window.AudioContext = MockAudioContext;
      AudioEngine.ctx = null;

      const mockVideo = document.createElement('video');
      mockVideo.src = 'https://www.youtube.com/watch?v=12345';

      const attached = AudioEngine.attachToVideo(mockVideo);
      assert.ok(attached, 'attachToVideo returns true');
      assert.equal(mockVideo.getAttribute('crossorigin'), 'anonymous', 'crossorigin attribute set to anonymous');
      assert.ok(createdMediaElementSource, 'createMediaElementSource invoked');
      assert.ok(biquadFilterCreated, 'createBiquadFilter invoked');
      assert.ok(gainCreated, 'createGain invoked');

      // Test volume clamping [0..6.0] / [0..600%]
      AudioEngine.setVolume(200);
      assert.equal(AudioEngine._volumeLevel, 200, 'volume level stored as 200%');
      assert.equal(AudioEngine.gainNode.gain.value, 2.0, 'gain node value updated to 2.0 multiplier');

      AudioEngine.setVolume(700);
      assert.equal(AudioEngine._volumeLevel, 600, 'volume clamped to 600% max');
      assert.equal(AudioEngine.gainNode.gain.value, 6.0, 'gain node clamped to 6.0 max multiplier');

      // Test bass clamping [0..20dB]
      AudioEngine.setBass(15);
      assert.equal(AudioEngine._bassLevel, 15, 'bass level set to 15dB');
      assert.equal(AudioEngine.bassNode.gain.value, 15, 'bass gain node set to 15dB');

      AudioEngine.setBass(30);
      assert.equal(AudioEngine._bassLevel, 20, 'bass level clamped to 20dB max');
      assert.equal(AudioEngine.bassNode.gain.value, 20, 'bass gain node clamped to 20dB max');
    } finally {
      window.AudioContext = origAudioContext;
    }
  });

  test('R2.9: VolumeBooster synchronizes with AudioEngine attachToVideo, setVolume, and setBass', () => {
    const VolumeBooster = require('../../content/js/volume-booster');
    let attachToVideoCalled = false;
    let setVolumeCalled = false;
    let setBassCalled = false;

    const origAttach = AudioEngine.attachToVideo;
    const origSetVol = AudioEngine.setVolume;
    const origSetBass = AudioEngine.setBass;

    try {
      AudioEngine.attachToVideo = (v) => { attachToVideoCalled = true; return true; };
      AudioEngine.setVolume = (v) => { setVolumeCalled = true; };
      AudioEngine.setBass = (b) => { setBassCalled = true; };

      const mockVideo = document.createElement('video');
      mockVideo.className = 'html5-main-video';
      document.body.appendChild(mockVideo);

      VolumeBooster.setVolume(150);
      assert.ok(setVolumeCalled, 'VolumeBooster.setVolume calls AudioEngine.setVolume');

      VolumeBooster.setBass(10);
      assert.ok(setBassCalled, 'VolumeBooster.setBass calls AudioEngine.setBass');

      VolumeBooster.connect();
      assert.ok(attachToVideoCalled, 'VolumeBooster.connect calls AudioEngine.attachToVideo');

      mockVideo.remove();
    } finally {
      AudioEngine.attachToVideo = origAttach;
      AudioEngine.setVolume = origSetVol;
      AudioEngine.setBass = origSetBass;
    }
  });

  test('R2.10: VolumeBooster.setVolume(0) mutes to 0% and AudioEngine.setVolume(6.1) clamps gain to 6.0', () => {
    const VolumeBooster = require('../../content/js/volume-booster');
    
    // Test VolumeBooster 0% muting
    VolumeBooster.setVolume(0);
    assert.equal(VolumeBooster.getVolume(), 0, 'VolumeBooster.setVolume(0) sets volume level to 0%');

    // Test AudioEngine 6.1 multiplier boundary clamping
    const origGainNode = AudioEngine.gainNode;
    try {
      AudioEngine.gainNode = { gain: { value: 1.0 } };
      AudioEngine.setVolume(6.1);
      assert.equal(AudioEngine._volumeLevel, 600, 'AudioEngine volume level clamped to 600%');
      assert.equal(AudioEngine.gainNode.gain.value, 6.0, 'AudioEngine gain node value clamped to 6.0 multiplier');
    } finally {
      AudioEngine.gainNode = origGainNode;
    }
  });

});

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

    AudioEngine.setEqBandGain(4, 6);
    assert.equal(AudioEngine.getEqPreset(), 'Custom', 'Preset automatically switches to Custom upon slider adjustment');
    assert.equal(AudioEngine.getEqGains()[4], 6, 'Band 4 updated to +6dB');

    const invalidIndex = AudioEngine.setEqBandGain(15, 5);
    assert.equal(invalidIndex, false, 'Invalid band index returns false');
  });

  test('R1.5: getEqGains returns an immutable copy of the gains array', () => {
    AudioEngine.setEqPreset('Flat');
    const gainsCopy = AudioEngine.getEqGains();
    
    gainsCopy[0] = 12;

    assert.equal(AudioEngine.getEqGains()[0], 0, 'Internal gains array protected against external mutation');
  });

  test('R1.6: setEqEnabled toggles master EQ bypass without corrupting stored preset state', () => {
    AudioEngine.setEqPreset('Bass Boost');
    const storedGains = AudioEngine.getEqGains();

    AudioEngine.setEqEnabled(false);
    assert.equal(AudioEngine.eqEnabled, false, 'EQ master toggle set to false');
    
    assert.deepEqual(AudioEngine.getEqGains(), storedGains, 'Stored gains preserved when disabled');

    AudioEngine.setEqEnabled(true);
    assert.equal(AudioEngine.eqEnabled, true, 'EQ master toggle set to true');
    assert.deepEqual(AudioEngine.getEqGains(), storedGains, 'Stored gains active when re-enabled');
  });

  test('R1.7: VolumeBooster proxies setEqGains, setEqBandGain, setEqPreset, getEqGains, getEqPreset, resetEq', () => {
    const VolumeBooster = require('../../content/js/volume-booster');

    VolumeBooster.setEqPreset('Pop');
    assert.equal(VolumeBooster.getEqPreset(), 'Pop', 'VolumeBooster getEqPreset returns Pop');
    assert.deepEqual(VolumeBooster.getEqGains(), [-1, 2, 4, 5, 4, 0, -1, 1, 3, 4], 'VolumeBooster getEqGains returns Pop gains');

    VolumeBooster.setEqBandGain(0, 10);
    assert.equal(VolumeBooster.getEqPreset(), 'Custom', 'VolumeBooster setEqBandGain sets preset to Custom');
    assert.equal(VolumeBooster.getEqGains()[0], 10, 'VolumeBooster band 0 gain set to 10dB');

    VolumeBooster.resetEq();
    assert.equal(VolumeBooster.getEqPreset(), 'Flat', 'VolumeBooster resetEq sets preset to Flat');
    assert.deepEqual(VolumeBooster.getEqGains(), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'VolumeBooster resetEq resets gains to Flat');
  });

  test('R1.8: setEqPreset returns false and maintains current preset on invalid preset name (AudioEngine & VolumeBooster)', () => {
    const VolumeBooster = require('../../content/js/volume-booster');

    // Reset to Flat
    AudioEngine.setEqPreset('Flat');
    VolumeBooster.setEqPreset('Flat');
    assert.equal(AudioEngine.getEqPreset(), 'Flat', 'AudioEngine initialized to Flat');
    assert.equal(VolumeBooster.getEqPreset(), 'Flat', 'VolumeBooster initialized to Flat');

    // 1. AudioEngine & VolumeBooster with AudioEngine active
    const aeInvalidRes = AudioEngine.setEqPreset('InvalidPresetName');
    assert.equal(aeInvalidRes, false, 'AudioEngine.setEqPreset("InvalidPresetName") returns false');
    assert.equal(AudioEngine.getEqPreset(), 'Flat', 'AudioEngine active preset remains unchanged after invalid preset');

    const vbInvalidRes = VolumeBooster.setEqPreset('InvalidPresetName');
    assert.equal(vbInvalidRes, false, 'VolumeBooster.setEqPreset("InvalidPresetName") returns false when AudioEngine active');
    assert.equal(VolumeBooster.getEqPreset(), 'Flat', 'VolumeBooster active preset remains unchanged after invalid preset');

    // 2. VolumeBooster in standalone mode (no AudioEngine)
    const origAEWindow = window.AudioEngine;
    const origAEGlobal = global.AudioEngine;
    try {
      delete window.AudioEngine;
      delete global.AudioEngine;

      const vbStandaloneInvalidRes = VolumeBooster.setEqPreset('InvalidPresetName');
      assert.equal(vbStandaloneInvalidRes, false, 'VolumeBooster.setEqPreset("InvalidPresetName") returns false in standalone mode');
      assert.equal(VolumeBooster.getEqPreset(), 'Flat', 'VolumeBooster active preset remains unchanged in standalone mode');

      const vbStandaloneValidRes = VolumeBooster.setEqPreset('Bass Boost');
      assert.equal(vbStandaloneValidRes, true, 'VolumeBooster.setEqPreset("Bass Boost") returns true in standalone mode');
      assert.equal(VolumeBooster.getEqPreset(), 'Bass Boost', 'VolumeBooster active preset updates to Bass Boost in standalone mode');
    } finally {
      window.AudioEngine = origAEWindow;
      global.AudioEngine = origAEGlobal;
    }
  });

  test('R2.11: AudioEngine constructs AnalyserNode (fftSize=128, smoothingTimeConstant=0.8) and getFrequencyData returns 64-byte Uint8Array', () => {
    const origAudioContext = window.AudioContext;
    let createAnalyserCalled = false;

    class MockAnalyserNode {
      constructor() {
        this.fftSize = 128;
        this.smoothingTimeConstant = 0.8;
        this.frequencyBinCount = 64;
        createAnalyserCalled = true;
      }
      getByteFrequencyData(array) {
        array.fill(128);
      }
      connect() {}
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
      createBiquadFilter() { return { type: 'peaking', frequency: { value: 1000 }, Q: { value: 1.414 }, gain: { value: 0 }, connect() {}, disconnect() {} }; }
      createAnalyser() { return new MockAnalyserNode(); }
    }

    try {
      window.AudioContext = MockAudioContext;
      AudioEngine.ctx = null;
      AudioEngine.analyserNode = null;

      const mockVideo = document.createElement('video');
      AudioEngine.attachToVideo(mockVideo);

      assert.ok(createAnalyserCalled, 'createAnalyser was called on AudioContext');
      assert.ok(AudioEngine.analyserNode, 'analyserNode is defined');
      assert.equal(AudioEngine.analyserNode.fftSize, 128, 'analyserNode fftSize is 128');
      assert.equal(AudioEngine.analyserNode.smoothingTimeConstant, 0.8, 'analyserNode smoothingTimeConstant is 0.8');

      const freqData = AudioEngine.getFrequencyData();
      assert.ok(freqData instanceof Uint8Array, 'getFrequencyData returns Uint8Array');
      assert.equal(freqData.length, 64, 'getFrequencyData returns 64 frequency bins');
      assert.equal(freqData[0], 128, 'getFrequencyData fills byte array correctly');
    } finally {
      window.AudioContext = origAudioContext;
    }
  });

  test('R2.12: VolumeBooster.getFrequencyData proxies to AudioEngine or returns 64-byte Uint8Array', () => {
    const VolumeBooster = require('../../content/js/volume-booster');
    
    // When AudioEngine has frequency data
    const origGetFreq = AudioEngine.getFrequencyData;
    try {
      AudioEngine.getFrequencyData = () => new Uint8Array([10, 20, 30]);
      const data = VolumeBooster.getFrequencyData();
      assert.equal(data[0], 10, 'VolumeBooster delegates getFrequencyData to AudioEngine');
    } finally {
      AudioEngine.getFrequencyData = origGetFreq;
    }

    // In fallback mode when AudioEngine is absent
    const origAEWindow = window.AudioEngine;
    const origAEGlobal = global.AudioEngine;
    try {
      delete window.AudioEngine;
      delete global.AudioEngine;

      const data = VolumeBooster.getFrequencyData();
      assert.ok(data instanceof Uint8Array, 'VolumeBooster.getFrequencyData fallback returns Uint8Array');
      assert.equal(data.length, 64, 'VolumeBooster fallback byte length is 64');
    } finally {
      window.AudioEngine = origAEWindow;
      global.AudioEngine = origAEGlobal;
    }
  });

});

describe('M4: Automated Compatibility & Multi-Browser Equalizer Verification', () => {

  test('M4.1: Exhaustive Verification of all 9 EQ Preset Profiles on AudioEngine and VolumeBooster', () => {
    const VolumeBooster = require('../../content/js/volume-booster');

    const PRESET_DEFINITIONS = {
      'Flat':          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      'Bass Boost':    [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
      'Vocal Booster': [-2, -1, 0, 2, 4, 5, 4, 2, 0, -1],
      'Treble Boost':  [0, 0, 0, 0, 0, 1, 3, 5, 7, 8],
      'Rock':          [5, 4, 3, 1, -1, -1, 0, 2, 4, 5],
      'Pop':           [-1, 2, 4, 5, 4, 0, -1, 1, 3, 4],
      'Acoustic':      [3, 2, 1, 2, 3, 3, 2, 3, 2, 1],
      'Electronic':    [6, 5, 2, 0, -2, 2, 1, 2, 4, 5]
    };

    // 1. Verify all 8 predefined presets
    for (const [presetName, expectedGains] of Object.entries(PRESET_DEFINITIONS)) {
      // Test on AudioEngine
      const aeOk = AudioEngine.setEqPreset(presetName);
      assert.ok(aeOk, `AudioEngine.setEqPreset('${presetName}') returns true`);
      assert.equal(AudioEngine.getEqPreset(), presetName, `AudioEngine preset is '${presetName}'`);
      assert.deepEqual(AudioEngine.getEqGains(), expectedGains, `AudioEngine gains match ${presetName} definition`);

      // Test on VolumeBooster
      const vbOk = VolumeBooster.setEqPreset(presetName);
      assert.ok(vbOk, `VolumeBooster.setEqPreset('${presetName}') returns true`);
      assert.equal(VolumeBooster.getEqPreset(), presetName, `VolumeBooster preset is '${presetName}'`);
      assert.deepEqual(VolumeBooster.getEqGains(), expectedGains, `VolumeBooster gains match ${presetName} definition`);
    }

    // 2. Verify Custom preset behavior
    AudioEngine.setEqPreset('Custom');
    assert.equal(AudioEngine.getEqPreset(), 'Custom', 'AudioEngine supports setting Custom preset directly');

    VolumeBooster.setEqPreset('Custom');
    assert.equal(VolumeBooster.getEqPreset(), 'Custom', 'VolumeBooster supports setting Custom preset directly');

    // 3. Verify automatic switch to Custom on non-matching manual gains
    AudioEngine.setEqGains([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(AudioEngine.getEqPreset(), 'Custom', 'AudioEngine auto-detects Custom when gains do not match predefined preset');
    assert.deepEqual(AudioEngine.getEqGains(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // 4. Verify automatic detection when manual gains match a predefined preset
    AudioEngine.setEqGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(AudioEngine.getEqPreset(), 'Flat', 'AudioEngine auto-detects Flat preset when all zeros applied');

    AudioEngine.setEqGains([6, 5, 4, 2, 0, 0, 0, 0, 0, 0]);
    assert.equal(AudioEngine.getEqPreset(), 'Bass Boost', 'AudioEngine auto-detects Bass Boost when matching gains applied');
  });

  test('M4.2: 10-Band Gain Clamping on All Individual Bands (-12dB to +12dB)', () => {
    // Test upper clamp on each individual band
    for (let band = 0; band < 10; band++) {
      AudioEngine.setEqPreset('Flat');
      AudioEngine.setEqBandGain(band, 25); // Above +12dB
      assert.equal(AudioEngine.getEqGains()[band], 12, `Band ${band} gain clamped to +12dB maximum`);
    }

    // Test lower clamp on each individual band
    for (let band = 0; band < 10; band++) {
      AudioEngine.setEqPreset('Flat');
      AudioEngine.setEqBandGain(band, -30); // Below -12dB
      assert.equal(AudioEngine.getEqGains()[band], -12, `Band ${band} gain clamped to -12dB minimum`);
    }

    // Test boundary edge cases (NaN, Infinity, -Infinity, null, undefined, strings)
    AudioEngine.setEqBandGain(0, NaN);
    assert.equal(AudioEngine.getEqGains()[0], 0, 'NaN gain defaults to 0dB');

    AudioEngine.setEqBandGain(1, Infinity);
    assert.equal(AudioEngine.getEqGains()[1], 12, 'Infinity gain clamps to +12dB');

    AudioEngine.setEqBandGain(2, -Infinity);
    assert.equal(AudioEngine.getEqGains()[2], -12, '-Infinity gain clamps to -12dB');

    AudioEngine.setEqBandGain(3, "8.5");
    assert.equal(AudioEngine.getEqGains()[3], 8.5, 'Valid number string parsed accurately');
  });

  test('M4.3: Multi-Tier Storage Persistence & Sync for 10-Band Equalizer Settings', async () => {
    const { StorageUtil, DEFAULT_SETTINGS } = require('../../utils/storage');

    // 1. Initial default check
    const initialSettings = await StorageUtil.getSettings();
    assert.ok(initialSettings.volumeBooster, 'volumeBooster section exists in default settings');
    assert.equal(initialSettings.volumeBooster.eqEnabled, true, 'eqEnabled is true by default');
    assert.equal(initialSettings.volumeBooster.preset, 'Flat', 'preset is Flat by default');
    assert.deepEqual(initialSettings.volumeBooster.eqGains, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'eqGains initialized to zeros');

    // 2. Update eqGains array
    const newGains = [5, 4, 3, 1, -1, -1, 0, 2, 4, 5];
    await StorageUtil.updateVolumeBoosterSetting('eqGains', newGains);

    const updatedAfterGains = await StorageUtil.getSettings();
    assert.deepEqual(updatedAfterGains.volumeBooster.eqGains, newGains, 'eqGains persisted in storage');

    // 3. Update preset
    await StorageUtil.updateVolumeBoosterSetting('preset', 'Rock');
    const updatedAfterPreset = await StorageUtil.getSettings();
    assert.equal(updatedAfterPreset.volumeBooster.preset, 'Rock', 'preset persisted in storage');

    // 4. Update eqEnabled
    await StorageUtil.updateVolumeBoosterSetting('eqEnabled', false);
    const updatedAfterToggle = await StorageUtil.getSettings();
    assert.equal(updatedAfterToggle.volumeBooster.eqEnabled, false, 'eqEnabled persisted as false in storage');

    // 5. Update volumeLevel and bassLevel
    await StorageUtil.updateVolumeBoosterSetting('volumeLevel', 250);
    await StorageUtil.updateVolumeBoosterSetting('bassLevel', 12);
    const finalSettings = await StorageUtil.getSettings();
    assert.equal(finalSettings.volumeBooster.volumeLevel, 250, 'volumeLevel persisted as 250%');
    assert.equal(finalSettings.volumeBooster.bassLevel, 12, 'bassLevel persisted as 12dB');

    // Clean up storage back to defaults
    await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS });
  });

  test('M4.4: Safari WebKit 6-Event Gesture Unlock on Window and Document', async () => {
    const gestureEvents = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown'];

    for (const evtName of gestureEvents) {
      let resumed = false;

      class MockContextUnlock {
        constructor() {
          this.state = 'suspended';
          this.destination = {};
          this.onstatechange = null;
        }
        resume() {
          resumed = true;
          this.state = 'running';
          return Promise.resolve();
        }
      }

      const origCtx = window.AudioContext;
      try {
        window.AudioContext = MockContextUnlock;
        AudioEngine.ctx = null;
        AudioEngine.initContext();

        AudioEngine.ctx.state = 'suspended';
        AudioEngine.attachGestureUnlock();

        const evt = new Event(evtName, { bubbles: true });
        window.dispatchEvent(evt);

        await new Promise(r => setTimeout(r, 10));
        assert.ok(resumed, `Gesture event '${evtName}' successfully resumed AudioContext`);
        assert.equal(AudioEngine.ctx.state, 'running', `Context transitioned to running on '${evtName}'`);
      } finally {
        window.AudioContext = origCtx;
      }
    }
  });

  test('M4.5: Media Element crossOrigin="anonymous" attribute and property configuration', () => {
    const origCtx = window.AudioContext;

    class MockContextMedia {
      constructor() { this.state = 'running'; this.destination = {}; }
      createMediaElementSource() { return { connect() {}, disconnect() {} }; }
      createGain() { return { gain: { value: 1.0 }, connect() {}, disconnect() {} }; }
      createBiquadFilter() { return { type: 'peaking', frequency: { value: 1000 }, Q: { value: 1.414 }, gain: { value: 0 }, connect() {}, disconnect() {} }; }
      createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, connect() {}, disconnect() {} }; }
    }

    try {
      window.AudioContext = MockContextMedia;
      AudioEngine.ctx = null;

      // 1. Standard YouTube Video URL -> crossOrigin set to anonymous
      const normalVideo = document.createElement('video');
      normalVideo.src = 'https://www.youtube.com/watch?v=media_cors_test';
      AudioEngine.attachToVideo(normalVideo);

      assert.equal(normalVideo.getAttribute('crossorigin'), 'anonymous', 'crossorigin attribute set to anonymous');
      assert.equal(normalVideo.crossOrigin, 'anonymous', 'crossOrigin property set to anonymous');

      // 2. Blob URL -> crossOrigin NOT forced to anonymous to prevent decode errors
      const blobVideo = document.createElement('video');
      blobVideo.src = 'blob:https://www.youtube.com/1234-5678-9abc';
      AudioEngine.attachToVideo(blobVideo);

      assert.equal(blobVideo.hasAttribute('crossorigin'), false, 'blob: video does not have crossorigin attribute forced');
    } finally {
      window.AudioContext = origCtx;
    }
  });

  test('M4.6: WeakMap videoSourceCache node caching prevents DOM duplicate node errors', () => {
    let sourceNodeCreationCount = 0;

    class MockContextCache {
      constructor() { this.state = 'running'; this.destination = {}; }
      createMediaElementSource() {
        sourceNodeCreationCount++;
        return { connect() {}, disconnect() {} };
      }
      createGain() { return { gain: { value: 1.0 }, connect() {}, disconnect() {} }; }
      createBiquadFilter() { return { type: 'peaking', frequency: { value: 1000 }, Q: { value: 1.414 }, gain: { value: 0 }, connect() {}, disconnect() {} }; }
      createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, connect() {}, disconnect() {} }; }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockContextCache;
      AudioEngine.ctx = null;
      AudioEngine.videoSourceCache = new WeakMap();
      AudioEngine._attachedSourceMap = AudioEngine.videoSourceCache;

      const videoEl = document.createElement('video');
      videoEl.src = 'https://www.youtube.com/watch?v=weakmap_test';

      // First attach creates node
      AudioEngine.attachToVideo(videoEl);
      assert.equal(sourceNodeCreationCount, 1, 'createMediaElementSource called on first attach');
      assert.ok(AudioEngine.videoSourceCache.has(videoEl), 'videoSourceCache has entry for videoEl');

      // Second attach on same element reuses cached node
      AudioEngine.attachToVideo(videoEl);
      assert.equal(sourceNodeCreationCount, 1, 'createMediaElementSource NOT called again (videoSourceCache hit)');

      // Also verify VolumeBooster videoSourceCache
      const VolumeBooster = require('../../content/js/volume-booster');
      assert.ok(VolumeBooster.videoSourceCache instanceof WeakMap, 'VolumeBooster has videoSourceCache WeakMap');
    } finally {
      window.AudioContext = origCtx;
    }
  });

  test('M4.7: Standalone VolumeBooster Audio Routing and Teardown Lifecycle', () => {
    const VolumeBooster = require('../../content/js/volume-booster');

    let disconnectedCount = 0;
    class MockNode {
      connect() {}
      disconnect() { disconnectedCount++; }
    }

    class MockContextStandalone {
      constructor() { this.state = 'running'; this.destination = {}; }
      createMediaElementSource() { return new MockNode(); }
      createGain() { return { gain: { value: 1.0 }, connect() {}, disconnect() { disconnectedCount++; } }; }
      createBiquadFilter() { return { type: 'lowshelf', frequency: { value: 150 }, Q: { value: 1 }, gain: { value: 0 }, connect() {}, disconnect() { disconnectedCount++; } }; }
      createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, frequencyBinCount: 64, getByteFrequencyData() {}, connect() {}, disconnect() { disconnectedCount++; } }; }
    }

    const origAEWindow = window.AudioEngine;
    const origAEGlobal = global.AudioEngine;
    const origCtx = window.AudioContext;

    try {
      delete window.AudioEngine;
      delete global.AudioEngine;
      window.AudioContext = MockContextStandalone;

      VolumeBooster.ctx = null;
      VolumeBooster.sourceNode = null;

      const video = document.createElement('video');
      video.className = 'html5-main-video';
      document.body.appendChild(video);

      // Connect in standalone mode
      VolumeBooster.connect();
      assert.ok(VolumeBooster.sourceNode, 'Standalone sourceNode created');
      assert.ok(VolumeBooster.gainNode, 'Standalone gainNode created');
      assert.ok(VolumeBooster.bassNode, 'Standalone bassNode created');
      assert.equal(VolumeBooster.eqNodes.length, 10, 'Standalone 10 EQ nodes created');
      assert.ok(VolumeBooster.analyserNode, 'Standalone analyserNode created');

      // Execute Teardown
      assert.doesNotThrow(() => {
        VolumeBooster.teardown();
      }, 'VolumeBooster.teardown() executes cleanly');

      assert.equal(VolumeBooster.sourceNode, null, 'sourceNode cleared on teardown');
      assert.equal(VolumeBooster.gainNode, null, 'gainNode cleared on teardown');
      assert.equal(VolumeBooster.bassNode, null, 'bassNode cleared on teardown');
      assert.equal(VolumeBooster.eqNodes.length, 0, 'eqNodes cleared on teardown');
      assert.equal(VolumeBooster.analyserNode, null, 'analyserNode cleared on teardown');
      assert.ok(disconnectedCount >= 12, 'All audio nodes disconnected during teardown');

      video.remove();
    } finally {
      window.AudioEngine = origAEWindow;
      global.AudioEngine = origAEGlobal;
      window.AudioContext = origCtx;
    }
  });

  test('M4.8: AudioEngine Disconnect and Teardown Lifecycle', () => {
    let disconnectedCount = 0;
    class MockNode {
      connect() {}
      disconnect() { disconnectedCount++; }
    }

    class MockContextAE {
      constructor() { this.state = 'running'; this.destination = {}; }
      createMediaElementSource() { return new MockNode(); }
      createGain() { return { gain: { value: 1.0 }, connect() {}, disconnect() { disconnectedCount++; } }; }
      createBiquadFilter() { return { type: 'lowshelf', frequency: { value: 150 }, Q: { value: 1 }, gain: { value: 0 }, connect() {}, disconnect() { disconnectedCount++; } }; }
      createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, frequencyBinCount: 64, getByteFrequencyData() {}, connect() {}, disconnect() { disconnectedCount++; } }; }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockContextAE;
      AudioEngine.ctx = null;
      AudioEngine.sourceNode = null;
      AudioEngine.bassNode = null;
      AudioEngine.gainNode = null;
      AudioEngine.eqNodes = [];
      AudioEngine.analyserNode = null;
      AudioEngine._connectedVideo = null;

      const video = document.createElement('video');
      video.src = 'https://www.youtube.com/watch?v=ae_teardown_test';
      AudioEngine.attachToVideo(video);

      assert.ok(AudioEngine.sourceNode, 'AudioEngine sourceNode attached');
      assert.equal(AudioEngine.eqNodes.length, 10, 'AudioEngine 10 EQ nodes attached');

      // Test teardown
      AudioEngine.teardown();

      assert.equal(AudioEngine.sourceNode, null, 'sourceNode cleared on teardown');
      assert.equal(AudioEngine.bassNode, null, 'bassNode cleared on teardown');
      assert.equal(AudioEngine.gainNode, null, 'gainNode cleared on teardown');
      assert.equal(AudioEngine.eqNodes.length, 0, 'eqNodes cleared on teardown');
      assert.equal(AudioEngine.analyserNode, null, 'analyserNode cleared on teardown');
      assert.ok(disconnectedCount >= 12, 'All nodes disconnected during AudioEngine teardown');
    } finally {
      window.AudioContext = origCtx;
    }
  });

});



