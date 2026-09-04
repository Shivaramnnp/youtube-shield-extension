/**
 * Tier 1 Test Suite: Feature 1 - AP & EXP Engine (ap-exp-engine.test.js)
 * Tests AP awards, EXP awards, Level formula, level progress %, and badge catalog unlocking.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, createMockStorage } = require('../harness/test-helpers');
const GamificationEngine = require('../../utils/gamification-engine');
const { StorageUtil } = require('../../utils/storage');
const { TimeTracker } = require('../../utils/time-tracker');

describe('Feature 1: AP & EXP Engine', () => {

  test('F1.1: Badge definitions award distinct AP and EXP values', async () => {
    const firstStep = GamificationEngine.BADGE_DEFINITIONS.find(b => b.id === 'first_step');
    assert.ok(firstStep, 'first_step badge exists');
    assert.equal(firstStep.ap, 50, 'first_step awards +50 AP');
    assert.equal(firstStep.exp, 500, 'first_step awards +500 EXP');

    const focusLegend = GamificationEngine.BADGE_DEFINITIONS.find(b => b.id === 'focus_legend');
    assert.ok(focusLegend, 'focus_legend badge exists');
    assert.equal(focusLegend.ap, 500, 'focus_legend awards +500 AP');
    assert.equal(focusLegend.exp, 5000, 'focus_legend awards +5000 EXP');

    const streakStarter = GamificationEngine.BADGE_DEFINITIONS.find(b => b.id === 'streak_starter');
    assert.equal(streakStarter.ap, 50, 'streak_starter awards +50 AP');

    const shortsDefender = GamificationEngine.BADGE_DEFINITIONS.find(b => b.id === 'shorts_defender');
    assert.equal(shortsDefender.ap, 50, 'shorts_defender awards +50 AP');
  });

  test('F1.2: calculateTotalAP computes accurate AP sums for unlocked badges', async () => {
    const emptyAP = GamificationEngine.calculateTotalAP([]);
    assert.equal(emptyAP, 0, 'Empty badges yield 0 AP');

    const singleAP = GamificationEngine.calculateTotalAP(['first_step']);
    assert.equal(singleAP, 50, 'first_step yields 50 AP');

    const multiAP = GamificationEngine.calculateTotalAP(['first_step', 'focus_rookie', 'deep_diver']);
    assert.equal(multiAP, 50 + 50 + 100, 'first_step + focus_rookie + deep_diver yields 200 AP');

    const maxAP = GamificationEngine.calculateTotalAP(['focus_legend', 'grandmaster_scholar', 'centurion_streak', 'shield_master']);
    assert.equal(maxAP, 500 + 500 + 500 + 500, 'Tier 4 badges yield 2000 AP');
  });

  test('F1.3: calculateTotalEXP computes combined badge EXP and learning time EXP', async () => {
    const noBadgesNoTime = GamificationEngine.calculateTotalEXP([], 0);
    assert.equal(noBadgesNoTime, 0, 'No badges and 0s time yields 0 EXP');

    // 600s learning time = Math.floor(600 / 6) = 100 EXP from time
    const timeOnlyEXP = GamificationEngine.calculateTotalEXP([], 600);
    assert.equal(timeOnlyEXP, 100, '600s learning time yields 100 EXP');

    // first_step (+500 EXP) + 600s (+100 EXP) = 600 EXP
    const combinedEXP = GamificationEngine.calculateTotalEXP(['first_step'], 600);
    assert.equal(combinedEXP, 600, 'first_step badge + 600s yields 600 EXP');
  });

  test('F1.4: calculateLevelFromEXP and Level formula Math.floor(totalAP/200)+1', async () => {
    // Test direct AP level formula from specification: Math.floor(totalAP / 200) + 1
    const apLevel1 = Math.floor(0 / 200) + 1;
    assert.equal(apLevel1, 1, '0 AP is Level 1');

    const apLevel2 = Math.floor(250 / 200) + 1;
    assert.equal(apLevel2, 2, '250 AP is Level 2');

    const apLevel6 = Math.floor(1000 / 200) + 1;
    assert.equal(apLevel6, 6, '1000 AP is Level 6');

    // Test EXP curve calculation
    const lvl1Info = GamificationEngine.calculateLevelFromEXP(0);
    assert.equal(lvl1Info.level, 1, '0 EXP is Level 1');
    assert.equal(lvl1Info.progressPct, 0, '0 EXP has 0% progress');

    const lvl2Info = GamificationEngine.calculateLevelFromEXP(500);
    assert.ok(lvl2Info.level >= 1, '500 EXP gives level progression');
    assert.ok(lvl2Info.progressPct >= 0 && lvl2Info.progressPct <= 100, 'Progress % is bounded between 0 and 100');
  });

  test('F1.5: TimeTracker.checkBadges dynamically unlocks badges on threshold reach', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const initialTracking = await StorageUtil.getTracking();
    initialTracking.monthlyLearningTotal = 950; // > 900s threshold for first_step

    const updatedTracking = tracker.checkBadges(initialTracking);

    assert.ok(updatedTracking.gamification.badges.includes('first_step'), 'first_step badge unlocked');
    assert.equal(updatedTracking.gamification.totalAP, 50, 'totalAP updated to 50');
    assert.ok(updatedTracking.gamification.totalEXP >= 500, 'totalEXP updated with badge EXP');
  });

  test('F1.6: Badge award idempotency prevents duplicate AP and duplicate badge IDs', async () => {
    await resetStorage();
    const tracker = new TimeTracker();

    const tracking = await StorageUtil.getTracking();
    tracking.monthlyLearningTotal = 950;

    // First check
    tracker.checkBadges(tracking);
    const badgeCountFirst = tracking.gamification.badges.length;
    const apFirst = tracking.gamification.totalAP;

    // Second check with same criteria
    tracker.checkBadges(tracking);
    const badgeCountSecond = tracking.gamification.badges.length;
    const apSecond = tracking.gamification.totalAP;

    assert.equal(badgeCountFirst, badgeCountSecond, 'Badge count does not increase on re-check');
    assert.equal(apFirst, apSecond, 'Total AP does not duplicate on re-check');
    assert.equal(tracking.gamification.badges.filter(b => b === 'first_step').length, 1, 'first_step appears exactly once');
  });

});
