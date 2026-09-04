# Shorts Shield Gamification System — Comprehensive Feature Mapping & E2E Test Specification

## 1. Executive Summary

This report presents a complete architectural analysis and test specification for the **Shorts Shield Gamification System** (PUBG & Free Fire style Achievement Points, Experience Points (EXP), Rank Tiers, and Leveling Progression System).

The analysis maps out every module, data model, business rule, UI component, and edge case in the `shorts-shield` extension codebase. Based on this mapping, detailed E2E test suites spanning Tiers 1 through 4 have been structured to ensure zero-regression integration.

---

## 2. Requirements & Feature Specifications

### R1. Achievement Points (AP) & EXP Engine
- **Core Requirement**: Every achievement badge awards specific Achievement Points (AP) and Experience Points (EXP) based on difficulty tier.
- **Storage Tracking**: Track total accumulated AP, total EXP, player Level, Level Progress percentage, and earned badges in `chrome.storage.local` under `tracking.gamification`.
- **Badge Catalog & Award Structure**:

| Category | Badge ID | Badge Name | Requirement | AP Award | EXP Award | Tier |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Time Milestones** | `first_step` | First Steps | 15 Minutes Learning | +50 AP | +50 EXP | Bronze |
| | `focus_rookie` | Focus Rookie | 1 Hour Learning | +100 AP | +100 EXP | Bronze |
| | `deep_diver` | Deep Diver | 5 Hours Learning | +200 AP | +200 EXP | Silver |
| | `dedicated_scholar` | Dedicated Scholar | 10 Hours Learning | +300 AP | +300 EXP | Silver |
| | `mastermind` | Mastermind | 25 Hours Learning | +500 AP | +500 EXP | Gold |
| | `study_warrior` | Study Warrior | 50 Hours Learning | +750 AP | +750 EXP | Gold |
| | `focus_legend` | Focus Legend | 100 Hours Learning | +1000 AP | +1000 EXP | Diamond |
| **Streaks** | `streak_starter` | Streak Starter | 2 Day Streak | +50 AP | +50 EXP | Bronze |
| | `consistency_master` | Consistency Master | 3 Day Streak | +100 AP | +100 EXP | Bronze |
| | `week_warrior` | Unstoppable Week | 7 Day Streak | +250 AP | +250 EXP | Silver |
| | `fortnight_master` | Fortnight Master | 14 Day Streak | +500 AP | +500 EXP | Gold |
| | `monthly_monk` | Monthly Monk | 30 Day Streak | +1000 AP | +1000 EXP | Diamond |
| **Shield Guard** | `shorts_shield_novice` | Shorts Defender | 10 Shorts Blocked | +50 AP | +50 EXP | Bronze |
| | `shorts_shield_guardian` | Shield Guardian | 50 Shorts Blocked | +150 AP | +150 EXP | Silver |
| | `focus_guardian` | Focus Guardian | 10 Focus Sessions | +200 AP | +200 EXP | Gold |

- **Level & EXP Calculation Formula**:
  - `Level` = `Math.floor(totalAP / 200) + 1`
  - `Current Level AP` = `totalAP % 200`
  - `Level Progress Bar %` = `(totalAP % 200) / 200 * 100`

---

### R2. PUBG/Free Fire Rank Tier System
- **Core Requirement**: Calculate user Rank Tier automatically based on total accumulated Achievement Points (AP).
- **Rank Tier Thresholds**:

| Rank Tier Name | AP Range | Rank Icon | Visual Theme | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Bronze Focus** | 0 – 199 AP | 🥉 | Bronze / Copper | Beginner focus warrior |
| **Silver Scholar** | 200 – 499 AP | 🥈 | Silver / Steel | Emerging consistent scholar |
| **Gold Mastermind** | 500 – 999 AP | 🥇 | Gold / Amber | Master of focus sessions |
| **Diamond Warrior** | 1000 – 1999 AP | 💎 | Cyan / Diamond | Elite study warrior |
| **Heroic Monk** | 2000 – 3499 AP | 🔥 | Red / Flame | Legendary monk of discipline |
| **Grandmaster Legend** | 3500+ AP | 👑 | Gold-Purple Glow | Supreme pinnacle legend |

- **Tier Progression Calculation**:
  - `Tier Progress %` = `((currentAP - currentTierMinAP) / (nextTierMinAP - currentTierMinAP)) * 100`
  - For Grandmaster Legend (3500+ AP), progress stays at 100% (MAX TIER).

---

### R3. Game-Style UI Cards & Battle-Card Aesthetic
- **Options Dashboard (`options.html` / `options.js` / `options.css`)**:
  - Redesigned **Achievements Tab** featuring a PUBG/Free Fire battle-card aesthetic:
    - **Header Player Score Card**: Displays Rank Tier Badge Icon, Rank Name, Level, Total AP, EXP, and animated glowing Level Progress Bar.
    - **Category Filters**: Tabs for `[All]`, `[Time Milestones]`, `[Streaks]`, `[Shield Guard]`.
    - **Battle-Card Component**:
      - Dark metallic background with neon accent borders.
      - Unlocked status: Glowing icon, full opacity, "+50 AP" badge highlighted in neon yellow/gold.
      - Locked status: Grayscale icon, 50% opacity, lock icon indicator, grayed-out point award.
- **Extension Popup UI (`popup.html` / `popup.js` / `popup.css`)**:
  - Top header summary card showing:
    - Current Rank Badge Icon & Tier Name.
    - Level indicator (`LVL X`).
    - Total AP score (`XXX AP`).
    - Mini rank progress bar.

---

## 3. Existing Codebase Architecture & Data Models

### 3.1 File & Module Directory Map
```
shorts-shield/
├── manifest.json                # MV3 Manifest
├── background/
│   └── background.js            # SPA & WebNavigation intercepter, settings migration
├── content/
│   ├── js/
│   │   ├── main.js              # Orchestrator & overlay triggers
│   │   ├── shorts-blocker.js    # DOM observer & blocker
│   │   ├── focus-mode.js       # UI hiding for focus
│   │   ├── study-mode.js       # Goal banner & alignment warning
│   │   └── time-manager.js     # Daily limit enforcement
│   └── css/                     # Injected styles
├── utils/
│   ├── storage.js               # StorageUtil wrappers for sync/local storage
│   └── time-tracker.js          # Playback monitor, streak & badge evaluation
├── options/
│   ├── options.html             # Dashboard markup with tabs
│   ├── options.js               # Dashboard controller & tab renderer
│   └── options.css              # Dashboard styling
└── popup/
    ├── popup.html               # Extension popup markup
    ├── popup.js                 # Popup controller
    └── popup.css                # Popup styling
```

### 3.2 Storage Data Schema (`utils/storage.js`)
```javascript
const DEFAULT_TRACKING = {
  dailyWatchTime: {},
  dailyLearningTime: {},
  weeklyTotal: 0,
  monthlyTotal: 0,
  weeklyLearningTotal: 0,
  monthlyLearningTotal: 0,
  activeSessionStart: 0,
  lastReminderTriggered: 0,
  gamification: {
    totalAP: 0,
    totalEXP: 0,
    level: 1,
    rankTier: "Bronze Focus",
    currentStreak: 0,
    longestStreak: 0,
    lastLearningDate: null,
    badges: [],
    shortsBlockedCount: 0,
    focusSessionsCompleted: 0
  }
};
```

---

## 4. E2E Test Suite Specification (Tier 1 to Tier 4)

### Tier 1: Unit & Core Logic Verification
- **Test 1.1: Syntax Integrity (`node -c`)**
  - Command: `node -c background/background.js content/js/*.js options/options.js popup/popup.js utils/*.js`
  - Expectation: Exit code 0, zero syntax errors across all files.
- **Test 1.2: AP & Rank Tier Calculation Engine**
  - Verify AP calculations for badge unlocks: 0 AP -> Bronze Focus (Level 1), 250 AP -> Silver Scholar (Level 2), 600 AP -> Gold Mastermind (Level 4), 1500 AP -> Diamond Warrior (Level 8), 2500 AP -> Heroic Monk (Level 13), 3600 AP -> Grandmaster Legend (Level 19).
- **Test 1.3: Badge Award Idempotency**
  - Verify that unlocking the same badge multiple times does NOT award duplicate AP/EXP.

### Tier 2: Storage & State Persistence Verification
- **Test 2.1: Storage Schema Migration**
  - Verify `StorageUtil.getTracking()` returns complete `gamification` defaults when legacy storage missing new fields.
- **Test 2.2: Badge Unlock Storage Update**
  - Simulate total learning time >= 900 seconds -> verify `first_step` added to `gamification.badges`, `totalAP` increases by 50.
- **Test 2.3: Streak Tracking & Reset**
  - Increment learning time across consecutive days -> verify `currentStreak` increments and streak badges trigger.

### Tier 3: Component & UI Rendering Verification
- **Test 3.1: Options Page Battle-Cards Rendering**
  - Load `options.html` with mock storage -> verify total score card displays correct Rank, Level, and AP.
  - Verify category filters (`All`, `Time Milestones`, `Streaks`, `Shield Guard`) filter battle-cards correctly.
- **Test 3.2: Unlocked vs Locked Visual States**
  - Verify unlocked badge card has class `earned` with visible `+50 AP` tag.
  - Verify locked badge card is grayed out.
- **Test 3.3: Extension Popup Gamification Card**
  - Open `popup.html` -> verify Rank icon, Level badge, and total AP score match storage values.

### Tier 4: E2E System & Workflow Integration
- **Test 4.1: Learning Session to Rank Promotion Workflow**
  - Start video with Study Mode enabled.
  - Accumulate learning time to reach 900 seconds.
  - Assert `first_step` badge unlocked -> AP awarded (+50 AP).
  - Verify total AP updates in storage and instantly syncs across popup and options UI.
- **Test 4.2: Tier Promotion Workflow**
  - Award AP to cross 200 AP threshold (Bronze Focus -> Silver Scholar).
  - Verify Rank Tier name updates to `Silver Scholar` and icon updates to 🥈 in both Options and Popup.

---

## 5. Acceptance Criteria Checklist

- [x] Every badge awards distinct AP (50 to 1000 AP) dynamically saved in storage.
- [x] Rank Tier updates automatically based on total earned AP across 6 PUBG/Free Fire tiers.
- [x] Options dashboard and Extension Popup display player Rank, Level, and AP score.
- [x] Game-style battle cards with category filters implemented in Options page.
- [x] `node -c` syntax check passes clean across all JS files.
