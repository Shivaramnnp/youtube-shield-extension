/**
 * Tier 3: Safari Web Audio Page DSP Bridge & CustomEvent IPC Interaction Test Suite
 * Validates cross-world audio synchronization, gesture unlocking, and node processing.
 */

require("../harness/mock-extension-env");
const { test, describe, assert, createMockStorage, resetStorage } = require("../harness/test-helpers");

function reloadPageAudioDsp() {
  delete window.__SS_PAGE_AUDIO_DSP_INITIALIZED__;
  delete window.__SS_PAGE_AUDIO_DSP__;
  try {
    delete require.cache[require.resolve("../../content/js/page-audio-dsp")];
  } catch (e) {}
  return require("../../content/js/page-audio-dsp");
}

describe("Tier 3: Safari Web Audio Page DSP Bridge & CustomEvent Synchronization", () => {

  test("Page Audio DSP Engine initializes on window.__SS_PAGE_AUDIO_DSP__ with clean reload", () => {
    reloadPageAudioDsp();

    assert.ok(window.__SS_PAGE_AUDIO_DSP__, "Page audio DSP instance attached to window");
    assert.equal(typeof window.__SS_PAGE_AUDIO_DSP__.setVolume, "function", "setVolume exists");
    assert.equal(typeof window.__SS_PAGE_AUDIO_DSP__.setBass, "function", "setBass exists");
    assert.equal(typeof window.__SS_PAGE_AUDIO_DSP__.setEqGains, "function", "setEqGains exists");
    assert.equal(typeof window.__SS_PAGE_AUDIO_DSP__.setEqPreset, "function", "setEqPreset exists");
    assert.equal(typeof window.__SS_PAGE_AUDIO_DSP__.setEqEnabled, "function", "setEqEnabled exists");
    assert.equal(typeof window.__SS_PAGE_AUDIO_DSP__.attachToVideo, "function", "attachToVideo exists");
    assert.equal(typeof window.__SS_PAGE_AUDIO_DSP__.unlock, "function", "unlock exists");
  });

  test("VolumeBooster injects page-audio-dsp script tag and dispatches __SS_AUDIO_UPDATE__ on all controls", () => {
    require("../../content/js/volume-booster");
    const vb = window.VolumeBooster;
    assert.ok(vb, "VolumeBooster instance available");

    let receivedEvents = [];
    const onUpdate = (e) => {
      receivedEvents.push(e.detail);
    };
    window.addEventListener("__SS_AUDIO_UPDATE__", onUpdate);

    try {
      // 1. Volume
      vb.setVolume(300);
      assert.ok(receivedEvents.length >= 1, "Event received for setVolume");
      assert.equal(receivedEvents[receivedEvents.length - 1].volumeLevel, 300, "Volume level 300% passed in event detail");

      // 2. Bass
      vb.setBass(15);
      assert.equal(receivedEvents[receivedEvents.length - 1].bassLevel, 15, "Bass level 15dB passed in event detail");

      // 3. Preset
      vb.setEqPreset("Rock");
      assert.equal(receivedEvents[receivedEvents.length - 1].eqPreset, "Rock", "EQ preset Rock passed in event detail");

      // 4. EQ Band Gain
      vb.setEqBandGain(2, 8);
      assert.equal(receivedEvents[receivedEvents.length - 1].eqGains[2], 8, "EQ band 2 set to 8dB in event detail");
      assert.equal(receivedEvents[receivedEvents.length - 1].eqPreset, "Custom", "EQ preset switches to Custom in event detail");

      // 5. EQ Enabled toggle
      vb.setEqEnabled(false);
      assert.equal(receivedEvents[receivedEvents.length - 1].eqEnabled, false, "EQ disabled in event detail");

      // 6. Reset EQ
      vb.resetEq();
      assert.equal(receivedEvents[receivedEvents.length - 1].eqPreset, "Flat", "Reset EQ sets Flat preset in event detail");
    } finally {
      window.removeEventListener("__SS_AUDIO_UPDATE__", onUpdate);
    }
  });

  test("Page Audio DSP Engine updates internal nodes and gain values on __SS_AUDIO_UPDATE__", () => {
    const pageDsp = window.__SS_PAGE_AUDIO_DSP__;
    assert.ok(pageDsp, "Page DSP engine active");

    window.dispatchEvent(new CustomEvent("__SS_AUDIO_UPDATE__", {
      detail: {
        volumeLevel: 450,
        bassLevel: 18,
        eqPreset: "Bass Boost",
        eqGains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
        eqEnabled: true
      }
    }));

    assert.equal(pageDsp._volumeLevel, 450, "Volume updated to 450%");
    assert.equal(pageDsp._bassLevel, 18, "Bass updated to 18dB");
    assert.equal(pageDsp._eqPreset, "Bass Boost", "Preset updated to Bass Boost");
    assert.deepEqual(pageDsp._eqGains, [6, 5, 4, 2, 0, 0, 0, 0, 0, 0], "EQ gains synced");
  });

  test("Volume clamping in Page DSP Engine protects bounds [0..600] and sets GainNode multiplier", () => {
    const pageDsp = window.__SS_PAGE_AUDIO_DSP__;
    pageDsp.gainNode = { gain: { value: 1.0 } };

    pageDsp.setVolume(999);
    assert.equal(pageDsp._volumeLevel, 600, "Clamped to max 600%");
    assert.equal(pageDsp.gainNode.gain.value, 6.0, "Gain node value is 6.0 multiplier");

    pageDsp.setVolume(-50);
    assert.equal(pageDsp._volumeLevel, 0, "Clamped to min 0%");
    assert.equal(pageDsp.gainNode.gain.value, 0.0, "Gain node value is 0.0 multiplier");

    pageDsp.setVolume(250);
    assert.equal(pageDsp._volumeLevel, 250, "Volume set to 250%");
    assert.equal(pageDsp.gainNode.gain.value, 2.5, "Gain node value is 2.5 multiplier");
  });

  test("Bass clamping in Page DSP Engine protects bounds [0..20 dB] and sets BassFilter gain", () => {
    const pageDsp = window.__SS_PAGE_AUDIO_DSP__;
    pageDsp.bassNode = { gain: { value: 0 } };

    pageDsp.setBass(50);
    assert.equal(pageDsp._bassLevel, 20, "Clamped to max 20dB");
    assert.equal(pageDsp.bassNode.gain.value, 20, "Bass node gain is 20dB");

    pageDsp.setBass(-10);
    assert.equal(pageDsp._bassLevel, 0, "Clamped to min 0dB");
    assert.equal(pageDsp.bassNode.gain.value, 0, "Bass node gain is 0dB");

    pageDsp.setBass(12);
    assert.equal(pageDsp._bassLevel, 12, "Bass set to 12dB");
    assert.equal(pageDsp.bassNode.gain.value, 12, "Bass node gain is 12dB");
  });

  test("EQ gains clamping and master bypass in Page DSP Engine", () => {
    const pageDsp = window.__SS_PAGE_AUDIO_DSP__;
    pageDsp.eqNodes = Array.from({ length: 10 }, () => ({ gain: { value: 0 } }));

    // Clamping [-12dB, +12dB]
    pageDsp.setEqGains([20, -25, 0, 5, -5, 10, -10, 15, -15, 0]);
    assert.equal(pageDsp._eqGains[0], 12, "Band 0 clamped to +12dB");
    assert.equal(pageDsp._eqGains[1], -12, "Band 1 clamped to -12dB");
    assert.equal(pageDsp.eqNodes[0].gain.value, 12, "Filter node 0 set to +12dB");
    assert.equal(pageDsp.eqNodes[1].gain.value, -12, "Filter node 1 set to -12dB");

    // Master bypass
    pageDsp.setEqEnabled(false);
    assert.equal(pageDsp._eqEnabled, false, "eqEnabled is false");
    for (let i = 0; i < 10; i++) {
      assert.equal(pageDsp.eqNodes[i].gain.value, 0, `Filter node ${i} set to 0dB when EQ disabled`);
    }
    assert.equal(pageDsp._eqGains[0], 12, "Internal _eqGains preserved when EQ disabled");

    // Re-enable
    pageDsp.setEqEnabled(true);
    assert.equal(pageDsp._eqEnabled, true, "eqEnabled is true");
    assert.equal(pageDsp.eqNodes[0].gain.value, 12, "Filter node 0 restored to +12dB");
  });

  test("Exhaustive verification of all 9 EQ Preset Profiles in Page DSP Engine", () => {
    const pageDsp = window.__SS_PAGE_AUDIO_DSP__;
    const AudioEngine = require("../../utils/audio-engine");

    const expectedPresets = {
      'Flat':          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      'Bass Boost':    [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
      'Vocal Booster': [-2, -1, 0, 2, 4, 5, 4, 2, 0, -1],
      'Treble Boost':  [0, 0, 0, 0, 0, 1, 3, 5, 7, 8],
      'Rock':          [5, 4, 3, 1, -1, -1, 0, 2, 4, 5],
      'Pop':           [-1, 2, 4, 5, 4, 0, -1, 1, 3, 4],
      'Acoustic':      [3, 2, 1, 2, 3, 3, 2, 3, 2, 1],
      'Electronic':    [6, 5, 2, 0, -2, 2, 1, 2, 4, 5]
    };

    for (const [presetName, gains] of Object.entries(expectedPresets)) {
      const ok = pageDsp.setEqPreset(presetName);
      assert.ok(ok, `setEqPreset('${presetName}') returns true`);
      assert.equal(pageDsp._eqPreset, presetName, `Preset updated to ${presetName}`);
      assert.deepEqual(pageDsp._eqGains, gains, `Gains match ${presetName} definition exactly`);

      // Verify alignment with AudioEngine.EQ_PRESETS
      assert.deepEqual(gains, AudioEngine.EQ_PRESETS[presetName], `${presetName} matches AudioEngine.EQ_PRESETS definition`);
    }

    // Custom preset
    pageDsp.setEqPreset("Custom");
    assert.equal(pageDsp._eqPreset, "Custom", "Custom preset accepted");

    // Invalid preset rejected
    const invalidRes = pageDsp.setEqPreset("NonExistentPreset");
    assert.equal(invalidRes, false, "Invalid preset returns false");
  });

  test("Full Audio DSP Graph wiring in Page Context", () => {
    const pageDsp = window.__SS_PAGE_AUDIO_DSP__;

    let mediaSourceCreated = false;
    let biquadFiltersCreated = 0;
    let gainCreated = false;
    let analyserCreated = false;

    class MockNode {
      constructor() {
        this.type = "";
        this.frequency = { value: 0 };
        this.Q = { value: 1 };
        this.gain = { value: 0 };
        this.connectedTo = [];
      }
      connect(target) {
        this.connectedTo.push(target);
      }
      disconnect() {
        this.connectedTo = [];
      }
    }

    class MockDestinationNode extends MockNode {}

    class MockAudioContext {
      constructor() {
        this.state = "running";
        this.destination = new MockDestinationNode();
      }
      createMediaElementSource() {
        mediaSourceCreated = true;
        return new MockNode();
      }
      createBiquadFilter() {
        biquadFiltersCreated++;
        return new MockNode();
      }
      createGain() {
        gainCreated = true;
        return new MockNode();
      }
      createAnalyser() {
        analyserCreated = true;
        const a = new MockNode();
        a.fftSize = 128;
        a.frequencyBinCount = 64;
        return a;
      }
      resume() {
        return Promise.resolve();
      }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockAudioContext;
      pageDsp.ctx = null;
      pageDsp.sourceNode = null;
      pageDsp.bassNode = null;
      pageDsp.gainNode = null;
      pageDsp.eqNodes = [];
      pageDsp.analyserNode = null;
      pageDsp.subsonicFilter = null;
      pageDsp.antiHissFilter = null;
      pageDsp.compressorNode = null;
      pageDsp._noiseRemover = false;
      pageDsp._connectedVideo = null;

      const video = document.createElement("video");
      const attached = pageDsp.attachToVideo(video);

      assert.ok(attached, "attachToVideo returns true");
      assert.ok(mediaSourceCreated, "createMediaElementSource called");
      assert.ok(gainCreated, "createGain called");
      assert.ok(biquadFiltersCreated >= 11, "At least 11 BiquadFilters created (1 bass + 10 EQ bands)");
      assert.ok(analyserCreated, "createAnalyser called");

      // Verify node chain topology: source -> bass -> gain -> eq[0..9] -> analyser -> destination
      assert.equal(pageDsp.sourceNode.connectedTo[0], pageDsp.bassNode, "Source connected to BassFilter");
      assert.equal(pageDsp.bassNode.connectedTo[0], pageDsp.gainNode, "BassFilter connected to GainNode");
      assert.equal(pageDsp.gainNode.connectedTo[0], pageDsp.eqNodes[0], "GainNode connected to EQ Band 0");
      for (let i = 0; i < 9; i++) {
        assert.equal(pageDsp.eqNodes[i].connectedTo[0], pageDsp.eqNodes[i + 1], `EQ Band ${i} connected to Band ${i + 1}`);
      }
      assert.equal(pageDsp.eqNodes[9].connectedTo[0], pageDsp.analyserNode, "EQ Band 9 connected to AnalyserNode");
      assert.equal(pageDsp.analyserNode.connectedTo[0], pageDsp.ctx.destination, "AnalyserNode connected to Destination");
    } finally {
      window.AudioContext = origCtx;
    }
  });

  test("Bidirectional State IPC: Page DSP Engine notifies state via CustomEvent and DOM attributes", () => {
    const pageDsp = window.__SS_PAGE_AUDIO_DSP__;
    let stateEventDetail = null;

    const onState = (e) => {
      stateEventDetail = e.detail;
    };
    window.addEventListener("__SS_AUDIO_STATE__", onState);

    try {
      pageDsp.setVolume(350);
      assert.ok(stateEventDetail, "__SS_AUDIO_STATE__ event received");
      assert.equal(stateEventDetail.volumeLevel, 350, "volumeLevel reflected in state event");
      assert.equal(document.documentElement.getAttribute("data-ss-audio-connected"), "true", "DOM attribute data-ss-audio-connected is true");

      pageDsp.setBass(14);
      assert.equal(stateEventDetail.bassLevel, 14, "bassLevel reflected in state event");

      // Query state via __SS_AUDIO_GET_STATE__
      stateEventDetail = null;
      window.dispatchEvent(new CustomEvent("__SS_AUDIO_GET_STATE__"));
      assert.ok(stateEventDetail, "__SS_AUDIO_GET_STATE__ triggers __SS_AUDIO_STATE__ response");
    } finally {
      window.removeEventListener("__SS_AUDIO_STATE__", onState);
    }
  });

  test("Multi-gesture WebKit AudioContext unlocking across all 9 events", async () => {
    const pageDsp = window.__SS_PAGE_AUDIO_DSP__;
    const events = ["click", "pointerdown", "mousedown", "keydown", "touchstart", "touchend", "play", "playing", "input"];

    for (const evtName of events) {
      let resumed = false;

      class MockUnlockCtx {
        constructor() {
          this.state = "suspended";
          this.destination = {};
        }
        resume() {
          resumed = true;
          this.state = "running";
          return Promise.resolve();
        }
      }

      const origCtx = window.AudioContext;
      try {
        window.AudioContext = MockUnlockCtx;
        pageDsp.ctx = null;
        pageDsp.initContext();
        pageDsp.ctx.state = "suspended";

        const evt = new Event(evtName, { bubbles: true });
        window.dispatchEvent(evt);

        await new Promise(r => setTimeout(r, 5));
        assert.ok(resumed, `Gesture event '${evtName}' resumed suspended AudioContext`);
      } finally {
        window.AudioContext = origCtx;
      }
    }
  });

  test("YouTube SPA navigation (yt-navigate-finish) and stream switches auto-resume audio", async () => {
    const pageDsp = window.__SS_PAGE_AUDIO_DSP__;
    let resumed = false;

    class MockNavCtx {
      constructor() {
        this.state = "suspended";
        this.destination = {};
      }
      resume() {
        resumed = true;
        this.state = "running";
        return Promise.resolve();
      }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockNavCtx;
      pageDsp.ctx = null;
      pageDsp.initContext();
      pageDsp.ctx.state = "suspended";

      const navEvent = new Event("yt-navigate-finish");
      window.dispatchEvent(navEvent);

      await new Promise(r => setTimeout(r, 5));
      assert.ok(resumed, "yt-navigate-finish event resumed suspended AudioContext");
    } finally {
      window.AudioContext = origCtx;
    }
  });

  test("WeakMap videoSourceMap prevents duplicate MediaElementSourceNode creation on the same video", () => {
    const pageDsp = window.__SS_PAGE_AUDIO_DSP__;
    let sourceCreationCount = 0;

    class MockNode {
      connect() {}
      disconnect() {}
    }

    class MockCtxCache {
      constructor() {
        this.state = "running";
        this.destination = {};
      }
      createMediaElementSource() {
        sourceCreationCount++;
        return new MockNode();
      }
      createBiquadFilter() {
        return new MockNode();
      }
      createGain() {
        return new MockNode();
      }
      createAnalyser() {
        return new MockNode();
      }
      resume() {
        return Promise.resolve();
      }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockCtxCache;
      pageDsp.ctx = null;
      pageDsp.videoSourceMap = new WeakMap();
      pageDsp._connectedVideo = null;
      pageDsp.sourceNode = null;

      const video = document.createElement("video");

      // Attach 1
      pageDsp.attachToVideo(video);
      assert.equal(sourceCreationCount, 1, "First attach creates MediaElementSource");

      // Attach 2 on same element
      pageDsp.attachToVideo(video);
      assert.equal(sourceCreationCount, 1, "Second attach reuses WeakMap cached source node");
    } finally {
      window.AudioContext = origCtx;
    }
  });

});

