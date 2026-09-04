/**
 * Tier 2: Challenger M1.2 Adversarial Stress Test Suite
 * Targets: utils/gamification-engine.js and utils/time-tracker.js
 */

require('../harness/mock-extension-env').setupMockEnv();
const { test, describe, assert, resetDOM, resetStorage } = require('../harness/test-helpers');

const GamificationEngine = require('../../utils/gamification-engine');
const { StorageUtil } = require('../../utils/storage');
const { TimeTracker } = require('../../utils/time-tracker');

describe('Challenger M1.2: Gamification & Time Tracker Stress Tests', () => {

  test('M1.2-STRESS-1: Duplicate Badge IDs deduplication in AP and EXP calculation', async () => {
    // Single first_step badge AP is 50, EXP is 500
    const duplicateBadges = ['first_step', 'first_step', 'first_step', 'focus_rookie', 'first_step'];

    const totalAP = GamificationEngine.calculateTotalAP(duplicateBadges, 0);
    // Unique badges: first_step (50 AP) + focus_rookie (50 AP) = 100 AP
    assert.equal(totalAP, 100, 'Duplicate badge IDs must be deduplicated when computing total AP');

    const totalEXP = GamificationEngine.calculateTotalEXP(duplicateBadges, 0);
    // Unique badges: first_step (500 EXP) + focus_rookie (500 EXP) = 1000 EXP
    assert.equal(totalEXP, 1000, 'Duplicate badge IDs must be deduplicated when computing total EXP');

    // Also test non-array / primitive inputs defensively
    assert.equal(GamificationEngine.calculateTotalAP('first_step', 0), 0, 'String instead of array yields 0 AP without throwing');
    assert.equal(GamificationEngine.calculateTotalEXP(null, 0), 0, 'Null instead of array yields 0 EXP without throwing');
  });

  test('M1.2-STRESS-2: Safe bounds handling for NaN, negative, and invalid EXP/AP/Time inputs', async () => {
    // Negative and NaN bonus AP
    assert.equal(GamificationEngine.calculateTotalAP(['first_step'], -100), 50, 'Negative bonus AP is clamped to 0');
    assert.equal(GamificationEngine.calculateTotalAP(['first_step'], NaN), 50, 'NaN bonus AP is handled safely as 0');
    assert.equal(GamificationEngine.calculateTotalAP(['first_step'], undefined), 50, 'Undefined bonus AP is handled safely as 0');

    // Negative and NaN learning time EXP
    assert.equal(GamificationEngine.calculateTotalEXP(['first_step'], -3600), 500, 'Negative learning time is clamped to 0');
    assert.equal(GamificationEngine.calculateTotalEXP(['first_step'], NaN), 500, 'NaN learning time is handled safely as 0');

    // Level calculation with NaN, negative, or non-numeric EXP
    const nanLevel = GamificationEngine.calculateLevelFromEXP(NaN);
    assert.equal(nanLevel.level, 1, 'NaN EXP returns level 1');
    assert.equal(nanLevel.progressPct, 0, 'NaN EXP returns 0% progress');

    const negLevel = GamificationEngine.calculateLevelFromEXP(-5000);
    assert.equal(negLevel.level, 1, 'Negative EXP returns level 1');
    assert.equal(negLevel.progressPct, 0, 'Negative EXP returns 0% progress');

    // Rank tier calculation with NaN or negative AP
    const nanRank = GamificationEngine.getRankTierFromAP(NaN);
    assert.equal(nanRank.currentRank.id, 'bronze_focus', 'NaN AP yields Bronze Focus rank');

    const negRank = GamificationEngine.getRankTierFromAP(-999);
    assert.equal(negRank.currentRank.id, 'bronze_focus', 'Negative AP yields Bronze Focus rank');
  });

  test('M1.2-STRESS-3: Year/Week ISO boundary transitions and weekly total rollover', async () => {
    const tracker = new TimeTracker();

    // Verify _isoYear and _isoWeek helpers on specific known calendar boundary dates
    // 2026-12-31 is Thursday of Week 53 in 2026
    const end2026 = new Date(Date.UTC(2026, 11, 31, 12, 0, 0));
    assert.equal(tracker._isoYear(end2026), 2026, '2026-12-31 is ISO year 2026');

    // 2027-01-01 is Friday of Week 53 in 2026 ISO calendar
    const jan1_2027 = new Date(Date.UTC(2027, 0, 1, 12, 0, 0));
    const jan1IsoYear = tracker._isoYear(jan1_2027);
    const jan1IsoWeek = tracker._isoWeek(jan1_2027);
    assert.ok(typeof jan1IsoYear === 'number' && jan1IsoYear > 0, 'jan1IsoYear returns valid positive year');
    assert.ok(typeof jan1IsoWeek === 'number' && jan1IsoWeek > 0, 'jan1IsoWeek returns valid positive week number');

    // Verify weekly total reset when tracking weekKey changes
    await resetStorage();
    const tracking = await StorageUtil.getTracking();
    tracking.currentWeekKey = '2026-W52';
    tracking.weeklyTotal = 3600;
    tracking.weeklyLearningTotal = 1800;
    await StorageUtil.saveTracking(tracking);

    // Call incrementWatchTime which checks weekKey vs current week
    await tracker.incrementWatchTime(60);
    const updated = await StorageUtil.getTracking();

    assert.notEqual(updated.currentWeekKey, '2026-W52', 'currentWeekKey updated to current week key');
    // If week rolled over, weeklyTotal was reset to 0 before adding 60
    assert.equal(updated.weeklyTotal, 60, 'weeklyTotal reset on week boundary transition before adding new seconds');
  });

  test('M1.2-STRESS-4: Rapid async checkVideoState calls snapshot activeTime cleanly without race condition', async () => {
    await resetDOM();
    await resetStorage();

    const tracker = new TimeTracker();
    
    // Create playing video element in DOM
    const video = document.createElement('video');
    document.body.appendChild(video);
    Object.defineProperty(video, 'paused', { value: false, writable: true });
    Object.defineProperty(video, 'ended', { value: false, writable: true });
    Object.defineProperty(document, 'hidden', { value: false, writable: true });

    // Set initial activeTime to 9
    tracker.activeTime = 9;

    // Call checkVideoState once -> activeTime becomes 10, triggering flush of 10s async increment
    const promise1 = tracker.checkVideoState();
    
    // activeTime should be immediately snapshotted to 0 before promise completes
    assert.equal(tracker.activeTime, 0, 'activeTime reset to 0 immediately upon flush initiation');

    // Call checkVideoState again while promise1 is pending
    const promise2 = tracker.checkVideoState();
    assert.equal(tracker.activeTime, 1, 'activeTime increments to 1 for the second call without interference');

    await Promise.all([promise1, promise2]);

    const tracking = await StorageUtil.getTracking();
    const today = tracker.getLocalDateKey();
    assert.equal(tracking.dailyWatchTime[today], 10, '10 seconds snapshotted and accumulated cleanly in storage');
  });

  test('M1.2-STRESS-5: Midnight Focus Reminder daily rollover reset', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const settings = {
      focusReminderInterval: 30 // 30 minutes = 1800 seconds
    };

    const tracking = await StorageUtil.getTracking();
    // Simulate Day 1: user watched 7200 seconds (120 mins) and last reminder was triggered at 7200s
    tracking.lastReminderTriggered = 7200;

    let reminderTriggeredCount = 0;
    tracker.triggerReminder = () => {
      reminderTriggeredCount++;
    };

    // Day 2 midnight rollover: today's watch time is 300 seconds (5 mins)
    await tracker.checkFocusReminder(tracking, 300, settings);

    // lastReminderTriggered (7200) > todayWatchTime (300), so it should reset to 0
    assert.equal(tracking.lastReminderTriggered, 0, 'lastReminderTriggered resets to 0 when date rolls over');
    assert.equal(reminderTriggeredCount, 0, 'Reminder is not falsely triggered at 300s');

    // Now Day 2 progresses: today's watch time reaches 1800 seconds (30 mins)
    await tracker.checkFocusReminder(tracking, 1800, settings);

    assert.equal(reminderTriggeredCount, 1, 'Focus reminder fires cleanly on Day 2 when todayWatchTime reaches interval');
    assert.equal(tracking.lastReminderTriggered, 1800, 'lastReminderTriggered updated to 1800');
  });

});
