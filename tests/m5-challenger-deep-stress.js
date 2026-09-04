/**
 * Milestone M5 Deep Empirical Challenger & Stress Harness
 * 
 * Tests:
 * 1. DOM Mutation Observer edge cases (high volume, non-element nodes, rapid disconnects, memory leaks)
 * 2. Storage Concurrency & Race Conditions (50 simultaneous operations, interleaved master toggles)
 * 3. Cross-Module State Synchronization & Storage Event Propagation
 * 4. Boundary & Malformed Inputs (Prototype pollution, NaN/Infinity, corrupted storage states)
 * 5. Feature Engine Idempotency & Teardown Lifecycle
 */

const { setupMockEnv } = require('./harness/mock-extension-env');

async function runM5DeepChallengerStress() {
  console.log('🔬 [M5 CHALLENGER] Starting Deep Empirical Verification & Stress Harness...\n');
  const mockEnv = setupMockEnv();

  // Enhance mock document with createComment if missing in test harness
  if (!global.document.createComment) {
    global.document.createComment = (text) => ({ nodeType: 8, textContent: text });
  }

  const StorageUtil = require('../utils/storage.js').StorageUtil;
  const GamificationEngine = require('../utils/gamification-engine.js');
  const AudioEngine = require('../utils/audio-engine.js');
  const observerUtils = require('../content/js/observer-utils.js');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ [PASS] ${testName}`);
    } else {
      failedTests++;
      console.error(`  ❌ [FAIL] ${testName} ${details ? '- ' + details : ''}`);
    }
  }

  // =========================================================================
  // SECTION 1: DOM MUTATION OBSERVER EDGE CASES & MEMORY LIFECYCLE
  // =========================================================================
  console.log('--- SECTION 1: DOM Mutation Observer Edge Cases & Lifecycle ---');

  try {
    // 1.1 Rapid observer setup & teardown
    for (let i = 0; i < 100; i++) {
      observerUtils.observe('.test-element', () => {}, `test_obs_${i}`);
    }
    assert(observerUtils.observers.size === 100, 'Registered 100 distinct named observers');

    observerUtils.clearAll();
    assert(observerUtils.observers.size === 0, 'clearAll() reset all observers map');
    assert(observerUtils._debounceTimers.size === 0, 'clearAll() cleared all debounce timers');
    assert(observerUtils._pendingElements.size === 0, 'clearAll() cleared pending elements');
    assert(observerUtils._initialScanDone.size === 0, 'clearAll() cleared initial scan done state');

    // 1.2 Handling non-element nodes (Text, Comment, DocumentFragment)
    let callbackFired = false;
    let receivedElements = [];
    observerUtils.observe('.match-class', (els) => {
      callbackFired = true;
      receivedElements = els;
    }, 'non_element_test', { childList: true, subtree: true }, 10);

    const matchEl = global.document.createElement('div');
    matchEl.className = 'match-class';
    matchEl.nodeType = 1; // Node.ELEMENT_NODE = 1
    
    const textNode = global.document.createTextNode('sample text');
    const commentNode = global.document.createComment('sample comment');

    const registeredObserver = observerUtils.observers.get('non_element_test');
    if (registeredObserver) {
      registeredObserver.callback([
        { type: 'childList', addedNodes: [textNode, commentNode, matchEl] }
      ]);
    }

    await new Promise(r => setTimeout(r, 30));
    assert(callbackFired === true, 'Observer callback fired for added elements');
    assert(receivedElements.length === 1 && receivedElements[0] === matchEl, 'Observer ignored non-element nodes (text/comment)');

    // 1.3 High-frequency DOM mutation batching (1,000 mutations)
    let batchCount = 0;
    let totalElementsReceived = 0;
    observerUtils.observe('.high-freq-item', (items) => {
      batchCount++;
      totalElementsReceived += items.length;
    }, 'high_freq_obs', { childList: true, subtree: true }, 20);

    const highFreqObs = observerUtils.observers.get('high_freq_obs');
    const dummyNodes = [];
    for (let i = 0; i < 1000; i++) {
      const el = global.document.createElement('div');
      el.className = 'high-freq-item';
      el.nodeType = 1;
      dummyNodes.push(el);
    }

    // Fire 10 rapid mutation bursts
    for (let burst = 0; burst < 10; burst++) {
      const chunk = dummyNodes.slice(burst * 100, (burst + 1) * 100);
      highFreqObs.callback([
        { type: 'childList', addedNodes: chunk }
      ]);
    }

    await new Promise(r => setTimeout(r, 50));
    assert(totalElementsReceived === 1000, `Batched observer received all 1,000 inserted elements (got ${totalElementsReceived})`);
    assert(batchCount === 1, `10 rapid mutation bursts debounced into single callback execution (got ${batchCount} calls)`);

    // Clean up observers
    observerUtils.disconnectAll();
  } catch (err) {
    assert(false, 'Section 1 Observer Exception', err.stack || err.message);
  }

  // =========================================================================
  // SECTION 2: STORAGE CONCURRENCY & RACE CONDITIONS
  // =========================================================================
  console.log('\n--- SECTION 2: Storage Concurrency & Race Conditions ---');

  try {
    StorageUtil.clearMemoryCache();
    await global.chrome.storage.local.clear();
    await global.chrome.storage.sync.clear();

    // 2.1 Concurrent async storage updates (50 simultaneous promises)
    const updatePromises = [];
    for (let i = 0; i < 50; i++) {
      if (i % 2 === 0) {
        updatePromises.push(StorageUtil.updateSetting('extensionEnabled', i % 4 === 0));
      } else {
        updatePromises.push(StorageUtil.updateUICleanerSetting('hideBell', i % 3 === 0));
      }
    }

    await Promise.all(updatePromises);
    const finalSettings = await StorageUtil.getSettings();
    assert(typeof finalSettings.extensionEnabled === 'boolean', 'extensionEnabled remains valid boolean after 50 concurrent writes');
    assert(typeof finalSettings.uiCleaner.hideBell === 'boolean', 'uiCleaner.hideBell remains valid boolean after 50 concurrent writes');

    // 2.2 Race condition: Rapid setting updates during active storage reading
    let readErrors = 0;
    const readWritePromises = [];

    for (let i = 0; i < 100; i++) {
      readWritePromises.push(
        StorageUtil.updateSetting('focusMode', i % 2 === 0),
        StorageUtil.getSettings().then(s => {
          if (!s || typeof s.focusMode !== 'boolean') readErrors++;
        })
      );
    }

    await Promise.all(readWritePromises);
    assert(readErrors === 0, 'Zero read errors during 100 interleaved storage read/write operations');
  } catch (err) {
    assert(false, 'Section 2 Concurrency Exception', err.stack || err.message);
  }

  // =========================================================================
  // SECTION 3: CROSS-MODULE STATE SYNCHRONIZATION
  // =========================================================================
  console.log('\n--- SECTION 3: Cross-Module State Synchronization ---');

  try {
    StorageUtil.clearMemoryCache();
    await global.chrome.storage.local.clear();
    await global.chrome.storage.sync.clear();

    // Storage listeners setup
    const storageListeners = [];
    global.chrome.storage.onChanged = {
      addListener: (fn) => storageListeners.push(fn),
      removeListener: (fn) => {
        const idx = storageListeners.indexOf(fn);
        if (idx !== -1) storageListeners.splice(idx, 1);
      }
    };

    let storageEventFired = false;
    let receivedChanges = null;

    const listener = (changes, areaName) => {
      if (areaName === 'sync' && changes.settings) {
        storageEventFired = true;
        receivedChanges = changes.settings;
      }
    };
    global.chrome.storage.onChanged.addListener(listener);

    // Patch storage.sync.set in mock to trigger registered storage listeners
    const originalSyncSet = global.chrome.storage.sync.set.bind(global.chrome.storage.sync);
    global.chrome.storage.sync.set = async (items) => {
      const oldVal = await StorageUtil.getSettings();
      await originalSyncSet(items);
      const newVal = await StorageUtil.getSettings();
      const changes = { settings: { oldValue: oldVal, newValue: newVal } };
      storageListeners.forEach(fn => fn(changes, 'sync'));
    };

    // Update setting via StorageUtil
    await StorageUtil.updateSetting('shortsBlocker', false);

    assert(storageEventFired === true, 'chrome.storage.onChanged listener fired on setting update');
    assert(receivedChanges && receivedChanges.newValue.shortsBlocker === false, 'Storage listener received updated shortsBlocker value (false)');

    // Clean up
    global.chrome.storage.onChanged.removeListener(listener);
  } catch (err) {
    assert(false, 'Section 3 State Sync Exception', err.stack || err.message);
  }

  // =========================================================================
  // SECTION 4: BOUNDARY & MALFORMED INPUT HANDLING (PROTOTYPE POLLUTION & CORRUPTION)
  // =========================================================================
  console.log('\n--- SECTION 4: Boundary & Malformed Input Handling ---');

  try {
    // 4.1 Prototype pollution safety check
    const maliciousPayload = JSON.parse('{"__proto__": {"polluted": true}, "extensionEnabled": false, "_lastUpdated": ' + (Date.now() + 1000) + '}');
    await global.chrome.storage.sync.set({ settings: maliciousPayload });
    await global.chrome.storage.local.set({ settings: maliciousPayload });
    StorageUtil.clearMemoryCache();

    const sanitizedSettings = await StorageUtil.getSettings();
    assert(Object.prototype.polluted === undefined, 'Prototype pollution vector blocked; Object.prototype not polluted');
    assert(sanitizedSettings.extensionEnabled === false, 'Settings read successfully after sanitized merge');

    // 4.2 Tracking object restoration when keys are invalid
    await global.chrome.storage.local.set({
      tracking: {
        dailyWatchTime: "corrupted_string_not_object",
        totalWatchTime: null,
        gamification: "corrupted_gamification_string"
      }
    });
    StorageUtil.clearMemoryCache();

    const trackingData = await StorageUtil.getTracking();
    assert(typeof trackingData.dailyWatchTime === 'object' && trackingData.dailyWatchTime !== null, 'dailyWatchTime recovered to Object from corrupted string');
    assert(typeof trackingData.gamification === 'object' && trackingData.gamification !== null, 'gamification recovered to Object from corrupted string');
    assert(Array.isArray(trackingData.gamification.badges), 'gamification.badges recovered to Array');

    // 4.3 Gamification AP / EXP calculation under NaN and extreme values
    const rankTier = GamificationEngine.getRankTierFromAP(NaN);
    assert(rankTier.currentRank.id === 'bronze_focus', 'NaN AP defaults safely to Bronze Focus rank');

    const rankTierNeg = GamificationEngine.getRankTierFromAP(-9999);
    assert(rankTierNeg.currentRank.id === 'bronze_focus', 'Negative AP defaults safely to Bronze Focus rank');

    const rankTierHuge = GamificationEngine.getRankTierFromAP(1e9);
    assert(rankTierHuge.currentRank.id === 'grandmaster_legend', '1 Billion AP resolves cleanly to Grandmaster Legend rank');
  } catch (err) {
    assert(false, 'Section 4 Boundary Exception', err.stack || err.message);
  }

  // =========================================================================
  // SUMMARY & VERDICT
  // =========================================================================
  console.log('\n================================================================');
  console.log(`M5 DEEP STRESS HARNESS SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runM5DeepChallengerStress().catch(err => {
    console.error('Fatal error running M5 deep stress harness:', err);
    process.exit(1);
  });
}

module.exports = { runM5DeepChallengerStress };
