class StudyMode {
  constructor() {
    this.isActive = false;
    this.goal = "Learn something new";
    this.bannerElement = null;
    this.sessionStartTime = Date.now();
    this.timerInterval = null;
    this.lastVideoId = null;
    
    // Pomodoro State
    this.pomoState = 'FOCUS'; // 'FOCUS' | 'BREAK' | 'LONG_BREAK'
    this.pomoSecondsLeft = 25 * 60;
    this.pomoIsPaused = false;
    this.pomoCycleCount = 1;
    this.pomoTotalCompleted = 0;
    this.pomoConfig = {
      enabled: true,
      workMinutes: 25,
      breakMinutes: 5,
      longBreakMinutes: 15,
      cyclesBeforeLongBreak: 4,
      autoStartBreaks: true,
      autoStartWork: false,
      soundAlerts: true,
      autoPause: true
    };

    // Store bound reference so enable/disable use the SAME function object
    this.boundNavigate = this.onNavigate.bind(this);
    // Cancellation token & handle for checkVideoAlignment retry chain
    this._alignmentCheckActive = false;
    this._alignmentTimeout = null;
    this._noticeTimeouts = [];
    this._warningTimeouts = [];
    // Store original layout values before we modify them
    this._originalBodyPadding = null;
    this._originalMastheadTop = null;
  }

  async loadPomodoroConfig() {
    try {
      if (typeof StorageUtil !== 'undefined' && typeof StorageUtil.getSettings === 'function') {
        const settings = await StorageUtil.getSettings();
        if (settings && settings.pomodoro) {
          this.pomoConfig = { ...this.pomoConfig, ...settings.pomodoro };
        }
      }
    } catch (e) {
      console.warn("StudyMode: Failed to load Pomodoro config", e);
    }
  }

  clearPendingTimeouts() {
    this._alignmentCheckActive = false;
    if (this._alignmentTimeout) {
      clearTimeout(this._alignmentTimeout);
      this._alignmentTimeout = null;
    }
    this._noticeTimeouts.forEach(t => clearTimeout(t));
    this._noticeTimeouts = [];
    this._warningTimeouts.forEach(t => clearTimeout(t));
    this._warningTimeouts = [];
  }

  removeNoticesAndWarnings() {
    const notice = document.getElementById('ss-pomo-notice');
    if (notice && notice.parentNode) {
      notice.parentNode.removeChild(notice);
    }
    const warning = document.getElementById('ss-alignment-warning');
    if (warning && warning.parentNode) {
      warning.parentNode.removeChild(warning);
    }
  }

  enable(goal) {
    if (goal) {
      if (this.isActive && this.goal !== goal) {
        this.goal = goal;
        this.lastVideoId = null;
        this.updateBanner();
        this.checkVideoAlignment();
        return;
      }
      this.goal = goal;
    }
    if (this.isActive) {
      this.updateBanner();
      return;
    }
    
    this.isActive = true;
    this.sessionStartTime = Date.now();
    this.pomoSecondsLeft = (this.pomoConfig.workMinutes || 25) * 60;
    
    // Inject banner synchronously
    this.injectBanner();
    this.startTimer();
    this.checkVideoAlignment();

  // Async load custom Pomodoro settings if available
    this.loadPomodoroConfig().then(() => {
      if (this.isActive && this.pomoState === 'FOCUS') {
        const workSecs = (this.pomoConfig.workMinutes || 25) * 60;
        const initialSecs = (this.pomoConfig.workMinutes || 25) * 60;
        if (Math.abs(this.pomoSecondsLeft - initialSecs) <= 3) {
          this.pomoSecondsLeft = workSecs;
          this.updateBanner();
        }
      }
    }).catch(err => {
      console.warn("StudyMode: error loading Pomodoro config:", err);
    });

    // Add event listener for YouTube navigation safely
    window.removeEventListener('yt-navigate-finish', this.boundNavigate);
    window.addEventListener('yt-navigate-finish', this.boundNavigate);
    
    console.log("StudyMode with Pomodoro enabled");
  }

  disable() {
    this.isActive = false;
    this._alignmentCheckActive = false;
    this.clearPendingTimeouts();
    this.removeBanner();
    this.removeNoticesAndWarnings();
    this.stopTimer();
    window.removeEventListener('yt-navigate-finish', this.boundNavigate);
    
    console.log("StudyMode disabled");
  }

  onNavigate() {
    if (this.isActive) {
      this.injectBanner(); // Ensure banner is still present
      this.checkVideoAlignment();
    }
  }

  injectBanner() {
    if (document.getElementById('ss-study-banner')) {
      this.updateBanner();
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'ss-study-banner';
    banner.innerHTML = `
      <div class="ss-banner-content" style="display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 16px; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span class="ss-banner-title" style="font-weight: 700; font-size: 13px; letter-spacing: 0.3px; color: rgba(255,255,255,0.85);">GOAL:</span>
          <span class="ss-banner-goal" id="ss-goal-text" style="font-weight: 700; font-size: 14px; color: #fde047; overflow: hidden; text-overflow: ellipsis;"></span>
          <span class="ss-banner-divider" style="opacity: 0.3; margin: 0 4px;">|</span>
          <span style="font-size: 12px; color: rgba(255,255,255,0.75);">Total:</span>
          <span id="ss-session-timer" class="ss-banner-timer" style="font-family: monospace; font-weight: 600; font-size: 12px; color: rgba(255,255,255,0.9);">00:00</span>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
          <div id="ss-pomo-container" style="display: flex; align-items: center; gap: 8px; background: rgba(15, 23, 42, 0.65); padding: 3px 12px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
            <span id="ss-pomo-phase-badge" style="font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.3s ease;">🍅 Focus</span>
            <span id="ss-pomo-timer" role="timer" aria-label="Pomodoro Countdown Timer" style="font-family: monospace, monospace; font-size: 15px; font-weight: 800; color: #ffffff; min-width: 48px; text-align: center;">25:00</span>
            <span id="ss-pomo-cycles" style="font-size: 11px; opacity: 0.85; padding-left: 2px;">1/4</span>

            <div style="display: flex; align-items: center; gap: 3px; margin-left: 4px;">
              <button id="ss-pomo-btn-pause" title="Pause / Resume" aria-label="Pause or Resume Pomodoro Timer" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.1); color: white; cursor: pointer; border-radius: 6px; padding: 2px 7px; font-size: 12px; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);">⏸️</button>
              <button id="ss-pomo-btn-skip" title="Skip Phase" aria-label="Skip Pomodoro Phase" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.1); color: white; cursor: pointer; border-radius: 6px; padding: 2px 7px; font-size: 12px; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);">⏭️</button>
              <button id="ss-pomo-btn-reset" title="Reset Timer" aria-label="Reset Pomodoro Timer" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.1); color: white; cursor: pointer; border-radius: 6px; padding: 2px 7px; font-size: 12px; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);">🔄</button>
            </div>
          </div>

          <button id="ss-banner-shield-btn" title="Open GodMode Shield Menu" aria-label="Open GodMode Shield Menu" style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); border: 1px solid rgba(255, 255, 255, 0.3); color: white; cursor: pointer; border-radius: 14px; padding: 4px 12px; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 10px rgba(99, 102, 241, 0.5); transition: transform 0.15s ease, box-shadow 0.2s ease;">
            <span>🛡️</span> <span>Shield</span>
          </button>
        </div>
      </div>
    `;

    // Apply text content safely to prevent XSS
    const goalTextEl = banner.querySelector('#ss-goal-text');
    if (goalTextEl) {
      goalTextEl.textContent = this.goal;
    }

    // Apply banner styles
    Object.assign(banner.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      background: 'linear-gradient(90deg, #1e1b4b 0%, #312e81 50%, #1e3a8a 100%)',
      color: 'white',
      zIndex: '9999',
      padding: '7px 0',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: '14px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(16px)',
      webkitBackdropFilter: 'blur(16px)',
      transition: 'background 0.4s ease',
      boxSizing: 'border-box'
    });

    const ytMasthead = document.getElementById('masthead-container');
    if (ytMasthead) {
      if (this._originalMastheadTop === null) {
        this._originalMastheadTop = ytMasthead.style.top || '';
      }
      ytMasthead.style.top = '36px';
    }
    if (document.body) {
      if (this._originalBodyPadding === null) {
        this._originalBodyPadding = document.body.style.paddingTop || '';
      }
      document.body.style.paddingTop = '36px';
    }
    if (document.documentElement) {
      document.documentElement.style.setProperty('--ytd-masthead-height', '92px');
    }

    if (window.DOMUtils) {
      window.DOMUtils.appendChild(banner);
    } else if (document.body) {
      document.body.appendChild(banner);
    }
    this.bannerElement = banner;

    // Attach Shield Menu Button Event Listener
    const bannerShieldBtn = banner.querySelector('#ss-banner-shield-btn');
    if (bannerShieldBtn) {
      bannerShieldBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.HeaderButton && typeof window.HeaderButton.togglePopup === 'function') {
          window.HeaderButton.togglePopup();
        }
      });
    }

    // Attach Pomodoro Control Event Listeners
    const btnPause = banner.querySelector('#ss-pomo-btn-pause');
    const btnSkip = banner.querySelector('#ss-pomo-btn-skip');
    const btnReset = banner.querySelector('#ss-pomo-btn-reset');

    if (btnPause) {
      btnPause.addEventListener('click', () => {
        this.pomoIsPaused = !this.pomoIsPaused;
        btnPause.textContent = this.pomoIsPaused ? '▶️' : '⏸️';
        if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.playClick === 'function') {
          try { window.AudioEngine.playClick(); } catch(e) {}
        }
      });
    }

    if (btnSkip) {
      btnSkip.addEventListener('click', () => {
        if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.playClick === 'function') {
          try { window.AudioEngine.playClick(); } catch(e) {}
        }
        this.advancePomoPhase();
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.playClick === 'function') {
          try { window.AudioEngine.playClick(); } catch(e) {}
        }
        this.resetPomoPhase();
      });
    }

    this.updateBanner();
  }

  updateBanner() {
    const goalText = document.getElementById('ss-goal-text');
    if (goalText) goalText.textContent = this.goal;

    const timerElement = document.getElementById('ss-pomo-timer');
    const badgeElement = document.getElementById('ss-pomo-phase-badge');
    const cyclesElement = document.getElementById('ss-pomo-cycles');
    const container = document.getElementById('ss-study-banner');

    const minutes = Math.floor(Math.max(0, this.pomoSecondsLeft) / 60);
    const seconds = Math.floor(Math.max(0, this.pomoSecondsLeft) % 60);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (timerElement) timerElement.textContent = timeStr;

    if (cyclesElement) {
      const maxC = this.pomoConfig.cyclesBeforeLongBreak || 4;
      cyclesElement.textContent = `${this.pomoCycleCount}/${maxC}`;
    }

    if (badgeElement && container) {
      if (this.pomoState === 'FOCUS') {
        badgeElement.textContent = '🍅 Focus';
        badgeElement.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        container.style.background = 'linear-gradient(90deg, #1e1b4b 0%, #312e81 50%, #1e3a8a 100%)';
      } else if (this.pomoState === 'BREAK') {
        badgeElement.textContent = '☕ Short Break';
        badgeElement.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        container.style.background = 'linear-gradient(90deg, #064e3b 0%, #047857 50%, #065f46 100%)';
      } else if (this.pomoState === 'LONG_BREAK') {
        badgeElement.textContent = '🌴 Long Break';
        badgeElement.style.background = 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)';
        container.style.background = 'linear-gradient(90deg, #4c1d95 0%, #6d28d9 50%, #581c87 100%)';
      }
    }
  }

  removeBanner() {
    if (this.bannerElement && this.bannerElement.parentNode) {
      this.bannerElement.parentNode.removeChild(this.bannerElement);
    }
    this.bannerElement = null;

    const ytMasthead = document.getElementById('masthead-container');
    if (ytMasthead && this._originalMastheadTop !== null) {
      ytMasthead.style.top = this._originalMastheadTop;
    }
    if (document.body && this._originalBodyPadding !== null) {
      document.body.style.paddingTop = this._originalBodyPadding;
    }
    if (document.documentElement) {
      document.documentElement.style.removeProperty('--ytd-masthead-height');
    }
    this._originalMastheadTop = null;
    this._originalBodyPadding = null;
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    this.timerInterval = setInterval(() => {
      if (!this.isActive) {
        this.stopTimer();
        return;
      }

      // 1. Overall Session Time
      const sessionTimerElement = document.getElementById('ss-session-timer');
      if (sessionTimerElement) {
        const diff = Date.now() - this.sessionStartTime;
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        sessionTimerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }

      // 2. Pomodoro Timer Countdown
      if (this.pomoConfig.enabled !== false && !this.pomoIsPaused) {
        this.pomoSecondsLeft--;

        if (this.pomoSecondsLeft <= 0) {
          this.advancePomoPhase();
        } else {
          this.updateBanner();
        }
      }
    }, 1000);
  }

  resetPomoPhase() {
    if (this.pomoState === 'FOCUS') {
      this.pomoSecondsLeft = (this.pomoConfig.workMinutes || 25) * 60;
    } else if (this.pomoState === 'BREAK') {
      this.pomoSecondsLeft = (this.pomoConfig.breakMinutes || 5) * 60;
    } else if (this.pomoState === 'LONG_BREAK') {
      this.pomoSecondsLeft = (this.pomoConfig.longBreakMinutes || 15) * 60;
    }
    this.updateBanner();
  }

  advancePomoPhase() {
    if (this.pomoState === 'FOCUS') {
      // Completed a Focus session!
      this.pomoTotalCompleted++;
      const maxC = this.pomoConfig.cyclesBeforeLongBreak || 4;

      // Play Sound safely
      if (this.pomoConfig.soundAlerts !== false && typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.playLevelUp === 'function') {
        try { window.AudioEngine.playLevelUp(); } catch(e) {}
      }

      // Award 10 AP for completing a Pomodoro sprint!
      this.awardPomodoroAP();

      if (this.pomoCycleCount % maxC === 0) {
        this.pomoState = 'LONG_BREAK';
        this.pomoSecondsLeft = (this.pomoConfig.longBreakMinutes || 15) * 60;
        this.showPomoAlert("🌴 Long Break Time! Excellent focus session. Take a 15-minute rest.");
      } else {
        this.pomoState = 'BREAK';
        this.pomoSecondsLeft = (this.pomoConfig.breakMinutes || 5) * 60;
        this.showPomoAlert("☕ Focus Sprint Complete! Take a 5-minute break. Rest your eyes.");
      }

      // Auto Pause video during break if configured
      if (this.pomoConfig.autoPause !== false) {
        const video = document.querySelector('video');
        if (video && !video.paused) {
          try { video.pause(); } catch(e) {}
        }
      }

    } else {
      // Completed a Break session!
      if (this.pomoState === 'LONG_BREAK') {
        this.pomoCycleCount = 1;
      } else {
        this.pomoCycleCount++;
      }

      this.pomoState = 'FOCUS';
      this.pomoSecondsLeft = (this.pomoConfig.workMinutes || 25) * 60;

      // Play Sound safely
      if (this.pomoConfig.soundAlerts !== false && typeof window !== 'undefined' && window.AudioEngine && typeof window.AudioEngine.playBadgeUnlock === 'function') {
        try { window.AudioEngine.playBadgeUnlock(); } catch(e) {}
      }

      this.showPomoAlert("🔥 Break Over! Back to your goal session.");
    }

    this.updateBanner();
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async awardPomodoroAP(points = 10) {
    try {
      const pts = typeof points === 'number' && points > 0 ? points : 10;
      if (typeof StorageUtil !== 'undefined' && typeof StorageUtil.getTracking === 'function' && typeof StorageUtil.saveTracking === 'function') {
        const tracking = await StorageUtil.getTracking();
        if (tracking) {
          if (!tracking.gamification) tracking.gamification = {};
          const newAP = (tracking.gamification.totalAP || 0) + pts;
          tracking.gamification.bonusAP = (tracking.gamification.bonusAP || 0) + pts;
          tracking.gamification.totalAP = newAP;

          const engine = (typeof window !== 'undefined' && window.GamificationEngine) || (typeof GamificationEngine !== 'undefined' ? GamificationEngine : null);
          if (engine) {
            const totalEXP = tracking.gamification.totalEXP || 0;
            const lvlInfo = typeof engine.calculateLevelFromEXP === 'function'
              ? engine.calculateLevelFromEXP(totalEXP)
              : (typeof engine.calculateLevel === 'function' ? engine.calculateLevel(totalEXP) : null);
            if (lvlInfo) {
              tracking.gamification.level = lvlInfo.level;
              tracking.gamification.expProgressPct = lvlInfo.progressPct !== undefined ? lvlInfo.progressPct : lvlInfo.expProgressPct;
            }
            if (typeof engine.getRankTierFromAP === 'function') {
              const rankInfo = engine.getRankTierFromAP(newAP);
              if (rankInfo && rankInfo.currentRank) {
                tracking.gamification.rankId = rankInfo.currentRank.id;
                tracking.gamification.rankTitle = rankInfo.currentRank.title;
              }
            }
          }
          await StorageUtil.saveTracking(tracking);
        }
      }
    } catch(e) {
      console.warn("StudyMode: failed to award Pomodoro AP:", e);
    }
  }

  showPomoAlert(msg) {
    if (document.getElementById('ss-pomo-notice')) return;
    const notice = document.createElement('div');
    notice.id = 'ss-pomo-notice';
    notice.setAttribute('role', 'alert');
    Object.assign(notice.style, {
      position: 'fixed',
      top: '55px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '30px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 12px 32px rgba(99, 102, 241, 0.5), 0 0 20px rgba(168, 85, 247, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      zIndex: '10001',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: '14px',
      fontWeight: '600',
      backdropFilter: 'blur(16px)',
      webkitBackdropFilter: 'blur(16px)',
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      cursor: 'pointer',
      boxSizing: 'border-box'
    });
    notice.textContent = msg;
    let autoDismiss = null;
    let isFading = false;

    const removeNotice = () => {
      if (isFading) return;
      isFading = true;
      if (autoDismiss) {
        clearTimeout(autoDismiss);
        const targetTimer = autoDismiss;
        autoDismiss = null;
        this._noticeTimeouts = this._noticeTimeouts.filter(item => item !== targetTimer);
      }
      if (notice && notice.parentNode) {
        notice.style.opacity = '0';
        const t = setTimeout(() => {
          if (notice.parentNode) notice.parentNode.removeChild(notice);
          this._noticeTimeouts = this._noticeTimeouts.filter(item => item !== t);
        }, 300);
        this._noticeTimeouts.push(t);
      }
    };

    notice.addEventListener('click', removeNotice);

    if (document.body) document.body.appendChild(notice);

    autoDismiss = setTimeout(() => {
      removeNotice();
    }, 6000);
    this._noticeTimeouts.push(autoDismiss);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  isKeywordMatch(text, kw) {
    if (!text || !kw) return false;
    if (kw.length <= 3) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      return regex.test(text);
    }
    return text.includes(kw);
  }

  checkVideoAlignment() {
    if (typeof window === 'undefined' || !window.location || window.location.pathname !== '/watch') {
      this.removeNoticesAndWarnings();
      this._alignmentCheckActive = false;
      this.lastVideoId = null;
      return;
    }

    const videoId = new URLSearchParams(window.location.search).get('v');
    if (this.lastVideoId === videoId) return;
    this.lastVideoId = videoId;

    if (this._alignmentTimeout) {
      clearTimeout(this._alignmentTimeout);
      this._alignmentTimeout = null;
    }

    this._alignmentCheckActive = true;

    let attempts = 0;
    const maxAttempts = 10;

    const checkForTitle = () => {
      if (!this._alignmentCheckActive || !this.isActive) return;
      attempts++;
      const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer yt-formatted-string, h1.ytd-watch-metadata');
      
      if (titleElement && titleElement.textContent.trim().length > 0) {
        const title = titleElement.textContent.toLowerCase();

        const stopWords = new Set([
          'learn', 'about', 'how', 'to', 'the', 'a', 'an', 'and', 'or', 'for',
          'in', 'of', 'with', 'something', 'new', 'tutorial', 'course', 'basics',
          'introduction', 'guide', 'beginner', 'advanced', 'complete', 'full',
          'crash', 'i', 'me', 'my', 'want', 'need', 'understand', 'study', 'make'
        ]);
        const technicalTerms = new Set([
          'c', 'r', 'go', 'ai', 'ml', 'dl', 'nlp', 'cv', 'ui', 'ux', 'db',
          'os', 'js', 'ts', 'sql', 'css', 'ios', 'api', 'git', 'aws', 'gcp',
          'llm', 'gpt', 'ci', 'cd', 'qa', 'oop', 'dsa', 'vim', 'web3', 'k8s'
        ]);

        const rawGoal = typeof this.goal === 'string' ? this.goal : '';
        const normalizedGoal = rawGoal.toLowerCase()
          .replace(/\bc\+\+/g, 'cplusplus')
          .replace(/\bc#/g, 'csharp')
          .replace(/\bui\/ux\b/g, 'uiux')
          .replace(/[^\w\s-]/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const goalWords = [];
        for (const token of normalizedGoal.split(' ')) {
          const clean = token.replace(/-/g, '');
          if (!clean) continue;
          if (technicalTerms.has(clean)) { goalWords.push(clean); continue; }
          if (clean.length < 3 || stopWords.has(clean)) continue;
          goalWords.push(clean);
        }

        let matches = false;
        if (goalWords.length > 0) {
          let keywords = goalWords;
          if (window.FeedController && typeof window.FeedController.extractKeywords === 'function') {
            keywords = window.FeedController.extractKeywords(this.goal);
          }
          const normalizedTitle = title
            .replace(/\bc\+\+/g, 'cplusplus')
            .replace(/\bc#/g, 'csharp')
            .replace(/\bui\/ux\b/g, 'uiux');
          matches = keywords.some(word => this.isKeywordMatch(normalizedTitle, word));
        } else {
          matches = true;
        }

        if (!matches) {
          this.showAlignmentWarning();
        }
      } else if (attempts < maxAttempts) {
        this._alignmentTimeout = setTimeout(checkForTitle, 1000);
      }
    };
    
    checkForTitle();
  }

  showAlignmentWarning() {
    if (document.getElementById('ss-alignment-warning')) return;

    const warning = document.createElement('div');
    warning.id = 'ss-alignment-warning';
    warning.setAttribute('role', 'alert');
    
    Object.assign(warning.style, {
      position: 'fixed',
      top: '60px',
      right: '20px',
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      color: 'white',
      padding: '14px 22px',
      borderRadius: '14px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 12px 32px rgba(239, 68, 68, 0.4), 0 0 20px rgba(239, 68, 68, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      zIndex: '10000',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: '14px',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      backdropFilter: 'blur(16px)',
      webkitBackdropFilter: 'blur(16px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      boxSizing: 'border-box'
    });

    warning.innerHTML = `
      <span>⚠️ This video may not match your current learning goal.</span>
      <button id="ss-dismiss-warning" style="background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.4); color: white; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);">Dismiss</button>
    `;

    if (window.DOMUtils) {
      window.DOMUtils.appendChild(warning);
    } else if (document.body) {
      document.body.appendChild(warning);
    }

    let autoDismiss = null;
    let isFading = false;

    const removeWarning = () => {
      if (isFading) return;
      isFading = true;
      if (autoDismiss) {
        clearTimeout(autoDismiss);
        const targetTimer = autoDismiss;
        autoDismiss = null;
        this._warningTimeouts = this._warningTimeouts.filter(item => item !== targetTimer);
      }
      if (warning && warning.parentNode) {
        warning.style.opacity = '0';
        const t = setTimeout(() => {
          if (warning.parentNode) warning.parentNode.removeChild(warning);
          this._warningTimeouts = this._warningTimeouts.filter(item => item !== t);
        }, 300);
        this._warningTimeouts.push(t);
      }
    };

    const dismissBtn = warning.querySelector('#ss-dismiss-warning');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', removeWarning);
    }
    warning.addEventListener('click', removeWarning);

    autoDismiss = setTimeout(() => {
      removeWarning();
    }, 10000);
    this._warningTimeouts.push(autoDismiss);
  }
}

window.StudyMode = new StudyMode();
