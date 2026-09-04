/**
 * Empirical Stress Test Runner for GodMode Extension Audit
 * Challenger 1 Replacement (challenger_final_1_rep)
 * 
 * Tests:
 * 1. 3-tier storage cascade (utils/storage.js) under simulated quota failures, missing APIs, and context invalidation.
 * 2. IPC messaging and options tab deduplication (background/background.js).
 * 3. Web Audio API synthesizer (utils/audio-engine.js) with boundary inputs, suspended state, and disabled toggles.
 */

const assert = require('assert');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '../../');

const { setupMockEnv } = require(path.join(PROJECT_ROOT, 'tests/harness/mock-extension-env'));

async function runEmpiricalTests() {
  console.log('================================================================');
  console.log('    EMPIRICAL STRESS TESTS — challenger_final_1_rep            ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const testResults = [];

  function test(name, fn) {
    try {
      fn();
      passed++;
      testResults.push({ name, pass: true });
      console.log(`  ✓ [PASS] ${name}`);
    } catch (err) {
      failed++;
      testResults.push({ name, pass: false, error: err.message });
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      passed++;
      testResults.push({ name, pass: true });
      console.log(`  ✓ [PASS] ${name}`);
    } catch (err) {
      failed++;
      testResults.push({ name, pass: false, error: err.message });
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  // ----------------------------------------------------------------
  // GROUP 1: 3-TIER STORAGE CASCADE STRESS TESTS
  // ----------------------------------------------------------------
  console.log('--- Group 1: 3-Tier Storage Cascade (utils/storage.js) ---');

  setupMockEnv();
  delete require.cache[require.resolve(path.join(PROJECT_ROOT, 'utils/storage.js'))];
  const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require(path.join(PROJECT_ROOT, 'utils/storage.js'));

  await asyncTest('Storage: Normal read/write via chrome.storage.sync (Tier 1)', async () => {
    StorageUtil.clearMemoryCaches();
    await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, focusMode: false });
    const settings = await StorageUtil.getSettings();
    assert.strictEqual(settings.focusMode, false, 'Should read written focusMode value');
    assert.strictEqual(settings.shortsBlocker, true, 'Default fields retained');
  });

  await asyncTest('Storage: Fallback to Tier 2 (chrome.storage.local) when chrome.storage.sync fails (Quota Exceeded)', async () => {
    StorageUtil.clearMemoryCaches();
    await global.chrome.storage.sync.clear();
    await global.chrome.storage.local.clear();

    const origSyncSet = global.chrome.storage.sync.set;
    const origSyncGet = global.chrome.storage.sync.get;

    global.chrome.storage.sync.set = async () => {
      throw new Error('QUOTA_BYTES_PER_ITEM exceeded');
    };

    const customSettings = { ...DEFAULT_SETTINGS, studyMode: true };
    await StorageUtil.saveSettings(customSettings);

    const localRes = await global.chrome.storage.local.get(['settings']);
    assert.ok(localRes && localRes.settings, 'Settings should fall back to local storage when sync quota fails');
    assert.strictEqual(localRes.settings.studyMode, true, 'Local storage should hold custom studyMode setting');

    global.chrome.storage.sync.get = async () => ({});
    const fetched = await StorageUtil.getSettings();
    assert.strictEqual(fetched.studyMode, true, 'getSettings() falls back to local storage');

    global.chrome.storage.sync.set = origSyncSet;
    global.chrome.storage.sync.get = origSyncGet;
  });

  await asyncTest('Storage: Fallback to Tier 3 (In-Memory Cache) when chrome storage APIs throw/missing', async () => {
    StorageUtil.clearMemoryCaches();
    await global.chrome.storage.sync.clear();
    await global.chrome.storage.local.clear();

    const primedSettings = { ...DEFAULT_SETTINGS, learningGoal: "Master WebExtensions" };
    await StorageUtil.saveSettings(primedSettings);

    const origStorage = global.chrome.storage;
    global.chrome.storage = undefined;

    const fetched = await StorageUtil.getSettings();
    assert.strictEqual(fetched.learningGoal, "Master WebExtensions", 'Should return in-memory cached settings when storage API is missing');

    global.chrome.storage = origStorage;
  });

  await asyncTest('Storage: Default fallback when memory cache cleared and APIs missing', async () => {
    StorageUtil.clearMemoryCaches();
    const origStorage = global.chrome.storage;
    global.chrome.storage = undefined;

    const fetchedSettings = await StorageUtil.getSettings();
    assert.strictEqual(fetchedSettings.extensionEnabled, true, 'Falls back to DEFAULT_SETTINGS extensionEnabled');
    assert.strictEqual(fetchedSettings.shortsBlocker, true, 'Falls back to DEFAULT_SETTINGS shortsBlocker');

    const fetchedTracking = await StorageUtil.getTracking();
    assert.strictEqual(fetchedTracking.weeklyTotal, 0, 'Falls back to DEFAULT_TRACKING weeklyTotal');
    assert.strictEqual(fetchedTracking.gamification.rankId, "bronze_focus", 'Falls back to DEFAULT_TRACKING rankId');

    global.chrome.storage = origStorage;
  });

  await asyncTest('Storage: Partial data deep-merge sanitization', async () => {
    StorageUtil.clearMemoryCaches();
    await global.chrome.storage.sync.clear();
    await global.chrome.storage.local.clear();

    const corruptSettings = {
      shortsBlocker: false,
      uiCleaner: { hideBell: false },
      blockedKeywords: "not-an-array",
      blockedChannels: null
    };

    await global.chrome.storage.sync.set({ settings: corruptSettings });

    const merged = await StorageUtil.getSettings();
    assert.strictEqual(merged.shortsBlocker, false, 'Preserves set scalar value');
    assert.strictEqual(merged.uiCleaner.hideBell, false, 'Preserves set sub-toggle');
    assert.strictEqual(merged.uiCleaner.hideChat, true, 'Populates default for missing hideChat sub-toggle');
    assert.ok(Array.isArray(merged.blockedKeywords), 'Sanitizes corrupt string into array');
    assert.ok(Array.isArray(merged.blockedChannels), 'Sanitizes null into array');
  });

  await asyncTest('Storage: chrome.storage.onChanged event synchronization', async () => {
    StorageUtil.clearMemoryCaches();
    
    let onChangedListener = null;
    global.chrome.storage.onChanged = {
      addListener: (fn) => { onChangedListener = fn; },
      removeListener: () => {}
    };

    delete require.cache[require.resolve(path.join(PROJECT_ROOT, 'utils/storage.js'))];
    const { StorageUtil: FreshStorageUtil } = require(path.join(PROJECT_ROOT, 'utils/storage.js'));

    const newSettings = { ...DEFAULT_SETTINGS, extensionEnabled: false };
    
    assert.ok(onChangedListener, 'Listener attached on module load');
    onChangedListener({ settings: { newValue: newSettings } }, 'sync');

    // Strip storage API to ensure getSettings reads directly from memory cache updated by onChanged
    const origStorage = global.chrome.storage;
    global.chrome.storage = undefined;

    const currentCached = await FreshStorageUtil.getSettings();
    assert.strictEqual(currentCached.extensionEnabled, false, 'Memory cache synchronized via storage.onChanged');

    global.chrome.storage = origStorage;
  });


  // ----------------------------------------------------------------
  // GROUP 2: IPC MESSAGING & OPTIONS TAB DEDUPLICATION STRESS TESTS
  // ----------------------------------------------------------------
  console.log('\n--- Group 2: IPC Messaging & Tab Deduplication (background/background.js) ---');

  setupMockEnv();
  delete require.cache[require.resolve(path.join(PROJECT_ROOT, 'utils/storage.js'))];
  delete require.cache[require.resolve(path.join(PROJECT_ROOT, 'background/background.js'))];

  let onMessageListener = null;
  global.chrome.runtime.onMessage.addListener = (fn) => { onMessageListener = fn; };

  const { StorageUtil: StorageForIPC } = require(path.join(PROJECT_ROOT, 'utils/storage.js'));
  require(path.join(PROJECT_ROOT, 'background/background.js'));

  await asyncTest('IPC: "getSettings" request returns current settings', async () => {
    StorageForIPC.clearMemoryCaches();
    await StorageForIPC.saveSettings({ ...DEFAULT_SETTINGS, focusReminderInterval: 45 });
    
    assert.ok(onMessageListener, 'onMessage listener attached');

    let responseData = null;
    onMessageListener({ action: 'getSettings' }, {}, (res) => {
      responseData = res;
    });

    await new Promise(r => setTimeout(r, 20));
    assert.ok(responseData, 'Received response from getSettings handler');
    assert.strictEqual(responseData.focusReminderInterval, 45, 'Returns updated setting value');
  });

  await asyncTest('IPC: "getTracking" request returns tracking data', async () => {
    StorageForIPC.clearMemoryCaches();
    await StorageForIPC.saveTracking({ ...DEFAULT_TRACKING, weeklyTotal: 120 });
    
    let responseData = null;
    onMessageListener({ action: 'getTracking' }, {}, (res) => {
      responseData = res;
    });

    await new Promise(r => setTimeout(r, 20));
    assert.ok(responseData, 'Received response from getTracking handler');
    assert.strictEqual(responseData.weeklyTotal, 120, 'Returns correct tracking data');
  });

  await asyncTest('IPC Tab Deduplication: Creates NEW options tab when none exists', async () => {
    let createdUrl = null;
    global.chrome.tabs.query = (queryObj, callback) => callback([]); // no open options tab
    global.chrome.tabs.create = (createObj, callback) => {
      createdUrl = createObj.url;
      callback({ id: 101, url: createObj.url });
    };

    let responseData = null;
    onMessageListener({ action: 'openOptionsPage' }, {}, (res) => {
      responseData = res;
    });

    await new Promise(r => setTimeout(r, 20));
    assert.ok(createdUrl && createdUrl.includes('options/options.html'), 'Created new options tab');
    assert.strictEqual(responseData.reused, false, 'Indicates reused: false when opening new tab');
    assert.strictEqual(responseData.tabId, 101, 'Returns created tabId');
  });

  await asyncTest('IPC Tab Deduplication: REUSES existing options tab when already open', async () => {
    const existingTab = { id: 202, windowId: 5, url: 'chrome-extension://abc/options/options.html' };
    let updatedTabId = null;
    let focusedWindowId = null;

    global.chrome.tabs.query = (queryObj, callback) => callback([existingTab]);
    global.chrome.tabs.update = (tabId, updateObj, callback) => {
      updatedTabId = tabId;
      callback({ ...existingTab, active: true });
    };
    global.chrome.windows = {
      update: (winId, winObj, callback) => {
        focusedWindowId = winId;
        callback({ id: winId });
      }
    };

    let responseData = null;
    onMessageListener({ action: 'openOptionsPage' }, {}, (res) => {
      responseData = res;
    });

    await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(updatedTabId, 202, 'Activated existing options tab ID 202');
    assert.strictEqual(focusedWindowId, 5, 'Focused window ID 5 containing existing options tab');
    assert.strictEqual(responseData.reused, true, 'Indicates reused: true');
    assert.strictEqual(responseData.tabId, 202, 'Returns existing tab ID');
  });

  await asyncTest('IPC Tab Deduplication: Graceful fallback to openNewTab on tab activation error', async () => {
    const closedTab = { id: 303, windowId: 8, url: 'chrome-extension://abc/options/options.html' };
    let newTabCreated = false;

    global.chrome.tabs.query = (queryObj, callback) => callback([closedTab]);
    global.chrome.tabs.update = (tabId, updateObj, callback) => {
      global.chrome.runtime.lastError = { message: 'No tab with id: 303.' };
      callback(undefined);
    };
    global.chrome.tabs.create = (createObj, callback) => {
      newTabCreated = true;
      global.chrome.runtime.lastError = undefined;
      callback({ id: 404, url: createObj.url });
    };

    let responseData = null;
    onMessageListener({ action: 'openOptionsPage' }, {}, (res) => {
      responseData = res;
    });

    await new Promise(r => setTimeout(r, 20));
    assert.ok(newTabCreated, 'Falls back to openNewTab when activating stale tab fails');
    assert.strictEqual(responseData.reused, false, 'reused is false for fallback creation');
    assert.strictEqual(responseData.tabId, 404, 'Returns new tab ID 404');

    global.chrome.runtime.lastError = undefined;
  });


  // ----------------------------------------------------------------
  // GROUP 3: WEB AUDIO API SYNTHESIZER STRESS TESTS
  // ----------------------------------------------------------------
  console.log('\n--- Group 3: Web Audio API Synthesizer (utils/audio-engine.js) ---');

  setupMockEnv();
  delete require.cache[require.resolve(path.join(PROJECT_ROOT, 'utils/audio-engine.js'))];
  const AudioEngine = require(path.join(PROJECT_ROOT, 'utils/audio-engine.js'));

  test('AudioEngine: Instantiates and initializes correctly', () => {
    assert.ok(AudioEngine, 'AudioEngine object exported');
    assert.strictEqual(AudioEngine.enabled, true, 'AudioEngine enabled by default');
  });

  test('AudioEngine: Respects enabled=false toggle without creating tones or erroring', () => {
    AudioEngine.enabled = false;
    let tonePlayed = false;
    const origPlayTone = AudioEngine.playTone;
    AudioEngine.playTone = () => { tonePlayed = true; };

    AudioEngine.playLevelUp();
    AudioEngine.playBadgeUnlock();
    AudioEngine.playAlarm();
    AudioEngine.playClick();

    assert.strictEqual(tonePlayed, false, 'No tones played when enabled = false');
    AudioEngine.enabled = true;
    AudioEngine.playTone = origPlayTone;
  });

  await asyncTest('AudioEngine: Gesture Unlock event handling when AudioContext is suspended', async () => {
    let listenersAdded = {};

    global.window.addEventListener = (event, fn, useCapture) => {
      listenersAdded[event] = fn;
    };
    global.window.removeEventListener = (event, fn, useCapture) => {
      delete listenersAdded[event];
    };

    AudioEngine.ctx = {
      state: 'suspended',
      resume: async () => {
        AudioEngine.ctx.state = 'running';
      }
    };

    AudioEngine.attachGestureUnlock();
    assert.ok(listenersAdded['click'], 'Attached click gesture listener');
    assert.ok(listenersAdded['keydown'], 'Attached keydown gesture listener');

    listenersAdded['click']();
    await new Promise(r => setTimeout(r, 20));
    
    assert.strictEqual(listenersAdded['click'], undefined, 'Click listener removed after gesture unlock');
    assert.strictEqual(listenersAdded['keydown'], undefined, 'Keydown listener removed after gesture unlock');
  });

  test('AudioEngine: Boundary parameters in playTone (negative, NaN, zero, string inputs)', () => {
    let oscCreated = false;
    let startFreq = 0;
    let stopDuration = 0;
    let startGain = 0;

    AudioEngine.ctx = {
      state: 'running',
      currentTime: 100,
      createOscillator: () => ({
        type: 'sine',
        frequency: { setValueAtTime: (val) => { startFreq = val; } },
        connect: () => {},
        start: () => { oscCreated = true; },
        stop: (time) => { stopDuration = time - 100; },
        disconnect: () => {}
      }),
      createGain: () => ({
        gain: {
          setValueAtTime: (val) => { startGain = val; },
          exponentialRampToValueAtTime: () => {}
        },
        connect: () => {},
        disconnect: () => {}
      }),
      destination: {}
    };

    AudioEngine.playTone(-500, 'sine', 0.2, 0, 0.1);
    assert.ok(oscCreated, 'Oscillator created with negative freq');
    assert.strictEqual(startFreq, 20, 'Negative frequency clamped to 20Hz');

    oscCreated = false;
    AudioEngine.playTone(NaN, 'triangle', -5, 0, NaN);
    assert.ok(oscCreated, 'Oscillator created with NaN inputs');
    assert.strictEqual(startFreq, 440, 'NaN frequency defaults to 440Hz');
    assert.ok(Math.abs(stopDuration - 0.01) < 0.0001, 'Negative duration clamped to 0.01s');
    assert.strictEqual(startGain, 0.1, 'NaN gain defaults to 0.1');

    AudioEngine.playLevelUp();
    AudioEngine.playBadgeUnlock();
    AudioEngine.playAlarm();
    AudioEngine.playClick();
  });

  console.log('\n================================================================');
  console.log(`EMPIRICAL STRESS TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runEmpiricalTests().catch(err => {
    console.error('Empirical tests failed with exception:', err);
    process.exit(1);
  });
}

module.exports = { runEmpiricalTests };
