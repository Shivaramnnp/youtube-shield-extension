# Handoff Report — Options Achievements Tab Redesign Specification (PUBG/Free Fire Battle-Card Aesthetic)

**Agent**: `teamwork_preview_explorer_m2_1` (Options Achievements UI Explorer)  
**Milestone**: M2 (Battle-Card UI & Popup Integration)  
**Target Files Analyzed**: `options/options.html`, `options/options.css`, `options/options.js`, `utils/gamification-engine.js`

---

## 1. Observation

### Codebase Inspection & Diagnostic Findings

1. **`utils/gamification-engine.js` Analysis (Lines 10–148)**:
   - Exposes `GamificationEngine` containing:
     - `BADGE_DEFINITIONS`: Complete registry of 22 badges (8 `time`, 7 `streak`, 7 `shield`) with `id`, `category`, `name`, `desc`, `icon`, `tier` (1–4), `ap` (50–500), `exp` (500–5000).
     - `RANK_TIERS`: 6 rank tiers (`bronze_focus`, `silver_scholar`, `gold_mastermind`, `diamond_warrior`, `heroic_monk`, `grandmaster_legend`) with AP thresholds (0, 200, 500, 1000, 2000, 3500+).
     - `calculateTotalAP(unlockedBadgeIds)`: Returns total AP score.
     - `calculateTotalEXP(unlockedBadgeIds, totalLearningTimeSeconds)`: Returns total EXP score.
     - `calculateLevelFromEXP(totalEXP)`: Computes level and EXP progress metrics using quadratic formula $E(L) = 100L^2 + 100L - 200$.
     - `getRankTierFromAP(totalAP)`: Computes current rank, next rank, AP needed, and tier progress percentage.

2. **`options/options.html` Gaps (Lines 238–283 & 298–300)**:
   - **Missing Script Tag**: Line 298 loads `../utils/storage.js` and line 299 loads `options.js`. `../utils/gamification-engine.js` is **missing** and must be added before `options.js`.
   - **Outdated `#gamification-tab` DOM Structure**:
     - Line 240–260: Uses an inline-styled `rank-banner-card` with static AP thresholds.
     - Missing Hero Battle Card header with rank emblem glow, player level indicator badge (`LVL X`), dual-layer animated EXP progress bar (`#battle-xp-fill`), total AP score (`#battle-ap-score`), and next rank preview (`#battle-next-tier-name`).
     - Missing category filter pills (`All Badges`, `Time Milestones`, `Streaks`, `Shield Guard`) with `data-category` attributes.
     - Grid container `#badges-container` (line 278) exists but currently lacks battle-card grid markup.

3. **`options/options.css` Gaps (Lines 290–328)**:
   - Line 296–328: Basic `.badges-grid` and `.badge-item` CSS with simple `filter: grayscale(100%)` and `opacity: 0.5`.
   - **Missing PUBG/Free Fire Aesthetic Rules**:
     - Metallic rank tier gradients (Bronze, Silver, Gold, Diamond, Heroic, Grandmaster).
     - Glowing `+50 AP` (and `+100 AP`, `+200 AP`, `+500 AP`) pill tags for unlocked badges.
     - Dark obsidian glassmorphism card styling for unlocked cards.
     - Grayscale dark obsidian styling with 🔒 lock overlays and progress indicators (e.g. `X/Y Mins`, `X/Y Days`, `X/Y Blocked`) for locked badges.
     - Keyframe animations `@keyframes xpStripes` (for animated EXP progress fill) and `@keyframes battleGlow` (for pulsing rank emblem glow ring).

4. **`options/options.js` Gaps (Lines 208–286)**:
   - Line 254–267: Hardcodes 12 badges in a local array instead of referencing `GamificationEngine.BADGE_DEFINITIONS` (22 badges).
   - Line 231–252: Custom math thresholds (200, 500, 1000, 2500, 5000) that contradict `GamificationEngine.RANK_TIERS`.
   - Missing integration with `GamificationEngine.getRankTierFromAP` and `GamificationEngine.calculateLevelFromEXP`.
   - Missing event handler for category filter pills (`All Badges`, `Time Milestones`, `Streaks`, `Shield Guard`).
   - Missing storage listener `chrome.storage.onChanged` to reactively update the UI when badges unlock in background.

---

## 2. Logic Chain

1. **Script Dependency Chain**:
   `options.html` executes `options.js` on `DOMContentLoaded`. `options.js` requires `GamificationEngine` to perform rank math and badge mapping. Therefore, `<script src="../utils/gamification-engine.js"></script>` must precede `<script src="options.js"></script>`.

2. **DOM Architecture Mapping**:
   The Hero Battle Card header in `#gamification-tab` must display:
   - Rank emblem icon with a metallic glow container (`#battle-rank-icon` / `#battle-rank-emblem`).
   - Player level badge indicator (`#battle-level-badge` displaying `LVL X`).
   - Rank title (`#battle-rank-name`).
   - Total AP score pill (`#battle-ap-score`).
   - Next rank preview text (`#battle-next-tier-name`).
   - Dual-layer animated EXP progress bar: track container, primary animated fill (`#battle-xp-fill`), and percentage text (`#battle-xp-text`).
   - Filter bar with 4 pills (`data-category="all"`, `data-category="time"`, `data-category="streak"`, `data-category="shield"`).
   - Dynamic 22-badge battle card grid container (`#badges-container`).

3. **Visual Styling Engine**:
   PUBG and Free Fire battle-cards feature dark obsidian metallic surfaces (`#0f172a`, `#1e293b`), glowing neon accents, and metallic border gradients matched to rank tiers. Keyframe animation `@keyframes xpStripes` creates a moving barber-shop stripe effect on the EXP bar, while `@keyframes battleGlow` creates a pulsating neon aura around the rank emblem. Locked badges receive dark obsidian grayscale styling, lock overlays (`🔒`), and progress indicators.

4. **Dynamic Data & Reactive Binding**:
   `options.js` reads `tracking` from `StorageUtil.getTracking()`. It calls `GamificationEngine.calculateTotalAP(unlockedBadges)` and `GamificationEngine.calculateTotalEXP(unlockedBadges, totalLearningTimeSeconds)`. Stats are fed into `GamificationEngine.getRankTierFromAP` and `GamificationEngine.calculateLevelFromEXP`. All 22 badges from `BADGE_DEFINITIONS` are rendered into `#badges-container`. Filter tab clicks update the visibility of cards via `data-category` attributes. `chrome.storage.onChanged` triggers UI refresh on storage updates.

---

## 3. Caveats

- **Read-Only Scope**: This report provides exact implementation specifications. Source code edits will be performed by the designated implementer agent.
- **Initial Install State**: On clean install, `tracking.gamification.badges` / `unlockedBadges` is empty (`[]`). JS logic safely defaults `unlockedBadges` to `[]`, resulting in Level 1, 0 AP, and Bronze Focus rank.
- **Progress Metrics for Locked Badges**: Progress text calculation for locked badges requires reading `totalLearningTimeSeconds`, `currentStreak` / `longestStreak`, and `totalShortsBlocked` from `tracking`. Fallbacks (`0`) are provided for missing values.

---

## 4. Conclusion & Technical Implementation Specs

### A. HTML DOM Structure Specifications (`options/options.html`)

1. **Include `gamification-engine.js` Script Tag**:
   Add before line 299 in `options/options.html`:
   ```html
   <script src="../utils/storage.js"></script>
   <script src="../utils/gamification-engine.js"></script>
   <script src="options.js"></script>
   ```

2. **Redesign `#gamification-tab` DOM Structure**:
   Replace lines 239–282 in `options/options.html` with the following structure:
   ```html
   <!-- Gamification Tab -->
   <div id="gamification-tab" class="tab-content" role="tabpanel">
     
     <!-- Hero Battle Card Header -->
     <div class="battle-card-hero">
       <div class="battle-hero-top">
         <div class="rank-emblem-glow-ring" id="battle-rank-emblem-container">
           <span id="battle-rank-icon" class="rank-emblem-icon rank-bronze">🥉</span>
           <div id="battle-level-badge" class="battle-level-badge">LVL 1</div>
         </div>

         <div class="battle-hero-info">
           <div class="battle-subtitle">PLAYER RANK & PROGRESSION</div>
           <h2 id="battle-rank-name" class="battle-rank-title">Bronze Focus</h2>
           <div id="battle-next-tier-name" class="battle-next-rank-text">Next Rank: Silver Scholar (200 AP needed)</div>
         </div>

         <div class="battle-ap-card">
           <span class="ap-card-label">TOTAL AP SCORE</span>
           <div class="ap-card-value-container">
             <span class="ap-icon">⚡</span>
             <span id="battle-ap-score" class="ap-card-value">0 AP</span>
           </div>
         </div>
       </div>

       <!-- Dual-Layer Animated EXP Progress Bar -->
       <div class="battle-xp-wrapper">
         <div class="battle-xp-labels">
           <span class="xp-title">PLAYER EXP PROGRESS</span>
           <span id="battle-xp-text" class="xp-stats">0 / 200 EXP (0%)</span>
         </div>
         <div class="battle-xp-track">
           <div id="battle-xp-fill" class="battle-xp-fill" style="width: 0%;"></div>
           <div id="battle-xp-glow" class="battle-xp-glow" style="width: 0%;"></div>
         </div>
       </div>
     </div>

     <!-- Learning Streaks Quick Stats Card -->
     <div class="card battle-streaks-card">
       <h2>Learning Streaks</h2>
       <div class="stats-grid">
         <div class="stat-box highlight">
           <h4>Current Streak</h4>
           <div id="stat-current-streak" class="stat-value">0 Days</div>
         </div>
         <div class="stat-box">
           <h4>Longest Streak</h4>
           <div id="stat-longest-streak" class="stat-value">0 Days</div>
         </div>
       </div>
     </div>

     <!-- Category Filter Pills Bar & Badges Section -->
     <div class="card battle-badges-section">
       <div class="battle-badges-header">
         <h2>Achievement Badges & Battle Cards</h2>
         <div class="category-filters" id="category-filter-pills">
           <button class="filter-pill active" data-category="all">All Badges <span class="pill-count">(22)</span></button>
           <button class="filter-pill" data-category="time">Time Milestones <span class="pill-count">(8)</span></button>
           <button class="filter-pill" data-category="streak">Streaks <span class="pill-count">(7)</span></button>
           <button class="filter-pill" data-category="shield">Shield Guard <span class="pill-count">(7)</span></button>
         </div>
       </div>

       <!-- Dynamic 22-Badge Grid Container -->
       <div class="badges-grid battle-grid" id="badges-container">
         <!-- Populated dynamically by options.js -->
       </div>
     </div>

   </div>
   ```

---

### B. CSS Rule Specifications (`options/options.css`)

Append/replace gamification CSS rules in `options/options.css`:

```css
/* ==========================================================================
   PUBG / Free Fire Battle-Card Hero Aesthetic & Achievements Tab Styling
   ========================================================================== */

/* Hero Battle Card Container */
.battle-card-hero {
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
  border: 1px solid rgba(168, 85, 247, 0.35);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.battle-card-hero::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%);
  pointer-events: none;
}

.battle-hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

/* Rank Emblem Glow & Level Badge */
.rank-emblem-glow-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.15);
  animation: battleGlow 3s infinite ease-in-out;
}

.rank-emblem-icon {
  font-size: 42px;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6));
}

.battle-level-badge {
  position: absolute;
  bottom: -6px;
  background: linear-gradient(135deg, #a855f7, #6366f1);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 10px;
  letter-spacing: 0.05em;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

/* Rank Text Info */
.battle-hero-info {
  flex: 1;
  min-width: 200px;
}

.battle-subtitle {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #a5b4fc;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.battle-rank-title {
  font-size: 26px;
  font-weight: 900;
  color: #ffffff;
  margin: 0 0 4px 0;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.battle-next-rank-text {
  font-size: 13px;
  color: #c7d2fe;
  font-weight: 500;
}

/* AP Total Score Card */
.battle-ap-card {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(251, 191, 36, 0.3);
  padding: 12px 20px;
  border-radius: 12px;
  text-align: right;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.ap-card-label {
  display: block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #fcd34d;
  margin-bottom: 2px;
}

.ap-card-value-container {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}

.ap-icon {
  font-size: 18px;
}

.ap-card-value {
  font-size: 22px;
  font-weight: 900;
  color: #fbbf24;
  text-shadow: 0 0 12px rgba(251, 191, 36, 0.4);
}

/* Dual-Layer Animated EXP Progress Bar */
.battle-xp-wrapper {
  margin-top: 10px;
}

.battle-xp-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 6px;
}

.xp-title {
  color: #a5b4fc;
  letter-spacing: 0.05em;
}

.xp-stats {
  color: #e0e7ff;
}

.battle-xp-track {
  position: relative;
  height: 16px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.6);
}

.battle-xp-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899);
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.25) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.25) 50%,
    rgba(255, 255, 255, 0.25) 75%,
    transparent 75%,
    transparent
  );
  background-size: 24px 24px;
  border-radius: 12px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  animation: xpStripes 1.5s linear infinite;
  box-shadow: 0 0 12px rgba(168, 85, 247, 0.6);
}

.battle-xp-glow {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  pointer-events: none;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Metallic Rank Gradients & Badges */
.rank-bronze { border-color: #cd7f32; box-shadow: 0 0 15px rgba(205, 127, 50, 0.4); }
.rank-silver { border-color: #c0c0c0; box-shadow: 0 0 15px rgba(192, 192, 192, 0.4); }
.rank-gold { border-color: #ffd700; box-shadow: 0 0 18px rgba(255, 215, 0, 0.5); }
.rank-diamond { border-color: #00bfff; box-shadow: 0 0 20px rgba(0, 191, 255, 0.6); }
.rank-heroic { border-color: #9370db; box-shadow: 0 0 22px rgba(147, 112, 219, 0.7); }
.rank-grandmaster { border-color: #ff4500; box-shadow: 0 0 25px rgba(255, 69, 0, 0.8); }

/* Category Filter Pills */
.battle-badges-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 12px;
}

.battle-badges-header h2 {
  margin: 0;
  border-bottom: none;
  padding-bottom: 0;
}

.category-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-pill {
  background: rgba(15, 23, 42, 0.6);
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.filter-pill:hover {
  color: #f1f5f9;
  border-color: rgba(168, 85, 247, 0.4);
  background: rgba(30, 41, 59, 0.8);
}

.filter-pill.active {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #ffffff;
  border-color: #a855f7;
  box-shadow: 0 0 12px rgba(124, 58, 237, 0.4);
}

.pill-count {
  font-size: 11px;
  opacity: 0.8;
  margin-left: 2px;
}

/* 22-Badge Battle Card Grid */
.battle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

/* Battle Card Element */
.battle-badge-card {
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* Unlocked Battle Card State */
.battle-badge-card.earned {
  border: 1px solid rgba(168, 85, 247, 0.4);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.battle-badge-card.earned:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(168, 85, 247, 0.25);
  border-color: #a855f7;
}

/* Tier Border Accents */
.battle-badge-card.tier-1.earned { border-color: rgba(205, 127, 50, 0.6); }
.battle-badge-card.tier-2.earned { border-color: rgba(192, 192, 192, 0.6); }
.battle-badge-card.tier-3.earned { border-color: rgba(255, 215, 0, 0.7); }
.battle-badge-card.tier-4.earned { border-color: rgba(0, 191, 255, 0.8); box-shadow: 0 0 16px rgba(0, 191, 255, 0.3); }

/* Card Header (Icon + Glowing AP Pill) */
.badge-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.badge-card-icon {
  font-size: 34px;
  line-height: 1;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
}

.badge-ap-tag {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.3));
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.5);
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.3);
  font-size: 11px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 12px;
  letter-spacing: 0.02em;
}

.badge-card-title {
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
  margin-bottom: 4px;
}

.badge-card-desc {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 14px;
  line-height: 1.4;
  flex: 1;
}

/* Status Elements */
.badge-status-unlocked {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #4ade80;
  font-size: 12px;
  font-weight: 700;
  background: rgba(74, 222, 128, 0.1);
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid rgba(74, 222, 128, 0.2);
  align-self: flex-start;
}

/* Locked Battle Card State (Dark Obsidian Grayscale + Lock Overlay) */
.battle-badge-card.locked {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.06);
  filter: grayscale(100%);
  opacity: 0.65;
}

.battle-badge-card.locked:hover {
  opacity: 0.85;
  filter: grayscale(70%);
}

.badge-status-locked {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.badge-lock-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}

.badge-mini-track {
  height: 6px;
  background: rgba(30, 41, 59, 0.9);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.badge-mini-bar {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #a855f7);
  border-radius: 6px;
}

/* Keyframe Animations */
@keyframes battleGlow {
  0%, 100% {
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.5), inset 0 0 12px rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.4);
  }
  50% {
    box-shadow: 0 0 24px rgba(168, 85, 247, 0.8), inset 0 0 20px rgba(168, 85, 247, 0.4);
    border-color: rgba(168, 85, 247, 0.8);
  }
}

@keyframes xpStripes {
  0% { background-position: 0 0; }
  100% { background-position: 48px 0; }
}
```

---

### C. JavaScript Specifications (`options/options.js`)

Replace lines 208–286 of `options/options.js` with the following modular logic:

```javascript
  // ==========================================================================
  // Gamification & Battle Card Dashboard Module
  // ==========================================================================
  const renderBattleDashboard = () => {
    if (typeof GamificationEngine === 'undefined') {
      console.warn('GamificationEngine is not loaded.');
      return;
    }

    const gamification = tracking.gamification || {};
    const unlockedBadges = Array.isArray(gamification.unlockedBadges)
      ? gamification.unlockedBadges
      : (Array.isArray(gamification.badges) ? gamification.badges : []);

    const totalLearningTimeSecs = tracking.totalLearningTimeSeconds || 0;
    const currentStreak = gamification.currentStreak || 0;
    const longestStreak = gamification.longestStreak || 0;
    const totalShortsBlocked = tracking.totalShortsBlocked || 0;

    // Update Streak Boxes
    const currentStreakEl = document.getElementById('stat-current-streak');
    const longestStreakEl = document.getElementById('stat-longest-streak');
    if (currentStreakEl) currentStreakEl.textContent = `${currentStreak} Days`;
    if (longestStreakEl) longestStreakEl.textContent = `${longestStreak} Days`;

    // Compute Stats via GamificationEngine
    const totalAP = GamificationEngine.calculateTotalAP(unlockedBadges);
    const totalEXP = GamificationEngine.calculateTotalEXP(unlockedBadges, totalLearningTimeSecs);
    const rankInfo = GamificationEngine.getRankTierFromAP(totalAP);
    const levelInfo = GamificationEngine.calculateLevelFromEXP(totalEXP);

    // Update Hero Battle Card Header
    const rankIconEl = document.getElementById('battle-rank-icon');
    const rankNameEl = document.getElementById('battle-rank-name');
    const levelBadgeEl = document.getElementById('battle-level-badge');
    const totalApEl = document.getElementById('battle-ap-score');
    const nextTierEl = document.getElementById('battle-next-tier-name');
    const xpFillEl = document.getElementById('battle-xp-fill');
    const xpGlowEl = document.getElementById('battle-xp-glow');
    const xpTextEl = document.getElementById('battle-xp-text');

    if (rankIconEl) {
      rankIconEl.textContent = rankInfo.currentRank.icon;
      rankIconEl.className = `rank-emblem-icon ${rankInfo.currentRank.badgeClass}`;
    }
    if (rankNameEl) rankNameEl.textContent = rankInfo.currentRank.title;
    if (levelBadgeEl) levelBadgeEl.textContent = `LVL ${levelInfo.level}`;
    if (totalApEl) totalApEl.textContent = `${totalAP} AP`;

    if (nextTierEl) {
      if (rankInfo.isMaxRank) {
        nextTierEl.textContent = 'MAX RANK REACHED — Grandmaster Legend';
      } else {
        nextTierEl.textContent = `Next Rank: ${rankInfo.nextRank.title} (${rankInfo.apToNextRank} AP needed)`;
      }
    }

    if (xpFillEl) xpFillEl.style.width = `${levelInfo.progressPct}%`;
    if (xpGlowEl) xpGlowEl.style.width = `${levelInfo.progressPct}%`;
    if (xpTextEl) {
      xpTextEl.textContent = `${levelInfo.expInCurrentLevel.toLocaleString()} / ${levelInfo.expNeededForNextLevel.toLocaleString()} EXP (${levelInfo.progressPct}%)`;
    }

    // Helper to calculate progress metrics for locked badges
    const getBadgeProgress = (badge) => {
      let current = 0;
      let target = 1;
      let unit = '';

      if (badge.category === 'time') {
        const currentMins = Math.floor(totalLearningTimeSecs / 60);
        unit = 'Mins';
        if (badge.id === 'first_step') target = 15;
        else if (badge.id === 'focus_rookie') target = 60;
        else if (badge.id === 'deep_diver') target = 300;
        else if (badge.id === 'dedicated_scholar') target = 600;
        else if (badge.id === 'mastermind') target = 1500;
        else if (badge.id === 'study_warrior') target = 3000;
        else if (badge.id === 'focus_legend') target = 6000;
        else if (badge.id === 'grandmaster_scholar') target = 15000;
        current = currentMins;
      } else if (badge.category === 'streak') {
        unit = 'Days';
        if (badge.id === 'streak_starter') target = 2;
        else if (badge.id === 'consistency_master') target = 3;
        else if (badge.id === 'week_warrior') target = 7;
        else if (badge.id === 'fortnight_master') target = 14;
        else if (badge.id === 'monthly_monk') target = 30;
        else if (badge.id === 'sixty_day_sage') target = 60;
        else if (badge.id === 'centurion_streak') target = 100;
        current = currentStreak;
      } else if (badge.category === 'shield') {
        unit = 'Shorts';
        if (badge.id === 'shorts_defender') target = 10;
        else if (badge.id === 'distraction_slayer') target = 100;
        else if (badge.id === 'shield_master') target = 500;
        else target = 1;
        current = totalShortsBlocked;
      }

      const pct = Math.min(100, Math.floor((current / target) * 100));
      return { current: Math.min(current, target), target, unit, pct };
    };

    // Render 22 Badges Dynamically
    const badgesContainer = document.getElementById('badges-container');
    if (badgesContainer) {
      badgesContainer.innerHTML = '';

      GamificationEngine.BADGE_DEFINITIONS.forEach(badge => {
        const isEarned = unlockedBadges.includes(badge.id);
        const card = document.createElement('div');
        card.className = `battle-badge-card tier-${badge.tier} ${isEarned ? 'earned' : 'locked'}`;
        card.dataset.category = badge.category;
        card.dataset.id = badge.id;

        if (isEarned) {
          card.innerHTML = `
            <div class="badge-card-header">
              <div class="badge-card-icon">${badge.icon}</div>
              <div class="badge-ap-tag">+${badge.ap} AP</div>
            </div>
            <div class="badge-card-title">${badge.name}</div>
            <div class="badge-card-desc">${badge.desc}</div>
            <div class="badge-status-unlocked">
              <span>✓</span> Unlocked
            </div>
          `;
        } else {
          const prog = getBadgeProgress(badge);
          card.innerHTML = `
            <div class="badge-card-header">
              <div class="badge-card-icon">${badge.icon}</div>
              <div class="badge-ap-tag">+${badge.ap} AP</div>
            </div>
            <div class="badge-card-title">${badge.name}</div>
            <div class="badge-card-desc">${badge.desc}</div>
            <div class="badge-status-locked">
              <div class="badge-lock-row">
                <span>🔒 Locked</span>
                <span>${prog.current}/${prog.target} ${prog.unit}</span>
              </div>
              <div class="badge-mini-track">
                <div class="badge-mini-bar" style="width: ${prog.pct}%"></div>
              </div>
            </div>
          `;
        }
        badgesContainer.appendChild(card);
      });
    }
  };

  // Initial Render
  renderBattleDashboard();

  // Category Filter Pills Event Handling
  const filterPills = document.querySelectorAll('#category-filter-pills .filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const cat = pill.dataset.category;
      const cards = document.querySelectorAll('#badges-container .battle-badge-card');
      cards.forEach(card => {
        if (cat === 'all' || card.dataset.category === cat) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Reactive Storage Change Listener for Gamification Updates
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.tracking) {
        tracking = changes.tracking.newValue || tracking;
        renderBattleDashboard();
      }
    });
  }
```

---

## 5. Verification Method

1. **Syntax Integrity Verification**:
   Execute Node syntax checks across all JS files:
   ```bash
   node -c utils/gamification-engine.js
   node -c options/options.js
   ```

2. **DOM Integration Check**:
   Confirm script inclusion order in `options/options.html`:
   - `utils/storage.js` -> `utils/gamification-engine.js` -> `options.js`
   - Verify elements `#battle-xp-fill`, `#battle-ap-score`, `#battle-next-tier-name`, and `#badges-container` exist in `options/options.html`.

3. **Battle Card UI Verification**:
   - Filter pills (`All Badges`, `Time Milestones`, `Streaks`, `Shield Guard`) correctly show/hide matching badge cards.
   - All 22 badge definitions render with correct tier borders and glowing `+AP` pills.
