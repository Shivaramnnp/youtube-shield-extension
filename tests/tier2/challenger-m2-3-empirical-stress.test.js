/**
 * Challenger M2 Storage Memory Cache Empirical Stress Test Suite (Tier 2)
 */

const { test, describe, assert, resetStorage } = require('../harness/test-helpers');
const { setupMockEnv } = require('../harness/mock-extension-env');
const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../../utils/storage');

describe('Challenger M2-3: Storage Memory Cache Retention', () => {

  test('Verify memorySettingsCache retention when chrome.storage.sync & local return {} or throw', async () => {
    setupMockEnv();
    await resetStorage();
    StorageUtil.clearMemoryCache();

    // 1. Populate memorySettingsCache
    const customSettings = { ...DEFAULT_SETTINGS, learningGoal: "Quantum Computing Challenger", shortsBlocker: false };
    await StorageUtil.saveSettings(customSettings);

    // Verify memory cache populated
    const cachedFirst = await StorageUtil.getSettings();
    assert.equal(cachedFirst.learningGoal, "Quantum Computing Challenger");

    // 2. Simulate sync & local returning empty objects {}
    const origSyncGet = global.chrome.storage.sync.get;
    const origLocalGet = global.chrome.storage.local.get;

    global.chrome.storage.sync.get = async () => ({});
    global.chrome.storage.local.get = async () => ({});

    try {
      const res1 = await StorageUtil.getSettings();
      assert.equal(res1.learningGoal, "Quantum Computing Challenger", "Memory settings cache must be preserved on empty object returns");
      assert.equal(res1.shortsBlocker, false);

      // 3. Simulate sync & local throwing errors
      global.chrome.storage.sync.get = async () => { throw new Error("Sync read error"); };
      global.chrome.storage.local.get = async () => { throw new Error("Local read error"); };

      const res2 = await StorageUtil.getSettings();
      assert.equal(res2.learningGoal, "Quantum Computing Challenger", "Memory settings cache must be preserved on storage throw");

      // 4. Immutability check: modifying returned object should not corrupt memory cache
      res2.learningGoal = "Corrupted Value";
      const res3 = await StorageUtil.getSettings();
      assert.equal(res3.learningGoal, "Quantum Computing Challenger", "Memory settings cache must return deep clones");
    } finally {
      global.chrome.storage.sync.get = origSyncGet;
      global.chrome.storage.local.get = origLocalGet;
    }
  });

  test('Verify memoryTrackingCache retention when chrome.storage.local returns {} or throws', async () => {
    setupMockEnv();
    await resetStorage();
    StorageUtil.clearMemoryCache();

    // 1. Populate memoryTrackingCache
    const customTracking = { ...DEFAULT_TRACKING, weeklyTotal: 99999, monthlyTotal: 500000 };
    await StorageUtil.saveTracking(customTracking);

    const origLocalGet = global.chrome.storage.local.get;

    try {
      // 2. Simulate local returning {}
      global.chrome.storage.local.get = async () => ({});

      const tracking1 = await StorageUtil.getTracking();
      assert.equal(tracking1.weeklyTotal, 99999, "Memory tracking cache must be preserved when local storage returns {}");
      assert.equal(tracking1.monthlyTotal, 500000);

      // 3. Simulate local throwing error
      global.chrome.storage.local.get = async () => { throw new Error("Disk corruption error"); };

      const tracking2 = await StorageUtil.getTracking();
      assert.equal(tracking2.weeklyTotal, 99999, "Memory tracking cache must be preserved when local storage throws");

      // 4. Immutability check
      tracking2.weeklyTotal = 0;
      const tracking3 = await StorageUtil.getTracking();
      assert.equal(tracking3.weeklyTotal, 99999, "Memory tracking cache must return deep clones");
    } finally {
      global.chrome.storage.local.get = origLocalGet;
    }
  });

  test('Verify behavior on completely null/undefined chrome.storage API or context invalidation', async () => {
    setupMockEnv();
    await resetStorage();
    StorageUtil.clearMemoryCache();

    // Save initial state
    await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, learningGoal: "Offline Goal" });
    await StorageUtil.saveTracking({ ...DEFAULT_TRACKING, weeklyTotal: 4321 });

    const origStorage = global.chrome.storage;
    const origId = global.chrome.runtime.id;

    try {
      // Destroy storage API & invalidate context
      delete global.chrome.storage;
      delete global.chrome.runtime.id;

      const s = await StorageUtil.getSettings();
      assert.equal(s.learningGoal, "Offline Goal", "Settings memory cache retained when chrome.storage deleted");

      const t = await StorageUtil.getTracking();
      assert.equal(t.weeklyTotal, 4321, "Tracking memory cache retained when chrome.storage deleted");
    } finally {
      global.chrome.storage = origStorage;
      global.chrome.runtime.id = origId;
    }
  });

});
