# Task Assignment — Spec Miner 1 (Time Tracker Integration Spec)

## Objective
Investigate `/Users/shivarampatel/Desktop/shorts-shield/utils/time-tracker.js` and detail the exact edits required for `checkBadges()` and gamification stat recalculations.

## Inputs
- ORIGINAL_REQUEST: `/Users/shivarampatel/Desktop/shorts-shield/.agents/ORIGINAL_REQUEST.md`
- PROJECT: `/Users/shivarampatel/Desktop/shorts-shield/PROJECT.md`
- SCOPE: `/Users/shivarampatel/Desktop/shorts-shield/.agents/sub_orch_m1/SCOPE.md`
- Survey Reports:
  - `/Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_explorer_survey_1/handoff.md`
  - `/Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_explorer_survey_2/handoff.md`
- Existing File: `/Users/shivarampatel/Desktop/shorts-shield/utils/time-tracker.js`

## Requirements
1. Analyze how `TimeTracker.prototype.checkBadges` currently works and how it integrates with `GamificationEngine`.
2. Map conditions for all 22 badges:
   - Time category (8 badges): `monthlyLearningTotal` thresholds (15m, 1h, 5h, 10h, 25h, 50h, 100h, 250h).
   - Streak category (7 badges): `currentStreak` thresholds (2, 3, 7, 14, 30, 60, 100).
   - Shield Guard category (7 badges): `totalBlockedShorts` (10, 100, 500), focus score, adhere to daily limit, high focus streaks.
3. Detail how `checkBadges(tracking)` recomputes `totalAP`, `totalEXP`, `level`, `rankId`, `rankTitle`, `expProgressPct` using `GamificationEngine` after evaluating badges.
4. Ensure unlocked badge dates are tracked in `tracking.gamification.unlockedBadgeDates[badgeId] = Date.now()`.
5. Detail exact edit steps and write comprehensive handoff report in `handoff.md` in your working directory `.agents/teamwork_preview_spec_miner_m1_1/`.

## 2026-08-09T05:16:44Z
**Context**: Spec Miner report check.
**Content**: Your handoff report file `/Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_spec_miner_m1_1/handoff.md` was not found on disk.
**Action**: Please write your complete handoff report to `/Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_spec_miner_m1_1/handoff.md`.

