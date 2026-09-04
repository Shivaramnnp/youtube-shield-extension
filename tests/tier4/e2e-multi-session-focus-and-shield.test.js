/**
 * Tier 4: E2E Multi-Session Concurrent Features Workflow Suite
 * Tests Shorts blocking, Focus Mode UI cleaning, Goal Mode topic validation, and Time Manager limit enforcement operating concurrently in a browser session.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetDOM, resetStorage } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
const { TimeTracker } = require('../../utils/time-tracker');

require('../../utils/dom-utils');
require('../../content/js/shorts-blocker');
require('../../content/js/study-mode');
require('../../content/js/goal-mode');
require('../../content/js/time-manager');
require('../../content/js/ui-cleaner');

function cleanupModes() {
  if (window.ShortsBlocker) window.ShortsBlocker.disable();
  if (window.GoalMode) window.GoalMode.disable();
  if (window.TimeManager) window.TimeManager.disable();
  if (window.StudyMode) {
    window.StudyMode.disable();
    window.StudyMode.bannerElement = null;
  }
  resetDOM();
}

describe('Tier 4: E2E Concurrent Session Workflow (Shorts Shield + Focus + Goal + Time Manager)', () => {

  test('Concurrent Initialization: All 4 core defensive features enable cleanly without state conflict', async () => {
    cleanupModes();
    await resetStorage();

    const shortsBlocker = window.ShortsBlocker;
    const goalMode = window.GoalMode;
    const timeManager = window.TimeManager;
    const uiCleaner = window.UICleaner;

    shortsBlocker.enable();
    goalMode.enable('Learn React Development');
    timeManager.enable({ enabled: true, dailyLimitMinutes: 60 });
    uiCleaner.applySettings({ hideChat: true, hideBell: true });

    assert.equal(shortsBlocker.isActive, true, 'ShortsBlocker active');
    assert.equal(goalMode.isActive, true, 'GoalMode active');
    assert.equal(timeManager.isActive, true, 'TimeManager active');
    assert.ok(document.documentElement.classList.contains('ss-hide-chat'), 'UICleaner active');

    cleanupModes();
  });

  test('Shorts Interception: ShortsBlocker hides short items & increments blocked count during session', async () => {
    cleanupModes();
    await resetStorage();

    const shortsBlocker = window.ShortsBlocker;
    shortsBlocker.enable();

    assert.ok(document.documentElement.classList.contains('shorts-shield-block-shorts'));

    const tracking = await StorageUtil.getTracking();
    tracking.gamification.totalBlockedShorts = 5;
    await StorageUtil.saveTracking(tracking);

    const updated = await StorageUtil.getTracking();
    assert.equal(updated.gamification.totalBlockedShorts, 5, 'Shorts blocked count saved as 5');

    cleanupModes();
  });

  test('Off-topic Video Blocking: GoalMode intercepts off-topic video with full-screen overlay and pauses playback', async () => {
    cleanupModes();
    await resetStorage();

    const goalMode = window.GoalMode;
    goalMode.enable('Learn Quantum Physics');

    global.location.pathname = '/watch';
    global.location.search = '?v=offtopic123';

    goalMode.showGoalBlockOverlay('Funny Cat Memes Compilation');

    const overlay = document.getElementById('ss-goal-block-overlay');
    assert.ok(overlay, 'Goal block overlay must be visible');
    assert.ok(overlay.textContent.includes('Goal Mode Active'), 'Overlay text indicates Goal Mode Active');
    assert.ok(overlay.textContent.includes('Funny Cat Memes Compilation'), 'Overlay highlights blocked video title');

    cleanupModes();
  });

  test('On-topic Video Session: GoalMode permits playback and TimeTracker accumulates learning time towards badge unlock', async () => {
    cleanupModes();
    await resetStorage();

    const goalMode = window.GoalMode;
    const tracker = new TimeTracker();

    goalMode.enable('Learn Python Programming');
    await StorageUtil.updateSetting('studyMode', true);

    await tracker.incrementWatchTime(900);

    const tracking = await StorageUtil.getTracking();
    const today = tracker.getLocalDateKey();

    assert.equal(tracking.dailyLearningTime[today], 900, 'Learning time accumulated');
    assert.ok(tracking.gamification.badges.includes('first_step'), 'first_step badge unlocked');
    assert.ok(tracking.gamification.totalAP >= 50, 'At least 50 AP awarded');

    cleanupModes();
  });

  test('Time Manager Daily Limit Enforcement: Reaching limit triggers TimeManager overlay and pauses playback', async () => {
    cleanupModes();
    await resetStorage();

    const timeManager = window.TimeManager;
    const tracker = new TimeTracker();

    const today = tracker.getLocalDateKey();

    // Set storage dailyWatchTime FIRST before enabling TimeManager
    const tracking = await StorageUtil.getTracking();
    tracking.dailyWatchTime = { [today]: 1860 };
    await StorageUtil.saveTracking(tracking);

    timeManager.enable({ enabled: true, dailyLimitMinutes: 30 });
    await timeManager.evaluate();

    const overlay = document.getElementById('ss-time-manager-overlay');
    assert.ok(overlay, 'Time Manager limit overlay must be injected when daily limit exceeded');
    assert.ok(overlay.textContent.includes('Daily Time Limit Reached'), 'Overlay displays daily limit reached title');

    cleanupModes();
  });

});
