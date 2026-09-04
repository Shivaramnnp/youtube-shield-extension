# Scope: Milestone 2 — Cross-Browser Storage & Background Messaging Fallbacks

## Objective
Implement robust 3-tier storage fallback (`chrome.storage.sync` -> `chrome.storage.local` -> memory cache), standardized options tab deduplication messaging across content script & popup gear icons, and fix audio engine IIFE timing.

## Target Files
- `utils/storage.js`
- `background/background.js`
- `popup/popup.js`
- `content/js/header-button.js`
- `content/js/main.js` (audio engine initialization)

## Technical Requirements
1. **Multi-Tier Storage Engine (`utils/storage.js`)**:
   - 3-tier cascade for settings: `chrome.storage.sync` -> `chrome.storage.local` -> `memorySettingsCache`.
   - 2-tier cascade for tracking: `chrome.storage.local` -> `memoryTrackingCache`.
   - Graceful handling of Safari sync storage restrictions, quota errors, and extension context invalidation.
2. **Options Navigation Protocol (`background/background.js`)**:
   - Listen for `{ action: "openOptionsPage" }` message.
   - Query existing tabs for `options/options.html`.
   - Focus existing options tab if open, otherwise call `chrome.runtime.openOptionsPage()` or `chrome.tabs.create({ url: "options/options.html" })`.
3. **Client Messaging & Gear Icon Wiring**:
   - Update `popup/popup.js` and `content/js/header-button.js` gear icons to send `{ action: "openOptionsPage" }`.
4. **Audio Engine IIFE Timing Fix**:
   - Fix async IIFE initialization in `content/js/main.js` so `AudioEngine` initializes cleanly without timing out or breaking test suites.

## References
- Global project plan: `/Users/shivarampatel/Desktop/shorts-shield/PROJECT.md`
- Survey analysis report: `/Users/shivarampatel/Desktop/shorts-shield/.agents/explorer_survey_2/analysis.md`
- Original request: `/Users/shivarampatel/Desktop/shorts-shield/.agents/ORIGINAL_REQUEST.md`

## Workflow Protocol
Execute iteration loop: Explorer -> Worker -> Reviewer -> Challenger -> Forensic Auditor -> Gate check (`GATE_STATUS.md`).
All subagents must verify `node -c` syntax checks pass.
Auditor must return CLEAN verdict.
