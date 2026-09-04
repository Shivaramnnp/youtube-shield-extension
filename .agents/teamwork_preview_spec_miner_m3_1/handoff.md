# Specification Mining Report — Milestone M3: Study, Goal & Time Management Modules

## 1. Observation

### Source Files Inspected
- `content/js/study-mode.js` (625 lines, 23,466 bytes)
- `content/js/goal-mode.js` (368 lines, 14,452 bytes)
- `content/js/time-manager.js` (217 lines, 7,583 bytes)
- `content/js/main.js` (243 lines, 10,062 bytes)

### Test Suites Inspected
- `tests/tier1/goal-mode-topic.test.js`
- `tests/tier1/time-manager-snooze.test.js`
- `tests/tier2/goal-mode-boundary.test.js`
- `tests/tier2/time-manager-boundary.test.js`
- `tests/tier3/study-goal-priority-interaction.test.js`
- `tests/tier3/time-tracking-ui-cleaner-interaction.test.js`
- `tests/tier4/e2e-daily-rollover-streak.test.js`
- `tests/tier4/e2e-multi-session-focus-and-shield.test.js`

### Context Files Inspected
- `.agents/ORIGINAL_REQUEST.md` (lines 13–29: R1 Deep Refactoring, R2 Edge Case Sweep for Study Mode, Goal Mode, Time Manager, R3 Test Suites)
- `.agents/PROJECT.md` (lines 18–22: Feature Inventory items 4, 5, 7; Milestone M3 definition)

---

## 2. Logic Chain

From direct inspection of the code, tests, and specification docs:

1. **Study Mode & Pomodoro Engine (`content/js/study-mode.js`)**:
   - `StudyMode` manages session timers, 3-phase Pomodoro cycles (`FOCUS`, `BREAK`, `LONG_BREAK`), video topic alignment checks, and award distribution.
   - **DOM Banner Injection**: Injects `#ss-study-banner` fixed at `top: 0`, `left: 0` with `zIndex: 9999`. Adjusts YouTube masthead `top: 36px`, `document.body` `paddingTop: 36px`, and `--ytd-masthead-height: 92px`. Stores original masthead `top` and body `paddingTop` values to cleanly restore DOM on `disable()`.
   - **Pomodoro State Machine**:
     - Defaults: `workMinutes: 25`, `breakMinutes: 5`, `longBreakMinutes: 15`, `cyclesBeforeLongBreak: 4`, `autoStartBreaks: true`, `soundAlerts: true`, `autoPause: true`.
     - When a `FOCUS` sprint reaches 0s: increments `pomoTotalCompleted`, plays `AudioEngine.playLevelUp()`, awards +10 bonus AP and +10 total AP via `awardPomodoroAP()`, auto-pauses active video (if `autoPause !== false`), and transitions to `LONG_BREAK` (if `pomoCycleCount % cyclesBeforeLongBreak === 0`) or `BREAK`.
     - When a break phase reaches 0s: increments `pomoCycleCount` (or resets to 1 after long break), transitions to `FOCUS`, plays `AudioEngine.playBadgeUnlock()`, and notifies user.
   - **Topic Alignment Check**:
     - Retries up to 10 attempts (1s interval) on `/watch` pages waiting for watch title elements.
     - Normalizes technical terms (`c++` -> `cplusplus`, `c#` -> `csharp`, `ui/ux` -> `uiux`, `ai`, `ml`, `go`, `sql`, `web3`, `llm`, etc.) and filters stop words (`learn`, `about`, `how`, `to`, `tutorial`, `guide`, etc.).
     - If goal keywords remain and video title contains none of them, displays `#ss-alignment-warning` card at `top: 60px`, `right: 20px`, `zIndex: 10000`. Auto-dismisses after 10s.

2. **Goal Mode & Strict Enforcement (`content/js/goal-mode.js`)**:
   - `GoalMode` enforces strict topic compliance on YouTube watch pages and feeds.
   - Adds `.shorts-shield-goal-mode` class to `document.documentElement` / `document.body` and enables `FeedController`.
   - **Watch Page Topic Check**:
     - Retries up to 15 attempts (500ms interval) on `/watch`.
     - Dynamically inspects title, channel name, meta tags (`meta[name="keywords"]`, `meta[name="description"]`), and video description element (`#description-inline-expander`).
     - Detects entertainment terms (`song`, `music video`, `official video`, `full movie`, `remix`, `dj song`, `trailer`, `teaser`, `funny video`, `comedy video`) in title and flags as off-topic automatically.
     - If off-topic: sets `isBlocked = true`, attaches play lock (`addPlayLock()` listening for `play` event and pausing video), and injects full-screen modal `#ss-goal-block-overlay` with `zIndex: 2147483647`.
   - **Overlay Options**:
     - "Allow Video Once" (`#ss-btn-allow-once`): sets `_allowedVideoId`, unlocks play lock, removes overlay, resumes video.
     - "Ask Gemini AI" (`#ss-btn-ask-gemini`): calls `window.GeminiAssistant.openModal(...)`.
     - "Search <Goal>" (`#ss-btn-search-goal`): redirects to YouTube search results for goal query.
     - "Home" (`#ss-btn-go-home`): redirects to `https://www.youtube.com/`.

3. **Time Manager & Limit System (`content/js/time-manager.js`)**:
   - `TimeManager` tracks daily usage against user-defined watch limits and focus schedules.
   - Evaluates state every 5 seconds (5000ms interval).
   - **Context Validity Check**: Calls `StorageUtil.isContextValid()`. If false (e.g. extension reloaded/invalidated), disables `TimeManager` to prevent orphaned background errors.
   - **Snooze Handling**: If `snoozeUntil && Date.now() < snoozeUntil`, suppresses limit overlay and permits video viewing.
   - **Schedule Evaluation**:
     - Daytime schedule (e.g., 09:00 to 17:00): blocked when `currentMinutes >= startMinutes && currentMinutes < endMinutes`.
     - Overnight schedule (e.g., 22:00 to 06:00): blocked when `currentMinutes >= startMinutes || currentMinutes < endMinutes`.
   - **Limit Enforcement**:
     - Reads daily watch time from `StorageUtil.getTracking()` (`dailyWatchTime[today]`).
     - If daily limit (min. 5 minutes) is exceeded or schedule is blocked: pauses video and injects modal `#ss-time-manager-overlay` with `zIndex: 2147483647`.
     - Provides "+5 Min Emergency Extension" button (`#ss-tm-snooze`), updating `snoozeUntil = Date.now() + 300000` and updating storage via `StorageUtil.updateTimeManagerSetting('snoozeUntil', snoozeUntil)`.

4. **Main Extension Orchestrator (`content/js/main.js`)**:
   - IIFE initialization guard: `window.shortsShieldInitialized`.
   - Multi-tier async settings loader: priority 1 `StorageUtil.getSettings()`, priority 2 `chrome.runtime.sendMessage({ action: "getSettings" })`, priority 3 fallback `DEFAULT_FALLBACK_SETTINGS`.
   - Master Toggle (`extensionEnabled: false`): Calls `disableAllFeatures()`. All content scripts disabled, except `HeaderButton` which remains active so user can open shield menu.
   - Focus Reminder: `showFocusReminderOverlay()` displays `#ss-focus-reminder` backdrop (`zIndex: 2147483647`) when triggered by `chrome.runtime.onMessage` action `"showFocusReminder"`.
   - `chrome.storage.onChanged`: Automatically reloads page (`window.location.reload()`) when structural feature toggles change (`shortsBlocker`, `focusMode`, `studyMode`, `goalMode`, `minimalMode`, `uiCleaner`, `timeManager`), or re-applies settings in-place via `applySettings(newVal)`.

---

## 3. Features Discovered & Specification Matrix

## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Study Mode | Sticky Top Banner Injection | Injects top banner `#ss-study-banner` displaying active goal and total session timer. | Goal string, session start timestamp | DOM `#ss-study-banner` at `zIndex: 9999`, body padding +36px | Graceful fallback if DOMUtils or document.body unavailable | `content/js/study-mode.js` lines 136-230 |
| 2 | Study Mode | 3-Phase Pomodoro Timer | Tracks Focus, Short Break, and Long Break sprints with configurable work/break durations. | Pomodoro config (`workMinutes`, `breakMinutes`, `longBreakMinutes`, `cyclesBeforeLongBreak`) | Formatted countdown string (`MM:SS`), phase badge, cycles text (`1/4`) | Defaults to 25m/5m/15m/4 cycles if config invalid or missing | `content/js/study-mode.js` lines 266-352 |
| 3 | Study Mode | Pomodoro AP Award & Audio Feedback | Awards +10 bonus AP and total AP upon completing a Focus sprint; plays level-up and badge sounds. | Completed focus sprint event | AP incremented in `StorageUtil.getTracking()`, audio played via `AudioEngine` | Soft try/catch block around audio and storage calls | `content/js/study-mode.js` lines 366-432 |
| 4 | Study Mode | Off-Topic Alignment Warning | Scans `/watch` page titles against goal keywords and warns user if video appears off-topic. | Goal string, video title from DOM | DOM `#ss-alignment-warning` card at `zIndex: 10000` | Ignores non-watch URLs; permits videos if goal has no non-stop-word keywords | `content/js/study-mode.js` lines 484-620 |
| 5 | Goal Mode | Strict Feed & Watch Page Filtering | Applies strict topic filtering across YouTube recommendations and watch pages. | Learning goal string | CSS class `.shorts-shield-goal-mode`, `FeedController.enable()` | Defaults to allowing content if goal contains only stop words | `content/js/goal-mode.js` lines 17-56 |
| 6 | Goal Mode | Off-Topic Video Play Lock & Metadata Inspection | Scans video title, channel, meta keywords, meta description, and video description; locks video play state if off-topic. | Video metadata, entertainment keyword list | Video paused via `boundPlayLock`, overlay injected | Retries up to 15 attempts (500ms interval) for title DOM element | `content/js/goal-mode.js` lines 88-240 |
| 7 | Goal Mode | Goal Block Overlay Modal | Displays full-screen modal blocking off-topic video with 4 action paths: Allow Once, Ask Gemini AI, Search Goal, Go Home. | Blocked video title, active goal | Full-screen modal `#ss-goal-block-overlay` at `zIndex: 2147483647` | HTML escapes goal & title strings via `escapeHtml()` to prevent XSS | `content/js/goal-mode.js` lines 242-334 |
| 8 | Goal Mode | Single-Session Video Exemption ("Allow Once") | Allows temporary viewing of an off-topic video for the active tab/session. | User click on `#ss-btn-allow-once` | `_allowedVideoId` set to `lastVideoId`, overlay & play lock removed, video playback resumed | Resets allowed video ID when goal changes | `content/js/goal-mode.js` lines 335-351 |
| 9 | Time Manager | Daily Watch Limit & Schedule Evaluation | Evaluates total daily watch time and scheduled focus time windows every 5 seconds. | Tracking storage (`dailyWatchTime[today]`), config (`dailyLimitMinutes`, `scheduleStart`, `scheduleEnd`) | Pauses video and displays `#ss-time-manager-overlay` at `zIndex: 2147483647` | Disables engine if extension context invalid (`!StorageUtil.isContextValid()`) | `content/js/time-manager.js` lines 50-97 |
| 10 | Time Manager | Overnight Schedule Handling | Correctly evaluates wrap-around overnight focus schedules (e.g., 22:00 to 06:00). | Schedule start and end times ("HH:MM") | Boolean `isScheduleBlocked()` evaluation | Handles boundary conditions (`22:00` blocked, `06:00` allowed) | `content/js/time-manager.js` lines 99-124 |
| 11 | Time Manager | Emergency +5 Min Snooze Extension | Grants a 5-minute temporary override when user clicks emergency snooze. | User click on `#ss-tm-snooze` | `config.snoozeUntil` set to `Date.now() + 300000`, stored to extension storage | Suppresses limit overlay evaluation until snooze timestamp expires | `content/js/time-manager.js` lines 190-205 |
| 12 | Main Orchestrator | Master Toggle Shutdown (`extensionEnabled: false`) | Disables all blocking, UI cleaning, study, goal, and time management scripts while keeping HeaderButton active. | Settings change event | All feature modules disabled, HeaderButton remains active | Ensures user can always access shield popover to re-enable extension | `content/js/main.js` lines 25-45 |
| 13 | Main Orchestrator | Structural Feature Toggle Auto-Reload | Detects structural feature setting changes and triggers full page reload. | `chrome.storage.onChanged` event | `window.location.reload()` | In-place update (`applySettings`) executed if only non-toggle settings change | `content/js/main.js` lines 198-229 |
| 14 | Main Orchestrator | Intentional Watching Focus Reminder | Injects check-in modal when receiving background message `showFocusReminder`. | IPC message `{ action: "showFocusReminder" }` | Full-screen modal `#ss-focus-reminder` at `zIndex: 2147483647` | Dismisses modal cleanly when user clicks "Continue" or "Take a Break" | `content/js/main.js` lines 95-143 |

---

## 4. Edge Cases Matrix

## Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Technical Keyword Extraction | Goal containing C++, UI/UX, AI, ML, Go, SQL, Web3 | Preserved as normalized tokens (`cplusplus`, `uiux`, `ai`, `ml`, `go`, `sql`, `web3`) and matched against video titles. |
| 2 | Stop-Words-Only Goal | Goal = `"Learn how to study"` or `"Learn something new"` | `extractGoalKeywords()` returns `[]`. Both Study Mode and Goal Mode default to allowing videos (`isGoalRelevant = true`). |
| 3 | Special Characters in Goal | Goal = `"Master C++ (v2.0) [regex+test] $100^2 *all*"` | Handled cleanly by string replacement without throwing regex or syntax errors. |
| 4 | XSS Injections in Titles/Goals | Malicious title `<img src=x onerror=alert(1)>` or goal `<script>alert('xss')</script>` | Sanitized by `escapeHtml()` into `&lt;img...&gt;` and `&lt;script...&gt;` before injecting into DOM innerHTML. |
| 5 | Master Toggle OFF | `extensionEnabled: false` in settings | All feature modules disabled (`ShortsBlocker`, `FocusMode`, `StudyMode`, `GoalMode`, `MinimalMode`, `UICleanerInstance`, `TimeManager`, `FeedController`), but `HeaderButton` remains active. |
| 6 | Overnight Time Schedule | Schedule `22:00` to `06:00`, current time `23:30` or `04:15` | Evaluates to `true` (blocked). Exact boundary at `22:00` is blocked; exact boundary at `06:00` is allowed. |
| 7 | Active Emergency Snooze | `dailyLimitMinutes = 30`, `todayMinutes = 40`, `snoozeUntil = Date.now() + 300000` | Overlay suppressed and playback allowed until `snoozeUntil` timestamp expires. |
| 8 | Z-Index Layering Hierarchy | Multiple active overlays in DOM simultaneously | Banner = `9999`, Alignment Warning = `10000`, Goal Block Overlay & Time Manager Overlay & Focus Reminder = `2147483647` (highest 32-bit integer). |
| 9 | Extension Context Invalidation | Extension reloaded/updated while TimeManager timer running | `StorageUtil.isContextValid()` returns `false`, causing `TimeManager.evaluate()` to call `disable()` cleanly without throwing runtime exception. |
| 10 | Entertainment Video Detection | Goal Mode active, video title contains `"Official Music Video"` or `"Full Movie"` | Automatically categorized as off-topic (`isEntertainment = true`), overriding keyword search and triggering Goal Block Overlay. |

---

## 5. Caveats
- No caveats. All 4 target JavaScript files (`study-mode.js`, `goal-mode.js`, `time-manager.js`, `main.js`), interface contracts, DOM layering requirements, and unit/boundary test suites were thoroughly inspected.

---

## 6. Conclusion
The specification boundary for Milestone M3 (`content/js/study-mode.js`, `content/js/goal-mode.js`, `content/js/time-manager.js`, `content/js/main.js`) is completely defined and verified against the test harness. The state machine transitions, technical keyword extraction rules, Pomodoro cycles, overlay z-index hierarchies, overnight schedule math, and emergency snooze mechanics are fully mapped and robust.

---

## 7. Verification Method
To independently verify this specification report and test suite compatibility:
1. Run syntax verification:
   ```bash
   node -c content/js/study-mode.js content/js/goal-mode.js content/js/time-manager.js content/js/main.js
   ```
2. Run M3 unit and integration tests:
   ```bash
   node tests/tier1/goal-mode-topic.test.js
   node tests/tier1/time-manager-snooze.test.js
   node tests/tier2/goal-mode-boundary.test.js
   node tests/tier2/time-manager-boundary.test.js
   node tests/tier3/study-goal-priority-interaction.test.js
   node tests/tier3/time-tracking-ui-cleaner-interaction.test.js
   ```
3. Run complete test harness across all tiers:
   ```bash
   npm test
   ```
