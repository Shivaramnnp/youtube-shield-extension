# E2E Test Specification & Analysis Report (Tiers 2, 3, 4)

**Explorer Agent**: Explorer 3 — E2E Testing Track  
**Date**: 2026-08-10  
**Scope File**: `.agents/sub_orch_e2e_testing/SCOPE.md`  
**Target Output**: `.agents/e2e_explorer_3/analysis.md`  

---

## 1. Executive Summary

This report establishes the comprehensive **Tier 2 (Boundary & Corner Cases)**, **Tier 3 (Cross-Feature Pairwise Coverage)**, and **Tier 4 (Real-World E2E User Scenarios)** test specifications for the Shorts Shield Extension.

Following a thorough read-only investigation of `/Users/shivarampatel/Desktop/shorts-shield/.agents/ORIGINAL_REQUEST.md`, `PROJECT.md`, `SCOPE.md`, and the underlying codebase (`content/js/`, `utils/`, `background/`, `options/`, `popup/`, and `tests/`), four key operational domains were audited in detail:
1. **Safari & Cross-Browser SPA Navigation & Multi-Tier Storage Fallbacks**
2. **Keyword & Channel Blocklist Matching Edge Cases**
3. **Data Backup, Export & Import Validation (JSON/CSV)**
4. **Time Manager Limits, Schedules & Web Audio API Synth Engine**

The analysis confirms that while existing unit and boundary tests cover baseline logic, explicit test specifications are required for edge case handling, pairwise feature interactions, and multi-session user flows.

---

## 2. In-Depth Domain Analysis & Technical Discoveries

### Domain A: Safari & Cross-Browser SPA Navigation & Storage Fallbacks
* **Architecture & Mechanics**:
  * YouTube operates as a Single Page Application (SPA). Video transitions, channel browsing, and Shorts clicking update browser history via `history.pushState` / `history.replaceState` without full page reloads.
  * Chrome MV3 background script (`background/background.js`) listens to `webNavigation.onBeforeNavigate` and `webNavigation.onHistoryStateUpdated`. On interception, it executes content scripts that invoke `history.replaceState` and dispatch custom `yt-navigate` events (`{ detail: { endpoint: { browseEndpoint: { browseId: 'FEwhat_to_watch' } } } }`).
  * In Safari (WebKit WebExtensions), extension background worker lifecycles and navigation events differ. Content script `content/js/shorts-blocker.js` provides redundant client-side SPA protection by binding to `yt-navigate-finish`, `yt-page-data-updated`, `popstate`, `hashchange`, and a 400ms polling fallback interval (`setInterval`).
  * `utils/storage.js` implements a 3-tier fallback cascade: `chrome.storage.sync` -> `chrome.storage.local` -> in-memory default cache.
* **Identified Vulnerabilities & Edge Cases**:
  * *URL Pattern Variations*: Query parameters (e.g. `/shorts/xyz?feature=share`), trailing slashes (`/shorts/`), fragment identifiers (`/#shorts`), and uppercase variants (`/SHORTS/`).
  * *Extension Context Invalidation*: When the extension updates or reloads in background, content script references to `chrome.runtime.id` become invalid. Storage API access throws `Extension context invalidated`.
  * *Safari Sync Storage Quota/Disallowance*: When `chrome.storage.sync` throws quota errors or is disabled in private browsing, `StorageUtil` must seamlessly fall back to `chrome.storage.local` without throwing unhandled promise rejections.

---

### Domain B: Custom Keyword & Channel Blocklist Matching
* **Architecture & Mechanics**:
  * `content/js/feed-controller.js` attaches a DOM observer (`ObserverUtils`) to YouTube video feed cards (`ytd-rich-item-renderer`, `ytd-video-renderer`, `ytd-compact-video-renderer`, `ytd-grid-video-renderer`).
  * `setBlocklist(blockedKeywords, blockedChannels)` processes user strings by lowercasing and trimming whitespace.
  * `filterFeed(elements)` inspects `#video-title` and `ytd-channel-name` / `#channel-name`. If a video title contains a blocked keyword (`titleText.includes(kw)`) or a channel contains a blocked channel (`channelText.includes(ch)`), it adds the `.off-topic` class and sets `el.style.display = 'none'`.
* **Identified Vulnerabilities & Edge Cases**:
  * *Empty String Poisoning*: If user enters `"gaming, , , vlog"`, splitting on comma without filtering empty strings (`.filter(Boolean)`) produces `""`. `titleText.includes("")` evaluates to `true` for all titles, wiping out the entire feed.
  * *Substring Over-Inclusivity*: Blocked keyword `"art"` matches `"Party"`, `"Artificial Intelligence"`, `"Carthage"`, `"Chart Analysis"`. Blocked keyword `"cat"` matches `"Category"`, `"Education"`, `"Catering"`.
  * *Special & Regex Control Characters*: Keywords containing symbols (`c++`, `c#`, `ui/ux`, `[test]`, `*star*`).
  * *Non-ASCII / Unicode Diacritics*: Titles containing non-ASCII characters (`PewDiePie`, `Résumé tips`, `🎮 Gaming live`, `café`).
  * *DOM Card Recycling*: YouTube recycles DOM card containers during infinite scrolling. Cards previously hidden must have `.off-topic` and `display = ''` reset if recycled with non-blocked video data.
  * *Feature Precedence*: If a video matches Study Mode goal keywords (e.g., "Python") BUT matches a Blocklist term (e.g., "Python prank"), Blocklist MUST take precedence and hide the video.

---

### Domain C: Data Backup, Export & Import Validation
* **Architecture & Mechanics**:
  * `options/options.js` handles data export and import:
    * Export JSON: `JSON.stringify({ settings, tracking }, null, 2)` downloaded as `shorts-shield-backup-YYYY-MM-DD.json`.
    * Export CSV: Formats daily watch and learning time stats into a downloadable `.csv` file.
    * Import JSON: Uses `FileReader.readAsText()` -> `JSON.parse()` -> `StorageUtil.saveSettings()` & `StorageUtil.saveTracking()`.
* **Identified Vulnerabilities & Edge Cases**:
  * *Corrupted JSON Payloads*: Syntax errors, binary files, non-object JSON values (e.g. JSON array `[1,2,3]` or primitive number `42`). Parsing non-object values passes `JSON.parse()` but breaks property access (`imported.settings` becomes undefined).
  * *Partial / Missing Datasets*: Backup JSON containing `settings` but missing `tracking`, or vice-versa.
  * *Corrupted Internal Types*: `dailyWatchTime` imported as a string/array instead of an object, `gamification.badges` imported as a primitive value instead of an array.
  * *Storage Quota Exceeded*: Uploading a massive backup file with thousands of historical records exceeding storage limits.

---

### Domain D: Time Manager Limits, Schedules & Web Audio API Synth Engine
* **Architecture & Mechanics**:
  * `content/js/time-manager.js` polls every 5 seconds (`evaluate()`). It calculates `todayMinutes` from `tracking.dailyWatchTime[today]` and compares against `dailyLimitMinutes` or checks `isScheduleBlocked()`.
  * On restriction, `pauseVideo()` is invoked, `#ss-time-manager-overlay` is attached to the DOM (backdrop-filter blur modal), and `AudioEngine.playAlarm()` is triggered.
  * Emergency Snooze (`+5 Min Emergency Extension`) sets `snoozeUntil = Date.now() + 300000`, temporarily suppressing restrictions.
  * `utils/audio-engine.js` synthesizes Web Audio API tones (`playLevelUp`, `playBadgeUnlock`, `playAlarm`, `playClick`) without external media files.
* **Identified Vulnerabilities & Edge Cases**:
  * *Zero / Negative Limit Boundary*: Direct storage manipulation setting `dailyLimitMinutes <= 0`. Input validation in `options.js` clamps min to 5, max to 720.
  * *Overnight Schedule Calculation*: Schedule spanning midnight (e.g., `22:00` to `06:00`). `isScheduleBlocked()` handles overnight wrap-around (`currentMinutes >= start || currentMinutes < end`).
  * *Midnight Limit Auto-Reset*: User hits 60/60 min limit at 23:59 (overlay visible). Clock rolls over to 00:00 (0 mins watched today). Next 5-second `evaluate()` check must recognize new date key, clear `limitExceeded`, and automatically remove the overlay.
  * *AudioContext Autoplay Policies*: Modern browsers suspend `AudioContext` until user interaction. `AudioEngine` handles suspended states via `this.ctx.resume().catch()`.
  * *Audio Mute Toggle*: Setting `audioEffects: false` in settings must immediately mute all synthesized sound triggers across all modules.

---

## 3. Tier 2: Boundary & Corner Cases Test Specification Matrix

| Test ID | Test Title | Target Module | Test Input / Pre-Condition | Expected Behavior / Verification |
|---|---|---|---|---|
| **T2-SPA-01** | Multi-Parameter Shorts URL Interception | `shorts-blocker.js` | URLs: `/shorts/123?feature=share`, `/shorts/`, `/#/shorts`, `/SHORTS/xyz`, `/playables/game` | `checkAndRedirectShortsURL()` detects match, replaces history state, and redirects to home URL. |
| **T2-SPA-02** | Multi-Tier Storage Fallback under Quota Error | `storage.js` | `chrome.storage.sync.set` throws `QuotaExceededError` or returns `runtime.lastError`. | `StorageUtil.saveSettings` falls back to `chrome.storage.local` without throwing unhandled exceptions. |
| **T2-BLK-01** | Blocklist Input Sanitization & Empty String Boundary | `feed-controller.js`, `options.js` | Input string `"gaming, , , vlog,  "` | `setBlocklist` filters empty strings to `["gaming", "vlog"]`. Feed items not containing these words remain visible. |
| **T2-BLK-02** | Substring vs Exact Keyword & Special Symbol Matching | `feed-controller.js` | Blocklist keywords: `c++`, `c#`, `ui/ux`, `[test]`. Feed titles: `"C++ Tutorial"`, `"C# Guide"`, `"Party"`. | Technical terms match correctly; non-matching words (`Party` when keyword is `art`) are not blocked. |
| **T2-BLK-03** | Unicode Diacritics & Non-ASCII Blocklist Matching | `feed-controller.js` | Blocklist channel: `"café"`, `"🎮 Gaming"`. Feed titles with non-ASCII text. | Case-insensitive matching handles diacritics and emojis correctly without DOM error. |
| **T2-BKUP-01** | Backup Import Malformed / Non-Object JSON Handling | `options.js` | Upload JSON file containing syntax error, primitive number `42`, or array `[1, 2, 3]`. | Import handler catches parsing/type error, alerts user with failure message, and leaves existing storage intact. |
| **T2-BKUP-02** | Partial Backup Import Schema Migration | `options.js`, `storage.js` | Upload JSON backup with `{ settings: { shortsBlocker: false } }` (missing `tracking` and `gamification`). | System merges imported settings with `DEFAULT_TRACKING` and `DEFAULT_SETTINGS` without overwriting missing fields with `undefined`. |
| **T2-TM-01** | Time Manager Boundary Limits & Overnight Schedule | `time-manager.js` | `dailyLimitMinutes = 5`, `dailyLimitMinutes = 720`, schedule `22:00` to `06:00`. | Input values clamped cleanly; overnight schedule correctly identifies current time within restricted window. |
| **T2-TM-02** | Emergency Extension Snooze Expiry Precision | `time-manager.js` | Click `+5 Min Emergency Extension`. Advance time by 299 seconds, then 301 seconds. | At 299s, overlay remains hidden. At 301s, `evaluate()` re-enforces limit and displays overlay. |
| **T2-AUD-01** | Audio Engine Triggering in Disabled or Suspended State | `audio-engine.js` | `AudioEngine.enabled = false` or browser `AudioContext.state = 'suspended'`. | Audio triggers (`playLevelUp`, `playAlarm`, `playBadgeUnlock`) return early or catch resume errors without throwing. |

---

## 4. Tier 3: Cross-Feature Pairwise Coverage Test Specification Matrix

| Test ID | Interaction Pair | Scenario Description | Expected Outcome & Verification |
|---|---|---|---|
| **T3-INT-01** | Custom Blocklist vs. Study Mode / Goal Mode | Study Mode active with goal `"Machine Learning"`. Feed contains video `"Machine Learning Reaction Video"` where `"reaction"` is in Blocklist. | Blocklist rule takes precedence. Video is hidden (`.off-topic` class, `display: none`) despite matching goal keywords. |
| **T3-INT-02** | Time Manager Daily Limit vs. Active Study Mode Tracking | User is watching a learning video in Study Mode. Daily watch time hits `dailyLimitMinutes`. | Time Manager overlay appears, pauses video element, and halts learning time accumulation in `TimeTracker`. |
| **T3-INT-03** | Data Backup Import vs. Gamification Engine & UI | User imports backup JSON containing Grandmaster Legend state (3500 AP, 15 badges) over a fresh profile. | Options Battle Card UI, Level badge, EXP bar, and unlocked badges update immediately without manual page reload. |
| **T3-INT-04** | Options / Popup Settings Change vs. Active Content Script | User updates `blockedKeywords` or `audioEffects` toggle in Options tab while YouTube tab is open. | `chrome.storage.onChanged` fires; active content script updates `FeedController` blocklist and `AudioEngine.enabled` without full tab reload. |
| **T3-INT-05** | Time Manager Overlay vs. Focus Reminder Overlay Stack | Goal Mode overlay (zIndex 2147483647), Time Manager overlay (zIndex 2147483647), and Focus Reminder overlay (zIndex 2147483647) trigger concurrently. | Overlays maintain proper z-index hierarchy above Study Mode banner (zIndex 9999). Backdrops clean up properly on dismissal. |
| **T3-INT-06** | UI Cleaner Settings Toggle vs. Time Tracker Monitoring | UI Cleaner hides distraction elements (`hideChat`, `hideTrending`, `hideBell`) during active video playback. | Element hiding does not interfere with `TimeTracker.checkVideoState()` DOM queries or session time accumulation. |

---

## 5. Tier 4: Real-World E2E User Flow Test Specification Matrix

### T4-E2E-01: Safari SPA Navigation & Shorts Shield Interception Journey
* **User Flow**:
  1. User installs extension in a Safari or cross-browser MV3 environment (with local storage fallback active).
  2. User opens `https://www.youtube.com/` home feed.
  3. User clicks on a Shorts video link (triggering SPA navigation to `youtube.com/shorts/sample123`).
  4. Content script and background listener intercept URL, replace history state, and smoothly redirect user back to `https://www.youtube.com/`.
  5. Blocked Shorts count increments in extension storage.
  6. User watches standard videos for 15 minutes; time is accurately logged in fallback storage.
* **Verification Method**: Assert home page URL, verify `totalBlockedShorts === 1`, assert `dailyWatchTime` recorded in fallback storage.

### T4-E2E-02: Study Mode, Blocklist & Audio Gamification Journey
* **User Flow**:
  1. User enters learning goal `"Python Programming"` and custom blocked keyword `"prank"`.
  2. FeedController scans home feed and search results: hides off-topic videos and videos containing `"prank"`.
  3. User watches 2 hours of Python programming tutorials.
  4. Badges (`first_step`, `study_session`, `time_investor`) unlock, triggering synthesized Web Audio fanfare (`playBadgeUnlock` and `playLevelUp`).
  5. User AP increases, promoting rank from Bronze Focus to Silver Scholar.
* **Verification Method**: Verify off-topic elements hidden, check unlocked badges array, assert `rankTier === 'Silver Scholar'`, verify audio methods invoked.

### T4-E2E-03: Time Manager Limit Enforcement, Emergency Snooze & Midnight Rollover Journey
* **User Flow**:
  1. User configures Time Manager with a 30-minute daily limit and audio alarm enabled.
  2. User watches YouTube videos until 30 accumulated minutes are reached.
  3. TimeManager pauses video playback, plays synthesized budget alarm, and renders full-screen backdrop modal.
  4. User clicks `+5 Min Emergency Extension` button. Modal removes, video resumes playback.
  5. After 5 minutes, limit re-triggers overlay and pauses video.
  6. System time advances past midnight (00:00). On next 5-second evaluation loop, TimeManager detects date change, resets daily calculation, and automatically removes the overlay.
* **Verification Method**: Verify video pause, check snooze timestamp calculation (`snoozeUntil === now + 300000`), verify overlay auto-dismissal on date rollover.

### T4-E2E-04: Multi-Device Profile Export, Restore & Visual Analytics Journey
* **User Flow**:
  1. User completes 14 days of tracking (accumulating 7-day and 30-day analytics data, 8 badges, custom blocklist).
  2. User clicks "Export JSON Backup" and "Export CSV Analytics" in Options tab.
  3. User performs a fresh extension install (clearing storage).
  4. User uploads the exported JSON backup via Options "Import Backup" input.
  5. System validates JSON schema, merges tracking and settings into storage, and reloads UI.
  6. 7-Day and 30-Day SVG bar charts, Hero Battle Card level/EXP, badges, and blocklist settings are 100% restored.
* **Verification Method**: Verify exported JSON structure, validate CSV formatting, assert storage after import equals pre-export state.

---

## 6. Test Suite Verification & Harness Audit

* **Master Test Runner Check (`node run-tests.js`)**:
  * **Phase 1 Syntax Check**: 57/57 JavaScript files pass syntax check clean.
  * **Phase 2 Mock Environment**: Chrome MV3 APIs and DOM mocks initialize correctly.
  * **Phase 3 Suite Execution**: 207 tests executed across Tiers 1-4 (Tier 1: 89/90, Tier 2: 79/79, Tier 3: 21/21, Tier 4: 17/17).
* **Identified Failure Fix Recommendation**:
  * In `tests/tier1/audio-engine.test.js` (line 103):
    ```javascript
    // Current code triggering ReferenceError in Node strict mode:
    const applySettingsFunc = window.applySettings || applySettings;
    ```
    Evaluating unassigned global variable `applySettings` in strict mode throws `ReferenceError: applySettings is not defined`.
    **Fix**: Update reference to `window.applySettings` directly (`const applySettingsFunc = window.applySettings;`).

---

## 7. Conclusion & Next Steps

This analysis provides comprehensive coverage of boundary cases (Tier 2), cross-feature interactions (Tier 3), and end-to-end user flows (Tier 4) for the Shorts Shield Extension.

The formulated test specifications in Sections 3, 4, and 5 can be implemented directly by the test writing team into `tests/tier2/`, `tests/tier3/`, and `tests/tier4/` to ensure full test suite coverage and 100% pass rates across all 12 core features.
