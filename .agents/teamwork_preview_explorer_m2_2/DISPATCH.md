## 2026-08-09T10:54:17Z
You are teamwork_preview_explorer_m2_2 (Popup & Masthead UI Explorer).
Working directory: /Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_explorer_m2_2/

Read context files first:
- /Users/shivarampatel/Desktop/shorts-shield/.agents/ORIGINAL_REQUEST.md
- /Users/shivarampatel/Desktop/shorts-shield/PROJECT.md
- /Users/shivarampatel/Desktop/shorts-shield/.agents/sub_orch_m2/SCOPE.md
- /Users/shivarampatel/Desktop/shorts-shield/utils/gamification-engine.js
- /Users/shivarampatel/Desktop/shorts-shield/popup/popup.html
- /Users/shivarampatel/Desktop/shorts-shield/popup/popup.js
- /Users/shivarampatel/Desktop/shorts-shield/popup/popup.css
- /Users/shivarampatel/Desktop/shorts-shield/content/js/header-button.js

Your task:
Investigate and detail exact implementation specs for the Extension Popup & Masthead Banner:
1. HTML DOM Structure (`popup/popup.html`):
   - Add compact Rank Tier Banner displaying Rank Emblem & Title (e.g. 💎 Diamond Warrior), Level (LVL X), Total AP score (⭐ X AP), and mini EXP progress bar (#popup-xp-fill).
2. CSS Styling (`popup/popup.css`):
   - Gamer HUD style rank banner, level badge, AP score badge, mini animated EXP fill bar.
3. JS Logic (`popup/popup.js`):
   - Read tracking data from chrome.storage.local / StorageUtil.
   - Calculate Rank, Level, AP score, and EXP progress using GamificationEngine.
   - Update popup DOM elements on load and chrome.storage.onChanged listener if applicable.
4. Masthead Button Sync (`content/js/header-button.js`):
   - Inspect existing header button dialog to determine if any rank badge or level indicator should be displayed or synced.

Write your complete handoff report to /Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_explorer_m2_2/handoff.md.
Also send a concise message to parent orchestrator referencing your handoff report path.
