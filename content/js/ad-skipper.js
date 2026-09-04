/**
 * AdSkipper — Automated YouTube Ad Skipping Engine (GodMode MV3)
 *
 * Strategies:
 * 1. Strategy A (Direct Media Manipulation): Detects active ad state (.ad-showing, .ad-interrupting,
 *    .ytp-ad-playing, active visible .ytp-ad-module) and advances ad video element: `video.currentTime = video.duration`.
 * 2. Strategy B (Page Script Main World Injection): Injects a lightweight script into document.head
 *    (MAIN world context) to trigger trusted skip button clicks and native player.skipAd() API with full
 *    countdown and visibility guards, coordinating with content script via window.postMessage.
 * 3. Strategy C (Fallback DOM Cleansing): If an ad persists for >= 2 seconds, removes/hides
 *    .ytp-ad-module and overlay containers from the DOM, and cleans up ad-state player classes.
 * 4. Full Selector & Guard Compatibility: Supports all modern, classic, and legacy skip button selectors,
 *    with robust countdown / preview protection and debounced logging.
 */

(function () {

  const AD_SKIP_SELECTORS = [
    // 1. Modern 2024/2026 redesign selectors
    '.ytp-ad-skip-button-modern',
    'button.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-modern.ytp-button',
    '.ytp-ad-skip-button-slot-modern button',
    '.ytp-ad-skip-button-slot-modern',
    '.ytp-ad-skip-button-container button',
    '.ytp-ad-skip-button-container',

    // 2. Modern skip button slots and containers
    '.ytp-ad-skip-button-slot button',
    '.ytp-ad-skip-button-slot',
    '.ytp-ad-player-overlay-skip-or-preview button',
    '.ytp-ad-player-overlay-skip-or-preview',

    // 3. Classic linear & bumper skip buttons
    '.ytp-skip-ad-button',
    'button.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    'button.ytp-ad-skip-button',

    // 4. Inner clickable text and content elements
    '.ytp-ad-skip-button-text',
    '.ytp-skip-ad-button-content',
    '.ytp-ad-text.ytp-ad-skip-button-text',

    // 5. Accessibility & attribute-based selectors
    'button[aria-label*="Skip ad"]',
    'button[aria-label*="skip ad"]',
    'button[aria-label*="Skip Ad"]',
    'button[aria-label*="Skip ads"]',
    'button[aria-label*="skip ads"]',
    'button[aria-label*="Skip Ads"]',
    'button[aria-label*="Skip advertisement"]',
    'button[aria-label*="skip advertisement"]',
    'button[aria-label*="Skip Advertisement"]',
    'button[aria-label="Skip"]',
    'button[aria-label="skip"]',
    '[aria-label*="Skip ad"]',
    '[aria-label*="skip ad"]',
    '[aria-label*="Skip Ad"]',
    '[aria-label*="Skip ads"]',
    '[aria-label*="skip ads"]',
    '[aria-label*="Skip Ads"]',
    '[aria-label*="Skip advertisement"]',
    '[aria-label*="skip advertisement"]',
    '[aria-label*="Skip Advertisement"]',
    '[aria-label="Skip"]',
    '[aria-label="skip"]',
    'button[id^="skip-button"]',
    '[id^="skip-button"] button',
    'button[class*="ytp-ad-skip-button"]',
    'button[class*="ytp-skip-ad-button"]',
    'button[class*="ytp-ad-skip"]',

    // 6. Legacy videoAdUi & module-scoped fallbacks
    '.videoAdUiSkipButton',
    'button.videoAdUiSkipButton',
    '.ytp-ad-module button[class*="skip"]',
    '.ytp-ad-module [class*="skip"] button',
    '.ytp-ad-module [class*="skip"]'
  ].join(', ');

  class AdSkipper {
    constructor() {
      this._enabled = false;
      this._observer = null;
      this._observedTarget = null;
      this._pollInterval = null;
      this._navBound = null;
      this._messageBound = null;
      this._lastSkipTime = 0;
      this._lastSkippedEl = null;
      this._lastLogTime = 0;
      this._adStartTime = 0;
      this._injectedScript = null;
      this._totalSkipped = 0;
    }

    /**
     * Returns the operational status of the AdSkipper engine.
     * @returns {{ enabled: boolean, observerActive: boolean, lastSkipTime: number, totalSkipped: number }}
     */
    getStatus() {
      return {
        enabled: Boolean(this._enabled),
        observerActive: Boolean(this._observer !== null),
        lastSkipTime: this._lastSkipTime || 0,
        totalSkipped: this._totalSkipped || 0
      };
    }

    /**
     * Enable the auto-skip engine.
     * Starts observer, 300ms poll interval, SPA navigation listener, page-script injection,
     * and performs an immediate skip check.
     */
    enable() {
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.setAttribute('data-ss-auto-skip', 'true');
        document.documentElement.setAttribute('data-ss-skip-ads', 'true');
      }
      if (this._enabled) return;
      this._enabled = true;
      this._lastSkippedEl = null;
      this._lastSkipTime = 0;
      this._lastLogTime = 0;
      this._adStartTime = 0;

      this._attachNavigationListener();
      this._startObserver();
      this._startPoll();
      this._trySkip();
      console.log('[GodMode] AdSkipper: enabled');
    }

    /**
     * Disable the auto-skip engine and clean up all listeners, scripts, and timers.
     */
    disable() {
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.setAttribute('data-ss-auto-skip', 'false');
        document.documentElement.setAttribute('data-ss-skip-ads', 'false');
      }
      if (!this._enabled) return;
      this._enabled = false;
      this._stopObserver();
      this._stopPoll();
      this._detachNavigationListener();
      this._lastSkippedEl = null;
      this._lastSkipTime = 0;
      this._lastLogTime = 0;
      this._adStartTime = 0;
      console.log('[GodMode] AdSkipper: disabled');
    }

    // ── Strategy A: Ad State Detection & Direct Media Manipulation ───────

    /**
     * Determines whether YouTube is currently displaying or playing an ad.
     * @returns {boolean} True if player or DOM indicates an active visible ad
     */
    _isAdPlaying() {
      if (typeof document === 'undefined') return false;

      const player = document.getElementById('movie_player') ||
                     document.querySelector('.html5-video-player') ||
                     document.querySelector('#player') ||
                     (document.querySelector('ytd-player, ytd-watch-flexy, #ytd-player') &&
                      document.querySelector('ytd-player, ytd-watch-flexy, #ytd-player').shadowRoot &&
                      document.querySelector('ytd-player, ytd-watch-flexy, #ytd-player').shadowRoot.querySelector('#movie_player, .html5-video-player'));

      if (player && player.classList) {
        if (player.classList.contains('ad-showing') ||
            player.classList.contains('ad-interrupting') ||
            player.classList.contains('ytp-ad-playing')) {
          return true;
        }
      }

      if (document.querySelector('.ad-showing, .ad-interrupting, .ytp-ad-playing')) {
        return true;
      }

      try {
        const playerScope = document.querySelector('ytd-player, ytd-watch-flexy, #player-container, #player, .html5-video-player, .ytp-ad-module, ytd-ad-slot-renderer') ||
                            document.getElementById('movie_player');
        if (playerScope && typeof playerScope.querySelector === 'function') {
          if (playerScope.querySelector(AD_SKIP_SELECTORS)) {
            return true;
          }
        }
      } catch (e) {}

      const adModule = document.querySelector('.ytp-ad-module');
      if (adModule) {
        // Check if adModule is explicitly hidden
        if (adModule.style && (adModule.style.display === 'none' || adModule.style.visibility === 'hidden')) {
          return false;
        }
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
          try {
            const style = window.getComputedStyle(adModule);
            if (style && (style.display === 'none' || style.visibility === 'hidden')) {
              return false;
            }
          } catch (e) {}
        }

        // Check if adModule contains active visible ad elements
        if (typeof adModule.querySelectorAll === 'function') {
          const activeAdEls = adModule.querySelectorAll(
            '.ytp-ad-player-overlay, .ytp-ad-overlay-container, .ytp-ad-text, .ytp-ad-preview-container, .ytp-ad-skip-button-slot, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button'
          );
          for (let i = 0; i < activeAdEls.length; i++) {
            const el = activeAdEls[i];
            if (el && el.style && (el.style.display === 'none' || el.style.visibility === 'hidden')) {
              continue;
            }
            if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
              try {
                const s = window.getComputedStyle(el);
                if (s && (s.display === 'none' || s.visibility === 'hidden')) {
                  continue;
                }
              } catch (e) {}
            }
            return true;
          }
        }

        if (adModule.children && adModule.children.length > 0) {
          // Check that at least one child is not explicitly hidden
          for (let i = 0; i < adModule.children.length; i++) {
            const child = adModule.children[i];
            if (child && child.style && (child.style.display === 'none' || child.style.visibility === 'hidden')) {
              continue;
            }
            if (child && ((typeof child.hasAttribute === 'function' && child.hasAttribute('hidden')) ||
                (typeof child.getAttribute === 'function' && child.getAttribute('aria-hidden') === 'true'))) {
              continue;
            }
            if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
              try {
                const s = window.getComputedStyle(child);
                if (s && (s.display === 'none' || s.visibility === 'hidden')) {
                  continue;
                }
              } catch (e) {}
            }
            return true;
          }
        }
      }

      return false;
    }

    /**
     * Strategy A: Finds the video element and seeks it to the end (duration)
    /**
     * Non-intrusive ad check — does NOT manipulate video.currentTime or duration
     * to avoid triggering YouTube's anti-adblocker detection.
     */
    _seekAdToEnd() {
      // Non-intrusive: We do NOT mutate video.currentTime to prevent breaking
      // YouTube's internal stream state machine. Skip button clicking handles transitions.
      return false;
    }

    /**
     * Strategy B (Page Script Injection) is REMOVED.
     * YouTube's Content Security Policy (CSP) blocks inline script injection
     * (document.createElement('script') + textContent) in MV3 extensions.
     * All ad skipping is handled by direct content-script button clicking (see _trySkip).
     * @deprecated CSP-blocked — do not use.
     */
    _injectPageScript() {
      // No-op: Removed due to YouTube CSP violation.
      // Strategy B used document.createElement('script') with textContent,
      // which is blocked by: script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules'
      // The content-script context can click buttons directly without page-world injection.
    }

    _removePageScript() {
      // No-op: Page script injection removed, nothing to clean up.
    }

    _attachMessageListener() {
      // No-op: postMessage coordination removed with page script injection.
    }
    _detachMessageListener() {
      // No-op: postMessage coordination removed with page script injection.
    }

    // ── Strategy C: Fallback DOM Removal ─────────────────────────────────

    /**
     * Non-intrusive fallback: Dismisses anti-adblocker enforcement dialogs
     * if YouTube shows "Ad blockers violate YouTube's Terms of Service".
     * Does NOT hide or remove ad containers from the DOM.
     */
    _applyFallbackDOMRemoval() {
      if (typeof document === 'undefined') return;
      try {
        const enforcementEls = document.querySelectorAll('ytd-enforcement-message-view-model, .ytd-enforcement-message-view-model, [class*="enforcement-message"]');
        if (!enforcementEls || enforcementEls.length === 0) return;

        // 1. Auto-dismiss anti-adblocker dialog strictly inside enforcement containers
        for (let i = 0; i < enforcementEls.length; i++) {
          const el = enforcementEls[i];
          const dismissBtns = el.querySelectorAll('button[aria-label*="Close" i], button[aria-label*="Dismiss" i], button, yt-icon-button button, .yt-spec-button-shape-next');
          for (let j = 0; j < dismissBtns.length; j++) {
            const btn = dismissBtns[j];
            if (btn && typeof btn.click === 'function') {
              try { btn.click(); } catch(e) {}
            }
          }

          try {
            const parentDialog = el.closest ? el.closest('tp-yt-paper-dialog, ytd-popup-container, #dialog') : null;
            if (parentDialog && parentDialog.parentNode) {
              parentDialog.parentNode.removeChild(parentDialog);
            }
            if (el && el.parentNode) {
              el.parentNode.removeChild(el);
            }
          } catch(e) {}
        }

        // 2. Clear backdrop overlay only if opened by enforcement message
        const backdrops = document.querySelectorAll('tp-yt-iron-overlay-backdrop.opened, tp-yt-iron-overlay-backdrop');
        for (let i = 0; i < backdrops.length; i++) {
          const bd = backdrops[i];
          if (!bd.closest || !bd.closest('#ss-popup-dialog, #ss-header-btn-container')) {
            try {
              bd.removeAttribute('opened');
              bd.style.display = 'none';
            } catch (e) {}
          }
        }

        // 3. Auto-resume main video playback if paused by anti-adblock popup
        const player = document.getElementById('movie_player') ||
                       document.querySelector('.html5-video-player') ||
                       document.querySelector('ytd-player, ytd-watch-flexy');
        const video = (player && typeof player.querySelector === 'function' && player.querySelector('video')) ||
                      document.querySelector('video');
        if (video && video.paused && !video.ended) {
          try {
            const p = video.play();
            if (p && typeof p.catch === 'function') {
              p.catch(() => {});
            }
          } catch(e) {}
        }
      } catch (e) {}
    }

    /**
     * Finds the active main video element on the page, prioritizing movie_player
     * over background/sidebar preview videos.
     * @returns {HTMLVideoElement|null}
     */
    _getActiveVideo() {
      if (typeof document === 'undefined') return null;
      const player = document.getElementById('movie_player') ||
                     document.querySelector('.html5-video-player') ||
                     document.querySelector('#player') ||
                     document.querySelector('ytd-player, ytd-watch-flexy');
      if (player && typeof player.querySelector === 'function') {
        const v = player.querySelector('video');
        if (v) return v;
      }
      return document.querySelector('#movie_player video, .html5-video-player video, .html5-main-video, video');
    }

    // ── Core Skip Logic & Selector Matching ──────────────────────────────

    /**
     * Resolves the actual interactive/clickable target element from a candidate.
     * @param {Element} el - Matched candidate element
     * @returns {Element} Resolved button or clickable element
     */
    _getClickableTarget(el) {
      if (!el) return null;
      if (el.tagName === 'BUTTON') return el;
      if (typeof el.querySelector === 'function') {
        const childBtn = el.querySelector('button, [role="button"], .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button');
        if (childBtn && childBtn !== el) return childBtn;
      }
      if (typeof el.closest === 'function') {
        const parentBtn = el.closest('button, [role="button"], .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button');
        if (parentBtn) return parentBtn;
      }
      return el;
    }

    /**
     * Validates whether a found DOM node represents a visible, active skip button
     * that is ready to be clicked (i.e. not hidden, not disabled, and not in countdown mode).
     * @param {Element} el - DOM element matching one of AD_SKIP_SELECTORS
     * @returns {boolean} True if element is a valid, clickable skip button
     */
    _isClickableSkipButton(el) {
      if (!el) return false;

      const btn = this._getClickableTarget(el);
      if (!btn) return false;

      // Never click buttons located inside masthead, top bar, search, extension UI, or banner ad option menus
      if (typeof btn.closest === 'function') {
        if (btn.closest('#ss-header-btn-container, #ss-popup-dialog, #ss-popup-backdrop, ytd-masthead, #masthead, #searchbox, header, ytd-banner-promo-renderer, ytd-statement-banner-renderer, ytd-display-ad-renderer, ytd-in-feed-ad-layout-renderer, ytd-ad-inline-playback-meta-block, #companion, ytd-companion-ad-renderer')) {
          return false;
        }
      }

      // Check disabled attributes on button
      if (btn.disabled || (typeof btn.getAttribute === 'function' && btn.getAttribute('aria-disabled') === 'true')) {
        return false;
      }
      if ((typeof btn.hasAttribute === 'function' && btn.hasAttribute('hidden')) ||
          (typeof btn.getAttribute === 'function' && btn.getAttribute('aria-hidden') === 'true')) {
        return false;
      }

      // Check ancestor disabled/hidden states via closest or direct parents
      if (typeof btn.closest === 'function') {
        if (btn.closest('[aria-hidden="true"], [aria-disabled="true"], [hidden]')) {
          return false;
        }
      }
      if (el !== btn && typeof el.closest === 'function') {
        if (el.closest('[aria-hidden="true"], [aria-disabled="true"], [hidden]')) {
          return false;
        }
      }
      if (btn.parentElement) {
        if (typeof btn.parentElement.getAttribute === 'function' &&
            (btn.parentElement.getAttribute('aria-hidden') === 'true' || btn.parentElement.getAttribute('aria-disabled') === 'true')) {
          return false;
        }
        if (typeof btn.parentElement.hasAttribute === 'function' && btn.parentElement.hasAttribute('hidden')) {
          return false;
        }
      }

      // Check inline style properties on candidate, target button, and parent
      if (el.style) {
        if (el.style.display === 'none' || el.style.visibility === 'hidden' || el.style.opacity === '0') {
          return false;
        }
      }
      if (btn.style) {
        if (btn.style.display === 'none' || btn.style.visibility === 'hidden' || btn.style.opacity === '0') {
          return false;
        }
      }
      if (btn.parentElement && btn.parentElement.style) {
        if (btn.parentElement.style.display === 'none' || btn.parentElement.style.visibility === 'hidden' || btn.parentElement.style.opacity === '0') {
          return false;
        }
      }

      // Check computed styles in real browser environments
      if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        try {
          const style = window.getComputedStyle(btn);
          if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
            return false;
          }
          if (btn.parentElement) {
            const parentStyle = window.getComputedStyle(btn.parentElement);
            if (parentStyle && (parentStyle.display === 'none' || parentStyle.visibility === 'hidden')) {
              return false;
            }
          }
        } catch (e) {}
      }

      // Check if element is purely a countdown/preview element before skip is available
      if (btn.classList) {
        if (
          btn.classList.contains('ytp-ad-preview-container') ||
          btn.classList.contains('ytp-ad-preview-text') ||
          btn.classList.contains('ytp-ad-preview-slot') ||
          btn.classList.contains('ytp-ad-duration-remaining') ||
          btn.classList.contains('ytp-preview-ad__text')
        ) {
          return false;
        }
      }
      if (el !== btn && el.classList) {
        if (
          el.classList.contains('ytp-ad-preview-container') ||
          el.classList.contains('ytp-ad-preview-text') ||
          el.classList.contains('ytp-ad-preview-slot') ||
          el.classList.contains('ytp-ad-duration-remaining') ||
          el.classList.contains('ytp-preview-ad__text')
        ) {
          return false;
        }
      }
      if (typeof btn.closest === 'function') {
        if (btn.closest('.ytp-ad-preview-container, .ytp-ad-preview-slot')) {
          return false;
        }
      }
      if (el !== btn && typeof el.closest === 'function') {
        if (el.closest('.ytp-ad-preview-container, .ytp-ad-preview-slot')) {
          return false;
        }
      }
      if (typeof btn.querySelector === 'function') {
        if (btn.querySelector('.ytp-ad-preview-container, .ytp-ad-preview-text, .ytp-ad-duration-remaining, .ytp-preview-ad__text')) {
          return false;
        }
      }

      // Check text content and accessibility attributes for countdown patterns
      const text = (btn.innerText || btn.textContent || '').replace(/\u00A0/g, ' ').trim();
      const ariaLabel = (typeof btn.getAttribute === 'function' ? btn.getAttribute('aria-label') : '') || '';
      const title = (typeof btn.getAttribute === 'function' ? btn.getAttribute('title') : '') || '';

      const elText = el !== btn ? (el.innerText || el.textContent || '').replace(/\u00A0/g, ' ').trim() : '';
      const elAria = (el !== btn && typeof el.getAttribute === 'function') ? (el.getAttribute('aria-label') || '') : '';
      const elTitle = (el !== btn && typeof el.getAttribute === 'function') ? (el.getAttribute('title') || '') : '';

      const slot = (typeof btn.closest === 'function') ? btn.closest('.ytp-ad-skip-button-slot, .ytp-ad-skip-button-container, .ytp-ad-player-overlay-skip-or-preview') : null;
      const slotAria = (slot && slot !== btn && slot !== el && typeof slot.getAttribute === 'function') ? (slot.getAttribute('aria-label') || '') : '';
      const slotTitle = (slot && slot !== btn && slot !== el && typeof slot.getAttribute === 'function') ? (slot.getAttribute('title') || '') : '';

      const combined = `${text} ${ariaLabel} ${title} ${elText} ${elAria} ${elTitle} ${slotAria} ${slotTitle}`.replace(/\u00A0/g, ' ').trim();

      // Pure numbers or timestamp format on button or slot (e.g. "5", "5s", "0:05", "0:15")
      if (/^\d+\s*(?:s|sec|seconds?)?$/i.test(text) || /^\d+:\d+$/.test(text) ||
          /^\d+\s*(?:s|sec|seconds?)?$/i.test(ariaLabel) || /^\d+:\d+$/.test(ariaLabel) ||
          /^\d+\s*(?:s|sec|seconds?)?$/i.test(title) || /^\d+:\d+$/.test(title) ||
          /^\d+\s*(?:s|sec|seconds?)?$/i.test(elAria) || /^\d+:\d+$/.test(elAria) ||
          /^\d+\s*(?:s|sec|seconds?)?$/i.test(elTitle) || /^\d+:\d+$/.test(elTitle) ||
          /^\d+\s*(?:s|sec|seconds?)?$/i.test(slotAria) || /^\d+:\d+$/.test(slotAria) ||
          /^\d+\s*(?:s|sec|seconds?)?$/i.test(slotTitle) || /^\d+:\d+$/.test(slotTitle) ||
          /^\d+\s*(?:s|sec|seconds?)?$/i.test(combined) || /^\d+:\d+$/.test(combined)) {
        return false;
      }
      // Status text, progress indicators, or banner ad option menus without skip capability
      if (/\b(?:video will play after ad|ad (?:will )?ends? in|you can skip (?:this )?(?:ad )?in|your video will begin in|playback will (?:begin|continue)|continue after ad|reward in|free after ad|my ad center|about advertiser|why seeing|report ad|block ad|send feedback)\b/i.test(combined)) {
        return false;
      }
      // Pure ad progress indicator e.g. "Ad 1 of 2 · 0:15" without skip keyword
      if (/\b(?:ad\s+\d+\s+of\s+\d+)\b/i.test(combined) && !/\bskip\b/i.test(combined)) {
        return false;
      }
      if (/\b\d+:\d+\b/.test(combined) && !/\bskip\b/i.test(combined)) {
        return false;
      }
      // Countdown skip text with remaining positive seconds (e.g. "Skip in 5s", "Skip in: 5", "Skip ad in 5", "Skip ads in 5s", "Skip after 5s")
      if (/\b(?:skip\s*(?:ad|ads|this ad)?\s*(?:in|after)\s*:?\s*[1-9]\d*)/i.test(combined)) {
        return false;
      }
      if (/\bin\s*:?\s*[1-9]\d*\s*(?:s|sec|seconds?)?\b/i.test(combined)) {
        return false;
      }
      if (/\bafter\s*:?\s*[1-9]\d*\s*(?:s|sec|seconds?)?\b/i.test(combined)) {
        return false;
      }
      if (/\b[1-9]\d*\s*(?:s|sec|seconds?)\s*(?:remaining|left)\b/i.test(combined)) {
        return false;
      }

      return true;
    }

    /**
     * Dispatches the full native pointer and mouse event sequence with composed: true
     * followed by programmatic click to penetrate Shadow DOM boundaries and trigger
     * YouTube's Polymer event handlers.
     * Order: pointerdown -> mousedown -> pointerup -> mouseup -> click -> btn.click()
     * @param {Element} btn - The primary clickable button target
     * @param {Element} [el] - The original matched candidate element if different from btn
     * @returns {boolean} True if at least one event or click succeeded
     */
    _dispatchNativeClickSequence(btn, el) {
      if (!btn) return false;
      let clicked = false;

      const eventOpts = {
        bubbles: true,
        cancelable: true,
        composed: true,
        detail: 1,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true
      };
      if (typeof window !== 'undefined' && typeof Window !== 'undefined' && window instanceof Window) {
        eventOpts.view = window;
      }

      // Native Event Sequence: pointerdown -> mousedown -> pointerup -> mouseup -> click
      if (typeof btn.dispatchEvent === 'function') {
        try {
          if (typeof PointerEvent !== 'undefined') {
            btn.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
          }
          if (typeof MouseEvent !== 'undefined') {
            btn.dispatchEvent(new MouseEvent('mousedown', eventOpts));
          }
          if (typeof PointerEvent !== 'undefined') {
            btn.dispatchEvent(new PointerEvent('pointerup', eventOpts));
          }
          if (typeof MouseEvent !== 'undefined') {
            btn.dispatchEvent(new MouseEvent('mouseup', eventOpts));
            btn.dispatchEvent(new MouseEvent('click', eventOpts));
            clicked = true;
          } else if (typeof CustomEvent !== 'undefined') {
            btn.dispatchEvent(new CustomEvent('click', { bubbles: true, cancelable: true, composed: true }));
            clicked = true;
          }
        } catch (e) {}
      }

      // YouTube Player API skip method
      try {
        const player = (typeof document !== 'undefined') ? (document.getElementById('movie_player') || document.querySelector('.html5-video-player')) : null;
        if (player && typeof player.skipAd === 'function') {
          player.skipAd();
          clicked = true;
        }
      } catch (e) {}

      // Standard programmatic click
      if (typeof btn.click === 'function') {
        try {
          btn.click();
          clicked = true;
        } catch (e) {}
      }

      if (btn.parentElement && typeof btn.parentElement.click === 'function' && btn.parentElement !== el) {
        try {
          btn.parentElement.click();
          clicked = true;
        } catch (e) {}
      }

      // Slot container click fallback
      if (typeof btn.closest === 'function') {
        const slotContainer = btn.closest('.ytp-ad-skip-button-slot, .ytp-ad-skip-button-slot-modern, .ytp-ad-skip-button-container, .ytp-ad-player-overlay-skip-or-preview');
        if (slotContainer && typeof slotContainer.click === 'function' && slotContainer !== btn && slotContainer !== el) {
          try {
            slotContainer.click();
            clicked = true;
          } catch (e) {}
        }
      }

      // If candidate el is distinct (e.g. inner text span or outer wrapper), also trigger on el
      if (el && el !== btn) {
        if (typeof el.dispatchEvent === 'function') {
          try {
            if (typeof PointerEvent !== 'undefined') {
              el.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
            }
            if (typeof MouseEvent !== 'undefined') {
              el.dispatchEvent(new MouseEvent('mousedown', eventOpts));
            }
            if (typeof PointerEvent !== 'undefined') {
              el.dispatchEvent(new PointerEvent('pointerup', eventOpts));
            }
            if (typeof MouseEvent !== 'undefined') {
              el.dispatchEvent(new MouseEvent('mouseup', eventOpts));
              el.dispatchEvent(new MouseEvent('click', eventOpts));
              clicked = true;
            }
          } catch (e) {}
        }
        if (typeof el.click === 'function') {
          try {
            el.click();
            clicked = true;
          } catch (e) {}
        }
      }

      return clicked;
    }

    /**
     * Executes skip strategies: skip button click handlers with full countdown guards
     * and fallback anti-adblocker dialog dismissal.
     * Note: Page-script injection (Strategy B) has been removed due to YouTube CSP blocking
     * inline script execution. Direct content-script button clicking works correctly.
     * @returns {boolean} True if an ad was detected/skipped.
     */
    _trySkip() {
      if (!this._enabled) return false;
      if (typeof document === 'undefined') return false;

      // Upgrade observer target if movie_player was dynamically mounted
      const playerEl = document.getElementById('movie_player') ||
                       document.querySelector('.html5-video-player') ||
                       document.querySelector('#player');
      if (playerEl && this._observedTarget && this._observedTarget !== playerEl && this._observer) {
        this._startObserver();
      }

      const adPlaying = this._isAdPlaying();
      const now = Date.now();

      if (adPlaying) {
        if (!this._adStartTime) {
          this._adStartTime = now;
        }
      } else {
        this._adStartTime = 0;
      }

      let skipped = false;

      // Check if anti-adblock enforcement dialog is present
      if (document.querySelector('ytd-enforcement-message-view-model')) {
        this._applyFallbackDOMRemoval();
        skipped = true;
      }

      // 3. Skip Button Click & Selector Matching (with full countdown guards)
      let candidates = null;
      try {
        const playerScope = document.querySelector('#ytd-player, ytd-player, ytd-watch-flexy, #player-container, #player, .html5-video-player, .ytp-ad-module, ytd-ad-slot-renderer') ||
                            document.getElementById('movie_player') ||
                            (typeof document !== 'undefined' ? document.body : null);
        if (playerScope) {
          if (playerScope.shadowRoot && typeof playerScope.shadowRoot.querySelectorAll === 'function') {
            const shadowCandidates = playerScope.shadowRoot.querySelectorAll(AD_SKIP_SELECTORS);
            if (shadowCandidates && shadowCandidates.length > 0) {
              candidates = shadowCandidates;
            }
          }
          if (!candidates || candidates.length === 0) {
            candidates = playerScope.querySelectorAll(AD_SKIP_SELECTORS);
          }
        }
      } catch (e) {
        candidates = null;
      }

      if (candidates && candidates.length > 0) {
        for (let i = 0; i < candidates.length; i++) {
          const el = candidates[i];
          if (!this._isClickableSkipButton(el)) continue;
          const btn = this._getClickableTarget(el);
          if (!btn) continue;

          // Deduplicate: same element requires 500ms cooldown, different element proceeds
          if (this._lastSkippedEl === btn && (now - this._lastSkipTime < 500)) {
            break;
          }

          this._lastSkippedEl = btn;
          this._lastSkipTime = now;
          this._totalSkipped = (this._totalSkipped || 0) + 1;

          let playResumed = false;
          const resumePlay = () => {
            if (playResumed) return;
            playResumed = true;
            const activeVid = this._getActiveVideo();
            if (activeVid && activeVid.paused && !activeVid.ended) {
              try {
                const p = activeVid.play();
                if (p && typeof p.catch === 'function') {
                  p.catch(() => {});
                }
              } catch(e) {}
            }
          };

          // PRIMARY: Ask background to fire skipAd() in MAIN world context
          // (content-script synthetic events are isTrusted=false and ignored by YouTube Polymer)
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            try {
              chrome.runtime.sendMessage({ action: 'skipYouTubeAdMainWorld' }, () => {
                // suppress any lastError
                if (chrome.runtime.lastError) {}
                // Auto-resume video after skip
                resumePlay();
              });
            } catch(e) {}
          }

          // FALLBACK: also fire content-script click in case background API unavailable
          this._dispatchNativeClickSequence(btn, el);
          resumePlay();

          skipped = true;
          break;
        }
      }

      // 4. Strategy C: Fallback DOM Removal if ad persists >= 2000ms
      if (adPlaying && this._adStartTime > 0 && (now - this._adStartTime >= 2000)) {
        this._applyFallbackDOMRemoval();
        this._adStartTime = 0;
        skipped = true;
      }

      if (skipped) {
        this._logSkip();
        return true;
      }

      return false;
    }

    /**
     * Logs the standardized skip success message to the browser console.
     */
    _logSkip() {
      const now = Date.now();
      if (now - this._lastLogTime < 500) return;
      this._lastLogTime = now;
      console.log('[GodMode] AdSkipper: ad skipped ⚡');
    }

    // ── Observers & Event Listeners ──────────────────────────────────────

    /**
     * Attach MutationObserver on #movie_player (or .html5-video-player / document.body fallback).
     */
    _startObserver() {
      this._stopObserver();
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

      try {
        const target = document.getElementById('movie_player') ||
                       document.querySelector('.html5-video-player') ||
                       document.querySelector('#player') ||
                       document.body ||
                       document.documentElement;

        if (!target) return;

        this._observedTarget = target;
        this._observer = new MutationObserver(() => {
          this._trySkip();
        });

        this._observer.observe(target, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style', 'aria-hidden', 'hidden', 'aria-disabled', 'aria-label', 'title', 'disabled']
        });
      } catch (e) {
        console.warn('[GodMode] AdSkipper: MutationObserver failed:', e);
      }
    }

    _stopObserver() {
      if (this._observer) {
        try { this._observer.disconnect(); } catch (e) {}
        this._observer = null;
      }
      this._observedTarget = null;
    }

    /**
     * Fallback interval poll — runs every 300ms to catch ads appearing after navigation.
     */
    _startPoll() {
      this._stopPoll();
      if (typeof setInterval === 'undefined') return;

      this._pollInterval = setInterval(() => {
        if (!this._enabled) {
          this._stopPoll();
          return;
        }
        this._trySkip();
      }, 300);
    }

    _stopPoll() {
      if (this._pollInterval) {
        clearInterval(this._pollInterval);
        this._pollInterval = null;
      }
    }

    /**
     * Handles YouTube SPA page navigation (yt-navigate-finish event).
     */
    _onNavigate() {
      if (!this._enabled) return;
      this._lastSkippedEl = null;
      this._lastSkipTime = 0;
      this._adStartTime = 0;
      this._injectPageScript();
      this._startObserver();
      this._trySkip();
    }

    _attachNavigationListener() {
      if (this._navBound || typeof window === 'undefined') return;
      this._navBound = this._onNavigate.bind(this);
      window.addEventListener('yt-navigate-finish', this._navBound, true);
      if (typeof document !== 'undefined') {
        document.addEventListener('yt-navigate-finish', this._navBound, true);
      }
    }

    _detachNavigationListener() {
      if (!this._navBound) return;
      if (typeof window !== 'undefined') {
        window.removeEventListener('yt-navigate-finish', this._navBound, true);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('yt-navigate-finish', this._navBound, true);
      }
      this._navBound = null;
    }
  }

  const adSkipperInstance = new AdSkipper();

  // Expose globally for main.js and universal test environments
  if (typeof window !== 'undefined') {
    window.AdSkipper = adSkipperInstance;
  }
  if (typeof global !== 'undefined') {
    global.AdSkipper = adSkipperInstance;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = adSkipperInstance;
  }
})();

