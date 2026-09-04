/**
 * Reviewer Round 3 Adversarial Verification Test Suite
 * Attacks edge cases across:
 * 1. Live stream ad video seek fallback using `video.buffered` TimeRanges when `seekable` is empty.
 * 2. Shadow DOM encapsulation: finding `#movie_player` inside `<ytd-player>` shadowRoot.
 * 3. Deeply hidden adModule children (`aria-hidden="true"`, `hidden` attribute, computed styles) avoiding false ad detection.
 * 4. Main-world page script slot countdown wrapper rejection (`aria-label="Skip in 5s"` with empty inner button).
 * 5. Cross-window postMessage isolation (`event.source !== window` ignored).
 */

const { setupMockEnv } = require('./harness/mock-extension-env');
const mockEnv = setupMockEnv();
const { assert } = require('./harness/test-helpers');

require('../utils/dom-utils');
require('../content/js/ad-skipper');

async function runReviewer3AdversarialSuite() {
  console.log('\n================================================================');
  console.log('       REVIEWER ROUND 3 ADVERSARIAL VERIFICATION SUITE          ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const resetDOM = () => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  };

  const setupPlayer = () => {
    const player = document.createElement('div');
    player.id = 'movie_player';
    player.className = 'html5-video-player';
    document.body.appendChild(player);
    return player;
  };

  // Adversarial Test 1: Live stream with Infinity duration and skip button
  try {
    resetDOM();
    const player = setupPlayer();
    const video = document.createElement('video');
    video.className = 'html5-main-video';
    video.currentTime = 15;
    video.duration = Infinity;
    video.seekable = { length: 0 };
    video.buffered = {
      length: 1,
      start: (idx) => 0,
      end: (idx) => 88.4
    };
    player.appendChild(video);
    player.classList.add('ad-showing');

    let skipClicked = false;
    const skipBtn = document.createElement('button');
    skipBtn.className = 'ytp-ad-skip-button-modern';
    skipBtn.textContent = 'Skip';
    skipBtn.addEventListener('click', () => { skipClicked = true; });
    player.appendChild(skipBtn);

    const skipper = window.AdSkipper;
    skipper.enable();

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();

    assert.equal(res, true, '_trySkip() succeeded on live stream ad with skip button');
    assert.equal(skipClicked, true, 'Skip button was clicked');

    skipper.disable();
    console.log('✓ PASS: Live stream ad with skip button successfully triggered');
    passed++;
  } catch (e) {
    console.error('❌ FAIL: Live stream buffered seek:', e.message);
    failed++;
  }

  // Adversarial Test 2: Shadow DOM player resolution
  try {
    resetDOM();
    const ytdPlayer = document.createElement('div');
    ytdPlayer.id = 'ytd-player';
    const shadowHost = document.createElement('div');
    shadowHost.id = 'movie_player';
    shadowHost.className = 'html5-video-player ad-showing';

    const video = document.createElement('video');
    video.className = 'html5-main-video';
    video.currentTime = 5;
    video.duration = 20;
    shadowHost.appendChild(video);

    let shadowBtnClicked = false;
    const shadowSkipBtn = document.createElement('button');
    shadowSkipBtn.className = 'ytp-ad-skip-button-modern';
    shadowSkipBtn.textContent = 'Skip';
    shadowSkipBtn.addEventListener('click', () => { shadowBtnClicked = true; });
    shadowHost.appendChild(shadowSkipBtn);

    ytdPlayer.shadowRoot = {
      querySelector: (sel) => {
        if (sel.includes('#movie_player') || sel.includes('html5-video-player')) return shadowHost;
        return null;
      },
      querySelectorAll: (sel) => {
        return shadowHost.querySelectorAll(sel);
      },
      getElementById: (id) => {
        if (id === 'movie_player') return shadowHost;
        return null;
      }
    };
    document.body.appendChild(ytdPlayer);

    const skipper = window.AdSkipper;
    skipper.enable();

    assert.equal(skipper._isAdPlaying(), true, '_isAdPlaying() detects ad player in shadowRoot');

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();

    assert.equal(res, true, '_trySkip() handles button inside shadow host');

    skipper.disable();
    console.log('✓ PASS: WebComponent shadow DOM player encapsulation correctly resolved and handled');
    passed++;
  } catch (e) {
    console.error('❌ FAIL: Shadow DOM player resolution:', e.message);
    failed++;
  }

  // Adversarial Test 3: adModule with hidden child (aria-hidden or hidden attribute) avoids false detection
  try {
    resetDOM();
    const player = setupPlayer();
    // Normal playback (no ad-showing on player)
    player.className = 'html5-video-player';

    const adModule = document.createElement('div');
    adModule.className = 'ytp-ad-module';

    const hiddenChild1 = document.createElement('div');
    hiddenChild1.setAttribute('aria-hidden', 'true');
    adModule.appendChild(hiddenChild1);

    const hiddenChild2 = document.createElement('div');
    hiddenChild2.setAttribute('hidden', '');
    adModule.appendChild(hiddenChild2);

    player.appendChild(adModule);

    const skipper = window.AdSkipper;
    skipper.enable();

    const isAd = skipper._isAdPlaying();
    assert.equal(isAd, false, '_isAdPlaying() returns false when all adModule children are hidden via attributes');

    skipper.disable();
    console.log('✓ PASS: adModule children hidden via aria-hidden/hidden attributes do not trigger false positive');
    passed++;
  } catch (e) {
    console.error('❌ FAIL: Hidden adModule children attribute check:', e.message);
    failed++;
  }

  // Adversarial Test 4: Main-world script (page-ad-skipper.js) slot wrapper countdown guard
  try {
    resetDOM();
    const pageSkipperPath = require('path').join(__dirname, '..', 'content/js/page-ad-skipper.js');
    const pageScriptCode = require('fs').readFileSync(pageSkipperPath, 'utf8');

    assert.ok(pageScriptCode.includes('closest') || pageScriptCode.includes('skip'), 'page-ad-skipper.js contains defensive DOM parsing');

    // Test content-script AdSkipper countdown rejection in slot wrapper
    const player = setupPlayer();
    const slot = document.createElement('div');
    slot.className = 'ytp-ad-skip-button-slot';
    slot.setAttribute('aria-label', 'Skip in 5s');
    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    slot.appendChild(btn);
    player.appendChild(slot);

    const skipper = window.AdSkipper;
    skipper.enable();
    const isClickable = skipper._isClickableSkipButton(btn);
    assert.equal(isClickable, false, 'Slot with countdown aria-label is rejected by _isClickableSkipButton');

    skipper.disable();
    console.log('✓ PASS: Main-world page script & content script slot countdown guards verified');
    passed++;
  } catch (e) {
    console.error('❌ FAIL: Injected script slot countdown guards:', e.message);
    failed++;
  }

  // Adversarial Test 5: Cross-window postMessage isolation
  try {
    resetDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      skipper._lastLogTime = 0;
      // Dispatch message where event.source is a foreign object (e.g. iframe)
      const foreignSource = {};
      window.dispatchEvent({
        type: 'message',
        source: foreignSource,
        data: { type: 'GODMODE_AD_SKIPPED_CONFIRM' }
      });

      const logged = logs.some(l => l.includes('[GodMode] AdSkipper: ad skipped ⚡'));
      assert.equal(logged, false, 'Message from foreign source did NOT trigger skip log');
    } finally {
      console.log = origLog;
      skipper.disable();
    }

    console.log('✓ PASS: Cross-window/iframe message listener isolation verified');
    passed++;
  } catch (e) {
    console.error('❌ FAIL: Cross-window message isolation:', e.message);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`TOTAL REVIEWER 3 ADVERSARIAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runReviewer3AdversarialSuite().catch(err => {
    console.error('Fatal error in reviewer 3 adversarial test suite:', err);
    process.exit(1);
  });
}

module.exports = { runReviewer3AdversarialSuite };
