# Technical Deep-Dive: Cross-Browser Storage Fallback Engine Architecture

**Author**: Explorer 1 (`explorer_m2_1`)  
**Target Milestone**: Milestone 2 (Cross-Browser Storage & Background Messaging Fallbacks)  
**Date**: 2026-08-10  
**Working Directory**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/explorer_m2_1`  
**Target File**: `/Users/shivarampatel/Desktop/shorts-shield/utils/storage.js`

---

## 1. Executive Summary

This investigation provides the comprehensive architecture, edge-case handling strategy, and step-by-step implementation guide for refactoring `utils/storage.js` to support:
1. **3-Tier Storage Cascade for Settings**: `chrome.storage.sync` -> `chrome.storage.local` -> `memorySettingsCache`.
2. **2-Tier Storage Cascade for Tracking Data**: `chrome.storage.local` -> `memoryTrackingCache`.
3. **Cross-Browser & Edge-Case Resilience**: Handling Safari WebExtension storage limitations, Chrome/Firefox storage quota limits (`QUOTA_BYTES_PER_ITEM`, `QUOTA_BYTES`), and Extension Context Invalidation.
4. **Real-Time Storage Alignment**: Maintaining internal in-memory caches and propagating storage changes dynamically via `chrome.storage.onChanged`.

---

## 2. Current Implementation Analysis (`utils/storage.js`)

### 2.1 Code Structure & Methods
Currently, `utils/storage.js` defines:
- **`DEFAULT_SETTINGS`**: Baseline settings object with default toggles (shortsBlocker: true, focusMode: true, studyMode: false, etc.).
- **`DEFAULT_TRACKING`**: Baseline tracking object (dailyWatchTime, dailyLearningTime, gamification stats, badges, etc.).
- **`StorageUtil`**:
  - `isContextValid()`: Checks `typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id`.
  - `getSettings()` (Lines 71–90):
    ```javascript
    getSettings: async () => {
      try {
        if (!StorageUtil.isContextValid() || !chrome.storage || !chrome.storage.sync) {
          return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }
        const result = await chrome.storage.sync.get(["settings"]).catch(() => null);
        if (result && result.settings) { ... }
        return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      } catch (e) {
        return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      }
    }
    ```
  - `saveSettings(settings)` (Lines 93–100):
    ```javascript
    saveSettings: async (settings) => {
      try {
        if (!StorageUtil.isContextValid() || !chrome.storage || !chrome.storage.sync) {
          return;
        }
        await chrome.storage.sync.set({ settings }).catch(() => null);
      } catch (e) {}
    }
    ```
  - `getTracking()` (Lines 138–170): Only queries `chrome.storage.local.get(["tracking"])`.
  - `saveTracking(tracking)` (Lines 173–180): Only writes to `chrome.storage.local.set({ tracking })`.

### 2.2 Vulnerabilities & Deficiencies Identified

1. **No Fallback to `chrome.storage.local` on Sync Failure**:
   - In Safari (where `chrome.storage.sync` may be unsupported or throw exceptions) or when sync is disabled in browser privacy settings, `getSettings()` immediately returns default settings without reading existing user configuration from `chrome.storage.local`.
   - `saveSettings()` silently drops writes when `chrome.storage.sync.set` fails, resulting in permanent settings loss.

2. **Uncaught Storage Quota Errors (`QUOTA_BYTES_PER_ITEM` / `QUOTA_BYTES`)**:
   - Chrome and Firefox enforce strict limits on `chrome.storage.sync` (8 KB per item, 100 KB total). When `blockedKeywords` or `blockedChannels` expand, `sync.set()` throws `QuotaExceededError`. The current code swallows the error with `.catch(() => null)` without attempting to save settings to `chrome.storage.local`.

3. **No In-Memory Cache Tier (`memorySettingsCache` / `memoryTrackingCache`)**:
   - When context invalidation occurs (e.g. extension reloaded/updated while YouTube content script is running) or inside restricted subframes, `chrome.storage` is inaccessible. The current code has no session-persistent in-memory variable to serve/retain state.

4. **Storage Event Misalignment in Content Script (`content/js/main.js`)**:
   - `content/js/main.js` line 112 filters storage events with `if (namespace === 'sync' && changes.settings)`. If settings are written to `chrome.storage.local` during sync fallback, content scripts ignore the change and fail to apply updated settings.

---

## 3. Refactored Storage Engine Architecture

### 3.1 Tiered Fallback Model

```
+-----------------------------------------------------------------------+
|                         SETTINGS READ / WRITE                          |
+-----------------------------------------------------------------------+
   |
   +---> [ Tier 1: chrome.storage.sync ] (Primary cross-device storage)
   |        | (If missing, throws error, or exceeds quota)
   |        v
   +---> [ Tier 2: chrome.storage.local ] (Secondary device-local storage)
   |        | (If context invalidated or storage disabled)
   |        v
   +---> [ Tier 3: memorySettingsCache ] (Tertiary in-memory session cache)


+-----------------------------------------------------------------------+
|                         TRACKING READ / WRITE                         |
+-----------------------------------------------------------------------+
   |
   +---> [ Tier 1: chrome.storage.local ] (Primary local storage)
   |        | (If context invalidated or storage disabled)
   |        v
   +---> [ Tier 2: memoryTrackingCache ] (Secondary in-memory session cache)
```

### 3.2 Detailed Logic Specifications

#### A. In-Memory Cache Initialization & Helper Functions
```javascript
// Module-scoped in-memory session caches initialized to defaults
let memorySettingsCache = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
let memoryTrackingCache = JSON.parse(JSON.stringify(DEFAULT_TRACKING));

// Utility to create isolated deep copies
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

// Helper for deep merging settings with default values
const mergeSettings = (stored) => {
  if (!stored || typeof stored !== 'object') return deepClone(DEFAULT_SETTINGS);
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  merged.uiCleaner = { ...DEFAULT_SETTINGS.uiCleaner, ...(stored.uiCleaner || {}) };
  merged.timeManager = { ...DEFAULT_SETTINGS.timeManager, ...(stored.timeManager || {}) };
  merged.blockedKeywords = Array.isArray(stored.blockedKeywords) ? [...stored.blockedKeywords] : [...DEFAULT_SETTINGS.blockedKeywords];
  merged.blockedChannels = Array.isArray(stored.blockedChannels) ? [...stored.blockedChannels] : [...DEFAULT_SETTINGS.blockedChannels];
  return merged;
};

// Helper for deep merging tracking data with default values
const mergeTracking = (stored) => {
  if (!stored || typeof stored !== 'object') return deepClone(DEFAULT_TRACKING);
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
  return {
    ...DEFAULT_TRACKING,
    ...stored,
    dailyWatchTime: { ...(DEFAULT_TRACKING.dailyWatchTime || {}), ...(stored.dailyWatchTime || {}) },
    dailyLearningTime: { ...(DEFAULT_TRACKING.dailyLearningTime || {}), ...(stored.dailyLearningTime || {}) },
    gamification: mergedGamification
  };
};
```

#### B. 3-Tier Settings Reader (`getSettings()`)
```javascript
getSettings: async () => {
  // Tier 1: Try chrome.storage.sync
  try {
    if (StorageUtil.isContextValid() && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      const syncResult = await chrome.storage.sync.get(["settings"]).catch(() => null);
      if (syncResult && syncResult.settings) {
        const merged = mergeSettings(syncResult.settings);
        memorySettingsCache = deepClone(merged);
        return deepClone(merged);
      }
    }
  } catch (e) {
    // Sync failed; fall through to Tier 2
  }

  // Tier 2: Try chrome.storage.local
  try {
    if (StorageUtil.isContextValid() && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const localResult = await chrome.storage.local.get(["settings"]).catch(() => null);
      if (localResult && localResult.settings) {
        const merged = mergeSettings(localResult.settings);
        memorySettingsCache = deepClone(merged);
        return deepClone(merged);
      }
    }
  } catch (e) {
    // Local failed; fall through to Tier 3
  }

  // Tier 3: Memory Cache Fallback
  return deepClone(memorySettingsCache);
}
```

#### C. 3-Tier Settings Writer (`saveSettings(settings)`)
```javascript
saveSettings: async (settings) => {
  // Always update Tier 3 (memory cache) immediately
  const merged = mergeSettings(settings);
  memorySettingsCache = deepClone(merged);

  if (!StorageUtil.isContextValid() || typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }

  let syncSuccess = false;

  // Tier 1: Attempt save to chrome.storage.sync
  try {
    if (chrome.storage.sync) {
      await chrome.storage.sync.set({ settings: merged });
      syncSuccess = true;
    }
  } catch (e) {
    // Catch quota exceeded or Safari sync runtime errors
    syncSuccess = false;
  }

  // Write-through / Fallback to Tier 2: chrome.storage.local
  try {
    if (chrome.storage.local) {
      await chrome.storage.local.set({ settings: merged });
    }
  } catch (e) {
    // Local save failed; memorySettingsCache retains current state
  }
}
```

#### D. 2-Tier Tracking Reader (`getTracking()`)
```javascript
getTracking: async () => {
  // Tier 1: Try chrome.storage.local
  try {
    if (StorageUtil.isContextValid() && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(["tracking"]).catch(() => null);
      if (result && result.tracking) {
        const merged = mergeTracking(result.tracking);
        memoryTrackingCache = deepClone(merged);
        return deepClone(merged);
      }
    }
  } catch (e) {
    // Local failed; fall through to Tier 2
  }

  // Tier 2: Memory Cache Fallback
  return deepClone(memoryTrackingCache);
}
```

#### E. 2-Tier Tracking Writer (`saveTracking(tracking)`)
```javascript
saveTracking: async (tracking) => {
  // Always update Tier 2 (memory cache) immediately
  const merged = mergeTracking(tracking);
  memoryTrackingCache = deepClone(merged);

  if (!StorageUtil.isContextValid() || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return;
  }

  // Tier 1: Attempt save to chrome.storage.local
  try {
    await chrome.storage.local.set({ tracking: merged });
  } catch (e) {
    // Local save failed; memoryTrackingCache retains current state
  }
}
```

#### F. Real-Time `onChanged` Listener Synchronization
To keep in-memory caches aligned with external writes (e.g. settings updated from popup or options page):
```javascript
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  try {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if ((namespace === 'sync' || namespace === 'local') && changes.settings && changes.settings.newValue) {
        memorySettingsCache = mergeSettings(changes.settings.newValue);
      }
      if (namespace === 'local' && changes.tracking && changes.tracking.newValue) {
        memoryTrackingCache = mergeTracking(changes.tracking.newValue);
      }
    });
  } catch (e) {
    // Ignore listener registration error in restricted scopes
  }
}
```

---

## 4. Cross-Browser Edge Cases & Mitigation Matrix

| Edge Case / Failure Scenario | Browser / Environment | Risk Level | Root Cause | Architectural Solution |
|------------------------------|-----------------------|------------|------------|------------------------|
| **Disabled `chrome.storage.sync`** | Safari (WebExtension mode) | High | Safari does not support sync storage in all contexts or returns `undefined`. | `getSettings` & `saveSettings` catch undefined `chrome.storage.sync` and fall back seamlessly to `chrome.storage.local`. |
| **`QuotaExceededError`** | Chrome / Firefox | High | Storage items exceeding `QUOTA_BYTES_PER_ITEM` (8,192 B) fail on `sync.set`. | `saveSettings` catches quota errors in sync write, logs warning, and completes write to `chrome.storage.local`. |
| **Extension Context Invalidation** | All Browsers | Medium | Reloading or updating extension while YouTube content script is running invalidates `chrome.runtime`. | `isContextValid()` check and `try/catch` wrappers around all storage calls gracefully return `memorySettingsCache` / `memoryTrackingCache`. |
| **Unchecked `runtime.lastError`** | Chrome | Low | Chrome logs unhandled runtime errors if callbacks/promises are not caught. | Promise `.catch(() => null)` appended to all storage API calls. |
| **Ignored Local Storage Events** | All Browsers | Medium | `content/js/main.js` line 112 checks `if (namespace === 'sync')`. | Update `main.js` listener to `if ((namespace === 'sync' || namespace === 'local') && changes.settings)`. |

---

## 5. Implementation Roadmap for Worker

1. **Modify `utils/storage.js`**:
   - Add `memorySettingsCache` and `memoryTrackingCache` variables initialized with default clones.
   - Refactor `getSettings()`, `saveSettings()`, `getTracking()`, and `saveTracking()` to use the 3-tier and 2-tier fallback cascades.
   - Add the `chrome.storage.onChanged` listener in `storage.js` to update in-memory caches.

2. **Modify `content/js/main.js`**:
   - Update line 112 to accept storage change events from both `'sync'` and `'local'` namespaces.

3. **Validate Node & CommonJS Compatibility**:
   - Ensure `module.exports` and `window.StorageUtil` assignments remain untouched for test suite compatibility.

4. **Execute Tests**:
   - Run `node run-tests.js` to confirm all 207 tests execute clean.
   - Add new tests in `tests/tier1/storage-persistence.test.js` targeting sync fallback, quota errors, and memory cache persistence.
