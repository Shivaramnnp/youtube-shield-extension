/**
 * Empirical Stress Test Suite for Challenger M3_2
 * Comprehensive verification of TimeManager & Main Content Script
 */

const { setupMockEnv } = require('./harness/mock-extension-env');
setupMockEnv();
const { test, describe, assert, resetDOM, resetStorage } = require('./harness/test-helpers');
const { StorageUtil } = require('../utils/storage');

require('../utils/dom-utils');
require('../content/js/time-manager');

let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

async function runAsyncTest(name, fn) {
  testResults.total++;
  try {
    await resetDOM();
    await resetStorage();
    // Ensure window.TimeManager is properly initialized
    delete require.cache[require.resolve('../content/js/time-manager')];
    require('../content/js/time-manager');

    await fn();
    testResults.passed++;
    console.log(`✓ PASS: ${name}`);
  } catch (err) {
    testResults.failed++;
    testResults.errors.push({ name, error: err.stack || err.message });
    console.error(`✗ FAIL: ${name}\n  ${err.stack || err.message}`);
  }
}

async function main() {
  console.log("==================================================");
  console.log("CHALLENGER M3_2 EMPIRICAL STRESS TEST SUITE");
  console.log("==================================================\n");

  // --- TIME MANAGER STRESS TESTS ---

  await runAsyncTest("TimeManager: getLocalDateKey formatting (YYYY-MM-DD) zero padding", async () => {
    const tm = window.TimeManager;
    const realDate = global.Date;

    try {
      // Mock Date for January 5th, 2026 08:05:09
      global.Date = class extends realDate {
        constructor(...args) {
          if (args.length) return new realDate(...args);
          return new realDate(2026, 0, 5, 8, 5, 9); // Month is 0-indexed in JS (Jan = 0)
        }
      };

      const key = tm.getLocalDateKey();
      assert.equal(key, "2026-01-05", `Expected '2026-01-05', got '${key}'`);
    } finally {
      global.Date = realDate;
    }
  });

  await runAsyncTest("TimeManager: Date key rollover across midnight resets limit evaluation", async () => {
    const tm = window.TimeManager;
    tm.enable({ enabled: true, dailyLimitMinutes: 30, snoozeUntil: 0 });

    // Store tracking data with 60 min watched yesterday (2026-08-11), 5 min today (2026-08-12)
    const mockTracking = {
      dailyWatchTime: {
        "2026-08-11": 3600, // 60 minutes yesterday (exceeds limit)
        "2026-08-12": 300   // 5 minutes today (under limit)
      }
    };
    await StorageUtil.saveTracking(mockTracking);

    const realDate = global.Date;
    try {
      // Mock current date as August 12, 2026
      global.Date = class extends realDate {
        constructor(...args) {
          if (args.length) return new realDate(...args);
          return new realDate(2026, 7, 12, 10, 0, 0);
        }
      };

      await tm.evaluate();

      const overlay = global.document.getElementById('ss-time-manager-overlay');
      assert.equal(overlay, null, "Overlay should NOT trigger on 2026-08-12 when today's watch time is only 5 minutes");
    } finally {
      global.Date = realDate;
      tm.disable();
    }
  });

  await runAsyncTest("TimeManager: Missing or malformed dailyWatchTime data handles gracefully without throwing", async () => {
    const tm = window.TimeManager;
    tm.enable({ enabled: true, dailyLimitMinutes: 30, snoozeUntil: 0 });

    await StorageUtil.saveTracking({ streak: 5 }); // No dailyWatchTime property

    await tm.evaluate();

    const overlay = global.document.getElementById('ss-time-manager-overlay');
    assert.equal(overlay, null, "Evaluates safely when dailyWatchTime is missing");
    tm.disable();
  });

  await runAsyncTest("TimeManager: Emergency Snooze (+5 min) button click updates config & persists to storage", async () => {
    const tm = window.TimeManager;
    tm.showOverlay('limit', { limitMinutes: 30, todayMinutes: 45 });

    const overlay = global.document.getElementById('ss-time-manager-overlay');
    assert.ok(overlay, "Overlay displayed");

    const snoozeBtn = overlay.querySelector('#ss-tm-snooze');
    assert.ok(snoozeBtn, "Snooze button present");

    const nowBefore = Date.now();
    snoozeBtn.click();

    await new Promise(r => setTimeout(r, 20));

    assert.equal(global.document.getElementById('ss-time-manager-overlay'), null, "Overlay removed on snooze click");
    assert.ok(tm.config.snoozeUntil >= nowBefore + 299000, "tm.config.snoozeUntil set to 5 minutes in future");

    const settings = await StorageUtil.getSettings();
    assert.ok(settings.timeManager && settings.timeManager.snoozeUntil >= nowBefore + 299000, "snoozeUntil saved to storage");
  });

  await runAsyncTest("TimeManager: Expired snooze causes evaluate() to re-trigger overlay if limit exceeded", async () => {
    const tm = window.TimeManager;
    const today = tm.getLocalDateKey();

    await StorageUtil.saveTracking({
      dailyWatchTime: { [today]: 3600 } // 60 min watched
    });

    tm.enable({
      enabled: true,
      dailyLimitMinutes: 30,
      snoozeUntil: Date.now() - 1000 // Expired snooze
    });

    await tm.evaluate();

    const overlay = global.document.getElementById('ss-time-manager-overlay');
    assert.ok(overlay, "Overlay re-triggered after snooze expired");
    tm.disable();
  });

  await runAsyncTest("TimeManager: AudioEngine.playAlarm is called when showing overlay", async () => {
    let alarmCalled = false;
    global.window.AudioEngine = {
      playAlarm: () => { alarmCalled = true; }
    };

    const tm = window.TimeManager;
    tm.showOverlay('limit', { limitMinutes: 60, todayMinutes: 70 });

    assert.ok(alarmCalled, "AudioEngine.playAlarm() called on overlay show");
    tm.removeOverlay();
    delete global.window.AudioEngine;
  });

  await runAsyncTest("TimeManager: AudioEngine throwing error does not break showOverlay", async () => {
    global.window.AudioEngine = {
      playAlarm: () => { throw new Error("AudioContext blocked by autoplay policy"); }
    };

    const tm = window.TimeManager;
    tm.showOverlay('limit', { limitMinutes: 60, todayMinutes: 70 });

    const overlay = global.document.getElementById('ss-time-manager-overlay');
    assert.ok(overlay, "Overlay created successfully despite AudioEngine error");
    tm.removeOverlay();
    delete global.window.AudioEngine;
  });

  await runAsyncTest("TimeManager: Multiple showOverlay calls do not create duplicate overlays or alarms", async () => {
    let alarmCallCount = 0;
    global.window.AudioEngine = {
      playAlarm: () => { alarmCallCount++; }
    };

    const tm = window.TimeManager;
    tm.showOverlay('limit', { limitMinutes: 60, todayMinutes: 70 });
    tm.showOverlay('limit', { limitMinutes: 60, todayMinutes: 70 });
    tm.showOverlay('limit', { limitMinutes: 60, todayMinutes: 70 });

    const overlays = global.document.querySelectorAll('#ss-time-manager-overlay');
    assert.equal(overlays.length, 1, "Exactly one overlay exists");
    assert.equal(alarmCallCount, 1, "Alarm played exactly once");

    tm.removeOverlay();
    delete global.window.AudioEngine;
  });

  // --- MAIN CONTENT SCRIPT STRESS TESTS ---

  await runAsyncTest("Main Script: Double initialization guard prevents running twice", async () => {
    global.window.shortsShieldInitialized = true;
    let initLogCount = 0;

    const origLog = console.log;
    console.log = (...args) => {
      if (args[0] === "Shorts Shield initializing...") initLogCount++;
      origLog(...args);
    };

    try {
      delete require.cache[require.resolve('../content/js/main.js')];
      require('../content/js/main.js');

      assert.equal(initLogCount, 0, "Main script did not re-initialize when window.shortsShieldInitialized is true");
    } finally {
      console.log = origLog;
      global.window.shortsShieldInitialized = false;
    }
  });

  await runAsyncTest("Main Script: Master toggle extensionEnabled: false disables feature modules", async () => {
    let disabledModules = [];
    global.window.ShortsBlocker = { disable: () => disabledModules.push('ShortsBlocker') };
    global.window.FocusMode = { disable: () => disabledModules.push('FocusMode') };
    global.window.StudyMode = { disable: () => disabledModules.push('StudyMode') };
    global.window.GoalMode = { disable: () => disabledModules.push('GoalMode') };
    global.window.UICleanerInstance = { disable: () => disabledModules.push('UICleanerInstance') };
    global.window.TimeManager = { disable: () => disabledModules.push('TimeManager') };
    global.window.FeedController = { disable: () => disabledModules.push('FeedController') };
    global.window.TimeTrackerInstance = { stopTracking: () => disabledModules.push('TimeTrackerInstance'), startTracking: () => {} };
    global.window.HeaderButton = { enable: () => disabledModules.push('HeaderButton_Enabled') };

    delete require.cache[require.resolve('../content/js/main.js')];
    delete global.window.shortsShieldInitialized;
    require('../content/js/main.js');

    assert.ok(typeof global.window.applySettings === 'function', "applySettings attached to window");

    global.window.applySettings({ extensionEnabled: false });

    assert.ok(disabledModules.includes('ShortsBlocker'), "ShortsBlocker disabled");
    assert.ok(disabledModules.includes('FocusMode'), "FocusMode disabled");
    assert.ok(disabledModules.includes('StudyMode'), "StudyMode disabled");
    assert.ok(disabledModules.includes('GoalMode'), "GoalMode disabled");
    assert.ok(disabledModules.includes('UICleanerInstance'), "UICleanerInstance disabled");
    assert.ok(disabledModules.includes('TimeManager'), "TimeManager disabled");
    assert.ok(disabledModules.includes('FeedController'), "FeedController disabled");
    assert.ok(disabledModules.includes('TimeTrackerInstance'), "TimeTrackerInstance stopped");
    assert.ok(!disabledModules.includes('HeaderButton_Enabled'), "HeaderButton was NOT re-enabled when extension disabled");

    // Clean up window mocks
    delete global.window.ShortsBlocker;
    delete global.window.FocusMode;
    delete global.window.StudyMode;
    delete global.window.GoalMode;
    delete global.window.UICleanerInstance;
    delete global.window.FeedController;
    delete global.window.TimeTrackerInstance;
    delete global.window.HeaderButton;
  });

  await runAsyncTest("Main Script: Context invalidation handling in TimeManager", async () => {
    const tm = window.TimeManager;
    let tmDisabled = false;
    tm.disable = () => { tmDisabled = true; };
    tm.isActive = true;
    tm.config = { enabled: true };

    const origIsValid = StorageUtil.isContextValid;
    StorageUtil.isContextValid = () => false;

    try {
      await tm.evaluate();
      assert.ok(tmDisabled, "TimeManager auto-disabled when StorageUtil.isContextValid() returns false");
    } finally {
      StorageUtil.isContextValid = origIsValid;
      tm.disable = Object.getPrototypeOf(tm).disable;
    }
  });

  await runAsyncTest("Main Script: storage.onChanged dynamically applies settings on feature toggle changes", async () => {
    let reloaded = false;
    global.window.location.reload = () => { reloaded = true; };

    let shortsBlockerDisabled = false;
    global.window.ShortsBlocker = {
      disable: () => { shortsBlockerDisabled = true; },
      enable: () => {},
      applySettings: () => {}
    };

    let storageListener = null;
    global.chrome.storage.onChanged.addListener = (fn) => { storageListener = fn; };

    delete require.cache[require.resolve('../content/js/main.js')];
    delete global.window.shortsShieldInitialized;
    require('../content/js/main.js');

    assert.ok(typeof storageListener === 'function', "Storage listener registered");

    // Trigger storage change where shortsBlocker changed from true to false
    storageListener({
      settings: {
        oldValue: { extensionEnabled: true, shortsBlocker: true },
        newValue: { extensionEnabled: true, shortsBlocker: false }
      }
    }, 'sync');

    assert.strictEqual(reloaded, false, "window.location.reload() NOT called on dynamic SPA setting toggle");
    assert.strictEqual(shortsBlockerDisabled, true, "ShortsBlocker.disable() invoked dynamically with new settings");
  });

  await runAsyncTest("Main Script: storage.onChanged applies settings without reload on non-feature changes", async () => {
    let reloaded = false;
    global.window.location.reload = () => { reloaded = true; };

    let audioEffectsSet = null;
    global.window.AudioEngine = {
      set enabled(val) { audioEffectsSet = val; },
      get enabled() { return audioEffectsSet; }
    };

    let storageListener = null;
    global.chrome.storage.onChanged.addListener = (fn) => { storageListener = fn; };

    delete require.cache[require.resolve('../content/js/main.js')];
    delete global.window.shortsShieldInitialized;
    require('../content/js/main.js');

    // Wait for initial loadSettingsAsync promise in main.js to settle
    await new Promise(r => setTimeout(r, 50));

    // Trigger non-feature change (audioEffects changed true -> false)
    const oldSettings = { extensionEnabled: true, shortsBlocker: true, audioEffects: true };
    const newSettings = { extensionEnabled: true, shortsBlocker: true, audioEffects: false };

    storageListener({
      settings: {
        oldValue: oldSettings,
        newValue: newSettings
      }
    }, 'sync');

    assert.equal(reloaded, false, "Page did NOT reload for non-feature setting change");
    assert.equal(global.window.AudioEngine.enabled, false, "applySettings updated AudioEngine.enabled to false");

    delete global.window.AudioEngine;
  });

  console.log("\n==================================================");
  console.log(`FINAL RESULTS: ${testResults.passed}/${testResults.total} PASSED`);
  if (testResults.failed > 0) {
    console.log(`FAILED: ${testResults.failed}`);
    testResults.errors.forEach(e => console.log(`- ${e.name}: ${e.error}`));
    process.exit(1);
  } else {
    console.log("ALL 13 CHALENGER EMPIRICAL STRESS TESTS PASSED CLEANLY!");
    console.log("==================================================");
  }
}

main();
