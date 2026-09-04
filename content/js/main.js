// Main content script that orchestrates everything
(function () {
  // Ensure we don't initialize twice
  if (typeof window !== 'undefined' && window.shortsShieldInitialized) return;
  if (typeof window !== 'undefined') window.shortsShieldInitialized = true;

  console.log("Shorts Shield initializing...");

  // Default fallback settings incorporating all standard keys
  const DEFAULT_FALLBACK_SETTINGS = {
    extensionEnabled: true, // Master ON/OFF toggle
    shortsBlocker: true,
    focusMode: true,
    studyMode: false,
    goalMode: false,
    learningGoal: "Learn something new",
    focusReminderInterval: 60,
    timeManager: {
      enabled: false,
      dailyLimitMinutes: 60,
      scheduleEnabled: false,
      scheduleStart: "09:00",
      scheduleEnd: "17:00",
      snoozeUntil: 0
    },
    audioEffects: true,
    autoSkipAds: true,
    volumeBooster: { volumeLevel: 100, bassLevel: 0, eqEnabled: true, preset: 'Flat', eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    uiCleaner: { hideBell: true, hideChat: true, hideTrending: true, hideExplore: true,
                 hideSubCount: false, hideMiniPlayer: false, hideAutoplay: true }
  };

  // Helper: disable ALL features when master toggle is OFF
  // NOTE: HeaderButton is intentionally NOT disabled — Shield button always stays visible
  const disableAllFeatures = () => {
    if (window.ShortsBlocker) window.ShortsBlocker.disable();
    if (window.FocusMode) window.FocusMode.disable();
    if (window.StudyMode) window.StudyMode.disable();
    if (window.GoalMode) window.GoalMode.disable();
    if (window.UICleaner && typeof window.UICleaner.cleanup === 'function') window.UICleaner.cleanup();
    if (window.UICleanerInstance && typeof window.UICleanerInstance.disable === 'function') window.UICleanerInstance.disable();
    if (window.TimeManager) window.TimeManager.disable();
    if (window.FeedController) {
      window.FeedController.disable();
      if (typeof window.FeedController.clearOffTopicCards === 'function') {
        window.FeedController.clearOffTopicCards();
      }
    }
    if (window.TimeTrackerInstance) window.TimeTrackerInstance.stopTracking();
    if (window.AdSkipper) window.AdSkipper.disable();
    if (window.QuickBlock && typeof window.QuickBlock.disable === 'function') window.QuickBlock.disable();
    console.log("Shorts Shield: Extension disabled by master toggle. Shield button remains visible.");
  };

  // Synchronously define applySettings and attach to window immediately
  const applySettings = (newSettings) => {
    if (!newSettings) return;

    // Master toggle: if extension is disabled, shut everything down and return
    if (newSettings.extensionEnabled === false) {
      disableAllFeatures();
      return;
    }

    if (window.TimeTrackerInstance) {
      window.TimeTrackerInstance.startTracking();
    }

    if (window.QuickBlock) {
      if (typeof window.QuickBlock.init === 'function') {
        window.QuickBlock.init();
      }
    }

    if (newSettings.shortsBlocker) {
      if (window.ShortsBlocker) window.ShortsBlocker.enable();
    } else {
      if (window.ShortsBlocker) window.ShortsBlocker.disable();
    }

    if (newSettings.focusMode) {
      if (window.FocusMode) window.FocusMode.enable();
    } else {
      if (window.FocusMode) window.FocusMode.disable();
    }

    if (window.FeedController) {
      window.FeedController.setBlocklist(newSettings.blockedKeywords || [], newSettings.blockedChannels || []);
    }

    if (newSettings.studyMode) {
      if (window.StudyMode) window.StudyMode.enable(newSettings.learningGoal);
    } else {
      if (window.StudyMode) window.StudyMode.disable();
    }

    if (newSettings.goalMode) {
      if (window.GoalMode) window.GoalMode.enable(newSettings.learningGoal);
    } else {
      if (window.GoalMode) window.GoalMode.disable();
    }

    if (window.FeedController) {
      if (newSettings.studyMode || newSettings.goalMode) {
        window.FeedController.enable(newSettings.learningGoal);
      } else {
        window.FeedController.disable();
      }
    }

    if (window.UICleaner) window.UICleaner.applySettings(newSettings.uiCleaner);

    if (newSettings.timeManager && newSettings.timeManager.enabled) {
      if (window.TimeManager) window.TimeManager.enable(newSettings.timeManager);
    } else {
      if (window.TimeManager) window.TimeManager.disable();
    }

    if (window.AudioEngine) {
      window.AudioEngine.enabled = (newSettings.audioEffects !== false);
    }

    // Auto Skip Ads
    if (window.AdSkipper) {
      if (newSettings.autoSkipAds) {
        window.AdSkipper.enable();
      } else {
        window.AdSkipper.disable();
      }
    }

    // Volume Booster, Bass Booster & 10-Band Equalizer
    if (window.VolumeBooster) {
      window.VolumeBooster.enable();
      const vb = newSettings.volumeBooster || {};
      window.VolumeBooster.setVolume(vb.volumeLevel != null ? vb.volumeLevel : 100);
      window.VolumeBooster.setBass(vb.bassLevel != null ? vb.bassLevel : 0);
      if (typeof window.VolumeBooster.setEqGains === 'function' && Array.isArray(vb.eqGains)) {
        window.VolumeBooster.setEqGains(vb.eqGains);
      }
      if (typeof window.VolumeBooster.setEqPreset === 'function' && vb.preset) {
        window.VolumeBooster.setEqPreset(vb.preset);
      }
      if (typeof window.VolumeBooster.setEqEnabled === 'function' && vb.eqEnabled !== undefined) {
        window.VolumeBooster.setEqEnabled(vb.eqEnabled);
      }
    }

    if (window.HeaderButton) {
      window.HeaderButton.enable();
    }
  };

  // Synchronously define showFocusReminderOverlay and attach to window
  const showFocusReminderOverlay = function() {
    if (document.getElementById('ss-focus-reminder')) return;

    const overlay = document.createElement('div');
    overlay.id = 'ss-focus-reminder';
    overlay.className = 'ss-focus-reminder-backdrop';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ss-focus-heading');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.88)',
      color: '#f8fafc',
      zIndex: '2147483645',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      backdropFilter: 'blur(16px)',
      webkitBackdropFilter: 'blur(16px)',
      boxSizing: 'border-box'
    });

    overlay.innerHTML = `
      <div class="ss-modal-card" style="background: rgba(15, 15, 26, 0.94); border: 1px solid rgba(99, 102, 241, 0.35); padding: 40px; border-radius: 20px; max-width: 500px; width: min(90vw, 500px); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15); animation: ssModalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); text-align: center; box-sizing: border-box;">
        <div style="font-size: 52px; margin-bottom: 16px; filter: drop-shadow(0 0 14px rgba(99, 102, 241, 0.45));">🤔</div>
        <h1 id="ss-focus-heading" style="font-size: 24px; font-weight: 800; margin-bottom: 16px; color: #f8fafc; letter-spacing: -0.02em;">Are you still watching intentionally?</h1>
        <p style="font-size: 14px; color: #94a3b8; margin-bottom: 28px; line-height: 1.5;">Take a moment to check in with your current session goals.</p>
        <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
          <button id="ss-btn-continue" class="ss-btn-gradient-primary" style="padding: 12px 24px; font-size: 16px; font-weight: 600; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border: none; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 14px rgba(37,99,235,0.4); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);">Continue</button>
          <button id="ss-btn-break" class="ss-btn-gradient-danger" style="padding: 12px 24px; font-size: 16px; font-weight: 600; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 14px rgba(239,68,68,0.4); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);">Take a Break</button>
        </div>
      </div>
    `;

    if (window.DOMUtils) {
      window.DOMUtils.appendChild(overlay);
    } else if (document.body) {
      document.body.appendChild(overlay);
    }

    const continueBtn = overlay.querySelector('#ss-btn-continue');
    const breakBtn = overlay.querySelector('#ss-btn-break');

    if (continueBtn && typeof continueBtn.focus === 'function') {
      try { continueBtn.focus(); } catch (e) {}
    }

    if (continueBtn) {
      continueBtn.addEventListener('click', () => { overlay.remove(); });
    }
    if (breakBtn) {
      breakBtn.addEventListener('click', () => {
        const video = document.querySelector('video');
        if (video && !video.paused) {
          try { video.pause(); } catch (e) {}
        }
        overlay.remove();
      });
    }
  };

  // Expose global methods on window synchronously
  if (typeof window !== 'undefined') {
    window.applySettings = applySettings;
    window.showFocusReminderOverlay = showFocusReminderOverlay;
  }

  // Multi-tier async settings fetcher with safe error handling
  const loadSettingsAsync = async () => {
    try {
      // Priority 1: Use StorageUtil directly if available
      if (typeof StorageUtil !== 'undefined' && typeof StorageUtil.getSettings === 'function') {
        const s = await StorageUtil.getSettings();
        if (s) return s;
      }
      // Priority 2: Use chrome.runtime.sendMessage IPC if available
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
        const s = await new Promise(resolve => {
          try {
            chrome.runtime.sendMessage({ action: "getSettings" }, (res) => {
              if (typeof chrome === 'undefined' || !chrome.runtime || chrome.runtime.lastError) {
                resolve(null);
              } else {
                resolve(res);
              }
            });
          } catch(e) {
            resolve(null);
          }
        });
        if (s) return s;
      }
    } catch(e) {
      console.warn("Shorts Shield: Error loading settings:", e);
    }
    return null;
  };

  // Execute non-blocking initial settings load
  loadSettingsAsync()
    .then(loadedSettings => {
      const initialSettings = loadedSettings || DEFAULT_FALLBACK_SETTINGS;
      applySettings(initialSettings);
    })
    .catch(() => {
      applySettings(DEFAULT_FALLBACK_SETTINGS);
    });

  // Content script initialization lifecycle
  const initContentScripts = () => {
    if (typeof window !== 'undefined' && window.TimeTrackerInstance) {
      window.TimeTrackerInstance.startTracking();
    }
    if (typeof window !== 'undefined' && window.QuickBlock && typeof window.QuickBlock.init === 'function') {
      window.QuickBlock.init();
    }
  };

  initContentScripts();

  // Listen for storage changes from both 'sync' and 'local' namespaces
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      try {
        if (typeof StorageUtil !== 'undefined' && typeof StorageUtil.isContextValid === 'function') {
          if (!StorageUtil.isContextValid()) return;
        }
        if (namespace === 'sync' || namespace === 'local') {
          if (changes.settings) {
            const newVal = changes.settings.newValue || {};
            applySettings(newVal);
          } else if (changes.blockedKeywords || changes.blockedChannels) {
            if (window.FeedController && typeof window.FeedController.setBlocklist === 'function') {
              const currentKws = changes.blockedKeywords ? (changes.blockedKeywords.newValue || []) : (window.FeedController.blockedKeywords || []);
              const currentChs = changes.blockedChannels ? (changes.blockedChannels.newValue || []) : (window.FeedController.blockedChannels || []);
              window.FeedController.setBlocklist(currentKws, currentChs);
            }
          }
        }
      } catch (e) {}
    });
  }

  // Listen for focus reminders from background script
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && request.action === "showFocusReminder") {
        if (typeof window !== 'undefined' && typeof window.showFocusReminderOverlay === 'function') {
          window.showFocusReminderOverlay();
        }
      }
    });
  }

})();
