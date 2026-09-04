/**
 * Challenger Adversarial Verification Script for Auto Skip Ads (R1, R2, R3)
 */

const { setupMockEnv } = require('./harness/mock-extension-env');
const mockEnv = setupMockEnv();

const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../utils/storage');
require('../utils/dom-utils');
require('../content/js/ad-skipper');
require('../content/js/header-button');
require('../content/js/main');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`✓ PASS: ${message}`);
    testsPassed++;
  }
}

async function runAdSkipperAdversarialSuite() {
  console.log('================================================================');
  console.log('   CHALLENGER ADVERSARIAL TEST SUITE: AUTO SKIP ADS             ');
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

  // ── TEST 1: Comprehensive Selector Coverage (R1) ──────────────────────────
  console.log('--- 1. Selectors & DOM Target Resolution ---');

  const selectorCases = [
    { desc: 'Modern button (.ytp-ad-skip-button-modern)', tag: 'button', cls: 'ytp-ad-skip-button-modern', txt: 'Skip ▶|' },
    { desc: 'Classic linear button (.ytp-skip-ad-button)', tag: 'button', cls: 'ytp-skip-ad-button', txt: 'Skip Ad' },
    { desc: 'Bumper button (.ytp-ad-skip-button)', tag: 'button', cls: 'ytp-ad-skip-button', txt: 'Skip' },
    { desc: 'Aria-label skip button (button[aria-label="Skip ad"])', tag: 'button', aria: 'Skip ad', txt: '' },
    { desc: 'Aria-label skip advertisement (button[aria-label="Skip advertisement"])', tag: 'button', aria: 'Skip advertisement', txt: '' },
    { desc: 'Legacy videoAdUi button (.videoAdUiSkipButton)', tag: 'button', cls: 'videoAdUiSkipButton', txt: 'Skip' }
  ];

  for (const tc of selectorCases) {
    const player = setupPlayer();
    skipper.enable();

    let clicked = false;
    const btn = document.createElement(tc.tag);
    if (tc.cls) btn.className = tc.cls;
    if (tc.aria) btn.setAttribute('aria-label', tc.aria);
    if (tc.txt) btn.textContent = tc.txt;
    btn.click = () => { clicked = true; };
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, `_trySkip() successfully skipped: ${tc.desc}`);
    assert(clicked === true, `Click handler executed for: ${tc.desc}`);

    skipper.disable();
  }

  // Nested in container / slot
  {
    const player = setupPlayer();
    skipper.enable();

    let clicked = false;
    const slot = document.createElement('div');
    slot.className = 'ytp-ad-skip-button-slot';
    const innerBtn = document.createElement('button');
    innerBtn.textContent = 'Skip';
    innerBtn.click = () => { clicked = true; };
    slot.appendChild(innerBtn);
    player.appendChild(slot);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, `_trySkip() resolved child button inside slot container`);
    assert(clicked === true, `Slot child button received click`);

    skipper.disable();
  }

  // Nested text span resolving to parent button
  {
    const player = setupPlayer();
    skipper.enable();

    let parentClicked = false;
    let textClicked = false;
    const parentBtn = document.createElement('button');
    parentBtn.className = 'ytp-ad-skip-button-modern';
    parentBtn.click = () => { parentClicked = true; };

    const textSpan = document.createElement('span');
    textSpan.className = 'ytp-ad-skip-button-text';
    textSpan.textContent = 'Skip';
    textSpan.click = () => { textClicked = true; };
    parentBtn.appendChild(textSpan);
    player.appendChild(parentBtn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, `_trySkip() resolved inner text span`);
    assert(parentClicked || textClicked, `Parent button or inner text received click`);

    skipper.disable();
  }

  // ── TEST 2: Countdown & Guarding Logic (R2) ────────────────────────────────
  console.log('\n--- 2. Countdown Guarding & Disabled/Hidden States ---');

  const countdownStrings = [
    '5',
    '5s',
    '0:05',
    'Skip in 5',
    'Skip in 5s',
    'Skip ad in 5',
    'Skip ad in 5s',
    'Skip ads in 5s',
    'You can skip in 5',
    'You can skip in 5s',
    'You can skip ad in 5',
    'You can skip ad in 5s',
    'Video will play after ad',
    'Ad will end in 5',
    'Ad will end in 5s',
    'Reward in 5s'
  ];

  for (const cStr of countdownStrings) {
    const player = setupPlayer();
    skipper.enable();

    let clicked = false;
    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = cStr;
    btn.click = () => { clicked = true; };
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === false, `Guards successfully rejected countdown: "${cStr}"`);
    assert(clicked === false, `No click executed during countdown: "${cStr}"`);

    skipper.disable();
  }

  // Disabled states
  {
    const player = setupPlayer();
    skipper.enable();

    // disabled attribute
    const btn1 = document.createElement('button');
    btn1.className = 'ytp-ad-skip-button-modern';
    btn1.disabled = true;
    player.appendChild(btn1);

    // aria-disabled
    const btn2 = document.createElement('button');
    btn2.className = 'ytp-ad-skip-button-modern';
    btn2.setAttribute('aria-disabled', 'true');
    player.appendChild(btn2);

    // display: none
    const btn3 = document.createElement('button');
    btn3.className = 'ytp-ad-skip-button-modern';
    btn3.style.display = 'none';
    player.appendChild(btn3);

    // parent display: none
    const parent = document.createElement('div');
    parent.style.display = 'none';
    const btn4 = document.createElement('button');
    btn4.className = 'ytp-ad-skip-button-modern';
    parent.appendChild(btn4);
    player.appendChild(parent);

    // hidden attribute
    const btn5 = document.createElement('button');
    btn5.className = 'ytp-ad-skip-button-modern';
    btn5.setAttribute('hidden', '');
    player.appendChild(btn5);

    // Deep ancestor aria-hidden/disabled
    const grandParent = document.createElement('div');
    grandParent.setAttribute('aria-hidden', 'true');
    const midSlot = document.createElement('div');
    midSlot.className = 'ytp-ad-skip-button-slot';
    const deepBtn = document.createElement('button');
    deepBtn.className = 'ytp-ad-skip-button-modern';
    deepBtn.textContent = 'Skip';
    midSlot.appendChild(deepBtn);
    grandParent.appendChild(midSlot);
    player.appendChild(grandParent);

    // Candidate inline style display: none
    const hiddenSlot = document.createElement('div');
    hiddenSlot.className = 'ytp-ad-skip-button-slot';
    hiddenSlot.style.display = 'none';
    const hiddenSlotBtn = document.createElement('button');
    hiddenSlotBtn.textContent = 'Skip';
    hiddenSlot.appendChild(hiddenSlotBtn);
    player.appendChild(hiddenSlot);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === false, `Guards rejected all hidden/disabled variants`);

    skipper.disable();
  }

  // Aria-label and Title Countdown Rejection
  {
    const player = setupPlayer();
    skipper.enable();

    let clicked1 = false;
    const ariaCountdownBtn = document.createElement('button');
    ariaCountdownBtn.className = 'ytp-ad-skip-button-modern';
    ariaCountdownBtn.setAttribute('aria-label', 'Skip ad in 5 seconds');
    ariaCountdownBtn.click = () => { clicked1 = true; };
    player.appendChild(ariaCountdownBtn);

    let clicked2 = false;
    const titleCountdownBtn = document.createElement('button');
    titleCountdownBtn.className = 'ytp-ad-skip-button-modern';
    titleCountdownBtn.setAttribute('title', 'You can skip ad in 5s');
    titleCountdownBtn.click = () => { clicked2 = true; };
    player.appendChild(titleCountdownBtn);

    // Slot wrapper with aria-label countdown and inner empty button
    let clicked3 = false;
    const slotWrap = document.createElement('div');
    slotWrap.className = 'ytp-ad-skip-button-slot';
    slotWrap.setAttribute('aria-label', 'Skip in 5s');
    const innerEmptyBtn = document.createElement('button');
    innerEmptyBtn.click = () => { clicked3 = true; };
    slotWrap.appendChild(innerEmptyBtn);
    player.appendChild(slotWrap);

    // Button with pure timestamp "0:15"
    let clicked4 = false;
    const tsBtn = document.createElement('button');
    tsBtn.className = 'ytp-ad-skip-button-modern';
    tsBtn.setAttribute('title', '0:15');
    tsBtn.click = () => { clicked4 = true; };
    player.appendChild(tsBtn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === false, `Guards successfully rejected aria-label, title, slot wrapper countdowns, and timestamps`);
    assert(clicked1 === false, `Aria countdown button was not clicked`);
    assert(clicked2 === false, `Title countdown button was not clicked`);
    assert(clicked3 === false, `Slot wrapper countdown button was not clicked`);
    assert(clicked4 === false, `Pure timestamp button was not clicked`);

    skipper.disable();
  }

  // Non-breaking space text handling
  {
    const player = setupPlayer();
    skipper.enable();

    let clicked = false;
    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip\u00A0Ad';
    btn.click = () => { clicked = true; };
    player.appendChild(btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();
    assert(res === true, `_trySkip() successfully skipped button with non-breaking spaces`);
    assert(clicked === true, `Click handler executed for non-breaking space skip button`);

    skipper.disable();
  }

  // ── TEST 3: MouseEvent Fallback & Console Logging (R2) ─────────────────────
  console.log('\n--- 3. MouseEvent Fallback & Console Logging ---');
  {
    const player = setupPlayer();
    skipper.enable();

    let mouseEventTriggered = false;
    const btn = document.createElement('button');
    btn.className = 'ytp-ad-skip-button-modern';
    btn.textContent = 'Skip';
    btn.addEventListener('click', (e) => {
      mouseEventTriggered = true;
    });
    player.appendChild(btn);

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res = skipper._trySkip();

    console.log = origLog;

    assert(res === true, `_trySkip() succeeded`);
    assert(mouseEventTriggered === true, `MouseEvent click handler was triggered`);
    assert(logs.some(l => l.includes('[GodMode] AdSkipper: ad skipped ⚡')), `Exact console log "[GodMode] AdSkipper: ad skipped ⚡" was output`);

    skipper.disable();
  }

  // ── TEST 4: Rapid Back-to-Back Ads (Ad 1 then Ad 2) ────────────────────────
  console.log('\n--- 4. Rapid Back-to-Back Skippable Ads ---');
  {
    const player = setupPlayer();
    skipper.enable();

    // Ad 1 appears
    let ad1Clicked = false;
    const ad1Btn = document.createElement('button');
    ad1Btn.className = 'ytp-ad-skip-button-modern';
    ad1Btn.textContent = 'Skip';
    ad1Btn.click = () => { ad1Clicked = true; };
    player.appendChild(ad1Btn);

    skipper._lastSkippedEl = null;
    skipper._lastSkipTime = 0;
    const res1 = skipper._trySkip();
    assert(res1 === true, `Ad 1 skipped successfully`);
    assert(ad1Clicked === true, `Ad 1 click handler executed`);

    // Remove Ad 1 element
    player.removeChild(ad1Btn);

    // Ad 2 appears — reset lastSkipTime to simulate inter-ad gap
    skipper._lastSkipTime = 0;
    let ad2Clicked = false;
    const ad2Btn = document.createElement('button');
    ad2Btn.className = 'ytp-ad-skip-button-modern';
    ad2Btn.textContent = 'Skip';
    ad2Btn.click = () => { ad2Clicked = true; };
    player.appendChild(ad2Btn);

    const res2 = skipper._trySkip();
    assert(res2 === true, `Ad 2 skipped successfully immediately after Ad 1`);
    assert(ad2Clicked === true, `Ad 2 click handler executed`);

    skipper.disable();
  }

  // ── TEST 5: Full Toggle Chain & Settings Wiring (R3) ───────────────────────
  console.log('\n--- 5. Settings, Storage, and HUD / Master Toggle Wiring ---');
  {
    // Storage default
    assert(DEFAULT_SETTINGS.autoSkipAds === true, `DEFAULT_SETTINGS.autoSkipAds is true`);
    await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS });
    const s = await StorageUtil.getSettings();
    assert(s.autoSkipAds === true, `Initial storage has autoSkipAds === true`);

    // applySettings enables / disables AdSkipper
    window.applySettings({ extensionEnabled: true, autoSkipAds: true });
    assert(skipper._enabled === true, `applySettings(autoSkipAds: true) enables AdSkipper`);

    window.applySettings({ extensionEnabled: true, autoSkipAds: false });
    assert(skipper._enabled === false, `applySettings(autoSkipAds: false) disables AdSkipper`);

    // Master toggle OFF disables AdSkipper even if autoSkipAds is true
    window.applySettings({ extensionEnabled: false, autoSkipAds: true });
    assert(skipper._enabled === false, `Master toggle OFF disables AdSkipper`);

    // HUD HeaderButton syncs #ss-toggle-auto-skip-ads
    const headerBtn = window.HeaderButton;
    headerBtn.enable();

    const hudDialog = document.createElement('div');
    hudDialog.id = 'ss-popup-dialog';
    const autoSkipToggle = document.createElement('input');
    autoSkipToggle.type = 'checkbox';
    autoSkipToggle.id = 'ss-toggle-auto-skip-ads';
    autoSkipToggle.checked = false;
    hudDialog.appendChild(autoSkipToggle);
    document.body.appendChild(hudDialog);

    await StorageUtil.updateSetting('autoSkipAds', true);
    await headerBtn.updateState();

    assert(autoSkipToggle.checked === true, `HUD popup #ss-toggle-auto-skip-ads synchronized to true`);
    assert(headerBtn.isShieldEnabled === true, `Shield status is active when autoSkipAds is true`);

    headerBtn.disable();
    hudDialog.remove();
    skipper.disable();
  }

  console.log('\n================================================================');
  console.log(`TOTAL ADVERSARIAL TESTS: ${testsPassed + testsFailed} | PASSED: ${testsPassed} | FAILED: ${testsFailed}`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runAdSkipperAdversarialSuite().catch(e => {
  console.error('Fatal in test:', e);
  process.exit(1);
});
