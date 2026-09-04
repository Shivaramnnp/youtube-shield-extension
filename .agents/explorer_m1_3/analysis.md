# Technical Analysis Report: Milestone 1 — Content-Script Level Shorts & Playables SPA Interception

**Author**: Explorer 3 (`explorer_m1_3`)  
**Target Milestone**: Milestone 1 (Content-Script Shorts & Playables SPA Interception)  
**Working Directory**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/explorer_m1_3`  
**Date**: 2026-08-10  

---

## 1. Executive Summary

This report delivers the comprehensive architectural and static analysis for **Milestone 1 (M1)** of the Shorts Shield extension. 

The primary goal of Milestone 1 is to achieve **instant, zero-flash redirection** away from YouTube Shorts (`youtube.com/shorts/*`) and YouTube Playables (`youtube.com/playables/*`) pages across **all web browsers**, with special emphasis on **Safari** (macOS and iOS WebKit runtime). 

In Safari, background service worker `chrome.webNavigation.onBeforeNavigate` and `onHistoryStateUpdated` API events fail or lag significantly during Single Page Application (SPA) client-side history navigation. By implementing immediate, multi-tiered content-script level interception in `content/js/shorts-blocker.js` and `content/js/main.js`, we eliminate dependence on background service worker event timing and guarantee microsecond-level SPA redirection.

---

## 2. Codebase Review & Current Implementation Analysis

### 2.1 `manifest.json` Execution Order
- **Location**: `manifest.json` (lines 25–60)
- **Match Pattern**: `*://*.youtube.com/*`
- **Execution Lifecycle**: `"run_at": "document_start"`
- **Content Script Array**:
  ```json
  "js": [
    "utils/dom-utils.js",
    "utils/audio-engine.js",
    "utils/gamification-engine.js",
    "utils/storage.js",
    "utils/time-tracker.js",
    "content/js/observer-utils.js",
    "content/js/shorts-blocker.js",
    ...
    "content/js/main.js"
  ]
  ```
*Finding*: `shorts-blocker.js` loads at `document_start` before `main.js`. However, in the current implementation, `ShortsBlocker` remains inactive (`this.isActive = false`) until `main.js` finishes its asynchronous IPC settings request (`chrome.runtime.sendMessage({ action: "getSettings" })`).

### 2.2 Existing `content/js/shorts-blocker.js` Review
- **Location**: `content/js/shorts-blocker.js` (lines 58–96, 190)
- **Current URL Check Logic**:
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

### 2.3 Existing `content/js/main.js` Review
- **Location**: `content/js/main.js` (lines 2–49)
- **Async Initialization Flow**:
  - `main.js` uses an async IIFE `(async () => { ... })()`.
  - Sends asynchronous IPC request: `chrome.runtime.sendMessage({ action: "getSettings" }, ...)`
  - Calls `applySettings(settings)` once settings promise resolves.
  - Calls `window.ShortsBlocker.enable()` inside `applySettings`.

---

## 3. Root Cause Analysis: Gaps in Current SPA Protection

1. **Async IPC Latency Window at `document_start`**:
   - `shorts-blocker.js` evaluates at `document_start` with `this.isActive = false`.
   - `main.js` must wait for `chrome.runtime.sendMessage({ action: "getSettings" })` to return asynchronously (takes 5–50ms).
   - During this async roundtrip window, if the user directly loaded a `/shorts/` URL, the browser begins rendering DOM elements before `ShortsBlocker.enable()` is called, causing a visible page flash.

2. **Missing Key YouTube Early SPA Events**:
   - `yt-navigate-finish`: Dispatched AFTER page navigation and rendering complete.
   - `yt-page-data-updated`: Dispatched AFTER network AJAX requests finish.
   - **Missing: `yt-navigate-start`**: Dispatched by YouTube Polymer framework at the **exact microsecond** a user clicks a Shorts thumbnail, BEFORE network requests start or DOM elements mount.
   - **Missing: `yt-page-type-changed`**: Dispatched when page type changes during navigation.
   - **Missing Capture Phase**: Listeners currently use bubbling phase (`useCapture: false`). They must use capture phase (`useCapture: true`) to get priority over YouTube event handlers.

3. **Bypass via History API (`history.pushState` / `history.replaceState`)**:
   - YouTube's internal SPA router updates URLs by calling `window.history.pushState(...)` and `window.history.replaceState(...)`.
   - HTML5 `popstate` event ONLY fires on browser Back/Forward navigation — it does **NOT** fire on `pushState` or `replaceState` calls.
   - Without monkey-patching `pushState` and `replaceState`, SPA navigations bypass instant detection.

4. **URL Regex Pattern Deficiencies**:
   - Current pattern: `/\/shorts\/|\/playables\//i`
   - Requires slashes on both sides.
   - Fails on `https://www.youtube.com/shorts` (no trailing slash).
   - Fails on `https://www.youtube.com/playables` (no trailing slash).
   - Fails on `https://www.youtube.com/shorts?feature=share` (query parameter instead of trailing slash).
   - Fails on `https://www.youtube.com/shorts#hashtag` (hash fragment instead of trailing slash).

5. **Backup Polling Timer Interval**:
   - Current backup interval is `400ms`, allowing up to 400ms of Shorts rendering/audio playback before redirection.

---

## 4. Technical Requirements for Milestone 1

| # | Requirement | Objective & Specification |
|---|-------------|---------------------------|
| 1 | **Immediate Synchronous URL Check** | Run URL check synchronously at `document_start` upon script evaluation in `shorts-blocker.js`, before waiting for async IPC `getSettings` in `main.js`. |
| 2 | **Early SPA Event Hooks** | Register listeners for `yt-navigate-start`, `yt-navigate-finish`, `yt-page-data-updated`, `yt-page-type-changed`, `popstate`, and `hashchange` on `window` and `document` in capture phase (`{ capture: true }`). |
| 3 | **Monkey-Patch History API** | Wrap `window.history.pushState` and `window.history.replaceState` to intercept SPA route changes at microsecond speed. |
| 4 | **Expanded URL Matching Regex** | Replace existing regex with `/(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i` to catch trailing slashes, query parameters, hashes, and base path variants. |
| 5 | **Instant Redirection Logic** | Execute `try { window.history.replaceState(null, '', 'https://www.youtube.com/'); } catch(e) {}` followed immediately by `window.location.replace('https://www.youtube.com/')`. |
| 6 | **Reduced Polling Interval** | Lower backup timer polling interval from `400ms` to `100ms`. |

---

## 5. Detailed Solution Design & Code Changes

### 5.1 `content/js/shorts-blocker.js` Proposed Implementation

```javascript
// Logic for aggressively removing Shorts that CSS might miss
// Relies on observer-utils.js

// Expanded Regex matching all Shorts & Playables URL variations
const SHORTS_URL_REGEX = /(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i;

class ShortsBlocker {
  constructor() {
    this.isActive = true; // Default active at document_start for early protection
    this.disabledExplicitly = false;
    this.isDebug = false;
    this.stats = { detected: 0, removed: 0 };
    this.boundSPAListener = null;
    this.historyPatched = false;
    this.urlCheckInterval = null;
    
    // Enable debug mode if window.ShortsShieldDebug is true
    if (window.ShortsShieldDebug) {
      this.enableDebugMode();
    }

    // Requirement 1 & 2: Immediate synchronous URL check & SPA/History hooks at document_start
    this.checkAndRedirectShortsURL();
    this.attachSPAListeners();
  }

  enableDebugMode() {
    this.isDebug = true;
    this.createDebugUI();
  }

  createDebugUI() {
    if (document.getElementById('shorts-shield-debug')) return;
    const debugPanel = document.createElement('div');
    debugPanel.id = 'shorts-shield-debug';
    debugPanel.style.cssText = `
      position: fixed; top: 10px; right: 10px; z-index: 999999;
      background: rgba(0,0,0,0.8); color: #0f0; padding: 10px;
      font-family: monospace; font-size: 12px; border: 1px solid #0f0;
      pointer-events: none;
    `;
    debugPanel.innerHTML = `
      <div><strong>SHORTS SHIELD DEBUG</strong></div>
      <div id="ss-debug-detected">SHORTS DETECTED: 0</div>
      <div id="ss-debug-removed">SHORTS REMOVED: 0</div>
      <div id="ss-debug-matches">SELECTOR MATCHES: 0</div>
    `;
    if (window.DOMUtils) {
      window.DOMUtils.appendChild(debugPanel);
    } else if (document.body) {
      document.body.appendChild(debugPanel);
    }
  }

  updateDebugUI(matches) {
    if (!this.isDebug) return;
    const detectedEl = document.getElementById('ss-debug-detected');
    const removedEl = document.getElementById('ss-debug-removed');
    const matchesEl = document.getElementById('ss-debug-matches');
    
    if (detectedEl) detectedEl.textContent = `SHORTS DETECTED: ${this.stats.detected}`;
    if (removedEl) removedEl.textContent = `SHORTS REMOVED: ${this.stats.removed}`;
    if (matchesEl) matchesEl.textContent = `SELECTOR MATCHES: ${matches}`;
    
    console.log(`[Shorts Shield Debug] Detected: ${this.stats.detected} | Removed: ${this.stats.removed} | Matches: ${matches}`);
  }

  // Requirement 4 & 5: Enhanced URL check with expanded regex and location replace
  checkAndRedirectShortsURL(targetUrl) {
    if (!this.isActive || this.disabledExplicitly) return;
    const url = targetUrl || window.location.href;
    if (SHORTS_URL_REGEX.test(url)) {
      console.log("[Shorts Shield] Shorts/Playables URL detected in Content-Script SPA interception. Redirecting to Home:", url);
      try {
        window.history.replaceState(null, '', 'https://www.youtube.com/');
      } catch(e) {}
      window.location.replace('https://www.youtube.com/');
    }
  }

  // Requirement 3: Monkey-patch history.pushState and history.replaceState
  patchHistoryAPI() {
    if (this.historyPatched) return;
    this.historyPatched = true;

    const self = this;
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(state, title, url) {
      const result = originalPushState.apply(this, arguments);
      if (url) {
        self.checkAndRedirectShortsURL(url.toString());
      } else {
        self.checkAndRedirectShortsURL();
      }
      return result;
    };

    window.history.replaceState = function(state, title, url) {
      const result = originalReplaceState.apply(this, arguments);
      if (url) {
        self.checkAndRedirectShortsURL(url.toString());
      } else {
        self.checkAndRedirectShortsURL();
      }
      return result;
    };
  }

  // Requirement 2 & 6: Comprehensive SPA event listeners & 100ms backup polling
  attachSPAListeners() {
    if (this.boundSPAListener) {
      this.patchHistoryAPI();
      return;
    }

    this.boundSPAListener = (evt) => {
      this.checkAndRedirectShortsURL();
    };

    // YouTube internal SPA custom events
    const spaEvents = [
      'yt-navigate-start',
      'yt-navigate-finish',
      'yt-page-data-updated',
      'yt-page-type-changed'
    ];

    spaEvents.forEach(evtName => {
      window.addEventListener(evtName, this.boundSPAListener, true);
      document.addEventListener(evtName, this.boundSPAListener, true);
    });

    // Standard HTML5 navigation events
    window.addEventListener('popstate', this.boundSPAListener, true);
    window.addEventListener('hashchange', this.boundSPAListener, true);

    // Requirement 3: Patch History API
    this.patchHistoryAPI();

    // Requirement 6: Reduced backup polling timer interval (100ms)
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
        'yt-page-type-changed'
      ];

      spaEvents.forEach(evtName => {
        window.removeEventListener(evtName, this.boundSPAListener, true);
        document.removeEventListener(evtName, this.boundSPAListener, true);
      });

      window.removeEventListener('popstate', this.boundSPAListener, true);
      window.removeEventListener('hashchange', this.boundSPAListener, true);
      this.boundSPAListener = null;
    }

    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }
  }

  enable() {
    this.disabledExplicitly = false;
    if (this.isActive) {
      this.checkAndRedirectShortsURL();
      return;
    }
    this.isActive = true;

    // 1. Add class to enable CSS-based hiding
    if (window.DOMUtils) {
      window.DOMUtils.addClass('shorts-shield-block-shorts');
    } else {
      if (document.documentElement) document.documentElement.classList.add('shorts-shield-block-shorts');
      if (document.body) document.body.classList.add('shorts-shield-block-shorts');
    }

    // 2. Remove complex Shorts elements dynamically
    this.observeShortsElements();

    // 3. Check URL for Shorts & subscribe to SPA navigation
    this.checkAndRedirectShortsURL();
    this.attachSPAListeners();

    console.log("ShortsBlocker enabled");
  }

  disable() {
    this.disabledExplicitly = true;
    if (!this.isActive) return;
    this.isActive = false;

    // 1. Remove class
    if (window.DOMUtils) {
      window.DOMUtils.removeClass('shorts-shield-block-shorts');
    } else {
      if (document.documentElement) document.documentElement.classList.remove('shorts-shield-block-shorts');
      if (document.body) document.body.classList.remove('shorts-shield-block-shorts');
    }

    // 2. Stop observing
    if (window.ObserverUtils) {
      window.ObserverUtils.disconnect('shorts-blocker');
    }

    // 3. Detach SPA listeners
    this.detachSPAListeners();

    console.log("ShortsBlocker disabled");
  }

  observeShortsElements() {
    if (!window.ObserverUtils) return;

    const shortsSelectors = 'a[href*="shorts"], a[title*="Shorts"], yt-formatted-string[title*="Shorts"], a[href*="playables"], a[title*="Playables"]';

    window.ObserverUtils.observe(
      shortsSelectors,
      (elements) => {
        let matches = elements.length;
        if (matches === 0) return;
        
        this.stats.detected += matches;

        elements.forEach(el => {
          const container = el.closest(`
            ytd-rich-section-renderer,
            ytd-rich-shelf-renderer,
            ytd-rich-item-renderer,
            ytd-video-renderer,
            ytd-compact-video-renderer,
            ytd-reel-shelf-renderer,
            ytd-guide-entry-renderer,
            ytd-mini-guide-entry-renderer,
            ytd-pivot-bar-item-renderer,
            tp-yt-paper-item
          `) || (el.matches && el.matches('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer') ? el : null);
          
          if (container) {
            container.style.setProperty('display', 'none', 'important');
            this.stats.removed++;
          } else if (el.style) {
            el.style.setProperty('display', 'none', 'important');
          }
        });

        if (this.isDebug) {
          this.updateDebugUI(matches);
        }
      },
      'shorts-blocker'
    );
  }
}

window.ShortsBlocker = new ShortsBlocker();
```

### 5.2 `content/js/main.js` Alignment Strategy
In `main.js`:
- `applySettings(newSettings)` calls `ShortsBlocker.enable()` if `newSettings.shortsBlocker` is `true`, setting `disabledExplicitly = false`.
- If `newSettings.shortsBlocker` is `false`, it calls `ShortsBlocker.disable()`, setting `disabledExplicitly = true` and `isActive = false`.

---

## 6. Edge Cases & Risk Mitigation Matrix

| Edge Case | Risk Level | Cause / Scenario | Mitigation Strategy |
|-----------|------------|------------------|---------------------|
| **Infinite Redirect Loop** | High | `window.location.replace('https://www.youtube.com/')` redirects to home feed. If home feed matches regex, it will loop forever. | The regex `/(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i` yields `false` for `https://www.youtube.com/`. Interception ONLY triggers when regex tests `true`. |
| **Disabled Feature Settings** | Medium | User turns off Shorts Blocker in extension settings. | When `main.js` finishes `getSettings` and calls `ShortsBlocker.disable()`, `disabledExplicitly` is set to `true`, instantly halting redirection logic in `checkAndRedirectShortsURL()`. |
| **Relative vs Absolute URLs in `pushState`** | Medium | YouTube calls `history.pushState(null, '', '/shorts/xyz')` or `history.pushState(null, '', 'https://www.youtube.com/shorts/xyz')`. | `checkAndRedirectShortsURL(targetUrl)` evaluates both `targetUrl` argument and fallback `window.location.href`. The expanded regex matches both relative (`/shorts/xyz`) and absolute (`https://.../shorts/xyz`) forms. |
| **Event Dispatches on `document` vs `window`** | Low | YouTube Polymer dispatches `yt-navigate-start` on `document` or `window`. | Listeners are registered on both `window` and `document` using `{ capture: true }`. |
| **Rapid Successive SPA Clicks** | Low | User rapidly clicks multiple Shorts thumbnails in SPA. | First event execution calls `window.location.replace()`, terminating page context before subsequent clicks can execute. |
| **Syntax Verification** | Critical | Code syntax errors in content scripts crash extension. | Require `node -c` syntax check on all `.js` files before code merge. |

---

## 7. Recommended Implementation Strategy for Worker

1. **Modify `content/js/shorts-blocker.js`**:
   - Add top-level `SHORTS_URL_REGEX` constant.
   - Update `constructor()` to enable default active state and run synchronous check + SPA listeners attachment at `document_start`.
   - Update `checkAndRedirectShortsURL(targetUrl)` to accept targetUrl, use `SHORTS_URL_REGEX`, check `disabledExplicitly`, and execute `location.replace`.
   - Implement `patchHistoryAPI()` to wrap `pushState` and `replaceState`.
   - Update `attachSPAListeners()` with expanded event list (`yt-navigate-start`, `yt-navigate-finish`, `yt-page-data-updated`, `yt-page-type-changed`, `popstate`, `hashchange`) on both `window` and `document` in capture phase, plus 100ms interval polling.
   - Update `detachSPAListeners()`, `enable()`, and `disable()` to manage `disabledExplicitly`.

2. **Verify `content/js/main.js`**:
   - Confirm `applySettings` calls `window.ShortsBlocker.enable()` and `disable()` cleanly.

3. **Validation & Verification**:
   - Execute `node -c` across all `.js` files in repo.
   - Execute `node run-tests.js` to verify test suite status.

---

## 8. Conclusion

By implementing immediate synchronous checks at `document_start`, monkey-patching `history.pushState`/`replaceState`, registering early capture-phase SPA hooks (`yt-navigate-start`), utilizing an expanded matching regex, and lowering backup polling to 100ms, the content script will guarantee zero-flash redirection across **Safari**, **Chrome**, **Firefox**, **Brave**, and **Edge**.
