const fs = require('fs');
const path = require('path');
const { setupMockEnv } = require('./harness/mock-extension-env');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓ [PASS] ' + msg);
  } else {
    failed++;
    failures.push(msg);
    console.error('  ❌ [FAIL] ' + msg);
  }
}

async function runStorageCascadeStress() {
  console.log('================================================================');
  console.log('=== STARTING 3-TIER STORAGE CASCADE ADVERSARIAL STRESS SUITE ===');
  console.log('================================================================');

  const env = setupMockEnv();
  const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../utils/storage');

  console.log('\n--- Test 1: Normal 3-Tier Storage Sync & Local Operation ---');
  StorageUtil.clearMemoryCache();
  await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, extensionEnabled: true, shortsBlocker: true, focusMode: false });
  let s1 = await StorageUtil.getSettings();
  assert(s1.extensionEnabled === true, 'Settings saved and retrieved');
  assert(s1.focusMode === false, 'Setting focusMode is false');
  assert(typeof s1._lastUpdated === 'number', '_lastUpdated timestamp attached on save');

  console.log('\n--- Test 2: chrome.storage.sync Quota Error Simulation ---');
  StorageUtil.clearMemoryCache();
  const origSyncSet = env.chrome.storage.sync.set;
  env.chrome.storage.sync.set = () => Promise.reject(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));

  let caughtError = false;
  try {
    await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, learningGoal: 'Quota Test Goal' });
  } catch (err) {
    caughtError = true;
  }
  assert(!caughtError, 'saveSettings did NOT throw when chrome.storage.sync throws QuotaExceededError');

  const localVal = await env.chrome.storage.local.get(['settings']);
  assert(localVal.settings.learningGoal === 'Quota Test Goal', 'Saved to chrome.storage.local despite sync quota failure');

  const s2 = await StorageUtil.getSettings();
  assert(s2.learningGoal === 'Quota Test Goal', 'getSettings retrieves setting saved in local tier');
  env.chrome.storage.sync.set = origSyncSet;

  console.log('\n--- Test 3: chrome.storage.sync Unavailable (Safari / Firefox Private) ---');
  StorageUtil.clearMemoryCache();
  const origSync = env.chrome.storage.sync;
  delete env.chrome.storage.sync;

  await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, learningGoal: 'Safari WebExtension Goal' });
  const s3 = await StorageUtil.getSettings();
  assert(s3.learningGoal === 'Safari WebExtension Goal', 'getSettings works seamlessly when chrome.storage.sync is undefined');
  env.chrome.storage.sync = origSync;

  console.log('\n--- Test 4: chrome.storage.sync.get Runtime Exception ---');
  StorageUtil.clearMemoryCache();
  const origSyncGet = env.chrome.storage.sync.get;
  env.chrome.storage.sync.get = () => Promise.reject(new Error('Sync backend connection timeout'));

  await env.chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, learningGoal: 'Local Only Goal', _lastUpdated: Date.now() } });
  const s4 = await StorageUtil.getSettings();
  assert(s4.learningGoal === 'Local Only Goal', 'getSettings falls back to local when sync.get throws runtime error');
  env.chrome.storage.sync.get = origSyncGet;

  console.log('\n--- Test 5: Total Storage Outage & In-Memory Cache Fallback ---');
  StorageUtil.clearMemoryCache();
  await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, learningGoal: 'Pre-Outage Goal' });

  const origRuntimeId = env.chrome.runtime.id;
  delete env.chrome.runtime.id;

  const s5 = await StorageUtil.getSettings();
  assert(s5.learningGoal === 'Pre-Outage Goal', 'getSettings returned memorySettingsCache when extension context is invalidated');

  await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, learningGoal: 'Memory-Only Updated Goal' });
  const s5b = await StorageUtil.getSettings();
  assert(s5b.learningGoal === 'Memory-Only Updated Goal', 'saveSettings in memory-only mode updates memorySettingsCache');

  StorageUtil.clearMemoryCache();
  const s5c = await StorageUtil.getSettings();
  assert(s5c.learningGoal === DEFAULT_SETTINGS.learningGoal, 'getSettings returns fresh DEFAULT_SETTINGS clone when both storage and cache are empty');
  assert(s5c !== DEFAULT_SETTINGS, 'Returned settings is a deep clone (immutable reference to DEFAULT_SETTINGS)');

  env.chrome.runtime.id = origRuntimeId;

  console.log('\n--- Test 6: Timestamp Conflict Reconciliation (Local vs Sync) ---');
  StorageUtil.clearMemoryCache();
  const baseTime = Date.now();

  await env.chrome.storage.sync.set({ settings: { ...DEFAULT_SETTINGS, learningGoal: 'Older Sync Goal', _lastUpdated: baseTime - 10000 } });
  await env.chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, learningGoal: 'Newer Local Goal', _lastUpdated: baseTime } });
  StorageUtil.clearMemoryCache();
  const s6a = await StorageUtil.getSettings();
  assert(s6a.learningGoal === 'Newer Local Goal', 'Reconciliation: Newer local settings win over older sync settings');

  await env.chrome.storage.sync.set({ settings: { ...DEFAULT_SETTINGS, learningGoal: 'Newer Sync Goal', _lastUpdated: baseTime + 5000 } });
  await env.chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, learningGoal: 'Older Local Goal', _lastUpdated: baseTime } });
  StorageUtil.clearMemoryCache();
  const s6b = await StorageUtil.getSettings();
  assert(s6b.learningGoal === 'Newer Sync Goal', 'Reconciliation: Newer sync settings win over older local settings');

  await env.chrome.storage.sync.set({ settings: { ...DEFAULT_SETTINGS, learningGoal: 'Tie Sync Goal', _lastUpdated: baseTime + 1000 } });
  await env.chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, learningGoal: 'Tie Local Goal', _lastUpdated: baseTime + 1000 } });
  StorageUtil.clearMemoryCache();
  const s6c = await StorageUtil.getSettings();
  assert(s6c.learningGoal === 'Tie Local Goal', 'Reconciliation: Equal timestamps resolve to local settings');

  await env.chrome.storage.sync.set({ settings: { ...DEFAULT_SETTINGS, learningGoal: 'Untimestamped Sync' } });
  await env.chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS, learningGoal: 'Untimestamped Local' } });
  StorageUtil.clearMemoryCache();
  const s6d = await StorageUtil.getSettings();
  assert(s6d.learningGoal === 'Untimestamped Local', 'Reconciliation: Missing timestamps default to 0 and resolve safely');

  console.log('\n--- Test 7: Schema Deep-Merge and Malformed Data Resilience ---');
  StorageUtil.clearMemoryCache();
  const corruptedPayload = {
    extensionEnabled: true,
    volumeBooster: null,
    timeManager: undefined,
    pomodoro: 'invalid_string',
    uiCleaner: {},
    blockedKeywords: 'not_an_array'
  };
  const merged = StorageUtil.buildMergedSettings(corruptedPayload);
  assert(merged.volumeBooster && typeof merged.volumeBooster === 'object', 'buildMergedSettings repairs null volumeBooster');
  assert(Array.isArray(merged.volumeBooster.eqGains) && merged.volumeBooster.eqGains.length === 10, 'volumeBooster.eqGains initialized to 10-band array');
  assert(merged.timeManager && merged.timeManager.dailyLimitMinutes === 60, 'buildMergedSettings repairs undefined timeManager');
  assert(merged.pomodoro && typeof merged.pomodoro === 'object', 'buildMergedSettings repairs non-object pomodoro');
  assert(Array.isArray(merged.blockedKeywords), 'buildMergedSettings repairs non-array blockedKeywords');

  console.log('\n--- Test 8: 2-Tier Tracking Cascade & In-Memory Fallback ---');
  StorageUtil.clearMemoryCache();
  const sampleTracking = {
    ...DEFAULT_TRACKING,
    dailyWatchTime: { '2026-08-22': 3600 },
    dailyLearningTime: { '2026-08-22': 1800 },
    gamification: { totalAP: 500, rankTitle: 'Gold Master' }
  };
  await StorageUtil.saveTracking(sampleTracking);
  let t1 = await StorageUtil.getTracking();
  assert(t1.dailyWatchTime['2026-08-22'] === 3600, 'Tracking saved and retrieved from local');

  const origLocalSet = env.chrome.storage.local.set;
  env.chrome.storage.local.set = () => Promise.reject(new Error('Local storage full'));

  sampleTracking.dailyWatchTime['2026-08-22'] = 7200;
  await StorageUtil.saveTracking(sampleTracking);

  env.chrome.storage.local.get = () => Promise.reject(new Error('Local get failed'));
  let t2 = await StorageUtil.getTracking();
  assert(t2.dailyWatchTime['2026-08-22'] === 7200, 'Tracking retrieved from memoryTrackingCache during local failure');

  env.chrome.storage.local.set = origLocalSet;

  console.log('\n--- Test 9: Timeline Log Consolidation & Channel Sanitization ---');
  StorageUtil.clearMemoryCache();
  await StorageUtil.saveTracking({ ...DEFAULT_TRACKING, timelineLog: [] });

  const event1 = {
    videoId: 'vid123',
    title: 'How to Learn Quantum Physics',
    channel: 'Veritasium Veritasium Subscribe',
    durationSeconds: 60,
    timestamp: 1000000,
    status: 'watched'
  };
  await StorageUtil.addTimelineEvent(event1);

  let trLog = (await StorageUtil.getTracking()).timelineLog;
  assert(trLog.length === 1, 'Initial timeline event added');
  assert(trLog[0].channel === 'Veritasium', 'Channel name sanitized (Veritasium)');

  const event2 = {
    videoId: 'vid123',
    title: 'How to Learn Quantum Physics',
    channel: 'Veritasium',
    durationSeconds: 30,
    timestamp: 1000050,
    status: 'watched'
  };
  await StorageUtil.addTimelineEvent(event2);

  trLog = (await StorageUtil.getTracking()).timelineLog;
  assert(trLog.length === 1, 'Consecutive event consolidated into existing entry (length: 1)');
  assert(trLog[0].durationSeconds === 90, 'Duration consolidated to 90 seconds');

  const event3 = {
    videoId: 'vid456',
    title: '3Blue1Brown Linear Algebra',
    channel: '3Blue1Brown • Subscribe',
    durationSeconds: 120,
    timestamp: 1000060,
    status: 'watched'
  };
  await StorageUtil.addTimelineEvent(event3);

  trLog = (await StorageUtil.getTracking()).timelineLog;
  assert(trLog.length === 2, 'Different video appended as new entry');
  assert(trLog[1].channel === '3Blue1Brown', 'Channel 2 sanitized (3Blue1Brown)');

  console.log('\n================================================================');
  console.log('TOTAL STORAGE CASCADE TESTS: ' + (passed + failed));
  console.log('PASSED: ' + passed);
  console.log('FAILED: ' + failed);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runStorageCascadeStress().catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = runStorageCascadeStress;