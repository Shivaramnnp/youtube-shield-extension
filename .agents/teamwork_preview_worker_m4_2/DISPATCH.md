## 2026-08-12T02:38:46Z
<USER_REQUEST>
You are teamwork_preview_worker_m4_2.
Working Directory: /Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_worker_m4_2
Project Root: /Users/shivarampatel/Desktop/shorts-shield

Mandatory Context Files to Read First:
- Original Request: /Users/shivarampatel/Desktop/shorts-shield/.agents/ORIGINAL_REQUEST.md
- Project Plan: /Users/shivarampatel/Desktop/shorts-shield/.agents/PROJECT.md
- Specification Miner Handoff: /Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_spec_miner_m4_1/handoff.md
- Explorer M4_1 Handoff: /Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_explorer_m4_1/handoff.md
- Explorer M4_2 Handoff: /Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_explorer_m4_2/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Assigned Files:
You have exclusive write access to:
- `background/background.js`
- `content/js/header-button.js`
- `popup/popup.js`
- `options/options.js`
- `manifest.json`

Task Objective:
Implement all refactorings and bug fixes identified in the Explorer handoff reports:
1. `background/background.js`:
   - Add `settings.extensionEnabled !== false` check to `onBeforeNavigate` and `onHistoryStateUpdated` URL interception handlers.
   - Clean up `chrome.storage.session` in `checkAndRemovePendingTab` and add `chrome.tabs.onRemoved` cleanup listener.
   - Add `.catch()` handlers to `StorageUtil.getSettings()` and `StorageUtil.getTracking()` IPC message listeners.
   - Use `StorageUtil.buildMergedSettings(existing)` during extension update migration in `onInstalled`.
   - Wrap top-level `importScripts` in try-catch and add `chrome.alarms` listener architecture.
2. `content/js/header-button.js`:
   - Track and clear `this.outsideClickTimer` in `openPopup`, `closePopup`, and `disable`.
   - Remove `window.location.reload()` calls from toggle change handlers and trigger dynamic state updates / storage events.
   - Add `chrome.storage.onChanged` listener in `enable()` to call `this.updateState()` live on setting changes.
   - Calculate session time dynamically from `tracking.activeSessionStart` instead of unpersisted local counter.
   - Add defensive null guards to stat element query selectors (`#ss-popup-today-time`, `#ss-popup-learning-time`, `#ss-popup-focus-score`).
   - Coerce input in `escapeHtml` via `String(str || '')`.
3. `popup/popup.js` & `options/options.js`:
   - Wrap top-level `DOMContentLoaded` execution blocks in try-catch.
   - Add `chrome.storage.onChanged` listeners in `popup.js` and `options.js` to dynamically update UI toggles, stats, and badges when storage changes.
   - Deduplicate blocklist arrays with `[...new Set(...)]` and listen for `'input'` / `'blur'` events to preserve pending text input.
   - Clamp focus score calculation: `Math.min(100, Math.max(0, Math.round((learningSeconds / totalSeconds) * 100)))`.
   - Fallback empty time inputs (`""`) to default schedule strings `"09:00"` and `"17:00"`.
   - Register `pagehide` alongside `unload` for popup session timer cleanup.
4. `manifest.json`:
   - Add `"alarms"` to `permissions`.
   - Add `web_accessible_resources` matching `["options/options.html", "popup/popup.html"]`.

Verification Requirements:
- Run static syntax verification: `node -c background/background.js content/js/header-button.js popup/popup.js options/options.js`
- Run syntax verification on all JS files: `node tests/syntax/syntax-checker.js`
- Run all test suites: `npm test`
- Ensure 100% test pass rate (250+ tests pass with exit code 0).

Output:
Write your implementation report to `/Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_worker_m4_2/handoff.md`.
Send a completion message back to parent when complete.
</USER_REQUEST>
