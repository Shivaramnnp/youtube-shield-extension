# Handoff Report: Script Tag & Gamification Spec Miner (M2)

**Agent**: `teamwork_preview_spec_miner_m2_1`  
**Milestone**: M2 — Battle-Card UI & Popup Integration  
**Target File**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_spec_miner_m2_1/handoff.md`  

---

## 1. Observation

Direct code observations from inspecting the codebase:

1. **Existing Script Inclusion Tags**:
   - `options/options.html` (lines 298-300):
     ```html
       <script src="../utils/storage.js"></script>
       <script src="options.js"></script>
     </body>
     ```
   - `popup/popup.html` (lines 100-102):
     ```html
       <script src="../utils/storage.js"></script>
       <script src="popup.js"></script>
     </body>
     ```
   - Notice: `utils/gamification-engine.js` is **currently absent** from both `options.html` and `popup.html`.

2. **GamificationEngine Exports**:
   - `utils/gamification-engine.js` (lines 151-157):
     ```javascript
     if (typeof window !== 'undefined') {
       window.GamificationEngine = GamificationEngine;
     }
     ```
   - Attached directly to `window.GamificationEngine` in browser extension pages.

3. **GamificationEngine Interface Contract**:
   - `BADGE_DEFINITIONS`: Array of 22 badge definitions across 3 categories (`time`: 8 badges / 1700 AP, `streak`: 7 badges / 1200 AP, `shield`: 7 badges / 1200 AP). Total possible AP: 4,100 AP.
   - `RANK_TIERS`: Array of 6 PUBG/Free Fire rank objects (`bronze_focus` [0-200], `silver_scholar` [200-500], `gold_mastermind` [500-1000], `diamond_warrior` [1000-2000], `heroic_monk` [2000-3500], `grandmaster_legend` [3500+]).
   - `calculateTotalAP(unlockedBadgeIds)`: Sums AP awards from badge IDs array.
   - `calculateTotalEXP(unlockedBadgeIds, totalLearningTimeSeconds)`: Badge EXP sum + `Math.floor(learningSecs / 6)`.
   - `calculateLevelFromEXP(totalEXP)`: Level math using $E(L) = 100L^2 + 100L - 200$. Returns `{ level, currentLevelThreshold, nextLevelThreshold, expInCurrentLevel, expNeededForNextLevel, progressPct }`.
   - `getRankTierFromAP(totalAP)`: Returns rank tier progression object `{ currentRank, nextRank, tierProgressPct, apInCurrentTier, apNeededForTier, apToNextRank, isMaxRank }`.

4. **Legacy UI & Storage Implementation**:
   - Legacy `options.js` (lines 254-267) currently hardcodes a 12-badge array with non-standard AP awards (e.g., 250, 1000, 2500, 5000 AP).
   - Legacy `options.js` (line 213) reads `gamification.totalPoints || 0`.
   - Legacy `popup.js` (line 141) reads `gamification.totalPoints || 0` and `gamification.rankTier || 'Bronze Focus'`.
   - M1 `time-tracker.js` (lines 250-266) populates both modern fields (`totalAP`, `totalEXP`, `level`, `rankId`, `rankTitle`) and legacy fallback fields (`totalPoints`, `rankTier`, `rankIcon`).

---

## 2. Logic Chain

1. **Script Tag Dependency**:
   - `options.js` and `popup.js` run immediately upon `DOMContentLoaded`.
   - To render battle-cards, rank icons, player level, level progress bars, and rank progress percentages, `options.js` and `popup.js` must call `GamificationEngine` methods and access `BADGE_DEFINITIONS` and `RANK_TIERS`.
   - If `utils/gamification-engine.js` is not included in HTML before `options.js` or `popup.js`, referencing `GamificationEngine` will throw an `Uncaught ReferenceError: GamificationEngine is not defined`.
   - Therefore, `<script src="../utils/gamification-engine.js"></script>` MUST be added to both `options.html` and `popup.html` before `<script src="options.js"></script>` / `<script src="popup.js"></script>`.

2. **Data Integration & Storage Fallback Logic**:
   - Storage retrieval via `StorageUtil.getTracking()` returns `tracking.gamification`.
   - For complete backward compatibility with existing user data:
     - `totalAP` retrieval priority: `gamification.totalAP ?? gamification.totalPoints ?? GamificationEngine.calculateTotalAP(gamification.badges || [])`.
     - `totalEXP` retrieval priority: `gamification.totalEXP ?? GamificationEngine.calculateTotalEXP(gamification.badges || [], totalLearningTimeSeconds)`.
     - Player Level & Level Progress Bar: Compute dynamically via `GamificationEngine.calculateLevelFromEXP(totalEXP)`.
     - Rank Tier & Rank Progress Bar: Compute dynamically via `GamificationEngine.getRankTierFromAP(totalAP)`.
     - Badge Grid: Render all 22 badges dynamically from `GamificationEngine.BADGE_DEFINITIONS`. Check unlock status via `(gamification.badges || []).includes(badge.id)`.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Script Tag | `options.html` Script Injection | Inject `utils/gamification-engine.js` tag before `options.js` | HTML DOM load | `window.GamificationEngine` global | `ReferenceError` if missing or loaded after `options.js` | `options/options.html:298-300` |
| 2 | Script Tag | `popup.html` Script Injection | Inject `utils/gamification-engine.js` tag before `popup.js` | HTML DOM load | `window.GamificationEngine` global | `ReferenceError` if missing or loaded after `popup.js` | `popup/popup.html:100-102` |
| 3 | Interface Contract | `BADGE_DEFINITIONS` Registry | Array of 22 badge objects (Time: 8, Streaks: 7, Shield: 7) | None | Array of badge objects `{ id, category, name, desc, icon, tier, ap, exp }` | N/A | `utils/gamification-engine.js:10-38` |
| 4 | Interface Contract | `RANK_TIERS` Registry | Array of 6 PUBG/Free Fire rank objects (Bronze to Grandmaster) | None | Array of rank objects `{ id, title, icon, minAP, maxAP, badgeClass, color }` | N/A | `utils/gamification-engine.js:43-50` |
| 5 | Interface Contract | `calculateTotalAP` | Calculates total AP from unlocked badge IDs | `unlockedBadgeIds` (Array) | Integer total AP | Returns 0 for invalid inputs | `utils/gamification-engine.js:57-63` |
| 6 | Interface Contract | `calculateTotalEXP` | Calculates total EXP from badges and learning time | `unlockedBadgeIds` (Array), `totalLearningTimeSeconds` (Number) | Integer total EXP | Returns 0 for invalid inputs | `utils/gamification-engine.js:71-78` |
| 7 | Interface Contract | `calculateLevelFromEXP` | Calculates player level & level progress percentage | `totalEXP` (Number) | Object `{ level, currentLevelThreshold, nextLevelThreshold, expInCurrentLevel, expNeededForNextLevel, progressPct }` | Negative EXP clamped to 0 (Level 1) | `utils/gamification-engine.js:85-103` |
| 8 | Interface Contract | `getRankTierFromAP` | Looks up current & next rank tier and AP progress | `totalAP` (Number) | Object `{ currentRank, nextRank, tierProgressPct, apInCurrentTier, apNeededForTier, apToNextRank, isMaxRank }` | AP clamped to >= 0; handles max rank | `utils/gamification-engine.js:110-148` |
| 9 | Data Integration | Storage Fallback Handling | Fallback handling for legacy tracking objects (`totalPoints` -> `totalAP`, missing `badges` array) | `chrome.storage.local` tracking | Deep-merged tracking object | Gracefully defaults missing fields | `utils/storage.js`, `utils/time-tracker.js` |

---

## 4. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `calculateTotalAP` | `null`, `undefined`, or `{}` | Returns `0` without throwing error. |
| 2 | `calculateTotalEXP` | `unlockedBadgeIds = null`, `learningTime = -10` | Clamps learning EXP component to 0, returns `0`. |
| 3 | `calculateLevelFromEXP` | `totalEXP = 0` | Level 1, `currentLevelThreshold: 0`, `nextLevelThreshold: 200`, `progressPct: 0`. |
| 4 | `calculateLevelFromEXP` | `totalEXP = 200` | Exact threshold for Level 2: `level: 2`, `currentLevelThreshold: 200`, `nextLevelThreshold: 600`, `progressPct: 0`. |
| 5 | `getRankTierFromAP` | `totalAP = 0` | Current Rank: Bronze Focus (0 AP), Next: Silver Scholar (200 AP), `tierProgressPct: 0`, `apToNextRank: 200`, `isMaxRank: false`. |
| 6 | `getRankTierFromAP` | `totalAP = 200` | Current Rank: Silver Scholar (200 AP), Next: Gold Mastermind (500 AP), `tierProgressPct: 0`, `apToNextRank: 300`, `isMaxRank: false`. |
| 7 | `getRankTierFromAP` | `totalAP = 3500` or higher (e.g. 4100 AP) | Current Rank: Grandmaster Legend (3500+ AP), Next: `null`, `tierProgressPct: 100`, `apToNextRank: 0`, `isMaxRank: true`. |
| 8 | Legacy Storage Migration | Storage contains legacy `totalPoints: 150` but no `totalAP` key | Implementer should check `gamification.totalAP ?? gamification.totalPoints ?? GamificationEngine.calculateTotalAP(badges)`. |
| 9 | Script Injection Order | `<script src="options.js"></script>` executed before `<script src="../utils/gamification-engine.js"></script>` | Uncaught ReferenceError on `GamificationEngine` access. |

---

## 5. Caveats

1. **Read-Only Scope**: This agent operates as a Specification Miner (read-only). Code changes to `options.html` and `popup.html` must be executed by the Implementer agent (`implementer_m2_1`).
2. **File Paths**: Relative paths from `options/options.html` and `popup/popup.html` to `utils/gamification-engine.js` are `../utils/gamification-engine.js`.
3. **No External CDN Dependencies**: Font and utility scripts are bundled locally to ensure CSP compliance.

---

## 6. Conclusion & Exact Recommendations

### Exact HTML `<script>` tags for `options.html`
Replace lines 298-300 in `options/options.html`:
```html
  <script src="../utils/storage.js"></script>
  <script src="../utils/gamification-engine.js"></script>
  <script src="options.js"></script>
```

### Exact HTML `<script>` tags for `popup.html`
Replace lines 100-102 in `popup/popup.html`:
```html
  <script src="../utils/storage.js"></script>
  <script src="../utils/gamification-engine.js"></script>
  <script src="popup.js"></script>
```

### UI Data Integration Pattern for Implementers
In both `options.js` and `popup.js`:
```javascript
const tracking = await StorageUtil.getTracking();
const gamification = tracking.gamification || {};
const unlockedBadges = Array.isArray(gamification.badges) ? gamification.badges : [];

// 1. AP calculation with legacy fallback
const totalAP = gamification.totalAP ?? gamification.totalPoints ?? GamificationEngine.calculateTotalAP(unlockedBadges);

// 2. Rank calculation
const rankInfo = GamificationEngine.getRankTierFromAP(totalAP);

// 3. EXP and Level calculation
const totalLearningTime = tracking.monthlyLearningTotal || 0; // or sum of dailyLearningTime
const totalEXP = gamification.totalEXP ?? GamificationEngine.calculateTotalEXP(unlockedBadges, totalLearningTime);
const levelInfo = GamificationEngine.calculateLevelFromEXP(totalEXP);
```

---

## 7. Verification Method

1. **Syntax Check**:
   Run `node -c utils/gamification-engine.js utils/storage.js options/options.js popup/popup.js` to ensure zero syntax errors across modified/dependent files.
2. **Script Tag Order Verification**:
   Inspect `options.html` and `popup.html` to confirm `<script src="../utils/gamification-engine.js"></script>` appears directly after `storage.js` and before `options.js` / `popup.js`.
3. **Console Execution Test**:
   Open Options page and Popup page in Chrome Extension developer mode, check Chrome Developer Tools Console for zero `GamificationEngine is not defined` errors.
