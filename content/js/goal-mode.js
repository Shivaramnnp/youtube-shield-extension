// Goal Mode module for Shorts Shield - Strict Goal Enforcement
class GoalMode {
  constructor() {
    this.isActive = false;
    this.goal = "Learn something new";
    this.currentGoal = null;
    this.lastVideoId = null;
    this.lastVerifiedVideoId = null;
    this.lastVerifiedTitle = null;
    this._allowedVideoId = null;
    this.boundNavigate = this.onNavigate.bind(this);
    this.boundPlayLock = this.onPlayAttempt.bind(this);
    this._alignmentCheckActive = false;
    this._alignmentTimeout = null;
    this.isBlocked = false;
    this._titleObserver = null;
  }

  enable(goal) {
    if (goal) {
      if (this.isActive && this.goal !== goal) {
        this.goal = goal;
        this.currentGoal = goal;
        this._allowedVideoId = null;
        this.lastVideoId = null;
        this.lastVerifiedVideoId = null;
        this.lastVerifiedTitle = null;
        if (window.FeedController) {
          window.FeedController.enable(this.goal);
        }
        this.checkVideoGoalAlignment();
        return;
      }
      this.goal = goal;
    }
    if (this.isActive && this.currentGoal === this.goal) return;

    this.isActive = true;
    this.currentGoal = this.goal;

    if (window.DOMUtils) {
      window.DOMUtils.addClass('shorts-shield-goal-mode');
    } else {
      if (document.documentElement) document.documentElement.classList.add('shorts-shield-goal-mode');
      if (document.body) document.body.classList.add('shorts-shield-goal-mode');
    }

    if (window.FeedController) {
      window.FeedController.enable(this.goal);
    }

    this.checkVideoGoalAlignment();
    this.observeWatchTitle();

    window.removeEventListener('yt-navigate-finish', this.boundNavigate);
    window.addEventListener('yt-navigate-finish', this.boundNavigate);
    window.removeEventListener('yt-page-data-updated', this.boundNavigate);
    window.addEventListener('yt-page-data-updated', this.boundNavigate);

    console.log("GoalMode enabled with goal:", this.goal);
  }

  disable() {
    if (!this.isActive) return;
    this.isActive = false;
    this._alignmentCheckActive = false;
    if (this._alignmentTimeout) {
      clearTimeout(this._alignmentTimeout);
      this._alignmentTimeout = null;
    }
    if (this._titleObserver) {
      this._titleObserver.disconnect();
      this._titleObserver = null;
    }
    this.isBlocked = false;
    this.lastVideoId = null;
    this.lastVerifiedVideoId = null;
    this.lastVerifiedTitle = null;
    this._allowedVideoId = null;

    if (window.DOMUtils) {
      window.DOMUtils.removeClass('shorts-shield-goal-mode');
    } else {
      if (document.documentElement) document.documentElement.classList.remove('shorts-shield-goal-mode');
      if (document.body) document.body.classList.remove('shorts-shield-goal-mode');
    }

    window.removeEventListener('yt-navigate-finish', this.boundNavigate);
    window.removeEventListener('yt-page-data-updated', this.boundNavigate);
    this.removePlayLock();
    this.removeOverlay();

    console.log("GoalMode disabled");
  }

  onNavigate() {
    if (this.isActive) {
      const videoId = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search).get('v') : null;
      if (videoId && videoId !== this.lastVideoId) {
        this.isBlocked = true;
        this._allowedVideoId = null;
        this.lastVideoId = videoId;
        this.addPlayLock();
        this.pauseCurrentVideo();
      }
      this.checkVideoGoalAlignment();
    }
  }

  onPlayAttempt(e) {
    if (this.isBlocked) {
      this.pauseCurrentVideo();
    }
  }

  pauseCurrentVideo() {
    try {
      const moviePlayer = typeof document !== 'undefined' ? (document.getElementById('movie_player') || document.querySelector('.html5-video-player')) : null;
      if (moviePlayer && typeof moviePlayer.pauseVideo === 'function') {
        moviePlayer.pauseVideo();
      }
    } catch(e) {}

    try {
      if (typeof document !== 'undefined') {
        const videos = document.querySelectorAll('video');
        videos.forEach(v => {
          try {
            v.pause();
          } catch(err) {}
        });
      }
    } catch(e) {}
  }

  addPlayLock() {
    if (typeof document === 'undefined') return;
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      video.removeEventListener('play', this.boundPlayLock);
      video.addEventListener('play', this.boundPlayLock);
      video.removeEventListener('playing', this.boundPlayLock);
      video.addEventListener('playing', this.boundPlayLock);
      video.removeEventListener('timeupdate', this.boundPlayLock);
      video.addEventListener('timeupdate', this.boundPlayLock);
    });
    if (this.isBlocked) {
      this.pauseCurrentVideo();
    }
  }

  removePlayLock() {
    if (typeof document === 'undefined') return;
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      video.removeEventListener('play', this.boundPlayLock);
      video.removeEventListener('playing', this.boundPlayLock);
      video.removeEventListener('timeupdate', this.boundPlayLock);
    });
  }

  observeWatchTitle() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this._titleObserver) {
      this._titleObserver.disconnect();
      this._titleObserver = null;
    }

    const target = document.querySelector('h1.ytd-watch-metadata, #title h1, title') || document.head;
    if (target && typeof MutationObserver !== 'undefined') {
      this._titleObserver = new MutationObserver(() => {
        if (this.isActive && window.location && window.location.pathname === '/watch') {
          this.checkVideoGoalAlignment();
        }
      });
      this._titleObserver.observe(target, { childList: true, characterData: true, subtree: true });
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

  extractGoalKeywords(goalText) {
    const raw = typeof goalText === 'string' ? goalText : '';
    if (window.FeedController && typeof window.FeedController.extractKeywords === 'function') {
      return window.FeedController.extractKeywords(raw);
    }

    if (!raw) return [];
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

    const normalized = raw.toLowerCase()
      .replace(/\bc\+\+/g, 'cplusplus')
      .replace(/\bc#/g, 'csharp')
      .replace(/\bui\/ux\b/g, 'uiux')
      .replace(/[^\w\s-]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const keywords = [];
    for (const token of normalized.split(' ')) {
      const clean = token.replace(/-/g, '');
      if (!clean) continue;
      if (technicalTerms.has(clean)) { keywords.push(clean); continue; }
      if (clean.length < 3 || stopWords.has(clean)) continue;
      keywords.push(clean);
    }
    return [...new Set(keywords)];
  }

  checkVideoGoalAlignment() {
    if (typeof window === 'undefined' || !window.location || window.location.pathname !== '/watch') {
      this.isBlocked = false;
      this._alignmentCheckActive = false;
      this.removeOverlay();
      this.removePlayLock();
      return;
    }

    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId) return;

    if (this.lastVideoId && this.lastVideoId !== videoId) {
      this.isBlocked = true;
      this._allowedVideoId = null;
      this.addPlayLock();
      this.pauseCurrentVideo();
    }
    this.lastVideoId = videoId;

    if (this._allowedVideoId === videoId) {
      this.isBlocked = false;
      this.removePlayLock();
      this.removeOverlay();
      return;
    }

    if (this._alignmentTimeout) {
      clearTimeout(this._alignmentTimeout);
      this._alignmentTimeout = null;
    }

    this._alignmentCheckActive = true;
    let attempts = 0;
    const maxAttempts = 20;

    const checkForTitle = () => {
      if (!this._alignmentCheckActive || !this.isActive) return;
      attempts++;

      const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer yt-formatted-string, h1.ytd-watch-metadata, #title h1');
      const channelEl = document.querySelector('#channel-name #text a, ytd-channel-name #text a, ytd-channel-name yt-formatted-string a, #channel-name #text, ytd-channel-name #text, #owner-name a, #owner-name, #byline a, #byline, ytd-channel-name, #channel-name');
      const videoDescriptionEl = document.querySelector('#description-inline-expander, #description, ytd-video-secondary-info-renderer');

      const currentTitleText = titleEl ? titleEl.textContent.trim().toLowerCase() : "";
      const documentTitleText = (document.title || "").toLowerCase().replace(/ - youtube$/i, '').trim();
      
      const titleText = currentTitleText || documentTitleText;
      const rawChannel = channelEl ? channelEl.textContent : "";
      const channelText = ((typeof StorageUtil !== 'undefined' && typeof StorageUtil.cleanChannelName === 'function')
        ? StorageUtil.cleanChannelName(rawChannel)
        : rawChannel.replace(/\s+/g, ' ').trim()).toLowerCase();
      const videoDescription = videoDescriptionEl ? videoDescriptionEl.textContent.trim().toLowerCase() : "";

      // Detect if DOM title is still stale from previous video
      if (this.lastVerifiedTitle && videoId !== this.lastVerifiedVideoId && titleText === this.lastVerifiedTitle && attempts < maxAttempts) {
        this.isBlocked = true;
        this.addPlayLock();
        this.pauseCurrentVideo();
        this._alignmentTimeout = setTimeout(checkForTitle, 150);
        return;
      }

      if (titleText.length > 0) {
        const keywords = this.extractGoalKeywords(this.goal);
        const normalizedTitle = titleText
          .replace(/\bc\+\+/g, 'cplusplus')
          .replace(/\bc#/g, 'csharp')
          .replace(/\bui\/ux\b/g, 'uiux');

        const musicGoalTerms = ['music', 'song', 'singing', 'guitar', 'piano', 'violin', 'audio', 'composition', 'beatmaking', 'drum', 'bass', 'vocal', 'band', 'dj'];
        const isMusicGoal = keywords.some(kw => musicGoalTerms.includes(kw));

        const entertainmentTerms = [
          'song', 'songs', 'video song', 'music video', 'official video', 'official audio', 
          'lyrical video', 'lyric video', 'lyrics', 'full movie', 'remix', 'dj song', 
          'funny video', 'comedy video', 'lofi', 'slowed', 'reverb', 'soundtrack', 'ost',
          'official music', 'visualizer', 'audio track', 'full album', 'prod.', 'feat.', 'ft.',
          'concert', 'live performance', 'single', 'unplugged', 'beats'
        ];
        const channelEntertainmentTerms = ['vevo', 'topic', 'music', 'records', 'sounds', 'audio', 'label', 'band'];

        const isEntertainment = entertainmentTerms.some(term => titleText.includes(term)) ||
          channelEntertainmentTerms.some(term => channelText.includes(term));

        let isGoalRelevant = false;
        if (isEntertainment && !isMusicGoal) {
          // Songs & music videos are NEVER goal-relevant for non-music study goals
          isGoalRelevant = false;
        } else if (keywords.length > 0) {
          const fullText = `${normalizedTitle} ${channelText} ${videoDescription}`;
          const matchesKeyword = keywords.some(kw => this.isKeywordMatch(fullText, kw));
          isGoalRelevant = matchesKeyword;
        } else {
          const goalWords = (this.goal || '').toLowerCase()
            .replace(/[^\w\s]/gi, '')
            .split(/\s+/)
            .filter(w => w.length >= 3 && !['the', 'a', 'an', 'and', 'or', 'for', 'in', 'of', 'with', 'to'].includes(w));

          if (goalWords.length > 0) {
            const fullText = `${normalizedTitle} ${channelText}`;
            isGoalRelevant = goalWords.some(w => this.isKeywordMatch(fullText, w));
          } else {
            isGoalRelevant = !isEntertainment;
          }
        }

        if (!isGoalRelevant) {
          this.isBlocked = true;
          this.addPlayLock();
          this.pauseCurrentVideo();
          this.showGoalBlockOverlay(titleEl ? titleEl.textContent.trim() : (document.title || 'Video'));
        } else {
          this.isBlocked = false;
          this.lastVerifiedVideoId = videoId;
          this.lastVerifiedTitle = titleText;
          this.removePlayLock();
          this.removeOverlay();
        }
      } else if (attempts < maxAttempts) {
        this._alignmentTimeout = setTimeout(checkForTitle, 150);
      }
    };

    checkForTitle();
  }

  showGoalBlockOverlay(videoTitle) {
    if (typeof StorageUtil !== 'undefined' && typeof StorageUtil.addTimelineEvent === 'function') {
      const channelEl = document.querySelector('#channel-name #text a, ytd-channel-name #text a, ytd-channel-name yt-formatted-string a, #channel-name #text, ytd-channel-name #text, #owner-name a, #owner-name, #byline a, #byline, ytd-channel-name, #channel-name');
      const rawChannel = channelEl ? channelEl.textContent : '';
      const cleanChannel = (typeof StorageUtil !== 'undefined' && typeof StorageUtil.cleanChannelName === 'function')
        ? StorageUtil.cleanChannelName(rawChannel)
        : (rawChannel ? rawChannel.replace(/\s+/g, ' ').trim() : 'YouTube Channel');

      StorageUtil.addTimelineEvent({
        title: videoTitle || 'Off-Topic Video',
        channel: cleanChannel,
        isLearning: false,
        mode: 'Goal Mode (Strict)',
        status: 'blocked',
        durationSeconds: 0
      });
    }

    if (document.getElementById('ss-goal-block-overlay')) {
      const titleTextEl = document.getElementById('ss-goal-video-title');
      if (titleTextEl) titleTextEl.textContent = videoTitle;
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'ss-goal-block-overlay';
    overlay.className = 'ss-overlay-backdrop';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ss-goal-heading');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.88)',
      color: '#f8fafc',
      zIndex: '2147483647',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: '24px',
      textAlign: 'center',
      backdropFilter: 'blur(16px)',
      webkitBackdropFilter: 'blur(16px)',
      boxSizing: 'border-box'
    });

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(this.goal || '')}`;

    overlay.innerHTML = `
      <div class="ss-modal-card" style="background: rgba(15, 15, 26, 0.94); border: 1px solid rgba(99, 102, 241, 0.35); padding: 40px; border-radius: 20px; max-width: 540px; width: min(90vw, 540px); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15); animation: ssModalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); box-sizing: border-box;">
        <div style="font-size: 52px; margin-bottom: 16px; filter: drop-shadow(0 0 14px rgba(239, 68, 68, 0.45));">🎯</div>
        <h1 id="ss-goal-heading" style="font-size: 24px; font-weight: 800; margin: 0 0 10px 0; color: #f8fafc; letter-spacing: -0.02em;">Goal Mode Active</h1>
        <p style="font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 16px 0;">
          Your current learning goal is: <strong style="color: #818cf8; font-size: 16px; font-weight: 700;">"${this.escapeHtml(this.goal)}"</strong>
        </p>
        
        <div style="background: rgba(15, 23, 42, 0.85); border-left: 4px solid #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); border-left-width: 4px; padding: 14px 18px; border-radius: 12px; text-align: left; margin-bottom: 24px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), 0 0 12px rgba(239, 68, 68, 0.15);">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #f87171; font-weight: 700; margin-bottom: 4px;">Blocked Video</div>
          <div id="ss-goal-video-title" style="font-size: 14px; color: #f1f5f9; font-weight: 600; word-break: break-word; line-height: 1.4;">${this.escapeHtml(videoTitle)}</div>
        </div>

        <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 24px; line-height: 1.5;">
          This video does not match your active goal keyword. Stay focused on your study goal.
        </p>

        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <a href="${searchUrl}" id="ss-btn-search-goal" class="ss-btn-gradient-primary" style="padding: 12px 20px; font-size: 14px; font-weight: 600; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border: none; border-radius: 10px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 14px rgba(37,99,235,0.4); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
            🔍 Search "${this.escapeHtml(this.goal)}"
          </a>
          <a href="https://www.youtube.com/" id="ss-btn-go-home" class="ss-btn-gradient-secondary" style="padding: 12px 20px; font-size: 14px; font-weight: 600; background: linear-gradient(135deg, #334155 0%, #1e293b 100%); color: #f1f5f9; border: none; border-radius: 10px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 14px rgba(0,0,0,0.3); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
            🏠 Return to Safe Feed
          </a>
        </div>
      </div>
    `;

    if (window.DOMUtils) {
      window.DOMUtils.appendChild(overlay);
    } else if (document.body) {
      document.body.appendChild(overlay);
    }

    const searchBtn = overlay.querySelector('#ss-btn-search-goal');
    if (searchBtn && typeof searchBtn.focus === 'function') {
      try { searchBtn.focus(); } catch (e) {}
    }
  }

  allowCurrentVideoOnce() {
    if (this.lastVideoId) {
      this._allowedVideoId = this.lastVideoId;
    }
    this.isBlocked = false;
    this.removePlayLock();
    this.removeOverlay();
    const video = document.querySelector('video');
    if (video) {
      try {
        const p = video.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch (e) {}
    }
  }

  removeOverlay() {
    const overlay = document.getElementById('ss-goal-block-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
}

window.GoalMode = new GoalMode();
