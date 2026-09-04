/**
 * Tier 1 Test Suite: Feature 4 - Storage Persistence (storage-persistence.test.js)
 * Tests chrome.storage.sync (settings) and chrome.storage.local (tracking/gamification) schema initialization,
 * default values, deep merging, and data persistence.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, createMockStorage } = require('../harness/test-helpers');
const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../../utils/storage');

describe('Feature 4: Storage Persistence & Schema Management', () => {

  test('F4.1: getSettings initializes default settings schema when sync storage is empty', async () => {
    await resetStorage();
    const settings = await StorageUtil.getSettings();

    assert.equal(settings.shortsBlocker, true, 'Default shortsBlocker is true');
    assert.equal(settings.focusMode, true, 'Default focusMode is true');
    assert.equal(settings.studyMode, false, 'Default studyMode is false');
    assert.equal(settings.goalMode, false, 'Default goalMode is false');
    assert.equal(settings.learningGoal, "Learn something new", 'Default learning goal set');

    assert.ok(settings.timeManager, 'timeManager object exists');
    assert.equal(settings.timeManager.enabled, false, 'Default timeManager enabled is false');
    assert.equal(settings.timeManager.dailyLimitMinutes, 60, 'Default daily limit is 60 minutes');

    assert.ok(settings.uiCleaner, 'uiCleaner object exists');
    assert.equal(settings.uiCleaner.hideBell, true, 'Default hideBell is true');
    assert.equal(settings.uiCleaner.hideSubCount, false, 'Default hideSubCount is false');
  });

  test('F4.2: getTracking initializes default tracking and gamification schema when local storage is empty', async () => {
    await resetStorage();
    const tracking = await StorageUtil.getTracking();

    assert.deepEqual(tracking.dailyWatchTime, {}, 'Default dailyWatchTime is empty object');
    assert.deepEqual(tracking.dailyLearningTime, {}, 'Default dailyLearningTime is empty object');
    assert.equal(tracking.weeklyTotal, 0, 'Default weeklyTotal is 0');
    assert.equal(tracking.monthlyTotal, 0, 'Default monthlyTotal is 0');

    assert.ok(tracking.gamification, 'gamification sub-object exists');
    assert.equal(tracking.gamification.totalAP, 0, 'Default totalAP is 0');
    assert.equal(tracking.gamification.totalEXP, 0, 'Default totalEXP is 0');
    assert.equal(tracking.gamification.level, 1, 'Default level is 1');
    assert.equal(tracking.gamification.rankTier, "Bronze Focus", 'Default rankTier is Bronze Focus');
    assert.deepEqual(tracking.gamification.badges, [], 'Default badges is empty array');
  });

  test('F4.3: saveSettings and updateSetting persist changes atomically to chrome.storage.sync', async () => {
    await resetStorage();

    await StorageUtil.updateSetting('studyMode', true);
    await StorageUtil.updateSetting('learningGoal', 'Master C++ Programming');

    const updated = await StorageUtil.getSettings();
    assert.equal(updated.studyMode, true, 'studyMode updated to true');
    assert.equal(updated.learningGoal, 'Master C++ Programming', 'learningGoal updated in storage');

    // Verify raw storage content
    const raw = await global.chrome.storage.sync.get('settings');
    assert.equal(raw.settings.studyMode, true, 'Raw sync storage contains updated studyMode');
    assert.equal(raw.settings.learningGoal, 'Master C++ Programming', 'Raw sync storage contains updated learningGoal');
  });

  test('F4.4: updateTimeManagerSetting and updateUICleanerSetting mutate nested settings correctly', async () => {
    await resetStorage();

    await StorageUtil.updateTimeManagerSetting('enabled', true);
    await StorageUtil.updateTimeManagerSetting('dailyLimitMinutes', 120);
    await StorageUtil.updateUICleanerSetting('hideSubCount', true);

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.timeManager.enabled, true, 'timeManager.enabled updated to true');
    assert.equal(settings.timeManager.dailyLimitMinutes, 120, 'timeManager.dailyLimitMinutes updated to 120');
    assert.equal(settings.uiCleaner.hideSubCount, true, 'uiCleaner.hideSubCount updated to true');
    assert.equal(settings.uiCleaner.hideBell, true, 'Unmodified uiCleaner properties preserved');
  });

  test('F4.5: saveTracking persists tracking and gamification state to chrome.storage.local', async () => {
    await resetStorage();

    const tracking = await StorageUtil.getTracking();
    tracking.dailyWatchTime['2026-08-09'] = 1800;
    tracking.dailyLearningTime['2026-08-09'] = 1800;
    tracking.gamification.totalAP = 500;
    tracking.gamification.rankTier = 'Gold Mastermind';
    tracking.gamification.badges.push('first_step');

    await StorageUtil.saveTracking(tracking);

    const reloaded = await StorageUtil.getTracking();
    assert.equal(reloaded.dailyWatchTime['2026-08-09'], 1800, 'Daily watch time persisted');
    assert.equal(reloaded.gamification.totalAP, 500, 'Total AP persisted');
    assert.equal(reloaded.gamification.rankTier, 'Gold Mastermind', 'Rank tier persisted');
    assert.ok(reloaded.gamification.badges.includes('first_step'), 'Badge list persisted');
  });

  test('F4.6: getTracking performs deep merge fallback when stored tracking contains missing fields', async () => {
    await resetStorage();

    // Partial legacy tracking missing new gamification fields
    const legacyTracking = {
      tracking: {
        dailyWatchTime: { '2026-08-01': 500 },
        gamification: {
          currentStreak: 5
          // missing totalAP, level, rankTier, badges, etc.
        }
      }
    };
    await global.chrome.storage.local.set(legacyTracking);

    const merged = await StorageUtil.getTracking();

    assert.equal(merged.dailyWatchTime['2026-08-01'], 500, 'Preserves legacy dailyWatchTime');
    assert.equal(merged.gamification.currentStreak, 5, 'Preserves stored currentStreak');
    assert.equal(merged.gamification.totalAP, 0, 'Falls back to default totalAP (0)');
    assert.equal(merged.gamification.rankTier, 'Bronze Focus', 'Falls back to default rankTier (Bronze Focus)');
    assert.deepEqual(merged.gamification.badges, [], 'Ensures badges array is initialized');
  });

  test('F4.7: updateVolumeBoosterSetting persists eqEnabled, preset, and eqGains with deep-cloning', async () => {
    await resetStorage();

    await StorageUtil.updateVolumeBoosterSetting('eqEnabled', false);
    await StorageUtil.updateVolumeBoosterSetting('preset', 'Rock');
    const customGains = [5, 4, 3, 1, -1, -1, 0, 2, 4, 5];
    await StorageUtil.updateVolumeBoosterSetting('eqGains', customGains);

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.volumeBooster.eqEnabled, false, 'eqEnabled persisted as false');
    assert.equal(settings.volumeBooster.preset, 'Rock', 'preset persisted as Rock');
    assert.deepEqual(settings.volumeBooster.eqGains, customGains, 'eqGains array persisted correctly');

    // Test deep-cloning immutability
    customGains[0] = 12;
    const freshSettings = await StorageUtil.getSettings();
    assert.equal(freshSettings.volumeBooster.eqGains[0], 5, 'Mutating original array does not corrupt stored eqGains');
  });

  test('F4.8: buildMergedSettings populates default volumeBooster schema when missing', () => {
    const merged = StorageUtil.buildMergedSettings({});
    assert.ok(merged.volumeBooster, 'volumeBooster object exists');
    assert.equal(merged.volumeBooster.volumeLevel, 100, 'Default volumeLevel is 100');
    assert.equal(merged.volumeBooster.bassLevel, 0, 'Default bassLevel is 0');
    assert.equal(merged.volumeBooster.eqEnabled, true, 'Default eqEnabled is true');
    assert.equal(merged.volumeBooster.preset, 'Flat', 'Default preset is Flat');
    assert.deepEqual(merged.volumeBooster.eqGains, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'Default eqGains has 10 zeros');
  });

});

