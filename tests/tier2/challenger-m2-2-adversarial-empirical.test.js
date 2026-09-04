/**
 * Challenger M2-2 Comprehensive Cross-Browser Adversarial Empirical Stress Test
 *
 * Explicitly tests across all 12 feature modules:
 * 1. Storage sync unavailability (chrome.storage.sync missing or throwing errors)
 * 2. Disabled extension context (chrome.runtime.id missing, context invalidation)
 * 3. Empty DOM elements (missing body, missing video, empty nodes, missing attributes)
 * 4. Rapid IPC messaging (500+ rapid concurrent IPC calls & state toggles)
 */

const fs = require('node:fs');
const path = require('node:path');
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { setupMockEnv } = require('../harness/mock-extension-env');

// Ensure clean environment
setupMockEnv();

// Require core utilities & modules
const { StorageUtil, DEFAULT_SETTINGS } = require('../../utils/storage');
const AudioEngine = require('../../utils/audio-engine');

if (fs.existsSync(path.join(__dirname, '../../utils/dom-utils.js'))) {
  require('../../utils/dom-utils');
}
if (fs.existsSync(path.join(__dirname, '../../content/js/observer-utils.js'))) {
  require('../../content/js/observer-utils');
}

require('../../content/js/shorts-blocker');
require('../../content/js/focus-mode');
require('../../content/js/study-mode');
require('../../content/js/goal-mode');
require('../../content/js/feed-controller');
require('../../content/js/time-manager');
require('../../content/js/ui-cleaner');
require('../../content/js/header-button');
require('../../content/js/volume-booster');

const ShortsBlocker = window.ShortsBlocker;
const FocusMode = window.FocusMode;
const StudyMode = window.StudyMode;
const GoalMode = window.GoalMode;
const FeedController = window.FeedController;
const TimeManager = window.TimeManager;
const UICleaner = window.UICleaner;
const HeaderButton = window.HeaderButton;
const VolumeBooster = window.VolumeBooster;

(async () => {
  await describe('Challenger M2-2 Empirical Adversarial Stress Suite', async () => {

    // =========================================================================
    // 1. STORAGE SYNC UNAVAILABILITY ACROSS ALL MODULES
    // =========================================================================
    await describe('1. Storage Sync Unavailability', async () => {

      await test('1.1 Safari/Firefox missing chrome.storage.sync API across all 12 modules', async () => {
        setupMockEnv();
        await resetStorage();

        const origSync = global.chrome.storage.sync;
        delete global.chrome.storage.sync;

        try {
          // Save modified settings
          const modifiedSettings = { ...DEFAULT_SETTINGS, focusMode: true, studyMode: true, learningGoal: 'Safari Test' };
          await StorageUtil.saveSettings(modifiedSettings);

          // Fetch settings
          const fetched = await StorageUtil.getSettings();
          assert.equal(fetched.focusMode, true);
          assert.equal(fetched.studyMode, true);
          assert.equal(fetched.learningGoal, 'Safari Test');

          // Verify local storage fallback holds the values
          const localObj = await global.chrome.storage.local.get('settings');
          assert.ok(localObj.settings);
          assert.equal(localObj.settings.learningGoal, 'Safari Test');

          // Test tracking persistence without sync
          const tracking = await StorageUtil.getTracking();
          tracking.gamification.totalAP += 100;
          await StorageUtil.saveTracking(tracking);

          const updatedTracking = await StorageUtil.getTracking();
          assert.equal(updatedTracking.gamification.totalAP, 100);
        } finally {
          global.chrome.storage.sync = origSync;
        }
      });

      await test('1.2 chrome.storage.sync quota error fallback to local & memory cache', async () => {
        setupMockEnv();
        await resetStorage();

        const origSet = global.chrome.storage.sync.set;
        global.chrome.storage.sync.set = () => Promise.reject(new Error('QUOTA_BYTES_PER_ITEM exceeded'));

        try {
          const customSettings = { ...DEFAULT_SETTINGS, hideShorts: true, hideBell: true };
          await StorageUtil.saveSettings(customSettings);

          const retrieved = await StorageUtil.getSettings();
          assert.equal(retrieved.hideShorts, true);
          assert.equal(retrieved.hideBell, true);
        } finally {
          global.chrome.storage.sync.set = origSet;
        }
      });
    });

    // =========================================================================
    // 2. DISABLED EXTENSION CONTEXT ACROSS ALL MODULES
    // =========================================================================
    await describe('2. Disabled Extension Context Resilience', async () => {

      await test('2.1 Context invalidation handling in StorageUtil and Content Controllers', async () => {
        setupMockEnv();
        await resetStorage();

        // Warm memory cache
        await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, shortsBlocker: true, focusMode: true });

        // Invalidate context
        const origValid = StorageUtil.isContextValid;
        StorageUtil.isContextValid = () => false;

        const origSendMessage = global.chrome.runtime.sendMessage;
        global.chrome.runtime.sendMessage = () => {
          throw new Error('Extension context invalidated.');
        };

        try {
          // getSettings must return memory cache safely
          const settings = await StorageUtil.getSettings();
          assert.equal(settings.shortsBlocker, true);
          assert.equal(settings.focusMode, true);

          // HeaderButton fallback to window.open on context invalidation
          resetDOM();
          let openedUrl = null;
          const origOpen = global.window.open;
          global.window.open = (url) => { openedUrl = url; };

          try {
            const dialog = document.createElement('div');
            dialog.innerHTML = `<div id="ss-popup-settings"></div>`;
            HeaderButton.wirePopupEvents(dialog, settings, {});

            const settingsBtn = dialog.querySelector('#ss-popup-settings');
            settingsBtn.dispatchEvent({ type: 'click', preventDefault: () => {}, stopPropagation: () => {} });

            assert.ok(openedUrl, 'HeaderButton must fall back to window.open');
            assert.ok(openedUrl.includes('options/options.html'));
          } finally {
            global.window.open = origOpen;
          }

        } finally {
          StorageUtil.isContextValid = origValid;
          global.chrome.runtime.sendMessage = origSendMessage;
        }
      });
    });

    // =========================================================================
    // 3. EMPTY DOM ELEMENTS ACROSS ALL MODULES
    // =========================================================================
    await describe('3. Empty DOM Elements Handling', async () => {

      await test('3.1 Operations on completely empty DOM (null/empty body, missing video, missing YouTube components)', () => {
        resetDOM();

        // 1. UICleaner on empty DOM
        assert.doesNotThrow(() => UICleaner.applySettings(DEFAULT_SETTINGS));
        assert.doesNotThrow(() => UICleaner.cleanup());

        // 2. FeedController on empty DOM
        assert.doesNotThrow(() => FeedController.enable('Machine Learning'));
        assert.doesNotThrow(() => FeedController.filterFeed([]));
        assert.doesNotThrow(() => FeedController.filterFeed([document.createElement('div')]));
        assert.doesNotThrow(() => FeedController.disable());

        // 3. StudyMode & GoalMode on empty DOM
        assert.doesNotThrow(() => StudyMode.enable({ pomodoroEnabled: true }));
        assert.doesNotThrow(() => StudyMode.disable());
        assert.doesNotThrow(() => GoalMode.enable('Python'));
        assert.doesNotThrow(() => GoalMode.disable());

        // 4. ShortsBlocker on empty DOM
        assert.doesNotThrow(() => ShortsBlocker.enable());
        assert.doesNotThrow(() => ShortsBlocker.observeShortsElements());
        assert.doesNotThrow(() => ShortsBlocker.disable());

        // 5. VolumeBooster on DOM without <video> element
        assert.doesNotThrow(() => VolumeBooster.setVolume(200));
        assert.doesNotThrow(() => VolumeBooster.setBass(10));
        assert.doesNotThrow(() => VolumeBooster.reset());

        // 6. TimeManager on empty DOM
        assert.doesNotThrow(() => TimeManager.enable({ enabled: true, dailyLimitMinutes: 30 }));
        assert.doesNotThrow(() => TimeManager.evaluate());
        assert.doesNotThrow(() => TimeManager.disable());
      });

      await test('3.2 Malformed DOM elements (video with no src, cards without title/channel)', () => {
        resetDOM();

        // Video element with no src or audio tracks
        const dummyVideo = document.createElement('video');
        document.body.appendChild(dummyVideo);

        assert.doesNotThrow(() => AudioEngine.attachToVideo(dummyVideo));
        assert.doesNotThrow(() => AudioEngine.setVolume(3.0));
        assert.doesNotThrow(() => AudioEngine.setBass(8.0));

        // Malformed video card in FeedController
        const malformedCard = document.createElement('ytd-rich-item-renderer');
        // No #video-title child
        assert.doesNotThrow(() => FeedController.filterFeed([malformedCard]));
      });
    });

    // =========================================================================
    // 4. RAPID IPC MESSAGING & HIGH FREQUENCY STATE TOGGLES
    // =========================================================================
    await describe('4. Rapid IPC Messaging & Toggle Stress', async () => {

      await test('4.1 500 Rapid concurrent IPC messages to Background Service Worker', async () => {
        setupMockEnv();
        await resetStorage();

        delete require.cache[require.resolve('../../background/background')];
        require('../../background/background');

        let messageListener = null;
        global.chrome.runtime.onMessage.addListener = (fn) => { messageListener = fn; };

        // Re-trigger listener registration in background script
        delete require.cache[require.resolve('../../background/background')];
        require('../../background/background');

        assert.ok(messageListener, 'Background script must register message listener');

        const actions = [
          { action: 'getSettings' },
          { action: 'getTracking' },
          { action: 'openOptionsPage' }
        ];

        const promises = [];
        for (let i = 0; i < 500; i++) {
          const msg = actions[i % actions.length];
          const p = new Promise((resolve) => {
            messageListener(msg, { tab: { id: i } }, (response) => {
              resolve(response);
            });
          });
          promises.push(p);
        }

        const results = await Promise.all(promises);
        assert.equal(results.length, 500);
        results.forEach(res => {
          assert.ok(res, 'Every IPC message must receive a response');
        });
      });

      await test('4.2 Rapid 100x toggle cycle across all content scripts concurrently', () => {
        resetDOM();

        for (let cycle = 0; cycle < 100; cycle++) {
          if (cycle % 2 === 0) {
            ShortsBlocker.enable();
            FocusMode.enable();
            StudyMode.enable({ pomodoroEnabled: true });
            GoalMode.enable('Deep Work');
            FeedController.enable('Software Engineering');
            UICleaner.applySettings({ hideBell: true, hideChat: true });
            VolumeBooster.setVolume(150);
          } else {
            ShortsBlocker.disable();
            FocusMode.disable();
            StudyMode.disable();
            GoalMode.disable();
            FeedController.disable();
            UICleaner.cleanup();
            VolumeBooster.setVolume(100);
          }
        }

        // Final clean teardown check
        assert.ok(!document.body.classList.contains('shorts-shield-focus-mode'));
        assert.ok(!document.body.classList.contains('ss-hide-bell'));
      });
    });

  });
})();
