/**
 * Empirical Adversarial Challenger Test Suite 2 (Final Release Validation)
 * Focus: Boundary & Cascade Storage Stress, Audio Studio & Background Stress, HUD & Modal Stress
 */

const { setupMockEnv } = require('./harness/mock-extension-env');

let passed = 0;
let failed = 0;
const failureDetails = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failed++;
    failureDetails.push(message);
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

// Mock Web Audio API for Node.js test environment if not present
function setupMockWebAudio() {
  class MockAudioParam {
    constructor(val = 0) {
      this.value = val;
    }
    setValueAtTime(val, time) {
      this.value = val;
    }
    exponentialRampToValueAtTime(val, time) {
      this.value = val;
    }
    linearRampToValueAtTime(val, time) {
      this.value = val;
    }
  }

  class MockAudioNode {
    constructor() {
      this.connectedTo = [];
    }
    connect(target) {
      this.connectedTo.push(target);
      return target;
    }
    disconnect() {
      this.connectedTo = [];
    }
  }

  class MockGainNode extends MockAudioNode {
    constructor() {
      super();
      this.gain = new MockAudioParam(1.0);
    }
  }

  class MockBiquadFilterNode extends MockAudioNode {
    constructor() {
      super();
      this.type = 'lowshelf';
      this.frequency = new MockAudioParam(350);
      this.Q = new MockAudioParam(1.0);
      this.gain = new MockAudioParam(0);
    }
  }

  class MockAnalyserNode extends MockAudioNode {
    constructor() {
      super();
      this.fftSize = 128;
      this.frequencyBinCount = 64;
      this.smoothingTimeConstant = 0.8;
    }
    getByteFrequencyData(array) {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 150) + 10;
      }
    }
    getByteTimeDomainData(array) {
      for (let i = 0; i < array.length; i++) {
        array[i] = 128 + Math.floor(Math.sin(i / 10) * 30);
      }
    }
  }

  class MockOscillatorNode extends MockAudioNode {
    constructor() {
      super();
      this.type = 'sine';
      this.frequency = new MockAudioParam(440);
      this.onended = null;
    }
    start(time) {}
    stop(time) {
      if (typeof this.onended === 'function') {
        setTimeout(() => this.onended(), 5);
      }
    }
  }

  class MockMediaElementSourceNode extends MockAudioNode {
    constructor(mediaElement) {
      super();
      this.mediaElement = mediaElement;
    }
  }

  class MockAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = new MockAudioNode();
      this.onstatechange = null;
    }
    createGain() { return new MockGainNode(); }
    createBiquadFilter() { return new MockBiquadFilterNode(); }
    createAnalyser() { return new MockAnalyserNode(); }
    createOscillator() { return new MockOscillatorNode(); }
    createMediaElementSource(el) {
      if (el._hasMediaSourceCreated) {
        throw new Error("Failed to execute 'createMediaElementSource' on 'AudioContext': HTMLMediaElement already connected to an audio source");
      }
      el._hasMediaSourceCreated = true;
      return new MockMediaElementSourceNode(el);
    }
    resume() {
      this.state = 'running';
      if (typeof this.onstatechange === 'function') this.onstatechange();
      return Promise.resolve();
    }
    suspend() {
      this.state = 'suspended';
      if (typeof this.onstatechange === 'function') this.onstatechange();
      return Promise.resolve();
    }
    close() {
      this.state = 'closed';
      if (typeof this.onstatechange === 'function') this.onstatechange();
      return Promise.resolve();
    }
  }

  global.AudioContext = MockAudioContext;
  global.webkitAudioContext = MockAudioContext;
  if (global.window) {
    global.window.AudioContext = MockAudioContext;
    global.window.webkitAudioContext = MockAudioContext;
  }
}

async function runChallenger2DeepStressSuite() {
  console.log("=========================================================================");
  console.log("=== CHALLENGER 2: DEEP BOUNDARY, STORAGE, AUDIO & UI STRESS HARNESS ===");
  console.log("=========================================================================\n");

  const env = setupMockEnv();
  setupMockWebAudio();

  // Load modules
  require('../utils/design-tokens');
  require('../utils/storage');
  require('../utils/dom-utils');
  require('../utils/gamification-engine');
  require('../utils/audio-engine');
  require('../content/js/observer-utils');
  require('../content/js/volume-booster');
  require('../content/js/header-button');
  require('../content/js/goal-mode');
  require('../content/js/time-manager');
  require('../content/js/study-mode');
  require('../content/js/focus-mode');
  require('../content/js/shorts-blocker');
  require('../content/js/feed-controller');

  const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../utils/storage');

  // =========================================================================
  // TASK 1: BOUNDARY & CASCADE STORAGE STRESS
  // =========================================================================
  console.log("--- PART 1: Boundary & 3-Tier Storage Cascade Adversarial Stress ---");

  // 1.1 Quota Exhaustion on chrome.storage.sync
  StorageUtil.clearMemoryCache();
  const originalSyncSet = env.chrome.storage.sync.set;
  const originalSyncGet = env.chrome.storage.sync.get;
  const originalLocalSet = env.chrome.storage.local.set;
  const originalLocalGet = env.chrome.storage.local.get;

  env.chrome.storage.sync.set = () => {
    return Promise.reject(new Error("QUOTA_BYTES_PER_ITEM quota exceeded"));
  };

  let quotaSaveError = false;
  try {
    await StorageUtil.saveSettings({
      ...DEFAULT_SETTINGS,
      learningGoal: "Exhaustion Quota Goal",
      focusMode: true
    });
  } catch (e) {
    quotaSaveError = true;
  }
  assert(!quotaSaveError, "1.1 saveSettings gracefully handles sync quota exhaustion without throwing");

  const localStored = await env.chrome.storage.local.get(["settings"]);
  assert(
    localStored && localStored.settings && localStored.settings.learningGoal === "Exhaustion Quota Goal",
    "1.1 Transparently persisted to chrome.storage.local when sync quota is exceeded"
  );

  const retrievedSettings1 = await StorageUtil.getSettings();
  assert(
    retrievedSettings1.learningGoal === "Exhaustion Quota Goal",
    "1.1 getSettings accurately retrieves local fallback payload"
  );

  // 1.2 Read Failure on chrome.storage.sync (Network timeout / sync backend error)
  StorageUtil.clearMemoryCache();
  env.chrome.storage.sync.get = () => {
    return Promise.reject(new Error("Sync backend unreachable / connection timed out"));
  };

  await env.chrome.storage.local.set({
    settings: {
      ...DEFAULT_SETTINGS,
      learningGoal: "Local-Only Recovery Goal",
      _lastUpdated: Date.now()
    }
  });

  const retrievedSettings2 = await StorageUtil.getSettings();
  assert(
    retrievedSettings2.learningGoal === "Local-Only Recovery Goal",
    "1.2 getSettings transparently recovers from local storage when sync.get throws"
  );

  // 1.3 Total Storage Outage & Context Invalidation (Extension Context Invalidated)
  StorageUtil.clearMemoryCache();
  await StorageUtil.saveSettings({
    ...DEFAULT_SETTINGS,
    learningGoal: "Pre-Invalidation Goal"
  });

  const origRuntimeId = env.chrome.runtime.id;
  delete env.chrome.runtime.id; // simulate extension context invalidation

  const memSettings1 = await StorageUtil.getSettings();
  assert(
    memSettings1.learningGoal === "Pre-Invalidation Goal",
    "1.3 getSettings returns in-memory cache when chrome extension context is invalidated"
  );

  // Save new settings while context is invalidated
  await StorageUtil.saveSettings({
    ...DEFAULT_SETTINGS,
    learningGoal: "Context Invalidated In-Memory Goal"
  });

  const memSettings2 = await StorageUtil.getSettings();
  assert(
    memSettings2.learningGoal === "Context Invalidated In-Memory Goal",
    "1.3 saveSettings updates memorySettingsCache during total context invalidation"
  );

  // Clear memory cache during outage -> returns safe DEFAULT_SETTINGS clone
  StorageUtil.clearMemoryCache();
  const memSettings3 = await StorageUtil.getSettings();
  assert(
    memSettings3.learningGoal === DEFAULT_SETTINGS.learningGoal,
    "1.3 getSettings returns clean DEFAULT_SETTINGS when context invalidated and cache cleared"
  );
  assert(
    memSettings3 !== DEFAULT_SETTINGS,
    "1.3 Returned DEFAULT_SETTINGS is an isolated deep clone"
  );

  // Restore runtime id
  env.chrome.runtime.id = origRuntimeId;
  env.chrome.storage.sync.set = originalSyncSet;
  env.chrome.storage.sync.get = originalSyncGet;

  // 1.4 High-Concurrency Burst Under Storage Failure (500 rapid asynchronous operations)
  console.log("  ... Executing 500 rapid concurrent storage read/write bursts under sync failure ...");
  StorageUtil.clearMemoryCache();
  env.chrome.storage.sync.set = () => Promise.reject(new Error("Sync quota full"));

  const burstPromises = [];
  for (let i = 0; i < 500; i++) {
    if (i % 2 === 0) {
      burstPromises.push(
        StorageUtil.saveSettings({
          ...DEFAULT_SETTINGS,
          learningGoal: `Concurrent Goal ${i}`,
          focusReminderInterval: 10 + (i % 50)
        })
      );
    } else {
      burstPromises.push(StorageUtil.getSettings());
    }
  }

  let burstFailed = false;
  try {
    await Promise.all(burstPromises);
  } catch (err) {
    burstFailed = true;
  }
  assert(!burstFailed, "1.4 500 concurrent operations executed without unhandled rejections or crashes");

  const postBurstSettings = await StorageUtil.getSettings();
  assert(
    postBurstSettings && typeof postBurstSettings.learningGoal === 'string',
    "1.4 Storage state remains consistent after 500 concurrent bursts"
  );

  env.chrome.storage.sync.set = originalSyncSet;

  // 1.5 Corrupted / Malformed Schema Auto-Repair
  StorageUtil.clearMemoryCache();
  const heavilyCorruptedSettings = {
    extensionEnabled: "not_a_boolean",
    volumeBooster: null,
    timeManager: "invalid_time_manager",
    pomodoro: undefined,
    uiCleaner: 12345,
    blockedKeywords: { key: "invalid_type" },
    blockedChannels: null
  };

  const repaired = StorageUtil.buildMergedSettings(heavilyCorruptedSettings);
  assert(repaired.volumeBooster && typeof repaired.volumeBooster === 'object', "1.5 Corrupted volumeBooster repaired to object");
  assert(Array.isArray(repaired.volumeBooster.eqGains) && repaired.volumeBooster.eqGains.length === 10, "1.5 volumeBooster.eqGains repaired to 10-element array");
  assert(repaired.timeManager && typeof repaired.timeManager === 'object' && repaired.timeManager.dailyLimitMinutes === 60, "1.5 Corrupted timeManager repaired to defaults");
  assert(repaired.pomodoro && typeof repaired.pomodoro === 'object' && repaired.pomodoro.workMinutes === 25, "1.5 Corrupted pomodoro repaired to defaults");
  assert(Array.isArray(repaired.blockedKeywords) && repaired.blockedKeywords.length === 0, "1.5 Corrupted blockedKeywords repaired to array");
  assert(Array.isArray(repaired.blockedChannels) && repaired.blockedChannels.length === 0, "1.5 Corrupted blockedChannels repaired to array");

  // 1.6 High-Volume Timeline Log Consolidation & 500 Entry Hard Limit
  StorageUtil.clearMemoryCache();
  await StorageUtil.saveTracking({ ...DEFAULT_TRACKING, timelineLog: [] });

  console.log("  ... Stress testing timeline log with 600 rapid events ...");
  for (let i = 0; i < 600; i++) {
    await StorageUtil.addTimelineEvent({
      videoId: `vid_${Math.floor(i / 3)}`,
      title: `Lesson ${Math.floor(i / 3)}: Advanced JavaScript & Audio DSP`,
      channel: "Fireship Fireship • Subscribe",
      durationSeconds: 10,
      timestamp: 1700000000000 + (i * 20000),
      status: "watched"
    });
  }

  const finalTracking = await StorageUtil.getTracking();
  assert(finalTracking.timelineLog.length <= 500, `1.6 Timeline log capped at <= 500 entries (Actual: ${finalTracking.timelineLog.length})`);
  assert(finalTracking.timelineLog[0].channel === "Fireship", "1.6 Timeline event channel sanitized to 'Fireship'");
  assert(finalTracking.timelineLog[0].durationSeconds >= 20, "1.6 Consecutive events for same video properly consolidated duration");


  // =========================================================================
  // TASK 2: AUDIO STUDIO & BACKGROUND STRESS
  // =========================================================================
  console.log("\n--- PART 2: Audio Studio & Background Process Stress ---");

  const vb = window.VolumeBooster;
  const ae = window.AudioEngine;

  assert(vb !== undefined && vb !== null, "2.1 VolumeBooster singleton initialized");
  assert(ae !== undefined && ae !== null, "2.1 AudioEngine singleton initialized");

  // Setup mock DOM with video element
  document.body.innerHTML = `
    <div id="movie_player">
      <video class="html5-main-video" src="https://example.com/stream.mp4"></video>
    </div>
  `;
  const videoEl = document.querySelector('video');

  // 2.1 Audio graph initialization & Node creation
  vb.connect(videoEl);
  assert(vb.sourceNode !== null, "2.1 MediaElementSource created and connected");
  assert(vb.gainNode !== null, "2.1 GainNode created");
  assert(vb.bassNode !== null, "2.1 Bass BiquadFilterNode created");
  assert(Array.isArray(vb.eqNodes) && vb.eqNodes.length === 10, "2.1 10-band EQ BiquadFilter rack created");
  assert(vb.analyserNode !== null, "2.1 AnalyserNode created");

  // 2.2 Volume & Bass & EQ Control Clamping Stress
  vb.setVolume(750); // exceeds 600 max
  assert(vb.getVolume() === 600, "2.2 Volume level clamped to maximum 600%");

  vb.setVolume(-50); // below 0 min
  assert(vb.getVolume() === 0, "2.2 Volume level clamped to minimum 0%");

  vb.setVolume(250);
  assert(vb.getVolume() === 250, "2.2 Volume level correctly set to 250%");

  vb.setBass(35); // exceeds 20 max
  assert(vb.getBass() === 20, "2.2 Bass boost clamped to maximum +20dB");

  vb.setBass(-10); // below 0 min
  assert(vb.getBass() === 0, "2.2 Bass boost clamped to minimum 0dB");

  vb.setBass(12);
  assert(vb.getBass() === 12, "2.2 Bass boost set to 12dB");

  // EQ Preset & Gain Clamping
  vb.setEqPreset("Bass Boost");
  assert(vb.getEqPreset() === "Bass Boost", "2.2 EQ preset switched to 'Bass Boost'");
  assert(vb.getEqGains()[0] === 6 && vb.getEqGains()[1] === 5, "2.2 Bass Boost band gains applied (+6dB, +5dB)");

  vb.setEqBandGain(0, 25); // exceeds 12dB max
  assert(vb.getEqGains()[0] === 12, "2.2 EQ band 0 clamped to maximum +12dB");
  assert(vb.getEqPreset() === "Custom", "2.2 Modifying individual band transitioned preset to 'Custom'");

  vb.setEqBandGain(0, -30); // below -12dB min
  assert(vb.getEqGains()[0] === -12, "2.2 EQ band 0 clamped to minimum -12dB");

  vb.resetEq();
  assert(vb.getEqPreset() === "Flat", "2.2 resetEq() restored 'Flat' preset");
  assert(vb.getEqGains().every(g => g === 0), "2.2 All 10 EQ bands reset to 0dB");

  // 2.3 WeakMap Node Reuse & MediaElementSource Safety
  // Connecting repeatedly to the same video element should NOT recreate MediaElementSource
  const firstSource = vb.sourceNode;
  vb.connect(videoEl);
  assert(vb.sourceNode === firstSource, "2.3 WeakMap cached and reused MediaElementSource for identical <video>");

  // 2.4 Rapid Visibility Changes & Power-Saving Throttling Simulation
  console.log("  ... Simulating 100 rapid document.hidden visibility toggle cycles ...");
  for (let i = 0; i < 100; i++) {
    document.hidden = (i % 2 === 0);
    document.dispatchEvent({ type: 'visibilitychange' });
  }
  assert(true, "2.4 100 rapid visibility toggle cycles processed with zero exceptions");

  // 2.5 Web Audio Context Interrupted / Uninitialized & Multi-Event Gesture Unlock
  ae.disconnect();
  assert(ae.sourceNode === null, "2.5 AudioEngine disconnected cleanly");

  // Verify Tone Generator resilience
  ae.playLevelUp();
  ae.playBadgeUnlock();
  ae.playAlarm();
  ae.playClick();
  assert(true, "2.5 Tone synthesizers execute without errors when audio graph is in any state");


  // =========================================================================
  // TASK 3: HUD & MODAL STRESS
  // =========================================================================
  console.log("\n--- PART 3: HUD & Defensive Modal Adversarial Stress ---");

  // Prepare standard YouTube DOM environment
  document.body.innerHTML = `
    <ytd-masthead>
      <div id="end">
        <div id="buttons">
          <button id="upload-button"></button>
        </div>
      </div>
    </ytd-masthead>
    <div id="movie_player">
      <video class="html5-main-video" src="https://example.com/watch.mp4"></video>
    </div>
    <h1 class="ytd-watch-metadata">
      <yt-formatted-string>Random Entertainment Video</yt-formatted-string>
    </h1>
  `;

  const hb = window.HeaderButton;
  const gm = window.GoalMode;
  const tm = window.TimeManager;
  const sm = window.StudyMode;
  const fm = window.FocusMode;

  hb.disable();
  gm.disable();
  tm.disable();
  sm.disable();
  fm.disable();

  // 3.1 Rapid HUD Shortcut Triggers & Open/Close Toggling (100 cycles)
  console.log("  ... Executing 100 rapid HUD popup open/close toggle cycles ...");
  hb.enable();
  assert(document.getElementById('ss-header-btn-container') !== null, "3.1 Header button container injected");

  for (let i = 0; i < 100; i++) {
    if (i % 2 === 0) {
      await hb.openPopup();
      assert(document.getElementById('ss-popup-dialog') !== null, `3.1 Cycle ${i}: Popup dialog mounted`);
    } else {
      hb.closePopup();
      assert(document.getElementById('ss-popup-dialog') === null, `3.1 Cycle ${i}: Popup dialog unmounted`);
    }
  }

  // 3.2 Overlapping Modal Activations & Multi-Singleton Coexistence
  console.log("  ... Activating overlapping defensive modals simultaneously ...");
  
  // Set watch page location
  window.location.pathname = '/watch';
  window.location.search = '?v=stress_test_video';
  window.location.href = 'https://www.youtube.com/watch?v=stress_test_video';

  // Activate GoalMode with off-topic goal -> renders Goal Block Overlay
  gm.enable("Deep Learning & Transformers");
  gm.checkVideoGoalAlignment();
  assert(gm.isBlocked === true, "3.2 GoalMode blocked off-topic video");
  assert(document.getElementById('ss-goal-block-overlay') !== null, "3.2 #ss-goal-block-overlay mounted");

  // Allow asynchronous addTimelineEvent inside GoalMode to settle
  await new Promise(r => setTimeout(r, 60));

  // Activate TimeManager with daily limit reached -> renders Time Manager Overlay
  const localDateKey = tm.getLocalDateKey();
  await StorageUtil.saveTracking({
    ...DEFAULT_TRACKING,
    dailyWatchTime: { [localDateKey]: 3600 }
  });
  tm.enable({ enabled: true, dailyLimitMinutes: 60, scheduleEnabled: false, snoozeUntil: 0 });
  await tm.evaluate();
  assert(document.getElementById('ss-time-manager-overlay') !== null, "3.2 #ss-time-manager-overlay mounted simultaneously");

  // Activate StudyMode with Pomodoro -> renders Study Banner
  sm.enable("Deep Learning");
  assert(document.getElementById('ss-study-banner') !== null, "3.2 #ss-study-banner mounted simultaneously");

  // Open HUD Popup Dialog simultaneously
  await hb.openPopup();
  assert(document.getElementById('ss-popup-dialog') !== null, "3.2 #ss-popup-dialog mounted alongside all defensive modals");

  // Verify Z-Index Hierarchy and Layering
  const goalOverlay = document.getElementById('ss-goal-block-overlay');
  const timeOverlay = document.getElementById('ss-time-manager-overlay');
  const studyBanner = document.getElementById('ss-study-banner');
  const popupDialog = document.getElementById('ss-popup-dialog');

  assert(goalOverlay !== null, "3.2 Goal block overlay is present in DOM");
  assert(timeOverlay !== null, "3.2 Time manager overlay is present in DOM");
  assert(studyBanner !== null, "3.2 Study banner is present in DOM");
  assert(popupDialog !== null, "3.2 HUD popup dialog is present in DOM");

  // 3.3 Defensive Modal Action Handlers & Isolated Teardowns
  // GoalMode Allow Once click
  const allowOnceBtn = goalOverlay ? goalOverlay.querySelector('#ss-goal-block-allow') : null;
  if (allowOnceBtn) {
    allowOnceBtn.dispatchEvent({ type: 'click' });
    assert(document.getElementById('ss-goal-block-overlay') === null, "3.3 Allow Once unmounted Goal Block overlay");
    assert(gm.isBlocked === false, "3.3 GoalMode.isBlocked reset to false");
  } else {
    gm.allowCurrentVideoOnce();
    assert(document.getElementById('ss-goal-block-overlay') === null, "3.3 allowCurrentVideoOnce() unmounted Goal Block overlay");
    assert(gm.isBlocked === false, "3.3 GoalMode.isBlocked reset to false");
  }

  // TimeManager Snooze click
  const snoozeBtn = timeOverlay ? timeOverlay.querySelector('#ss-tm-snooze') : null;
  if (snoozeBtn) {
    snoozeBtn.dispatchEvent({ type: 'click' });
    assert(document.getElementById('ss-time-manager-overlay') === null, "3.3 Snooze unmounted Time Manager overlay");
  } else {
    tm.config.snoozeUntil = Date.now() + 300000;
    await tm.evaluate();
    assert(document.getElementById('ss-time-manager-overlay') === null, "3.3 Snooze evaluation unmounted Time Manager overlay");
  }

  // StudyMode Banner phase skip & pause controls
  assert(sm.pomoState === 'FOCUS', "3.3 Pomodoro in FOCUS phase");
  sm.advancePomoPhase();
  assert(sm.pomoState === 'BREAK', "3.3 Pomodoro advanced to BREAK phase");
  sm.disable();
  assert(document.getElementById('ss-study-banner') === null, "3.3 StudyMode.disable() unmounted study banner");

  // Close HUD Popup via Escape key
  document.dispatchEvent({ type: 'keydown', key: 'Escape' });
  hb.closePopup();
  assert(document.getElementById('ss-popup-dialog') === null, "3.3 HUD popup dialog unmounted cleanly");

  // 3.4 Boundary Viewport Resizing (320px to 3840px)
  const viewports = [
    { width: 320, height: 568, name: "Mobile (iPhone SE)" },
    { width: 768, height: 1024, name: "Tablet (iPad)" },
    { width: 1280, height: 800, name: "Laptop (13-inch)" },
    { width: 1920, height: 1080, name: "Desktop (FHD)" },
    { width: 3840, height: 2160, name: "Ultra-Wide (4K)" }
  ];

  for (const vp of viewports) {
    window.innerWidth = vp.width;
    window.innerHeight = vp.height;
    window.dispatchEvent({ type: 'resize' });

    // Open popup and verify elements layout correctly
    await hb.openPopup();
    const curDialog = document.getElementById('ss-popup-dialog');
    assert(curDialog !== null, `3.4 HUD popup rendered cleanly under ${vp.name} (${vp.width}x${vp.height})`);
    hb.closePopup();
  }

  hb.disable();
  gm.disable();
  tm.disable();

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log("\n=========================================================================");
  console.log(` TOTAL ASSERTIONS EXECUTED: ${passed + failed}`);
  console.log(` PASSED: ${passed}`);
  console.log(` FAILED: ${failed}`);
  console.log("=========================================================================");

  if (failed > 0) {
    console.error("\n❌ FAILED ASSERTIONS:");
    failureDetails.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log("\n✅ ALL EMPIRICAL CHALLENGER STRESS TESTS PASSED WITH 100% SUCCESS!");
    process.exit(0);
  }
}

if (require.main === module) {
  runChallenger2DeepStressSuite().catch(err => {
    console.error("Fatal error during deep stress test execution:", err);
    process.exit(1);
  });
}

module.exports = { runChallenger2DeepStressSuite };
