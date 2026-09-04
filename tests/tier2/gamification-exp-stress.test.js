/**
 * Tier 2 Stress Test Suite: Gamification Engine EXP & Quadratic Level Progression Math
 * Quadratic Formula: E(L) = 100L^2 + 100L - 200
 */

const { test, assert } = require('../harness/test-helpers');
const GamificationEngine = require('../../utils/gamification-engine');

test('Gamification stress test: Level threshold boundaries for E(L) = 100L^2 + 100L - 200', async () => {
  // Level 1: E(1) = 0
  const l1_start = GamificationEngine.calculateLevelFromEXP(0);
  assert.equal(l1_start.level, 1, 'EXP=0 should be Level 1');
  assert.equal(l1_start.currentLevelThreshold, 0);
  assert.equal(l1_start.nextLevelThreshold, 400);
  assert.equal(l1_start.expInCurrentLevel, 0);
  assert.equal(l1_start.expNeededForNextLevel, 400);
  assert.equal(l1_start.progressPct, 0);

  const l1_end = GamificationEngine.calculateLevelFromEXP(399);
  assert.equal(l1_end.level, 1, 'EXP=399 should still be Level 1');
  assert.equal(l1_end.expInCurrentLevel, 399);
  assert.equal(l1_end.progressPct, 99);

  // Level 2: E(2) = 400
  const l2_start = GamificationEngine.calculateLevelFromEXP(400);
  assert.equal(l2_start.level, 2, 'EXP=400 should be Level 2');
  assert.equal(l2_start.currentLevelThreshold, 400);
  assert.equal(l2_start.nextLevelThreshold, 1000);
  assert.equal(l2_start.expInCurrentLevel, 0);
  assert.equal(l2_start.expNeededForNextLevel, 600);
  assert.equal(l2_start.progressPct, 0);

  const l2_end = GamificationEngine.calculateLevelFromEXP(999);
  assert.equal(l2_end.level, 2, 'EXP=999 should still be Level 2');
  assert.equal(l2_end.expInCurrentLevel, 599);
  assert.equal(l2_end.progressPct, 99);

  // Level 3: E(3) = 1000
  const l3_start = GamificationEngine.calculateLevelFromEXP(1000);
  assert.equal(l3_start.level, 3, 'EXP=1000 should be Level 3');
  assert.equal(l3_start.currentLevelThreshold, 1000);
  assert.equal(l3_start.nextLevelThreshold, 1800);
  assert.equal(l3_start.expInCurrentLevel, 0);
  assert.equal(l3_start.expNeededForNextLevel, 800);
  assert.equal(l3_start.progressPct, 0);

  const l3_end = GamificationEngine.calculateLevelFromEXP(1799);
  assert.equal(l3_end.level, 3, 'EXP=1799 should still be Level 3');
  assert.equal(l3_end.expInCurrentLevel, 799);
  assert.equal(l3_end.progressPct, 99);

  // Level 4: E(4) = 1800
  const l4_start = GamificationEngine.calculateLevelFromEXP(1800);
  assert.equal(l4_start.level, 4, 'EXP=1800 should be Level 4');
  assert.equal(l4_start.currentLevelThreshold, 1800);
  assert.equal(l4_start.nextLevelThreshold, 2800);
  assert.equal(l4_start.expInCurrentLevel, 0);
  assert.equal(l4_start.expNeededForNextLevel, 1000);
  assert.equal(l4_start.progressPct, 0);

  const l4_end = GamificationEngine.calculateLevelFromEXP(2799);
  assert.equal(l4_end.level, 4, 'EXP=2799 should still be Level 4');
  assert.equal(l4_end.expInCurrentLevel, 999);
  assert.equal(l4_end.progressPct, 99);

  // Level 5: E(5) = 2800
  const l5_start = GamificationEngine.calculateLevelFromEXP(2800);
  assert.equal(l5_start.level, 5, 'EXP=2800 should be Level 5');
  assert.equal(l5_start.currentLevelThreshold, 2800);
  assert.equal(l5_start.nextLevelThreshold, 4000);
  assert.equal(l5_start.expInCurrentLevel, 0);
  assert.equal(l5_start.expNeededForNextLevel, 1200);
  assert.equal(l5_start.progressPct, 0);

  const l5_end = GamificationEngine.calculateLevelFromEXP(3999);
  assert.equal(l5_end.level, 5, 'EXP=3999 should still be Level 5');
  assert.equal(l5_end.expInCurrentLevel, 1199);
  assert.equal(l5_end.progressPct, 99);

  // Level 6: E(6) = 4000
  const l6_start = GamificationEngine.calculateLevelFromEXP(4000);
  assert.equal(l6_start.level, 6, 'EXP=4000 should be Level 6');
  assert.equal(l6_start.currentLevelThreshold, 4000);
  assert.equal(l6_start.nextLevelThreshold, 5400);
  assert.equal(l6_start.expInCurrentLevel, 0);
  assert.equal(l6_start.expNeededForNextLevel, 1400);
  assert.equal(l6_start.progressPct, 0);
});

test('Gamification stress test: expProgressPct midpoints and rounding math', async () => {
  // Midpoints (50%) across levels 1 to 5
  assert.equal(GamificationEngine.calculateLevelFromEXP(200).progressPct, 50, 'Level 1 midpoint (200/400)');
  assert.equal(GamificationEngine.calculateLevelFromEXP(700).progressPct, 50, 'Level 2 midpoint ((700-400)/600)');
  assert.equal(GamificationEngine.calculateLevelFromEXP(1400).progressPct, 50, 'Level 3 midpoint ((1400-1000)/800)');
  assert.equal(GamificationEngine.calculateLevelFromEXP(2300).progressPct, 50, 'Level 4 midpoint ((2300-1800)/1000)');
  assert.equal(GamificationEngine.calculateLevelFromEXP(3400).progressPct, 50, 'Level 5 midpoint ((3400-2800)/1200)');

  // Floor rounding precision check (e.g. 201/400 * 100 = 50.25 -> 50)
  assert.equal(GamificationEngine.calculateLevelFromEXP(201).progressPct, 50);
  // Boundary 99.75% flooring to 99%
  assert.equal(GamificationEngine.calculateLevelFromEXP(399).progressPct, 99);
});

test('Gamification stress test: calculateTotalEXP aggregation (badges + time rate)', async () => {
  // Zero badges & zero time
  assert.equal(GamificationEngine.calculateTotalEXP([], 0), 0);
  assert.equal(GamificationEngine.calculateTotalEXP(null, null), 0);

  // Unknown badge handle
  assert.equal(GamificationEngine.calculateTotalEXP(['unknown_badge_id'], 0), 0);

  // Time conversion: 1 sec = 1/6 EXP (Math.floor)
  assert.equal(GamificationEngine.calculateTotalEXP([], 0), 0);
  assert.equal(GamificationEngine.calculateTotalEXP([], 5), 0, '5 seconds gives 0 EXP');
  assert.equal(GamificationEngine.calculateTotalEXP([], 6), 1, '6 seconds gives 1 EXP');
  assert.equal(GamificationEngine.calculateTotalEXP([], 11), 1, '11 seconds gives 1 EXP');
  assert.equal(GamificationEngine.calculateTotalEXP([], 12), 2, '12 seconds gives 2 EXP');
  assert.equal(GamificationEngine.calculateTotalEXP([], 3600), 600, '3600 seconds (1 hr) gives 600 EXP');

  // Badge EXP addition
  const firstStepBadgeEXP = GamificationEngine.BADGE_DEFINITIONS.find(b => b.id === 'first_step').exp; // 500
  const focusRookieBadgeEXP = GamificationEngine.BADGE_DEFINITIONS.find(b => b.id === 'focus_rookie').exp; // 500
  assert.equal(firstStepBadgeEXP, 500);
  assert.equal(focusRookieBadgeEXP, 500);

  assert.equal(GamificationEngine.calculateTotalEXP(['first_step'], 0), 500);
  assert.equal(GamificationEngine.calculateTotalEXP(['first_step', 'focus_rookie'], 900), 1150, '500+500 + 900/6=150 = 1150 EXP');
});

test('Gamification stress test: High level threshold progression sweep (L1 to L50)', async () => {
  for (let L = 1; L <= 50; L++) {
    const expectedThreshold = 100 * L * L + 100 * L - 200;
    const res = GamificationEngine.calculateLevelFromEXP(expectedThreshold);
    assert.equal(res.level, L, `Exact threshold for Level ${L} (${expectedThreshold} EXP) must return level=${L}`);
    assert.equal(res.currentLevelThreshold, expectedThreshold);
    assert.equal(res.progressPct, 0, `Exact threshold for Level ${L} must start at 0% progress`);

    if (L > 1) {
      const prevRes = GamificationEngine.calculateLevelFromEXP(expectedThreshold - 1);
      assert.equal(prevRes.level, L - 1, `1 EXP below Level ${L} threshold (${expectedThreshold - 1} EXP) must return level=${L - 1}`);
      assert.equal(prevRes.progressPct, 99, `1 EXP below Level ${L} threshold must return 99% progress`);
    }
  }
});

test('Gamification stress test: Edge inputs and negative/float values', async () => {
  // Negative totalEXP should clamp to 0 (Level 1, 0%)
  const neg = GamificationEngine.calculateLevelFromEXP(-500);
  assert.equal(neg.level, 1);
  assert.equal(neg.progressPct, 0);

  // Floating point totalEXP
  const floatExp = GamificationEngine.calculateLevelFromEXP(400.9);
  assert.equal(floatExp.level, 2);
  assert.ok(Math.abs(floatExp.expInCurrentLevel - 0.9) < 1e-9, `expInCurrentLevel should be ~0.9, got ${floatExp.expInCurrentLevel}`);

  // Monotonicity check across contiguous integer range 0 to 10,000 EXP
  let prevLevel = 1;
  for (let exp = 0; exp <= 10000; exp++) {
    const state = GamificationEngine.calculateLevelFromEXP(exp);
    assert.ok(state.level >= prevLevel, `Level must be non-decreasing at EXP=${exp}`);
    assert.ok(state.progressPct >= 0 && state.progressPct <= 100, `Progress % must be within [0, 100] at EXP=${exp}`);
    prevLevel = state.level;
  }
});
