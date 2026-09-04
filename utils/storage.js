// Default settings for the extension
const DEFAULT_SETTINGS = {
  extensionEnabled: true, // Master ON/OFF toggle for entire extension
  shortsBlocker: true,
  focusMode: true,
  studyMode: false,
  goalMode: false,
  learningGoal: "Learn something new",
  focusReminderInterval: 60, // in minutes
  timeManager: {
    enabled: false,
    dailyLimitMinutes: 60, // 60 minutes daily limit
    scheduleEnabled: false,
    scheduleStart: "09:00",
    scheduleEnd: "17:00",
    snoozeUntil: 0 // timestamp for temporary emergency extension
  },
  uiCleaner: {
    hideBell: true,
    hideSubCount: false,
    hideChat: true,
    hideTrending: true,
    hideExplore: true,
    hideMiniPlayer: false,
    hideAutoplay: true
  },
  blockedKeywords: [], // e.g. ["gaming", "vlog", "reaction", "prank"]
  blockedChannels: [], // e.g. ["GamingChannel", "VlogChannel"]
  ghostShield: true, // Creative Mode: Ghost Shield (Strict Purge) - purges blocked content from feeds & strictly denies playback if clicked
  audioEffects: true,
  autoSkipAds: true, // Automatically click the Skip Ad button once it appears
  volumeBooster: {
    volumeLevel: 100,  // 100% = normal, max 600%
    bassLevel: 0,       // 0dB = flat, max +20dB
    eqEnabled: true,
    preset: 'Flat',
    eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    noiseRemover: true  // Dynamic Anti-Distortion, Subsonic Filter & Noise Clarifier
  },
  pomodoro: {
    enabled: true,
    workMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4,
    autoStartBreaks: true,
    autoStartWork: false,
    soundAlerts: true,
    autoPause: true
  }
};

const DEFAULT_TRACKING = {
  dailyWatchTime: {},
  dailyLearningTime: {},
  hourlyWatchTime: {},
  hourlyLearningTime: {},
  timelineLog: [],
  timelineMigrated: true,
  weeklyTotal: 0,
  monthlyTotal: 0,
  weeklyLearningTotal: 0,
  monthlyLearningTotal: 0,
  lifetimeLearningTotal: 0,
  activeSessionStart: 0,
  lastReminderTriggered: 0,
  gamification: {
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
  }
};

// In-Memory Fallback Caches
let memorySettingsCache = null;
let memoryTrackingCache = null;

// Helper to construct deep-merged settings object
function buildMergedSettings(stored) {
  if (!stored) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  merged.uiCleaner = { ...DEFAULT_SETTINGS.uiCleaner, ...(stored.uiCleaner || {}) };
  merged.timeManager = { ...DEFAULT_SETTINGS.timeManager, ...(stored.timeManager || {}) };
  merged.pomodoro = { ...DEFAULT_SETTINGS.pomodoro, ...(stored.pomodoro || {}) };
  merged.volumeBooster = { ...DEFAULT_SETTINGS.volumeBooster, ...(stored.volumeBooster || {}) };
  if (stored.volumeBooster && Array.isArray(stored.volumeBooster.eqGains)) {
    merged.volumeBooster.eqGains = [...stored.volumeBooster.eqGains];
  } else {
    merged.volumeBooster.eqGains = [...DEFAULT_SETTINGS.volumeBooster.eqGains];
  }
  merged.blockedKeywords = Array.isArray(stored.blockedKeywords) ? [...stored.blockedKeywords] : [...DEFAULT_SETTINGS.blockedKeywords];
  merged.blockedChannels = Array.isArray(stored.blockedChannels) ? [...stored.blockedChannels] : [...DEFAULT_SETTINGS.blockedChannels];
  return merged;
}

/**
 * Sanitizes YouTube channel name strings by collapsing whitespace, stripping
 * tooltip artifacts, and deduplicating concatenated child node text (e.g. "Firstpost Firstpost").
 * @param {string} rawName - Raw channel string from DOM or storage
 * @returns {string} Cleaned channel name
 */
function cleanChannelName(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return 'YouTube Channel';
  }

  // 1. Normalize whitespace and trim
  let clean = rawName.replace(/\r\n|\r|\n|\t/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean || clean.toLowerCase() === 'youtube') {
    return 'YouTube Channel';
  }

  // 2. Remove common YouTube DOM tooltip / button suffix artifacts
  clean = clean.replace(/\s*(?:Subscribe|Subscribed|Verified|•\s*Subscribe)\s*$/i, '').trim();

  // 3. Deduplicate concatenated duplicate phrases (e.g., "Firstpost Firstpost", "Linus Tech Tips Linus Tech Tips")
  const words = clean.split(' ');
  // Try 2-way word deduplication first ("X X" → "X")
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    const firstHalf = words.slice(0, half).join(' ');
    const secondHalf = words.slice(half).join(' ');
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      clean = firstHalf;
    }
  }
  // Try 3-way word deduplication independently ("X X X" → "X")
  // Must run even when length is also divisible by 2 (e.g. 6 words: "A B A B A B")
  if (clean === clean) { // always runs — kept for readability parity
    const w3 = clean.split(' ');
    if (w3.length >= 3 && w3.length % 3 === 0) {
      const third = w3.length / 3;
      const p1 = w3.slice(0, third).join(' ');
      const p2 = w3.slice(third, 2 * third).join(' ');
      const p3 = w3.slice(2 * third).join(' ');
      if (p1.toLowerCase() === p2.toLowerCase() && p2.toLowerCase() === p3.toLowerCase()) {
        clean = p1;
      }
    }
  }
  // Character-level fallback for short duplicated strings ("ABAB" → "AB")
  if (clean.length >= 4) {
    const len = clean.length;
    if (len % 2 === 0) {
      const halfLen = len / 2;
      const firstStr = clean.slice(0, halfLen);
      const secondStr = clean.slice(halfLen);
      if (firstStr.toLowerCase() === secondStr.toLowerCase()) {
        clean = firstStr;
      }
    }
  }

  return clean || 'YouTube Channel';
}

/**
 * One-time idempotent migration that merges consecutive duplicate same-video records
 * in tracking.timelineLog and sanitizes historical channel names.
 * @param {Object} tracking - Tracking state object
 * @returns {Object} Migrated tracking object
 */
function migrateTimelineLog(tracking) {
  if (!tracking || typeof tracking !== 'object') return tracking;
  if (Array.isArray(tracking)) {
    const temp = { timelineLog: tracking };
    migrateTimelineLog(temp);
    return temp.timelineLog;
  }
  if (!Array.isArray(tracking.timelineLog) || tracking.timelineLog.length === 0) {
    if (!Array.isArray(tracking.timelineLog)) tracking.timelineLog = [];
    tracking.timelineMigrated = true;
    return tracking;
  }

  const rawLogs = tracking.timelineLog;
  const migrated = [];

  for (let i = 0; i < rawLogs.length; i++) {
    const item = rawLogs[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    if (Object.keys(item).length === 0) continue;

    const hasTitle = item.title && String(item.title).trim().length > 0;
    const hasVideoId = item.videoId && String(item.videoId).trim().length > 0;
    const hasChannel = item.channel && String(item.channel).trim().length > 0;
    const hasTimestamp = typeof item.timestamp === 'number' && !isNaN(item.timestamp) && item.timestamp > 0;
    const hasDuration = (typeof item.durationSeconds === 'number' && item.durationSeconds > 0) ||
                        (typeof item.durationMinutes === 'number' && item.durationMinutes > 0);

    if (!hasTitle && !hasVideoId && !hasChannel && !hasTimestamp && !hasDuration) {
      continue;
    }

    const cleanCh = cleanChannelName(item.channel);
    const title = item.title ? String(item.title).trim() : 'YouTube Video';
    
    // Robust duration extraction supporting durationSeconds or durationMinutes
    let duration = 0;
    if (typeof item.durationSeconds === 'number' && !isNaN(item.durationSeconds)) {
      duration = item.durationSeconds;
    } else if (typeof item.durationMinutes === 'number' && !isNaN(item.durationMinutes)) {
      duration = item.durationMinutes * 60;
    } else if (item.durationSeconds) {
      duration = parseInt(item.durationSeconds, 10) || 0;
    } else if (item.durationMinutes) {
      duration = (parseInt(item.durationMinutes, 10) || 0) * 60;
    }

    // Derive missing dateKey from timestamp
    let dateKey = item.dateKey;
    if (!dateKey && item.timestamp) {
      const d = new Date(item.timestamp);
      if (!isNaN(d.getTime())) {
        dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    if (!dateKey) {
      const now = new Date();
      dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    const normalized = {
      ...item,
      title: title,
      channel: cleanCh,
      durationSeconds: duration,
      durationMinutes: Math.round(duration / 60),
      dateKey: dateKey,
      status: item.status || 'watched'
    };

    if (migrated.length === 0) {
      migrated.push(normalized);
      continue;
    }

    const prev = migrated[migrated.length - 1];
    const isBothWatched = prev.status === 'watched' && normalized.status === 'watched';
    const isSameDate = prev.dateKey === normalized.dateKey;
    const isSameTitle = Boolean(prev.title && normalized.title && prev.title.trim().toLowerCase() === normalized.title.trim().toLowerCase());
    const isSameVideoId = Boolean(prev.videoId && normalized.videoId && prev.videoId === normalized.videoId);
    const isDifferentVideoId = Boolean(prev.videoId && normalized.videoId && prev.videoId !== normalized.videoId);
    const isSameVideo = !isDifferentVideoId && (isSameVideoId || isSameTitle);
    const isSameChannel = !prev.channel || !normalized.channel ||
      prev.channel === 'YouTube Channel' || normalized.channel === 'YouTube Channel' ||
      prev.channel.toLowerCase() === normalized.channel.toLowerCase();

    if (isBothWatched && isSameDate && isSameVideo && isSameChannel) {
      prev.durationSeconds = (prev.durationSeconds || 0) + normalized.durationSeconds;
      prev.durationMinutes = Math.round(prev.durationSeconds / 60);
      prev.endTime = normalized.endTime || prev.endTime;
      prev.timestamp = Math.max(prev.timestamp || 0, normalized.timestamp || 0);
      prev.lastActiveTimestamp = Math.max(prev.lastActiveTimestamp || 0, normalized.lastActiveTimestamp || normalized.timestamp || 0);
      if (normalized.isLearning) prev.isLearning = true;
      if (normalized.mode && normalized.mode !== 'Standard') prev.mode = normalized.mode;
      if (normalized.videoId && !prev.videoId) prev.videoId = normalized.videoId;
      if (prev.channel === 'YouTube Channel' && normalized.channel !== 'YouTube Channel') {
        prev.channel = normalized.channel;
      }
    } else {
      migrated.push(normalized);
    }
  }

  tracking.timelineLog = migrated.length > 500 ? migrated.slice(-500) : migrated;
  tracking.timelineMigrated = true;
  return tracking;
}

// Helper to construct deep-merged tracking object
function buildMergedTracking(stored) {
  if (!stored) return JSON.parse(JSON.stringify(DEFAULT_TRACKING));
  const mergedGamification = {
    ...DEFAULT_TRACKING.gamification,
    ...(stored.gamification || {})
  };
  if (!Array.isArray(mergedGamification.badges)) {
    mergedGamification.badges = [];
  }
  if (typeof mergedGamification.unlockedBadgeDates !== 'object' || mergedGamification.unlockedBadgeDates === null) {
    mergedGamification.unlockedBadgeDates = {};
  }
  let lifetimeLearningTotal = typeof stored.lifetimeLearningTotal === 'number' && !isNaN(stored.lifetimeLearningTotal)
    ? stored.lifetimeLearningTotal
    : 0;

  if (lifetimeLearningTotal === 0 && stored) {
    const dailyLearn = typeof stored.dailyLearningTime === 'object' && stored.dailyLearningTime !== null ? stored.dailyLearningTime : {};
    const sumDaily = Object.values(dailyLearn).reduce((acc, v) => acc + (Number(v) || 0), 0);
    lifetimeLearningTotal = Math.max(sumDaily, stored.monthlyLearningTotal || 0, stored.weeklyLearningTotal || 0);
  }

  return {
    ...DEFAULT_TRACKING,
    ...stored,
    lifetimeLearningTotal: lifetimeLearningTotal,
    dailyWatchTime: typeof stored.dailyWatchTime === 'object' && stored.dailyWatchTime !== null ? { ...(DEFAULT_TRACKING.dailyWatchTime || {}), ...stored.dailyWatchTime } : { ...DEFAULT_TRACKING.dailyWatchTime },
    dailyLearningTime: typeof stored.dailyLearningTime === 'object' && stored.dailyLearningTime !== null ? { ...(DEFAULT_TRACKING.dailyLearningTime || {}), ...stored.dailyLearningTime } : { ...DEFAULT_TRACKING.dailyLearningTime },
    hourlyWatchTime: typeof stored.hourlyWatchTime === 'object' && stored.hourlyWatchTime !== null ? stored.hourlyWatchTime : {},
    hourlyLearningTime: typeof stored.hourlyLearningTime === 'object' && stored.hourlyLearningTime !== null ? stored.hourlyLearningTime : {},
    timelineLog: Array.isArray(stored.timelineLog) ? stored.timelineLog : [],
    timelineMigrated: stored && stored.timelineMigrated !== undefined ? Boolean(stored.timelineMigrated) : false,
    gamification: mergedGamification
  };
}

// Storage Utilities with 3-tier cascade and guarded try-catch async wrappers
const StorageUtil = {
  // Clear in-memory caches (for testing & state reset)
  clearMemoryCache: () => {
    memorySettingsCache = null;
    memoryTrackingCache = null;
  },

  // Check if extension context is valid
  isContextValid: () => {
    try {
      wrapStorageMethods();
      return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  },

  // Get settings from 3-tier cascade: chrome.storage.sync & chrome.storage.local (timestamp merged) -> memorySettingsCache
  getSettings: async () => {
    try {
      if (!StorageUtil.isContextValid() || typeof chrome === 'undefined' || !chrome.storage) {
        return memorySettingsCache ? JSON.parse(JSON.stringify(memorySettingsCache)) : JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      }

      let syncSettings = null;
      let localSettings = null;

      // Fetch from chrome.storage.sync
      if (chrome.storage.sync) {
        try {
          const result = await chrome.storage.sync.get(["settings"]).catch(() => null);
          if (result && result.settings) {
            syncSettings = result.settings;
          }
        } catch (e) {}
      }

      // Fetch from chrome.storage.local
      if (chrome.storage.local) {
        try {
          const localResult = await chrome.storage.local.get(["settings"]).catch(() => null);
          if (localResult && localResult.settings) {
            localSettings = localResult.settings;
          }
        } catch (e) {}
      }

      // Select most recent settings based on _lastUpdated timestamp
      let storedSettings = null;
      if (syncSettings && localSettings) {
        const syncTs = Number(syncSettings._lastUpdated) || 0;
        const localTs = Number(localSettings._lastUpdated) || 0;
        storedSettings = localTs >= syncTs ? localSettings : syncSettings;
      } else {
        storedSettings = localSettings || syncSettings;
      }

      if (storedSettings) {
        const merged = buildMergedSettings(storedSettings);
        memorySettingsCache = JSON.parse(JSON.stringify(merged));
        return merged;
      }

      if (memorySettingsCache) {
        return JSON.parse(JSON.stringify(memorySettingsCache));
      }

      const defaults = buildMergedSettings(null);
      memorySettingsCache = JSON.parse(JSON.stringify(defaults));
      return defaults;
    } catch (e) {
      // Tier 3: In-memory cache fallback on exception
      if (memorySettingsCache) {
        return JSON.parse(JSON.stringify(memorySettingsCache));
      }
      return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
  },

  // Save settings through 3-tier cascade with quota & context invalidation handling
  saveSettings: async (settings) => {
    try {
      if (!settings) return;
      settings._lastUpdated = Date.now();
      memorySettingsCache = JSON.parse(JSON.stringify(settings));

      if (!StorageUtil.isContextValid() || typeof chrome === 'undefined' || !chrome.storage) {
        return;
      }

      let savedToSync = false;

      // Attempt write to chrome.storage.sync
      if (chrome.storage.sync) {
        try {
          await chrome.storage.sync.set({ settings });
          savedToSync = true;
        } catch (e) {
          // Quota bytes per item, Safari unavailability, or context invalidation
          savedToSync = false;
        }
      }

      // Always update chrome.storage.local to guarantee local storage contains latest payload
      if (chrome.storage.local) {
        try {
          await chrome.storage.local.set({ settings });
        } catch (e) {}
      }
    } catch (e) {}
  },

  // Update a specific setting
  updateSetting: async (key, value) => {
    try {
      const settings = await StorageUtil.getSettings();
      if (!settings) return;
      settings[key] = value;
      await StorageUtil.saveSettings(settings);
    } catch (e) {}
  },

  // Update a specific Time Manager setting
  updateTimeManagerSetting: async (key, value) => {
    try {
      const settings = await StorageUtil.getSettings();
      if (!settings) return;
      if (!settings.timeManager) settings.timeManager = { ...DEFAULT_SETTINGS.timeManager };
      settings.timeManager[key] = value;
      await StorageUtil.saveSettings(settings);
    } catch (e) {}
  },

  // Update a specific Pomodoro setting
  updatePomodoroSetting: async (key, value) => {
    try {
      const settings = await StorageUtil.getSettings();
      if (!settings) return;
      if (!settings.pomodoro) settings.pomodoro = { ...DEFAULT_SETTINGS.pomodoro };
      settings.pomodoro[key] = value;
      await StorageUtil.saveSettings(settings);
    } catch (e) {}
  },

  // Update a specific Volume Booster setting
  updateVolumeBoosterSetting: async (key, value) => {
    try {
      const settings = await StorageUtil.getSettings();
      if (!settings) return;
      if (!settings.volumeBooster) settings.volumeBooster = { ...DEFAULT_SETTINGS.volumeBooster };
      if (key === 'eqGains') {
        settings.volumeBooster.eqGains = Array.isArray(value) ? [...value] : [...DEFAULT_SETTINGS.volumeBooster.eqGains];
      } else if (key === 'eqEnabled') {
        settings.volumeBooster.eqEnabled = Boolean(value);
      } else {
        settings.volumeBooster[key] = value;
      }
      await StorageUtil.saveSettings(settings);
    } catch (e) {}
  },

  // Update a specific UI Cleaner toggle
  updateUICleanerSetting: async (key, value) => {
    try {
      const settings = await StorageUtil.getSettings();
      if (!settings) return;
      if (!settings.uiCleaner) settings.uiCleaner = {};
      settings.uiCleaner[key] = value;
      await StorageUtil.saveSettings(settings);
    } catch (e) {}
  },

  // Sanitize and deduplicate YouTube channel names (e.g. "Firstpost Firstpost" -> "Firstpost")
  cleanChannelName: (rawName) => cleanChannelName(rawName),

  // One-time, idempotent migration for historical timeline logs
  migrateTimelineLog: (tracking) => migrateTimelineLog(tracking),

  // Add event to timeline log (chronological session activity stream)
  addTimelineEvent: async (eventData) => {
    try {
      const tracking = await StorageUtil.getTracking();
      if (!tracking) return;
      if (!Array.isArray(tracking.timelineLog)) tracking.timelineLog = [];

      const now = new Date();
      const defaultDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const defaultTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const cleanCh = cleanChannelName(eventData.channel);
      const nowTs = eventData.timestamp || Date.now();

      // Consolidate duplicate consecutive updates within 120s for continuous watched sessions
      const last = tracking.timelineLog[tracking.timelineLog.length - 1];
      const lastTs = last ? (last.lastActiveTimestamp || last.timestamp || 0) : 0;
      const gapMs = nowTs - lastTs;

      const isSameTitle = Boolean(last && last.title && eventData.title && last.title.trim().toLowerCase() === eventData.title.trim().toLowerCase());
      const isSameVideoId = Boolean(last && eventData.videoId && last.videoId && last.videoId === eventData.videoId);
      const isDifferentVideoId = Boolean(last && eventData.videoId && last.videoId && last.videoId !== eventData.videoId);
      const isSameVideo = Boolean(last && !isDifferentVideoId && (isSameVideoId || isSameTitle));

      if (last && isSameVideo && last.status === eventData.status && last.status === 'watched' && last.dateKey === (eventData.dateKey || defaultDateKey) && gapMs <= 120000) {
        last.durationSeconds = (last.durationSeconds || 0) + (eventData.durationSeconds || 0);
        last.endTime = eventData.endTime || defaultTime;
        last.lastActiveTimestamp = nowTs;
        last.timestamp = nowTs;
        if (cleanCh && cleanCh !== 'YouTube Channel') {
          last.channel = cleanCh;
        }
        if (eventData.videoId && !last.videoId) {
          last.videoId = eventData.videoId;
        }
        await StorageUtil.saveTracking(tracking);
        return;
      }

      const event = {
        id: 'evt_' + nowTs + '_' + Math.random().toString(36).substr(2, 5),
        videoId: eventData.videoId || null,
        timestamp: nowTs,
        lastActiveTimestamp: nowTs,
        dateKey: eventData.dateKey || defaultDateKey,
        startTime: eventData.startTime || defaultTime,
        endTime: eventData.endTime || defaultTime,
        title: eventData.title || 'YouTube Video',
        channel: cleanCh,
        durationSeconds: eventData.durationSeconds || 0,
        isLearning: Boolean(eventData.isLearning),
        mode: eventData.mode || 'Standard',
        status: eventData.status || 'watched' // 'watched', 'blocked', 'sprint'
      };

      tracking.timelineLog.push(event);

      // Keep max 500 timeline events to prevent storage bloat
      if (tracking.timelineLog.length > 500) {
        tracking.timelineLog = tracking.timelineLog.slice(-500);
      }

      await StorageUtil.saveTracking(tracking);
    } catch (e) {}
  },

  // Get tracking data using 2-tier cascade: chrome.storage.local -> memoryTrackingCache
  getTracking: async () => {
    try {
      if (!StorageUtil.isContextValid() || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        if (memoryTrackingCache) {
          if (!memoryTrackingCache.timelineMigrated) {
            migrateTimelineLog(memoryTrackingCache);
          }
          return JSON.parse(JSON.stringify(memoryTrackingCache));
        }
        const def = buildMergedTracking(null);
        def.timelineMigrated = true;
        return def;
      }
      const result = await chrome.storage.local.get(["tracking"]).catch(() => null);
      if (result && result.tracking) {
        let tr = result.tracking;
        if (!tr.timelineMigrated) {
          tr = migrateTimelineLog(tr);
          await chrome.storage.local.set({ tracking: tr }).catch(() => null);
        }
        const merged = buildMergedTracking(tr);
        memoryTrackingCache = JSON.parse(JSON.stringify(merged));
        return merged;
      }

      if (memoryTrackingCache) {
        if (!memoryTrackingCache.timelineMigrated) {
          migrateTimelineLog(memoryTrackingCache);
        }
        return JSON.parse(JSON.stringify(memoryTrackingCache));
      }
      
      const defaults = buildMergedTracking(null);
      defaults.timelineMigrated = true;
      memoryTrackingCache = JSON.parse(JSON.stringify(defaults));
      return defaults;
    } catch (e) {
      if (memoryTrackingCache) {
        if (!memoryTrackingCache.timelineMigrated) {
          migrateTimelineLog(memoryTrackingCache);
        }
        return JSON.parse(JSON.stringify(memoryTrackingCache));
      }
      return JSON.parse(JSON.stringify(DEFAULT_TRACKING));
    }
  },

  // Save tracking data using 2-tier cascade
  saveTracking: async (tracking) => {
    try {
      if (!tracking) return;
      memoryTrackingCache = JSON.parse(JSON.stringify(tracking));

      if (!StorageUtil.isContextValid() || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return;
      }
      await chrome.storage.local.set({ tracking }).catch(() => null);
    } catch (e) {}
  },

  // Expose schema merge helpers for background.js migration on update
  buildMergedSettings: (stored) => buildMergedSettings(stored),
  buildMergedTracking: (stored) => buildMergedTracking(stored)
};

function wrapStorageMethods() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    if (chrome.storage.local) {
      const proto = Object.getPrototypeOf(chrome.storage.local);
      if (proto && typeof proto.clear === 'function' && !proto._wrappedClear) {
        const origClear = proto.clear;
        proto.clear = function(...args) {
          memoryTrackingCache = null;
          memorySettingsCache = null;
          return origClear.apply(this, args);
        };
        proto._wrappedClear = true;
      }
    }
    if (chrome.storage.sync) {
      const proto = Object.getPrototypeOf(chrome.storage.sync);
      if (proto && typeof proto.clear === 'function' && !proto._wrappedClear) {
        const origClear = proto.clear;
        proto.clear = function(...args) {
          memorySettingsCache = null;
          return origClear.apply(this, args);
        };
        proto._wrappedClear = true;
      }
    }
  }
}
wrapStorageMethods();

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    try {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        try {
          if (namespace === 'sync' || namespace === 'local') {
            if (changes.settings) {
              memorySettingsCache = changes.settings.newValue ? buildMergedSettings(changes.settings.newValue) : null;
            }
            if (changes.tracking) {
              memoryTrackingCache = changes.tracking.newValue ? buildMergedTracking(changes.tracking.newValue) : null;
            }
          }
        } catch (e) {}
      });
    } catch (e) {}
  }

// Attach default configurations to StorageUtil namespace
StorageUtil.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
StorageUtil.DEFAULT_TRACKING = DEFAULT_TRACKING;
StorageUtil.clearMemoryCaches = () => {
  memorySettingsCache = null;
  memoryTrackingCache = null;
};

// Universal module export pattern
if (typeof window !== 'undefined') {
  window.StorageUtil = StorageUtil;
  window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  window.DEFAULT_TRACKING = DEFAULT_TRACKING;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageUtil;
  StorageUtil.StorageUtil = StorageUtil;
  StorageUtil.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  StorageUtil.DEFAULT_TRACKING = DEFAULT_TRACKING;
}



