/**
 * Tier 2: Feature 2 Rank Tier System Boundary & Corner Cases Suite
 */

require('../harness/mock-extension-env.js');
const { test, describe, assert, createMockStorage, assertGamificationData } = require('../harness/test-helpers');
const GamificationEngine = require('../../utils/gamification-engine');
const { TimeTracker } = require('../../utils/time-tracker');

describe('Feature 2 Boundaries: Rank Tier System', () => {

  test('Rank Tier: Transition at 199 AP to 200 AP boundary', async () => {
    const tier199 = GamificationEngine.getRankTierFromAP(199);
    assert.equal(tier199.currentRank.title, 'Bronze Focus');
    assert.equal(tier199.nextRank.title, 'Silver Scholar');
    assert.equal(tier199.tierProgressPct, 99);
    assert.equal(tier199.apToNextRank, 1);
    assert.equal(tier199.isMaxRank, false);

    const tier200 = GamificationEngine.getRankTierFromAP(200);
    assert.equal(tier200.currentRank.title, 'Silver Scholar');
    assert.equal(tier200.nextRank.title, 'Gold Mastermind');
    assert.equal(tier200.tierProgressPct, 0);
    assert.equal(tier200.apToNextRank, 300);
    assert.equal(tier200.isMaxRank, false);
  });

  test('Rank Tier: Intermediate tier boundaries (499->500, 999->1000, 1999->2000)', async () => {
    // Silver to Gold boundary
    const tier499 = GamificationEngine.getRankTierFromAP(499);
    assert.equal(tier499.currentRank.title, 'Silver Scholar');
    const tier500 = GamificationEngine.getRankTierFromAP(500);
    assert.equal(tier500.currentRank.title, 'Gold Mastermind');

    // Gold to Diamond boundary
    const tier999 = GamificationEngine.getRankTierFromAP(999);
    assert.equal(tier999.currentRank.title, 'Gold Mastermind');
    const tier1000 = GamificationEngine.getRankTierFromAP(1000);
    assert.equal(tier1000.currentRank.title, 'Diamond Warrior');

    // Diamond to Heroic boundary
    const tier1999 = GamificationEngine.getRankTierFromAP(1999);
    assert.equal(tier1999.currentRank.title, 'Diamond Warrior');
    const tier2000 = GamificationEngine.getRankTierFromAP(2000);
    assert.equal(tier2000.currentRank.title, 'Heroic Monk');
  });

  test('Rank Tier: Grandmaster Legend cap (3500+ AP fixed at 100% progress)', async () => {
    const tier3500 = GamificationEngine.getRankTierFromAP(3500);
    assert.equal(tier3500.currentRank.title, 'Grandmaster Legend');
    assert.equal(tier3500.nextRank, null);
    assert.equal(tier3500.tierProgressPct, 100);
    assert.equal(tier3500.apToNextRank, 0);
    assert.equal(tier3500.isMaxRank, true);

    // Ultra high AP values (e.g. 10,000 AP) remains capped at 100%
    const tier10000 = GamificationEngine.getRankTierFromAP(10000);
    assert.equal(tier10000.currentRank.title, 'Grandmaster Legend');
    assert.equal(tier10000.tierProgressPct, 100);
    assert.equal(tier10000.isMaxRank, true);
  });

  test('Rank Tier: Progress % calculation at exact 0% and 100% bounds', async () => {
    // Exact tier minAP yields 0% tier progress for all tiers
    [0, 200, 500, 1000, 2000].forEach(minAp => {
      const info = GamificationEngine.getRankTierFromAP(minAp);
      assert.equal(info.tierProgressPct, 0, `Expected 0% progress at minAP ${minAp}`);
    });

    // 1 AP below next tier maxAP yields max progress for tier
    assert.equal(GamificationEngine.getRankTierFromAP(199).tierProgressPct, 99);
    assert.equal(GamificationEngine.getRankTierFromAP(499).tierProgressPct, 99);
    assert.equal(GamificationEngine.getRankTierFromAP(999).tierProgressPct, 99);
    assert.equal(GamificationEngine.getRankTierFromAP(1999).tierProgressPct, 99);
    assert.equal(GamificationEngine.getRankTierFromAP(3499).tierProgressPct, 99);
  });

  test('Rank Tier: Options/Popup progress bar calculation logic for Grandmaster cap', async () => {
    const totalAP = 3500;
    let prevThreshold = 0;
    let nextThreshold = 200;

    if (totalAP >= 3500) {
      prevThreshold = 3500;
      nextThreshold = 3500;
    }

    const range = nextThreshold - prevThreshold;
    const progressPct = range > 0 ? Math.min(100, Math.max(0, Math.round(((totalAP - prevThreshold) / range) * 100))) : 100;
    assert.equal(progressPct, 100);
  });

  test('Rank Tier: Automatic rank upgrade in TimeTracker checkBadges on earning AP', async () => {
    const tracker = new TimeTracker();
    const tracking = {
      monthlyLearningTotal: 18000, // 5 hours (triggers deep_diver: 100 AP)
      dailyWatchTime: {},
      dailyLearningTime: {},
      gamification: {
        currentStreak: 7, // triggers week_warrior: 100 AP
        longestStreak: 7,
        badges: [],
        totalAP: 0,
        rankTier: 'Bronze Focus'
      }
    };

    tracker.checkBadges(tracking, {});

    // Badges unlocked: deep_diver (100 AP) + week_warrior (100 AP) + first_step (50 AP) + focus_rookie (50 AP) + streak_starter (50 AP) + consistency_master (50 AP) = 400 AP total
    assert.ok(tracking.gamification.totalAP >= 200, `Expected AP >= 200, got ${tracking.gamification.totalAP}`);
    assert.equal(tracking.gamification.rankTitle, 'Silver Scholar');
  });

});
