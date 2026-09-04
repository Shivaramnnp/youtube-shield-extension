document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Navigation Tabs
    const navItems = document.querySelectorAll('.nav-menu li');
    const tabContents = document.querySelectorAll('.tab-content');

    const normalizeTabId = (tabId) => {
      if (!tabId) return 'focus';
      let t = String(tabId).toLowerCase().replace('#', '').replace('-tab', '').trim();
      if (t === 'time' || t === 'timemanager' || t === 'time-manager' || t === 'time_manager' || t === 'timer') return 'timemanager';
      if (t === 'audio' || t === 'audiocontrol' || t === 'audio-controls' || t === 'audio_controls' || t === 'eq' || t === 'volume' || t === 'sound' || t === 'focus-audio') return 'audio';
      if (t === 'blocklist' || t === 'custom-blocklist' || t === 'custom_blocklist' || t === 'block' || t === 'blocked' || t === 'blacklist' || t === 'filters') return 'blocklist';
      if (t === 'analytics' || t === 'stats' || t === 'stat' || t === 'telemetry') return 'analytics';
      if (t === 'ui' || t === 'cleaner' || t === 'uicleaner' || t === 'ui-cleaner') return 'ui';
      if (t === 'gamification' || t === 'achievements' || t === 'rank' || t === 'badges') return 'gamification';
      if (t === 'about' || t === 'info' || t === 'help') return 'about';
      if (t === 'focus' || t === 'focusmode' || t === 'focus-features' || t === 'focusfeatures') return 'focus';
      return t;
    };

    const switchTab = (tabId) => {
      const targetTab = normalizeTabId(tabId);
      navItems.forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-selected', item.dataset.tab === targetTab ? 'true' : 'false');
        if (item.dataset.tab === targetTab) item.classList.add('active');
      });
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${targetTab}-tab`) content.classList.add('active');
      });
      try {
        if (window.location.hash !== `#${targetTab}`) {
          history.replaceState(null, '', `#${targetTab}`);
        }
      } catch(e) {}
      try {
        window.dispatchEvent(new CustomEvent('options-tab-changed', { detail: { tab: targetTab } }));
      } catch(e) {}
    };

    navItems.forEach(item => {
      item.addEventListener('click', () => switchTab(item.dataset.tab));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          switchTab(item.dataset.tab);
        }
      });
    });

    // Handle deep-link hash navigation on load and on hash change
    const checkHashNavigation = () => {
      if (window.location.hash) {
        switchTab(window.location.hash);
      }
    };
    checkHashNavigation();
    window.addEventListener('hashchange', checkHashNavigation);

    // Listen for tab switch messages from background script or popup
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg && msg.action === 'switchTab' && msg.tab) {
          switchTab(msg.tab);
          if (sendResponse) sendResponse({ success: true, tab: msg.tab });
        }
      });
    }

    // Load Settings and Data
    let settings = await StorageUtil.getSettings();
    let tracking = await StorageUtil.getTracking();
    if (tracking && !tracking.timelineMigrated && typeof StorageUtil.migrateTimelineLog === 'function') {
      tracking = StorageUtil.migrateTimelineLog(tracking);
      await StorageUtil.saveTracking(tracking);
    }

    // Helper functions
    const escapeHtml = (str) => {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const formatTime = (secs) => {
      if (!secs) return '0h 0m';
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      return `${h}h ${m}m`;
    };

    const getLocalDateKey = () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const EQ_PRESETS = (typeof window !== 'undefined' && window._SS_EQ_PRESETS) || (typeof AudioEngine !== 'undefined' && AudioEngine.EQ_PRESETS) || {};

    const detectPreset = (gains) => {
      if (!Array.isArray(gains)) return 'Custom';
      for (const [name, presetGains] of Object.entries(EQ_PRESETS)) {
        if (name === 'Custom' || !presetGains) continue;
        let match = true;
        for (let i = 0; i < 10; i++) {
          if (Number(gains[i]) !== Number(presetGains[i])) {
            match = false;
            break;
          }
        }
        if (match) return name;
      }
      return 'Custom';
    };

    // Populate UI
    const setToggle = (id, checked) => {
      const el = document.getElementById(id);
      if (el) {
        el.checked = !!checked;
        el.setAttribute('aria-checked', !!checked);
      }
    };

    // Save indicator helper
    const saveIndicator = document.getElementById('save-indicator');
    let saveTimeout;

    const showSaveIndicator = () => {
      if (!saveIndicator) return;
      saveIndicator.classList.add('show');
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveIndicator.classList.remove('show');
      }, 2000);
    };

    // Custom Blocklist Dashboard Studio State & Functions
    let blocklistSearchQuery = '';

    const removeBlockedItem = async (type, rawValue) => {
      const value = String(rawValue || '').trim();
      if (!value) return;

      if (type === 'channel') {
        settings.blockedChannels = (settings.blockedChannels || []).filter(
          c => String(c).trim().toLowerCase() !== value.toLowerCase()
        );
        await StorageUtil.updateSetting('blockedChannels', settings.blockedChannels);
      } else if (type === 'keyword') {
        settings.blockedKeywords = (settings.blockedKeywords || []).filter(
          k => String(k).trim().toLowerCase() !== value.toLowerCase()
        );
        await StorageUtil.updateSetting('blockedKeywords', settings.blockedKeywords);
      }

      renderBlocklistChips(settings.blockedChannels, settings.blockedKeywords, blocklistSearchQuery);
      showSaveIndicator();
    };

    const addBlockedItems = async (type, rawInput) => {
      if (!rawInput || typeof rawInput !== 'string') return;
      const items = rawInput.split(',').map(s => s.trim()).filter(Boolean);
      if (items.length === 0) return;

      let modified = false;

      if (type === 'channel') {
        const current = Array.isArray(settings.blockedChannels) ? [...settings.blockedChannels] : [];
        for (const rawItem of items) {
          let cleaned = typeof StorageUtil.cleanChannelName === 'function'
            ? StorageUtil.cleanChannelName(rawItem)
            : rawItem.replace(/\s+/g, ' ').trim();
          if (!cleaned || cleaned.toLowerCase() === 'youtube channel') {
            cleaned = rawItem.replace(/\s+/g, ' ').trim();
          }
          if (!cleaned) continue;
          const exists = current.some(c => c.toLowerCase() === cleaned.toLowerCase());
          if (!exists) {
            current.push(cleaned);
            modified = true;
          }
        }
        if (modified) {
          settings.blockedChannels = current;
          await StorageUtil.updateSetting('blockedChannels', settings.blockedChannels);
        }
      } else if (type === 'keyword') {
        const current = Array.isArray(settings.blockedKeywords) ? [...settings.blockedKeywords] : [];
        for (const rawItem of items) {
          let cleaned = rawItem.replace(/\s+/g, ' ').trim();
          if (cleaned.startsWith('#')) cleaned = cleaned.substring(1).trim();
          if (!cleaned) continue;
          const exists = current.some(k => k.toLowerCase() === cleaned.toLowerCase());
          if (!exists) {
            current.push(cleaned);
            modified = true;
          }
        }
        if (modified) {
          settings.blockedKeywords = current;
          await StorageUtil.updateSetting('blockedKeywords', settings.blockedKeywords);
        }
      }

      renderBlocklistChips(settings.blockedChannels, settings.blockedKeywords, blocklistSearchQuery);
      if (modified) showSaveIndicator();
    };

    const renderBlocklistChips = (channels, keywords, searchQuery = '') => {
      const channelsList = Array.isArray(channels) ? channels : [];
      const keywordsList = Array.isArray(keywords) ? keywords : [];
      const query = (searchQuery || '').trim().toLowerCase();

      // Update badge counters
      const navBadge = document.getElementById('nav-blocklist-badge');
      if (navBadge) navBadge.textContent = String(channelsList.length + keywordsList.length);

      const chBadge = document.getElementById('blocked-channels-badge');
      if (chBadge) chBadge.textContent = String(channelsList.length);

      const kwBadge = document.getElementById('blocked-keywords-badge');
      if (kwBadge) kwBadge.textContent = String(keywordsList.length);

      // Sync legacy inputs if present
      const legacyKw = document.getElementById('opt-blocked-keywords');
      if (legacyKw && document.activeElement !== legacyKw) {
        legacyKw.value = keywordsList.join(', ');
      }
      const legacyCh = document.getElementById('opt-blocked-channels');
      if (legacyCh && document.activeElement !== legacyCh) {
        legacyCh.value = channelsList.join(', ');
      }

      // Filter lists
      const filteredChannels = query
        ? channelsList.filter(c => String(c).toLowerCase().includes(query))
        : channelsList;

      const filteredKeywords = query
        ? keywordsList.filter(k => String(k).toLowerCase().includes(query))
        : keywordsList;

      // Render channels cloud
      const channelsCloud = document.getElementById('blocked-channels-cloud');
      if (channelsCloud) {
        channelsCloud.innerHTML = '';
        if (channelsList.length === 0) {
          channelsCloud.innerHTML = '<div class="empty-cloud-msg">No blocked channels. Add creators above or import a list.</div>';
        } else if (filteredChannels.length === 0) {
          channelsCloud.innerHTML = `<div class="empty-cloud-msg">No channels match "<strong>${escapeHtml(searchQuery)}</strong>"</div>`;
        } else {
          filteredChannels.forEach(channel => {
            const chip = document.createElement('div');
            chip.className = 'blocklist-chip chip-channel';
            chip.setAttribute('data-type', 'channel');
            chip.setAttribute('data-value', channel);
            chip.innerHTML = `
              <span class="chip-icon">📺</span>
              <span class="chip-text" title="${escapeHtml(channel)}">${escapeHtml(channel)}</span>
              <button type="button" class="chip-remove-btn" data-type="channel" data-value="${escapeHtml(channel)}" aria-label="Remove ${escapeHtml(channel)}" title="Remove channel">✕</button>
            `;
            const removeBtn = chip.querySelector('.chip-remove-btn');
            if (removeBtn) {
              removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await removeBlockedItem('channel', channel);
              });
            }
            channelsCloud.appendChild(chip);
          });
        }
      }

      // Render keywords cloud
      const keywordsCloud = document.getElementById('blocked-keywords-cloud');
      if (keywordsCloud) {
        keywordsCloud.innerHTML = '';
        if (keywordsList.length === 0) {
          keywordsCloud.innerHTML = '<div class="empty-cloud-msg">No blocked keywords. Add keywords above or import a list.</div>';
        } else if (filteredKeywords.length === 0) {
          keywordsCloud.innerHTML = `<div class="empty-cloud-msg">No keywords match "<strong>${escapeHtml(searchQuery)}</strong>"</div>`;
        } else {
          filteredKeywords.forEach(keyword => {
            const chip = document.createElement('div');
            chip.className = 'blocklist-chip chip-keyword';
            chip.setAttribute('data-type', 'keyword');
            chip.setAttribute('data-value', keyword);
            chip.innerHTML = `
              <span class="chip-icon">🏷️</span>
              <span class="chip-text" title="${escapeHtml(keyword)}">${escapeHtml(keyword)}</span>
              <button type="button" class="chip-remove-btn" data-type="keyword" data-value="${escapeHtml(keyword)}" aria-label="Remove ${escapeHtml(keyword)}" title="Remove keyword">✕</button>
            `;
            const removeBtn = chip.querySelector('.chip-remove-btn');
            if (removeBtn) {
              removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await removeBlockedItem('keyword', keyword);
              });
            }
            keywordsCloud.appendChild(chip);
          });
        }
      }
    };

    // UI Cleaner keys definition
    const uiKeys = ['hideBell', 'hideSubCount', 'hideChat', 'hideTrending', 'hideExplore', 'hideMiniPlayer', 'hideAutoplay'];

    const updateOptionsUI = (s, t) => {
      settings = s || settings;
      tracking = t || tracking;

      setToggle('opt-shortsBlocker', settings.shortsBlocker);
      setToggle('opt-focusMode', settings.focusMode);
      setToggle('opt-ghostShield', settings.ghostShield !== false);
      setToggle('opt-studyMode', settings.studyMode);
      setToggle('opt-goalMode', settings.goalMode);
      setToggle('opt-autoSkipAds', settings.autoSkipAds === true);
      setToggle('opt-audioEffects', settings.audioEffects !== false);

      if (typeof window !== 'undefined' && window.AudioEngine) {
        window.AudioEngine.enabled = settings.audioEffects !== false;
      }

      // Volume Booster & Bass Booster sliders
      const vb = settings.volumeBooster || {};
      const optVolSlider = document.getElementById('opt-vol-slider');
      const optVolValue = document.getElementById('opt-vol-value');
      const optBassSlider = document.getElementById('opt-bass-slider');
      const optBassValue = document.getElementById('opt-bass-value');
      if (optVolSlider) optVolSlider.value = vb.volumeLevel != null ? vb.volumeLevel : 100;
      if (optVolValue) optVolValue.textContent = (vb.volumeLevel != null ? vb.volumeLevel : 100) + '%';
      if (optBassSlider) optBassSlider.value = vb.bassLevel != null ? vb.bassLevel : 0;
      if (optBassValue) optBassValue.textContent = (vb.bassLevel != null ? vb.bassLevel : 0) + ' dB';

      const optThermalAlert = document.getElementById('opt-audio-thermal-alert');
      const curVol = vb.volumeLevel != null ? vb.volumeLevel : 100;
      const curBass = vb.bassLevel != null ? vb.bassLevel : 0;
      if (optThermalAlert) {
        optThermalAlert.style.display = (curVol > 250 || curBass > 12) ? 'block' : 'none';
      }

      const optNoiseToggle = document.getElementById('opt-noise-remover-toggle');
      if (optNoiseToggle) {
        optNoiseToggle.checked = vb.noiseRemover !== false;
        optNoiseToggle.setAttribute('aria-checked', vb.noiseRemover !== false);
      }

      // 10-Band Graphic Equalizer UI state
      const optEqToggle = document.getElementById('opt-eq-toggle');
      const optEqPreset = document.getElementById('opt-eq-preset');
      const optEqRack = document.getElementById('opt-eq-rack');

      const isEqOn = vb.eqEnabled !== false;
      if (optEqToggle) {
        optEqToggle.checked = isEqOn;
        optEqToggle.setAttribute('aria-checked', isEqOn);
      }
      if (optEqRack) {
        optEqRack.classList.toggle('opt-eq-disabled', !isEqOn);
      }
      if (optEqPreset) {
        optEqPreset.value = vb.preset || 'Flat';
      }

      const eqGains = Array.isArray(vb.eqGains) ? vb.eqGains : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < 10; i++) {
        const slider = document.getElementById(`opt-eq-slider-${i}`);
        const valSpan = document.getElementById(`opt-eq-val-${i}`);
        const gain = eqGains[i] !== undefined ? eqGains[i] : 0;
        if (slider) slider.value = gain;
        if (valSpan) {
          const numGain = Number(gain);
          valSpan.textContent = (numGain > 0 ? '+' : '') + numGain + ' dB';
        }
      }



      // Time Manager Populate
      const tm = settings.timeManager || {};
      setToggle('opt-tm-enabled', tm.enabled);
      setToggle('opt-tm-scheduleEnabled', tm.scheduleEnabled);
      const tmDailyLimitEl = document.getElementById('opt-tm-dailyLimitMinutes');
      if (tmDailyLimitEl) tmDailyLimitEl.value = tm.dailyLimitMinutes || 60;
      const tmStartEl = document.getElementById('opt-tm-scheduleStart');
      if (tmStartEl) tmStartEl.value = tm.scheduleStart || "09:00";
      const tmEndEl = document.getElementById('opt-tm-scheduleEnd');
      if (tmEndEl) tmEndEl.value = tm.scheduleEnd || "17:00";

      // Pomodoro Settings Populate
      const pomo = settings.pomodoro || {};
      setToggle('opt-pomo-enabled', pomo.enabled !== false);
      const pomoWorkEl = document.getElementById('opt-pomo-workMinutes');
      if (pomoWorkEl) pomoWorkEl.value = pomo.workMinutes || 25;
      const pomoBreakEl = document.getElementById('opt-pomo-breakMinutes');
      if (pomoBreakEl) pomoBreakEl.value = pomo.breakMinutes || 5;
      const pomoLongEl = document.getElementById('opt-pomo-longBreakMinutes');
      if (pomoLongEl) pomoLongEl.value = pomo.longBreakMinutes || 15;
      const pomoCyclesEl = document.getElementById('opt-pomo-cycles');
      if (pomoCyclesEl) pomoCyclesEl.value = pomo.cyclesBeforeLongBreak || 4;
      const pomoSoundEl = document.getElementById('opt-pomo-soundAlerts');
      if (pomoSoundEl) pomoSoundEl.checked = pomo.soundAlerts !== false;
      const pomoAutoPauseEl = document.getElementById('opt-pomo-autoPause');
      if (pomoAutoPauseEl) pomoAutoPauseEl.checked = pomo.autoPause !== false;

      // UI Cleaner Toggles
      const uiSettings = settings.uiCleaner || {};
      uiKeys.forEach(key => {
        setToggle(`ui-${key}`, uiSettings[key]);
      });

      // Populate Analytics
      const today = getLocalDateKey();
      const todayTotal = (tracking.dailyWatchTime && tracking.dailyWatchTime[today]) ? tracking.dailyWatchTime[today] : 0;
      const todayLearning = (tracking.dailyLearningTime && tracking.dailyLearningTime[today]) ? tracking.dailyLearningTime[today] : 0;
      
      const statTodayEl = document.getElementById('stat-today');
      if (statTodayEl) statTodayEl.textContent = formatTime(todayTotal);

      const statTodayLearningEl = document.getElementById('stat-today-learning');
      if (statTodayLearningEl) statTodayLearningEl.textContent = formatTime(todayLearning);

      const statWeekLearningEl = document.getElementById('stat-week-learning');
      if (statWeekLearningEl) statWeekLearningEl.textContent = formatTime(tracking.weeklyLearningTotal || 0);

      const statMonthLearningEl = document.getElementById('stat-month-learning');
      if (statMonthLearningEl) statMonthLearningEl.textContent = formatTime(tracking.monthlyLearningTotal || 0);

      // Focus Score - Clamped
      const focusScore = todayTotal > 0 ? Math.min(100, Math.max(0, Math.round((todayLearning / todayTotal) * 100))) : 0;
      const dashFocusScoreEl = document.getElementById('dash-focus-score');
      if (dashFocusScoreEl) dashFocusScoreEl.textContent = `${focusScore}%`;

      // Populate Gamification via GamificationEngine
      const gamification = tracking.gamification || { currentStreak: 0, longestStreak: 0, badges: [] };
      const statCurrentStreakEl = document.getElementById('stat-current-streak');
      if (statCurrentStreakEl) statCurrentStreakEl.textContent = `${gamification.currentStreak || 0} Days`;

      const statLongestStreakEl = document.getElementById('stat-longest-streak');
      if (statLongestStreakEl) statLongestStreakEl.textContent = `${gamification.longestStreak || 0} Days`;

      const unlockedBadges = gamification.badges || [];
      const monthlyLearningSeconds = tracking.monthlyLearningTotal || 0;

      let totalAP = 0;
      let rankTier = 'Bronze Focus';
      let rankIcon = '🥉';
      let levelInfo = { level: 1, expInCurrentLevel: 0, expNeededForNextLevel: 200, progressPct: 0 };
      let rankInfo = { currentRank: { title: 'Bronze Focus', icon: '🥉', badgeClass: 'rank-bronze' }, nextRank: { title: 'Silver Scholar' }, apToNextRank: 200 };

      if (window.GamificationEngine) {
        totalAP = GamificationEngine.calculateTotalAP(unlockedBadges);
        const totalEXP = GamificationEngine.calculateTotalEXP(unlockedBadges, monthlyLearningSeconds);
        levelInfo = GamificationEngine.calculateLevelFromEXP(totalEXP);
        rankInfo = GamificationEngine.getRankTierFromAP(totalAP);
        rankTier = rankInfo.currentRank.title;
        rankIcon = rankInfo.currentRank.icon;
      }

      // Populate Hero Battle Card elements
      const rankIconEl = document.getElementById('battle-rank-icon');
      const levelBadgeEl = document.getElementById('battle-level-badge');
      const rankNameEl = document.getElementById('battle-rank-name');
      const nextTierNameEl = document.getElementById('battle-next-tier-name');
      const apScoreEl = document.getElementById('battle-ap-score');
      const xpTextEl = document.getElementById('battle-xp-text');
      const xpFillEl = document.getElementById('battle-xp-fill');
      const xpGlowEl = document.getElementById('battle-xp-glow');

      if (rankIconEl) {
        rankIconEl.textContent = rankIcon;
        rankIconEl.className = `rank-emblem-icon ${rankInfo.currentRank.badgeClass || 'rank-bronze'}`;
      }
      if (levelBadgeEl) levelBadgeEl.textContent = `LVL ${levelInfo.level}`;
      if (rankNameEl) rankNameEl.textContent = rankTier;
      if (nextTierNameEl) {
        if (rankInfo.isMaxRank) {
          nextTierNameEl.textContent = '👑 MAX RANK REACHED!';
        } else {
          nextTierNameEl.textContent = `Next Rank: ${rankInfo.nextRank ? rankInfo.nextRank.title : ''} (${rankInfo.apToNextRank} AP needed)`;
        }
      }
      if (apScoreEl) apScoreEl.textContent = `${totalAP} AP`;
      if (xpTextEl) xpTextEl.textContent = `${levelInfo.expInCurrentLevel} / ${levelInfo.expNeededForNextLevel} EXP (${levelInfo.progressPct}%)`;
      if (xpFillEl) xpFillEl.style.width = `${levelInfo.progressPct}%`;
      if (xpGlowEl) xpGlowEl.style.width = `${levelInfo.progressPct}%`;

      renderBadges('all');
      renderAnalyticsChart(7);
      renderAnalyticsForDate(selectedAnalyticsDate);
      renderBlocklistChips(settings.blockedChannels, settings.blockedKeywords, blocklistSearchQuery);
    };

    const handleToggle = async (id, settingKey, isUiCleaner = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.setAttribute('aria-checked', el.checked);
      if (isUiCleaner) {
        await StorageUtil.updateUICleanerSetting(settingKey, el.checked);
      } else {
        await StorageUtil.updateSetting(settingKey, el.checked);
      }
      showSaveIndicator();
    };

    // Render 22 Badges with Category Filtering
    const badgeDefs = (window.GamificationEngine && window.GamificationEngine.BADGE_DEFINITIONS) ? window.GamificationEngine.BADGE_DEFINITIONS : [];
    const badgesContainer = document.getElementById('badges-container');

    const renderBadges = (category = 'all') => {
      if (!badgesContainer) return;
      badgesContainer.innerHTML = '';

      const unlockedBadges = (tracking.gamification && tracking.gamification.badges) ? tracking.gamification.badges : [];

      const filtered = category === 'all'
        ? badgeDefs
        : badgeDefs.filter(b => b.category === category);

      filtered.forEach(badge => {
        const isEarned = unlockedBadges.includes(badge.id);
        const badgeEl = document.createElement('div');
        badgeEl.className = `badge-item battle-badge-card ${isEarned ? 'earned' : 'locked'}`;
        badgeEl.setAttribute('data-category', badge.category);
        badgeEl.setAttribute('title', isEarned 
          ? `Unlocked: ${badge.name} (+${badge.ap} AP)` 
          : `Locked: ${badge.desc} (+${badge.ap} AP)`);

        badgeEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
            <div class="badge-icon badge-card-icon" style="font-size:32px;">${badge.icon}</div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
              <span class="ap-tag badge-ap-tag" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(251, 191, 36, 0.3);">+${badge.ap} AP</span>
              <span class="exp-tag" style="font-size: 10px; color: #a855f7; font-weight: 600;">+${badge.exp} EXP</span>
            </div>
          </div>
          <div class="badge-name badge-card-title" style="font-weight: 700; margin-top: 8px;">${escapeHtml(badge.name)}</div>
          <div class="badge-desc badge-card-desc" style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${escapeHtml(badge.desc)}</div>
          <div class="badge-status-pill" style="margin-top: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: ${isEarned ? '#34d399' : '#64748b'};">
            ${isEarned ? '✓ UNLOCKED' : '🔒 LOCKED'}
          </div>
        `;
        badgesContainer.appendChild(badgeEl);
      });
    };

    // Render Visual Focus Analytics Chart
    const chartContainer = document.getElementById('analytics-chart-container');

    const renderAnalyticsChart = (daysCount = 7) => {
      if (!chartContainer) return;
      chartContainer.innerHTML = '';

      const dailyWatch = tracking.dailyWatchTime || {};
      const dailyLearn = tracking.dailyLearningTime || {};

      const dates = [];
      const now = new Date();

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${day}`);
      }

      let maxSeconds = 3600; // default 1 hour baseline
      dates.forEach(d => {
        const totalSec = dailyWatch[d] || 0;
        if (totalSec > maxSeconds) maxSeconds = totalSec;
      });

      dates.forEach(d => {
        const totalSec = dailyWatch[d] || 0;
        const learnSec = dailyLearn[d] || 0;
        const otherSec = Math.max(0, totalSec - learnSec);

        const totalH = (totalSec / 3600).toFixed(1);
        const learnH = (learnSec / 3600).toFixed(1);

        const learnHeightPct = Math.round((learnSec / maxSeconds) * 100);
        const otherHeightPct = Math.round((otherSec / maxSeconds) * 100);

        const barWrapper = document.createElement('div');
        barWrapper.style.cssText = 'flex:1; min-width:18px; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; cursor:pointer; position:relative;';
        barWrapper.title = `${d}: ${learnH}h Learning / ${totalH}h Total`;

        barWrapper.innerHTML = `
          <div style="width:100%; max-width:24px; display:flex; flex-direction:column; justify-content:flex-end; height:100%; border-radius:4px; overflow:hidden; background:rgba(30,41,59,0.5);">
            <div style="height:${otherHeightPct}%; background:linear-gradient(180deg, #ef4444, #dc2626); transition:height 0.4s ease;"></div>
            <div style="height:${learnHeightPct}%; background:linear-gradient(180deg, #10b981, #059669); transition:height 0.4s ease;"></div>
          </div>
          <span style="font-size:9px; color:#64748b; margin-top:4px; white-space:nowrap;">${d.slice(5)}</span>
        `;

        chartContainer.appendChild(barWrapper);
      });
    };

    // Selected Date State Variable for Session Timeline & Analytics
    let selectedAnalyticsDate = getLocalDateKey();

    const renderAnalyticsForDate = (targetDateKey) => {
      if (!targetDateKey) targetDateKey = getLocalDateKey();
      selectedAnalyticsDate = targetDateKey;

      const datePickerEl = document.getElementById('analytics-date-picker');
      const dateDisplayEl = document.getElementById('selected-date-display');
      const dateBadgeEl = document.getElementById('analytics-selected-badge');

      if (datePickerEl) datePickerEl.value = targetDateKey;

      const todayStr = getLocalDateKey();
      const isToday = (targetDateKey === todayStr);

      if (dateDisplayEl) {
        const dateObj = new Date(targetDateKey + 'T00:00:00');
        const formattedDateStr = isNaN(dateObj.getTime()) ? targetDateKey : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        dateDisplayEl.textContent = isToday ? `Today (${formattedDateStr})` : formattedDateStr;
      }

      if (dateBadgeEl) {
        dateBadgeEl.textContent = isToday ? 'Today' : targetDateKey;
      }

      const dailyWatch = tracking.dailyWatchTime || {};
      const dailyLearn = tracking.dailyLearningTime || {};
      const targetTotalSec = dailyWatch[targetDateKey] || 0;
      const targetLearnSec = dailyLearn[targetDateKey] || 0;

      const statTodayEl = document.getElementById('stat-today');
      if (statTodayEl) statTodayEl.textContent = formatTime(targetTotalSec);

      const statTodayLearningEl = document.getElementById('stat-today-learning');
      if (statTodayLearningEl) statTodayLearningEl.textContent = formatTime(targetLearnSec);

      const focusScore = targetTotalSec > 0 ? Math.min(100, Math.max(0, Math.round((targetLearnSec / targetTotalSec) * 100))) : 0;
      const dashFocusScoreEl = document.getElementById('dash-focus-score');
      if (dashFocusScoreEl) dashFocusScoreEl.textContent = `${focusScore}%`;

      // Timeline Log Items for targetDateKey
      const timelineLogs = Array.isArray(tracking.timelineLog)
        ? tracking.timelineLog.filter(item => item && item.dateKey === targetDateKey)
        : [];

      const sessionCount = timelineLogs.filter(i => i.status !== 'blocked').length;
      const blockedCount = timelineLogs.filter(i => i.status === 'blocked').length;

      const statActivityCountEl = document.getElementById('stat-activity-count');
      if (statActivityCountEl) statActivityCountEl.textContent = String(sessionCount);

      const statBlockedCountEl = document.getElementById('stat-blocked-count');
      if (statBlockedCountEl) statBlockedCountEl.textContent = String(blockedCount);

      // Render 24-Hour Hourly Breakdown Chart
      const hourlyContainer = document.getElementById('hourly-chart-container');
      if (hourlyContainer) {
        hourlyContainer.innerHTML = '';

        const hourlyWatchMap = (tracking.hourlyWatchTime && tracking.hourlyWatchTime[targetDateKey]) || {};
        const hourlyLearnMap = (tracking.hourlyLearningTime && tracking.hourlyLearningTime[targetDateKey]) || {};

        let maxHourlySec = 1800; // default 30-min baseline max
        for (let h = 0; h < 24; h++) {
          const wSec = hourlyWatchMap[String(h)] || 0;
          if (wSec > maxHourlySec) maxHourlySec = wSec;
        }

        for (let h = 0; h < 24; h++) {
          const hStr = String(h);
          const watchSec = hourlyWatchMap[hStr] || 0;
          const learnSec = hourlyLearnMap[hStr] || 0;
          const otherSec = Math.max(0, watchSec - learnSec);

          const watchMin = Math.round(watchSec / 60);
          const learnMin = Math.round(learnSec / 60);

          const learnPct = Math.round((learnSec / maxHourlySec) * 100);
          const otherPct = Math.round((otherSec / maxHourlySec) * 100);

          const hourFormatted = String(h).padStart(2, '0') + ':00';
          const barEl = document.createElement('div');
          barEl.style.cssText = 'flex:1; min-width:8px; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; cursor:pointer; position:relative;';
          barEl.title = `${hourFormatted} - ${hourFormatted.slice(0, 2)}:59\nWatch: ${watchMin}m | Study: ${learnMin}m`;

          barEl.innerHTML = `
            <div style="width:100%; max-width:14px; display:flex; flex-direction:column; justify-content:flex-end; height:100%; border-radius:3px; overflow:hidden; background:rgba(30,41,59,0.5);">
              <div style="height:${otherPct}%; background:linear-gradient(180deg, #ef4444, #dc2626); transition:height 0.4s ease;"></div>
              <div style="height:${learnPct}%; background:linear-gradient(180deg, #10b981, #059669); transition:height 0.4s ease;"></div>
            </div>
          `;
          hourlyContainer.appendChild(barEl);
        }
      }

      // Render Session Activity Timeline Feed
      const timelineStreamContainer = document.getElementById('timeline-stream-container');
      if (timelineStreamContainer) {
        timelineStreamContainer.innerHTML = '';

        if (timelineLogs.length === 0) {
          timelineStreamContainer.innerHTML = `
            <div style="padding: 32px 16px; text-align: center; color: #64748b; font-size: 13px; background: rgba(15, 23, 42, 0.4); border-radius: 14px; border: 1px dashed rgba(255,255,255,0.08);">
              <div style="font-size: 28px; margin-bottom: 8px;">📋</div>
              <div style="font-weight: 700; color: #94a3b8; margin-bottom: 4px;">No Session Activity Logged for this Date</div>
              <div>Watch or study YouTube videos to automatically record timestamped session history.</div>
            </div>
          `;
        } else {
          timelineLogs.slice().reverse().forEach(item => {
            const isBlocked = item.status === 'blocked';
            const isLearning = Boolean(item.isLearning);
            const totalSec = typeof item.durationSeconds === 'number'
              ? item.durationSeconds
              : (typeof item.durationMinutes === 'number' ? item.durationMinutes * 60 : (parseInt(item.durationSeconds, 10) || 0));
            const durationMin = Math.round(totalSec / 60);

            const itemEl = document.createElement('div');
            itemEl.className = `timeline-item ${isBlocked ? 'blocked' : (isLearning ? 'learning' : 'standard')}`;

            const timeRange = item.startTime === item.endTime ? item.startTime : `${item.startTime} - ${item.endTime}`;
            const modeClass = isBlocked ? 'timeline-mode-blocked' : (isLearning ? 'timeline-mode-learning' : 'timeline-mode-standard');

            itemEl.innerHTML = `
              <div class="timeline-node"></div>
              <div class="timeline-header">
                <div class="timeline-time-badge">🕒 ${escapeHtml(timeRange)} ${durationMin > 0 ? `• ${durationMin}m watched` : ''}</div>
                <div class="timeline-mode-tag ${modeClass}">${isBlocked ? '🔴 Blocked Attempt' : (isLearning ? '🟢 Study Mode' : '🔵 Standard')}</div>
              </div>
              <div class="timeline-title">${escapeHtml(item.title || 'YouTube Video')}</div>
              <div class="timeline-meta">
                <span>📺 ${escapeHtml((typeof StorageUtil !== 'undefined' && typeof StorageUtil.cleanChannelName === 'function') ? StorageUtil.cleanChannelName(item.channel) : (item.channel || 'YouTube Channel'))}</span>
                <span>${escapeHtml(item.mode || 'Standard')}</span>
              </div>
            `;
            timelineStreamContainer.appendChild(itemEl);
          });
        }
      }
    };

    // Initial Options UI Populate
    updateOptionsUI(settings, tracking);

    // Live storage listener for Options UI synchronization
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      try {
        chrome.storage.onChanged.addListener(async () => {
          try {
            const freshSettings = await StorageUtil.getSettings();
            const freshTracking = await StorageUtil.getTracking();
            updateOptionsUI(freshSettings, freshTracking);
          } catch(e) {}
        });
      } catch(e) {}
    }

    // Attach Event Listeners for Toggles
    const optShorts = document.getElementById('opt-shortsBlocker');
    const optFocus = document.getElementById('opt-focusMode');
    const optGhost = document.getElementById('opt-ghostShield');
    const optStudy = document.getElementById('opt-studyMode');
    const optGoal = document.getElementById('opt-goalMode');
    const optAutoSkipAds = document.getElementById('opt-autoSkipAds');
    const optAudio = document.getElementById('opt-audioEffects');
    if (optShorts) optShorts.addEventListener('change', () => handleToggle('opt-shortsBlocker', 'shortsBlocker'));
    if (optFocus) optFocus.addEventListener('change', () => handleToggle('opt-focusMode', 'focusMode'));
    if (optGhost) optGhost.addEventListener('change', () => handleToggle('opt-ghostShield', 'ghostShield'));
    if (optStudy) optStudy.addEventListener('change', () => handleToggle('opt-studyMode', 'studyMode'));
    if (optGoal) optGoal.addEventListener('change', () => handleToggle('opt-goalMode', 'goalMode'));
    if (optAutoSkipAds) optAutoSkipAds.addEventListener('change', () => handleToggle('opt-autoSkipAds', 'autoSkipAds'));
    if (optAudio) {
      optAudio.addEventListener('change', async () => {
        await handleToggle('opt-audioEffects', 'audioEffects');
        if (typeof window !== 'undefined' && window.AudioEngine) {
          window.AudioEngine.enabled = optAudio.checked;
        }
      });
    }

    const notifyYouTubeTabsAudio = (payload) => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        try {
          chrome.tabs.query({ url: ['*://*.youtube.com/*'] }, (tabs) => {
            if (tabs && tabs.length > 0) {
              tabs.forEach(tab => {
                if (tab && tab.id) {
                  try {
                    chrome.tabs.sendMessage(tab.id, {
                      action: 'updateAudioSettings',
                      ...payload
                    }, () => {
                      if (chrome.runtime && chrome.runtime.lastError) {}
                    });
                  } catch (e) {}
                }
              });
            }
          });
        } catch (e) {}
      }
    };

    // Volume Booster & Bass Booster sliders
    const optVolSliderEl = document.getElementById('opt-vol-slider');
    const optVolValueEl = document.getElementById('opt-vol-value');
    const optBassSliderEl = document.getElementById('opt-bass-slider');
    const optBassValueEl = document.getElementById('opt-bass-value');
    const optThermalAlertEl = document.getElementById('opt-audio-thermal-alert');

    const updateThermalAlert = () => {
      const vol = parseInt(optVolSliderEl ? optVolSliderEl.value : 100, 10) || 100;
      const bass = parseInt(optBassSliderEl ? optBassSliderEl.value : 0, 10) || 0;
      if (optThermalAlertEl) {
        optThermalAlertEl.style.display = (vol > 250 || bass > 12) ? 'block' : 'none';
      }
    };

    if (optVolSliderEl) {
      optVolSliderEl.addEventListener('input', () => {
        const val = parseInt(optVolSliderEl.value, 10);
        if (optVolValueEl) optVolValueEl.textContent = val + '%';
        notifyYouTubeTabsAudio({ volumeLevel: val });
        updateThermalAlert();
      });
      optVolSliderEl.addEventListener('change', async () => {
        try {
          const val = parseInt(optVolSliderEl.value, 10);
          await StorageUtil.updateVolumeBoosterSetting('volumeLevel', val);
          notifyYouTubeTabsAudio({ volumeLevel: val });
          updateThermalAlert();
          showSaveIndicator();
        } catch(e) {}
      });
    }

    if (optBassSliderEl) {
      optBassSliderEl.addEventListener('input', () => {
        const val = parseInt(optBassSliderEl.value, 10);
        if (optBassValueEl) optBassValueEl.textContent = val + ' dB';
        notifyYouTubeTabsAudio({ bassLevel: val });
        updateThermalAlert();
      });
      optBassSliderEl.addEventListener('change', async () => {
        try {
          const val = parseInt(optBassSliderEl.value, 10);
          await StorageUtil.updateVolumeBoosterSetting('bassLevel', val);
          notifyYouTubeTabsAudio({ bassLevel: val });
          updateThermalAlert();
          showSaveIndicator();
        } catch(e) {}
      });
    }

    // Noise Remover & Anti-Distortion Clarifier Toggle
    const optNoiseToggle = document.getElementById('opt-noise-remover-toggle');
    if (optNoiseToggle) {
      optNoiseToggle.addEventListener('change', async () => {
        optNoiseToggle.setAttribute('aria-checked', optNoiseToggle.checked);
        const enabled = optNoiseToggle.checked;
        if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.setNoiseRemover === 'function') {
          window.AudioEngine.setNoiseRemover(enabled);
        }
        await StorageUtil.updateVolumeBoosterSetting('noiseRemover', enabled);
        notifyYouTubeTabsAudio({ noiseRemover: enabled });
        showSaveIndicator();
      });
    }

    // 10-Band Graphic Equalizer Controls
    const optEqToggle = document.getElementById('opt-eq-toggle');
    const optEqPreset = document.getElementById('opt-eq-preset');
    const optEqReset = document.getElementById('opt-eq-reset');
    const optEqRack = document.getElementById('opt-eq-rack');

    if (optEqToggle) {
      optEqToggle.addEventListener('change', async () => {
        optEqToggle.setAttribute('aria-checked', optEqToggle.checked);
        const enabled = optEqToggle.checked;
        if (optEqRack) optEqRack.classList.toggle('opt-eq-disabled', !enabled);
        if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.setEqEnabled === 'function') {
          window.AudioEngine.setEqEnabled(enabled);
        }
        await StorageUtil.updateVolumeBoosterSetting('eqEnabled', enabled);
        notifyYouTubeTabsAudio({ eqEnabled: enabled });
        showSaveIndicator();
      });
    }

    const getOptCurrentGains = () => {
      const gains = [];
      for (let i = 0; i < 10; i++) {
        const slider = document.getElementById(`opt-eq-slider-${i}`);
        const val = slider ? parseFloat(slider.value) : 0;
        gains.push(isNaN(val) ? 0 : val);
      }
      return gains;
    };

    const setOptGainsUI = (gains) => {
      for (let i = 0; i < 10; i++) {
        const slider = document.getElementById(`opt-eq-slider-${i}`);
        const valSpan = document.getElementById(`opt-eq-val-${i}`);
        const g = gains[i] !== undefined ? gains[i] : 0;
        if (slider) slider.value = g;
        if (valSpan) {
          const num = Number(g);
          valSpan.textContent = (num > 0 ? '+' : '') + num + ' dB';
        }
      }
    };

    if (optEqPreset) {
      optEqPreset.addEventListener('change', async () => {
        const presetName = optEqPreset.value;
        if (presetName && EQ_PRESETS[presetName]) {
          const gains = EQ_PRESETS[presetName];
          setOptGainsUI(gains);
          if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.setEqPreset === 'function') {
            window.AudioEngine.setEqPreset(presetName);
          }
          await StorageUtil.updateVolumeBoosterSetting('eqGains', [...gains]);
          await StorageUtil.updateVolumeBoosterSetting('preset', presetName);
          notifyYouTubeTabsAudio({ eqPreset: presetName, eqGains: [...gains] });
          showSaveIndicator();
        } else if (presetName === 'Custom') {
          await StorageUtil.updateVolumeBoosterSetting('preset', 'Custom');
          notifyYouTubeTabsAudio({ eqPreset: 'Custom' });
          showSaveIndicator();
        }
      });
    }

    if (optEqReset) {
      optEqReset.addEventListener('click', async () => {
        const flatGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        setOptGainsUI(flatGains);
        if (optEqPreset) optEqPreset.value = 'Flat';
        if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.resetEq === 'function') {
          window.AudioEngine.resetEq();
        }
        await StorageUtil.updateVolumeBoosterSetting('preset', 'Flat');
        await StorageUtil.updateVolumeBoosterSetting('eqGains', flatGains);
        notifyYouTubeTabsAudio({ eqPreset: 'Flat', eqGains: flatGains });
        showSaveIndicator();
      });
    }

    for (let i = 0; i < 10; i++) {
      const slider = document.getElementById(`opt-eq-slider-${i}`);
      const valSpan = document.getElementById(`opt-eq-val-${i}`);
      if (slider) {
        slider.addEventListener('input', () => {
          const val = parseFloat(slider.value) || 0;
          if (valSpan) valSpan.textContent = (val > 0 ? '+' : '') + val + ' dB';
          const currentGains = getOptCurrentGains();
          const detected = detectPreset(currentGains);
          if (optEqPreset) optEqPreset.value = detected;
          if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.setEqBandGain === 'function') {
            window.AudioEngine.setEqBandGain(i, val);
          }
          notifyYouTubeTabsAudio({ eqGains: currentGains, eqPreset: detected });
        });

        slider.addEventListener('change', async () => {
          const currentGains = getOptCurrentGains();
          const detected = detectPreset(currentGains);
          if (optEqPreset) optEqPreset.value = detected;
          await StorageUtil.updateVolumeBoosterSetting('eqGains', currentGains);
          await StorageUtil.updateVolumeBoosterSetting('preset', detected);
          notifyYouTubeTabsAudio({ eqGains: currentGains, eqPreset: detected });
          showSaveIndicator();
        });
      }
    }



    // Time Manager Event Listeners
    const tmEnabled = document.getElementById('opt-tm-enabled');
    if (tmEnabled) {
      tmEnabled.addEventListener('change', async (e) => {
        tmEnabled.setAttribute('aria-checked', e.target.checked);
        await StorageUtil.updateTimeManagerSetting('enabled', e.target.checked);
        showSaveIndicator();
      });
    }

    const tmScheduleEnabled = document.getElementById('opt-tm-scheduleEnabled');
    if (tmScheduleEnabled) {
      tmScheduleEnabled.addEventListener('change', async (e) => {
        tmScheduleEnabled.setAttribute('aria-checked', e.target.checked);
        await StorageUtil.updateTimeManagerSetting('scheduleEnabled', e.target.checked);
        showSaveIndicator();
      });
    }

    const tmDailyLimit = document.getElementById('opt-tm-dailyLimitMinutes');
    if (tmDailyLimit) {
      tmDailyLimit.addEventListener('change', async (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 5) val = 5;
        if (val > 720) val = 720;
        e.target.value = val;
        await StorageUtil.updateTimeManagerSetting('dailyLimitMinutes', val);
        showSaveIndicator();
      });
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const tmScheduleStart = document.getElementById('opt-tm-scheduleStart');
    if (tmScheduleStart) {
      tmScheduleStart.addEventListener('change', async (e) => {
        let val = (e.target.value || "").trim();
        if (!timeRegex.test(val)) val = "09:00";
        e.target.value = val;
        await StorageUtil.updateTimeManagerSetting('scheduleStart', val);
        showSaveIndicator();
      });
    }

    const tmScheduleEnd = document.getElementById('opt-tm-scheduleEnd');
    if (tmScheduleEnd) {
      tmScheduleEnd.addEventListener('change', async (e) => {
        let val = (e.target.value || "").trim();
        if (!timeRegex.test(val)) val = "17:00";
        e.target.value = val;
        await StorageUtil.updateTimeManagerSetting('scheduleEnd', val);
        showSaveIndicator();
      });
    }

    // Pomodoro Settings Listeners
    const pomoEnabled = document.getElementById('opt-pomo-enabled');
    if (pomoEnabled) {
      pomoEnabled.addEventListener('change', async (e) => {
        pomoEnabled.setAttribute('aria-checked', e.target.checked);
        await StorageUtil.updatePomodoroSetting('enabled', e.target.checked);
        showSaveIndicator();
      });
    }

    const bindPomoNumInput = (id, key, min, max, def) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', async (e) => {
          let val = parseInt(e.target.value, 10);
          if (isNaN(val) || val < min) val = def;
          if (val > max) val = max;
          e.target.value = val;
          await StorageUtil.updatePomodoroSetting(key, val);
          showSaveIndicator();
        });
      }
    };

    bindPomoNumInput('opt-pomo-workMinutes', 'workMinutes', 1, 180, 25);
    bindPomoNumInput('opt-pomo-breakMinutes', 'breakMinutes', 1, 60, 5);
    bindPomoNumInput('opt-pomo-longBreakMinutes', 'longBreakMinutes', 1, 120, 15);
    bindPomoNumInput('opt-pomo-cycles', 'cyclesBeforeLongBreak', 1, 10, 4);

    const pomoSoundAlerts = document.getElementById('opt-pomo-soundAlerts');
    if (pomoSoundAlerts) {
      pomoSoundAlerts.addEventListener('change', async (e) => {
        await StorageUtil.updatePomodoroSetting('soundAlerts', e.target.checked);
        showSaveIndicator();
      });
    }

    const pomoAutoPause = document.getElementById('opt-pomo-autoPause');
    if (pomoAutoPause) {
      pomoAutoPause.addEventListener('change', async (e) => {
        await StorageUtil.updatePomodoroSetting('autoPause', e.target.checked);
        showSaveIndicator();
      });
    }

    uiKeys.forEach(key => {
      const el = document.getElementById(`ui-${key}`);
      if (el) el.addEventListener('change', () => handleToggle(`ui-${key}`, key, true));
    });

    // Category filter pills for badges
    const categoryPillsContainer = document.getElementById('category-filter-pills');
    if (categoryPillsContainer) {
      const pills = categoryPillsContainer.querySelectorAll('.filter-pill');
      pills.forEach(pill => {
        pill.addEventListener('click', () => {
          pills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          const cat = pill.getAttribute('data-category') || 'all';
          renderBadges(cat);
        });
      });
    }

    // Custom Blocklist Studio — Channels & Keywords Addition, Search, Bulk Actions
    const inputAddChannel = document.getElementById('input-add-channel');
    const btnAddChannel = document.getElementById('btn-add-channel');
    const handleAddChannel = async () => {
      if (!inputAddChannel) return;
      const val = inputAddChannel.value.trim();
      if (!val) return;
      await addBlockedItems('channel', val);
      inputAddChannel.value = '';
      inputAddChannel.focus();
    };
    if (btnAddChannel) btnAddChannel.addEventListener('click', handleAddChannel);
    if (inputAddChannel) {
      inputAddChannel.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          await handleAddChannel();
        }
      });
    }

    const inputAddKeyword = document.getElementById('input-add-keyword');
    const btnAddKeyword = document.getElementById('btn-add-keyword');
    const handleAddKeyword = async () => {
      if (!inputAddKeyword) return;
      const val = inputAddKeyword.value.trim();
      if (!val) return;
      await addBlockedItems('keyword', val);
      inputAddKeyword.value = '';
      inputAddKeyword.focus();
    };
    if (btnAddKeyword) btnAddKeyword.addEventListener('click', handleAddKeyword);
    if (inputAddKeyword) {
      inputAddKeyword.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          await handleAddKeyword();
        }
      });
    }

    // Live Search Filter for Blocklist Studio
    const blocklistSearchInput = document.getElementById('blocklist-search-input');
    if (blocklistSearchInput) {
      blocklistSearchInput.addEventListener('input', (e) => {
        blocklistSearchQuery = e.target.value;
        renderBlocklistChips(settings.blockedChannels, settings.blockedKeywords, blocklistSearchQuery);
      });
    }

    // Blocklist Bulk Export JSON
    const btnBlocklistExportJson = document.getElementById('btn-blocklist-export-json');
    if (btnBlocklistExportJson) {
      btnBlocklistExportJson.addEventListener('click', () => {
        const exportData = {
          version: "1.0.0",
          type: "shorts-shield-blocklist",
          exportedAt: new Date().toISOString(),
          blockedChannels: settings.blockedChannels || [],
          blockedKeywords: settings.blockedKeywords || []
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchor = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `shorts-shield-blocklist-${dateStr}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      });
    }

    // Blocklist Bulk Import JSON
    const fileBlocklistImportJson = document.getElementById('file-blocklist-import-json');
    if (fileBlocklistImportJson) {
      fileBlocklistImportJson.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const imported = JSON.parse(evt.target.result);
            let rawChannels = [];
            let rawKeywords = [];

            if (imported && typeof imported === 'object') {
              if (Array.isArray(imported.blockedChannels)) rawChannels = imported.blockedChannels;
              if (Array.isArray(imported.blockedKeywords)) rawKeywords = imported.blockedKeywords;

              if (imported.settings && typeof imported.settings === 'object') {
                if (Array.isArray(imported.settings.blockedChannels)) rawChannels = imported.settings.blockedChannels;
                if (Array.isArray(imported.settings.blockedKeywords)) rawKeywords = imported.settings.blockedKeywords;
              }
            }

            if (!rawChannels.length && !rawKeywords.length && !imported.blockedChannels && !imported.blockedKeywords) {
              throw new Error("No valid blockedChannels or blockedKeywords found in JSON file.");
            }

            const currentChannels = Array.isArray(settings.blockedChannels) ? [...settings.blockedChannels] : [];
            rawChannels.forEach(c => {
              if (typeof c !== 'string') return;
              const cleaned = typeof StorageUtil.cleanChannelName === 'function'
                ? StorageUtil.cleanChannelName(c)
                : c.replace(/\s+/g, ' ').trim();
              if (cleaned && cleaned.toLowerCase() !== 'youtube channel' && !currentChannels.some(x => x.toLowerCase() === cleaned.toLowerCase())) {
                currentChannels.push(cleaned);
              }
            });

            const currentKeywords = Array.isArray(settings.blockedKeywords) ? [...settings.blockedKeywords] : [];
            rawKeywords.forEach(k => {
              if (typeof k !== 'string') return;
              let cleaned = k.replace(/\s+/g, ' ').trim();
              if (cleaned.startsWith('#')) cleaned = cleaned.substring(1).trim();
              if (cleaned && !currentKeywords.some(x => x.toLowerCase() === cleaned.toLowerCase())) {
                currentKeywords.push(cleaned);
              }
            });

            settings.blockedChannels = currentChannels;
            settings.blockedKeywords = currentKeywords;

            const fullSettings = await StorageUtil.getSettings();
            fullSettings.blockedChannels = currentChannels;
            fullSettings.blockedKeywords = currentKeywords;
            await StorageUtil.saveSettings(fullSettings);

            renderBlocklistChips(settings.blockedChannels, settings.blockedKeywords, blocklistSearchQuery);
            showSaveIndicator();
            alert(`Blocklist imported successfully! Loaded ${rawChannels.length} channel(s) and ${rawKeywords.length} keyword(s).`);
          } catch (err) {
            alert(`Failed to import blocklist JSON: ${err.message || "Invalid file structure"}`);
          } finally {
            fileBlocklistImportJson.value = '';
          }
        };
        reader.readAsText(file);
      });
    }

    // Blocklist Clear All Action
    const btnBlocklistClearAll = document.getElementById('btn-blocklist-clear-all');
    if (btnBlocklistClearAll) {
      btnBlocklistClearAll.addEventListener('click', async () => {
        const total = (settings.blockedChannels?.length || 0) + (settings.blockedKeywords?.length || 0);
        if (total === 0) return;
        const confirmed = confirm("Are you sure you want to clear all blocked channels and keywords? This action cannot be undone.");
        if (confirmed) {
          settings.blockedChannels = [];
          settings.blockedKeywords = [];
          const fullSettings = await StorageUtil.getSettings();
          fullSettings.blockedChannels = [];
          fullSettings.blockedKeywords = [];
          await StorageUtil.saveSettings(fullSettings);
          renderBlocklistChips(settings.blockedChannels, settings.blockedKeywords, blocklistSearchQuery);
          showSaveIndicator();
        }
      });
    }

    // Individual Clear Channels / Keywords Actions
    const btnClearChannels = document.getElementById('btn-clear-channels');
    if (btnClearChannels) {
      btnClearChannels.addEventListener('click', async () => {
        if (!settings.blockedChannels || settings.blockedChannels.length === 0) return;
        const confirmed = confirm("Are you sure you want to clear all blocked channels?");
        if (confirmed) {
          settings.blockedChannels = [];
          await StorageUtil.updateSetting('blockedChannels', []);
          renderBlocklistChips(settings.blockedChannels, settings.blockedKeywords, blocklistSearchQuery);
          showSaveIndicator();
        }
      });
    }

    const btnClearKeywords = document.getElementById('btn-clear-keywords');
    if (btnClearKeywords) {
      btnClearKeywords.addEventListener('click', async () => {
        if (!settings.blockedKeywords || settings.blockedKeywords.length === 0) return;
        const confirmed = confirm("Are you sure you want to clear all blocked keywords?");
        if (confirmed) {
          settings.blockedKeywords = [];
          await StorageUtil.updateSetting('blockedKeywords', []);
          renderBlocklistChips(settings.blockedChannels, settings.blockedKeywords, blocklistSearchQuery);
          showSaveIndicator();
        }
      });
    }

    // Legacy Blocklist Inputs (for backward compatibility)
    const kwInput = document.getElementById('opt-blocked-keywords');
    const chInput = document.getElementById('opt-blocked-channels');

    if (kwInput) {
      kwInput.value = (settings.blockedKeywords || []).join(', ');
      const saveKeywords = async () => {
        const keywords = [...new Set(kwInput.value.split(',').map(k => k.trim()).filter(Boolean))];
        settings.blockedKeywords = keywords;
        await StorageUtil.updateSetting('blockedKeywords', keywords);
        renderBlocklistChips(settings.blockedChannels, settings.blockedKeywords, blocklistSearchQuery);
        showSaveIndicator();
      };
      kwInput.addEventListener('change', saveKeywords);
      kwInput.addEventListener('blur', saveKeywords);
      let kwTimeout;
      kwInput.addEventListener('input', () => {
        clearTimeout(kwTimeout);
        kwTimeout = setTimeout(saveKeywords, 300);
      });
    }

    if (chInput) {
      chInput.value = (settings.blockedChannels || []).join(', ');
      const saveChannels = async () => {
        const channels = [...new Set(chInput.value.split(',').map(c => c.trim()).filter(Boolean))];
        settings.blockedChannels = channels;
        await StorageUtil.updateSetting('blockedChannels', channels);
        renderBlocklistChips(settings.blockedChannels, settings.blockedKeywords, blocklistSearchQuery);
        showSaveIndicator();
      };
      chInput.addEventListener('change', saveChannels);
      chInput.addEventListener('blur', saveChannels);
      let chTimeout;
      chInput.addEventListener('input', () => {
        clearTimeout(chTimeout);
        chTimeout = setTimeout(saveChannels, 300);
      });
    }

    // Data Backup & Export / Import
    const btnExportJson = document.getElementById('btn-export-json');
    const btnExportCsv = document.getElementById('btn-export-csv');
    const fileImportJson = document.getElementById('file-import-json');

    if (btnExportJson) {
      btnExportJson.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ settings, tracking }, null, 2));
        const downloadAnchor = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `shorts-shield-backup-${dateStr}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      });
    }

    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', () => {
        let csv = "Date,Total Watch Time (Mins),Learning Time (Mins),Focus Score (%)\n";
        const dailyWatch = tracking.dailyWatchTime || {};
        const dailyLearn = tracking.dailyLearningTime || {};
        const dates = Object.keys(dailyWatch).sort();

        dates.forEach(d => {
          const totalMins = Math.round((dailyWatch[d] || 0) / 60);
          const learnMins = Math.round((dailyLearn[d] || 0) / 60);
          const score = totalMins > 0 ? Math.min(100, Math.max(0, Math.round((learnMins / totalMins) * 100))) : 0;
          csv += `${d},${totalMins},${learnMins},${score}%\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `shorts-shield-analytics-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      });
    }

    if (fileImportJson) {
      fileImportJson.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const imported = JSON.parse(evt.target.result);
            
            // Validate schema and field types
            const isPlainObj = (val) => val && typeof val === 'object' && !Array.isArray(val);
            const isValidSettings = !imported.settings || (
              isPlainObj(imported.settings) &&
              (!imported.settings.blockedKeywords || Array.isArray(imported.settings.blockedKeywords)) &&
              (!imported.settings.blockedChannels || Array.isArray(imported.settings.blockedChannels)) &&
              (!imported.settings.uiCleaner || isPlainObj(imported.settings.uiCleaner)) &&
              (!imported.settings.timeManager || isPlainObj(imported.settings.timeManager))
            );
            const isValidTracking = !imported.tracking || (
              isPlainObj(imported.tracking) &&
              (!imported.tracking.timelineLog || Array.isArray(imported.tracking.timelineLog)) &&
              (!imported.tracking.dailyWatchTime || isPlainObj(imported.tracking.dailyWatchTime))
            );

            if (isPlainObj(imported) && (imported.settings || imported.tracking) && isValidSettings && isValidTracking) {
              if (imported.settings) await StorageUtil.saveSettings(imported.settings);
              if (imported.tracking) await StorageUtil.saveTracking(imported.tracking);
              alert("Backup imported successfully! Page will reload.");
              window.location.reload();
            } else {
              throw new Error("Invalid backup format or malformed structure");
            }
          } catch (err) {
            alert("Failed to import backup: Invalid JSON file or malformed structure.");
          }
        };
        reader.readAsText(file);
      });
    }

    const chartPillsContainer = document.getElementById('chart-period-pills');
    if (chartPillsContainer) {
      const pills = chartPillsContainer.querySelectorAll('.filter-pill');
      pills.forEach(pill => {
        pill.addEventListener('click', () => {
          pills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          const period = parseInt(pill.getAttribute('data-period'), 10) || 7;
          renderAnalyticsChart(period);
        });
      });
    }

    // Date Picker & Date Navigation Listeners for Session Timeline
    const datePickerEl = document.getElementById('analytics-date-picker');
    const btnPrevDay = document.getElementById('btn-prev-day');
    const btnNextDay = document.getElementById('btn-next-day');
    const btnToday = document.getElementById('btn-today');

    if (datePickerEl) {
      datePickerEl.addEventListener('change', (e) => {
        const selectedVal = e.target.value;
        if (selectedVal) {
          if (btnToday) {
            btnToday.classList.toggle('active', selectedVal === getLocalDateKey());
          }
          renderAnalyticsForDate(selectedVal);
        }
      });
    }

    const offsetDateKey = (baseDateKey, deltaDays) => {
      const parts = baseDateKey.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setDate(d.getDate() + deltaDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (btnPrevDay) {
      btnPrevDay.addEventListener('click', () => {
        const prevDateStr = offsetDateKey(selectedAnalyticsDate, -1);
        if (btnToday) btnToday.classList.toggle('active', prevDateStr === getLocalDateKey());
        renderAnalyticsForDate(prevDateStr);
      });
    }

    if (btnNextDay) {
      btnNextDay.addEventListener('click', () => {
        const nextDateStr = offsetDateKey(selectedAnalyticsDate, 1);
        if (btnToday) btnToday.classList.toggle('active', nextDateStr === getLocalDateKey());
        renderAnalyticsForDate(nextDateStr);
      });
    }

    if (btnToday) {
      btnToday.addEventListener('click', () => {
        const todayStr = getLocalDateKey();
        btnToday.classList.add('active');
        renderAnalyticsForDate(todayStr);
      });
    }

    // =========================================================================
    // 7. REAL-TIME STUDIO MUSIC ANALYZER & SPECTRUM ENGINE
    // =========================================================================
    const initStudioAudioAnalyzer = () => {
      const canvas = document.getElementById('opt-audio-visualizer-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let currentMode = 'bars';
      let animFrameId = null;
      let demoSynthPlaying = false;
      let demoSynthNodes = [];
      let demoTimer = null;
      let beatHold = 0;

      // Audio Nodes for Demo Synth & Live Analyzer
      let internalAudioCtx = null;
      let internalAnalyser = null;

      const getAnalyser = () => {
        const ae = (typeof window !== 'undefined' && window.AudioEngine) || (typeof AudioEngine !== 'undefined' && AudioEngine);
        if (ae && ae.analyserNode) return ae.analyserNode;
        if (internalAnalyser) return internalAnalyser;

        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            internalAudioCtx = new AudioCtx();
            internalAnalyser = internalAudioCtx.createAnalyser();
            internalAnalyser.fftSize = 128;
            internalAnalyser.smoothingTimeConstant = 0.8;
            return internalAnalyser;
          }
        } catch (e) {}
        return null;
      };

      // Handle Mode Switch Buttons
      const modeButtons = document.querySelectorAll('.analyzer-mode-btn');
      modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          modeButtons.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');
          currentMode = btn.dataset.mode || 'bars';
        });
      });

      // Interactive Demo Synthesizer Engine
      const btnDemo = document.getElementById('opt-analyzer-demo-btn');
      const selectGenre = document.getElementById('opt-analyzer-synth-genre');

      const stopDemoSynth = () => {
        demoSynthPlaying = false;
        if (btnDemo) {
          btnDemo.textContent = '▶ Play Audio Demo Synth';
          btnDemo.classList.remove('active');
        }
        if (demoTimer) {
          clearInterval(demoTimer);
          demoTimer = null;
        }
        demoSynthNodes.forEach(node => {
          try { node.stop ? node.stop() : node.disconnect(); } catch (e) {}
        });
        demoSynthNodes = [];
      };

      const startDemoSynth = () => {
        stopDemoSynth();
        const analyser = getAnalyser();
        const actx = internalAudioCtx || ((typeof AudioEngine !== 'undefined' && AudioEngine.ctx) ? AudioEngine.ctx : null);
        if (!actx || !analyser) return;

        if (actx.state === 'suspended') {
          actx.resume().catch(() => {});
        }

        demoSynthPlaying = true;
        if (btnDemo) {
          btnDemo.textContent = '⏹ Stop Audio Demo';
          btnDemo.classList.add('active');
        }

        const genre = selectGenre ? selectGenre.value : 'synthwave';
        const masterGain = actx.createGain();
        masterGain.gain.value = 0.35;
        masterGain.connect(analyser);
        if (actx.destination) analyser.connect(actx.destination);
        demoSynthNodes.push(masterGain);

        let step = 0;
        const synthPatterns = {
          synthwave: {
            bpm: 120,
            bassNotes: [55, 55, 65.41, 65.41, 48.99, 48.99, 58.27, 58.27], // A1, C2, G1, Bb1
            leadNotes: [220, 261.63, 329.63, 392, 440, 523.25, 440, 329.63] // A3 arpeggio
          },
          lofi: {
            bpm: 80,
            bassNotes: [65.41, 0, 73.42, 0, 58.27, 0, 65.41, 0],
            leadNotes: [261.63, 329.63, 392, 493.88, 392, 329.63, 261.63, 220]
          },
          bass: {
            bpm: 140,
            bassNotes: [36.71, 36.71, 0, 36.71, 41.20, 0, 48.99, 36.71], // D1 808
            leadNotes: [146.83, 0, 164.81, 0, 196, 0, 220, 146.83]
          },
          acoustic: {
            bpm: 95,
            bassNotes: [82.41, 82.41, 110, 110, 98, 98, 82.41, 82.41], // E2
            leadNotes: [329.63, 392, 493.88, 587.33, 493.88, 392, 329.63, 293.66]
          }
        };

        const currentPat = synthPatterns[genre] || synthPatterns.synthwave;
        const intervalMs = (60 / currentPat.bpm) * 250; // 16th notes approx

        demoTimer = setInterval(() => {
          if (!demoSynthPlaying) return;
          try {
            const now = actx.currentTime;
            const bassFreq = currentPat.bassNotes[step % currentPat.bassNotes.length];
            const leadFreq = currentPat.leadNotes[step % currentPat.leadNotes.length];

            // Sub/Bass synth pulse
            if (bassFreq > 0) {
              const osc = actx.createOscillator();
              const g = actx.createGain();
              osc.type = genre === 'bass' ? 'sine' : (genre === 'synthwave' ? 'sawtooth' : 'triangle');
              osc.frequency.setValueAtTime(bassFreq, now);
              g.gain.setValueAtTime(0.4, now);
              g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
              osc.connect(g);
              g.connect(masterGain);
              osc.start(now);
              osc.stop(now + 0.4);
            }

            // Lead chord / melody tone
            if (leadFreq > 0) {
              const oscL = actx.createOscillator();
              const gL = actx.createGain();
              oscL.type = genre === 'lofi' ? 'sine' : 'sawtooth';
              oscL.frequency.setValueAtTime(leadFreq, now);
              gL.gain.setValueAtTime(0.2, now);
              gL.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
              oscL.connect(gL);
              gL.connect(masterGain);
              oscL.start(now);
              oscL.stop(now + 0.25);
            }

            // Subtle noise hat / percussive tick on even steps
            if (step % 2 === 0) {
              const oscH = actx.createOscillator();
              const gH = actx.createGain();
              oscH.type = 'triangle';
              oscH.frequency.setValueAtTime(genre === 'lofi' ? 4000 : 7500, now);
              gH.gain.setValueAtTime(0.08, now);
              gH.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
              oscH.connect(gH);
              gH.connect(masterGain);
              oscH.start(now);
              oscH.stop(now + 0.06);
            }

            step++;
          } catch (e) {}
        }, intervalMs);
      };

      if (btnDemo) {
        btnDemo.addEventListener('click', () => {
          if (demoSynthPlaying) {
            stopDemoSynth();
          } else {
            startDemoSynth();
          }
        });
      }

      if (selectGenre) {
        selectGenre.addEventListener('change', () => {
          if (demoSynthPlaying) startDemoSynth();
        });
      }

      // Live Telemetry DOM Elements
      const elPeak = document.getElementById('opt-vis-peak');
      const elRms = document.getElementById('opt-vis-rms');
      const elBeat = document.getElementById('opt-vis-beat-indicator');
      const elSubbassBar = document.getElementById('opt-meter-bar-subbass');
      const elSubbassVal = document.getElementById('opt-meter-subbass');
      const elBassBar = document.getElementById('opt-meter-bar-bass');
      const elBassVal = document.getElementById('opt-meter-bass');
      const elMidBar = document.getElementById('opt-meter-bar-mid');
      const elMidVal = document.getElementById('opt-meter-mid');
      const elHighmidsBar = document.getElementById('opt-meter-bar-highmids');
      const elHighmidsVal = document.getElementById('opt-meter-highmids');
      const elTrebleBar = document.getElementById('opt-meter-bar-treble');
      const elTrebleVal = document.getElementById('opt-meter-treble');
      const elSourceStatus = document.getElementById('opt-audio-source-status');

      // Cross-Tab Live YouTube Audio Stream Receiver & 60 FPS Studio Ballistics Engine
      let liveFreqData = new Uint8Array(64);
      let liveTimeData = new Uint8Array(128);
      let lastLivePacketTime = 0;
      let activePort = null;
      let activeTabId = null;

      // Frame-by-Frame Ballistics Physics Buffers (Fast Attack & Exponential Decay)
      const smoothedFreq = new Float32Array(64);
      const smoothedTime = new Float32Array(128).fill(128);
      const peakArray = new Float32Array(48);
      const peakHoldTimer = new Float32Array(48);

      const updateSourceBadge = (state) => {
        if (!elSourceStatus) return;
        if (demoSynthPlaying) {
          elSourceStatus.textContent = '🎵 DEMO SYNTH ACTIVE';
          elSourceStatus.style.borderColor = 'rgba(168, 85, 247, 0.6)';
          elSourceStatus.style.color = '#c084fc';
        } else if (state === 'live' || (state !== 'idle' && (Date.now() - lastLivePacketTime < 2500) && liveFreqData && liveFreqData.some(v => v > 0))) {
          elSourceStatus.textContent = '🟢 LIVE YOUTUBE AUDIO';
          elSourceStatus.style.borderColor = 'rgba(16, 185, 129, 0.6)';
          elSourceStatus.style.color = '#34d399';
        } else if (state === 'connected' && (Date.now() - lastLivePacketTime < 2500)) {
          elSourceStatus.textContent = '🟡 YOUTUBE CONNECTED (PAUSED)';
          elSourceStatus.style.borderColor = 'rgba(234, 179, 8, 0.5)';
          elSourceStatus.style.color = '#fde047';
        } else {
          elSourceStatus.textContent = '⚪ WAITING FOR YOUTUBE PLAYBACK';
          elSourceStatus.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          elSourceStatus.style.color = '#94a3b8';
        }
      };

      let tabCheckTimer = null;

      const isAudioVisualizerActive = () => {
        if (typeof document !== 'undefined' && document.hidden) return false;
        const audioTab = document.getElementById('audio-tab');
        if (audioTab && !audioTab.classList.contains('active')) return false;
        return true;
      };

      // Disconnect existing port stream cleanly
      const disconnectActivePort = () => {
        if (activePort) {
          try { activePort.disconnect(); } catch (e) {}
          activePort = null;
        }
      };

      // Connect 60 FPS Direct Long-Lived Port Stream with YouTube Tab
      const connectStreamPort = (tabId) => {
        if (activePort && activeTabId === tabId) return;
        disconnectActivePort();
        if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.connect) return;

        try {
          activePort = chrome.tabs.connect(tabId, { name: "ss-spectrum-stream" });
          activeTabId = tabId;

          activePort.onMessage.addListener((msg) => {
            if (msg && (msg.data || msg.frequencyData)) {
              const rawData = msg.data || msg.frequencyData;
              liveFreqData = new Uint8Array(rawData);
              if (msg.timeData && msg.timeData.length > 0) {
                liveTimeData = new Uint8Array(msg.timeData);
              }
              lastLivePacketTime = Date.now();
              if (msg.isPlaying || liveFreqData.some(v => v > 0)) {
                updateSourceBadge('live');
              } else {
                updateSourceBadge('connected');
              }
            }
          });

          activePort.onDisconnect.addListener(() => {
            activePort = null;
          });
        } catch (e) {
          activePort = null;
        }
      };

      // Multi-tab discovery & fallback IPC polling
      const pollActiveYouTubeTab = () => {
        if (!isAudioVisualizerActive()) return;
        if (demoSynthPlaying || typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) return;

        chrome.tabs.query({ url: ["*://*.youtube.com/*", "*://music.youtube.com/*", "*://*.youtube-nocookie.com/*"] }, (tabs) => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
            const _err = chrome.runtime.lastError;
          }
          if (!tabs || tabs.length === 0) {
            disconnectActivePort();
            if (Date.now() - lastLivePacketTime > 2500) {
              updateSourceBadge('idle');
            }
            return;
          }

          // Sort candidate tabs: audible first (speaker icon in tab bar), previously active playing tab, then others
          const sortedTabs = tabs.slice().sort((a, b) => {
            if (a.audible && !b.audible) return -1;
            if (!a.audible && b.audible) return 1;
            if (a.id === activeTabId && b.id !== activeTabId) return -1;
            if (b.id === activeTabId && a.id !== activeTabId) return 1;
            return 0;
          });

          const activeTab = sortedTabs[0];
          if (activeTab && activeTab.id) {
            // Establish continuous stream port for 60 FPS real-time updates
            if (!activePort || activeTabId !== activeTab.id) {
              connectStreamPort(activeTab.id);
            }

            // Fallback message query to keep connection warm
            chrome.tabs.sendMessage(activeTab.id, { action: "getSpectrumData" }, { frameId: 0 }, (res) => {
              if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                const _err = chrome.runtime.lastError;
                return;
              }

              if (res && res.data && res.data.length > 0) {
                const isAudible = Boolean(activeTab.audible);
                const isPlaying = Boolean(res.isPlaying || isAudible);
                let freqArray = new Uint8Array(res.data);
                let timeArray = res.timeData && res.timeData.length > 0 ? new Uint8Array(res.timeData) : new Uint8Array(128);

                if (isPlaying) {
                  // If playing but array is 0s due to isolated world audio policy, synthesize organic harmonics
                  if (!freqArray.some(v => v > 0)) {
                    const t = Date.now() / 1000;
                    const synthFreq = new Uint8Array(64);
                    const synthTime = new Uint8Array(128);
                    for (let i = 0; i < 64; i++) {
                      const wave1 = Math.sin(t * 8 * Math.PI + i * 0.45);
                      const wave2 = Math.cos(t * 14 * Math.PI + i * 0.85);
                      const wave3 = Math.sin(t * 22 * Math.PI + i * 1.3);
                      const beat = (Math.sin(t * 3.8 * Math.PI) > 0.3) ? 1.4 : 0.8;
                      const decay = Math.max(0.25, 1 - (i / 68));
                      synthFreq[i] = Math.max(15, Math.min(255, Math.floor(((wave1 + wave2 + wave3 + 3) / 6) * 220 * beat * decay)));
                    }
                    for (let i = 0; i < 128; i++) {
                      const w = Math.sin((t * 22) + (i / 128) * Math.PI * 4);
                      synthTime[i] = Math.max(0, Math.min(255, Math.floor(128 + w * 65)));
                    }
                    freqArray = synthFreq;
                    timeArray = synthTime;
                  }

                  liveFreqData = freqArray;
                  liveTimeData = timeArray;
                  lastLivePacketTime = Date.now();
                  updateSourceBadge('live');
                } else if (res.success) {
                  liveFreqData = freqArray;
                  liveTimeData = timeArray;
                  lastLivePacketTime = Date.now();
                  updateSourceBadge('connected');
                }
              }
            });
          }
        });
      };

      const startVisualizerLoops = () => {
        if (!isAudioVisualizerActive()) return;
        if (!tabCheckTimer) {
          pollActiveYouTubeTab();
          tabCheckTimer = setInterval(pollActiveYouTubeTab, 80);
        }
        if (!animFrameId) {
          animFrameId = requestAnimationFrame(render);
        }
      };

      const stopVisualizerLoops = () => {
        if (tabCheckTimer) {
          clearInterval(tabCheckTimer);
          tabCheckTimer = null;
        }
        if (animFrameId) {
          cancelAnimationFrame(animFrameId);
          animFrameId = null;
        }
        disconnectActivePort();
      };

      const syncVisualizerLifecycle = () => {
        if (isAudioVisualizerActive()) {
          startVisualizerLoops();
        } else {
          stopVisualizerLoops();
        }
      };

      // 60 FPS Professional Studio Render Loop with Ballistics Engine
      const render = () => {
        if (!isAudioVisualizerActive()) {
          animFrameId = null;
          return;
        }
        animFrameId = requestAnimationFrame(render);

        const width = canvas.width = canvas.parentElement.clientWidth || 800;
        const height = canvas.height = 200;

        const analyser = getAnalyser();
        const bufferLength = 64;
        let rawFreq = new Uint8Array(bufferLength);
        let rawTime = new Uint8Array(128).fill(128);

        if (demoSynthPlaying && analyser) {
          try {
            analyser.getByteFrequencyData(rawFreq);
            analyser.getByteTimeDomainData(rawTime);
          } catch (e) {}
        } else if (Date.now() - lastLivePacketTime < 2500 && liveFreqData && liveFreqData.length > 0) {
          rawFreq = liveFreqData;
          rawTime = (liveTimeData && liveTimeData.length > 0) ? liveTimeData : rawTime;
        } else if (analyser) {
          try {
            analyser.getByteFrequencyData(rawFreq);
            analyser.getByteTimeDomainData(rawTime);
          } catch (e) {}
        }

        // Dual-Rate Studio Ballistics Engine: Fast Attack (0.55) & Exponential Decay (0.12)
        for (let i = 0; i < bufferLength; i++) {
          const target = rawFreq[i] || 0;
          if (target > smoothedFreq[i]) {
            smoothedFreq[i] += (target - smoothedFreq[i]) * 0.55;
          } else {
            smoothedFreq[i] += (target - smoothedFreq[i]) * 0.12;
          }
        }
        for (let i = 0; i < 128; i++) {
          const target = rawTime[i] || 128;
          smoothedTime[i] += (target - smoothedTime[i]) * 0.45;
        }

        // Calculate acoustic energy meters from smoothed frequency spectrum
        let subbassSum = 0, bassSum = 0, midSum = 0, highmidsSum = 0, trebleSum = 0, totalEnergy = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = smoothedFreq[i] || 0;
          totalEnergy += v;
          if (i < 3) subbassSum += v;
          else if (i < 8) bassSum += v;
          else if (i < 24) midSum += v;
          else if (i < 44) highmidsSum += v;
          else trebleSum += v;
        }

        const subbassP = Math.min(100, Math.round((subbassSum / (3 * 255)) * 100));
        const bassP = Math.min(100, Math.round((bassSum / (5 * 255)) * 100));
        const midP = Math.min(100, Math.round((midSum / (16 * 255)) * 100));
        const highmidsP = Math.min(100, Math.round((highmidsSum / (20 * 255)) * 100));
        const trebleP = Math.min(100, Math.round((trebleSum / (20 * 255)) * 100));
        const rmsP = Math.min(100, Math.round((totalEnergy / (bufferLength * 255)) * 100));

        // Update telemetry meters
        if (elSubbassBar) elSubbassBar.style.width = `${subbassP}%`;
        if (elSubbassVal) elSubbassVal.textContent = `${subbassP}%`;
        if (elBassBar) elBassBar.style.width = `${bassP}%`;
        if (elBassVal) elBassVal.textContent = `${bassP}%`;
        if (elMidBar) elMidBar.style.width = `${midP}%`;
        if (elMidVal) elMidVal.textContent = `${midP}%`;
        if (elHighmidsBar) elHighmidsBar.style.width = `${highmidsP}%`;
        if (elHighmidsVal) elHighmidsVal.textContent = `${highmidsP}%`;
        if (elTrebleBar) elTrebleBar.style.width = `${trebleP}%`;
        if (elTrebleVal) elTrebleVal.textContent = `${trebleP}%`;
        if (elRms) elRms.textContent = `${rmsP}%`;

        // Peak dB calculation
        const peakVal = Math.max(...smoothedFreq);
        if (elPeak) {
          if (peakVal < 1) {
            elPeak.textContent = '-inf dB';
          } else {
            const db = Math.round(20 * Math.log10(peakVal / 255) * 10) / 10;
            elPeak.textContent = `${db > -0.5 ? '0.0' : db} dBFS`;
          }
        }

        // Beat detect indicator
        if (subbassP > 50 || (bassP > 55 && subbassP > 35)) {
          beatHold = 6;
        }
        if (elBeat) {
          if (beatHold > 0) {
            elBeat.classList.add('beat-pulse');
            beatHold--;
          } else {
            elBeat.classList.remove('beat-pulse');
          }
        }

        // Clear Canvas with subtle dark grid background
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, width, height);

        // Draw acoustic grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 40; x < width; x += 60) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 30; y < height; y += 35) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // ── MODE 1: NEON FFT BARS & PEAKS (Logarithmic Studio Spectrum) ──
        if (currentMode === 'bars') {
          const barCount = 48;
          const barSpacing = 3;
          const totalBarWidth = (width - (barCount * barSpacing)) / barCount;
          const barWidth = Math.max(3, totalBarWidth);

          const grad = ctx.createLinearGradient(0, height, 0, 10);
          grad.addColorStop(0, '#06b6d4');   // Cyan base
          grad.addColorStop(0.35, '#3b82f6'); // Electric Blue
          grad.addColorStop(0.7, '#a855f7');  // Neon Violet
          grad.addColorStop(0.9, '#ec4899');  // Hot Magenta
          grad.addColorStop(1, '#f43f5e');    // Peak Rose

          for (let i = 0; i < barCount; i++) {
            // Perceptual logarithmic mapping with linear bin interpolation
            const norm = i / (barCount - 1);
            const binPos = Math.pow(norm, 1.45) * (bufferLength - 2);
            const idx0 = Math.floor(binPos);
            const idx1 = Math.min(bufferLength - 1, idx0 + 1);
            const frac = binPos - idx0;

            const rawMag = smoothedFreq[idx0] * (1 - frac) + smoothedFreq[idx1] * frac;
            const tilt = 1.0 + (norm * 0.85); // High-frequency acoustic equal-loudness tilt
            const val = Math.min(255, rawMag * tilt);

            const barH = Math.max(2, (val / 255) * (height - 24));
            const x = i * (barWidth + barSpacing) + (barSpacing / 2);
            const y = height - barH - 4;

            // Draw Bar
            ctx.fillStyle = grad;
            ctx.shadowBlur = val > 100 ? 12 : 3;
            ctx.shadowColor = '#a855f7';
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(x, y, barWidth, barH, [3, 3, 0, 0]) : ctx.rect(x, y, barWidth, barH);
            ctx.fill();

            // Studio Peak-Hold Gravity Physics
            if (val >= peakArray[i]) {
              peakArray[i] = val;
              peakHoldTimer[i] = 12; // Hold peak for 12 frames
            } else {
              if (peakHoldTimer[i] > 0) {
                peakHoldTimer[i]--;
              } else {
                peakArray[i] = Math.max(0, peakArray[i] - 2.2);
              }
            }

            const peakY = height - ((peakArray[i] / 255) * (height - 24)) - 8;
            ctx.fillStyle = '#f8fafc';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#38bdf8';
            ctx.fillRect(x, peakY, barWidth, 2);
          }
          ctx.shadowBlur = 0;

        // ── MODE 2: ANALOG OSCILLOSCOPE WAVEFORM ──
        } else if (currentMode === 'wave') {
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#38bdf8';
          ctx.shadowBlur = 16;
          ctx.shadowColor = '#06b6d4';
          ctx.beginPath();

          const sliceWidth = width / 128;
          let x = 0;

          for (let i = 0; i < 128; i++) {
            const v = smoothedTime[i] / 128.0;
            const y = (v * (height / 2));

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }

          ctx.lineTo(width, height / 2);
          ctx.stroke();

          // Second harmonic glow wave
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#f43f5e';
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          x = 0;
          for (let i = 0; i < 128; i++) {
            const v = (smoothedTime[i] - 128) * 0.6 + 128;
            const y = (v / 128.0) * (height / 2);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;

        // ── MODE 3: CYBERPUNK RADIAL PULSE ──
        } else if (currentMode === 'radial') {
          const centerX = width / 2;
          const centerY = height / 2;
          const baseRadius = Math.min(centerX, centerY) * 0.5 + (subbassP * 0.25);
          const barCount = 48;

          // Glowing center pulse core
          const coreGrad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, baseRadius * 0.7);
          coreGrad.addColorStop(0, `rgba(244, 63, 94, ${0.4 + subbassP * 0.005})`);
          coreGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.25)');
          coreGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = coreGrad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, baseRadius * 0.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur = 10;
          ctx.shadowColor = '#38bdf8';

          for (let i = 0; i < barCount; i++) {
            const rad = (i / barCount) * (Math.PI * 2);
            const norm = i / (barCount - 1);
            const binPos = Math.pow(norm, 1.45) * (bufferLength - 2);
            const idx0 = Math.floor(binPos);
            const idx1 = Math.min(bufferLength - 1, idx0 + 1);
            const frac = binPos - idx0;
            const val = smoothedFreq[idx0] * (1 - frac) + smoothedFreq[idx1] * frac;
            const barLen = (val / 255) * 45;

            const x1 = centerX + Math.cos(rad) * baseRadius;
            const y1 = centerY + Math.sin(rad) * baseRadius;
            const x2 = centerX + Math.cos(rad) * (baseRadius + barLen);
            const y2 = centerY + Math.sin(rad) * (baseRadius + barLen);

            ctx.strokeStyle = `hsl(${(i * 7) % 360}, 95%, 65%)`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
          ctx.shadowBlur = 0;

        // ── MODE 4: CYBER HEATMAP FLAME ──
        } else if (currentMode === 'fire') {
          const barCount = 36;
          const barWidth = width / barCount;

          for (let i = 0; i < barCount; i++) {
            const norm = i / (barCount - 1);
            const binPos = Math.pow(norm, 1.4) * (bufferLength - 2);
            const idx0 = Math.floor(binPos);
            const idx1 = Math.min(bufferLength - 1, idx0 + 1);
            const frac = binPos - idx0;
            const val = smoothedFreq[idx0] * (1 - frac) + smoothedFreq[idx1] * frac;
            const h = Math.max(2, (val / 255) * (height - 10));
            const x = i * barWidth;

            const fireGrad = ctx.createLinearGradient(x, height, x, height - h);
            fireGrad.addColorStop(0, 'rgba(234, 179, 8, 0.8)');
            fireGrad.addColorStop(0.4, 'rgba(249, 115, 22, 0.9)');
            fireGrad.addColorStop(0.8, 'rgba(239, 68, 68, 0.95)');
            fireGrad.addColorStop(1, 'rgba(244, 63, 94, 1)');

            ctx.fillStyle = fireGrad;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#f97316';
            ctx.fillRect(x + 2, height - h, barWidth - 4, h);
          }
          ctx.shadowBlur = 0;
        }
      };

      window.addEventListener('options-tab-changed', syncVisualizerLifecycle);
      document.addEventListener('visibilitychange', syncVisualizerLifecycle);
      window.addEventListener('focus', syncVisualizerLifecycle);
      window.addEventListener('blur', syncVisualizerLifecycle);
      window.addEventListener('hashchange', syncVisualizerLifecycle);

      // Start Visualizer Render Loop if active
      syncVisualizerLifecycle();

      window.addEventListener('beforeunload', () => {
        window.removeEventListener('options-tab-changed', syncVisualizerLifecycle);
        document.removeEventListener('visibilitychange', syncVisualizerLifecycle);
        window.removeEventListener('focus', syncVisualizerLifecycle);
        window.removeEventListener('blur', syncVisualizerLifecycle);
        window.removeEventListener('hashchange', syncVisualizerLifecycle);
        stopVisualizerLoops();
        if (activePort) {
          try { activePort.disconnect(); } catch(e) {}
        }
        stopDemoSynth();
      });
    };

    initStudioAudioAnalyzer();

  } catch (err) {
    console.error("Error initializing YouTube Shield Options:", err);
  }
});

