# Specification & Feature Inventory Handoff Report — Spec Miner 3

**Author**: Spec Miner 3 (Extension Modules Spec Miner)  
**Date**: 2026-08-12  
**Target Repository**: `/Users/shivarampatel/Desktop/shorts-shield`  
**Metadata Working Directory**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/spec_miner_survey_3`  
**Authoritative Reference**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/ORIGINAL_REQUEST.md` & `PROJECT.md`

---

## 1. Observation

### System & Architecture Overview
- **Manifest**: Manifest V3 WebExtension (`manifest.json`) targeting `*://*.youtube.com/*` (excluding `studio`, `music`, `tv`).
- **Core JavaScript Files**: Exactly 18 core JS files across 5 directories (`utils/`, `content/js/`, `background/`, `options/`, `popup/`) plus `run-tests.js`.
- **Test Infrastructure**: `npm test` runs 260 unit and integration tests across 4 tiers; `node -c` runs syntax validation on all 19 JS files. Command results: `node run-tests.js` exited clean with code 0; `npm test` exited clean with code 0.

### Complete File-to-Module Mapping
| # | Module / Subsystem | Primary Implementation Files | Supporting Files / Assets |
|---|-------------------|------------------------------|---------------------------|
| 1 | Master Toggle | `content/js/main.js` (lines 34-55) | `utils/storage.js`, `popup/popup.js`, `options/options.js`, `content/js/header-button.js` |
| 2 | Shorts Blocker | `content/js/shorts-blocker.js` (lines 1-298) | `content/css/hide-shorts.css`, `background/background.js`, `content/js/observer-utils.js` |
| 3 | Focus Mode | `content/js/focus-mode.js` (lines 1-60) | `content/css/focus-mode.css` |
| 4 | Study Mode + Pomodoro | `content/js/study-mode.js` (lines 1-686) | `utils/audio-engine.js`, `utils/gamification-engine.js`, `content/js/feed-controller.js` |
| 5 | Goal Mode | `content/js/goal-mode.js` (lines 1-393) | `content/js/feed-controller.js`, `content/js/gemini-assistant.js`, `utils/dom-utils.js` |
| 6 | Minimal Mode | `content/js/main.js` (lines 61-102) | `content/js/focus-mode.js`, `content/js/shorts-blocker.js`, `content/js/ui-cleaner.js` |
| 7 | Time Manager | `content/js/time-manager.js` (lines 1-224) | `utils/time-tracker.js`, `utils/audio-engine.js`, `utils/storage.js` |
| 8 | UI Cleaner | `content/js/ui-cleaner.js` (lines 1-67) | `content/css/clean-ui.css` |
| 9 | Header Button Popover | `content/js/header-button.js` (lines 1-616) | `content/css/header-button.css`, `content/js/observer-utils.js`, `utils/dom-utils.js` |
| 10 | Toolbar Popup | `popup/popup.js` (lines 1-311) | `popup/popup.html`, `popup/popup.css`, `utils/storage.js`, `utils/audio-engine.js` |
| 11 | Options Dashboard | `options/options.js` (lines 1-593) | `options/options.html`, `options/options.css`, `utils/gamification-engine.js` |
| 12 | Gemini AI Assistant | `content/js/gemini-assistant.js` (lines 1-184) | `content/js/header-button.js`, `content/js/goal-mode.js` |
| 13 | Gamification & Sound Engine | `utils/gamification-engine.js` & `utils/audio-engine.js` | `utils/storage.js`, `utils/time-tracker.js` |
| 14 | Feed Controller & Blocklist | `content/js/feed-controller.js` (lines 1-259) | `content/css/feed-controller.css`, `content/js/observer-utils.js` |
| 15 | Time Tracker Subsystem | `utils/time-tracker.js` (lines 1-393) | `utils/storage.js`, `utils/gamification-engine.js` |
| 16 | Storage Cascade & Observer | `utils/storage.js`, `utils/dom-utils.js`, `content/js/observer-utils.js` | `manifest.json` |

---

## 2. Chrome Extension API Mapping Matrix

| Extension Module | Storage API (`chrome.storage`) | Tabs API (`chrome.tabs`) | Runtime / Messaging API | Content Script | Background Service Worker | Popup UI (`action`) | Options Page (`options_ui`) | Web Navigation (`webNavigation`) |
|------------------|-------------------------------|-------------------------|------------------------|----------------|---------------------------|--------------------|----------------------------|---------------------------------|
| 1. Master Toggle | `sync`, `local`, `onChanged` | `query`, `reload` | `sendMessage` | `main.js` | Checked before intercepting | Checkbox toggle in popup | Syncs across tabs | N/A |
| 2. Shorts Blocker | `sync`, `local`, `session` | `update`, `reload` | IPC router | `shorts-blocker.js` | `onBeforeNavigate`, `onHistoryStateUpdated` | Toggle switch | Toggle switch | URL Interception (`/shorts/*`, `/playables/*`) |
| 3. Focus Mode | `sync`, `local` | N/A | Settings listener | `focus-mode.js` | N/A | Toggle switch | Toggle switch | N/A |
| 4. Study Mode | `sync`, `local` | N/A | `yt-navigate-finish` | `study-mode.js` | N/A | Toggle switch | Pomodoro config | N/A |
| 5. Goal Mode | `sync`, `local` | N/A | `yt-navigate-finish` | `goal-mode.js` | N/A | Toggle switch | Goal text editor | N/A |
| 6. Minimal Mode | `sync`, `local` | N/A | Settings listener | `main.js` | N/A | Toggle switch | Toggle switch | N/A |
| 7. Time Manager | `sync`, `local` | N/A | Alarm trigger IPC | `time-manager.js` | Optional alarms | Toggle switch | Limits & Schedule | N/A |
| 8. UI Cleaner | `sync`, `local` | N/A | Settings listener | `ui-cleaner.js` | N/A | Quick switches | 7 Granular Switches | N/A |
| 9. Header Button | `sync`, `local`, `onChanged` | N/A | `{action: "openOptionsPage"}` | `header-button.js` | N/A | Embedded floating popover | Opens Options page | SPA nav listener |
| 10. Toolbar Popup | `sync`, `local`, `onChanged` | `query`, `reload`, `create` | `openOptionsPage` IPC | Receives updates | Relays IPC | `popup.html` controller | Links to Options | N/A |
| 11. Options Dashboard | `sync`, `local`, `onChanged` | N/A | `openOptionsPage` target | Receives updates | Tab deduplication | Opened via Popup/Header | `options.html` controller | N/A |
| 12. Gemini Assistant | N/A | N/A | Chrome Built-in AI (`window.ai`) | `gemini-assistant.js` | N/A | Invoked from popup | N/A | N/A |

---

## 3. Features Discovered Table

## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Extension Core | Master Power Toggle | Single soft toggle (`extensionEnabled`) that shuts down all 10 active feature modules while keeping HeaderButton visible for in-page recovery. | `extensionEnabled` (boolean) | System state update, DOM class removal, tab reload | Retains HeaderButton in DOM on failure | Code Inspection (`content/js/main.js:34-55`) |
| 2 | Distraction Blocker | Shorts & Playables Redirection | Background SW URL interception + SPA `replaceState` patching + 100ms interval fallback redirecting `/shorts/` and `/playables/` to Home. | Navigation event / URL | `https://www.youtube.com/` URL redirect | Fallback to `window.location.replace` if `pushState` throws | Code Inspection (`content/js/shorts-blocker.js:61-130`) |
| 3 | Distraction Blocker | Shorts CSS & DOM Container Eraser | Strict CSS `:has()` rules + `ObserverUtils` MutationObserver removing parent shelf & card containers to prevent blank layout gaps. | DOM mutations matching `a[href*="shorts"]` | `display: none !important` on parent container | Hides individual node if parent container absent | Code Inspection (`content/js/shorts-blocker.js:236-283`, `content/css/hide-shorts.css`) |
| 4 | Layout Engine | Focus Mode Fluid Player Expansion | Expands primary watch container to 1280px via CSS variable `--ytd-watch-flexy-sidebar-width: 0px` and hides comments, sidebar, and end screens. | `shorts-shield-focus-mode` root class | Centered 1280px watch column | Reverts cleanly when class removed | Code Inspection (`content/js/focus-mode.js`, `content/css/focus-mode.css`) |
| 5 | Productivity | Study Mode Sticky Top Banner | Fixed banner (`#ss-study-banner`) at `top: 0` displaying active goal, total session counter, Pomodoro badge, and timer controls. | `learningGoal` string | Injected DOM element + masthead padding shift | Restores original body padding & masthead `top` on disable | Code Inspection (`content/js/study-mode.js:141-274`) |
| 6 | Productivity | 3-Phase Pomodoro State Machine | Pomodoro timer cycling through Focus (25m), Short Break (5m), and Long Break (15m) with Web Audio chimes and auto-pause. | Timer ticks, user clicks | Visual badge update, Web Audio tone, +10 AP award | Fallback sound suppress if AudioContext suspended | Code Inspection (`content/js/study-mode.js:332-452`) |
| 7 | Productivity | Content Alignment Check & Warning | Inspects video title, normalizes tech terms (C++, C#, UI/UX), compares against extracted keywords, and shows warning toast if off-topic. | Video title DOM element, active goal | Warning toast (`#ss-alignment-warning`) | Retries up to 10 times for title DOM availability | Code Inspection (`content/js/study-mode.js:526-610`) |
| 8 | Strict Control | Goal Mode Play Lock & Redirect Overlay | Strict keyword matching on watch pages; pauses HTML5 video (`video.pause()`) and shows full-screen modal overlay if non-relevant. | Video title, channel, meta keywords/description | Modal `#ss-goal-block-overlay` & play lock listener | Provides "Allow Once" bypass storing `_allowedVideoId` | Code Inspection (`content/js/goal-mode.js:174-359`) |
| 9 | Preset | Minimal Mode Distraction-Free Cascade | Meta-preset combining Focus Mode, Shorts Blocker, and UI Cleaner into a single high-performance preset. | `minimalMode` boolean toggle | Applies Focus + Shorts + UI Cleaner rules | Disables cleanly when master toggle turns off | Code Inspection (`content/js/main.js:61-102`) |
| 10 | Limit Manager | Time Manager Limit & Schedule Guard | Enforces daily watch limit (e.g., 60m) and scheduled focus hours (e.g., 09:00-17:00 or overnight 22:00-06:00) with +5 min snooze option. | `dailyWatchTime` tracking, system clock | Video pause + modal overlay `#ss-time-manager-overlay` | Snooze sets `snoozeUntil` timestamp for temporary bypass | Code Inspection (`content/js/time-manager.js:54-132`) |
| 11 | Interface | UI Cleaner 7-Switch Granular Toggles | 7 individual switches (`hideBell`, `hideSubCount`, `hideChat`, `hideTrending`, `hideExplore`, `hideMiniPlayer`, `hideAutoplay`) mapped to CSS root classes. | UI Cleaner configuration object | Root element class addition/removal | Cleanly strips classes on `cleanup()` | Code Inspection (`content/js/ui-cleaner.js`, `content/css/clean-ui.css`) |
| 12 | Navigation UI | In-Page Header Button & Popover | Masthead shield button `#ss-header-btn` injected next to Create button; opens popover dialog `#ss-popup-dialog` with switches and stats. | Masthead DOM node, user clicks | Injected popover dialog | Retries injection up to 20 times; listens for outside clicks | Code Inspection (`content/js/header-button.js:103-345`) |
| 13 | Extension UI | Extension Toolbar Popup Controller | Popup UI controller managing feature toggles, goal editing, real-time analytics, and active session timer cleanup on window unload. | User click/input events in `popup.html` | Updated settings in storage + active tab reload | Clears timer interval on `unload`/`pagehide` to prevent leaks | Code Inspection (`popup/popup.js:1-311`) |
| 14 | Management UI | Options Dashboard & Analytics Engine | Full-page management dashboard featuring Hero Battle Card, 22-badge grid, 7/30-day analytics chart, and JSON/CSV backup engine. | User interactions in `options.html` | Visual charts, badge unlocks, file downloads | Validates JSON schema on import before saving | Code Inspection (`options/options.js:1-593`) |
| 15 | AI Integration | Gemini AI Assistant Widget | Floating in-page AI modal (`#ss-gemini-modal`) integrating Chrome Built-in AI (`window.ai.languageModel`) or intelligent fallback engine. | User prompt, active video title | Chat response bubble | Fallback response generator if Built-in AI is absent | Code Inspection (`content/js/gemini-assistant.js:1-184`) |
| 16 | Progression System | PUBG/Free Fire Gamification Engine | 22 badges across 3 categories (Time, Streak, Shield), 6 PUBG rank tiers, and quadratic level curve $E(L)=100L^2+100L-200$. | Badges array, learning time seconds | AP score, EXP points, level number, rank title | Clamps level calculation to minimum 1 | Code Inspection (`utils/gamification-engine.js:1-173`) |
| 17 | Audio Synthesizer | Web Audio API Zero-Asset Sound Engine | Synthesizes 4 futuristic gaming sound effects (Level Up, Badge Unlock, Alarm, Click) without external media files; includes gesture unlock. | Method call (`playLevelUp`, `playAlarm`, etc.) | Audio output via Web Audio API OscillatorNode | Ignores play calls if `enabled === false` or AudioContext blocked | Code Inspection (`utils/audio-engine.js:1-131`) |
| 18 | Feed Filter | Feed Controller Blocklist & Goal Filter | Filters YouTube home feed & sidebar cards (`ytd-rich-item-renderer`, etc.) against custom blocked keywords/channels and active goal keywords. | `blockedKeywords`, `blockedChannels`, `learningGoal` | Adds `.off-topic` class and `display: none` | Preserves explicit search page `/results` browsing | Code Inspection (`content/js/feed-controller.js:1-259`) |
| 19 | Metrics Subsystem | Time Tracker Read-Then-Write Subsystem | 1-second video state checker with 10-second storage flushes, read-then-write multi-tab race protection, and local date key tracking. | `<video>` element play state, document visibility | Storage tracking update, badge check trigger | Stops tracking if extension context invalidated | Code Inspection (`utils/time-tracker.js:1-393`) |
| 20 | Storage Subsystem | 3-Tier Storage Cascade | Sync storage (`chrome.storage.sync`) -> Local storage (`chrome.storage.local`) -> In-memory cache fallback with quota handling. | `getSettings`, `saveSettings`, `getTracking` | Merged settings/tracking data | Falls back to in-memory cache if Chrome APIs unavailable | Code Inspection (`utils/storage.js:110-289`) |

---

## 4. Edge Cases Table

## Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Master Toggle | Setting `extensionEnabled = false` while on a Shorts page | Disables background navigation interception and content script blockers, but preserves HeaderButton in masthead for instant in-page recovery. |
| 2 | Shorts Blocker | Navigating to channel URL containing substring "shorts" (e.g. `youtube.com/@shorts_creator`) | BUG-11 fix prevents accidental hiding: CSS rule narrowed strictly to `a[href^="/shorts/"]:not(#logo):not([class*="brand"])`. |
| 3 | Shorts Blocker | Dynamic infinite scroll loading of Shorts shelf items | `ObserverUtils` MutationObserver detects added nodes, batches matched elements with 80ms debounce, and applies `display: none !important` to container. |
| 4 | Study Mode | Active goal contains common stop words only (e.g. "learn how to") | BUG-8 fix issues warning console log and skips false-positive feed filtering rather than hiding all videos. |
| 5 | Study Mode | Switching YouTube videos via SPA navigation during active Pomodoro | `yt-navigate-finish` listener re-injects top banner if detached, resets video alignment check retry chain, and retains Pomodoro countdown state. |
| 6 | Goal Mode | Non-goal-relevant video played on watch page | `checkVideoGoalAlignment` detects mismatch, activates `video.pause()` listener on play event, and displays modal overlay `#ss-goal-block-overlay`. |
| 7 | Goal Mode | User clicks "🔓 Allow Video Once" on block overlay | GoalMode stores current video ID in `_allowedVideoId`, removes overlay and play lock for this video only, without unblocking future non-goal videos. |
| 8 | Time Manager | Scheduled focus hours span across midnight (e.g. 22:00 to 06:00) | `isScheduleBlocked()` detects `startMinutes > endMinutes` and checks `currentMinutes >= startMinutes || currentMinutes < endMinutes`. |
| 9 | Time Manager | User triggers +5 Min Emergency Extension | `snoozeUntil` timestamp set to `Date.now() + 300000` and saved to storage; overlay auto-dismisses until timestamp expires. |
| 10 | Header Button | YouTube DOM masthead loaded dynamically or slow render | `startRetryLoop()` retries injection every 500ms (up to 20 attempts) and `observeHeader()` watches `#buttons` container mutations. |
| 11 | Toolbar Popup | User opens popup window while Study Mode session is active | Popup starts 1-second session timer interval to update UI, and attaches `unload`/`pagehide` listeners to clear interval when popup closes. |
| 12 | Options Dashboard | User imports malformed or corrupt JSON backup file | FileReader `JSON.parse` try-catch catches exception and displays alert `Failed to import backup: Invalid JSON file.` without corrupting storage. |
| 13 | Gemini Assistant | User queries Gemini AI when Chrome Built-in AI (`window.ai`) is unavailable | Assistant falls back gracefully to internal rule-based AI response generator for summary, goal analysis, and study advice queries. |
| 14 | Time Tracker | Multiple YouTube tabs playing simultaneously | `incrementWatchTime` reads fresh tracking data from storage immediately before adding seconds ("read-then-write"), preventing multi-tab overwrite race conditions. |
| 15 | Gamification Engine | Calendar week or month rolls over during active tracking | TimeTracker detects `currentWeekKey` or `currentMonthKey` mismatch and resets `weeklyTotal` / `monthlyTotal` counters while accumulating total EXP. |

---

## 5. Logic Chain

1. **Observation**: `manifest.json` defines MV3 architecture with background service worker (`background/background.js`), popup (`popup/popup.html`), options page (`options/options.html`), permissions (`storage`, `tabs`, `scripting`, `webNavigation`, `alarms`), and content scripts (`document_start`).
2. **Observation**: Inspection of all 18 core JS files in `utils/`, `content/js/`, `background/`, `options/`, `popup/` reveals the exact boundaries of the 12 extension modules + 4 supporting subsystems.
3. **Logic Inference**: 
   - Master Toggle acts as a top-level soft gate in `content/js/main.js` (`applySettings`). When disabled, `disableAllFeatures()` shuts down `ShortsBlocker`, `FocusMode`, `StudyMode`, `GoalMode`, `MinimalMode`, `UICleaner`, `TimeManager`, `FeedController`, and `TimeTrackerInstance`, but explicitly excludes `HeaderButton` to maintain in-page recovery.
   - Shorts Blocker operates via dual-layer defense: background SW intercepts full URL loads & SPA history updates, while content script applies strict CSS `:has()` rules and MutationObserver container removal.
   - Focus Mode leverages CSS custom property overrides (`--ytd-watch-flexy-sidebar-width: 0px`) and flex layout modifications to achieve responsive 1280px watch centering without JavaScript layout hacks.
   - Study Mode and Goal Mode share `FeedController` keyword extraction and content alignment checks, but Goal Mode enforces strict video pause locks (`video.pause()`) and full-screen modal redirects.
   - Time Manager manages daily time limits (local date keys `YYYY-MM-DD`) and schedule blocks with snooze capability and Web Audio alarms.
   - UI Cleaner provides 7 CSS root class toggles that hide specific interface components.
   - Header Button injects directly into YouTube's masthead and hosts an in-page popover dialog matching popup features, using chrome messaging for options tab deduplication.
   - Toolbar Popup and Options Dashboard provide complete configuration, gamification progress tracking (PUBG ranks, 22 badges, quadratic level curve $E(L)=100L^2+100L-200$), analytics charts, and backup management.
   - Gemini Assistant embeds Chrome Built-in AI (`window.ai`) or local AI fallbacks for context-aware YouTube video summarization and study help.
   - Verification suite (`run-tests.js` / `npm test`) passes 100% clean across 260 test cases and 19 JS files.

---

## 6. Caveats

- **External AI API Availability**: Chrome Built-in AI (`window.ai.languageModel`) availability depends on browser flag settings in Chromium; when disabled or unavailable, Gemini Assistant seamlessly utilizes its local fallback generator.
- **YouTube DOM Stability**: Dynamic element selectors (`ytd-rich-item-renderer`, `ytd-watch-flexy`, `ytd-masthead`) depend on YouTube's standard DOM structure. MutationObserver wrappers and DOMUtils fallbacks provide robust resilience against DOM rendering delays.

---

## 7. Conclusion

The specification mining audit for all 12 extension modules (plus 4 core subsystems) in GodMode Extension is complete and fully verified. The codebase exhibits a modular, resilient architecture with 100% syntax compliance (`node -c`) and 100% test pass rate (`260/260` tests passing in `npm test` and `node run-tests.js`).

---

## 8. Verification Method

To independently verify this specification inventory:
1. **Syntax Check across all JS files**:
   ```bash
   node tests/syntax/syntax-checker.js
   ```
2. **Run Comprehensive Test Suite**:
   ```bash
   npm test
   # OR
   node run-tests.js
   ```
3. **Inspect Core Implementation Files**:
   - Master Toggle & Orchestration: `content/js/main.js`
   - Shorts Blocker & CSS: `content/js/shorts-blocker.js`, `content/css/hide-shorts.css`, `background/background.js`
   - Focus Mode: `content/js/focus-mode.js`, `content/css/focus-mode.css`
   - Study Mode & Pomodoro: `content/js/study-mode.js`
   - Goal Mode: `content/js/goal-mode.js`
   - Time Manager: `content/js/time-manager.js`
   - UI Cleaner: `content/js/ui-cleaner.js`, `content/css/clean-ui.css`
   - Header Button: `content/js/header-button.js`
   - Popup: `popup/popup.js`
   - Options: `options/options.js`
   - Gemini Assistant: `content/js/gemini-assistant.js`
   - Storage & Utilities: `utils/storage.js`, `utils/gamification-engine.js`, `utils/audio-engine.js`, `utils/time-tracker.js`
