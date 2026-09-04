/**
 * Independent Victory Auditor Verification Suite
 * Tests all requirements from ORIGINAL_REQUEST.md independently.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// Setup mock environment
const { setupMockEnv } = require('../../tests/harness/mock-extension-env');
setupMockEnv();

const { StorageUtil, DEFAULT_SETTINGS } = require('../../utils/storage');
require('../../content/js/ad-skipper');
require('../../content/js/main');
require('../../content/js/header-button');

async function runAuditorVerification() {
  console.log('================================================================');
  console.log('   INDEPENDENT AUDITOR REQUIREMENTS VERIFICATION SUITE          ');
  console.log('================================================================');

  let total = 0;
  let passed = 0;
  let failed = 0;

  function auditAssert(cond, name) {
    total++;
    if (cond) {
      passed++;
      console.log(`  ✓ [AUDIT PASS] ${name}`);
    } else {
      failed++;
      console.error(`  ❌ [AUDIT FAIL] ${name}`);
    }
  }

  // --- Check 1: Manifest & Module Architecture Check ---
  console.log('\n--- 1. Manifest & Module Architecture Check ---');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../../manifest.json'), 'utf8'));
  const contentJs = manifest.content_scripts[0].js;
  const adSkipperIdx = contentJs.indexOf('content/js/ad-skipper.js');
  const mainJsIdx = contentJs.indexOf('content/js/main.js');

  auditAssert(adSkipperIdx !== -1, 'manifest.json includes content/js/ad-skipper.js');
  auditAssert(mainJsIdx !== -1, 'manifest.json includes content/js/main.js');
  auditAssert(adSkipperIdx < mainJsIdx, 'manifest.json loads content/js/ad-skipper.js before content/js/main.js');

  // --- Check 2: Storage Default and Toggle Chain ---
  console.log('\n--- 2. Storage Defaults & Persistence Check ---');
  auditAssert(DEFAULT_SETTINGS.autoSkipAds === false, 'DEFAULT_SETTINGS.autoSkipAds is false by default');
  
  await global.chrome.storage.local.clear();
  await global.chrome.storage.sync.clear();
  StorageUtil.clearMemoryCache();

  const initialSettings = await StorageUtil.getSettings();
  auditAssert(initialSettings.autoSkipAds === false, 'StorageUtil.getSettings() returns autoSkipAds: false initially');

  await StorageUtil.updateSetting('autoSkipAds', true);
  const updatedSettings = await StorageUtil.getSettings();
  auditAssert(updatedSettings.autoSkipAds === true, 'StorageUtil.updateSetting("autoSkipAds", true) persists correctly');

  await StorageUtil.updateSetting('autoSkipAds', false);
  const revertedSettings = await StorageUtil.getSettings();
  auditAssert(revertedSettings.autoSkipAds === false, 'StorageUtil.updateSetting("autoSkipAds", false) persists correctly');

  // --- Check 3: Strategy A - Video seek to end ---
  console.log('\n--- 3. Strategy A: Video Seek to End ---');
  const skipper = window.AdSkipper;

  // 3.1 .ad-showing detection and seek
  document.body.innerHTML = '';
  const player1 = document.createElement('div');
  player1.id = 'movie_player';
  player1.className = 'html5-video-player ad-showing';
  const video1 = document.createElement('video');
  video1.className = 'html5-main-video';
  video1.currentTime = 5;
  video1.duration = 30;
  player1.appendChild(video1);
  document.body.appendChild(player1);

  skipper.enable();
  skipper._lastSkippedEl = null;
  skipper._lastSkipTime = 0;
  const res1 = skipper._trySkip();
  auditAssert(res1 === true, 'Strategy A detected ad via .ad-showing');
  auditAssert(video1.currentTime === 30, 'Strategy A advanced video.currentTime to duration (30s)');

  // 3.2 .ad-interrupting detection and seek
  player1.className = 'html5-video-player ad-interrupting';
  video1.currentTime = 2;
  video1.duration = 15;
  skipper._lastSkippedEl = null;
  skipper._lastSkipTime = 0;
  const res2 = skipper._trySkip();
  auditAssert(res2 === true, 'Strategy A detected ad via .ad-interrupting');
  auditAssert(video1.currentTime === 15, 'Strategy A advanced video.currentTime to duration (15s)');

  // 3.3 .ytp-ad-playing detection and seek
  player1.className = 'html5-video-player ytp-ad-playing';
  video1.currentTime = 0;
  video1.duration = 20;
  skipper._lastSkippedEl = null;
  skipper._lastSkipTime = 0;
  const res3 = skipper._trySkip();
  auditAssert(res3 === true, 'Strategy A detected ad via .ytp-ad-playing');
  auditAssert(video1.currentTime === 20, 'Strategy A advanced video.currentTime to duration (20s)');

  // 3.4 Non-ad video content isolation (no interference)
  player1.className = 'html5-video-player';
  video1.currentTime = 120;
  video1.duration = 600;
  skipper._lastSkippedEl = null;
  skipper._lastSkipTime = 0;
  const resNonAd = skipper._trySkip();
  auditAssert(resNonAd === false, 'Strategy A ignored non-ad video');
  auditAssert(video1.currentTime === 120, 'Non-ad video currentTime untouched at 120s');

  skipper.disable();

  // --- Check 4: Strategy B - Page Script Main World Injection ---
  console.log('\n--- 4. Strategy B: Page Script Main World Injection ---');
  skipper.enable();
  const scriptEl = document.getElementById('godmode-ad-skipper-injected');
  auditAssert(scriptEl !== null, 'Page script was injected into document.head / DOM');
  auditAssert(scriptEl.textContent.includes('GODMODE_SKIP_AD_REQUEST'), 'Injected script handles GODMODE_SKIP_AD_REQUEST message');
  auditAssert(scriptEl.textContent.includes('GODMODE_AD_SKIPPED_CONFIRM'), 'Injected script posts GODMODE_AD_SKIPPED_CONFIRM response');

  skipper.disable();
  const scriptRemoved = document.getElementById('godmode-ad-skipper-injected');
  auditAssert(scriptRemoved === null, 'Page script was cleaned up on disable()');

  // --- Check 5: Strategy C - Fallback DOM Removal ---
  console.log('\n--- 5. Strategy C: Fallback DOM Removal after 2s ---');
  document.body.innerHTML = '';
  const player3 = document.createElement('div');
  player3.id = 'movie_player';
  player3.className = 'html5-video-player ad-showing';
  const adModule = document.createElement('div');
  adModule.className = 'ytp-ad-module';
  const overlay = document.createElement('div');
  overlay.className = 'ytp-ad-player-overlay';
  adModule.appendChild(overlay);
  player3.appendChild(adModule);
  const video3 = document.createElement('video');
  video3.currentTime = 0;
  video3.duration = 30;
  player3.appendChild(video3);
  document.body.appendChild(player3);

  skipper.enable();
  skipper._lastSkippedEl = null;
  skipper._lastSkipTime = 0;
  skipper._trySkip(); // sets _adStartTime

  skipper._adStartTime = Date.now() - 2200; // simulate 2.2 seconds elapsed
  skipper._trySkip();

  auditAssert(adModule.style.display === 'none', 'Strategy C hid .ytp-ad-module after 2s persistence');
  auditAssert(overlay.style.display === 'none', 'Strategy C hid .ytp-ad-player-overlay after 2s persistence');
  auditAssert(!player3.classList.contains('ad-showing'), 'Strategy C cleared .ad-showing class from player');

  skipper.disable();

  // --- Check 6: Console Log Format ---
  console.log('\n--- 6. Console Logging Check ---');
  const capturedLogs = [];
  const origLog = console.log;
  console.log = (...args) => { capturedLogs.push(args.join(' ')); };

  try {
    skipper.enable();
    document.body.innerHTML = '';
    const playerLog = document.createElement('div');
    playerLog.id = 'movie_player';
    playerLog.className = 'html5-video-player ad-showing';
    const videoLog = document.createElement('video');
    videoLog.currentTime = 0;
    videoLog.duration = 10;
    playerLog.appendChild(videoLog);
    document.body.appendChild(playerLog);

    skipper._lastLogTime = 0;
    skipper._lastSkippedEl = null;
    skipper._trySkip();

    const matchedLog = capturedLogs.some(l => l.includes('[GodMode] AdSkipper: ad skipped ⚡'));
    auditAssert(matchedLog === true, 'Exact console log string "[GodMode] AdSkipper: ad skipped ⚡" produced');
  } finally {
    console.log = origLog;
    skipper.disable();
  }

  // --- Check 7: SPA Navigation Re-triggering ---
  console.log('\n--- 7. SPA Navigation Event (yt-navigate-finish) Check ---');
  let skipCheckOnNav = false;
  const originalTrySkip = skipper._trySkip;
  skipper._trySkip = function() {
    skipCheckOnNav = true;
    return originalTrySkip.apply(this, arguments);
  };

  try {
    skipper.enable();
    skipCheckOnNav = false;
    window.dispatchEvent(new Event('yt-navigate-finish'));
    auditAssert(skipCheckOnNav === true, 'AdSkipper._trySkip() re-executes on yt-navigate-finish event');
  } finally {
    skipper._trySkip = originalTrySkip;
    skipper.disable();
  }

  // --- Check 8: Options & HUD DOM Wiring ---
  console.log('\n--- 8. Options and HUD DOM Toggles ---');
  const optionsHtml = fs.readFileSync(path.join(__dirname, '../../options/options.html'), 'utf8');
  const optionsJs = fs.readFileSync(path.join(__dirname, '../../options/options.js'), 'utf8');
  const headerBtnJs = fs.readFileSync(path.join(__dirname, '../../content/js/header-button.js'), 'utf8');

  auditAssert(optionsHtml.includes('id="opt-autoSkipAds"'), 'options.html includes #opt-autoSkipAds checkbox');
  auditAssert(optionsJs.includes('opt-autoSkipAds') && optionsJs.includes('autoSkipAds'), 'options.js handles opt-autoSkipAds toggle');
  auditAssert(headerBtnJs.includes('ss-toggle-auto-skip-ads') && headerBtnJs.includes('autoSkipAds'), 'header-button.js binds #ss-toggle-auto-skip-ads');

  console.log('\n================================================================');
  console.log(`AUDIT VERIFICATION SUMMARY: ${passed}/${total} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuditorVerification().catch(err => {
  console.error('Fatal error during auditor verification:', err);
  process.exit(1);
});
