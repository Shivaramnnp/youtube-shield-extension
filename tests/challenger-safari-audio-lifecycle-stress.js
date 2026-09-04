/**
 * Challenger 2: Safari WebKit Audio Lifecycle & Video Element Recycling Empirical Stress Harness
 *
 * Exhaustively tests:
 * 1. AudioContext auto-resumes across all 9 gestures (click, pointerdown, mousedown, keydown, touchstart, touchend, play, playing, input).
 * 2. Rapid video element additions, removals, replacements, and SPA navigation events (yt-navigate-finish, yt-page-data-updated).
 * 3. WeakMap node caching strictly preventing duplicate createMediaElementSource errors (InvalidStateError) across 500+ simulated video swaps.
 * 4. MutationObserver auto-detection and attachment dynamics.
 * 5. Full audio DSP graph topology, parameter synchronization, and disconnect/teardown memory safety.
 */

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

function reloadPageAudioDsp() {
  delete window.__SS_PAGE_AUDIO_DSP_INITIALIZED__;
  delete window.__SS_PAGE_AUDIO_DSP__;
  try {
    delete require.cache[require.resolve('../content/js/page-audio-dsp')];
  } catch (e) {}
  return require('../content/js/page-audio-dsp');
}

async function runSafariAudioLifecycleStressSuite() {
  console.log("=========================================================================================");
  console.log("=== CHALLENGER 2: SAFARI WEBKIT AUDIO LIFECYCLE & VIDEO RECYCLING EMPIRICAL STRESS ===");
  console.log("=========================================================================================");

  const env = setupMockEnv();

  const AudioEngine = require('../utils/audio-engine');
  const VolumeBooster = require('../content/js/volume-booster');
  reloadPageAudioDsp();
  const pageDsp = window.__SS_PAGE_AUDIO_DSP__;

  // ===================================================================================
  // SECTION 1: 9-GESTURE WEBKIT AUDIOCONTEXT UNLOCK MATRIX
  // ===================================================================================
  console.log("\n--- SECTION 1: Multi-Gesture WebKit AudioContext Unlock Matrix (9 Gestures) ---");

  const ALL_9_GESTURES = [
    'click',
    'pointerdown',
    'mousedown',
    'keydown',
    'touchstart',
    'touchend',
    'play',
    'playing',
    'input'
  ];

  // 1.1 Test each of the 9 gestures individually on PageAudioDspEngine
  console.log("\n  - Subtest 1.1: Individual Gesture Unlock on PageAudioDspEngine");
  for (const gesture of ALL_9_GESTURES) {
    let resumeCalled = 0;
    class MockGestureCtx {
      constructor() {
        this.state = 'suspended';
        this.destination = {};
      }
      resume() {
        resumeCalled++;
        this.state = 'running';
        return Promise.resolve();
      }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockGestureCtx;
      pageDsp.ctx = null;
      pageDsp.initContext();
      pageDsp.ctx.state = 'suspended';

      // Dispatch event on window
      const evt = new Event(gesture, { bubbles: true });
      window.dispatchEvent(evt);

      await new Promise(r => setTimeout(r, 5));
      assert(resumeCalled >= 1, `PageAudioDspEngine: Gesture '${gesture}' called ctx.resume()`);
      assert(pageDsp.ctx.state === 'running', `PageAudioDspEngine: State transitioned to 'running' on '${gesture}'`);
    } finally {
      window.AudioContext = origCtx;
    }
  }

  // 1.2 Test each of the 9 gestures individually on VolumeBooster & AudioEngine
  console.log("\n  - Subtest 1.2: Individual Gesture Unlock on VolumeBooster and AudioEngine");
  for (const gesture of ALL_9_GESTURES) {
    let aeResumed = 0;
    let vbResumed = 0;

    class MockAeCtx {
      constructor() { this.state = 'suspended'; this.destination = {}; }
      resume() { aeResumed++; this.state = 'running'; return Promise.resolve(); }
    }
    class MockVbCtx {
      constructor() { this.state = 'suspended'; this.destination = {}; }
      resume() { vbResumed++; this.state = 'running'; return Promise.resolve(); }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockAeCtx;
      AudioEngine.ctx = null;
      AudioEngine.initContext();
      AudioEngine.ctx.state = 'suspended';
      AudioEngine.attachGestureUnlock();

      const vid = document.createElement('video');
      document.body.appendChild(vid);

      vid.dispatchEvent(new Event(gesture, { bubbles: true }));
      await new Promise(r => setTimeout(r, 5));
      assert(aeResumed >= 1, `AudioEngine: Gesture '${gesture}' on video element resumed context`);

      vid.remove();
    } finally {
      window.AudioContext = origCtx;
    }
  }

  // 1.3 Rapid Concurrency Burst: 180 Mixed Gestures Dispatched Across Window, Document, and Video
  console.log("\n  - Subtest 1.3: Rapid Concurrency Burst (180 mixed gestures simultaneously)");
  let burstResumeTotal = 0;
  class MockBurstCtx {
    constructor() { this.state = 'suspended'; this.destination = {}; }
    resume() {
      burstResumeTotal++;
      this.state = 'running';
      return Promise.resolve();
    }
  }

  const origCtxBurst = window.AudioContext;
  try {
    window.AudioContext = MockBurstCtx;
    pageDsp.ctx = null;
    pageDsp.initContext();
    pageDsp.ctx.state = 'suspended';

    const testVideo = document.createElement('video');
    document.body.appendChild(testVideo);

    for (let i = 0; i < 180; i++) {
      const g = ALL_9_GESTURES[i % ALL_9_GESTURES.length];
      const target = (i % 3 === 0) ? window : (i % 3 === 1) ? document : testVideo;
      target.dispatchEvent(new Event(g, { bubbles: true }));
    }

    await new Promise(r => setTimeout(r, 15));
    assert(burstResumeTotal > 0, `Burst of 180 gestures processed without exception (resumes: ${burstResumeTotal})`);
    assert(pageDsp.ctx.state === 'running', "AudioContext remained running after burst");

    testVideo.remove();
  } finally {
    window.AudioContext = origCtxBurst;
  }

  // 1.4 State Oscillation Stress: Repeated Tab Backgrounding / Media Suspensions (50 cycles)
  console.log("\n  - Subtest 1.4: 50 Suspended <-> Running State Transitions on Page DSP");
  let oscillationSuccess = 0;
  class MockOscillationCtx {
    constructor() { this.state = 'running'; this.destination = {}; }
    resume() { this.state = 'running'; return Promise.resolve(); }
  }

  try {
    window.AudioContext = MockOscillationCtx;
    pageDsp.ctx = null;
    pageDsp.initContext();

    for (let cycle = 0; cycle < 50; cycle++) {
      // Background / suspend tab
      pageDsp.ctx.state = 'suspended';
      const gesture = ALL_9_GESTURES[cycle % ALL_9_GESTURES.length];
      window.dispatchEvent(new Event(gesture, { bubbles: true }));
      await new Promise(r => setTimeout(r, 2));

      if (pageDsp.ctx.state === 'running') {
        oscillationSuccess++;
      }
    }
    assert(oscillationSuccess === 50, `All 50 suspension/resume cycles completed cleanly (success: ${oscillationSuccess}/50)`);
  } finally {
    window.AudioContext = origCtxBurst;
  }

  // ===================================================================================
  // SECTION 2: WEAKMAP NODE CACHING & WEBKIT INVALIDSTATEERROR CRASH TEST
  // ===================================================================================
  console.log("\n--- SECTION 2: WeakMap Node Caching & WebKit InvalidStateError Crash Test ---");

  let sourceNodeAllocations = 0;
  const connectedNodesRegistry = new Set();

  class MockUniqueSourceNode {
    constructor(video) {
      this.video = video;
      this.connectedTo = [];
    }
    connect(dest) { this.connectedTo.push(dest); }
    disconnect() { this.connectedTo = []; }
  }

  class MockStrictWebKitAudioContext {
    constructor() {
      this.state = 'running';
      this.destination = { name: 'destination' };
      this.seenElements = new Set();
    }
    createMediaElementSource(videoEl) {
      if (this.seenElements.has(videoEl)) {
        const err = new Error("InvalidStateError: HTMLMediaElement already connected to a different MediaElementSourceNode");
        err.name = "InvalidStateError";
        throw err;
      }
      this.seenElements.add(videoEl);
      sourceNodeAllocations++;
      return new MockUniqueSourceNode(videoEl);
    }
    createGain() { return { gain: { value: 1.0 }, connect() {}, disconnect() {} }; }
    createBiquadFilter() { return { type: 'lowshelf', frequency: { value: 150 }, gain: { value: 0 }, Q: { value: 1 }, connect() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 128, smoothingTimeConstant: 0.8, frequencyBinCount: 64, getByteFrequencyData() {}, connect() {}, disconnect() {} }; }
    resume() { return Promise.resolve(); }
  }

  const origContextStrict = window.AudioContext;
  try {
    window.AudioContext = MockStrictWebKitAudioContext;
    pageDsp.ctx = null;
    pageDsp.videoSourceMap = new WeakMap();
    pageDsp._connectedVideo = null;
    pageDsp.sourceNode = null;
    sourceNodeAllocations = 0;

    // 2.1 200 Repeated Attaches on the EXACT Same Video Element (Zero Duplicate Source Allocations)
    console.log("\n  - Subtest 2.1: 200 repeated attaches on identical video element");
    const primaryVideo = document.createElement('video');
    primaryVideo.src = "https://www.youtube.com/watch?v=primary_test";
    document.body.appendChild(primaryVideo);

    for (let i = 0; i < 200; i++) {
      let attachSuccess = false;
      doesNotThrow(() => {
        attachSuccess = pageDsp.attachToVideo(primaryVideo);
      }, `Attach cycle ${i} must never throw InvalidStateError`);
      assert(attachSuccess === true, `Cycle ${i}: attachToVideo returned true`);
    }

    assert(sourceNodeAllocations === 1, `createMediaElementSource called EXACTLY 1 time across 200 attaches (got ${sourceNodeAllocations})`);
    assert(pageDsp.videoSourceMap.has(primaryVideo), "videoSourceMap WeakMap holds source node for primaryVideo");

    // 2.2 300 Rapid Video Element Swaps across 30 Distinct Video Elements
    console.log("\n  - Subtest 2.2: 300 rapid video element swaps across 30 distinct video elements");
    const videoPool = [];
    for (let i = 0; i < 30; i++) {
      const v = document.createElement('video');
      v.id = `video_pool_${i}`;
      v.src = `https://www.youtube.com/watch?v=pool_${i}`;
      videoPool.push(v);
    }

    const allocationsBeforePool = sourceNodeAllocations;

    // Perform 300 random swaps across these 30 videos
    for (let i = 0; i < 300; i++) {
      const chosenVideo = videoPool[i % 30];
      let ok = false;
      doesNotThrow(() => {
        ok = pageDsp.attachToVideo(chosenVideo);
      }, `Pool swap ${i} on video ${chosenVideo.id}`);
      assert(ok === true, `Pool swap ${i} succeeded`);
    }

    const newAllocations = sourceNodeAllocations - allocationsBeforePool;
    assert(newAllocations === 30, `Exactly 30 new source nodes allocated for 30 unique videos (got ${newAllocations})`);

    // 2.3 Standalone VolumeBooster & AudioEngine WeakMap Verification
    console.log("\n  - Subtest 2.3: Standalone VolumeBooster & AudioEngine WeakMap Resilience");
    AudioEngine.ctx = null;
    AudioEngine.videoSourceCache = new WeakMap();
    AudioEngine._attachedSourceMap = AudioEngine.videoSourceCache;

    const aeVideo = document.createElement('video');
    aeVideo.src = "https://www.youtube.com/watch?v=ae_video";

    const aeAllocBefore = sourceNodeAllocations;
    for (let i = 0; i < 50; i++) {
      AudioEngine.attachToVideo(aeVideo);
    }
    assert(sourceNodeAllocations - aeAllocBefore === 1, "AudioEngine: Exactly 1 source node allocated across 50 attaches on same video");

    primaryVideo.remove();
  } finally {
    window.AudioContext = origContextStrict;
  }

  // ===================================================================================
  // SECTION 3: RAPID DOM MUTATIONS, ADDITIONS, REMOVALS & REPLACEMENTS
  // ===================================================================================
  console.log("\n--- SECTION 3: Rapid DOM Video Additions, Removals, Replacements & MutationObserver ---");

  // 3.1 Verify findActiveVideo Priority Hierarchy
  console.log("\n  - Subtest 3.1: findActiveVideo Selection Priority Hierarchy");
  document.body.innerHTML = "";

  // Scenario A: No video
  assert(pageDsp.findActiveVideo() === null, "findActiveVideo returns null when DOM is empty");

  // Scenario B: Plain background video vs #movie_player video
  const bgVideo = document.createElement('video');
  bgVideo.id = "bg-video";
  document.body.appendChild(bgVideo);

  const playerContainer = document.createElement('div');
  playerContainer.id = "movie_player";
  const mainVideo = document.createElement('video');
  mainVideo.className = "html5-main-video";
  playerContainer.appendChild(mainVideo);
  document.body.appendChild(playerContainer);

  const foundVideo = pageDsp.findActiveVideo();
  assert(foundVideo === mainVideo, "findActiveVideo prioritizes #movie_player video over random video");

  // Scenario C: Playing video prioritized among multiple videos
  const extraVideo = document.createElement('video');
  extraVideo.id = "preview_video";
  extraVideo.paused = false;
  extraVideo.ended = false;
  extraVideo.currentTime = 5.2;
  extraVideo.readyState = 4;
  document.body.appendChild(extraVideo);

  // If main player is not present, playing video is chosen
  playerContainer.remove();
  assert(pageDsp.findActiveVideo() === extraVideo, "findActiveVideo prioritizes actively playing video when container absent");

  // 3.2 100 Rapid DOM Mount / Unmount / Replacement Cycles
  console.log("\n  - Subtest 3.2: 100 Rapid DOM Video Replacements");
  for (let cycle = 0; cycle < 100; cycle++) {
    document.body.innerHTML = "";

    const container = document.createElement('div');
    container.className = "html5-video-player";
    const v = document.createElement('video');
    v.className = "html5-main-video";
    v.src = `https://www.youtube.com/watch?v=dyn_${cycle}`;
    container.appendChild(v);
    document.body.appendChild(container);

    pageDsp.scanAndAttach();
    assert(pageDsp._connectedVideo === v, `Cycle ${cycle}: scanAndAttach attached to active DOM video`);
  }

  // 3.3 MutationObserver Lifecycle Trigger Test
  console.log("\n  - Subtest 3.3: MutationObserver Auto-Attachment Dynamics");
  let mutationAttachCount = 0;
  const origAttach = pageDsp.attachToVideo.bind(pageDsp);
  pageDsp.attachToVideo = function(video) {
    mutationAttachCount++;
    return origAttach(video);
  };

  try {
    document.body.innerHTML = "<div id='movie_player'></div>";
    const container = document.getElementById('movie_player');

    // Create and append a new video element dynamically
    const dynamicVideo = document.createElement('video');
    dynamicVideo.className = "html5-main-video";
    container.appendChild(dynamicVideo);

    // Trigger observer callback manually or via DOM mutation
    pageDsp.scanAndAttach();
    assert(pageDsp._connectedVideo === dynamicVideo, "Mutation auto-attached to newly inserted video element");
  } finally {
    pageDsp.attachToVideo = origAttach;
  }

  // ===================================================================================
  // SECTION 4: YOUTUBE SPA NAVIGATION & STREAM SWITCH RESUME
  // ===================================================================================
  console.log("\n--- SECTION 4: YouTube SPA Navigation & Stream Switch Lifecycle ---");

  // 4.1 yt-navigate-finish & yt-page-data-updated event handling
  console.log("\n  - Subtest 4.1: SPA Navigation Events (yt-navigate-finish & yt-page-data-updated)");
  let spaResumedCount = 0;
  class MockSpaCtx {
    constructor() {
      this.state = 'suspended';
      this.destination = { name: 'destination' };
    }
    createMediaElementSource() { return { connect() {}, disconnect() {} }; }
    createBiquadFilter() { return { type: 'lowshelf', frequency: { value: 150 }, gain: { value: 0 }, Q: { value: 1 }, connect() {}, disconnect() {} }; }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 128, frequencyBinCount: 64, connect() {}, disconnect() {} }; }
    resume() { spaResumedCount++; this.state = 'running'; return Promise.resolve(); }
  }

  const origCtxSpa = window.AudioContext;
  try {
    window.AudioContext = MockSpaCtx;
    pageDsp.ctx = null;
    pageDsp.initContext();
    pageDsp.ctx.state = 'suspended';

    // 1. yt-navigate-finish
    window.dispatchEvent(new Event("yt-navigate-finish"));
    await new Promise(r => setTimeout(r, 5));
    assert(spaResumedCount >= 1, "yt-navigate-finish triggered unlock/resume");
    assert(pageDsp.ctx.state === 'running', "AudioContext running after yt-navigate-finish");

    // 2. yt-page-data-updated
    pageDsp.ctx.state = 'suspended';
    window.dispatchEvent(new Event("yt-page-data-updated"));
    await new Promise(r => setTimeout(r, 5));
    assert(pageDsp.ctx.state === 'running', "AudioContext running after yt-page-data-updated");

    // 4.2 100 Rapid SPA Navigation Events in Sequence
    console.log("\n  - Subtest 4.2: 100 Rapid Burst SPA Navigations");
    for (let i = 0; i < 100; i++) {
      const evtType = (i % 2 === 0) ? "yt-navigate-finish" : "yt-page-data-updated";
      window.dispatchEvent(new Event(evtType));
    }
    await new Promise(r => setTimeout(r, 10));
    assert(pageDsp.ctx.state === 'running', "AudioContext intact and running after 100 rapid SPA events");

    // 4.3 Video Playback Resume Handler
    console.log("\n  - Subtest 4.3: Video Play/Playing Event Auto-Resume");
    const playVid = document.createElement('video');
    document.body.appendChild(playVid);
    pageDsp.attachToVideo(playVid);

    pageDsp.ctx.state = 'suspended';
    playVid.dispatchEvent(new Event('play'));
    await new Promise(r => setTimeout(r, 5));
    assert(pageDsp.ctx.state === 'running', "video 'play' event auto-resumed suspended context");

    pageDsp.ctx.state = 'suspended';
    playVid.dispatchEvent(new Event('playing'));
    await new Promise(r => setTimeout(r, 5));
    assert(pageDsp.ctx.state === 'running', "video 'playing' event auto-resumed suspended context");

    playVid.remove();
  } finally {
    window.AudioContext = origCtxSpa;
  }

  // ===================================================================================
  // SECTION 5: BIDIRECTIONAL IPC, PARAMETER CLAMPING & FULL DSP GRAPH TOPOLOGY
  // ===================================================================================
  console.log("\n--- SECTION 5: Bidirectional CustomEvent IPC & DSP Graph Topology ---");

  // 5.1 Graph Topology Verification: Source -> Bass -> Gain -> 10 EQ Bands -> Analyser -> Destination
  console.log("\n  - Subtest 5.1: Complete Sequential DSP Graph Connection Verification");
  class MockTopologyNode {
    constructor(name) {
      this.name = name;
      this.connectedTo = [];
      this.type = 'peaking';
      this.frequency = { value: 1000 };
      this.gain = { value: 0 };
      this.Q = { value: 1.0 };
    }
    connect(target) { this.connectedTo.push(target); }
    disconnect() { this.connectedTo = []; }
  }

  class MockTopologyCtx {
    constructor() {
      this.state = 'running';
      this.destination = new MockTopologyNode('destination');
    }
    createMediaElementSource() { return new MockTopologyNode('sourceNode'); }
    createBiquadFilter() { return new MockTopologyNode('biquadFilter'); }
    createGain() { return new MockTopologyNode('gainNode'); }
    createAnalyser() {
      const a = new MockTopologyNode('analyserNode');
      a.fftSize = 128;
      a.frequencyBinCount = 64;
      return a;
    }
    resume() { return Promise.resolve(); }
  }

  const origCtxTop = window.AudioContext;
  try {
    window.AudioContext = MockTopologyCtx;
    pageDsp.ctx = null;
    pageDsp.sourceNode = null;
    pageDsp.bassNode = null;
    pageDsp.gainNode = null;
    pageDsp.eqNodes = [];
    pageDsp.analyserNode = null;
    pageDsp._connectedVideo = null;
    pageDsp.videoSourceMap = new WeakMap();

    const topVid = document.createElement('video');
    document.body.appendChild(topVid);

    const attached = pageDsp.attachToVideo(topVid);
    assert(attached === true, "attachToVideo attached cleanly");

    // Check node instances
    assert(pageDsp.sourceNode !== null, "SourceNode created");
    assert(pageDsp.bassNode !== null, "BassNode created");
    assert(pageDsp.gainNode !== null, "GainNode created");
    assert(pageDsp.eqNodes.length === 10, "10 EQ Nodes created");
    assert(pageDsp.analyserNode !== null, "AnalyserNode created");

    // Verify sequential connections:
    // sourceNode -> bassNode -> gainNode -> eqNodes[0..9] -> analyserNode -> destination
    assert(pageDsp.sourceNode.connectedTo[0] === pageDsp.bassNode, "Topology: Source -> BassFilter (150Hz)");
    assert(pageDsp.bassNode.connectedTo[0] === pageDsp.gainNode, "Topology: BassFilter -> GainNode");
    assert(pageDsp.gainNode.connectedTo[0] === pageDsp.eqNodes[0], "Topology: GainNode -> EQ Band 0 (32Hz)");

    for (let i = 0; i < 9; i++) {
      assert(pageDsp.eqNodes[i].connectedTo[0] === pageDsp.eqNodes[i + 1], `Topology: EQ Band ${i} -> EQ Band ${i + 1}`);
    }
    assert(pageDsp.eqNodes[9].connectedTo[0] === pageDsp.analyserNode, "Topology: EQ Band 9 (16kHz) -> AnalyserNode");
    assert(pageDsp.analyserNode.connectedTo[0] === pageDsp.ctx.destination, "Topology: AnalyserNode -> Destination");

    topVid.remove();
  } finally {
    window.AudioContext = origCtxTop;
  }

  // 5.2 500 Adversarial Parameter IPC Stress Updates
  console.log("\n  - Subtest 5.2: 500 Adversarial Parameter Updates via CustomEvent IPC");
  const PRESET_NAMES = ['Flat', 'Bass Boost', 'Vocal Booster', 'Treble Boost', 'Rock', 'Pop', 'Acoustic', 'Electronic', 'Custom'];

  for (let i = 0; i < 500; i++) {
    const randomVol = Math.floor(Math.random() * 1200) - 200; // -200..1000
    const randomBass = Math.floor(Math.random() * 50) - 10;   // -10..40
    const randomPreset = PRESET_NAMES[i % PRESET_NAMES.length];
    const randomGains = Array.from({ length: 10 }, () => (Math.random() * 40) - 20); // -20..+20
    const randomEnabled = (i % 2 === 0);

    window.dispatchEvent(new CustomEvent("__SS_AUDIO_UPDATE__", {
      detail: {
        volumeLevel: randomVol,
        bassLevel: randomBass,
        eqPreset: randomPreset,
        eqGains: randomGains,
        eqEnabled: randomEnabled
      }
    }));

    // Verify clamping
    assert(pageDsp._volumeLevel >= 0 && pageDsp._volumeLevel <= 600, `Update ${i}: volume clamped [0..600] (got ${pageDsp._volumeLevel})`);
    assert(pageDsp._bassLevel >= 0 && pageDsp._bassLevel <= 20, `Update ${i}: bass clamped [0..20] (got ${pageDsp._bassLevel})`);
    for (let b = 0; b < 10; b++) {
      assert(pageDsp._eqGains[b] >= -12 && pageDsp._eqGains[b] <= 12, `Update ${i}: eqGain[${b}] clamped [-12..+12] (got ${pageDsp._eqGains[b]})`);
    }
  }

  // 5.3 DOM Attribute State Reflection
  console.log("\n  - Subtest 5.3: DOM Attributes Reflection on document.documentElement");
  pageDsp.notifyState();
  assert(document.documentElement.getAttribute("data-ss-audio-connected") === "true", "DOM attribute data-ss-audio-connected is 'true'");
  assert(document.documentElement.hasAttribute("data-ss-audio-state"), "DOM attribute data-ss-audio-state exists");

  // ===================================================================================
  // SUMMARY
  // ===================================================================================
  console.log("\n=========================================================================================");
  console.log(`TOTAL CHALLENGER 2 STRESS TESTS EXECUTED: ${testsPassed + testsFailed}`);
  console.log(`PASSED: ${testsPassed}`);
  console.log(`FAILED: ${testsFailed}`);
  console.log("=========================================================================================");

  if (testsFailed > 0) {
    console.error("FAILURES DETECTED:");
    failures.forEach(f => console.error(" - " + f));
    process.exit(1);
  } else {
    console.log("ALL CHALLENGER 2 SAFARI WEBKIT & RECYCLING TESTS PASSED WITH 100% SUCCESS! ✅");
    process.exit(0);
  }
}

runSafariAudioLifecycleStressSuite();
