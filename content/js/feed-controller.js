class FeedController {
  constructor() {
    this.isActive = false;
    this.goalKeywords = [];
    this.blockedKeywords = [];
    this.blockedChannels = [];
    this.learningGoal = null;
    this.initClickInterceptor();
  }

  initClickInterceptor() {
    if (typeof document === 'undefined') return;
    if (this._clickInterceptorBound) return;
    this._clickInterceptorBound = true;

    document.addEventListener('click', (e) => {
      if (!e || !e.target) return;
      const target = e.target;
      const blockedEl = (typeof target.closest === 'function')
        ? target.closest('[data-ss-blocked="true"], .ss-ghost-purged')
        : null;

      if (blockedEl) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

        const channelEl = blockedEl.querySelector('ytd-channel-name, #channel-name, .ytd-channel-name, #byline, .yt-channel-name');
        const chName = channelEl ? channelEl.textContent.trim() : 'YouTube Creator';

        if (typeof window !== 'undefined') {
          if (window.quickBlockInstance && typeof window.quickBlockInstance.renderBlockedOverlay === 'function') {
            window.quickBlockInstance.renderBlockedOverlay('Ghost Shield Purged Item', chName);
          } else if (window.QuickBlock && typeof window.QuickBlock.renderBlockedOverlay === 'function') {
            window.QuickBlock.renderBlockedOverlay('Ghost Shield Purged Item', chName);
          }
        }
      }
    }, true); // Capture phase
  }

  setBlocklist(blockedKeywords = [], blockedChannels = []) {
    const rawKws = Array.isArray(blockedKeywords) ? blockedKeywords : [];
    const rawChs = Array.isArray(blockedChannels) ? blockedChannels : [];
    this.blockedKeywords = rawKws
      .map(k => (typeof k === 'string' ? k : String(k || '')).trim().toLowerCase())
      .filter(Boolean);
    this.blockedChannels = rawChs
      .map(c => (typeof c === 'string' ? c : String(c || '')).trim().toLowerCase())
      .filter(Boolean);
    
    // If blocklists are cleared and study mode is inactive, unhide all off-topic cards
    const hasBlocklist = (this.blockedKeywords.length > 0) || (this.blockedChannels.length > 0);
    if (!hasBlocklist && !this.isActive) {
      this.clearOffTopicCards();
    }
    
    this.applyBlocklist();
    this.updateObserver();
  }

  clearOffTopicCards() {
    const offTopicCards = document.querySelectorAll('.off-topic');
    offTopicCards.forEach(el => {
      el.classList.remove('off-topic');
      el.classList.remove('ss-ghost-purged');
      if (typeof el.removeAttribute === 'function') el.removeAttribute('data-ss-blocked');
      el.style.display = '';
      el.style.visibility = '';
      el.style.pointerEvents = '';
    });
  }

  updateObserver() {
    const hasBlocklist = (this.blockedKeywords && this.blockedKeywords.length > 0) || (this.blockedChannels && this.blockedChannels.length > 0);
    if (this.isActive || hasBlocklist) {
      if (window.ObserverUtils) {
        window.ObserverUtils.observe(
          'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer',
          (elements) => this.filterFeed(elements),
          'feed-controller'
        );
      }
    } else {
      if (window.ObserverUtils) {
        window.ObserverUtils.disconnect('feed-controller');
      }
    }
  }

  applyBlocklist() {
    const videoCards = document.querySelectorAll(
      'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, .ytd-rich-item-renderer, .ytd-video-renderer, .ytd-compact-video-renderer, .ytd-grid-video-renderer, .off-topic'
    );
    this.filterFeed(videoCards);
  }

  filterFeed(elements) {
    if (!elements) return;
    let nodeList;
    if (typeof elements.forEach === 'function') {
      nodeList = elements;
    } else if (Array.isArray(elements) || (typeof elements === 'object' && elements[Symbol.iterator])) {
      nodeList = Array.from(elements);
    } else {
      nodeList = [elements];
    }

    nodeList.forEach(el => {
      if (!el || typeof el.querySelector !== 'function') return;
      // Skip if it's a Shorts container (handled by shorts-blocker)
      if (el.querySelector('a[href*="shorts"], a[title*="Shorts"], yt-formatted-string[title*="Shorts"], ytd-reel-item-renderer')) return;

      const titleEl = el.querySelector('#video-title, #video-title-link, .ytd-video-renderer #video-title, h3 #video-title, .title');
      const channelEl = el.querySelector('ytd-channel-name, #channel-name, .ytd-channel-name, #byline, .yt-channel-name, #text.ytd-channel-name, #owner-name');

      if (!titleEl) return;

      const titleText = (titleEl.getAttribute('title') || titleEl.textContent || "").toLowerCase();
      const channelText = channelEl ? (channelEl.getAttribute('title') || channelEl.getAttribute('aria-label') || channelEl.textContent || "").toLowerCase().trim() : "";

      // Issue 1.5: Normalize title text for technical terms (e.g. C++ -> cplusplus, C# -> csharp, UI/UX -> uiux)
      const normalizedTitle = titleText
        .replace(/c\+\+/gi, 'cplusplus')
        .replace(/c#/gi, 'csharp')
        .replace(/ui\/ux/gi, 'uiux');

      // 1. Custom Blocklist Evaluation (Ghost Shield Purge)
      const isBlockedKeyword = Array.isArray(this.blockedKeywords) && this.blockedKeywords.some(kw => {
        if (!kw) return false;
        const rawKw = String(kw).trim().toLowerCase();
        if (!rawKw) return false;

        const normKw = rawKw
          .replace(/c\+\+/gi, 'cplusplus')
          .replace(/c#/gi, 'csharp')
          .replace(/ui\/ux/gi, 'uiux');

        // Multi-word phrase or technical token with special chars: phrase match
        if (rawKw.includes(' ') || normKw.includes(' ') || /[^a-z0-9]/i.test(normKw)) {
          return titleText.includes(rawKw) || normalizedTitle.includes(rawKw) || normalizedTitle.includes(normKw) || titleText.includes(normKw);
        }

        // Single word token: word-boundary match (prevents "x" matching "fox", "next", "matrix")
        const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundaryRegex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, 'i');
        return wordBoundaryRegex.test(normalizedTitle) || wordBoundaryRegex.test(titleText);
      });

      // Extract accurate channel name for exact identity match
      let extractedChannelName = '';
      const channelLink = el.querySelector('ytd-channel-name a, #channel-name a, #byline a, .yt-channel-name a, #text.ytd-channel-name a, #owner-name a, a.yt-simple-endpoint.yt-formatted-string');
      if (channelLink && channelLink.textContent && channelLink.textContent.trim()) {
        extractedChannelName = channelLink.textContent.trim();
      } else if (channelEl) {
        extractedChannelName = channelEl.getAttribute('title') || channelEl.getAttribute('aria-label') || channelEl.textContent || '';
      }

      let cleanExtractedChannel = String(extractedChannelName || channelText)
        .replace(/\s*(?:subscribe|subscribed|verified|•\s*subscribe)\s*$/i, '')
        .trim();

      // Deduplicate repeated phrases e.g. "Channel Channel"
      const chWords = cleanExtractedChannel.split(/\s+/);
      if (chWords.length >= 2 && chWords.length % 2 === 0) {
        const half = chWords.length / 2;
        const firstHalf = chWords.slice(0, half).join(' ');
        const secondHalf = chWords.slice(half).join(' ');
        if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
          cleanExtractedChannel = firstHalf;
        }
      }

      const normExtractedChannel = cleanExtractedChannel.toLowerCase().replace(/^@/, '').trim();
      const alphaExtractedChannel = normExtractedChannel.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      const extractedWords = alphaExtractedChannel.split(/\s+/).filter(Boolean);

      const isBlockedChannel = Array.isArray(this.blockedChannels) && this.blockedChannels.some(ch => {
        if (!ch) return false;
        const normBlocked = String(ch).toLowerCase().replace(/^@/, '').trim();
        if (!normBlocked) return false;

        // 1. Exact equality (e.g. "x" === "x", "mrbeast" === "mrbeast")
        if (normExtractedChannel === normBlocked) return true;

        // 2. Alphanumeric stripped equality (e.g. "Linus Tech Tips!" === "Linus Tech Tips")
        const alphaBlocked = normBlocked.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
        if (alphaExtractedChannel && alphaBlocked && alphaExtractedChannel === alphaBlocked) return true;

        // 3. Multi-word phrase or token boundary matching
        if (alphaBlocked.includes(' ')) {
          if (alphaExtractedChannel.startsWith(alphaBlocked + ' ') || alphaExtractedChannel.endsWith(' ' + alphaBlocked)) {
            return true;
          }
        } else {
          // Single word blocked channel: match standalone word token (e.g. "BadChannel" in "BadChannel Tech")
          // but strictly NOT substring inside words (e.g. "x" in "Fox", "SpaceX", "Vox")
          if (extractedWords.includes(alphaBlocked)) {
            return true;
          }
        }

        return false;
      });

      if (isBlockedKeyword || isBlockedChannel) {
        el.classList.add('off-topic');
        el.classList.add('ss-ghost-purged');
        if (typeof el.setAttribute === 'function') el.setAttribute('data-ss-blocked', 'true');
        el.style.display = 'none'; // Completely hide blocked items
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
        return;
      }

      // 2. Goal Mode / Study Mode Filtering (Home feed and watch sidebar only, preserve explicit user search results on /results)
      const isSearchPage = (typeof window !== 'undefined' && window.location && window.location.pathname === '/results');

      if (this.isActive && this.goalKeywords && this.goalKeywords.length > 0 && !isSearchPage) {
        const fullText = titleText + " " + normalizedTitle + " " + channelText;

        const musicGoalTerms = ['music', 'song', 'singing', 'guitar', 'piano', 'violin', 'audio', 'composition', 'beatmaking', 'drum', 'bass', 'vocal', 'band'];
        const isMusicGoal = this.goalKeywords.some(kw => musicGoalTerms.includes(kw));

        const entertainmentTerms = [
          'song', 'songs', 'video song', 'music video', 'official video', 'official audio', 
          'lyrical video', 'lyric video', 'lyrics', 'full movie', 'remix', 'dj song', 
          'funny video', 'comedy video', 'lofi', 'slowed', 'reverb', 'soundtrack', 'ost',
          'official music', 'visualizer', 'audio track', 'full album'
        ];
        const channelEntertainmentTerms = ['vevo', ' - topic', 'music', 'records', 'soundtracks'];

        const isEntertainment = entertainmentTerms.some(term => titleText.includes(term)) ||
          channelEntertainmentTerms.some(term => channelText.includes(term));

        let isRelevant = false;
        if (isEntertainment && !isMusicGoal) {
          isRelevant = false;
        } else {
          isRelevant = this.goalKeywords.some(kw => fullText.includes(kw));
        }

        if (!isRelevant) {
          el.classList.add('off-topic');
          el.style.display = 'none';
        } else {
          el.classList.remove('off-topic');
          el.style.display = '';
        }
      } else {
        // If on search page or Study mode is off, make sure card is visible (unless custom blocked)
        if (!isBlockedKeyword && !isBlockedChannel) {
          el.classList.remove('off-topic');
          el.style.display = '';
        }
      }
    });
  }

  enable(learningGoal) {
    if (this.isActive && this.learningGoal === learningGoal) return;
    this.isActive = true;
    this.learningGoal = learningGoal;
    this.goalKeywords = this.extractKeywords(learningGoal);

    if (window.DOMUtils) {
      window.DOMUtils.addClass('shorts-shield-feed-filtered');
    } else {
      if (document.documentElement) document.documentElement.classList.add('shorts-shield-feed-filtered');
      if (document.body) document.body.classList.add('shorts-shield-feed-filtered');
    }

    // BUG-8 FIX: Inform clearly when the goal produces no usable keywords so users
    // know filtering is inactive rather than silently doing nothing.
    if (this.goalKeywords.length === 0) {
      console.info(
        `[Shorts Shield] Study Mode feed filtering is inactive: goal "${learningGoal}" ` +
        `contains only common stop words. Try being more specific (e.g. "Python", "Machine Learning", "Piano").`
      );
    }

    // Filter existing elements
    this.applyBlocklist();

    // Observe future additions via infinite scroll
    this.updateObserver();
    console.log("FeedController enabled with keywords:", this.goalKeywords);
  }

  disable() {
    if (!this.isActive) return;
    this.isActive = false;
    this.learningGoal = null;
    this.goalKeywords = [];

    if (window.DOMUtils) {
      window.DOMUtils.removeClass('shorts-shield-feed-filtered');
    } else {
      if (document.documentElement) document.documentElement.classList.remove('shorts-shield-feed-filtered');
      if (document.body) document.body.classList.remove('shorts-shield-feed-filtered');
    }

    const hasBlocklist = (this.blockedKeywords && this.blockedKeywords.length > 0) || (this.blockedChannels && this.blockedChannels.length > 0);
    if (hasBlocklist) {
      this.applyBlocklist();
    } else {
      document.querySelectorAll('.off-topic').forEach(el => {
        el.classList.remove('off-topic');
        el.style.display = '';
      });
    }

    this.updateObserver();
    console.log("FeedController disabled");
  }

  extractKeywords(goal) {
    const raw = typeof goal === 'string' ? goal : '';
    if (!raw) return [];

    // FIX #1: Preserve technical short terms (C++, Go, AI, ML, R, SQL, UI/UX, Web3, etc.)
    // before stripping punctuation, so they survive keyword extraction.

    // Step 1: Common learning stop words to filter out
    const stopWords = new Set([
      'learn', 'about', 'how', 'to', 'the', 'a', 'an', 'and', 'or', 'for',
      'in', 'of', 'with', 'something', 'new', 'tutorial', 'course', 'basics',
      'introduction', 'guide', 'beginner', 'advanced', 'complete', 'full',
      'crash', 'i', 'me', 'my', 'want', 'need', 'understand', 'study', 'make'
    ]);

    // Step 2: Known technical short-form terms to preserve even if very short
    const technicalTerms = new Set([
      'c', 'r', 'go', 'ai', 'ml', 'dl', 'nlp', 'cv', 'ui', 'ux', 'db',
      'os', 'js', 'ts', 'sql', 'css', 'ios', 'api', 'git', 'aws', 'gcp',
      'llm', 'gpt', 'ci', 'cd', 'qa', 'oop', 'dsa', 'vim', 'web3', 'k8s'
    ]);

    const keywords = [];

    // Step 3: Tokenize carefully — preserve common compound tech terms
    // Replace common multi-word technical compound notations
    const normalized = raw
      .toLowerCase()
      // Normalize "c++" -> "cplusplus" to prevent stripping
      .replace(/\bc\+\+/g, 'cplusplus')
      // Normalize "c#" -> "csharp"
      .replace(/\bc#/g, 'csharp')
      // Normalize "ui/ux" -> "uiux"
      .replace(/\bui\/ux\b/g, 'uiux')
      // Normalize "web3" stays as is
      // Strip remaining punctuation except alphanumerics, spaces, hyphens
      .replace(/[^\w\s-]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = normalized.split(' ');

    for (const token of tokens) {
      if (!token) continue;
      const clean = token.replace(/-/g, ''); // merge hyphenated compounds
      if (clean.length === 0) continue;

      // Always keep known technical short terms even if 1-2 chars
      if (technicalTerms.has(clean)) {
        keywords.push(clean);
        continue;
      }

      // Skip very short non-technical words and stop words
      if (clean.length < 3) continue;
      if (stopWords.has(clean)) continue;

      keywords.push(clean);
    }

    // Step 4: Broad Category Concept Expansion & Root Stemming (0 hardcoded titles or names)
    const categorySynonyms = {
      communication: ['speaking', 'speech', 'presentation', 'keynote', 'talk', 'conversation', 'vocabulary', 'grammar', 'fluency', 'debate', 'rhetoric', 'interview', 'pitch', 'softskills', 'language'],
      english: ['grammar', 'vocabulary', 'speaking', 'fluency', 'pronunciation', 'listening', 'ielts', 'toefl'],
      upsc: ['ias', 'ips', 'civilservices', 'currentaffairs', 'history', 'polity', 'geography', 'economy', 'editorial'],
      coding: ['programming', 'developer', 'software', 'python', 'javascript', 'java', 'cpp', 'html', 'css', 'react', 'dsa', 'algorithms'],
      programming: ['coding', 'developer', 'software', 'python', 'javascript', 'java', 'dsa', 'algorithms']
    };

    const expanded = [...keywords];
    for (const kw of keywords) {
      if (categorySynonyms[kw]) {
        expanded.push(...categorySynonyms[kw]);
      }
    }

    // Deduplicate
    return [...new Set(expanded)];
  }
}

const feedControllerInstance = new FeedController();

if (typeof window !== 'undefined') {
  window.FeedController = feedControllerInstance;
}
if (typeof globalThis !== 'undefined') {
  globalThis.FeedController = globalThis.FeedController || feedControllerInstance;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = feedControllerInstance;
}
