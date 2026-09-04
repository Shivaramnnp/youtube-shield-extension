/**
 * Tier 1 Test Suite: Auto Skip Ads (ad-skipper.test.js)
 * Covers requirements R1-R3:
 *  - R1: Identification and coverage of YouTube Skip Ad DOM selectors across all variants
 *  - R2: Reliable auto-skip logic with countdown avoidance, MutationObserver, 300ms poll fallback, and MouseEvent dispatch
 *  - R3: End-to-end toggle chain wiring from Storage to main.js and HUD/Options
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil, DEFAULT_SETTINGS } = require('../../utils/storage');

// Require AdSkipper implementation
require('../../content/js/ad-skipper');

const setupPlayerDOM = () => {
  const player = global.document.createElement('div');
  player.id = 'movie_player';
  player.className = 'html5-video-player';
  global.document.body.appendChild(player);
  return player;
};

describe('Auto Skip Ads: R1 & R2 - Selectors & Skip Logic', () => {

  test('R1.1: Detects and clicks modern 2023+ skip button (.ytp-ad-skip-button-modern)', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let clicked = false;
    const btn = global.document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern ytp-button';
    btn.textContent = 'Skip';
    btn.click = () => { clicked = true; };
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, true, '_trySkip() returns true for modern skip button');
    assert.equal(clicked, true, 'Modern skip button .click() was called');

    skipper.disable();
  });

  test('R1.2: Detects and clicks button inside modern skip slot (.ytp-ad-skip-button-slot button)', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let clicked = false;
    const slot = global.document.createElement('div');
    slot.className = 'ytp-ad-skip-button-slot';
    const btn = global.document.createElement('button');
    btn.textContent = 'Skip ▶|';
    btn.click = () => { clicked = true; };
    slot.appendChild(btn);
    player.appendChild(slot);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, true, '_trySkip() returns true for button inside skip slot');
    assert.equal(clicked, true, 'Slot button .click() was called');

    skipper.disable();
  });

  test('R1.3: Detects and clicks classic linear ad skip button (.ytp-skip-ad-button)', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let clicked = false;
    const btn = global.document.createElement('button');
    btn.className = 'ytp-skip-ad-button';
    btn.textContent = 'Skip Ad';
    btn.click = () => { clicked = true; };
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, true, '_trySkip() returns true for classic skip button');
    assert.equal(clicked, true, 'Classic skip button .click() was called');

    skipper.disable();
  });

  test('R1.4: Detects and clicks bumper / legacy skip button (.ytp-ad-skip-button)', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let clicked = false;
    const btn = global.document.createElement('button');
    btn.className = 'ytp-ad-skip-button';
    btn.textContent = 'Skip Ad';
    btn.click = () => { clicked = true; };
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, true, '_trySkip() returns true for bumper skip button');
    assert.equal(clicked, true, 'Bumper skip button .click() was called');

    skipper.disable();
  });

  test('R1.5: Detects and clicks inner text / content element (.ytp-ad-skip-button-text)', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let btnClicked = false;
    let innerClicked = false;
    const btn = global.document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.click = () => { btnClicked = true; };

    const innerSpan = global.document.createElement('div');
    innerSpan.className = 'ytp-ad-skip-button-text';
    innerSpan.textContent = 'Skip';
    innerSpan.click = () => { innerClicked = true; };
    btn.appendChild(innerSpan);
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, true, '_trySkip() returns true for inner skip text element');
    assert.ok(btnClicked || innerClicked, 'Either parent button or inner text received click');

    skipper.disable();
  });

  test('R1.6: Detects and clicks button with aria-label ("Skip ad", "Skip ads", "Skip")', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let clicked = false;
    const btn = global.document.createElement('button');
    btn.setAttribute('aria-label', 'Skip advertisement');
    btn.click = () => { clicked = true; };
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, true, '_trySkip() returns true for aria-label skip button');
    assert.equal(clicked, true, 'Aria-label button .click() was called');

    skipper.disable();
  });

  test('R1.7: Detects and clicks legacy videoAdUi skip button (.videoAdUiSkipButton)', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let clicked = false;
    const btn = global.document.createElement('button');
    btn.className = 'videoAdUiSkipButton';
    btn.textContent = 'Skip';
    btn.click = () => { clicked = true; };
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, true, '_trySkip() returns true for videoAdUi skip button');
    assert.equal(clicked, true, 'videoAdUi button .click() was called');

    skipper.disable();
  });

  test('R2.1: Does NOT click button when in countdown mode (preview container / countdown text)', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let previewClicked = false;
    const previewContainer = global.document.createElement('div');
    previewContainer.className = 'ytp-ad-preview-container';
    previewContainer.textContent = 'Video will play after ad';
    previewContainer.click = () => { previewClicked = true; };
    player.appendChild(previewContainer);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, false, '_trySkip() ignores countdown preview container');
    assert.equal(previewClicked, false, 'Preview container was not clicked');

    skipper.disable();
  });

  test('R2.2: Does NOT click button when countdown timer digits are displayed', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let countdownClicked = false;
    const countdownBtn = global.document.createElement('button');
    countdownBtn.className = 'ytp-ad-skip-button-slot';
    countdownBtn.textContent = '5';
    countdownBtn.click = () => { countdownClicked = true; };
    player.appendChild(countdownBtn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, false, '_trySkip() ignores pure countdown digit text');
    assert.equal(countdownClicked, false, 'Countdown button was not clicked');

    skipper.disable();
  });

  test('R2.3: Does NOT click button when hidden via display:none or visibility:hidden or hidden attribute', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let clicked = false;
    const btn = global.document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.style.display = 'none';
    btn.click = () => { clicked = true; };
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, false, '_trySkip() ignores display:none button');
    assert.equal(clicked, false, 'Hidden button was not clicked');

    skipper.disable();
  });

  test('R2.4: Does NOT click button when disabled (disabled property or aria-disabled)', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let clicked = false;
    const btn = global.document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.disabled = true;
    btn.click = () => { clicked = true; };
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, false, '_trySkip() ignores disabled button');
    assert.equal(clicked, false, 'Disabled button was not clicked');

    skipper.disable();
  });

  test('R2.5: Dispatches real MouseEvent if standard .click() does not bubble or is intercepted', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let clickFired = false;
    const btn = global.document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip Ad';
    btn.addEventListener('click', () => {
      clickFired = true;
    });

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    player.appendChild(btn);

    if (!clickFired) {
      skipper._trySkip();
    }

    assert.equal(clickFired, true, 'Click/MouseEvent listener was triggered on skip button');

    skipper.disable();
  });

  test('R2.6: Logs "[GodMode] AdSkipper: ad skipped ⚡" to console on skip', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };

    try {
      const btn = global.document.createElement('button');
      btn.className = 'ytp-ad-skip-button-modern';
      btn.textContent = 'Skip';
      player.appendChild(btn);

      skipper._lastSkippedEl = null;
      skipper._lastSkipTime = 0;
      skipper._trySkip();

      const hasSkipLog = logs.some(l => l.includes('[GodMode] AdSkipper: ad skipped ⚡'));
      assert.equal(hasSkipLog, true, 'Console logged exact string [GodMode] AdSkipper: ad skipped ⚡');
    } finally {
      console.log = origLog;
      skipper.disable();
    }
  });

  test('R2.7: Does NOT click when AdSkipper is disabled', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.disable();

    let clicked = false;
    const btn = global.document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';
    btn.click = () => { clicked = true; };
    player.appendChild(btn);

    const result = skipper._trySkip();
    assert.equal(result, false, '_trySkip() returns false when disabled');
    assert.equal(clicked, false, 'No click occurred when disabled');
  });

  test('R2.8: SPA Navigation (yt-navigate-finish) triggers re-attachment and skip check', async () => {
    await resetDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let skipCheckCalled = false;
    const origTrySkip = skipper._trySkip;
    skipper._trySkip = function() {
      skipCheckCalled = true;
      return origTrySkip.apply(this, arguments);
    };

    try {
      window.dispatchEvent(new Event('yt-navigate-finish'));
      assert.equal(skipCheckCalled, true, '_trySkip() was called on yt-navigate-finish event');
    } finally {
      skipper._trySkip = origTrySkip;
      skipper.disable();
    }
  });

  test('R2.9: Does NOT click during varied countdown strings ("Skip in 5s", "You can skip ad in 5s", "Skip ad in 5", "0:05")', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    const countdownStrings = [
      'Skip in 5s',
      'Skip in 5',
      'Skip ad in 5s',
      'Skip ad in 5',
      'Skip ads in 5s',
      'You can skip in 5',
      'You can skip in 5s',
      'You can skip ad in 5',
      'You can skip ad in 5s',
      'Ad will end in 5s',
      'Ad will end in 5',
      'Reward in 5s',
      '5s',
      '0:05'
    ];

    for (const str of countdownStrings) {
      let clicked = false;
      const btn = global.document.createElement('button');
      btn.className = 'ytp-ad-skip-button-modern';
      btn.textContent = str;
      btn.click = () => { clicked = true; };
      player.appendChild(btn);

      skipper._lastSkippedEl = null;
      skipper._lastSkipTime = 0;
      const result = skipper._trySkip();
      assert.equal(result, false, `_trySkip() correctly rejects countdown string: "${str}"`);
      assert.equal(clicked, false, `Button with text "${str}" was not clicked`);

      player.removeChild(btn);
    }

    skipper.disable();
  });

  test('R2.10: Unskippable 15s ad without skip button remains idle without clicking', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let previewClicked = false;
    const previewSlot = global.document.createElement('div');
    previewSlot.className = 'ytp-ad-preview-slot';
    previewSlot.textContent = 'Ad 1 of 2 · 0:15';
    previewSlot.click = () => { previewClicked = true; };
    player.appendChild(previewSlot);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, false, '_trySkip() returns false for unskippable ad');
    assert.equal(previewClicked, false, 'Unskippable preview slot was not clicked');

    skipper.disable();
  });

  test('R2.11: Rapid back-to-back skippable ads (Ad 1 then Ad 2) are both skipped', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    // Ad 1
    let ad1Clicked = false;
    const btn1 = global.document.createElement('button');
    btn1.className = 'ytp-ad-skip-button-modern';
    btn1.textContent = 'Skip';
    btn1.click = () => { ad1Clicked = true; };
    player.appendChild(btn1);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res1 = skipper._trySkip();
    assert.equal(res1, true, 'Ad 1 skip button clicked');
    assert.equal(ad1Clicked, true, 'Ad 1 click handler executed');

    // Remove Ad 1 element
    player.removeChild(btn1);

    // Ad 2 appears — reset lastSkipTime to simulate time elapsed between ads
    skipper._lastSkipTime = 0;
    let ad2Clicked = false;
    const btn2 = global.document.createElement('button');
    btn2.className = 'ytp-ad-skip-button-modern';
    btn2.textContent = 'Skip';
    btn2.click = () => { ad2Clicked = true; };
    player.appendChild(btn2);

    const res2 = skipper._trySkip();
    assert.equal(res2, true, 'Ad 2 skip button clicked');
    assert.equal(ad2Clicked, true, 'Ad 2 click handler executed');

    skipper.disable();
  });

  test('R2.12: Detects and clicks role="button" or custom element in skip slot', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    let clicked = false;
    const slot = global.document.createElement('div');
    slot.className = 'ytp-ad-skip-button-slot-modern';
    const customBtn = global.document.createElement('div');
    customBtn.setAttribute('role', 'button');
    customBtn.className = 'ytp-ad-skip-button-modern';
    customBtn.textContent = 'Skip ▶|';
    customBtn.click = () => { clicked = true; };
    slot.appendChild(customBtn);
    player.appendChild(slot);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, true, '_trySkip() returns true for role="button" inside slot');
    assert.equal(clicked, true, 'Custom role="button" element was clicked');

    skipper.disable();
  });

  test('R2.13: Does NOT click when countdown phrase is in aria-label or title attributes', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    // Button with icon only, but aria-label has countdown
    let clicked1 = false;
    const btn1 = global.document.createElement('button');
    btn1.className = 'ytp-ad-skip-button-modern';
    btn1.setAttribute('aria-label', 'Skip ad in 5 seconds');
    btn1.click = () => { clicked1 = true; };
    player.appendChild(btn1);

    // Button with title countdown
    let clicked2 = false;
    const btn2 = global.document.createElement('button');
    btn2.className = 'ytp-ad-skip-button-modern';
    btn2.setAttribute('title', 'You can skip ad in 5s');
    btn2.click = () => { clicked2 = true; };
    player.appendChild(btn2);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, false, '_trySkip() rejects countdown in aria-label and title attributes');
    assert.equal(clicked1, false, 'Button 1 with aria-label countdown was not clicked');
    assert.equal(clicked2, false, 'Button 2 with title countdown was not clicked');

    skipper.disable();
  });

  test('R2.14: Deep ancestor aria-hidden/disabled/hidden or candidate display:none prevents click', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    const grandparent = global.document.createElement('div');
    grandparent.setAttribute('aria-hidden', 'true');
    const parent = global.document.createElement('div');
    parent.className = 'ytp-ad-skip-button-slot';
    const btn = global.document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';

    let clicked = false;
    btn.click = () => { clicked = true; };
    parent.appendChild(btn);
    grandparent.appendChild(parent);
    player.appendChild(grandparent);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, false, '_trySkip() rejects element with aria-hidden ancestor');
    assert.equal(clicked, false, 'Deep ancestor aria-hidden button was not clicked');

    skipper.disable();
  });

  test('R2.15: Candidate wrapper countdown aria-label and pure timestamp (0:15 / 5s) rejection', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    // Slot wrapper has countdown aria-label while inner button is empty
    const slot = global.document.createElement('div');
    slot.className = 'ytp-ad-skip-button-slot';
    slot.setAttribute('aria-label', 'Skip in 5s');
    const emptyBtn = global.document.createElement('button');
    let clicked1 = false;
    emptyBtn.click = () => { clicked1 = true; };
    slot.appendChild(emptyBtn);
    player.appendChild(slot);

    // Button with pure timestamp "0:15"
    const timestampBtn = global.document.createElement('button');
    timestampBtn.className = 'ytp-ad-skip-button-modern';
    timestampBtn.setAttribute('title', '0:15');
    let clicked2 = false;
    timestampBtn.click = () => { clicked2 = true; };
    player.appendChild(timestampBtn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const result = skipper._trySkip();
    assert.equal(result, false, '_trySkip() rejects candidate wrapper countdown and pure timestamp');
    assert.equal(clicked1, false, 'Slot button with wrapper countdown was not clicked');
    assert.equal(clicked2, false, 'Timestamp button was not clicked');

    skipper.disable();
  });

  test('R2.16: Handles non-breaking spaces and dispatches MouseEvents', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    try {
      let eventCaptured = false;
      const btn = global.document.createElement('button');
      btn.className = 'ytp-ad-skip-button-modern';
      btn.textContent = 'Skip\u00A0Ad'; // non-breaking space
      btn.addEventListener('click', () => {
        eventCaptured = true;
      });
      player.appendChild(btn);

      skipper._lastSkippedEl = null;
      skipper._lastSkipTime = 0;
      const result = skipper._trySkip();
      assert.equal(result, true, '_trySkip() clicks button with non-breaking space text');
      assert.equal(eventCaptured, true, 'Click event listener triggered');
    } finally {
      skipper.disable();
    }
  });

});

describe('Auto Skip Ads: R3 - Full Toggle Chain & Settings Wiring', () => {

  test('R3.1: autoSkipAds is true by default in DEFAULT_SETTINGS and storage', async () => {
    await resetStorage();
    assert.equal(DEFAULT_SETTINGS.autoSkipAds, true, 'DEFAULT_SETTINGS.autoSkipAds is true by default');

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.autoSkipAds, true, 'StorageUtil.getSettings() returns autoSkipAds: true by default');
  });

  test('R3.2: StorageUtil.updateSetting updates autoSkipAds correctly', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('autoSkipAds', true);

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.autoSkipAds, true, 'StorageUtil.getSettings() returns autoSkipAds: true after update');

    await StorageUtil.updateSetting('autoSkipAds', false);
    const settingsOff = await StorageUtil.getSettings();
    assert.equal(settingsOff.autoSkipAds, false, 'StorageUtil.getSettings() returns autoSkipAds: false after toggle off');
  });

  test('R3.3: AdSkipper.enable() and disable() manage lifecycle and log state cleanly', async () => {
    const skipper = window.AdSkipper;
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };

    try {
      skipper.enable();
      assert.equal(skipper._enabled, true, 'AdSkipper._enabled is true after enable()');
      assert.ok(skipper._pollInterval !== null, 'Poll interval is running');

      skipper.disable();
      assert.equal(skipper._enabled, false, 'AdSkipper._enabled is false after disable()');
      assert.equal(skipper._pollInterval, null, 'Poll interval cleared after disable()');

      assert.ok(logs.some(l => l.includes('[GodMode] AdSkipper: enabled')), 'Logged enabled state');
      assert.ok(logs.some(l => l.includes('[GodMode] AdSkipper: disabled')), 'Logged disabled state');
    } finally {
      console.log = origLog;
      skipper.disable();
    }
  });

  test('R3.4: Main content script applySettings enables AdSkipper when autoSkipAds is true', async () => {
    await resetDOM();
    const skipper = window.AdSkipper;
    skipper.disable();

    // Require main.js to get applySettings
    require('../../content/js/main');

    assert.ok(typeof window.applySettings === 'function', 'window.applySettings is defined');

    // Apply settings with autoSkipAds = true
    window.applySettings({
      extensionEnabled: true,
      autoSkipAds: true
    });
    assert.equal(skipper._enabled, true, 'AdSkipper is enabled when autoSkipAds: true');

    // Apply settings with autoSkipAds = false
    window.applySettings({
      extensionEnabled: true,
      autoSkipAds: false
    });
    assert.equal(skipper._enabled, false, 'AdSkipper is disabled when autoSkipAds: false');

    skipper.disable();
  });

  test('R3.5: Master toggle disableAllFeatures disables AdSkipper when extensionEnabled is false', async () => {
    await resetDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    require('../../content/js/main');

    // Apply settings with extensionEnabled = false
    window.applySettings({
      extensionEnabled: false,
      autoSkipAds: true
    });

    assert.equal(skipper._enabled, false, 'AdSkipper is disabled when master toggle is off');
  });

  test('R3.6: HUD HeaderButton updateState synchronizes #ss-toggle-auto-skip-ads and activates shield', async () => {
    await resetDOM();
    await resetStorage();
    require('../../content/js/header-button');

    const headerBtn = window.HeaderButton;
    headerBtn.enable();

    // Setup HUD dialog mock
    const dialog = global.document.createElement('div');
    dialog.id = 'ss-popup-dialog';
    const autoSkipToggle = global.document.createElement('input');
    autoSkipToggle.type = 'checkbox';
    autoSkipToggle.id = 'ss-toggle-auto-skip-ads';
    autoSkipToggle.checked = false;
    dialog.appendChild(autoSkipToggle);
    global.document.body.appendChild(dialog);

    // Update storage with autoSkipAds = true
    await StorageUtil.updateSetting('autoSkipAds', true);
    await headerBtn.updateState();

    assert.equal(autoSkipToggle.checked, true, '#ss-toggle-auto-skip-ads toggle checked matches storage state');
    assert.equal(headerBtn.isShieldEnabled, true, 'Shield is enabled when autoSkipAds is active');

    headerBtn.disable();
  });

});

describe('Auto Skip Ads: Strategies A, B & C (Media Seek, Script Injection, DOM Removal)', () => {

  const setupPlayerDOMWithVideo = (initialTime = 0, duration = 30) => {
    const player = global.document.createElement('div');
    player.id = 'movie_player';
    player.className = 'html5-video-player';

    const video = global.document.createElement('video');
    video.className = 'html5-main-video';
    video.currentTime = initialTime;
    video.duration = duration;
    video.playbackRate = 1;
    video.paused = false;
    player.appendChild(video);

    global.document.body.appendChild(player);
    return { player, video };
  };

  test('Strategy A.1: Does NOT force seek video.currentTime when .ad-showing class is on player', async () => {
    await resetDOM();
    const { player, video } = setupPlayerDOMWithVideo(5, 30);
    player.classList.add('ad-showing');

    const skipper = window.AdSkipper;
    skipper.enable();

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    skipper._trySkip();

    assert.equal(video.currentTime, 5, 'Ad video currentTime remains 5s (not artificially modified)');

    skipper.disable();
  });

  test('Strategy A.2: Does NOT force seek video.currentTime when .ad-interrupting class is on player', async () => {
    await resetDOM();
    const { player, video } = setupPlayerDOMWithVideo(2, 15);
    player.classList.add('ad-interrupting');

    const skipper = window.AdSkipper;
    skipper.enable();

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    skipper._trySkip();

    assert.equal(video.currentTime, 2, 'Ad video currentTime remains 2s (not artificially modified)');

    skipper.disable();
  });

  test('Strategy A.3: Does NOT force seek video.currentTime when ad is playing (non-intrusive mode)', async () => {
    await resetDOM();
    const { player, video } = setupPlayerDOMWithVideo(5, 20);
    player.classList.add('ytp-ad-playing');

    const skipper = window.AdSkipper;
    skipper.enable();

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();

    assert.equal(video.currentTime, 5, 'Ad video currentTime was NOT artificially altered');

    skipper.disable();
  });

  test('Strategy A.4: Does NOT alter video.currentTime when NO ad is playing', async () => {
    await resetDOM();
    const { player, video } = setupPlayerDOMWithVideo(120, 600);
    // Normal playback: no ad classes, no ad module
    player.className = 'html5-video-player playing-mode';

    const skipper = window.AdSkipper;
    skipper.enable();

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();

    assert.equal(res, false, '_trySkip() returns false when no ad is playing');
    assert.equal(video.currentTime, 120, 'Main video currentTime remains unchanged at 120s');

    skipper.disable();
  });

  test('Strategy B.1: _injectPageScript() is a no-op (CSP-compliant — no inline script injection)', async () => {
    // YouTube's CSP blocks inline script injection via script.textContent.
    // _injectPageScript() must be a no-op that does NOT add any script tag to the DOM.
    await resetDOM();
    const skipper = window.AdSkipper;

    skipper.enable();
    const injected = global.document.getElementById('godmode-ad-skipper-injected');
    assert.equal(injected, null, 'Page script #godmode-ad-skipper-injected must NOT be added to DOM (CSP-compliant)');

    skipper.disable();
    assert.equal(global.document.getElementById('godmode-ad-skipper-injected'), null,
      'No residual script element after disable()');
  });

  test('Strategy B.2: _attachMessageListener() is a no-op (page script removed, no postMessage coordination)', async () => {
    // _attachMessageListener() is removed along with page script injection.
    // The message listener should NOT be attached; dispatching a GODMODE_AD_SKIPPED_CONFIRM
    // message should have no effect.
    await resetDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };

    try {
      skipper._lastLogTime = 0;
      skipper._lastSkippedEl = null;
      window.dispatchEvent({
        type: 'message',
        data: { type: 'GODMODE_AD_SKIPPED_CONFIRM' }
      });

      // postMessage coordination is removed — no log should be emitted via message listener
      const hasSkipLog = logs.some(l => l.includes('[GodMode] AdSkipper: ad skipped ⚡'));
      assert.equal(hasSkipLog, false,
        'GODMODE_AD_SKIPPED_CONFIRM postMessage must NOT trigger skip logging (message listener removed)');
    } finally {
      console.log = origLog;
      skipper.disable();
    }
  });

  test('Strategy C.1: Dismisses anti-adblock enforcement message if dialog appears', async () => {
    await resetDOM();
    const { player } = setupPlayerDOMWithVideo(0, 30);
    player.classList.add('ad-showing');

    const dialog = global.document.createElement('div');
    dialog.className = 'ytd-enforcement-message-view-model';
    let dismissed = false;
    const btn = global.document.createElement('button');
    btn.click = () => { dismissed = true; };
    dialog.appendChild(btn);
    player.appendChild(dialog);

    const skipper = window.AdSkipper;
    skipper.enable();

    skipper._adStartTime = Date.now() - 2500;
    skipper._trySkip();

    assert.equal(dismissed, true, 'Enforcement message dismiss button was clicked');

    skipper.disable();
  });

  test('Strategy A.5: Preserves video playbackRate and does not force 16x speed', async () => {
    await resetDOM();
    const { player, video } = setupPlayerDOMWithVideo(0, 30);
    player.classList.add('ad-showing');
    video.playbackRate = 1.0;

    const skipper = window.AdSkipper;
    skipper.enable();

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    skipper._trySkip();

    assert.equal(video.playbackRate, 1.0, 'video.playbackRate was not corrupted to 16');
    skipper.disable();
  });

  test('Strategy A.6: Ignores hidden .ytp-ad-module with display: none during main video playback', async () => {
    await resetDOM();
    const { player, video } = setupPlayerDOMWithVideo(50, 300);
    player.className = 'html5-video-player';

    const adModule = global.document.createElement('div');
    adModule.className = 'ytp-ad-module';
    adModule.style.display = 'none';
    const child = global.document.createElement('div');
    child.className = 'ytp-ad-player-overlay';
    adModule.appendChild(child);
    player.appendChild(adModule);

    const skipper = window.AdSkipper;
    skipper.enable();

    assert.equal(skipper._isAdPlaying(), false, '_isAdPlaying() returns false for hidden ad module');
    assert.equal(video.currentTime, 50, 'Main video currentTime remains unchanged at 50s');
    skipper.disable();
  });

  test('Strategy B.3: _injectPageScript() does NOT inject a script element (CSP-compliant no-op)', async () => {
    // Inline script injection is blocked by YouTube's CSP directive:
    // script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules'
    // The _injectPageScript method must be a no-op that creates no DOM element.
    await resetDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    const script = global.document.getElementById('godmode-ad-skipper-injected');
    assert.equal(script, null, 'No script element must be injected into DOM (CSP-compliant no-op)');

    skipper.disable();
  });

  test('Strategy B.4: _injectPageScript() ignores trustedTypes — no-op regardless of CSP environment', async () => {
    // Even with trustedTypes present, _injectPageScript() is a no-op.
    // YouTube's CSP policy disallows ALL inline script execution in MV3 content scripts.
    await resetDOM();
    let policyCreated = false;

    window.trustedTypes = {
      createPolicy: (name, rules) => {
        policyCreated = true;
        return { createScript: (s) => s };
      }
    };

    const skipper = window.AdSkipper;
    try {
      skipper.enable();
      const injected = global.document.getElementById('godmode-ad-skipper-injected');
      assert.equal(injected, null, 'No script element must be injected even with trustedTypes present');
      assert.equal(policyCreated, false, 'No Trusted Types policy is created when script injection is a no-op');
    } finally {
      skipper.disable();
      delete window.trustedTypes;
    }
  });

  test('Strategy D.1: Debounces console logging across rapid skip button clicks within 500ms', async () => {
    await resetDOM();
    const { player } = setupPlayerDOMWithVideo(0, 30);
    player.classList.add('ad-showing');

    const btn = global.document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';
    player.appendChild(btn);

    const skipper = window.AdSkipper;
    skipper.enable();

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };

    try {
      // Reset both timers so first call fires
      skipper._lastLogTime = 0;
      skipper._lastSkipTime = 0;

      skipper._trySkip(); // fires: logs 1x, sets _lastSkipTime = now
      // Second & third calls within 1500ms deduplication window — skipped = false, no log
      skipper._trySkip();
      skipper._trySkip();

      const skipLogs = logs.filter(l => l.includes('[GodMode] AdSkipper: ad skipped ⚡'));
      assert.equal(skipLogs.length, 1, 'Console logged exactly 1 time across rapid successive calls');
    } finally {
      console.log = origLog;
      skipper.disable();
    }
  });

  test('Strategy A.7: Live video stream ad with duration Infinity does NOT force seek video.currentTime', async () => {
    await resetDOM();
    const { player, video } = setupPlayerDOMWithVideo(10, Infinity);
    player.classList.add('ad-showing');
    video.duration = Infinity;
    video.seekable = {
      length: 1,
      end: (idx) => 125.5,
      start: (idx) => 0
    };

    const skipper = window.AdSkipper;
    skipper.enable();

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();

    assert.equal(video.currentTime, 10, 'Live stream ad currentTime was NOT artificially altered');

    skipper.disable();
  });

  test('Strategy A.8: Detects active ad when .ytp-ad-module has both hidden and visible children', async () => {
    await resetDOM();
    const { player } = setupPlayerDOMWithVideo(0, 30);

    const adModule = global.document.createElement('div');
    adModule.className = 'ytp-ad-module';

    // Leftover hidden overlay
    const hiddenChild = global.document.createElement('div');
    hiddenChild.className = 'ytp-ad-player-overlay';
    hiddenChild.style.display = 'none';
    adModule.appendChild(hiddenChild);

    // Active visible overlay container
    const visibleChild = global.document.createElement('div');
    visibleChild.className = 'ytp-ad-overlay-container';
    visibleChild.style.display = 'block';
    adModule.appendChild(visibleChild);

    player.appendChild(adModule);

    const skipper = window.AdSkipper;
    skipper.enable();

    assert.equal(skipper._isAdPlaying(), true, '_isAdPlaying() returns true when at least one child is visible');

    skipper.disable();
  });


  test('Strategy D.2: Rejects ad progress indicator "Ad 1 of 2 · 0:15" and colon countdown "Skip in: 5"', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    // Ad progress indicator
    const progressEl = global.document.createElement('div');
    progressEl.className = 'ytp-ad-skip-button-slot';
    progressEl.textContent = 'Ad 1 of 2 · 0:15';
    let progressClicked = false;
    progressEl.click = () => { progressClicked = true; };
    player.appendChild(progressEl);

    // Colon countdown button
    const colonBtn = global.document.createElement('button');
    colonBtn.className = 'ytp-ad-skip-button-modern';
    colonBtn.textContent = 'Skip in: 5';
    let colonClicked = false;
    colonBtn.click = () => { colonClicked = true; };
    player.appendChild(colonBtn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();

    assert.equal(res, false, '_trySkip() rejects ad progress and colon countdown');
    assert.equal(progressClicked, false, 'Progress indicator was not clicked');
    assert.equal(colonClicked, false, 'Colon countdown was not clicked');

    skipper.disable();
  });

  test('Strategy D.3: MutationObserver upgrades target from body to #movie_player dynamically', async () => {
    await resetDOM();
    const skipper = window.AdSkipper;

    // Start with empty DOM (observer attaches to document.body)
    skipper.enable();
    assert.equal(skipper._observedTarget, global.document.body, 'Initial observed target is document.body');

    // Mount #movie_player dynamically
    const player = setupPlayerDOM();
    skipper._trySkip();

    assert.equal(skipper._observedTarget, player, 'Observer target upgraded to #movie_player dynamically');

    skipper.disable();
  });

  test('Interface Contract: AdSkipper.getStatus() returns operational metrics and lifecycle state', async () => {
    await resetDOM();
    const skipper = window.AdSkipper;
    skipper.disable();

    const statusDisabled = skipper.getStatus();
    assert.equal(statusDisabled.enabled, false, 'getStatus().enabled is false when disabled');
    assert.equal(statusDisabled.observerActive, false, 'getStatus().observerActive is false when disabled');
    assert.equal(typeof statusDisabled.lastSkipTime, 'number', 'getStatus().lastSkipTime is number');
    assert.equal(typeof statusDisabled.totalSkipped, 'number', 'getStatus().totalSkipped is number');

    skipper.enable();
    const statusEnabled = skipper.getStatus();
    assert.equal(statusEnabled.enabled, true, 'getStatus().enabled is true when enabled');
    assert.equal(statusEnabled.observerActive, true, 'getStatus().observerActive is true when enabled');

    skipper.disable();
  });

  test('M1 Sequence: Dispatches full native event sequence (pointerdown -> mousedown -> pointerup -> mouseup -> click) with composed: true', async () => {
    await resetDOM();
    const player = setupPlayerDOM();
    const skipper = window.AdSkipper;
    skipper.enable();

    const eventsFired = [];
    const btn = global.document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';

    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evtType => {
      btn.addEventListener(evtType, (e) => {
        eventsFired.push({ type: evtType, composed: e.composed, bubbles: e.bubbles });
      });
    });

    player.appendChild(btn);
    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;

    const res = skipper._trySkip();
    assert.equal(res, true, '_trySkip() triggered skip action');
    assert.ok(eventsFired.length >= 5, 'All 5 interaction events were dispatched');
    assert.equal(eventsFired[0].type, 'pointerdown', 'First event is pointerdown');
    assert.equal(eventsFired[1].type, 'mousedown', 'Second event is mousedown');
    assert.equal(eventsFired[2].type, 'pointerup', 'Third event is pointerup');
    assert.equal(eventsFired[3].type, 'mouseup', 'Fourth event is mouseup');
    assert.equal(eventsFired[4].type, 'click', 'Fifth event is click');
    assert.equal(eventsFired[0].composed, true, 'pointerdown has composed: true');
    assert.equal(eventsFired[4].composed, true, 'click has composed: true');

    skipper.disable();
  });

  test('M2 Playback Assurance: Resumes paused video playback via video.play() on ad skip', async () => {
    await resetDOM();
    const { player, video } = setupPlayerDOMWithVideo(10, 100);
    video.paused = true;
    let playCalled = false;
    video.play = async () => {
      playCalled = true;
      video.paused = false;
    };

    const btn = global.document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';
    player.appendChild(btn);

    const skipper = window.AdSkipper;
    skipper.enable();
    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;

    const res = skipper._trySkip();
    assert.equal(res, true, '_trySkip() returned true');
    assert.equal(playCalled, true, 'video.play() was invoked to resume playback post-skip');

    skipper.disable();
  });

  test('M3 Isolation: Dismisses ytd-enforcement-message-view-model without mutating tp-yt-iron-overlay-backdrop', async () => {
    await resetDOM();
    const { player, video } = setupPlayerDOMWithVideo(10, 100);
    video.paused = true;
    let playCalled = false;
    video.play = async () => {
      playCalled = true;
      video.paused = false;
    };

    // YouTube native Polymer menu backdrop
    const backdrop = global.document.createElement('tp-yt-iron-overlay-backdrop');
    backdrop.className = 'opened';
    global.document.body.appendChild(backdrop);

    const skipper = window.AdSkipper;
    skipper.enable();

    // Enforcement modal mounts dynamically while AdSkipper is running
    const modal = global.document.createElement('ytd-enforcement-message-view-model');
    let modalDismissClicked = false;
    const dismissBtn = global.document.createElement('button');
    dismissBtn.click = () => { modalDismissClicked = true; };
    modal.appendChild(dismissBtn);
    global.document.body.appendChild(modal);

    const res = skipper._trySkip();
    assert.equal(res, true, '_trySkip() detected and dismissed enforcement modal');
    assert.equal(modalDismissClicked, true, 'Enforcement modal dismiss button was clicked');
    assert.equal(global.document.querySelector('ytd-enforcement-message-view-model'), null, 'Modal was removed from DOM');
    assert.ok(global.document.querySelector('tp-yt-iron-overlay-backdrop') !== null, 'Native Polymer backdrop remains untouched in DOM');
    assert.equal(playCalled, true, 'Main video play() resumed post-modal dismissal');

    skipper.disable();
  });

});




