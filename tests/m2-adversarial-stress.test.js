/**
 * Milestone 2 Empirical Adversarial Stress Test Suite
 * Tests multi-tier storage fallbacks, options tab deduplication, and audio engine IIFE timing.
 */

const assert = require('assert');
const { setupMockEnv } = require('./harness/mock-extension-env');

console.log("=========================================================");
console.log("  MILESTONE 2 EMPIRICAL ADVERSARIAL STRESS TEST SUITE   ");
console.log("=========================================================\n");

let passedCount = 0;
let failedCount = 0;
let totalCount = 0;
const failures = [];

async function runTest(testName, testFn) {
  totalCount++;
  try {
    await testFn();
    passedCount++;
    console.log(`  ✓ [PASS] ${testName}`);
  } catch (err) {
    failedCount++;
    failures.push({ testName, error: err.message, stack: err.stack });
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAllTests() {
  // -----------------------------------------------------------------------------
  // SECTION 1: Multi-Tier Storage Cascade Under Failure Conditions
  // -----------------------------------------------------------------------------
  console.log("--- Section 1: Multi-Tier Storage Cascade & Error Fallbacks ---");

  await runTest("1.1 Sync Storage Quota Error -> Fallback to Local Storage", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/storage.js')];
    const { StorageUtil, DEFAULT_SETTINGS } = require('../utils/storage.js');

    // Force sync.set to reject (simulating QUOTA_BYTES_PER_ITEM error)
    env.chrome.storage.sync.set = async () => {
      throw new Error("QuotaExceededError: QUOTA_BYTES_PER_ITEM exceeded");
    };

    const customSettings = { ...DEFAULT_SETTINGS, learningGoal: "Master Quantum Physics", focusMode: false };
    await StorageUtil.saveSettings(customSettings);

    // Verify sync storage was NOT updated (failed)
    const syncRes = await env.chrome.storage.sync.get(["settings"]);
    assert.strictEqual(syncRes.settings, undefined, "Sync storage should be empty after quota error");

    // Verify local storage WAS updated (fallback target)
    const localRes = await env.chrome.storage.local.get(["settings"]);
    assert.notStrictEqual(localRes.settings, undefined, "Local storage should contain settings fallback");
    assert.strictEqual(localRes.settings.learningGoal, "Master Quantum Physics");

    // Verify getSettings() retrieves data seamlessly from Local storage when Sync fails
    env.chrome.storage.sync.get = async () => { throw new Error("Sync storage unavailable"); };
    const retrieved = await StorageUtil.getSettings();
    assert.strictEqual(retrieved.learningGoal, "Master Quantum Physics");
    assert.strictEqual(retrieved.focusMode, false);
  });

  await runTest("1.2 Safari Environment (chrome.storage.sync is undefined)", async () => {
    const env = setupMockEnv();
    delete env.chrome.storage.sync;

    delete require.cache[require.resolve('../utils/storage.js')];
    const { StorageUtil, DEFAULT_SETTINGS } = require('../utils/storage.js');

    const safariSettings = { ...DEFAULT_SETTINGS, learningGoal: "Safari Compatibility Test", studyMode: true };
    await StorageUtil.saveSettings(safariSettings);

    // Local storage should receive the saved settings
    const localRes = await env.chrome.storage.local.get(["settings"]);
    assert.strictEqual(localRes.settings.learningGoal, "Safari Compatibility Test");

    // getSettings should read from Local storage seamlessly
    const retrieved = await StorageUtil.getSettings();
    assert.strictEqual(retrieved.learningGoal, "Safari Compatibility Test");
    assert.strictEqual(retrieved.studyMode, true);
  });

  await runTest("1.3 Extension Context Invalidation -> In-Memory Fallback Cache", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/storage.js')];
    const { StorageUtil, DEFAULT_SETTINGS } = require('../utils/storage.js');

    const initialSettings = { ...DEFAULT_SETTINGS, learningGoal: "Context Invalidation Test", focusMode: true };
    await StorageUtil.saveSettings(initialSettings);

    // Invalidate context by deleting runtime.id
    delete env.chrome.runtime.id;
    assert.strictEqual(StorageUtil.isContextValid(), false, "Context should report invalid");

    const offlineSettings = { ...initialSettings, learningGoal: "Saved Offline" };
    await StorageUtil.saveSettings(offlineSettings);

    // getSettings when context is invalid — should return memory cache
    const retrieved = await StorageUtil.getSettings();
    assert.strictEqual(retrieved.learningGoal, "Saved Offline");
    assert.strictEqual(retrieved.focusMode, true);
  });

  await runTest("1.4 Memory Cache Fallback when Sync/Local Storage is Empty or Throws (Tier 3 Cascade)", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/storage.js')];

    let changeListener = null;
    env.chrome.storage.onChanged.addListener = (fn) => { changeListener = fn; };

    const { StorageUtil, DEFAULT_SETTINGS } = require('../utils/storage.js');

    // Populate memory cache via change event or previous save
    const newLocalSettings = { ...DEFAULT_SETTINGS, learningGoal: "Local Sync Event" };
    changeListener({ settings: { newValue: newLocalSettings } }, 'local');

    // Both sync and local return empty / null (e.g. storage cleared or read failure)
    env.chrome.storage.sync.get = async () => ({});
    env.chrome.storage.local.get = async () => ({});

    const cached = await StorageUtil.getSettings();
    assert.strictEqual(cached.learningGoal, "Local Sync Event", "getSettings must fall back to memorySettingsCache when sync/local return empty");
  });

  await runTest("1.5 Tracking Multi-Tier Cascade (chrome.storage.local -> memoryTrackingCache)", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/storage.js')];
    const { StorageUtil, DEFAULT_TRACKING } = require('../utils/storage.js');

    const customTracking = { ...DEFAULT_TRACKING, weeklyTotal: 7200 };
    await StorageUtil.saveTracking(customTracking);

    // Clear local storage get to simulate read failure
    env.chrome.storage.local.get = async () => ({});

    const tracking = await StorageUtil.getTracking();
    assert.strictEqual(tracking.weeklyTotal, 7200, "getTracking should fall back to memoryTrackingCache when local storage is empty");
  });

  await runTest("1.6 Deep Merging of Partial Settings and Missing Sub-Objects", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/storage.js')];
    const { StorageUtil } = require('../utils/storage.js');

    await env.chrome.storage.local.set({ settings: { shortsBlocker: false, learningGoal: "Deep Merge Test" } });
    delete env.chrome.storage.sync;

    const merged = await StorageUtil.getSettings();
    assert.strictEqual(merged.shortsBlocker, false);
    assert.strictEqual(merged.learningGoal, "Deep Merge Test");
    assert.notStrictEqual(merged.uiCleaner, undefined, "uiCleaner sub-object must be merged");
    assert.strictEqual(merged.uiCleaner.hideBell, true, "uiCleaner default keys must be preserved");
    assert.notStrictEqual(merged.timeManager, undefined, "timeManager sub-object must be merged");
    assert.strictEqual(merged.timeManager.dailyLimitMinutes, 60, "timeManager default keys must be preserved");
  });

  // -----------------------------------------------------------------------------
  // SECTION 2: Background Options Page Tab Deduplication Protocol
  // -----------------------------------------------------------------------------
  console.log("\n--- Section 2: Background Options Page Tab Deduplication ---");

  await runTest("2.1 Focus Single Existing Options Tab", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/storage.js')];
    delete require.cache[require.resolve('../background/background.js')];

    const optionsUrl = env.chrome.runtime.getURL('options/options.html');
    const existingTab = { id: 101, windowId: 5, url: optionsUrl, active: false };

    let tabUpdated = false;
    let windowFocused = false;

    env.chrome.tabs.query = (queryInfo, callback) => callback([existingTab]);
    env.chrome.tabs.update = (tabId, props, callback) => {
      if (tabId === 101 && props.active === true) tabUpdated = true;
      if (typeof callback === 'function') callback(existingTab);
    };
    env.chrome.windows = {
      update: (windowId, props, callback) => {
        if (windowId === 5 && props.focused === true) windowFocused = true;
        if (typeof callback === 'function') callback();
      }
    };
    env.chrome.tabs.create = () => {
      assert.fail("chrome.tabs.create should NOT be called when matching options tab exists");
    };

    require('../background/background.js');

    const res = await new Promise(resolve => {
      env.chrome.runtime.sendMessage({ action: "openOptionsPage" }, resolve);
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.reused, true);
    assert.strictEqual(res.tabId, 101);
    assert.strictEqual(tabUpdated, true, "Existing tab should be activated");
    assert.strictEqual(windowFocused, true, "Window of existing tab should be focused");
  });

  await runTest("2.2 Deduplicate Multiple Open Options Tabs (Focus First Match)", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/storage.js')];
    delete require.cache[require.resolve('../background/background.js')];

    const optionsUrl = env.chrome.runtime.getURL('options/options.html');
    const tabList = [
      { id: 1, windowId: 1, url: 'https://www.youtube.com/' },
      { id: 201, windowId: 2, url: optionsUrl },
      { id: 202, windowId: 3, url: optionsUrl }
    ];

    let focusedTabId = null;

    env.chrome.tabs.query = (queryInfo, callback) => callback(tabList);
    env.chrome.tabs.update = (tabId, props, callback) => {
      focusedTabId = tabId;
      if (typeof callback === 'function') callback({ id: tabId });
    };
    env.chrome.windows = {
      update: (windowId, props, callback) => { if (typeof callback === 'function') callback(); }
    };

    require('../background/background.js');

    const res = await new Promise(resolve => {
      env.chrome.runtime.sendMessage({ action: "openOptionsPage" }, resolve);
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.reused, true);
    assert.strictEqual(res.tabId, 201, "First matching options tab (ID 201) should be focused");
    assert.strictEqual(focusedTabId, 201);
  });

  await runTest("2.3 Open New Tab when No Options Tab is Open", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/storage.js')];
    delete require.cache[require.resolve('../background/background.js')];

    const openTabs = [
      { id: 1, windowId: 1, url: 'https://www.youtube.com/' },
      { id: 2, windowId: 1, url: 'https://www.google.com/' }
    ];

    let createdUrl = null;

    env.chrome.tabs.query = (queryInfo, callback) => callback(openTabs);
    env.chrome.tabs.create = (props, callback) => {
      createdUrl = props.url;
      const newTab = { id: 301, ...props };
      if (typeof callback === 'function') callback(newTab);
    };

    require('../background/background.js');

    const res = await new Promise(resolve => {
      env.chrome.runtime.sendMessage({ action: "openOptionsPage" }, resolve);
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.reused, false);
    assert.strictEqual(res.tabId, 301);
    assert.strictEqual(createdUrl, env.chrome.runtime.getURL('options/options.html'));
  });

  await runTest("2.4 Handles Missing chrome.windows API Gracefully", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/storage.js')];
    delete require.cache[require.resolve('../background/background.js')];

    delete env.chrome.windows;

    const optionsUrl = env.chrome.runtime.getURL('options/options.html');
    const existingTab = { id: 401, url: optionsUrl };

    env.chrome.tabs.query = (queryInfo, callback) => callback([existingTab]);
    env.chrome.tabs.update = (tabId, props, callback) => {
      if (typeof callback === 'function') callback(existingTab);
    };

    require('../background/background.js');

    const res = await new Promise(resolve => {
      env.chrome.runtime.sendMessage({ action: "openOptionsPage" }, resolve);
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.reused, true);
    assert.strictEqual(res.tabId, 401);
  });

  // -----------------------------------------------------------------------------
  // SECTION 3: Audio Engine & Synchronous IIFE Init Timing
  // -----------------------------------------------------------------------------
  console.log("\n--- Section 3: Audio Engine & Main.js Init Timing ---");

  await runTest("3.1 Synchronous window.applySettings Attachment in main.js", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/storage.js')];
    delete require.cache[require.resolve('../content/js/main.js')];

    delete global.window.applySettings;
    delete global.window.showFocusReminderOverlay;
    delete global.window.shortsShieldInitialized;

    require('../content/js/main.js');

    assert.strictEqual(typeof global.window.applySettings, 'function', "window.applySettings MUST be attached synchronously");
    assert.strictEqual(typeof global.window.showFocusReminderOverlay, 'function', "window.showFocusReminderOverlay MUST be attached synchronously");
  });

  await runTest("3.2 Execution of applySettings without throwing when optional modules are absent", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/main.js')];
    delete global.window.shortsShieldInitialized;

    require('../content/js/main.js');

    delete global.window.ShortsBlocker;
    delete global.window.FocusMode;
    delete global.window.FeedController;
    delete global.window.StudyMode;
    delete global.window.GoalMode;
    delete global.window.UICleaner;
    delete global.window.TimeManager;
    delete global.window.AudioEngine;
    delete global.window.HeaderButton;

    assert.doesNotThrow(() => {
      global.window.applySettings({
        shortsBlocker: true,
        focusMode: true,
        studyMode: true,
        goalMode: true,
        audioEffects: true,
        timeManager: { enabled: true }
      });
    }, "applySettings should handle missing modules gracefully without crashing");
  });

  await runTest("3.3 Audio Engine Toggle Synchronization via applySettings", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/main.js')];
    delete global.window.shortsShieldInitialized;

    global.window.AudioEngine = { enabled: true };

    require('../content/js/main.js');

    global.window.applySettings({ audioEffects: false });
    assert.strictEqual(global.window.AudioEngine.enabled, false, "AudioEngine.enabled should be updated to false");

    global.window.applySettings({ audioEffects: true });
    assert.strictEqual(global.window.AudioEngine.enabled, true, "AudioEngine.enabled should be updated to true");
  });

  await runTest("3.4 Focus Reminder Overlay DOM Injection Verification", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/main.js')];
    delete global.window.shortsShieldInitialized;

    require('../content/js/main.js');

    assert.strictEqual(env.document.getElementById('ss-focus-reminder'), null);

    global.window.showFocusReminderOverlay();

    const overlay = env.document.getElementById('ss-focus-reminder');
    assert.notStrictEqual(overlay, null, "Overlay element should be injected into DOM");
    assert.strictEqual(overlay.className, 'ss-focus-reminder-backdrop');

    const continueBtn = overlay.querySelector('#ss-btn-continue');
    assert.notStrictEqual(continueBtn, null, "Continue button should exist in overlay");
    continueBtn.click();
    assert.strictEqual(env.document.getElementById('ss-focus-reminder'), null, "Clicking continue should remove overlay");
  });

  console.log("\n=========================================================");
  console.log(`  STRESS SUITE SUMMARY: ${passedCount}/${totalCount} Passed, ${failedCount} Failed`);
  console.log("=========================================================\n");

  if (failedCount > 0) {
    console.log("FAILED TESTS DETAILED LOG:");
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}) ${f.testName}: ${f.error}`);
    });
    console.log("");
    process.exit(1);
  }
}

runAllTests();
