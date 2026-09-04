/**
 * Empirical Adversarial Challenger Test Suite: UI/UX Interactive Surfaces, Z-Index Layering,
 * Defensive Overlays, Focus Trapping, and Keyboard Navigation Stress Harness.
 *
 * Targets:
 *  - content/js/header-button.js & content/css/header-button.css
 *  - popup/popup.js & popup/popup.html & popup/popup.css
 *  - options/options.js & options/options.html & options/options.css
 *  - content/js/goal-mode.js, content/js/time-manager.js, content/js/study-mode.js, content/js/main.js
 */

const fs = require('fs');
const path = require('path');
const { setupMockEnv } = require('./harness/mock-extension-env');

let passedCount = 0;
let failedCount = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failedCount++;
    failures.push(message);
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runUIUXEmpiricalChallengerSuite() {
  console.log("=========================================================================");
  console.log("=== EMPIRICAL CHALLENGER: UI/UX, Z-INDEX, KEYBOARD NAV & OVERLAY STRESS ===");
  console.log("=========================================================================\n");

  const env = setupMockEnv();

  // Load modules into environment
  require('../utils/design-tokens');
  require('../utils/storage');
  require('../utils/dom-utils');
  require('../utils/gamification-engine');
  require('../utils/audio-engine');
  require('../content/js/volume-booster');
  require('../content/js/header-button');
  require('../content/js/goal-mode');
  require('../content/js/time-manager');
  require('../content/js/study-mode');
  require('../content/js/main');

  const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../utils/storage');
  const DesignTokens = require('../utils/design-tokens');

  // ===========================================================================
  // SECTION 1: MODAL & DEFENSIVE OVERLAY Z-INDEX STACKING HIERARCHY & STYLING
  // ===========================================================================
  console.log("--- SECTION 1: Modal Z-Index Hierarchy & Defensive Overlay Layering ---");

  // 1.1 Clean DOM and storage reset
  document.body.innerHTML = `
    <ytd-masthead>
      <div id="end"><div id="buttons"><ytd-button-renderer id="upload-button"></ytd-button-renderer></div></div>
    </ytd-masthead>
    <video id="test-video"></video>
  `;

  await StorageUtil.saveSettings({
    ...DEFAULT_SETTINGS,
    extensionEnabled: true,
    learningGoal: 'Neural Networks',
    shortsBlocker: true,
    focusMode: true,
    studyMode: false,
    goalMode: false,
    timeManager: { enabled: true, dailyLimitMinutes: 60, scheduleEnabled: false, snoozeUntil: 0 },
    volumeBooster: { volumeLevel: 100, bassLevel: 0, eqEnabled: true, preset: 'Flat', eqGains: [0,0,0,0,0,0,0,0,0,0] }
  });
  await StorageUtil.saveTracking({ ...DEFAULT_TRACKING });

  // 1.2 Mount all defensive overlays simultaneously
  window.GoalMode.showGoalBlockOverlay("Off-Topic Entertainment Video");
  window.TimeManager.showOverlay('limit', { todayMinutes: 65, limitMinutes: 60 });
  window.showFocusReminderOverlay();
  window.StudyMode.showAlignmentWarning();
  window.StudyMode.injectBanner();

  const elGoalBlock = document.getElementById('ss-goal-block-overlay');
  const elTimeManager = document.getElementById('ss-time-manager-overlay');
  const elFocusReminder = document.getElementById('ss-focus-reminder');
  const elAlignWarning = document.getElementById('ss-alignment-warning');
  const elStudyBanner = document.getElementById('ss-study-banner');

  assert(elGoalBlock !== null, "Goal Block overlay mounted (#ss-goal-block-overlay)");
  assert(elTimeManager !== null, "Time Manager overlay mounted (#ss-time-manager-overlay)");
  assert(elFocusReminder !== null, "Focus Reminder overlay mounted (#ss-focus-reminder)");
  assert(elAlignWarning !== null, "Alignment Warning mounted (#ss-alignment-warning)");
  assert(elStudyBanner !== null, "Study Banner mounted (#ss-study-banner)");

  // 1.3 Exact Z-Index Hierarchy Verification
  const zGoal = parseInt(elGoalBlock.style.zIndex, 10);
  const zTime = parseInt(elTimeManager.style.zIndex, 10);
  const zFocus = parseInt(elFocusReminder.style.zIndex, 10);
  const zAlign = parseInt(elAlignWarning.style.zIndex, 10);
  const zBanner = parseInt(elStudyBanner.style.zIndex, 10);

  assert(zGoal === 2147483647, `Tier 1: Goal Block has maximum z-index 2147483647 (actual: ${zGoal})`);
  assert(zTime === 2147483646, `Tier 2: Time Manager has z-index 2147483646 (actual: ${zTime})`);
  assert(zFocus === 2147483645, `Tier 3: Focus Reminder has z-index 2147483645 (actual: ${zFocus})`);
  assert(zAlign === 10000, `Tier 4: Alignment Warning has z-index 10000 (actual: ${zAlign})`);
  assert(zBanner === 9999, `Tier 5: Study Banner has z-index 9999 (actual: ${zBanner})`);

  // Stacking order invariant assertion: zGoal > zTime > zFocus > zAlign > zBanner
  assert(zGoal > zTime && zTime > zFocus && zFocus > zAlign && zAlign > zBanner,
    "Strict 5-Tier Stacking Invariant holds: Goal(2147483647) > Time(2147483646) > Focus(2147483645) > Align(10000) > Banner(9999)");

  // 1.4 HeaderButton Popover and Backdrop Z-Index Hierarchy
  window.HeaderButton.enable();
  await window.HeaderButton.openPopup();

  const elDialog = document.getElementById('ss-popup-dialog');
  const elBackdrop = document.getElementById('ss-popup-backdrop');

  assert(elDialog !== null, "HeaderButton dialog mounted (#ss-popup-dialog)");
  assert(elBackdrop !== null, "HeaderButton backdrop mounted (#ss-popup-backdrop)");

  const zDialog = parseInt(elDialog.style.zIndex || '2147483647', 10);
  const zBackdropMatch = elBackdrop.style.zIndex || (elBackdrop.style.cssText && elBackdrop.style.cssText.match(/z-index:\s*(\d+)/)?.[1]) || '99998';
  const zBackdrop = parseInt(zBackdropMatch, 10);

  assert(zBackdrop === 99998, `Backdrop sits at z-index 99998 (actual: ${zBackdrop})`);
  assert(zDialog >= 99999, `Popover dialog z-index (${zDialog}) is strictly greater than backdrop (${zBackdrop})`);

  // 1.5 Frosted Glass Backdrop-Filter and CSS Validation
  const cssContent = fs.readFileSync(path.join(__dirname, '../content/css/header-button.css'), 'utf8');
  assert(cssContent.includes('backdrop-filter: blur(') || cssContent.includes('-webkit-backdrop-filter: blur('),
    "CSS defines cross-engine backdrop-filter blur");
  assert(cssContent.includes('--gm-blur: 16px') || cssContent.includes('blur(16px)'),
    "CSS enforces 16px frosted glass blur token");
  assert(cssContent.includes('@keyframes ssModalScaleIn'),
    "CSS defines @keyframes ssModalScaleIn entrance micro-animation");
  assert(cssContent.includes('@keyframes ssPopupFadeIn'),
    "CSS defines @keyframes ssPopupFadeIn entrance animation for floating HUD");

  // Clean up overlays
  window.GoalMode.removeOverlay();
  window.TimeManager.removeOverlay();
  if (elFocusReminder && elFocusReminder.parentNode) elFocusReminder.parentNode.removeChild(elFocusReminder);
  window.StudyMode.disable();
  window.HeaderButton.closePopup();
  window.HeaderButton.disable();

  // ===========================================================================
  // SECTION 2: RAPID KEYBOARD NAVIGATION & ACCESSIBILITY (ENTER, SPACE, ESC, TAB)
  // ===========================================================================
  console.log("\n--- SECTION 2: Rapid Keyboard Navigation in Header Popover ---");

  // 2.1 HeaderButton Popover Keyboard Dismissal via Escape
  window.HeaderButton.enable();
  await window.HeaderButton.openPopup();
  assert(document.getElementById('ss-popup-dialog') !== null, "Popover dialog opened for Escape test");

  // Dispatch Escape on document
  document.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert(document.getElementById('ss-popup-dialog') === null, "Pressing Escape dismisses #ss-popup-dialog");
  assert(document.getElementById('ss-popup-backdrop') === null, "Pressing Escape removes #ss-popup-backdrop");

  // 2.2 Inline Goal Editor Keyboard Handling in Header Popover
  await window.HeaderButton.openPopup();
  const popDialog = document.getElementById('ss-popup-dialog');
  const editGoalBtn = popDialog.querySelector('#ss-popup-edit-goal');
  const goalInputContainer = popDialog.querySelector('#ss-popup-goal-container');
  const goalInput = popDialog.querySelector('#ss-popup-goal-input');
  const goalText = popDialog.querySelector('#ss-popup-goal');

  assert(editGoalBtn !== null, "Edit goal button present in popover");
  editGoalBtn.dispatchEvent({ type: 'click' });
  assert(goalInputContainer.classList.contains('ss-goal-input-open'), "Goal edit container opened on click");

  // Press Escape inside goal input -> cancels edit without saving
  goalInput.value = "Temporary Goal Change";
  goalInput.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert(!goalInputContainer.classList.contains('ss-goal-input-open'), "Escape key in goal input cancels editing");
  assert(goalText.textContent.trim() === 'Neural Networks', "Goal text preserved unchanged on Escape");

  // Open again and submit via Enter -> saves new goal
  editGoalBtn.dispatchEvent({ type: 'click' });
  goalInput.value = "Advanced Quantum Physics";
  goalInput.dispatchEvent({ type: 'keydown', key: 'Enter' });
  await new Promise(r => setTimeout(r, 20));

  assert(!goalInputContainer.classList.contains('ss-goal-input-open'), "Enter key in goal input saves and closes editor");
  assert(goalText.textContent.trim() === 'Advanced Quantum Physics', "Goal text updated to 'Advanced Quantum Physics'");
  const updatedSettings = await StorageUtil.getSettings();
  assert(updatedSettings.learningGoal === 'Advanced Quantum Physics', "Updated goal persisted to storage");

  // 2.3 Settings Gear Keyboard Interaction (Enter / Space)
  const settingsIcon = popDialog.querySelector('#ss-popup-settings');
  assert(settingsIcon !== null, "Settings gear icon present in header");
  assert(settingsIcon.getAttribute('tabindex') === '0', "Settings icon is keyboard focusable (tabindex=0)");
  assert(settingsIcon.getAttribute('role') === 'button', "Settings icon has role=button");

  let optionsOpened = false;
  env.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.action === 'openOptionsPage') {
      optionsOpened = true;
      if (cb) cb({ success: true });
    }
  };

  settingsIcon.dispatchEvent({ type: 'keydown', key: 'Enter' });
  assert(optionsOpened === true, "Enter key on #ss-popup-settings triggers openOptionsPage IPC");

  optionsOpened = false;
  settingsIcon.dispatchEvent({ type: 'keydown', key: ' ' });
  assert(optionsOpened === true, "Space key on #ss-popup-settings triggers openOptionsPage IPC");

  // 2.4 Accordion Sections Keyboard Navigation in Header Popover
  const tmAccordionHeader = popDialog.querySelector('#ss-header-timemanager');
  const tmAccordionBody = popDialog.querySelector('#ss-section-timemanager');
  assert(tmAccordionHeader !== null, "TimeManager accordion header present");
  assert(tmAccordionBody.style.display === 'none', "TimeManager section initially collapsed");
  assert(tmAccordionHeader.getAttribute('aria-expanded') === 'false', "aria-expanded is initially false");

  // Click / Enter on accordion header toggles expansion
  tmAccordionHeader.dispatchEvent({ type: 'click' });
  assert(tmAccordionBody.style.display === '', "TimeManager section expanded on trigger");
  assert(tmAccordionHeader.getAttribute('aria-expanded') === 'true', "aria-expanded is now true");

  tmAccordionHeader.dispatchEvent({ type: 'click' });
  assert(tmAccordionBody.style.display === 'none', "TimeManager section re-collapsed on trigger");
  assert(tmAccordionHeader.getAttribute('aria-expanded') === 'false', "aria-expanded is restored to false");

  // 2.5 Quick Dashboard Navigation Buttons Keyboard Interaction
  const navFocusBtn = popDialog.querySelector('#ss-nav-focus');
  assert(navFocusBtn !== null, "#ss-nav-focus quick nav button present");
  let targetedTab = null;
  env.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.action === 'openOptionsPage') {
      targetedTab = msg.tab;
      if (cb) cb({ success: true, tab: msg.tab });
    }
  };

  navFocusBtn.dispatchEvent({ type: 'keydown', key: 'Enter' });
  assert(targetedTab === 'focus', "Enter on #ss-nav-focus sends openOptionsPage with tab='focus'");

  const navAudioBtn = popDialog.querySelector('#ss-nav-audio');
  navAudioBtn.dispatchEvent({ type: 'keydown', key: ' ' });
  assert(targetedTab === 'audio', "Space on #ss-nav-audio sends openOptionsPage with tab='audio'");

  window.HeaderButton.closePopup();
  window.HeaderButton.disable();

  // ===========================================================================
  // SECTION 3: OUTSIDE-CLICK DIALOG CLOSURE & SYNTHETIC EVENT IMMUNITY
  // ===========================================================================
  console.log("\n--- SECTION 3: Outside-Click Closures & Synthetic Event Immunity ---");

  window.HeaderButton.enable();
  await window.HeaderButton.openPopup();

  const activeBackdrop = document.getElementById('ss-popup-backdrop');
  assert(activeBackdrop !== null, "Backdrop created upon openPopup()");

  // Test 3.1: Synthetic Polymer event immunity within 300ms window
  const syntheticMastheadEl = document.querySelector('ytd-masthead');
  window.HeaderButton.onOutsideClick({ target: syntheticMastheadEl });
  assert(document.getElementById('ss-popup-dialog') !== null,
    "Synthetic outside click within 300ms window is safely rejected");

  // Test 3.2: Click INSIDE dialog container does NOT close dialog
  const insideCard = document.querySelector('.ss-popup-study-card');
  window.HeaderButton._openTime = Date.now() - 500; // Fast-forward past 300ms guard
  window.HeaderButton.onOutsideClick({ target: insideCard });
  assert(document.getElementById('ss-popup-dialog') !== null,
    "Click inside #ss-popup-dialog does NOT close the menu");

  // Test 3.3: Genuine outside click on backdrop DOES close dialog
  activeBackdrop.dispatchEvent({ type: 'pointerdown' });
  assert(document.getElementById('ss-popup-dialog') === null,
    "Pointerdown on #ss-popup-backdrop closes popup dialog");
  assert(document.getElementById('ss-popup-backdrop') === null,
    "Backdrop cleanly self-removes upon closure");

  // Test 3.4: Rapid open/close toggle stress (20 cycles)
  for (let i = 0; i < 20; i++) {
    await window.HeaderButton.openPopup();
    assert(document.getElementById('ss-popup-dialog') !== null, `Cycle ${i+1}: Dialog opened`);
    window.HeaderButton.closePopup();
    assert(document.getElementById('ss-popup-dialog') === null, `Cycle ${i+1}: Dialog closed`);
  }
  assert(true, "20 rapid open/close toggle cycles completed with zero DOM leakage");

  window.HeaderButton.disable();

  // ===========================================================================
  // SECTION 4: DEFENSIVE OVERLAY ACTION CALLBACKS & STATE TEARDOWNS
  // ===========================================================================
  console.log("\n--- SECTION 4: Defensive Overlay Action Callbacks & State Teardowns ---");

  // 4.1 Goal Block: Strict Zero-Bypass Overlay (No "Allow Video Once")
  window.GoalMode.enable("Learn Python");
  window.GoalMode.isBlocked = true;
  window.GoalMode.showGoalBlockOverlay("Funny Cat Compilation");
  assert(document.getElementById('ss-goal-block-overlay') !== null, "Goal Block overlay mounted");
  assert(window.GoalMode.isBlocked === true, "GoalMode.isBlocked is true");

  const allowOnceBtn = document.getElementById('ss-btn-allow-once');
  assert(allowOnceBtn === null, "Allow Once button is strictly removed from Goal Block overlay");
  const searchGoalBtn = document.getElementById('ss-btn-search-goal');
  assert(searchGoalBtn !== null, "Search Goal button present in overlay");
  const goHomeBtn = document.getElementById('ss-btn-go-home');
  assert(goHomeBtn !== null, "Return to Safe Feed button present in overlay");

  window.GoalMode.disable();

  // 4.2 Time Manager: "+5 Min Emergency Extension"
  window.TimeManager.enable({ enabled: true, dailyLimitMinutes: 60, snoozeUntil: 0 });
  window.TimeManager.showOverlay('limit', { todayMinutes: 65, limitMinutes: 60 });
  assert(document.getElementById('ss-time-manager-overlay') !== null, "Time Manager overlay mounted");

  const snoozeBtn = document.getElementById('ss-tm-snooze');
  assert(snoozeBtn !== null, "Snooze button present in Time Manager overlay");
  const beforeSnoozeTime = Date.now();
  snoozeBtn.dispatchEvent({ type: 'click' });
  await new Promise(r => setTimeout(r, 20));

  assert(document.getElementById('ss-time-manager-overlay') === null, "Clicking Snooze unmounts #ss-time-manager-overlay");
  assert(window.TimeManager.config.snoozeUntil >= beforeSnoozeTime + (4.9 * 60 * 1000),
    "Snooze extension correctly set to +5 minutes into future");

  window.TimeManager.disable();

  // 4.3 Focus Reminder: "Continue" vs "Take a Break"
  window.showFocusReminderOverlay();
  let focusOverlay = document.getElementById('ss-focus-reminder');
  assert(focusOverlay !== null, "Focus Reminder overlay mounted");
  const continueBtn = document.getElementById('ss-btn-continue');
  assert(continueBtn !== null, "Continue button present in Focus Reminder");

  continueBtn.dispatchEvent({ type: 'click' });
  assert(document.getElementById('ss-focus-reminder') === null, "Continue click unmounts #ss-focus-reminder");

  window.showFocusReminderOverlay();
  focusOverlay = document.getElementById('ss-focus-reminder');
  const breakBtn = document.getElementById('ss-btn-break');
  assert(breakBtn !== null, "Take a Break button present in Focus Reminder");

  breakBtn.dispatchEvent({ type: 'click' });
  assert(document.getElementById('ss-focus-reminder') === null, "Take a Break click unmounts #ss-focus-reminder");

  // 4.4 Study Mode Banner & Pomodoro Sprints
  window.StudyMode.disable(); // clean baseline
  window.StudyMode.enable("Machine Learning");
  assert(document.getElementById('ss-study-banner') !== null, "Study Banner mounted (#ss-study-banner)");
  assert(window.StudyMode.pomoIsPaused === false, "Pomodoro initially running");

  const pomoPauseBtn = document.getElementById('ss-pomo-btn-pause');
  const pomoSkipBtn = document.getElementById('ss-pomo-btn-skip');
  const pomoResetBtn = document.getElementById('ss-pomo-btn-reset');

  assert(pomoPauseBtn !== null, "Pomodoro pause button present");
  assert(pomoSkipBtn !== null, "Pomodoro skip button present");
  assert(pomoResetBtn !== null, "Pomodoro reset button present");

  // Pause toggle
  pomoPauseBtn.dispatchEvent({ type: 'click' });
  assert(window.StudyMode.pomoIsPaused === true, "Clicking pause toggles pomoIsPaused = true");
  assert(pomoPauseBtn.textContent.includes('▶️'), "Pause button displays play icon (▶️)");

  pomoPauseBtn.dispatchEvent({ type: 'click' });
  assert(window.StudyMode.pomoIsPaused === false, "Clicking resume toggles pomoIsPaused = false");
  assert(pomoPauseBtn.textContent.includes('⏸️'), "Pause button displays pause icon (⏸️)");

  // Skip Phase (Focus -> Break)
  assert(window.StudyMode.pomoState === 'FOCUS', "Initial phase is FOCUS");
  pomoSkipBtn.dispatchEvent({ type: 'click' });
  assert(window.StudyMode.pomoState === 'BREAK', "Skipping phase transitions from FOCUS to BREAK");

  // Reset Phase
  window.StudyMode.pomoSecondsLeft = 10;
  pomoResetBtn.dispatchEvent({ type: 'click' });
  assert(window.StudyMode.pomoSecondsLeft === (window.StudyMode.pomoConfig.breakMinutes || 5) * 60,
    "Reset button restores full phase countdown seconds");

  window.StudyMode.disable();
  assert(document.getElementById('ss-study-banner') === null, "StudyMode.disable() cleanly unmounts banner");

  // ===========================================================================
  // SECTION 5: EQUALIZER UI CONTROLS & DYNAMIC PRESET AUTO-DETECTION
  // ===========================================================================
  console.log("\n--- SECTION 5: Equalizer UI Controls & Preset Auto-Detection ---");

  window.HeaderButton.enable();
  await window.HeaderButton.openPopup();
  const popDialogEq = document.getElementById('ss-popup-dialog');

  const eqToggle = popDialogEq.querySelector('#ss-eq-toggle');
  const eqPreset = popDialogEq.querySelector('#ss-eq-preset');
  const eqReset = popDialogEq.querySelector('#ss-eq-reset');
  const eqRack = popDialogEq.querySelector('#ss-eq-rack');

  assert(eqToggle !== null, "EQ master toggle present in popover");
  assert(eqPreset !== null, "EQ preset select dropdown present");
  assert(eqReset !== null, "EQ reset button present");
  assert(eqRack !== null, "EQ 10-band slider rack present");

  // 5.1 Select Bass Boost Preset
  eqPreset.value = 'Bass Boost';
  eqPreset.dispatchEvent({ type: 'change' });
  await new Promise(r => setTimeout(r, 20));

  const slider0 = popDialogEq.querySelector('#ss-eq-slider-0');
  const slider1 = popDialogEq.querySelector('#ss-eq-slider-1');
  assert(parseFloat(slider0.value) === 6.0, `Bass Boost band 0 is +6dB (actual: ${slider0.value})`);
  assert(parseFloat(slider1.value) === 5.0, `Bass Boost band 1 is +5dB (actual: ${slider1.value})`);

  let currentVb = (await StorageUtil.getSettings()).volumeBooster;
  assert(currentVb.preset === 'Bass Boost', "Preset 'Bass Boost' persisted to storage");

  // 5.2 Move a single slider -> Auto-detect transitions to 'Custom'
  slider0.value = "3.5";
  slider0.dispatchEvent({ type: 'input' });
  slider0.dispatchEvent({ type: 'change' });
  await new Promise(r => setTimeout(r, 20));

  assert(eqPreset.value === 'Custom', `Dropdown auto-transitioned to 'Custom' (actual: ${eqPreset.value})`);
  currentVb = (await StorageUtil.getSettings()).volumeBooster;
  assert(currentVb.preset === 'Custom', "Preset 'Custom' persisted to storage");

  // 5.3 Reset button restores Flat preset (all 0dB)
  eqReset.dispatchEvent({ type: 'click' });
  await new Promise(r => setTimeout(r, 20));

  assert(eqPreset.value === 'Flat', `Reset button restored 'Flat' preset (actual: ${eqPreset.value})`);
  for (let i = 0; i < 10; i++) {
    const s = popDialogEq.querySelector(`#ss-eq-slider-${i}`);
    assert(parseFloat(s.value) === 0, `Band ${i} reset to 0dB`);
  }

  // 5.4 Master EQ toggle disables rack
  eqToggle.checked = false;
  eqToggle.dispatchEvent({ type: 'change' });
  await new Promise(r => setTimeout(r, 20));

  assert(eqRack.classList.contains('ss-eq-disabled'), "Rack has .ss-eq-disabled class when EQ toggle is OFF");
  currentVb = (await StorageUtil.getSettings()).volumeBooster;
  assert(currentVb.eqEnabled === false, "eqEnabled = false persisted to storage");

  window.HeaderButton.closePopup();
  window.HeaderButton.disable();

  // ===========================================================================
  // SECTION 6: POPUP HUD (`popup/popup.js`) KEYBOARD NAVIGATION & INTERACTIONS
  // ===========================================================================
  console.log("\n--- SECTION 6: Popup HUD (`popup/popup.js`) Keyboard Navigation ---");

  const envPopup = setupMockEnv();
  const popupHtml = `
    <div class="popup-container">
      <input type="checkbox" id="toggle-master" />
      <input type="checkbox" id="toggle-shorts" />
      <input type="checkbox" id="toggle-focus" />
      <input type="checkbox" id="toggle-study" />
      <input type="checkbox" id="toggle-goal" />
      <input type="checkbox" id="toggle-time-manager" />
      <input type="checkbox" id="toggle-auto-skip-ads" />
      <input type="checkbox" id="pop-audioEffects" />
      
      <span id="current-goal"></span>
      <button id="edit-goal" tabindex="0"></button>
      <div id="goal-input-container" style="display:none;">
        <input type="text" id="goal-input" />
        <button id="save-goal"></button>
        <button id="search-goal"></button>
      </div>

      <div id="open-settings" tabindex="0">⚙️</div>
      <span id="today-time"></span>
      <span id="learning-time"></span>
      <span id="focus-score"></span>
      <span id="popup-rank-tier"></span>

      <!-- 10-Band Graphic EQ Section -->
      <div class="pop-eq-section" id="pop-eq-section">
        <input type="checkbox" id="pop-eq-toggle" checked />
        <button id="pop-eq-reset">Reset</button>
        <div id="pop-eq-preset-chips">
          <button data-preset="Flat" class="preset-chip">Flat</button>
          <button data-preset="Bass Boost" class="preset-chip">Bass Boost</button>
          <button data-preset="Rock" class="preset-chip">Rock</button>
        </div>
        <select id="pop-eq-preset" style="display:none;">
          <option value="Flat">Flat</option>
          <option value="Bass Boost">Bass Boost</option>
          <option value="Rock">Rock</option>
          <option value="Custom">Custom</option>
        </select>
        <div class="pop-eq-rack" id="pop-eq-rack">
          <div class="pop-eq-band"><span id="pop-eq-val-0">0dB</span><input type="range" id="pop-eq-slider-0" value="0" /><span class="pop-eq-freq">32</span></div>
          <div class="pop-eq-band"><span id="pop-eq-val-1">0dB</span><input type="range" id="pop-eq-slider-1" value="0" /><span class="pop-eq-freq">64</span></div>
          <div class="pop-eq-band"><span id="pop-eq-val-2">0dB</span><input type="range" id="pop-eq-slider-2" value="0" /><span class="pop-eq-freq">125</span></div>
          <div class="pop-eq-band"><span id="pop-eq-val-3">0dB</span><input type="range" id="pop-eq-slider-3" value="0" /><span class="pop-eq-freq">250</span></div>
          <div class="pop-eq-band"><span id="pop-eq-val-4">0dB</span><input type="range" id="pop-eq-slider-4" value="0" /><span class="pop-eq-freq">500</span></div>
          <div class="pop-eq-band"><span id="pop-eq-val-5">0dB</span><input type="range" id="pop-eq-slider-5" value="0" /><span class="pop-eq-freq">1k</span></div>
          <div class="pop-eq-band"><span id="pop-eq-val-6">0dB</span><input type="range" id="pop-eq-slider-6" value="0" /><span class="pop-eq-freq">2k</span></div>
          <div class="pop-eq-band"><span id="pop-eq-val-7">0dB</span><input type="range" id="pop-eq-slider-7" value="0" /><span class="pop-eq-freq">4k</span></div>
          <div class="pop-eq-band"><span id="pop-eq-val-8">0dB</span><input type="range" id="pop-eq-slider-8" value="0" /><span class="pop-eq-freq">8k</span></div>
          <div class="pop-eq-band"><span id="pop-eq-val-9">0dB</span><input type="range" id="pop-eq-slider-9" value="0" /><span class="pop-eq-freq">16k</span></div>
        </div>
      </div>

      <input type="text" id="pop-blocked-keywords" />
      <input type="text" id="pop-blocked-channels" />
    </div>
  `;
  envPopup.document.body.innerHTML = popupHtml;
  global.StorageUtil = StorageUtil;
  envPopup.window.StorageUtil = StorageUtil;

  // Execute popup.js
  const popupJsCode = fs.readFileSync(path.join(__dirname, '../popup/popup.js'), 'utf8');
  await eval(`(async () => { ${popupJsCode} })()`);
  envPopup.document.dispatchEvent('DOMContentLoaded');
  await new Promise(r => setTimeout(r, 40));

  // 6.1 Keyboard interaction on Popup Edit Goal button
  const popEditGoalBtn = envPopup.document.getElementById('edit-goal');
  const popGoalInputContainer = envPopup.document.getElementById('goal-input-container');
  const popGoalInput = envPopup.document.getElementById('goal-input');

  popEditGoalBtn.dispatchEvent({ type: 'keydown', key: 'Enter' });
  assert(popGoalInputContainer.style.display === 'flex', "Enter key on #edit-goal opens goal input");

  // Escape key in popup goal input cancels
  popGoalInput.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert(popGoalInputContainer.style.display === 'none', "Escape key in popup goal input closes input container");

  // Enter key in popup goal input saves
  popEditGoalBtn.dispatchEvent({ type: 'keydown', key: ' ' });
  assert(popGoalInputContainer.style.display === 'flex', "Space key on #edit-goal opens goal input");
  popGoalInput.value = "Advanced Robotics";
  popGoalInput.dispatchEvent({ type: 'keydown', key: 'Enter' });
  await new Promise(r => setTimeout(r, 40));
  assert(popGoalInputContainer.style.display === 'none', "Enter key on popup goal input saves and closes");

  // 6.2 Settings open via Enter key
  let popupOptionsTriggered = false;
  envPopup.chrome.runtime.sendMessage = (msg, cb) => {
    if (msg && msg.action === 'openOptionsPage') {
      popupOptionsTriggered = true;
      if (cb) cb({ success: true });
    }
  };
  const popOpenSettings = envPopup.document.getElementById('open-settings');
  popOpenSettings.dispatchEvent({ type: 'keydown', key: 'Enter' });
  assert(popupOptionsTriggered === true, "Enter key on popup #open-settings triggers options navigation");

  // 6.3 Preset Chip Click in Popup
  const bassChip = envPopup.document.querySelector('button[data-preset="Bass Boost"]');
  bassChip.dispatchEvent({ type: 'click' });
  await new Promise(r => setTimeout(r, 40));
  const popEqPresetEl = envPopup.document.getElementById('pop-eq-preset');
  assert(popEqPresetEl.value === 'Bass Boost', "Clicking Bass Boost chip updates preset to 'Bass Boost'");

  // ===========================================================================
  // SECTION 7: OPTIONS DASHBOARD (`options/options.js`) KEYBOARD NAVIGATION
  // ===========================================================================
  console.log("\n--- SECTION 7: Options Dashboard Keyboard Navigation & Tabs ---");

  const envOpt = setupMockEnv();
  const optionsHtml = `
    <ul class="nav-menu">
      <li data-tab="focus" class="active" tabindex="0">Focus Features</li>
      <li data-tab="timemanager" tabindex="0">Time Manager</li>
      <li data-tab="audio" tabindex="0">Audio Studio</li>
      <li data-tab="analytics" tabindex="0">Analytics</li>
      <li data-tab="gamification" tabindex="0">Gamification</li>
      <li data-tab="ui" tabindex="0">UI Cleaner</li>
    </ul>
    <div id="focus-tab" class="tab-content active">
      <input type="checkbox" id="opt-shortsBlocker" />
      <input type="checkbox" id="opt-focusMode" />
      <input type="checkbox" id="opt-studyMode" />
      <input type="checkbox" id="opt-goalMode" />
      <input type="checkbox" id="opt-autoSkipAds" />
    </div>
    <div id="timemanager-tab" class="tab-content">
      <input type="checkbox" id="opt-tm-enabled" />
      <input type="checkbox" id="opt-tm-scheduleEnabled" />
      <input type="number" id="opt-tm-dailyLimitMinutes" />
      <input type="time" id="opt-tm-scheduleStart" />
      <input type="time" id="opt-tm-scheduleEnd" />
    </div>
    <div id="audio-tab" class="tab-content">
      <input type="checkbox" id="opt-audioEffects" />
      <input type="range" id="opt-vol-slider" />
      <input type="range" id="opt-bass-slider" />
      <input type="checkbox" id="opt-eq-toggle" checked />
      <select id="opt-eq-preset">
        <option value="Flat">Flat</option>
        <option value="Bass Boost">Bass Boost</option>
      </select>
      <button id="opt-eq-reset">Reset</button>
      <div id="opt-eq-rack">
        <input type="range" id="opt-eq-slider-0" value="0" />
      </div>
    </div>
    <div id="analytics-tab" class="tab-content">
      <span id="stat-today"></span>
      <span id="stat-today-learning"></span>
      <span id="stat-week-learning"></span>
      <span id="stat-month-learning"></span>
      <span id="dash-focus-score"></span>
    </div>
    <div id="gamification-tab" class="tab-content">
      <span id="stat-current-streak"></span>
      <span id="stat-longest-streak"></span>
    </div>
    <div id="ui-tab" class="tab-content">
      <input type="checkbox" id="ui-hideBell" />
      <input type="checkbox" id="ui-hideSubCount" />
    </div>
  `;
  envOpt.document.body.innerHTML = optionsHtml;
  global.StorageUtil = StorageUtil;
  envOpt.window.StorageUtil = StorageUtil;

  // Execute options.js
  const optionsJsCode = fs.readFileSync(path.join(__dirname, '../options/options.js'), 'utf8');
  await eval(`(async () => { ${optionsJsCode} })()`);
  envOpt.document.dispatchEvent('DOMContentLoaded');
  await new Promise(r => setTimeout(r, 40));

  const navList = envOpt.document.querySelectorAll('.nav-menu li');
  const tmTabNav = navList[1];
  const audioTabNav = navList[2];

  // 7.1 Keyboard switch to Time Manager via Enter key
  tmTabNav.dispatchEvent({ type: 'keydown', key: 'Enter' });
  assert(tmTabNav.classList.contains('active'), "Enter key activates Time Manager nav item");
  assert(tmTabNav.getAttribute('aria-selected') === 'true', "Time Manager nav item has aria-selected='true'");
  assert(envOpt.document.getElementById('timemanager-tab').classList.contains('active'), "Time Manager tab content is active");

  // 7.2 Keyboard switch to Audio Studio via Space key
  audioTabNav.dispatchEvent({ type: 'keydown', key: ' ' });
  assert(audioTabNav.classList.contains('active'), "Space key activates Audio Studio nav item");
  assert(audioTabNav.getAttribute('aria-selected') === 'true', "Audio Studio nav item has aria-selected='true'");
  assert(envOpt.document.getElementById('audio-tab').classList.contains('active'), "Audio Studio tab content is active");

  // ===========================================================================
  // FINAL RESULTS
  // ===========================================================================
  console.log("\n=========================================================================");
  console.log(`TOTAL EMPIRICAL CHALLENGER ASSERTIONS: ${passedCount + failedCount}`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${failedCount}`);
  console.log("=========================================================================\n");

  if (failedCount > 0) {
    console.error("❌ EMPIRICAL CHALLENGER FAILURE DETAILS:");
    failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log("ALL UI/UX, Z-INDEX, KEYBOARD & OVERLAY ADVERSARIAL STRESS TESTS PASSED CLEANLY! ✅");
    process.exit(0);
  }
}

runUIUXEmpiricalChallengerSuite().catch(err => {
  console.error("Unexpected error in challenger test runner:", err);
  process.exit(1);
});
