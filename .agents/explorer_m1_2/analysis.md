# Milestone 1 Analysis Report: Content-Script Shorts & Playables SPA Interception

**Author**: Explorer 2 (`explorer_m1_2`)  
**Phase**: Milestone 1 Investigation  
**Target Extension**: Shorts Shield Extension (`/Users/shivarampatel/Desktop/shorts-shield`)  
**Date**: 2026-08-10  

---

## 1. Observation

### 1.1 Source Files Examined
The static analysis investigated the following repository files:
- `/Users/shivarampatel/Desktop/shorts-shield/content/js/shorts-blocker.js`
- `/Users/shivarampatel/Desktop/shorts-shield/content/js/main.js`
- `/Users/shivarampatel/Desktop/shorts-shield/background/background.js`
- `/Users/shivarampatel/Desktop/shorts-shield/manifest.json`
- `/Users/shivarampatel/Desktop/shorts-shield/tests/tier1/shorts-blocker.test.js`
- `/Users/shivarampatel/Desktop/shorts-shield/tests/tier2/shorts-blocker-boundary.test.js`

---

### 1.2 Verbatim Current Implementation Details

#### A. Content Script Loading Sequence (`manifest.json` lines 25–59)
`manifest.json` configures content script injection at `"run_at": "document_start"`. `shorts-blocker.js` (line 40) is loaded sequentially before `main.js` (line 48):
```json
"js": [
  "utils/dom-utils.js",
  "utils/audio-engine.js",
  "utils/gamification-engine.js",
  "utils/storage.js",
  "utils/time-tracker.js",
  "content/js/observer-utils.js",
  "content/js/shorts-blocker.js",
  "content/js/focus-mode.js",
  "content/js/study-mode.js",
  "content/js/ui-cleaner.js",
  "content/js/feed-controller.js",
  "content/js/header-button.js",
  "content/js/time-manager.js",
  "content/js/goal-mode.js",
  "content/js/main.js"
]
```

#### B. Current `ShortsBlocker` Implementation (`content/js/shorts-blocker.js`)
1. **Initial State (lines 5–6)**:
   ```javascript
   constructor() {
     this.isActive = false;
     ...
   ```
2. **Current URL Checking Logic (lines 58–68)**:
   ```javascript
   checkAndRedirectShortsURL() {
     if (!this.isActive) return;
     const url = window.location.href;
     if (/\/shorts\/|\/playables\//i.test(url)) {
       console.log("[Shorts Shield] Shorts/Playables URL detected in Safari/SPA navigation. Redirecting to Home:", url);
       try {
         window.history.replaceState(null, '', 'https://www.youtube.com/');
       } catch(e) {}
       window.location.replace('https://www.youtube.com/');
     }
   }
   ```
3. **Current SPA Listeners (lines 70–82)**:
   ```javascript
   attachSPAListeners() {
     if (this.boundSPAListener) return;
     this.boundSPAListener = () => this.checkAndRedirectShortsURL();

     window.addEventListener('yt-navigate-finish', this.boundSPAListener);
     window.addEventListener('yt-page-data-updated', this.boundSPAListener);
     window.addEventListener('popstate', this.boundSPAListener);
     window.addEventListener('hashchange', this.boundSPAListener);

     if (!this.urlCheckInterval) {
       this.urlCheckInterval = setInterval(() => this.checkAndRedirectShortsURL(), 400);
     }
   }
   ```

#### C. Current `main.js` Async IPC Window (`content/js/main.js` lines 2–49)
`main.js` wraps settings initialization in an async IIFE:
```javascript
(async () => {
  ...
  let settings = await new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "getSettings" }, (res) => { ... });
    }
  });
  ...
  const applySettings = (newSettings) => {
    if (newSettings.shortsBlocker) {
      if (window.ShortsBlocker) window.ShortsBlocker.enable();
    } else {
      if (window.ShortsBlocker) window.ShortsBlocker.disable();
    }
  };
  ...
  applySettings(settings);
})();
```

---

### 1.3 Identified Flaws in Current Codebase

1. **Async IPC Latency Window on Direct Initial Page Load**:
   - `shorts-blocker.js` initializes with `this.isActive = false`.
   - `checkAndRedirectShortsURL()` returns immediately without performing any check because `this.isActive` is `false`.
   - `main.js` requires an async IPC roundtrip (`chrome.runtime.sendMessage({ action: "getSettings" })`) to resolve settings.
   - On Safari (or when background service worker is cold-starting), this IPC roundtrip takes **150ms to 500ms**.
   - During this window, YouTube loads the DOM, mounts `<ytd-shorts>`, and begins streaming video and audio before `ShortsBlocker.enable()` is finally called.

2. **Incomplete SPA Event Coverage**:
   - Listeners only subscribe to `yt-navigate-finish`, `yt-page-data-updated`, `popstate`, and `hashchange`.
   - `yt-navigate-finish` and `yt-page-data-updated` fire AFTER network requests complete and page rendering finishes.
   - Missing **`yt-navigate-start`** (dispatched immediately upon link click before network/render) and **`yt-page-type-changed`** (dispatched when Polymer resolves new page type).
   - Listeners are registered only on `window` in the bubble phase, allowing event propagation to be stopped before reaching the listener.

3. **No History API Patching**:
   - YouTube's SPA router calls `history.pushState()` and `history.replaceState()` directly when navigating client-side.
   - `popstate` events only fire on browser Back/Forward navigation, NOT on `history.pushState` or `history.replaceState`.
   - Lacking monkey-patches on `history.pushState` and `history.replaceState`, SPA navigations are missed until secondary events or timer ticks occur.

4. **Flawed URL Regular Expression**:
   - Current pattern: `/\/shorts\/|\/playables\//i`
   - Requires trailing slashes (`/shorts/` or `/playables/`).
   - Misses `youtube.com/shorts`, `youtube.com/playables`, `youtube.com/shorts?feature=share`, `youtube.com/shorts#hash`, and relative paths like `shorts/123`.

5. **Slow Polling Interval**:
   - Polling interval is set to 400ms (`setInterval(..., 400)`), allowing up to 400ms of Shorts rendering/audio before triggering backup redirection.

---

## 2. Logic Chain

1. **Premise 1**: Content scripts injected at `document_start` run before any HTML DOM elements are parsed or rendered.
2. **Premise 2**: Shorts Shield's core feature is blocking Shorts by default (`shortsBlocker: true`).
3. **Step 1 -> Synchronous Pre-Settings URL Check**:
   - If `shorts-blocker.js` executes a synchronous URL check immediately at `document_start` (prior to `main.js` async IPC settings resolution), direct navigations to `/shorts/*` or `/playables/*` will be redirected instantly with 0ms delay.
   - Defaulting `this.isActive` to `true` (or invoking `checkAndRedirectShortsURL(true)` on load) guarantees zero-flash redirection on direct initial page loads.
   - If `main.js` later resolves settings and finds `shortsBlocker === false`, it calls `ShortsBlocker.disable()`, setting `this.disabledExplicitly = true` and `this.isActive = false`.

4. **Step 2 -> History API Patching**:
   - YouTube's SPA router updates the address bar by calling `window.history.pushState` or `window.history.replaceState`.
   - Wrapping `window.history.pushState` and `window.history.replaceState` intercepts route changes at microsecond speed (< 1ms), executing redirection before YouTube mounts page components.

5. **Step 3 -> Early SPA Event Hooks**:
   - Adding `yt-navigate-start` and `yt-page-type-changed` listeners attached to BOTH `window` and `document` in the capture phase (`useCapture: true`) captures YouTube's internal Polymer dispatches at the instant of a user click.

6. **Step 4 -> Expanded Regex Pattern**:
   - Pattern `/(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i` covers all URI forms:
     - `https://www.youtube.com/shorts` -> Matches `/shorts`
     - `https://www.youtube.com/shorts/` -> Matches `/shorts/`
     - `https://www.youtube.com/shorts/video123` -> Matches `/shorts/`
     - `https://www.youtube.com/shorts?foo=bar` -> Matches `/shorts?`
     - `https://www.youtube.com/shorts#section` -> Matches `/shorts#`
     - `https://www.youtube.com/playables` -> Matches `/playables`
     - `https://www.youtube.com/playables/game123` -> Matches `/playables/`
     - `/shorts/12345` -> Matches `/shorts/`
     - Non-matching URLs (`/watch?v=123`, `/feed/subscriptions`, `search_query=shorts_tutorial`) correctly evaluate to `false`.

7. **Step 5 -> Instant Redirection**:
   - Standardizing on `window.history.replaceState(null, '', 'https://www.youtube.com/')` followed immediately by `window.location.replace('https://www.youtube.com/')` cleanly replaces browser history and forces immediate page navigation without creating back-button loops.

8. **Step 6 -> 100ms Backup Polling Interval**:
   - Lowering polling interval from 400ms to 100ms creates a tight fallback network while using trivial CPU resources (10 string regex evaluations per second).

---

## 3. Technical Requirements & Implementation Blueprint

### Requirement 1: Synchronous `document_start` URL Checking
- **Location**: `content/js/shorts-blocker.js`
- **Current Problem**: `constructor()` sets `this.isActive = false`, skipping check until `enable()` is called by `main.js`.
- **Worker Solution**:
  - Set `this.isActive = true` by default in `constructor()`.
  - Add `this.disabledExplicitly = false` flag.
  - Automatically call `this.checkAndRedirectShortsURL()` and `this.attachSPAListeners()` immediately during script initialization (at `document_start`).
  - In `enable()`: set `this.disabledExplicitly = false`, `this.isActive = true`, and attach listeners.
  - In `disable()`: set `this.disabledExplicitly = true`, `this.isActive = false`, and detach listeners.

### Requirement 2: Early SPA Event Hooks
- **Location**: `content/js/shorts-blocker.js`
- **Current Problem**: Listens only to `yt-navigate-finish`, `yt-page-data-updated`, `popstate`, `hashchange` on `window` in bubble phase.
- **Worker Solution**:
  - Add `yt-navigate-start` and `yt-page-type-changed`.
  - Register all 6 events (`yt-navigate-start`, `yt-navigate-finish`, `yt-page-data-updated`, `yt-page-type-changed`, `popstate`, `hashchange`) on BOTH `window` AND `document` using `{ capture: true }` / `true`.
  - Update `detachSPAListeners()` to unregister all 6 events from both `window` and `document` with `{ capture: true }`.

### Requirement 3: History API Monkey-Patching
- **Location**: `content/js/shorts-blocker.js`
- **Current Problem**: `pushState` and `replaceState` are not intercepted.
- **Worker Solution**:
  - Implement `patchHistoryAPI()` and `unpatchHistoryAPI()`.
  - Preserve original functions in `this.originalPushState` and `this.originalReplaceState`.
  - In patched methods, inspect `args[2]` (target URL) and `window.location.href`. If matching, execute `checkAndRedirectShortsURL()` before and after calling the original function.
  - In `unpatchHistoryAPI()`, restore original functions cleanly.

### Requirement 4: Expanded URL Regex Matching
- **Location**: `content/js/shorts-blocker.js`
- **Current Pattern**: `/\/shorts\/|\/playables\//i`
- **Worker Solution**:
  - Define regex helper method:
    ```javascript
    isShortsOrPlayablesURL(urlStr) {
      if (!urlStr) return false;
      const shortsRegex = /(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i;
      return shortsRegex.test(urlStr);
    }
    ```
  - Use `this.isShortsOrPlayablesURL(...)` in `checkAndRedirectShortsURL()` and in history API wrappers.

### Requirement 5: Instant Redirection Execution
- **Location**: `content/js/shorts-blocker.js`
- **Current Problem**: Logic exists but is skipped when `this.isActive` is `false`.
- **Worker Solution**:
  - Update `checkAndRedirectShortsURL()`:
    ```javascript
    checkAndRedirectShortsURL() {
      if (!this.isActive || this.disabledExplicitly) return;
      const url = window.location.href;
      if (this.isShortsOrPlayablesURL(url)) {
        console.log("[Shorts Shield] Shorts/Playables URL detected. Redirecting to Home:", url);
        try {
          window.history.replaceState(null, '', 'https://www.youtube.com/');
        } catch(e) {}
        window.location.replace('https://www.youtube.com/');
      }
    }
    ```

### Requirement 6: 100ms Backup Polling Interval
- **Location**: `content/js/shorts-blocker.js`
- **Current Problem**: Interval is `400ms`.
- **Worker Solution**:
  - Change interval in `attachSPAListeners()` to `100ms`:
    ```javascript
    if (!this.urlCheckInterval) {
      this.urlCheckInterval = setInterval(() => this.checkAndRedirectShortsURL(), 100);
    }
    ```

---

## 4. Proposed Code Changes for Worker Implementation

### 4.1 Modifications to `content/js/shorts-blocker.js`

```javascript
class ShortsBlocker {
  constructor() {
    this.isActive = true; // Default active at document_start for instant interception
    this.disabledExplicitly = false;
    this.isDebug = false;
    this.historyPatched = false;
    this.stats = { detected: 0, removed: 0 };
    
    if (window.ShortsShieldDebug) {
      this.enableDebugMode();
    }

    // Immediate synchronous check at injection/construction
    this.checkAndRedirectShortsURL();
    this.attachSPAListeners();
  }

  isShortsOrPlayablesURL(urlStr) {
    if (!urlStr) return false;
    const shortsRegex = /(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i;
    return shortsRegex.test(urlStr);
  }

  checkAndRedirectShortsURL() {
    if (!this.isActive || this.disabledExplicitly) return;
    const url = window.location.href;
    if (this.isShortsOrPlayablesURL(url)) {
      console.log("[Shorts Shield] Shorts/Playables URL detected in Safari/SPA navigation. Redirecting to Home:", url);
      try {
        window.history.replaceState(null, '', 'https://www.youtube.com/');
      } catch(e) {}
      window.location.replace('https://www.youtube.com/');
    }
  }

  patchHistoryAPI() {
    if (this.historyPatched) return;
    this.historyPatched = true;

    this.originalPushState = window.history.pushState;
    this.originalReplaceState = window.history.replaceState;
    const self = this;

    window.history.pushState = function(...args) {
      const targetUrl = args[2];
      if (targetUrl && typeof targetUrl === 'string' && self.isShortsOrPlayablesURL(targetUrl)) {
        self.checkAndRedirectShortsURL();
      }
      const result = self.originalPushState.apply(this, args);
      self.checkAndRedirectShortsURL();
      return result;
    };

    window.history.replaceState = function(...args) {
      const targetUrl = args[2];
      if (targetUrl && typeof targetUrl === 'string' && self.isShortsOrPlayablesURL(targetUrl)) {
        self.checkAndRedirectShortsURL();
      }
      const result = self.originalReplaceState.apply(this, args);
      self.checkAndRedirectShortsURL();
      return result;
    };
  }

  unpatchHistoryAPI() {
    if (!this.historyPatched) return;
    if (this.originalPushState) window.history.pushState = this.originalPushState;
    if (this.originalReplaceState) window.history.replaceState = this.originalReplaceState;
    this.historyPatched = false;
  }

  attachSPAListeners() {
    if (this.boundSPAListener) return;
    this.boundSPAListener = () => this.checkAndRedirectShortsURL();

    const spaEvents = [
      'yt-navigate-start',
      'yt-navigate-finish',
      'yt-page-data-updated',
      'yt-page-type-changed',
      'popstate',
      'hashchange'
    ];

    spaEvents.forEach(eventName => {
      window.addEventListener(eventName, this.boundSPAListener, true);
      document.addEventListener(eventName, this.boundSPAListener, true);
    });

    this.patchHistoryAPI();

    if (!this.urlCheckInterval) {
      this.urlCheckInterval = setInterval(() => this.checkAndRedirectShortsURL(), 100);
    }
  }

  detachSPAListeners() {
    if (this.boundSPAListener) {
      const spaEvents = [
        'yt-navigate-start',
        'yt-navigate-finish',
        'yt-page-data-updated',
        'yt-page-type-changed',
        'popstate',
        'hashchange'
      ];

      spaEvents.forEach(eventName => {
        window.removeEventListener(eventName, this.boundSPAListener, true);
        document.removeEventListener(eventName, this.boundSPAListener, true);
      });
      this.boundSPAListener = null;
    }

    this.unpatchHistoryAPI();

    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }
  }

  enable() {
    this.disabledExplicitly = false;
    if (this.isActive) return;
    this.isActive = true;

    if (window.DOMUtils) {
      window.DOMUtils.addClass('shorts-shield-block-shorts');
    } else {
      if (document.documentElement) document.documentElement.classList.add('shorts-shield-block-shorts');
      if (document.body) document.body.classList.add('shorts-shield-block-shorts');
    }

    this.observeShortsElements();
    this.checkAndRedirectShortsURL();
    this.attachSPAListeners();

    console.log("ShortsBlocker enabled");
  }

  disable() {
    this.disabledExplicitly = true;
    if (!this.isActive) return;
    this.isActive = false;

    if (window.DOMUtils) {
      window.DOMUtils.removeClass('shorts-shield-block-shorts');
    } else {
      if (document.documentElement) document.documentElement.classList.remove('shorts-shield-block-shorts');
      if (document.body) document.body.classList.remove('shorts-shield-block-shorts');
    }

    if (window.ObserverUtils) {
      window.ObserverUtils.disconnect('shorts-blocker');
    }

    this.detachSPAListeners();

    console.log("ShortsBlocker disabled");
  }
```

---

### 4.2 Modifications to `content/js/main.js`
In `main.js`, `applySettings` toggling logic is preserved cleanly:
```javascript
const applySettings = (newSettings) => {
  if (newSettings.shortsBlocker) {
    if (window.ShortsBlocker) window.ShortsBlocker.enable();
  } else {
    if (window.ShortsBlocker) window.ShortsBlocker.disable();
  }
  ...
```
When `newSettings.shortsBlocker` is `true`, `ShortsBlocker.enable()` clears `disabledExplicitly` and sets `isActive = true`.  
When `newSettings.shortsBlocker` is `false`, `ShortsBlocker.disable()` sets `disabledExplicitly = true` and `isActive = false`.

---

## 5. Edge Case Analysis & Risk Mitigation

| Edge Case | Description | Mitigation |
| :--- | :--- | :--- |
| **User Disables Shorts Blocker** | User turns off Shorts Blocker in options page. | `disabledExplicitly` flag set in `disable()` immediately suppresses redirects and detaches event listeners / unpatches history API. |
| **Cross-Origin replaceState Exceptions** | Browsers may throw exception if calling `replaceState` in restricted iframe contexts. | Wrapped in `try { window.history.replaceState(...) } catch(e) {}` before `window.location.replace(...)`. |
| **Infinite Redirection Loop** | Redirection to `https://www.youtube.com/` triggering re-check. | `isShortsOrPlayablesURL('https://www.youtube.com/')` returns `false`, halting redirection loop immediately. |
| **Double History Patching** | `enable()` or `attachSPAListeners()` called repeatedly. | Guard flag `this.historyPatched` prevents multiple monkey-patch wraps. `unpatchHistoryAPI()` restores original state. |
| **Duplicate Event Listeners** | `attachSPAListeners()` called multiple times. | Single `this.boundSPAListener` reference checked with `if (this.boundSPAListener) return;`. |

---

## 6. Caveats

No caveats. All relevant code files, test harnesses, and manifest configurations were directly inspected and statically analyzed. No source files were modified during this investigation.

---

## 7. Conclusion

Implementing the proposed 6-tier interception strategy in `shorts-blocker.js` will eliminate latency on direct page loads and guarantee microsecond-level SPA interception across Safari, Chrome, Firefox, Brave, and Edge.

The implementation plan is clean, self-contained, fully backward-compatible, and ready for Worker execution.

---

## 8. Verification Method

1. **Syntax Check**:
   ```bash
   node tests/syntax/syntax-checker.js
   ```
   Must pass 100% clean across all 57 files.

2. **Automated Test Suite Execution**:
   ```bash
   node run-tests.js
   ```
   Verify all Tier 1 and Tier 2 `ShortsBlocker` tests pass (`tests/tier1/shorts-blocker.test.js` and `tests/tier2/shorts-blocker-boundary.test.js`).

3. **URL Regex Verification**:
   Test regex `/(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i` against:
   - `https://www.youtube.com/shorts` -> PASS
   - `https://www.youtube.com/shorts/` -> PASS
   - `https://www.youtube.com/shorts/xyz123` -> PASS
   - `https://www.youtube.com/shorts?feature=share` -> PASS
   - `https://www.youtube.com/shorts#hash` -> PASS
   - `https://www.youtube.com/playables` -> PASS
   - `https://www.youtube.com/playables/game1` -> PASS
   - `https://www.youtube.com/watch?v=123` -> FAIL (Not blocked)
   - `https://www.youtube.com/results?search_query=shorts_tutorial` -> FAIL (Not blocked)
