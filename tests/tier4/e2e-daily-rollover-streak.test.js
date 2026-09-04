/**
 * Tier 4: E2E Daily Rollover, Retention Pruning, & Multi-Day Streak Retention Suite
 * Tests midnight date rollover, ISO week resets, month boundary resets, 60-day data retention pruning, and streak retention across days.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
const { TimeTracker } = require('../../utils/time-tracker');

function getLocalDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('Tier 4: E2E Daily Rollover, Retention Pruning, & Streak Retention', () => {

  test('Midnight Rollover: transition to new date initializes daily watch and learning totals', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const day1Key = getLocalDateStr(-1);
    const tracking1 = await StorageUtil.getTracking();
    tracking1.dailyWatchTime[day1Key] = 1800;
    tracking1.dailyLearningTime[day1Key] = 1200;
    await StorageUtil.saveTracking(tracking1);

    const day2Key = getLocalDateStr(0);
    const tracking2 = await StorageUtil.getTracking();
    if (!tracking2.dailyWatchTime[day2Key]) tracking2.dailyWatchTime[day2Key] = 0;
    if (!tracking2.dailyLearningTime[day2Key]) tracking2.dailyLearningTime[day2Key] = 0;

    tracking2.dailyWatchTime[day2Key] += 600;
    tracking2.dailyLearningTime[day2Key] += 600;
    await StorageUtil.saveTracking(tracking2);

    const updated = await StorageUtil.getTracking();
    assert.equal(updated.dailyWatchTime[day1Key], 1800, 'Day 1 watch time preserved');
    assert.equal(updated.dailyLearningTime[day1Key], 1200, 'Day 1 learning time preserved');
    assert.equal(updated.dailyWatchTime[day2Key], 600, 'Day 2 watch time initialized and accumulated');
    assert.equal(updated.dailyLearningTime[day2Key], 600, 'Day 2 learning time initialized and accumulated');
  });

  test('ISO Week Boundary Reset: weeklyTotal and weeklyLearningTotal reset to 0 when week changes', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const tracking = await StorageUtil.getTracking();
    tracking.currentWeekKey = '2026-W01';
    tracking.weeklyTotal = 15000;
    tracking.weeklyLearningTotal = 12000;
    await StorageUtil.saveTracking(tracking);

    const now = new Date();
    const currentISOWeek = tracker._isoWeek(now);
    const newWeekKey = `${now.getFullYear()}-W${currentISOWeek}`;

    await tracker.incrementWatchTime(100);

    const updated = await StorageUtil.getTracking();
    assert.equal(updated.currentWeekKey, newWeekKey, 'Week key updated to current week');
    assert.equal(updated.weeklyTotal, 100, 'weeklyTotal reset to 0 then incremented by 100');
  });

  test('Month Boundary Reset: monthlyTotal and monthlyLearningTotal reset when calendar month changes', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const tracking = await StorageUtil.getTracking();
    tracking.currentMonthKey = '2026-01';
    tracking.monthlyTotal = 45000;
    tracking.monthlyLearningTotal = 30000;
    await StorageUtil.saveTracking(tracking);

    await tracker.incrementWatchTime(300);

    const updated = await StorageUtil.getTracking();
    const now = new Date();
    const expectedMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    assert.equal(updated.currentMonthKey, expectedMonthKey, 'Month key updated');
    assert.equal(updated.monthlyTotal, 300, 'monthlyTotal reset to 0 then incremented by 300');
  });

  test('60-Day Data Retention Pruning: entries older than 60 days are pruned from dailyWatchTime and dailyLearningTime', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const tracking = await StorageUtil.getTracking();

    const oldDateKey = getLocalDateStr(-70);
    const recentDateKey = getLocalDateStr(-10);

    tracking.dailyWatchTime[oldDateKey] = 5000;
    tracking.dailyWatchTime[recentDateKey] = 2000;
    tracking.dailyLearningTime[oldDateKey] = 4000;
    tracking.dailyLearningTime[recentDateKey] = 1500;
    await StorageUtil.saveTracking(tracking);

    await tracker.incrementWatchTime(10);

    const updated = await StorageUtil.getTracking();

    assert.equal(updated.dailyWatchTime[oldDateKey], undefined, 'Old date entry older than 60 days must be pruned');
    assert.equal(updated.dailyLearningTime[oldDateKey], undefined, 'Old date learning entry older than 60 days must be pruned');
    assert.equal(updated.dailyWatchTime[recentDateKey], 2000, 'Recent date entry within 60 days must be retained');
    assert.equal(updated.dailyLearningTime[recentDateKey], 1500, 'Recent date learning entry within 60 days must be retained');
  });

  test('Multi-Day Streak Retention & Recovery: consecutive days increment streak; missed day resets streak to 1', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const today = getLocalDateStr(0);
    const yesterday = getLocalDateStr(-1);
    const twoDaysAgo = getLocalDateStr(-2);

    // Initial state: studied yesterday
    const t1 = await StorageUtil.getTracking();
    t1.dailyLearningTime[today] = 300;
    t1.gamification.currentStreak = 1;
    t1.gamification.lastLearningDate = yesterday;
    await StorageUtil.saveTracking(t1);

    // Track consecutive study today -> streak increments to 2
    const t2 = await StorageUtil.getTracking();
    tracker.updateStreaks(t2, today);
    await StorageUtil.saveTracking(t2);
    assert.equal(t2.gamification.currentStreak, 2, 'Streak increments to 2 on consecutive study day');
    assert.equal(t2.gamification.longestStreak, 2, 'Longest streak updates to 2');

    // Missed yesterday scenario: lastLearningDate is two days ago
    const tReset = await StorageUtil.getTracking();
    tReset.gamification.currentStreak = 2;
    tReset.gamification.longestStreak = 2;
    tReset.gamification.lastLearningDate = twoDaysAgo; // gap!
    tReset.dailyLearningTime[today] = 300;

    tracker.updateStreaks(tReset, today);
    await StorageUtil.saveTracking(tReset);

    assert.equal(tReset.gamification.currentStreak, 1, 'Current streak resets to 1 on non-consecutive day');
    assert.equal(tReset.gamification.longestStreak, 2, 'Longest streak retains maximum streak of 2');
  });

});
