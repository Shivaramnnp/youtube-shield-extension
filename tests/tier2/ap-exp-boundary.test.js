/**
 * Tier 2: Feature 1 AP & EXP Engine Boundary & Corner Cases Suite
 */

require('../harness/mock-extension-env.js');
const { test, describe, assert, resetStorage } = require('../harness/test-helpers');
const GamificationEngine = require('../../utils/gamification-engine');

describe('Feature 1 Boundaries: AP & EXP Engine', () => {

  test('AP Engine: Exact boundary AP threshold rank mappings (0, 199, 200, 499, 500, 999, 1000, 1999, 2000, 3499, 3500)', async () => {
    // 0 AP -> Bronze Focus
    const rank0 = GamificationEngine.getRankTierFromAP(0);
    assert.equal(rank0.currentRank.title, 'Bronze Focus');
    assert.equal(rank0.tierProgressPct, 0);

    // 199 AP -> Bronze Focus (highest point in tier)
    const rank199 = GamificationEngine.getRankTierFromAP(199);
    assert.equal(rank199.currentRank.title, 'Bronze Focus');
    assert.equal(rank199.tierProgressPct, 99);

    // 200 AP -> Silver Scholar (threshold boundary)
    const rank200 = GamificationEngine.getRankTierFromAP(200);
    assert.equal(rank200.currentRank.title, 'Silver Scholar');
    assert.equal(rank200.tierProgressPct, 0);

    // 499 AP -> Silver Scholar
    const rank499 = GamificationEngine.getRankTierFromAP(499);
    assert.equal(rank499.currentRank.title, 'Silver Scholar');
    assert.equal(rank499.tierProgressPct, 99);

    // 500 AP -> Gold Mastermind
    const rank500 = GamificationEngine.getRankTierFromAP(500);
    assert.equal(rank500.currentRank.title, 'Gold Mastermind');
    assert.equal(rank500.tierProgressPct, 0);

    // 999 AP -> Gold Mastermind
    const rank999 = GamificationEngine.getRankTierFromAP(999);
    assert.equal(rank999.currentRank.title, 'Gold Mastermind');
    assert.equal(rank999.tierProgressPct, 99);

    // 1000 AP -> Diamond Warrior
    const rank1000 = GamificationEngine.getRankTierFromAP(1000);
    assert.equal(rank1000.currentRank.title, 'Diamond Warrior');
    assert.equal(rank1000.tierProgressPct, 0);

    // 1999 AP -> Diamond Warrior
    const rank1999 = GamificationEngine.getRankTierFromAP(1999);
    assert.equal(rank1999.currentRank.title, 'Diamond Warrior');
    assert.equal(rank1999.tierProgressPct, 99);

    // 2000 AP -> Heroic Monk
    const rank2000 = GamificationEngine.getRankTierFromAP(2000);
    assert.equal(rank2000.currentRank.title, 'Heroic Monk');
    assert.equal(rank2000.tierProgressPct, 0);

    // 3499 AP -> Heroic Monk
    const rank3499 = GamificationEngine.getRankTierFromAP(3499);
    assert.equal(rank3499.currentRank.title, 'Heroic Monk');
    assert.equal(rank3499.tierProgressPct, 99);

    // 3500 AP -> Grandmaster Legend (Max tier boundary)
    const rank3500 = GamificationEngine.getRankTierFromAP(3500);
    assert.equal(rank3500.currentRank.title, 'Grandmaster Legend');
    assert.equal(rank3500.tierProgressPct, 100);
    assert.equal(rank3500.isMaxRank, true);
  });

  test('AP Engine: Negative, invalid, and corrupted AP values handling', async () => {
    // Negative AP clamped to 0 AP / Bronze Focus
    const negRank = GamificationEngine.getRankTierFromAP(-100);
    assert.equal(negRank.currentRank.title, 'Bronze Focus');
    assert.equal(negRank.tierProgressPct, 0);

    // Null/undefined AP
    const nullRank = GamificationEngine.getRankTierFromAP(null);
    assert.equal(nullRank.currentRank.title, 'Bronze Focus');

    const undefRank = GamificationEngine.getRankTierFromAP(undefined);
    assert.equal(undefRank.currentRank.title, 'Bronze Focus');

    // NaN AP
    const nanRank = GamificationEngine.getRankTierFromAP(NaN);
    assert.equal(nanRank.currentRank.title, 'Bronze Focus');
  });

  test('EXP Engine: Zero EXP handling and minimum Level 1 base', async () => {
    const lvl0 = GamificationEngine.calculateLevelFromEXP(0);
    assert.equal(lvl0.level, 1);
    assert.equal(lvl0.progressPct, 0);
    assert.equal(lvl0.expInCurrentLevel, 0);

    // Negative EXP falls back to base Level 1
    const lvlNeg = GamificationEngine.calculateLevelFromEXP(-500);
    assert.equal(lvlNeg.level, 1);
    assert.equal(lvlNeg.progressPct, 0);
  });

  test('EXP Engine: Level progress calculation with badge and learning time EXP', async () => {
    // 1 badge (first_step: 500 EXP) + 600s learning time (100 EXP) = 600 EXP total
    const totalExp = GamificationEngine.calculateTotalEXP(['first_step'], 600);
    assert.equal(totalExp, 600);

    const lvlInfo = GamificationEngine.calculateLevelFromEXP(totalExp);
    assert.ok(lvlInfo.level >= 1);
    assert.ok(lvlInfo.progressPct >= 0 && lvlInfo.progressPct <= 100);
  });

  test('AP & EXP Engine: Unlocked badge array edge cases (empty array, null, invalid IDs)', async () => {
    assert.equal(GamificationEngine.calculateTotalAP([]), 0);
    assert.equal(GamificationEngine.calculateTotalAP(null), 0);
    assert.equal(GamificationEngine.calculateTotalAP(undefined), 0);
    assert.equal(GamificationEngine.calculateTotalAP(['nonexistent_badge_xyz']), 0);

    assert.equal(GamificationEngine.calculateTotalEXP([], 0), 0);
    assert.equal(GamificationEngine.calculateTotalEXP(null, null), 0);
  });

  test('AP & EXP Engine: Accumulation with mixed valid and invalid badges', async () => {
    // 'first_step' = 50 AP, 'invalid_id' = 0 AP, 'deep_diver' = 100 AP -> total 150 AP
    const totalAP = GamificationEngine.calculateTotalAP(['first_step', 'invalid_id', 'deep_diver']);
    assert.equal(totalAP, 150);

    const rank = GamificationEngine.getRankTierFromAP(totalAP);
    assert.equal(rank.currentRank.title, 'Bronze Focus');
  });

});
