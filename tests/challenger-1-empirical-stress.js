/**
 * Challenger 1 Empirical Stress Test Suite for AdSkipper (MV3)
 * Focus areas:
 * 1. Event dispatch sequence across shadow DOM boundaries and slot containers
 * 2. Negative exclusion zones (masthead, banner promos, search box, companion ads, etc.)
 * 3. Rate limiting (click deduplication 500ms) and log debouncing (500ms)
 * 4. Playback assurance and anti-adblock backdrop isolation
 */

const { setupMockEnv } = require('./harness/mock-extension-env');
const mockEnv = setupMockEnv();

const { StorageUtil, DEFAULT_SETTINGS } = require('../utils/storage');
require('../utils/dom-utils');
require('../content/js/ad-skipper');
require('../content/js/header-button');
require('../content/js/main');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  } else {
    console.log(`✓ PASS: ${message}`);
    passed++;
  }
}

async function runChallenger1EmpiricalStressSuite() {
  console.log('================================================================');
  console.log('   CHALLENGER 1: EMPIRICAL AD-SKIPPER STRESS & VERIFICATION    ');
  console.log('================================================================\n');

  const skipper = window.AdSkipper;

  const setupPlayer = () => {
    document.body.innerHTML = '';
    const player = document.createElement('div');
    player.id = 'movie_player';
    player.className = 'html5-video-player';
    document.body.appendChild(player);
    return player;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 1. EVENT DISPATCH SEQUENCE ACROSS SHADOW DOM & SLOT CONTAINERS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Event Dispatch Sequence & Shadow DOM / Slot Traversal ---');

  // 1.1 Chronological order & event flags
  {
    const player = setupPlayer();
    skipper.enable();

    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';

    const eventsLog = [];
    const eventTypes = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    eventTypes.forEach(t => {
      btn.addEventListener(t, (e) => {
        eventsLog.push({
          type: e.type,
          bubbles: e.bubbles,
          cancelable: e.cancelable,
          composed: e.composed,
          hasView: !!e.view
        });
      });
    });

    player.appendChild(btn);
    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;

    const res = skipper._trySkip();
    assert(res === true, '1.1: _trySkip() returned true for skip button');
    assert(eventsLog.length >= 5, `1.1: At least 5 events dispatched (got ${eventsLog.length})`);
    
    // Validate order of dispatched sequence
    assert(eventsLog[0].type === 'pointerdown', '1.1: 1st event is pointerdown');
    assert(eventsLog[1].type === 'mousedown', '1.1: 2nd event is mousedown');
    assert(eventsLog[2].type === 'pointerup', '1.1: 3rd event is pointerup');
    assert(eventsLog[3].type === 'mouseup', '1.1: 4th event is mouseup');
    assert(eventsLog[4].type === 'click', '1.1: 5th event is click');

    // Validate flags of the native dispatch sequence (first 5 events)
    for (let i = 0; i < 5; i++) {
      const evt = eventsLog[i];
      assert(evt.bubbles === true, `1.1: [${evt.type}] has bubbles: true`);
      assert(evt.cancelable === true, `1.1: [${evt.type}] has cancelable: true`);
      assert(evt.composed === true, `1.1: [${evt.type}] has composed: true (penetrates shadow root)`);
    }

    skipper.disable();
  }

  // 1.2 Slot Container and Inner Target Unwrapping
  {
    const player = setupPlayer();
    skipper.enable();

    const slot = document.createElement('div');
    slot.className = 'ytp-ad-skip-button-slot-modern';
    
    const innerBtn = document.createElement('button');
    innerBtn.className = 'ytp-ad-skip-button-modern';
    
    const textSpan = document.createElement('span');
    textSpan.className = 'ytp-ad-skip-button-text';
    textSpan.textContent = 'Skip Ad';

    innerBtn.appendChild(textSpan);
    slot.appendChild(innerBtn);
    player.appendChild(slot);

    let btnClicked = false;
    let spanClicked = false;
    innerBtn.addEventListener('click', () => { btnClicked = true; });
    textSpan.addEventListener('click', () => { spanClicked = true; });

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, '1.2: _trySkip() resolved slot and inner span');
    assert(btnClicked === true, '1.2: Inner button received click');

    skipper.disable();
  }

  // 1.3 Shadow Root boundary simulation
  {
    const player = setupPlayer();
    skipper.enable();

    // Create a host element simulating Polymer custom element
    const hostEl = document.createElement('ytd-ad-slot-renderer');
    const shadowBtn = document.createElement('button');
    shadowBtn.className = 'ytp-ad-skip-button-modern';
    shadowBtn.textContent = 'Skip';

    let shadowEvents = [];
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(t => {
      shadowBtn.addEventListener(t, (e) => {
        shadowEvents.push({ type: e.type, composed: e.composed });
      });
    });

    hostEl.appendChild(shadowBtn);
    player.appendChild(hostEl);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, '1.3: _trySkip() found candidate in custom element slot');
    assert(shadowEvents.length >= 5, '1.3: At least 5 composed events fired inside custom element slot');
    assert(shadowEvents.slice(0, 5).every(e => e.composed === true), '1.3: All 5 events flagged composed: true for shadow penetration');

    skipper.disable();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. NEGATIVE EXCLUSION ZONES
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Negative Exclusion Zones ---');

  const exclusionZones = [
    { name: 'ytd-masthead', tag: 'ytd-masthead' },
    { name: '#masthead', id: 'masthead', tag: 'div' },
    { name: '#searchbox', id: 'searchbox', tag: 'div' },
    { name: 'header', tag: 'header' },
    { name: 'ytd-banner-promo-renderer', tag: 'ytd-banner-promo-renderer' },
    { name: 'ytd-statement-banner-renderer', tag: 'ytd-statement-banner-renderer' },
    { name: 'ytd-display-ad-renderer', tag: 'ytd-display-ad-renderer' },
    { name: 'ytd-in-feed-ad-layout-renderer', tag: 'ytd-in-feed-ad-layout-renderer' },
    { name: 'ytd-ad-inline-playback-meta-block', tag: 'ytd-ad-inline-playback-meta-block' },
    { name: '#companion', id: 'companion', tag: 'div' },
    { name: 'ytd-companion-ad-renderer', tag: 'ytd-companion-ad-renderer' },
    { name: '#ss-header-btn-container (HUD)', id: 'ss-header-btn-container', tag: 'div' },
    { name: '#ss-popup-dialog (HUD modal)', id: 'ss-popup-dialog', tag: 'div' },
    { name: '#ss-popup-backdrop (HUD backdrop)', id: 'ss-popup-backdrop', tag: 'div' }
  ];

  for (const zone of exclusionZones) {
    setupPlayer();
    skipper.enable();

    const zoneContainer = document.createElement(zone.tag);
    if (zone.id) zoneContainer.id = zone.id;
    document.body.appendChild(zoneContainer);

    let clicked = false;
    const fakeSkipBtn = document.createElement('button');
    fakeSkipBtn.className = 'ytp-ad-skip-button-modern ytp-button';
    fakeSkipBtn.textContent = 'Skip';
    fakeSkipBtn.addEventListener('click', () => { clicked = true; });
    fakeSkipBtn.click = () => { clicked = true; };
    zoneContainer.appendChild(fakeSkipBtn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();

    assert(res === false, `2.x: Exclusion zone ${zone.name} successfully blocked candidate from skipping`);
    assert(clicked === false, `2.x: Button inside ${zone.name} was NOT clicked`);

    zoneContainer.remove();
    skipper.disable();
  }

  // 2.2 My Ad Center and Why Seeing Ads dropdown option menu exclusion
  {
    setupPlayer();
    const player = document.getElementById('movie_player');
    skipper.enable();

    let clicked = false;
    const adCenterBtn = document.createElement('button');
    adCenterBtn.className = 'ytp-ad-skip-button-modern';
    adCenterBtn.textContent = 'My Ad Center';
    adCenterBtn.click = () => { clicked = true; };
    player.appendChild(adCenterBtn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === false, '2.2: "My Ad Center" button rejected by phrase guard');
    assert(clicked === false, '2.2: "My Ad Center" button was NOT clicked');

    skipper.disable();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. RATE LIMITING & LOG DEBOUNCING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Rate Limiting & Log Debouncing ---');

  // 3.1 Same Element Deduplication (< 500ms)
  {
    const player = setupPlayer();
    skipper.enable();

    let clickCount = 0;
    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';
    btn.addEventListener('click', () => { clickCount++; });
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;

    // 1st skip invocation
    const res1 = skipper._trySkip();
    assert(res1 === true, '3.1: 1st skip succeeded');
    const firstCount = clickCount;
    assert(firstCount > 0, '3.1: First skip dispatched click');

    // Immediate 2nd skip invocation (within 500ms on same element)
    const res2 = skipper._trySkip();
    assert(res2 === false, '3.1: 2nd skip on same element within 500ms skipped via deduplication');
    assert(clickCount === firstCount, '3.1: No additional clicks triggered during deduplication window');

    // Simulate > 500ms elapsed
    skipper._lastSkipTime = Date.now() - 600;
    const res3 = skipper._trySkip();
    assert(res3 === true, '3.1: 3rd skip succeeded after 500ms timeout passed');
    assert(clickCount > firstCount, '3.1: New click dispatched after timeout passed');

    skipper.disable();
  }

  // 3.2 Console Log Debouncing (< 500ms)
  {
    const player = setupPlayer();
    skipper.enable();

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };

    try {
      skipper._lastLogTime = 0;
      skipper._lastSkippedEl = null;

      // Trigger _logSkip 5 times in rapid succession
      skipper._logSkip();
      skipper._logSkip();
      skipper._logSkip();
      skipper._logSkip();
      skipper._logSkip();

      const skipLogs = logs.filter(l => l.includes('[GodMode] AdSkipper: ad skipped ⚡'));

      // Advance time > 500ms
      skipper._lastLogTime = Date.now() - 600;
      skipper._logSkip();

      const updatedSkipLogs = logs.filter(l => l.includes('[GodMode] AdSkipper: ad skipped ⚡'));

      console.log = origLog;
      assert(skipLogs.length === 1, `3.2: Log debouncing emitted exactly 1 log out of 5 rapid calls (got ${skipLogs.length})`);
      assert(updatedSkipLogs.length === 2, `3.2: Second log emitted after > 500ms interval passed (got ${updatedSkipLogs.length})`);
    } finally {
      console.log = origLog;
      skipper.disable();
    }
  }

  // 3.3 Multi-part ads (Ad 1 then Ad 2) are not blocked by deduplication
  {
    const player = setupPlayer();
    skipper.enable();

    // Ad 1 element
    let ad1Clicked = false;
    const ad1Btn = document.createElement('button');
    ad1Btn.className = 'ytp-ad-skip-button-modern';
    ad1Btn.textContent = 'Skip';
    ad1Btn.addEventListener('click', () => { ad1Clicked = true; });
    player.appendChild(ad1Btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res1 = skipper._trySkip();
    assert(res1 === true, '3.3: Ad 1 skipped');
    assert(ad1Clicked === true, '3.3: Ad 1 received click');

    // DOM updates: Ad 1 is removed, Ad 2 appears
    player.removeChild(ad1Btn);

    let ad2Clicked = false;
    const ad2Btn = document.createElement('button');
    ad2Btn.className = 'ytp-ad-skip-button-modern';
    ad2Btn.textContent = 'Skip';
    ad2Btn.addEventListener('click', () => { ad2Clicked = true; });
    player.appendChild(ad2Btn);

    // Immediate skip check for Ad 2 (different DOM node)
    const res2 = skipper._trySkip();
    assert(res2 === true, '3.3: Ad 2 skipped immediately without being blocked by Ad 1');
    assert(ad2Clicked === true, '3.3: Ad 2 received click');

    skipper.disable();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. PLAYBACK ASSURANCE & POLYMER ISOLATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Playback Assurance & Polymer Backdrop Isolation ---');

  // 4.1 Resumes paused video upon skip
  {
    const player = setupPlayer();
    const video = document.createElement('video');
    video.currentTime = 10;
    video.duration = 100;
    video.paused = true;
    let playTriggered = false;
    video.play = async () => {
      playTriggered = true;
      video.paused = false;
    };
    player.appendChild(video);

    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';
    player.appendChild(btn);

    skipper.enable();
    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;

    const res = skipper._trySkip();
    assert(res === true, '4.1: _trySkip() succeeded');
    assert(playTriggered === true, '4.1: video.play() was invoked when video was paused');
    assert(video.paused === false, '4.1: video.paused is false');

    skipper.disable();
  }

  // 4.2 Playback error catch resilience (p.catch)
  {
    const player = setupPlayer();
    const video = document.createElement('video');
    video.currentTime = 10;
    video.duration = 100;
    video.paused = true;
    video.play = () => {
      // Return rejecting promise to test error handling
      return Promise.reject(new Error('Autoplay blocked'));
    };
    player.appendChild(video);

    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';
    player.appendChild(btn);

    skipper.enable();
    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;

    // Should not throw or reject
    let threw = false;
    try {
      skipper._trySkip();
    } catch (e) {
      threw = true;
    }
    assert(threw === false, '4.2: video.play() rejection cleanly caught without throwing');

    skipper.disable();
  }

  // 4.3 Dismisses anti-adblock modal while preserving Polymer backdrop
  {
    setupPlayer();
    const video = document.createElement('video');
    video.paused = true;
    let playCalled = false;
    video.play = async () => { playCalled = true; video.paused = false; };
    document.body.appendChild(video);

    // Native Polymer backdrop
    const backdrop = document.createElement('tp-yt-iron-overlay-backdrop');
    backdrop.className = 'opened';
    document.body.appendChild(backdrop);

    skipper.enable();

    // Enforcement modal dynamically appears while engine is running
    const modal = document.createElement('ytd-enforcement-message-view-model');
    let dismissClicked = false;
    const dismissBtn = document.createElement('button');
    dismissBtn.click = () => { dismissClicked = true; };
    modal.appendChild(dismissBtn);
    document.body.appendChild(modal);

    const res = skipper._trySkip();

    assert(res === true, '4.3: _trySkip() handled enforcement modal');
    assert(dismissClicked === true, '4.3: Enforcement modal dismiss button clicked');
    assert(document.querySelector('ytd-enforcement-message-view-model') === null, '4.3: Modal removed from DOM');
    assert(document.querySelector('tp-yt-iron-overlay-backdrop') !== null, '4.3: Native Polymer backdrop preserved');
    assert(playCalled === true, '4.3: Video play() resumed after dismissal');

    backdrop.remove();
    video.remove();
    skipper.disable();
  }

  console.log('\n================================================================');
  console.log(`CHALLENGER 1 RESULTS: TOTAL ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runChallenger1EmpiricalStressSuite().catch(e => {
  console.error('Fatal in test:', e);
  process.exit(1);
});
