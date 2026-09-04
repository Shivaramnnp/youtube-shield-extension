/**
 * Tier 3: TimeTracker Engine & UI Cleaner Pairwise Interaction Test Suite
 * Validates active time recording and storage flushes during video playback while YouTube UI distraction elements are hidden by UICleaner CSS classes.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetDOM, resetStorage } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
const { TimeTracker } = require('../../utils/time-tracker');
require('../../content/js/ui-cleaner');

describe('Tier 3: TimeTracker Engine & UI Cleaner CSS Interaction', () => {

  test('Active UICleaner CSS classes applied on DOM do not interfere with TimeTracker playback monitoring', async () => {
    resetDOM();
    await resetStorage();

    const cleaner = window.UICleaner;
    const tracker = new TimeTracker();

    const uiSettings = {
      hideBell: true,
      hideSubCount: true,
      hideChat: true,
      hideTrending: true,
      hideExplore: true,
      hideMiniPlayer: true,
      hideAutoplay: true
    };
    cleaner.applySettings(uiSettings);

    assert.ok(document.documentElement.classList.contains('ss-hide-bell'), 'ss-hide-bell class attached');
    assert.ok(document.documentElement.classList.contains('ss-hide-chat'), 'ss-hide-chat class attached');
    assert.ok(document.documentElement.classList.contains('ss-hide-trending'), 'ss-hide-trending class attached');

    await tracker.incrementWatchTime(30);

    const tracking = await StorageUtil.getTracking();
    const today = tracker.getLocalDateKey();

    assert.equal(tracking.dailyWatchTime[today], 30, 'TimeTracker accumulated 30s watch time while UI Cleaner active');
  });

  test('Dynamically toggling UICleaner settings during video playback preserves active session time', async () => {
    resetDOM();
    await resetStorage();

    const cleaner = window.UICleaner;
    const tracker = new TimeTracker();

    cleaner.applySettings({ hideChat: true, hideBell: false });

    await tracker.incrementWatchTime(60);

    cleaner.updateSetting('hideBell', true);
    cleaner.updateSetting('hideChat', false);

    assert.ok(document.documentElement.classList.contains('ss-hide-bell'), 'ss-hide-bell turned on');
    assert.equal(document.documentElement.classList.contains('ss-hide-chat'), false, 'ss-hide-chat turned off');

    await tracker.incrementWatchTime(60);

    const tracking = await StorageUtil.getTracking();
    const today = tracker.getLocalDateKey();

    assert.equal(tracking.dailyWatchTime[today], 120, 'TimeTracker total must be 120s across dynamic UI Cleaner toggles');
  });

  test('TimeTracker checkVideoState queries video element correctly when UI Cleaner hides surrounding DOM elements', async () => {
    resetDOM();
    await resetStorage();

    const cleaner = window.UICleaner;
    cleaner.applySettings({ hideChat: true, hideTrending: true, hideAutoplay: true });

    const video = document.createElement('video');
    video.paused = false;
    video.ended = false;
    document.body.appendChild(video);

    const tracker = new TimeTracker();
    assert.equal(tracker.activeTime, 0);

    global.document.hidden = false;
    await tracker.checkVideoState();

    assert.equal(tracker.activeTime, 1, 'activeTime incremented by 1');
  });

  test('Study Mode learning time accumulates and unlocks badges while UI Cleaner hides distraction elements', async () => {
    resetDOM();
    await resetStorage();

    const cleaner = window.UICleaner;
    const tracker = new TimeTracker();

    cleaner.applySettings({ hideBell: true, hideChat: true, hideExplore: true });

    await StorageUtil.updateSetting('studyMode', true);

    await tracker.incrementWatchTime(900);

    const tracking = await StorageUtil.getTracking();
    const today = tracker.getLocalDateKey();

    assert.equal(tracking.dailyLearningTime[today], 900, 'Learning time recorded as 900s');
    assert.ok(tracking.gamification.badges.includes('first_step'), 'first_step badge unlocked during UI Cleaner session');
    assert.ok(tracking.gamification.totalAP >= 50, 'At least 50 AP awarded for unlocks');
  });

  test('Full UI Cleaner teardown restores clean DOM without affecting recorded time totals', async () => {
    resetDOM();
    await resetStorage();

    const cleaner = window.UICleaner;
    const tracker = new TimeTracker();

    cleaner.applySettings({
      hideBell: true, hideSubCount: true, hideChat: true,
      hideTrending: true, hideExplore: true, hideMiniPlayer: true, hideAutoplay: true
    });

    await tracker.incrementWatchTime(180);

    cleaner.applySettings({
      hideBell: false, hideSubCount: false, hideChat: false,
      hideTrending: false, hideExplore: false, hideMiniPlayer: false, hideAutoplay: false
    });

    assert.equal(document.documentElement.classList.contains('ss-hide-bell'), false);
    assert.equal(document.documentElement.classList.contains('ss-hide-chat'), false);

    const tracking = await StorageUtil.getTracking();
    const today = tracker.getLocalDateKey();
    assert.equal(tracking.dailyWatchTime[today], 180, '180s watch time preserved after UI Cleaner teardown');
  });

});
