/**
 * In-Page Quick Block Button on YouTube Watch Pages
 * content/js/quick-block.js
 *
 * Provides:
 * - Watch page action bar injection of #ss-quick-block-btn beside Like/Share
 * - Glassmorphic popover menu for channel blocking and title keyword selection
 * - 5-second animated countdown toast notification with Undo and Go Home actions
 * - Playback auto-pausing and safe redirection on commit
 */

// Standard stop words for title keyword tokenizer
const QUICK_BLOCK_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'in', 'on', 'at',
  'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after',
  'how', 'why', 'what', 'when', 'where', 'who', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their',
  'video', 'official', 'hd', '4k', 'full', 'new', '2024', '2025', '2026', 'vs', 'part', 'episode'
]);

function getStorageUtil() {
  if (typeof StorageUtil !== 'undefined') return StorageUtil;
  if (typeof window !== 'undefined' && window.StorageUtil) return window.StorageUtil;
  if (typeof globalThis !== 'undefined' && globalThis.StorageUtil) return globalThis.StorageUtil;
  if (typeof global !== 'undefined' && global.StorageUtil) return global.StorageUtil;
  if (typeof global !== 'undefined' && global.window && global.window.StorageUtil) return global.window.StorageUtil;
  return null;
}

class QuickBlock {
  constructor() {
    this.isActive = false;
    this.injected = false;
    this.toastTimer = null;
    this.redirectTimer = null;
    this.countdownInterval = null;
    this.previousState = null;
    this.activeToast = null;
    this.menuVisible = false;
    this._watchdogInterval = null;
    this.retryInterval = null;

    this.boundNavigate = this.onNavigate.bind(this);
    this.boundOutsideClick = this.onOutsideClick.bind(this);
    this.boundKeydown = (e) => {
      if (e && e.key === 'Escape') this.closeMenu();
    };
  }

  init() {
    this.enable();
  }

  enable() {
    if (this.isActive) {
      if (this.isWatchPage()) {
        this.tryInjectButton();
      }
      return;
    }
    this.isActive = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('yt-navigate-finish', this.boundNavigate);
      window.addEventListener('yt-page-data-updated', this.boundNavigate);
      window.addEventListener('yt-navigate-start', this.boundNavigate);
      window.addEventListener('DOMContentLoaded', this.boundNavigate);
      window.addEventListener('load', this.boundNavigate);
      window.addEventListener('pageshow', this.boundNavigate);
      window.addEventListener('popstate', this.boundNavigate);
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', this.boundOutsideClick);
      document.addEventListener('keydown', this.boundKeydown);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.isActive && this.isWatchPage()) {
          this.tryInjectButton();
        }
      });
    }

    if (this.isWatchPage()) {
      this.tryInjectButton();
    }

    this.startSelfHealingWatchdog();
    this.observeWatchPage();
  }

  disable() {
    if (!this.isActive) return;
    this.isActive = false;

    this.closeMenu();
    this.removeButton();
    this.stopSelfHealingWatchdog();
    this.stopRetryLoop();
    this.clearTimers();

    if (this.activeToast) {
      try { this.activeToast.remove(); } catch (e) {}
      this.activeToast = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('yt-navigate-finish', this.boundNavigate);
      window.removeEventListener('yt-page-data-updated', this.boundNavigate);
      window.removeEventListener('yt-navigate-start', this.boundNavigate);
      window.removeEventListener('DOMContentLoaded', this.boundNavigate);
      window.removeEventListener('load', this.boundNavigate);
      window.removeEventListener('pageshow', this.boundNavigate);
      window.removeEventListener('popstate', this.boundNavigate);
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', this.boundOutsideClick);
      document.removeEventListener('keydown', this.boundKeydown);
    }

    if (typeof window !== 'undefined' && window.ObserverUtils) {
      window.ObserverUtils.disconnect('quick-block');
    }
  }

  startSelfHealingWatchdog() {
    this.stopSelfHealingWatchdog();
    this._watchdogInterval = setInterval(() => {
      if (this.isActive) {
        const existing = document.getElementById('ss-quick-block-btn');
        if (!existing || !document.contains(existing)) {
          this.tryInjectButton();
        }
        this.updateButtonVisibility();
        if (this.isWatchPage()) {
          this.checkAndEnforceStrictBlock();
        }
      }
    }, 600);
  }

  stopSelfHealingWatchdog() {
    if (this._watchdogInterval) {
      clearInterval(this._watchdogInterval);
      this._watchdogInterval = null;
    }
  }

  startRetryLoop() {
    this.stopRetryLoop();
    let attempts = 0;
    this.retryInterval = setInterval(() => {
      attempts++;
      const existing = document.getElementById('ss-quick-block-btn');
      if (existing && document.contains(existing)) {
        this.stopRetryLoop();
        return;
      }
      if (this.isActive) {
        const injected = this.tryInjectButton();
        if (injected || attempts > 25) {
          this.stopRetryLoop();
        }
      } else {
        this.stopRetryLoop();
      }
    }, 250);
  }

  stopRetryLoop() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  updateButtonVisibility() {
    const container = document.getElementById('ss-header-btn-container');
    const btn = document.getElementById('ss-quick-block-btn');
    const onWatch = this.isWatchPage();

    if (container) {
      if (onWatch) {
        container.classList.add('ss-show-block-btn');
      } else {
        container.classList.remove('ss-show-block-btn');
      }
    }

    if (btn) {
      if (onWatch) {
        btn.classList.add('ss-visible');
        btn.style.setProperty('display', 'inline-flex', 'important');
      } else {
        btn.classList.remove('ss-visible');
        btn.style.setProperty('display', 'none', 'important');
      }
    }
  }

  onNavigate() {
    if (!this.isActive) return;
    this.closeMenu();
    this.tryInjectButton();
    this.updateButtonVisibility();
    if (this.isWatchPage()) {
      this.checkAndEnforceStrictBlock();
    }
  }

  observeWatchPage() {
    if (typeof window === 'undefined' || !window.ObserverUtils) return;

    window.ObserverUtils.observe(
      'ytd-watch-metadata, #top-level-buttons-computed, #top-row, #above-the-fold, #actions, ytd-menu-renderer, ytd-watch-flexy, #primary, #actions-inner, segmented-like-dislike-button-view-model, ytd-segmented-like-dislike-button-renderer, yt-button-view-model, like-button-view-model, share-button-view-model, ytd-masthead, #masthead, #buttons',
      () => {
        if (this.isActive) {
          const existing = document.getElementById('ss-quick-block-btn');
          if (!existing || !document.contains(existing)) {
            this.tryInjectButton();
          }
          this.updateButtonVisibility();
          if (this.isWatchPage()) {
            this.checkAndEnforceStrictBlock();
          }
        }
      },
      'quick-block'
    );
  }

  onOutsideClick(e) {
    if (!this.menuVisible) return;
    const menu = document.getElementById('ss-quick-block-menu');
    const btn = document.getElementById('ss-quick-block-btn');
    if (menu && e && e.target) {
      if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
        this.closeMenu();
      }
    }
  }

  closeMenu() {
    const menu = document.getElementById('ss-quick-block-menu');
    if (menu) {
      menu.remove();
    }
    this.menuVisible = false;
  }

  isWatchPage() {
    const loc = (typeof window !== 'undefined' && window.location) ? window.location : (typeof global !== 'undefined' && global.location ? global.location : null);
    if (loc) {
      const p = (loc.pathname || '').toLowerCase();
      const h = (loc.href || '').toLowerCase();
      const s = (loc.search || '').toLowerCase();

      // Clear home feed and non-watch page exclusion
      if (p === '/' || p === '' || p.startsWith('/feed/')) {
        return false;
      }

      return p.includes('/watch') || h.includes('/watch') || p.includes('/live') || h.includes('/live') || s.includes('v=');
    }
    // Fallback: DOM-only detection when location is unavailable
    if (typeof document !== 'undefined') {
      const isWatchMetadata = document.querySelector('ytd-watch-flexy, ytd-watch-metadata, #movie_player');
      if (isWatchMetadata && !document.querySelector('ytd-browse[page-subtype="home"]')) {
        return true;
      }
    }
    return false;
  }

  tryInjectButton() {
    return this.injectButton();
  }

  /**
   * Finds or attaches the Quick Block button beside the Shield button in the top masthead.
   * Ensures exactly ONE button exists and is placed inside #ss-header-btn-container.
   */
  injectButton() {
    try {
      if (typeof document === 'undefined') return false;

      // Clean up any rogue/orphan buttons outside the header container
      const headerContainer = document.getElementById('ss-header-btn-container');
      const allButtons = document.querySelectorAll('#ss-quick-block-btn');
      if (allButtons.length > 0) {
        allButtons.forEach(btn => {
          if (!headerContainer || !headerContainer.contains(btn)) {
            try { btn.remove(); } catch(e) {}
          }
        });
      }

      // Check if button already exists cleanly inside headerContainer
      const existingInHeader = headerContainer ? headerContainer.querySelector('#ss-quick-block-btn') : null;
      if (existingInHeader && document.contains(existingInHeader)) {
        this.injected = true;
        this.checkAndEnforceStrictBlock();
        return true;
      }

      // If header container is available, inject inside it beside Shield button
      if (headerContainer) {
        const btn = document.createElement('button');
        btn.id = 'ss-quick-block-btn';
        btn.className = 'ss-header-btn ss-header-block-btn ss-quick-block-pill yt-spec-button-shape-next';
        btn.innerHTML = '<span class="ss-btn-icon">🚫</span><span class="ss-btn-text">Block</span>';
        btn.setAttribute('aria-label', 'Quick Block Channel or Keywords');
        btn.setAttribute('title', 'Quick Block Channel & Keywords');
        btn.style.display = this.isWatchPage() ? 'inline-flex' : 'none';

        btn.addEventListener('click', (e) => {
          if (e) {
            e.stopPropagation();
            if (typeof e.preventDefault === 'function') e.preventDefault();
          }
          this.toggleMenu();
        });

        btn.addEventListener('pointerdown', (e) => e && e.stopPropagation());
        btn.addEventListener('mousedown', (e) => e && e.stopPropagation());

        headerContainer.appendChild(btn);
        this.injected = true;
        this.checkAndEnforceStrictBlock();
        return true;
      }

      // If header container not yet present, trigger HeaderButton injection
      if (typeof window !== 'undefined' && window.HeaderButton && typeof window.HeaderButton.tryInject === 'function') {
        window.HeaderButton.tryInject();
        const createdHeader = document.getElementById('ss-header-btn-container');
        if (createdHeader) {
          const btn = createdHeader.querySelector('#ss-quick-block-btn');
          if (btn) {
            btn.style.display = this.isWatchPage() ? 'inline-flex' : 'none';
            this.injected = true;
            this.checkAndEnforceStrictBlock();
            return true;
          }
        }
      }

      // Look for YouTube masthead buttons container
      let buttonsContainer = document.querySelector(
        'ytd-masthead #end #buttons, #end #buttons, #masthead #buttons, ytd-masthead #buttons, div#buttons'
      );

      if (buttonsContainer) {
        const btn = document.createElement('button');
        btn.id = 'ss-quick-block-btn';
        btn.className = 'ss-header-btn ss-header-block-btn ss-quick-block-pill yt-spec-button-shape-next';
        btn.innerHTML = '<span class="ss-btn-icon">🚫</span><span class="ss-btn-text">Block</span>';
        btn.setAttribute('aria-label', 'Quick Block Channel or Keywords');
        btn.setAttribute('title', 'Quick Block Channel & Keywords');
        btn.style.display = this.isWatchPage() ? 'inline-flex' : 'none';

        btn.addEventListener('click', (e) => {
          if (e) {
            e.stopPropagation();
            if (typeof e.preventDefault === 'function') e.preventDefault();
          }
          this.toggleMenu();
        });

        btn.addEventListener('pointerdown', (e) => e && e.stopPropagation());
        btn.addEventListener('mousedown', (e) => e && e.stopPropagation());

        buttonsContainer.appendChild(btn);
        this.injected = true;
        this.checkAndEnforceStrictBlock();
        return true;
      }

      // Fallback for tests or watch page mock DOM:
      if (document.body) {
        const btn = document.createElement('button');
        btn.id = 'ss-quick-block-btn';
        btn.className = 'ss-header-btn ss-header-block-btn ss-quick-block-pill yt-spec-button-shape-next';
        btn.innerHTML = '<span class="ss-btn-icon">🚫</span><span class="ss-btn-text">Block</span>';
        btn.setAttribute('aria-label', 'Quick Block Channel or Keywords');
        btn.setAttribute('title', 'Quick Block Channel & Keywords');
        btn.style.display = this.isWatchPage() ? 'inline-flex' : 'none';

        btn.addEventListener('click', (e) => {
          if (e) {
            e.stopPropagation();
            if (typeof e.preventDefault === 'function') e.preventDefault();
          }
          this.toggleMenu();
        });

        btn.addEventListener('pointerdown', (e) => e && e.stopPropagation());
        btn.addEventListener('mousedown', (e) => e && e.stopPropagation());

        document.body.appendChild(btn);
        this.injected = true;
        this.checkAndEnforceStrictBlock();
        return true;
      }

      return false;
    } catch (err) {
      console.warn('QuickBlock: injectButton failed', err);
      return false;
    }
  }

  removeButton() {
    const btn = document.getElementById('ss-quick-block-btn');
    if (btn && btn.parentNode) {
      btn.parentNode.removeChild(btn);
    }
    if (this._positionInterval) {
      clearInterval(this._positionInterval);
      this._positionInterval = null;
    }
    const overlay = document.getElementById('ss-blocked-content-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    this.injected = false;
  }

  /**
   * Ghost Shield (Strict Purge Mode) Watch Page Enforcement:
   * Scans current video title & channel against blocklists.
   * If matched and Ghost Shield is active, immediately halts playback and renders
   * the unskippable Obsidian "Blocked Content" overlay.
   */
  async checkAndEnforceStrictBlock() {
    if (!this.isWatchPage()) return false;
    const su = getStorageUtil();
    if (!su || typeof su.getSettings !== 'function') return false;

    let settings;
    try {
      settings = await su.getSettings();
    } catch (e) { return false; }
    if (!settings || settings.ghostShield === false || settings.extensionEnabled === false) return false;

    const blockedChannels = Array.isArray(settings.blockedChannels) ? settings.blockedChannels : [];
    const blockedKeywords = Array.isArray(settings.blockedKeywords) ? settings.blockedKeywords : [];
    if (blockedChannels.length === 0 && blockedKeywords.length === 0) return false;

    const rawChannelName = this.extractChannelName();
    const cleanCurrentChannel = String(rawChannelName || '')
      .replace(/\s*(?:subscribe|subscribed|verified|•\s*subscribe)\s*$/i, '')
      .toLowerCase()
      .replace(/^@/, '')
      .trim();
    const alphaCurrentChannel = cleanCurrentChannel.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

    const rawTitle = typeof document !== 'undefined' && document.title ? document.title.replace(/ - YouTube$/i, '') : '';
    const titleEl = document.querySelector('#title h1, h1.ytd-watch-metadata, #video-title, h1.ytd-video-primary-info-renderer');
    const currentTitle = ((titleEl ? titleEl.textContent : '') || rawTitle).toLowerCase();
    const normTitle = currentTitle
      .replace(/c\+\+/gi, 'cplusplus')
      .replace(/c#/gi, 'csharp')
      .replace(/ui\/ux/gi, 'uiux');

    // Check if channel is blocked (exact identity match, NOT arbitrary substring match)
    const matchedChannel = blockedChannels.find(ch => {
      if (!ch) return false;
      const normBlocked = String(ch).toLowerCase().replace(/^@/, '').trim();
      if (!normBlocked) return false;

      // 1. Direct equality
      if (cleanCurrentChannel === normBlocked) return true;

      // 2. Alphanumeric stripped equality
      const alphaBlocked = normBlocked.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      return (alphaCurrentChannel && alphaBlocked && alphaCurrentChannel === alphaBlocked);
    });

    // Check if keyword is blocked (phrase match for multi-word or word-boundary for single word)
    const matchedKeyword = blockedKeywords.find(kw => {
      if (!kw) return false;
      const rawKw = String(kw).trim().toLowerCase();
      if (!rawKw) return false;

      const normKw = rawKw
        .replace(/c\+\+/gi, 'cplusplus')
        .replace(/c#/gi, 'csharp')
        .replace(/ui\/ux/gi, 'uiux');

      // Multi-word phrase or special chars
      if (rawKw.includes(' ') || normKw.includes(' ') || /[^a-z0-9]/i.test(normKw)) {
        return currentTitle.includes(rawKw) || normTitle.includes(rawKw) || normTitle.includes(normKw) || currentTitle.includes(normKw);
      }

      // Single word token: word-boundary match (prevents "x" matching "fox", "next", "matrix")
      const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, 'i');
      return wordBoundaryRegex.test(normTitle) || wordBoundaryRegex.test(currentTitle);
    });

    if (matchedChannel || matchedKeyword) {
      const matchReason = matchedChannel ? `Channel "${matchedChannel}"` : `Keyword "${matchedKeyword}"`;
      this.pausePlayback();
      this.renderBlockedOverlay(matchReason, rawChannelName);
      return true;
    }
    return false;
  }

  renderBlockedOverlay(reason, channelName) {
    if (document.getElementById('ss-blocked-content-overlay')) return;

    this.pausePlayback();
    const video = document.querySelector('video');
    if (video) {
      try {
        video.muted = true;
        video.pause();
      } catch(e) {}
    }

    const overlay = document.createElement('div');
    overlay.id = 'ss-blocked-content-overlay';
    overlay.className = 'ss-blocked-content-backdrop';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="ss-blocked-modal">
        <div class="ss-blocked-badge">
          <span class="badge-icon">🚫</span>
          <span>STRICT GHOST SHIELD ACTIVE</span>
        </div>
        <div class="ss-blocked-shield-glow">
          <span class="ss-shield-symbol">🛡️</span>
        </div>
        <h2 class="ss-blocked-title">Content Blocked by Ghost Shield</h2>
        <p class="ss-blocked-desc">
          Playback is strictly denied. This content matches your custom block rule:
        </p>
        <div class="ss-blocked-match-chip">
          <span class="chip-label">Rule:</span>
          <span class="chip-val">${this.escapeHtml(reason)}</span>
        </div>
        <div class="ss-blocked-channel-tag">
          <span class="ch-label">Channel:</span>
          <span class="ch-name">${this.escapeHtml(channelName || 'YouTube Creator')}</span>
        </div>
        <p class="ss-blocked-strict-notice">
          Ghost Shield is in strict enforcement mode. Playback is not permitted.
        </p>
        <div class="ss-blocked-btn-group">
          <button id="ss-btn-blocked-home" class="ss-btn-blocked-primary">
            <span>🏠 Return to Safe Feed</span>
          </button>
          <button id="ss-btn-blocked-studio" class="ss-btn-blocked-secondary">
            <span>⚙️ Manage Blocklist Studio</span>
          </button>
        </div>
      </div>
    `;

    const homeBtn = overlay.querySelector('#ss-btn-blocked-home');
    if (homeBtn) {
      homeBtn.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        window.location.href = 'https://www.youtube.com/';
      });
    }

    const studioBtn = overlay.querySelector('#ss-btn-blocked-studio');
    if (studioBtn) {
      studioBtn.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          try {
            chrome.runtime.sendMessage({ action: 'openOptionsPage', tab: 'blocklist' });
          } catch(err) {
            window.open(chrome.runtime.getURL('options/options.html#blocklist'), '_blank');
          }
        } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          window.open(chrome.runtime.getURL('options/options.html#blocklist'), '_blank');
        }
      });
    }

    if (document.body) {
      document.body.appendChild(overlay);
    }

    if (homeBtn && typeof homeBtn.focus === 'function') {
      try { homeBtn.focus(); } catch (e) {}
    }
  }

  extractChannelName() {
    const ownerEl = document.querySelector(
      '#owner #channel-name, ytd-watch-metadata #channel-name, ytd-channel-name, #channel-name, ytd-watch-metadata ytd-channel-name #text a, #upload-info #channel-name a, #owner-name a, #text-container a'
    );
    if (!ownerEl) return 'YouTube Channel';
    const rawText = ownerEl.textContent || '';
    const su = getStorageUtil();
    return (su && typeof su.cleanChannelName === 'function')
      ? su.cleanChannelName(rawText)
      : rawText.trim() || 'YouTube Channel';
  }

  extractTitleKeywords(rawTitle = null) {
    let text = rawTitle;
    if (!text) {
      const titleEl = document.querySelector(
        '#title h1, h1.ytd-watch-metadata, #video-title, h1.ytd-video-primary-info-renderer, #title h1 yt-formatted-string, ytd-watch-metadata h1'
      );
      text = titleEl ? titleEl.textContent : (typeof document !== 'undefined' && document.title ? document.title.replace(/ - YouTube$/i, '') : '');
    }
    if (!text || typeof text !== 'string') return [];

    // Strip punctuation, brackets, special symbols, split on whitespace
    const cleanText = text.replace(/[[\](){}!?,.:;'"/\\|#*~`@$%^&+=<>_-]/g, ' ');
    const tokens = cleanText.split(/\s+/).map(t => t.trim().toLowerCase()).filter(Boolean);

    const candidates = [];
    for (const t of tokens) {
      if (t.length > 2 && !QUICK_BLOCK_STOP_WORDS.has(t) && !/^\d+$/.test(t)) {
        if (!candidates.includes(t)) {
          candidates.push(t);
        }
      }
    }
    return candidates;
  }

  toggleMenu() {
    let menu = document.getElementById('ss-quick-block-menu');
    if (menu) {
      menu.remove();
      this.menuVisible = false;
      return;
    }

    const channel = this.extractChannelName();
    const keywords = this.extractTitleKeywords();

    menu = document.createElement('div');
    menu.id = 'ss-quick-block-menu';
    menu.className = 'ss-quick-block-popover';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', 'Quick Block Shield');

    let keywordsHtml = '';
    keywords.forEach(kw => {
      keywordsHtml += `<button class="ss-keyword-chip" data-keyword="${this.escapeHtml(kw)}" title="Block '${this.escapeHtml(kw)}'">${this.escapeHtml(kw)} <span class="chip-plus">+</span></button>`;
    });

    menu.innerHTML = `
      <div class="ss-popover-header">
        <div class="ss-popover-title">
          <span class="ss-shield-icon">🛡️</span>
          <span>Quick Block Shield</span>
        </div>
        <button class="ss-popover-close-btn" id="ss-popover-close" aria-label="Close menu" title="Close">✕</button>
      </div>

      <div class="ss-menu-section ss-channel-section">
        <div class="ss-channel-card">
          <div class="ss-channel-info">
            <span class="ss-channel-avatar">📺</span>
            <div class="ss-channel-text">
              <span class="ss-section-caption">Channel</span>
              <span class="ss-channel-name" title="${this.escapeHtml(channel)}">${this.escapeHtml(channel)}</span>
            </div>
          </div>
          <button id="ss-btn-block-channel" class="ss-action-block-btn ss-btn-danger">
            <span class="icon">🚫</span> Block Channel
          </button>
        </div>
      </div>

      <div class="ss-menu-section">
        <div class="ss-section-caption">Keywords From Video Title:</div>
        <div id="ss-keyword-chips-container" class="ss-chips-row">
          ${keywordsHtml || '<span class="ss-no-keywords">No title keywords found</span>'}
        </div>
      </div>

      <div class="ss-menu-section ss-custom-kw-section">
        <div class="ss-section-caption">Add Custom Keyword:</div>
        <div class="ss-custom-kw-row">
          <input type="text" id="ss-custom-kw-input" placeholder="e.g. gaming, reaction, prank" class="ss-kw-input" />
          <button id="ss-btn-add-custom-kw" class="ss-btn-add-kw">＋ Add</button>
        </div>
      </div>

      <div class="ss-popover-footer">
        <button id="ss-btn-open-blocklist-studio" class="ss-footer-link">
          <span>⚙️ Manage All in Blocklist Studio</span>
          <span>➔</span>
        </button>
      </div>
    `;

    const closeBtn = menu.querySelector('#ss-popover-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        menu.remove();
        this.menuVisible = false;
      });
    }

    const channelBtn = menu.querySelector('#ss-btn-block-channel');
    if (channelBtn) {
      channelBtn.addEventListener('click', (e) => {
        if (e) {
          e.stopPropagation();
          if (typeof e.preventDefault === 'function') e.preventDefault();
        }
        menu.remove();
        this.menuVisible = false;
        this.blockChannel(channel);
      });
    }

    const keywordBtns = menu.querySelectorAll('.ss-keyword-chip');
    keywordBtns.forEach(kBtn => {
      kBtn.addEventListener('click', (e) => {
        if (e) {
          e.stopPropagation();
          if (typeof e.preventDefault === 'function') e.preventDefault();
        }
        const kw = kBtn.dataset.keyword;
        menu.remove();
        this.menuVisible = false;
        this.blockKeyword(kw);
      });
    });

    const customKwInput = menu.querySelector('#ss-custom-kw-input');
    const customKwBtn = menu.querySelector('#ss-btn-add-custom-kw');
    const handleCustomKw = () => {
      if (!customKwInput) return;
      const kw = customKwInput.value.trim();
      if (kw) {
        menu.remove();
        this.menuVisible = false;
        this.blockKeyword(kw);
      }
    };

    if (customKwBtn) {
      customKwBtn.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        handleCustomKw();
      });
    }

    if (customKwInput) {
      customKwInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          handleCustomKw();
        }
      });
      customKwInput.addEventListener('click', (e) => e && e.stopPropagation());
    }

    const studioBtn = menu.querySelector('#ss-btn-open-blocklist-studio');
    if (studioBtn) {
      studioBtn.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        menu.remove();
        this.menuVisible = false;
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          try {
            chrome.runtime.sendMessage({ action: 'openOptionsPage', tab: 'blocklist' });
          } catch(err) {
            window.open(chrome.runtime.getURL('options/options.html#blocklist'), '_blank');
          }
        } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          window.open(chrome.runtime.getURL('options/options.html#blocklist'), '_blank');
        }
      });
    }

    menu.addEventListener('click', (e) => e && e.stopPropagation());
    menu.addEventListener('pointerdown', (e) => e && e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e && e.stopPropagation());

    const hostBtn = document.getElementById('ss-quick-block-btn');
    if (hostBtn && typeof hostBtn.getBoundingClientRect === 'function') {
      const rect = hostBtn.getBoundingClientRect();
      const menuWidth = 360;
      const menuHeight = 360;
      const winWidth = window.innerWidth || 1200;
      const winHeight = window.innerHeight || 800;

      let leftPos = rect.right - menuWidth;
      if (leftPos < 16) leftPos = Math.max(16, rect.left);
      if (leftPos + menuWidth > winWidth - 16) {
        leftPos = Math.max(16, winWidth - menuWidth - 16);
      }

      let topPos = rect.bottom + 8;
      if (topPos + menuHeight > winHeight && rect.top > menuHeight + 16) {
        topPos = Math.max(16, rect.top - menuHeight - 8);
      } else if (topPos + menuHeight > winHeight) {
        topPos = Math.max(16, winHeight - menuHeight - 16);
      }

      menu.style.position = 'fixed';
      menu.style.top = `${topPos}px`;
      menu.style.left = `${leftPos}px`;
      menu.style.zIndex = '2147483647';
      menu.style.maxHeight = 'calc(100vh - 32px)';
      menu.style.overflowY = 'auto';
    }

    if (document.body) {
      document.body.appendChild(menu);
    }
    this.menuVisible = true;
  }

  async blockChannel(channelName) {
    const su = getStorageUtil();
    let settings = { blockedChannels: [], blockedKeywords: [] };
    if (su && typeof su.getSettings === 'function') {
      settings = await su.getSettings();
    }
    this.previousState = {
      type: 'channel',
      item: channelName,
      previousChannels: Array.isArray(settings.blockedChannels) ? [...settings.blockedChannels] : [],
      previousKeywords: Array.isArray(settings.blockedKeywords) ? [...settings.blockedKeywords] : []
    };

    const channels = [...this.previousState.previousChannels];
    if (!channels.some(c => c.toLowerCase() === channelName.toLowerCase())) {
      channels.push(channelName);
      if (su && typeof su.updateSetting === 'function') {
        await su.updateSetting('blockedChannels', channels);
      }
      if (typeof window !== 'undefined' && window.FeedController && typeof window.FeedController.setBlocklist === 'function') {
        window.FeedController.setBlocklist(this.previousState.previousKeywords, channels);
      }
    }

    // Auto-pause video
    this.pausePlayback();

    // Show undo toast
    this.showUndoToast(`🚫 Channel "${channelName}" Blocked`, () => this.handleUndo());

    // Schedule redirect after 5 seconds
    this.scheduleRedirect(5000);
  }

  async blockKeyword(keyword) {
    const cleaned = (keyword || '').trim().toLowerCase();
    if (!cleaned) return;

    const su = getStorageUtil();
    let settings = { blockedChannels: [], blockedKeywords: [] };
    if (su && typeof su.getSettings === 'function') {
      settings = await su.getSettings();
    }
    this.previousState = {
      type: 'keyword',
      item: cleaned,
      previousChannels: Array.isArray(settings.blockedChannels) ? [...settings.blockedChannels] : [],
      previousKeywords: Array.isArray(settings.blockedKeywords) ? [...settings.blockedKeywords] : []
    };

    const keywords = [...this.previousState.previousKeywords];
    if (!keywords.some(k => k.toLowerCase() === cleaned)) {
      keywords.push(cleaned);
      if (su && typeof su.updateSetting === 'function') {
        await su.updateSetting('blockedKeywords', keywords);
      }
      if (typeof window !== 'undefined' && window.FeedController && typeof window.FeedController.setBlocklist === 'function') {
        window.FeedController.setBlocklist(keywords, this.previousState.previousChannels);
      }
    }

    // Show undo toast
    this.showUndoToast(`🚫 Keyword "${cleaned}" Blocked`, () => this.handleUndo());
  }

  pausePlayback() {
    const video = document.querySelector('video');
    if (video && typeof video.pause === 'function') {
      try { video.pause(); } catch (e) {}
    }
    const player = document.getElementById('movie_player');
    if (player && typeof player.pauseVideo === 'function') {
      try { player.pauseVideo(); } catch (e) {}
    }
  }

  resumePlayback() {
    const video = document.querySelector('video');
    if (video && typeof video.play === 'function') {
      try { video.play(); } catch (e) {}
    }
    const player = document.getElementById('movie_player');
    if (player && typeof player.playVideo === 'function') {
      try { player.playVideo(); } catch (e) {}
    }
  }

  showUndoToast(message, onUndo) {
    if (this.activeToast) {
      try { this.activeToast.remove(); } catch (e) {}
      this.activeToast = null;
    }
    this.clearTimers();

    const toast = document.createElement('div');
    toast.id = 'ss-block-toast';
    toast.className = 'ss-floating-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
      <div class="ss-toast-content">
        <span class="ss-toast-message">${this.escapeHtml(message)}</span>
        <button id="ss-toast-undo-btn" class="ss-toast-btn-undo">Undo (<span id="ss-toast-countdown">5</span>s)</button>
        <button id="ss-toast-home-btn" class="ss-toast-btn-home">Go Home</button>
      </div>
      <div class="ss-toast-progress-bar"><div class="ss-toast-progress-fill"></div></div>
    `;

    const undoBtn = toast.querySelector('#ss-toast-undo-btn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        this.clearTimers();
        toast.remove();
        this.activeToast = null;
        if (typeof onUndo === 'function') onUndo();
      });
    }

    const homeBtn = toast.querySelector('#ss-toast-home-btn');
    if (homeBtn) {
      homeBtn.addEventListener('click', () => {
        this.clearTimers();
        toast.remove();
        this.activeToast = null;
        this.executeRedirect();
      });
    }

    if (document.body) {
      document.body.appendChild(toast);
    }
    this.activeToast = toast;

    // Countdown simulation
    let secondsLeft = 5;
    const countdownEl = toast.querySelector('#ss-toast-countdown');
    this.countdownInterval = setInterval(() => {
      secondsLeft--;
      if (countdownEl && secondsLeft >= 0) {
        countdownEl.textContent = String(secondsLeft);
      }
      if (secondsLeft <= 0) {
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
          this.countdownInterval = null;
        }
      }
    }, 1000);

    this.toastTimer = setTimeout(() => {
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
      if (this.activeToast === toast) {
        toast.remove();
        this.activeToast = null;
      }
    }, 5000);
  }

  async handleUndo() {
    this.clearTimers();
    if (this.previousState) {
      const su = getStorageUtil();
      if (su && typeof su.updateSetting === 'function') {
        await su.updateSetting('blockedChannels', this.previousState.previousChannels);
        await su.updateSetting('blockedKeywords', this.previousState.previousKeywords);
      }
      this.previousState = null;
    }
    this.resumePlayback();
  }

  scheduleRedirect(delayMs = 5000) {
    if (this.redirectTimer) clearTimeout(this.redirectTimer);
    this.redirectTimer = setTimeout(() => {
      this.executeRedirect();
    }, delayMs);
  }

  clearTimers() {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
      this.redirectTimer = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  executeRedirect() {
    const loc = (typeof window !== 'undefined' && window.location) ? window.location : (typeof global !== 'undefined' && global.location ? global.location : null);
    if (loc) {
      if (typeof loc.replace === 'function') {
        loc.replace('https://www.youtube.com/');
      } else {
        loc.href = 'https://www.youtube.com/';
      }
    }
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

const quickBlockInstance = new QuickBlock();
const QuickBlockController = QuickBlock;

if (typeof window !== 'undefined') {
  window.QuickBlock = quickBlockInstance;
  window.QuickBlockController = QuickBlockController;
  try {
    quickBlockInstance.enable();
  } catch (e) {}
}
if (typeof globalThis !== 'undefined') {
  globalThis.QuickBlock = globalThis.QuickBlock || quickBlockInstance;
  globalThis.QuickBlockController = globalThis.QuickBlockController || QuickBlockController;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = quickBlockInstance;
  module.exports.QuickBlock = QuickBlock;
  module.exports.QuickBlockController = QuickBlockController;
}
