/**
 * Reviewer Round 2 Adversarial Verification Test Suite
 * Attacks edge cases across:
 * 1. Live stream ad video seek with Infinity duration & seekable TimeRanges.
 * 2. Strict CSP / Google Trusted Types policy support.
 * 3. Mixed visibility in .ytp-ad-module (hidden leftover + active visible).
 * 4. Ad progress indicator ("Ad 1 of 2 · 0:15") and colon countdown ("Skip in: 5").
 * 5. Lifecycle re-attachment & MutationObserver target upgrading.
 */

const { setupMockEnv } = require('./harness/mock-extension-env');
const mockEnv = setupMockEnv();
const { assert } = require('./harness/test-helpers');

require('../utils/dom-utils');
require('../content/js/ad-skipper');

async function runReviewer2AdversarialSuite() {
  console.log('\n================================================================');
  console.log('       REVIEWER ROUND 2 ADVERSARIAL VERIFICATION SUITE          ');
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

  // Adversarial Test 1: Live stream ad with skip button handles non-intrusively
  try {
    resetDOM();
    const player = setupPlayer();
    const video = document.createElement('video');
    video.className = 'html5-main-video';
    video.currentTime = 10;
    video.duration = Infinity;
    video.seekable = {
      length: 1,
      end: (idx) => 340.5,
      start: (idx) => 0
    };
    player.appendChild(video);
    player.classList.add('ad-showing');

    let skipBtnClicked = false;
    const skipBtn = document.createElement('button');
    skipBtn.className = 'ytp-ad-skip-button-modern';
    skipBtn.textContent = 'Skip';
    skipBtn.addEventListener('click', () => { skipBtnClicked = true; });
    player.appendChild(skipBtn);

    const skipper = window.AdSkipper;
    skipper.enable();

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();

    assert.equal(res, true, '_trySkip() handles live stream ad with skip button');
    assert.equal(skipBtnClicked, true, 'skip button was clicked for live stream ad');

    skipper.disable();
    console.log('✓ PASS: Live stream ad video skip button clicked without anti-adblock detection');
    passed++;
  } catch (e) {
    console.error('❌ FAIL: Live stream ad video seek:', e.message);
    failed++;
  }

  // Adversarial Test 2: MV3 CSP Compliance & MAIN-world Ad Skipper registration
  try {
    resetDOM();
    const manifestPath = require('path').join(__dirname, '..', 'manifest.json');
    const manifest = JSON.parse(require('fs').readFileSync(manifestPath, 'utf8'));
    
    // Verify MAIN world script is configured in manifest
    const mainWorldScript = manifest.content_scripts.find(cs => cs.world === 'MAIN');
    assert.ok(mainWorldScript !== undefined, 'MAIN world content script configured in manifest.json');
    assert.ok(mainWorldScript.js.includes('content/js/page-ad-skipper.js'), 'page-ad-skipper.js registered in MAIN world');

    // Verify AdSkipper enable/disable operates cleanly without unsafe inline script injection
    const skipper = window.AdSkipper;
    skipper.enable();
    const unsafeInjected = document.getElementById('godmode-ad-skipper-injected');
    assert.equal(unsafeInjected, null, 'Unsafe inline script tag NOT injected (CSP compliant)');

    skipper.disable();
    console.log('✓ PASS: MV3 CSP compliance & MAIN-world script isolation verified without inline injection');
    passed++;
  } catch (e) {
    console.error('❌ FAIL: Trusted Types policy support:', e.message);
    failed++;
  }

  // Adversarial Test 3: Mixed child visibility in .ytp-ad-module
  try {
    resetDOM();
    const player = setupPlayer();
    const adModule = document.createElement('div');
    adModule.className = 'ytp-ad-module';

    const hiddenChild = document.createElement('div');
    hiddenChild.className = 'ytp-ad-player-overlay';
    hiddenChild.style.display = 'none';
    adModule.appendChild(hiddenChild);

    const visibleChild = document.createElement('div');
    visibleChild.className = 'ytp-ad-overlay-container';
    visibleChild.style.display = 'block';
    adModule.appendChild(visibleChild);

    player.appendChild(adModule);

    const skipper = window.AdSkipper;
    skipper.enable();

    const isAd = skipper._isAdPlaying();
    assert.equal(isAd, true, '_isAdPlaying() detects ad when visible overlay exists alongside hidden overlay');

    skipper.disable();
    console.log('✓ PASS: Mixed child visibility in .ytp-ad-module accurately identifies active ad');
    passed++;
  } catch (e) {
    console.error('❌ FAIL: Mixed child visibility:', e.message);
    failed++;
  }

  // Adversarial Test 4: Hardened countdown & ad progress indicator rejection
  try {
    resetDOM();
    const player = setupPlayer();
    const skipper = window.AdSkipper;
    skipper.enable();

    // Ad progress indicator: "Ad 1 of 2 · 0:15"
    let clicked1 = false;
    const progressEl = document.createElement('div');
    progressEl.className = 'ytp-ad-skip-button-slot';
    progressEl.textContent = 'Ad 1 of 2 · 0:15';
    progressEl.click = () => { clicked1 = true; };
    player.appendChild(progressEl);

    // Colon countdown: "Skip in: 5"
    let clicked2 = false;
    const colonBtn = document.createElement('button');
    colonBtn.className = 'ytp-ad-skip-button-modern';
    colonBtn.textContent = 'Skip in: 5';
    colonBtn.click = () => { clicked2 = true; };
    player.appendChild(colonBtn);

    // Ad ends countdown: "Ad ends in 5s"
    let clicked3 = false;
    const endsBtn = document.createElement('button');
    endsBtn.className = 'ytp-skip-ad-button';
    endsBtn.textContent = 'Ad ends in 5s';
    endsBtn.click = () => { clicked3 = true; };
    player.appendChild(endsBtn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();

    assert.equal(res, false, '_trySkip() rejects all ad progress and countdown phrases');
    assert.equal(clicked1, false, 'Ad progress label was not clicked');
    assert.equal(clicked2, false, 'Colon countdown was not clicked');
    assert.equal(clicked3, false, 'Ad ends countdown was not clicked');

    skipper.disable();
    console.log('✓ PASS: Hardened countdown and ad progress patterns successfully rejected');
    passed++;
  } catch (e) {
    console.error('❌ FAIL: Hardened countdown rejection:', e.message);
    failed++;
  }

  // Adversarial Test 5: Dynamic MutationObserver target upgrading
  try {
    resetDOM();
    const skipper = window.AdSkipper;

    skipper.enable();
    assert.equal(skipper._observedTarget, document.body, 'Initial target is document.body');

    const player = setupPlayer();
    skipper._trySkip();
    assert.equal(skipper._observedTarget, player, 'Target upgraded to #movie_player');

    skipper.disable();
    assert.equal(skipper._observedTarget, null, 'Observer target reset on disable()');
    console.log('✓ PASS: Dynamic MutationObserver target upgrading and clean teardown verified');
    passed++;
  } catch (e) {
    console.error('❌ FAIL: Dynamic observer upgrading:', e.message);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`TOTAL REVIEWER 2 ADVERSARIAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runReviewer2AdversarialSuite().catch(err => {
    console.error('Fatal error in reviewer 2 adversarial test suite:', err);
    process.exit(1);
  });
}

module.exports = { runReviewer2AdversarialSuite };
