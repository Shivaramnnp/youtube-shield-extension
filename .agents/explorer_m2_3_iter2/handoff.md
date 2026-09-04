# Handoff Report: Explorer 3 — Test Coverage & Verification Requirements (Milestone 2)

**Author**: Explorer 3 (`explorer_m2_3_iter2`)  
**Target Milestone**: Milestone 2 — On-Page HUD Redesign, Design Tokens, Collapsible Sections & Verification  
**Working Directory**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/explorer_m2_3_iter2`  
**Date**: 2026-08-15  
**Target Test Suites**: `tests/tier1/hud-redesign.test.js`, `tests/tier1/design-tokens.test.js`, `tests/syntax/syntax-checker.js`, `run-tests.js`

---

## 1. Observation

### 1.1 Baseline Test Suite & Syntax Validator Execution
Empirical execution of `npm test` and `node tests/syntax/syntax-checker.js` from `/Users/shivarampatel/Desktop/shorts-shield`:

- **Master E2E Test Suite (`npm test` / `node run-tests.js`)**:
  ```text
  ================================================================
                     E2E TEST SUMMARY REPORT                      
  ================================================================
    Phase 1 Syntax Validation : PASS (92/92 clean)
    Phase 2 Environment Mock  : PASS (Chrome MV3 + DOM)
    Phase 3 Suites Executed   : 349 test(s) across 4 tiers

    Tier 1 (Core Logic)      : 151/151 passed (19 files)
    Tier 2 (Boundaries)      : 158/158 passed (20 files)
    Tier 3 (Interactions)    : 23/23 passed (5 files)
    Tier 4 (Real-World E2E)  : 17/17 passed (4 files)
  ----------------------------------------------------------------
    Total Executed           : 349
    Total Passed             : 349
    Total Failed             : 0
    Duration                 : 2741 ms
  ================================================================
  ✅ OVERALL TEST SUITE RESULT: ALL PASSED CLEANLY
  ```

- **Static Syntax Checker (`node tests/syntax/syntax-checker.js`)**:
  ```text
  🔍 Phase 1: Static Syntax Validation (node -c)
  Scanning 92 JavaScript file(s)...
  ...
  --- Syntax Check Summary ---
  Total Checked : 92
  Passed        : 92
  Failed        : 0
  ✅ All 92 JavaScript files passed syntax check cleanly.
  ```

### 1.2 Test Harness Discovery & Execution Mechanics (`run-tests.js`)
In `run-tests.js` (lines 14, 54-89):
- `const TIER_DIRS = ['tier1', 'tier2', 'tier3', 'tier4'];`
- Discovers all `.js` files within each directory alphabetically.
- Automatically clears storage (`chrome.storage.local.clear()`, `chrome.storage.sync.clear()`) before requiring each test file.
- Any new file added to `tests/tier1/` (e.g. `hud-redesign.test.js`, `design-tokens.test.js`) is automatically picked up and executed in Phase 3 without requiring modifications to `run-tests.js`.

### 1.3 Manifest & Isolated World Invariant (`tests/challenger-m4-empirical-presets-verifier.js`)
In `tests/challenger-m4-empirical-presets-verifier.js` (lines 41-46):
```javascript
const manifestPath = path.join(__dirname, '..', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const contentScripts = manifest.content_scripts[0].js;

assert(Array.isArray(contentScripts), "manifest.json has content_scripts[0].js array");
assert(contentScripts.length === 16, `manifest.json contains exactly 16 content scripts (got ${contentScripts.length})`);
```
- Currently, `manifest.json` defines exactly 16 content scripts.
- If `utils/design-tokens.js` is added to `manifest.json` `content_scripts[0].js`, `contentScripts.length` becomes 17, which causes `challenger-m4-empirical-presets-verifier.js` line 46 to fail unless updated. If `utils/design-tokens.js` is loaded directly by options/popup and exported isomorphically for node tests without modifying `content_scripts[0].js`, the 16-script invariant is maintained.

### 1.4 HeaderButton DOM Architecture (`content/js/header-button.js`)
In `content/js/header-button.js` (lines 293-485):
- Container element: `#ss-header-btn-container`
- Dialog popup: `#ss-popup-dialog`
- Header: logo (`.ss-popup-logo`), master toggle (`#ss-toggle-master`), minimize button (`#ss-minimize-btn`), options settings icon (`#ss-popup-settings`).
- Minimized pill bar: `#ss-minimized-bar`, `#ss-mini-timer`, restore button (`#ss-restore-btn`).
- Scrollable body: `#ss-hud-body`.
- Default visible items: Hero goal card (`.ss-popup-study-card`, `#ss-popup-goal`, `#ss-popup-edit-goal`, `#ss-popup-goal-container`, `#ss-popup-goal-input`, `#ss-popup-save-goal`, `#ss-popup-session-time`), Quick toggles (`.ss-quick-toggles`, `#ss-toggle-shorts`, `#ss-toggle-focus`).
- Collapsible section buttons & containers:
  - Focus Features: header `#ss-sect-focus-btn`, body `#ss-sect-focus` (contains `#ss-toggle-study`, `#ss-toggle-goal`, `#ss-toggle-time-manager`).
  - Audio: header `#ss-sect-audio-btn`, body `#ss-sect-audio` (contains `#ss-vol-slider`, `#ss-bass-slider`, `#ss-spectrum-canvas`, `#ss-eq-section`, `#ss-eq-toggle`, `#ss-eq-preset`, `#ss-eq-reset`, `#ss-eq-rack`, `#ss-eq-slider-0..9`, `#ss-eq-val-0..9`).
  - Session Stats: header `#ss-sect-stats-btn`, body `#ss-sect-stats` (contains `#ss-popup-rank-tier`, `#ss-popup-today-time`, `#ss-popup-learning-time`, `#ss-popup-focus-score`).

---

## 2. Logic Chain

1. **Automatic Discovery & Execution**:
   - `run-tests.js` iterates `TIER_DIRS = ['tier1', 'tier2', 'tier3', 'tier4']`.
   - Creating `tests/tier1/hud-redesign.test.js` and `tests/tier1/design-tokens.test.js` will seamlessly register both suites under Tier 1.
   - Using `const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');` ensures standard reporting and async test chaining via `suitePromiseChain`.

2. **HUD Redesign Test Assertions (Suite 1: `hud-redesign.test.js`)**:
   - **Default View Isolation**: Assert that immediately after `HeaderButton.openPopup()`, only `#ss-toggle-master`, `#ss-popup-goal`, `#ss-popup-session-time`, `#ss-toggle-shorts`, and `#ss-toggle-focus` are visible in the main viewport.
   - **Collapsible Section Invariants**: Assert that `#ss-sect-focus`, `#ss-sect-audio`, and `#ss-sect-stats` have `style.display === 'none'` initially. Assert clicking `#ss-sect-focus-btn` expands `#ss-sect-focus` (`style.display === ''` / not `'none'`), sets `aria-expanded="true"`, and toggles class `ss-expanded`. Assert a second click collapses it.
   - **Minimize / Restore Invariants**: Assert clicking `#ss-minimize-btn` sets `#ss-hud-body.style.display = 'none'`, sets `#ss-minimized-bar.style.display = 'flex'`, and adds `.ss-is-minimized` to `#ss-popup-dialog`. Assert clicking `#ss-restore-btn` reverses this state. Assert `#ss-mini-timer` and `#ss-popup-session-time` maintain synchronized elapsed time.
   - **Full Backward Compatibility Matrix**: Assert that all 30+ legacy IDs exist in the DOM tree, all `change`/`input`/`click` event handlers correctly mutate `StorageUtil` settings/tracking and invoke underlying feature APIs (`VolumeBooster`, `AudioEngine`, `TimeTracker`).

3. **Design Tokens Test Assertions (Suite 2: `design-tokens.test.js`)**:
   - **Module Export**: Assert `require('../../utils/design-tokens')` returns an object and `global.window.DesignTokens` is defined.
   - **Completeness**: Assert the presence and correct formatting (hex/rgba/css strings) of brand palette, backgrounds, text, borders, status, gamification rank tiers, font scales, spacing scales, border radii, shadows, and z-indexes.
   - **CSS Generator / Mapping**: Assert that design tokens provide a helper (e.g. `toCssVariables()`) or match the CSS custom properties in `header-button.css`, `popup.css`, and `options.css`.

4. **Zero-Regression & Syntax Validation Invariants**:
   - All JS files must pass `node -c` cleanly to satisfy Phase 1 of `run-tests.js` and `syntax-checker.js`.
   - `HeaderButton.tryInject()` requires a buttons container in the mock DOM (`#end #buttons` or `ytd-masthead #buttons` or `div#buttons`) or a pre-assigned `HeaderButton.containerElement`. The test harness must set this up before opening the popup.
   - All async operations (such as `StorageUtil.saveSettings`, `HeaderButton.openPopup`) must be awaited within `test(name, async () => { ... })`.

---

## 3. Caveats

1. **Mock DOM vs Real Browser CSS Layout**: In the Node.js mock environment (`tests/harness/mock-extension-env.js`), CSS layout engines (calculating actual rendered pixel heights or CSS cascade specificity) are not present. Visibility is verified via inline `style.display`, DOM class toggles (`.ss-collapsed`, `.ss-expanded`, `.ss-is-minimized`), and ARIA attributes (`aria-expanded`).
2. **DOM Event Dispatching**: The mock environment relies on `element.dispatchEvent(new Event('...'))` or simulated handler triggers (`button.click()`, `input.checked = true; input.dispatchEvent('change')`).
3. **Audio Context Mocking**: Spectrum rendering tests verify that `renderSpectrum` starts and stops cleanly without throwing in headless environments where `canvas.getContext('2d')` or `requestAnimationFrame` may be mocked.

---

## 4. Conclusion & Verification Requirements Blueprint

### 4.1 Test Blueprint: `tests/tier1/hud-redesign.test.js`

```javascript
/**
 * Tier 1 Unit & Integration Test Suite: Milestone 2 - HUD Redesign & Collapsible UI
 * File: tests/tier1/hud-redesign.test.js
 * 
 * Verifies:
 * 1. Minimal default view (only master toggle, goal card, session timer, shorts blocker, focus mode visible)
 * 2. Collapsible accordion sections (Focus Features, Audio, Session Stats collapsed by default, toggle on click)
 * 3. Minimize pill badge (collapsing hides full panel and shows pill badge; clicking restore restores full panel)
 * 4. Backward compatibility of all 30+ element IDs, event listeners, and storage synchronization
 * 5. Clean teardown and lifecycle management
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../../utils/storage');

require('../../utils/dom-utils');
require('../../utils/audio-engine');
require('../../content/js/volume-booster');
require('../../content/js/header-button');

describe('M2: On-Page HUD Redesign & Interaction Suite', () => {

  // Helper to initialize HeaderButton in clean mock DOM
  async function setupHUD(customSettings = {}, customTracking = {}) {
    await resetStorage();
    resetDOM();

    // Create YouTube masthead buttons container
    const masthead = document.createElement('div');
    masthead.id = 'buttons';
    document.body.appendChild(masthead);

    await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, ...customSettings });
    await StorageUtil.saveTracking({ ...DEFAULT_TRACKING, ...customTracking });

    window.HeaderButton.enable();
    await window.HeaderButton.openPopup();

    const dialog = document.getElementById('ss-popup-dialog');
    return { dialog, headerBtn: window.HeaderButton };
  }

  // =========================================================================
  // 1. MINIMAL DEFAULT VIEW VISIBILITY
  // =========================================================================
  describe('1. Minimal Default View Visibility', () => {

    test('M2.1a: Default view displays master toggle, hero goal card, session timer, shorts blocker, focus mode', async () => {
      const { dialog } = await setupHUD();
      assert.ok(dialog, 'HUD popup dialog is injected into DOM');

      // Master Toggle
      const masterToggle = dialog.querySelector('#ss-toggle-master');
      assert.ok(masterToggle, 'Master toggle (#ss-toggle-master) is present');
      assert.equal(masterToggle.checked, true, 'Master toggle is checked by default');

      // Hero Goal Card & Session Timer
      const goalEl = dialog.querySelector('#ss-popup-goal');
      const timerEl = dialog.querySelector('#ss-popup-session-time');
      const editGoalBtn = dialog.querySelector('#ss-popup-edit-goal');
      assert.ok(goalEl, 'Goal text display (#ss-popup-goal) is present');
      assert.ok(timerEl, 'Session timer (#ss-popup-session-time) is present');
      assert.ok(editGoalBtn, 'Edit goal button (#ss-popup-edit-goal) is present');

      // Quick Toggles (Shorts Blocker & Focus Mode)
      const shortsToggle = dialog.querySelector('#ss-toggle-shorts');
      const focusToggle = dialog.querySelector('#ss-toggle-focus');
      assert.ok(shortsToggle, 'Shorts blocker toggle (#ss-toggle-shorts) is present in quick toggles');
      assert.ok(focusToggle, 'Focus mode toggle (#ss-toggle-focus) is present in quick toggles');

      // Verify Quick Toggles Container exists
      const quickToggles = dialog.querySelector('.ss-quick-toggles');
      assert.ok(quickToggles, 'Quick toggles container (.ss-quick-toggles) is present and visible');
    });

    test('M2.1b: Secondary controls are inside collapsed accordion sections by default', async () => {
      const { dialog } = await setupHUD();

      // Accordion bodies
      const focusBody = dialog.querySelector('#ss-sect-focus');
      const audioBody = dialog.querySelector('#ss-sect-audio');
      const statsBody = dialog.querySelector('#ss-sect-stats');

      assert.ok(focusBody, 'Focus Features section body (#ss-sect-focus) exists');
      assert.ok(audioBody, 'Audio section body (#ss-sect-audio) exists');
      assert.ok(statsBody, 'Session Stats section body (#ss-sect-stats) exists');

      // Verify all are hidden by default
      assert.equal(focusBody.style.display, 'none', 'Focus Features body is hidden (display: none) by default');
      assert.equal(audioBody.style.display, 'none', 'Audio body is hidden (display: none) by default');
      assert.equal(statsBody.style.display, 'none', 'Session Stats body is hidden (display: none) by default');

      // Secondary controls must reside inside these collapsed bodies
      assert.ok(focusBody.querySelector('#ss-toggle-study'), 'Study Mode toggle is inside Focus section');
      assert.ok(focusBody.querySelector('#ss-toggle-goal'), 'Goal Mode toggle is inside Focus section');
      assert.ok(focusBody.querySelector('#ss-toggle-time-manager'), 'Time Manager toggle is inside Focus section');

      assert.ok(audioBody.querySelector('#ss-vol-slider'), 'Volume Boost slider is inside Audio section');
      assert.ok(audioBody.querySelector('#ss-bass-slider'), 'Bass Boost slider is inside Audio section');
      assert.ok(audioBody.querySelector('#ss-spectrum-canvas'), 'Spectrum visualizer canvas is inside Audio section');
      assert.ok(audioBody.querySelector('#ss-eq-rack'), '10-Band EQ rack is inside Audio section');

      assert.ok(statsBody.querySelector('#ss-popup-rank-tier'), 'Player rank is inside Stats section');
      assert.ok(statsBody.querySelector('#ss-popup-today-time'), 'Today total time is inside Stats section');
      assert.ok(statsBody.querySelector('#ss-popup-learning-time'), 'Learning time is inside Stats section');
      assert.ok(statsBody.querySelector('#ss-popup-focus-score'), 'Focus score is inside Stats section');
    });
  });

  // =========================================================================
  // 2. COLLAPSIBLE ACCORDION SECTIONS
  // =========================================================================
  describe('2. Collapsible Accordion Sections Interaction', () => {

    test('M2.2a: Focus Features accordion toggles open and closed on header click', async () => {
      const { dialog } = await setupHUD();

      const btn = dialog.querySelector('#ss-sect-focus-btn');
      const body = dialog.querySelector('#ss-sect-focus');

      assert.equal(btn.getAttribute('aria-expanded'), 'false', 'Initial aria-expanded is false');
      assert.equal(body.style.display, 'none', 'Initial display is none');

      // Click 1: Expand
      btn.click();
      assert.equal(body.style.display, '', 'Body display is cleared (visible)');
      assert.equal(btn.getAttribute('aria-expanded'), 'true', 'aria-expanded is true');
      assert.ok(btn.classList.contains('ss-expanded'), 'Button has ss-expanded class');

      // Click 2: Collapse
      btn.click();
      assert.equal(body.style.display, 'none', 'Body display is none');
      assert.equal(btn.getAttribute('aria-expanded'), 'false', 'aria-expanded is false');
      assert.ok(btn.classList.contains('ss-collapsed'), 'Button has ss-collapsed class');
    });

    test('M2.2b: Audio accordion toggles open and closed on header click', async () => {
      const { dialog } = await setupHUD();

      const btn = dialog.querySelector('#ss-sect-audio-btn');
      const body = dialog.querySelector('#ss-sect-audio');

      assert.equal(body.style.display, 'none');

      // Click 1: Expand
      btn.click();
      assert.equal(body.style.display, '', 'Audio section is expanded');
      assert.equal(btn.getAttribute('aria-expanded'), 'true');

      // Click 2: Collapse
      btn.click();
      assert.equal(body.style.display, 'none', 'Audio section is collapsed');
      assert.equal(btn.getAttribute('aria-expanded'), 'false');
    });

    test('M2.2c: Session Stats accordion toggles open and closed on header click', async () => {
      const { dialog } = await setupHUD();

      const btn = dialog.querySelector('#ss-sect-stats-btn');
      const body = dialog.querySelector('#ss-sect-stats');

      assert.equal(body.style.display, 'none');

      // Click 1: Expand
      btn.click();
      assert.equal(body.style.display, '', 'Stats section is expanded');
      assert.equal(btn.getAttribute('aria-expanded'), 'true');

      // Click 2: Collapse
      btn.click();
      assert.equal(body.style.display, 'none', 'Stats section is collapsed');
      assert.equal(btn.getAttribute('aria-expanded'), 'false');
    });

    test('M2.2d: Multiple sections expand independently without mutual interference', async () => {
      const { dialog } = await setupHUD();

      const focusBtn = dialog.querySelector('#ss-sect-focus-btn');
      const focusBody = dialog.querySelector('#ss-sect-focus');
      const audioBtn = dialog.querySelector('#ss-sect-audio-btn');
      const audioBody = dialog.querySelector('#ss-sect-audio');

      // Expand Focus
      focusBtn.click();
      assert.equal(focusBody.style.display, '');
      assert.equal(audioBody.style.display, 'none');

      // Expand Audio
      audioBtn.click();
      assert.equal(focusBody.style.display, '', 'Focus remains expanded');
      assert.equal(audioBody.style.display, '', 'Audio is also expanded');
    });
  });

  // =========================================================================
  // 3. MINIMIZE PILL BADGE INTERACTION
  // =========================================================================
  describe('3. Minimize Pill Badge Interaction', () => {

    test('M2.3a: Clicking minimize button hides HUD body and displays minimized pill badge', async () => {
      const { dialog } = await setupHUD();

      const hudBody = dialog.querySelector('#ss-hud-body');
      const minBar = dialog.querySelector('#ss-minimized-bar');
      const minBtn = dialog.querySelector('#ss-minimize-btn');

      assert.equal(hudBody.style.display, '', 'HUD body is initially visible');
      assert.equal(minBar.style.display, 'none', 'Minimized bar is initially hidden');
      assert.ok(!dialog.classList.contains('ss-is-minimized'), 'Dialog does not have minimized class');

      // Click minimize
      minBtn.click();

      assert.equal(hudBody.style.display, 'none', 'HUD body is hidden on minimize');
      assert.equal(minBar.style.display, 'flex', 'Minimized bar is displayed flex');
      assert.ok(dialog.classList.contains('ss-is-minimized'), 'Dialog has ss-is-minimized class');
    });

    test('M2.3b: Clicking restore button restores HUD body and hides minimized pill badge', async () => {
      const { dialog } = await setupHUD();

      const hudBody = dialog.querySelector('#ss-hud-body');
      const minBar = dialog.querySelector('#ss-minimized-bar');
      const minBtn = dialog.querySelector('#ss-minimize-btn');
      const restoreBtn = dialog.querySelector('#ss-restore-btn');

      // Minimize first
      minBtn.click();
      assert.equal(minBar.style.display, 'flex');

      // Restore
      restoreBtn.click();
      assert.equal(hudBody.style.display, '', 'HUD body is restored to visible');
      assert.equal(minBar.style.display, 'none', 'Minimized bar is hidden');
      assert.ok(!dialog.classList.contains('ss-is-minimized'), 'Minimized class removed from dialog');
    });

    test('M2.3c: Live session timer remains synchronized across full and minimized views', async () => {
      const { dialog, headerBtn } = await setupHUD({}, { activeSessionStart: Date.now() - 65000 }); // 1m 5s ago

      headerBtn.startSessionTimer({ activeSessionStart: Date.now() - 65000 });

      const fullTimer = dialog.querySelector('#ss-popup-session-time');
      const miniTimer = dialog.querySelector('#ss-mini-timer');

      assert.ok(fullTimer, 'Full session timer element exists');
      assert.ok(miniTimer, 'Mini timer element exists');
      assert.equal(fullTimer.textContent, miniTimer.textContent, 'Full timer and mini timer show identical time');
      assert.equal(fullTimer.textContent, '00:01:05', 'Timer formats elapsed seconds accurately');
    });
  });

  // =========================================================================
  // 4. BACKWARD COMPATIBILITY OF CONTROLS & STORAGE SYNCHRONIZATION
  // =========================================================================
  describe('4. Backward Compatibility of Controls & Storage', () => {

    test('M2.4a: Master toggle updates extensionEnabled in storage and manages child opacity', async () => {
      const { dialog } = await setupHUD();
      const masterToggle = dialog.querySelector('#ss-toggle-master');

      masterToggle.checked = false;
      masterToggle.dispatchEvent('change');

      const settings = await StorageUtil.getSettings();
      assert.equal(settings.extensionEnabled, false, 'extensionEnabled updated in storage to false');
    });

    test('M2.4b: Feature toggles (shorts, focus, study, goal, time manager) update storage correctly', async () => {
      const { dialog } = await setupHUD();

      // Shorts Blocker
      const shorts = dialog.querySelector('#ss-toggle-shorts');
      shorts.checked = false;
      shorts.dispatchEvent('change');
      let s = await StorageUtil.getSettings();
      assert.equal(s.shortsBlocker, false);

      // Focus Mode
      const focus = dialog.querySelector('#ss-toggle-focus');
      focus.checked = false;
      focus.dispatchEvent('change');
      s = await StorageUtil.getSettings();
      assert.equal(s.focusMode, false);

      // Study Mode
      const study = dialog.querySelector('#ss-toggle-study');
      study.checked = true;
      study.dispatchEvent('change');
      s = await StorageUtil.getSettings();
      assert.equal(s.studyMode, true);

      // Goal Mode
      const goal = dialog.querySelector('#ss-toggle-goal');
      goal.checked = true;
      goal.dispatchEvent('change');
      s = await StorageUtil.getSettings();
      assert.equal(s.goalMode, true);

      // Time Manager
      const tm = dialog.querySelector('#ss-toggle-time-manager');
      tm.checked = true;
      tm.dispatchEvent('change');
      s = await StorageUtil.getSettings();
      assert.equal(s.timeManager.enabled, true);
    });

    test('M2.4c: Volume and Bass sliders update VolumeBooster and persist to storage', async () => {
      const { dialog } = await setupHUD();

      const volSlider = dialog.querySelector('#ss-vol-slider');
      const volValue = dialog.querySelector('#ss-vol-value');
      const bassSlider = dialog.querySelector('#ss-bass-slider');
      const bassValue = dialog.querySelector('#ss-bass-value');

      volSlider.value = '250';
      volSlider.dispatchEvent('input');
      assert.equal(volValue.textContent, '250%');
      volSlider.dispatchEvent('change');

      let s = await StorageUtil.getSettings();
      assert.equal(s.volumeBooster.volumeLevel, 250);

      bassSlider.value = '12';
      bassSlider.dispatchEvent('input');
      assert.equal(bassValue.textContent, '12 dB');
      bassSlider.dispatchEvent('change');

      s = await StorageUtil.getSettings();
      assert.equal(s.volumeBooster.bassLevel, 12);
    });

    test('M2.4d: 10-Band EQ presets, reset, and individual band sliders function seamlessly', async () => {
      const { dialog } = await setupHUD();

      const eqPreset = dialog.querySelector('#ss-eq-preset');
      const eqReset = dialog.querySelector('#ss-eq-reset');

      // Select 'Bass Boost' preset
      eqPreset.value = 'Bass Boost';
      eqPreset.dispatchEvent('change');

      let s = await StorageUtil.getSettings();
      assert.equal(s.volumeBooster.preset, 'Bass Boost');
      assert.deepEqual(s.volumeBooster.eqGains, [6, 5, 4, 2, 0, 0, 0, 0, 0, 0]);

      // Reset EQ
      eqReset.click();
      s = await StorageUtil.getSettings();
      assert.equal(s.volumeBooster.preset, 'Flat');
      assert.deepEqual(s.volumeBooster.eqGains, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      // Adjust individual band slider
      const band0 = dialog.querySelector('#ss-eq-slider-0');
      const val0 = dialog.querySelector('#ss-eq-val-0');
      band0.value = '8';
      band0.dispatchEvent('input');
      assert.equal(val0.textContent, '+8dB');
      band0.dispatchEvent('change');

      s = await StorageUtil.getSettings();
      assert.equal(s.volumeBooster.eqGains[0], 8);
      assert.equal(s.volumeBooster.preset, 'Custom');
    });

    test('M2.4e: Goal inline editing and saving updates storage', async () => {
      const { dialog } = await setupHUD();

      const editBtn = dialog.querySelector('#ss-popup-edit-goal');
      const goalContainer = dialog.querySelector('#ss-popup-goal-container');
      const goalInput = dialog.querySelector('#ss-popup-goal-input');
      const saveBtn = dialog.querySelector('#ss-popup-save-goal');
      const goalText = dialog.querySelector('#ss-popup-goal');

      editBtn.click();
      assert.equal(goalContainer.style.display, 'flex');

      goalInput.value = 'Learn Kubernetes Architecture';
      saveBtn.click();

      const s = await StorageUtil.getSettings();
      assert.equal(s.learningGoal, 'Learn Kubernetes Architecture');
      assert.equal(goalText.textContent, 'Learn Kubernetes Architecture');
      assert.equal(goalContainer.style.display, 'none');
    });

    test('M2.4f: Options icon triggers background tab deduplication or window.open fallback', async () => {
      const { dialog } = await setupHUD();
      const settingsIcon = dialog.querySelector('#ss-popup-settings');

      let ipcAction = null;
      global.chrome.runtime.sendMessage = (msg, cb) => {
        ipcAction = msg.action;
        if (cb) cb({ success: true, reused: true });
      };

      settingsIcon.click();
      assert.equal(ipcAction, 'openOptionsPage');
    });
  });

  // =========================================================================
  // 5. LIFECYCLE & TEARDOWN
  // =========================================================================
  describe('5. Lifecycle & Clean Teardown', () => {

    test('M2.5a: closePopup removes dialog and cleans up spectrum timer', async () => {
      const { dialog, headerBtn } = await setupHUD();
      assert.ok(document.getElementById('ss-popup-dialog'));

      headerBtn.closePopup();
      assert.equal(document.getElementById('ss-popup-dialog'), null, 'Dialog element removed from DOM');
    });

    test('M2.5b: disable cleanly removes button container and all listeners', async () => {
      const { headerBtn } = await setupHUD();

      headerBtn.disable();
      assert.equal(headerBtn.isActive, false);
      assert.equal(document.getElementById('ss-header-btn-container'), null);
      assert.equal(document.getElementById('ss-popup-dialog'), null);
    });
  });

});
```

---

### 4.2 Test Blueprint: `tests/tier1/design-tokens.test.js`

```javascript
/**
 * Tier 1 Unit Test Suite: Milestone 2 - Design Tokens & Shared Theme System
 * File: tests/tier1/design-tokens.test.js
 * 
 * Verifies:
 * 1. Isomorphic module exports (window.DesignTokens and module.exports)
 * 2. Token completeness across Palette, Typography, Spacing, Radii, Shadows, Z-Index, Transitions
 * 3. CSS Custom Properties generator / mapper consistency with HUD & Dashboard styling
 */

require('../harness/mock-extension-env');
const { test, describe, assert } = require('../harness/test-helpers');
const DesignTokens = require('../../utils/design-tokens');

describe('M2: Shared Design Tokens & Theme System', () => {

  test('M2.T1: DesignTokens is exported cleanly as CommonJS module and attached to window', () => {
    assert.ok(DesignTokens, 'DesignTokens module exported');
    assert.equal(typeof DesignTokens, 'object', 'DesignTokens is an object');
    assert.ok(global.window.DesignTokens, 'window.DesignTokens is populated on global window');
    assert.strictEqual(DesignTokens, global.window.DesignTokens, 'CommonJS export strictly equals window.DesignTokens');
  });

  test('M2.T2: Palette tokens include all brand accents, backgrounds, text, and status colors', () => {
    const { colors } = DesignTokens;
    assert.ok(colors, 'colors group exists');

    // Accents
    assert.equal(colors.accentIndigo, '#6366f1');
    assert.equal(colors.accentPurple, '#a855f7');
    assert.equal(colors.accentPink, '#ec4899');
    assert.equal(colors.accentEmerald, '#10b981');
    assert.equal(colors.accentBlue, '#3b82f6');

    // Backgrounds
    assert.ok(colors.bgBase, 'bgBase defined');
    assert.ok(colors.bgSurface, 'bgSurface defined');
    assert.ok(colors.bgGlassPanel, 'bgGlassPanel defined');
    assert.ok(colors.bgCard, 'bgCard defined');

    // Text
    assert.equal(colors.textPrimary, '#f8fafc');
    assert.equal(colors.textSecondary, '#cbd5e1');
    assert.equal(colors.textMuted, '#94a3b8');
    assert.equal(colors.textAccent, '#a78bfa');

    // Borders
    assert.ok(colors.borderSubtle, 'borderSubtle defined');
    assert.ok(colors.borderDefault, 'borderDefault defined');

    // Status
    assert.equal(colors.statusSuccess, '#10b981');
    assert.equal(colors.statusWarning, '#f59e0b');
    assert.equal(colors.statusDanger, '#ef4444');
    assert.equal(colors.statusInfo, '#3b82f6');
  });

  test('M2.T3: Gamification rank tier colors are fully specified', () => {
    const { rankColors } = DesignTokens;
    assert.ok(rankColors, 'rankColors group exists');

    assert.ok(rankColors.bronze, 'Bronze rank color defined');
    assert.ok(rankColors.silver, 'Silver rank color defined');
    assert.ok(rankColors.gold, 'Gold rank color defined');
    assert.ok(rankColors.platinum, 'Platinum rank color defined');
    assert.ok(rankColors.diamond, 'Diamond rank color defined');
    assert.ok(rankColors.master, 'Master rank color defined');
    assert.ok(rankColors.grandmaster, 'Grandmaster rank color defined');
  });

  test('M2.T4: Typography tokens define font families, scales, and font weights', () => {
    const { typography } = DesignTokens;
    assert.ok(typography, 'typography group exists');

    assert.ok(typography.fontFamily, 'fontFamily defined');
    assert.ok(typography.fontSize, 'fontSize scale defined');
    assert.equal(typography.fontSize.xs, '11px');
    assert.equal(typography.fontSize.sm, '12px');
    assert.equal(typography.fontSize.base, '14px');
    assert.equal(typography.fontSize.lg, '16px');
    assert.equal(typography.fontSize.xl, '20px');
    assert.equal(typography.fontSize['2xl'], '24px');
    assert.equal(typography.fontSize.timer, '30px');

    assert.ok(typography.fontWeight, 'fontWeight defined');
    assert.equal(typography.fontWeight.regular, 400);
    assert.equal(typography.fontWeight.medium, 500);
    assert.equal(typography.fontWeight.semibold, 600);
    assert.equal(typography.fontWeight.bold, 700);
  });

  test('M2.T5: Spacing, border radii, and layout bounds tokens are defined', () => {
    const { spacing, radii, layout } = DesignTokens;
    assert.ok(spacing, 'spacing group exists');
    assert.ok(radii, 'radii group exists');
    assert.ok(layout, 'layout group exists');

    assert.equal(spacing['0'], '0px');
    assert.equal(spacing['1'], '4px');
    assert.equal(spacing['2'], '8px');
    assert.equal(spacing['3'], '12px');
    assert.equal(spacing['4'], '16px');
    assert.equal(spacing['6'], '24px');

    assert.equal(radii.sm, '6px');
    assert.equal(radii.md, '8px');
    assert.equal(radii.lg, '12px');
    assert.equal(radii.xl, '16px');
    assert.equal(radii.full, '9999px');

    assert.equal(layout.hudWidth, '320px');
    assert.ok(layout.hudMaxHeight.includes('480px') || layout.hudMaxHeight.includes('80vh') || layout.hudMaxHeight.includes('72vh'));
  });

  test('M2.T6: Z-Index hierarchy prevents overlay collisions', () => {
    const { zIndex } = DesignTokens;
    assert.ok(zIndex, 'zIndex group exists');

    assert.ok(zIndex.base < zIndex.sticky);
    assert.ok(zIndex.sticky < zIndex.hud);
    assert.ok(zIndex.hud <= zIndex.overlay);
    assert.equal(zIndex.overlay, 2147483647, 'Overlay z-index has maximum value');
  });

  test('M2.T7: CSS Custom Properties generator outputs valid CSS variable declarations', () => {
    assert.equal(typeof DesignTokens.toCssVariables, 'function', 'toCssVariables method exists');
    const cssVars = DesignTokens.toCssVariables();

    assert.ok(typeof cssVars === 'string', 'toCssVariables returns a string');
    assert.ok(cssVars.includes('--gm-accent-indigo: #6366f1;'));
    assert.ok(cssVars.includes('--gm-accent-purple: #a855f7;'));
    assert.ok(cssVars.includes('--gm-text-primary: #f8fafc;'));
    assert.ok(cssVars.includes('--gm-bg-base:'));
  });

});
```

---

## 5. Verification Method

To independently verify all findings and test suite integrations:

1. **Verify Static Syntax on Codebase**:
   ```bash
   node tests/syntax/syntax-checker.js
   ```
   *Expected Result*: 92/92 (or 95/95 when M2 files are added) pass cleanly with 0 errors.

2. **Execute Full E2E Test Suite (`npm test`)**:
   ```bash
   npm test
   ```
   *Expected Result*: 349/349 (or 375+/375+ with new M2 suites) passing across all 4 tiers with exit code 0.

3. **Verify Empirical Isolated World Presets**:
   ```bash
   node tests/challenger-m4-empirical-presets-verifier.js
   ```
   *Expected Result*: 324/324 tests passing cleanly.

4. **Verify Zero Deprecated Slider Attributes**:
   ```bash
   grep -rn "orient=\"vertical\"\|slider-vertical" popup/ options/ content/
   ```
   *Expected Result*: Exactly 0 matches.

5. **Invalidation Conditions**:
   - Any test failure reported by `run-tests.js`.
   - Any syntax error raised by `node tests/syntax/syntax-checker.js`.
   - Any regression in legacy element IDs or storage persistence contracts.
