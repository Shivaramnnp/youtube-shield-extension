## 2026-08-09T05:15:21Z
<USER_REQUEST>
You are Worker 1 (Test Infrastructure & Runner Specialist).
Your working directory is /Users/shivarampatel/Desktop/shorts-shield/.agents/worker_infra_1/.
Read /Users/shivarampatel/Desktop/shorts-shield/.agents/ORIGINAL_REQUEST.md and the survey reports in /Users/shivarampatel/Desktop/shorts-shield/.agents/explorer_e2e_3/analysis.md and /Users/shivarampatel/Desktop/shorts-shield/.agents/explorer_e2e_1/analysis.md.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your objective:
Build the E2E test infrastructure and runner harness for the Shorts Shield Gamification system.

Files you own and MUST create:
1. `/Users/shivarampatel/Desktop/shorts-shield/TEST_INFRA.md`: Comprehensive test infrastructure document at project root. Must detail test philosophy (opaque-box, requirement-driven), Feature Inventory mapping all 8 features (AP/EXP Engine, Rank Tier System, Battle Card UI, Storage Persistence, Shorts Blocker, Focus/Minimal Mode UI Cleaner, Goal Mode, Time Manager), test architecture, directory layout, and coverage thresholds.
2. `/Users/shivarampatel/Desktop/shorts-shield/package.json`: Lightweight package file containing `"name": "shorts-shield"`, `"version": "1.0.0"`, `"scripts": { "test": "node run-tests.js" }`.
3. `/Users/shivarampatel/Desktop/shorts-shield/tests/harness/mock-extension-env.js`: Comprehensive Chrome MV3 & DOM Mock Environment. Mocks `chrome.storage.sync` & `chrome.storage.local` (in-memory Map with get, set, remove, clear), `chrome.runtime` (id, sendMessage, onMessage), `chrome.tabs`, `chrome.scripting`, `window` (globalThis), `document` (createElement, getElementById, querySelector, querySelectorAll, addEventListener, body), `DOMParser`, `MutationObserver`, `localStorage`, `location`. Provides global setup helper `setupMockEnv()`.
4. `/Users/shivarampatel/Desktop/shorts-shield/tests/harness/test-helpers.js`: Shared test assertion and state reset utilities (e.g. `resetStorage()`, `createMockStorage()`, `simulateTimePassed()`).
5. `/Users/shivarampatel/Desktop/shorts-shield/tests/syntax/syntax-checker.js`: Syntax checker module using `child_process.spawnSync('node', ['-c', filePath])` scanning all JS files in source directories (`background/`, `content/`, `options/`, `popup/`, `utils/`) and test directories (`tests/`, `run-tests.js`). Returns summary of clean syntax checks.
6. `/Users/shivarampatel/Desktop/shorts-shield/run-tests.js`: Master CLI runner executable via `node run-tests.js` or `npm test`. Phase 1: executes `syntax-checker.js`. Phase 2: initializes `setupMockEnv()`. Phase 3: discovers and executes all test suites (`tests/tier1/`, `tests/tier2/`, `tests/tier3/`, `tests/tier4/`). Phase 4: outputs formatted summary report and exits with process exit code 0 if all pass, or process exit code 1 if any fail.

Execution and Verification:
- Run `node -c` checks on all created scripts.
- Execute `node run-tests.js` to ensure the runner works cleanly.
- Write your handoff report to `/Users/shivarampatel/Desktop/shorts-shield/.agents/worker_infra_1/handoff.md`.
- Report completion back to parent via `send_message`.
</USER_REQUEST>
