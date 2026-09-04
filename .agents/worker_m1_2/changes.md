# Detailed Changes Log — Milestone 1 (R1 & R3 Remediation)

## Agent: worker_m1_2
**Date**: 2026-08-23

### 1. `content/js/main.js`
- **File**: `content/js/main.js`
- **Location**: `disableAllFeatures` function (lines 35–48)
- **Change**: Added proper invocation of `window.UICleaner.cleanup()` alongside `window.UICleanerInstance?.disable?.()`.
- **Rationale**: `ui-cleaner.js` exports its singleton on `window.UICleaner` (and alias `window.UICleanerInstance`). Calling `cleanup()` directly ensures all applied CSS blocker classes (`ss-hide-bell`, `ss-hide-chat`, `ss-hide-trending`, `ss-hide-explore`, `ss-hide-sub-count`, `ss-hide-mini-player`, `ss-hide-autoplay`) are cleanly stripped from `document.documentElement` and `document.body` whenever the extension master toggle is disabled.

### 2. `content/js/ad-skipper.js` & `content/js/page-ad-skipper.js`
- **Files**: `content/js/ad-skipper.js`, `content/js/page-ad-skipper.js`
- **Locations**:
  - `content/js/ad-skipper.js`: `enable()` and `disable()` methods
  - `content/js/page-ad-skipper.js`: `isAutoSkipEnabled()` helper and `handleAd()` guard
- **Change**:
  - `ad-skipper.js`: Sets `document.documentElement.setAttribute('data-ss-auto-skip', 'true')` on `enable()`, and `document.documentElement.setAttribute('data-ss-auto-skip', 'false')` on `disable()`.
  - `page-ad-skipper.js`: Added `isAutoSkipEnabled()` which inspects the `data-ss-auto-skip` DOM bridge attribute and dataset flags. In `handleAd()`, immediately returns when auto-skip is disabled, and safely restores normal video playback (`playbackRate = 1`, unmutes) if toggled off during an active ad.
- **Rationale**: Since `page-ad-skipper.js` runs in the declarative MAIN world without access to WebExtension `chrome.storage` or `chrome.runtime` APIs, the DOM bridge attribute on `document.documentElement` establishes a fast, synchronous state synchronization channel across the isolated content script world and the page MAIN world.

### 3. `content/js/study-mode.js`
- **File**: `content/js/study-mode.js`
- **Location**: `awardPomodoroAP(points = 10)` (lines 430–467)
- **Change**: Fixed the level progression calculation so that `calculateLevelFromEXP` receives `tracking.gamification.totalEXP` instead of `newAP`. Also added rank tier update via `GamificationEngine.getRankTierFromAP(newAP)` and an `escapeHtml(str)` helper method.
- **Rationale**: `GamificationEngine.calculateLevel` / `calculateLevelFromEXP` computes level based on a quadratic EXP curve ($E(L) = 100L^2 + 100L - 200$). Passing AP (which is in the range of 10–2000 AP) into `calculateLevel()` caused player level corruption and reset level progress to 1 upon completing Pomodoro focus sprints.

### 4. `background/background.js`
- **File**: `background/background.js`
- **Location**: `chrome.commands.onCommand` listener (lines 398–414)
- **Change**: Updated shortcut `toggle-shield` command to compute `const nextState = !(s.extensionEnabled !== false); s.extensionEnabled = nextState;`.
- **Rationale**: Previously, `s.extensionEnabled = s.extensionEnabled === false;` evaluated to `false` when `extensionEnabled` was `undefined` (which defaults to `true`), incorrectly disabling the shield on initial shortcut invocation. The inverted comparison correctly toggles `true` (or `undefined`) $\to$ `false`, and `false` $\to$ `true`.

### 5. `utils/storage.js`
- **File**: `utils/storage.js`
- **Location**: `migrateTimelineLog(tracking)` (lines 172–265)
- **Change**: Added filtering for empty or malformed `{}` objects in the raw timeline log stream before normalization and merging. Specifically checks `Object.keys(item).length === 0` and validates that items possess video identity (`title` / `videoId`), channel, timestamp, or duration. Also added transparent support when an array is passed directly.
- **Rationale**: Previously, raw `{}` entries without title, channel, or duration were processed into phantom watch events with default title `"YouTube Video"` and duration `0`, polluting the user's history and analytics.

### 6. XSS Sanitization & CSP Verification
- **Verification**: Verified all dynamic DOM insertions and innerHTML templates across all modified files. Dynamic values are either escaped via `escapeHtml()` with input coercion (`String(str || '')`) or set using secure native DOM properties (`textContent`).
