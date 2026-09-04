/**
 * Tier 1 Test Suite: Feature 2 - Rank Tier System (rank-tier-system.test.js)
 * Tests automatic rank tier assignment for Bronze Focus, Silver Scholar, Gold Mastermind,
 * Diamond Warrior, Heroic Monk, and Grandmaster Legend, plus tier progression percentages.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, createMockStorage } = require('../harness/test-helpers');
const GamificationEngine = require('../../utils/gamification-engine');
const { StorageUtil } = require('../../utils/storage');
const { TimeTracker } = require('../../utils/time-tracker');

describe('Feature 2: PUBG/Free Fire Rank Tier System', () => {

  test('F2.1: Bronze Focus rank assignment for 0 - 199 AP', async () => {
    const rank0 = GamificationEngine.getRankTierFromAP(0);
    assert.equal(rank0.currentRank.id, 'bronze_focus');
    assert.equal(rank0.currentRank.title, 'Bronze Focus');
    assert.equal(rank0.currentRank.icon, '🥉');
    assert.equal(rank0.isMaxRank, false);

    const rank150 = GamificationEngine.getRankTierFromAP(150);
    assert.equal(rank150.currentRank.id, 'bronze_focus');
    assert.equal(rank150.currentRank.title, 'Bronze Focus');
    assert.equal(rank150.nextRank.id, 'silver_scholar');
  });

  test('F2.2: Silver Scholar (200-499 AP) and Gold Mastermind (500-999 AP) rank assignments', async () => {
    const silver200 = GamificationEngine.getRankTierFromAP(200);
    assert.equal(silver200.currentRank.id, 'silver_scholar');
    assert.equal(silver200.currentRank.title, 'Silver Scholar');
    assert.equal(silver200.currentRank.icon, '🥈');

    const silver499 = GamificationEngine.getRankTierFromAP(499);
    assert.equal(silver499.currentRank.id, 'silver_scholar');

    const gold500 = GamificationEngine.getRankTierFromAP(500);
    assert.equal(gold500.currentRank.id, 'gold_mastermind');
    assert.equal(gold500.currentRank.title, 'Gold Mastermind');
    assert.equal(gold500.currentRank.icon, '🥇');

    const gold999 = GamificationEngine.getRankTierFromAP(999);
    assert.equal(gold999.currentRank.id, 'gold_mastermind');
  });

  test('F2.3: Diamond Warrior (1000-1999 AP) and Heroic Monk (2000-3499 AP) rank assignments', async () => {
    const diamond1000 = GamificationEngine.getRankTierFromAP(1000);
    assert.equal(diamond1000.currentRank.id, 'diamond_warrior');
    assert.equal(diamond1000.currentRank.title, 'Diamond Warrior');
    assert.equal(diamond1000.currentRank.icon, '💎');

    const diamond1999 = GamificationEngine.getRankTierFromAP(1999);
    assert.equal(diamond1999.currentRank.id, 'diamond_warrior');

    const heroic2000 = GamificationEngine.getRankTierFromAP(2000);
    assert.equal(heroic2000.currentRank.id, 'heroic_monk');
    assert.equal(heroic2000.currentRank.title, 'Heroic Monk');

    const heroic3499 = GamificationEngine.getRankTierFromAP(3499);
    assert.equal(heroic3499.currentRank.id, 'heroic_monk');
  });

  test('F2.4: Grandmaster Legend rank assignment for 3500+ AP and max rank handling', async () => {
    const gm3500 = GamificationEngine.getRankTierFromAP(3500);
    assert.equal(gm3500.currentRank.id, 'grandmaster_legend');
    assert.equal(gm3500.currentRank.title, 'Grandmaster Legend');
    assert.equal(gm3500.currentRank.icon, '👑');
    assert.equal(gm3500.isMaxRank, true, '3500 AP triggers isMaxRank = true');
    assert.equal(gm3500.tierProgressPct, 100, '3500 AP has 100% progress in max rank');
    assert.equal(gm3500.nextRank, null, 'No next rank exists for Grandmaster Legend');

    const gm5000 = GamificationEngine.getRankTierFromAP(5000);
    assert.equal(gm5000.currentRank.id, 'grandmaster_legend');
    assert.equal(gm5000.isMaxRank, true);
  });

  test('F2.5: Tier progress percentage calculation across rank thresholds', async () => {
    // Bronze range 0-200. AP = 100 -> (100-0)/(200-0) = 50%
    const bronzeHalf = GamificationEngine.getRankTierFromAP(100);
    assert.equal(bronzeHalf.tierProgressPct, 50, '100 AP is 50% through Bronze Focus');

    // Silver range 200-500. AP = 350 -> (350-200)/(500-200) = 150/300 = 50%
    const silverHalf = GamificationEngine.getRankTierFromAP(350);
    assert.equal(silverHalf.tierProgressPct, 50, '350 AP is 50% through Silver Scholar');

    // Gold range 500-1000. AP = 750 -> (750-500)/(1000-500) = 250/500 = 50%
    const goldHalf = GamificationEngine.getRankTierFromAP(750);
    assert.equal(goldHalf.tierProgressPct, 50, '750 AP is 50% through Gold Mastermind');

    // Diamond range 1000-2000. AP = 1500 -> (1500-1000)/(2000-1000) = 500/1000 = 50%
    const diamondHalf = GamificationEngine.getRankTierFromAP(1500);
    assert.equal(diamondHalf.tierProgressPct, 50, '1500 AP is 50% through Diamond Warrior');
  });

  test('F2.6: Automatic rank promotion during TimeTracker badge evaluation', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const tracking = await StorageUtil.getTracking();
    // 0 AP initially -> Bronze Focus
    tracker.checkBadges(tracking);
    assert.equal(tracking.gamification.rankTier, 'Bronze Focus');

    // Simulate unlocking badges to cross 200 AP threshold (Silver Scholar)
    tracking.monthlyLearningTotal = 90000; // Unlock 5 time badges = 50+50+100+100+200 = 500 AP
    tracker.checkBadges(tracking);

    assert.equal(tracking.gamification.totalAP, 500, 'Total AP equals 500');
    assert.equal(tracking.gamification.rankTier, 'Gold Mastermind', 'Rank promotes automatically to Gold Mastermind');
    assert.equal(tracking.gamification.rankId, 'gold_mastermind');
  });

});
