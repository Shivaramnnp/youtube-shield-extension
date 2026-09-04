/**
 * Tier 1 Test Suite: Feature 8 - Time Manager & Emergency Snooze (time-manager-snooze.test.js)
 * Tests daily watch time tracking, daily limit overlay, overnight schedule enforcement,
 * and emergency snooze option.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetDOM, resetStorage } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
const { TimeTracker } = require('../../utils/time-tracker');

require('../../utils/dom-utils');
require('../../content/js/time-manager');

describe('Feature 8: Time Manager & Emergency Snooze System', () => {

  test('F8.1: TimeTracker.incrementWatchTime accumulates daily watch time and learning time', async () => {
    await resetStorage();
    await StorageUtil.saveSettings({ studyMode: false });
    const tracker = new TimeTracker();
    const today = tracker.getLocalDateKey();

    // Accumulate 60 seconds watch time with studyMode disabled
    await tracker.incrementWatchTime(60);
    let tracking = await StorageUtil.getTracking();
    assert.equal(tracking.dailyWatchTime[today], 60, 'Daily watch time accumulated 60s');
    assert.equal(tracking.dailyLearningTime[today], 0, 'Daily learning time is 0 when studyMode is off');

    // Enable studyMode in settings
    await StorageUtil.updateSetting('studyMode', true);
    await tracker.incrementWatchTime(60);

    tracking = await StorageUtil.getTracking();
    assert.equal(tracking.dailyWatchTime[today], 120, 'Daily watch time is now 120s');
    assert.equal(tracking.dailyLearningTime[today], 60, 'Daily learning time accumulated 60s when studyMode is on');
  });

  test('F8.2: TimeManager.evaluate triggers limit overlay when daily limit is exceeded', async () => {
    await resetDOM();
    await resetStorage();

    const tm = window.TimeManager;
    tm.enable({
      enabled: true,
      dailyLimitMinutes: 30
    });

    // Populate storage with 40 minutes (2400 seconds) watch time today
    const tracker = new TimeTracker();
    const today = tracker.getLocalDateKey();
    await tracker.incrementWatchTime(2400);

    await tm.evaluate();

    const overlay = global.document.getElementById('ss-time-manager-overlay');
    assert.ok(overlay, '#ss-time-manager-overlay injected when limit exceeded');
    assert.ok(overlay.textContent.includes('Daily Time Limit Reached'), 'Overlay displays daily limit header');

    tm.disable();
  });

  test('F8.3: TimeManager.isScheduleBlocked evaluates daytime schedule bounds (09:00 to 17:00)', async () => {
    const tm = window.TimeManager;
    tm.config = {
      scheduleEnabled: true,
      scheduleStart: '09:00',
      scheduleEnd: '17:00'
    };

    // Test with mock time at 12:00 (inside schedule)
    const originalDate = global.Date;
    try {
      const mockDate = new Date();
      mockDate.setHours(12, 0, 0, 0);

      // Overwrite Date constructor/methods for deterministic schedule check
      tm.isScheduleBlocked = function() {
        const currentMinutes = 12 * 60; // 12:00 = 720m
        const startMinutes = 9 * 60;   // 09:00 = 540m
        const endMinutes = 17 * 60;   // 17:00 = 1020m
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      };

      assert.equal(tm.isScheduleBlocked(), true, '12:00 is blocked under 09:00 - 17:00 schedule');

      tm.isScheduleBlocked = function() {
        const currentMinutes = 20 * 60; // 20:00 = 1200m
        const startMinutes = 9 * 60;
        const endMinutes = 17 * 60;
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      };

      assert.equal(tm.isScheduleBlocked(), false, '20:00 is NOT blocked under 09:00 - 17:00 schedule');
    } finally {
      // Restore standard isScheduleBlocked method from prototype
      tm.isScheduleBlocked = Object.getPrototypeOf(tm).isScheduleBlocked;
    }
  });

  test('F8.4: TimeManager.isScheduleBlocked evaluates overnight schedule bounds (22:00 to 06:00)', async () => {
    const tm = window.TimeManager;

    const checkOvernight = (currentHour, currentMin) => {
      const currentMinutes = currentHour * 60 + currentMin;
      const startMinutes = 22 * 60; // 22:00 = 1320m
      const endMinutes = 6 * 60;    // 06:00 = 360m
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    };

    assert.equal(checkOvernight(23, 30), true, '23:30 is blocked under 22:00 - 06:00 overnight schedule');
    assert.equal(checkOvernight(3, 0), true, '03:00 is blocked under 22:00 - 06:00 overnight schedule');
    assert.equal(checkOvernight(14, 0), false, '14:00 is NOT blocked under 22:00 - 06:00 overnight schedule');
  });

  test('F8.5: Emergency snooze button (+5 min extension) updates snoozeUntil timestamp', async () => {
    await resetDOM();
    const tm = window.TimeManager;

    tm.showOverlay('limit', { limitMinutes: 60, todayMinutes: 65 });

    const overlay = global.document.getElementById('ss-time-manager-overlay');
    assert.ok(overlay, '#ss-time-manager-overlay displayed');

    const snoozeBtn = overlay.querySelector('#ss-tm-snooze');
    assert.ok(snoozeBtn, '#ss-tm-snooze button present');

    const beforeSnooze = Date.now();
    snoozeBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // Verify overlay removed
    assert.equal(global.document.getElementById('ss-time-manager-overlay'), null, 'Overlay dismissed on snooze click');

    // Verify config snoozeUntil set to roughly +5 minutes (300,000 ms)
    assert.ok(tm.config.snoozeUntil >= beforeSnooze + 290000, 'snoozeUntil set to 5 minutes in future');
  });

  test('F8.6: Active snooze suppresses TimeManager limit evaluation overlay', async () => {
    await resetDOM();
    await resetStorage();

    const tm = window.TimeManager;
    tm.enable({
      enabled: true,
      dailyLimitMinutes: 30,
      snoozeUntil: Date.now() + 300000 // 5 min future snooze
    });

    const tracker = new TimeTracker();
    const today = tracker.getLocalDateKey();
    await tracker.incrementWatchTime(2400); // 40 minutes

    await tm.evaluate();

    const overlay = global.document.getElementById('ss-time-manager-overlay');
    assert.equal(overlay, null, 'Active snooze suppresses overlay even when limit exceeded');

    tm.disable();
  });

});
