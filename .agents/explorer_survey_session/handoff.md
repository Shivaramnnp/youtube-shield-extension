# Investigation Report: Session Tracking, Duplicate Logging, Channel Extraction, Storage Schema & Analytics

## 1. Observation

Direct code examination of the GodMode Chrome Extension codebase revealed the following exact file paths, line numbers, and implementation details:

### A. Session Tracking & Time Accumulation Mechanism
- **Content Script Entry Point** (`content/js/main.js:56-58, 234-237`):
  ```javascript
  if (window.TimeTrackerInstance) {
    window.TimeTrackerInstance.startTracking();
  }
  ```
  `main.js` starts `TimeTrackerInstance` upon script injection and restarts it when settings change.

- **Time Tracking Loop** (`utils/time-tracker.js:9-56`):
  `TimeTracker.startTracking()` initializes a 1-second interval (`setInterval(() => this.checkVideoState(), 1000)`).
  In `checkVideoState()`:
  ```javascript
  const video = document.querySelector('video');
  if (!video) return;
  if (!video.paused && !video.ended && !document.hidden) {
    this.activeTime++;
    if (this.activeTime >= 10) {
      const secondsToFlush = this.activeTime;
      this.activeTime = 0;
      await this.incrementWatchTime(secondsToFlush);
    }
  }
  ```

- **Daily & Hourly Metrics Aggregation** (`utils/time-tracker.js:140-154`):
  `incrementWatchTime(seconds)` reads storage fresh via `StorageUtil.getTracking()`, computes the local date key `today = this.getLocalDateKey()` (`YYYY-MM-DD`), and increments:
  ```javascript
  tracking.dailyWatchTime[today] += seconds;
  tracking.hourlyWatchTime[today][currentHour] = (tracking.hourlyWatchTime[today][currentHour] || 0) + seconds;
  tracking.weeklyTotal = (tracking.weeklyTotal || 0) + seconds;
  tracking.monthlyTotal = (tracking.monthlyTotal || 0) + seconds;
  ```
  If `settings.studyMode` is active, it increments `dailyLearningTime`, `hourlyLearningTime`, `weeklyLearningTotal`, and `monthlyLearningTotal`.

### B. The Duplicate Session-Logging Bug
- **Exact Bug Location 1** (`utils/time-tracker.js:170-195`):
  ```javascript
  const lastLog = tracking.timelineLog[tracking.timelineLog.length - 1];

  if (lastLog && lastLog.title === videoTitle && lastLog.dateKey === today && (now.getTime() - (lastLog.timestamp || 0)) < 45000) {
    lastLog.durationSeconds = (lastLog.durationSeconds || 0) + seconds;
    lastLog.endTime = timeDisplay;
    lastLog.isLearning = Boolean(settings.studyMode);
    lastLog.mode = modeName;
  } else {
    tracking.timelineLog.push({
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: now.getTime(),
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
  ```
- **Exact Bug Location 2** (`utils/storage.js:304-310`):
  ```javascript
  const last = tracking.timelineLog[tracking.timelineLog.length - 1];
  if (last && last.title === eventData.title && last.status === eventData.status && (Date.now() - last.timestamp) < 30000) {
    last.durationSeconds = (last.durationSeconds || 0) + (eventData.durationSeconds || 0);
    last.endTime = eventData.endTime || defaultTime;
    await StorageUtil.saveTracking(tracking);
    return;
  }
  ```
  In both files, `last.timestamp` is the session's **creation start timestamp**. The code checks `(now.getTime() - last.timestamp) < 45000` (or `< 30000`). Because `last.timestamp` is never updated to reflect the last active tick, after 45 seconds of continuous playback, `now.getTime() - last.timestamp` exceeds 45,000 ms. The branch fails, forcing a brand new session object to be created every 45-60 seconds for the same playing video.

### C. The Duplicate Channel Name Rendering Bug
- **Exact Bug Locations** (`utils/time-tracker.js:159-163` & `content/js/goal-mode.js:355-358`):
  ```javascript
  const channelEl = document.querySelector('ytd-channel-name, #owner-name, #channel-name, #byline');
  const channelName = channelEl ? channelEl.textContent.trim() : 'YouTube Channel';
  ```
  And in `options/options.js:506`:
  ```javascript
  <span>📺 ${item.channel || 'YouTube'}</span>
  ```
- **DOM Structure on YouTube**:
  YouTube renders `<ytd-channel-name>` containing both:
  1. `<yt-formatted-string id="text"><a ...>ChannelName</a></yt-formatted-string>`
  2. `<tp-yt-paper-tooltip class="style-scope ytd-channel-name">ChannelName</tp-yt-paper-tooltip>`
  Calling `.textContent` on `ytd-channel-name` extracts the text of ALL descendants, producing `"ChannelName\n        ChannelName"`, which normalizes to `"ChannelName ChannelName"` (e.g. `"Firstpost Firstpost"`).

### D. Analytics Calculations & Session Metrics
- **"Sessions Logged" & "Blocked Attempts"** (`options/options.js:419-430`):
  ```javascript
  const timelineLogs = Array.isArray(tracking.timelineLog)
    ? tracking.timelineLog.filter(item => item && item.dateKey === targetDateKey)
    : [];

  const sessionCount = timelineLogs.filter(i => i.status !== 'blocked').length;
  const blockedCount = timelineLogs.filter(i => i.status === 'blocked').length;

  const statActivityCountEl = document.getElementById('stat-activity-count');
  if (statActivityCountEl) statActivityCountEl.textContent = String(sessionCount);
  ```
- **"Focus Score"** (`options/options.js:414-416`, `popup/popup.js:141-143`, `utils/time-tracker.js:292`):
  ```javascript
  const focusScore = targetTotalSec > 0 ? Math.min(100, Math.max(0, Math.round((targetLearnSec / targetTotalSec) * 100))) : 0;
  ```
- **24-Hour Hourly Breakdown** (`options/options.js:433-471`):
  Constructs 24 stacked vertical bars for hours 0..23 using `tracking.hourlyWatchTime[dateKey][h]` and `tracking.hourlyLearningTime[dateKey][h]`.

---

## 2. Logic Chain

1. **Why Duplicate Sessions Occur**:
   - `TimeTracker` checks `(now.getTime() - lastLog.timestamp) < 45000`.
   - `lastLog.timestamp` is the immutable session creation time.
   - For any video watched longer than 45 seconds, this condition evaluates to `false` on the 5th flush (t = 50s).
   - This causes `tracking.timelineLog.push()` to execute every minute.
   - Downstream, `options.js` computes `Sessions Logged` as `timelineLogs.filter(i => i.status !== 'blocked').length`. Since there were ~60 entries for a 60-minute video, `Sessions Logged` inflated to 60 instead of 1.

2. **Why Channel Names Duplicate**:
   - YouTube's `<ytd-channel-name>` element contains a tooltip element (`<tp-yt-paper-tooltip>`) that repeats the channel name string.
   - Querying `ytd-channel-name` directly and reading `textContent` collects both strings concatenated together.
   - Without targeted sub-element selection (`#text a`, `yt-formatted-string a`) and string deduplication, `"Firstpost Firstpost"` is stored in `chrome.storage` and rendered in the timeline.

3. **Required State Machine**:
   - State machine must distinguish between:
     - `SESSION_INIT`: Fresh video navigation (`v` param or title change).
     - `SESSION_ACTIVE`: Same video playing continuously (`video && !video.paused && !document.hidden`). Updates the SAME record in place (`durationSeconds += flushedSeconds`, `endTime = currentTime`, `lastActiveTimestamp = Date.now()`).
     - `SESSION_PAUSED / GAP`: Video paused or idle. If gap <= `GAP_THRESHOLD` (e.g. 120s), resume appends to current session; if gap > `GAP_THRESHOLD` or user switches videos, finalize session and open a new session record.
     - `SESSION_FINALIZED`: SPA navigation away or tab closed/unloaded.

4. **Storage Schema & Migration Strategy**:
   - Schema remains backwards-compatible:
     ```typescript
     interface TimelineEvent {
       id: string;                 // 'evt_<timestamp>_<rand>'
       timestamp: number;          // session creation timestamp
       dateKey: string;            // 'YYYY-MM-DD'
       startTime: string;          // 'HH:MM'
       endTime: string;            // 'HH:MM'
       title: string;              // clean video title
       channel: string;            // clean channel name
       durationSeconds: number;    // total active playback seconds
       durationMinutes?: number;   // Math.round(durationSeconds / 60)
       isLearning: boolean;        // Study Mode flag
       mode: string;               // 'Study Mode' | 'Goal Mode' | 'Standard'
       status: 'watched' | 'blocked' | 'sprint';
       lastActiveTimestamp?: number;
       videoId?: string;
     }
     ```
   - Migration logic iterates through stored `timelineLog` entries:
     - Cleans duplicate channel strings (`cleanChannelName`).
     - Merges adjacent records sharing the same `title`, `dateKey`, `status: 'watched'`:
       - `prev.durationSeconds += item.durationSeconds`
       - `prev.endTime = item.endTime`
       - `prev.isLearning = prev.isLearning || item.isLearning`
       - `prev.lastActiveTimestamp = item.lastActiveTimestamp || item.timestamp`
     - Preserves blocked attempts and distinct video sessions.
     - Runs once on extension load / storage read, guarded by `migrationVersion` or idempotent execution.

---

## 3. Caveats

1. **SPA Title Delay**: On YouTube, when navigating between videos, the DOM `<title>` and `h1` elements may update 100-300ms after the video begins buffering/playing. Session initialization should fall back to URL query parameter `v=...` if title is initially `'YouTube'` or empty, and update title in place once DOM metadata renders.
2. **Multi-Tab Playback**: If a user plays YouTube in multiple tabs simultaneously, `StorageUtil.getTracking()` fresh read before save ensures additive accumulation. The session updater must match both `videoId`/`title` and recent active timestamp to avoid cross-tab collision.
3. **Blocked Events**: Off-topic videos blocked by Goal Mode create `status: 'blocked'` records with `durationSeconds: 0`. These should NOT be merged with standard watched sessions.

---

## 4. Conclusion

1. **Root Cause 1 (Duplicate Sessions)**: `time-tracker.js` line 172 compared `now.getTime() - lastLog.timestamp < 45000` against the immutable session start time instead of tracking an active session state with `lastActiveTimestamp`.
2. **Root Cause 2 (Duplicate Channel Names)**: `time-tracker.js` line 159 extracted `textContent` from `<ytd-channel-name>`, which contains both the channel link and `<tp-yt-paper-tooltip>`.
3. **State Machine Solution**: Track `currentSession` with `lastActiveTimestamp` and update `durationSeconds` in place for continuous playback. Finalize session only on URL navigation, tab unload, or inactive gap > 120s.
4. **Migration Solution**: An idempotent `migrateTimelineLog()` function that cleans channel names and merges consecutive duplicate video entries in `tracking.timelineLog`.
5. **Analytics Consistency**: `Sessions Logged` in `options.js` will immediately reflect true session counts without changing the underlying Focus Score or 24-hour hourly formulas.

---

## 5. Verification Method

### Concrete Verification Steps
1. **Unit Test Verification**:
   - Run `npm test` from project root: verify all 331 tests pass.
   - Run `node tests/syntax/syntax-checker.js`: verify 88/88 JS files pass clean syntax checks.
2. **Session Consolidator Test**:
   - Execute 2 or more consecutive calls to `incrementWatchTime(10)` with the same video title/URL.
   - Query `StorageUtil.getTracking()`.
   - Assert `tracking.timelineLog.length === 1`.
   - Assert `tracking.timelineLog[0].durationSeconds === 20`.
3. **Channel Deduplication Test**:
   - Pass `<ytd-channel-name><div id="text-container"><yt-formatted-string id="text"><a href="/@Firstpost">Firstpost</a></yt-formatted-string></div><tp-yt-paper-tooltip>Firstpost</tp-yt-paper-tooltip></ytd-channel-name>` to channel extractor.
   - Assert extracted channel is exactly `"Firstpost"`.
4. **Historical Migration Test**:
   - Seed `chrome.storage.local` with 15 duplicate 1-minute entries of `"Learn Physics"` with channel `"Firstpost Firstpost"`.
   - Run migration function.
   - Assert `timelineLog` contains 1 record with `durationSeconds: 900`, `channel: "Firstpost"`, and `Sessions Logged` in options UI displays `1`.
