/**
 * Challenger M4 Empirical Stress & Adversarial Verification Suite
 * Exhaustively stress-tests:
 * 1. Safari WebKit 6-event gesture unlock under rapid / burst user events & suspended re-arming.
 * 2. videoSourceCache WeakMap node caching across rapid DOM video re-creations & InvalidStateError prevention.
 * 3. disconnect() and teardown() lifecycle safety & memory leak prevention.
 * 4. 10-Band Graphic Equalizer, preset switching, gain clamping, tone synthesis cleanup.
 * 5. Real-time AnalyserNode byte extraction & multi-tier storage synchronization.
 */

const fs = require('fs');
const path = require('path');
const { setupMockEnv } = require('./harness/mock-extension-env');

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    testsFailed++;
    failures.push(message);
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

function doesNotThrow(fn, message) {
  try {
    fn();
    assert(true, message);
  } catch (err) {
    assert(false, `${message} (Threw: ${err.message})`);
  }
}

async function runChallengerM4StressSuite() {
  console.log("==========================================================================");
  console.log("=== STARTING CHALLENGER M4 ADVERSARIAL STRESS & EMPIRICAL VERIFICATION ===");
  console.log("==========================================================================");

  const env = setupMockEnv();

  // Load core modules
  const AudioEngine = require('../utils/audio-engine');
  const VolumeBooster = require('../content/js/volume-booster');
  const { StorageUtil, DEFAULT_SETTINGS } = require('../utils/storage');

  // ===================================================================================
  // SECTION 1: SAFARI WEBKIT 6-EVENT GESTURE UNLOCK ADVERSARIAL STRESS
  // ===================================================================================
  console.log("\n--- SECTION 1: Safari WebKit 6-Event Gesture Unlock Adversarial Stress ---");

  const gestureEvents = ['click', 'touchstart', 'touchend', 'keydown', 'mousedown', 'pointerdown'];
  const mediaEvents = ['play', 'playing'];
  const allUnlockEvents = [...gestureEvents, ...mediaEvents];

  // 1.1 Test each individual gesture event unlocks suspended AudioContext
  for (const evtName of allUnlockEvents) {
    let resumeCalls = 0;

    class MockUnlockContext {
      constructor() {
        this.state = 'suspended';
        this.destination = {};
        this.onstatechange = null;
      }
      resume() {
        resumeCalls++;
        this.state = 'running';
        return Promise.resolve();
      }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockUnlockContext;
      AudioEngine.ctx = null;
      AudioEngine.initContext();
      AudioEngine.ctx.state = 'suspended';
      AudioEngine.attachGestureUnlock();

      const video = document.createElement('video');
      video.className = 'html5-main-video';
      document.body.appendChild(video);
      AudioEngine.attachGestureUnlock();

      // Dispatch event on video, document, and window
      const evt = new Event(evtName, { bubbles: true });
      video.dispatchEvent(evt);

      await new Promise(r => setTimeout(r, 10));

      assert(resumeCalls >= 1, `Gesture/Media event '${evtName}' successfully called AudioContext.resume()`);
      assert(AudioEngine.ctx.state === 'running', `AudioContext state transitioned to 'running' after '${evtName}'`);

      video.remove();
    } finally {
      window.AudioContext = origCtx;
    }
  }

  // 1.2 Rapid burst of 100 mixed user gesture events while suspended
  console.log("\n  - Subtest 1.2: Rapid burst of 100 mixed gesture events");
  let burstResumeCalls = 0;
  class MockBurstContext {
    constructor() {
      this.state = 'suspended';
      this.destination = {};
      this.onstatechange = null;
    }
    resume() {
      burstResumeCalls++;
      this.state = 'running';
      return Promise.resolve();
    }
  }

  const origCtxBurst = window.AudioContext;
  try {
    window.AudioContext = MockBurstContext;
    AudioEngine.ctx = null;
    AudioEngine.initContext();
    AudioEngine.ctx.state = 'suspended';
    AudioEngine.attachGestureUnlock();

    // Dispatch 100 rapid events
    for (let i = 0; i < 100; i++) {
      const randomEvt = allUnlockEvents[i % allUnlockEvents.length];
      window.dispatchEvent(new Event(randomEvt, { bubbles: true }));
      document.dispatchEvent(new Event(randomEvt, { bubbles: true }));
    }

    await new Promise(r => setTimeout(r, 20));
    assert(burstResumeCalls > 0, "Rapid burst of 100 gesture events unlocked context");
    assert(AudioEngine.ctx.state === 'running', "AudioContext remained in 'running' state after burst");
  } finally {
    window.AudioContext = origCtxBurst;
  }

  // 1.3 Repeated Suspended <-> Running Cycles (e.g. Tab Backgrounding / Bluetooth Reconnect)
  console.log("\n  - Subtest 1.3: Re-arming unlock handler across 20 suspended/running cycles");
  let cycleResumes = 0;
  class MockCyclingContext {
    constructor() {
      this.state = 'running';
      this.destination = {};
      this.onstatechange = null;
    }
    resume() {
      cycleResumes++;
      this.state = 'running';
      return Promise.resolve();
    }
  }

  try {
    window.AudioContext = MockCyclingContext;
    AudioEngine.ctx = null;
    AudioEngine.initContext();

    for (let cycle = 0; cycle < 20; cycle++) {
      // Transition to suspended
      AudioEngine.ctx.state = 'suspended';
      if (typeof AudioEngine.ctx.onstatechange === 'function') {
        AudioEngine.ctx.onstatechange();
      }

      // Trigger gesture
      const chosenEvent = gestureEvents[cycle % gestureEvents.length];
      window.dispatchEvent(new Event(chosenEvent, { bubbles: true }));
      await new Promise(r => setTimeout(r, 5));

      assert(AudioEngine.ctx.state === 'running', `Cycle ${cycle + 1}/20: State returned to 'running' on '${chosenEvent}'`);
    }

    assert(cycleResumes >= 20, `AudioContext resumed at least 20 times across all cycles (total: ${cycleResumes})`);
  } finally {
    window.AudioContext = origCtxBurst;
  }

  // ===================================================================================
  // SECTION 2: WEAKMAP NODE CACHING & WEBKIT INVALIDSTATEERROR PREVENTION
  // ===================================================================================
  console.log("\n--- SECTION 2: WeakMap Node Caching & WebKit InvalidStateError Stress ---");

  let createSourceCallCount = 0;
  class MockSourceNode {
    connect() {}
    disconnect() {}
  }
  class MockCachingContext {
    constructor() {
      this.state = 'running';
      this.destination = {};
    }
    createMediaElementSource(el) {
      createSourceCallCount++;
      return new MockSourceNode();
    }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
    createBiquadFilter() { return { type: 'lowshelf', frequency: { value: 150 }, gain: { value: 0 }, Q: { value: 1 }, connect() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, frequencyBinCount: 64, getByteFrequencyData() {}, connect() {}, disconnect() {} }; }
  }

  const origContextCaching = window.AudioContext;
  try {
    window.AudioContext = MockCachingContext;
    AudioEngine.ctx = null;
    AudioEngine.videoSourceCache = new WeakMap();
    AudioEngine._attachedSourceMap = AudioEngine.videoSourceCache;

    // 2.1 Re-attaching same video 100 times does not re-create source node
    console.log("\n  - Subtest 2.1: 100 consecutive attaches on the same video element");
    createSourceCallCount = 0;
    const stableVideo = document.createElement('video');
    stableVideo.src = 'https://www.youtube.com/watch?v=stable_video';

    for (let i = 0; i < 100; i++) {
      AudioEngine.attachToVideo(stableVideo);
    }
    assert(createSourceCallCount === 1, `createMediaElementSource called exactly 1 time across 100 attaches (got ${createSourceCallCount})`);
    assert(AudioEngine.videoSourceCache.has(stableVideo), "videoSourceCache retains entry for stable video");

    // 2.2 Re-creating 50 new video elements (simulating rapid SPA video recycling)
    console.log("\n  - Subtest 2.2: 50 distinct video elements attached sequentially");
    createSourceCallCount = 0;
    const videoList = [];
    for (let i = 0; i < 50; i++) {
      const v = document.createElement('video');
      v.src = `https://www.youtube.com/watch?v=vid_${i}`;
      videoList.push(v);
      AudioEngine.attachToVideo(v);
      assert(v._ssMediaSourceNode !== undefined, `DOM fallback _ssMediaSourceNode set on video ${i}`);
      assert(AudioEngine.videoSourceCache.has(v), `videoSourceCache has video ${i}`);
    }
    assert(createSourceCallCount === 50, `Exactly 50 source nodes created for 50 distinct videos (got ${createSourceCallCount})`);

    // 2.3 Re-visiting all 50 videos again -> 0 new source node creations
    console.log("\n  - Subtest 2.3: Re-visiting 50 previously attached videos (cache hit verification)");
    const prevCount = createSourceCallCount;
    for (let i = 0; i < 50; i++) {
      AudioEngine.attachToVideo(videoList[i]);
    }
    assert(createSourceCallCount === prevCount, `0 new source nodes created when revisiting 50 cached videos (got ${createSourceCallCount - prevCount} new)`);

    // 2.4 Fallback to DOM property _ssMediaSourceNode when WeakMap is cleared
    console.log("\n  - Subtest 2.4: DOM property fallback when WeakMap entry is lost");
    const fallbackVideo = document.createElement('video');
    fallbackVideo.src = 'https://www.youtube.com/watch?v=fallback_test';
    AudioEngine.attachToVideo(fallbackVideo);
    const countBeforeFallback = createSourceCallCount;

    // Manually delete from WeakMap
    AudioEngine.videoSourceCache.delete(fallbackVideo);
    AudioEngine._connectedVideo = null;

    // Attach again -> should use fallbackVideo._ssMediaSourceNode
    AudioEngine.attachToVideo(fallbackVideo);
    assert(createSourceCallCount === countBeforeFallback, "createMediaElementSource NOT called again (DOM property fallback hit)");

    // 2.5 WebKit InvalidStateError DOMException Graceful Recovery
    console.log("\n  - Subtest 2.5: WebKit InvalidStateError DOMException Resilience");
    class MockThrowingContext {
      constructor() { this.state = 'running'; this.destination = {}; }
      createMediaElementSource() {
        const err = new Error('InvalidStateError: HTMLMediaElement already connected to another MediaElementSourceNode');
        err.name = 'InvalidStateError';
        throw err;
      }
      createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
      createBiquadFilter() { return { type: 'lowshelf', frequency: { value: 150 }, gain: { value: 0 }, Q: { value: 1 }, connect() {}, disconnect() {} }; }
      createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, frequencyBinCount: 64, getByteFrequencyData() {}, connect() {}, disconnect() {} }; }
    }

    window.AudioContext = MockThrowingContext;
    AudioEngine.ctx = null;
    AudioEngine.videoSourceCache = new WeakMap();

    const throwingVideo = document.createElement('video');
    throwingVideo.src = 'https://www.youtube.com/watch?v=throwing_vid';

    let attachRes = false;
    doesNotThrow(() => {
      attachRes = AudioEngine.attachToVideo(throwingVideo);
    }, "attachToVideo does NOT throw unhandled exception when WebKit throws InvalidStateError");
    assert(attachRes === true, "attachToVideo returns true safely to preserve video playback");

    // 2.6 CORS crossOrigin Configuration Verification
    console.log("\n  - Subtest 2.6: Media Element CORS crossOrigin safety");
    const stdVideo = document.createElement('video');
    stdVideo.src = 'https://rr1---sn-ab5sznzl.googlevideo.com/videoplayback?id=123';
    AudioEngine.attachToVideo(stdVideo);
    assert(stdVideo.getAttribute('crossorigin') === 'anonymous', "Standard video gets crossorigin='anonymous' attribute");
    assert(stdVideo.crossOrigin === 'anonymous', "Standard video gets crossOrigin='anonymous' property");

    const blobVideo = document.createElement('video');
    blobVideo.src = 'blob:https://www.youtube.com/abcdef-1234-5678';
    AudioEngine.attachToVideo(blobVideo);
    assert(blobVideo.hasAttribute('crossorigin') === false, "Blob URL video does NOT get crossorigin attribute forced (prevents decode errors)");
  } finally {
    window.AudioContext = origContextCaching;
  }

  // ===================================================================================
  // SECTION 3: DISCONNECT() AND TEARDOWN() LIFECYCLE SAFETY & MEMORY LEAK RESILIENCE
  // ===================================================================================
  console.log("\n--- SECTION 3: Disconnect() and Teardown() Lifecycle Safety ---");

  let totalDisconnectCalls = 0;
  class MockDisconnectNode {
    connect() {}
    disconnect() {
      totalDisconnectCalls++;
    }
  }

  class MockTeardownContext {
    constructor() { this.state = 'running'; this.destination = {}; }
    createMediaElementSource() { return new MockDisconnectNode(); }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() { totalDisconnectCalls++; } }; }
    createBiquadFilter() { return { type: 'lowshelf', frequency: { value: 150 }, gain: { value: 0 }, Q: { value: 1 }, connect() {}, disconnect() { totalDisconnectCalls++; } }; }
    createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, frequencyBinCount: 64, getByteFrequencyData() {}, connect() {}, disconnect() { totalDisconnectCalls++; } }; }
  }

  const origContextTeardown = window.AudioContext;
  try {
    window.AudioContext = MockTeardownContext;

    // 3.1 AudioEngine Rapid Connect / Disconnect / Teardown Cycle (50 iterations)
    console.log("\n  - Subtest 3.1: AudioEngine 50 rapid connect/disconnect/teardown cycles");
    for (let i = 0; i < 50; i++) {
      AudioEngine.ctx = null;
      AudioEngine.sourceNode = null;
      AudioEngine.eqNodes = [];
      const testVid = document.createElement('video');
      testVid.src = `https://www.youtube.com/watch?v=cycle_${i}`;

      AudioEngine.attachToVideo(testVid);
      assert(AudioEngine.sourceNode !== null, `Cycle ${i}: sourceNode attached`);
      assert(AudioEngine.eqNodes.length === 10, `Cycle ${i}: 10 EQ nodes attached`);

      // Teardown
      AudioEngine.teardown();
      assert(AudioEngine.sourceNode === null, `Cycle ${i}: sourceNode cleared on teardown`);
      assert(AudioEngine.bassNode === null, `Cycle ${i}: bassNode cleared on teardown`);
      assert(AudioEngine.gainNode === null, `Cycle ${i}: gainNode cleared on teardown`);
      assert(AudioEngine.eqNodes.length === 0, `Cycle ${i}: eqNodes cleared on teardown`);
      assert(AudioEngine.analyserNode === null, `Cycle ${i}: analyserNode cleared on teardown`);
    }
    assert(totalDisconnectCalls > 500, `Nodes properly disconnected across all 50 cycles (total disconnects: ${totalDisconnectCalls})`);

    // 3.2 VolumeBooster Standalone Connect / Teardown Cycle (50 iterations)
    console.log("\n  - Subtest 3.2: VolumeBooster standalone 50 rapid connect/disconnect/teardown cycles");
    const origAEWindow = window.AudioEngine;
    const origAEGlobal = global.AudioEngine;
    try {
      delete window.AudioEngine;
      delete global.AudioEngine;

      for (let i = 0; i < 50; i++) {
        VolumeBooster.ctx = null;
        VolumeBooster.sourceNode = null;
        VolumeBooster.eqNodes = [];

        const vid = document.createElement('video');
        vid.className = 'html5-main-video';
        document.body.appendChild(vid);

        VolumeBooster.connect();
        assert(VolumeBooster.sourceNode !== null, `VB Standalone Cycle ${i}: sourceNode connected`);
        assert(VolumeBooster.eqNodes.length === 10, `VB Standalone Cycle ${i}: 10 EQ nodes connected`);

        VolumeBooster.teardown();
        assert(VolumeBooster.sourceNode === null, `VB Standalone Cycle ${i}: sourceNode cleared on teardown`);
        assert(VolumeBooster.eqNodes.length === 0, `VB Standalone Cycle ${i}: eqNodes cleared on teardown`);

        vid.remove();
      }
    } finally {
      window.AudioEngine = origAEWindow;
      global.AudioEngine = origAEGlobal;
    }

    // 3.3 Multiple Consecutive Teardown Calls Idempotency
    console.log("\n  - Subtest 3.3: Consecutive teardown calls idempotency");
    doesNotThrow(() => {
      AudioEngine.teardown();
      AudioEngine.teardown();
      AudioEngine.teardown();
      AudioEngine.disconnect();
      AudioEngine.disconnect();
      VolumeBooster.teardown();
      VolumeBooster.teardown();
      VolumeBooster.disconnect();
    }, "Multiple consecutive teardown/disconnect calls execute safely without throwing");

    // 3.4 Tone Synthesis Node Auto-Cleanup on onended
    console.log("\n  - Subtest 3.4: Sound effects oscillator and gain node cleanup onended");
    let oscDisconnected = false;
    let gainDisconnected = false;

    class MockToneContext {
      constructor() {
        this.currentTime = 0;
        this.destination = {};
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: { setValueAtTime() {} },
          connect() {},
          disconnect() { oscDisconnected = true; },
          start() {},
          stop() {},
          onended: null
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
          disconnect() { gainDisconnected = true; }
        };
      }
    }

    window.AudioContext = MockToneContext;
    AudioEngine.ctx = null;
    AudioEngine.initContext();

    // Trigger playTone
    let capturedOsc = null;
    const origCreateOsc = AudioEngine.ctx.createOscillator;
    AudioEngine.ctx.createOscillator = function() {
      capturedOsc = origCreateOsc.call(this);
      return capturedOsc;
    };

    AudioEngine.playTone(440, 'sine', 0.1);
    assert(capturedOsc !== null, "Oscillator created for playTone");
    assert(typeof capturedOsc.onended === 'function', "Oscillator has onended cleanup handler");

    capturedOsc.onended();
    assert(oscDisconnected === true, "Oscillator disconnected on ended");
    assert(gainDisconnected === true, "Gain node disconnected on ended");

  } finally {
    window.AudioContext = origContextTeardown;
  }

  // ===================================================================================
  // SECTION 4: 10-BAND GRAPHIC EQUALIZER ENGINE, PRESETS & GAIN CLAMPING
  // ===================================================================================
  console.log("\n--- SECTION 4: 10-Band Graphic Equalizer Engine & Presets ---");

  const ALL_PRESETS = {
    'Flat':          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'Bass Boost':    [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
    'Vocal Booster': [-2, -1, 0, 2, 4, 5, 4, 2, 0, -1],
    'Treble Boost':  [0, 0, 0, 0, 0, 1, 3, 5, 7, 8],
    'Rock':          [5, 4, 3, 1, -1, -1, 0, 2, 4, 5],
    'Pop':           [-1, 2, 4, 5, 4, 0, -1, 1, 3, 4],
    'Acoustic':      [3, 2, 1, 2, 3, 3, 2, 3, 2, 1],
    'Electronic':    [6, 5, 2, 0, -2, 2, 1, 2, 4, 5]
  };

  // 4.1 Verify all presets on AudioEngine and VolumeBooster
  for (const [name, expectedGains] of Object.entries(ALL_PRESETS)) {
    const aeRes = AudioEngine.setEqPreset(name);
    assert(aeRes === true, `AudioEngine.setEqPreset('${name}') returns true`);
    assert(AudioEngine.getEqPreset() === name, `AudioEngine preset is '${name}'`);
    assert(JSON.stringify(AudioEngine.getEqGains()) === JSON.stringify(expectedGains), `AudioEngine gains match '${name}' preset array`);

    const vbRes = VolumeBooster.setEqPreset(name);
    assert(vbRes === true, `VolumeBooster.setEqPreset('${name}') returns true`);
    assert(VolumeBooster.getEqPreset() === name, `VolumeBooster preset is '${name}'`);
    assert(JSON.stringify(VolumeBooster.getEqGains()) === JSON.stringify(expectedGains), `VolumeBooster gains match '${name}' preset array`);
  }

  // 4.2 Adversarial Gain Clamping on All 10 Bands
  console.log("\n  - Subtest 4.2: Adversarial Gain Clamping (-12dB to +12dB)");
  for (let band = 0; band < 10; band++) {
    AudioEngine.setEqPreset('Flat');
    AudioEngine.setEqBandGain(band, 999);
    assert(AudioEngine.getEqGains()[band] === 12, `Band ${band} clamped to +12dB max on 999dB input`);

    AudioEngine.setEqBandGain(band, -999);
    assert(AudioEngine.getEqGains()[band] === -12, `Band ${band} clamped to -12dB min on -999dB input`);

    AudioEngine.setEqBandGain(band, NaN);
    assert(AudioEngine.getEqGains()[band] === 0, `Band ${band} defaults to 0dB on NaN input`);

    AudioEngine.setEqBandGain(band, Infinity);
    assert(AudioEngine.getEqGains()[band] === 12, `Band ${band} clamped to +12dB on Infinity input`);

    AudioEngine.setEqBandGain(band, -Infinity);
    assert(AudioEngine.getEqGains()[band] === -12, `Band ${band} clamped to -12dB on -Infinity input`);
  }

  // Invalid band indices
  assert(AudioEngine.setEqBandGain(-1, 5) === false, "Negative band index (-1) rejected");
  assert(AudioEngine.setEqBandGain(10, 5) === false, "Out of bounds band index (10) rejected");
  assert(AudioEngine.setEqBandGain("invalid", 5) === false, "String non-number index rejected");

  // 4.3 EQ Master Enable / Disable Toggle State Preservation
  console.log("\n  - Subtest 4.3: EQ Master Enable/Disable state preservation");
  AudioEngine.setEqPreset('Rock');
  const rockGains = AudioEngine.getEqGains();

  AudioEngine.setEqEnabled(false);
  assert(AudioEngine.eqEnabled === false, "AudioEngine.eqEnabled is false");
  assert(JSON.stringify(AudioEngine.getEqGains()) === JSON.stringify(rockGains), "Stored Rock gains preserved when eqEnabled is false");

  AudioEngine.setEqEnabled(true);
  assert(AudioEngine.eqEnabled === true, "AudioEngine.eqEnabled is true");
  assert(JSON.stringify(AudioEngine.getEqGains()) === JSON.stringify(rockGains), "Stored Rock gains active when eqEnabled is true");

  // ===================================================================================
  // SECTION 5: REAL-TIME ANALYSERNODE FREQUENCY DATA & STORAGE PERSISTENCE
  // ===================================================================================
  console.log("\n--- SECTION 5: AnalyserNode Byte Extraction & Storage Persistence ---");

  // 5.1 Analyser frequency data byte extraction
  const mockFreqData = AudioEngine.getFrequencyData();
  assert(mockFreqData instanceof Uint8Array, "getFrequencyData() returns Uint8Array");
  assert(mockFreqData.length === 64, "getFrequencyData() returns 64 frequency bins");

  const vbFreqData = VolumeBooster.getFrequencyData();
  assert(vbFreqData instanceof Uint8Array, "VolumeBooster.getFrequencyData() returns Uint8Array");
  assert(vbFreqData.length === 64, "VolumeBooster.getFrequencyData() returns 64 frequency bins");

  // 5.2 Multi-Tier Storage Persistence & Sync for 10-Band EQ Settings
  console.log("\n  - Subtest 5.2: Multi-Tier Storage Persistence & Sync");
  await StorageUtil.updateVolumeBoosterSetting('preset', 'Electronic');
  await StorageUtil.updateVolumeBoosterSetting('eqGains', [6, 5, 2, 0, -2, 2, 1, 2, 4, 5]);
  await StorageUtil.updateVolumeBoosterSetting('eqEnabled', true);
  await StorageUtil.updateVolumeBoosterSetting('volumeLevel', 300);
  await StorageUtil.updateVolumeBoosterSetting('bassLevel', 16);

  const storedSettings = await StorageUtil.getSettings();
  assert(storedSettings.volumeBooster.preset === 'Electronic', "preset 'Electronic' persisted in storage");
  assert(JSON.stringify(storedSettings.volumeBooster.eqGains) === JSON.stringify([6, 5, 2, 0, -2, 2, 1, 2, 4, 5]), "eqGains persisted in storage");
  assert(storedSettings.volumeBooster.eqEnabled === true, "eqEnabled persisted in storage");
  assert(storedSettings.volumeBooster.volumeLevel === 300, "volumeLevel 300 persisted in storage");
  assert(storedSettings.volumeBooster.bassLevel === 16, "bassLevel 16 persisted in storage");

  // Clean up settings back to defaults
  await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS });

  // ===================================================================================
  // SUMMARY
  // ===================================================================================
  console.log("\n==========================================================================");
  console.log(`TOTAL CHALLENGER M4 STRESS TESTS EXECUTED: ${testsPassed + testsFailed}`);
  console.log(`PASSED: ${testsPassed}`);
  console.log(`FAILED: ${testsFailed}`);
  console.log("==========================================================================");

  if (testsFailed > 0) {
    console.error("FAILURES DETECTED:");
    failures.forEach(f => console.error(" - " + f));
    process.exit(1);
  } else {
    console.log("ALL CHALLENGER M4 EMPIRICAL STRESS TESTS PASSED 100% CLEANLY! ✅");
    process.exit(0);
  }
}

runChallengerM4StressSuite();
