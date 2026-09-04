/**
 * Shared Test Assertion and State Reset Utilities for Shorts Shield E2E Test Harness.
 */

const assert = require('node:assert/strict');
const { setupMockEnv } = require('./mock-extension-env');

const currentSuiteResults = [];
let suitePromiseChain = Promise.resolve();

function test(name, fn) {
  if (!global.chrome || !global.chrome.storage) {
    setupMockEnv();
  }

  const p = suitePromiseChain.then(async () => {
    await resetStorage();
    resetDOM();

    const start = Date.now();
    try {
      await fn();
      const duration = Date.now() - start;
      const result = { name, success: true, duration, error: null };
      currentSuiteResults.push(result);
      if (global._testCollector) {
        global._testCollector.push(result);
      } else {
        console.log(`  ✓ ${name} (${duration}ms)`);
      }
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      const result = { name, success: false, duration, error: err };
      currentSuiteResults.push(result);
      if (global._testCollector) {
        global._testCollector.push(result);
      } else {
        console.error(`  ❌ ${name} (${duration}ms):`, err.message);
      }
      return result;
    }
  });

  suitePromiseChain = p.catch(() => {});

  if (global._pendingTestPromises) {
    global._pendingTestPromises.push(p);
  }

  return p;
}

async function describe(suiteName, fn) {
  if (!global._testCollector) {
    console.log(`\n📦 Suite: ${suiteName}`);
  }
  await fn();
}

/**
 * Resets storage (chrome.storage.local & chrome.storage.sync) to clean empty states or default gamification schema.
 * @param {Object} [defaultData] Optional initial data to populate into local storage
 */
async function resetStorage(defaultData = null) {
  if (!global.chrome || !global.chrome.storage) {
    setupMockEnv();
  }
  await global.chrome.storage.local.clear();
  await global.chrome.storage.sync.clear();

  if (global.StorageUtil && global.StorageUtil.DEFAULT_TRACKING) {
    global.StorageUtil.DEFAULT_TRACKING.dailyWatchTime = {};
    global.StorageUtil.DEFAULT_TRACKING.dailyLearningTime = {};
    global.StorageUtil.DEFAULT_TRACKING.weeklyTotal = 0;
    global.StorageUtil.DEFAULT_TRACKING.monthlyTotal = 0;
    global.StorageUtil.DEFAULT_TRACKING.weeklyLearningTotal = 0;
    global.StorageUtil.DEFAULT_TRACKING.monthlyLearningTotal = 0;
    global.StorageUtil.DEFAULT_TRACKING.activeSessionStart = 0;
    global.StorageUtil.DEFAULT_TRACKING.lastReminderTriggered = 0;
    global.StorageUtil.DEFAULT_TRACKING.gamification = {
      currentStreak: 0,
      longestStreak: 0,
      lastLearningDate: null,
      highFocusStreak: 0,
      totalBlockedShorts: 0,
      badges: [],
      unlockedBadgeDates: {},
      totalAP: 0,
      totalEXP: 0,
      level: 1,
      expProgressPct: 0,
      rankId: "bronze_focus",
      rankTitle: "Bronze Focus",
      rankTier: "Bronze Focus"
    };
  }

  if (defaultData) {
    await global.chrome.storage.local.set(defaultData);
  }
}

/**
 * Creates and populates mock storage with specific user state.
 * @param {Object} localStorageData Map of key-value pairs for chrome.storage.local
 * @param {Object} syncStorageData Map of key-value pairs for chrome.storage.sync
 */
async function createMockStorage(localStorageData = {}, syncStorageData = {}) {
  await resetStorage();
  if (Object.keys(localStorageData).length > 0) {
    await global.chrome.storage.local.set(localStorageData);
  }
  if (Object.keys(syncStorageData).length > 0) {
    await global.chrome.storage.sync.set(syncStorageData);
  }
}

/**
 * Resets document body and head elements.
 */
function resetDOM() {
  if (global.document && global.document.documentElement) {
    global.document.documentElement.className = '';
  }
  if (global.document && global.document.body) {
    global.document.body.children = [];
    global.document.body.className = '';
    global.document.body.id = '';
    global.document.body.innerHTML = '';
  }
  if (global.document && global.document.head) {
    global.document.head.children = [];
    global.document.head.className = '';
    global.document.head.id = '';
    global.document.head.innerHTML = '';
  }
  const w = global.window || global;
  if (w.FocusMode && typeof w.FocusMode.disable === 'function') w.FocusMode.disable();
  if (w.HeaderButton && typeof w.HeaderButton.disable === 'function') w.HeaderButton.disable();
  if (w.FeedController && typeof w.FeedController.disable === 'function') w.FeedController.disable();
  if (w.StudyMode && typeof w.StudyMode.disable === 'function') w.StudyMode.disable();
  if (w.GoalMode && typeof w.GoalMode.disable === 'function') w.GoalMode.disable();
  if (w.TimeManager && typeof w.TimeManager.disable === 'function') w.TimeManager.disable();
  if (w.ShortsBlocker && typeof w.ShortsBlocker.disable === 'function') w.ShortsBlocker.disable();
  if (w.AdSkipper && typeof w.AdSkipper.disable === 'function') w.AdSkipper.disable();
  if (w.VolumeBooster && typeof w.VolumeBooster.teardown === 'function') w.VolumeBooster.teardown();
  if (w.AudioEngine && typeof w.AudioEngine.teardown === 'function') w.AudioEngine.teardown();
  if (w.QuickBlock && typeof w.QuickBlock.disable === 'function') w.QuickBlock.disable();
  if (global.QuickBlock && typeof global.QuickBlock.disable === 'function') global.QuickBlock.disable();
  if (typeof window !== 'undefined' && window.QuickBlock && typeof window.QuickBlock.disable === 'function') window.QuickBlock.disable();
  if (global.AdSkipper && w) w.AdSkipper = global.AdSkipper;
  if (global.location) {
    global.location.href = 'https://www.youtube.com/';
    global.location.pathname = '/';
    global.location.search = '';
  }
}

/**
 * Simulates passage of time for watch time or study time trackers.
 * @param {number} seconds Number of seconds passed
 * @param {Object} [trackerInstance] TimeTracker instance to advance
 */
function simulateTimePassed(seconds, trackerInstance = null) {
  if (trackerInstance && typeof trackerInstance.accumulateTime === 'function') {
    trackerInstance.accumulateTime(seconds);
  } else if (global.TimeTrackerInstance && typeof global.TimeTrackerInstance.accumulateTime === 'function') {
    global.TimeTrackerInstance.accumulateTime(seconds);
  }
}

/**
 * Helper to assert gamification storage parameters.
 * @param {Object} expected Expected fields (totalAP, level, rankTier, badges, etc.)
 */
async function assertGamificationData(expected = {}) {
  const result = await global.chrome.storage.local.get('tracking');
  const gamification = (result.tracking && result.tracking.gamification) ? result.tracking.gamification : {};

  if ('totalAP' in expected) {
    assert.equal(gamification.totalAP, expected.totalAP, `Expected totalAP to be ${expected.totalAP}, got ${gamification.totalAP}`);
  }
  if ('totalEXP' in expected) {
    assert.equal(gamification.totalEXP, expected.totalEXP, `Expected totalEXP to be ${expected.totalEXP}, got ${gamification.totalEXP}`);
  }
  if ('level' in expected) {
    assert.equal(gamification.level, expected.level, `Expected level to be ${expected.level}, got ${gamification.level}`);
  }
  if ('rankTier' in expected) {
    assert.equal(gamification.rankTier, expected.rankTier, `Expected rankTier to be ${expected.rankTier}, got ${gamification.rankTier}`);
  }
  if ('badge' in expected) {
    assert.ok(Array.isArray(gamification.badges) && gamification.badges.includes(expected.badge), `Expected badge ${expected.badge} in badges list`);
  }
  if ('badgeCount' in expected) {
    assert.equal(gamification.badges ? gamification.badges.length : 0, expected.badgeCount, `Expected badge count ${expected.badgeCount}`);
  }
}

module.exports = {
  assert,
  test,
  it: test,
  describe,
  resetStorage,
  createMockStorage,
  resetDOM,
  simulateTimePassed,
  assertGamificationData,
  getResults: () => currentSuiteResults
};
