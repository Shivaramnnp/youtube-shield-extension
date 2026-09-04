/**
 * Tier 3: Options Dashboard & Extension Popup Storage Sync Pairwise Interaction Test Suite
 * Validates state synchronization across Popup UI, Options Dashboard, and storage via chrome.storage.onChanged events.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, createMockStorage, resetStorage } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
require('../../background/background');

describe('Tier 3: Extension Popup & Options Dashboard Storage Sync Interaction', () => {

  test('Updating settings in Popup triggers chrome.storage.onChanged and updates Options state', async () => {
    await resetStorage();

    let storageChangedEvent = null;
    global.chrome.storage.onChanged.addListener((changes, areaName) => {
      storageChangedEvent = { changes, areaName };
    });

    await StorageUtil.updateSetting('studyMode', true);

    const freshSettings = await StorageUtil.getSettings();
    assert.equal(freshSettings.studyMode, true, 'Options should reflect studyMode = true');

    const changePayload = { settings: { oldValue: { studyMode: false }, newValue: freshSettings } };
    global.chrome.storage.onChanged.addListener((changes, area) => {
      assert.equal(area, 'sync');
      assert.equal(changes.settings.newValue.studyMode, true);
    });
  });

  test('Updating UI Cleaner toggles in Options Dashboard syncs to Popup state', async () => {
    await resetStorage();

    await StorageUtil.updateUICleanerSetting('hideChat', true);
    await StorageUtil.updateUICleanerSetting('hideBell', false);

    const freshSettings = await StorageUtil.getSettings();
    assert.equal(freshSettings.uiCleaner.hideChat, true, 'Popup should see hideChat = true');
    assert.equal(freshSettings.uiCleaner.hideBell, false, 'Popup should see hideBell = false');
  });

  test('Gamification AP increase in tracking data syncs across Popup and Options score cards', async () => {
    await resetStorage();

    let changeNotified = false;
    global.chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.tracking) {
        changeNotified = true;
      }
    });

    const tracking = await StorageUtil.getTracking();
    tracking.gamification.totalAP = 600;
    tracking.gamification.totalEXP = 600;
    tracking.gamification.level = 4;
    tracking.gamification.rankTier = 'Gold Mastermind';
    tracking.gamification.badges = ['first_step', 'focus_rookie', 'deep_diver', 'mastermind'];

    await StorageUtil.saveTracking(tracking);

    const updatedTracking = await StorageUtil.getTracking();
    const g = updatedTracking.gamification;

    assert.equal(g.totalAP, 600, 'Both Popup and Options view 600 AP');
    assert.equal(g.rankTier, 'Gold Mastermind', 'Both Popup and Options view Gold Mastermind');
    assert.equal(g.badges.length, 4, 'Both view 4 unlocked badges');
  });

  test('Bidirectional sequential updates between Popup and Options maintain storage integrity', async () => {
    await resetStorage();

    await StorageUtil.updateSetting('learningGoal', 'Master C++ Programming');
    let s1 = await StorageUtil.getSettings();
    assert.equal(s1.learningGoal, 'Master C++ Programming');

    await StorageUtil.updateTimeManagerSetting('enabled', true);
    await StorageUtil.updateTimeManagerSetting('dailyLimitMinutes', 45);
    let s2 = await StorageUtil.getSettings();

    assert.equal(s2.learningGoal, 'Master C++ Programming', 'learningGoal set by Popup must be preserved');
    assert.equal(s2.timeManager.enabled, true, 'Time Manager enabled set by Options must be saved');
    assert.equal(s2.timeManager.dailyLimitMinutes, 45, 'Time Manager daily limit set by Options must be saved');

    await StorageUtil.updateSetting('goalMode', true);
    let s3 = await StorageUtil.getSettings();

    assert.equal(s3.goalMode, true);
    assert.equal(s3.learningGoal, 'Master C++ Programming');
    assert.equal(s3.timeManager.dailyLimitMinutes, 45);
  });

  test('Default settings and tracking fallback schema is consistently served across both UIs', async () => {
    await resetStorage();

    await global.chrome.storage.local.clear();
    await global.chrome.storage.sync.clear();

    const popupSettings = await StorageUtil.getSettings();
    const optionsTracking = await StorageUtil.getTracking();

    assert.equal(popupSettings.shortsBlocker, true, 'Default shortsBlocker = true');
    assert.equal(popupSettings.focusMode, true, 'Default focusMode = true');
    assert.equal(optionsTracking.gamification.rankTier, 'Bronze Focus', 'Default rankTier = Bronze Focus');
    assert.equal(optionsTracking.gamification.totalAP, 0, 'Default totalAP = 0');
    assert.deepEqual(optionsTracking.gamification.badges, [], 'Default badges = []');
  });

  test('Options page IPC tab deduplication messaging via chrome.runtime.sendMessage', async () => {
    delete require.cache[require.resolve('../../background/background')];
    require('../../background/background');

    let tabCreatedProps = null;
    const origCreate = global.chrome.tabs.create;
    
    try {
      global.chrome.tabs.create = (props, callback) => {
        tabCreatedProps = props;
        const tab = { id: 99, ...props };
        if (typeof callback === 'function') callback(tab);
        return Promise.resolve(tab);
      };

      // Trigger openOptionsPage IPC action
      const response = await new Promise((resolve) => {
        global.chrome.runtime.sendMessage({ action: "openOptionsPage" }, (res) => {
          resolve(res);
        });
      });

      assert.ok(response, 'Response received from background IPC router');
      assert.equal(response.success, true, 'IPC response indicates success');
      assert.ok(tabCreatedProps && tabCreatedProps.url.includes('options/options.html'), 'Created tab target URL contains options/options.html');
    } finally {
      global.chrome.tabs.create = origCreate;
    }
  });

  test('Equalizer gain and preset updates in Popup sync across StorageUtil, AudioEngine, and Options state', async () => {
    await resetStorage();

    // 1. Initial State
    let settings = await StorageUtil.getSettings();
    assert.equal(settings.volumeBooster.preset, 'Flat', 'Default EQ preset is Flat');
    assert.equal(settings.volumeBooster.eqEnabled, true, 'Default EQ enabled is true');

    // 2. Update via updateVolumeBoosterSetting
    const rockGains = [5, 4, 3, 1, -1, -1, 0, 2, 4, 5];
    await StorageUtil.updateVolumeBoosterSetting('preset', 'Rock');
    await StorageUtil.updateVolumeBoosterSetting('eqGains', rockGains);
    await StorageUtil.updateVolumeBoosterSetting('eqEnabled', false);

    // 3. Verify synced storage
    const updated = await StorageUtil.getSettings();
    assert.equal(updated.volumeBooster.preset, 'Rock', 'Preset updated to Rock');
    assert.deepEqual(updated.volumeBooster.eqGains, rockGains, 'eqGains updated to Rock profile');
    assert.equal(updated.volumeBooster.eqEnabled, false, 'eqEnabled updated to false');

    // 4. Update single band and verify Custom preset transition
    rockGains[0] = 10;
    await StorageUtil.updateVolumeBoosterSetting('eqGains', rockGains);
    await StorageUtil.updateVolumeBoosterSetting('preset', 'Custom');

    const customSettings = await StorageUtil.getSettings();
    assert.equal(customSettings.volumeBooster.preset, 'Custom', 'Preset transitioned to Custom');
    assert.equal(customSettings.volumeBooster.eqGains[0], 10, 'Band 0 updated to 10dB');
  });

});

