# Architectural Analysis & Technical Blueprint: Content-Script Shorts & Playables SPA Interception (Milestone 1)

**Author**: Explorer 1 (`explorer_m1_1`)  
**Phase**: Milestone 1 Implementation Blueprint  
**Target Files**: `content/js/shorts-blocker.js`, `content/js/main.js`  
**Working Directory**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/explorer_m1_1`  
**Date**: 2026-08-10  

---

## Executive Summary

This report presents a thorough static analysis and architectural blueprint for **Milestone 1 (Content-Script Shorts & Playables SPA Interception)** of the **Shorts Shield Extension**.

### Problem Statement
In modern browsers (especially **Safari** and web environments with sleeping background service workers), background `chrome.webNavigation.onBeforeNavigate` and `chrome.webNavigation.onHistoryStateUpdated` events are either unsupported, severely delayed, or fail to fire on Single Page Application (SPA) client-side history transitions. When a user clicks a Shorts/Playables thumbnail or directly opens a `/shorts/` URL, YouTube's Polymer router modifies browser history and mounts media elements without triggering a full page navigation. If content scripts wait asynchronously for background IPC settings resolution (`chrome.runtime.sendMessage({ action: "getSettings" })`), a visible flash of Shorts video content and audio occurs before redirection takes place.

### Objective
Implement zero-latency, multi-layered content-script interception in `content/js/shorts-blocker.js` and `content/js/main.js` that guarantees instant redirection off `/shorts/` and `/playables/` URLs to `https://www.youtube.com/` across **all browsers** (Safari, Chrome, Firefox, Brave, Edge), synchronously at `document_start` and at microsecond latency on SPA route changes.

---

## 1. Current Implementation Review & Root Cause Analysis

### 1.1 `manifest.json` Execution Order
In `manifest.json`, content scripts are configured with `"run_at": "document_start"` for `*://*.youtube.com/*`:
1. `utils/dom-utils.js`
2. `utils/audio-engine.js`
3. `utils/gamification-engine.js`
4. `utils/storage.js`
5. `utils/time-tracker.js`
6. `content/js/observer-utils.js`
7. `content/js/shorts-blocker.js` (Executes 7th)
...
15. `content/js/main.js` (Executes 15th)

`shorts-blocker.js` is loaded at `document_start` prior to `main.js`.

### 1.2 Analysis of Existing `content/js/shorts-blocker.js`
- **Current Constructor**:
  ```javascript
  constructor() {
    this.isActive = false;
    this.isDebug = false;
    this.stats = { detected: 0, removed: 0 };
    if (window.ShortsShieldDebug) {
      this.enableDebugMode();
    }
  }
  ```
  - *Flaw*: `this.isActive` is initialized to `false`. `checkAndRedirectShortsURL()` returns immediately if `!this.isActive`. Therefore, when `shorts-blocker.js` is injected at `document_start`, no synchronous URL check occurs until `enable()` is called.

- **Current URL Check Logic**:
  ```javascript
  checkAndRedirectShortsURL() {
    if (!this.isActive) return;
    const url = window.location.href;
    if (/\/shorts\/|\/playables\//i.test(url)) { ... }
  }
  ```
  - *Flaw 1*: Requires `this.isActive === true`.
  - *Flaw 2*: Regex `/\/shorts\/|\/playables\//i` requires trailing slashes `/shorts/` or `/playables/`. It fails to match `youtube.com/shorts`, `youtube.com/playables`, or URL variants with query parameters/hashes like `youtube.com/shorts?feature=share`.

- **Current SPA Listeners**:
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
  - *Flaw 1*: Missing early YouTube SPA lifecycle events (`yt-navigate-start`, `yt-page-type-changed`). `yt-navigate-finish` and `yt-page-data-updated` fire AFTER network fetch and DOM mounting have already completed.
  - *Flaw 2*: Missing `history.pushState` and `history.replaceState` monkey-patching. HTML5 `popstate` event ONLY fires on browser Back/Forward navigation, NOT when JavaScript invokes `pushState`.
  - *Flaw 3*: Polling interval is `400ms`, allowing up to 400ms of Shorts rendering/audio before polling catches the URL.

### 1.3 Analysis of Existing `content/js/main.js`
- **Current Async Initialization**:
  ```javascript
  (async () => {
    if (window.shortsShieldInitialized) return;
    window.shortsShieldInitialized = true;

    let settings = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: "getSettings" }, (res) => { ... });
    });
    ...
    applySettings(settings);
  })();
  ```
  - *Flaw*: The `sendMessage({ action: "getSettings" })` async IPC roundtrip takes 10ms to 200ms+. During this latency window, `ShortsBlocker.enable()` has not yet been called, leaving direct loads to `/shorts/` unprotected.

---

## 2. Technical Requirements & Solution Architecture

```
+-----------------------------------------------------------------------------------------+
|                  MILESTONE 1 MULTI-TIER CONTENT-SCRIPT INTERCEPTION ENGINE              |
+-----------------------------------------------------------------------------------------+
| Tier 1: Immediate Sync Check @ document_start  --> Intercept direct URL loads at 0ms   |
| Tier 2: History API Monkey-Patching            --> Intercept pushState/replaceState     |
| Tier 3: YouTube Early SPA Lifecycle Hooks      --> yt-navigate-start & yt-page-type     |
| Tier 4: Standard HTML5 History & Nav Events    --> popstate, hashchange, finish/updated |
| Tier 5: High-Frequency Polling Fallback        --> 100ms interval timer                 |
+-----------------------------------------------------------------------------------------+
```

### Technical Requirement Breakdown

#### Requirement 1: Synchronous `document_start` Execution & Pre-Settings Check
- **Specification**: Run `checkAndRedirectShortsURL()` synchronously upon script load at `document_start` before async settings resolve.
- **Implementation**:
  - Introduce `this.disabledExplicitly = false;` in `ShortsBlocker`.
  - By default, Shorts blocking is enabled (`disabledExplicitly = false`).
  - In `checkAndRedirectShortsURL()`, guard with `if (this.disabledExplicitly) return;`.
  - Execute `checkAndRedirectShortsURL()` and `attachSPAListeners()` immediately during `ShortsBlocker` instantiation / script execution.
  - When `main.js` finishes loading settings:
    - If `settings.shortsBlocker` is `true`: calls `ShortsBlocker.enable()`, setting `disabledExplicitly = false` and `isActive = true`.
    - If `settings.shortsBlocker` is `false`: calls `ShortsBlocker.disable()`, setting `disabledExplicitly = true` and `isActive = false`.

#### Requirement 2: Early SPA Lifecycle Hooks
- **Specification**: Attach event listeners for `yt-navigate-start`, `yt-navigate-finish`, `yt-page-data-updated`, `yt-page-type-changed`, `popstate`, and `hashchange`.
- **Implementation**:
  - `yt-navigate-start`: Dispatched by YouTube Polymer router at the instant a link click occurs, prior to network requests.
  - `yt-page-type-changed`: Dispatched when page type updates.
  - Target capture phase (`{ capture: true }`) and attach listeners to both `window` and `document` to guarantee event interception regardless of DOM hierarchy.

#### Requirement 3: Monkey-Patching `history.pushState` and `history.replaceState`
- **Specification**: Intercept SPA route transitions at microsecond level.
- **Implementation**:
  - Create `patchHistoryAPI()` and `unpatchHistoryAPI()` methods on `ShortsBlocker`.
  - Preserve original method references `window.history.pushState` and `window.history.replaceState`.
  - Override methods to invoke original method, followed immediately by `this.checkAndRedirectShortsURL()`.
  - Include guard `if (typeof window === 'undefined' || !window.history) return;` for node test environment safety.

#### Requirement 4: Universal Expanded URL Regex Pattern
- **Specification**: `/(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i`
- **Verification Matrix**:
  | Test URL | Regex Match | Expected Action |
  |---|---|---|
  | `https://www.youtube.com/shorts` | `true` | Redirect to Home |
  | `https://www.youtube.com/shorts/` | `true` | Redirect to Home |
  | `https://www.youtube.com/shorts/abc123xyz` | `true` | Redirect to Home |
  | `https://www.youtube.com/shorts?feature=share` | `true` | Redirect to Home |
  | `https://www.youtube.com/shorts#section` | `true` | Redirect to Home |
  | `https://www.youtube.com/playables` | `true` | Redirect to Home |
  | `https://www.youtube.com/playables/` | `true` | Redirect to Home |
  | `https://www.youtube.com/playables/game456` | `true` | Redirect to Home |
  | `https://www.youtube.com/watch?v=shorts_demo` | `false` | Allow (Normal Video) |
  | `https://www.youtube.com/results?search_query=shorts` | `false` | Allow (Search Results) |
  | `https://www.youtube.com/shortstory` | `false` | Allow (Non-matching Path) |

#### Requirement 5: Instant Redirection Logic
- **Specification**: Redirect to `https://www.youtube.com/` using `window.location.replace()`.
- **Implementation**:
  ```javascript
  checkAndRedirectShortsURL() {
    if (this.disabledExplicitly) return;
    const url = (typeof window !== 'undefined' && window.location && window.location.href) ? window.location.href : '';
    const shortsRegex = /(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i;
    if (shortsRegex.test(url)) {
      console.log("[Shorts Shield] Shorts/Playables URL detected. Instant redirecting:", url);
      try {
        if (window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState(null, '', 'https://www.youtube.com/');
        }
      } catch(e) {}
      try {
        if (window.location && typeof window.location.replace === 'function') {
          window.location.replace('https://www.youtube.com/');
        }
      } catch(e) {}
    }
  }
  ```

#### Requirement 6: Reduced Polling Interval
- **Specification**: Reduce polling interval from `400ms` to `100ms`.
- **Implementation**: `setInterval(() => this.checkAndRedirectShortsURL(), 100)` inside `attachSPAListeners()`.

---

## 3. Exact Proposed Changes for Worker Implementation

### 3.1 `content/js/shorts-blocker.js`

```javascript
class ShortsBlocker {
  constructor() {
    this.isActive = false;
    this.disabledExplicitly = false;
    this.isDebug = false;
    this.historyPatched = false;
    this.stats = { detected: 0, removed: 0 };
    
    if (window.ShortsShieldDebug) {
      this.enableDebugMode();
    }

    // 1. Immediate synchronous URL check at document_start injection
    this.checkAndRedirectShortsURL();

    // 2. Early attachment of SPA listeners & history API monkey-patching
    this.attachSPAListeners();
  }

  checkAndRedirectShortsURL() {
    if (this.disabledExplicitly) return;
    const url = (typeof window !== 'undefined' && window.location && window.location.href) ? window.location.href : '';
    const shortsRegex = /(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i;
    
    if (shortsRegex.test(url)) {
      console.log("[Shorts Shield] Shorts/Playables URL detected in Content Script. Redirecting to Home:", url);
      try {
        if (window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState(null, '', 'https://www.youtube.com/');
        }
      } catch(e) {}
      try {
        if (window.location && typeof window.location.replace === 'function') {
          window.location.replace('https://www.youtube.com/');
        }
      } catch(e) {}
    }
  }

  patchHistoryAPI() {
    if (this.historyPatched) return;
    if (typeof window === 'undefined' || !window.history) return;

    this.historyPatched = true;
    this.originalPushState = window.history.pushState;
    this.originalReplaceState = window.history.replaceState;
    const self = this;

    if (typeof this.originalPushState === 'function') {
      window.history.pushState = function(...args) {
        const result = self.originalPushState.apply(this, args);
        self.checkAndRedirectShortsURL();
        return result;
      };
    }

    if (typeof this.originalReplaceState === 'function') {
      window.history.replaceState = function(...args) {
        const result = self.originalReplaceState.apply(this, args);
        self.checkAndRedirectShortsURL();
        return result;
      };
    }
  }

  unpatchHistoryAPI() {
    if (!this.historyPatched) return;
    this.historyPatched = false;
    if (typeof window !== 'undefined' && window.history) {
      if (this.originalPushState) {
        window.history.pushState = this.originalPushState;
      }
      if (this.originalReplaceState) {
        window.history.replaceState = this.originalReplaceState;
      }
    }
  }

  attachSPAListeners() {
    if (this.boundSPAListener) return;
    this.boundSPAListener = () => this.checkAndRedirectShortsURL();

    // Early YouTube SPA events
    window.addEventListener('yt-navigate-start', this.boundSPAListener, true);
    window.addEventListener('yt-navigate-finish', this.boundSPAListener, true);
    window.addEventListener('yt-page-data-updated', this.boundSPAListener, true);
    window.addEventListener('yt-page-type-changed', this.boundSPAListener, true);

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('yt-navigate-start', this.boundSPAListener, true);
      document.addEventListener('yt-navigate-finish', this.boundSPAListener, true);
      document.addEventListener('yt-page-data-updated', this.boundSPAListener, true);
      document.addEventListener('yt-page-type-changed', this.boundSPAListener, true);
    }

    // Standard HTML5 navigation events
    window.addEventListener('popstate', this.boundSPAListener, true);
    window.addEventListener('hashchange', this.boundSPAListener, true);

    // Patch history pushState and replaceState
    this.patchHistoryAPI();

    // Fast fallback interval (100ms)
    if (!this.urlCheckInterval) {
      this.urlCheckInterval = setInterval(() => this.checkAndRedirectShortsURL(), 100);
    }
  }

  detachSPAListeners() {
    if (this.boundSPAListener) {
      window.removeEventListener('yt-navigate-start', this.boundSPAListener, true);
      window.removeEventListener('yt-navigate-finish', this.boundSPAListener, true);
      window.removeEventListener('yt-page-data-updated', this.boundSPAListener, true);
      window.removeEventListener('yt-page-type-changed', this.boundSPAListener, true);

      if (typeof document !== 'undefined' && document.removeEventListener) {
        document.removeEventListener('yt-navigate-start', this.boundSPAListener, true);
        document.removeEventListener('yt-navigate-finish', this.boundSPAListener, true);
        document.removeEventListener('yt-page-data-updated', this.boundSPAListener, true);
        document.removeEventListener('yt-page-type-changed', this.boundSPAListener, true);
      }

      window.removeEventListener('popstate', this.boundSPAListener, true);
      window.removeEventListener('hashchange', this.boundSPAListener, true);
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

### 3.2 `content/js/main.js`

In `main.js`, ensure `applySettings` explicitly sets state for `ShortsBlocker`:
```javascript
  const applySettings = (newSettings) => {
    if (newSettings.shortsBlocker) {
      if (window.ShortsBlocker) window.ShortsBlocker.enable();
    } else {
      if (window.ShortsBlocker) window.ShortsBlocker.disable();
    }
    ...
```
*(No breaking architectural changes required in `main.js`, but verifying that `applySettings` clean calls `enable()` / `disable()` is confirmed).*

---

## 4. Edge Cases & Safety Precautions

1. **Explicit Disabled State Persistence**:
   - If the user turns OFF `shortsBlocker` in extension settings, `main.js` calls `disable()`, which sets `disabledExplicitly = true` and detaches all listeners.
   - Any background interval or history call will immediately return without triggering redirection.

2. **Test Environment Compatibility (`mock-extension-env.js` & `run-tests.js`)**:
   - Defensive checks for `typeof window !== 'undefined'`, `typeof window.history !== 'undefined'`, and `try/catch` around `location.replace` and `history.replaceState` guarantee 100% test suite stability in Node.js environments.

3. **No Redirection Loops**:
   - `window.location.replace('https://www.youtube.com/')` replaces the history entry rather than pushing a new one, preventing infinite Back button loops.

---

## 5. Verification Method for Implementer & Auditors

1. **Syntax Check**:
   ```bash
   node tests/syntax/syntax-checker.js
   ```
2. **Full Automated Test Suite Pass**:
   ```bash
   node run-tests.js
   ```
3. **Dedicated Shorts Blocker Unit & Boundary Test Verification**:
   ```bash
   node -e "require('./tests/tier1/shorts-blocker.test.js')"
   node -e "require('./tests/tier2/shorts-blocker-boundary.test.js')"
   ```

---

## 6. Recommended Next Steps

Worker 1 should implement the proposed changes in `content/js/shorts-blocker.js`, run static syntax validation and unit test suites, and provide handoff for Reviewer and Gate check.
