/**
 * Adversarial Stress & Edge Case Test Suite for Milestone M1 Utilities
 * Target Files: utils/storage.js, utils/dom-utils.js, utils/audio-engine.js
 */

const path = require('path');
const assert = require('assert');

// Set up mock browser environment
const { setupMockEnv } = require('../../tests/harness/mock-extension-env.js');
setupMockEnv();

// Load utility modules
const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../../utils/storage.js');
const DOMUtils = require('../../utils/dom-utils.js');
const AudioEngine = require('../../utils/audio-engine.js');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    console.error(err.stack);
    failCount++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    console.error(err.stack);
    failCount++;
  }
}

async function runAdversarialSuite() {
  console.log("=================================================");
  console.log("  M1 ADVERSARIAL STRESS & EDGE CASE HARNESS    ");
  console.log("=================================================\n");

  // Reset environment before starting
  StorageUtil.clearMemoryCaches();

  // -----------------------------------------------------------------
  // SUITE 1: StorageUtil Adversarial Edge Cases
  // -----------------------------------------------------------------
  console.log("--- SUITE 1: StorageUtil Corrupted Data & Robustness ---");

  await runAsyncTest("StorageUtil handles un-mocked chrome global on require (ReferenceError test)", async () => {
    const origChrome = global.chrome;
    delete global.chrome;
    delete window.chrome;
    delete require.cache[require.resolve('../../utils/storage.js')];

    try {
      require('../../utils/storage.js');
      console.log("     StorageUtil loaded without chrome global without throwing.");
    } catch (e) {
      throw new Error(`StorageUtil threw when loaded without chrome global: ${e.message}`);
    } finally {
      global.chrome = origChrome;
      window.chrome = origChrome;
      delete require.cache[require.resolve('../../utils/storage.js')];
      require('../../utils/storage.js');
    }
  });

  await runAsyncTest("StorageUtil handles corrupted settings data (primitive string instead of object)", async () => {
    await chrome.storage.local.set({ settings: "CORRUPTED_STRING_DATA" });
    const settings = await StorageUtil.getSettings();
    assert.strictEqual(typeof settings, 'object');
    assert.strictEqual(settings.extensionEnabled, true);
    assert.strictEqual(typeof settings.uiCleaner, 'object');
    assert.strictEqual(Array.isArray(settings.blockedKeywords), true);
  });

  await runAsyncTest("StorageUtil handles corrupted settings data (null/number)", async () => {
    await chrome.storage.local.set({ settings: 12345 });
    const settings = await StorageUtil.getSettings();
    assert.strictEqual(typeof settings, 'object');
    assert.strictEqual(settings.extensionEnabled, true);
  });

  await runAsyncTest("StorageUtil deep merges broken nested sub-objects (e.g. uiCleaner = 'invalid')", async () => {
    await chrome.storage.local.set({
      settings: {
        extensionEnabled: false,
        uiCleaner: "NOT_AN_OBJECT",
        blockedKeywords: "NOT_AN_ARRAY"
      }
    });
    const settings = await StorageUtil.getSettings();
    assert.strictEqual(settings.extensionEnabled, false);
    assert.strictEqual(typeof settings.uiCleaner, 'object');
    assert.strictEqual(settings.uiCleaner.hideBell, true);
    assert.strictEqual(Array.isArray(settings.blockedKeywords), true);
    assert.strictEqual(settings.blockedKeywords.length, 0);
  });

  await runAsyncTest("StorageUtil handles corrupted tracking data (tracking = false)", async () => {
    await chrome.storage.local.set({ tracking: false });
    const tracking = await StorageUtil.getTracking();
    assert.strictEqual(typeof tracking, 'object');
    assert.strictEqual(typeof tracking.dailyWatchTime, 'object');
    assert.strictEqual(typeof tracking.gamification, 'object');
    assert.strictEqual(Array.isArray(tracking.gamification.badges), true);
  });

  await runAsyncTest("StorageUtil handles corrupted tracking sub-properties (gamification = null)", async () => {
    await chrome.storage.local.set({
      tracking: {
        dailyWatchTime: "INVALID",
        gamification: null
      }
    });
    const tracking = await StorageUtil.getTracking();
    assert.strictEqual(typeof tracking.dailyWatchTime, 'object');
    assert.strictEqual(typeof tracking.gamification, 'object');
    assert.strictEqual(tracking.gamification.level, 1);
    assert.strictEqual(Array.isArray(tracking.gamification.badges), true);
  });

  await runAsyncTest("StorageUtil saveSettings / saveTracking with null, undefined, non-objects", async () => {
    await StorageUtil.saveSettings(null);
    await StorageUtil.saveSettings(undefined);
    await StorageUtil.saveTracking(null);
    await StorageUtil.saveTracking(undefined);
  });

  await runAsyncTest("StorageUtil updateSetting helpers with missing sub-objects", async () => {
    await chrome.storage.local.clear();
    StorageUtil.clearMemoryCaches();
    await StorageUtil.updateUICleanerSetting('hideBell', false);
    const settings1 = await StorageUtil.getSettings();
    assert.strictEqual(settings1.uiCleaner.hideBell, false);

    await StorageUtil.updateTimeManagerSetting('dailyLimitMinutes', 120);
    const settings2 = await StorageUtil.getSettings();
    assert.strictEqual(settings2.timeManager.dailyLimitMinutes, 120);

    await StorageUtil.updatePomodoroSetting('workMinutes', 45);
    const settings3 = await StorageUtil.getSettings();
    assert.strictEqual(settings3.pomodoro.workMinutes, 45);
  });

  await runAsyncTest("StorageUtil chrome.storage.onChanged event handling with invalid payloads", async () => {
    const listeners = chrome.storage.onChanged._listeners || [];
    for (const listener of listeners) {
      listener({ settings: { newValue: undefined } }, 'sync');
      listener({ tracking: { newValue: null } }, 'local');
      listener({ settings: { newValue: "CORRUPTED" } }, 'sync');
    }
    const settings = await StorageUtil.getSettings();
    assert.strictEqual(typeof settings, 'object');
  });

  await runAsyncTest("StorageUtil gracefully degrades when chrome runtime/storage is undefined", async () => {
    const originalChrome = global.chrome;
    delete global.chrome;
    delete window.chrome;

    const fallbackSettings = await StorageUtil.getSettings();
    assert.strictEqual(typeof fallbackSettings, 'object');
    assert.strictEqual(fallbackSettings.extensionEnabled, true);

    const fallbackTracking = await StorageUtil.getTracking();
    assert.strictEqual(typeof fallbackTracking, 'object');

    await StorageUtil.saveSettings({ extensionEnabled: false });
    await StorageUtil.saveTracking({ weeklyTotal: 100 });

    global.chrome = originalChrome;
    window.chrome = originalChrome;
  });

  // -----------------------------------------------------------------
  // SUITE 2: DOMUtils Adversarial Edge Cases & Stress Testing
  // -----------------------------------------------------------------
  console.log("\n--- SUITE 2: DOMUtils Edge Cases & Stress Testing ---");

  runTest("DOMUtils handles null, non-string, and whitespace class names", () => {
    DOMUtils.addClass(null);
    DOMUtils.addClass(undefined);
    DOMUtils.addClass(123);
    DOMUtils.addClass({});
    DOMUtils.addClass("   ");

    DOMUtils.removeClass(null);
    DOMUtils.removeClass(undefined);
    DOMUtils.removeClass(456);
    DOMUtils.removeClass("   ");

    assert.strictEqual(DOMUtils.hasClass(null, "test"), false);
    assert.strictEqual(DOMUtils.hasClass(document.body, null), false);
    assert.strictEqual(DOMUtils.hasClass(document.body, "  "), false);
  });

  runTest("DOMUtils handles invalid CSS query selectors without throwing", () => {
    const res1 = DOMUtils.querySelector(":::invalid selector syntax:::");
    assert.strictEqual(res1, null);

    const res2 = DOMUtils.querySelectorAll("///[invalid]///");
    assert.strictEqual(res2.length, 0);

    const res3 = DOMUtils.querySelector("");
    assert.strictEqual(res3, null);

    const res4 = DOMUtils.querySelectorAll(null);
    assert.strictEqual(res4.length, 0);
  });

  runTest("DOMUtils createElement handles invalid inputs, attributes, and children safely", () => {
    const nullTag = DOMUtils.createElement(null);
    assert.strictEqual(nullTag, null);

    const numTag = DOMUtils.createElement(123);
    assert.strictEqual(numTag, null);

    const el = DOMUtils.createElement("div", {
      className: "test-class",
      style: { color: "red", display: "flex" },
      textContent: "Hello",
      "data-test": "123",
      onClick: () => {}
    }, [
      "Text Child",
      12345,
      null,
      undefined,
      DOMUtils.createElement("span", { id: "child-span" })
    ]);

    assert.notStrictEqual(el, null);
    assert.strictEqual(el.className, "test-class");
    assert.strictEqual(el.getAttribute("data-test"), "123");
    assert.strictEqual(el.childNodes.length >= 2, true);
  });

  runTest("DOMUtils appendChild & removeElement with null/detached nodes", () => {
    DOMUtils.appendChild(null);
    DOMUtils.removeElement(null);
    DOMUtils.removeElement({});

    const tempNode = document.createElement("div");
    DOMUtils.removeElement(tempNode);
  });

  runTest("DOMUtils rapid MutationObserver creation and teardown (1000 instances)", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const handles = [];
    for (let i = 0; i < 1000; i++) {
      const handle = DOMUtils.createObserver(parent, () => {}, { childList: true });
      handles.push(handle);
    }

    assert.strictEqual(DOMUtils._activeObservers.size, 1000);

    for (let i = 0; i < 500; i++) {
      handles[i].disconnect();
      handles[i].disconnect();
    }
    assert.strictEqual(DOMUtils._activeObservers.size, 500);

    DOMUtils.clearAllObservers();
    assert.strictEqual(DOMUtils._activeObservers.size, 0);

    DOMUtils.removeElement(parent);
  });

  runTest("DOMUtils behavior when document / document.body / window are missing or stripped", () => {
    const origDoc = global.document;
    delete global.document;
    delete window.document;

    DOMUtils.addClass("test-no-doc");
    DOMUtils.removeClass("test-no-doc");
    assert.strictEqual(DOMUtils.querySelector("div"), null);
    assert.strictEqual(DOMUtils.querySelectorAll("div").length, 0);
    assert.strictEqual(DOMUtils.createElement("div"), null);
    DOMUtils.appendChild({});

    global.document = origDoc;
    window.document = origDoc;
  });

  // -----------------------------------------------------------------
  // SUITE 3: AudioEngine Adversarial Edge Cases
  // -----------------------------------------------------------------
  console.log("\n--- SUITE 3: AudioEngine Parameter Bounds & Exception Handling ---");

  runTest("AudioEngine handles negative, zero, NaN, Infinity, and non-numeric playTone arguments", () => {
    AudioEngine.playTone(-1000, "sine", -5, -2, -0.5);
    AudioEngine.playTone(NaN, null, undefined, "abc", Infinity);
    AudioEngine.playTone(0, "", 0, 0, 0);
    AudioEngine.playTone(99999, "invalid_type", 100, 100, 100);
  });

  runTest("AudioEngine fanfare and alert methods execute safely without errors", () => {
    AudioEngine.enabled = true;
    AudioEngine.playLevelUp();
    AudioEngine.playBadgeUnlock();
    AudioEngine.playAlarm();
    AudioEngine.playClick();
  });

  runTest("AudioEngine respects enabled = false toggle", () => {
    AudioEngine.enabled = false;
    AudioEngine.playTone(440, "sine", 0.1);
    AudioEngine.playLevelUp();
    AudioEngine.playBadgeUnlock();
    AudioEngine.playAlarm();
    AudioEngine.playClick();
    AudioEngine.enabled = true;
  });

  runTest("AudioEngine gracefully handles AudioContext creation failure or suspension", () => {
    const origCtx = AudioEngine.ctx;
    AudioEngine.ctx = null;

    const origAudioContext = window.AudioContext;
    window.AudioContext = function() {
      throw new Error("AudioContext creation failed");
    };

    AudioEngine.init();
    AudioEngine.playTone(440, "sine", 0.1);

    window.AudioContext = origAudioContext;
    AudioEngine.ctx = origCtx;
  });

  console.log("\n=================================================");
  console.log(`  RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("=================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

runAdversarialSuite();
