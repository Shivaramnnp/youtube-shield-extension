/**
 * Cross-Browser API Boundary Stress Test Suite (Tier 2)
 * Tests Safari chrome.storage.sync fallbacks, webNavigation interception/fallbacks,
 * CSS :has() legacy Firefox Observer fallbacks, and Tab Deduplication IPC.
 */

const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { setupMockEnv } = require('../harness/mock-extension-env');
const { StorageUtil, DEFAULT_SETTINGS } = require('../../utils/storage');

describe('Cross-Browser API Boundary Stress Tests', () => {

  // =========================================================================
  // 1. SAFARI CHROME.STORAGE.SYNC FALLBACK & ERROR RESILIENCE
  // =========================================================================
  describe('Safari chrome.storage.sync Fallback', () => {
    
    test('1.1 Safari missing chrome.storage.sync (undefined sync API)', async () => {
      setupMockEnv();
      await resetStorage();
      const originalSync = global.chrome.storage.sync;
      delete global.chrome.storage.sync;

      try {
        // Save settings when sync is undefined
        await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, shortsBlocker: false });
        
        // Verify stored in local storage
        const localData = await global.chrome.storage.local.get('settings');
        assert.ok(localData.settings, 'Settings must be written to chrome.storage.local');
        assert.equal(localData.settings.shortsBlocker, false);

        // Read settings back
        const retrieved = await StorageUtil.getSettings();
        assert.equal(retrieved.shortsBlocker, false, 'getSettings must read from local storage when sync is missing');
      } finally {
        global.chrome.storage.sync = originalSync;
      }
    });

    test('1.2 chrome.storage.sync.get throwing / rejecting error', async () => {
      setupMockEnv();
      await resetStorage();
      const originalGet = global.chrome.storage.sync.get;

      // Populate local storage with test data
      await global.chrome.storage.local.set({
        settings: { ...DEFAULT_SETTINGS, focusMode: false }
      });

      // Simulate Safari throwing access error on sync.get rejection
      global.chrome.storage.sync.get = () => {
        return Promise.reject(new Error("Sync storage disabled in Safari settings"));
      };

      try {
        const retrieved = await StorageUtil.getSettings();
        assert.equal(retrieved.focusMode, false, 'getSettings must fall back to local storage on sync.get failure');
      } finally {
        global.chrome.storage.sync.get = originalGet;
      }
    });

    test('1.3 chrome.storage.sync.set throwing QUOTA_BYTES_PER_ITEM error', async () => {
      setupMockEnv();
      await resetStorage();
      const originalSet = global.chrome.storage.sync.set;

      // Simulate Quota Exceeded error on sync.set
      global.chrome.storage.sync.set = () => {
        return Promise.reject(new Error("QUOTA_BYTES_PER_ITEM exceeded"));
      };

      try {
        const targetSettings = { ...DEFAULT_SETTINGS, learningGoal: "Safari Quota Test Goal" };
        await StorageUtil.saveSettings(targetSettings);

        // Check local storage fallback
        const localData = await global.chrome.storage.local.get('settings');
        assert.ok(localData.settings, 'saveSettings must fall back to local storage on sync quota error');
        assert.equal(localData.settings.learningGoal, "Safari Quota Test Goal");
      } finally {
        global.chrome.storage.sync.set = originalSet;
      }
    });

    test('1.4 Catastrophic storage failure (invalidation & exception fallback to memory cache)', async () => {
      setupMockEnv();
      await resetStorage();

      // Save valid settings first to warm memory cache
      await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, studyMode: true, learningGoal: "Cache Warm" });

      const originalContextValid = StorageUtil.isContextValid;

      // Simulate context invalidation / total API failure
      StorageUtil.isContextValid = () => false;

      try {
        const retrieved = await StorageUtil.getSettings();
        assert.equal(retrieved.studyMode, true, 'getSettings must use memory cache when context is invalid');
        assert.equal(retrieved.learningGoal, "Cache Warm", 'Memory cache retains stored values');
      } finally {
        StorageUtil.isContextValid = originalContextValid;
      }
    });
  });

  // =========================================================================
  // 2. CHROMIUM VS FIREFOX WEBNAVIGATION INTERCEPTION
  // =========================================================================
  describe('webNavigation Interception & Scripting Fallbacks', () => {

    test('2.1 webNavigation.onBeforeNavigate redirects Shorts URL to home', async () => {
      setupMockEnv();
      await resetStorage();
      await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, shortsBlocker: true });

      let updatedTabId = null;
      let updatedProps = null;
      const originalUpdate = global.chrome.tabs.update;

      global.chrome.tabs.update = (tabId, props) => {
        updatedTabId = tabId;
        updatedProps = props;
        return Promise.resolve({ id: tabId, ...props });
      };

      try {
        let navListener = null;
        global.chrome.webNavigation.onBeforeNavigate.addListener = (fn) => { navListener = fn; };
        
        delete require.cache[require.resolve('../../background/background')];
        require('../../background/background');

        if (navListener) {
          await navListener({ frameId: 0, tabId: 42, url: 'https://www.youtube.com/shorts/test12345' });
        }

        assert.equal(updatedTabId, 42, 'Target tabId should be 42');
        assert.equal(updatedProps.url, 'https://www.youtube.com/', 'Target URL should be YouTube Home');
      } finally {
        global.chrome.tabs.update = originalUpdate;
      }
    });

    test('2.2 webNavigation.onHistoryStateUpdated SPA nav with chrome.scripting', async () => {
      setupMockEnv();
      await resetStorage();
      await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, shortsBlocker: true });

      let executedDetails = null;
      const originalExecute = global.chrome.scripting.executeScript;

      global.chrome.scripting.executeScript = (details) => {
        executedDetails = details;
        return Promise.resolve([{ result: true }]);
      };

      try {
        let historyListener = null;
        global.chrome.webNavigation.onHistoryStateUpdated.addListener = (fn) => { historyListener = fn; };

        delete require.cache[require.resolve('../../background/background')];
        require('../../background/background');

        if (historyListener) {
          await historyListener({ frameId: 0, tabId: 88, url: 'https://www.youtube.com/shorts/spa_test_123' });
        }

        assert.ok(executedDetails, 'executeScript should be called for SPA navigation');
        assert.equal(executedDetails.target.tabId, 88);
        assert.equal(typeof executedDetails.func, 'function');
      } finally {
        global.chrome.scripting.executeScript = originalExecute;
      }
    });

    test('2.3 webNavigation.onHistoryStateUpdated fallback when chrome.scripting is undefined (Firefox MV2)', async () => {
      setupMockEnv();
      await resetStorage();
      await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, shortsBlocker: true });

      const originalScripting = global.chrome.scripting;
      delete global.chrome.scripting;

      let updatedTabId = null;
      let updatedProps = null;
      const originalUpdate = global.chrome.tabs.update;

      global.chrome.tabs.update = (tabId, props) => {
        updatedTabId = tabId;
        updatedProps = props;
        return Promise.resolve({ id: tabId, ...props });
      };

      try {
        let historyListener = null;
        global.chrome.webNavigation.onHistoryStateUpdated.addListener = (fn) => { historyListener = fn; };

        delete require.cache[require.resolve('../../background/background')];
        require('../../background/background');

        if (historyListener) {
          await historyListener({ frameId: 0, tabId: 99, url: 'https://www.youtube.com/shorts/no_scripting' });
        }

        assert.equal(updatedTabId, 99, 'Fallback tab.update should be called when scripting is missing');
        assert.equal(updatedProps.url, 'https://www.youtube.com/');
      } finally {
        global.chrome.scripting = originalScripting;
        global.chrome.tabs.update = originalUpdate;
      }
    });

    test('2.4 Content script ShortsBlocker URL check fallback when webNavigation API fails', () => {
      setupMockEnv();
      resetDOM();
      require('../../content/js/shorts-blocker');
      const originalLocation = global.location;
      
      let replacedUrl = null;
      global.location = {
        href: 'https://www.youtube.com/shorts/content_script_check',
        replace: (url) => { replacedUrl = url; }
      };

      try {
        window.ShortsBlocker.disabledExplicitly = false;
        window.ShortsBlocker.checkAndRedirectShortsURL();

        assert.equal(replacedUrl, 'https://www.youtube.com/', 'ShortsBlocker content script must redirect via location.replace');
      } finally {
        global.location = originalLocation;
      }
    });
  });

  // =========================================================================
  // 3. CSS :HAS() CONTAINER REMOVAL IN LEGACY FIREFOX
  // =========================================================================
  describe('Legacy Firefox CSS :has() Container Removal Fallback', () => {

    const containerSelectors = [
      'ytd-rich-section-renderer',
      'ytd-rich-shelf-renderer',
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-reel-shelf-renderer',
      'ytd-guide-entry-renderer',
      'ytd-mini-guide-entry-renderer',
      'ytd-pivot-bar-item-renderer',
      'tp-yt-paper-item'
    ];

    containerSelectors.forEach(selector => {
      test(`3.1 ObserverUtils removes parent container: ${selector}`, () => {
        setupMockEnv();
        resetDOM();
        require('../../content/js/observer-utils');
        require('../../content/js/shorts-blocker');

        // Create parent container element
        const parentContainer = global.document.createElement(selector);
        
        // Create child Shorts link element
        const shortsLink = global.document.createElement('a');
        shortsLink.setAttribute('href', '/shorts/123456');
        shortsLink.setAttribute('title', 'Shorts');
        parentContainer.appendChild(shortsLink);
        
        global.document.body.appendChild(parentContainer);

        // Mock ObserverUtils to invoke callback immediately
        window.ObserverUtils = {
          observe: (sel, callback) => {
            const elements = global.document.querySelectorAll(sel);
            if (elements.length > 0) {
              callback(elements);
            }
          },
          disconnect: () => {}
        };

        // Trigger observeShortsElements
        window.ShortsBlocker.observeShortsElements();

        assert.equal(
          parentContainer.style.display,
          'none',
          `Container <${selector}> must be hidden via inline style display: none`
        );
      });
    });

    test('3.2 Fallback to hiding element directly when no container matches', () => {
      setupMockEnv();
      resetDOM();
      require('../../content/js/observer-utils');
      require('../../content/js/shorts-blocker');

      const genericWrapper = global.document.createElement('div');
      genericWrapper.className = 'generic-custom-wrapper';

      const shortsLink = global.document.createElement('a');
      shortsLink.setAttribute('href', '/shorts/isolated_99');
      genericWrapper.appendChild(shortsLink);
      global.document.body.appendChild(genericWrapper);

      window.ObserverUtils = {
        observe: (sel, callback) => {
          const elements = global.document.querySelectorAll(sel);
          if (elements.length > 0) callback(elements);
        },
        disconnect: () => {}
      };

      window.ShortsBlocker.observeShortsElements();

      assert.equal(
        shortsLink.style.display,
        'none',
        'Direct element must be hidden when no known YouTube container matched'
      );
    });
  });

  // =========================================================================
  // 4. TAB DEDUPLICATION IPC
  // =========================================================================
  describe('Tab Deduplication IPC Handling', () => {

    test('4.1 openOptionsPage reuses existing options tab', async () => {
      setupMockEnv();
      await resetStorage();
      const optionsUrl = global.chrome.runtime.getURL('options/options.html');

      let updatedTabId = null;
      let updatedTabProps = null;
      let updatedWinId = null;
      let updatedWinProps = null;

      const originalQuery = global.chrome.tabs.query;
      const originalTabUpdate = global.chrome.tabs.update;
      const originalWinUpdate = global.chrome.windows ? global.chrome.windows.update : null;

      global.chrome.tabs.query = (queryInfo, callback) => {
        callback([{ id: 77, url: optionsUrl, windowId: 5 }]);
      };

      global.chrome.tabs.update = (tabId, props, callback) => {
        updatedTabId = tabId;
        updatedTabProps = props;
        if (callback) callback({ id: tabId, ...props });
      };

      global.chrome.windows = {
        update: (winId, props, callback) => {
          updatedWinId = winId;
          updatedWinProps = props;
          if (callback) callback({ id: winId, ...props });
        }
      };

      try {
        let messageListener = null;
        global.chrome.runtime.onMessage.addListener = (fn) => { messageListener = fn; };

        delete require.cache[require.resolve('../../background/background')];
        require('../../background/background');

        let response = null;
        if (messageListener) {
          messageListener({ action: "openOptionsPage" }, {}, (res) => { response = res; });
        }

        assert.ok(response, 'Response must be received from openOptionsPage');
        assert.equal(response.success, true);
        assert.equal(response.reused, true, 'reused flag must be true when focusing existing tab');
        assert.equal(response.tabId, 77);
        assert.equal(updatedTabId, 77);
        assert.equal(updatedTabProps.active, true);
        assert.equal(updatedWinId, 5);
        assert.equal(updatedWinProps.focused, true);
      } finally {
        global.chrome.tabs.query = originalQuery;
        global.chrome.tabs.update = originalTabUpdate;
        if (originalWinUpdate) global.chrome.windows.update = originalWinUpdate;
      }
    });

    test('4.2 openOptionsPage creates new tab when no existing tab is found', async () => {
      setupMockEnv();
      await resetStorage();

      let createdProps = null;
      const originalQuery = global.chrome.tabs.query;
      const originalCreate = global.chrome.tabs.create;

      global.chrome.tabs.query = (queryInfo, callback) => {
        callback([]); // No existing tabs
      };

      global.chrome.tabs.create = (props, callback) => {
        createdProps = props;
        callback({ id: 101, ...props });
      };

      try {
        let messageListener = null;
        global.chrome.runtime.onMessage.addListener = (fn) => { messageListener = fn; };

        delete require.cache[require.resolve('../../background/background')];
        require('../../background/background');

        let response = null;
        if (messageListener) {
          messageListener({ action: "openOptionsPage" }, {}, (res) => { response = res; });
        }

        assert.ok(response);
        assert.equal(response.success, true);
        assert.equal(response.reused, false, 'reused flag must be false when creating new tab');
        assert.equal(response.tabId, 101);
        assert.ok(createdProps.url.includes('options/options.html'));
      } finally {
        global.chrome.tabs.query = originalQuery;
        global.chrome.tabs.create = originalCreate;
      }
    });

    test('4.3 openOptionsPage handles query error / lastError gracefully', async () => {
      setupMockEnv();
      await resetStorage();

      const originalQuery = global.chrome.tabs.query;
      const originalCreate = global.chrome.tabs.create;

      global.chrome.runtime.lastError = { message: "Permission denied for tab query" };

      global.chrome.tabs.query = (queryInfo, callback) => {
        callback(null);
      };

      let createdTab = false;
      global.chrome.tabs.create = (props, callback) => {
        createdTab = true;
        callback({ id: 202, ...props });
      };

      try {
        let messageListener = null;
        global.chrome.runtime.onMessage.addListener = (fn) => { messageListener = fn; };

        delete require.cache[require.resolve('../../background/background')];
        require('../../background/background');

        let response = null;
        if (messageListener) {
          messageListener({ action: "openOptionsPage" }, {}, (res) => { response = res; });
        }

        assert.ok(response);
        assert.equal(response.success, true);
        assert.equal(createdTab, true, 'Should fall back to openNewTab when tabs.query returns error');
      } finally {
        global.chrome.runtime.lastError = null;
        global.chrome.tabs.query = originalQuery;
        global.chrome.tabs.create = originalCreate;
      }
    });

    test('4.4 Content script HeaderButton falls back to window.open if IPC fails', () => {
      setupMockEnv();
      resetDOM();
      require('../../content/js/header-button');

      const originalSendMessage = global.chrome.runtime.sendMessage;
      let windowOpenedUrl = null;
      const originalWindowOpen = global.window.open;

      global.chrome.runtime.sendMessage = (msg, cb) => {
        global.chrome.runtime.lastError = { message: "Extension context invalidated" };
        if (cb) cb({ success: false });
      };

      global.window.open = (url) => {
        windowOpenedUrl = url;
      };

      try {
        const headerBtn = window.HeaderButton;
        const dialog = global.document.createElement('div');
        dialog.innerHTML = `
          <div id="ss-popup-settings"></div>
          <div id="ss-popup-today-time">0h 0m</div>
          <div id="ss-popup-learning-time">0h 0m</div>
          <div id="ss-popup-focus-score">0%</div>
          <div id="ss-popup-rank-tier">Bronze</div>
        `;

        headerBtn.wirePopupEvents(dialog, DEFAULT_SETTINGS, {});
        
        const settingsIcon = dialog.querySelector('#ss-popup-settings');
        settingsIcon.dispatchEvent({ type: 'click', preventDefault: () => {}, stopPropagation: () => {} });

        assert.ok(windowOpenedUrl, 'window.open must be called on IPC failure');
        assert.ok(windowOpenedUrl.includes('options/options.html'));
      } finally {
        global.chrome.runtime.sendMessage = originalSendMessage;
        global.window.open = originalWindowOpen;
        global.chrome.runtime.lastError = null;
        setupMockEnv(); // Ensure clean environment for subsequent test suites
      }
    });
  });
});
