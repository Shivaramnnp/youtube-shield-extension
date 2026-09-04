try {
  if (typeof importScripts !== 'undefined') {
    importScripts('../utils/storage.js');
  }
} catch (e) {
  console.error("Shorts Shield: Failed to import scripts in background worker", e);
}

// Constants
const YOUTUBE_SHORTS_REGEX = /^https?:\/\/(www\.)?youtube\.com\/(shorts|playables)(\/.*)?$/i;
const YOUTUBE_HOME_URL = 'https://www.youtube.com/';

// Initialization
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
      // Initialize default settings on fresh install
      await StorageUtil.saveSettings(DEFAULT_SETTINGS);
      await StorageUtil.saveTracking(DEFAULT_TRACKING);
      console.log("Shorts Shield installed. Default settings applied.");

      // Set uninstall URL if supported by runtime
      if (chrome.runtime.setUninstallURL) {
        try {
          chrome.runtime.setUninstallURL('https://www.youtube.com/');
        } catch(e) {}
      }
    } else if (details.reason === "update") {
      // Merge existing settings with DEFAULT_SETTINGS for schema migrations using buildMergedSettings
      const existing = await StorageUtil.getSettings();
      const migrated = StorageUtil.buildMergedSettings(existing);
      await StorageUtil.saveSettings(migrated);
      console.log("Shorts Shield updated. Settings migrated:", migrated);
    }
  });
}



const pendingHistoryReplace = new Set();

const markPendingTab = async (tabId) => {
  pendingHistoryReplace.add(tabId);
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
    try {
      const res = await chrome.storage.session.get(['pendingHistoryReplace']);
      const arr = Array.isArray(res.pendingHistoryReplace) ? res.pendingHistoryReplace : [];
      if (!arr.includes(tabId)) arr.push(tabId);
      await chrome.storage.session.set({ pendingHistoryReplace: arr });
    } catch(e) {}
  }
};

const checkAndRemovePendingTab = async (tabId) => {
  let found = false;
  if (pendingHistoryReplace.has(tabId)) {
    pendingHistoryReplace.delete(tabId);
    found = true;
  }
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
    try {
      const res = await chrome.storage.session.get(['pendingHistoryReplace']);
      const arr = Array.isArray(res.pendingHistoryReplace) ? res.pendingHistoryReplace : [];
      if (arr.includes(tabId)) {
        const nextArr = arr.filter(id => id !== tabId);
        await chrome.storage.session.set({ pendingHistoryReplace: nextArr });
        found = true;
      }
    } catch(e) {}
  }
  return found;
};

// Clean up pending history replace tracking when tabs are closed
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    pendingHistoryReplace.delete(tabId);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      try {
        const res = await chrome.storage.session.get(['pendingHistoryReplace']);
        const arr = Array.isArray(res.pendingHistoryReplace) ? res.pendingHistoryReplace : [];
        if (arr.includes(tabId)) {
          const nextArr = arr.filter(id => id !== tabId);
          await chrome.storage.session.set({ pendingHistoryReplace: nextArr });
        }
      } catch(e) {}
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener(async (tabId, info) => {
    if (info.status === 'complete') {
      const isPending = await checkAndRemovePendingTab(tabId);
      if (isPending) {
        if (chrome.scripting && chrome.scripting.executeScript) {
          chrome.scripting.executeScript({
            target: { tabId },
            func: () => { window.history.replaceState(null, '', window.location.href); }
          }).catch(() => {});
        }
      }
    }
  });
}

// Watch for navigation to Shorts URLs and redirect
if (typeof chrome !== 'undefined' && chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Only process main frame navigations
    if (details.frameId !== 0) return;

    const url = details.url;
    
    if (YOUTUBE_SHORTS_REGEX.test(url)) {
      try {
        const settings = await StorageUtil.getSettings();
        
        if (settings.extensionEnabled !== false && settings.shortsBlocker) {
          console.log("Shorts URL intercepted. Replacing history entry.", url);
          chrome.tabs.update(details.tabId, { url: YOUTUBE_HOME_URL });
          await markPendingTab(details.tabId);
        }
      } catch(e) {}
    }
  }, { url: [{ hostContains: 'youtube.com' }] });
}

// Handle SPA navigation on YouTube
if (typeof chrome !== 'undefined' && chrome.webNavigation && chrome.webNavigation.onHistoryStateUpdated) {
  chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    if (details.frameId !== 0) return;

    const url = details.url;
    
    if (YOUTUBE_SHORTS_REGEX.test(url)) {
      try {
        const settings = await StorageUtil.getSettings();
        
        if (settings.extensionEnabled !== false && settings.shortsBlocker) {
          console.log("Shorts SPA navigation intercepted. Redirecting via SPA nav.", url);
          if (chrome.scripting && chrome.scripting.executeScript) {
            chrome.scripting.executeScript({
              target: { tabId: details.tabId },
              func: () => {
                window.history.replaceState(null, '', 'https://www.youtube.com/');
                window.dispatchEvent(new CustomEvent('yt-navigate', {
                  detail: { endpoint: { browseEndpoint: { browseId: 'FEwhat_to_watch' } } }
                }));
              }
            }).catch(() => {
              chrome.tabs.update(details.tabId, { url: YOUTUBE_HOME_URL });
            });
          } else {
            chrome.tabs.update(details.tabId, { url: YOUTUBE_HOME_URL });
          }
        }
      } catch(e) {}
    }
  }, { url: [{ hostContains: 'youtube.com' }] });
}

// Listen for messages from content scripts or popup
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) return false;

    if (request.action === "getSettings") {
      StorageUtil.getSettings()
        .then(settings => sendResponse(settings))
        .catch(err => sendResponse({ error: err ? (err.message || String(err)) : "Failed to fetch settings" }));
      return true; // Indicate async response
    }
    
    if (request.action === "getTracking") {
      StorageUtil.getTracking()
        .then(tracking => sendResponse(tracking))
        .catch(err => sendResponse({ error: err ? (err.message || String(err)) : "Failed to fetch tracking" }));
      return true;
    }

    // MAIN-world ad skip injection: fires skip commands from the page's own JS context
    // where isTrusted is not enforced, Shadow DOMs are traversable, and YouTube's player API is accessible.
    if (request.action === "skipYouTubeAdMainWorld") {
      const tabId = sender && sender.tab && sender.tab.id;
      if (tabId && chrome.scripting && chrome.scripting.executeScript) {
        chrome.scripting.executeScript({
          target: { tabId },
          world: "MAIN",
          func: () => {
            try {
              let skipped = false;

              // 1. Helper to find element even inside open Shadow DOMs
              const queryDeep = (selector, root = document) => {
                try {
                  const el = root.querySelector(selector);
                  if (el) return el;
                  const all = root.querySelectorAll('*');
                  for (let i = 0; i < all.length; i++) {
                    if (all[i].shadowRoot) {
                      const found = queryDeep(selector, all[i].shadowRoot);
                      if (found) return found;
                    }
                  }
                } catch(e) {}
                return null;
              };

              // 2. Direct YouTube Player API skipAd() or cancelPlayback()
              const player = document.getElementById('movie_player') ||
                             document.querySelector('.html5-video-player');
              if (player) {
                if (typeof player.skipAd === 'function') {
                  try { player.skipAd(); skipped = true; } catch(e) {}
                }
                if (typeof player.cancelPlayback === 'function' && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
                  try { player.cancelPlayback(); skipped = true; } catch(e) {}
                }
              }

              // 3. Skip Button selectors across main DOM & Shadow DOM
              const selectors = [
                '.ytp-ad-skip-button-modern',
                'button.ytp-ad-skip-button-modern',
                '.ytp-ad-skip-button-slot-modern button',
                '.ytp-ad-skip-button-slot-modern',
                '.ytp-ad-skip-button-slot button',
                '.ytp-ad-skip-button-slot',
                '.ytp-ad-player-overlay-skip-or-preview button',
                '.ytp-ad-player-overlay-skip-or-preview',
                '.ytp-ad-skip-button-container button',
                '.ytp-ad-skip-button-container',
                'button.ytp-skip-ad-button',
                '.ytp-skip-ad-button',
                'button.ytp-ad-skip-button',
                '.ytp-ad-skip-button',
                '.ytp-ad-skip-button-text',
                'button[aria-label*="Skip ad" i]',
                'button[aria-label*="Skip ads" i]',
                'button[aria-label*="Skip advertisement" i]',
                '[aria-label*="Skip ad" i]',
                'button[id^="skip-button"]',
                '.videoAdUiSkipButton'
              ];

              const eventOpts = {
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window,
                detail: 1,
                button: 0,
                buttons: 1,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true
              };

              for (const sel of selectors) {
                try {
                  const btn = queryDeep(sel);
                  if (btn) {
                    // Trigger comprehensive event sequence on the button
                    try { btn.dispatchEvent(new PointerEvent('pointerdown', eventOpts)); } catch(e) {}
                    try { btn.dispatchEvent(new MouseEvent('mousedown', eventOpts)); } catch(e) {}
                    try { btn.dispatchEvent(new PointerEvent('pointerup', eventOpts)); } catch(e) {}
                    try { btn.dispatchEvent(new MouseEvent('mouseup', eventOpts)); } catch(e) {}
                    try { btn.dispatchEvent(new MouseEvent('click', eventOpts)); } catch(e) {}
                    if (typeof btn.click === 'function') {
                      try { btn.click(); } catch(e) {}
                    }
                    // Also trigger on parent container if present
                    if (btn.parentElement) {
                      try { btn.parentElement.dispatchEvent(new MouseEvent('click', eventOpts)); } catch(e) {}
                      if (typeof btn.parentElement.click === 'function') {
                        try { btn.parentElement.click(); } catch(e) {}
                      }
                    }
                    skipped = true;
                    break;
                  }
                } catch(e) {}
              }

              // 4. Auto-resume video playback if paused
              const video = document.querySelector('#movie_player video, .html5-video-player video, video');
              if (video && video.paused && !video.ended) {
                try { video.play().catch(() => {}); } catch(e) {}
              }

              return { skipped };
            } catch(e) {
              return { skipped: false, error: String(e) };
            }
          }
        }).then(results => {
          const result = results && results[0] && results[0].result;
          sendResponse({ success: true, result });
        }).catch(err => {
          sendResponse({ success: false, error: String(err) });
        });
      } else {
        sendResponse({ success: false, error: "No tabId or scripting API unavailable" });
      }
      return true;
    }

    if (request.action === "openOptionsPage") {
      try {
        const targetTab = request.tab || '';
        const targetHash = targetTab ? `#${targetTab}` : '';
        const optionsBaseUrl = chrome.runtime.getURL('options/options.html');
        const fullOptionsUrl = targetTab ? `${optionsBaseUrl}#${targetTab}` : optionsBaseUrl;

        const activateTab = (tab) => {
          if (!tab || !tab.id) {
            openNewTab();
            return;
          }
          const updateProps = { active: true };
          if (targetTab) {
            updateProps.url = fullOptionsUrl;
          }
          chrome.tabs.update(tab.id, updateProps, (updatedTab) => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
              openNewTab();
              return;
            }
            if (targetTab && chrome.tabs && chrome.tabs.sendMessage) {
              try {
                chrome.tabs.sendMessage(tab.id, { action: "switchTab", tab: targetTab }, () => {
                  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                    const _err = chrome.runtime.lastError;
                  }
                });
              } catch(e) {}
            }
            if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.update && tab.windowId !== undefined) {
              chrome.windows.update(tab.windowId, { focused: true }, () => {
                sendResponse({ success: true, tabId: tab.id, reused: true });
              });
            } else {
              sendResponse({ success: true, tabId: tab.id, reused: true });
            }
          });
        };

        const openNewTab = () => {
          if (!targetTab && chrome.runtime && typeof chrome.runtime.openOptionsPage === 'function') {
            try {
              chrome.runtime.openOptionsPage(() => {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                  fallbackCreateTab();
                } else {
                  sendResponse({ success: true, reused: false });
                }
              });
              return;
            } catch (err) {}
          }
          fallbackCreateTab();
        };

        const fallbackCreateTab = () => {
          if (chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({ url: fullOptionsUrl }, (tab) => {
              sendResponse({ success: true, tabId: tab ? tab.id : null, reused: false });
            });
          } else {
            sendResponse({ success: false, error: "No tab API available" });
          }
        };

        if (chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs) => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) tabs = [];
            if (!tabs) tabs = [];
            const existingTab = tabs.find(t => t && t.url && (t.url === optionsBaseUrl || t.url.includes('options/options.html')));
            if (existingTab) {
              activateTab(existingTab);
            } else {
              openNewTab();
            }
          });
        } else {
          openNewTab();
        }
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return true; // Keep message channel open for async response
    }
  });
}

// Global Keyboard Command Shortcuts Listener
if (typeof chrome !== 'undefined' && chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    try {
      if (command === 'toggle-shield') {
        const s = await StorageUtil.getSettings();
        const nextState = !(s.extensionEnabled !== false);
        s.extensionEnabled = nextState;
        await StorageUtil.saveSettings(s);
        console.log(`[YouTube Shield] Master Power toggled via shortcut: ${s.extensionEnabled}`);
      } else if (command === 'toggle-shorts') {
        const s = await StorageUtil.getSettings();
        s.shortsBlocker = !s.shortsBlocker;
        await StorageUtil.saveSettings(s);
        console.log(`[YouTube Shield] Shorts Blocker toggled via shortcut: ${s.shortsBlocker}`);
      }
    } catch(e) {}
  });
}
