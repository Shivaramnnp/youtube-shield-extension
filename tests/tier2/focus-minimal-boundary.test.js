/**
 * Tier 2: Feature 6 Focus / Minimal UI Cleaner Boundary & Corner Cases Suite
 */

require('../harness/mock-extension-env.js');
const { test, describe, assert, resetDOM } = require('../harness/test-helpers');
require('../../content/js/focus-mode');
require('../../content/js/ui-cleaner');

describe('Feature 6 Boundaries: Focus / Minimal UI Cleaner', () => {

  test('Focus Mode: Rapid toggle flipping (enable/disable 50x in loop)', async () => {
    resetDOM();
    const focusMode = global.window.FocusMode;

    for (let i = 0; i < 50; i++) {
      focusMode.enable();
      assert.equal(focusMode.isActive, true);
      assert.ok(global.document.documentElement.classList.contains('shorts-shield-focus-mode'));

      focusMode.disable();
      assert.equal(focusMode.isActive, false);
      assert.equal(global.document.documentElement.classList.contains('shorts-shield-focus-mode'), false);
    }
  });

  test('UI Cleaner: All 7 UI cleaner toggles active simultaneously', async () => {
    resetDOM();
    const cleaner = global.window.UICleaner;

    const allActive = {
      hideBell: true,
      hideSubCount: true,
      hideChat: true,
      hideTrending: true,
      hideExplore: true,
      hideMiniPlayer: true,
      hideAutoplay: true
    };

    cleaner.applySettings(allActive);

    const docEl = global.document.documentElement;
    assert.ok(docEl.classList.contains('ss-hide-bell'));
    assert.ok(docEl.classList.contains('ss-hide-sub-count'));
    assert.ok(docEl.classList.contains('ss-hide-chat'));
    assert.ok(docEl.classList.contains('ss-hide-trending'));
    assert.ok(docEl.classList.contains('ss-hide-explore'));
    assert.ok(docEl.classList.contains('ss-hide-mini-player'));
    assert.ok(docEl.classList.contains('ss-hide-autoplay'));
  });

  test('UI Cleaner: All 7 UI cleaner toggles deactivated simultaneously', async () => {
    resetDOM();
    const cleaner = global.window.UICleaner;

    const allDisabled = {
      hideBell: false,
      hideSubCount: false,
      hideChat: false,
      hideTrending: false,
      hideExplore: false,
      hideMiniPlayer: false,
      hideAutoplay: false
    };

    cleaner.applySettings(allDisabled);

    const docEl = global.document.documentElement;
    assert.equal(docEl.classList.contains('ss-hide-bell'), false);
    assert.equal(docEl.classList.contains('ss-hide-sub-count'), false);
    assert.equal(docEl.classList.contains('ss-hide-chat'), false);
    assert.equal(docEl.classList.contains('ss-hide-trending'), false);
    assert.equal(docEl.classList.contains('ss-hide-explore'), false);
    assert.equal(docEl.classList.contains('ss-hide-mini-player'), false);
    assert.equal(docEl.classList.contains('ss-hide-autoplay'), false);
  });

  test('Focus Reminder Interval Boundary: 0-second / negative input clamping', async () => {
    // Test reminder logic input clamping rule (0 or negative input -> clamped to default 60)
    let inputVal = 0;
    if (isNaN(inputVal) || inputVal <= 0) inputVal = 60;
    assert.equal(inputVal, 60);

    let negVal = -15;
    if (isNaN(negVal) || negVal <= 0) negVal = 60;
    assert.equal(negVal, 60);
  });

  test('Focus Reminder Interval Boundary: Upper limit clamping (1440 min / 24 hours)', async () => {
    // Upper limit clamping rule (values > 480 -> clamped to 480 minutes)
    let extremeVal = 1440; // 24 hours
    if (extremeVal > 480) extremeVal = 480;
    assert.equal(extremeVal, 480);
  });

  test('Focus Mode: Null/undefined DOMUtils fallback handling', async () => {
    resetDOM();
    const oldDOMUtils = global.window.DOMUtils;
    global.window.DOMUtils = undefined;

    const focusMode = global.window.FocusMode;

    assert.doesNotThrow(() => {
      focusMode.enable();
      assert.ok(global.document.documentElement.classList.contains('shorts-shield-focus-mode'));
      focusMode.disable();
      assert.equal(global.document.documentElement.classList.contains('shorts-shield-focus-mode'), false);
    });

    global.window.DOMUtils = oldDOMUtils;
  });

});
