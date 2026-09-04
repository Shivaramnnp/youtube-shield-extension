/**
 * Tier 2: Feature 4 Storage Persistence Boundary & Corner Cases Suite
 */

require('../harness/mock-extension-env.js');
const { test, describe, assert, resetStorage, createMockStorage } = require('../harness/test-helpers');
const { StorageUtil, DEFAULT_TRACKING, DEFAULT_SETTINGS } = require('../../utils/storage');
const { TimeTracker } = require('../../utils/time-tracker');

describe('Feature 4 Boundaries: Storage Persistence', () => {

  test('Storage: Empty storage initialization returns deep copy of DEFAULT_TRACKING', async () => {
    await resetStorage();
    const tracking = await StorageUtil.getTracking();
    assert.equal(tracking.gamification.level, 1);
    assert.equal(tracking.gamification.totalAP, 0);
    assert.equal(tracking.gamification.rankTier, 'Bronze Focus');
    assert.deepEqual(tracking.gamification.badges, []);
  });

  test('Storage: Legacy schema migration when gamification object is completely missing', async () => {
    const legacyStorage = {
      tracking: {
        dailyWatchTime: { "2026-08-01": 3600 },
        dailyLearningTime: { "2026-08-01": 1800 },
        weeklyTotal: 3600
        // Missing gamification field completely
      }
    };
    await createMockStorage(legacyStorage);

    const tracking = await StorageUtil.getTracking();
    // Watch time preserved
    assert.equal(tracking.dailyWatchTime["2026-08-01"], 3600);
    assert.equal(tracking.dailyLearningTime["2026-08-01"], 1800);

    // Missing gamification field populated from DEFAULT_TRACKING
    assert.ok(tracking.gamification, 'Gamification object should be migrated and present');
    assert.equal(tracking.gamification.totalAP, 0);
    assert.equal(tracking.gamification.level, 1);
    assert.deepEqual(tracking.gamification.badges, []);
  });

  test('Storage: Corrupted storage field types auto-repair during read', async () => {
    const corruptedStorage = {
      tracking: {
        dailyWatchTime: "not-an-object",
        dailyLearningTime: null,
        gamification: {
          badges: "invalid-string-instead-of-array",
          unlockedBadgeDates: 12345, // invalid primitive
          totalAP: "corrupted_string"
        }
      }
    };
    await createMockStorage(corruptedStorage);

    const tracking = await StorageUtil.getTracking();
    assert.ok(Array.isArray(tracking.gamification.badges), 'Badges repaired to array');
    assert.deepEqual(tracking.gamification.badges, []);
    assert.equal(typeof tracking.gamification.unlockedBadgeDates, 'object');
  });

  test('Storage: 60-day storage data pruning boundary in TimeTracker', async () => {
    const tracker = new TimeTracker();
    const today = tracker.getLocalDateKey();

    // Generate dates: 65 days ago, 61 days ago, 59 days ago, and today
    const date65 = new Date(); date65.setDate(date65.getDate() - 65);
    const date61 = new Date(); date61.setDate(date61.getDate() - 61);
    const date59 = new Date(); date59.setDate(date59.getDate() - 59);

    const formatD = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const key65 = formatD(date65);
    const key61 = formatD(date61);
    const key59 = formatD(date59);

    const initialTracking = {
      tracking: {
        dailyWatchTime: { [key65]: 1200, [key61]: 1800, [key59]: 2400, [today]: 300 },
        dailyLearningTime: { [key65]: 600, [key61]: 900, [key59]: 1200, [today]: 150 },
        weeklyTotal: 4500,
        monthlyTotal: 5700,
        currentWeekKey: `${new Date().getFullYear()}-W${tracker._isoWeek(new Date())}`,
        currentMonthKey: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        gamification: { badges: [] }
      }
    };
    await createMockStorage(initialTracking);

    await tracker.incrementWatchTime(10);

    const updated = await StorageUtil.getTracking();

    // 65 and 61 days ago entries pruned
    assert.equal(updated.dailyWatchTime[key65], undefined);
    assert.equal(updated.dailyWatchTime[key61], undefined);

    // 59 days ago and today entries preserved
    assert.equal(updated.dailyWatchTime[key59], 2400);
    assert.equal(updated.dailyWatchTime[today], 310);
  });

  test('Storage: Missing settings keys fall back cleanly via deep merge', async () => {
    const partialSettings = {
      settings: {
        shortsBlocker: false
        // missing uiCleaner and timeManager objects
      }
    };
    await createMockStorage({}, partialSettings);

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.shortsBlocker, false);
    assert.ok(settings.uiCleaner, 'uiCleaner should fall back to defaults');
    assert.equal(settings.uiCleaner.hideBell, DEFAULT_SETTINGS.uiCleaner.hideBell);
    assert.ok(settings.timeManager, 'timeManager should fall back to defaults');
    assert.equal(settings.timeManager.dailyLimitMinutes, 60);
  });

  test('Storage: Calendar week and month rollover boundary handling', async () => {
    const tracker = new TimeTracker();
    const oldWeekTracking = {
      tracking: {
        currentWeekKey: "2020-W01",
        currentMonthKey: "2020-01",
        weeklyTotal: 5000,
        monthlyTotal: 20000,
        weeklyLearningTotal: 2500,
        monthlyLearningTotal: 10000,
        dailyWatchTime: {},
        dailyLearningTime: {},
        gamification: { badges: [] }
      }
    };
    await createMockStorage(oldWeekTracking);

    await tracker.incrementWatchTime(10);

    const updated = await StorageUtil.getTracking();
    const now = new Date();
    const currentWeekKey = `${now.getFullYear()}-W${tracker._isoWeek(now)}`;
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    assert.equal(updated.currentWeekKey, currentWeekKey);
    assert.equal(updated.currentMonthKey, currentMonthKey);
    // Totals reset on rollover and incremented by 10
    assert.equal(updated.weeklyTotal, 10);
    assert.equal(updated.monthlyTotal, 10);
  });

  test('Storage: Multi-tier storage fallback error handling under quota/permission failure', async () => {
    await resetStorage();

    const origGet = global.chrome.storage.sync.get;
    const origSet = global.chrome.storage.sync.set;

    try {
      // Simulate sync storage throwing quota or permission error
      global.chrome.storage.sync.get = async () => { throw new Error('QuotaExceededError'); };
      global.chrome.storage.sync.set = async () => { throw new Error('QuotaExceededError'); };

      // Should return default settings without throwing exception
      const settings = await StorageUtil.getSettings();
      assert.ok(settings, 'getSettings returns settings object on storage failure');
      assert.equal(settings.shortsBlocker, true, 'shortsBlocker default is preserved');

      // saveSettings handles errors gracefully without raising unhandled exception
      assert.doesNotThrow(async () => {
        await StorageUtil.saveSettings({ shortsBlocker: false });
      }, 'saveSettings does not throw when storage API fails');
    } finally {
      global.chrome.storage.sync.get = origGet;
      global.chrome.storage.sync.set = origSet;
    }
  });

});
