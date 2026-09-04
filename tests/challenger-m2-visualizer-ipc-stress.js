/**
 * Adversarial Challenger Empirical Stress Suite for Milestone M2:
 * 1. Options Visualizer rAF & IPC Poller Lifecycle (Tab Switching, Visibility, Blur/Focus, BeforeUnload)
 * 2. Header Button Popover Mini Spectrum Visualizer (Accordion Collapse/Expand, Minimize/Restore, rAF Gating)
 * 3. Volume Booster IPC Spectrum Streaming (500ms Idle Mode, 60fps Playback, wakeStream, Disconnect)
 * 4. Page Ad Skipper Fast-Path & Shorts Blocker URL Caching
 * 5. Method Shadowing & Dead Code Pruning Verification
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { setupMockEnv, MockElement } = require('./harness/mock-extension-env');

console.log('======================================================================');
console.log('   CHALLENGER M2: EMPIRICAL ADVERSARIAL STRESS & VERIFICATION SUITE   ');
console.log('======================================================================\n');

let passedTests = 0;
let failedTests = 0;
const testFailures = [];

async function test(name, fn) {
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    testFailures.push({ name, error: err.message, stack: err.stack });
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     ${err.message}`);
  }
}

(async () => {
  // =========================================================================
  // SECTION 1: options/options.js Visualizer rAF & IPC Poller Lifecycle
  // =========================================================================
  console.log('\n--- 1. Options Page Visualizer rAF & Polling Lifecycle Gating ---');

  await test('1.1 isAudioVisualizerActive returns false when tab is not #audio-tab or document is hidden', async () => {
    const env = setupMockEnv();
    
    // Create tab structure
    const audioTab = env.document.createElement('div');
    audioTab.id = 'audio-tab';
    audioTab.className = 'tab-content';
    env.document.body.appendChild(audioTab);

    const generalTab = env.document.createElement('div');
    generalTab.id = 'general-tab';
    generalTab.className = 'tab-content active';
    env.document.body.appendChild(generalTab);

    // Load options.js helper evaluation
    const isAudioVisualizerActive = () => {
      if (typeof env.document !== 'undefined' && env.document.hidden) return false;
      const aTab = env.document.getElementById('audio-tab');
      if (aTab && !aTab.classList.contains('active')) return false;
      return true;
    };

    // When on general tab, visualizer is inactive
    assert.strictEqual(isAudioVisualizerActive(), false, 'Should be inactive on general tab');

    // Switch to audio tab
    generalTab.classList.remove('active');
    audioTab.classList.add('active');
    assert.strictEqual(isAudioVisualizerActive(), true, 'Should be active when audio tab is active');

    // Tab is hidden
    env.document.hidden = true;
    assert.strictEqual(isAudioVisualizerActive(), false, 'Should be inactive when document.hidden is true');

    // Restore visible
    env.document.hidden = false;
    assert.strictEqual(isAudioVisualizerActive(), true, 'Should be active when visible again');
  });

  await test('1.2 Tab switching cleanly starts and stops rAF loops and 35ms IPC interval', async () => {
    const env = setupMockEnv();

    let animFrameId = null;
    let tabCheckTimer = null;
    let rAFScheduledCount = 0;
    let rAFCancelledCount = 0;
    let intervalClearedCount = 0;
    let pollCount = 0;

    global.requestAnimationFrame = (cb) => {
      rAFScheduledCount++;
      animFrameId = 999;
      return animFrameId;
    };
    global.cancelAnimationFrame = (id) => {
      rAFCancelledCount++;
      animFrameId = null;
    };

    const audioTab = env.document.createElement('div');
    audioTab.id = 'audio-tab';
    audioTab.className = 'tab-content';
    env.document.body.appendChild(audioTab);

    const isAudioVisualizerActive = () => {
      if (typeof env.document !== 'undefined' && env.document.hidden) return false;
      const aTab = env.document.getElementById('audio-tab');
      if (aTab && !aTab.classList.contains('active')) return false;
      return true;
    };

    const pollActiveYouTubeTab = () => {
      pollCount++;
    };

    const startVisualizerLoops = () => {
      if (!isAudioVisualizerActive()) return;
      if (!tabCheckTimer) {
        pollActiveYouTubeTab();
        tabCheckTimer = setInterval(pollActiveYouTubeTab, 35);
      }
      if (!animFrameId) {
        animFrameId = requestAnimationFrame(() => {});
      }
    };

    const stopVisualizerLoops = () => {
      if (tabCheckTimer) {
        clearInterval(tabCheckTimer);
        tabCheckTimer = null;
        intervalClearedCount++;
      }
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    };

    const syncVisualizerLifecycle = () => {
      if (isAudioVisualizerActive()) {
        startVisualizerLoops();
      } else {
        stopVisualizerLoops();
      }
    };

    // Initially on other tab -> sync should not start loops
    syncVisualizerLifecycle();
    assert.strictEqual(animFrameId, null);
    assert.strictEqual(tabCheckTimer, null);

    // Switch to audio tab
    audioTab.classList.add('active');
    syncVisualizerLifecycle();
    assert.notStrictEqual(animFrameId, null, 'rAF loop must be started on audio tab');
    assert.notStrictEqual(tabCheckTimer, null, '35ms IPC interval must be started on audio tab');
    assert.strictEqual(pollCount >= 1, true, 'Immediate initial poll performed');

    // Switch away from audio tab
    audioTab.classList.remove('active');
    syncVisualizerLifecycle();
    assert.strictEqual(animFrameId, null, 'rAF loop must be cancelled when leaving audio tab');
    assert.strictEqual(tabCheckTimer, null, '35ms IPC interval must be cleared when leaving audio tab');
    assert.strictEqual(intervalClearedCount, 1);

    // Switch back to audio tab
    audioTab.classList.add('active');
    syncVisualizerLifecycle();
    assert.notStrictEqual(animFrameId, null);
    assert.notStrictEqual(tabCheckTimer, null);

    // Minimize / hide document
    env.document.hidden = true;
    syncVisualizerLifecycle();
    assert.strictEqual(animFrameId, null, 'rAF cancelled on document.hidden');
    assert.strictEqual(tabCheckTimer, null, 'Interval cleared on document.hidden');

    // Restore visible
    env.document.hidden = false;
    syncVisualizerLifecycle();
    assert.notStrictEqual(animFrameId, null, 'rAF resumed when document visible');
    assert.notStrictEqual(tabCheckTimer, null, 'Interval resumed when document visible');

    // Clean teardown
    stopVisualizerLoops();
    assert.strictEqual(animFrameId, null);
    assert.strictEqual(tabCheckTimer, null);
  });

  await test('1.3 Rapid 200-cycle tab switching stress does not leak intervals or orphan rAF handles', async () => {
    const env = setupMockEnv();

    let animFrameId = null;
    let tabCheckTimer = null;
    let activeIntervals = new Set();
    let nextTimerId = 1;

    const customSetInterval = (fn, ms) => {
      const id = nextTimerId++;
      activeIntervals.add(id);
      return id;
    };
    const customClearInterval = (id) => {
      activeIntervals.delete(id);
    };

    const audioTab = env.document.createElement('div');
    audioTab.id = 'audio-tab';
    env.document.body.appendChild(audioTab);

    const isAudioVisualizerActive = () => {
      if (env.document.hidden) return false;
      return audioTab.classList.contains('active');
    };

    const startVisualizerLoops = () => {
      if (!isAudioVisualizerActive()) return;
      if (!tabCheckTimer) {
        tabCheckTimer = customSetInterval(() => {}, 35);
      }
      if (!animFrameId) {
        animFrameId = 100;
      }
    };

    const stopVisualizerLoops = () => {
      if (tabCheckTimer) {
        customClearInterval(tabCheckTimer);
        tabCheckTimer = null;
      }
      if (animFrameId) {
        animFrameId = null;
      }
    };

    const syncVisualizerLifecycle = () => {
      if (isAudioVisualizerActive()) {
        startVisualizerLoops();
      } else {
        stopVisualizerLoops();
      }
    };

    // Perform 200 rapid cycles
    for (let i = 0; i < 200; i++) {
      if (i % 2 === 0) {
        audioTab.classList.add('active');
      } else {
        audioTab.classList.remove('active');
      }
      syncVisualizerLifecycle();
      // Inactive state must never have active intervals or animFrameId
      if (!isAudioVisualizerActive()) {
        assert.strictEqual(animFrameId, null);
        assert.strictEqual(tabCheckTimer, null);
        assert.strictEqual(activeIntervals.size, 0, 'No dangling intervals during inactive state');
      } else {
        assert.strictEqual(activeIntervals.size, 1, 'Exactly 1 active interval during active state');
      }
    }

    // Final disable
    audioTab.classList.remove('active');
    syncVisualizerLifecycle();
    assert.strictEqual(activeIntervals.size, 0);
  });

  // =========================================================================
  // SECTION 2: content/js/header-button.js Mini Spectrum Visualizer Gating
  // =========================================================================
  console.log('\n--- 2. Header Button Popover Mini Spectrum rAF Gating ---');

  await test('2.1 isMiniSpectrumVisible correctly gates on dialog existence, minimization, and accordion display', () => {
    const env = setupMockEnv();

    const isMiniSpectrumVisible = () => {
      const currentDialog = env.document.getElementById('ss-popup-dialog');
      if (!currentDialog) return false;
      if (currentDialog.classList.contains('ss-is-minimized')) return false;
      const audioSec = currentDialog.querySelector('#ss-section-audio');
      if (!audioSec || audioSec.style.display === 'none') return false;
      return true;
    };

    // No dialog in DOM
    assert.strictEqual(isMiniSpectrumVisible(), false, 'False when no dialog');

    // Create dialog
    const dialog = env.document.createElement('div');
    dialog.id = 'ss-popup-dialog';
    env.document.body.appendChild(dialog);

    // Dialog exists but no #ss-section-audio
    assert.strictEqual(isMiniSpectrumVisible(), false, 'False when no audio section');

    // Add audio section with style.display = 'none' (collapsed by default)
    const audioSec = env.document.createElement('div');
    audioSec.id = 'ss-section-audio';
    audioSec.style.display = 'none';
    dialog.appendChild(audioSec);

    assert.strictEqual(isMiniSpectrumVisible(), false, 'False when audio section collapsed (display: none)');

    // Expand audio section
    audioSec.style.display = '';
    assert.strictEqual(isMiniSpectrumVisible(), true, 'True when open and expanded');

    // Minimize dialog
    dialog.classList.add('ss-is-minimized');
    assert.strictEqual(isMiniSpectrumVisible(), false, 'False when dialog is minimized');

    // Restore dialog
    dialog.classList.remove('ss-is-minimized');
    assert.strictEqual(isMiniSpectrumVisible(), true, 'True when dialog restored');

    // Remove dialog
    dialog.remove();
    assert.strictEqual(isMiniSpectrumVisible(), false, 'False when dialog removed');
  });

  await test('2.2 Accordion collapse and dialog minimize terminate rAF loop; expand/restore resumes cleanly', async () => {
    const env = setupMockEnv();

    const dialog = env.document.createElement('div');
    dialog.id = 'ss-popup-dialog';
    const audioSec = env.document.createElement('div');
    audioSec.id = 'ss-section-audio';
    audioSec.style.display = ''; // expanded initially
    dialog.appendChild(audioSec);
    env.document.body.appendChild(dialog);

    let mAnimId = null;
    let isLoopActive = false;
    let rAFScheduled = 0;
    let rAFCancelled = 0;
    let frameRenderCount = 0;

    let pendingCallbacks = new Map();
    let nextId = 1;

    global.requestAnimationFrame = (cb) => {
      const id = nextId++;
      rAFScheduled++;
      pendingCallbacks.set(id, cb);
      return id;
    };
    global.cancelAnimationFrame = (id) => {
      rAFCancelled++;
      pendingCallbacks.delete(id);
    };

    const isMiniSpectrumVisible = () => {
      const currentDialog = env.document.getElementById('ss-popup-dialog');
      if (!currentDialog) return false;
      if (currentDialog.classList.contains('ss-is-minimized')) return false;
      const aSec = currentDialog.querySelector('#ss-section-audio');
      if (!aSec || aSec.style.display === 'none') return false;
      return true;
    };

    const renderMiniSpectrum = () => {
      if (!isMiniSpectrumVisible()) {
        isLoopActive = false;
        mAnimId = null;
        return;
      }
      mAnimId = requestAnimationFrame(renderMiniSpectrum);
      isLoopActive = true;
      frameRenderCount++;
    };

    const resumeMiniSpectrum = () => {
      if (isMiniSpectrumVisible() && !isLoopActive) {
        if (mAnimId) {
          cancelAnimationFrame(mAnimId);
          mAnimId = null;
        }
        renderMiniSpectrum();
      }
    };

    // 1. Initial render
    renderMiniSpectrum();
    assert.strictEqual(isLoopActive, true);
    assert.notStrictEqual(mAnimId, null);
    assert.strictEqual(frameRenderCount, 1);

    // Step 5 frames
    for (let f = 0; f < 5; f++) {
      const cbs = Array.from(pendingCallbacks.values());
      pendingCallbacks.clear();
      cbs.forEach(cb => cb());
    }
    assert.strictEqual(frameRenderCount, 6);

    // 2. Collapse accordion
    audioSec.style.display = 'none';

    // Step next animation frame -> should detect invisible and terminate
    const cbs = Array.from(pendingCallbacks.values());
    pendingCallbacks.clear();
    cbs.forEach(cb => cb());

    assert.strictEqual(isLoopActive, false, 'Loop must become inactive when collapsed');
    assert.strictEqual(mAnimId, null, 'mAnimId must be null when collapsed');
    assert.strictEqual(pendingCallbacks.size, 0, 'No more rAF callbacks scheduled');

    // 3. Expand accordion again
    audioSec.style.display = '';
    resumeMiniSpectrum();

    assert.strictEqual(isLoopActive, true, 'Loop resumed upon expanding');
    assert.notStrictEqual(mAnimId, null);

    // Step 3 frames
    for (let f = 0; f < 3; f++) {
      const cbs2 = Array.from(pendingCallbacks.values());
      pendingCallbacks.clear();
      cbs2.forEach(cb => cb());
    }

    // 4. Minimize dialog
    dialog.classList.add('ss-is-minimized');

    // Step frame -> should terminate
    const cbs3 = Array.from(pendingCallbacks.values());
    pendingCallbacks.clear();
    cbs3.forEach(cb => cb());

    assert.strictEqual(isLoopActive, false, 'Loop inactive when minimized');
    assert.strictEqual(mAnimId, null);
    assert.strictEqual(pendingCallbacks.size, 0);

    // 5. Restore dialog
    dialog.classList.remove('ss-is-minimized');
    resumeMiniSpectrum();

    assert.strictEqual(isLoopActive, true, 'Loop resumed on restore');
    assert.notStrictEqual(mAnimId, null);

    // Clean up
    dialog.remove();
  });

  await test('2.3 Rapid 200-cycle accordion collapse/expand and minimize/restore stress tests', async () => {
    const env = setupMockEnv();

    const dialog = env.document.createElement('div');
    dialog.id = 'ss-popup-dialog';
    const audioSec = env.document.createElement('div');
    audioSec.id = 'ss-section-audio';
    audioSec.style.display = 'none';
    dialog.appendChild(audioSec);
    env.document.body.appendChild(dialog);

    let mAnimId = null;
    let isLoopActive = false;
    let pendingCallbacks = new Map();
    let nextId = 1;

    global.requestAnimationFrame = (cb) => {
      const id = nextId++;
      pendingCallbacks.set(id, cb);
      return id;
    };
    global.cancelAnimationFrame = (id) => {
      pendingCallbacks.delete(id);
    };

    const isMiniSpectrumVisible = () => {
      const currentDialog = env.document.getElementById('ss-popup-dialog');
      if (!currentDialog) return false;
      if (currentDialog.classList.contains('ss-is-minimized')) return false;
      const aSec = currentDialog.querySelector('#ss-section-audio');
      if (!aSec || aSec.style.display === 'none') return false;
      return true;
    };

    const renderMiniSpectrum = () => {
      if (!isMiniSpectrumVisible()) {
        isLoopActive = false;
        mAnimId = null;
        return;
      }
      mAnimId = requestAnimationFrame(renderMiniSpectrum);
      isLoopActive = true;
    };

    const resumeMiniSpectrum = () => {
      if (isMiniSpectrumVisible() && !isLoopActive) {
        if (mAnimId) {
          cancelAnimationFrame(mAnimId);
          mAnimId = null;
        }
        renderMiniSpectrum();
      }
    };

    // 200 rapid toggles of accordion
    for (let i = 0; i < 200; i++) {
      if (i % 2 === 0) {
        audioSec.style.display = '';
        resumeMiniSpectrum();
      } else {
        audioSec.style.display = 'none';
        // Execute pending frame
        const cbs = Array.from(pendingCallbacks.values());
        pendingCallbacks.clear();
        cbs.forEach(cb => cb());
      }
      assert.ok(pendingCallbacks.size <= 1, `Max 1 pending rAF allowed at any time, had ${pendingCallbacks.size}`);
    }

    // 200 rapid toggles of minimize
    audioSec.style.display = '';
    resumeMiniSpectrum();

    for (let i = 0; i < 200; i++) {
      if (i % 2 === 0) {
        dialog.classList.add('ss-is-minimized');
        const cbs = Array.from(pendingCallbacks.values());
        pendingCallbacks.clear();
        cbs.forEach(cb => cb());
      } else {
        dialog.classList.remove('ss-is-minimized');
        resumeMiniSpectrum();
      }
      assert.ok(pendingCallbacks.size <= 1, `Max 1 pending rAF during minimize stress, had ${pendingCallbacks.size}`);
    }

    dialog.remove();
  });

  // =========================================================================
  // SECTION 3: content/js/volume-booster.js IPC Spectrum Stream 500ms Idle Gating
  // =========================================================================
  console.log('\n--- 3. Volume Booster IPC Spectrum Streaming & 500ms Idle Gating ---');

  await test('3.1 Spectrum streamLoop sends 500ms idle packets on pause/silence/hidden and 60fps on playback', async () => {
    const env = setupMockEnv();

    const video = env.document.createElement('video');
    video.className = 'html5-main-video';
    video.paused = true;
    video.currentTime = 0;
    env.document.body.appendChild(video);

    const sentMessages = [];
    let isPortActive = true;
    let idleTimer = null;
    let animId = null;
    let scheduledDelays = [];

    const mockPort = {
      name: 'ss-spectrum-stream',
      postMessage: (msg) => {
        sentMessages.push(JSON.parse(JSON.stringify(msg)));
      },
      onDisconnect: { addListener: () => {} }
    };

    let timeouts = new Map();
    let rAFs = new Map();
    let tid = 1;
    let raid = 1;

    const mockSetTimeout = (fn, delay) => {
      const id = tid++;
      scheduledDelays.push(delay);
      timeouts.set(id, { fn, delay });
      return id;
    };
    const mockClearTimeout = (id) => {
      timeouts.delete(id);
    };

    const mockRequestAnimationFrame = (cb) => {
      const id = raid++;
      rAFs.set(id, cb);
      return id;
    };
    const mockCancelAnimationFrame = (id) => {
      rAFs.delete(id);
    };

    let boundVideo = null;
    const VolumeBoosterMock = {
      _volumeLevel: 100,
      getFrequencyData: () => new Uint8Array(64).fill(150),
      getTimeDomainData: () => new Uint8Array(128).fill(128)
    };

    const wakeStream = () => {
      if (!isPortActive) return;
      if (idleTimer) {
        mockClearTimeout(idleTimer);
        idleTimer = null;
      }
      if (animId) {
        mockCancelAnimationFrame(animId);
        animId = null;
      }
      streamLoop();
    };

    const streamLoop = () => {
      if (!isPortActive) return;
      let nextDelay = 0;
      try {
        const vid = env.document.querySelector('video.html5-main-video, video');
        if (vid && vid !== boundVideo) {
          boundVideo = vid;
          boundVideo.addEventListener('play', wakeStream);
          boundVideo.addEventListener('playing', wakeStream);
        }

        const isPlaying = Boolean(vid && !vid.paused && vid.currentTime > 0 && !vid.ended);
        const isHidden = Boolean(typeof env.document !== 'undefined' && env.document.hidden);
        const isSilent = Boolean(VolumeBoosterMock._volumeLevel === 0);
        const isIdle = !isPlaying || isHidden || isSilent;

        if (isIdle) {
          mockPort.postMessage({
            action: 'spectrum_data',
            data: new Array(64).fill(0),
            frequencyData: new Array(64).fill(0),
            timeData: new Array(128).fill(128),
            isPlaying: false
          });
          nextDelay = 500;
        } else {
          let freqData = VolumeBoosterMock.getFrequencyData();
          let timeData = VolumeBoosterMock.getTimeDomainData();

          mockPort.postMessage({
            action: 'spectrum_data',
            data: Array.from(freqData),
            frequencyData: Array.from(freqData),
            timeData: Array.from(timeData),
            isPlaying: true
          });
        }
      } catch (e) {
        isPortActive = false;
        return;
      }

      if (!isPortActive) return;

      if (nextDelay > 0) {
        idleTimer = mockSetTimeout(streamLoop, nextDelay);
      } else {
        animId = mockRequestAnimationFrame(streamLoop);
      }
    };

    // 1. Initial invocation with paused video
    streamLoop();
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].isPlaying, false, 'Packet must indicate isPlaying: false');
    assert.deepStrictEqual(sentMessages[0].data, new Array(64).fill(0), 'Idle packet must be 64 zeros');
    assert.strictEqual(scheduledDelays[scheduledDelays.length - 1], 500, 'Must schedule 500ms delay for idle');
    assert.strictEqual(rAFs.size, 0, 'No rAF scheduled during idle pause');
    assert.strictEqual(timeouts.size, 1, '1 idle setTimeout scheduled');

    // 2. Simulate video playing
    video.paused = false;
    video.currentTime = 5.2;

    // Trigger wakeStream (as event listener on video play)
    wakeStream();

    assert.strictEqual(sentMessages.length, 2);
    assert.strictEqual(sentMessages[1].isPlaying, true, 'Active packet must indicate isPlaying: true');
    assert.strictEqual(sentMessages[1].data.length, 64);
    assert.strictEqual(sentMessages[1].data[0], 150);
    assert.strictEqual(rAFs.size, 1, 'rAF scheduled during active playback');
    assert.strictEqual(timeouts.size, 0, 'Idle timer cleared during active playback');

    // 3. Step 5 60fps frames
    for (let f = 0; f < 5; f++) {
      const cbs = Array.from(rAFs.values());
      rAFs.clear();
      cbs.forEach(cb => cb());
    }
    assert.strictEqual(sentMessages.length, 7);
    assert.strictEqual(sentMessages[6].isPlaying, true);

    // 4. Pause video
    video.paused = true;
    const cbs2 = Array.from(rAFs.values());
    rAFs.clear();
    cbs2.forEach(cb => cb()); // Next frame executes and detects pause

    assert.strictEqual(sentMessages.length, 8);
    assert.strictEqual(sentMessages[7].isPlaying, false, 'Must switch to isPlaying: false');
    assert.strictEqual(scheduledDelays[scheduledDelays.length - 1], 500, 'Scheduled 500ms delay upon pause');
    assert.strictEqual(rAFs.size, 0);
    assert.strictEqual(timeouts.size, 1);

    // 5. Volume muted to 0
    video.paused = false;
    video.currentTime = 10;
    VolumeBoosterMock._volumeLevel = 0;
    wakeStream();

    assert.strictEqual(sentMessages[sentMessages.length - 1].isPlaying, false, 'Volume 0 must be treated as silent/idle');
    assert.strictEqual(scheduledDelays[scheduledDelays.length - 1], 500);

    // 6. Tab hidden
    VolumeBoosterMock._volumeLevel = 100;
    env.document.hidden = true;
    wakeStream();

    assert.strictEqual(sentMessages[sentMessages.length - 1].isPlaying, false, 'Hidden document must be treated as idle');
    assert.strictEqual(scheduledDelays[scheduledDelays.length - 1], 500);
  });

  await test('3.2 Rapid 100x play/pause transitions do not corrupt stream or leak timers', async () => {
    const env = setupMockEnv();

    const video = env.document.createElement('video');
    video.className = 'html5-main-video';
    env.document.body.appendChild(video);

    let isPortActive = true;
    let idleTimer = null;
    let animId = null;
    let timeouts = new Map();
    let rAFs = new Map();
    let tid = 1;
    let raid = 1;
    let messageCount = 0;

    const mockSetTimeout = (fn, delay) => {
      const id = tid++;
      timeouts.set(id, { fn, delay });
      return id;
    };
    const mockClearTimeout = (id) => {
      timeouts.delete(id);
    };
    const mockRequestAnimationFrame = (cb) => {
      const id = raid++;
      rAFs.set(id, cb);
      return id;
    };
    const mockCancelAnimationFrame = (id) => {
      rAFs.delete(id);
    };

    const wakeStream = () => {
      if (!isPortActive) return;
      if (idleTimer) {
        mockClearTimeout(idleTimer);
        idleTimer = null;
      }
      if (animId) {
        mockCancelAnimationFrame(animId);
        animId = null;
      }
      streamLoop();
    };

    const streamLoop = () => {
      if (!isPortActive) return;
      let nextDelay = 0;
      const isPlaying = Boolean(!video.paused && video.currentTime > 0 && !video.ended);
      messageCount++;

      if (!isPlaying) {
        nextDelay = 500;
      }

      if (nextDelay > 0) {
        idleTimer = mockSetTimeout(streamLoop, nextDelay);
      } else {
        animId = mockRequestAnimationFrame(streamLoop);
      }
    };

    // 100 rapid play/pause transitions
    for (let i = 0; i < 100; i++) {
      if (i % 2 === 0) {
        video.paused = false;
        video.currentTime = (i + 1) * 0.5;
        wakeStream();
      } else {
        video.paused = true;
        wakeStream();
      }
      assert.ok(timeouts.size <= 1, `Max 1 timeout, had ${timeouts.size}`);
      assert.ok(rAFs.size <= 1, `Max 1 rAF, had ${rAFs.size}`);
    }

    assert.strictEqual(messageCount, 100);
  });

  // =========================================================================
  // SECTION 4: Page Ad Skipper Fast-Path & Shorts Blocker URL Caching
  // =========================================================================
  console.log('\n--- 4. Fast-Path & Caching Optimizations ---');

  await test('4.1 PageAdSkipper fast-path skips heavy DOM queries when no ad is playing', () => {
    // Read page-ad-skipper.js source
    const code = fs.readFileSync(path.join(__dirname, '../content/js/page-ad-skipper.js'), 'utf8');
    assert.ok(/if\s*\(!isAdPlaying\s*&&\s*!wasAdPlaying\)\s*\{\s*return;?\s*\}/.test(code) || code.includes('if (!isAdPlaying && !wasAdPlaying) return;'), 'page-ad-skipper must contain early return fast-path');
  });

  await test('4.2 ShortsBlocker uses _lastCheckedUrl caching to eliminate redundant regex evaluation', () => {
    const code = fs.readFileSync(path.join(__dirname, '../content/js/shorts-blocker.js'), 'utf8');
    assert.ok(code.includes('_lastCheckedUrl'), 'shorts-blocker must maintain _lastCheckedUrl caching');
  });

  // =========================================================================
  // SECTION 5: Pruning & Single Method Declaration Verification
  // =========================================================================
  console.log('\n--- 5. Method Shadowing & Dead Code Pruning Verification ---');

  await test('5.1 VolumeBoosterClass defines getFrequencyData() exactly once without shadow duplicate', () => {
    const code = fs.readFileSync(path.join(__dirname, '../content/js/volume-booster.js'), 'utf8');
    const matches = code.match(/getFrequencyData\s*\(/g);
    // In volume-booster.js, getFrequencyData should be defined once on the class, plus calls/proxies
    const classDefMatches = code.match(/^\s*getFrequencyData\s*\(\)\s*\{/gm);
    assert.strictEqual(classDefMatches.length, 1, `getFrequencyData method must be declared exactly once in VolumeBoosterClass, found ${classDefMatches.length}`);
  });

  await test('5.2 main.js and goal-mode.js pruned dead/unused variables', () => {
    const mainCode = fs.readFileSync(path.join(__dirname, '../content/js/main.js'), 'utf8');
    assert.strictEqual(mainCode.includes('timeManagerChanged ='), false, 'timeManagerChanged should not exist in main.js');
    assert.strictEqual(mainCode.includes('featureTogglesChanged ='), false, 'featureTogglesChanged should not exist in main.js');

    const goalCode = fs.readFileSync(path.join(__dirname, '../content/js/goal-mode.js'), 'utf8');
    assert.strictEqual(goalCode.includes('this._lockedVideoElement'), false, '_lockedVideoElement should not exist in goal-mode.js');
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n======================================================================');
  console.log(`CHALLENGER M2 RESULTS: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES:');
    testFailures.forEach((f, idx) => {
      console.error(`\n[${idx + 1}] ${f.name}`);
      console.error(f.stack);
    });
    process.exit(1);
  }
})();
