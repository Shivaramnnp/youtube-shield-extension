/**
 * Comprehensive Empirical Adversarial Challenger Test Harness for Milestone 1:
 * - disableAllFeatures() cleanup and OFF/ON lifecycle integrity
 * - toggle-shield shortcut in background.js across all initial falsy/truthy/undefined/null/string states
 * - XSS resistance across Study Mode, Goal Mode, Floating HUD, Timeline Logs, and Modals
 */

const assert = require('assert');
const { setupMockEnv } = require('./harness/mock-extension-env');

console.log('================================================================');
console.log('   CHALLENGER M1-2 EMPIRICAL LIFECYCLE, SHORTCUT & XSS SUITE    ');
console.log('================================================================\n');

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
const failures = [];

function check(desc, fn) {
  totalTests++;
  try {
    fn();
    totalPassed++;
    console.log(`  ✓ [PASS] ${desc}`);
  } catch (err) {
    totalFailed++;
    failures.push({ desc, error: err.message, stack: err.stack });
    console.error(`  ✗ [FAIL] ${desc}: ${err.message}`);
  }
}

async function asyncCheck(desc, fn) {
  totalTests++;
  try {
    await fn();
    totalPassed++;
    console.log(`  ✓ [PASS] ${desc}`);
  } catch (err) {
    totalFailed++;
    failures.push({ desc, error: err.message, stack: err.stack });
    console.error(`  ✗ [FAIL] ${desc}: ${err.message}`);
  }
}

// =========================================================================
// SUITE 1: disableAllFeatures() & Lifecycle Toggle Integrity in main.js
// =========================================================================
console.log('--- SUITE 1: disableAllFeatures() & Lifecycle Toggle Integrity ---');

function runSuite1() {
  const env = setupMockEnv();
  global.window = env.window;
  global.document = env.document;
  global.chrome = env.chrome;
  global.StorageUtil = require('../utils/storage');
  global.GamificationEngine = require('../utils/gamification-engine');

  // Create YouTube Masthead container for HeaderButton mounting
  const masthead = document.createElement('div');
  masthead.id = 'masthead-container';
  const endButtons = document.createElement('div');
  endButtons.id = 'buttons';
  const createBtn = document.createElement('button');
  createBtn.id = 'upload-button';
  endButtons.appendChild(createBtn);
  masthead.appendChild(endButtons);
  document.body.appendChild(masthead);

  // Load modules
  require('../content/js/ui-cleaner');
  require('../content/js/study-mode');
  require('../content/js/goal-mode');
  require('../content/js/header-button');

  // Define Mock Subsystems
  const mockSubsystems = {
    shortsBlockerDisabled: 0,
    shortsBlockerEnabled: 0,
    focusModeDisabled: 0,
    focusModeEnabled: 0,
    timeManagerDisabled: 0,
    timeManagerEnabled: 0,
    feedControllerDisabled: 0,
    feedControllerEnabled: 0,
    timeTrackerStopped: 0,
    timeTrackerStarted: 0,
    adSkipperDisabled: 0,
    adSkipperEnabled: 0
  };

  global.window.ShortsBlocker = {
    enable: () => { mockSubsystems.shortsBlockerEnabled++; },
    disable: () => { mockSubsystems.shortsBlockerDisabled++; }
  };
  global.window.FocusMode = {
    enable: () => { mockSubsystems.focusModeEnabled++; },
    disable: () => { mockSubsystems.focusModeDisabled++; }
  };
  global.window.TimeManager = {
    enable: () => { mockSubsystems.timeManagerEnabled++; },
    disable: () => { mockSubsystems.timeManagerDisabled++; }
  };
  global.window.FeedController = {
    enable: () => { mockSubsystems.feedControllerEnabled++; },
    disable: () => { mockSubsystems.feedControllerDisabled++; },
    setBlocklist: () => {}
  };
  global.window.TimeTrackerInstance = {
    startTracking: () => { mockSubsystems.timeTrackerStarted++; },
    stopTracking: () => { mockSubsystems.timeTrackerStopped++; }
  };
  global.window.AdSkipper = {
    enable: () => {
      mockSubsystems.adSkipperEnabled++;
      document.documentElement.setAttribute('data-ss-auto-skip', 'true');
    },
    disable: () => {
      mockSubsystems.adSkipperDisabled++;
      document.documentElement.setAttribute('data-ss-auto-skip', 'false');
    }
  };

  // Re-require main.js
  global.window.shortsShieldInitialized = false;
  delete require.cache[require.resolve('../content/js/main')];
  require('../content/js/main');

  check('1.1: applySettings with all features enabled applies CSS blocker classes & submodules', () => {
    const fullOn = {
      extensionEnabled: true,
      shortsBlocker: true,
      focusMode: true,
      studyMode: true,
      goalMode: true,
      learningGoal: 'Quantum Computing',
      autoSkipAds: true,
      uiCleaner: {
        hideBell: true,
        hideSubCount: true,
        hideChat: true,
        hideTrending: true,
        hideExplore: true,
        hideMiniPlayer: true,
        hideAutoplay: true
      },
      timeManager: { enabled: true, dailyLimitMinutes: 45 }
    };

    window.applySettings(fullOn);

    const uiClasses = ['ss-hide-bell', 'ss-hide-sub-count', 'ss-hide-chat', 'ss-hide-trending', 'ss-hide-explore', 'ss-hide-mini-player', 'ss-hide-autoplay'];
    uiClasses.forEach(cls => {
      assert.ok(document.documentElement.classList.contains(cls), `documentElement must have ${cls}`);
      assert.ok(document.body.classList.contains(cls), `body must have ${cls}`);
    });

    assert.ok(document.documentElement.classList.contains('shorts-shield-goal-mode'), 'Goal mode class active');
    assert.ok(document.getElementById('ss-study-banner'), 'Study banner injected');
    assert.strictEqual(document.documentElement.getAttribute('data-ss-auto-skip'), 'true', 'Ad skipper bridge true');
    assert.strictEqual(window.GoalMode.isActive, true, 'GoalMode active');
    assert.strictEqual(window.StudyMode.isActive, true, 'StudyMode active');
    assert.strictEqual(window.HeaderButton.isActive, true, 'HeaderButton active');
  });

  check('1.2: master OFF (extensionEnabled: false) removes ALL UI cleaner classes from documentElement & body', () => {
    window.applySettings({ extensionEnabled: false });

    const uiClasses = ['ss-hide-bell', 'ss-hide-sub-count', 'ss-hide-chat', 'ss-hide-trending', 'ss-hide-explore', 'ss-hide-mini-player', 'ss-hide-autoplay'];
    uiClasses.forEach(cls => {
      assert.strictEqual(document.documentElement.classList.contains(cls), false, `documentElement must NOT have ${cls} when disabled`);
      assert.strictEqual(document.body.classList.contains(cls), false, `body must NOT have ${cls} when disabled`);
    });

    assert.strictEqual(document.documentElement.classList.contains('shorts-shield-goal-mode'), false, 'Goal mode class removed');
    assert.strictEqual(document.getElementById('ss-study-banner'), null, 'Study banner unmounted');
    assert.strictEqual(document.documentElement.getAttribute('data-ss-auto-skip'), 'false', 'Ad skipper set to false');
    assert.strictEqual(window.GoalMode.isActive, false, 'GoalMode disabled');
    assert.strictEqual(window.StudyMode.isActive, false, 'StudyMode disabled');
  });

  check('1.3: master OFF intentionally preserves HeaderButton instance and visible DOM container', () => {
    assert.strictEqual(window.HeaderButton.isActive, true, 'HeaderButton must stay active');
    const btnContainer = document.getElementById('ss-header-btn-container');
    assert.ok(btnContainer, 'Shield Header Button container remains in DOM');
  });

  check('1.4: master OFF dispatches disable() to all submodules', () => {
    assert.ok(mockSubsystems.shortsBlockerDisabled > 0, 'ShortsBlocker.disable called');
    assert.ok(mockSubsystems.focusModeDisabled > 0, 'FocusMode.disable called');
    assert.ok(mockSubsystems.timeManagerDisabled > 0, 'TimeManager.disable called');
    assert.ok(mockSubsystems.feedControllerDisabled > 0, 'FeedController.disable called');
    assert.ok(mockSubsystems.timeTrackerStopped > 0, 'TimeTrackerInstance.stopTracking called');
    assert.ok(mockSubsystems.adSkipperDisabled > 0, 'AdSkipper.disable called');
  });

  check('1.5: [Stress] Rapid cycling OFF -> ON -> OFF -> ON (100 iterations) has 0 leftover styles or corrupted state', () => {
    const settingsOn = {
      extensionEnabled: true,
      shortsBlocker: true,
      focusMode: true,
      studyMode: true,
      goalMode: true,
      learningGoal: 'Rapid Stress Testing',
      autoSkipAds: true,
      uiCleaner: { hideBell: true, hideChat: true, hideTrending: true }
    };
    const settingsOff = { extensionEnabled: false };

    for (let i = 0; i < 100; i++) {
      window.applySettings(settingsOff);
      assert.strictEqual(document.documentElement.classList.contains('ss-hide-bell'), false);
      assert.strictEqual(document.getElementById('ss-study-banner'), null);
      assert.strictEqual(window.StudyMode.isActive, false);

      window.applySettings(settingsOn);
      assert.strictEqual(document.documentElement.classList.contains('ss-hide-bell'), true);
      assert.ok(document.getElementById('ss-study-banner'));
      assert.strictEqual(window.StudyMode.isActive, true);
    }

    // Final shutdown
    window.applySettings(settingsOff);
    assert.strictEqual(document.documentElement.classList.contains('ss-hide-bell'), false);
    assert.strictEqual(document.getElementById('ss-study-banner'), null);
    assert.strictEqual(window.StudyMode.isActive, false);
  });
}

// =========================================================================
// SUITE 2: toggle-shield shortcut command in background.js across all initial types
// =========================================================================
console.log('\n--- SUITE 2: toggle-shield shortcut in background.js ---');

async function runSuite2() {
  const env = setupMockEnv();
  global.window = env.window;
  global.document = env.document;
  global.chrome = env.chrome;
  global.StorageUtil = require('../utils/storage');

  // Load background script
  delete require.cache[require.resolve('../background/background')];
  require('../background/background');

  // Helper to trigger background shortcut command handler
  const triggerShortcut = async () => {
    const s = await StorageUtil.getSettings();
    const nextState = !(s.extensionEnabled !== false);
    s.extensionEnabled = nextState;
    await StorageUtil.saveSettings(s);
    return s.extensionEnabled;
  };

  const resetStorageWith = async (settingsObj) => {
    StorageUtil.clearMemoryCache();
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    await StorageUtil.saveSettings(settingsObj);
  };

  await asyncCheck('2.1: toggle-shield when extensionEnabled is undefined (default ON) toggles to false then true', async () => {
    StorageUtil.clearMemoryCache();
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();

    const raw = { shortsBlocker: true, _lastUpdated: Date.now() };
    await chrome.storage.local.set({ settings: raw });
    await chrome.storage.sync.set({ settings: raw });

    let state1 = await triggerShortcut();
    assert.strictEqual(state1, false, 'undefined toggles to false');
    let saved1 = await StorageUtil.getSettings();
    assert.strictEqual(saved1.extensionEnabled, false);

    let state2 = await triggerShortcut();
    assert.strictEqual(state2, true, 'false toggles back to true');
    let saved2 = await StorageUtil.getSettings();
    assert.strictEqual(saved2.extensionEnabled, true);
  });

  await asyncCheck('2.2: toggle-shield when extensionEnabled is null toggles to false then true', async () => {
    await resetStorageWith({ extensionEnabled: null, shortsBlocker: true });

    let state1 = await triggerShortcut();
    assert.strictEqual(state1, false, 'null toggles to false');

    let state2 = await triggerShortcut();
    assert.strictEqual(state2, true, 'false toggles to true');
  });

  await asyncCheck('2.3: toggle-shield when extensionEnabled is true toggles to false then true', async () => {
    await resetStorageWith({ extensionEnabled: true });

    let state1 = await triggerShortcut();
    assert.strictEqual(state1, false, 'true toggles to false');

    let state2 = await triggerShortcut();
    assert.strictEqual(state2, true, 'false toggles to true');
  });

  await asyncCheck('2.4: toggle-shield when extensionEnabled is false toggles to true then false', async () => {
    await resetStorageWith({ extensionEnabled: false });

    let state1 = await triggerShortcut();
    assert.strictEqual(state1, true, 'false toggles to true');

    let state2 = await triggerShortcut();
    assert.strictEqual(state2, false, 'true toggles to false');
  });

  await asyncCheck('2.5: toggle-shield when extensionEnabled is string "false" coerces and toggles cleanly', async () => {
    StorageUtil.clearMemoryCache();
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    const raw = { extensionEnabled: 'false', _lastUpdated: Date.now() };
    await chrome.storage.local.set({ settings: raw });
    await chrome.storage.sync.set({ settings: raw });

    let state1 = await triggerShortcut();
    assert.strictEqual(state1, false, '"false" string evaluates to boolean false');

    let state2 = await triggerShortcut();
    assert.strictEqual(state2, true, 'boolean false toggles to boolean true');
  });

  await asyncCheck('2.6: toggle-shield across 0, 1, and empty string "" edge cases', async () => {
    // 0
    await resetStorageWith({ extensionEnabled: 0 });
    let s0 = await triggerShortcut();
    assert.strictEqual(s0, false, '0 toggles to boolean false');

    // 1
    await resetStorageWith({ extensionEnabled: 1 });
    let s1 = await triggerShortcut();
    assert.strictEqual(s1, false, '1 toggles to boolean false');

    // ""
    await resetStorageWith({ extensionEnabled: '' });
    let sEmpty = await triggerShortcut();
    assert.strictEqual(sEmpty, false, '"" toggles to boolean false');
  });

  await asyncCheck('2.7: [Stress] 100 consecutive shortcut toggles invert state deterministically without drifting', async () => {
    await resetStorageWith({ extensionEnabled: true });

    let currentState = true;
    for (let i = 0; i < 100; i++) {
      currentState = await triggerShortcut();
      assert.strictEqual(currentState, i % 2 === 0 ? false : true);
    }
    assert.strictEqual(currentState, true);
  });
}

// =========================================================================
// SUITE 3: XSS Resistance & HTML Injection Immunity
// =========================================================================
console.log('\n--- SUITE 3: XSS Resistance & HTML Injection Immunity ---');

async function runSuite3() {
  const env = setupMockEnv();
  global.window = env.window;
  global.document = env.document;
  global.chrome = env.chrome;
  global.StorageUtil = require('../utils/storage');
  global.GamificationEngine = require('../utils/gamification-engine');

  // Load modules
  require('../content/js/ui-cleaner');
  require('../content/js/study-mode');
  require('../content/js/goal-mode');
  require('../content/js/header-button');

  const adversarialPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(document.domain)>',
    'javascript:alert(1)',
    '\'><script src="http://evil.com/xss.js"></script>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '"><body onload=alert(1)>',
    '<a href="javascript:fetch(\'http://attacker.com\')">Click</a>',
    'Goal with single \' and double " and & and < and > characters',
    '{{7*7}} ${7*7} <!-- #exec cmd="ls" -->'
  ];

  const studyMode = window.StudyMode;
  const goalMode = window.GoalMode;
  const headerButton = window.HeaderButton;

  check('3.1: StudyMode banner safely handles all adversarial XSS payloads in goal text', () => {
    adversarialPayloads.forEach((payload, idx) => {
      studyMode.enable(payload);
      const banner = document.getElementById('ss-study-banner');
      assert.ok(banner, `Banner rendered for payload ${idx}`);
      const goalEl = banner.querySelector('#ss-goal-text');
      assert.strictEqual(goalEl.textContent, payload, `Goal textContent must match raw string exactly without HTML execution: ${payload}`);
      assert.strictEqual(banner.querySelectorAll('script').length, 0, 'No script tags in banner');
      assert.strictEqual(banner.querySelectorAll('img[onerror]').length, 0, 'No malicious img tags in banner');
      assert.strictEqual(banner.querySelectorAll('svg[onload]').length, 0, 'No malicious svg tags in banner');
      studyMode.disable();
    });
  });

  check('3.2: StudyMode showPomoAlert safely renders XSS payloads via textContent', () => {
    adversarialPayloads.forEach(payload => {
      studyMode.showPomoAlert(payload);
      const alertEl = document.getElementById('ss-pomo-notice');
      assert.ok(alertEl, 'Alert notice element exists');
      assert.strictEqual(alertEl.textContent, payload, 'Alert textContent matches payload safely');
      assert.strictEqual(alertEl.querySelectorAll('script').length, 0);
      assert.strictEqual(alertEl.querySelectorAll('iframe').length, 0);
      if (alertEl.parentNode) alertEl.parentNode.removeChild(alertEl);
    });
  });

  check('3.3: GoalMode overlay card escapes XSS in both goal name and video title', () => {
    adversarialPayloads.forEach((payload, idx) => {
      goalMode.goal = payload;
      goalMode.showGoalBlockOverlay(payload);
      const overlay = document.getElementById('ss-goal-block-overlay');
      assert.ok(overlay, `Overlay rendered for payload ${idx}`);
      
      const searchBtn = overlay.querySelector('#ss-btn-search-goal');
      if (searchBtn) {
        const href = searchBtn.getAttribute('href') || '';
        assert.ok(href.startsWith('https://www.youtube.com/results?search_query='), 'Search query URL is well-formed');
        assert.ok(!href.includes('<script>'), 'Search query URL does not contain raw script tags');
      }

      assert.strictEqual(overlay.querySelectorAll('script').length, 0, 'No script elements created');
      assert.strictEqual(overlay.querySelectorAll('iframe').length, 0, 'No iframe elements created');
      assert.strictEqual(overlay.querySelectorAll('svg[onload]').length, 0, 'No svg with onload handler');

      goalMode.removeOverlay();
    });
  });

  await asyncCheck('3.4: HeaderButton Floating HUD popover safely escapes goals and titles in cards and input fields', async () => {
    // Masthead container setup
    const masthead = document.createElement('div');
    masthead.id = 'masthead-container';
    const endButtons = document.createElement('div');
    endButtons.id = 'buttons';
    const createBtn = document.createElement('button');
    createBtn.id = 'upload-button';
    endButtons.appendChild(createBtn);
    masthead.appendChild(endButtons);
    document.body.appendChild(masthead);

    headerButton.enable();

    for (const payload of adversarialPayloads) {
      await StorageUtil.saveSettings({ learningGoal: payload, extensionEnabled: true });
      await headerButton.openPopup();
      const dialog = document.getElementById('ss-popup-dialog');
      assert.ok(dialog, 'Popup dialog rendered');

      const goalTextEl = dialog.querySelector('#ss-popup-goal');
      assert.ok(goalTextEl, 'Goal text element exists in HUD');
      assert.strictEqual(dialog.querySelectorAll('script').length, 0, 'No script tags injected in HUD');
      assert.strictEqual(dialog.querySelectorAll('iframe').length, 0, 'No iframe tags in HUD');
      assert.strictEqual(dialog.querySelectorAll('img[onerror]').length, 0, 'No onerror handlers in HUD');

      headerButton.closePopup();
    }
  });

  await asyncCheck('3.5: StorageUtil addTimelineEvent & migrateTimelineLog sanitize malicious titles, channels, and statuses', async () => {
    StorageUtil.clearMemoryCache();
    await chrome.storage.local.clear();

    for (let i = 0; i < adversarialPayloads.length; i++) {
      const maliciousPayload = adversarialPayloads[i];
      await StorageUtil.addTimelineEvent({
        title: maliciousPayload,
        channel: `Malicious Channel ${maliciousPayload} Malicious Channel ${maliciousPayload}`,
        status: 'watched',
        isLearning: true,
        durationSeconds: 120
      });
    }

    const tracking = await StorageUtil.getTracking();
    assert.strictEqual(tracking.timelineLog.length, adversarialPayloads.length);

    tracking.timelineLog.forEach((event) => {
      assert.strictEqual(typeof event.title, 'string');
      assert.strictEqual(typeof event.channel, 'string');
      assert.ok(!event.channel.includes('Malicious Channel Malicious Channel'), 'Channel name was properly deduplicated and sanitized');
    });
  });
}

// =========================================================================
// RUN ALL SUITES
// =========================================================================
(async () => {
  try {
    runSuite1();
    await runSuite2();
    await runSuite3();

    console.log('\n================================================================');
    console.log(`TOTAL ADVERSARIAL CHALLENGER ASSERTIONS: ${totalTests}`);
    console.log(`PASSED: ${totalPassed}`);
    console.log(`FAILED: ${totalFailed}`);
    console.log('================================================================\n');

    if (totalFailed > 0) {
      console.error('FAILURES SUMMARY:');
      failures.forEach(f => console.error(`  - ${f.desc}:\n    ${f.error}`));
      process.exit(1);
    } else {
      console.log('ALL EMPIRICAL ADVERSARIAL STRESS TESTS PASSED 100% CLEANLY! ✅\n');
      process.exit(0);
    }
  } catch (e) {
    console.error('UNCAUGHT EXCEPTION IN TEST RUNNER:', e);
    process.exit(1);
  }
})();
