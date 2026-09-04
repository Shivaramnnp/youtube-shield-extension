/**
 * Challenger 2 Empirical Stress Test Suite: AdSkipper Playback Assurance & Anti-Adblock Isolation
 * 
 * Deep Empirical Coverage for:
 * 1. Sequential multi-part ads (Ad 1 of 2 -> Ad 2 of 2) across various DOM topologies & state machines
 * 2. Video playback resumption (`video.play()`) across stream transitions, end cards, and error handlers
 * 3. Anti-adblock modal auto-dismissal (`ytd-enforcement-message-view-model`) & strict Polymer backdrop isolation (`tp-yt-iron-overlay-backdrop`)
 */

const { setupMockEnv } = require('./harness/mock-extension-env');
setupMockEnv();

const { StorageUtil, DEFAULT_SETTINGS } = require('../utils/storage');
require('../utils/dom-utils');
require('../content/js/ad-skipper');
require('../content/js/header-button');
require('../content/js/main');

let passed = 0;
let failed = 0;
const failureDetails = [];

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    failureDetails.push(message);
    throw new Error(message);
  } else {
    console.log(`✓ PASS: ${message}`);
    passed++;
  }
}

const setupPlayerDOMWithVideo = (initialTime = 0, duration = 120, paused = false) => {
  document.body.innerHTML = '';
  const player = document.createElement('div');
  player.id = 'movie_player';
  player.className = 'html5-video-player';

  const video = document.createElement('video');
  video.className = 'html5-main-video';
  video.currentTime = initialTime;
  video.duration = duration;
  video.playbackRate = 1;
  video.paused = paused;
  video.ended = false;

  let playCalledCount = 0;
  let pauseCalledCount = 0;
  let shouldRejectPlay = false;

  video.play = () => {
    playCalledCount++;
    if (shouldRejectPlay) {
      return Promise.reject(new Error('NotAllowedError: play() failed because the user didn\'t interact with the document first.'));
    }
    video.paused = false;
    return Promise.resolve();
  };

  video.pause = () => {
    pauseCalledCount++;
    video.paused = true;
  };

  video.getPlayCount = () => playCalledCount;
  video.getPauseCount = () => pauseCalledCount;
  video.setRejectPlay = (val) => { shouldRejectPlay = val; };

  player.appendChild(video);
  document.body.appendChild(player);

  return { player, video };
};

async function runChallenger2Suite() {
  console.log('================================================================');
  console.log('   CHALLENGER 2 EMPIRICAL STRESS TEST SUITE                     ');
  console.log('   Playback Assurance & Anti-Adblock Isolation Verification    ');
  console.log('================================================================\n');

  const skipper = window.AdSkipper;

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1: Sequential Multi-Part Ads (Ad 1 of 2 followed by Ad 2 of 2)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- 1. Sequential Multi-Part Ads Stress Testing ---');

  // Test 1.1: Standard Multi-Part Linear Ads (Ad 1 -> Ad 2 -> Main Video)
  {
    const { player, video } = setupPlayerDOMWithVideo(0, 30, true);
    player.classList.add('ad-showing');
    skipper.enable();

    // Ad 1 of 2 appears
    let ad1Clicked = false;
    const ad1Btn = document.createElement('button');
    ad1Btn.className = 'ytp-ad-skip-button-modern';
    ad1Btn.textContent = 'Skip';
    ad1Btn.click = () => { ad1Clicked = true; };
    player.appendChild(ad1Btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res1 = skipper._trySkip();
    assert(res1 === true, 'Test 1.1a: Ad 1 skipped successfully');
    assert(ad1Clicked === true, 'Test 1.1b: Ad 1 click handler executed');
    assert(video.getPlayCount() === 1, 'Test 1.1c: video.play() called after Ad 1 skip');

    // Simulate YouTube removing Ad 1 and mounting Ad 2
    player.removeChild(ad1Btn);
    video.paused = true; // Stream transition pauses video on Ad 2 entry

    let ad2Clicked = false;
    const ad2Btn = document.createElement('button');
    ad2Btn.className = 'ytp-ad-skip-button-modern';
    ad2Btn.textContent = 'Skip ▶|';
    ad2Btn.click = () => { ad2Clicked = true; };
    player.appendChild(ad2Btn);

    const res2 = skipper._trySkip();
    assert(res2 === true, 'Test 1.1d: Ad 2 skipped successfully in sequence');
    assert(ad2Clicked === true, 'Test 1.1e: Ad 2 click handler executed');
    assert(video.getPlayCount() === 2, 'Test 1.1f: video.play() called after Ad 2 skip');

    skipper.disable();
  }

  // Test 1.2: Same Element Reused for Ad 1 and Ad 2 after cooldown window
  {
    const { player, video } = setupPlayerDOMWithVideo(0, 30, true);
    player.classList.add('ad-showing');
    skipper.enable();

    let clickCount = 0;
    const persistentBtn = document.createElement('button');
    persistentBtn.className = 'ytp-ad-skip-button-modern';
    persistentBtn.textContent = 'Skip';
    persistentBtn.click = () => { clickCount++; };
    player.appendChild(persistentBtn);

    // Skip Ad 1
    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res1 = skipper._trySkip();
    assert(res1 === true && clickCount === 1, 'Test 1.2a: Persistent button clicked for Ad 1');

    // Attempt immediately on same element within 500ms -> should deduplicate
    const resImmediate = skipper._trySkip();
    assert(resImmediate === false && clickCount === 1, 'Test 1.2b: Deduplication prevented rapid double click within 500ms on same element');

    // Simulate time passing (550ms) and Ad 2 being skippable on the same DOM element
    skipper._lastSkipTime = Date.now() - 600;
    const res2 = skipper._trySkip();
    assert(res2 === true && clickCount === 2, 'Test 1.2c: Ad 2 on same element skipped cleanly after cooldown window');

    skipper.disable();
  }

  // Test 1.3: Ad 1 Skippable, Ad 2 Unskippable 15s Countdown
  {
    const { player, video } = setupPlayerDOMWithVideo(0, 30, true);
    player.classList.add('ad-showing');
    skipper.enable();

    // Ad 1 is skippable
    let ad1Clicked = false;
    const ad1Btn = document.createElement('button');
    ad1Btn.className = 'ytp-ad-skip-button-modern';
    ad1Btn.textContent = 'Skip';
    ad1Btn.click = () => { ad1Clicked = true; };
    player.appendChild(ad1Btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res1 = skipper._trySkip();
    assert(res1 === true && ad1Clicked === true, 'Test 1.3a: Ad 1 skipped');

    // Transition to Ad 2 (Unskippable countdown slot)
    player.removeChild(ad1Btn);
    let ad2Clicked = false;
    const unskippableSlot = document.createElement('div');
    unskippableSlot.className = 'ytp-ad-skip-button-slot';
    unskippableSlot.textContent = 'Ad 2 of 2 · 0:15';
    unskippableSlot.click = () => { ad2Clicked = true; };
    player.appendChild(unskippableSlot);

    const res2 = skipper._trySkip();
    assert(res2 === false, 'Test 1.3b: Ad 2 unskippable countdown rejected');
    assert(ad2Clicked === false, 'Test 1.3c: Ad 2 unskippable element was NOT clicked');

    skipper.disable();
  }

  // Test 1.4: Ad 1 Unskippable Countdown ("Skip in 5s"), Ad 2 Skippable ("Skip")
  {
    const { player, video } = setupPlayerDOMWithVideo(0, 30, false);
    player.classList.add('ad-showing');
    skipper.enable();

    // Ad 1 is in countdown mode
    let ad1Clicked = false;
    const ad1CountdownBtn = document.createElement('button');
    ad1CountdownBtn.className = 'ytp-ad-skip-button-modern';
    ad1CountdownBtn.textContent = 'Skip in 5s';
    ad1CountdownBtn.click = () => { ad1Clicked = true; };
    player.appendChild(ad1CountdownBtn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res1 = skipper._trySkip();
    assert(res1 === false && ad1Clicked === false, 'Test 1.4a: Ad 1 countdown not clicked');

    // YouTube transitions to Ad 2 with active skip button
    player.removeChild(ad1CountdownBtn);
    let ad2Clicked = false;
    const ad2Btn = document.createElement('button');
    ad2Btn.className = 'ytp-ad-skip-button-modern';
    ad2Btn.textContent = 'Skip';
    ad2Btn.click = () => { ad2Clicked = true; };
    player.appendChild(ad2Btn);

    const res2 = skipper._trySkip();
    assert(res2 === true && ad2Clicked === true, 'Test 1.4b: Ad 2 skipped once active');

    skipper.disable();
  }

  // Test 1.5: Multi-Part Ads with SPA Navigation Re-attachment
  {
    const { player } = setupPlayerDOMWithVideo(0, 30, false);
    skipper.enable();

    // Trigger SPA navigation event (yt-navigate-finish)
    window.dispatchEvent(new Event('yt-navigate-finish'));

    let newAdClicked = false;
    const newAdBtn = document.createElement('button');
    newAdBtn.className = 'ytp-ad-skip-button-modern';
    newAdBtn.textContent = 'Skip';
    newAdBtn.click = () => { newAdClicked = true; };
    player.appendChild(newAdBtn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true && newAdClicked === true, 'Test 1.5: Post-navigation multi-part ad skipped cleanly');

    skipper.disable();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2: Video Playback Resumption (`video.play()`)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- 2. Video Playback Resumption (`video.play()`) Stress Testing ---');

  // Test 2.1: Playback Resumed when Video is Paused on Ad Skip
  {
    const { player, video } = setupPlayerDOMWithVideo(15, 600, true);
    assert(video.paused === true, 'Video starts paused');
    skipper.enable();

    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, 'Test 2.1a: Skip executed');
    assert(video.paused === false, 'Test 2.1b: video.paused transitioned to false');
    assert(video.getPlayCount() === 1, 'Test 2.1c: video.play() was invoked exactly once');

    skipper.disable();
  }

  // Test 2.2: Already Playing Video is Not Interrupted on Skip
  {
    const { player, video } = setupPlayerDOMWithVideo(15, 600, false);
    assert(video.paused === false, 'Video starts actively playing');
    skipper.enable();

    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, 'Test 2.2a: Skip executed');
    assert(video.getPlayCount() === 0, 'Test 2.2b: video.play() not redundantly called when already playing');

    skipper.disable();
  }

  // Test 2.3: Ended Video (`video.ended === true`) is NOT Resumed
  {
    const { player, video } = setupPlayerDOMWithVideo(600, 600, true);
    video.ended = true;
    skipper.enable();

    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, 'Test 2.3a: Skip executed');
    assert(video.getPlayCount() === 0, 'Test 2.3b: video.play() was NOT called because video had ended');

    skipper.disable();
  }

  // Test 2.4: Async Play Rejection Handled Gracefully (No Unhandled Promise Rejections)
  {
    const { player, video } = setupPlayerDOMWithVideo(10, 600, true);
    video.setRejectPlay(true);
    skipper.enable();

    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;

    let unhandledOccurred = false;
    const rejectionHandler = (reason) => {
      unhandledOccurred = true;
    };
    process.on('unhandledRejection', rejectionHandler);

    try {
      const res = skipper._trySkip();
      assert(res === true, 'Test 2.4a: Skip executed even with rejecting play promise');
      assert(video.getPlayCount() === 1, 'Test 2.4b: video.play() was called');
      // Yield to microtask queue
      await new Promise(r => setTimeout(r, 20));
      assert(unhandledOccurred === false, 'Test 2.4c: No unhandled promise rejection occurred from video.play().catch()');
    } finally {
      process.removeListener('unhandledRejection', rejectionHandler);
      skipper.disable();
    }
  }

  // Test 2.5: Playback Resumed during Fallback DOM Removal (Persistent Ad >= 2000ms)
  {
    const { player, video } = setupPlayerDOMWithVideo(0, 30, true);
    player.classList.add('ad-showing');
    skipper.enable();

    skipper._adStartTime = Date.now() - 2500; // Simulated persistent ad
    const res = skipper._trySkip();
    assert(res === true, 'Test 2.5a: Fallback DOM removal executed for persistent ad');
    assert(video.getPlayCount() === 1, 'Test 2.5b: video.play() invoked during fallback DOM removal');

    skipper.disable();
  }

  // Test 2.6: Multiple Video Elements on Page - Correct Active Player Video Selected
  {
    document.body.innerHTML = '';
    // Background / sidebar preview video
    const sidebar = document.createElement('div');
    sidebar.className = 'ytd-rich-grid-renderer';
    const sidebarVideo = document.createElement('video');
    sidebarVideo.className = 'sidebar-preview-video';
    sidebarVideo.paused = true;
    sidebarVideo.ended = false;
    let sidebarPlayCount = 0;
    sidebarVideo.play = () => { sidebarPlayCount++; sidebarVideo.paused = false; return Promise.resolve(); };
    sidebar.appendChild(sidebarVideo);
    document.body.appendChild(sidebar);

    // Active player video
    const player = document.createElement('div');
    player.id = 'movie_player';
    player.className = 'html5-video-player';
    const mainVideo = document.createElement('video');
    mainVideo.className = 'html5-main-video';
    mainVideo.paused = true;
    mainVideo.ended = false;
    let mainPlayCount = 0;
    mainVideo.play = () => { mainPlayCount++; mainVideo.paused = false; return Promise.resolve(); };
    player.appendChild(mainVideo);
    document.body.appendChild(player);

    skipper.enable();

    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, 'Test 2.6a: Skip executed');
    assert(mainPlayCount === 1, 'Test 2.6b: Main active player video was played');
    assert(sidebarPlayCount === 0, 'Test 2.6c: Sidebar preview video was untouched');

    skipper.disable();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 3: Anti-Adblock Modal Auto-Dismissal & Polymer Backdrop Isolation
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- 3. Anti-Adblock Modal Auto-Dismissal & Backdrop Isolation Stress Testing ---');

  // Test 3.1: Anti-Adblock Modal (`ytd-enforcement-message-view-model`) Dismissal
  {
    const { player, video } = setupPlayerDOMWithVideo(10, 300, true);
    skipper.enable();

    // Add native YouTube Polymer backdrop (must remain untouched!)
    const nativeBackdrop = document.createElement('tp-yt-iron-overlay-backdrop');
    nativeBackdrop.className = 'opened';
    nativeBackdrop.setAttribute('style', 'z-index: 2200;');
    document.body.appendChild(nativeBackdrop);

    // Add Anti-Adblock Enforcement Modal
    const modal = document.createElement('ytd-enforcement-message-view-model');
    modal.className = 'ytd-enforcement-message-view-model';
    let dismissBtnClicked = false;
    const dismissBtn = document.createElement('button');
    dismissBtn.setAttribute('aria-label', 'Dismiss');
    dismissBtn.click = () => { dismissBtnClicked = true; };
    modal.appendChild(dismissBtn);
    document.body.appendChild(modal);

    assert(document.querySelector('ytd-enforcement-message-view-model') !== null, 'Enforcement modal present initially');
    assert(document.querySelector('tp-yt-iron-overlay-backdrop') !== null, 'Native backdrop present initially');

    const res = skipper._trySkip();
    assert(res === true, 'Test 3.1a: _trySkip() detected and dismissed enforcement modal');
    assert(dismissBtnClicked === true, 'Test 3.1b: Modal dismiss button was clicked');
    assert(document.querySelector('ytd-enforcement-message-view-model') === null, 'Test 3.1c: Enforcement modal was removed from DOM');
    assert(document.querySelector('tp-yt-iron-overlay-backdrop') === nativeBackdrop, 'Test 3.1d: Native Polymer backdrop was NOT removed');
    assert(nativeBackdrop.className === 'opened', 'Test 3.1e: Native Polymer backdrop classes were NOT mutated');
    assert(nativeBackdrop.getAttribute('style') === 'z-index: 2200;', 'Test 3.1f: Native Polymer backdrop styles were NOT mutated');
    assert(video.getPlayCount() === 1, 'Test 3.1g: Video playback resumed post-modal dismissal');

    skipper.disable();
  }

  // Test 3.2: Strict Backdrop Isolation across Multiple Native Backdrops
  {
    document.body.innerHTML = '';
    const { player, video } = setupPlayerDOMWithVideo(10, 300, true);
    skipper.enable();

    // Simulate multiple native Polymer backdrops (e.g. Account menu + Playlist menu)
    const backdrop1 = document.createElement('tp-yt-iron-overlay-backdrop');
    backdrop1.id = 'backdrop-account-menu';
    backdrop1.className = 'opened';
    document.body.appendChild(backdrop1);

    const backdrop2 = document.createElement('tp-yt-iron-overlay-backdrop');
    backdrop2.id = 'backdrop-playlist-menu';
    backdrop2.className = 'opened';
    document.body.appendChild(backdrop2);

    // Enforcement modal mounts
    const modal = document.createElement('ytd-enforcement-message-view-model');
    const dismissBtn = document.createElement('button');
    dismissBtn.click = () => {};
    modal.appendChild(dismissBtn);
    document.body.appendChild(modal);

    skipper._trySkip();

    const remainingBackdrops = document.querySelectorAll('tp-yt-iron-overlay-backdrop');
    assert(remainingBackdrops.length === 2, 'Test 3.2a: Exactly 2 native backdrops remain in DOM');
    assert(document.getElementById('backdrop-account-menu') !== null, 'Test 3.2b: Account menu backdrop intact');
    assert(document.getElementById('backdrop-playlist-menu') !== null, 'Test 3.2c: Playlist menu backdrop intact');

    skipper.disable();
  }

  // Test 3.3: Multiple Concurrent Enforcement Modals Removed Cleanly
  {
    document.body.innerHTML = '';
    const { player, video } = setupPlayerDOMWithVideo(10, 300, true);
    skipper.enable();

    const modal1 = document.createElement('ytd-enforcement-message-view-model');
    const modal2 = document.createElement('ytd-enforcement-message-view-model');
    document.body.appendChild(modal1);
    document.body.appendChild(modal2);

    skipper._trySkip();

    assert(document.querySelectorAll('ytd-enforcement-message-view-model').length === 0, 'Test 3.3: All concurrent enforcement modals removed');

    skipper.disable();
  }

  // Test 3.4: Dialog Dismissal Button Variant Selectors
  {
    const dialogSelectors = [
      'ytd-enforcement-message-view-model button',
      '.ytd-enforcement-message-view-model button',
      'tp-yt-paper-dialog #dismiss-button',
      'button[aria-label*="Allow YouTube ads"]',
      'ytd-popup-container #dismiss-button',
      'yt-button-shape button[aria-label*="Dismiss"]'
    ];

    for (const selector of dialogSelectors) {
      document.body.innerHTML = '';
      const { player, video } = setupPlayerDOMWithVideo(0, 30, true);
      player.classList.add('ad-showing');
      skipper.enable();

      let clicked = false;
      if (selector === 'tp-yt-paper-dialog #dismiss-button') {
        const dialog = document.createElement('tp-yt-paper-dialog');
        const btn = document.createElement('button');
        btn.id = 'dismiss-button';
        btn.click = () => { clicked = true; };
        dialog.appendChild(btn);
        document.body.appendChild(dialog);
      } else if (selector === 'button[aria-label*="Allow YouTube ads"]') {
        const btn = document.createElement('button');
        btn.setAttribute('aria-label', 'Allow YouTube ads or buy premium');
        btn.click = () => { clicked = true; };
        document.body.appendChild(btn);
      } else if (selector === 'ytd-popup-container #dismiss-button') {
        const popup = document.createElement('ytd-popup-container');
        const btn = document.createElement('button');
        btn.id = 'dismiss-button';
        btn.click = () => { clicked = true; };
        popup.appendChild(btn);
        document.body.appendChild(popup);
      } else if (selector === 'yt-button-shape button[aria-label*="Dismiss"]') {
        const shape = document.createElement('yt-button-shape');
        const btn = document.createElement('button');
        btn.setAttribute('aria-label', 'Dismiss message');
        btn.click = () => { clicked = true; };
        shape.appendChild(btn);
        document.body.appendChild(shape);
      } else {
        const modal = document.createElement('ytd-enforcement-message-view-model');
        const btn = document.createElement('button');
        btn.click = () => { clicked = true; };
        modal.appendChild(btn);
        document.body.appendChild(modal);
      }

      skipper._adStartTime = Date.now() - 2500;
      skipper._trySkip();
      assert(clicked === true, `Test 3.4: Dialog dismiss button matched and clicked for selector: ${selector}`);

      skipper.disable();
    }
  }

  // Test 3.5: Console Log Debounce Verification during Rapid Modal Dismissal
  {
    document.body.innerHTML = '';
    const { player, video } = setupPlayerDOMWithVideo(0, 30, true);
    skipper.enable();

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      skipper._lastLogTime = 0;
      for (let i = 0; i < 5; i++) {
        const modal = document.createElement('ytd-enforcement-message-view-model');
        document.body.appendChild(modal);
        skipper._trySkip();
      }

      const skipLogs = logs.filter(l => l.includes('[GodMode] AdSkipper: ad skipped ⚡'));
      assert(skipLogs.length === 1, 'Test 3.5: Console logging debounced to exactly 1 log across 5 rapid invocations (zero infinite loops)');
    } finally {
      console.log = origLog;
      skipper.disable();
    }
  }

  console.log('\n================================================================');
  console.log(`TOTAL CHALLENGER 2 TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error('Failures encountered:', failureDetails);
    process.exit(1);
  }
}

runChallenger2Suite().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
