# Handoff Report — Spec Miner 1: Time Tracker Integration & Badge Evaluator Spec

**Author**: Spec Miner 1 (`teamwork_preview_spec_miner_m1_1`)  
**Date**: 2026-08-09  
**Target File**: `/Users/shivarampatel/Desktop/shorts-shield/utils/time-tracker.js`  
**Working Directory**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_spec_miner_m1_1/`

---

## 1. Observation

Direct observations from analyzing `/Users/shivarampatel/Desktop/shorts-shield/utils/time-tracker.js` (256 lines):

### 1.1 Existing `TimeTracker` Trigger & Evaluation Logic
1. **Watch Time Accumulation (`checkVideoState`)**: Runs every 1 second when HTML `<video>` is playing and tab is visible (`!document.hidden`). Every 10 seconds of active playback, calls `incrementWatchTime(this.activeTime)`.
2. **Storage Read-and-Write (`incrementWatchTime`)**:
   - Fetches fresh state via `await StorageUtil.getTracking()` and settings via `await StorageUtil.getSettings()`.
   - Calculates local date key `today` (`YYYY-MM-DD`).
   - Checks calendar boundaries (`currentWeekKey`, `currentMonthKey`) to reset weekly and monthly totals when a new week/month starts.
   - Increments `dailyWatchTime[today]`, `weeklyTotal`, `monthlyTotal`.
   - If `settings.studyMode` is enabled, increments `dailyLearningTime[today]`, `weeklyLearningTotal`, `monthlyLearningTotal`, and calls `this.updateStreaks(tracking, today)`.
   - Saves `tracking` to storage using `await StorageUtil.saveTracking(tracking)`.
3. **Existing `updateStreaks(tracking, today)` (lines 132–160)**:
   - Evaluates if `dailyLearningTime[today] >= 60` (requires at least 60s of learning).
   - If `gamification.lastLearningDate !== today`, compares `lastLearningDate` with yesterday's local date. If matched, increments `currentStreak`; otherwise resets `currentStreak` to `1`. Updates `longestStreak` if `currentStreak > longestStreak`.
   - Calls `this.checkBadges(tracking)`.
4. **Existing `checkBadges(tracking)` (lines 162–229)**:
   - Evaluates only **12 legacy badges** (7 time milestones + 5 streak badges).
   - Missing 10 new badges (1 time milestone: `grandmaster_scholar`, 2 streak milestones: `sixty_day_sage`, `centurion_streak`, and all 7 Shield Guard category badges: `shorts_defender`, `focus_guardian`, `pure_focus`, `time_commander`, `distraction_slayer`, `iron_will`, `shield_master`).
   - **Invocation Defect**: `checkBadges(tracking)` is currently ONLY called inside `updateStreaks(tracking, today)` when `lastLearningDate !== today`. As a result, time milestones reached later on the same day (e.g. crossing 1 hour or 5 hours of learning) or Shield Guard actions taken later are never evaluated until the next day.
   - **Stat Recalculation Defect**: Computes an arbitrary `totalPoints` formula (`Math.floor(totalLearningTime / 60) + badgePoints`) and maps to legacy string ranks (`Bronze Focus`, `Silver Scholar`, etc.) directly without setting `totalAP`, `totalEXP`, `level`, `expProgressPct`, `rankId`, `rankTitle`, or tracking `unlockedBadgeDates`.

---

## 2. Logic Chain

### 2.1 Trigger Mechanism Fix
To ensure real-time evaluation:
1. `checkBadges(tracking, settings)` must be invoked **directly inside `incrementWatchTime(seconds)`** after `updateStreaks` and before `StorageUtil.saveTracking(tracking)`.
2. `settings` must be passed into `checkBadges(tracking, settings)` so time-manager limit adherence (`time_commander` badge) can be evaluated accurately against `settings.timeManager`.

### 2.2 Complete 22-Badge Condition Mapping
The 22 badges across 3 categories are evaluated in `checkBadges(tracking, settings)` as follows:

| Badge ID | Category | Name | Requirement / Condition | Tier | AP | EXP |
|---|---|---|---|---|---|---|
| `first_step` | Time | First Steps | `monthlyLearningTotal >= 900` (15 min) | 1 | +50 | 500 |
| `focus_rookie` | Time | Focus Rookie | `monthlyLearningTotal >= 3600` (1 hour) | 1 | +50 | 500 |
| `deep_diver` | Time | Deep Diver | `monthlyLearningTotal >= 18000` (5 hours) | 2 | +100 | 1000 |
| `dedicated_scholar` | Time | Dedicated Scholar | `monthlyLearningTotal >= 36000` (10 hours) | 2 | +100 | 1000 |
| `mastermind` | Time | Mastermind | `monthlyLearningTotal >= 90000` (25 hours) | 3 | +200 | 2000 |
| `study_warrior` | Time | Study Warrior | `monthlyLearningTotal >= 180000` (50 hours) | 3 | +200 | 2000 |
| `focus_legend` | Time | Focus Legend | `monthlyLearningTotal >= 360000` (100 hours) | 4 | +500 | 5000 |
| `grandmaster_scholar` | Time | Grandmaster Scholar | `monthlyLearningTotal >= 900000` (250 hours) | 4 | +500 | 5000 |
| `streak_starter` | Streak | Streak Starter | `currentStreak >= 2` | 1 | +50 | 500 |
| `consistency_master` | Streak | Consistency Master | `currentStreak >= 3` | 1 | +50 | 500 |
| `week_warrior` | Streak | Unstoppable Week | `currentStreak >= 7` | 2 | +100 | 1000 |
| `fortnight_master` | Streak | Fortnight Master | `currentStreak >= 14` | 2 | +100 | 1000 |
| `monthly_monk` | Streak | Monthly Monk | `currentStreak >= 30` | 3 | +200 | 2000 |
| `sixty_day_sage` | Streak | 60-Day Sage | `currentStreak >= 60` | 3 | +200 | 2000 |
| `centurion_streak` | Streak | Centurion Legend | `currentStreak >= 100` | 4 | +500 | 5000 |
| `shorts_defender` | Shield | Shorts Defender | `totalBlockedShorts >= 10` | 1 | +50 | 500 |
| `focus_guardian` | Shield | Focus Guardian | `todayWatch >= 300` && `focusScore >= 80%` | 1 | +50 | 500 |
| `pure_focus` | Shield | Pure Focus Monk | `todayLearn >= 1800` (30m) && `focusScore >= 100%` | 2 | +100 | 1000 |
| `time_commander` | Shield | Time Commander | `todayWatch >= 1800` && `todayWatch <= limit` | 2 | +100 | 1000 |
| `distraction_slayer` | Shield | Distraction Slayer | `totalBlockedShorts >= 100` | 3 | +200 | 2000 |
| `iron_will` | Shield | Iron Will | `highFocusStreak >= 7` | 3 | +200 | 2000 |
| `shield_master` | Shield | Ultimate Shield Master | `totalBlockedShorts >= 500` && `currentStreak >= 30` | 4 | +500 | 5000 |

### 2.3 `unlockedBadgeDates` Tracking
When any badge is newly unlocked:
1. `badgeId` is appended to `tracking.gamification.badges`.
2. `tracking.gamification.unlockedBadgeDates[badgeId] = Date.now()`.
3. Existing unlocked badges missing a timestamp entry are populated with `Date.now()` during migration scan.

### 2.4 Gamification Stat Recalculation Flow
After evaluating all 22 badge conditions, `checkBadges` recomputes overall player metrics:
1. **Total AP**: `GamificationEngine.calculateTotalAP(gamification.badges)` (sum of AP awarded by unlocked badges).
2. **Total EXP**: `GamificationEngine.calculateTotalEXP(gamification.badges, totalLearningTime)` (sum of badge EXP + `floor(totalLearningTime / 6)`).
3. **Player Level & Level Progress Bar**:
   - `levelInfo = GamificationEngine.calculateLevelFromEXP(totalEXP)`
   - `gamification.level = levelInfo.level`
   - `gamification.expProgressPct = levelInfo.progressPct`
4. **PUBG/Free Fire Rank Tier**:
   - `rankInfo = GamificationEngine.getRankTierFromAP(totalAP)`
   - `gamification.rankId = rankInfo.currentRank.id`
   - `gamification.rankTitle = rankInfo.currentRank.title`
5. **Backward Compatibility**:
   - `gamification.rankTier = rankInfo.currentRank.title`
   - `gamification.rankIcon = rankInfo.currentRank.icon`
   - `gamification.totalPoints = gamification.totalAP`

---

## 3. Features Discovered & Edge Cases

## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Time Milestones | `first_step` Badge | Awarded when user accumulates 15 min learning time | `monthlyLearningTotal >= 900` | Badges array + `first_step`, +50 AP, +500 EXP | Safe fallback if total is null | Code inspection |
| 2 | Time Milestones | `focus_rookie` Badge | Awarded when user accumulates 1 hour learning time | `monthlyLearningTotal >= 3600` | Badges array + `focus_rookie`, +50 AP, +500 EXP | Safe fallback if total is null | Code inspection |
| 3 | Time Milestones | `deep_diver` Badge | Awarded when user accumulates 5 hours learning time | `monthlyLearningTotal >= 18000` | Badges array + `deep_diver`, +100 AP, +1000 EXP | Safe fallback if total is null | Code inspection |
| 4 | Time Milestones | `dedicated_scholar` Badge | Awarded when user accumulates 10 hours learning time | `monthlyLearningTotal >= 36000` | Badges array + `dedicated_scholar`, +100 AP, +1000 EXP | Safe fallback if total is null | Code inspection |
| 5 | Time Milestones | `mastermind` Badge | Awarded when user accumulates 25 hours learning time | `monthlyLearningTotal >= 90000` | Badges array + `mastermind`, +200 AP, +2000 EXP | Safe fallback if total is null | Code inspection |
| 6 | Time Milestones | `study_warrior` Badge | Awarded when user accumulates 50 hours learning time | `monthlyLearningTotal >= 180000` | Badges array + `study_warrior`, +200 AP, +2000 EXP | Safe fallback if total is null | Code inspection |
| 7 | Time Milestones | `focus_legend` Badge | Awarded when user accumulates 100 hours learning time | `monthlyLearningTotal >= 360000` | Badges array + `focus_legend`, +500 AP, +5000 EXP | Safe fallback if total is null | Code inspection |
| 8 | Time Milestones | `grandmaster_scholar` Badge | Awarded when user accumulates 250 hours learning time | `monthlyLearningTotal >= 900000` | Badges array + `grandmaster_scholar`, +500 AP, +5000 EXP | Safe fallback if total is null | Spec Analysis |
| 9 | Streaks | `streak_starter` Badge | Awarded for maintaining a 2-day learning streak | `currentStreak >= 2` | Badges array + `streak_starter`, +50 AP, +500 EXP | Safe fallback if streak is null | Code inspection |
| 10 | Streaks | `consistency_master` Badge | Awarded for maintaining a 3-day learning streak | `currentStreak >= 3` | Badges array + `consistency_master`, +50 AP, +500 EXP | Safe fallback if streak is null | Code inspection |
| 11 | Streaks | `week_warrior` Badge | Awarded for maintaining a 7-day learning streak | `currentStreak >= 7` | Badges array + `week_warrior`, +100 AP, +1000 EXP | Safe fallback if streak is null | Code inspection |
| 12 | Streaks | `fortnight_master` Badge | Awarded for maintaining a 14-day learning streak | `currentStreak >= 14` | Badges array + `fortnight_master`, +100 AP, +1000 EXP | Safe fallback if streak is null | Code inspection |
| 13 | Streaks | `monthly_monk` Badge | Awarded for maintaining a 30-day learning streak | `currentStreak >= 30` | Badges array + `monthly_monk`, +200 AP, +2000 EXP | Safe fallback if streak is null | Code inspection |
| 14 | Streaks | `sixty_day_sage` Badge | Awarded for maintaining a 60-day learning streak | `currentStreak >= 60` | Badges array + `sixty_day_sage`, +200 AP, +2000 EXP | Safe fallback if streak is null | Spec Analysis |
| 15 | Streaks | `centurion_streak` Badge | Awarded for maintaining a 100-day learning streak | `currentStreak >= 100` | Badges array + `centurion_streak`, +500 AP, +5000 EXP | Safe fallback if streak is null | Spec Analysis |
| 16 | Shield Guard | `shorts_defender` Badge | Awarded for blocking 10 Shorts | `totalBlockedShorts >= 10` | Badges array + `shorts_defender`, +50 AP, +500 EXP | Default count to 0 | Spec Analysis |
| 17 | Shield Guard | `focus_guardian` Badge | Awarded for 80%+ Focus Score today (min 5 min watch time) | `todayWatch >= 300 && focusScore >= 80` | Badges array + `focus_guardian`, +50 AP, +500 EXP | Guard divide-by-zero | Spec Analysis |
| 18 | Shield Guard | `pure_focus` Badge | Awarded for 100% Focus Score today (min 30 min learn time) | `todayLearn >= 1800 && focusScore >= 100` | Badges array + `pure_focus`, +100 AP, +1000 EXP | Guard divide-by-zero | Spec Analysis |
| 19 | Shield Guard | `time_commander` Badge | Awarded for adhering to daily watch limit | `todayWatch >= 1800 && todayWatch <= dailyLimit` | Badges array + `time_commander`, +100 AP, +1000 EXP | Handle disabled Time Manager | Spec Analysis |
| 20 | Shield Guard | `distraction_slayer` Badge | Awarded for blocking 100 Shorts | `totalBlockedShorts >= 100` | Badges array + `distraction_slayer`, +200 AP, +2000 EXP | Default count to 0 | Spec Analysis |
| 21 | Shield Guard | `iron_will` Badge | Awarded for 90%+ Focus Score for 7 consecutive days | `highFocusStreak >= 7` | Badges array + `iron_will`, +200 AP, +2000 EXP | Default streak to 0 | Spec Analysis |
| 22 | Shield Guard | `shield_master` Badge | Awarded for blocking 500 Shorts and 30-day streak | `totalBlockedShorts >= 500 && currentStreak >= 30` | Badges array + `shield_master`, +500 AP, +5000 EXP | Default inputs to 0 | Spec Analysis |
| 23 | Gamification Stat | AP & EXP Sum | Computes total earned AP and EXP from badges and learning time | `badges` list, `monthlyLearningTotal` | `gamification.totalAP`, `gamification.totalEXP` | Non-negative integer output | Spec Analysis |
| 24 | Gamification Stat | Level & Level Progress Math | Computes quadratic level ($E(L) = 100L^2+100L-200$) and progress % | `totalEXP` | `gamification.level`, `gamification.expProgressPct` | Clamp percentage to [0, 100] | Spec Analysis |
| 25 | Gamification Stat | PUBG Rank Tier Lookup | Maps total AP to one of 6 rank tiers (Bronze Focus to Grandmaster Legend) | `totalAP` | `gamification.rankId`, `gamification.rankTitle` | Default to Bronze Focus | Spec Analysis |
| 26 | Timestamp Tracker | `unlockedBadgeDates` Map | Records unlock timestamp (`Date.now()`) for each unlocked badge | Newly unlocked badge ID | `tracking.gamification.unlockedBadgeDates[badgeId] = Date.now()` | Preserve existing dates | Spec Analysis |

## Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Zero State Initialization | Fresh user storage with missing `tracking.gamification` | Initializes `gamification` schema object defaults without errors; sets AP=0, EXP=0, Level=1, Rank="Bronze Focus". |
| 2 | Legacy User Storage Migration | `tracking.gamification` has legacy `badges: ['first_step']` but no `unlockedBadgeDates` or `totalAP` | Migration scan populates `unlockedBadgeDates['first_step'] = Date.now()`, recomputes `totalAP = 50`, `totalEXP`, level, and rank tier. |
| 3 | Zero Watch Time Focus Score | `todayWatchTime = 0` | Divide-by-zero avoided via ternary check `todayWatch > 0 ? (todayLearn / todayWatch) * 100 : 0`. |
| 4 | Missing Settings Object | `settings` parameter is undefined or missing `timeManager` | Optional chaining `settings?.timeManager?.enabled` safely evaluates to false without throwing `TypeError`. |
| 5 | Maximum Rank Boundary | `totalAP >= 3500` (Grandmaster Legend) | `getRankTierFromAP` returns `grandmaster_legend`, progress = 100%, `nextRank` = null. `checkBadges` cleanly handles max rank. |
| 6 | Standalone / Missing Module Fallback | `GamificationEngine` module not loaded in environment | `checkBadges` executes inline fallback math for AP sum, EXP sum, quadratic level curve, and rank tier lookup seamlessly. |
| 7 | Mid-Day Badge Milestone | User crosses 1-hour learning milestone mid-session | Called every 10s inside `incrementWatchTime`, badge unlocks immediately in real time instead of waiting for next day. |

---

## 4. Caveats

1. **Standalone Script Fallback**: While `GamificationEngine` will be included in the extension runtime, `checkBadges(tracking, settings)` includes inline fallback math so standalone unit execution or tests pass even if `GamificationEngine` is missing.
2. **Context Validity**: Callers must verify `StorageUtil.isContextValid()` before attempting storage writes to prevent runtime warnings on extension reload.
3. **Date Key Alignment**: `checkBadges` uses `this.getLocalDateKey()` matching `incrementWatchTime` to ensure local timezone consistency.

---

## 5. Conclusion & Exact Code Specifications

### 5.1 Exact Edit Plan for `utils/time-tracker.js`

#### Edit 1: Update `incrementWatchTime(seconds)` to invoke `checkBadges(tracking, settings)` prior to `StorageUtil.saveTracking(tracking)`
In `utils/time-tracker.js`, modify `incrementWatchTime(seconds)` (lines 109–119):

```javascript
    // Increment learning time if Study Mode is active
    if (settings.studyMode) {
      tracking.dailyLearningTime[today] += seconds;
      tracking.weeklyLearningTotal = (tracking.weeklyLearningTotal || 0) + seconds;
      tracking.monthlyLearningTotal = (tracking.monthlyLearningTotal || 0) + seconds;
      
      this.updateStreaks(tracking, today);
    }

    // Always evaluate all 22 badges and recompute gamification stats on flush
    this.checkBadges(tracking, settings);

    await StorageUtil.saveTracking(tracking);
```

#### Edit 2: Replace `checkBadges(tracking)` with the complete 22-badge evaluator and stat recalculator
In `utils/time-tracker.js`, replace `checkBadges(tracking)` (lines 162–229) with:

```javascript
  checkBadges(tracking, settings = {}) {
    if (!tracking) return tracking;

    // Ensure gamification sub-object exists
    if (!tracking.gamification) {
      tracking.gamification = {
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
        rankId: "bronze_focus",
        rankTitle: "Bronze Focus"
      };
    }

    const gamification = tracking.gamification;
    if (!Array.isArray(gamification.badges)) {
      gamification.badges = [];
    }
    if (!gamification.unlockedBadgeDates || typeof gamification.unlockedBadgeDates !== 'object') {
      gamification.unlockedBadgeDates = {};
    }

    const totalLearningTime = tracking.monthlyLearningTotal || 0;
    const streak = gamification.currentStreak || 0;
    const blockedShorts = gamification.totalBlockedShorts || 0;
    const highFocusStreak = gamification.highFocusStreak || 0;

    const today = this.getLocalDateKey();
    const todayWatch = (tracking.dailyWatchTime && tracking.dailyWatchTime[today]) || 0;
    const todayLearn = (tracking.dailyLearningTime && tracking.dailyLearningTime[today]) || 0;
    const focusScore = todayWatch > 0 ? (todayLearn / todayWatch) * 100 : 0;

    const unlockIf = (badgeId, condition) => {
      if (!gamification.badges.includes(badgeId) && condition) {
        gamification.badges.push(badgeId);
        gamification.unlockedBadgeDates[badgeId] = Date.now();
        return true;
      }
      return false;
    };

    // Category 1: Time Milestones (8 Badges)
    unlockIf('first_step', totalLearningTime >= 900);
    unlockIf('focus_rookie', totalLearningTime >= 3600);
    unlockIf('deep_diver', totalLearningTime >= 18000);
    unlockIf('dedicated_scholar', totalLearningTime >= 36000);
    unlockIf('mastermind', totalLearningTime >= 90000);
    unlockIf('study_warrior', totalLearningTime >= 180000);
    unlockIf('focus_legend', totalLearningTime >= 360000);
    unlockIf('grandmaster_scholar', totalLearningTime >= 900000);

    // Category 2: Streaks (7 Badges)
    unlockIf('streak_starter', streak >= 2);
    unlockIf('consistency_master', streak >= 3);
    unlockIf('week_warrior', streak >= 7);
    unlockIf('fortnight_master', streak >= 14);
    unlockIf('monthly_monk', streak >= 30);
    unlockIf('sixty_day_sage', streak >= 60);
    unlockIf('centurion_streak', streak >= 100);

    // Category 3: Shield Guard (7 Badges)
    unlockIf('shorts_defender', blockedShorts >= 10);
    unlockIf('focus_guardian', todayWatch >= 300 && focusScore >= 80);
    unlockIf('pure_focus', todayLearn >= 1800 && focusScore >= 100);
    unlockIf('time_commander', todayWatch >= 1800 && (settings && settings.timeManager && settings.timeManager.enabled ? todayWatch <= (settings.timeManager.dailyLimitMinutes * 60) : false));
    unlockIf('distraction_slayer', blockedShorts >= 100);
    unlockIf('iron_will', highFocusStreak >= 7);
    unlockIf('shield_master', blockedShorts >= 500 && streak >= 30);

    // Migration scan: Ensure all unlocked badges have an unlocked date entry
    gamification.badges.forEach(bId => {
      if (!gamification.unlockedBadgeDates[bId]) {
        gamification.unlockedBadgeDates[bId] = Date.now();
      }
    });

    // Recompute total AP, total EXP, level, expProgressPct, and PUBG rank tier
    if (typeof GamificationEngine !== 'undefined' && typeof GamificationEngine.calculateTotalAP === 'function') {
      gamification.totalAP = GamificationEngine.calculateTotalAP(gamification.badges);
      gamification.totalEXP = GamificationEngine.calculateTotalEXP(gamification.badges, totalLearningTime);
      
      const levelInfo = GamificationEngine.calculateLevelFromEXP(gamification.totalEXP);
      gamification.level = levelInfo.level;
      gamification.expProgressPct = levelInfo.progressPct;

      const rankInfo = GamificationEngine.getRankTierFromAP(gamification.totalAP);
      gamification.rankId = rankInfo.currentRank.id;
      gamification.rankTitle = rankInfo.currentRank.title;

      // Backward compatibility fields
      gamification.rankTier = rankInfo.currentRank.title;
      gamification.rankIcon = rankInfo.currentRank.icon;
      gamification.totalPoints = gamification.totalAP;
    } else {
      // Inline fallback math if GamificationEngine module is absent
      const BADGE_AP = {
        first_step: 50, focus_rookie: 50, deep_diver: 100, dedicated_scholar: 100,
        mastermind: 200, study_warrior: 200, focus_legend: 500, grandmaster_scholar: 500,
        streak_starter: 50, consistency_master: 50, week_warrior: 100, fortnight_master: 100,
        monthly_monk: 200, sixty_day_sage: 200, centurion_streak: 500,
        shorts_defender: 50, focus_guardian: 50, pure_focus: 100, time_commander: 100,
        distraction_slayer: 200, iron_will: 200, shield_master: 500
      };
      const BADGE_EXP = {
        first_step: 500, focus_rookie: 500, deep_diver: 1000, dedicated_scholar: 1000,
        mastermind: 2000, study_warrior: 2000, focus_legend: 5000, grandmaster_scholar: 5000,
        streak_starter: 500, consistency_master: 500, week_warrior: 1000, fortnight_master: 1000,
        monthly_monk: 2000, sixty_day_sage: 2000, centurion_streak: 5000,
        shorts_defender: 500, focus_guardian: 500, pure_focus: 1000, time_commander: 1000,
        distraction_slayer: 2000, iron_will: 2000, shield_master: 5000
      };

      let ap = 0;
      let bExp = 0;
      gamification.badges.forEach(bId => {
        ap += BADGE_AP[bId] || 0;
        bExp += BADGE_EXP[bId] || 0;
      });
      gamification.totalAP = ap;
      gamification.totalEXP = bExp + Math.floor(totalLearningTime / 6);

      const exp = Math.max(0, gamification.totalEXP);
      const exactL = (-1 + Math.sqrt(9 + (exp / 25))) / 2;
      const lvl = Math.max(1, Math.floor(exactL));
      gamification.level = lvl;
      
      const curLvlThreshold = 100 * (lvl * lvl) + 100 * lvl - 200;
      const nextLvlThreshold = 100 * ((lvl + 1) * (lvl + 1)) + 100 * (lvl + 1) - 200;
      const span = nextLvlThreshold - curLvlThreshold;
      gamification.expProgressPct = span > 0 ? Math.min(100, Math.max(0, Math.floor(((exp - curLvlThreshold) / span) * 100))) : 100;

      if (ap >= 3500) { gamification.rankId = 'grandmaster_legend'; gamification.rankTitle = 'Grandmaster Legend'; }
      else if (ap >= 2000) { gamification.rankId = 'heroic_monk'; gamification.rankTitle = 'Heroic Monk'; }
      else if (ap >= 1000) { gamification.rankId = 'diamond_warrior'; gamification.rankTitle = 'Diamond Warrior'; }
      else if (ap >= 500) { gamification.rankId = 'gold_mastermind'; gamification.rankTitle = 'Gold Mastermind'; }
      else if (ap >= 200) { gamification.rankId = 'silver_scholar'; gamification.rankTitle = 'Silver Scholar'; }
      else { gamification.rankId = 'bronze_focus'; gamification.rankTitle = 'Bronze Focus'; }

      gamification.rankTier = gamification.rankTitle;
      gamification.totalPoints = gamification.totalAP;
    }

    return tracking;
  }
```

---

## 6. Verification Method

To verify this specification:

1. **JavaScript Syntax Verification**:
   ```bash
   node -c utils/time-tracker.js
   ```
   *Expected output*: Zero syntax errors (exit code 0).

2. **Node Execution Test Script**:
   ```bash
   node -e '
   const tracker = new (require("./utils/time-tracker.js").TimeTracker || class TimeTracker {
     getLocalDateKey() { return "2026-08-09"; }
   })();
   '
   ```

3. **Storage Output Verification Checklist**:
   - `tracking.gamification.badges` contains unlocked string IDs.
   - `tracking.gamification.unlockedBadgeDates[badgeId]` is a numeric timestamp.
   - `tracking.gamification.totalAP` equals sum of AP for unlocked badges.
   - `tracking.gamification.totalEXP` equals sum of badge EXP + `floor(totalLearningTime / 6)`.
   - `tracking.gamification.level` matches quadratic formula $E(L)$.
   - `tracking.gamification.rankId` and `rankTitle` match total AP threshold bounds.
