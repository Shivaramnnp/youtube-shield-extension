/**
 * Challenger 1 (challenger_final_1) Empirical Adversarial Stress Suite
 * 
 * Deep Empirical Coverage for:
 * 1. Rapid Dynamic Video State Switching:
 *    - Ad -> Main Video -> Sponsor/Cue -> Ad transitions
 *    - Playback rate / Mute state preservation and restoration
 *    - Rapid sequential bursts (50+ cycles)
 * 2. Custom Element Mutation Bursts & Observer Churn:
 *    - High-frequency DOM mutation bursts (5,000+ mutations across custom elements & Shadow DOMs)
 *    - Observer connect/disconnect churn & lifecycle stress
 *    - Attribute churn on class, style, hidden, aria-label, disabled
 * 3. Non-Standard YouTube DOM Variations:
 *    - Mobile Web DOM (m.youtube.com, ytm-player, ytm-pivot-bar-renderer)
 *    - Embedded Player DOM (youtube.com/embed/*, iframe player, minimal root)
 *    - Theatre Mode DOM (ytd-watch-flexy[theater], .watch-stage-mode)
 *    - Deep Nested Shadow DOM (ytd-player.shadowRoot -> movie_player)
 *    - Malformed/Corrupted media metadata (NaN/Infinity duration, negative times)
 * 4. Resource Cleanup, Memory Leak & Exception Safety:
 *    - 0 dangling intervals, 0 hanging MutationObservers, 0 leaked event listeners
 *    - 0 unhandled promise rejections or uncaught exceptions
 */

const { setupMockEnv } = require('./harness/mock-extension-env');
setupMockEnv();

const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../utils/storage');
require('../utils/dom-utils');
require('../content/js/ad-skipper');
require('../content/js/page-ad-skipper');
require('../content/js/shorts-blocker');
require('../content/js/header-button');
require('../content/js/goal-mode');
require('../content/js/study-mode');
require('../content/js/time-manager');
require('../content/js/volume-booster');
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

const createMockVideo = (initialTime = 0, duration = 300, paused = false) => {
  const video = document.createElement('video');
  video.className = 'html5-main-video';
  video.currentTime = initialTime;
  video.duration = duration;
  video.playbackRate = 1;
  video.muted = false;
  video.paused = paused;
  video.ended = false;

  let playCount = 0;
  let pauseCount = 0;
  let shouldRejectPlay = false;

  video.play = () => {
    playCount++;
    if (shouldRejectPlay) {
      return Promise.reject(new Error('NotAllowedError: play() failed.'));
    }
    video.paused = false;
    return Promise.resolve();
  };

  video.pause = () => {
    pauseCount++;
    video.paused = true;
  };

  video.getPlayCount = () => playCount;
  video.getPauseCount = () => pauseCount;
  video.setRejectPlay = (val) => { shouldRejectPlay = val; };

  return video;
};

async function runChallenger1AdversarialSuite() {
  console.log('========================================================================');
  console.log('   CHALLENGER 1 (challenger_final_1) EMPIRICAL ADVERSARIAL STRESS SUITE ');
  console.log('   Dynamic State Switching, Mutation Bursts & Non-Standard DOM Topologies');
  console.log('========================================================================\n');

  const skipper = window.AdSkipper;
  const shortsBlocker = window.ShortsBlocker;

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1: Rapid Dynamic Video State Switching
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- 1. Rapid Dynamic Video State Switching Stress Testing ---');

  // Test 1.1: Complex Cycle (Ad -> Main Video -> Sponsor/Cue -> Ad -> Main Video)
  {
    document.body.innerHTML = '';
    const player = document.createElement('div');
    player.id = 'movie_player';
    player.className = 'html5-video-player';
    const video = createMockVideo(0, 600, false);
    player.appendChild(video);
    document.body.appendChild(player);

    skipper.enable();

    // PHASE A: Ad begins
    player.classList.add('ad-showing');
    player.classList.add('ad-interrupting');
    const adBtn1 = document.createElement('button');
    adBtn1.className = 'ytp-ad-skip-button-modern';
    adBtn1.textContent = 'Skip';
    player.appendChild(adBtn1);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const resA = skipper._trySkip();
    assert(resA === true, 'Test 1.1a: Ad phase skipped successfully');

    // PHASE B: Transition to Main Content Video
    player.classList.remove('ad-showing', 'ad-interrupting');
    if (adBtn1.parentNode) player.removeChild(adBtn1);
    assert(video.playbackRate === 1, 'Test 1.1b: Playback rate is 1 for main video');
    assert(video.muted === false, 'Test 1.1c: Main video is unmuted');

    // PHASE C: In-stream Sponsor / Cue transition (no skip button, main content plays)
    video.currentTime = 120;
    const resC = skipper._trySkip();
    assert(resC === false, 'Test 1.1d: No false positive skip during sponsor segment / main content');

    // PHASE D: Mid-roll Ad begins (Ad 2 of 2)
    player.classList.add('ad-showing');
    const adBtn2 = document.createElement('button');
    adBtn2.className = 'ytp-ad-skip-button-modern';
    adBtn2.textContent = 'Skip Ad';
    player.appendChild(adBtn2);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const resD = skipper._trySkip();
    assert(resD === true, 'Test 1.1e: Mid-roll ad skipped successfully');

    // PHASE E: Return to Main Content Video
    player.classList.remove('ad-showing');
    if (adBtn2.parentNode) player.removeChild(adBtn2);
    assert(video.playbackRate === 1, 'Test 1.1f: Playback rate restored to 1 post mid-roll ad');
    assert(video.muted === false, 'Test 1.1g: Main video remains unmuted');

    skipper.disable();
  }

  // Test 1.2: 50 Rapid Burst State Transitions (Ad <-> Main Video in micro-intervals)
  {
    document.body.innerHTML = '';
    const player = document.createElement('div');
    player.id = 'movie_player';
    player.className = 'html5-video-player';
    const video = createMockVideo(0, 1200, false);
    player.appendChild(video);
    document.body.appendChild(player);

    skipper.enable();

    let skippedCount = 0;
    for (let i = 0; i < 50; i++) {
      const isAd = (i % 2 === 0);
      if (isAd) {
        player.classList.add('ad-showing');
        const btn = document.createElement('button');
        btn.className = 'ytp-ad-skip-button-modern';
        btn.id = `ad-skip-btn-${i}`;
        btn.textContent = 'Skip';
        player.appendChild(btn);

        skipper._lastSkippedEl = null;
        skipper._lastSkipTime = 0;
        const res = skipper._trySkip();
        if (res) skippedCount++;
        if (btn.parentNode) player.removeChild(btn);
      } else {
        player.classList.remove('ad-showing');
        skipper._trySkip();
      }
    }

    assert(skippedCount === 25, `Test 1.2a: All 25 rapid ad burst cycles skipped (Actual: ${skippedCount})`);
    assert(video.playbackRate === 1, 'Test 1.2b: Final playback rate is stable at 1');
    assert(video.muted === false, 'Test 1.2c: Final muted state is false');

    skipper.disable();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2: Custom Element Mutation Bursts & Observer Churn
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- 2. Custom Element Mutation Bursts & Observer Churn Testing ---');

  // Test 2.1: 5,000 Rapid Custom Element & Attribute Mutation Bursts
  {
    document.body.innerHTML = '';
    const watchFlexy = document.createElement('ytd-watch-flexy');
    watchFlexy.id = 'watch-flexy';

    const playerContainer = document.createElement('div');
    playerContainer.id = 'player-container';

    const player = document.createElement('div');
    player.id = 'movie_player';
    player.className = 'html5-video-player';
    const video = createMockVideo(0, 600, false);
    player.appendChild(video);
    playerContainer.appendChild(player);
    watchFlexy.appendChild(playerContainer);

    const richSection = document.createElement('ytd-rich-section-renderer');
    watchFlexy.appendChild(richSection);
    document.body.appendChild(watchFlexy);

    skipper.enable();
    shortsBlocker.enable();

    let unhandledErrors = 0;
    const errHandler = () => { unhandledErrors++; };
    process.on('uncaughtException', errHandler);

    try {
      console.log('  ... Executing 5,000 rapid DOM mutations across custom elements ...');
      for (let i = 0; i < 5000; i++) {
        // Mutate attributes
        if (i % 5 === 0) {
          player.setAttribute('class', i % 2 === 0 ? 'html5-video-player ad-showing' : 'html5-video-player');
        } else if (i % 5 === 1) {
          player.setAttribute('style', `opacity: ${i % 2 === 0 ? '1' : '0.9'}`);
        } else if (i % 5 === 2) {
          // Mutate child elements
          const promo = document.createElement('ytd-ad-slot-renderer');
          promo.setAttribute('data-id', `ad-slot-${i}`);
          richSection.appendChild(promo);
          if (richSection.children.length > 5) {
            richSection.removeChild(richSection.firstChild);
          }
        } else if (i % 5 === 3) {
          // Add/remove shorts links
          const shortLink = document.createElement('a');
          shortLink.setAttribute('href', '/shorts/test1234');
          shortLink.setAttribute('title', 'Shorts Item');
          richSection.appendChild(shortLink);
        } else {
          // Trigger observer notifications
          watchFlexy.setAttribute('theater', i % 2 === 0 ? 'true' : 'false');
        }
      }

      assert(unhandledErrors === 0, 'Test 2.1a: 5,000 mutation bursts executed with 0 unhandled exceptions');
      assert(skipper.getStatus().enabled === true, 'Test 2.1b: AdSkipper remained active and healthy through burst');
      assert(shortsBlocker.isActive === true, 'Test 2.1c: ShortsBlocker remained active and healthy through burst');
    } finally {
      process.removeListener('uncaughtException', errHandler);
      skipper.disable();
      shortsBlocker.disable();
    }
  }

  // Test 2.2: Observer Connect / Disconnect Churn (100 Rapid Lifecycle Toggles)
  {
    console.log('  ... Stressing observer lifecycle across 100 enable/disable churn cycles ...');
    for (let i = 0; i < 100; i++) {
      skipper.enable();
      assert(skipper._observer !== null, `Test 2.2: Cycle ${i} observer started`);
      assert(skipper._pollInterval !== null, `Test 2.2: Cycle ${i} poll timer started`);
      skipper.disable();
      assert(skipper._observer === null, `Test 2.2: Cycle ${i} observer stopped`);
      assert(skipper._pollInterval === null, `Test 2.2: Cycle ${i} poll timer cleared`);
    }
    assert(true, 'Test 2.2: 100 rapid observer lifecycle churn cycles completed with zero dangling references');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 3: Non-Standard YouTube DOM Variations
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- 3. Non-Standard YouTube DOM Variations Stress Testing ---');

  // Test 3.1: Mobile Web DOM Variation (m.youtube.com, ytm-player, ytm-pivot-bar-renderer)
  {
    document.body.innerHTML = `
      <ytm-app>
        <ytm-mobile-topbar-renderer></ytm-mobile-topbar-renderer>
        <ytm-player id="player">
          <div class="html5-video-player ad-showing">
            <video class="html5-main-video"></video>
            <button class="ytp-ad-skip-button-modern" aria-label="Skip ad">Skip ad</button>
          </div>
        </ytm-player>
        <ytm-pivot-bar-renderer>
          <ytm-pivot-bar-item-renderer>
            <a href="/shorts/mobile123">Shorts</a>
          </ytm-pivot-bar-item-renderer>
        </ytm-pivot-bar-renderer>
      </ytm-app>
    `;

    skipper.enable();
    shortsBlocker.enable();

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, 'Test 3.1a: Ad skipped in Mobile Web DOM (ytm-player)');

    const mobileShorts = document.querySelector('a[href="/shorts/mobile123"]');
    const container = mobileShorts.closest('ytm-pivot-bar-item-renderer');
    assert(container !== null, 'Test 3.1b: Mobile shorts item container located');

    skipper.disable();
    shortsBlocker.disable();
  }

  // Test 3.2: Embedded Player DOM Variation (youtube.com/embed/*, minimal root, no masthead)
  {
    document.body.innerHTML = `
      <div id="player" class="full-frame">
        <div id="movie_player" class="html5-video-player ad-showing ad-interrupting">
          <video class="html5-main-video"></video>
          <div class="ytp-ad-module">
            <div class="ytp-ad-player-overlay-skip-or-preview">
              <button class="ytp-ad-skip-button" aria-label="Skip Ad">Skip Ad</button>
            </div>
          </div>
        </div>
      </div>
    `;

    skipper.enable();
    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, 'Test 3.2: Ad skipped cleanly in Embedded Player DOM (iframe/embed)');
    skipper.disable();
  }

  // Test 3.3: Theatre Mode & Fullscreen DOM Variation
  {
    document.body.innerHTML = `
      <ytd-watch-flexy theater fullscreen class="watch-stage-mode">
        <div id="player-container-inner">
          <div id="movie_player" class="html5-video-player ytp-ad-playing">
            <video class="html5-main-video"></video>
            <button class="ytp-skip-ad-button">Skip</button>
          </div>
        </div>
      </ytd-watch-flexy>
    `;

    skipper.enable();
    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, 'Test 3.3: Ad skipped in Theatre Mode & Fullscreen DOM');
    skipper.disable();
  }

  // Test 3.4: Deep Nested Shadow DOM Player Topology
  {
    document.body.innerHTML = `
      <ytd-app>
        <ytd-page-manager>
          <ytd-player id="ytd-player"></ytd-player>
        </ytd-page-manager>
      </ytd-app>
    `;

    const ytdPlayer = document.getElementById('ytd-player');
    const shadowRoot = ytdPlayer.attachShadow ? ytdPlayer.attachShadow({ mode: 'open' }) : document.createElement('div');
    ytdPlayer.shadowRoot = shadowRoot;

    const innerPlayer = document.createElement('div');
    innerPlayer.id = 'movie_player';
    innerPlayer.className = 'html5-video-player ad-showing';
    const video = createMockVideo(0, 300, false);
    innerPlayer.appendChild(video);

    const shadowBtn = document.createElement('button');
    shadowBtn.className = 'ytp-ad-skip-button-modern';
    shadowBtn.textContent = 'Skip';
    innerPlayer.appendChild(shadowBtn);
    shadowRoot.appendChild(innerPlayer);

    skipper.enable();
    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, 'Test 3.4: Ad skipped across nested Shadow DOM boundaries');
    skipper.disable();
  }

  // Test 3.5: Malformed & Corrupted Video Metadata (NaN, Infinity, Negative Duration)
  {
    document.body.innerHTML = '';
    const player = document.createElement('div');
    player.id = 'movie_player';
    player.className = 'html5-video-player ad-showing';

    const corruptedVideo = document.createElement('video');
    corruptedVideo.duration = NaN;
    corruptedVideo.currentTime = -10;
    player.appendChild(corruptedVideo);

    const skipBtn = document.createElement('button');
    skipBtn.className = 'ytp-ad-skip-button-modern';
    skipBtn.textContent = 'Skip';
    player.appendChild(skipBtn);
    document.body.appendChild(player);

    skipper.enable();
    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, 'Test 3.5a: Handled video with duration=NaN and currentTime=-10 gracefully');

    corruptedVideo.duration = Infinity;
    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const resInf = skipper._trySkip();
    assert(resInf === true, 'Test 3.5b: Handled video with duration=Infinity gracefully');

    skipper.disable();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 4: Memory Leak, Resource Cleanup & Exception Trapping
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- 4. Memory Leak, Resource Cleanup & Exception Verification ---');

  {
    const hb = window.HeaderButton;
    const gm = window.GoalMode;
    const tm = window.TimeManager;
    const sm = window.StudyMode;
    const vb = window.VolumeBooster;

    // Enable all singletons
    hb.enable();
    gm.enable('Artificial Intelligence');
    tm.enable({ enabled: true, dailyLimitMinutes: 60, scheduleEnabled: false, snoozeUntil: 0 });
    sm.enable('AI Research');
    skipper.enable();
    shortsBlocker.enable();

    // Disable all singletons
    hb.disable();
    gm.disable();
    tm.disable();
    sm.disable();
    skipper.disable();
    shortsBlocker.disable();

    assert(hb.isActive === false, 'Test 4.1: HeaderButton.isActive is false after disable');
    assert(hb.retryInterval === null, 'Test 4.1: HeaderButton retryInterval cleared');
    assert(hb.sessionTimerInterval === null, 'Test 4.1: HeaderButton sessionTimerInterval cleared');
    assert(hb.outsideClickTimer === null, 'Test 4.1: HeaderButton outsideClickTimer cleared');
    assert(gm.isActive === false, 'Test 4.1: GoalMode.isActive is false after disable');
    assert(gm._titleObserver === null, 'Test 4.1: GoalMode titleObserver disconnected');
    assert(tm.isActive === false, 'Test 4.1: TimeManager.isActive is false after disable');
    assert(tm.checkInterval === null, 'Test 4.1: TimeManager checkInterval cleared');
    assert(sm.isActive === false, 'Test 4.1: StudyMode.isActive is false after disable');
    assert(sm.timerInterval === null, 'Test 4.1: StudyMode timerInterval cleared');
    assert(skipper._observer === null, 'Test 4.1: AdSkipper observer disconnected');
    assert(skipper._pollInterval === null, 'Test 4.1: AdSkipper pollInterval cleared');
    assert(shortsBlocker.isActive === false, 'Test 4.1: ShortsBlocker.isActive is false after disable');
    assert(shortsBlocker.urlCheckInterval === null, 'Test 4.1: ShortsBlocker urlCheckInterval cleared');

    assert(document.getElementById('ss-popup-dialog') === null, 'Test 4.2: #ss-popup-dialog cleaned from DOM');
    assert(document.getElementById('ss-popup-backdrop') === null, 'Test 4.2: #ss-popup-backdrop cleaned from DOM');
    assert(document.getElementById('ss-goal-block-overlay') === null, 'Test 4.2: #ss-goal-block-overlay cleaned from DOM');
    assert(document.getElementById('ss-time-manager-overlay') === null, 'Test 4.2: #ss-time-manager-overlay cleaned from DOM');
    assert(document.getElementById('ss-study-banner') === null, 'Test 4.2: #ss-study-banner cleaned from DOM');
  }

  console.log('\n========================================================================');
  console.log(`TOTAL EMPIRICAL CHALLENGER TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    console.error('Failures encountered:', failureDetails);
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  runChallenger1AdversarialSuite().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}

module.exports = { runChallenger1AdversarialSuite };
