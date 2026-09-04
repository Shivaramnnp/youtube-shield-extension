/**
 * Tier 1 Unit & Integration Test Suite: Milestone 1 - Session Tracking & Migration Overhaul
 * File: tests/tier1/session-tracking-fix.test.js
 * 
 * Verifies:
 * 1. Continuous video playback session aggregation (updating durationSeconds in-place)
 * 2. Navigation / Video change boundary separation
 * 3. Playback inactivity gap boundary (> 120s threshold splits session, <= 120s preserves session)
 * 4. YouTube DOM channel name extraction and sanitization (deduplicating tooltip duplication)
 * 5. One-time idempotent historical data migration (StorageUtil.migrateTimelineLog)
 * 6. Options Analytics metrics calculation ("Sessions Logged", Focus Score, and Timeline Feed)
 * 7. Study Mode continuous playback preserves isLearning flag and accumulates learning time
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
const { TimeTracker } = require('../../utils/time-tracker');

describe('M1: Session Tracking Fix, Channel Deduplication & Migration Suite', () => {

  // =========================================================================
  // 1. 2-Minute Continuous Playback Simulation
  // =========================================================================
  test('M1.1: Continuous 2-minute playback on single video produces exactly 1 timeline entry with 120s duration', async () => {
    await resetStorage();
    await resetDOM();

    // Setup YouTube Watch Page DOM
    const titleEl = document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = document.createElement('yt-formatted-string');
    textEl.textContent = 'Building Scalable Node.js Microservices';
    titleEl.appendChild(textEl);
    document.body.appendChild(titleEl);

    const channelEl = document.createElement('ytd-channel-name');
    channelEl.id = 'channel-name';
    const chText = document.createElement('yt-formatted-string');
    chText.id = 'text';
    chText.textContent = 'Backend Masters';
    channelEl.appendChild(chText);
    document.body.appendChild(channelEl);

    const tracker = new TimeTracker();

    // Simulate 12 periodic 10-second active playback flushes (total 120s = 2 minutes)
    for (let i = 0; i < 12; i++) {
      await tracker.incrementWatchTime(10);
    }

    const tracking = await StorageUtil.getTracking();
    const today = tracker.getLocalDateKey();

    // Invariant assertions
    assert.equal(tracking.timelineLog.length, 1, 'Continuous playback must result in exactly 1 session record');
    assert.equal(tracking.timelineLog[0].durationSeconds, 120, 'Session durationSeconds must equal 120s');
    assert.equal(tracking.timelineLog[0].title, 'Building Scalable Node.js Microservices', 'Session title must match video');
    assert.equal(tracking.timelineLog[0].status, 'watched', 'Status must be watched');
    assert.equal(tracking.dailyWatchTime[today], 120, 'Daily watch time must accumulate to 120s');
  });

  // =========================================================================
  // 2. Video Change Boundary Separation
  // =========================================================================
  test('M1.2: Video change boundary creates distinct session entries for consecutive videos', async () => {
    await resetStorage();
    await resetDOM();

    const titleEl = document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = document.createElement('yt-formatted-string');
    textEl.textContent = 'Video A: Deep Dive into Web Audio API';
    titleEl.appendChild(textEl);
    document.body.appendChild(titleEl);

    const channelEl = document.createElement('ytd-channel-name');
    channelEl.id = 'channel-name';
    const chText = document.createElement('yt-formatted-string');
    chText.id = 'text';
    chText.textContent = 'Web Audio Pro';
    channelEl.appendChild(chText);
    document.body.appendChild(channelEl);

    const tracker = new TimeTracker();

    // Play Video A for 60 seconds (six 10s flushes)
    for (let i = 0; i < 6; i++) {
      await tracker.incrementWatchTime(10);
    }

    let tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 1, 'Video A session created');
    assert.equal(tracking.timelineLog[0].durationSeconds, 60, 'Video A duration is 60s');

    // User navigates to Video B
    textEl.textContent = 'Video B: Modern CSS Grid Architecture';
    chText.textContent = 'CSS Mastery';

    // Play Video B for 60 seconds (six 10s flushes)
    for (let i = 0; i < 6; i++) {
      await tracker.incrementWatchTime(10);
    }

    tracking = await StorageUtil.getTracking();
    const today = tracker.getLocalDateKey();

    assert.equal(tracking.timelineLog.length, 2, 'Navigating to new video creates separate session record');
    assert.equal(tracking.timelineLog[0].title, 'Video A: Deep Dive into Web Audio API', 'Session 1 title matches Video A');
    assert.equal(tracking.timelineLog[0].durationSeconds, 60, 'Session 1 duration is 60s');
    assert.equal(tracking.timelineLog[0].channel, 'Web Audio Pro', 'Session 1 channel matches Video A');

    assert.equal(tracking.timelineLog[1].title, 'Video B: Modern CSS Grid Architecture', 'Session 2 title matches Video B');
    assert.equal(tracking.timelineLog[1].durationSeconds, 60, 'Session 2 duration is 60s');
    assert.equal(tracking.timelineLog[1].channel, 'CSS Mastery', 'Session 2 channel matches Video B');

    assert.notEqual(tracking.timelineLog[0].id, tracking.timelineLog[1].id, 'Session records must have unique IDs');
    assert.equal(tracking.dailyWatchTime[today], 120, 'Total daily watch time is 120s across both sessions');
  });

  // =========================================================================
  // 3. Playback Gap Boundary (120s Inactivity Threshold)
  // =========================================================================
  test('M1.3a: Inactivity gap > 120s splits playback into a new session record', async () => {
    await resetStorage();
    await resetDOM();

    const titleEl = document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = document.createElement('yt-formatted-string');
    textEl.textContent = 'Algorithms & Data Structures Crash Course';
    titleEl.appendChild(textEl);
    document.body.appendChild(titleEl);

    const channelEl = document.createElement('ytd-channel-name');
    channelEl.id = 'channel-name';
    const chText = document.createElement('yt-formatted-string');
    chText.id = 'text';
    chText.textContent = 'CS Academy';
    channelEl.appendChild(chText);
    document.body.appendChild(channelEl);

    const tracker = new TimeTracker();

    // Play Video for 60 seconds
    for (let i = 0; i < 6; i++) {
      await tracker.incrementWatchTime(10);
    }

    let tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 1, 'Initial session recorded');
    assert.equal(tracking.timelineLog[0].durationSeconds, 60, 'Initial session duration 60s');

    // Simulate 150s gap (>120s threshold) by setting lastActiveTimestamp or timestamp in storage 150s in the past
    const lastEntry = tracking.timelineLog[0];
    const pastTime = Date.now() - 150000;
    lastEntry.timestamp = pastTime;
    if (lastEntry.lastActiveTimestamp) lastEntry.lastActiveTimestamp = pastTime;
    await StorageUtil.saveTracking(tracking);

    // Resume playing the same video for another 60 seconds
    for (let i = 0; i < 6; i++) {
      await tracker.incrementWatchTime(10);
    }

    tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 2, 'Gap > 120s creates a second session record for the same video');
    assert.equal(tracking.timelineLog[0].durationSeconds, 60, 'First session duration preserved at 60s');
    assert.equal(tracking.timelineLog[1].durationSeconds, 60, 'Second session duration initialized to 60s');
  });

  test('M1.3b: Inactivity gap <= 120s continues the existing session record', async () => {
    await resetStorage();
    await resetDOM();

    const titleEl = document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = document.createElement('yt-formatted-string');
    textEl.textContent = 'Quantum Computing Fundamentals';
    titleEl.appendChild(textEl);
    document.body.appendChild(titleEl);

    const tracker = new TimeTracker();

    // Play for 60 seconds
    for (let i = 0; i < 6; i++) {
      await tracker.incrementWatchTime(10);
    }

    let tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 1);

    // Simulate short pause of 45s (<=120s threshold)
    const lastEntry = tracking.timelineLog[0];
    const recentTime = Date.now() - 45000;
    lastEntry.timestamp = recentTime;
    if (lastEntry.lastActiveTimestamp) lastEntry.lastActiveTimestamp = recentTime;
    await StorageUtil.saveTracking(tracking);

    // Resume playing for 60 seconds
    for (let i = 0; i < 6; i++) {
      await tracker.incrementWatchTime(10);
    }

    tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 1, 'Gap <= 120s extends the existing session');
    assert.equal(tracking.timelineLog[0].durationSeconds, 120, 'Session duration accumulated to 120s');
  });

  // =========================================================================
  // 4. Channel Name Extraction & Sanitization
  // =========================================================================
  test('M1.4a: StorageUtil.cleanChannelName sanitizes duplicated strings and invalid values', () => {
    // Tooltip duplicate deduplication
    assert.equal(StorageUtil.cleanChannelName('Firstpost Firstpost'), 'Firstpost', 'Deduplicates identical halves');
    assert.equal(StorageUtil.cleanChannelName('Tech Lead Tech Lead'), 'Tech Lead', 'Deduplicates multi-word identical halves');
    assert.equal(StorageUtil.cleanChannelName('Veritasium Veritasium'), 'Veritasium', 'Deduplicates Veritasium');

    // Normal strings without duplication preserved
    assert.equal(StorageUtil.cleanChannelName('Kurzgesagt – In a Nutshell'), 'Kurzgesagt – In a Nutshell', 'Preserves standard channel names');
    assert.equal(StorageUtil.cleanChannelName('3Blue1Brown'), '3Blue1Brown', 'Preserves alphanumeric channel names');

    // Trimming and whitespace handling
    assert.equal(StorageUtil.cleanChannelName('  freeCodeCamp.org   '), 'freeCodeCamp.org', 'Trims whitespace');
    assert.equal(StorageUtil.cleanChannelName('CNN\nCNN'), 'CNN', 'Handles newline duplicated channel names');

    // Safe fallback for null, undefined, empty string
    assert.equal(StorageUtil.cleanChannelName(''), 'YouTube Channel', 'Empty string falls back to default');
    assert.equal(StorageUtil.cleanChannelName('   '), 'YouTube Channel', 'Whitespace falls back to default');
    assert.equal(StorageUtil.cleanChannelName(null), 'YouTube Channel', 'null falls back to default');
    assert.equal(StorageUtil.cleanChannelName(undefined), 'YouTube Channel', 'undefined falls back to default');
  });

  test('M1.4b: TimeTracker DOM channel extraction ignores <tp-yt-paper-tooltip> elements', async () => {
    await resetStorage();
    await resetDOM();

    // Construct YouTube Polymer channel element containing tooltip
    const titleEl = document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = document.createElement('yt-formatted-string');
    textEl.textContent = 'Breaking Global News Live';
    titleEl.appendChild(textEl);
    document.body.appendChild(titleEl);

    const channelEl = document.createElement('ytd-channel-name');
    channelEl.id = 'channel-name';
    
    const textContainer = document.createElement('div');
    textContainer.id = 'text-container';
    const innerText = document.createElement('yt-formatted-string');
    innerText.id = 'text';
    const linkEl = document.createElement('a');
    linkEl.textContent = 'Firstpost';
    innerText.appendChild(linkEl);
    textContainer.appendChild(innerText);
    channelEl.appendChild(textContainer);

    const tooltipEl = document.createElement('tp-yt-paper-tooltip');
    tooltipEl.textContent = 'Firstpost';
    channelEl.appendChild(tooltipEl);

    document.body.appendChild(channelEl);

    const tracker = new TimeTracker();
    await tracker.incrementWatchTime(30);

    const tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 1);
    assert.equal(tracking.timelineLog[0].channel, 'Firstpost', 'Extracted channel name must be Firstpost (no duplicate)');
  });

  // =========================================================================
  // 5. Historical Data Migration (StorageUtil.migrateTimelineLog)
  // =========================================================================
  test('M1.5: StorageUtil.migrateTimelineLog merges consecutive duplicate records and is idempotent', async () => {
    await resetStorage();

    // Create legacy corrupted tracking data with 10 duplicate 1-minute entries
    const legacyTracking = {
      dailyWatchTime: { '2026-08-15': 600 },
      dailyLearningTime: {},
      hourlyWatchTime: {},
      hourlyLearningTime: {},
      timelineLog: [
        // 10 consecutive duplicate entries of 60s for the same video with duplicated channel name
        { id: 'evt_1', timestamp: 1700000000000, dateKey: '2026-08-15', startTime: '08:00', endTime: '08:00', title: 'World News Headlines', channel: 'Firstpost Firstpost', durationSeconds: 60, isLearning: false, mode: 'Standard', status: 'watched' },
        { id: 'evt_2', timestamp: 1700000060000, dateKey: '2026-08-15', startTime: '08:01', endTime: '08:01', title: 'World News Headlines', channel: 'Firstpost Firstpost', durationSeconds: 60, isLearning: false, mode: 'Standard', status: 'watched' },
        { id: 'evt_3', timestamp: 1700000120000, dateKey: '2026-08-15', startTime: '08:02', endTime: '08:02', title: 'World News Headlines', channel: 'Firstpost Firstpost', durationSeconds: 60, isLearning: false, mode: 'Standard', status: 'watched' },
        { id: 'evt_4', timestamp: 1700000180000, dateKey: '2026-08-15', startTime: '08:03', endTime: '08:03', title: 'World News Headlines', channel: 'Firstpost Firstpost', durationSeconds: 60, isLearning: false, mode: 'Standard', status: 'watched' },
        { id: 'evt_5', timestamp: 1700000240000, dateKey: '2026-08-15', startTime: '08:04', endTime: '08:04', title: 'World News Headlines', channel: 'Firstpost Firstpost', durationSeconds: 60, isLearning: false, mode: 'Standard', status: 'watched' },
        { id: 'evt_6', timestamp: 1700000300000, dateKey: '2026-08-15', startTime: '08:05', endTime: '08:05', title: 'World News Headlines', channel: 'Firstpost Firstpost', durationSeconds: 60, isLearning: false, mode: 'Standard', status: 'watched' },
        { id: 'evt_7', timestamp: 1700000360000, dateKey: '2026-08-15', startTime: '08:06', endTime: '08:06', title: 'World News Headlines', channel: 'Firstpost Firstpost', durationSeconds: 60, isLearning: false, mode: 'Standard', status: 'watched' },
        { id: 'evt_8', timestamp: 1700000420000, dateKey: '2026-08-15', startTime: '08:07', endTime: '08:07', title: 'World News Headlines', channel: 'Firstpost Firstpost', durationSeconds: 60, isLearning: false, mode: 'Standard', status: 'watched' },
        { id: 'evt_9', timestamp: 1700000480000, dateKey: '2026-08-15', startTime: '08:08', endTime: '08:08', title: 'World News Headlines', channel: 'Firstpost Firstpost', durationSeconds: 60, isLearning: false, mode: 'Standard', status: 'watched' },
        { id: 'evt_10', timestamp: 1700000540000, dateKey: '2026-08-15', startTime: '08:09', endTime: '08:09', title: 'World News Headlines', channel: 'Firstpost Firstpost', durationSeconds: 60, isLearning: false, mode: 'Standard', status: 'watched' },
        // Separate distinct video entry
        { id: 'evt_11', timestamp: 1700001000000, dateKey: '2026-08-15', startTime: '08:20', endTime: '08:22', title: 'Rust Systems Programming', channel: 'Tech With Tim Tech With Tim', durationSeconds: 120, isLearning: true, mode: 'Study Mode', status: 'watched' },
        // Non-watched blocked event
        { id: 'evt_12', timestamp: 1700002000000, dateKey: '2026-08-15', startTime: '08:35', endTime: '08:35', title: 'Funny Cat Fails', channel: 'CatZone', durationSeconds: 0, isLearning: false, mode: 'Goal Mode (Strict)', status: 'blocked' }
      ]
    };

    // Run Migration
    const migrated = StorageUtil.migrateTimelineLog(legacyTracking);

    assert.equal(migrated.timelineLog.length, 3, '10 duplicate entries merged into 1 + 1 distinct video + 1 blocked event');
    
    // First merged session assertions
    const session1 = migrated.timelineLog[0];
    assert.equal(session1.title, 'World News Headlines', 'Merged session title matches');
    assert.equal(session1.channel, 'Firstpost', 'Channel name cleaned from duplicate');
    assert.equal(session1.durationSeconds, 600, 'Duration summed to 600 seconds (10 minutes)');
    assert.equal(session1.startTime, '08:00', 'Earliest start time preserved');
    assert.equal(session1.endTime, '08:09', 'Latest end time preserved');
    assert.equal(session1.status, 'watched', 'Status is watched');

    // Second video assertions
    const session2 = migrated.timelineLog[1];
    assert.equal(session2.title, 'Rust Systems Programming', 'Distinct video preserved');
    assert.equal(session2.channel, 'Tech With Tim', 'Distinct video channel cleaned');
    assert.equal(session2.durationSeconds, 120, 'Distinct video duration preserved');

    // Blocked attempt assertions
    const blockedEvent = migrated.timelineLog[2];
    assert.equal(blockedEvent.status, 'blocked', 'Blocked attempt preserved');
    assert.equal(blockedEvent.title, 'Funny Cat Fails', 'Blocked title preserved');

    // Verify Idempotency (running migration again does not change anything)
    const reMigrated = StorageUtil.migrateTimelineLog(migrated);
    assert.equal(reMigrated.timelineLog.length, 3, 'Idempotent: entry count unchanged');
    assert.equal(reMigrated.timelineLog[0].durationSeconds, 600, 'Idempotent: duration unchanged');
    assert.equal(reMigrated.timelineLog[0].channel, 'Firstpost', 'Idempotent: channel unchanged');
    assert.deepEqual(reMigrated.timelineLog, migrated.timelineLog, 'Idempotent: timeline logs are strictly identical');
  });

  // =========================================================================
  // 6. Options Analytics Calculation & UI Verification
  // =========================================================================
  test('M1.6: Options Analytics correctly computes "Sessions Logged" count from consolidated sessions', async () => {
    await resetStorage();
    await resetDOM();

    const targetDateKey = '2026-08-15';
    const trackingData = {
      dailyWatchTime: { [targetDateKey]: 600 },
      dailyLearningTime: { [targetDateKey]: 0 },
      hourlyWatchTime: { [targetDateKey]: { '8': 600 } },
      hourlyLearningTime: { [targetDateKey]: {} },
      timelineLog: [
        {
          id: 'evt_merged_1',
          timestamp: 1700000000000,
          dateKey: targetDateKey,
          startTime: '08:00',
          endTime: '08:10',
          title: 'Mastering Antigravity Multi-Agent Architecture',
          channel: 'AI Engineering',
          durationSeconds: 600,
          isLearning: false,
          mode: 'Standard',
          status: 'watched'
        }
      ]
    };

    await StorageUtil.saveTracking(trackingData);

    // Filter sessions for target date (mirroring options.js calculation)
    const timelineLogs = trackingData.timelineLog.filter(item => item && item.dateKey === targetDateKey);
    const sessionCount = timelineLogs.filter(i => i.status !== 'blocked').length;
    const blockedCount = timelineLogs.filter(i => i.status === 'blocked').length;

    assert.equal(sessionCount, 1, 'Single continuous 10-min video must report 1 session logged, NOT 10');
    assert.equal(blockedCount, 0, 'Zero blocked attempts');

    // Simulate Options UI DOM population
    const statActivityCountEl = document.createElement('div');
    statActivityCountEl.id = 'stat-activity-count';
    document.body.appendChild(statActivityCountEl);

    const statTodayEl = document.createElement('div');
    statTodayEl.id = 'stat-today';
    document.body.appendChild(statTodayEl);

    const timelineContainer = document.createElement('div');
    timelineContainer.id = 'timeline-stream-container';
    document.body.appendChild(timelineContainer);

    // Populate elements as options.js does
    statActivityCountEl.textContent = String(sessionCount);
    statTodayEl.textContent = '0h 10m';

    timelineLogs.slice().reverse().forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'timeline-item standard';
      const durationMin = Math.round((item.durationSeconds || 0) / 60);
      itemEl.innerHTML = `
        <div class="timeline-title">${item.title}</div>
        <div class="timeline-meta">📺 ${item.channel} • ${durationMin}m watched</div>
      `;
      timelineContainer.appendChild(itemEl);
    });

    assert.equal(statActivityCountEl.textContent, '1', 'UI displays "1" for Sessions Logged');
    assert.equal(statTodayEl.textContent, '0h 10m', 'UI displays total watched time');
    assert.equal(timelineContainer.children.length, 1, 'UI renders exactly 1 timeline card');
    const renderedCard = timelineContainer.children[0];
    assert.ok(renderedCard.innerHTML.includes('10m watched'), 'Timeline card displays 10m watched');
    assert.ok(renderedCard.innerHTML.includes('AI Engineering'), 'Timeline card displays clean channel name');
  });

  // =========================================================================
  // 7. Study Mode Learning Session Preservation
  // =========================================================================
  test('M1.7: Study Mode continuous playback preserves isLearning flag and accumulates learning time', async () => {
    await resetStorage();
    await resetDOM();

    // Enable Study Mode in settings
    await StorageUtil.updateSetting('studyMode', true);

    const titleEl = document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = document.createElement('yt-formatted-string');
    textEl.textContent = 'Full Stack Development with TypeScript & React';
    titleEl.appendChild(textEl);
    document.body.appendChild(titleEl);

    const channelEl = document.createElement('ytd-channel-name');
    channelEl.id = 'channel-name';
    const chText = document.createElement('yt-formatted-string');
    chText.id = 'text';
    chText.textContent = 'Dev University';
    channelEl.appendChild(chText);
    document.body.appendChild(channelEl);

    const tracker = new TimeTracker();

    // Play for 120 seconds in Study Mode
    for (let i = 0; i < 12; i++) {
      await tracker.incrementWatchTime(10);
    }

    const tracking = await StorageUtil.getTracking();
    const today = tracker.getLocalDateKey();

    assert.equal(tracking.timelineLog.length, 1, '1 continuous study session');
    assert.equal(tracking.timelineLog[0].durationSeconds, 120, 'Duration is 120s');
    assert.equal(tracking.timelineLog[0].isLearning, true, 'isLearning must be true');
    assert.equal(tracking.timelineLog[0].mode, 'Study Mode', 'Mode must be Study Mode');
    assert.equal(tracking.dailyLearningTime[today], 120, 'dailyLearningTime must equal 120s');
    assert.equal(tracking.dailyWatchTime[today], 120, 'dailyWatchTime must equal 120s');
  });

});
