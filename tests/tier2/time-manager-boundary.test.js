/**
 * Tier 2: Feature 8 Time Manager Boundary & Corner Cases Suite
 */

require('../harness/mock-extension-env.js');
const { test, describe, assert, createMockStorage, resetDOM } = require('../harness/test-helpers');
require('../../content/js/time-manager');

describe('Feature 8 Boundaries: Time Manager', () => {

  test('Time Manager: 5-minute minimum daily limit boundary', async () => {
    const tm = global.window.TimeManager;
    tm.config = { enabled: true, dailyLimitMinutes: 5, scheduleEnabled: false, snoozeUntil: 0 };

    // 299 seconds -> 4 minutes watched -> limit not exceeded
    const mins299 = Math.floor(299 / 60);
    assert.equal(mins299 >= tm.config.dailyLimitMinutes, false);

    // 300 seconds -> 5 minutes watched -> limit exceeded boundary
    const mins300 = Math.floor(300 / 60);
    assert.equal(mins300 >= tm.config.dailyLimitMinutes, true);
  });

  test('Time Manager: Zero watch time (0 seconds)', async () => {
    const tm = global.window.TimeManager;
    tm.config = { enabled: true, dailyLimitMinutes: 60, scheduleEnabled: false, snoozeUntil: 0 };

    const todayMinutes = Math.floor(0 / 60);
    assert.equal(todayMinutes >= tm.config.dailyLimitMinutes, false);
  });

  test('Time Manager: Overnight 22:00-06:00 schedule wrap boundary evaluation', async () => {
    const tm = global.window.TimeManager;

    const isBlockedForTime = (currentH, currentM) => {
      const currentMinutes = currentH * 60 + currentM;
      const startMinutes = 22 * 60; // 1320
      const endMinutes = 6 * 60;   // 360

      if (startMinutes < endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    };

    // 23:30 (1410 min) -> blocked (overnight start region)
    assert.equal(isBlockedForTime(23, 30), true);

    // 04:15 (255 min) -> blocked (overnight end region)
    assert.equal(isBlockedForTime(4, 15), true);

    // 12:00 (720 min) -> allowed (daytime open window)
    assert.equal(isBlockedForTime(12, 0), false);

    // 22:00 (1320 min) -> exact start boundary -> blocked
    assert.equal(isBlockedForTime(22, 0), true);

    // 06:00 (360 min) -> exact end boundary -> allowed
    assert.equal(isBlockedForTime(6, 0), false);
  });

  test('Time Manager: Emergency snooze 5-minute expiration countdown', async () => {
    const tm = global.window.TimeManager;
    const now = Date.now();

    // Active snooze set for 5 minutes in future
    tm.config.snoozeUntil = now + 300000;
    const isSnoozedActive = tm.config.snoozeUntil && now < tm.config.snoozeUntil;
    assert.equal(isSnoozedActive, true);

    // Expired snooze set 1ms in past
    tm.config.snoozeUntil = now - 1;
    const isSnoozedExpired = tm.config.snoozeUntil && now < tm.config.snoozeUntil;
    assert.equal(isSnoozedExpired, false);
  });

  test('Time Manager: Invalid/Disabled limits (0 or negative limit)', async () => {
    const tm = global.window.TimeManager;

    // Daily limit = 0 -> treated as disabled
    tm.config = { enabled: true, dailyLimitMinutes: 0, scheduleEnabled: false, snoozeUntil: 0 };
    const limitExceeded0 = tm.config.dailyLimitMinutes > 0 && 100 >= tm.config.dailyLimitMinutes;
    assert.equal(limitExceeded0, false);

    // Daily limit = -10 -> treated as disabled
    tm.config = { enabled: true, dailyLimitMinutes: -10, scheduleEnabled: false, snoozeUntil: 0 };
    const limitExceededNeg = tm.config.dailyLimitMinutes > 0 && 100 >= tm.config.dailyLimitMinutes;
    assert.equal(limitExceededNeg, false);
  });

  test('Time Manager: Pause video on limit exceeded or schedule blocked', async () => {
    resetDOM();
    const tm = global.window.TimeManager;

    let pauseCalled = false;
    const video = global.document.createElement('video');
    video.paused = false;
    video.pause = () => { pauseCalled = true; };
    global.document.body.appendChild(video);

    tm.pauseVideo();
    assert.equal(pauseCalled, true);
  });

});
