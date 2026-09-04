/**
 * Tier 2 Stress Test Suite: PUBG/Free Fire Rank Tier Boundaries & 22 Badge Triggers
 * 
 * Verifies:
 * 1. Rank tier boundary math across all 6 ranks (0, 199, 200, 499, 500, 999, 1000, 1999, 2000, 3499, 3500+ AP).
 * 2. Exact trigger boundary thresholds for all 22 badges across Time, Streak, and Shield Guard categories.
 * 3. Correct population and migration of `unlockedBadgeDates` timestamps.
 * 4. Overall AP accumulation and rank progression up to Grandmaster Legend.
 */

const { test, assert, resetStorage } = require('../harness/test-helpers');
const GamificationEngine = require('../../utils/gamification-engine');
const { TimeTracker } = require('../../utils/time-tracker');

// Helper to create empty tracking object
function createCleanTracking() {
  const tracker = new TimeTracker();
  const today = tracker.getLocalDateKey();
  return {
    dailyWatchTime: { [today]: 0 },
    dailyLearningTime: { [today]: 0 },
    monthlyLearningTotal: 0,
    currentWeekKey: '',
    currentMonthKey: '',
    weeklyTotal: 0,
    weeklyLearningTotal: 0,
    monthlyTotal: 0,
    gamification: {
      currentStreak: 0,
      longestStreak: 0,
      lastLearningDate: null,
      highFocusStreak: 0,
      totalBlockedShorts: 0,
      badges: [],
      unlockedBadgeDates: {},
      totalAP: 0,
      totalEXP: 0,
      level: 1,
      expProgressPct: 0,
      rankId: 'bronze_focus',
      rankTitle: 'Bronze Focus'
    }
  };
}

// -----------------------------------------------------------------------------
// SECTION 1: Rank Tier AP Boundary Stress Tests (GamificationEngine.getRankTierFromAP)
// -----------------------------------------------------------------------------

test('Rank Tier Boundary: AP = 0 (Bronze Focus start)', async () => {
  const result = GamificationEngine.getRankTierFromAP(0);
  assert.equal(result.currentRank.id, 'bronze_focus');
  assert.equal(result.currentRank.title, 'Bronze Focus');
  assert.equal(result.nextRank.id, 'silver_scholar');
  assert.equal(result.isMaxRank, false);
  assert.equal(result.apInCurrentTier, 0);
  assert.equal(result.apNeededForTier, 200);
  assert.equal(result.tierProgressPct, 0);
  assert.equal(result.apToNextRank, 200);
});

test('Rank Tier Boundary: AP = 199 (Bronze Focus upper boundary)', async () => {
  const result = GamificationEngine.getRankTierFromAP(199);
  assert.equal(result.currentRank.id, 'bronze_focus');
  assert.equal(result.currentRank.title, 'Bronze Focus');
  assert.equal(result.nextRank.id, 'silver_scholar');
  assert.equal(result.isMaxRank, false);
  assert.equal(result.apInCurrentTier, 199);
  assert.equal(result.apNeededForTier, 200);
  assert.equal(result.tierProgressPct, 99); // Math.floor(199/200 * 100)
  assert.equal(result.apToNextRank, 1);
});

test('Rank Tier Boundary: AP = 200 (Silver Scholar transition boundary)', async () => {
  const result = GamificationEngine.getRankTierFromAP(200);
  assert.equal(result.currentRank.id, 'silver_scholar');
  assert.equal(result.currentRank.title, 'Silver Scholar');
  assert.equal(result.nextRank.id, 'gold_mastermind');
  assert.equal(result.isMaxRank, false);
  assert.equal(result.apInCurrentTier, 0);
  assert.equal(result.apNeededForTier, 300); // 500 - 200
  assert.equal(result.tierProgressPct, 0);
  assert.equal(result.apToNextRank, 300);
});

test('Rank Tier Boundary: AP = 499 (Silver Scholar upper boundary)', async () => {
  const result = GamificationEngine.getRankTierFromAP(499);
  assert.equal(result.currentRank.id, 'silver_scholar');
  assert.equal(result.currentRank.title, 'Silver Scholar');
  assert.equal(result.nextRank.id, 'gold_mastermind');
  assert.equal(result.isMaxRank, false);
  assert.equal(result.apInCurrentTier, 299);
  assert.equal(result.apNeededForTier, 300);
  assert.equal(result.tierProgressPct, 99); // Math.floor(299/300 * 100)
  assert.equal(result.apToNextRank, 1);
});

test('Rank Tier Boundary: AP = 500 (Gold Mastermind transition boundary)', async () => {
  const result = GamificationEngine.getRankTierFromAP(500);
  assert.equal(result.currentRank.id, 'gold_mastermind');
  assert.equal(result.currentRank.title, 'Gold Mastermind');
  assert.equal(result.nextRank.id, 'diamond_warrior');
  assert.equal(result.isMaxRank, false);
  assert.equal(result.apInCurrentTier, 0);
  assert.equal(result.apNeededForTier, 500); // 1000 - 500
  assert.equal(result.tierProgressPct, 0);
  assert.equal(result.apToNextRank, 500);
});

test('Rank Tier Boundary: AP = 999 (Gold Mastermind upper boundary)', async () => {
  const result = GamificationEngine.getRankTierFromAP(999);
  assert.equal(result.currentRank.id, 'gold_mastermind');
  assert.equal(result.currentRank.title, 'Gold Mastermind');
  assert.equal(result.nextRank.id, 'diamond_warrior');
  assert.equal(result.isMaxRank, false);
  assert.equal(result.apInCurrentTier, 499);
  assert.equal(result.apNeededForTier, 500);
  assert.equal(result.tierProgressPct, 99); // Math.floor(499/500 * 100)
  assert.equal(result.apToNextRank, 1);
});

test('Rank Tier Boundary: AP = 1000 (Diamond Warrior transition boundary)', async () => {
  const result = GamificationEngine.getRankTierFromAP(1000);
  assert.equal(result.currentRank.id, 'diamond_warrior');
  assert.equal(result.currentRank.title, 'Diamond Warrior');
  assert.equal(result.nextRank.id, 'heroic_monk');
  assert.equal(result.isMaxRank, false);
  assert.equal(result.apInCurrentTier, 0);
  assert.equal(result.apNeededForTier, 1000); // 2000 - 1000
  assert.equal(result.tierProgressPct, 0);
  assert.equal(result.apToNextRank, 1000);
});

test('Rank Tier Boundary: AP = 1999 (Diamond Warrior upper boundary)', async () => {
  const result = GamificationEngine.getRankTierFromAP(1999);
  assert.equal(result.currentRank.id, 'diamond_warrior');
  assert.equal(result.currentRank.title, 'Diamond Warrior');
  assert.equal(result.nextRank.id, 'heroic_monk');
  assert.equal(result.isMaxRank, false);
  assert.equal(result.apInCurrentTier, 999);
  assert.equal(result.apNeededForTier, 1000);
  assert.equal(result.tierProgressPct, 99); // Math.floor(999/1000 * 100)
  assert.equal(result.apToNextRank, 1);
});

test('Rank Tier Boundary: AP = 2000 (Heroic Monk transition boundary)', async () => {
  const result = GamificationEngine.getRankTierFromAP(2000);
  assert.equal(result.currentRank.id, 'heroic_monk');
  assert.equal(result.currentRank.title, 'Heroic Monk');
  assert.equal(result.nextRank.id, 'grandmaster_legend');
  assert.equal(result.isMaxRank, false);
  assert.equal(result.apInCurrentTier, 0);
  assert.equal(result.apNeededForTier, 1500); // 3500 - 2000
  assert.equal(result.tierProgressPct, 0);
  assert.equal(result.apToNextRank, 1500);
});

test('Rank Tier Boundary: AP = 3499 (Heroic Monk upper boundary)', async () => {
  const result = GamificationEngine.getRankTierFromAP(3499);
  assert.equal(result.currentRank.id, 'heroic_monk');
  assert.equal(result.currentRank.title, 'Heroic Monk');
  assert.equal(result.nextRank.id, 'grandmaster_legend');
  assert.equal(result.isMaxRank, false);
  assert.equal(result.apInCurrentTier, 1499);
  assert.equal(result.apNeededForTier, 1500);
  assert.equal(result.tierProgressPct, 99); // Math.floor(1499/1500 * 100)
  assert.equal(result.apToNextRank, 1);
});

test('Rank Tier Boundary: AP = 3500 (Grandmaster Legend threshold)', async () => {
  const result = GamificationEngine.getRankTierFromAP(3500);
  assert.equal(result.currentRank.id, 'grandmaster_legend');
  assert.equal(result.currentRank.title, 'Grandmaster Legend');
  assert.equal(result.nextRank, null);
  assert.equal(result.isMaxRank, true);
  assert.equal(result.tierProgressPct, 100);
  assert.equal(result.apToNextRank, 0);
});

test('Rank Tier Boundary: AP = 5000 (Grandmaster Legend surplus AP)', async () => {
  const result = GamificationEngine.getRankTierFromAP(5000);
  assert.equal(result.currentRank.id, 'grandmaster_legend');
  assert.equal(result.currentRank.title, 'Grandmaster Legend');
  assert.equal(result.nextRank, null);
  assert.equal(result.isMaxRank, true);
  assert.equal(result.tierProgressPct, 100);
  assert.equal(result.apInCurrentTier, 1500); // 5000 - 3500
  assert.equal(result.apToNextRank, 0);
});

test('Rank Tier Boundary: Negative AP handling', async () => {
  const result = GamificationEngine.getRankTierFromAP(-100);
  assert.equal(result.currentRank.id, 'bronze_focus');
  assert.equal(result.apInCurrentTier, 0);
});


// -----------------------------------------------------------------------------
// SECTION 2: Category 1 Badges — Time Milestones (8 Badges)
// -----------------------------------------------------------------------------

test('Badge Trigger: Time Category (first_step, focus_rookie, deep_diver, dedicated_scholar, mastermind, study_warrior, focus_legend, grandmaster_scholar)', async () => {
  const tracker = new TimeTracker();
  const timeBadges = [
    { id: 'first_step', seconds: 900, ap: 50, exp: 500 },
    { id: 'focus_rookie', seconds: 3600, ap: 50, exp: 500 },
    { id: 'deep_diver', seconds: 18000, ap: 100, exp: 1000 },
    { id: 'dedicated_scholar', seconds: 36000, ap: 100, exp: 1000 },
    { id: 'mastermind', seconds: 90000, ap: 200, exp: 2000 },
    { id: 'study_warrior', seconds: 180000, ap: 200, exp: 2000 },
    { id: 'focus_legend', seconds: 360000, ap: 500, exp: 5000 },
    { id: 'grandmaster_scholar', seconds: 900000, ap: 500, exp: 5000 }
  ];

  for (const b of timeBadges) {
    // Sub-test 1: 1 second below threshold -> badge should NOT unlock
    let trackingBelow = createCleanTracking();
    trackingBelow.monthlyLearningTotal = b.seconds - 1;
    tracker.checkBadges(trackingBelow);
    assert.ok(!trackingBelow.gamification.badges.includes(b.id), `Badge ${b.id} should NOT unlock at ${b.seconds - 1}s`);

    // Sub-test 2: Exact threshold -> badge SHOULD unlock
    let trackingExact = createCleanTracking();
    trackingExact.monthlyLearningTotal = b.seconds;
    tracker.checkBadges(trackingExact);
    assert.ok(trackingExact.gamification.badges.includes(b.id), `Badge ${b.id} SHOULD unlock at ${b.seconds}s`);
    assert.ok(trackingExact.gamification.unlockedBadgeDates[b.id] > 0, `unlockedBadgeDates timestamp missing for ${b.id}`);
  }
});


// -----------------------------------------------------------------------------
// SECTION 3: Category 2 Badges — Streaks (7 Badges)
// -----------------------------------------------------------------------------

test('Badge Trigger: Streak Category (streak_starter, consistency_master, week_warrior, fortnight_master, monthly_monk, sixty_day_sage, centurion_streak)', async () => {
  const tracker = new TimeTracker();
  const streakBadges = [
    { id: 'streak_starter', days: 2 },
    { id: 'consistency_master', days: 3 },
    { id: 'week_warrior', days: 7 },
    { id: 'fortnight_master', days: 14 },
    { id: 'monthly_monk', days: 30 },
    { id: 'sixty_day_sage', days: 60 },
    { id: 'centurion_streak', days: 100 }
  ];

  for (const b of streakBadges) {
    // 1 day below threshold
    let trackingBelow = createCleanTracking();
    trackingBelow.gamification.currentStreak = b.days - 1;
    tracker.checkBadges(trackingBelow);
    assert.ok(!trackingBelow.gamification.badges.includes(b.id), `Badge ${b.id} should NOT unlock at streak ${b.days - 1}`);

    // Exact threshold
    let trackingExact = createCleanTracking();
    trackingExact.gamification.currentStreak = b.days;
    tracker.checkBadges(trackingExact);
    assert.ok(trackingExact.gamification.badges.includes(b.id), `Badge ${b.id} SHOULD unlock at streak ${b.days}`);
    assert.ok(trackingExact.gamification.unlockedBadgeDates[b.id] > 0, `unlockedBadgeDates timestamp missing for ${b.id}`);
  }
});


// -----------------------------------------------------------------------------
// SECTION 4: Category 3 Badges — Shield Guard (7 Badges)
// -----------------------------------------------------------------------------

test('Badge Trigger: Shield Guard — shorts_defender (10 Shorts blocked)', async () => {
  const tracker = new TimeTracker();
  
  let t9 = createCleanTracking();
  t9.gamification.totalBlockedShorts = 9;
  tracker.checkBadges(t9);
  assert.ok(!t9.gamification.badges.includes('shorts_defender'));

  let t10 = createCleanTracking();
  t10.gamification.totalBlockedShorts = 10;
  tracker.checkBadges(t10);
  assert.ok(t10.gamification.badges.includes('shorts_defender'));
  assert.ok(t10.gamification.unlockedBadgeDates['shorts_defender'] > 0);
});

test('Badge Trigger: Shield Guard — focus_guardian (300s watch & 80%+ focus)', async () => {
  const tracker = new TimeTracker();
  const today = tracker.getLocalDateKey();

  // Case A: watch time < 300 (299s watch, 299s learn = 100% focus) -> Fail
  let tA = createCleanTracking();
  tA.dailyWatchTime[today] = 299;
  tA.dailyLearningTime[today] = 299;
  tracker.checkBadges(tA);
  assert.ok(!tA.gamification.badges.includes('focus_guardian'));

  // Case B: watch time 300s, learn time 239s = 79.66% focus -> Fail
  let tB = createCleanTracking();
  tB.dailyWatchTime[today] = 300;
  tB.dailyLearningTime[today] = 239;
  tracker.checkBadges(tB);
  assert.ok(!tB.gamification.badges.includes('focus_guardian'));

  // Case C: watch time 300s, learn time 240s = 80% focus -> Pass
  let tC = createCleanTracking();
  tC.dailyWatchTime[today] = 300;
  tC.dailyLearningTime[today] = 240;
  tracker.checkBadges(tC);
  assert.ok(tC.gamification.badges.includes('focus_guardian'));
  assert.ok(tC.gamification.unlockedBadgeDates['focus_guardian'] > 0);
});

test('Badge Trigger: Shield Guard — pure_focus (1800s learn & 100% focus)', async () => {
  const tracker = new TimeTracker();
  const today = tracker.getLocalDateKey();

  // Case A: learn 1799s, watch 1799s (100% focus) -> Fail (< 1800s learn)
  let tA = createCleanTracking();
  tA.dailyWatchTime[today] = 1799;
  tA.dailyLearningTime[today] = 1799;
  tracker.checkBadges(tA);
  assert.ok(!tA.gamification.badges.includes('pure_focus'));

  // Case B: learn 1800s, watch 1801s (99.94% focus) -> Fail (< 100% focus)
  let tB = createCleanTracking();
  tB.dailyWatchTime[today] = 1801;
  tB.dailyLearningTime[today] = 1800;
  tracker.checkBadges(tB);
  assert.ok(!tB.gamification.badges.includes('pure_focus'));

  // Case C: learn 1800s, watch 1800s (100% focus) -> Pass
  let tC = createCleanTracking();
  tC.dailyWatchTime[today] = 1800;
  tC.dailyLearningTime[today] = 1800;
  tracker.checkBadges(tC);
  assert.ok(tC.gamification.badges.includes('pure_focus'));
  assert.ok(tC.gamification.unlockedBadgeDates['pure_focus'] > 0);
});

test('Badge Trigger: Shield Guard — time_commander (daily limit adherence)', async () => {
  const tracker = new TimeTracker();
  const today = tracker.getLocalDateKey();
  const settings = { timeManager: { enabled: true, dailyLimitMinutes: 60 } }; // 3600s limit

  // Case A: timeManager disabled -> Fail
  let tA = createCleanTracking();
  tA.dailyWatchTime[today] = 1800;
  tracker.checkBadges(tA, { timeManager: { enabled: false, dailyLimitMinutes: 60 } });
  assert.ok(!tA.gamification.badges.includes('time_commander'));

  // Case B: watch time < 1800s (1799s) -> Fail
  let tB = createCleanTracking();
  tB.dailyWatchTime[today] = 1799;
  tracker.checkBadges(tB, settings);
  assert.ok(!tB.gamification.badges.includes('time_commander'));

  // Case C: watch time > daily limit (3601s > 3600s) -> Fail
  let tC = createCleanTracking();
  tC.dailyWatchTime[today] = 3601;
  tracker.checkBadges(tC, settings);
  assert.ok(!tC.gamification.badges.includes('time_commander'));

  // Case D: watch time = 1800s, <= 3600s -> Pass
  let tD = createCleanTracking();
  tD.dailyWatchTime[today] = 1800;
  tracker.checkBadges(tD, settings);
  assert.ok(tD.gamification.badges.includes('time_commander'));
  assert.ok(tD.gamification.unlockedBadgeDates['time_commander'] > 0);
});

test('Badge Trigger: Shield Guard — distraction_slayer (100 Shorts blocked)', async () => {
  const tracker = new TimeTracker();

  let t99 = createCleanTracking();
  t99.gamification.totalBlockedShorts = 99;
  tracker.checkBadges(t99);
  assert.ok(!t99.gamification.badges.includes('distraction_slayer'));

  let t100 = createCleanTracking();
  t100.gamification.totalBlockedShorts = 100;
  tracker.checkBadges(t100);
  assert.ok(t100.gamification.badges.includes('distraction_slayer'));
  assert.ok(t100.gamification.unlockedBadgeDates['distraction_slayer'] > 0);
});

test('Badge Trigger: Shield Guard — iron_will (highFocusStreak >= 7)', async () => {
  const tracker = new TimeTracker();

  let t6 = createCleanTracking();
  t6.gamification.highFocusStreak = 6;
  tracker.checkBadges(t6);
  assert.ok(!t6.gamification.badges.includes('iron_will'));

  let t7 = createCleanTracking();
  t7.gamification.highFocusStreak = 7;
  tracker.checkBadges(t7);
  assert.ok(t7.gamification.badges.includes('iron_will'));
  assert.ok(t7.gamification.unlockedBadgeDates['iron_will'] > 0);
});

test('Badge Trigger: Shield Guard — shield_master (500 blocked Shorts & 30 day streak)', async () => {
  const tracker = new TimeTracker();

  // Case A: 500 blocked, 29 streak -> Fail
  let tA = createCleanTracking();
  tA.gamification.totalBlockedShorts = 500;
  tA.gamification.currentStreak = 29;
  tracker.checkBadges(tA);
  assert.ok(!tA.gamification.badges.includes('shield_master'));

  // Case B: 499 blocked, 30 streak -> Fail
  let tB = createCleanTracking();
  tB.gamification.totalBlockedShorts = 499;
  tB.gamification.currentStreak = 30;
  tracker.checkBadges(tB);
  assert.ok(!tB.gamification.badges.includes('shield_master'));

  // Case C: 500 blocked, 30 streak -> Pass
  let tC = createCleanTracking();
  tC.gamification.totalBlockedShorts = 500;
  tC.gamification.currentStreak = 30;
  tracker.checkBadges(tC);
  assert.ok(tC.gamification.badges.includes('shield_master'));
  assert.ok(tC.gamification.unlockedBadgeDates['shield_master'] > 0);
});


// -----------------------------------------------------------------------------
// SECTION 5: Timestamp Migration & unlockedBadgeDates Verification
// -----------------------------------------------------------------------------

test('Migration: Legacy unlocked badges missing from unlockedBadgeDates are backfilled', async () => {
  const tracker = new TimeTracker();
  let t = createCleanTracking();
  
  // Manually put legacy badge IDs in badges array without unlockedBadgeDates entries
  t.gamification.badges = ['first_step', 'streak_starter', 'shorts_defender'];
  t.gamification.unlockedBadgeDates = {}; // empty

  const beforeTime = Date.now();
  tracker.checkBadges(t);
  const afterTime = Date.now();

  assert.equal(t.gamification.badges.length, 3);
  for (const bId of ['first_step', 'streak_starter', 'shorts_defender']) {
    const ts = t.gamification.unlockedBadgeDates[bId];
    assert.ok(typeof ts === 'number' && ts >= beforeTime && ts <= afterTime, `Timestamp for ${bId} was not correctly backfilled`);
  }
});


// -----------------------------------------------------------------------------
// SECTION 6: Full Gamification Progression (Unlocking All 22 Badges)
// -----------------------------------------------------------------------------

test('Full Progression: Unlocking all 22 badges calculates 4100 AP and Grandmaster Legend rank', async () => {
  const tracker = new TimeTracker();
  const today = tracker.getLocalDateKey();
  let t = createCleanTracking();

  // Set criteria to unlock all 22 badges simultaneously
  t.monthlyLearningTotal = 900000; // Unlocks all 8 time badges
  t.gamification.currentStreak = 100; // Unlocks all 7 streak badges
  t.gamification.totalBlockedShorts = 500; // Unlocks shorts_defender, distraction_slayer, shield_master
  t.gamification.highFocusStreak = 7; // Unlocks iron_will
  t.dailyWatchTime[today] = 1800;
  t.dailyLearningTime[today] = 1800; // Unlocks focus_guardian (80%+ focus), pure_focus (100% focus)

  const settings = { timeManager: { enabled: true, dailyLimitMinutes: 60 } }; // Unlocks time_commander

  tracker.checkBadges(t, settings);

  // Assert all 22 badges are unlocked
  assert.equal(t.gamification.badges.length, 22, `Expected all 22 badges unlocked, got ${t.gamification.badges.length}`);
  
  // Assert total AP = 1700 (time) + 1200 (streak) + 1200 (shield) = 4100 AP
  assert.equal(t.gamification.totalAP, 4100, `Expected totalAP 4100, got ${t.gamification.totalAP}`);

  // Assert Rank is Grandmaster Legend
  assert.equal(t.gamification.rankId, 'grandmaster_legend');
  assert.equal(t.gamification.rankTitle, 'Grandmaster Legend');
  assert.equal(t.gamification.rankTier, 'Grandmaster Legend');

  // Assert all 22 badges have valid timestamp entries
  assert.equal(Object.keys(t.gamification.unlockedBadgeDates).length, 22);
  for (const bId of t.gamification.badges) {
    assert.ok(t.gamification.unlockedBadgeDates[bId] > 0, `Missing unlocked timestamp for ${bId}`);
  }
});
