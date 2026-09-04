# E2E Test Infra: YouTube Shield Comprehensive Test Infrastructure

## Test Philosophy
- **Opaque-Box & Requirement-Driven**: Tests validate observable extension behavior against requirements in `ORIGINAL_REQUEST.md` and `PROJECT.md` without tight coupling to internal private states.
- **4-Tier Structured Verification**:
  1. **Tier 1: Feature Coverage** (≥5 tests per feature) — Validates the primary behavior (happy path) and functional execution of all core features.
  2. **Tier 2: Boundary & Corner Cases** (≥5 tests per feature) — Exercises parameter limits, type coercion, null/undefined payloads, corrupted storage schemas, rapid state transitions, and browser fallback gates.
  3. **Tier 3: Cross-Feature Interactions** — Validates pairwise and multi-module state synchronization between isolated content scripts, MAIN-world DSP/ad controllers, background service worker, popup UI, options studio, and storage cascade.
  4. **Tier 4: Real-World Application Scenarios** (≥5 comprehensive workflows) — Simulates authentic multi-session user journeys, daily rollovers, blocklist import/export migrations, long-term gamification progression, and concurrent defense mode activations.

---

## Feature Inventory & Test Mapping

| # | Feature | Milestone | Source Requirement | Tier 1 Tests | Tier 2 Tests | Tier 3 | Tier 4 |
|---|---------|-----------|--------------------|:------------:|:------------:|:------:|:------:|
| 1 | **Glassmorphism & Token Conformance** | M1 | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 2 | **Masthead HUD Popover Dialog** | M1 | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 3 | **Popup Menu Interface (328px)** | M1 | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 4 | **Options Studio Dashboard (8 Tabs)** | M1 | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 5 | **Floating Modals & Z-Index Stacking** | M1 | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 6 | **Master Power & Core Toggles** | M2 | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 7 | **Shorts Blocker & Clean UI (7 Toggles)** | M2 | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 8 | **Focus Mode & Study Mode (Pomodoro)** | M2 | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 9 | **Goal Mode Strict Zero-Bypass** | M2 | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 10 | **Time Manager & Emergency Snooze** | M2 | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 11 | **Ghost Shield & Quick Block** | M2 | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 12 | **Multi-Strategy Ad Skipper** | M2 | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 13 | **Cross-Browser Detection & Gating** | M3 | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 14 | **Web Audio DSP Engine (Volume, Bass, EQ)** | M3 | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 15 | **Gamification System (22 Badges, 6 Ranks)** | M4 | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 16 | **Analytics Engine & Backup (24h Charts, CSV/JSON)** | M4 | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 17 | **3-Tier Storage Cascade (Sync -> Local -> Memory)** | M4 | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 18 | **E2E Opaque-Box Test Suite (522 Tests)** | M5 | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 19 | **Adversarial Coverage Hardening (Challenger Suites)** | M5 | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 20 | **Pre-Deployment Build Certification** | M5 | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |

---

## Test Architecture

### Master Test Runner (`node run-tests.js` / `npm test`)
The test execution harness coordinates four sequential phases:

1. **Phase 1: Static JavaScript Syntax Validation (`tests/syntax/syntax-checker.js`)**
   - Automatically discovers and runs `node -c` across all 131 JavaScript files in `background/`, `content/`, `popup/`, `options/`, `utils/`, `scripts/`, and `tests/`.
   - Halts immediately with exit code 1 if any syntax, parsing, or tokenization error is detected.

2. **Phase 2: Mock Extension & Browser DOM Environment (`tests/harness/mock-extension-env.js`)**
   - Emulates Chrome Manifest V3 extension APIs:
     - `chrome.storage.sync`, `chrome.storage.local`, `chrome.storage.session`, `chrome.storage.onChanged`
     - `chrome.runtime.sendMessage`, `chrome.runtime.onMessage`, `chrome.runtime.getURL`, `chrome.runtime.openOptionsPage`
     - `chrome.tabs.query`, `chrome.tabs.sendMessage`, `chrome.tabs.update`, `chrome.tabs.create`, `chrome.tabs.onUpdated`, `chrome.tabs.onRemoved`
     - `chrome.webNavigation.onBeforeNavigate`, `chrome.webNavigation.onHistoryStateUpdated`
     - `chrome.scripting.executeScript`
     - `chrome.commands.onCommand`
     - `chrome.i18n.getMessage`
   - Emulates Web Audio API graph (`AudioContext`, `GainNode`, `BiquadFilterNode`, `AnalyserNode`, `MediaElementAudioSourceNode`).
   - Emulates Browser DOM environment (`window`, `document`, `DOMParser`, `MutationObserver`, `CustomEvent`, `localStorage`, `sessionStorage`, `navigator`).

3. **Phase 3: Automated Suite Discovery & Execution (Tiers 1–4)**
   - Discovers test files matching `tests/tier*/*.js`.
   - Cleans storage and DOM state before and after each test case (`tests/harness/test-helpers.js`).
   - Collects per-test execution duration, assertion outcomes, and stack traces.

4. **Phase 4: Summary Report & Exit Determination**
   - Formats execution metrics across tiers.
   - Exits with `0` on clean pass; outputs line-level failure details and exits with `1` on any failure.

---

## Real-World Application Scenarios (Tier 4)

| # | Scenario | Primary Features Exercised | Verification Focus |
|---|----------|----------------------------|--------------------|
| 1 | **Custom Blocklist & Quick Block Flow** | F11 (Ghost Shield & Quick Block), F17 (Storage Cascade), F4 (Options Studio) | Watch page quick block action -> auto video pause -> channel blocklist sync -> multi-tab feed suppression -> Options Studio inspection, undo, and JSON export/import migration. |
| 2 | **Daily Rollover & Streak Engine** | F15 (Gamification), F16 (Analytics Engine), F17 (Storage Cascade) | Midnight boundary rollover -> daily watch and study accumulation -> ISO weekly and monthly resets -> 60-day data retention pruning -> consecutive streak preservation and recovery. |
| 3 | **Fresh Install to Grandmaster Progression** | F15 (Gamification), F8 (Focus/Study Mode), F7 (Shorts Blocker) | User starts at Level 1 Bronze Focus (0 AP) -> accumulates study time, Pomodoro sessions, and blocked Shorts -> progresses through Silver Scholar, Gold Mastermind, Diamond Warrior, Heroic Monk -> unlocks Level 100 Grandmaster Legend (3500+ AP) with 22 achievement badges. |
| 4 | **Multi-Session Focus & Defensive Shield** | F6 (Master Power), F7 (Shorts Blocker), F8 (Focus/Study), F9 (Goal Mode), F10 (Time Manager) | Concurrent activation of all 4 defense modes -> off-topic video blocking with strict zero-bypass -> on-topic video study session -> Time Manager daily quota enforcement and emergency snooze extension. |
| 5 | **Cross-Context Lifecycle & E2E State Integration** | F1–F20 (Full System Integration) | End-to-end integration lifecycle connecting Popup, Masthead HUD, Options Studio, Isolated Content Scripts, MAIN-world DSP audio engine, and Background Worker. |

---

## Coverage Thresholds & Quality Metrics

- **Tier 1 (Core Logic)**: ≥5 tests per feature (286 total tests across 26 suites).
- **Tier 2 (Boundaries & Edge Cases)**: ≥5 tests per feature (173 total tests across 22 suites).
- **Tier 3 (Cross-Module Interactions)**: Pairwise coverage across all modules (41 total tests across 7 suites).
- **Tier 4 (Real-World Application Scenarios)**: ≥5 comprehensive multi-step workflows (22 total tests across 5 suites).
- **Syntax Integrity**: 100% clean check across all 131 JavaScript files.
- **Empirical Challenger Suites**: 6 external stress test suites validating ad skipping, DSP node graphs, modal z-index hierarchies, and storage cascade resilience under adversarial load.

---

## Commands

```bash
# Run the complete master test suite (Syntax Check + Tiers 1-4)
npm test

# Run manifest and asset reference validation
npm run validate

# Run master suite + all empirical adversarial challenger stress suites
npm run test:all

# Package Chrome and Firefox distribution zip bundles
npm run package

# Full pre-deployment clean, build, validate, test, and package pipeline
npm run build
```
