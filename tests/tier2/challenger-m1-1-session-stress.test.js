/**
 * Tier 2 Stress & Boundary Suite: Challenger M1-1 Empirical Session State Machine Stress
 * File: tests/tier2/challenger-m1-1-session-stress.test.js
 * 
 * Adversarially tests:
 * 1. Rapid consecutive ticks & zero drift accumulation
 * 2. Ping-pong Video Switches (Video A -> Video B -> Video A -> Video B) ensuring non-merging across boundaries
 * 3. SPA Transitions & Video ID extraction across watch/shorts/embed URLs
 * 4. Tab Backgrounding & Visibility change suppression (document.hidden)
 * 5. Midnight Date Rollover session boundary isolation & dailyWatchTime partitioning
 * 6. Tab Unload / beforeunload / pagehide partial flush preservation
 * 7. Inactivity Gap Threshold Exact Boundary (<=120s vs >120s)
 * 8. Adversarial Migration & Multi-pattern Channel Deduplication Idempotency
 * 9. Options Analytics "Sessions Logged" & Focus Score Consistency under stress
 */

require('../harness/mock-extension-env.js');
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
const { TimeTracker } = require('../../utils/time-tracker');

describe('Challenger M1-1: Empirical Session State Machine Stress & Verification', () => {

  // =========================================================================
  // 1. Rapid Consecutive Ticks & Zero Drift Accumulation
  // =========================================================================
  test('Stress 1: 100 rapid consecutive ticks accumulate to exactly 100s without drift or duplicate records', async () => {
    await resetStorage();
    await resetDOM();

    const titleEl = document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = document.createElement('yt-formatted-string');
    textEl.textContent = 'High Frequency Microservices Architecture';
    titleEl.appendChild(textEl);
    document.body.appendChild(titleEl);

    const tracker = new TimeTracker();
    const today = tracker.getLocalDateKey();

    // Fire 100 consecutive 1-second ticks in rapid sequence
    for (let i = 0; i < 100; i++) {
      await tracker.incrementWatchTime(1);
    }

    const tracking = await StorageUtil.getTracking();

    assert.equal(tracking.timelineLog.length, 1, '100 rapid ticks on same video must produce exactly 1 timeline record');
    assert.equal(tracking.timelineLog[0].durationSeconds, 100, 'durationSeconds must accurately equal 100s');
    assert.equal(tracking.dailyWatchTime[today], 100, 'dailyWatchTime must equal 100s');
    assert.equal(tracking.weeklyTotal, 100, 'weeklyTotal must equal 100s');
    assert.equal(tracking.monthlyTotal, 100, 'monthlyTotal must equal 100s');
  });

  // =========================================================================
  // 2. Ping-Pong Video Switches (A -> B -> A -> B)
  // =========================================================================
  test('Stress 2: Ping-pong navigation (Video A -> Video B -> Video A -> Video B) creates 4 distinct session records', async () => {
    await resetStorage();
    await resetDOM();

    const titleEl = document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = document.createElement('yt-formatted-string');
    textEl.textContent = 'Video A: Deep Neural Networks';
    titleEl.appendChild(textEl);
    document.body.appendChild(titleEl);

    const channelEl = document.createElement('ytd-channel-name');
    channelEl.id = 'channel-name';
    const chText = document.createElement('yt-formatted-string');
    chText.id = 'text';
    chText.textContent = 'AI Research Lab';
    channelEl.appendChild(chText);
    document.body.appendChild(channelEl);

    const tracker = new TimeTracker();
    const today = tracker.getLocalDateKey();

    // Step 1: Play Video A for 40s (4x 10s)
    if (global.location) global.location.search = '?v=video_aaa_11';
    for (let i = 0; i < 4; i++) {
      await tracker.incrementWatchTime(10);
    }

    // Step 2: Switch to Video B for 30s (3x 10s)
    textEl.textContent = 'Video B: Distributed Systems';
    chText.textContent = 'Cloud Arch';
    if (global.location) global.location.search = '?v=video_bbb_22';
    for (let i = 0; i < 3; i++) {
      await tracker.incrementWatchTime(10);
    }

    // Step 3: Switch back to Video A for 50s (5x 10s)
    textEl.textContent = 'Video A: Deep Neural Networks';
    chText.textContent = 'AI Research Lab';
    if (global.location) global.location.search = '?v=video_aaa_11';
    for (let i = 0; i < 5; i++) {
      await tracker.incrementWatchTime(10);
    }

    // Step 4: Switch back to Video B for 20s (2x 10s)
    textEl.textContent = 'Video B: Distributed Systems';
    chText.textContent = 'Cloud Arch';
    if (global.location) global.location.search = '?v=video_bbb_22';
    for (let i = 0; i < 2; i++) {
      await tracker.incrementWatchTime(10);
    }

    const tracking = await StorageUtil.getTracking();

    // Invariant assertions: Intervening video changes MUST NOT merge sessions across boundaries
    assert.equal(tracking.timelineLog.length, 4, 'Must create exactly 4 distinct session records');
    
    assert.equal(tracking.timelineLog[0].title, 'Video A: Deep Neural Networks');
    assert.equal(tracking.timelineLog[0].videoId, 'video_aaa_11');
    assert.equal(tracking.timelineLog[0].durationSeconds, 40);

    assert.equal(tracking.timelineLog[1].title, 'Video B: Distributed Systems');
    assert.equal(tracking.timelineLog[1].videoId, 'video_bbb_22');
    assert.equal(tracking.timelineLog[1].durationSeconds, 30);

    assert.equal(tracking.timelineLog[2].title, 'Video A: Deep Neural Networks');
    assert.equal(tracking.timelineLog[2].videoId, 'video_aaa_11');
    assert.equal(tracking.timelineLog[2].durationSeconds, 50);

    assert.equal(tracking.timelineLog[3].title, 'Video B: Distributed Systems');
    assert.equal(tracking.timelineLog[3].videoId, 'video_bbb_22');
    assert.equal(tracking.timelineLog[3].durationSeconds, 20);

    const totalDuration = tracking.timelineLog.reduce((acc, s) => acc + s.durationSeconds, 0);
    assert.equal(totalDuration, 140, 'Total session duration sum must equal 140s');
    assert.equal(tracking.dailyWatchTime[today], 140, 'dailyWatchTime must equal 140s');
  });

  // =========================================================================
  // 3. SPA Transitions & Video ID Extraction Matrix
  // =========================================================================
  test('Stress 3: Video ID extraction parses watch URLs, shorts URLs, and embed URLs correctly', async () => {
    await resetStorage();
    await resetDOM();

    const tracker = new TimeTracker();

    // Watch query parameter format
    global.location.pathname = '/watch';
    global.location.search = '?v=dQw4w9WgXcQ&t=42s';
    assert.equal(tracker.getVideoId(), 'dQw4w9WgXcQ', 'Parses v= parameter');

    // Shorts pathname format
    global.location.pathname = '/shorts/abcdefghijk';
    global.location.search = '';
    assert.equal(tracker.getVideoId(), 'abcdefghijk', 'Parses /shorts/11-char ID');

    // Embed pathname format
    global.location.pathname = '/embed/xyz98765432';
    global.location.search = '';
    assert.equal(tracker.getVideoId(), 'xyz98765432', 'Parses /embed/11-char ID');

    // Generic home page (no video)
    global.location.pathname = '/';
    global.location.search = '';
    assert.equal(tracker.getVideoId(), null, 'Returns null on home page');
  });

  // =========================================================================
  // 4. Tab Backgrounding & Visibility Change (document.hidden)
  // =========================================================================
  test('Stress 4: Tab backgrounding (document.hidden = true) halts active time accumulation', async () => {
    await resetStorage();
    await resetDOM();

    // Create playing video element
    const video = document.createElement('video');
    video.paused = false;
    video.ended = false;
    document.body.appendChild(video);

    const titleEl = document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = document.createElement('yt-formatted-string');
    textEl.textContent = 'Background Tab Handling in Web Audio';
    titleEl.appendChild(textEl);
    document.body.appendChild(titleEl);

    const tracker = new TimeTracker();

    // 1. Tab is visible: simulate 5 seconds of playback checks
    document.hidden = false;
    for (let i = 0; i < 5; i++) {
      await tracker.checkVideoState();
    }
    assert.equal(tracker.activeTime, 5, '5s accumulated when tab is visible');

    // 2. Tab is backgrounded (document.hidden = true): simulate 15 checks
    document.hidden = true;
    for (let i = 0; i < 15; i++) {
      await tracker.checkVideoState();
    }
    assert.equal(tracker.activeTime, 5, 'activeTime must NOT increment while document.hidden is true');

    // 3. Tab returns to foreground: simulate 5 more seconds (total reaches 10 -> triggers batch flush)
    document.hidden = false;
    for (let i = 0; i < 5; i++) {
      await tracker.checkVideoState();
    }
    assert.equal(tracker.activeTime, 0, 'Batch flush triggered when activeTime reached 10s');

    const tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 1, '1 session recorded');
    assert.equal(tracking.timelineLog[0].durationSeconds, 10, 'Exactly 10s recorded (15 backgrounded seconds ignored)');
  });

  // =========================================================================
  // 5. Midnight Date Rollover & Daily Watch Time Partitioning
  // =========================================================================
  test('Stress 5: Midnight date rollover cleanly transitions session records and daily accounting', async () => {
    await resetStorage();
    await resetDOM();

    const titleEl = document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = document.createElement('yt-formatted-string');
    textEl.textContent = 'Overnight Ambient Study Lo-Fi';
    titleEl.appendChild(textEl);
    document.body.appendChild(titleEl);

    const tracker = new TimeTracker();

    // Mock getLocalDateKey to simulate Day 1
    let simulatedDate = '2026-08-15';
    tracker.getLocalDateKey = () => simulatedDate;

    // Day 1: Play 60s
    for (let i = 0; i < 6; i++) {
      await tracker.incrementWatchTime(10);
    }

    let tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 1, 'Day 1 session created');
    assert.equal(tracking.timelineLog[0].dateKey, '2026-08-15');
    assert.equal(tracking.timelineLog[0].durationSeconds, 60);
    assert.equal(tracking.dailyWatchTime['2026-08-15'], 60);

    // Midnight Rollover: Clock crosses into Day 2
    simulatedDate = '2026-08-16';

    // Day 2: Continue playing same video for 40s
    for (let i = 0; i < 4; i++) {
      await tracker.incrementWatchTime(10);
    }

    tracking = await StorageUtil.getTracking();

    assert.equal(tracking.timelineLog.length, 2, 'Midnight rollover splits into new session record for Day 2');
    assert.equal(tracking.timelineLog[0].dateKey, '2026-08-15');
    assert.equal(tracking.timelineLog[0].durationSeconds, 60, 'Day 1 session has 60s');
    assert.equal(tracking.timelineLog[1].dateKey, '2026-08-16');
    assert.equal(tracking.timelineLog[1].durationSeconds, 40, 'Day 2 session has 40s');

    assert.equal(tracking.dailyWatchTime['2026-08-15'], 60, 'Day 1 dailyWatchTime is 60s');
    assert.equal(tracking.dailyWatchTime['2026-08-16'], 40, 'Day 2 dailyWatchTime is 40s');
    assert.equal(tracking.weeklyTotal, 100, 'Weekly total combines both days to 100s');
  });

  // =========================================================================
  // 6. Tab Unload Partial Flush Preservation (beforeunload / pagehide)
  // =========================================================================
  test('Stress 6: Tab unload flush flushes partial unbatched seconds (<10s) without loss', async () => {
    await resetStorage();
    await resetDOM();

    const video = document.createElement('video');
    video.paused = false;
    video.ended = false;
    document.body.appendChild(video);

    const titleEl = document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = document.createElement('yt-formatted-string');
    textEl.textContent = 'Chrome Extensions Deep Dive';
    titleEl.appendChild(textEl);
    document.body.appendChild(titleEl);

    const tracker = new TimeTracker();
    tracker.startTracking();

    // Simulate 7 seconds of playback (not enough for 10s auto-flush)
    document.hidden = false;
    for (let i = 0; i < 7; i++) {
      await tracker.checkVideoState();
    }
    assert.equal(tracker.activeTime, 7, '7s currently unbatched in activeTime');

    // Simulate Tab Unload (e.g. user closes tab or navigates away)
    // Note: flushPendingTime is async, stopTracking calls it fire-and-forget
    await tracker.flushPendingTime();

    assert.equal(tracker.activeTime, 0, 'activeTime reset to 0 after flush');

    const tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 1, '1 session recorded');
    assert.equal(tracking.timelineLog[0].durationSeconds, 7, 'Exact 7s flushed to storage on unload');
  });

  // =========================================================================
  // 7. Inactivity Gap Exact Threshold Matrix (<=120s vs >120s)
  // =========================================================================
  test('Stress 7: Inactivity gap threshold of 120s strictly separates continuous vs new sessions', async () => {
    await resetStorage();
    await resetDOM();

    const titleEl = document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = document.createElement('yt-formatted-string');
    textEl.textContent = 'Boundary Value Analysis in Software Testing';
    titleEl.appendChild(textEl);
    document.body.appendChild(titleEl);

    const tracker = new TimeTracker();

    // 1. Initial 30s session
    await tracker.incrementWatchTime(30);
    let tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 1);
    assert.equal(tracking.timelineLog[0].durationSeconds, 30);

    // 2. Pause within 120s threshold (110,000 ms <= 120,000 ms) -> MUST CONSOLIDATE
    const now = Date.now();
    tracking.timelineLog[0].lastActiveTimestamp = now - 110000;
    tracking.timelineLog[0].timestamp = now - 110000;
    await StorageUtil.saveTracking(tracking);

    await tracker.incrementWatchTime(20);
    tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 1, 'Gap within 120s threshold merges into existing session');
    assert.equal(tracking.timelineLog[0].durationSeconds, 50, 'Session duration is 50s');

    // 3. Pause of 150s (> 120,000 ms) -> MUST SPLIT INTO NEW SESSION
    const lastSession = tracking.timelineLog[0];
    lastSession.lastActiveTimestamp = now - 150000;
    lastSession.timestamp = now - 150000;
    await StorageUtil.saveTracking(tracking);

    await tracker.incrementWatchTime(20);
    tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 2, 'Gap > 120s (121s) splits into new session');
    assert.equal(tracking.timelineLog[0].durationSeconds, 50, 'First session remains 50s');
    assert.equal(tracking.timelineLog[1].durationSeconds, 20, 'Second session has 20s');
  });

  // =========================================================================
  // 8. Adversarial Migration & Channel Deduplication Under Massive Stress
  // =========================================================================
  test('Stress 8: StorageUtil.migrateTimelineLog merges 100 corrupted duplicates and is strictly idempotent', () => {
    const rawTimeline = [];
    const baseTimestamp = 1700000000000;

    // Generate 50 duplicate 60s records for Video Alpha with 3-word repeating channel name
    for (let i = 0; i < 50; i++) {
      rawTimeline.push({
        id: `evt_alpha_${i}`,
        timestamp: baseTimestamp + (i * 60000),
        lastActiveTimestamp: baseTimestamp + (i * 60000),
        dateKey: '2026-08-15',
        startTime: '10:00',
        endTime: '10:01',
        title: 'Alpha Quantum Computing',
        channel: 'MIT Physics MIT Physics',
        durationSeconds: 60,
        isLearning: true,
        mode: 'Study Mode',
        status: 'watched'
      });
    }

    // Interleave 1 blocked attempt
    rawTimeline.push({
      id: 'evt_block_1',
      timestamp: baseTimestamp + (51 * 60000),
      dateKey: '2026-08-15',
      startTime: '10:51',
      endTime: '10:51',
      title: 'Distracting Video',
      channel: 'DistractionHub',
      durationSeconds: 0,
      isLearning: false,
      mode: 'Goal Mode',
      status: 'blocked'
    });

    // Generate 50 duplicate 60s records for Video Beta with 3-part repeating channel name
    for (let i = 0; i < 50; i++) {
      rawTimeline.push({
        id: `evt_beta_${i}`,
        timestamp: baseTimestamp + ((52 + i) * 60000),
        lastActiveTimestamp: baseTimestamp + ((52 + i) * 60000),
        dateKey: '2026-08-15',
        startTime: '11:00',
        endTime: '11:01',
        title: 'Beta Superconductivity',
        channel: 'Stanford Lab Stanford Lab Stanford Lab',
        durationSeconds: 60,
        isLearning: false,
        mode: 'Standard',
        status: 'watched'
      });
    }

    const unMigratedState = {
      timelineLog: rawTimeline,
      timelineMigrated: false
    };

    // Calculate pre-migration duration sum
    const preWatchSeconds = rawTimeline
      .filter(r => r.status === 'watched')
      .reduce((acc, r) => acc + r.durationSeconds, 0);
    assert.equal(preWatchSeconds, 6000, '100 watched records of 60s = 6000s');

    // Run Migration
    const migrated = StorageUtil.migrateTimelineLog(unMigratedState);

    assert.equal(migrated.timelineLog.length, 3, '101 total raw entries consolidated to 2 watched sessions + 1 blocked event');
    
    // Video Alpha assertions
    assert.equal(migrated.timelineLog[0].title, 'Alpha Quantum Computing');
    assert.equal(migrated.timelineLog[0].channel, 'MIT Physics', 'Deduplicated 2-half channel name');
    assert.equal(migrated.timelineLog[0].durationSeconds, 3000, '50 * 60s = 3000s');
    assert.equal(migrated.timelineLog[0].isLearning, true);

    // Blocked event assertions
    assert.equal(migrated.timelineLog[1].title, 'Distracting Video');
    assert.equal(migrated.timelineLog[1].status, 'blocked');

    // Video Beta assertions
    assert.equal(migrated.timelineLog[2].title, 'Beta Superconductivity');
    assert.equal(migrated.timelineLog[2].channel, 'Stanford Lab', 'Deduplicated 3-third channel name');
    assert.equal(migrated.timelineLog[2].durationSeconds, 3000, '50 * 60s = 3000s');

    // Post-migration duration sum conservation
    const postWatchSeconds = migrated.timelineLog
      .filter(r => r.status === 'watched')
      .reduce((acc, r) => acc + r.durationSeconds, 0);
    assert.equal(postWatchSeconds, preWatchSeconds, 'Zero data loss: Watch time strictly conserved');

    // Idempotency: Running migration 5 more times produces identical output
    let current = migrated;
    for (let run = 0; run < 5; run++) {
      current = StorageUtil.migrateTimelineLog(current);
      assert.equal(current.timelineLog.length, 3, `Idempotency run ${run + 1}: length unchanged`);
      assert.deepEqual(current.timelineLog, migrated.timelineLog, `Idempotency run ${run + 1}: logs strictly equal`);
    }
  });

  // =========================================================================
  // 9. Options Analytics "Sessions Logged" & Focus Score Consistency Under Stress
  // =========================================================================
  test('Stress 9: Options Analytics metrics accurately reflect session boundaries and focus scores', async () => {
    await resetStorage();

    const targetDate = '2026-08-15';
    const trackingState = {
      dailyWatchTime: { [targetDate]: 7200 },     // 120 minutes
      dailyLearningTime: { [targetDate]: 3600 },  // 60 minutes
      hourlyWatchTime: { [targetDate]: { '10': 3600, '11': 3600 } },
      hourlyLearningTime: { [targetDate]: { '10': 3600 } },
      timelineLog: [
        {
          id: 's1',
          dateKey: targetDate,
          title: 'Advanced Machine Learning Course',
          channel: 'DeepMind',
          durationSeconds: 3600,
          isLearning: true,
          mode: 'Study Mode',
          status: 'watched'
        },
        {
          id: 's2',
          dateKey: targetDate,
          title: 'Mechanical Keyboard Review',
          channel: 'Hardware Tech',
          durationSeconds: 3600,
          isLearning: false,
          mode: 'Standard',
          status: 'watched'
        },
        {
          id: 'b1',
          dateKey: targetDate,
          title: 'Shorts Distraction Feed',
          channel: 'Reels Hub',
          durationSeconds: 0,
          isLearning: false,
          mode: 'Goal Mode',
          status: 'blocked'
        }
      ]
    };

    await StorageUtil.saveTracking(trackingState);

    const tracking = await StorageUtil.getTracking();
    const todayLogs = tracking.timelineLog.filter(item => item && item.dateKey === targetDate);

    // Metric Calculations (mirroring options.js)
    const sessionsLogged = todayLogs.filter(item => item.status !== 'blocked').length;
    const blockedCount = todayLogs.filter(item => item.status === 'blocked').length;
    const todayWatch = tracking.dailyWatchTime[targetDate] || 0;
    const todayLearn = tracking.dailyLearningTime[targetDate] || 0;
    const focusScore = todayWatch > 0 ? Math.round((todayLearn / todayWatch) * 100) : 0;

    assert.equal(sessionsLogged, 2, 'Exactly 2 watched sessions logged');
    assert.equal(blockedCount, 1, 'Exactly 1 blocked distraction attempt');
    assert.equal(focusScore, 50, 'Focus Score is exactly 50% (60m / 120m)');
  });

});
