# E2E Test Runner & Infrastructure Analysis Report

**Explorer**: Explorer 3  
**Date**: 2026-08-09  
**Target Project**: Shorts Shield Extension (`/Users/shivarampatel/Desktop/shorts-shield`)  

---

## Executive Summary

This report delivers a comprehensive analysis of the existing project structure, runtime environment, syntax checking mechanisms, test invocation strategy, and test runner architecture for the **Shorts Shield** extension. 

Key Findings:
1. **Runtime & Code Base**: The project is a Google Chrome Manifest V3 extension written in plain Vanilla JavaScript. Node.js version available in the environment is **v22.16.0** (npm **10.9.2**). There is currently **no `package.json`** or external build tool in the root repository.
2. **Module Execution**: Scripts rely on browser global scope assignment (`if (typeof window !== 'undefined') window.StorageUtil = StorageUtil;`). Standard Node.js `require()` with a pre-configured global mock environment (`global.window`, `global.chrome`, `global.document`) successfully loads and executes all utility scripts without transpilation or external bundlers.
3. **Syntax Validation**: All existing JavaScript files pass `node -c` syntax check cleanly with code 0.
4. **Test Runner Architecture**: Node.js v22 native `node:test` + `node:assert` with a custom Chrome Extension & DOM Mock Harness is optimal. It provides zero-dependency execution, fast execution times, native async support, TAP/Spec reporting, and strict exit code handling (0 for pass, 1 for fail).

---

## 1. Project Files & Runtime Environment Inspection

### 1.1 File Structure Overview
```
shorts-shield/
├── manifest.json              # Chrome MV3 manifest mapping background, popup, options, content scripts
├── background/
│   └── background.js          # Background service worker (message passing, alarms, tab state)
├── content/
│   ├── css/                   # Injectable style sheets for YouTube DOM modification
│   └── js/                    # Content scripts (shorts-blocker, focus-mode, study-mode, goal-mode, etc.)
├── options/
│   ├── options.html           # Settings & Achievements Dashboard UI
│   ├── options.css            # Options styling
│   └── options.js             # Options tab navigation, toggles, badge display, analytics
├── popup/
│   ├── popup.html             # Extension Popup UI
│   ├── popup.css              # Popup styling
│   └── popup.js               # Quick toggle controls, watch time stats, level display
├── utils/
│   ├── dom-utils.js           # DOM query helpers and selector utilities
│   ├── storage.js             # StorageUtil wrapper for chrome.storage.sync & chrome.storage.local
│   └── time-tracker.js        # TimeTracker engine, ISO week helper, streak counter, badge & rank tier calculation
├── README.md & TESTING.md     # Documentation & 50 QA test scenario specifications
├── ORIGINAL_REQUEST.md        # Gamification & Rank Tier system requirements
└── .agents/                   # Agent orchestrator workspace and task tracking
```

### 1.2 Runtime Environment & Execution Mechanisms
- **Node.js Environment**: Node **v22.16.0**, npm **10.9.2** running on macOS.
- **Dependency Footprint**: Zero existing npm packages (`package.json` absent, `node_modules` absent).
- **Module Format**: Browser global scripts. Utilities attach exported objects to `window` (e.g. `window.StorageUtil`, `window.TimeTrackerInstance`).
- **Chrome Extension API Usage**: `chrome.storage.sync`, `chrome.storage.local`, `chrome.runtime`, `chrome.tabs`, `chrome.scripting`, `chrome.webNavigation`.
- **Node.js Interoperability Verification**: Executing `node -e "global.window = global; global.chrome = {...}; require('./utils/storage.js');"` succeeded with zero errors, confirming seamless mockable runtime loading.

---

## 2. Test Execution, `node -c` Syntax Checks, & Runner Architecture

### 2.1 Invocation Strategy
- **Entry Point**: Standard CLI runner `run-tests.js` in the workspace root, as well as a lightweight `package.json` defining `"scripts": { "test": "node run-tests.js" }`.
- **Command Syntax**: `node run-tests.js` or `npm test`.
- **Execution Flow**:
  1. **Phase 1: Syntax Validation (`node -c`)**: Scans all JS files across source (`background/`, `content/`, `options/`, `popup/`, `utils/`) and test suites (`tests/`). Executes `node -c <file>` for each.
  2. **Phase 2: Mock Environment Setup**: Instantiates Chrome Extension storage, runtime, DOMParser, document, window, and timer mocks.
  3. **Phase 3: Test Suite Execution**: Discovers and runs test files from `tests/tier1/` through `tests/tier4/` sequentially.
  4. **Phase 4: Summary & Exit Code**: Emits a structured console summary (Total Tests, Passed, Failed, Duration) and exits with `code 0` if 100% pass, or `code 1` on any error/failure.

### 2.2 `node -c` Syntax Check Specification
- **Engine Function**: `child_process.spawnSync('node', ['-c', filePath], { encoding: 'utf-8' })`.
- **Target Inclusion**:
  - `background/*.js`
  - `content/js/*.js`
  - `options/*.js`
  - `popup/*.js`
  - `utils/*.js`
  - `tests/**/*.js`
  - Root runner scripts (`run-tests.js`)
- **Error Handling**: Captures `stderr` output. On syntax violation, logs file path, line/column details, exact error snippet, and immediately aborts runner execution with `process.exit(1)`.

### 2.3 Test Runner Format Selection
- **Framework**: Node.js Native Test Runner (`node:test`) + Native Assertion Module (`node:assert/strict`).
- **Justification**:
  1. **Zero External Dependencies**: Does not require `npm install` or third-party frameworks like Jest/Mocha/Vitest, preserving the clean zero-dependency design of the project.
  2. **First-Class Async Support**: Built-in support for `async/await`, Promise rejections, and async hooks (`before`, `after`, `beforeEach`, `afterEach`).
  3. **High Performance**: Launches instantly without compilation overhead (<100ms startup time).
  4. **Standard Output**: Emits clear spec-style test outputs with colored pass/fail indicators and TAP compliance options.

---

## 3. Test Runner Infrastructure & Directory Blueprint

### 3.1 Directory Organization
```
shorts-shield/
├── package.json                   # Root package definition with test script
├── run-tests.js                   # Master CLI runner orchestrator
└── tests/
    ├── harness/
    │   ├── mock-extension-env.js  # Chrome API & Browser DOM mock environment setup
    │   └── test-helpers.js        # Assertion helpers and storage reset utilities
    ├── syntax/
    │   └── syntax-checker.js      # Programmatic node -c scanner across all JS files
    ├── tier1/                     # Tier 1: Feature Coverage (Happy Path, >=5 tests per feature)
    │   ├── achievement-engine.test.js
    │   ├── rank-tier.test.js
    │   ├── ui-cards.test.js
    │   ├── storage.test.js
    │   └── time-tracking.test.js
    ├── tier2/                     # Tier 2: Boundary & Edge Cases (>=5 tests per feature)
    │   ├── achievement-boundary.test.js
    │   ├── rank-tier-boundary.test.js
    │   ├── ui-cards-boundary.test.js
    │   └── storage-boundary.test.js
    ├── tier3/                     # Tier 3: Cross-Feature Interactions
    │   ├── streak-rank-interaction.test.js
    │   ├── study-time-tracking-interaction.test.js
    │   └── options-popup-sync.test.js
    └── tier4/                     # Tier 4: Real-World Workloads & Workflows
        ├── e2e-user-progression.test.js
        └── multi-day-streak-rollover.test.js
```

### 3.2 Mock Environment Design (`tests/harness/mock-extension-env.js`)
To enable full execution of Extension code in Node.js without a real browser context, the mock harness provides:
- **`chrome.storage.sync` & `chrome.storage.local`**: In-memory JavaScript Map store supporting `get(keys)`, `set(items)`, `remove(keys)`, and `clear()`.
- **`chrome.runtime`**: Mock `id`, `sendMessage`, `onMessage.addListener`.
- **`window` & `document`**:
  - Global `window` referencing `globalThis`.
  - Minimal DOM implementation for `document.getElementById`, `document.querySelector`, `document.querySelectorAll`, `document.createElement`, `classList`, `setAttribute`.
- **`MutationObserver`**: Dummy/stubbed observer class to satisfy content script instantiation.

---

## 4. Implementation Guidelines for Implementers

1. **Step 1: Package & Harness Setup**: Create `package.json` with `"test": "node run-tests.js"` and build `tests/harness/mock-extension-env.js`.
2. **Step 2: Syntax Check Utility**: Create `tests/syntax/syntax-checker.js` using `child_process.spawnSync('node', ['-c', ...])`.
3. **Step 3: Master Test Runner Entrypoint**: Create `run-tests.js` to invoke the syntax check first, load the mock harness, and run test suites via `node:test`.
4. **Step 4: Suite Construction**: Populate Tiers 1 through 4 with comprehensive test cases covering AP calculations, Rank Tier assignments, storage persistence, and UI rendering logic.
