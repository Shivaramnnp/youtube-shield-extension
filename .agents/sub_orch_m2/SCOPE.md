# Scope: Milestone 2 — Battle-Card UI & Popup Integration

## Architecture
- Options Dashboard Achievements Redesign (`options/options.html`, `options/options.js`, `options/options.css`):
  - PUBG/Free Fire battle-card hero header card featuring rank tier icon emblem with glow, player level indicator, dual-layer animated EXP progress bar, total AP score, and next rank preview.
  - 4 Category Filter Pills (`All Badges`, `Time Milestones`, `Streaks`, `Shield Guard`) with active tab states.
  - Dynamic 22-badge battle card grid with tier gradient borders, glowing `+50 AP` pill tags for unlocked badges, dark obsidian grayscale styling with 🔒 lock overlays and progress indicators for locked badges.
- Extension Popup & Masthead Header UI (`popup/popup.html`, `popup/popup.js`, `popup/popup.css`, `content/js/header-button.js`):
  - Compact Rank Tier Banner displaying Rank Title, Level, AP score, and mini EXP progress bar.
  - Manifest scripts script tag updates in `options.html` and `popup.html` to load `utils/gamification-engine.js`.

## Features Assigned
1. Options Dashboard Achievements Tab Redesign (Hero Card, Category Filters, 22 Battle Cards, Tier Gradients).
2. Extension Popup & Masthead Banner (Rank Title, Level, AP Score, Mini EXP Bar).
3. Script Tag Integration (`utils/gamification-engine.js` included before dependent scripts).

## Interface Contracts
- Reads `tracking.gamification` from `chrome.storage.local` or calls `GamificationEngine.getRankTierFromAP` and `GamificationEngine.calculateLevelFromEXP`.
- Uses `GamificationEngine.BADGE_DEFINITIONS` and `GamificationEngine.RANK_TIERS`.
