# Comprehensive Codebase Analysis & Tier 1 E2E Test Specifications

**Explorer ID**: E2E Explorer 1 (`e2e_explorer_1`)  
**Phase**: E2E Testing Track — Feature Exploration & Tier 1 Test Spec Formulation  
**Target Project**: Shorts Shield Extension (`/Users/shivarampatel/Desktop/shorts-shield`)  
**Date**: 2026-08-10  

---

## 1. Executive Summary

This report provides an exhaustive investigation of the **Shorts Shield** Chrome/Multi-browser extension codebase and formulates a complete **Tier 1 (Feature Coverage)** End-to-End (E2E) test specification covering all **12 core features**.

### Key Findings:
1. **Architecture & Scope**: Shorts Shield is a Manifest V3 extension engineered for modern Single Page Application (SPA) architectures on YouTube. It operates seamlessly across Chrome, Brave, Edge, Firefox, and Safari using robust fallback patterns.
2. **12 Core Features Verified**:
   - **Feature 1: Shorts Blocker** (`shorts-blocker.js`, `background.js`, `hide-shorts.css`)
   - **Feature 2: Focus Mode** (`focus-mode.js`, `focus-mode.css`)
   - **Feature 3: Study Mode** (`study-mode.js`, `feed-controller.js`)
   - **Feature 4: Goal Mode (Strict)** (`goal-mode.js`, `feed-controller.js`)
   - **Feature 5: Minimal Mode** (`focus-mode.css`, `main.js`, UI controllers)
   - **Feature 6: Time Manager** (`time-manager.js`, `time-tracker.js`)
   - **Feature 7: UI Cleaner** (`ui-cleaner.js`, `clean-ui.css`)
   - **Feature 8: Header Button** (`header-button.js`, `header-button.css`)
   - **Feature 9: Extension Popup UI** (`popup.html`, `popup.js`, `popup.css`)
   - **Feature 10: Options Dashboard** (`options.html`, `options.js`, `options.css`)
   - **Feature 11: Gamification Engine** (`gamification-engine.js`, `storage.js`, `time-tracker.js`)
   - **Feature 12: Audio Effects** (`audio-engine.js`)
3. **Tier 1 Test Spec Formulation**: Exactly **60 high-precision Tier 1 test specifications** (5 per feature) have been defined with explicit setup, execution steps, expected assertions, and exact source trace references.

---

## 2. Codebase Architecture & File Map

```
/Users/shivarampatel/Desktop/shorts-shield
├── manifest.json                       # Manifest V3 configuration & content script load order
├── background/
│   └── background.js                   # Service Worker handling SPA webNavigation & options tab router
├── content/
│   ├── css/
│   │   ├── clean-ui.css                # CSS rules for UI Cleaner toggles
│   │   ├── feed-controller.css         # Off-topic feed hiding styles
│   │   ├── focus-mode.css              # Focus Mode & Minimal Mode hiding rules
│   │   ├── header-button.css           # In-page YouTube Shield button & popover modal styling
│   │   └── hide-shorts.css             # CSS rules for Shorts DOM removal
│   └── js/
│       ├── feed-controller.js          # Custom blocklist & goal keyword filtering logic
│       ├── focus-mode.js               # Focus mode DOM controller
│       ├── goal-mode.js                # Goal Mode strict enforcement & play-lock overlay
│       ├── header-button.js            # Masthead Shield button injector & menu popover
│       ├── main.js                     # Main content script orchestrator
│       ├── observer-utils.js           # Shared MutationObserver utility manager
│       ├── shorts-blocker.js           # Shorts DOM observer & Safari SPA navigation handler
│       ├── study-mode.js               # Study Mode banner, timer & alignment warning
│       ├── time-manager.js             # Daily time limit & schedule overlay manager
│       └── ui-cleaner.js               # Clean Interface class-toggling controller
├── options/
│   ├── options.html                    # Settings Dashboard HTML markup
│   ├── options.css                     # Glassmorphism theme & PUBG Battle-Card CSS
│   └── options.js                      # Dashboard UI logic, charts, backup/restore, badges
├── popup/
│   ├── popup.html                      # Toolbar Extension Popup HTML
│   ├── popup.css                       # Compact dark glassmorphism CSS
│   └── popup.js                        # Popup UI event handlers & storage synchronization
├── utils/
│   ├── audio-engine.js                 # Web Audio API sound synthesizer
│   ├── dom-utils.js                    # Safe DOM manipulation helpers
│   ├── gamification-engine.js          # 22-badge definitions, AP/EXP math, Rank tier thresholds
│   ├── storage.js                      # Multi-tier Chrome Storage sync/local/memory wrappers
│   └── time-tracker.js                 # Playback monitoring, streak calculation, badge triggers
└── tests/
    ├── run-tests.js                    # Master test runner CLI
    ├── harness/
    │   ├── mock-extension-env.js       # Extension & DOM API mock harness
    │   └── test-helpers.js             # Test runner assertion helpers
    └── tier1/                          # Tier 1 unit & feature test suites
```

---

## 3. Deep-Dive 12-Feature Implementation Details

### Feature 1: Shorts Blocker
- **Primary Source Files**: `content/js/shorts-blocker.js`, `background/background.js`, `content/css/hide-shorts.css`.
- **Implementation Mechanics**:
  - URL Interception Regex: `/(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i` (and content script `/\/shorts\/|\/playables\//i`).
  - Safari & SPA Fallback: Attached listeners to `yt-navigate-finish`, `yt-page-data-updated`, `popstate`, `hashchange`, and a 400ms interval fallback (`checkAndRedirectShortsURL`). Redirection performed via `window.history.replaceState` and `window.location.replace('https://www.youtube.com/')`.
  - DOM Removal & CSS Hiding: Adds `.shorts-shield-block-shorts` to `document.documentElement`. Observes dynamic Shorts items using `ObserverUtils.observe()` with selectors `a[href*="shorts"]`, `a[title*="Shorts"]`, `yt-formatted-string[title*="Shorts"]`, `a[href*="playables"]`, `a[title*="Playables"]`. Hides parent containers (`ytd-rich-shelf-renderer`, `ytd-reel-shelf-renderer`, `ytd-guide-entry-renderer`, etc.) with `display: none !important`.
  - Stats & Debug: Maintains `this.stats = { detected: 0, removed: 0 }`. Injects `#shorts-shield-debug` overlay when `window.ShortsShieldDebug` is active.

### Feature 2: Focus Mode
- **Primary Source Files**: `content/js/focus-mode.js`, `content/css/focus-mode.css`.
- **Implementation Mechanics**:
  - Class Toggle: Toggles `.shorts-shield-focus-mode` on `document.documentElement` / `document.body`.
  - Hiding Selectors: Suppresses `#comments`, `ytd-comments`, `#related`, `#secondary` (recommendations sidebar), `.ytp-ce-element`, `.ytp-endscreen-content`, `#chat`, and promotional shelves.
  - Video Player Centering: Uses CSS variables (`--focus-player-width`, etc.) to center video player dynamically without firing window resize events.

### Feature 3: Study Mode
- **Primary Source Files**: `content/js/study-mode.js`, `content/js/feed-controller.js`.
- **Implementation Mechanics**:
  - Learning Banner: Injects top banner `#ss-study-banner` (zIndex `9999`) with backdrop blur (`backdropFilter: 'blur(8px)'`), displaying goal text `#ss-goal-text` and live session timer `#ss-session-timer` (`MM:SS`).
  - Masthead Adjustment: Dynamically shifts YouTube masthead (`#masthead-container`) `top` to `36px` and `document.body.style.paddingTop` to `36px`, cleanly preserving original styling values for restoration upon disable.
  - Alignment Verification: On `/watch?v=...`, extracts title via `h1.ytd-watch-metadata`. Parses learning goal into normalized keywords using `FeedController.extractKeywords(goal)`. Preserves technical short terms (`c++` -> `cplusplus`, `c#` -> `csharp`, `ui/ux` -> `uiux`, `ai`, `ml`, `go`, `sql`, `db`, `js`, `ts`, `git`, `k8s`).
  - Warning Overlay: Injects non-blocking warning `#ss-alignment-warning` (zIndex `10000`) if video title fails keyword match. Auto-dismisses in 10s or via manual click.

### Feature 4: Goal Mode (Strict)
- **Primary Source Files**: `content/js/goal-mode.js`, `content/js/feed-controller.js`.
- **Implementation Mechanics**:
  - Strict Feed Filtering: Applies root class `.shorts-shield-goal-mode` and calls `FeedController.enable(this.goal)` to hide all off-topic video items on home feed and search results by adding class `.off-topic` and `display: none`.
  - Play Lock Enforcement: On watch page (`/watch`), checks video title against goal keywords. If off-topic, sets `isBlocked = true`, attaches play listener to `<video>` element to execute `video.pause()` continuously on any play attempt.
  - Full-Screen Overlay: Injects modal `#ss-goal-block-overlay` (zIndex `2147483647`) with options to search active goal on YouTube or return to YouTube Home (`https://www.youtube.com/`).

### Feature 5: Minimal Mode
- **Primary Source Files**: `content/css/focus-mode.css`, `content/js/main.js`, `popup/popup.js`, `options/options.js`.
- **Implementation Mechanics**:
  - Class Toggle: Applies `.shorts-shield-minimal-mode` to root document.
  - Layout Stripping: Hides guide sidebar (`#guide`, `ytd-mini-guide-renderer`), top masthead left/right sections (logo, create button, notifications, user avatar), search filters, feed headers, category chips (`yt-chip-cloud-renderer`), and footer links. Isolates watch player or search results.

### Feature 6: Time Manager
- **Primary Source Files**: `content/js/time-manager.js`, `utils/time-tracker.js`, `options/options.js`.
- **Implementation Mechanics**:
  - Daily Budget Limit: Configurable `dailyLimitMinutes` (min 5m, default 60m).
  - Schedule Window: Configurable start and end times (`scheduleStart`, `scheduleEnd`, e.g., "09:00" to "17:00" or overnight "22:00" to "06:00").
  - Evaluation Cycle: Checks every 5 seconds via `setInterval`. Compares today's watch time seconds (keyed by local date `YYYY-MM-DD` in `StorageUtil.getTracking()`) against limits.
  - Enforcement Overlay: Injects modal `#ss-time-manager-overlay` (zIndex `2147483647`), pauses active video, and triggers Web Audio alarm `AudioEngine.playAlarm()`.
  - Snooze Feature: "+5 Min Emergency Extension" button sets `snoozeUntil` timestamp in settings and temporary memory.

### Feature 7: UI Cleaner
- **Primary Source Files**: `content/js/ui-cleaner.js`, `content/css/clean-ui.css`, `options/options.js`.
- **Implementation Mechanics**:
  - Granular Toggle Dictionary:
    - `hideBell` -> `.ss-hide-bell` (Notification bell)
    - `hideSubCount` -> `.ss-hide-sub-count` (Subscriber counts)
    - `hideChat` -> `.ss-hide-chat` (Live chat box)
    - `hideTrending` -> `.ss-hide-trending` (Trending guide link)
    - `hideExplore` -> `.ss-hide-explore` (Explore guide section)
    - `hideMiniPlayer` -> `.ss-hide-mini-player` (Miniplayer button)
    - `hideAutoplay` -> `.ss-hide-autoplay` (Autoplay toggle switch)
  - Execution: Manipulates root element classes dynamically upon setting change.

### Feature 8: Header Button
- **Primary Source Files**: `content/js/header-button.js`, `content/css/header-button.css`.
- **Implementation Mechanics**:
  - DOM Injection: Injects `#ss-header-btn-container` into YouTube masthead next to `#buttons`. Utilizes `ObserverUtils.observe('#end #buttons, ytd-masthead #buttons')` and retry loop for dynamic DOM updates.
  - Hover & Visual State: Tooltip `#ss-header-btn-tooltip` displays active status. Adds `.ss-disabled` class when features are paused.
  - In-Page Popover Dialog: Clicking Shield button opens `#ss-popup-dialog`. Injects interactive toggles for all modes, goal input with save handler, live session timer `#ss-popup-session-time`, options gear `#ss-popup-settings` (messaging `{ action: "openOptionsPage" }`), and player rank tier display (`#ss-popup-rank-tier`).
  - Outside Click Dismissal: Listens on document click to close popover dialog cleanly.

### Feature 9: Extension Popup UI
- **Primary Source Files**: `popup/popup.html`, `popup/popup.js`, `popup/popup.css`.
- **Implementation Mechanics**:
  - Layout & Design: Dark glassmorphism toolbar popup with rounded pill toggles and custom typography.
  - Interactive Controls: Toggles for Shorts Blocker, Focus Mode, Study Mode, Goal Mode, Minimal Mode, Time Manager, and Audio Effects. Triggers active tab reload on toggle change.
  - Goal Management: Editable goal input (`#goal-input`) redirecting active YouTube tab to search results for the new goal keyword upon save.
  - Custom Blocklist Inputs: Comma-separated keyword (`#pop-blocked-keywords`) and channel (`#pop-blocked-channels`) inputs synchronizing directly to storage.
  - Live Dashboard Stats: Displays today watch time (`#today-time`), learning time (`#learning-time`), focus score % (`#focus-score`), session timer (`#session-time`), player PUBG rank tier (`#popup-rank-tier`), and options gear link (`#open-settings`).

### Feature 10: Options Dashboard
- **Primary Source Files**: `options/options.html`, `options/options.js`, `options/options.css`.
- **Implementation Mechanics**:
  - Tabbed Layout: Sidebar navigation switching between General, Modes, Time Manager, UI Cleaner, Blocklist, Analytics, Gamification, and Data Backup.
  - Visual Analytics Charts: SVG/CSS bar charts for 7-Day and 30-Day periods comparing Learning Time vs Total Watch Time per day with tooltips displaying exact hours/minutes.
  - Data Backup & Restore:
    - JSON Export: Exports full `{ settings, tracking }` payload with date-stamped filename `shorts-shield-backup-YYYY-MM-DD.json`.
    - CSV Export: Exports tabular daily records `Date, Total Watch Time (Mins), Learning Time (Mins), Focus Score (%)`.
    - JSON Import: Upload file reader validating schema before calling `StorageUtil.saveSettings()` and `StorageUtil.saveTracking()`.
  - Blocklist Manager: Inputs `#opt-blocked-keywords` and `#opt-blocked-channels` updating storage.

### Feature 11: Gamification Engine
- **Primary Source Files**: `utils/gamification-engine.js`, `utils/storage.js`, `utils/time-tracker.js`, `options/options.js`.
- **Implementation Mechanics**:
  - Badge Registry: 22 Badges categorized into Time Milestones (8 badges, 1,700 AP), Streaks (7 badges, 1,200 AP), and Shield Guard (7 badges, 1,200 AP). Awards range from +50 to +500 AP and +500 to +5000 EXP.
  - Level Progression Math: Quadratic formula $E(L) = 100L^2 + 100L - 200$. Total EXP calculated as Badge EXP + Math.floor(TotalLearningSeconds / 6). Calculates Level, current/next thresholds, and progress percentage.
  - 6 Rank Tiers: Bronze Focus (0-200 AP), Silver Scholar (200-500 AP), Gold Mastermind (500-1000 AP), Diamond Warrior (1000-2000 AP), Heroic Monk (2000-3500 AP), Grandmaster Legend (3500+ AP).
  - Streak Engine: Calculates `currentStreak` and `longestStreak` based on consecutive daily activity in local timezone.
  - PUBG Battle Card UI: Hero banner displaying rank icon (`#battle-rank-icon`), rank name (`#battle-rank-name`), level badge (`#battle-level-badge`), total AP (`#battle-ap-score`), EXP progress bar (`#battle-xp-fill`), and 22-badge interactive achievement grid.

### Feature 12: Audio Effects
- **Primary Source Files**: `utils/audio-engine.js`, `popup/popup.js`, `options/options.js`.
- **Implementation Mechanics**:
  - Sound Synthesizer: Zero-file Web Audio API engine (`AudioContext` / `webkitAudioContext`).
  - Audio Methods:
    - `playTone(freq, type, duration, startTime, gainValue)`: Synthesizes oscillators ('sine', 'square', 'triangle', 'sawtooth') with exponential ramp decay.
    - `playLevelUp()`: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz) ascending synth chimes.
    - `playBadgeUnlock()`: A4 (440Hz), C#5 (554.37Hz), E5 (659.25Hz) triangle wave fanfare.
    - `playAlarm()`: 880Hz square beep x2 + 440Hz sawtooth warning tone.
    - `playClick()`: 600Hz sine tactile click (0.05s).
  - Master Control: `this.enabled` property updated by `audioEffects` toggle setting.

---

## 4. Tier 1 End-to-End Test Specifications (60 Test Specifications)

The following Tier 1 test suite guarantees complete, comprehensive coverage across all 12 core features (>=5 test cases per feature).

---

### Feature 1: Shorts Blocker (Test Specifications T1.1.1 – T1.1.5)

#### Test T1.1.1: Direct URL Interception and Redirection for `/shorts/`
- **Preconditions**: Extension active, `shortsBlocker = true`.
- **Execution Steps**:
  1. Navigate browser window to `https://www.youtube.com/shorts/abc123xyz`.
  2. Call `window.ShortsBlocker.checkAndRedirectShortsURL()`.
- **Expected Results & Assertions**:
  - `window.location.replace` is called with `'https://www.youtube.com/'`.
  - Browser URL changes to home feed instantly.
- **Source Trace**: `content/js/shorts-blocker.js:58-68`.

#### Test T1.1.2: Direct URL Interception and Redirection for `/playables/`
- **Preconditions**: Extension active, `shortsBlocker = true`.
- **Execution Steps**:
  1. Navigate browser window to `https://www.youtube.com/playables/game456`.
  2. Call `window.ShortsBlocker.checkAndRedirectShortsURL()`.
- **Expected Results & Assertions**:
  - Redirection target equals `'https://www.youtube.com/'`.
  - Console logs `[Shorts Shield] Shorts/Playables URL detected`.
- **Source Trace**: `content/js/shorts-blocker.js:61-66`.

#### Test T1.1.3: Dynamic SPA Route Change Interception (`yt-navigate-finish`)
- **Preconditions**: Extension active, `ShortsBlocker` enabled.
- **Execution Steps**:
  1. Change `window.location.href` to `https://www.youtube.com/shorts/test789`.
  2. Dispatch event `new Event('yt-navigate-finish')` on `window`.
- **Expected Results & Assertions**:
  - `boundSPAListener` catches event and invokes `checkAndRedirectShortsURL()`.
  - Location is redirected away from `/shorts/`.
- **Source Trace**: `content/js/shorts-blocker.js:70-78`.

#### Test T1.1.4: Root CSS Class Application and Container Hiding
- **Preconditions**: `ShortsBlocker` disabled initially.
- **Execution Steps**:
  1. Call `window.ShortsBlocker.enable()`.
  2. Inspect root HTML document classes.
- **Expected Results & Assertions**:
  - `document.documentElement` contains class `shorts-shield-block-shorts`.
  - `ObserverUtils.observe` is invoked with category `'shorts-blocker'`.
- **Source Trace**: `content/js/shorts-blocker.js:98-118`.

#### Test T1.1.5: Observer-Based Shorts Reel Container Removal
- **Preconditions**: `ShortsBlocker` enabled, DOM contains `<ytd-reel-shelf-renderer><a href="/shorts/123"></a></ytd-reel-shelf-renderer>`.
- **Execution Steps**:
  1. Trigger observer callback for element `a[href*="shorts"]`.
- **Expected Results & Assertions**:
  - Parent container `ytd-reel-shelf-renderer` style `display` is set to `'none'`.
  - `ShortsBlocker.stats.removed` increments by 1.
- **Source Trace**: `content/js/shorts-blocker.js:143-186`.

---

### Feature 2: Focus Mode (Test Specifications T1.2.1 – T1.2.5)

#### Test T1.2.1: Enable Focus Mode Class Injection
- **Preconditions**: `FocusMode` inactive.
- **Execution Steps**:
  1. Call `window.FocusMode.enable()`.
- **Expected Results & Assertions**:
  - `document.documentElement.classList.contains('shorts-shield-focus-mode')` is `true`.
  - `FocusMode.isActive` equals `true`.
- **Source Trace**: `content/js/focus-mode.js:7-22`.

#### Test T1.2.2: Disable Focus Mode Class Removal
- **Preconditions**: `FocusMode` active.
- **Execution Steps**:
  1. Call `window.FocusMode.disable()`.
- **Expected Results & Assertions**:
  - Class `shorts-shield-focus-mode` is removed from `document.documentElement`.
  - `FocusMode.isActive` equals `false`.
- **Source Trace**: `content/js/focus-mode.js:24-38`.

#### Test T1.2.3: Comments Section Hiding Verification via CSS Rule
- **Preconditions**: `shorts-shield-focus-mode` class applied to root document.
- **Execution Steps**:
  1. Inject dummy `#comments` div into DOM.
  2. Compute styles or verify CSS selector `.shorts-shield-focus-mode #comments`.
- **Expected Results & Assertions**:
  - `#comments` display property resolves to `none !important`.
- **Source Trace**: `content/css/focus-mode.css:12-25`.

#### Test T1.2.4: Recommendations Sidebar Hiding Verification
- **Preconditions**: `shorts-shield-focus-mode` class applied.
- **Execution Steps**:
  1. Query `#secondary` and `#related` elements in DOM.
- **Expected Results & Assertions**:
  - `.shorts-shield-focus-mode #secondary` and `.shorts-shield-focus-mode #related` have `display: none !important`.
- **Source Trace**: `content/css/focus-mode.css:28-40`.

#### Test T1.2.5: Toggle Idempotency Check
- **Preconditions**: `FocusMode` already enabled.
- **Execution Steps**:
  1. Call `window.FocusMode.enable()` a second time.
- **Expected Results & Assertions**:
  - Function returns early without re-adding class or throwing errors.
  - Class count remains exactly 1.
- **Source Trace**: `content/js/focus-mode.js:8`.

---

### Feature 3: Study Mode (Test Specifications T1.3.1 – T1.3.5)

#### Test T1.3.1: Study Mode Banner Injection & Goal Display
- **Preconditions**: `StudyMode` inactive.
- **Execution Steps**:
  1. Call `window.StudyMode.enable('Learn Quantum Physics')`.
- **Expected Results & Assertions**:
  - DOM contains element `#ss-study-banner`.
  - Element `#ss-goal-text` text content equals `'Learn Quantum Physics'`.
  - `StudyMode.isActive` equals `true`.
- **Source Trace**: `content/js/study-mode.js:18-35`, `57-119`.

#### Test T1.3.2: Banner Timer Counter Tick
- **Preconditions**: `StudyMode` active, timer started.
- **Execution Steps**:
  1. Fast-forward timer clock by 5000ms.
- **Expected Results & Assertions**:
  - Element `#ss-session-timer` text content equals `'00:05'`.
- **Source Trace**: `content/js/study-mode.js:145-157`.

#### Test T1.3.3: On-Topic Watch Video Alignment Check (No Warning)
- **Preconditions**: `StudyMode` active with goal `'Learn Python Programming'`. Set `window.location.pathname = '/watch'`.
- **Execution Steps**:
  1. Inject `<h1 class="ytd-watch-metadata">yt-formatted-string: "Python Full Course for Beginners"</h1>`.
  2. Call `window.StudyMode.checkVideoAlignment()`.
- **Expected Results & Assertions**:
  - Keyword `'python'` matches title.
  - Element `#ss-alignment-warning` is NOT present in DOM.
- **Source Trace**: `content/js/study-mode.js:166-248`.

#### Test T1.3.4: Off-Topic Watch Video Alignment Check (Triggers Warning)
- **Preconditions**: `StudyMode` active with goal `'Learn Quantum Physics'`. Set watch page URL.
- **Execution Steps**:
  1. Inject `<h1 class="ytd-watch-metadata">yt-formatted-string: "Top 10 Funny Cat Videos 2026"</h1>`.
  2. Call `window.StudyMode.checkVideoAlignment()`.
- **Expected Results & Assertions**:
  - Title fails keyword match for `'quantum'` and `'physics'`.
  - Warning banner `#ss-alignment-warning` is injected into DOM.
- **Source Trace**: `content/js/study-mode.js:238-247`, `250-308`.

#### Test T1.3.5: Masthead Layout Restoration on Disable
- **Preconditions**: `StudyMode` active, masthead padding modified to `36px`.
- **Execution Steps**:
  1. Call `window.StudyMode.disable()`.
- **Expected Results & Assertions**:
  - Banner `#ss-study-banner` removed from DOM.
  - `document.body.style.paddingTop` restored to original value.
  - `StudyMode.isActive` equals `false`.
- **Source Trace**: `content/js/study-mode.js:37-48`, `126-143`.

---

### Feature 4: Goal Mode Strict (Test Specifications T1.4.1 – T1.4.5)

#### Test T1.4.1: Goal Mode Feed Filtering Activation
- **Preconditions**: `GoalMode` inactive.
- **Execution Steps**:
  1. Call `window.GoalMode.enable('Master Rust Lang')`.
- **Expected Results & Assertions**:
  - Root element contains class `shorts-shield-goal-mode`.
  - `FeedController.isActive` equals `true`.
  - `FeedController.goalKeywords` contains `'rust'` and `'lang'`.
- **Source Trace**: `content/js/goal-mode.js:13-39`.

#### Test T1.4.2: Feed Items Off-Topic Hiding
- **Preconditions**: `GoalMode` active with goal `'Master Rust Lang'`.
- **Execution Steps**:
  1. Inject two video items into DOM: Item A ("Rust Async Crash Course") and Item B ("Minecraft Gameplay Part 1").
  2. Call `FeedController.applyBlocklist()`.
- **Expected Results & Assertions**:
  - Item A remains visible (`display: ''`).
  - Item B receives class `.off-topic` and `display: none`.
- **Source Trace**: `content/js/feed-controller.js:39-84`.

#### Test T1.4.3: Strict Video Play Lock on Off-Topic Watch Page
- **Preconditions**: `GoalMode` active on `/watch?v=offtopic123` with goal `'Learn Machine Learning'`.
- **Execution Steps**:
  1. Inject title "Celebrity Gossip Secrets".
  2. Run `GoalMode.checkVideoGoalAlignment()`.
  3. Dispatch `'play'` event on `<video>` element.
- **Expected Results & Assertions**:
  - `GoalMode.isBlocked` equals `true`.
  - Video play lock handler invokes `video.pause()`.
- **Source Trace**: `content/js/goal-mode.js:67-92`, `173-176`.

#### Test T1.4.4: Full-Screen Goal Block Overlay Ingestion
- **Preconditions**: Off-topic video detected in Goal Mode.
- **Execution Steps**:
  1. Inspect DOM after alignment check.
- **Expected Results & Assertions**:
  - Element `#ss-goal-block-overlay` present with zIndex `2147483647`.
  - Search button `#ss-btn-search-goal` href contains `search_query=Learn%20Machine%20Learning`.
- **Source Trace**: `content/js/goal-mode.js:190-255`.

#### Test T1.4.5: Goal Mode Disable Play Lock Release
- **Preconditions**: Goal Mode currently blocking off-topic video.
- **Execution Steps**:
  1. Call `window.GoalMode.disable()`.
- **Expected Results & Assertions**:
  - Overlay `#ss-goal-block-overlay` removed from DOM.
  - Video play lock listener removed.
  - `GoalMode.isBlocked` reset to `false`.
- **Source Trace**: `content/js/goal-mode.js:41-59`.

---

### Feature 5: Minimal Mode (Test Specifications T1.5.1 – T1.5.5)

#### Test T1.5.1: Minimal Mode Class Injection
- **Preconditions**: Minimal Mode off.
- **Execution Steps**:
  1. Apply class `shorts-shield-minimal-mode` to `document.documentElement`.
- **Expected Results & Assertions**:
  - `document.documentElement.classList.contains('shorts-shield-minimal-mode')` is `true`.
- **Source Trace**: `content/css/focus-mode.css:120-135`.

#### Test T1.5.2: Left Guide Sidebar Hiding
- **Preconditions**: `shorts-shield-minimal-mode` active.
- **Execution Steps**:
  1. Query `#guide` and `ytd-mini-guide-renderer` in DOM.
- **Expected Results & Assertions**:
  - CSS rule `.shorts-shield-minimal-mode #guide` resolves to `display: none !important`.
  - Mini guide resolves to `display: none !important`.
- **Source Trace**: `content/css/focus-mode.css:140-155`.

#### Test T1.5.3: Masthead Auxiliary Element Hiding
- **Preconditions**: `shorts-shield-minimal-mode` active.
- **Execution Steps**:
  1. Query `#buttons`, `ytd-topbar-menu-button-renderer` in masthead.
- **Expected Results & Assertions**:
  - Non-essential masthead action buttons hidden via CSS while top search bar remains visible.
- **Source Trace**: `content/css/focus-mode.css:160-175`.

#### Test T1.5.4: Home Feed Header & Chips Hiding
- **Preconditions**: Minimal Mode active on Home page.
- **Execution Steps**:
  1. Query `yt-chip-cloud-renderer` (category filter chips).
- **Expected Results & Assertions**:
  - Category chips section has `display: none !important`.
- **Source Trace**: `content/css/focus-mode.css:180-192`.

#### Test T1.5.5: Minimal Mode Clean Removal
- **Preconditions**: Minimal Mode active.
- **Execution Steps**:
  1. Remove class `shorts-shield-minimal-mode` from root document.
- **Expected Results & Assertions**:
  - Standard YouTube layout components restored to default visibility.
- **Source Trace**: `content/css/focus-mode.css:195-205`.

---

### Feature 6: Time Manager (Test Specifications T1.6.1 – T1.6.5)

#### Test T1.6.1: Time Limit Exceeded Detection
- **Preconditions**: `TimeManager` enabled with `dailyLimitMinutes = 30`. Mock tracking data: `dailyWatchTime['2026-08-10'] = 2400` (40 mins).
- **Execution Steps**:
  1. Call `window.TimeManager.evaluate()`.
- **Expected Results & Assertions**:
  - `limitExceeded` evaluates to `true`.
  - Overlay `#ss-time-manager-overlay` injected into DOM.
- **Source Trace**: `content/js/time-manager.js:48-87`.

#### Test T1.6.2: Scheduled Focus Window Enforcement (Daytime Window)
- **Preconditions**: `TimeManager` enabled with `scheduleEnabled = true`, `scheduleStart = "09:00"`, `scheduleEnd = "17:00"`. Mock current time: 14:30.
- **Execution Steps**:
  1. Call `window.TimeManager.isScheduleBlocked()`.
- **Expected Results & Assertions**:
  - Returns `true`.
  - Overlay reason set to `'schedule'`.
- **Source Trace**: `content/js/time-manager.js:89-109`.

#### Test T1.6.3: Scheduled Focus Window Overnight Schedule Handling
- **Preconditions**: `scheduleStart = "22:00"`, `scheduleEnd = "06:00"`. Mock current time: 02:15.
- **Execution Steps**:
  1. Call `window.TimeManager.isScheduleBlocked()`.
- **Expected Results & Assertions**:
  - Returns `true` (overnight logic correctly handles cross-midnight boundary).
- **Source Trace**: `content/js/time-manager.js:106-108`.

#### Test T1.6.4: Video Pause and Alarm Playback on Trigger
- **Preconditions**: Active `<video>` playing in DOM.
- **Execution Steps**:
  1. Trigger `TimeManager.evaluate()` under limit breach.
- **Expected Results & Assertions**:
  - `<video>` element `pause()` method called.
  - `AudioEngine.playAlarm()` invoked.
- **Source Trace**: `content/js/time-manager.js:111-125`.

#### Test T1.6.5: Emergency Snooze Extension (+5 Min)
- **Preconditions**: Time Manager overlay displayed on screen.
- **Execution Steps**:
  1. Click `#ss-tm-snooze` button.
- **Expected Results & Assertions**:
  - `TimeManager.config.snoozeUntil` set to `Date.now() + 300000`.
  - Overlay `#ss-time-manager-overlay` removed from DOM.
  - Subsequent `evaluate()` calls return early without showing overlay until snooze expires.
- **Source Trace**: `content/js/time-manager.js:175-184`.

---

### Feature 7: UI Cleaner (Test Specifications T1.7.1 – T1.7.5)

#### Test T1.7.1: Apply Settings Mapping to Root Classes
- **Preconditions**: `UICleaner` initialized.
- **Execution Steps**:
  1. Call `UICleaner.applySettings({ hideBell: true, hideChat: true, hideAutoplay: false })`.
- **Expected Results & Assertions**:
  - `document.documentElement` contains `ss-hide-bell` and `ss-hide-chat`.
  - `document.documentElement` does NOT contain `ss-hide-autoplay`.
- **Source Trace**: `content/js/ui-cleaner.js:15-35`.

#### Test T1.7.2: Single Setting Granular Update
- **Preconditions**: `ss-hide-sub-count` not present.
- **Execution Steps**:
  1. Call `UICleaner.updateSetting('hideSubCount', true)`.
- **Expected Results & Assertions**:
  - Class `ss-hide-sub-count` added to root element.
- **Source Trace**: `content/js/ui-cleaner.js:38-57`.

#### Test T1.7.3: Notification Bell Hiding CSS Verification
- **Preconditions**: `ss-hide-bell` class present on root document.
- **Execution Steps**:
  1. Query `ytd-notification-topbar-button-renderer` in DOM.
- **Expected Results & Assertions**:
  - CSS rule `.ss-hide-bell ytd-notification-topbar-button-renderer` resolves to `display: none !important`.
- **Source Trace**: `content/css/clean-ui.css:5-15`.

#### Test T1.7.4: Live Chat Replay Hiding CSS Verification
- **Preconditions**: `ss-hide-chat` class present on root document.
- **Execution Steps**:
  1. Query `#chat` and `#chatframe` elements.
- **Expected Results & Assertions**:
  - Elements resolved to `display: none !important`.
- **Source Trace**: `content/css/clean-ui.css:35-48`.

#### Test T1.7.5: Autoplay Toggle Switch Hiding CSS Verification
- **Preconditions**: `ss-hide-autoplay` class present.
- **Execution Steps**:
  1. Query `.ytp-autonav-toggle-button` in DOM.
- **Expected Results & Assertions**:
  - Autoplay toggle button hidden via CSS.
- **Source Trace**: `content/css/clean-ui.css:80-92`.

---

### Feature 8: Header Button (Test Specifications T1.8.1 – T1.8.5)

#### Test T1.8.1: Header Button DOM Injection in YouTube Masthead
- **Preconditions**: YouTube masthead `#end #buttons` present in DOM. `HeaderButton` inactive.
- **Execution Steps**:
  1. Call `window.HeaderButton.enable()`.
- **Expected Results & Assertions**:
  - Container `#ss-header-btn-container` injected into `#buttons`.
  - Button `#ss-header-btn` text contains `"Shield"`.
- **Source Trace**: `content/js/header-button.js:85-145`.

#### Test T1.8.2: Shield Active Status Indicator Update
- **Preconditions**: Extension settings have `shortsBlocker = true`.
- **Execution Steps**:
  1. Call `HeaderButton.updateState()`.
- **Expected Results & Assertions**:
  - `#ss-header-btn` does NOT contain `.ss-disabled`.
  - Tooltip `#ss-header-btn-tooltip` text contains `"Shorts Shield: Active"`.
- **Source Trace**: `content/js/header-button.js:154-176`.

#### Test T1.8.3: In-Page Popover Modal Toggle
- **Preconditions**: Header button present in DOM, popover closed.
- **Execution Steps**:
  1. Click `#ss-header-btn`.
- **Expected Results & Assertions**:
  - Popover dialog `#ss-popup-dialog` created and appended to container.
  - Interactive mode toggles rendered inside dialog.
- **Source Trace**: `content/js/header-button.js:178-290`.

#### Test T1.8.4: Popover Goal Editing & Save Trigger
- **Preconditions**: Popover dialog open.
- **Execution Steps**:
  1. Click `#ss-popup-edit-goal`.
  2. Input new goal `"Master WebAssembly"`.
  3. Click `#ss-popup-save-goal`.
- **Expected Results & Assertions**:
  - `StorageUtil.updateSetting` called with `'learningGoal'` = `"Master WebAssembly"`.
  - Browser location updated to search results URL for `"Master WebAssembly"`.
- **Source Trace**: `content/js/header-button.js:350-386`.

#### Test T1.8.5: Outside Click Popover Dismissal
- **Preconditions**: Popover dialog `#ss-popup-dialog` currently open.
- **Execution Steps**:
  1. Dispatch click event on outside element `document.body`.
- **Expected Results & Assertions**:
  - `onOutsideClick()` fires.
  - Dialog `#ss-popup-dialog` removed from DOM.
- **Source Trace**: `content/js/header-button.js:489-503`.

---

### Feature 9: Extension Popup UI (Test Specifications T1.9.1 – T1.9.5)

#### Test T1.9.1: Extension Popup Initialization & Storage Load
- **Preconditions**: Popup document DOM loaded. Mock settings: `shortsBlocker = true`, `learningGoal = "Rust Coding"`.
- **Execution Steps**:
  1. Trigger `DOMContentLoaded` event in `popup.js`.
- **Expected Results & Assertions**:
  - `#toggle-shorts` checkbox `checked` state is `true`.
  - `#current-goal` text content equals `"Rust Coding"`.
- **Source Trace**: `popup/popup.js:1-35`.

#### Test T1.9.2: Mode Toggle Event & Active Tab Reload
- **Preconditions**: Popup open, mock active YouTube tab ID 101.
- **Execution Steps**:
  1. Click `#toggle-focus` switch to enable.
- **Expected Results & Assertions**:
  - `StorageUtil.updateSetting('focusMode', true)` invoked.
  - `chrome.tabs.reload(101)` called.
- **Source Trace**: `popup/popup.js:38-50`, `77`.

#### Test T1.9.3: Custom Blocklist Inputs Change Handler
- **Preconditions**: Popup open.
- **Execution Steps**:
  1. Type `"clickbait, drama, gaming"` into `#pop-blocked-keywords`.
  2. Dispatch `'change'` event.
- **Expected Results & Assertions**:
  - `StorageUtil.updateSetting('blockedKeywords', ['clickbait', 'drama', 'gaming'])` called.
- **Source Trace**: `popup/popup.js:84-94`.

#### Test T1.9.4: Popup Statistics & Focus Score Rendering
- **Preconditions**: Mock tracking data: `dailyWatchTime['2026-08-10'] = 3600` (1h), `dailyLearningTime['2026-08-10'] = 2700` (45m).
- **Execution Steps**:
  1. Render popup DOM.
- **Expected Results & Assertions**:
  - `#today-time` text equals `"1h 0m"`.
  - `#learning-time` text equals `"0h 45m"`.
  - `#focus-score` text equals `"75%"`.
- **Source Trace**: `popup/popup.js:157-174`.

#### Test T1.9.5: Cross-Browser Options Page Launch
- **Preconditions**: Click listener attached to `#open-settings`.
- **Execution Steps**:
  1. Click `#open-settings` link.
- **Expected Results & Assertions**:
  - Fallback logic checks `chrome.tabs.create`, `chrome.runtime.openOptionsPage`, or fallback message `{ action: "openOptionsPage" }`.
- **Source Trace**: `popup/popup.js:183-202`.

---

### Feature 10: Options Dashboard (Test Specifications T1.10.1 – T1.10.5)

#### Test T1.10.1: Navigation Tab Switching
- **Preconditions**: Options page loaded on `'general'` tab.
- **Execution Steps**:
  1. Click navigation tab item `li[data-tab="analytics"]`.
- **Expected Results & Assertions**:
  - Tab item receives class `.active`.
  - Section `#analytics-tab` receives class `.active`.
- **Source Trace**: `options/options.js:6-25`.

#### Test T1.10.2: 7-Day & 30-Day Visual Analytics SVG/CSS Chart Render
- **Preconditions**: Analytics tab active. Mock 7-day tracking data populated.
- **Execution Steps**:
  1. Call `renderAnalyticsChart(7)`.
- **Expected Results & Assertions**:
  - Container `#analytics-chart-container` contains 7 bar wrapper elements.
  - Each bar wrapper contains learning height div and total watch background div.
- **Source Trace**: `options/options.js:396-448`.

#### Test T1.10.3: Data Backup JSON Export Trigger
- **Preconditions**: Options page loaded with valid settings and tracking state.
- **Execution Steps**:
  1. Click `#btn-export-json`.
- **Expected Results & Assertions**:
  - Dynamic `<a>` download element created with `download` attribute matching `shorts-shield-backup-YYYY-MM-DD.json`.
  - Data string contains stringified JSON payload with `settings` and `tracking` keys.
- **Source Trace**: `options/options.js:336-347`.

#### Test T1.10.4: Data Restore JSON Import Parsing and Validation
- **Preconditions**: Valid backup JSON string: `{"settings": {"shortsBlocker": true}, "tracking": {}}`.
- **Execution Steps**:
  1. Simulate file selection on `#file-import-json`.
  2. FileReader triggers `onload`.
- **Expected Results & Assertions**:
  - `StorageUtil.saveSettings` and `StorageUtil.saveTracking` called.
  - Success alert displayed and page reloaded.
- **Source Trace**: `options/options.js:374-392`.

#### Test T1.10.5: CSV Data Export Schema Verification
- **Preconditions**: Daily watch tracking contains records for multiple days.
- **Execution Steps**:
  1. Click `#btn-export-csv`.
- **Expected Results & Assertions**:
  - Generated CSV string header equals `"Date,Total Watch Time (Mins),Learning Time (Mins),Focus Score (%)\n"`.
- **Source Trace**: `options/options.js:349-372`.

---

### Feature 11: Gamification Engine (Test Specifications T1.11.1 – T1.11.5)

#### Test T1.11.1: Total AP Calculation from Unlocked Badges
- **Preconditions**: Badges array `['first_step', 'focus_rookie', 'deep_diver']`.
- **Execution Steps**:
  1. Call `GamificationEngine.calculateTotalAP(['first_step', 'focus_rookie', 'deep_diver'])`.
- **Expected Results & Assertions**:
  - Returns `200` (50 + 50 + 100 AP).
- **Source Trace**: `utils/gamification-engine.js:57-63`.

#### Test T1.11.2: Total EXP Calculation (Badges + Learning Time)
- **Preconditions**: Unlocked badges `['first_step']` (500 EXP), total learning time seconds = `3600` (600 EXP).
- **Execution Steps**:
  1. Call `GamificationEngine.calculateTotalEXP(['first_step'], 3600)`.
- **Expected Results & Assertions**:
  - Returns `1100` EXP.
- **Source Trace**: `utils/gamification-engine.js:71-78`.

#### Test T1.11.3: Level Progression Math Curve $E(L) = 100L^2 + 100L - 200$
- **Preconditions**: Total EXP = `400`.
- **Execution Steps**:
  1. Call `GamificationEngine.calculateLevelFromEXP(400)`.
- **Expected Results & Assertions**:
  - Level 1 threshold = 0 EXP, Level 2 threshold = 400 EXP.
  - Returns `level = 2`, `expInCurrentLevel = 0`, `progressPct = 0`.
- **Source Trace**: `utils/gamification-engine.js:85-103`.

#### Test T1.11.4: Rank Tier Threshold Mapping
- **Preconditions**: Total AP = `1200`.
- **Execution Steps**:
  1. Call `GamificationEngine.getRankTierFromAP(1200)`.
- **Expected Results & Assertions**:
  - Returns `currentRank.title = "Diamond Warrior"`, `icon = "💎"`, `nextRank.title = "Heroic Monk"`.
- **Source Trace**: `utils/gamification-engine.js:110-148`.

#### Test T1.11.5: 22-Badge Render & Category Filtering in Options
- **Preconditions**: Options gamification tab open. `BADGE_DEFINITIONS` contains 22 badges.
- **Execution Steps**:
  1. Call `renderBadges('streak')`.
- **Expected Results & Assertions**:
  - Container `#badges-container` contains exactly 7 badge items matching category `'streak'`.
- **Source Trace**: `options/options.js:277-307`.

---

### Feature 12: Audio Effects (Test Specifications T1.12.1 – T1.12.5)

#### Test T1.12.1: Web Audio Context Lazy Initialization
- **Preconditions**: `AudioEngine.ctx = null`. Mock `window.AudioContext`.
- **Execution Steps**:
  1. Call `window.AudioEngine.init()`.
- **Expected Results & Assertions**:
  - `AudioEngine.ctx` is instantiated as valid `AudioContext`.
- **Source Trace**: `utils/audio-engine.js:12-22`.

#### Test T1.12.2: Master Enable/Disable Toggle Suppresses Sound Output
- **Preconditions**: `AudioEngine.enabled = false`.
- **Execution Steps**:
  1. Call `AudioEngine.playLevelUp()`.
- **Expected Results & Assertions**:
  - Method returns immediately without creating oscillators or gains.
- **Source Trace**: `utils/audio-engine.js:49-50`.

#### Test T1.12.3: Level Up Fanfare Note Sequence Generation
- **Preconditions**: `AudioEngine.enabled = true`. Spy on `playTone`.
- **Execution Steps**:
  1. Call `AudioEngine.playLevelUp()`.
- **Expected Results & Assertions**:
  - `playTone` invoked 4 times with frequencies `523.25`, `659.25`, `783.99`, `1046.50`.
- **Source Trace**: `utils/audio-engine.js:48-54`.

#### Test T1.12.4: Badge Unlock Fanfare Sound Synthesis
- **Preconditions**: `AudioEngine.enabled = true`. Spy on `playTone`.
- **Execution Steps**:
  1. Call `AudioEngine.playBadgeUnlock()`.
- **Expected Results & Assertions**:
  - `playTone` invoked 3 times with triangle oscillator type (`'triangle'`).
- **Source Trace**: `utils/audio-engine.js:57-62`.

#### Test T1.12.5: Budget Alarm Sound Synthesis
- **Preconditions**: `AudioEngine.enabled = true`. Spy on `playTone`.
- **Execution Steps**:
  1. Call `AudioEngine.playAlarm()`.
- **Expected Results & Assertions**:
  - `playTone` invoked with square and sawtooth wave types for warning tone.
- **Source Trace**: `utils/audio-engine.js:65-70`.

---

## 5. Summary Matrix of Tier 1 Test Specifications

| # | Feature Name | Test Range | Total Tests | Target Source Files |
|---|--------------|------------|-------------|---------------------|
| 1 | **Shorts Blocker** | T1.1.1 – T1.1.5 | 5 | `content/js/shorts-blocker.js`, `background/background.js` |
| 2 | **Focus Mode** | T1.2.1 – T1.2.5 | 5 | `content/js/focus-mode.js`, `content/css/focus-mode.css` |
| 3 | **Study Mode** | T1.3.1 – T1.3.5 | 5 | `content/js/study-mode.js`, `content/js/feed-controller.js` |
| 4 | **Goal Mode (Strict)** | T1.4.1 – T1.4.5 | 5 | `content/js/goal-mode.js`, `content/js/feed-controller.js` |
| 5 | **Minimal Mode** | T1.5.1 – T1.5.5 | 5 | `content/css/focus-mode.css`, `popup/popup.js` |
| 6 | **Time Manager** | T1.6.1 – T1.6.5 | 5 | `content/js/time-manager.js`, `utils/time-tracker.js` |
| 7 | **UI Cleaner** | T1.7.1 – T1.7.5 | 5 | `content/js/ui-cleaner.js`, `content/css/clean-ui.css` |
| 8 | **Header Button** | T1.8.1 – T1.8.5 | 5 | `content/js/header-button.js`, `content/css/header-button.css` |
| 9 | **Popup UI** | T1.9.1 – T1.9.5 | 5 | `popup/popup.js`, `popup/popup.html` |
| 10 | **Options Dashboard** | T1.10.1 – T1.10.5 | 5 | `options/options.js`, `options/options.html` |
| 11 | **Gamification Engine**| T1.11.1 – T1.11.5 | 5 | `utils/gamification-engine.js`, `options/options.js` |
| 12 | **Audio Effects** | T1.12.1 – T1.12.5 | 5 | `utils/audio-engine.js` |
| **TOTAL** | | | **60** | |

---

## 6. Verification & Test Execution Guide

To independently verify these Tier 1 test specifications:

1. **Run Full Test Suite via Master Runner**:
   ```bash
   node /Users/shivarampatel/Desktop/shorts-shield/run-tests.js
   ```
2. **Run Programmatic Syntax Verification**:
   ```bash
   node /Users/shivarampatel/Desktop/shorts-shield/tests/syntax/syntax-checker.js
   ```
3. **Execute Tier 1 Unit Specs Specifically**:
   ```bash
   node /Users/shivarampatel/Desktop/shorts-shield/tests/tier1/harness-sanity.test.js
   ```

---

## 7. Conclusion

The Shorts Shield extension possesses a well-structured, modular codebase. All 12 core features have been mapped to their exact source implementations, and 60 comprehensive Tier 1 E2E test specifications are fully formulated to validate complete feature coverage.
