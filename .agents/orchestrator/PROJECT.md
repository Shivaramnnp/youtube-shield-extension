# Project: GodMode Extension Verification & Code Quality Audit

## Architecture
Chrome Extension Manifest V3 (MV3) Architecture:
- **Background Service Worker**: `background/background.js` (Tab management, options page routing, messaging).
- **Content Scripts**: 16 JS files (`utils/dom-utils.js`, `utils/audio-engine.js`, `utils/gamification-engine.js`, `utils/storage.js`, `utils/time-tracker.js`, `content/js/observer-utils.js`, `content/js/shorts-blocker.js`, `content/js/focus-mode.js`, `content/js/study-mode.js`, `content/js/ui-cleaner.js`, `content/js/feed-controller.js`, `content/js/gemini-assistant.js`, `content/js/header-button.js`, `content/js/time-manager.js`, `content/js/goal-mode.js`, `content/js/main.js`).
- **Toolbar Popup**: `popup/popup.html` & `popup/popup.js`.
- **Options Dashboard**: `options/options.html` & `options/options.js`.
- **Core Utilities**: Audio engine, DOM utilities, Gamification engine, Storage cascade, Time tracker.

## Feature Inventory
All requirements mapped from ORIGINAL_REQUEST.md:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Syntax Verification | Verify `node -c` passes 100% clean across all 19 JavaScript files | M1 | R1 |
| 2 | Test Suite Verification | Verify `npm test` passes 100% clean with 260/260 passing unit & integration tests | M1 | R1 |
| 3 | Master Toggle Module | Global extension enable/disable state management | M2 | R2 |
| 4 | Shorts Blocker Module | Block/redirect YouTube Shorts and hide Shorts UI elements | M2 | R2 |
| 5 | Focus Mode Module | Restrict distracting elements and enforce focus rules | M2 | R2 |
| 6 | Study Mode Module | Enforce study session timers, break schedules, and block lists | M2 | R2 |
| 7 | Goal Mode Module | Goal tracking, session targets, and gamification feedback | M2 | R2 |
| 8 | Minimal Mode Module | Minimalist UI layout transformation for YouTube | M2 | R2 |
| 9 | Time Manager Module | Track watch time limits, cooldowns, and session resets | M2 | R2 |
| 10 | UI Cleaner Module | Hide comments, recommendations, sidebar, and home feed | M2 | R2 |
| 11 | Header Button Module | Quick toggle button injected into YouTube header bar | M2 | R2 |
| 12 | Toolbar Popup Module | Extension popup interface, quick settings, and stats | M2 | R2 |
| 13 | Options Dashboard Module | Comprehensive settings dashboard and configuration page | M2 | R2 |
| 14 | Gemini Assistant Module | AI focus assistant integration in YouTube UI | M2 | R2 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Milestone 1 (R1 Verification) | `node -c` 19 JS files & `npm test` 260 unit/integration tests | none | PLANNED |
| 2 | Milestone 2 (R2 Module Audit) | Audit feature integrity & code quality across all 12 modules | M1 | PLANNED |
| 3 | Milestone 3 (Final Audit Gate) | Reviewer + Challenger + Forensic Auditor verification pass | M1, M2 | PLANNED |

## Code Layout
- `background/background.js` (Service Worker)
- `content/js/` (11 content modules: feed-controller.js, focus-mode.js, gemini-assistant.js, goal-mode.js, header-button.js, main.js, observer-utils.js, shorts-blocker.js, study-mode.js, time-manager.js, ui-cleaner.js)
- `options/options.js` & `options/options.html`
- `popup/popup.js` & `popup/popup.html`
- `utils/` (5 core utilities: audio-engine.js, dom-utils.js, gamification-engine.js, storage.js, time-tracker.js)
- `tests/` (Tier 1–4 unit & integration test suites, runner `run-tests.js`)
