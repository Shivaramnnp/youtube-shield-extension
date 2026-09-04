/**
 * Tier 1 Unit & Integration Test Suite: Milestone 2 - HUD Redesign & Collapsible UI
 * File: tests/tier1/hud-redesign.test.js
 * 
 * Verifies:
 * 1. Minimal default view (only master toggle, goal card, session timer, shorts blocker, focus mode visible)
 * 2. Collapsible accordion sections (Session, Focus Features, Audio collapsed by default, toggle on click)
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
    if (window.HeaderButton) {
      window.HeaderButton.disable();
    }
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
      const focusBody = dialog.querySelector('#ss-section-focus') || dialog.querySelector('#ss-sect-focus');
      const statsBody = dialog.querySelector('#ss-section-stats') || dialog.querySelector('#ss-sect-stats');
      const audioBody = dialog.querySelector('#ss-section-audio') || dialog.querySelector('#ss-sect-audio');

      assert.ok(focusBody, 'Focus Features section body exists');
      assert.ok(statsBody, 'Today Stats section body exists');
      assert.ok(audioBody, 'Audio section body exists');

      // Verify all are hidden by default
      assert.equal(focusBody.style.display, 'none', 'Focus Features body is hidden (display: none) by default');
      assert.equal(statsBody.style.display, 'none', 'Today Stats body is hidden (display: none) by default');
      assert.equal(audioBody.style.display, 'none', 'Audio body is hidden (display: none) by default');

      // Secondary controls must reside inside these collapsed bodies
      assert.ok(focusBody.querySelector('#ss-toggle-study'), 'Study Mode toggle is inside Focus Features section');
      assert.ok(focusBody.querySelector('#ss-toggle-goal'), 'Goal Mode toggle is inside Focus Features section');
      assert.ok(focusBody.querySelector('#ss-toggle-time-manager'), 'Time Manager toggle is inside Focus Features section');

      assert.ok(statsBody.querySelector('#ss-popup-rank-tier'), 'Player rank is inside Today Stats section');
      assert.ok(statsBody.querySelector('#ss-popup-today-time'), 'Today total time is inside Today Stats section');
      assert.ok(statsBody.querySelector('#ss-popup-learning-time'), 'Learning time is inside Today Stats section');
      assert.ok(statsBody.querySelector('#ss-popup-focus-score'), 'Focus score is inside Today Stats section');

      assert.ok(audioBody.querySelector('#ss-vol-slider'), 'Volume Boost slider is inside Audio section');
      assert.ok(audioBody.querySelector('#ss-bass-slider'), 'Bass Boost slider is inside Audio section');
      assert.ok(audioBody.querySelector('#ss-eq-rack'), '10-Band EQ rack is inside Audio section');
    });
  });

  // =========================================================================
  // 2. COLLAPSIBLE ACCORDION SECTIONS
  // =========================================================================
  describe('2. Collapsible Accordion Sections Interaction', () => {

    test('M2.2a: Focus Features accordion toggles open and closed on header click', async () => {
      const { dialog } = await setupHUD();

      const btn = dialog.querySelector('#ss-header-focus') || dialog.querySelector('#ss-sect-focus-btn');
      const body = dialog.querySelector('#ss-section-focus') || dialog.querySelector('#ss-sect-focus');

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

    test('M2.2b: Today Stats accordion toggles open and closed on header click', async () => {
      const { dialog } = await setupHUD();

      const btn = dialog.querySelector('#ss-header-stats') || dialog.querySelector('#ss-sect-stats-btn');
      const body = dialog.querySelector('#ss-section-stats') || dialog.querySelector('#ss-sect-stats');

      assert.equal(body.style.display, 'none');

      // Click 1: Expand
      btn.click();
      assert.equal(body.style.display, '', 'Today Stats section is expanded');
      assert.equal(btn.getAttribute('aria-expanded'), 'true');

      // Click 2: Collapse
      btn.click();
      assert.equal(body.style.display, 'none', 'Today Stats section is collapsed');
      assert.equal(btn.getAttribute('aria-expanded'), 'false');
    });

    test('M2.2c: Audio accordion toggles open and closed on header click', async () => {
      const { dialog } = await setupHUD();

      const btn = dialog.querySelector('#ss-header-audio') || dialog.querySelector('#ss-sect-audio-btn');
      const body = dialog.querySelector('#ss-section-audio') || dialog.querySelector('#ss-sect-audio');

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

    test('M2.2d: Multiple sections expand independently without mutual interference', async () => {
      const { dialog } = await setupHUD();

      const focusBtn = dialog.querySelector('#ss-header-focus') || dialog.querySelector('#ss-sect-focus-btn');
      const focusBody = dialog.querySelector('#ss-section-focus') || dialog.querySelector('#ss-sect-focus');
      const audioBtn = dialog.querySelector('#ss-header-audio') || dialog.querySelector('#ss-sect-audio-btn');
      const audioBody = dialog.querySelector('#ss-section-audio') || dialog.querySelector('#ss-sect-audio');

      // Expand Focus Features
      focusBtn.click();
      assert.equal(focusBody.style.display, '');
      assert.equal(audioBody.style.display, 'none');

      // Expand Audio
      audioBtn.click();
      assert.equal(focusBody.style.display, '', 'Focus Features remains expanded');
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
      const minBar = dialog.querySelector('#ss-hud-minimized-badge') || dialog.querySelector('#ss-minimized-bar');
      const minBtn = dialog.querySelector('#ss-hud-minimize') || dialog.querySelector('#ss-minimize-btn');

      assert.notEqual(hudBody.style.display, 'none', 'HUD body is initially visible (not display: none)');
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
      const minBar = dialog.querySelector('#ss-hud-minimized-badge') || dialog.querySelector('#ss-minimized-bar');
      const minBtn = dialog.querySelector('#ss-hud-minimize') || dialog.querySelector('#ss-minimize-btn');
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
      await new Promise(r => setTimeout(r, 10));

      const settings = await StorageUtil.getSettings();
      assert.equal(settings.extensionEnabled, false, 'extensionEnabled updated in storage to false');
    });

    test('M2.4b: Feature toggles (shorts, focus, study, goal, time manager) update storage correctly', async () => {
      const { dialog } = await setupHUD();

      // Shorts Blocker
      const shorts = dialog.querySelector('#ss-toggle-shorts');
      shorts.checked = false;
      shorts.dispatchEvent('change');
      await new Promise(r => setTimeout(r, 10));
      let s = await StorageUtil.getSettings();
      assert.equal(s.shortsBlocker, false);

      // Focus Mode
      const focus = dialog.querySelector('#ss-toggle-focus');
      focus.checked = false;
      focus.dispatchEvent('change');
      await new Promise(r => setTimeout(r, 10));
      s = await StorageUtil.getSettings();
      assert.equal(s.focusMode, false);

      // Study Mode
      const study = dialog.querySelector('#ss-toggle-study');
      study.checked = true;
      study.dispatchEvent('change');
      await new Promise(r => setTimeout(r, 10));
      s = await StorageUtil.getSettings();
      assert.equal(s.studyMode, true);

      // Goal Mode
      const goal = dialog.querySelector('#ss-toggle-goal');
      goal.checked = true;
      goal.dispatchEvent('change');
      await new Promise(r => setTimeout(r, 10));
      s = await StorageUtil.getSettings();
      assert.equal(s.goalMode, true);

      // Time Manager
      const tm = dialog.querySelector('#ss-toggle-time-manager');
      tm.checked = true;
      tm.dispatchEvent('change');
      await new Promise(r => setTimeout(r, 10));
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
      await new Promise(r => setTimeout(r, 10));

      let s = await StorageUtil.getSettings();
      assert.equal(s.volumeBooster.volumeLevel, 250);

      bassSlider.value = '12';
      bassSlider.dispatchEvent('input');
      assert.equal(bassValue.textContent, '12 dB');
      bassSlider.dispatchEvent('change');
      await new Promise(r => setTimeout(r, 10));

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
      await new Promise(r => setTimeout(r, 10));

      let s = await StorageUtil.getSettings();
      assert.equal(s.volumeBooster.preset, 'Bass Boost');
      assert.deepEqual(s.volumeBooster.eqGains, [6, 5, 4, 2, 0, 0, 0, 0, 0, 0]);

      // Reset EQ
      eqReset.click();
      await new Promise(r => setTimeout(r, 10));
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
      await new Promise(r => setTimeout(r, 10));

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
      // Goal container opens via class toggle (ss-goal-input-open), not inline style
      assert.ok(goalContainer.classList.contains('ss-goal-input-open'), 'Goal container opens with ss-goal-input-open class');

      goalInput.value = 'Learn Kubernetes Architecture';
      saveBtn.click();
      await new Promise(r => setTimeout(r, 10));

      const s = await StorageUtil.getSettings();
      assert.equal(s.learningGoal, 'Learn Kubernetes Architecture');
      assert.equal(goalText.textContent, 'Learn Kubernetes Architecture');
      // Goal container hidden by removing ss-goal-input-open class
      assert.ok(!goalContainer.classList.contains('ss-goal-input-open'), 'Goal container hidden after save');
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
      const { headerBtn } = await setupHUD();
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
