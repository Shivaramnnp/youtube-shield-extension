function _ssDetectPreset(gains) {
  var p = window._SS_EQ_PRESETS;
  if (!Array.isArray(gains) || !p) return 'Custom';
  for (var _n in p) {
    var _pg = p[_n];
    if (_n === 'Custom' || !_pg) continue;
    var _m = true;
    for (var _i = 0; _i < 10; _i++) {
      if (Number(gains[_i]) !== Number(_pg[_i])) { _m = false; break; }
    }
    if (_m) return _n;
  }
  return 'Custom';
}


class HeaderButton {
  constructor() {
    this.isActive = false;
    this.containerElement = null;
    this.isShieldEnabled = true;
    this.retryInterval = null;
    this.sessionTimerInterval = null;
    this.sessionTimeSeconds = 0;
    this.outsideClickTimer = null;
    this._activeSpectrumVisualizer = null;
    this._watchdogInterval = null;
    this.boundNavigate = this.onNavigate.bind(this);
    this.boundOutsideClick = this.onOutsideClick.bind(this);
    this.boundKeydown = (e) => { if (e && e.key === 'Escape') this.closePopup(); };
    this.boundDOMReady = () => { if (this.isActive) this.tryInject(); };
    this.boundStorageChange = () => this.updateState();
  }

  enable() {
    if (this.isActive) return;
    this.isActive = true;

    this.tryInject();
    this.startRetryLoop();
    this.observeHeader();
    this.startSelfHealingWatchdog();

    window.addEventListener('yt-navigate-finish', this.boundNavigate);
    window.addEventListener('yt-page-data-updated', this.boundNavigate);
    window.addEventListener('yt-navigate-start', this.boundNavigate);
    window.addEventListener('DOMContentLoaded', this.boundDOMReady);
    window.addEventListener('load', this.boundDOMReady);
    window.addEventListener('pageshow', this.boundDOMReady);

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      try {
        chrome.storage.onChanged.addListener(this.boundStorageChange);
      } catch(e) {}
    }

    console.log("HeaderButton enabled");
  }

  disable() {
    if (!this.isActive) return;
    this.isActive = false;

    this.closePopup();
    this.stopRetryLoop();
    this.stopSelfHealingWatchdog();
    this.stopSessionTimer();
    if (this.outsideClickTimer) {
      clearTimeout(this.outsideClickTimer);
      this.outsideClickTimer = null;
    }
    this.removeButton();
    if (window.ObserverUtils) {
      window.ObserverUtils.disconnect('header-button');
    }

    window.removeEventListener('yt-navigate-finish', this.boundNavigate);
    window.removeEventListener('yt-page-data-updated', this.boundNavigate);
    window.removeEventListener('yt-navigate-start', this.boundNavigate);
    window.removeEventListener('DOMContentLoaded', this.boundDOMReady);
    window.removeEventListener('load', this.boundDOMReady);
    window.removeEventListener('pageshow', this.boundDOMReady);

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged && this.boundStorageChange) {
      try {
        chrome.storage.onChanged.removeListener(this.boundStorageChange);
      } catch(e) {}
    }

    document.removeEventListener('pointerdown', this.boundOutsideClick);
    console.log("HeaderButton disabled");
  }

  onNavigate() {
    if (this.isActive) {
      this.tryInject();
      this.updateBlockButtonVisibility();
      setTimeout(() => { this.tryInject(); this.updateBlockButtonVisibility(); }, 200);
      setTimeout(() => { this.tryInject(); this.updateBlockButtonVisibility(); }, 600);
      setTimeout(() => { this.tryInject(); this.updateBlockButtonVisibility(); }, 1200);
    }
  }

  observeHeader() {
    if (!window.ObserverUtils) return;

    window.ObserverUtils.observe(
      '#end #buttons, ytd-masthead #buttons, div#buttons, ytd-masthead, #masthead, #end, ytd-app',
      () => {
        if (this.isActive) {
          const existing = document.getElementById('ss-header-btn-container');
          if (!existing || !document.contains(existing)) {
            this.tryInject();
          }
        }
      },
      'header-button'
    );
  }

  startSelfHealingWatchdog() {
    this.stopSelfHealingWatchdog();
    this._watchdogInterval = setInterval(() => {
      if (this.isActive) {
        const existing = document.getElementById('ss-header-btn-container');
        if (!existing || !document.contains(existing)) {
          this.tryInject();
        }
      }
    }, 1500);
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
      const injected = this.tryInject();
      if (injected || attempts > 20) {
        this.stopRetryLoop();
      }
    }, 500);
  }

  stopRetryLoop() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  tryInject() {
    const existing = document.getElementById('ss-header-btn-container');
    if (existing && document.contains(existing)) {
      this.containerElement = existing;
      return true;
    }

    let buttonsContainer = document.querySelector(
      'ytd-masthead #end #buttons, #end #buttons, #masthead #buttons, ytd-masthead #buttons, div#buttons, #end.ytd-masthead #buttons, ytd-masthead div#buttons'
    );

    if (!buttonsContainer) {
      const anchorEl = document.querySelector(
        '#upload-button, button[aria-label*="Create" i], a[aria-label*="Create" i], ytd-notification-topbar-button-renderer, ytd-topbar-menu-button-renderer, #avatar-btn, ytd-masthead #end, #masthead #end'
      );
      if (anchorEl) {
        buttonsContainer = (anchorEl.id === 'end' || anchorEl.tagName === 'YTD-MASTHEAD') ? anchorEl : anchorEl.parentNode;
      }
    }

    if (!buttonsContainer) return false;

    const container = document.createElement('div');
    container.className = 'ss-header-btn-container';
    container.id = 'ss-header-btn-container';

    container.innerHTML = `
      <button class="ss-header-btn" id="ss-header-btn" title="YouTube Shield Menu" aria-label="YouTube Shield Menu" aria-haspopup="dialog" aria-expanded="false">
        <span class="ss-header-btn-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-5.45 9-12V5l-9-4zm0 2.18l7 3.12v5.7c0 4.37-2.98 8.47-7 9.77-4.02-1.3-7-5.4-7-9.77V6.3l7-3.12z"/>
            <path d="M10.5 13.5L8.5 11.5L7.09 12.91L10.5 16.32L17.5 9.32L16.09 7.91L10.5 13.5Z"/>
          </svg>
        </span>
        <span class="ss-header-btn-text">Shield</span>
        <span class="ss-header-btn-status" id="ss-header-btn-status"></span>
      </button>
      <button class="ss-header-block-btn ss-quick-block-pill yt-spec-button-shape-next" id="ss-quick-block-btn" title="Quick Block Channel & Keywords" aria-label="Quick Block Channel or Keywords" aria-haspopup="dialog">
        <span class="ss-btn-icon">🚫</span>
        <span class="ss-btn-text">Block</span>
      </button>
      <div class="ss-header-btn-tooltip" id="ss-header-btn-tooltip">YouTube Shield: Active</div>
    `;

    const createBtn = buttonsContainer.querySelector(
      '#upload-button, button[aria-label*="Create"], a[aria-label*="Create"]'
    );

    if (createBtn && createBtn.parentNode === buttonsContainer) {
      buttonsContainer.insertBefore(container, createBtn);
    } else if (buttonsContainer.firstElementChild) {
      buttonsContainer.insertBefore(container, buttonsContainer.firstElementChild);
    } else {
      buttonsContainer.appendChild(container);
    }

    this.containerElement = container;

    // Clean up any orphan/stray #ss-quick-block-btn in document.body outside this container
    document.querySelectorAll('#ss-quick-block-btn').forEach(b => {
      if (!container.contains(b)) {
        try { b.remove(); } catch(e) {}
      }
    });

    const button = container.querySelector('#ss-header-btn');
    if (button) {
      const handleToggle = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.togglePopup();
      };
      button.addEventListener('click', handleToggle);
      button.addEventListener('pointerdown', (e) => e.stopPropagation());
      button.addEventListener('pointerup', (e) => e.stopPropagation());
      button.addEventListener('mousedown', (e) => e.stopPropagation());
      button.addEventListener('mouseup', (e) => e.stopPropagation());
    }

    const blockBtn = container.querySelector('#ss-quick-block-btn');
    if (blockBtn) {
      const handleBlockClick = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (typeof window !== 'undefined') {
          if (window.quickBlockInstance && typeof window.quickBlockInstance.toggleMenu === 'function') {
            window.quickBlockInstance.toggleMenu();
          } else if (window.QuickBlock && typeof window.QuickBlock.toggleMenu === 'function') {
            window.QuickBlock.toggleMenu();
          }
        }
      };
      blockBtn.addEventListener('click', handleBlockClick);
      blockBtn.addEventListener('pointerdown', (e) => e && e.stopPropagation());
      blockBtn.addEventListener('pointerup', (e) => e && e.stopPropagation());
      blockBtn.addEventListener('mousedown', (e) => e && e.stopPropagation());
      blockBtn.addEventListener('mouseup', (e) => e && e.stopPropagation());
    }

    this.updateBlockButtonVisibility();
    this.updateState();
    return true;
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
    if (typeof document !== 'undefined') {
      const isWatchMetadata = document.querySelector('ytd-watch-flexy, ytd-watch-metadata, #movie_player');
      if (isWatchMetadata && !document.querySelector('ytd-browse[page-subtype="home"]')) {
        return true;
      }
    }
    return false;
  }

  updateBlockButtonVisibility() {
    const container = this.containerElement || document.getElementById('ss-header-btn-container');
    const blockBtn = container ? container.querySelector('#ss-quick-block-btn') : document.getElementById('ss-quick-block-btn');
    const onWatch = this.isWatchPage();

    if (container) {
      if (onWatch) {
        container.classList.add('ss-show-block-btn');
      } else {
        container.classList.remove('ss-show-block-btn');
      }
    }

    if (blockBtn) {
      if (onWatch) {
        blockBtn.classList.add('ss-visible');
        blockBtn.style.setProperty('display', 'inline-flex', 'important');
      } else {
        blockBtn.classList.remove('ss-visible');
        blockBtn.style.setProperty('display', 'none', 'important');
      }
    }
  }

  removeButton() {
    if (this.containerElement && this.containerElement.parentNode) {
      this.containerElement.parentNode.removeChild(this.containerElement);
    }
    this.containerElement = null;
  }

  async updateState() {
    if (typeof StorageUtil === 'undefined') return;
    try {
      const settings = await StorageUtil.getSettings();

      const isAnyFeatureActive = !!(
        settings.shortsBlocker ||
        settings.focusMode ||
        settings.studyMode ||
        settings.goalMode ||
        (settings.timeManager && settings.timeManager.enabled) ||
        settings.autoSkipAds
      );

      this.isShieldEnabled = (settings.extensionEnabled !== false) && isAnyFeatureActive;

      const btnElement = document.getElementById('ss-header-btn');
      const tooltipElement = document.getElementById('ss-header-btn-tooltip');

      if (btnElement) {
        if (this.isShieldEnabled) {
          btnElement.classList.remove('ss-disabled');
        } else {
          btnElement.classList.add('ss-disabled');
        }
      }

      if (tooltipElement) {
        tooltipElement.textContent = this.isShieldEnabled
          ? "YouTube Shield: Active (Click for Menu)"
          : "YouTube Shield: Paused (Click for Menu)";
      }

      // Sync active popup controls if open in DOM
      const dialog = document.getElementById('ss-popup-dialog');
      if (dialog) {
        const isEnabled = settings.extensionEnabled !== false;
        const statusBadge = dialog.querySelector('#ss-header-status-badge');
        if (statusBadge) {
          statusBadge.textContent = isEnabled ? 'ACTIVE' : 'PAUSED';
          statusBadge.className = `ss-status-badge ${isEnabled ? 'ss-status-active' : 'ss-status-paused'}`;
        }

        const masterToggle = dialog.querySelector('#ss-toggle-master');
        if (masterToggle && settings.extensionEnabled !== undefined) {
          masterToggle.checked = isEnabled;
        }

        const shortsToggle = dialog.querySelector('#ss-toggle-shorts');
        if (shortsToggle && settings.shortsBlocker !== undefined) shortsToggle.checked = !!settings.shortsBlocker;
        const focusToggle = dialog.querySelector('#ss-toggle-focus');
        if (focusToggle && settings.focusMode !== undefined) focusToggle.checked = !!settings.focusMode;
        const studyToggle = dialog.querySelector('#ss-toggle-study');
        if (studyToggle && settings.studyMode !== undefined) studyToggle.checked = !!settings.studyMode;
        const goalToggle = dialog.querySelector('#ss-toggle-goal');
        if (goalToggle && settings.goalMode !== undefined) goalToggle.checked = !!settings.goalMode;
        const tmToggle = dialog.querySelector('#ss-toggle-time-manager');
        if (tmToggle && settings.timeManager) tmToggle.checked = !!settings.timeManager.enabled;
        const autoSkipAdsToggle = dialog.querySelector('#ss-toggle-auto-skip-ads');
        if (autoSkipAdsToggle && settings.autoSkipAds !== undefined) autoSkipAdsToggle.checked = !!settings.autoSkipAds;

        const goalText = dialog.querySelector('#ss-popup-goal');
        if (goalText && settings.learningGoal !== undefined) {
          goalText.textContent = settings.learningGoal || 'General Study';
        }

        const vb = settings.volumeBooster || {};
        const volSlider = dialog.querySelector('#ss-vol-slider');
        const volValue = dialog.querySelector('#ss-vol-value');
        const bassSlider = dialog.querySelector('#ss-bass-slider');
        const bassValue = dialog.querySelector('#ss-bass-value');
        if (volSlider && vb.volumeLevel != null) {
          volSlider.value = vb.volumeLevel;
          if (volValue) volValue.textContent = vb.volumeLevel + '%';
        }
        if (bassSlider && vb.bassLevel != null) {
          bassSlider.value = vb.bassLevel;
          if (bassValue) bassValue.textContent = vb.bassLevel + ' dB';
        }

        const eqToggle = dialog.querySelector('#ss-eq-toggle');
        const eqPreset = dialog.querySelector('#ss-eq-preset');
        const eqRack = dialog.querySelector('#ss-eq-rack');
        const isEqOn = vb.eqEnabled !== false;
        if (eqToggle) eqToggle.checked = isEqOn;
        if (eqRack) eqRack.classList.toggle('ss-eq-disabled', !isEqOn);
        if (eqPreset && vb.preset) eqPreset.value = vb.preset;

        const eqGains = Array.isArray(vb.eqGains) ? vb.eqGains : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < 10; i++) {
          const slider = dialog.querySelector(`#ss-eq-slider-${i}`);
          const valSpan = dialog.querySelector(`#ss-eq-val-${i}`);
          const g = eqGains[i] !== undefined ? eqGains[i] : 0;
          if (slider) slider.value = g;
          if (valSpan) {
            const num = Number(g);
            valSpan.textContent = (num > 0 ? '+' : '') + num + 'dB';
          }
        }
      }
    } catch(e) {}
  }

  async togglePopup() {
    const dialog = document.getElementById('ss-popup-dialog');
    if (dialog) {
      this.closePopup();
    } else {
      await this.openPopup();
    }
  }

  async openPopup() {
    const container = this.containerElement || document.getElementById('ss-header-btn-container');
    if (!container) return;
    this.containerElement = container;
    this._openTime = Date.now();

    this.closePopup(); // Ensure clean slate

    let settings = {};
    let tracking = {};
    try {
      if (typeof StorageUtil !== 'undefined' && typeof StorageUtil.getSettings === 'function') {
        settings = (await StorageUtil.getSettings()) || {};
      }
    } catch(e) {}
    try {
      if (typeof StorageUtil !== 'undefined' && typeof StorageUtil.getTracking === 'function') {
        tracking = (await StorageUtil.getTracking()) || {};
      }
    } catch(e) {}

    // Fallbacks if storage returned empty
    if (!settings || typeof settings !== 'object') {
      settings = (typeof DEFAULT_SETTINGS !== 'undefined' ? DEFAULT_SETTINGS : { extensionEnabled: true });
    }
    if (!tracking || typeof tracking !== 'object') {
      tracking = (typeof DEFAULT_TRACKING !== 'undefined' ? DEFAULT_TRACKING : {});
    }

    try {
      const vb = settings.volumeBooster || {};
      const eqGains = Array.isArray(vb.eqGains) ? vb.eqGains : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const isEqEnabled = vb.eqEnabled !== false;
      const isNoiseRemoverEnabled = vb.noiseRemover !== false;
      const currentPreset = vb.preset || 'Flat';

      const bandFrequencies = [
        { freq: '32', label: '32' },
        { freq: '64', label: '64' },
        { freq: '125', label: '125' },
        { freq: '250', label: '250' },
        { freq: '500', label: '500' },
        { freq: '1000', label: '1k' },
        { freq: '2000', label: '2k' },
        { freq: '4000', label: '4k' },
        { freq: '8000', label: '8k' },
        { freq: '16000', label: '16k' }
      ];

      const supportsAudioDSP = (typeof window !== 'undefined' && window.BrowserDetection) 
        ? window.BrowserDetection.supportsAudioDSP 
        : (typeof BrowserDetection !== 'undefined' ? BrowserDetection.supportsAudioDSP : true);

      const dialog = document.createElement('div');
      dialog.className = 'ss-popup-dialog';
      dialog.id = 'ss-popup-dialog';

      dialog.innerHTML = `
        <!-- Single Integrated HUD Header: logo + timer status badge + master toggle + minimize + settings -->
        <div class="ss-popup-header" id="ss-popup-header">
          <div class="ss-popup-header-brand">
            <div class="ss-popup-logo">
              <span class="ss-logo-icon">🛡️</span>
              <span class="ss-logo-text">YouTube Shield</span>
            </div>
            <span class="ss-status-badge ${settings.extensionEnabled !== false ? 'ss-status-active' : 'ss-status-paused'}" id="ss-header-status-badge">
              ${settings.extensionEnabled !== false ? 'ACTIVE' : 'PAUSED'}
            </span>
          </div>
          <div class="ss-popup-header-right">
            <label class="ss-master-toggle-wrap" for="ss-toggle-master" title="Master Power: Enable / Disable YouTube Shield">
              <input type="checkbox" id="ss-toggle-master" role="switch" aria-label="Master Power" aria-checked="${settings.extensionEnabled !== false ? 'true' : 'false'}" ${settings.extensionEnabled !== false ? 'checked' : ''} />
              <span class="ss-master-slider"></span>
            </label>
            <button class="ss-minimize-btn" id="ss-minimize-btn" title="Minimize panel" aria-label="Minimize">－</button>
            <div class="ss-popup-settings-icon" id="ss-popup-settings" title="Open Options Dashboard" tabindex="0" role="button" aria-label="Settings">⚙️</div>
          </div>
        </div>

        <!-- Sleek Floating Minimized Pill View (hidden by default) -->
        <div class="ss-minimized-bar" id="ss-minimized-bar" style="display:none;">
          <span class="ss-mini-pulse"></span>
          <span class="ss-popup-logo" style="font-size:12px; font-weight:700; display:flex; align-items:center; gap:4px;">
            <span>🛡️</span><span>YouTube Shield</span>
          </span>
          <span id="ss-mini-timer" class="ss-mini-timer">00:00:00</span>
          <button class="ss-minimize-btn ss-restore-btn" id="ss-restore-btn" title="Restore panel" aria-label="Restore">＋</button>
        </div>

        <!-- Main scrollable body -->
        <div class="ss-hud-body" id="ss-hud-body">

          <!-- Streamlined Goal & Timer Hero Card: Subtle inline-editable goal chip + Centered Session Timer -->
          <div class="ss-popup-study-card">
            <div class="ss-popup-study-header">
              <div class="ss-goal-chip" id="ss-popup-goal-chip" title="Click to edit study goal" tabindex="0" role="button" aria-label="Edit study goal">
                <span class="ss-popup-edit-goal" id="ss-popup-edit-goal" title="Edit Goal">✏️</span>
                <span class="ss-goal-label">Goal:</span>
                <span class="ss-goal-text" id="ss-popup-goal">${this.escapeHtml(settings.learningGoal || 'General Study')}</span>
              </div>
            </div>
            <div class="ss-popup-session-time" id="ss-popup-session-time">00:00:00</div>
            <div class="ss-popup-session-label">Session Time</div>

            <div class="ss-popup-goal-input-container" id="ss-popup-goal-container" style="display: none;">
              <input type="text" id="ss-popup-goal-input" placeholder="Enter learning goal..." aria-label="Learning goal text" value="${this.escapeHtml(settings.learningGoal || '')}" />
              <div class="ss-popup-goal-actions">
                <button id="ss-popup-save-goal" class="ss-btn-save-goal" type="button">Save</button>
                <button id="ss-popup-search-goal" class="ss-btn-search-goal" type="button">🔍 Search</button>
              </div>
            </div>
          </div>

          <!-- Quick toggles: Shorts Blocker + Focus Mode + Ghost Shield (Strict Purge) -->
          <div class="ss-popup-toggles ss-quick-toggles">
            <label class="ss-popup-toggle-row" for="ss-toggle-shorts">
              <div class="ss-toggle-info">
                <span class="ss-toggle-icon">🚫</span>
                <span class="ss-popup-toggle-label">Shorts Blocker</span>
              </div>
              <div class="ss-toggle-switch">
                <input type="checkbox" id="ss-toggle-shorts" role="switch" aria-label="Shorts Blocker" aria-checked="${settings.shortsBlocker ? 'true' : 'false'}" ${settings.shortsBlocker ? 'checked' : ''} />
                <span class="ss-slider"></span>
              </div>
            </label>
            <label class="ss-popup-toggle-row" for="ss-toggle-focus">
              <div class="ss-toggle-info">
                <span class="ss-toggle-icon">🎯</span>
                <span class="ss-popup-toggle-label">Focus Mode</span>
              </div>
              <div class="ss-toggle-switch">
                <input type="checkbox" id="ss-toggle-focus" role="switch" aria-label="Focus Mode" aria-checked="${settings.focusMode ? 'true' : 'false'}" ${settings.focusMode ? 'checked' : ''} />
                <span class="ss-slider"></span>
              </div>
            </label>
            <label class="ss-popup-toggle-row" for="ss-toggle-ghost-shield">
              <div class="ss-toggle-info">
                <span class="ss-toggle-icon">👻</span>
                <div style="display:flex; flex-direction:column; line-height:1.2;">
                  <span class="ss-popup-toggle-label">Ghost Shield</span>
                  <span style="font-size:10px; color:#94a3b8; font-weight:400; margin-top:2px;">Strict purge &amp; denies playback</span>
                </div>
              </div>
              <div class="ss-toggle-switch">
                <input type="checkbox" id="ss-toggle-ghost-shield" role="switch" aria-label="Ghost Shield" aria-checked="${settings.ghostShield !== false ? 'true' : 'false'}" ${settings.ghostShield !== false ? 'checked' : ''} />
                <span class="ss-slider"></span>
              </div>
            </label>
          </div>

          <!-- ── Collapsible Section 0: Time Manager ── -->
          <div class="ss-section" id="ss-sect-wrapper-timemanager">
            <button class="ss-section-header ss-collapsed" id="ss-header-timemanager" aria-expanded="false" aria-controls="ss-section-timemanager">
              <div class="ss-section-title">
                <span class="ss-section-icon">⏱️</span>
                <span>Time Manager</span>
              </div>
              <div class="ss-section-header-right">
                <span class="ss-section-pill">${settings.timeManager && settings.timeManager.enabled ? 'Active' : 'Limits &amp; Schedule'}</span>
                <span class="ss-open-settings-btn" id="ss-open-timemanager" role="button" tabindex="0" title="Open Time Manager in Settings">↗</span>
                <span class="ss-chevron">▾</span>
              </div>
            </button>
            <div class="ss-section-body" id="ss-section-timemanager" style="display:none;">
              <div class="ss-popup-toggles ss-section-inner-toggles">
                <label class="ss-popup-toggle-row" for="ss-toggle-time-manager">
                  <div class="ss-toggle-info">
                    <span class="ss-toggle-icon">🛡️</span>
                    <span class="ss-popup-toggle-label">Enable Time Limits</span>
                  </div>
                  <div class="ss-toggle-switch">
                    <input type="checkbox" id="ss-toggle-time-manager" role="switch" aria-label="Enable Time Limits" aria-checked="${settings.timeManager && settings.timeManager.enabled ? 'true' : 'false'}" ${settings.timeManager && settings.timeManager.enabled ? 'checked' : ''} />
                    <span class="ss-slider"></span>
                  </div>
                </label>
                <div class="ss-tm-quick-info" style="padding: 6px 4px 2px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;">
                  <span>Daily Limit: <strong style="color: #60a5fa;">${(settings.timeManager && settings.timeManager.dailyLimitMinutes) || 60}m</strong></span>
                  <span>Schedule: <strong style="color: ${(settings.timeManager && settings.timeManager.scheduleEnabled) ? '#10b981' : '#64748b'};">${(settings.timeManager && settings.timeManager.scheduleEnabled) ? 'Active' : 'Off'}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Collapsible Section 1: Focus Features ── -->
          <div class="ss-section" id="ss-sect-wrapper-focus">
            <button class="ss-section-header ss-collapsed" id="ss-header-focus" aria-expanded="false" aria-controls="ss-section-focus">
              <div class="ss-section-title">
                <span class="ss-section-icon">🧠</span>
                <span>Focus Features</span>
              </div>
              <div class="ss-section-header-right">
                <span class="ss-section-pill">4 Controls</span>
                <span class="ss-open-settings-btn" id="ss-open-focus" role="button" tabindex="0" title="Open Focus settings">↗</span>
                <span class="ss-chevron">▾</span>
              </div>
            </button>
            <div class="ss-section-body" id="ss-section-focus" style="display:none;">
              <div class="ss-popup-toggles ss-section-inner-toggles">
                <label class="ss-popup-toggle-row" for="ss-toggle-study">
                  <div class="ss-toggle-info">
                    <span class="ss-toggle-info-text">
                      <span class="ss-toggle-icon">📚</span>
                      <span class="ss-popup-toggle-label">Study Mode</span>
                    </span>
                  </div>
                  <div class="ss-toggle-switch">
                    <input type="checkbox" id="ss-toggle-study" role="switch" aria-label="Study Mode" aria-checked="${settings.studyMode ? 'true' : 'false'}" ${settings.studyMode ? 'checked' : ''} />
                    <span class="ss-slider"></span>
                  </div>
                </label>
                <label class="ss-popup-toggle-row" for="ss-toggle-goal">
                  <div class="ss-toggle-info">
                    <span class="ss-toggle-info-text">
                      <span class="ss-toggle-icon">🏹</span>
                      <span class="ss-popup-toggle-label">Goal Mode (Strict)</span>
                    </span>
                  </div>
                  <div class="ss-toggle-switch">
                    <input type="checkbox" id="ss-toggle-goal" role="switch" aria-label="Strict Goal Enforcement" aria-checked="${settings.goalMode ? 'true' : 'false'}" ${settings.goalMode ? 'checked' : ''} />
                    <span class="ss-slider"></span>
                  </div>
                </label>
                <label class="ss-popup-toggle-row" for="ss-toggle-time-manager">
                  <div class="ss-toggle-info">
                    <span class="ss-toggle-info-text">
                      <span class="ss-toggle-icon">⏱️</span>
                      <span class="ss-popup-toggle-label">Time Manager</span>
                    </span>
                  </div>
                  <div class="ss-toggle-switch">
                    <input type="checkbox" id="ss-toggle-time-manager" role="switch" aria-label="Time Manager" aria-checked="${settings.timeManager && settings.timeManager.enabled ? 'true' : 'false'}" ${settings.timeManager && settings.timeManager.enabled ? 'checked' : ''} />
                    <span class="ss-slider"></span>
                  </div>
                </label>
                <label class="ss-popup-toggle-row" for="ss-toggle-auto-skip-ads">
                  <div class="ss-toggle-info">
                    <span class="ss-toggle-info-text">
                      <span class="ss-toggle-icon">⏭️</span>
                      <span class="ss-popup-toggle-label">Auto Skip Ads</span>
                    </span>
                  </div>
                  <div class="ss-toggle-switch">
                    <input type="checkbox" id="ss-toggle-auto-skip-ads" role="switch" aria-label="Auto Skip Ads" aria-checked="${settings.autoSkipAds ? 'true' : 'false'}" ${settings.autoSkipAds ? 'checked' : ''} />
                    <span class="ss-slider"></span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- ── Collapsible Section 2: Today's Stats ── -->
          <div class="ss-section" id="ss-sect-wrapper-stats">
            <button class="ss-section-header ss-collapsed" id="ss-header-stats" aria-expanded="false" aria-controls="ss-section-stats">
              <div class="ss-section-title">
                <span class="ss-section-icon">📊</span>
                <span>Today's Stats</span>
              </div>
              <div class="ss-section-header-right">
                <span class="ss-section-pill">Live Metrics</span>
                <span class="ss-open-settings-btn" id="ss-open-analytics" role="button" tabindex="0" title="Open Analytics">↗</span>
                <span class="ss-chevron">▾</span>
              </div>
            </button>
            <div class="ss-section-body" id="ss-section-stats" style="display:none;">
              <div class="ss-popup-stats">
                <div class="ss-stat-row">
                  <span class="ss-stat-label">Player Rank:</span>
                  <span id="ss-popup-rank-tier" class="ss-stat-value">🥉 Bronze Focus (0 AP)</span>
                </div>
                <div class="ss-stat-row">
                  <span class="ss-stat-label">Today's Total Time:</span>
                  <span id="ss-popup-today-time" class="ss-stat-value">0h 0m</span>
                </div>
                <div class="ss-stat-row">
                  <span class="ss-stat-label">Learning Time:</span>
                  <span id="ss-popup-learning-time" class="ss-stat-value">0h 0m</span>
                </div>
                <div class="ss-stat-row ss-focus-score-row">
                  <span class="ss-stat-label">Focus Score:</span>
                  <span id="ss-popup-focus-score" class="ss-stat-value ss-stat-score">0%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Collapsible Section 3: Audio Controls ── -->
          <div class="ss-section" id="ss-sect-wrapper-audio">
            <button class="ss-section-header ss-collapsed" id="ss-header-audio" aria-expanded="false" aria-controls="ss-section-audio">
              <div class="ss-section-title">
                <span class="ss-section-icon">🎛️</span>
                <span>Audio Controls</span>
              </div>
              <div class="ss-section-header-right">
                <span class="ss-section-pill">Booster &amp; EQ</span>
                <span class="ss-open-settings-btn" id="ss-open-audio" role="button" tabindex="0" title="Open Audio settings">↗</span>
                <span class="ss-chevron">▾</span>
              </div>
            </button>
            <div class="ss-section-body" id="ss-section-audio" style="display:none;">
              <div class="ss-popup-audio-enhancements">
                ${!supportsAudioDSP ? `
                <div class="ss-safari-audio-notice" style="margin-bottom: 12px; padding: 10px 12px; background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.35); border-radius: 8px; color: #fde047; font-size: 11px; line-height: 1.45; display: flex; align-items: flex-start; gap: 8px;">
                  <span style="font-size: 14px; flex-shrink: 0;">⚠️</span>
                  <div>
                    <strong style="color: #fef08a;">Audio enhancement isn't supported in Safari.</strong>
                    <div style="color: #cbd5e1; margin-top: 2px; font-size: 10.5px;">Please use Chrome, Brave, Edge, or Firefox to use Volume Booster, Bass Booster, and Equalizer.</div>
                  </div>
                </div>
                ` : ''}

                <!-- Live Mini Spectrum Analyzer Canvas -->
                <div class="ss-popup-spectrum-container" style="margin-bottom: 12px; background: rgba(3, 7, 18, 0.7); border-radius: 8px; padding: 6px 8px; border: 1px solid rgba(255,255,255,0.08);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 9px; color: #64748b; font-weight: 700; letter-spacing: 0.4px;">
                    <span>REAL-TIME SPECTRUM</span>
                    <span id="ss-popup-peak-db" style="color: ${supportsAudioDSP ? '#38bdf8' : '#64748b'}; font-family: monospace;">${supportsAudioDSP ? '-inf dB' : 'Unavailable in Safari'}</span>
                  </div>
                  <canvas id="ss-popup-spectrum-canvas" width="280" height="42" style="width: 100%; height: 42px; display: block; border-radius: 4px; ${!supportsAudioDSP ? 'opacity: 0.4;' : ''}"></canvas>
                </div>

                <!-- Real-Time Thermal & High Amplification Alert -->
                <div id="ss-audio-thermal-alert" class="ss-audio-thermal-alert" style="display: ${(vb.volumeLevel > 250 || vb.bassLevel > 12) ? 'block' : 'none'}; margin-bottom: 10px; padding: 8px 10px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; color: #fbbf24; font-size: 10.5px; line-height: 1.4;">
                  <div style="display: flex; align-items: flex-start; gap: 6px;">
                    <span style="font-size: 13px;">🔥</span>
                    <div>
                      <strong style="color: #fde047;">High Amplification Alert</strong>
                      <div style="color: #e2e8f0; font-size: 10px; margin-top: 1px;">High volume / bass heats laptop speakers &amp; causes clipping. Recommended: 150%–250% or headphones. Noise Clarifier active.</div>
                    </div>
                  </div>
                </div>

                <div class="ss-slider-group" style="margin-bottom: 12px; ${!supportsAudioDSP ? 'opacity: 0.6;' : ''}">
                  <div class="ss-slider-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span class="ss-slider-label" style="font-size: 12px; color: #cbd5e1; font-weight: 500;">
                      🔊 Volume Boost
                      ${!supportsAudioDSP ? '<span style="font-size: 9.5px; color: #fbbf24; background: rgba(245, 158, 11, 0.15); padding: 1px 5px; border-radius: 4px; margin-left: 6px; font-weight: 600;">⚠ Not supported in Safari</span>' : ''}
                    </span>
                    <span id="ss-vol-value" class="ss-slider-val" style="font-size: 11px; color: ${supportsAudioDSP ? '#60a5fa' : '#94a3b8'}; font-weight: 700; min-width: 38px; text-align: right;">${vb.volumeLevel || 100}%</span>
                  </div>
                  <input type="range" id="ss-vol-slider" min="100" max="600" step="10" value="${vb.volumeLevel || 100}" class="ss-horizontal-slider" aria-label="Volume Boost" aria-valuetext="${vb.volumeLevel || 100}%" ${!supportsAudioDSP ? 'disabled style="cursor: not-allowed;"' : ''} />
                </div>
                <div class="ss-slider-group" style="margin-bottom: 12px; ${!supportsAudioDSP ? 'opacity: 0.6;' : ''}">
                  <div class="ss-slider-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span class="ss-slider-label" style="font-size: 12px; color: #cbd5e1; font-weight: 500;">
                      🎵 Bass Boost
                      ${!supportsAudioDSP ? '<span style="font-size: 9.5px; color: #fbbf24; background: rgba(245, 158, 11, 0.15); padding: 1px 5px; border-radius: 4px; margin-left: 6px; font-weight: 600;">⚠ Not supported in Safari</span>' : ''}
                    </span>
                    <span id="ss-bass-value" class="ss-slider-val" style="font-size: 11px; color: ${supportsAudioDSP ? '#a855f7' : '#94a3b8'}; font-weight: 700; min-width: 38px; text-align: right;">${vb.bassLevel || 0} dB</span>
                  </div>
                  <input type="range" id="ss-bass-slider" min="0" max="20" step="1" value="${vb.bassLevel || 0}" class="ss-horizontal-slider ss-bass-slider-track" aria-label="Bass Boost" aria-valuetext="${vb.bassLevel || 0} dB" ${!supportsAudioDSP ? 'disabled style="cursor: not-allowed;"' : ''} />
                </div>

                <!-- Noise Remover & Anti-Distortion Clarifier Toggle Row -->
                <div class="ss-noise-remover-row" style="margin-bottom: 12px; padding: 8px 10px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; ${!supportsAudioDSP ? 'opacity: 0.6;' : ''}">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 14px;">🛡️</span>
                    <div>
                      <div style="font-size: 11.5px; font-weight: 600; color: #f1f5f9;">Noise Remover &amp; Clarifier</div>
                      <div style="font-size: 9.5px; color: #94a3b8;">Subsonic filter, anti-hiss &amp; soft limiter</div>
                    </div>
                  </div>
                  <label class="ss-toggle-switch" style="width: 38px; height: 20px;" for="ss-noise-remover-toggle">
                    <input type="checkbox" id="ss-noise-remover-toggle" role="switch" aria-label="Noise Remover Toggle" aria-checked="${isNoiseRemoverEnabled ? 'true' : 'false'}" ${isNoiseRemoverEnabled ? 'checked' : ''} ${!supportsAudioDSP ? 'disabled' : ''} />
                    <span class="ss-slider" style="border-radius: 20px; ${!supportsAudioDSP ? 'cursor: not-allowed;' : ''}"></span>
                  </label>
                </div>
                <!-- 10-Band EQ -->
                <div class="ss-eq-section" id="ss-eq-section" style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); ${!supportsAudioDSP ? 'opacity: 0.6;' : ''}">
                  <div class="ss-eq-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 12px; font-weight: 600; color: #f1f5f9; display: flex; align-items: center; gap: 6px;">
                      <span>🎚️</span> 10-Band Graphic EQ
                      ${!supportsAudioDSP ? '<span style="font-size: 9.5px; color: #fbbf24; background: rgba(245, 158, 11, 0.15); padding: 1px 5px; border-radius: 4px; margin-left: 6px; font-weight: 600;">⚠ Not supported in Safari</span>' : ''}
                    </span>
                    <label class="ss-toggle-switch" style="width: 38px; height: 20px;" for="ss-eq-toggle">
                      <input type="checkbox" id="ss-eq-toggle" role="switch" aria-label="Equalizer Toggle" aria-checked="${isEqEnabled ? 'true' : 'false'}" ${isEqEnabled ? 'checked' : ''} ${!supportsAudioDSP ? 'disabled' : ''} />
                      <span class="ss-slider" style="border-radius: 20px; ${!supportsAudioDSP ? 'cursor: not-allowed;' : ''}"></span>
                    </label>
                  </div>
                  <div class="ss-eq-controls" style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px;">
                    <select id="ss-eq-preset" class="ss-eq-select" aria-label="Equalizer Preset" ${!supportsAudioDSP ? 'disabled style="cursor: not-allowed;"' : ''}>
                      <option value="Flat" ${currentPreset === 'Flat' ? 'selected' : ''}>Flat</option>
                      <option value="Bass Boost" ${currentPreset === 'Bass Boost' ? 'selected' : ''}>Bass Boost</option>
                      <option value="Vocal Booster" ${currentPreset === 'Vocal Booster' ? 'selected' : ''}>Vocal Booster</option>
                      <option value="Treble Boost" ${currentPreset === 'Treble Boost' ? 'selected' : ''}>Treble Boost</option>
                      <option value="Rock" ${currentPreset === 'Rock' ? 'selected' : ''}>Rock</option>
                      <option value="Pop" ${currentPreset === 'Pop' ? 'selected' : ''}>Pop</option>
                      <option value="Acoustic" ${currentPreset === 'Acoustic' ? 'selected' : ''}>Acoustic</option>
                      <option value="Electronic" ${currentPreset === 'Electronic' ? 'selected' : ''}>Electronic</option>
                      <option value="Custom" ${currentPreset === 'Custom' ? 'selected' : ''}>Custom</option>
                    </select>
                    <button id="ss-eq-reset" class="ss-eq-btn" type="button" ${!supportsAudioDSP ? 'disabled style="cursor: not-allowed; opacity: 0.5;"' : ''}>Reset</button>
                  </div>
                  <div class="ss-eq-rack ${!isEqEnabled || !supportsAudioDSP ? 'ss-eq-disabled' : ''}" id="ss-eq-rack">
                    ${bandFrequencies.map((band, i) => {
                      const g = eqGains[i] !== undefined ? eqGains[i] : 0;
                      const sign = g > 0 ? '+' : '';
                      return `
                      <div class="ss-eq-band">
                        <span id="ss-eq-val-${i}" class="ss-eq-val">${sign}${g}dB</span>
                        <input type="range" id="ss-eq-slider-${i}" class="ss-eq-slider" min="-12" max="12" step="0.5" value="${g}" style="writing-mode: vertical-lr; direction: rtl; ${!supportsAudioDSP ? 'cursor: not-allowed;' : ''}" aria-label="${band.label} Gain" aria-valuetext="${sign}${g} dB" ${!supportsAudioDSP ? 'disabled' : ''} />
                        <span class="ss-eq-freq">${band.label}</span>
                      </div>`;
                    }).join('')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Quick Nav Bar to Dashboard Pages ── -->
          <div class="ss-popup-nav-footer" style="padding: 10px 14px 12px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.2);">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.6px; margin-bottom: 8px;">OPEN DASHBOARD PAGE</div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
              <button class="ss-nav-dashboard-btn" id="ss-nav-focus" type="button" style="display:flex; align-items:center; justify-content:center; gap:6px; background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.25); border-radius:6px; color:#93c5fd; font-size:11px; font-weight:600; padding:6px 8px; cursor:pointer; transition:all 0.15s ease;">
                <span>🎯</span> <span>Focus Features</span>
              </button>
              <button class="ss-nav-dashboard-btn" id="ss-nav-timemanager" type="button" style="display:flex; align-items:center; justify-content:center; gap:6px; background:rgba(234,179,8,0.12); border:1px solid rgba(234,179,8,0.25); border-radius:6px; color:#fde047; font-size:11px; font-weight:600; padding:6px 8px; cursor:pointer; transition:all 0.15s ease;">
                <span>⏳</span> <span>Time Manager</span>
              </button>
              <button class="ss-nav-dashboard-btn" id="ss-nav-analytics" type="button" style="display:flex; align-items:center; justify-content:center; gap:6px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); border-radius:6px; color:#6ee7b7; font-size:11px; font-weight:600; padding:6px 8px; cursor:pointer; transition:all 0.15s ease;">
                <span>📊</span> <span>Analytics &amp; Stats</span>
              </button>
              <button class="ss-nav-dashboard-btn" id="ss-nav-audio" type="button" style="display:flex; align-items:center; justify-content:center; gap:6px; background:rgba(168,85,247,0.12); border:1px solid rgba(168,85,247,0.25); border-radius:6px; color:#d8b4fe; font-size:11px; font-weight:600; padding:6px 8px; cursor:pointer; transition:all 0.15s ease;">
                <span>🎛️</span> <span>Audio Studio</span>
              </button>
            </div>
          </div>

        </div><!-- end .ss-hud-body -->
      `;

      // Dynamically calculate fixed position relative to the Shield header button
      try {
        const btn = container.querySelector('#ss-header-btn') || container;
        const rect = btn.getBoundingClientRect();
        if (rect && rect.bottom > 0) {
          dialog.style.top = `${Math.max(10, Math.round(rect.bottom + 8))}px`;
          dialog.style.right = `${Math.max(10, Math.round(window.innerWidth - rect.right))}px`;
        } else {
          dialog.style.top = '56px';
          dialog.style.right = '24px';
        }
      } catch (err) {
        dialog.style.top = '56px';
        dialog.style.right = '24px';
      }

      if (document.body) {
        // Create a transparent full-screen backdrop BEHIND the popup.
        // Pattern: any click on the backdrop (= outside the popup) closes it.
        // Clicks ON the popup itself are handled by the popup's own z-index being HIGHER
        // than the backdrop, so they never reach the backdrop.
        // This is immune to YouTube's Polymer synthetic event re-dispatching because
        // YouTube's synthetic events target ytd-masthead / Polymer components,
        // NOT our backdrop element.
        const backdrop = document.createElement('div');
        backdrop.id = 'ss-popup-backdrop';
        backdrop.style.cssText = [
          'position:fixed',
          'top:0', 'left:0',
          'width:100vw', 'height:100vh',
          'z-index:99998',
          'background:transparent',
          'cursor:default'
        ].join(';');

        // Clicking backdrop closes popup and lets the event propagate to YouTube
        backdrop.addEventListener('pointerdown', () => {
          this.closePopup();
        }, { once: true });

        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);
      } else if (container) {
        container.appendChild(dialog);
      }

      // Wire up events inside dialog
      this.wirePopupEvents(dialog, settings, tracking);

      const hostBtn = container.querySelector('#ss-header-btn');
      if (hostBtn) {
        hostBtn.setAttribute('aria-expanded', 'true');
      }

      // Escape key closes popup
      document.addEventListener('keydown', this.boundKeydown);
    } catch(e) {}
  }

  wirePopupEvents(dialog, settings, tracking) {
    const masterInput = dialog.querySelector('#ss-toggle-master');
    const shortsInput = dialog.querySelector('#ss-toggle-shorts');
    const focusInput = dialog.querySelector('#ss-toggle-focus');
    const studyInput = dialog.querySelector('#ss-toggle-study');
    const goalToggleInput = dialog.querySelector('#ss-toggle-goal');
    const timeManagerInput = dialog.querySelector('#ss-toggle-time-manager');
    const autoSkipAdsInput = dialog.querySelector('#ss-toggle-auto-skip-ads');

    // ── Minimize / Restore ──────────────────────────────────────────────────
    const hudBody = dialog.querySelector('#ss-hud-body');
    const minimizedBar = dialog.querySelector('#ss-hud-minimized-badge') || dialog.querySelector('#ss-minimized-bar');
    const popupHeader = dialog.querySelector('#ss-popup-header') || dialog.querySelector('.ss-popup-header');
    const minimizeBtn = dialog.querySelector('#ss-hud-minimize') || dialog.querySelector('#ss-minimize-btn');
    const restoreBtn = dialog.querySelector('#ss-restore-btn');

    const setMinimized = (minimized) => {
      if (hudBody) hudBody.style.display = minimized ? 'none' : '';
      if (popupHeader) popupHeader.style.display = minimized ? 'none' : '';
      if (minimizedBar) minimizedBar.style.display = minimized ? 'flex' : 'none';
      dialog.classList.toggle('ss-is-minimized', minimized);
    };
    if (minimizeBtn) minimizeBtn.addEventListener('click', (e) => { if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); setMinimized(true); });
    if (restoreBtn) restoreBtn.addEventListener('click', (e) => { if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); setMinimized(false); });
    if (minimizedBar) minimizedBar.addEventListener('click', (e) => { if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); setMinimized(false); });

    // ── Collapsible sections ────────────────────────────────────────────────
    dialog.querySelectorAll('.ss-section-header').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const controlsId = btn.getAttribute('aria-controls');
        const body = controlsId ? dialog.querySelector('#' + controlsId) : btn.nextElementSibling;
        if (!body) return;
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : '';
        btn.setAttribute('aria-expanded', String(!isOpen));
        btn.classList.toggle('ss-collapsed', isOpen);
        btn.classList.toggle('ss-expanded', !isOpen);
      });
    });

    const applyDisabledState = (disabled) => {
      dialog.querySelectorAll('.ss-popup-toggles, .ss-popup-study-card').forEach(el => {
        el.style.opacity = disabled ? '0.35' : '1';
        el.style.pointerEvents = disabled ? 'none' : '';
      });
    };
    applyDisabledState(settings.extensionEnabled === false);

    if (masterInput) {
      masterInput.addEventListener('change', async () => {
        try {
          const isEnabled = masterInput.checked;
          const statusBadge = dialog.querySelector('#ss-header-status-badge');
          if (statusBadge) {
            statusBadge.textContent = isEnabled ? 'ACTIVE' : 'PAUSED';
            statusBadge.className = `ss-status-badge ${isEnabled ? 'ss-status-active' : 'ss-status-paused'}`;
          }
          await StorageUtil.updateSetting('extensionEnabled', isEnabled);
          applyDisabledState(!isEnabled);
          this.updateState();
        } catch(e) {}
      });
    }

    if (shortsInput) {
      shortsInput.addEventListener('change', async () => {
        try {
          await StorageUtil.updateSetting('shortsBlocker', shortsInput.checked);
          this.updateState();
        } catch(e) {}
      });
    }

    if (focusInput) {
      focusInput.addEventListener('change', async () => {
        try {
          await StorageUtil.updateSetting('focusMode', focusInput.checked);
          this.updateState();
        } catch(e) {}
      });
    }

    const ghostShieldInput = dialog.querySelector('#ss-toggle-ghost-shield');
    if (ghostShieldInput) {
      ghostShieldInput.addEventListener('change', async () => {
        try {
          await StorageUtil.updateSetting('ghostShield', ghostShieldInput.checked);
          this.updateState();
        } catch(e) {}
      });
    }

    if (studyInput) {
      studyInput.addEventListener('change', async () => {
        try {
          await StorageUtil.updateSetting('studyMode', studyInput.checked);
          if (studyInput.checked) {
            this.startSessionTimer(tracking);
          } else {
            this.stopSessionTimer();
          }
          this.updateState();
        } catch(e) {}
      });
    }

    if (goalToggleInput) {
      goalToggleInput.addEventListener('change', async () => {
        try {
          await StorageUtil.updateSetting('goalMode', goalToggleInput.checked);
          this.updateState();
        } catch(e) {}
      });
    }

    if (timeManagerInput) {
      timeManagerInput.addEventListener('change', async () => {
        try {
          await StorageUtil.updateTimeManagerSetting('enabled', timeManagerInput.checked);
          this.updateState();
        } catch(e) {}
      });
    }

    if (autoSkipAdsInput) {
      autoSkipAdsInput.addEventListener('change', async () => {
        try {
          await StorageUtil.updateSetting('autoSkipAds', autoSkipAdsInput.checked);
          this.updateState();
        } catch(e) {}
      });
    }

    // Volume Booster & Bass Booster sliders
    const volSlider = dialog.querySelector('#ss-vol-slider');
    const volValue = dialog.querySelector('#ss-vol-value');
    const bassSlider = dialog.querySelector('#ss-bass-slider');
    const bassValue = dialog.querySelector('#ss-bass-value');

    const ensureAudioUnlocked = () => {
      if (window.AudioEngine) {
        window.AudioEngine.unlock();
      }
      if (window.VolumeBooster) {
        window.VolumeBooster.connect();
        if (window.VolumeBooster.ctx && window.VolumeBooster.ctx.state === 'suspended') {
          window.VolumeBooster.ctx.resume().catch(() => {});
        }
      }
    };

    const thermalAlert = dialog.querySelector('#ss-audio-thermal-alert');
    const updateThermalAlert = () => {
      const vol = parseInt(volSlider ? volSlider.value : 100, 10) || 100;
      const bass = parseInt(bassSlider ? bassSlider.value : 0, 10) || 0;
      if (thermalAlert) {
        thermalAlert.style.display = (vol > 250 || bass > 12) ? 'block' : 'none';
      }
    };

    if (volSlider) {
      volSlider.addEventListener('input', () => {
        ensureAudioUnlocked();
        const val = parseInt(volSlider.value, 10);
        if (volValue) volValue.textContent = val + '%';
        if (window.VolumeBooster) window.VolumeBooster.setVolume(val);
        updateThermalAlert();
      });
      volSlider.addEventListener('change', async () => {
        try {
          await StorageUtil.updateVolumeBoosterSetting('volumeLevel', parseInt(volSlider.value, 10));
          updateThermalAlert();
        } catch(e) {}
      });
    }

    if (bassSlider) {
      bassSlider.addEventListener('input', () => {
        ensureAudioUnlocked();
        const val = parseInt(bassSlider.value, 10);
        if (bassValue) bassValue.textContent = val + ' dB';
        if (window.VolumeBooster) window.VolumeBooster.setBass(val);
        updateThermalAlert();
      });
      bassSlider.addEventListener('change', async () => {
        try {
          await StorageUtil.updateVolumeBoosterSetting('bassLevel', parseInt(bassSlider.value, 10));
          updateThermalAlert();
        } catch(e) {}
      });
    }

    // Noise Remover & Anti-Distortion Clarifier Toggle
    const noiseToggle = dialog.querySelector('#ss-noise-remover-toggle');
    if (noiseToggle) {
      noiseToggle.addEventListener('change', async () => {
        ensureAudioUnlocked();
        const enabled = noiseToggle.checked;
        if (window.VolumeBooster && typeof window.VolumeBooster.setNoiseRemover === 'function') {
          window.VolumeBooster.setNoiseRemover(enabled);
        }
        if (window.AudioEngine && typeof window.AudioEngine.setNoiseRemover === 'function') {
          window.AudioEngine.setNoiseRemover(enabled);
        }
        await StorageUtil.updateVolumeBoosterSetting('noiseRemover', enabled);
      });
    }

    // 10-Band Graphic Equalizer Controls
    const eqToggle = dialog.querySelector('#ss-eq-toggle');
    const eqPreset = dialog.querySelector('#ss-eq-preset');
    const eqReset = dialog.querySelector('#ss-eq-reset');
    const eqRack = dialog.querySelector('#ss-eq-rack');

    if (eqToggle) {
      eqToggle.addEventListener('change', async () => {
        ensureAudioUnlocked();
        const enabled = eqToggle.checked;
        if (eqRack) eqRack.classList.toggle('ss-eq-disabled', !enabled);
        if (window.VolumeBooster && typeof window.VolumeBooster.setEqEnabled === 'function') {
          window.VolumeBooster.setEqEnabled(enabled);
        }
        if (window.AudioEngine && typeof window.AudioEngine.setEqEnabled === 'function') {
          window.AudioEngine.setEqEnabled(enabled);
        }
        await StorageUtil.updateVolumeBoosterSetting('eqEnabled', enabled);
      });
    }

    const getPopupCurrentGains = () => {
      const gains = [];
      for (let i = 0; i < 10; i++) {
        const slider = dialog.querySelector(`#ss-eq-slider-${i}`);
        const val = slider ? parseFloat(slider.value) : 0;
        gains.push(isNaN(val) ? 0 : val);
      }
      return gains;
    };

    const setPopupGainsUI = (gains) => {
      for (let i = 0; i < 10; i++) {
        const slider = dialog.querySelector(`#ss-eq-slider-${i}`);
        const valSpan = dialog.querySelector(`#ss-eq-val-${i}`);
        const g = gains[i] !== undefined ? gains[i] : 0;
        if (slider) slider.value = g;
        if (valSpan) {
          const num = Number(g);
          valSpan.textContent = (num > 0 ? '+' : '') + num + 'dB';
        }
      }
    };

    if (eqPreset) {
      eqPreset.addEventListener('change', async () => {
        ensureAudioUnlocked();
        const presetName = eqPreset.value;
        if (presetName && window._SS_EQ_PRESETS && window._SS_EQ_PRESETS[presetName]) {
          const gains = window._SS_EQ_PRESETS[presetName];
          setPopupGainsUI(gains);
          if (window.VolumeBooster && typeof window.VolumeBooster.setEqPreset === 'function') {
            window.VolumeBooster.setEqPreset(presetName);
          }
          if (window.AudioEngine && typeof window.AudioEngine.setEqPreset === 'function') {
            window.AudioEngine.setEqPreset(presetName);
          }
          await StorageUtil.updateVolumeBoosterSetting('eqGains', [...gains]);
          await StorageUtil.updateVolumeBoosterSetting('preset', presetName);
        } else if (presetName === 'Custom') {
          await StorageUtil.updateVolumeBoosterSetting('preset', 'Custom');
        }
      });
    }

    if (eqReset) {
      eqReset.addEventListener('click', async () => {
        ensureAudioUnlocked();
        const flatGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        setPopupGainsUI(flatGains);
        if (eqPreset) eqPreset.value = 'Flat';
        if (window.VolumeBooster && typeof window.VolumeBooster.resetEq === 'function') {
          window.VolumeBooster.resetEq();
        }
        if (window.AudioEngine && typeof window.AudioEngine.resetEq === 'function') {
          window.AudioEngine.resetEq();
        }
        await StorageUtil.updateVolumeBoosterSetting('preset', 'Flat');
        await StorageUtil.updateVolumeBoosterSetting('eqGains', flatGains);
      });
    }

    for (let i = 0; i < 10; i++) {
      const slider = dialog.querySelector(`#ss-eq-slider-${i}`);
      const valSpan = dialog.querySelector(`#ss-eq-val-${i}`);
      if (slider) {
        slider.addEventListener('input', () => {
          ensureAudioUnlocked();
          const val = parseFloat(slider.value) || 0;
          if (valSpan) valSpan.textContent = (val > 0 ? '+' : '') + val + 'dB';
          const currentGains = getPopupCurrentGains();
          const detected = _ssDetectPreset(currentGains);
          if (eqPreset) eqPreset.value = detected;
          if (window.VolumeBooster && typeof window.VolumeBooster.setEqBandGain === 'function') {
            window.VolumeBooster.setEqBandGain(i, val);
          }
          if (window.AudioEngine && typeof window.AudioEngine.setEqBandGain === 'function') {
            window.AudioEngine.setEqBandGain(i, val);
          }
        });

        slider.addEventListener('change', async () => {
          const currentGains = getPopupCurrentGains();
          const detected = _ssDetectPreset(currentGains);
          if (eqPreset) eqPreset.value = detected;
          await StorageUtil.updateVolumeBoosterSetting('eqGains', currentGains);
          await StorageUtil.updateVolumeBoosterSetting('preset', detected);
        });
      }
    }

    // ── Live Mini Spectrum Analyzer in Popover ──
    try {
      const miniCanvas = dialog.querySelector('#ss-popup-spectrum-canvas');
      const peakDbEl = dialog.querySelector('#ss-popup-peak-db');
      if (miniCanvas && typeof miniCanvas.getContext === 'function') {
        const mctx = miniCanvas.getContext('2d');
        if (mctx) {
          let mAnimId = null;
          let mPeaks = new Array(28).fill(0);
          let isLoopActive = false;

          const isMiniSpectrumVisible = () => {
            const currentDialog = document.getElementById('ss-popup-dialog');
            if (!currentDialog) return false;
            if (currentDialog.classList.contains('ss-is-minimized')) return false;
            const audioSec = currentDialog.querySelector('#ss-section-audio');
            if (!audioSec || audioSec.style.display === 'none') return false;
            return true;
          };

          const renderMiniSpectrum = () => {
            if (!isMiniSpectrumVisible()) {
              isLoopActive = false;
              mAnimId = null;
              return;
            }

            if (typeof requestAnimationFrame === 'function') {
              mAnimId = requestAnimationFrame(renderMiniSpectrum);
              isLoopActive = true;
            }

            const mw = (miniCanvas.width = miniCanvas.clientWidth || 280);
            const mh = (miniCanvas.height = 42);

            let freqData = new Uint8Array(64);
            if (window.AudioEngine && typeof window.AudioEngine.getFrequencyData === 'function') {
              const d = window.AudioEngine.getFrequencyData();
              if (d && d.some && d.some(v => v > 0)) freqData = d;
            }
            if (!freqData.some(v => v > 0) && window.VolumeBooster && typeof window.VolumeBooster.getFrequencyData === 'function') {
              const d = window.VolumeBooster.getFrequencyData();
              if (d && d.some && d.some(v => v > 0)) freqData = d;
            }
            if (!freqData.some(v => v > 0) && window.__SS_PAGE_AUDIO_DSP__ && typeof window.__SS_PAGE_AUDIO_DSP__.getFrequencyData === 'function') {
              const d = window.__SS_PAGE_AUDIO_DSP__.getFrequencyData();
              if (d && d.some && d.some(v => v > 0)) freqData = d;
            }

            mctx.fillStyle = '#030712';
            mctx.fillRect(0, 0, mw, mh);

            const barCount = 28;
            const spacing = 2;
            const barW = Math.max(2, (mw - (barCount * spacing)) / barCount);

            const grad = mctx.createLinearGradient(0, mh, 0, 0);
            grad.addColorStop(0, '#06b6d4');
            grad.addColorStop(0.5, '#a855f7');
            grad.addColorStop(1, '#f43f5e');

            let maxVal = 0;
            for (let i = 0; i < barCount; i++) {
              const idx = Math.floor((i / barCount) * 50);
              const v = freqData[idx] || 0;
              if (v > maxVal) maxVal = v;
              const bh = (v / 255) * (mh - 4);
              const x = i * (barW + spacing) + spacing;
              const y = mh - bh - 2;

              mctx.fillStyle = grad;
              mctx.fillRect(x, y, barW, bh);

              if (v >= mPeaks[i]) {
                mPeaks[i] = v;
              } else {
                mPeaks[i] = Math.max(0, mPeaks[i] - 2);
              }
              const py = mh - ((mPeaks[i] / 255) * (mh - 4)) - 4;
              mctx.fillStyle = '#f8fafc';
              mctx.fillRect(x, py, barW, 1.5);
            }

            if (peakDbEl) {
              if (!supportsAudioDSP) {
                peakDbEl.textContent = 'Unavailable in Safari';
              } else if (maxVal === 0) {
                peakDbEl.textContent = '-inf dB';
              } else {
                const db = Math.round(20 * Math.log10(maxVal / 255) * 10) / 10;
                peakDbEl.textContent = `${db > -0.5 ? '0.0' : db} dB`;
              }
            }
          };

          const resumeMiniSpectrum = () => {
            if (isMiniSpectrumVisible() && !isLoopActive) {
              if (mAnimId && typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(mAnimId);
                mAnimId = null;
              }
              renderMiniSpectrum();
            }
          };

          const headerAudioBtn = dialog.querySelector('#ss-header-audio');
          if (headerAudioBtn) {
            headerAudioBtn.addEventListener('click', () => {
              setTimeout(resumeMiniSpectrum, 10);
            });
          }
          if (restoreBtn) restoreBtn.addEventListener('click', () => setTimeout(resumeMiniSpectrum, 10));
          if (minimizedBar) minimizedBar.addEventListener('click', () => setTimeout(resumeMiniSpectrum, 10));

          renderMiniSpectrum();
          this._activeSpectrumVisualizer = {
            stop: () => {
              isLoopActive = false;
              if (mAnimId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(mAnimId);
              mAnimId = null;
            },
            resume: resumeMiniSpectrum
          };
        }
      }
    } catch (err) {}

    const editBtn = dialog.querySelector('#ss-popup-edit-goal');
    const goalChip = dialog.querySelector('#ss-popup-goal-chip');
    const goalContainer = dialog.querySelector('#ss-popup-goal-container');
    const goalInput = dialog.querySelector('#ss-popup-goal-input');
    const saveGoalBtn = dialog.querySelector('#ss-popup-save-goal');
    const goalTextEl = dialog.querySelector('#ss-popup-goal');

    if (goalInput) goalInput.value = settings.learningGoal || '';

    const openGoalEdit = (e) => {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      if (goalContainer && goalInput) {
        goalContainer.classList.add('ss-goal-input-open');
        goalInput.focus();
        goalInput.select(); // Select all text so user can immediately type new goal
      }
    };

    if (editBtn) editBtn.addEventListener('click', openGoalEdit);
    if (goalChip) {
      goalChip.addEventListener('click', (e) => {
        if (e.target !== editBtn) openGoalEdit(e);
      });
    }

    const searchGoalBtn = dialog.querySelector('#ss-popup-search-goal');
    if (goalInput && goalTextEl && goalContainer) {
      const handleSaveGoal = async (shouldSearch = false) => {
        const newGoal = goalInput.value.trim();
        if (newGoal) {
          try { await StorageUtil.updateSetting('learningGoal', newGoal); } catch(e) {}
          goalTextEl.textContent = newGoal;
          goalContainer.classList.remove('ss-goal-input-open');
          // Update GoalMode and StudyMode with new goal if active
          if (window.GoalMode && typeof window.GoalMode.setGoal === 'function') {
            try { window.GoalMode.setGoal(newGoal); } catch(e) {}
          }
          if (window.StudyMode && typeof window.StudyMode.setGoal === 'function') {
            try { window.StudyMode.setGoal(newGoal); } catch(e) {}
          }

          if (shouldSearch) {
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(newGoal)}`;
            if (typeof window !== 'undefined' && window.location) {
              window.location.href = searchUrl;
            }
          }
        }
      };

      // Prevent pointerdown inside goal input from bubbling to backdrop
      goalInput.addEventListener('pointerdown', (e) => e.stopPropagation());
      if (saveGoalBtn) saveGoalBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      if (searchGoalBtn) searchGoalBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      goalContainer.addEventListener('pointerdown', (e) => e.stopPropagation());

      if (saveGoalBtn) {
        saveGoalBtn.addEventListener('click', () => handleSaveGoal(false));
      }
      if (searchGoalBtn) {
        searchGoalBtn.addEventListener('click', () => handleSaveGoal(true));
      }
      goalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSaveGoal(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          goalContainer.classList.remove('ss-goal-input-open');
        }
      });
    }

    const settingsIcon = dialog.querySelector('#ss-popup-settings');
    if (settingsIcon) {
      const openSettingsPage = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        let sent = false;
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "openOptionsPage" }, (res) => {
              if (chrome.runtime.lastError || !res || !res.success) {
                try {
                  const optionsUrl = chrome.runtime.getURL('options/options.html');
                  window.open(optionsUrl, '_blank');
                } catch(err) {}
              }
            });
            sent = true;
          }
        } catch(e) {}

        if (!sent) {
          try {
            const optionsUrl = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('options/options.html') : null;
            if (optionsUrl) {
              window.open(optionsUrl, '_blank');
            }
          } catch(err) {}
        }
      };

      const handleSettingsClick = (e) => {
        if (e) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }
        openSettingsPage(e);
      };

      settingsIcon.addEventListener('click', handleSettingsClick);
      settingsIcon.addEventListener('touchend', handleSettingsClick);
      settingsIcon.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') handleSettingsClick(e);
      });
    }

    // ── Open-in-settings buttons for accordion sections and footer nav bar ──
    const openOptionsTab = (tab, e) => {
      if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      }
      try {
        const optionsUrl = chrome.runtime.getURL(`options/options.html#${tab}`);
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'openOptionsPage', tab }, (res) => {
            if (chrome.runtime.lastError || !res || !res.success) {
              try { window.open(optionsUrl, '_blank'); } catch(e2) {}
            }
          });
        } else {
          window.open(optionsUrl, '_blank');
        }
      } catch(err) {
        try {
          const optionsUrl = chrome.runtime.getURL(`options/options.html#${tab}`);
          window.open(optionsUrl, '_blank');
        } catch(e3) {}
      }
    };

    const sectionBtnMap = [
      { id: 'ss-open-focus',          tab: 'focus' },
      { id: 'ss-open-timemanager',    tab: 'timemanager' },
      { id: 'ss-open-analytics',      tab: 'analytics' },
      { id: 'ss-open-audio',          tab: 'audio' },
      { id: 'ss-nav-focus',           tab: 'focus' },
      { id: 'ss-nav-timemanager',     tab: 'timemanager' },
      { id: 'ss-nav-analytics',       tab: 'analytics' },
      { id: 'ss-nav-audio',           tab: 'audio' },
    ];

    sectionBtnMap.forEach(({ id, tab }) => {
      const btn = dialog.querySelector(`#${id}`);
      if (!btn) return;
      const handleTabClick = (e) => {
        if (e) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }
        openOptionsTab(tab, e);
      };
      btn.addEventListener('click', handleTabClick);
      btn.addEventListener('touchend', handleTabClick);
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') handleTabClick(e);
      });
    });

    // Update Stats with defensive null guards
    const getLocalDateKey = () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    const today = getLocalDateKey();
    const totalSeconds = (tracking.dailyWatchTime && tracking.dailyWatchTime[today]) || 0;
    const learningSeconds = (tracking.dailyLearningTime && tracking.dailyLearningTime[today]) || 0;

    const formatTime = (secs) => {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      return `${h}h ${m}m`;
    };

    const todayTimeEl = dialog.querySelector('#ss-popup-today-time');
    if (todayTimeEl) todayTimeEl.textContent = formatTime(totalSeconds);

    const learningTimeEl = dialog.querySelector('#ss-popup-learning-time');
    if (learningTimeEl) learningTimeEl.textContent = formatTime(learningSeconds);

    const score = totalSeconds > 0 ? Math.min(100, Math.max(0, Math.round((learningSeconds / totalSeconds) * 100))) : 0;
    const focusScoreEl = dialog.querySelector('#ss-popup-focus-score');
    if (focusScoreEl) focusScoreEl.textContent = `${score}%`;

    const gamification = tracking.gamification || {};
    const rankIcon = gamification.rankIcon || '🥉';
    const rankTier = gamification.rankTier || 'Bronze Focus';
    const totalAP = gamification.totalPoints || 0;
    const rankEl = dialog.querySelector('#ss-popup-rank-tier');
    if (rankEl) rankEl.textContent = `${rankIcon} ${rankTier} (${totalAP} AP)`;

    // Session timer calculated dynamically from tracking.activeSessionStart if Study Mode is checked
    if (settings.studyMode) {
      this.startSessionTimer(tracking);
    }
  }

  startSessionTimer(tracking = {}) {
    this.stopSessionTimer();
    const startTime = (tracking && tracking.activeSessionStart) ? tracking.activeSessionStart : Date.now();
    const updateTimerDisplay = () => {
      const elapsedSecs = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      const h = Math.floor(elapsedSecs / 3600);
      const m = Math.floor((elapsedSecs % 3600) / 60);
      const s = elapsedSecs % 60;
      const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      
      const timerEl = document.getElementById('ss-popup-session-time') || (this.containerElement && this.containerElement.querySelector('#ss-popup-session-time'));
      const miniTimerEl = document.getElementById('ss-mini-timer') || (this.containerElement && this.containerElement.querySelector('#ss-mini-timer'));
      if (timerEl) timerEl.textContent = formatted;
      if (miniTimerEl) miniTimerEl.textContent = formatted;
    };
    updateTimerDisplay();
    this.sessionTimerInterval = setInterval(updateTimerDisplay, 1000);
  }

  stopSessionTimer() {
    if (this.sessionTimerInterval) {
      clearInterval(this.sessionTimerInterval);
      this.sessionTimerInterval = null;
    }
  }

  closePopup() {
    // Remove the popup dialog
    const dialog = document.getElementById('ss-popup-dialog');
    if (dialog && dialog.parentNode) {
      dialog.parentNode.removeChild(dialog);
    }
    // Remove the transparent backdrop (outside-click detection)
    const backdrop = document.getElementById('ss-popup-backdrop');
    if (backdrop && backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }
    if (this._activeSpectrumVisualizer && typeof this._activeSpectrumVisualizer.stop === 'function') {
      this._activeSpectrumVisualizer.stop();
      this._activeSpectrumVisualizer = null;
    }
    this.stopSessionTimer();
    if (this.outsideClickTimer) {
      clearTimeout(this.outsideClickTimer);
      this.outsideClickTimer = null;
    }
    // Remove document-level listeners (pointerdown removed, keydown remains needed)
    document.removeEventListener('pointerdown', this.boundOutsideClick);
    document.removeEventListener('keydown', this.boundKeydown);

    const hostBtn = (this.containerElement && this.containerElement.querySelector('#ss-header-btn')) || document.getElementById('ss-header-btn');
    if (hostBtn) {
      hostBtn.setAttribute('aria-expanded', 'false');
    }
  }

  onOutsideClick(e) {
    // CRITICAL FIX: YouTube's Polymer/topbar components re-dispatch synthetic click events
    // on ytd-masthead AFTER the Shield button click. These synthetic events have e.target
    // pointing to YouTube-internal elements (not the Shield button/dialog), yet they are
    // attached to the real document DOM — so all contains/closest/composedPath guards fail.
    // Since these retargeted clicks are CAUSALLY linked to the same click that opened the
    // menu, we reject any outside-click event that arrives within 300ms of opening.
    if (this._openTime && (Date.now() - this._openTime) < 300) {
      return;
    }

    if (!e || !e.target) return;

    const dialog = document.getElementById('ss-popup-dialog');
    const container = document.getElementById('ss-header-btn-container');

    if (dialog && typeof dialog.contains === 'function' && dialog.contains(e.target)) {
      return;
    }
    if (container && typeof container.contains === 'function' && container.contains(e.target)) {
      return;
    }
    if (e.composedPath && typeof e.composedPath === 'function') {
      try {
        const path = e.composedPath();
        if (Array.isArray(path)) {
          if (dialog && path.includes(dialog)) return;
          if (container && path.includes(container)) return;
        }
      } catch(err) {}
    }
    if (typeof e.target.closest === 'function' && e.target.closest('#ss-header-btn-container, .ss-header-btn-container, #ss-header-btn, #ss-popup-dialog, .ss-popup-dialog')) {
      return;
    }
    if (typeof document !== 'undefined' && typeof document.contains === 'function' && !document.contains(e.target)) {
      return;
    }

    this.closePopup();
  }

  escapeHtml(str) {
    const val = String(str || '');
    return val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
}

window.HeaderButton = new HeaderButton();

/**
 * High-performance HTML5 Canvas Spectrum Visualizer Rendering Engine
 * Renders glowing gradient bars with peak-hold indicator caps at 60 FPS.
 */
function renderSpectrum(canvas, getByteDataFn) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    return { stop: () => {} };
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return { stop: () => {} };

  const numBars = 24;
  const peakHoldDelay = 15;
  const peakDecayRate = 2.5;

  const peakHeights = new Float32Array(numBars);
  const peakHoldCounters = new Float32Array(numBars);

  let animFrameId = null;
  let isRunning = true;

  function renderFrame() {
    if (!isRunning) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    let rawData;
    try {
      rawData = getByteDataFn() || new Uint8Array(64);
    } catch (e) {
      rawData = new Uint8Array(64);
    }

    const binsPerBar = rawData.length / numBars;
    const barValues = new Float32Array(numBars);

    for (let i = 0; i < numBars; i++) {
      const startBin = Math.floor(i * binsPerBar);
      const endBin = Math.min(rawData.length, Math.ceil((i + 1) * binsPerBar));
      let sum = 0;
      let count = 0;
      for (let j = startBin; j < endBin; j++) {
        sum += rawData[j];
        count++;
      }
      const avg = count > 0 ? sum / count : 0;
      const boost = 1 + (i / numBars) * 0.4;
      barValues[i] = Math.min(255, avg * boost);
    }

    const gap = 3;
    const totalGaps = (numBars - 1) * gap;
    const usableWidth = width - 8;
    const barWidth = Math.max(2, (usableWidth - totalGaps) / numBars);
    const startX = 4;
    const maxBarHeight = height - 6;

    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#2563eb');
    gradient.addColorStop(0.35, '#7c3aed');
    gradient.addColorStop(0.7, '#a855f7');
    gradient.addColorStop(1, '#ec4899');

    for (let i = 0; i < numBars; i++) {
      const x = startX + i * (barWidth + gap);
      const val = barValues[i];
      const targetBarHeight = (val / 255) * maxBarHeight;

      if (targetBarHeight >= peakHeights[i]) {
        peakHeights[i] = targetBarHeight;
        peakHoldCounters[i] = peakHoldDelay;
      } else {
        if (peakHoldCounters[i] > 0) {
          peakHoldCounters[i]--;
        } else {
          peakHeights[i] = Math.max(0, peakHeights[i] - peakDecayRate);
        }
      }

      if (targetBarHeight > 0.5) {
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(168,85,247,0.5)';
        ctx.fillStyle = gradient;
        const y = height - targetBarHeight;
        if (typeof ctx.roundRect === 'function' && targetBarHeight > 3) {
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, targetBarHeight, [2, 2, 0, 0]);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barWidth, targetBarHeight);
        }
        ctx.restore();
      }

      if (peakHeights[i] > 0.5) {
        const peakY = Math.max(0, height - peakHeights[i] - 2);
        ctx.save();
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(56,189,248,0.8)';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, peakY, barWidth, 2);
        ctx.restore();
      }
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      animFrameId = requestAnimationFrame(renderFrame);
    }
  }

  if (typeof requestAnimationFrame !== 'undefined') {
    animFrameId = requestAnimationFrame(renderFrame);
  }

  const stop = () => {
    isRunning = false;
    if (animFrameId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch (e) {}
  };

  return { stop };
}


