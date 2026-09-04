# Investigation Report: Milestone 1 (R1) Quick Block Test Coverage

## 1. Observation

Direct inspection of `/Users/shivarampatel/Desktop/shorts-shield/tests/tier1/quick-block-button.test.js`, `/Users/shivarampatel/Desktop/shorts-shield/content/js/quick-block.js`, `/Users/shivarampatel/Desktop/shorts-shield/tests/harness/mock-extension-env.js`, and `/Users/shivarampatel/Desktop/shorts-shield/tests/harness/test-helpers.js` revealed the following exact facts:

### Observation A: Production Code Decoupling in `tests/tier1/quick-block-button.test.js`
In `tests/tier1/quick-block-button.test.js`, lines 16–18:
```javascript
require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
```
The test suite **does not require or import** `content/js/quick-block.js`. Instead, lines 64–353 define an in-file mock class named `QuickBlockController`. All 11 unit tests (`T1.1` to `T1.11`) instantiate `new QuickBlockController()` against this standalone dummy class. Grep search across the entire `tests/` directory confirms `content/js/quick-block.js` is imported in **0 test files**.

### Observation B: Divergence on Anchor Injection Contract
In `tests/tier1/quick-block-button.test.js` lines 112–137, the mock's `injectButton()` method is hardcoded:
```javascript
const actionContainer = document.getElementById('top-level-buttons-computed');
if (!actionContainer) return false;
...
actionContainer.appendChild(btn);
```
And test `T1.1` (lines 357–369) asserts:
```javascript
assert.ok(btn.parentElement.id === 'top-level-buttons-computed', 'Button is child of top-level-buttons');
```
In contrast, production `content/js/quick-block.js` (lines 228–275 & 307–316) implements dynamic anchor resolution:
```javascript
// Priority 2: Directly after top-level-buttons-computed
const topButtons = document.querySelector(
  'ytd-watch-metadata #top-level-buttons-computed, #top-level-buttons-computed, ytd-menu-renderer #top-level-buttons-computed'
);
if (topButtons) {
  return { element: topButtons, position: 'after' };
}
```
When `anchor.position === 'after'`, `quick-block.js` executes `anchor.element.after(btn)` (or `anchor.element.parentNode.insertBefore(btn, anchor.element.nextSibling)`). In production, `#ss-quick-block-btn` becomes a **sibling** after `#top-level-buttons-computed`, NOT a direct child. The unit test assertion directly contradicts the production DOM hierarchy.

### Observation C: 5 Anchor Fallback Tiers Audit
Inspection of all 5 fallback tiers in `content/js/quick-block.js:228-275`:
| Tier # | Selector(s) | Position | Production Implementation (`quick-block.js`) | Test Suite Status |
|---|---|---|---|---|
| **Tier 1** | `ytd-watch-metadata ytd-menu-renderer`, `ytd-menu-renderer.ytd-watch-metadata`, `#actions-inner ytd-menu-renderer`, `#actions ytd-menu-renderer`, `ytd-menu-renderer` | `after` | Lines 233–238 | **0 tests (0% coverage)** |
| **Tier 2** | `ytd-watch-metadata #top-level-buttons-computed`, `#top-level-buttons-computed`, `ytd-menu-renderer #top-level-buttons-computed` | `after` | Lines 240–246 | **Mock Only (Asserts child instead of sibling)** |
| **Tier 3** | `ytd-watch-metadata #actions-inner`, `#actions-inner`, `ytd-watch-metadata #actions`, `#actions` | `inside` | Lines 248–254 | **0 tests (0% coverage)** |
| **Tier 4** | `ytd-watch-metadata #owner #subscribe-button`, `#owner #subscribe-button`, `#subscribe-button` | `after` | Lines 256–262 | **0 tests (0% coverage)** |
| **Tier 5** | `ytd-watch-metadata #top-row`, `#top-row`, `ytd-watch-metadata #owner`, `#owner` | `inside` | Lines 264–270 | **0 tests (0% coverage)** |
| **Priority Fallback Sequence** | Progressive fallback when higher tier elements are missing | N/A | Lines 228–275 | **0 tests (0% coverage)** |

### Observation D: DOM Eviction Re-Injection & Watchdog Audit
Inspection of self-healing and eviction resilience mechanisms in `content/js/quick-block.js`:
- **600ms Heartbeat Watchdog** (`quick-block.js:115-132`): `startSelfHealingWatchdog()` sets `this._watchdogInterval = setInterval(..., 600)`. When active on `/watch`, it checks `!existing || !document.contains(existing)` and re-invokes `tryInjectButton()`. **Tested: 0 tests**.
- **MutationObserver Watchdog** (`quick-block.js:173-188`): `observeWatchPage()` calls `ObserverUtils.observe(...)` on watch metadata selectors and modern view models (`segmented-like-dislike-button-view-model`, `ytd-segmented-like-dislike-button-renderer`, `yt-button-view-model`, `like-button-view-model`, `share-button-view-model`). Re-injects when button is missing or evicted. **Tested: 0 tests**.
- **Retry Loop** (`quick-block.js:134-160`): `startRetryLoop()` checks every 250ms for up to 25 attempts. **Tested: 0 tests**.
- **7 Lifecycle Navigation Events** (`quick-block.js:54-60`): Registers listeners for `yt-navigate-finish`, `yt-page-data-updated`, `yt-navigate-start`, `DOMContentLoaded`, `load`, `pageshow`, `popstate`, plus `visibilitychange`. **Tested: 0 tests for QuickBlock**.

### Observation E: Test Harness Mock Capabilities (`tests/harness/mock-extension-env.js`)
Inspection of `MockElement` in `tests/harness/mock-extension-env.js:144-451`:
- `MockElement` defines `appendChild`, `prepend`, `removeChild`, `insertBefore`, `replaceChild`, `remove`.
- `MockElement` **lacks** `Element.prototype.after()`, `Element.prototype.before()`, `nextSibling` getter, and `previousSibling` getter.
- In `content/js/quick-block.js:308-316`:
  ```javascript
  if (typeof anchor.element.after === 'function') {
    anchor.element.after(btn);
  } else if (anchor.element.parentNode) {
    anchor.element.parentNode.insertBefore(btn, anchor.element.nextSibling);
  }
  ```
  Without `after` or `nextSibling` on `MockElement`, `insertBefore(btn, undefined)` falls back to `appendChild(btn)` at the end of the container, preventing accurate sibling position validation in unit tests.

### Observation F: `resetDOM()` Teardown in `tests/harness/test-helpers.js`
In `tests/harness/test-helpers.js:138-150`, `resetDOM()` cleans up `FocusMode`, `HeaderButton`, `FeedController`, `StudyMode`, `GoalMode`, `TimeManager`, `ShortsBlocker`, `AdSkipper`, `VolumeBooster`, `AudioEngine`, but **omits** `window.QuickBlock?.disable()`. If `QuickBlock` is required and enabled, its 600ms watchdog interval persists across tests unless explicitly disabled.

---

## 2. Logic Chain

1. **Premise 1 (Test Isolation from Production)**: `tests/tier1/quick-block-button.test.js` tests an in-file mock class rather than `content/js/quick-block.js` (Obs A). Therefore, the current 100% pass rate in `npm test` provides **0% verification** of the actual production implementation in `content/js/quick-block.js`.
2. **Premise 2 (Specification Requirement)**: Milestone 1 (ORIGINAL_REQUEST §R1 and PROJECT.md Feature 1 & Feature 4) explicitly requires 5-tier selector priority fallback (`ytd-menu-renderer`, `#top-level-buttons-computed`, `#actions-inner`, `#owner #subscribe-button`, `#top-row`), modern Lit/Polymer view models, 7 navigation events, and a 600ms self-healing watchdog with DOM eviction re-injection.
3. **Premise 3 (Coverage Gap on Anchor Fallback Tiers)**: Tiers 1, 3, 4, 5 have 0 tests. Tier 2 is tested only against the local mock with an inverted DOM hierarchy assertion (Obs B, Obs C). Therefore, none of the 5 anchor fallback tiers are verified.
4. **Premise 4 (Coverage Gap on Eviction & Watchdog)**: The 600ms self-healing watchdog, the MutationObserver watch page integration, the 250ms retry loop, and the 7 lifecycle navigation events are completely unasserted (Obs D).
5. **Premise 5 (Harness Prerequisite)**: Real testing of `content/js/quick-block.js` requires `MockElement` to support `after()`, `before()`, `nextSibling`, and `previousSibling` (Obs E), and `resetDOM()` to call `window.QuickBlock?.disable()` to prevent leaked intervals (Obs F).
6. **Inference**: To satisfy Milestone 1 testing standards, the test suite must be upgraded to import `content/js/quick-block.js`, enrich `MockElement` with DOM Level 4 traversal methods, and assert all 5 anchor fallback tiers, DOM eviction re-injection, watchdog heartbeat, and navigation lifecycle events.

---

## 3. Caveats

- **Existing Tests Pass**: All 487 tests currently pass under `npm test` because `tests/tier1/quick-block-button.test.js` evaluates against its internal mock. Refactoring the test file to test `content/js/quick-block.js` will require updating `MockElement` in `tests/harness/mock-extension-env.js` first so DOM sibling operations succeed.
- **Production Code Status**: Production `content/js/quick-block.js` already contains the implementation for `findTargetAnchor()`, `startSelfHealingWatchdog()`, `observeWatchPage()`, and lifecycle event listeners. The deficit is entirely in the test suite coverage and test harness support.
- **No Other Caveats**: No other modules are blocked.

---

## 4. Conclusion & Actionable Testing Recommendations

The test suite for Milestone 1 has major coverage gaps due to testing an in-file mock rather than `content/js/quick-block.js`, leaving all 5 anchor fallback tiers, DOM eviction re-injection, Lit/Polymer view models, and the 600ms watchdog unverified.

### Recommended Test Architecture & Implementation Plan:

#### 1. Upgrade Test Harness (`tests/harness/mock-extension-env.js` & `tests/harness/test-helpers.js`)
- Add DOM Level 4 tree mutation methods and sibling getters to `MockElement`:
  ```javascript
  // Add to MockElement in tests/harness/mock-extension-env.js:
  after(...nodes) {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx !== -1) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        node.parentNode = this.parentNode;
        node.parentElement = this.parentNode;
        this.parentNode.children.splice(idx + 1 + i, 0, node);
      }
    }
  }

  before(...nodes) {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx !== -1) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        node.parentNode = this.parentNode;
        node.parentElement = this.parentNode;
        this.parentNode.children.splice(idx + i, 0, node);
      }
    }
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.children.indexOf(this);
    return (idx !== -1 && idx + 1 < this.parentNode.children.length) ? this.parentNode.children[idx + 1] : null;
  }

  get previousSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.children.indexOf(this);
    return (idx > 0) ? this.parentNode.children[idx - 1] : null;
  }
  ```
- Add `window.QuickBlock?.disable()` and `global.QuickBlock?.disable()` inside `resetDOM()` in `tests/harness/test-helpers.js`.

#### 2. Refactor `tests/tier1/quick-block-button.test.js` to Import Production Code
- Remove the local `QuickBlockController` class definition (lines 64–353).
- Import `const { QuickBlock, QuickBlockController } = require('../../content/js/quick-block');` and `require('../../content/js/observer-utils');`.
- Update test cases to exercise the actual `QuickBlock` singleton and class instances.

#### 3. Add Comprehensive Test Cases for Milestone 1 (R1):

| Test ID | Test Description | Assertion Details |
|---|---|---|
| **T1.ANCHOR.1** | Tier 1 Fallback: Injects directly after `ytd-menu-renderer` | DOM contains `ytd-watch-metadata` with `ytd-menu-renderer`; verify `#ss-quick-block-btn` inserted as immediate nextSibling of `ytd-menu-renderer`. |
| **T1.ANCHOR.2** | Tier 2 Fallback: Injects directly after `#top-level-buttons-computed` | DOM without `ytd-menu-renderer`, has `#top-level-buttons-computed`; verify button inserted as immediate nextSibling after `#top-level-buttons-computed`. |
| **T1.ANCHOR.3** | Tier 3 Fallback: Injects inside `#actions-inner` or `#actions` | DOM without Tiers 1–2, has `#actions-inner`; verify button is appended as child of `#actions-inner`. |
| **T1.ANCHOR.4** | Tier 4 Fallback: Injects after `#owner #subscribe-button` | DOM without Tiers 1–3, has `#owner #subscribe-button`; verify button inserted as nextSibling after `#subscribe-button`. |
| **T1.ANCHOR.5** | Tier 5 Fallback: Injects inside `#owner` or `#top-row` | DOM without Tiers 1–4, has `#top-row`; verify button is appended inside `#top-row`. |
| **T1.ANCHOR.PRIORITY** | Anchor Priority Cascade Fallback | DOM initially has Tier 1 (`ytd-menu-renderer`); verify Tier 1 used. Remove Tier 1, re-inject; verify Tier 2 used. Remove Tier 2, re-inject; verify Tier 3 used. |
| **T1.LIT.1** | Modern 2024–2026 Lit/Polymer view models | Inject DOM with `segmented-like-dislike-button-view-model`, `yt-button-view-model`, and `ytd-segmented-like-dislike-button-renderer`; verify injection succeeds without layout exceptions. |
| **T1.EVICTION.WATCHDOG** | 600ms Self-Healing Watchdog re-injects evicted button | Button injected on `/watch`. Manually remove `#ss-quick-block-btn` from DOM (eviction). Advance timer by 600ms; verify `#ss-quick-block-btn` is automatically re-injected. |
| **T1.EVICTION.OBSERVER** | MutationObserver re-injects button on DOM mutation | Button evicted. Trigger MutationObserver callback via `window.ObserverUtils`; verify button is immediately re-injected. |
| **T1.LIFECYCLE.EVENTS** | 7 Lifecycle navigation events trigger injection | Dispatch `yt-navigate-finish`, `yt-page-data-updated`, `yt-navigate-start`, `popstate`, `pageshow`, `load`, `DOMContentLoaded`, and `visibilitychange`; verify `tryInjectButton()` executes on watch page. |
| **T1.SAFARI.FALLBACK** | Cross-Browser DOM insertion fallback for Safari WebKit | Set `anchor.element.after = undefined`; verify `parentNode.insertBefore(btn, anchor.element.nextSibling)` successfully inserts button. |

---

## 5. Verification Method

To verify these findings and test suite improvements:

1. **Verify Current In-File Mock Isolation**:
   ```bash
   node -e "const fs = require('fs'); const content = fs.readFileSync('tests/tier1/quick-block-button.test.js', 'utf8'); console.log('Contains in-file mock class:', content.includes('class QuickBlockController')); console.log('Requires quick-block.js:', content.includes('content/js/quick-block'));"
   ```
2. **Verify Master Test Suite Run**:
   ```bash
   npm test
   ```
3. **Verify Static Syntax Check**:
   ```bash
   node tests/syntax/syntax-checker.js
   ```
4. **Invalidation Conditions**:
   - If `tests/tier1/quick-block-button.test.js` already required `content/js/quick-block.js` and asserted all 5 tiers (disproved by Obs A & Obs C).
   - If `MockElement` already implemented `after()` and `nextSibling` (disproved by Obs E).
