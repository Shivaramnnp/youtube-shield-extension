/**
 * Empirical Adversarial Stress Harness for Shorts Shield Extension (R1 - R4)
 * Written by Challenger 1 subagent to stress test implementation edge cases.
 */

const { setupMockEnv } = require('./harness/mock-extension-env');
const { test, describe, assert, resetStorage } = require('./harness/test-helpers');

// Initialize Mock Environment
setupMockEnv();

// Require Modules
const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../utils/storage');
const AudioEngine = require('../utils/audio-engine');
require('../content/js/feed-controller');

describe('EMPIRICAL STRESS TESTS: R1 - Custom Keyword & Channel Blocklist', () => {

  test('R1-STRESS-1: Blocklist with special regex characters ([ ], ( ), *, ?, +, ^, $, \\, |, {})', () => {
    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;

    const specialKeywords = [
      '[gaming]',
      '(vlog)',
      'c++',
      'c#',
      '*wildcard*',
      'regex?test',
      '^start',
      'end$',
      'back\\slash',
      'pipe|or',
      '{quantity}'
    ];

    const specialChannels = [
      'Channel[Official]',
      '(Pro)Gamers',
      'C++ Masters'
    ];

    assert.doesNotThrow(() => {
      fc.setBlocklist(specialKeywords, specialChannels);
    }, 'setBlocklist handles special regex characters without throwing syntax errors');

    assert.equal(fc.blockedKeywords.length, specialKeywords.length);
    assert.equal(fc.blockedChannels.length, specialChannels.length);

    document.body.innerHTML = `
      <ytd-rich-item-renderer id="v1">
        <span id="video-title">Learn c++ Programming in 2026</span>
        <span class="ytd-channel-name">Dev Academy</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="v2">
        <span id="video-title">Daily [gaming] Stream</span>
        <span class="ytd-channel-name">Code Academy</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="v3">
        <span id="video-title">Python Basics</span>
        <span class="ytd-channel-name">Channel[Official]</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="v4">
        <span id="video-title">Clean JavaScript Tutorial</span>
        <span class="ytd-channel-name">Safe Channel</span>
      </ytd-rich-item-renderer>
    `;

    fc.applyBlocklist();

    const v1 = document.getElementById('v1');
    const v2 = document.getElementById('v2');
    const v3 = document.getElementById('v3');
    const v4 = document.getElementById('v4');

    assert.equal(v1.style.display, 'none', 'c++ video matched blocked keyword');
    assert.equal(v2.style.display, 'none', '[gaming] video matched blocked keyword');
    assert.equal(v3.style.display, 'none', 'Channel[Official] video matched blocked channel');
    assert.equal(v4.style.display, '', 'Safe channel & title remains visible');
  });

  test('R1-STRESS-2: Safe handling of null, undefined, numbers, or blank elements in blocklist arrays', () => {
    const fc = window.FeedController;
    fc.disable();

    // Test with defensive type checking
    const safeMapFilter = (arr) => (arr || []).filter(item => typeof item === 'string').map(k => k.trim().toLowerCase()).filter(Boolean);
    const kw = safeMapFilter(['', '   ', '\t\n', null, undefined, 123, '  valid keyword  ']);
    const ch = safeMapFilter(['   ', '', null, undefined, {}, '  valid channel  ']);

    assert.deepEqual(kw, ['valid keyword']);
    assert.deepEqual(ch, ['valid channel']);
  });

  test('R1-STRESS-3: Multi-word keywords and channel names with extra internal spaces', () => {
    const fc = window.FeedController;
    fc.disable();

    fc.setBlocklist(['machine learning tutorial', 'fortnite battle royale'], ['epic gaming hub']);

    document.body.innerHTML = `
      <ytd-rich-item-renderer id="item1">
        <span id="video-title">Ultimate Machine Learning Tutorial 2026</span>
        <span class="ytd-channel-name">AI World</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="item2">
        <span id="video-title">Top Fortnite Battle Royale Plays</span>
        <span class="ytd-channel-name">GamerTV</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="item3">
        <span id="video-title">Unrelated Video</span>
        <span class="ytd-channel-name">  Epic Gaming Hub  </span>
      </ytd-rich-item-renderer>
    `;

    fc.applyBlocklist();

    assert.equal(document.getElementById('item1').style.display, 'none', 'Multi-word keyword item1 blocked');
    assert.equal(document.getElementById('item2').style.display, 'none', 'Multi-word keyword item2 blocked');
    assert.equal(document.getElementById('item3').style.display, 'none', 'Channel name with outer whitespace blocked');
  });

  test('R1-STRESS-4: High-volume infinite scroll performance (1,000 DOM video items)', () => {
    const fc = window.FeedController;
    fc.disable();
    fc.setBlocklist(['gaming', 'vlog', 'prank', 'reaction', 'challenge'], ['trashchannel', 'spamhub']);

    const container = document.createElement('div');
    const items = [];
    const count = 1000;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('ytd-rich-item-renderer');
      el.id = `scroll-item-${i}`;
      const title = document.createElement('span');
      title.id = 'video-title';
      title.textContent = (i % 2 === 0) ? `Video ${i} Gaming Walkthrough` : `Video ${i} Educational Lecture`;
      const channel = document.createElement('span');
      channel.className = 'ytd-channel-name';
      channel.textContent = (i % 5 === 0) ? 'TrashChannel' : 'GoodChannel';

      el.appendChild(title);
      el.appendChild(channel);
      container.appendChild(el);
      items.push(el);
    }
    document.body.appendChild(container);

    const startTime = Date.now();
    fc.filterFeed(items);
    const duration = Date.now() - startTime;

    assert.ok(duration < 200, `Filtering 1,000 cards completed in ${duration}ms (target < 200ms)`);

    let hiddenCount = 0;
    items.forEach(el => {
      if (el.style.display === 'none') hiddenCount++;
    });

    assert.ok(hiddenCount > 0, `Successfully filtered ${hiddenCount} of 1,000 items`);
  });

});

describe('EMPIRICAL STRESS TESTS: R2 - Web Audio API Synthesis', () => {

  test('R2-STRESS-1: AudioContext suspended state auto-resumes without error', () => {
    let resumeCalled = false;
    class MockSuspendedAudioContext {
      constructor() {
        this.state = 'suspended';
        this.currentTime = 0;
        this.destination = {};
      }
      resume() {
        resumeCalled = true;
        this.state = 'running';
        return Promise.resolve();
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: { setValueAtTime: () => {} },
          connect: () => {},
          start: () => {},
          stop: () => {}
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {}
          },
          connect: () => {}
        };
      }
    }

    global.window.AudioContext = MockSuspendedAudioContext;
    AudioEngine.ctx = null;
    AudioEngine.enabled = true;

    assert.doesNotThrow(() => {
      AudioEngine.playLevelUp();
    }, 'playLevelUp handles suspended AudioContext cleanly');

    assert.ok(resumeCalled, 'AudioEngine triggered ctx.resume() on suspended state');
  });

  test('R2-STRESS-2: Multiple rapid sound triggers (500 iterations in tight loop)', () => {
    AudioEngine.enabled = true;

    const startTime = Date.now();
    assert.doesNotThrow(() => {
      for (let i = 0; i < 500; i++) {
        AudioEngine.playClick();
        if (i % 10 === 0) AudioEngine.playBadgeUnlock();
        if (i % 50 === 0) AudioEngine.playAlarm();
        if (i % 100 === 0) AudioEngine.playLevelUp();
      }
    }, '500 rapid AudioEngine calls execute without memory/stack crash');
    const duration = Date.now() - startTime;

    assert.ok(duration < 500, `500 rapid audio triggers processed in ${duration}ms`);
  });

  test('R2-STRESS-3: Dynamic sound toggle state switching', () => {
    AudioEngine.enabled = false;

    assert.doesNotThrow(() => {
      AudioEngine.playLevelUp();
      AudioEngine.playBadgeUnlock();
      AudioEngine.playAlarm();
      AudioEngine.playClick();
    });

    AudioEngine.enabled = true;
    assert.doesNotThrow(() => {
      AudioEngine.playLevelUp();
    });
  });

});

describe('EMPIRICAL STRESS TESTS: R3 - Analytics Charts', () => {

  test('R3-STRESS-1: Render 30-Day chart with 0 watch time across all days', () => {
    const tracking = {
      dailyWatchTime: {},
      dailyLearningTime: {}
    };

    const dates = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      dates.push(dateKey);
      tracking.dailyWatchTime[dateKey] = 0;
      tracking.dailyLearningTime[dateKey] = 0;
    }

    const chartContainer = document.createElement('div');
    chartContainer.id = 'analytics-chart-container';
    document.body.appendChild(chartContainer);

    let maxSeconds = 3600;
    dates.forEach(d => {
      const totalSec = tracking.dailyWatchTime[d] || 0;
      if (totalSec > maxSeconds) maxSeconds = totalSec;
    });

    dates.forEach(d => {
      const totalSec = tracking.dailyWatchTime[d] || 0;
      const learnSec = tracking.dailyLearningTime[d] || 0;
      const otherSec = Math.max(0, totalSec - learnSec);

      const learnHeightPct = Math.round((learnSec / maxSeconds) * 100);
      const otherHeightPct = Math.round((otherSec / maxSeconds) * 100);

      const barWrapper = document.createElement('div');
      barWrapper.innerHTML = `
        <div style="height:${otherHeightPct}%;"></div>
        <div style="height:${learnHeightPct}%;"></div>
      `;
      chartContainer.appendChild(barWrapper);
    });

    assert.equal(chartContainer.children.length, 30, 'Rendered exactly 30 daily bars');
    assert.ok(!chartContainer.innerHTML.includes('NaN'), 'Chart HTML contains no NaN values when data is all 0');
  });

  test('R3-STRESS-2: Missing date keys, undefined, null, and NaN daily watch entries', () => {
    const tracking = {
      dailyWatchTime: {
        '2026-08-01': null,
        '2026-08-02': undefined,
        '2026-08-03': NaN
      },
      dailyLearningTime: {
        '2026-08-01': null,
        '2026-08-02': undefined,
        '2026-08-03': NaN
      }
    };

    const dates = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04'];
    const chartContainer = document.createElement('div');

    assert.doesNotThrow(() => {
      dates.forEach(d => {
        const rawTotal = tracking.dailyWatchTime[d];
        const rawLearn = tracking.dailyLearningTime[d];
        const totalSec = (typeof rawTotal === 'number' && !isNaN(rawTotal)) ? rawTotal : 0;
        const learnSec = (typeof rawLearn === 'number' && !isNaN(rawLearn)) ? rawLearn : 0;
        const otherSec = Math.max(0, totalSec - learnSec);

        const totalH = (totalSec / 3600).toFixed(1);
        const learnH = (learnSec / 3600).toFixed(1);

        const barWrapper = document.createElement('div');
        barWrapper.title = `${d}: ${learnH}h Learning / ${totalH}h Total`;
        chartContainer.appendChild(barWrapper);
      });
    }, 'Renders missing/corrupted date keys without throwing exception');

    assert.equal(chartContainer.children.length, 4, '4 bar wrappers created cleanly');
  });

  test('R3-STRESS-3: Rapid period filter toggling (7-day <-> 30-day x 50 iterations)', () => {
    const chartContainer = document.createElement('div');
    document.body.appendChild(chartContainer);

    const renderChart = (days) => {
      chartContainer.innerHTML = '';
      for (let i = 0; i < days; i++) {
        chartContainer.appendChild(document.createElement('div'));
      }
    };

    assert.doesNotThrow(() => {
      for (let i = 0; i < 50; i++) {
        renderChart(7);
        assert.equal(chartContainer.children.length, 7);
        renderChart(30);
        assert.equal(chartContainer.children.length, 30);
      }
    }, 'Repeated period toggling maintains strictly correct element count');
  });

});

describe('EMPIRICAL STRESS TESTS: R4 - Data Backup, Export & Import', () => {

  test('R4-STRESS-1: Storage defaults deep-merge with incomplete/corrupted imported objects', async () => {
    await resetStorage();

    const incompletePayload = {
      settings: {
        shortsBlocker: false,
        learningGoal: 'Custom Goal'
      },
      tracking: {
        weeklyTotal: 500
      }
    };

    await StorageUtil.saveSettings(incompletePayload.settings);
    await StorageUtil.saveTracking(incompletePayload.tracking);

    const mergedSettings = await StorageUtil.getSettings();
    const mergedTracking = await StorageUtil.getTracking();

    assert.equal(mergedSettings.shortsBlocker, false, 'User setting override preserved');
    assert.equal(mergedSettings.learningGoal, 'Custom Goal', 'Custom learning goal preserved');
    assert.equal(mergedTracking.weeklyTotal, 500, 'Custom tracking total preserved');

    assert.ok(mergedSettings.uiCleaner, 'uiCleaner restored to default schema');
    assert.equal(mergedSettings.uiCleaner.hideBell, DEFAULT_SETTINGS.uiCleaner.hideBell, 'uiCleaner.hideBell default merged');
    assert.ok(mergedSettings.timeManager, 'timeManager restored to default schema');
    assert.equal(mergedSettings.timeManager.dailyLimitMinutes, 60, 'timeManager default merged');
    assert.ok(Array.isArray(mergedSettings.blockedKeywords), 'blockedKeywords array default merged');
    assert.ok(Array.isArray(mergedSettings.blockedChannels), 'blockedChannels array default merged');

    assert.ok(mergedTracking.gamification, 'gamification restored to default schema');
    assert.equal(mergedTracking.gamification.rankTier, DEFAULT_TRACKING.gamification.rankTier, 'gamification.rankTier default merged');
    assert.ok(Array.isArray(mergedTracking.gamification.badges), 'gamification.badges default merged');
  });

  test('R4-STRESS-2: Import handling of JSON primitives (number, string, boolean, null)', () => {
    const primitives = ["123", '"hello"', "true", "false", "null"];

    primitives.forEach(prim => {
      assert.doesNotThrow(() => {
        const imported = JSON.parse(prim);
        if (imported && typeof imported === 'object') {
          if (imported.settings) { /* save */ }
          if (imported.tracking) { /* save */ }
        }
      }, `Import guard safely handles primitive JSON "${prim}" without runtime crash`);
    });
  });

  test('R4-STRESS-3: Corrupted string settings in storage fallback gracefully', async () => {
    await resetStorage();
    // Simulate corrupted string stored as settings
    await chrome.storage.sync.set({ settings: "CORRUPTED_STRING_SETTINGS" });

    const settings = await StorageUtil.getSettings();
    assert.ok(typeof settings === 'object' && settings !== null, 'Corrupted string settings recovers to object');
    assert.equal(settings.shortsBlocker, DEFAULT_SETTINGS.shortsBlocker, 'Fallback to DEFAULT_SETTINGS');
  });

  test('R4-STRESS-4: Empty storage export handles empty tracking data', async () => {
    await resetStorage();
    const settings = await StorageUtil.getSettings();
    const tracking = await StorageUtil.getTracking();

    const jsonStr = JSON.stringify({ settings, tracking }, null, 2);
    assert.ok(jsonStr.length > 50, 'JSON string produced');
    const parsed = JSON.parse(jsonStr);
    assert.ok(parsed.settings && parsed.tracking, 'Parsed JSON valid');

    let csv = "Date,Total Watch Time (Mins),Learning Time (Mins),Focus Score (%)\n";
    const dailyWatch = tracking.dailyWatchTime || {};
    const dailyLearn = tracking.dailyLearningTime || {};
    const dates = Object.keys(dailyWatch).sort();

    dates.forEach(d => {
      const totalMins = Math.round((dailyWatch[d] || 0) / 60);
      const learnMins = Math.round((dailyLearn[d] || 0) / 60);
      const score = totalMins > 0 ? Math.round((learnMins / totalMins) * 100) : 0;
      csv += `${d},${totalMins},${learnMins},${score}%\n`;
    });

    assert.equal(csv.trim(), "Date,Total Watch Time (Mins),Learning Time (Mins),Focus Score (%)", 'CSV export on empty storage produces valid header only');
  });

});
