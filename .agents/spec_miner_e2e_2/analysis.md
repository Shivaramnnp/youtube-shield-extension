# E2E Specification Mining Report: Shorts Shield & PUBG/Free Fire Gamification System

## Executive Summary
This document provides the authoritative, mined specification details for **Shorts Shield** browser extension, including the core extension features (Shorts Blocking, Focus Mode, Study Mode, Goal Mode, Time Manager, UI Cleaner, Time Tracking) and the newly specified **PUBG & Free Fire style Achievement Points (AP), Experience Points (EXP), Rank Tier System, and Battle-Card UI Progression Engine**.

---

## 1. Features Discovered & Specification Overview

### Features Discovered Table
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Gamification | AP & EXP Engine | Computes AP (+50 to +500) & EXP per badge unlocked; maintains total AP, Level, and EXP Progress in storage. | Unlocked Badge IDs | Total AP, EXP, Level, Level Progress % | Defaults to 0 AP / Level 1 if storage empty/corrupted. | `ORIGINAL_REQUEST.md`, `utils/time-tracker.js` |
| 2 | Gamification | Rank Tier Calculation | Determines player Rank Tier based on total earned AP & total learning time. | Total AP, Total Learning Time | Rank Tier Name & Badge Icon | Falls back to Bronze Focus (0 AP). | `ORIGINAL_REQUEST.md`, `options/options.js` |
| 3 | Gamification | Game-Style UI Battle Cards | Displays PUBG/Free Fire battle-card aesthetic in Options & Popup UI with category filters and progress bars. | AP score, Level, Badges | Rendered Battle-Card UI | Missing elements guarded against null pointers. | `ORIGINAL_REQUEST.md`, `options/options.html` |
| 4 | Shorts Blocking | URL & SPA Intercept | Intercepts navigation to `/shorts/*` or `/playables/*` and redirects to YouTube Home (`/`). | Navigation URL | SPA dispatch `yt-navigate` or `tabs.update` | Falls back to `window.location.replace` if SPA fails. | `background/background.js` |
| 5 | Shorts Blocking | DOM Hiding & Observer | Removes Shorts shelves, chips, sidebar links, and reel renderers dynamically. | DOM Mutation events | `display: none !important` applied | Gracefully ignores non-matching nodes. | `content/js/shorts-blocker.js`, `observer-utils.js` |
| 6 | Focus Mode | Distraction Hiding | Hides comments, related videos, end screens, and sidebar recommendations. | `focusMode: true` toggle | Hides `.ytd-comments`, `#secondary`, etc. | Toggles CSS classes safely via `DOMUtils`. | `content/js/focus-mode.js`, `content/css/focus-mode.css` |
| 7 | Study Mode | Goal Banner & Session Timer | Displays sticky top banner with current learning goal and active session timer (`MM:SS`). | `studyMode: true`, `learningGoal` string | Fixed header banner (`#ss-study-banner`) | Sanitizes input text via `textContent` to prevent XSS. | `content/js/study-mode.js` |
| 8 | Feed Filtering | Smart Keyword Extraction | Extracts technical short terms (C++, AI, ML, Go, SQL, UI/UX) and filters home feed items. | `learningGoal` string | Hides off-topic video items (`.off-topic`) | Logs warning if goal contains only stop words. | `content/js/feed-controller.js` |
| 9 | Goal Mode | Strict Video Enforcement | Enforces strict block overlay and play lock on watch page if video title lacks goal keywords. | Video Title, Channel Name, Active Goal | Fullscreen overlay (`#ss-goal-block-overlay`), video pause | Permits video if goal yields no keywords. | `content/js/goal-mode.js` |
| 10 | Time Manager | Daily Limit & Focus Schedule | Tracks daily watch minutes vs limit (5-720m) and restricts access during scheduled focus hours. | `dailyLimitMinutes`, `scheduleStart`, `scheduleEnd` | Fullscreen overlay (`#ss-time-manager-overlay`), video pause | Allows +5 Min emergency extension (snooze). | `content/js/time-manager.js` |
| 11 | UI Cleaner | Modular UI Toggles | Individually hides notification bell, subscriber counts, live chat, trending, explore, mini-player, autoplay. | 7 boolean flags | Specific CSS classes added/removed from `<html>`/`<body>` | Defaults missing toggles to `DEFAULT_SETTINGS.uiCleaner`. | `content/js/ui-cleaner.js` |
| 12 | Analytics | Time Tracking Engine | Tracks playing video time when tab active, flushes every 10s to storage. Resets weekly/monthly on rollover. | Active playing video, Tab visibility | Daily/Weekly/Monthly totals, Focus Score % | Prunes daily records older than 60 days. | `utils/time-tracker.js` |
| 13 | Header UI | Masthead Header Button | Injects a "Shield" button in YouTube masthead opening an embedded popup dialog. | User click on masthead button | Embedded popup modal (`#ss-popup-dialog`) | Retries up to 20 times (10s) if masthead delayed. | `content/js/header-button.js` |

---

## 2. Tier 1: Feature Coverage Specifications

### R1 & R2: Achievement Points (AP), EXP & PUBG/Free Fire Rank System

#### 1. Achievement Badges & AP / EXP Specification
Each badge awards a specific tier of AP and EXP upon requirement completion:

| Badge ID | Badge Name | Category | Requirement | AP Award | EXP Award | Difficulty Tier |
|----------|------------|----------|-------------|----------|-----------|-----------------|
| `first_step` | First Steps | Time Milestones | 15 Minutes Learning | +50 AP | +100 EXP | Common |
| `focus_rookie` | Focus Rookie | Time Milestones | 1 Hour Learning | +50 AP | +100 EXP | Common |
| `deep_diver` | Deep Diver | Time Milestones | 5 Hours Learning | +100 AP | +250 EXP | Rare |
| `dedicated_scholar` | Dedicated Scholar | Time Milestones | 10 Hours Learning | +100 AP | +250 EXP | Rare |
| `mastermind` | Mastermind | Time Milestones | 25 Hours Learning | +200 AP | +500 EXP | Epic |
| `study_warrior` | Study Warrior | Time Milestones | 50 Hours Learning | +200 AP | +500 EXP | Epic |
| `focus_legend` | Focus Legend | Time Milestones | 100 Hours Learning | +500 AP | +1200 EXP | Legendary |
| `streak_starter` | Streak Starter | Streaks | 2 Day Streak (>=60s/day) | +50 AP | +100 EXP | Common |
| `consistency_master` | Consistency Master | Streaks | 3 Day Streak | +50 AP | +100 EXP | Common |
| `week_warrior` | Unstoppable Week | Streaks | 7 Day Streak | +100 AP | +250 EXP | Rare |
| `fortnight_master` | Fortnight Master | Streaks | 14 Day Streak | +200 AP | +500 EXP | Epic |
| `monthly_monk` | Monthly Monk | Streaks | 30 Day Streak | +500 AP | +1200 EXP | Legendary |

**Total Maximum Earnable AP**: 2,100 AP (from base 12 badges).  
**Additional Shield Guard Badges** (Future expansion allowance): Up to 3,500+ AP max.

#### 2. PUBG / Free Fire Rank Tier Thresholds
Rank Tier is computed deterministically from total earned AP:

| Rank Tier | Required AP Range | Tier Icon / Aesthetic | Progression Bar Color |
|-----------|-------------------|----------------------|-----------------------|
| **Bronze Focus** | 0 - 199 AP | 🥉 Bronze Shield | `#cd7f32` (Bronze Metallic) |
| **Silver Scholar** | 200 - 499 AP | 🥈 Silver Shield | `#c0c0c0` (Silver Metallic) |
| **Gold Mastermind** | 500 - 999 AP | 🥇 Gold Crest | `#ffd700` (Gold Metallic) |
| **Diamond Warrior** | 1000 - 1999 AP | 💎 Diamond Gem | `#00ffff` (Cyan Diamond Sparkle) |
| **Heroic Monk** | 2000 - 3499 AP | 🔥 Heroic Flame Badge | `#ff4500` (Red/Orange Flame) |
| **Grandmaster Legend** | 3500+ AP | 👑 Grandmaster Crown | `#purple-gold` Animated Gradient |

#### 3. Level & Level Progress Formula
- **Player Level**: Level = floor(Total EXP / 500) + 1
- **Level Progress Percentage**: Progress % = ((Total EXP mod 500) / 500) * 100%

#### 4. Extended Storage Schema (`chrome.storage.local` -> `tracking`)
```json
{
  "tracking": {
    "dailyWatchTime": { "2026-08-09": 3600 },
    "dailyLearningTime": { "2026-08-09": 2400 },
    "weeklyTotal": 14400,
    "monthlyTotal": 57600,
    "weeklyLearningTotal": 9600,
    "monthlyLearningTotal": 38400,
    "currentWeekKey": "2026-W32",
    "currentMonthKey": "2026-08",
    "gamification": {
      "currentStreak": 5,
      "longestStreak": 12,
      "lastLearningDate": "2026-08-09",
      "badges": ["first_step", "focus_rookie", "streak_starter", "consistency_master"],
      "totalAP": 200,
      "totalEXP": 400,
      "level": 1,
      "levelProgress": 80,
      "rankTier": "Silver Scholar"
    }
  }
}
```

---

### Core Extension Feature Specifications

#### Base Feature 1: Shorts & Playables Blocker
- **Target URLs**: `*://*.youtube.com/shorts/*`, `*://*.youtube.com/playables/*`
- **Behavior**:
  - `webNavigation.onBeforeNavigate`: Redirects tab to `https://www.youtube.com/`. Registers `tabId` in `pendingHistoryReplace` set.
  - `webNavigation.onHistoryStateUpdated` (SPA Navigation): Replaces browser history entry with `https://www.youtube.com/` and dispatches `yt-navigate` custom event with browse endpoint `FEwhat_to_watch`. Fallback to `chrome.tabs.update`.
  - DOM Hiding: Injects `.shorts-shield-block-shorts` CSS class on `<html>` & `<body>`. Uses `ObserverUtils` with selector `a[href*="shorts"], a[title*="Shorts"], a[href*="playables"]` to set `display: none !important` on parent containers (`ytd-rich-section-renderer`, `ytd-rich-shelf-renderer`, `ytd-reel-shelf-renderer`, `ytd-guide-entry-renderer`).

#### Base Feature 2: Focus Mode
- **CSS Class**: `.shorts-shield-focus-mode`
- **Elements Hidden**: `#comments`, `#related`, `.ytp-endscreen-content`, `ytd-watch-next-secondary-results-renderer`, `#secondary`.
- **Player Layout**: Re-centers primary player using CSS custom variables; removes JS window resize triggers.

#### Base Feature 3: Study Mode & Feed Controller
- **Sticky Banner**: Injects `#ss-study-banner` at top, offsets `masthead-container` top by `36px` and `document.body` paddingTop by `36px`. Preserves original inline styles for clean restoration on disable.
- **Session Timer**: Increments `MM:SS` count from `Date.now() - sessionStartTime`.
- **Feed Filtering**: Analyzes `learningGoal`. Preserves technical short terms (e.g. `c`, `r`, `go`, `ai`, `ml`, `dl`, `nlp`, `cv`, `ui`, `ux`, `db`, `os`, `js`, `ts`, `sql`, `css`, `ios`, `api`, `git`, `aws`, `gcp`, `llm`, `gpt`, `ci`, `cd`, `qa`, `oop`, `dsa`, `vim`, `web3`, `k8s`, `cplusplus`, `csharp`, `uiux`). Adds `.off-topic` class to non-matching `ytd-rich-item-renderer` elements.
- **Watch Page Alignment Warning**: Displays warning `#ss-alignment-warning` ("⚠️ This video may not match your current learning goal") if watch video title lacks goal keywords. Auto-dismisses after 10 seconds or manual click.

#### Base Feature 4: Goal Mode (Strict)
- **Watch Page Alignment Check**: Polls video title up to 15 times (at 500ms intervals).
- **Play Lock**: Intercepts `play` events on `<video>` element, immediately calling `video.pause()`.
- **Block Overlay**: Displays full-screen modal `#ss-goal-block-overlay` (`zIndex: 2147483647`) with goal title, blocked video title, "Search for Goal" button, and "YouTube Home" button.

#### Base Feature 5: Time Manager
- **Daily Limit**: Range 5 to 720 minutes (`opt-tm-dailyLimitMinutes`). If accumulated today's watch time >= limit, triggers overlay.
- **Focus Schedule**: Compares local time vs `scheduleStart` and `scheduleEnd` (`HH:MM`). Supports intraday (`09:00` - `17:00`) and overnight (`22:00` - `06:00`).
- **Emergency Extension (Snooze)**: "+5 Min Emergency Extension" button sets `snoozeUntil = Date.now() + 300,000` (5 minutes). Suppresses overlay during active snooze.

#### Base Feature 6: UI Cleaner
- **Toggles**: 7 individual flags in `settings.uiCleaner`: `hideBell` (`.ss-hide-bell`), `hideSubCount` (`.ss-hide-sub-count`), `hideChat` (`.ss-hide-chat`), `hideTrending` (`.ss-hide-trending`), `hideExplore` (`.ss-hide-explore`), `hideMiniPlayer` (`.ss-hide-mini-player`), `hideAutoplay` (`.ss-hide-autoplay`).

#### Base Feature 7: Time Tracker Engine
- **Active Video Verification**: Increments active watch time by 1s if `<video>` exists, `!video.paused`, `!video.ended`, and `!document.hidden`.
- **Storage Flush**: Saves accumulated seconds every 10 seconds.
- **Date Keying**: Local date format `YYYY-MM-DD`.
- **Pruning**: Deletes daily records older than 60 days.
- **Calendar Rollovers**: Updates `currentWeekKey` (`YYYY-Www`) and `currentMonthKey` (`YYYY-MM`) and resets weekly/monthly aggregations on boundary change.
- **Streak Evaluation**: Requires >= 60 seconds learning time on consecutive local calendar days.

---

## 3. Tier 2: Boundary & Corner Cases

| Boundary ID | Feature | Boundary Condition / Edge Case | Expected System Behavior |
|-------------|---------|--------------------------------|--------------------------|
| B1 | AP Engine | Total AP = 0 | Rank Tier = "Bronze Focus", Level = 1, EXP = 0, Progress Bar = 0%. |
| B2 | AP Engine | Total AP = 199 AP | Rank Tier remains "Bronze Focus". |
| B3 | AP Engine | Total AP = 200 AP | Rank Tier automatically upgrades to "Silver Scholar". |
| B4 | AP Engine | Total AP = 500 AP | Rank Tier upgrades to "Gold Mastermind". |
| B5 | AP Engine | Total AP = 1000 AP | Rank Tier upgrades to "Diamond Warrior". |
| B6 | AP Engine | Total AP = 2000 AP | Rank Tier upgrades to "Heroic Monk". |
| B7 | AP Engine | Total AP = 3500 AP | Rank Tier upgrades to "Grandmaster Legend". |
| B8 | EXP Engine | Total EXP = 499 | Level = 1, Progress = 99.8%. |
| B9 | EXP Engine | Total EXP = 500 | Level = 2, Progress = 0%. |
| B10 | EXP Engine | Total EXP = 2450 | Level = 5 (floor(2450/500) + 1), Progress = 90% (450/500). |
| B11 | Keyword Extractor | Goal = "Learn C++ & UI/UX" | Keywords extracted: `["cplusplus", "uiux"]`. Matches titles containing "C++" or "UI/UX". |
| B12 | Keyword Extractor | Goal = "How to learn" (Only stop words) | Keywords extracted: `[]`. Logs warning; does NOT block videos/feed. |
| B13 | Keyword Extractor | Goal = `<script>alert('xss')</script>` | Sanitized to plain text; rendered safely via `textContent` or `escapeHtml`. |
| B14 | Time Manager | Daily Limit = 5 min (minimum limit) | Triggers Time Manager overlay after exactly 300 seconds of active playback. |
| B15 | Time Manager | Daily Limit = 0 min or negative | Treated as disabled; no limit enforced. |
| B16 | Time Manager | Schedule = 22:00 to 06:00 (Overnight) | Correctly evaluates active restriction when current time is 23:30 or 04:15. |
| B17 | Time Manager | Emergency Extension Snooze | Snooze grants exactly 300,000 ms. Overlay re-appears after 5 minutes if limit still exceeded. |
| B18 | Time Tracker | Midnight Rollover (23:59:59 -> 00:00:00) | Creates new daily date key `YYYY-MM-DD`. Yesterday's streak preserved if >=60s logged. |
| B19 | Time Tracker | 60-Day Storage Pruning | Daily entries older than 60 days deleted during `incrementWatchTime`. |
| B20 | Storage | Missing keys on Extension Update | `StorageUtil.getSettings()` deep-merges `DEFAULT_SETTINGS` so new keys fall back cleanly. |

---

## 4. Tier 3: Cross-Feature Combinations

### 1. Goal Mode + Study Mode Concurrency
- **Behavior**: When both Study Mode and Goal Mode are active:
  - Study Mode injects top sticky banner (`#ss-study-banner`).
  - FeedController filters feed items (hides off-topic items).
  - On watch page, **Goal Mode strict overlay** (`#ss-goal-block-overlay`) takes precedence over Study Mode's non-blocking alignment warning (`#ss-alignment-warning`).
  - Video play lock is enforced.

### 2. Focus Mode + Minimal Mode + UI Cleaner Interaction
- **Behavior**:
  - Focus Mode adds `.shorts-shield-focus-mode` (hides comments & related videos).
  - Minimal Mode adds `.shorts-shield-minimal-mode` (strips everything except player & search bar).
  - UI Cleaner toggles add specific sub-classes (e.g. `.ss-hide-bell`, `.ss-hide-chat`).
  - CSS rule specificity is designed so Minimal Mode overrides normal page elements without style conflicts.

### 3. Overlay Prioritization & Z-Index Matrix
When multiple overlays trigger simultaneously:

| Overlay Element | Z-Index | Priority | Purpose |
|-----------------|---------|----------|---------|
| `#ss-time-manager-overlay` | `2147483647` | 1 (Highest) | Daily limit / Schedule block (Restricts all playback) |
| `#ss-goal-block-overlay` | `2147483647` | 1 (Highest) | Strict off-topic video block |
| `#ss-focus-reminder` | `2147483647` | 2 | Intentional watch reminder popup |
| `#ss-alignment-warning` | `10000` | 3 | Soft study mode warning toast |
| `#ss-study-banner` | `9999` | 4 | Sticky top session bar |

### 4. Multi-Tab Storage Synchronization
- Each content script reads fresh state from `chrome.storage.local` during 10-second increment cycles.
- Changes to `chrome.storage.sync` (e.g. toggling Focus Mode in Popup) trigger `chrome.storage.onChanged` in all active tabs, auto-reloading or re-applying settings seamlessly.

---

## 5. Tier 4: Real-World Scenarios

### Scenario 1: Fresh Install & Gamification Onboarding
1. User installs extension. Default settings applied (`shortsBlocker: true`, `focusMode: true`, `totalAP: 0`, `rankTier: "Bronze Focus"`).
2. User opens YouTube and watches 15 minutes of a Python tutorial in Study Mode.
3. Time Tracker accumulates 900 seconds of learning time.
4. `checkBadges()` unlocks `first_step` badge (+50 AP, +100 EXP).
5. Storage updates: `totalAP = 50`, `totalEXP = 100`, `level = 1`, `levelProgress = 20%`.
6. Options Dashboard & Popup update UI to display **Bronze Focus (50 AP)**.

### Scenario 2: Unlocking Silver Scholar Rank & Level Up
1. User accumulates 5 Hours of Learning (`deep_diver` badge unlocked: +100 AP, +250 EXP) and 3-day streak (`consistency_master`: +50 AP, +100 EXP).
2. Total earned AP reaches 200 AP. Total EXP reaches 550 EXP.
3. System automatically triggers Rank Upgrade:
   - Rank Tier transitions from **Bronze Focus** -> **Silver Scholar**.
   - Level transitions from **Level 1** -> **Level 2** (Progress: 50 / 500 = 10%).
4. Battle-Card UI displays glowing **Silver Scholar** badge icon (`🥈`) with metallic silver progress bar.

### Scenario 3: Strict Goal Mode Session & Emergency Extension
1. User sets Goal: `"Learn Rust Web Assembly"`. Toggles **Goal Mode (Strict)**.
2. User clicks a gaming video on YouTube.
3. GoalMode inspects video title `"Top 10 Gaming Moments"`. No match for keywords `["rust", "assembly"]`.
4. Play lock pauses video. Strict modal `#ss-goal-block-overlay` appears.
5. User clicks "🔍 Search for Rust Web Assembly" button in overlay. YouTube tab navigates to search results.
6. User reaches daily watch limit (60 mins). `TimeManager` overlay appears.
7. User clicks **"+5 Min Emergency Extension"**. `snoozeUntil` updated in storage; overlay dismisses for 5 minutes.

### Scenario 4: Reaching Grandmaster Legend (3500+ AP)
1. Heavy learner unlocks all 12 time and streak badges, earning 2,100 AP.
2. Learner completes 30-day streak (`monthly_monk`: +500 AP, +1200 EXP) and extended Shield Guard milestones reaching 3,500 AP and 7,500 EXP.
3. System transitions user to **Grandmaster Legend**:
   - Level reaches **Level 16** (floor(7500/500) + 1).
   - Rank badge displays animated gold/purple gradient crown icon (`👑`).
   - Popup & Options UI render Grandmaster battle card with 100% completed tier bar.

---

## 6. Edge Cases & Validation Rules Table

| # | Feature | Input / Condition | Observed / Expected Behavior |
|---|---------|-------------------|------------------------------|
| 1 | Gamification | Empty / null `badges` array in storage | Initialized to `[]` without error. |
| 2 | Gamification | Duplicate badge trigger | `badges.includes(id)` check prevents duplicate AP/EXP awards. |
| 3 | Reminder Interval | User enters `0` or negative in Options | Clamped to `60` minutes to prevent infinite overlay loop (`division by zero`). |
| 4 | Reminder Interval | User enters `9999` in Options | Clamped to max `480` minutes. |
| 5 | Time Manager | Daily Limit input `< 5` | Clamped to min `5` minutes. |
| 6 | Time Manager | Daily Limit input `> 720` | Clamped to max `720` minutes (12 hours). |
| 7 | Study Goal | Input `<script>alert(1)</script>` | Escaped safely via HTML entity encoding (`escapeHtml`); rendered as plain string. |
| 8 | SPA Navigation | Click Shorts link from external site | Intercepted by `webNavigation.onBeforeNavigate`; redirected to `youtube.com/`. |
| 9 | SPA Navigation | In-page click on Shorts link | Intercepted by `webNavigation.onHistoryStateUpdated`; smooth SPA dispatch to home. |
| 10 | Header Button | Masthead element `#buttons` delayed load | Retry loop attempts injection every 500ms up to 20 times (10s total). |
