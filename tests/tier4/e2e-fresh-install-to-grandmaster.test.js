/**
 * Tier 4: E2E Fresh Install to Grandmaster Legend User Progression Journey Suite
 * Tests full multi-stage progression from fresh install (0 AP Bronze Focus) to 3500+ AP Grandmaster Legend rank.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, createMockStorage } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
const { TimeTracker } = require('../../utils/time-tracker');

describe('Tier 4: E2E Fresh Install to Grandmaster Legend Progression Journey', () => {

  test('Stage 1: Fresh Install Baseline initialized with 0 AP Bronze Focus', async () => {
    await resetStorage();
    const tracking = await StorageUtil.getTracking();
    const g = tracking.gamification;

    assert.equal(g.totalAP, 0, 'Fresh install starts with 0 AP');
    assert.equal(g.level, 1, 'Fresh install starts at Level 1');
    assert.equal(g.rankTier, 'Bronze Focus', 'Fresh install starts at Bronze Focus');
    assert.deepEqual(g.badges, [], 'Fresh install has empty badges list');
  });

  test('Stage 2: Learning & 3-day streak unlocks Silver Scholar (>= 200 AP)', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const tracking = await StorageUtil.getTracking();
    tracking.monthlyLearningTotal = 3600;
    tracking.gamification.currentStreak = 3;

    tracker.checkBadges(tracking, { studyMode: true });
    await StorageUtil.saveTracking(tracking);

    const updated = await StorageUtil.getTracking();
    const g = updated.gamification;

    assert.equal(g.totalAP, 200, 'Total AP must be 200 AP');
    assert.equal(g.rankTier, 'Silver Scholar', 'Rank must promote to Silver Scholar');
    assert.equal(g.badges.length, 4, '4 badges unlocked');
  });

  test('Stage 3: 10 Hours learning, 7-day streak, 10 Shorts blocked unlocks Gold Mastermind (>= 500 AP)', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const tracking = await StorageUtil.getTracking();
    tracking.monthlyLearningTotal = 36000;
    tracking.gamification.currentStreak = 7;
    tracking.gamification.totalBlockedShorts = 10;

    tracker.checkBadges(tracking);
    await StorageUtil.saveTracking(tracking);

    const updated = await StorageUtil.getTracking();
    const g = updated.gamification;

    assert.equal(g.totalAP, 550, 'Total AP must be 550 AP');
    assert.equal(g.rankTier, 'Gold Mastermind', 'Rank must promote to Gold Mastermind');
  });

  test('Stage 4: 50 Hours learning, 14-day streak, 100 Shorts blocked unlocks Diamond Warrior (>= 1000 AP)', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const tracking = await StorageUtil.getTracking();
    tracking.monthlyLearningTotal = 180000;
    tracking.gamification.currentStreak = 14;
    tracking.gamification.totalBlockedShorts = 100;

    tracker.checkBadges(tracking);
    await StorageUtil.saveTracking(tracking);

    const updated = await StorageUtil.getTracking();
    const g = updated.gamification;

    assert.ok(g.totalAP >= 1000, `Total AP should be >= 1000, got ${g.totalAP}`);
    assert.equal(g.rankTier, 'Diamond Warrior', 'Rank must promote to Diamond Warrior');
  });

  test('Stage 5: 100 Hours learning & 30-day streak unlocks Heroic Monk (>= 2000 AP)', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const tracking = await StorageUtil.getTracking();
    tracking.monthlyLearningTotal = 360000;
    tracking.gamification.currentStreak = 30;
    tracking.gamification.totalBlockedShorts = 100;
    tracking.gamification.highFocusStreak = 7;

    const today = tracker.getLocalDateKey();
    tracking.dailyWatchTime[today] = 1800;
    tracking.dailyLearningTime[today] = 1800;

    tracker.checkBadges(tracking);
    await StorageUtil.saveTracking(tracking);

    const updated = await StorageUtil.getTracking();
    const g = updated.gamification;

    assert.ok(g.totalAP >= 2000, `Total AP should be >= 2000, got ${g.totalAP}`);
    assert.equal(g.rankTier, 'Heroic Monk', 'Rank must promote to Heroic Monk');
  });

  test('Stage 6: Ultimate progression to 100-day streak & 900,000s learning unlocks Grandmaster Legend (3500+ AP)', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const tracking = await StorageUtil.getTracking();
    tracking.monthlyLearningTotal = 900000;
    tracking.gamification.currentStreak = 100;
    tracking.gamification.totalBlockedShorts = 500;
    tracking.gamification.highFocusStreak = 7;

    const today = tracker.getLocalDateKey();
    tracking.dailyWatchTime[today] = 1800;
    tracking.dailyLearningTime[today] = 1800;

    tracker.checkBadges(tracking);
    await StorageUtil.saveTracking(tracking);

    const updated = await StorageUtil.getTracking();
    const g = updated.gamification;

    assert.ok(g.totalAP >= 3500, `Total AP must reach Grandmaster Legend threshold (>=3500), got ${g.totalAP}`);
    assert.equal(g.rankTier, 'Grandmaster Legend', 'Rank Tier must equal Grandmaster Legend');
    assert.equal(g.rankId, 'grandmaster_legend', 'Rank ID must equal grandmaster_legend');
    assert.ok(g.level >= 10, 'Player Level must advance with high EXP');
  });

});
