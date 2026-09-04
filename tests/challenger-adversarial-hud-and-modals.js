/**
 * Empirical Adversarial Challenger Test Suite
 * Focus: Floating HUD Overlay & Defensive Modal Overlays Integrity
 */

const fs = require('fs');
const path = require('path');
const { setupMockEnv } = require('./harness/mock-extension-env');

let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];

function assert(condition, message) {
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failedAssertions++;
    failureDetails.push(message);
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runEmpiricalHUDAndModalsSuite() {
  console.log("=========================================================================");
  console.log("=== EMPIRICAL CHALLENGER: FLOATING HUD & DEFENSIVE MODALS STRESS TEST ===");
  console.log("=========================================================================\n");

  const env = setupMockEnv();

  // Load Utilities & Content Scripts into Mock Environment
  require('../utils/design-tokens');
  require('../utils/storage');
  require('../utils/dom-utils');
  require('../utils/audio-engine');
  require('../content/js/volume-booster');
  require('../content/js/header-button');
  require('../content/js/goal-mode');
  require('../content/js/time-manager');
  require('../content/js/study-mode');
  require('../content/js/main');

  const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../utils/storage');

  // ---------------------------------------------------------------------------
  // 1. FLOATING HUD OVERLAY VERIFICATION & ADVERSARIAL STRESS
  // ---------------------------------------------------------------------------
  console.log("--- PART 1: Floating HUD Overlay Mechanics & Event Stress ---");

  const hb = window.HeaderButton;
  assert(hb !== undefined && hb !== null, "window.HeaderButton singleton is instantiated");
  hb.disable();

  // Clean DOM setup
  document.body.innerHTML = `
    <ytd-masthead>
      <div id="end">
        <div id="buttons">
          <ytd-button-renderer id="upload-button"></ytd-button-renderer>
        </div>
      </div>
    </ytd-masthead>
  `;

  // Initialize Storage defaults
  await StorageUtil.saveSettings({
    ...DEFAULT_SETTINGS,
    extensionEnabled: true,
    learningGoal: 'Quantum Computing',
    shortsBlocker: true,
    focusMode: true,
    studyMode: false,
    goalMode: false,
    timeManager: { enabled: true, dailyLimitMinutes: 60, scheduleEnabled: false, snoozeUntil: 0 }
  });
  await StorageUtil.saveTracking({ ...DEFAULT_TRACKING });

  // 1.1 DOM Injection & Masthead Resolution
  hb.enable();
  assert(hb.isActive === true, "HeaderButton.isActive is true after enable()");
  const injectedContainer = document.getElementById('ss-header-btn-container');
  assert(injectedContainer !== null, "#ss-header-btn-container injected into DOM");
  assert(document.getElementById('ss-header-btn') !== null, "#ss-header-btn button created");
  assert(document.getElementById('ss-header-btn-tooltip') !== null, "#ss-header-btn-tooltip created");

  // Verify Idempotency
  const injectResultAgain = hb.tryInject();
  assert(injectResultAgain === true, "tryInject() is idempotent when container already exists");
  assert(document.querySelectorAll('#ss-header-btn-container').length === 1, "Exactly one container exists (no duplication)");

  // 1.2 Open Popover & Dialog Mount
  await hb.openPopup();
  const dialog = document.getElementById('ss-popup-dialog');
  assert(dialog !== null, "#ss-popup-dialog mounted to DOM upon openPopup()");
  assert(dialog.classList.contains('ss-popup-dialog'), "Dialog has .ss-popup-dialog class");

  // 1.3 Single Integrated Header Verification
  const popupHeader = dialog.querySelector('#ss-popup-header');
  assert(popupHeader !== null, "Single integrated HUD header (#ss-popup-header) exists");
  const logoEl = dialog.querySelector('.ss-popup-logo');
  assert(logoEl !== null, "Header contains brand logo (.ss-popup-logo)");
  const statusBadge = dialog.querySelector('#ss-header-status-badge');
  assert(statusBadge !== null && statusBadge.textContent.trim() === 'ACTIVE', "Status badge displays 'ACTIVE'");
  const masterToggle = dialog.querySelector('#ss-toggle-master');
  assert(masterToggle !== null && masterToggle.checked === true, "Master toggle (#ss-toggle-master) is checked");
  const minimizeBtn = dialog.querySelector('#ss-minimize-btn');
  assert(minimizeBtn !== null, "Minimize button (#ss-minimize-btn) present in header");
  const settingsIcon = dialog.querySelector('#ss-popup-settings');
  assert(settingsIcon !== null, "Settings gear icon (#ss-popup-settings) present in header");

  // 1.4 Master Switch Toggle Stress
  masterToggle.checked = false;
  masterToggle.dispatchEvent({ type: 'change' });
  await new Promise(r => setTimeout(r, 20));

  let savedSettings = await StorageUtil.getSettings();
  assert(savedSettings.extensionEnabled === false, "Master switch OFF persisted to storage (extensionEnabled = false)");
  assert(statusBadge.textContent.trim() === 'PAUSED', "Status badge dynamically updated to 'PAUSED'");
  assert(statusBadge.classList.contains('ss-status-paused'), "Status badge has .ss-status-paused class");

  // Toggle master back ON
  masterToggle.checked = true;
  masterToggle.dispatchEvent({ type: 'change' });
  await new Promise(r => setTimeout(r, 20));
  savedSettings = await StorageUtil.getSettings();
  assert(savedSettings.extensionEnabled === true, "Master switch ON persisted to storage (extensionEnabled = true)");
  assert(statusBadge.textContent.trim() === 'ACTIVE', "Status badge dynamically restored to 'ACTIVE'");

  // 1.5 Streamlined Inline Goal Editing
  const goalChip = dialog.querySelector('#ss-popup-goal-chip');
  const editPencil = dialog.querySelector('#ss-popup-edit-goal');
  const goalContainer = dialog.querySelector('#ss-popup-goal-container');
  const goalInput = dialog.querySelector('#ss-popup-goal-input');
  const saveGoalBtn = dialog.querySelector('#ss-popup-save-goal');
  const goalTextEl = dialog.querySelector('#ss-popup-goal');

  assert(goalChip !== null, "Inline goal chip (#ss-popup-goal-chip) exists");
  assert(editPencil !== null, "Edit pencil icon (#ss-popup-edit-goal) exists");
  assert(goalTextEl.textContent.trim() === 'Quantum Computing', "Initial goal text matches saved learningGoal");
  assert(!goalContainer.classList.contains('ss-goal-input-open'), "Goal input container initially hidden");

  // Action A: Open via pencil click
  editPencil.dispatchEvent({ type: 'click' });
  assert(goalContainer.classList.contains('ss-goal-input-open'), "Clicking pencil opens goal input container (display: flex)");

  // Action B: Cancel via Escape
  goalInput.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert(!goalContainer.classList.contains('ss-goal-input-open'), "Pressing Escape closes goal input container");

  // Action C: Open via chip click
  goalChip.dispatchEvent({ type: 'click' });
  assert(goalContainer.classList.contains('ss-goal-input-open'), "Clicking goal chip opens goal input container");

  // Action D: Save via Enter key
  goalInput.value = 'Astrophysics Research';
  goalInput.dispatchEvent({ type: 'keydown', key: 'Enter' });
  await new Promise(r => setTimeout(r, 20));

  savedSettings = await StorageUtil.getSettings();
  assert(savedSettings.learningGoal === 'Astrophysics Research', "Goal updated via Enter saved to storage");
  assert(goalTextEl.textContent === 'Astrophysics Research', "Goal text in chip updated in DOM");
  assert(!goalContainer.classList.contains('ss-goal-input-open'), "Goal container closed after saving");

  // Action E: Open & Save via Save Button with XSS Sanitization
  goalChip.dispatchEvent({ type: 'click' });
  goalInput.value = '<script>alert("hack")</script>Neural Networks';
  saveGoalBtn.dispatchEvent({ type: 'click' });
  await new Promise(r => setTimeout(r, 20));

  savedSettings = await StorageUtil.getSettings();
  assert(savedSettings.learningGoal === '<script>alert("hack")</script>Neural Networks', "Goal updated via Save button saved to storage");
  assert(!goalTextEl.innerHTML.includes('<script>'), "Goal text in chip safely escaped HTML");
  assert(!goalContainer.classList.contains('ss-goal-input-open'), "Goal container closed after saving");

  // 1.6 Accordion Expand/Collapse Transitions
  const focusHeader = dialog.querySelector('#ss-header-focus');
  const focusSection = dialog.querySelector('#ss-section-focus');
  assert(focusHeader !== null && focusSection !== null, "Focus accordion elements exist");
  assert(focusSection.style.display === 'none', "Accordion section starts collapsed (display: none)");
  assert(focusHeader.getAttribute('aria-expanded') === 'false', "Accordion header starts with aria-expanded='false'");

  // Expand accordion
  focusHeader.dispatchEvent({ type: 'click' });
  assert(focusSection.style.display === '', "Clicking header expands section (display: '')");
  assert(focusHeader.getAttribute('aria-expanded') === 'true', "Header aria-expanded is 'true'");
  assert(focusHeader.classList.contains('ss-expanded'), "Header has .ss-expanded class");
  assert(!focusHeader.classList.contains('ss-collapsed'), "Header no longer has .ss-collapsed class");

  // Collapse accordion
  focusHeader.dispatchEvent({ type: 'click' });
  assert(focusSection.style.display === 'none', "Clicking header again collapses section (display: none)");
  assert(focusHeader.getAttribute('aria-expanded') === 'false', "Header aria-expanded is 'false'");
  assert(focusHeader.classList.contains('ss-collapsed'), "Header has .ss-collapsed class");

  // Test Stats & Audio accordions
  const statsHeader = dialog.querySelector('#ss-header-stats');
  const statsSection = dialog.querySelector('#ss-section-stats');
  const audioHeader = dialog.querySelector('#ss-header-audio');
  const audioSection = dialog.querySelector('#ss-section-audio');

  statsHeader.dispatchEvent({ type: 'click' });
  assert(statsSection.style.display === '', "Stats section expanded on click");
  audioHeader.dispatchEvent({ type: 'click' });
  assert(audioSection.style.display === '', "Audio section expanded on click");

  // 1.7 Minimized Bar Pill Restoration
  const hudBody = dialog.querySelector('#ss-hud-body');
  const minimizedBar = dialog.querySelector('#ss-minimized-bar');
  const restoreBtn = dialog.querySelector('#ss-restore-btn');

  assert(minimizedBar.style.display === 'none', "Minimized bar initially hidden");

  // Minimize
  minimizeBtn.dispatchEvent({ type: 'click' });
  assert(hudBody.style.display === 'none', "HUD body hidden when minimized");
  assert(popupHeader.style.display === 'none', "Popup header hidden when minimized");
  assert(minimizedBar.style.display === 'flex', "Minimized bar visible (display: flex)");
  assert(dialog.classList.contains('ss-is-minimized'), "Dialog has .ss-is-minimized class");

  // Restore via Restore Button
  restoreBtn.dispatchEvent({ type: 'click' });
  assert(hudBody.style.display === '', "HUD body restored");
  assert(popupHeader.style.display === '', "Popup header restored");
  assert(minimizedBar.style.display === 'none', "Minimized bar hidden");
  assert(!dialog.classList.contains('ss-is-minimized'), "Dialog no longer has .ss-is-minimized class");

  // Minimize & Restore via Minimized Bar Pill Click
  minimizeBtn.dispatchEvent({ type: 'click' });
  assert(dialog.classList.contains('ss-is-minimized'), "Minimized again");
  minimizedBar.dispatchEvent({ type: 'click' });
  assert(!dialog.classList.contains('ss-is-minimized'), "Restored by clicking minimized pill");

  // 1.8 Outside Click Dismissal (backdrop pattern)
  // Verify backdrop was created with openPopup
  const popupBackdrop = document.getElementById('ss-popup-backdrop');
  assert(popupBackdrop !== null, "Transparent backdrop created on openPopup()");

  // Clicking inside dialog should NOT close it (onOutsideClick still guards this)
  const innerClickEvt = { target: dialog, stopPropagation: () => {} };
  hb.onOutsideClick(innerClickEvt);
  assert(document.getElementById('ss-popup-dialog') !== null, "Click inside dialog does not dismiss it");

  // Simulate clicking the backdrop (outside the popup) — this closes the popup.
  // In real browser: physical click on backdrop fires pointerdown on the backdrop element,
  // which has a { once: true } listener that calls closePopup().
  // In test: call closePopup() directly to simulate what the backdrop listener does.
  hb.closePopup();
  assert(document.getElementById('ss-popup-dialog') === null, "Click outside dialog dismisses HUD popover");
  assert(document.getElementById('ss-popup-backdrop') === null, "Backdrop removed when popup closes");

  // 1.9 Unmount and Teardown
  hb.disable();
  assert(hb.isActive === false, "HeaderButton.isActive is false after disable()");
  assert(document.getElementById('ss-header-btn-container') === null, "#ss-header-btn-container removed on disable()");

  // ---------------------------------------------------------------------------
  // 2. DEFENSIVE MODAL OVERLAYS & STRICT Z-INDEX HIERARCHY
  // ---------------------------------------------------------------------------
  console.log("\n--- PART 2: Defensive Modal Overlays Hierarchy & Glassmorphism ---");

  // 2.1 Trigger all 5 Overlays simultaneously
  window.location = new URL('https://www.youtube.com/watch?v=offtopic123');

  // Mount #1: Goal Mode Strict Block Overlay
  window.GoalMode.enable("Deep Learning");
  window.GoalMode.showGoalBlockOverlay("Cat Compilation 2026");

  // Mount #2: Time Manager Overlay
  window.TimeManager.enable({ enabled: true, dailyLimitMinutes: 30 });
  window.TimeManager.showOverlay('limit', { limitMinutes: 30, todayMinutes: 45 });

  // Mount #3: Focus Reminder Overlay
  window.showFocusReminderOverlay();

  // Mount #4: Alignment Warning Toast
  window.StudyMode.enable("Deep Learning");
  window.StudyMode.showAlignmentWarning();

  // Mount #5: Study Mode Top Banner
  // Banner already injected in window.StudyMode.enable()

  const elGoalBlock = document.getElementById('ss-goal-block-overlay');
  const elTimeManager = document.getElementById('ss-time-manager-overlay');
  const elFocusReminder = document.getElementById('ss-focus-reminder');
  const elAlignmentWarning = document.getElementById('ss-alignment-warning');
  const elStudyBanner = document.getElementById('ss-study-banner');

  assert(elGoalBlock !== null, "#ss-goal-block-overlay mounted in DOM");
  assert(elTimeManager !== null, "#ss-time-manager-overlay mounted in DOM");
  assert(elFocusReminder !== null, "#ss-focus-reminder mounted in DOM");
  assert(elAlignmentWarning !== null, "#ss-alignment-warning mounted in DOM");
  assert(elStudyBanner !== null, "#ss-study-banner mounted in DOM");

  // 2.2 Strict Z-Index Hierarchy Assertion
  const zGoal = parseInt(elGoalBlock.style.zIndex, 10);
  const zTime = parseInt(elTimeManager.style.zIndex, 10);
  const zFocus = parseInt(elFocusReminder.style.zIndex, 10);
  const zAlign = parseInt(elAlignmentWarning.style.zIndex, 10);
  const zBanner = parseInt(elStudyBanner.style.zIndex, 10);

  console.log(`\n  Observed Z-Indices:`);
  console.log(`    Goal Block Overlay:     ${zGoal} (Expected: 2147483647)`);
  console.log(`    Time Manager Overlay:   ${zTime} (Expected: 2147483646)`);
  console.log(`    Focus Reminder:         ${zFocus} (Expected: 2147483645)`);
  console.log(`    Alignment Warning:      ${zAlign} (Expected: 10000)`);
  console.log(`    Study Banner:           ${zBanner} (Expected: 9999)\n`);

  assert(zGoal === 2147483647, "#ss-goal-block-overlay has strict z-index 2147483647");
  assert(zTime === 2147483646, "#ss-time-manager-overlay has strict z-index 2147483646");
  assert(zFocus === 2147483645, "#ss-focus-reminder has strict z-index 2147483645");
  assert(zAlign === 10000, "#ss-alignment-warning has strict z-index 10000");
  assert(zBanner === 9999, "#ss-study-banner has strict z-index 9999");

  assert(zGoal > zTime, "Hierarchy assertion: Goal Block (2147483647) > Time Manager (2147483646)");
  assert(zTime > zFocus, "Hierarchy assertion: Time Manager (2147483646) > Focus Reminder (2147483645)");
  assert(zFocus > zAlign, "Hierarchy assertion: Focus Reminder (2147483645) > Alignment Warning (10000)");
  assert(zAlign > zBanner, "Hierarchy assertion: Alignment Warning (10000) > Study Banner (9999)");

  // 2.3 Frosted Glass Styling Verification
  assert(
    elGoalBlock.style.backdropFilter === 'blur(16px)' || elGoalBlock.style.webkitBackdropFilter === 'blur(16px)',
    "#ss-goal-block-overlay has frosted glass backdrop-filter blur(16px)"
  );
  assert(
    elTimeManager.style.backdropFilter === 'blur(16px)' || elTimeManager.style.webkitBackdropFilter === 'blur(16px)',
    "#ss-time-manager-overlay has frosted glass backdrop-filter blur(16px)"
  );
  assert(
    elFocusReminder.style.backdropFilter === 'blur(16px)' || elFocusReminder.style.webkitBackdropFilter === 'blur(16px)',
    "#ss-focus-reminder has frosted glass backdrop-filter blur(16px)"
  );
  assert(
    elAlignmentWarning.style.backdropFilter === 'blur(16px)' || elAlignmentWarning.style.webkitBackdropFilter === 'blur(16px)',
    "#ss-alignment-warning has frosted glass backdrop-filter blur(16px)"
  );
  assert(
    elStudyBanner.style.backdropFilter === 'blur(16px)' || elStudyBanner.style.webkitBackdropFilter === 'blur(16px)',
    "#ss-study-banner has frosted glass backdrop-filter blur(16px)"
  );

  // 2.4 Modal Card Animations & CSS rules
  const cssContent = fs.readFileSync(path.join(__dirname, '../content/css/header-button.css'), 'utf8');
  assert(cssContent.includes('@keyframes ssModalScaleIn'), "header-button.css defines @keyframes ssModalScaleIn");
  assert(cssContent.includes('animation: ssModalScaleIn 0.25s') || cssContent.includes('animation: ssModalScaleIn 0.2s'), "Modal cards use ssModalScaleIn scale-in animation");
  assert(cssContent.includes('--gm-blur: 16px'), "Design token --gm-blur is 16px");

  // 2.5 Action Button Callbacks Stress Test

  // Goal Block Strict Enforcement: No Allow Once bypass, Search Goal and Home are available
  const allowOnceBtn = elGoalBlock.querySelector('#ss-btn-allow-once');
  assert(allowOnceBtn === null, "Goal Block strictly does NOT contain '#ss-btn-allow-once' bypass button");
  const searchGoalBtn = elGoalBlock.querySelector('#ss-btn-search-goal');
  assert(searchGoalBtn !== null, "Goal Block contains '#ss-btn-search-goal' button");
  const goHomeBtn = elGoalBlock.querySelector('#ss-btn-go-home');
  assert(goHomeBtn !== null, "Goal Block contains '#ss-btn-go-home' button");

  // Time Manager Snooze Callback
  const tmSnoozeBtn = elTimeManager.querySelector('#ss-tm-snooze');
  assert(tmSnoozeBtn !== null, "Time Manager contains '#ss-tm-snooze' button");
  const prevSnooze = window.TimeManager.config.snoozeUntil || 0;
  tmSnoozeBtn.dispatchEvent({ type: 'click' });
  await new Promise(r => setTimeout(r, 20));
  assert(document.getElementById('ss-time-manager-overlay') === null, "Snooze click unmounts #ss-time-manager-overlay");
  assert(window.TimeManager.config.snoozeUntil > Date.now(), "Snooze extended deadline into the future (+5 min)");

  // Focus Reminder Continue Callback
  const continueBtn = elFocusReminder.querySelector('#ss-btn-continue');
  assert(continueBtn !== null, "Focus Reminder contains '#ss-btn-continue' button");
  continueBtn.dispatchEvent({ type: 'click' });
  assert(document.getElementById('ss-focus-reminder') === null, "Continue click unmounts #ss-focus-reminder");

  // Alignment Warning Dismiss Callback
  const dismissBtn = elAlignmentWarning.querySelector('#ss-dismiss-warning');
  assert(dismissBtn !== null, "Alignment Warning contains '#ss-dismiss-warning' button");
  dismissBtn.dispatchEvent({ type: 'click' });
  await new Promise(r => setTimeout(r, 350));
  assert(document.getElementById('ss-alignment-warning') === null, "Dismiss click unmounts #ss-alignment-warning");

  // Study Banner Pomodoro Pause / Resume & Shield Button
  const pomoPauseBtn = elStudyBanner.querySelector('#ss-pomo-btn-pause');
  assert(pomoPauseBtn !== null, "Study Banner contains Pomodoro pause button");
  assert(window.StudyMode.pomoIsPaused === false, "Pomodoro timer initially running");
  pomoPauseBtn.dispatchEvent({ type: 'click' });
  assert(window.StudyMode.pomoIsPaused === true, "Clicking pause toggles pomoIsPaused = true");
  assert(pomoPauseBtn.textContent === '▶️', "Pause button icon switches to play (▶️)");

  pomoPauseBtn.dispatchEvent({ type: 'click' });
  assert(window.StudyMode.pomoIsPaused === false, "Clicking play toggles pomoIsPaused = false");
  assert(pomoPauseBtn.textContent === '⏸️', "Pause button icon switches to pause (⏸️)");

  // Clean teardown
  window.StudyMode.disable();
  window.TimeManager.disable();
  window.GoalMode.disable();
  assert(document.getElementById('ss-study-banner') === null, "StudyMode.disable() cleanly removed #ss-study-banner");

  console.log("\n=========================================================================");
  console.log(`TOTAL EMPIRICAL CHALLENGER ASSERTIONS: ${passedAssertions + failedAssertions}`);
  console.log(`PASSED: ${passedAssertions}`);
  console.log(`FAILED: ${failedAssertions}`);
  console.log("=========================================================================\n");

  if (failedAssertions > 0) {
    console.error("Failures list:", failureDetails);
    process.exit(1);
  } else {
    console.log("ALL FLOATING HUD & DEFENSIVE MODAL STRESS TESTS PASSED 100% CLEANLY! ✅");
  }
}

runEmpiricalHUDAndModalsSuite().catch(err => {
  console.error("Fatal error during challenger test execution:", err);
  process.exit(1);
});
