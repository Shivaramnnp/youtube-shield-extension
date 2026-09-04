/**
 * Tier 1: M1 Empirical Challenger Re-Verification Suite
 * Tests utils/storage.js under non-extension Node environment without global chrome,
 * and tests utils/audio-engine.js exception handling when AudioContext constructor throws.
 */

const { execSync } = require('node:child_process');
const path = require('node:path');
const { test, describe, assert } = require('../harness/test-helpers');
const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../../utils/storage.js');
const AudioEngine = require('../../utils/audio-engine.js');

describe('M1 Challenger Re-Verification: Storage & Audio Engine Defect Sweep', () => {

  test('M1.1-CHALLENGE: utils/storage.js loads cleanly without global chrome in isolated non-extension Node process', () => {
    const projectRoot = path.resolve(__dirname, '../../');
    assert.doesNotThrow(() => {
      const output = execSync(
        'node -e "delete global.chrome; const { StorageUtil } = require(\'./utils/storage.js\'); if (StorageUtil.isContextValid() !== false) process.exit(1);"',
        { cwd: projectRoot, stdio: 'pipe', encoding: 'utf8' }
      );
    }, 'utils/storage.js top-level evaluation succeeds cleanly in non-extension Node process without ReferenceError');
  });

  test('M1.1-CHALLENGE: StorageUtil fallbacks to memory cache/defaults when chrome is undefined', async () => {
    const origChrome = global.chrome;
    try {
      delete global.chrome;
      StorageUtil.clearMemoryCache();

      const settings = await StorageUtil.getSettings();
      assert.deepEqual(settings.uiCleaner, DEFAULT_SETTINGS.uiCleaner, 'getSettings() falls back to DEFAULT_SETTINGS schema');

      const tracking = await StorageUtil.getTracking();
      assert.deepEqual(tracking.gamification.rankTier, DEFAULT_TRACKING.gamification.rankTier, 'getTracking() falls back to DEFAULT_TRACKING schema');

      // Test updating settings without chrome
      await StorageUtil.updateSetting('shortsBlocker', false);
      const updatedSettings = await StorageUtil.getSettings();
      assert.equal(updatedSettings.shortsBlocker, false, 'updateSetting updates memory settings cache safely');
    } finally {
      global.chrome = origChrome;
      StorageUtil.clearMemoryCache();
    }
  });

  test('M1.2-CHALLENGE: AudioEngine safely catches throwing AudioContext constructor during all sound play calls', () => {
    const origWindow = global.window;
    
    try {
      global.window = global.window || {};
      // Mock AudioContext constructor to throw an error (simulating browser autoplay policy or AudioContext block)
      global.window.AudioContext = class {
        constructor() {
          throw new Error('NotAllowedError: AudioContext construction failed by autoplay policy');
        }
      };
      global.window.webkitAudioContext = undefined;

      AudioEngine.ctx = null;
      AudioEngine.enabled = true;

      assert.doesNotThrow(() => {
        AudioEngine.playClick();
        AudioEngine.playLevelUp();
        AudioEngine.playBadgeUnlock();
        AudioEngine.playAlarm();
      }, 'All sound play methods (playClick, playLevelUp, playBadgeUnlock, playAlarm) catch constructor throw safely');

      assert.equal(AudioEngine.ctx, null, 'AudioEngine.ctx remains null after constructor failure');
    } finally {
      global.window = origWindow;
    }
  });

  test('M1.2-CHALLENGE: AudioEngine safely catches throwing webkitAudioContext constructor', () => {
    const origWindow = global.window;
    
    try {
      global.window = global.window || {};
      global.window.AudioContext = undefined;
      global.window.webkitAudioContext = function() {
        throw new DOMException('NotAllowedError: WebKit WebAudio disabled');
      };

      AudioEngine.ctx = null;
      AudioEngine.enabled = true;

      assert.doesNotThrow(() => {
        AudioEngine.playClick();
        AudioEngine.playLevelUp();
        AudioEngine.playBadgeUnlock();
        AudioEngine.playAlarm();
      }, 'Sound play methods catch webkitAudioContext constructor throw safely');

      assert.equal(AudioEngine.ctx, null, 'AudioEngine.ctx remains null');
    } finally {
      global.window = origWindow;
    }
  });

  test('M1.2-CHALLENGE: AudioEngine handles suspended context with failing resume() or createOscillator()', () => {
    const origWindow = global.window;
    
    try {
      global.window = global.window || {};
      global.window.AudioContext = class {
        constructor() {
          this.state = 'suspended';
        }
        resume() {
          return Promise.reject(new Error('Resume failed'));
        }
        createOscillator() {
          throw new Error('createOscillator failed unexpectedly');
        }
      };

      AudioEngine.ctx = null;
      AudioEngine.enabled = true;

      assert.doesNotThrow(() => {
        AudioEngine.playClick();
        AudioEngine.playLevelUp();
        AudioEngine.playBadgeUnlock();
        AudioEngine.playAlarm();
      }, 'Suspended context resume/oscillator failure caught without exception');
    } finally {
      global.window = origWindow;
    }
  });

  test('M1.3-REVERIFY: VolumeBooster.setVolume(0) mutes volume to 0%', () => {
    const VolumeBooster = require('../../content/js/volume-booster.js');
    VolumeBooster.setVolume(0);
    assert.equal(VolumeBooster.getVolume(), 0, 'VolumeBooster.getVolume() returns 0 when set to 0%');
  });

  test('M1.3-REVERIFY: AudioEngine.setVolume(6.1) clamps multiplier gain to 6.0 (600%)', () => {
    const origCtx = AudioEngine.ctx;
    const origGainNode = AudioEngine.gainNode;
    try {
      AudioEngine.gainNode = { gain: { value: 1.0 } };
      AudioEngine.setVolume(6.1);
      assert.equal(AudioEngine._volumeLevel, 600, 'AudioEngine._volumeLevel clamped to 600%');
      assert.equal(AudioEngine.gainNode.gain.value, 6.0, 'AudioEngine gain node clamped to 6.0');
    } finally {
      AudioEngine.ctx = origCtx;
      AudioEngine.gainNode = origGainNode;
    }
  });

});
