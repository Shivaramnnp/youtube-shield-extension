/**
 * Tier 3: Streak Tracking & Rank Tier AP Engine Pairwise Interaction Test Suite
 * Validates interaction between multi-day streak tracking, badge unlocks, AP accumulation, and Rank Tier promotion.
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

describe('Tier 3: Streak Tracking & Rank Tier AP Engine Interaction', () => {

  test('Daily streak progression from day 1 to day 2 unlocks streak_starter and retains Bronze Focus', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const today = getLocalDateStr(0);
    const yesterday = getLocalDateStr(-1);

    // Day 1
    const tracking1 = await StorageUtil.getTracking();
    tracking1.dailyLearningTime[yesterday] = 120;
    tracking1.gamification.currentStreak = 1;
    tracking1.gamification.lastLearningDate = yesterday;
    await StorageUtil.saveTracking(tracking1);

    // Day 2
    const tracking2 = await StorageUtil.getTracking();
    tracking2.dailyLearningTime[today] = 120;
    tracker.updateStreaks(tracking2, today);
    await StorageUtil.saveTracking(tracking2);

    assert.equal(tracking2.gamification.currentStreak, 2, 'Streak should increment to 2 on consecutive day');
    assert.ok(tracking2.gamification.badges.includes('streak_starter'), 'Expected streak_starter badge unlocked');
    assert.equal(tracking2.gamification.totalAP, 50);
    assert.equal(tracking2.gamification.rankTier, 'Bronze Focus');
  });

  test('Multi-day streak across 7 days unlocks week_warrior and triggers Silver Scholar promotion', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const today = getLocalDateStr(0);
    const yesterday = getLocalDateStr(-1);

    const tracking = await StorageUtil.getTracking();
    tracking.monthlyLearningTotal = 4200; // > 3600s -> first_step (50 AP) + focus_rookie (50 AP)
    tracking.dailyLearningTime[today] = 600;
    tracking.gamification.currentStreak = 6;
    tracking.gamification.lastLearningDate = yesterday;

    tracker.updateStreaks(tracking, today);
    await StorageUtil.saveTracking(tracking);

    const finalTracking = await StorageUtil.getTracking();
    const g = finalTracking.gamification;

    assert.equal(g.currentStreak, 7, 'Streak should reach 7 days');
    assert.ok(g.badges.includes('streak_starter'), 'Should have streak_starter');
    assert.ok(g.badges.includes('consistency_master'), 'Should have consistency_master');
    assert.ok(g.badges.includes('week_warrior'), 'Should have week_warrior');
    assert.ok(g.totalAP >= 200, `Expected totalAP >= 200, got ${g.totalAP}`);
    assert.equal(g.rankTier, 'Silver Scholar');
  });

  test('Multi-day streak to 30 days accumulates AP to trigger Gold Mastermind and Diamond Warrior ranks', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const today = getLocalDateStr(0);
    const yesterday = getLocalDateStr(-1);

    const tracking = await StorageUtil.getTracking();
    tracking.monthlyLearningTotal = 54000; // 15 hours -> first_step, focus_rookie, deep_diver, dedicated_scholar
    tracking.dailyLearningTime[today] = 1800;
    tracking.gamification.currentStreak = 29;
    tracking.gamification.lastLearningDate = yesterday;

    tracker.updateStreaks(tracking, today);
    await StorageUtil.saveTracking(tracking);

    const finalTracking = await StorageUtil.getTracking();
    const g = finalTracking.gamification;

    assert.equal(g.currentStreak, 30, 'Streak should reach 30 days');
    assert.ok(g.badges.includes('monthly_monk'), 'Should have monthly_monk');
    assert.ok(g.totalAP >= 500, `Expected totalAP >= 500, got ${g.totalAP}`);
    assert.ok(['Gold Mastermind', 'Diamond Warrior', 'Heroic Monk', 'Grandmaster Legend'].includes(g.rankTier));
  });

  test('Breaking streak resets currentStreak but retains unlocked badges, totalAP, and rank tier', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const today = getLocalDateStr(0);
    const twoDaysAgo = getLocalDateStr(-2); // missed yesterday (-1)

    const tracking = await StorageUtil.getTracking();
    tracking.gamification.currentStreak = 5;
    tracking.gamification.longestStreak = 5;
    tracking.gamification.lastLearningDate = twoDaysAgo;
    tracking.gamification.badges = ['streak_starter', 'consistency_master'];
    tracking.gamification.totalAP = 100;
    tracking.gamification.rankTier = 'Bronze Focus';
    tracking.dailyLearningTime[today] = 300;

    tracker.updateStreaks(tracking, today);
    await StorageUtil.saveTracking(tracking);

    const result = await StorageUtil.getTracking();
    const g = result.gamification;

    assert.equal(g.currentStreak, 1, 'Streak should reset to 1 after missed day');
    assert.equal(g.longestStreak, 5, 'Longest streak should stay 5');
    assert.ok(g.badges.includes('streak_starter'), 'Unlocked badge streak_starter must be retained');
    assert.equal(g.totalAP, 100, 'totalAP must not decrease');
  });

  test('Repeated checkBadges calls are idempotent and do not double count AP', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const tracking = await StorageUtil.getTracking();
    tracking.monthlyLearningTotal = 3600;
    tracker.checkBadges(tracking);
    await StorageUtil.saveTracking(tracking);

    const ap1 = tracking.gamification.totalAP;

    for (let i = 0; i < 5; i++) {
      tracker.checkBadges(tracking);
    }

    assert.equal(tracking.gamification.totalAP, ap1, 'totalAP must remain exact on repeated evaluations');
  });

});
