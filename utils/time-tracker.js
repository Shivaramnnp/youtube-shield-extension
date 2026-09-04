// Time Tracking Utility for Content Script
/**
 * =========================================================================
 * TIME TRACKER SESSION STATE MACHINE
 * =========================================================================
 * Architecture & Lifecycle:
 * 1. Playback Monitoring: checkVideoState() polls every 1000ms. When video is
 *    playing and tab is active, activeTime is incremented.
 * 2. 10-Second Batch Flushes: Every 10s of active playback, activeTime is
 *    snapshotted and incrementWatchTime(secondsToFlush) is dispatched.
 * 3. Continuous Video Session Consolidation:
 *    - If the same video continues playing on the same date with an inactivity
 *      gap <= 120 seconds, the existing timelineLog record is updated IN PLACE
 *      (durationSeconds += seconds, endTime = now, lastActiveTimestamp = now).
 *    - A new session record is created ONLY when:
 *      a) The video changes (different videoId or title),
 *      b) An inactivity/pause gap > 120 seconds occurs,
 *      c) The calendar date rolls over (dateKey !== today),
 *      d) The tab unloads / page closes.
 * =========================================================================
 */

class TimeTracker {
  constructor() {
    this.intervalId = null;
    this.activeTime = 0;
    this._unloadBound = false;
  }

  startTracking() {
    if (this.intervalId) return;

    // Check every second
    this.intervalId = setInterval(() => this.checkVideoState(), 1000);

    // Bind tab close / unload flush handler
    if (!this._unloadBound && typeof window !== 'undefined') {
      const flushBound = () => this.flushPendingTime();
      window.addEventListener('beforeunload', flushBound);
      window.addEventListener('pagehide', flushBound);
      this._unloadBound = true;
    }

    console.log("TimeTracker started in content script");
  }

  stopTracking() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.flushPendingTime();
  }

  async flushPendingTime() {
    if (this.activeTime > 0) {
      const secondsToFlush = this.activeTime;
      this.activeTime = 0;
      await this.incrementWatchTime(secondsToFlush);
    }
  }

  async checkVideoState() {
    if (typeof StorageUtil !== 'undefined' && typeof StorageUtil.isContextValid === 'function') {
      if (!StorageUtil.isContextValid()) {
        this.stopTracking();
        return;
      }
    }

    if (typeof document === 'undefined') return;
    const video = document.querySelector('video');
    if (!video) return;

    // Only count if video is playing and tab is visible
    if (!video.paused && !video.ended && !document.hidden) {
      this.activeTime++;
      
      // Save every 10 seconds to avoid spamming storage
      if (this.activeTime >= 10) {
        const secondsToFlush = this.activeTime;
        this.activeTime = 0;
        await this.incrementWatchTime(secondsToFlush);
      }
    }
  }

  // FIX #3a: Use local timezone date instead of UTC
  getLocalDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Extract current video ID from URL search query or pathname
  getVideoId() {
    if (typeof window !== 'undefined' && window.location) {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.has('v')) return searchParams.get('v');
        const match = window.location.pathname.match(/\/(?:shorts|embed|watch)\/([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) return match[1];
      } catch (e) {}
    } else if (typeof location !== 'undefined') {
      try {
        const searchParams = new URLSearchParams(location.search);
        if (searchParams.has('v')) return searchParams.get('v');
        const match = location.pathname.match(/\/(?:shorts|embed|watch)\/([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) return match[1];
      } catch (e) {}
    }
    return null;
  }

  async incrementWatchTime(seconds) {
    // FIX #3b: Read-then-write with fresh storage read each cycle to prevent
    // multi-tab race conditions overwriting each other's accumulated time.
    // Each tab reads fresh state from storage before incrementing, so parallel
    // tabs accumulate additively rather than last-write-wins.
    const tracking = await StorageUtil.getTracking();
    const settings = await StorageUtil.getSettings();

    // FIX #3a: Use local date key instead of UTC
    const today = this.getLocalDateKey();

    // Initialize daily & hourly tracking if it doesn't exist
    if (!tracking.dailyWatchTime) tracking.dailyWatchTime = {};
    if (!tracking.dailyLearningTime) tracking.dailyLearningTime = {};
    if (!tracking.hourlyWatchTime) tracking.hourlyWatchTime = {};
    if (!tracking.hourlyLearningTime) tracking.hourlyLearningTime = {};
    if (!Array.isArray(tracking.timelineLog)) tracking.timelineLog = [];
    if (!tracking.gamification) {
      tracking.gamification = { currentStreak: 0, longestStreak: 0, lastLearningDate: null, badges: [] };
    }

    if (!tracking.dailyWatchTime[today]) tracking.dailyWatchTime[today] = 0;
    if (!tracking.dailyLearningTime[today]) tracking.dailyLearningTime[today] = 0;
    if (!tracking.hourlyWatchTime[today]) tracking.hourlyWatchTime[today] = {};
    if (!tracking.hourlyLearningTime[today]) tracking.hourlyLearningTime[today] = {};

    const now = new Date();
    const currentHour = String(now.getHours());

    // Prune old daily & hourly entries beyond 60 days to prevent storage bloat
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60);
    const cutoffY = cutoffDate.getFullYear();
    const cutoffM = String(cutoffDate.getMonth() + 1).padStart(2, '0');
    const cutoffD = String(cutoffDate.getDate()).padStart(2, '0');
    const cutoffKey = `${cutoffY}-${cutoffM}-${cutoffD}`;

    const allDateKeys = new Set([
      ...Object.keys(tracking.dailyWatchTime || {}),
      ...Object.keys(tracking.dailyLearningTime || {}),
      ...Object.keys(tracking.hourlyWatchTime || {}),
      ...Object.keys(tracking.hourlyLearningTime || {})
    ]);
    for (const dateKey of allDateKeys) {
      if (dateKey < cutoffKey) {
        if (tracking.dailyWatchTime) delete tracking.dailyWatchTime[dateKey];
        if (tracking.dailyLearningTime) delete tracking.dailyLearningTime[dateKey];
        if (tracking.hourlyWatchTime) delete tracking.hourlyWatchTime[dateKey];
        if (tracking.hourlyLearningTime) delete tracking.hourlyLearningTime[dateKey];
      }
    }

    // Prune timelineLog older than 60 days
    if (Array.isArray(tracking.timelineLog)) {
      tracking.timelineLog = tracking.timelineLog.filter(item => item && item.dateKey >= cutoffKey);
    }

    // R3-9 FIX: Reset weekly/monthly totals when the calendar boundary rolls over.
    const isoYear = this._isoYear(now);
    const weekKey = `${isoYear}-W${this._isoWeek(now)}`;
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (tracking.currentWeekKey !== weekKey) {
      tracking.currentWeekKey = weekKey;
      tracking.weeklyTotal = 0;
      tracking.weeklyLearningTotal = 0;
    }
    if (tracking.currentMonthKey !== monthKey) {
      tracking.currentMonthKey = monthKey;
      tracking.monthlyTotal = 0;
      tracking.monthlyLearningTotal = 0;
    }

    // Increment general time (daily + hourly)
    tracking.dailyWatchTime[today] += seconds;
    tracking.hourlyWatchTime[today][currentHour] = (tracking.hourlyWatchTime[today][currentHour] || 0) + seconds;
    tracking.weeklyTotal = (tracking.weeklyTotal || 0) + seconds;
    tracking.monthlyTotal = (tracking.monthlyTotal || 0) + seconds;

    // Increment learning time if Study Mode is active
    if (settings.studyMode) {
      tracking.dailyLearningTime[today] += seconds;
      tracking.hourlyLearningTime[today][currentHour] = (tracking.hourlyLearningTime[today][currentHour] || 0) + seconds;
      tracking.weeklyLearningTotal = (tracking.weeklyLearningTotal || 0) + seconds;
      tracking.monthlyLearningTotal = (tracking.monthlyLearningTotal || 0) + seconds;
      tracking.lifetimeLearningTotal = (tracking.lifetimeLearningTotal || 0) + seconds;
      
      this.updateStreaks(tracking, today, settings);
    }

    // Extract current video details for continuous session timeline log
    if (typeof document !== 'undefined') {
      const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer yt-formatted-string, h1.ytd-watch-metadata, #title h1, .ytp-title-link');
      const channelEl = document.querySelector('#channel-name #text a, ytd-channel-name #text a, ytd-channel-name yt-formatted-string a, #channel-name #text, ytd-channel-name #text, #owner-name a, #owner-name, #byline a, #byline, ytd-channel-name, #channel-name');
      
      const videoTitle = titleEl ? titleEl.textContent.trim() : (document.title || 'YouTube Video').replace(/ - YouTube$/i, '').trim();
      const rawChannel = channelEl ? channelEl.textContent : '';
      const channelName = (typeof StorageUtil !== 'undefined' && typeof StorageUtil.cleanChannelName === 'function')
        ? StorageUtil.cleanChannelName(rawChannel)
        : (rawChannel ? rawChannel.replace(/\s+/g, ' ').trim() : 'YouTube Channel');
      const videoId = this.getVideoId();

      if (videoTitle && videoTitle.length > 0 && videoTitle !== 'YouTube') {
        const timeDisplay = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const modeName = settings.goalMode ? 'Goal Mode' : (settings.studyMode ? 'Study Mode' : 'Standard');
        const nowTimestamp = now.getTime();
        
        // Update or append to timelineLog in tracking object
        if (!Array.isArray(tracking.timelineLog)) tracking.timelineLog = [];
        const lastLog = tracking.timelineLog[tracking.timelineLog.length - 1];
        
        // Continuous session state machine:
        // Calculate gap from last active playback timestamp (defaults to 0 if absent)
        const lastActiveTs = lastLog ? (lastLog.lastActiveTimestamp || lastLog.timestamp || 0) : 0;
        const gapMs = nowTimestamp - lastActiveTs;
        const GAP_THRESHOLD_MS = 120000; // 120 seconds meaningful inactivity gap

        // Video identity match:
        // Strictly require title match when titles are present; reject if videoIds conflict
        const isSameTitle = Boolean(lastLog && lastLog.title && videoTitle && lastLog.title.trim().toLowerCase() === videoTitle.trim().toLowerCase());
        const isSameVideoId = Boolean(lastLog && videoId && lastLog.videoId && lastLog.videoId === videoId);
        const isDifferentVideoId = Boolean(lastLog && videoId && lastLog.videoId && lastLog.videoId !== videoId);

        const isSameVideo = Boolean(
          lastLog &&
          !isDifferentVideoId &&
          (isSameVideoId || isSameTitle)
        );

        // State Machine Decision:
        // Update in place if: status is 'watched', same dateKey, same video, and gap <= 120s
        const isContinuousSession = Boolean(
          lastLog &&
          lastLog.status === 'watched' &&
          lastLog.dateKey === today &&
          isSameVideo &&
          gapMs <= GAP_THRESHOLD_MS
        );

        if (isContinuousSession) {
          // State: CONTINUOUS_PLAYBACK -> In-place consolidation
          lastLog.durationSeconds = (lastLog.durationSeconds || 0) + seconds;
          lastLog.endTime = timeDisplay;
          lastLog.lastActiveTimestamp = nowTimestamp;
          lastLog.timestamp = nowTimestamp; // Refresh timestamp so downstream queries stay current
          lastLog.isLearning = Boolean(settings.studyMode);
          lastLog.mode = modeName;
          if (videoId && !lastLog.videoId) lastLog.videoId = videoId;
          if (videoTitle && videoTitle !== 'YouTube Video' && (!lastLog.title || lastLog.title === 'YouTube Video' || (videoId && lastLog.videoId === videoId && lastLog.title !== videoTitle))) {
            lastLog.title = videoTitle;
          }
          if (channelName && channelName !== 'YouTube Channel' && (!lastLog.channel || lastLog.channel === 'YouTube Channel')) {
            lastLog.channel = channelName;
          }
        } else {
          // State: NEW_SESSION_BOUNDARY -> Initialize fresh record
          tracking.timelineLog.push({
            id: 'evt_' + nowTimestamp + '_' + Math.random().toString(36).substr(2, 5),
            videoId: videoId || null,
            timestamp: nowTimestamp,
            lastActiveTimestamp: nowTimestamp,
            dateKey: today,
            startTime: timeDisplay,
            endTime: timeDisplay,
            title: videoTitle,
            channel: channelName,
            durationSeconds: seconds,
            isLearning: Boolean(settings.studyMode),
            mode: modeName,
            status: 'watched'
          });
          if (tracking.timelineLog.length > 500) {
            tracking.timelineLog = tracking.timelineLog.slice(-500);
          }
        }
      }
    }

    // Always evaluate all 22 badges and recompute gamification stats on flush
    this.checkBadges(tracking, settings);

    await StorageUtil.saveTracking(tracking);

    // Check focus reminders (pass tracking AFTER save so lastReminderTriggered is fresh)
    this.checkFocusReminder(tracking, tracking.dailyWatchTime[today], settings);
  }

  // R3-9 helper: ISO week year
  _isoYear(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    return d.getUTCFullYear();
  }

  // R3-9 helper: ISO week number
  _isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  updateStreaks(tracking, today, settings = {}) {
    const gamification = tracking.gamification;
    
    // Require at least 60 seconds of learning to count as a streak day
    if (tracking.dailyLearningTime[today] >= 60) {
      if (gamification.lastLearningDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        // FIX #3a: Use local timezone for yesterday comparison too
        const y = yesterday.getFullYear();
        const m = String(yesterday.getMonth() + 1).padStart(2, '0');
        const d = String(yesterday.getDate()).padStart(2, '0');
        const yesterdayStr = `${y}-${m}-${d}`;

        if (gamification.lastLearningDate === yesterdayStr) {
           gamification.currentStreak++;
        } else {
           gamification.currentStreak = 1;
        }
        gamification.lastLearningDate = today;

        if (gamification.currentStreak > gamification.longestStreak) {
           gamification.longestStreak = gamification.currentStreak;
        }

        this.checkBadges(tracking, settings);
      }
    }
  }

  checkBadges(tracking, settings = {}) {
    if (!tracking) return tracking;

    // Ensure gamification sub-object exists
    if (!tracking.gamification) {
      tracking.gamification = {
        currentStreak: 0,
        longestStreak: 0,
        lastLearningDate: null,
        highFocusStreak: 0,
        totalBlockedShorts: 0,
        badges: [],
        unlockedBadgeDates: {},
        totalAP: 0,
        totalEXP: 0,
        level: 1,
        expProgressPct: 0,
        rankId: "bronze_focus",
        rankTitle: "Bronze Focus"
      };
    }

    const gamification = tracking.gamification;
    if (!Array.isArray(gamification.badges)) {
      gamification.badges = [];
    }
    if (!gamification.unlockedBadgeDates || typeof gamification.unlockedBadgeDates !== 'object') {
      gamification.unlockedBadgeDates = {};
    }

    const previousRankId = gamification.rankId;

    const totalLearningTime = tracking.lifetimeLearningTotal || tracking.monthlyLearningTotal || 0;
    const streak = gamification.currentStreak || 0;
    const blockedShorts = gamification.totalBlockedShorts || 0;
    const highFocusStreak = gamification.highFocusStreak || 0;

    const today = this.getLocalDateKey();
    const todayWatch = (tracking.dailyWatchTime && tracking.dailyWatchTime[today]) || 0;
    const todayLearn = (tracking.dailyLearningTime && tracking.dailyLearningTime[today]) || 0;
    const focusScore = todayWatch > 0 ? (todayLearn / todayWatch) * 100 : 0;

    const unlockIf = (badgeId, condition) => {
      if (!gamification.badges.includes(badgeId) && condition) {
        gamification.badges.push(badgeId);
        gamification.unlockedBadgeDates[badgeId] = Date.now();
        if (typeof window !== 'undefined' && window.AudioEngine) {
          window.AudioEngine.playBadgeUnlock();
        }
        return true;
      }
      return false;
    };

    // Category 1: Time Milestones (8 Badges)
    unlockIf('first_step', totalLearningTime >= 900);
    unlockIf('focus_rookie', totalLearningTime >= 3600);
    unlockIf('deep_diver', totalLearningTime >= 18000);
    unlockIf('dedicated_scholar', totalLearningTime >= 36000);
    unlockIf('mastermind', totalLearningTime >= 90000);
    unlockIf('study_warrior', totalLearningTime >= 180000);
    unlockIf('focus_legend', totalLearningTime >= 360000);
    unlockIf('grandmaster_scholar', totalLearningTime >= 900000);

    // Category 2: Streaks (7 Badges)
    unlockIf('streak_starter', streak >= 2);
    unlockIf('consistency_master', streak >= 3);
    unlockIf('week_warrior', streak >= 7);
    unlockIf('fortnight_master', streak >= 14);
    unlockIf('monthly_monk', streak >= 30);
    unlockIf('sixty_day_sage', streak >= 60);
    unlockIf('centurion_streak', streak >= 100);

    // Category 3: Shield Guard (7 Badges)
    unlockIf('shorts_defender', blockedShorts >= 10);
    unlockIf('focus_guardian', todayWatch >= 300 && focusScore >= 80);
    unlockIf('pure_focus', todayLearn >= 1800 && focusScore >= 100);
    unlockIf('time_commander', todayWatch >= 1800 && (settings && settings.timeManager && settings.timeManager.enabled ? todayWatch <= (settings.timeManager.dailyLimitMinutes * 60) : false));
    unlockIf('distraction_slayer', blockedShorts >= 100);
    unlockIf('iron_will', highFocusStreak >= 7);
    unlockIf('shield_master', blockedShorts >= 500 && streak >= 30);

    // Migration scan: Ensure all unlocked badges have an unlocked date entry
    gamification.badges.forEach(bId => {
      if (!gamification.unlockedBadgeDates[bId]) {
        gamification.unlockedBadgeDates[bId] = Date.now();
      }
    });

    // Recompute total AP, total EXP, level, expProgressPct, and PUBG rank tier
    if (typeof GamificationEngine !== 'undefined' && typeof GamificationEngine.calculateTotalAP === 'function') {
      gamification.totalAP = GamificationEngine.calculateTotalAP(gamification.badges, gamification.bonusAP || 0);
      gamification.totalEXP = GamificationEngine.calculateTotalEXP(gamification.badges, totalLearningTime);
      
      const levelInfo = GamificationEngine.calculateLevelFromEXP(gamification.totalEXP);
      gamification.level = levelInfo.level;
      gamification.expProgressPct = levelInfo.progressPct;

      const rankInfo = GamificationEngine.getRankTierFromAP(gamification.totalAP);
      gamification.rankId = rankInfo.currentRank.id;
      gamification.rankTitle = rankInfo.currentRank.title;

      // Backward compatibility fields
      gamification.rankTier = rankInfo.currentRank.title;
      gamification.rankIcon = rankInfo.currentRank.icon;
      gamification.totalPoints = gamification.totalAP;
    } else {
      // Inline fallback math if GamificationEngine module is absent
      const BADGE_AP = {
        first_step: 50, focus_rookie: 50, deep_diver: 100, dedicated_scholar: 100,
        mastermind: 200, study_warrior: 200, focus_legend: 500, grandmaster_scholar: 500,
        streak_starter: 50, consistency_master: 50, week_warrior: 100, fortnight_master: 100,
        monthly_monk: 200, sixty_day_sage: 200, centurion_streak: 500,
        shorts_defender: 50, focus_guardian: 50, pure_focus: 100, time_commander: 100,
        distraction_slayer: 200, iron_will: 200, shield_master: 500
      };
      const BADGE_EXP = {
        first_step: 500, focus_rookie: 500, deep_diver: 1000, dedicated_scholar: 1000,
        mastermind: 2000, study_warrior: 2000, focus_legend: 5000, grandmaster_scholar: 5000,
        streak_starter: 500, consistency_master: 500, week_warrior: 1000, fortnight_master: 1000,
        monthly_monk: 2000, sixty_day_sage: 2000, centurion_streak: 5000,
        shorts_defender: 500, focus_guardian: 500, pure_focus: 1000, time_commander: 1000,
        distraction_slayer: 2000, iron_will: 2000, shield_master: 5000
      };

      let ap = 0;
      let bExp = 0;
      gamification.badges.forEach(bId => {
        ap += BADGE_AP[bId] || 0;
        bExp += BADGE_EXP[bId] || 0;
      });
      gamification.totalAP = ap + Math.max(0, gamification.bonusAP || 0);
      gamification.totalEXP = bExp + Math.floor(totalLearningTime / 6);

      const exp = Math.max(0, gamification.totalEXP);
      const exactL = (-1 + Math.sqrt(9 + (exp / 25))) / 2;
      const lvl = Math.max(1, Math.floor(exactL));
      gamification.level = lvl;
      
      const curLvlThreshold = 100 * (lvl * lvl) + 100 * lvl - 200;
      const nextLvlThreshold = 100 * ((lvl + 1) * (lvl + 1)) + 100 * (lvl + 1) - 200;
      const span = nextLvlThreshold - curLvlThreshold;
      gamification.expProgressPct = span > 0 ? Math.min(100, Math.max(0, Math.floor(((exp - curLvlThreshold) / span) * 100))) : 100;

      if (ap >= 3500) { gamification.rankId = 'grandmaster_legend'; gamification.rankTitle = 'Grandmaster Legend'; }
      else if (ap >= 2000) { gamification.rankId = 'heroic_monk'; gamification.rankTitle = 'Heroic Monk'; }
      else if (ap >= 1000) { gamification.rankId = 'diamond_warrior'; gamification.rankTitle = 'Diamond Warrior'; }
      else if (ap >= 500) { gamification.rankId = 'gold_mastermind'; gamification.rankTitle = 'Gold Mastermind'; }
      else if (ap >= 200) { gamification.rankId = 'silver_scholar'; gamification.rankTitle = 'Silver Scholar'; }
      else { gamification.rankId = 'bronze_focus'; gamification.rankTitle = 'Bronze Focus'; }

      gamification.rankTier = gamification.rankTitle;
      gamification.totalPoints = gamification.totalAP;
    }

    if (previousRankId && gamification.rankId !== previousRankId) {
      if (typeof window !== 'undefined' && window.AudioEngine) {
        window.AudioEngine.playLevelUp();
      }
    }

    return tracking;
  }

  async checkFocusReminder(tracking, todayWatchTimeSeconds, settings) {
    if (!settings || !settings.focusReminderInterval || settings.focusReminderInterval <= 0) return;

    const intervalSeconds = settings.focusReminderInterval * 60;
    
    // Reset lastReminderTriggered if it exceeds todayWatchTimeSeconds (e.g. from a previous day)
    if ((tracking.lastReminderTriggered || 0) > todayWatchTimeSeconds) {
      tracking.lastReminderTriggered = 0;
    }

    const currentMultiple = Math.floor(todayWatchTimeSeconds / intervalSeconds);
    const lastMultiple = Math.floor((tracking.lastReminderTriggered || 0) / intervalSeconds);

    if (currentMultiple > lastMultiple && currentMultiple > 0) {
      this.triggerReminder();
      tracking.lastReminderTriggered = todayWatchTimeSeconds;
      await StorageUtil.saveTracking(tracking);
    }
  }

  triggerReminder() {
    // Show reminder overlay directly since we're in the content script
    if (typeof window.showFocusReminderOverlay === 'function') {
       window.showFocusReminderOverlay();
    }
  }

  accumulateTime(seconds) {
    return this.incrementWatchTime(seconds);
  }
}

// Export for main.js and Node testing environments
if (typeof window !== 'undefined') {
  window.TimeTrackerInstance = new TimeTracker();
  window.TimeTracker = TimeTracker;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TimeTracker, TimeTrackerInstance: typeof window !== 'undefined' ? window.TimeTrackerInstance : new TimeTracker() };
}
