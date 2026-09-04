# Handoff Report: Extension Popup & Masthead Banner UI Implementation Spec (M2)

**Agent ID**: `teamwork_preview_explorer_m2_2`  
**Role**: Popup & Masthead UI Explorer  
**Working Directory**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_explorer_m2_2/`  
**Target Files**: `popup/popup.html`, `popup/popup.css`, `popup/popup.js`, `content/js/header-button.js`, `content/css/header-button.css`, `manifest.json`

---

## 1. Observation

### 1.1 Existing Popup Structure (`popup/popup.html`)
- Lines 81-98 contain `.stats-container` with a static text row for Player Rank:
  ```html
  <div class="stat-row">
    <span>Player Rank:</span>
    <span id="popup-rank-tier">🥉 Bronze Focus (0 AP)</span>
  </div>
  ```
- Lines 100-101 include scripts:
  ```html
  <script src="../utils/storage.js"></script>
  <script src="popup.js"></script>
  ```
- `utils/gamification-engine.js` is **missing** from `popup.html` script tags.

### 1.2 Existing Popup Script Logic (`popup/popup.js`)
- Lines 138-143 attempt to render rank info from storage:
  ```javascript
  const gamification = tracking.gamification || {};
  const rankIcon = gamification.rankIcon || '🥉';
  const rankTier = gamification.rankTier || 'Bronze Focus';
  const totalAP = gamification.totalPoints || 0;
  const rankEl = document.getElementById('popup-rank-tier');
  if (rankEl) rankEl.textContent = `${rankIcon} ${rankTier} (${totalAP} AP)`;
  ```
- Does **not** compute Level, EXP, or mini EXP fill bar.
- Does **not** listen for `chrome.storage.onChanged` to update rank/EXP dynamically when storage updates in real-time.

### 1.3 Existing Popup CSS (`popup/popup.css`)
- Contains basic styling for `.stats-container` and `.stat-row` (lines 199-234).
- Lacks Gamer HUD rank banner container (`.popup-rank-banner`), level badge (`.level-badge`), AP score badge (`.ap-score-badge`), and mini EXP progress bar fill (`#popup-xp-fill`).

### 1.4 Existing Masthead Header Button (`content/js/header-button.js` & `content/css/header-button.css` & `manifest.json`)
- `header-button.js` creates `#ss-popup-dialog` on YouTube. Lines 270-274 hardcode static text `🥉 Bronze Focus (0 AP)` for `#ss-popup-rank-tier`.
- `wirePopupEvents` (lines 395-420) updates daily time and focus score, but completely ignores rank, level, AP score, and EXP.
- `manifest.json` line 33 does **not** include `"utils/gamification-engine.js"` under `content_scripts.js`.

---

## 2. Logic Chain

1. **Gamification Math Engine Integration**:
   - `GamificationEngine` (in `utils/gamification-engine.js`) exposes `calculateTotalAP()`, `calculateTotalEXP()`, `calculateLevelFromEXP()`, and `getRankTierFromAP()`.
   - Adding `<script src="../utils/gamification-engine.js"></script>` to `popup.html` allows `popup.js` to compute accurate Rank, Level, AP score, and EXP progress percentage from raw badge data and learning time.
   - Adding `"utils/gamification-engine.js"` to `manifest.json` under `content_scripts` makes `GamificationEngine` available to `header-button.js` on YouTube pages.

2. **Gamer HUD Banner DOM & CSS**:
   - Designing a `.popup-rank-banner` container with metallic obsidian background, tier-based glow borders (`.rank-bronze`, `.rank-silver`, `.rank-gold`, `.rank-diamond`, `.rank-heroic`, `.rank-grandmaster`), level badge (`.level-badge`), AP score badge (`.ap-score-badge`), and mini animated EXP fill bar (`#popup-xp-fill`) fulfills requirements R2 and R3.
   - Maintaining the legacy `#popup-rank-tier` element inside `.stats-container` ensures full backward compatibility with tests.

3. **Dynamic Real-Time Sync**:
   - Registering a `chrome.storage.onChanged` listener in `popup.js` ensures that when time tracking updates in the background or options tab updates badges, the popup banner automatically updates without requiring a manual popup re-open.
   - In `header-button.js`, adding `.ss-popup-rank-banner` inside `#ss-popup-dialog` and calculating rank stats in `wirePopupEvents` keeps the content script masthead popup perfectly synchronized with the main extension popup.

---

## 3. Caveats

- **Context Validity**: Chrome extensions can unload popup contexts when closed. DOM elements must be guarded with `null` checks before manipulation.
- **Fallback Math**: `popup.js` and `header-button.js` should check `typeof GamificationEngine !== 'undefined'` and fall back gracefully to `tracking.gamification` properties if the engine is loading asynchronously or unavailable.
- **Content Script Isolation**: All CSS rules in `content/css/header-button.css` require `!important` to prevent YouTube's global CSS styles from overriding the masthead popup banner layout.

---

## 4. Conclusion & Implementation Specs

### Spec 1: `popup/popup.html` Modifications
1. Add `<script src="../utils/gamification-engine.js"></script>` right before `<script src="../utils/storage.js"></script>`.
2. Insert `.popup-rank-banner` right after `.study-card` (above `.toggles-container`):
```html
<div class="popup-rank-banner" id="popup-rank-banner">
  <div class="rank-banner-header">
    <div class="rank-title-group">
      <span class="rank-emblem" id="popup-rank-icon">🥉</span>
      <span class="rank-name" id="popup-rank-title">Bronze Focus</span>
    </div>
    <div class="rank-badges-group">
      <span class="level-badge" id="popup-level-badge">LVL 1</span>
      <span class="ap-score-badge" id="popup-ap-score">⭐ 0 AP</span>
    </div>
  </div>
  <div class="xp-bar-container">
    <div class="xp-bar-track">
      <div class="xp-bar-fill" id="popup-xp-fill" style="width: 0%;"></div>
    </div>
    <div class="xp-bar-meta">
      <span class="xp-bar-text" id="popup-xp-text">0 / 200 EXP</span>
      <span class="xp-bar-pct" id="popup-xp-pct">0%</span>
    </div>
  </div>
</div>
```

### Spec 2: `popup/popup.css` Modifications
Add the following Gamer HUD rank banner styles:
```css
/* Gamer HUD Style Rank Banner */
.popup-rank-banner {
  margin: 12px 16px;
  padding: 12px 14px;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  overflow: hidden;
}

/* Tier Specific Border & Glow Modifiers */
.popup-rank-banner.rank-bronze { border-color: rgba(205, 127, 50, 0.4); box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 8px rgba(205,127,50,0.15); }
.popup-rank-banner.rank-silver { border-color: rgba(192, 192, 192, 0.4); box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 8px rgba(192,192,192,0.15); }
.popup-rank-banner.rank-gold   { border-color: rgba(255, 215, 0, 0.4); box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 8px rgba(255,215,0,0.2); }
.popup-rank-banner.rank-diamond{ border-color: rgba(0, 191, 255, 0.4); box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 10px rgba(0,191,255,0.25); }
.popup-rank-banner.rank-heroic { border-color: rgba(147, 112, 219, 0.5); box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 10px rgba(147,112,219,0.3); }
.popup-rank-banner.rank-grandmaster { border-color: rgba(255, 69, 0, 0.6); box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 12px rgba(255,69,0,0.35); }

.rank-banner-header { display: flex; justify-content: space-between; align-items: center; }
.rank-title-group { display: flex; align-items: center; gap: 8px; }
.rank-emblem { font-size: 20px; filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.3)); line-height: 1; }
.rank-name { font-size: 14px; font-weight: 700; color: #ffffff; letter-spacing: 0.3px; }
.rank-badges-group { display: flex; align-items: center; gap: 6px; }

.level-badge {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
  letter-spacing: 0.5px;
}

.ap-score-badge {
  background: rgba(255, 215, 0, 0.12);
  color: #ffd700;
  border: 1px solid rgba(255, 215, 0, 0.35);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
}

.xp-bar-container { display: flex; flex-direction: column; gap: 4px; }
.xp-bar-track { height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden; position: relative; }
.xp-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #06b6d4 50%, #10b981 100%);
  border-radius: 4px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 8px rgba(6, 182, 212, 0.5);
}
.xp-bar-meta { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
```

### Spec 3: `popup/popup.js` Modifications
Add `updateGamificationUI(tracking)` function and `chrome.storage.onChanged` listener:
```javascript
function updateGamificationUI(tracking) {
  if (!tracking) return;
  const gamification = tracking.gamification || {};
  const unlockedBadges = gamification.badges || [];
  
  const dailyLearning = tracking.dailyLearningTime || {};
  const totalLearningSeconds = Object.values(dailyLearning).reduce((sum, v) => sum + (Number(v) || 0), 0);

  let totalAP = gamification.totalAP || 0;
  let totalEXP = gamification.totalEXP || 0;
  let levelInfo = { level: gamification.level || 1, expInCurrentLevel: 0, expNeededForNextLevel: 100, progressPct: gamification.expProgressPct || 0 };
  let rankInfo = null;

  if (typeof GamificationEngine !== 'undefined') {
    totalAP = GamificationEngine.calculateTotalAP(unlockedBadges);
    totalEXP = GamificationEngine.calculateTotalEXP(unlockedBadges, totalLearningSeconds);
    levelInfo = GamificationEngine.calculateLevelFromEXP(totalEXP);
    rankInfo = GamificationEngine.getRankTierFromAP(totalAP);
  }

  const rankIcon = rankInfo ? rankInfo.currentRank.icon : (gamification.rankIcon || '🥉');
  const rankTitle = rankInfo ? rankInfo.currentRank.title : (gamification.rankTitle || 'Bronze Focus');
  const badgeClass = rankInfo ? rankInfo.currentRank.badgeClass : 'rank-bronze';

  const bannerEl = document.getElementById('popup-rank-banner');
  if (bannerEl) bannerEl.className = 'popup-rank-banner ' + badgeClass;

  const iconEl = document.getElementById('popup-rank-icon');
  if (iconEl) iconEl.textContent = rankIcon;

  const titleEl = document.getElementById('popup-rank-title');
  if (titleEl) titleEl.textContent = rankTitle;

  const levelEl = document.getElementById('popup-level-badge');
  if (levelEl) levelEl.textContent = `LVL ${levelInfo.level}`;

  const apEl = document.getElementById('popup-ap-score');
  if (apEl) apEl.textContent = `⭐ ${totalAP.toLocaleString()} AP`;

  const fillEl = document.getElementById('popup-xp-fill');
  if (fillEl) fillEl.style.width = `${levelInfo.progressPct}%`;

  const textEl = document.getElementById('popup-xp-text');
  if (textEl) textEl.textContent = `${levelInfo.expInCurrentLevel} / ${levelInfo.expNeededForNextLevel} EXP`;

  const pctEl = document.getElementById('popup-xp-pct');
  if (pctEl) pctEl.textContent = `${levelInfo.progressPct}%`;

  // Legacy stat row update
  const rankEl = document.getElementById('popup-rank-tier');
  if (rankEl) rankEl.textContent = `${rankIcon} ${rankTitle} (${totalAP} AP)`;
}

// Inside DOMContentLoaded:
updateGamificationUI(tracking);

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.tracking) {
      updateGamificationUI(changes.tracking.newValue || {});
    }
  });
}
```

### Spec 4: Masthead Synchronization (`manifest.json`, `content/js/header-button.js`, `content/css/header-button.css`)
1. **`manifest.json`**:
   Add `"utils/gamification-engine.js"` to `content_scripts[0].js` array before `"utils/storage.js"`.
2. **`content/js/header-button.js`**:
   - Add `.ss-popup-rank-banner` container HTML to `openPopup()` inside `#ss-popup-dialog`.
   - In `wirePopupEvents()`, compute `totalAP`, `totalEXP`, `levelInfo`, `rankInfo` and update `#ss-popup-rank-icon`, `#ss-popup-rank-title`, `#ss-popup-level-badge`, `#ss-popup-ap-score`, `#ss-popup-xp-fill`, `#ss-popup-xp-text`, `#ss-popup-xp-pct`, `#ss-popup-rank-tier`.
3. **`content/css/header-button.css`**:
   - Add scoped CSS rules with `!important` for `.ss-popup-rank-banner`, `.ss-level-badge`, `.ss-ap-score-badge`, `.ss-xp-bar-track`, `.ss-xp-bar-fill`.

---

## 5. Verification Method

To verify the implementation once applied:
1. Run static syntax check across all JavaScript files:
   ```bash
   node tests/syntax/syntax-checker.js
   ```
2. Run full test suite:
   ```bash
   node run-tests.js
   ```
3. Inspect `popup/popup.html` and verify script tag inclusion order (`gamification-engine.js` -> `storage.js` -> `popup.js`).
4. Inspect `manifest.json` and verify `utils/gamification-engine.js` presence in `content_scripts`.
