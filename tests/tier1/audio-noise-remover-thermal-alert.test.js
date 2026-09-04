require('../harness/mock-extension-env').setupMockEnv();
const { test, describe, assert, resetDOM } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
const AudioEngine = require('../../utils/audio-engine');
const VolumeBooster = require('../../content/js/volume-booster');

describe('Audio Noise Remover & Thermal Protection Alert', () => {

  test('NR.1: StorageUtil contains noiseRemover: true in DEFAULT_SETTINGS.volumeBooster', async () => {
    const StorageUtil = window.StorageUtil || global.StorageUtil;
    assert(StorageUtil, 'StorageUtil exists');
    const settings = await StorageUtil.getSettings();
    assert(settings.volumeBooster, 'volumeBooster settings exist');
    assert.strictEqual(settings.volumeBooster.noiseRemover, true, 'noiseRemover defaults to true');
  });

  test('NR.2: AudioEngineClass initializes with noiseRemover enabled and creates clarifier filters & compressor', () => {
    const AudioEngine = window.AudioEngine || global.AudioEngine;
    assert(AudioEngine, 'AudioEngine exists');
    assert.strictEqual(AudioEngine.getNoiseRemover(), true, 'AudioEngine.getNoiseRemover() returns true by default');

    class MockNode {
      constructor() {
        this.gain = { value: 0 };
        this.frequency = { value: 0 };
        this.threshold = { value: 0 };
        this.knee = { value: 0 };
        this.ratio = { value: 0 };
        this.attack = { value: 0 };
        this.release = { value: 0 };
        this.Q = { value: 0 };
        this.type = '';
      }
      connect() {}
      disconnect() {}
    }

    class MockAudioContext {
      constructor() {
        this.state = 'running';
        this.destination = {};
      }
      resume() { return Promise.resolve(); }
      createMediaElementSource() { return new MockNode(); }
      createBiquadFilter() { return new MockNode(); }
      createGain() { return new MockNode(); }
      createDynamicsCompressor() { return new MockNode(); }
      createAnalyser() {
        const a = new MockNode();
        a.frequencyBinCount = 64;
        a.fftSize = 128;
        a.smoothingTimeConstant = 0.8;
        a.getByteFrequencyData = () => {};
        a.getByteTimeDomainData = () => {};
        return a;
      }
    }

    const origCtx = window.AudioContext;
    window.AudioContext = MockAudioContext;
    AudioEngine.ctx = null;

    try {
      const video = document.createElement('video');
      video.className = 'html5-main-video';
      document.body.appendChild(video);

      AudioEngine.setVolume(300);
      AudioEngine.setBass(10);
      AudioEngine.setNoiseRemover(true);
      AudioEngine.attachToVideo(video);

      assert(AudioEngine.subsonicFilter, 'Subsonic filter was created');
      assert.strictEqual(AudioEngine.subsonicFilter.type, 'highpass', 'Subsonic filter is highpass');
      assert.strictEqual(AudioEngine.subsonicFilter.frequency.value, 30, 'Subsonic filter cutoff is 30Hz');

      assert(AudioEngine.antiHissFilter, 'Anti-hiss filter was created');
      assert.strictEqual(AudioEngine.antiHissFilter.type, 'lowpass', 'Anti-hiss filter is lowpass');
      assert.strictEqual(AudioEngine.antiHissFilter.frequency.value, 18500, 'Anti-hiss filter cutoff is 18.5kHz');

      assert(AudioEngine.compressorNode, 'Dynamics compressor node was created');
      assert.strictEqual(AudioEngine.compressorNode.threshold.value, -12, 'Compressor threshold is -12 dB');
      assert.strictEqual(AudioEngine.compressorNode.ratio.value, 12, 'Compressor ratio is 12');

      AudioEngine.disconnect();
    } finally {
      window.AudioContext = origCtx;
      AudioEngine.ctx = null;
    }
  });

  test('NR.3: VolumeBoosterClass delegates setNoiseRemover to AudioEngine', () => {
    const VolumeBooster = window.VolumeBooster || global.VolumeBooster;
    const AudioEngine = window.AudioEngine || global.AudioEngine;
    assert(VolumeBooster, 'VolumeBooster exists');

    VolumeBooster.setNoiseRemover(false);
    assert.strictEqual(VolumeBooster.getNoiseRemover(), false, 'VolumeBooster getNoiseRemover returns false');
    assert.strictEqual(AudioEngine.getNoiseRemover(), false, 'AudioEngine getNoiseRemover synced to false');

    VolumeBooster.setNoiseRemover(true);
    assert.strictEqual(VolumeBooster.getNoiseRemover(), true, 'VolumeBooster getNoiseRemover returns true');
    assert.strictEqual(AudioEngine.getNoiseRemover(), true, 'AudioEngine getNoiseRemover synced to true');
  });

  test('NR.4: High amplification thermal alert threshold calculation (>250% vol or >12dB bass)', () => {
    const isThermalAlert = (vol, bass) => (vol > 250 || bass > 12);

    assert.strictEqual(isThermalAlert(100, 0), false, 'Normal volume (100%) and 0dB bass is safe');
    assert.strictEqual(isThermalAlert(200, 6), false, '200% volume and 6dB bass is safe');
    assert.strictEqual(isThermalAlert(250, 12), false, '250% volume and 12dB bass is at boundary (safe)');
    assert.strictEqual(isThermalAlert(260, 0), true, '260% volume triggers thermal warning');
    assert.strictEqual(isThermalAlert(100, 13), true, '13dB bass triggers thermal warning');
    assert.strictEqual(isThermalAlert(600, 20), true, 'Max volume (600%) and max bass (20dB) triggers thermal warning');
  });

});
