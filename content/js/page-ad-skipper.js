/**
 * GodMode — Page-World Ad Skipper Engine
 * Injected in the MAIN world context to natively interact with YouTube player & DOM.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.__GODMODE_PAGE_AD_SKIPPER__) return;
  window.__GODMODE_PAGE_AD_SKIPPER__ = true;

  let wasAdPlaying = false;
  let prevMuted = false;
  let lastSkipTime = 0;

  const SKIP_SELECTORS = [
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

  function queryDeep(selector, root) {
    if (!root) root = document;
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
    } catch (e) {}
    return null;
  }

  function clickElement(el) {
    if (!el) return;
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
    try { el.dispatchEvent(new PointerEvent('pointerdown', eventOpts)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', eventOpts)); } catch (e) {}
    try { el.dispatchEvent(new PointerEvent('pointerup', eventOpts)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', eventOpts)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('click', eventOpts)); } catch (e) {}
    if (typeof el.click === 'function') {
      try { el.click(); } catch (e) {}
    }
  }

  function isAutoSkipEnabled() {
    if (typeof document === 'undefined' || !document.documentElement) return true;
    const autoSkipAttr = document.documentElement.getAttribute('data-ss-auto-skip');
    const skipAdsAttr = document.documentElement.getAttribute('data-ss-skip-ads');
    if (autoSkipAttr === 'false' || skipAdsAttr === 'false') return false;
    if (document.documentElement.dataset) {
      if (document.documentElement.dataset.ssAutoSkip === 'false' ||
          document.documentElement.dataset.shortsShieldAutoSkip === 'false' ||
          document.documentElement.dataset.ssSkipAds === 'false') {
        return false;
      }
    }
    return true;
  }

  function dismissAntiAdblockModal() {
    try {
      const enforcement = document.querySelector('ytd-enforcement-message-view-model');
      if (!enforcement) return false;

      // 1. Click close/dismiss buttons strictly inside enforcement message
      const dismissBtns = enforcement.querySelectorAll('button[aria-label*="Close" i], button[aria-label*="Dismiss" i], yt-icon-button button, .yt-spec-button-shape-next, button');
      for (let i = 0; i < dismissBtns.length; i++) {
        clickElement(dismissBtns[i]);
        break;
      }

      // 2. Remove enforcement elements from DOM
      const allEnforcements = document.querySelectorAll('ytd-enforcement-message-view-model');
      allEnforcements.forEach(el => {
        try {
          const parentDialog = el.closest('tp-yt-paper-dialog, ytd-popup-container, #dialog');
          if (parentDialog) {
            parentDialog.remove();
          }
          el.remove();
        } catch (e) {}
      });

      // 3. Clear backdrop overlay if opened by enforcement
      const backdrops = document.querySelectorAll('tp-yt-iron-overlay-backdrop.opened, tp-yt-iron-overlay-backdrop');
      backdrops.forEach(bd => {
        if (!bd.closest('#ss-popup-dialog, #ss-header-btn-container')) {
          try {
            bd.removeAttribute('opened');
            bd.style.display = 'none';
          } catch (e) {}
        }
      });

      // 4. Resume main video playback
      const video = document.querySelector('#movie_player video, .html5-video-player video, video');
      if (video && video.paused && !video.ended) {
        video.play().catch(() => {});
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function handleAd() {
    try {
      if (!isAutoSkipEnabled()) {
        if (wasAdPlaying) {
          wasAdPlaying = false;
          const video = document.querySelector('#movie_player video, .html5-video-player video, video');
          if (video) {
            if (video.playbackRate === 16) video.playbackRate = 1;
            video.muted = prevMuted;
          }
        }
        return;
      }

      // Always check and dismiss anti-adblock modal if present
      dismissAntiAdblockModal();

      const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
      const isAdPlaying = (player && player.classList && (
        player.classList.contains('ad-showing') ||
        player.classList.contains('ad-interrupting') ||
        player.classList.contains('ytp-ad-playing')
      )) || !!document.querySelector('.ad-showing, .ad-interrupting, .ytp-ad-playing');

      // Fast path: if no ad is active and no ad was playing, exit immediately to save CPU
      if (!isAdPlaying && !wasAdPlaying) {
        return;
      }

      const video = document.querySelector('#movie_player video, .html5-video-player video, video');

      if (isAdPlaying) {
        if (!wasAdPlaying) {
          wasAdPlaying = true;
          if (video) prevMuted = video.muted;
        }

        // 1. Mute and accelerate ad playback safely (without triggering video.currentTime telemetry alerts)
        if (video) {
          video.muted = true;
          video.playbackRate = 16;
        }

        // 2. Click skip buttons
        const now = Date.now();
        if (now - lastSkipTime > 500) {
          for (let i = 0; i < SKIP_SELECTORS.length; i++) {
            const btn = queryDeep(SKIP_SELECTORS[i]);
            if (btn) {
              clickElement(btn);
              lastSkipTime = now;
              break;
            }
          }
        }

        // 3. YouTube Player API skip
        if (player && typeof player.skipAd === 'function') {
          try { player.skipAd(); } catch (e) {}
        }
      } else if (wasAdPlaying) {
        wasAdPlaying = false;
        // Restore standard playback for main content video
        if (video) {
          if (video.playbackRate === 16) video.playbackRate = 1;
          video.muted = prevMuted;
          if (video.paused && !video.ended) {
            video.play().catch(() => {});
          }
        }
      }
    } catch (e) {}
  }

  // Continuous fallback loop (250ms)
  setInterval(handleAd, 250);

  // MutationObserver for instant trigger
  try {
    const observer = new MutationObserver(handleAd);
    const target = document.documentElement || document.body;
    if (target) {
      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-ss-auto-skip', 'data-ss-skip-ads']
      });
    }
  } catch (e) {}
})();
