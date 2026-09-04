// Logic for aggressively removing Shorts that CSS might miss
// Relies on observer-utils.js

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

  checkAndRedirectShortsURL() {
    if (this.disabledExplicitly) return;
    const url = (typeof window !== 'undefined' && window.location && window.location.href) ? window.location.href : '';
    if (!url || url === this._lastCheckedUrl) return;
    this._lastCheckedUrl = url;
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
        let result;
        try {
          result = self.originalPushState.apply(this, args);
        } catch (err) {
          throw err;
        } finally {
          self._lastCheckedUrl = '';
          self.checkAndRedirectShortsURL();
        }
        return result;
      };
    }

    if (typeof this.originalReplaceState === 'function') {
      window.history.replaceState = function(...args) {
        let result;
        try {
          result = self.originalReplaceState.apply(this, args);
        } catch (err) {
          throw err;
        } finally {
          self._lastCheckedUrl = '';
          self.checkAndRedirectShortsURL();
        }
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
    this.boundSPAListener = () => {
      this._lastCheckedUrl = '';
      this.checkAndRedirectShortsURL();
    };

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

    // Fallback interval (500ms)
    if (!this.urlCheckInterval) {
      this.urlCheckInterval = setInterval(() => this.checkAndRedirectShortsURL(), 500);
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

    // We observe elements (Shorts & Playables) that might be dynamically loaded
    // and need parent containers removed to prevent layout shifts or gaps.
    const shortsSelectors = [
      'a[href*="shorts"]',
      'a[title*="Shorts"]',
      'yt-formatted-string[title*="Shorts"]',
      'ytd-reel-item-renderer',
      'ytd-reel-shelf-renderer',
      'ytd-shorts-lockup-view-model',
      'reel-shelf-view-model',
      'yt-shorts-shelf-view-model',
      'a[href*="playables"]',
      'a[title*="Playables"]'
    ].join(', ');

    window.ObserverUtils.observe(
      shortsSelectors,
      (elements) => {
        let matches = elements.length;
        if (matches === 0) return;
        
        this.stats.detected += matches;

        elements.forEach(el => {
          if (!el) return;
          // Find parent shelf if el is inside a dedicated Shorts shelf section
          const parentShelf = el.parentElement && typeof el.parentElement.closest === 'function'
            ? el.parentElement.closest(`
                ytd-reel-shelf-renderer,
                ytd-rich-section-renderer,
                ytd-rich-shelf-renderer,
                reel-shelf-view-model,
                yt-shorts-shelf-view-model,
                grid-shelf-view-model,
                ytd-horizontal-card-list-renderer
              `)
            : null;

          // Find container item if individual card
          const container = (typeof el.closest === 'function') ? el.closest(`
            ytd-rich-item-renderer,
            ytd-video-renderer,
            ytd-compact-video-renderer,
            ytd-reel-item-renderer,
            ytd-guide-entry-renderer,
            ytd-mini-guide-entry-renderer,
            ytd-pivot-bar-item-renderer,
            tp-yt-paper-item
          `) : null;
          
          const target = parentShelf || container || (el.matches && el.matches('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ytd-reel-item-renderer, ytd-reel-shelf-renderer') ? el : null);

          if (target && target.style) {
            target.style.setProperty('display', 'none', 'important');
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

const shortsBlockerInstance = new ShortsBlocker();

if (typeof window !== 'undefined') {
  window.ShortsBlocker = shortsBlockerInstance;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ShortsBlocker = globalThis.ShortsBlocker || shortsBlockerInstance;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = shortsBlockerInstance;
}

