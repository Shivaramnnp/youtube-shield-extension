/**
 * Tier 1 Test Suite: Feature 6 - Focus & Minimal UI Cleaner (focus-minimal-ui.test.js)
 * Tests Focus Mode session triggers, minimal mode styling injection, and the 7 UI Cleaner toggles.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetDOM, resetStorage } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');

require('../../utils/dom-utils');
require('../../content/js/focus-mode');
require('../../content/js/ui-cleaner');

describe('Feature 6: Focus Mode & Minimal UI Cleaner', () => {

  test('F6.1: FocusMode.enable() injects shorts-shield-focus-mode class', async () => {
    await resetDOM();
    const fm = window.FocusMode;

    fm.enable();
    assert.equal(fm.isActive, true, 'FocusMode isActive is true');

    const hasClass = (global.document.documentElement && global.document.documentElement.classList.contains('shorts-shield-focus-mode')) ||
                     (global.document.body && global.document.body.classList.contains('shorts-shield-focus-mode'));
    assert.ok(hasClass, 'Document root or body contains "shorts-shield-focus-mode" class');

    fm.disable();
  });

  test('F6.2: FocusMode.disable() removes shorts-shield-focus-mode class', async () => {
    await resetDOM();
    const fm = window.FocusMode;

    fm.enable();
    fm.disable();

    assert.equal(fm.isActive, false, 'FocusMode isActive is false');
    const hasClass = (global.document.documentElement && global.document.documentElement.classList.contains('shorts-shield-focus-mode')) ||
                     (global.document.body && global.document.body.classList.contains('shorts-shield-focus-mode'));
    assert.ok(!hasClass, 'Document root and body no longer contain "shorts-shield-focus-mode" class');
  });

  test('F6.3: UICleaner.applySettings() applies all 7 CSS toggle classes correctly', async () => {
    await resetDOM();
    const cleaner = window.UICleaner;

    const allTrueSettings = {
      hideBell: true,
      hideSubCount: true,
      hideChat: true,
      hideTrending: true,
      hideExplore: true,
      hideMiniPlayer: true,
      hideAutoplay: true
    };

    cleaner.applySettings(allTrueSettings);

    const docClass = (cls) => (global.document.documentElement && global.document.documentElement.classList.contains(cls)) ||
                             (global.document.body && global.document.body.classList.contains(cls));

    assert.ok(docClass('ss-hide-bell'), 'ss-hide-bell applied');
    assert.ok(docClass('ss-hide-sub-count'), 'ss-hide-sub-count applied');
    assert.ok(docClass('ss-hide-chat'), 'ss-hide-chat applied');
    assert.ok(docClass('ss-hide-trending'), 'ss-hide-trending applied');
    assert.ok(docClass('ss-hide-explore'), 'ss-hide-explore applied');
    assert.ok(docClass('ss-hide-mini-player'), 'ss-hide-mini-player applied');
    assert.ok(docClass('ss-hide-autoplay'), 'ss-hide-autoplay applied');
  });

  test('F6.4: UICleaner.updateSetting() dynamically toggles individual UI cleaner classes', async () => {
    await resetDOM();
    const cleaner = window.UICleaner;

    const docClass = (cls) => (global.document.documentElement && global.document.documentElement.classList.contains(cls)) ||
                             (global.document.body && global.document.body.classList.contains(cls));

    // Enable hideBell
    cleaner.updateSetting('hideBell', true);
    assert.ok(docClass('ss-hide-bell'), 'ss-hide-bell enabled');

    // Disable hideBell
    cleaner.updateSetting('hideBell', false);
    assert.ok(!docClass('ss-hide-bell'), 'ss-hide-bell disabled');

    // Enable hideChat
    cleaner.updateSetting('hideChat', true);
    assert.ok(docClass('ss-hide-chat'), 'ss-hide-chat enabled');
  });

  test('F6.5: StorageUtil.updateUICleanerSetting updates storage for UI Cleaner toggles', async () => {
    await resetStorage();

    await StorageUtil.updateUICleanerSetting('hideTrending', false);
    await StorageUtil.updateUICleanerSetting('hideMiniPlayer', true);

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.uiCleaner.hideTrending, false, 'hideTrending updated in storage');
    assert.equal(settings.uiCleaner.hideMiniPlayer, true, 'hideMiniPlayer updated in storage');
  });

  test('F6.6: UICleaner safely handles null, undefined, or empty settings objects', async () => {
    await resetDOM();
    const cleaner = window.UICleaner;

    // Should not throw or crash on null/undefined input
    cleaner.applySettings(null);
    cleaner.applySettings(undefined);
    cleaner.applySettings({});

    assert.ok(true, 'UICleaner handled null and empty settings gracefully');
  });

});
