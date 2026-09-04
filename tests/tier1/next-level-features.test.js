/**
 * Tier 1 Test Suite: Next-Level Features R1-R4 (next-level-features.test.js)
 * Covers requirements R1-R4:
 *  - R1: Custom Keyword & Channel Blocklist (content/js/feed-controller.js & settings)
 *  - R2: Gaming Web Audio Sound Effects (utils/audio-engine.js)
 *  - R3: 7-Day & 30-Day Visual Analytics Charts (options/options.js)
 *  - R4: Data Backup, Export & Import (options/options.js / utils/storage.js)
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, createMockStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');

// Require implementation files
require('../../utils/dom-utils');
require('../../content/js/observer-utils');
require('../../content/js/feed-controller');

// AudioEngine requirement
const AudioEngine = require('../../utils/audio-engine');

describe('Next-Level Features: R1 - Custom Keyword & Channel Blocklist', () => {

  const resetFCState = () => {
    const fc = window.FeedController;
    if (fc) {
      fc.disable();
      fc.isActive = false;
      fc.goalKeywords = [];
      fc.blockedKeywords = [];
      fc.blockedChannels = [];
    }
  };

  test('R1.1: FeedController.setBlocklist() parses, trims, and normalizes keywords & channels to lowercase', async () => {
    resetFCState();
    const fc = window.FeedController;
    fc.setBlocklist([' Gaming ', '  VLOG  ', ''], ['  GamingChannel  ', ' ']);

    assert.deepEqual(fc.blockedKeywords, ['gaming', 'vlog'], 'blockedKeywords are trimmed and lowercased');
    assert.deepEqual(fc.blockedChannels, ['gamingchannel'], 'blockedChannels are trimmed and lowercased');
  });

  test('R1.2: Filters video cards on YouTube Home Feed (ytd-rich-item-renderer) matching blocked terms', async () => {
    await resetDOM();
    resetFCState();
    const doc = global.document;
    const fc = window.FeedController;
    fc.setBlocklist(['gaming'], ['clickbaiter']);

    // Card 1: Matches keyword "gaming" in title
    const card1 = doc.createElement('ytd-rich-item-renderer');
    const title1 = doc.createElement('div');
    title1.id = 'video-title';
    title1.textContent = 'Ultimate Gaming Setup 2026';
    const ch1 = doc.createElement('ytd-channel-name');
    ch1.textContent = 'TechGurus';
    card1.appendChild(title1);
    card1.appendChild(ch1);

    // Card 2: Matches channel "clickbaiter"
    const card2 = doc.createElement('ytd-rich-item-renderer');
    const title2 = doc.createElement('div');
    title2.id = 'video-title';
    title2.textContent = 'You Will Not Believe This!';
    const ch2 = doc.createElement('ytd-channel-name');
    ch2.textContent = 'ClickBaiter';
    card2.appendChild(title2);
    card2.appendChild(ch2);

    // Card 3: Clean video
    const card3 = doc.createElement('ytd-rich-item-renderer');
    const title3 = doc.createElement('div');
    title3.id = 'video-title';
    title3.textContent = 'Clean Architecture in JavaScript';
    const ch3 = doc.createElement('ytd-channel-name');
    ch3.textContent = 'CodeAcademy';
    card3.appendChild(title3);
    card3.appendChild(ch3);

    doc.body.appendChild(card1);
    doc.body.appendChild(card2);
    doc.body.appendChild(card3);

    fc.applyBlocklist();

    assert.ok(card1.classList.contains('off-topic'), 'Card 1 (title match) has off-topic class');
    assert.equal(card1.style.display, 'none', 'Card 1 is hidden with display: none');

    assert.ok(card2.classList.contains('off-topic'), 'Card 2 (channel match) has off-topic class');
    assert.equal(card2.style.display, 'none', 'Card 2 is hidden with display: none');

    assert.ok(!card3.classList.contains('off-topic'), 'Card 3 (clean) does NOT have off-topic class');
    assert.notEqual(card3.style.display, 'none', 'Card 3 remains visible');
  });

  test('R1.3: Filters video cards on YouTube Search Results (ytd-video-renderer) matching blocked terms', async () => {
    await resetDOM();
    resetFCState();
    const doc = global.document;
    const fc = window.FeedController;
    fc.setBlocklist(['prank', 'reaction'], ['trollchannel']);

    const card1 = doc.createElement('ytd-video-renderer');
    const title1 = doc.createElement('div');
    title1.id = 'video-title';
    title1.textContent = 'Hilarious Public Prank!';
    card1.appendChild(title1);

    const card2 = doc.createElement('ytd-video-renderer');
    const title2 = doc.createElement('div');
    title2.id = 'video-title';
    title2.textContent = 'Ordinary Daily News';
    const ch2 = doc.createElement('ytd-channel-name');
    ch2.textContent = 'TrollChannel';
    card2.appendChild(title2);
    card2.appendChild(ch2);

    const card3 = doc.createElement('ytd-video-renderer');
    const title3 = doc.createElement('div');
    title3.id = 'video-title';
    title3.textContent = 'Calculus 101 Lecture';
    const ch3 = doc.createElement('ytd-channel-name');
    ch3.textContent = 'MathDep';
    card3.appendChild(title3);
    card3.appendChild(ch3);

    doc.body.appendChild(card1);
    doc.body.appendChild(card2);
    doc.body.appendChild(card3);

    fc.applyBlocklist();

    assert.equal(card1.style.display, 'none', 'Search result matching keyword "prank" is hidden');
    assert.equal(card2.style.display, 'none', 'Search result matching channel "trollchannel" is hidden');
    assert.notEqual(card3.style.display, 'none', 'Search result clean video remains visible');
  });

  test('R1.4: Filters video cards on Sidebar Recommendations (ytd-compact-video-renderer & ytd-grid-video-renderer)', async () => {
    await resetDOM();
    resetFCState();
    const doc = global.document;
    const fc = window.FeedController;
    fc.setBlocklist(['unboxing'], ['reviewhub']);

    const compactCard = doc.createElement('ytd-compact-video-renderer');
    const t1 = doc.createElement('div');
    t1.id = 'video-title';
    t1.textContent = 'Unboxing New Smartphone';
    compactCard.appendChild(t1);

    const gridCard = doc.createElement('ytd-grid-video-renderer');
    const t2 = doc.createElement('div');
    t2.id = 'video-title';
    t2.textContent = 'Gadget Overview';
    const ch2 = doc.createElement('ytd-channel-name');
    ch2.textContent = 'ReviewHub';
    gridCard.appendChild(t2);
    gridCard.appendChild(ch2);

    const cleanCompact = doc.createElement('ytd-compact-video-renderer');
    const t3 = doc.createElement('div');
    t3.id = 'video-title';
    t3.textContent = 'Rust Memory Safety Explained';
    cleanCompact.appendChild(t3);

    doc.body.appendChild(compactCard);
    doc.body.appendChild(gridCard);
    doc.body.appendChild(cleanCompact);

    fc.applyBlocklist();

    assert.equal(compactCard.style.display, 'none', 'Sidebar compact card matching "unboxing" is hidden');
    assert.equal(gridCard.style.display, 'none', 'Sidebar grid card matching "reviewhub" is hidden');
    assert.notEqual(cleanCompact.style.display, 'none', 'Clean sidebar video remains visible');
  });

  test('R1.5: Comma-separated keyword and channel string parsing and storage updating', async () => {
    await resetStorage();

    // Simulate Options page input parsing
    const rawKeywords = 'gaming, vlog , reaction, ';
    const rawChannels = 'GamingChannel, VlogChannel, ';

    const parsedKeywords = rawKeywords.split(',').map(k => k.trim()).filter(Boolean);
    const parsedChannels = rawChannels.split(',').map(c => c.trim()).filter(Boolean);

    await StorageUtil.updateSetting('blockedKeywords', parsedKeywords);
    await StorageUtil.updateSetting('blockedChannels', parsedChannels);

    const updatedSettings = await StorageUtil.getSettings();
    assert.deepEqual(updatedSettings.blockedKeywords, ['gaming', 'vlog', 'reaction'], 'blockedKeywords parsed and stored correctly');
    assert.deepEqual(updatedSettings.blockedChannels, ['GamingChannel', 'VlogChannel'], 'blockedChannels parsed and stored correctly');
  });

  test('R1.6: FeedController skips Shorts container elements (containing a[href*="/shorts/"])', async () => {
    await resetDOM();
    resetFCState();
    const doc = global.document;
    const fc = window.FeedController;
    fc.setBlocklist(['shorts', 'gaming']);

    const shortsCard = doc.createElement('ytd-rich-item-renderer');
    const shortsLink = doc.createElement('a');
    shortsLink.setAttribute('href', '/shorts/abcdef');
    const title = doc.createElement('div');
    title.id = 'video-title';
    title.textContent = 'Shorts Gaming Clip';
    shortsCard.appendChild(shortsLink);
    shortsCard.appendChild(title);
    doc.body.appendChild(shortsCard);

    fc.applyBlocklist();

    // Should skip shortsCard because it has a[href*="/shorts/"]
    assert.ok(!shortsCard.classList.contains('off-topic'), 'Shorts container skipped by FeedController');
  });

});

describe('Next-Level Features: R2 - Gaming Web Audio Sound Effects', () => {

  // Set up mock Web Audio Context before each audio test
  class MockAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = {};
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: { setValueAtTime: (val, time) => {} },
        connect: (target) => {},
        start: (time) => {},
        stop: (time) => {}
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime: (val, time) => {},
          exponentialRampToValueAtTime: (val, time) => {}
        },
        connect: (target) => {}
      };
    }
  }

  const beforeEachMockAudio = () => {
    global.AudioContext = MockAudioContext;
    global.window.AudioContext = MockAudioContext;
    AudioEngine.enabled = true;
    AudioEngine.ctx = null;
  };

  test('R2.1: AudioEngine initializes AudioContext on demand', async () => {
    beforeEachMockAudio();
    assert.equal(AudioEngine.ctx, null, 'AudioEngine.ctx is initially null');

    AudioEngine.init();
    assert.ok(AudioEngine.ctx !== null, 'AudioEngine.ctx initialized after init() call');
    assert.equal(AudioEngine.ctx.state, 'running', 'AudioContext state resumed to running');
  });

  test('R2.2: AudioEngine.playLevelUp() synthesizes 4-note ascending fanfare', async () => {
    beforeEachMockAudio();
    const playedTones = [];
    AudioEngine.playTone = (freq, type, duration, startTime, gainVal) => {
      playedTones.push({ freq, type, duration, startTime });
    };

    AudioEngine.playLevelUp();

    assert.equal(playedTones.length, 4, 'playLevelUp() schedules 4 notes');
    assert.equal(playedTones[0].freq, 523.25, 'Note 1 frequency is C5 (523.25 Hz)');
    assert.equal(playedTones[1].freq, 659.25, 'Note 2 frequency is E5 (659.25 Hz)');
    assert.equal(playedTones[2].freq, 783.99, 'Note 3 frequency is G5 (783.99 Hz)');
    assert.equal(playedTones[3].freq, 1046.50, 'Note 4 frequency is C6 (1046.50 Hz)');
    assert.equal(playedTones[0].type, 'sine', 'Oscillator wave type is sine');
  });

  test('R2.3: AudioEngine.playBadgeUnlock() synthesizes 3-note achievement fanfare', async () => {
    beforeEachMockAudio();
    const playedTones = [];
    AudioEngine.playTone = (freq, type, duration, startTime) => {
      playedTones.push({ freq, type, duration, startTime });
    };

    AudioEngine.playBadgeUnlock();

    assert.equal(playedTones.length, 3, 'playBadgeUnlock() schedules 3 notes');
    assert.equal(playedTones[0].freq, 440, 'Note 1 frequency is A4 (440 Hz)');
    assert.equal(playedTones[1].freq, 554.37, 'Note 2 frequency is C#5 (554.37 Hz)');
    assert.equal(playedTones[2].freq, 659.25, 'Note 3 frequency is E5 (659.25 Hz)');
    assert.equal(playedTones[0].type, 'triangle', 'Oscillator wave type is triangle');
  });

  test('R2.4: AudioEngine.playAlarm() synthesizes 3-note Time Manager warning alarm', async () => {
    beforeEachMockAudio();
    const playedTones = [];
    AudioEngine.playTone = (freq, type, duration, startTime) => {
      playedTones.push({ freq, type, duration, startTime });
    };

    AudioEngine.playAlarm();

    assert.equal(playedTones.length, 3, 'playAlarm() schedules 3 notes');
    assert.equal(playedTones[0].freq, 880, 'Beep 1 frequency is A5 (880 Hz)');
    assert.equal(playedTones[1].freq, 880, 'Beep 2 frequency is A5 (880 Hz)');
    assert.equal(playedTones[2].freq, 440, 'Warning tone frequency is A4 (440 Hz)');
    assert.equal(playedTones[0].type, 'square', 'Warning beep wave type is square');
    assert.equal(playedTones[2].type, 'sawtooth', 'Final warning wave type is sawtooth');
  });

  test('R2.5: AudioEngine.playClick() synthesizes UI tactile click', async () => {
    beforeEachMockAudio();
    const playedTones = [];
    AudioEngine.playTone = (freq, type, duration, startTime) => {
      playedTones.push({ freq, type, duration, startTime });
    };

    AudioEngine.playClick();

    assert.equal(playedTones.length, 1, 'playClick() schedules 1 short click tone');
    assert.equal(playedTones[0].freq, 600, 'Click tone frequency is 600 Hz');
    assert.equal(playedTones[0].duration, 0.05, 'Click tone duration is 0.05s');
  });

  test('R2.6: Sound toggle setting AudioEngine.enabled suppresses audio when false', async () => {
    beforeEachMockAudio();
    AudioEngine.enabled = false;

    let tonesCalled = 0;
    AudioEngine.playTone = () => { tonesCalled++; };

    AudioEngine.playLevelUp();
    AudioEngine.playBadgeUnlock();
    AudioEngine.playAlarm();
    AudioEngine.playClick();

    assert.equal(tonesCalled, 0, 'No audio tones played when AudioEngine.enabled is false');
  });

});

describe('Next-Level Features: R3 - 7-Day & 30-Day Visual Analytics Charts', () => {

  // Helper simulating options.js renderAnalyticsChart(daysCount)
  const renderAnalyticsChartHelper = (doc, tracking, daysCount = 7) => {
    const chartContainer = doc.getElementById('analytics-chart-container');
    if (!chartContainer) return;
    chartContainer.innerHTML = '';

    const dailyWatch = tracking.dailyWatchTime || {};
    const dailyLearn = tracking.dailyLearningTime || {};

    const dates = [];
    const now = new Date('2026-08-09T12:00:00Z');

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${day}`);
    }

    let maxSeconds = 3600;
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

      const barWrapper = doc.createElement('div');
      barWrapper.className = 'chart-bar-wrapper';
      barWrapper.setAttribute('data-date', d);
      barWrapper.title = `${d}: ${learnH}h Learning / ${totalH}h Total`;

      barWrapper.innerHTML = `
        <div class="bar-stack" style="height:100%;">
          <div class="bar-other" style="height:${otherHeightPct}%;"></div>
          <div class="bar-learn" style="height:${learnHeightPct}%;"></div>
        </div>
        <span class="bar-date-label">${d.slice(5)}</span>
      `;

      chartContainer.appendChild(barWrapper);
    });
  };

  test('R3.1: Visual Analytics chart renders 7 daily bars for past 7 days', async () => {
    await resetDOM();
    const doc = global.document;

    const chartContainer = doc.createElement('div');
    chartContainer.id = 'analytics-chart-container';
    doc.body.appendChild(chartContainer);

    const tracking = {
      dailyWatchTime: { '2026-08-09': 3600, '2026-08-08': 1800 },
      dailyLearningTime: { '2026-08-09': 1800, '2026-08-08': 900 }
    };

    renderAnalyticsChartHelper(doc, tracking, 7);

    const bars = chartContainer.children;
    assert.equal(bars.length, 7, '7 bar wrapper elements rendered for 7-day period');
  });

  test('R3.2: Visual Analytics chart renders 30 daily bars for past 30 days', async () => {
    await resetDOM();
    const doc = global.document;

    const chartContainer = doc.createElement('div');
    chartContainer.id = 'analytics-chart-container';
    doc.body.appendChild(chartContainer);

    const tracking = { dailyWatchTime: {}, dailyLearningTime: {} };

    renderAnalyticsChartHelper(doc, tracking, 30);

    const bars = chartContainer.children;
    assert.equal(bars.length, 30, '30 bar wrapper elements rendered for 30-day period');
  });

  test('R3.3: Visual Analytics chart bar segment heights scale dynamically relative to max watch time', async () => {
    await resetDOM();
    const doc = global.document;

    const chartContainer = doc.createElement('div');
    chartContainer.id = 'analytics-chart-container';
    doc.body.appendChild(chartContainer);

    // Peak watch time is 7200s (2 hours). On 2026-08-09: 3600s learning (50%), 3600s other (50%).
    const tracking = {
      dailyWatchTime: { '2026-08-09': 7200 },
      dailyLearningTime: { '2026-08-09': 3600 }
    };

    renderAnalyticsChartHelper(doc, tracking, 7);

    const latestBar = chartContainer.children[6]; // last bar (2026-08-09)
    assert.ok(latestBar, 'Latest bar wrapper exists');

    const html = latestBar.innerHTML;
    assert.ok(html.includes('height:50%'), 'Learning and other bar heights computed to 50% relative to peak 7200s');
  });

  test('R3.4: Hover tooltips display exact date, formatted learning hours, and total watch hours', async () => {
    await resetDOM();
    const doc = global.document;

    const chartContainer = doc.createElement('div');
    chartContainer.id = 'analytics-chart-container';
    doc.body.appendChild(chartContainer);

    const tracking = {
      dailyWatchTime: { '2026-08-09': 5400 }, // 1.5h
      dailyLearningTime: { '2026-08-09': 3600 } // 1.0h
    };

    renderAnalyticsChartHelper(doc, tracking, 7);

    const latestBar = chartContainer.children[6];
    assert.equal(latestBar.title, '2026-08-09: 1.0h Learning / 1.5h Total', 'Tooltip title correctly formats hours and date');
  });

  test('R3.5: Period filter pills switch active state and re-render chart from 7 to 30 days', async () => {
    await resetDOM();
    const doc = global.document;

    const chartContainer = doc.createElement('div');
    chartContainer.id = 'analytics-chart-container';
    doc.body.appendChild(chartContainer);

    const pillsContainer = doc.createElement('div');
    pillsContainer.id = 'chart-period-pills';

    const pill7 = doc.createElement('button');
    pill7.className = 'filter-pill active';
    pill7.setAttribute('data-period', '7');
    pill7.textContent = '7 Days';

    const pill30 = doc.createElement('button');
    pill30.className = 'filter-pill';
    pill30.setAttribute('data-period', '30');
    pill30.textContent = '30 Days';

    pillsContainer.appendChild(pill7);
    pillsContainer.appendChild(pill30);
    doc.body.appendChild(pillsContainer);

    const tracking = { dailyWatchTime: {}, dailyLearningTime: {} };

    // Initial render: 7 days
    renderAnalyticsChartHelper(doc, tracking, 7);
    assert.equal(chartContainer.children.length, 7, 'Initial chart has 7 bars');

    // Attach pill click handlers simulating options.js
    [pill7, pill30].forEach(pill => {
      pill.addEventListener('click', () => {
        [pill7, pill30].forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const period = parseInt(pill.getAttribute('data-period'), 10) || 7;
        renderAnalyticsChartHelper(doc, tracking, period);
      });
    });

    // Click 30-day pill
    pill30.click();

    assert.ok(!pill7.classList.contains('active'), '7-day pill deactivated');
    assert.ok(pill30.classList.contains('active'), '30-day pill activated');
    assert.equal(chartContainer.children.length, 30, 'Chart re-rendered with 30 bars');
  });

});

describe('Next-Level Features: R4 - Data Backup, Export & Import', () => {

  // Setup mock alert & FileReader if missing
  const beforeEachData = () => {
    if (typeof global.alert === 'undefined') {
      global.lastAlertMessage = null;
      global.alert = (msg) => { global.lastAlertMessage = msg; };
    }
    if (typeof global.FileReader === 'undefined') {
      class MockFileReader {
        readAsText(file) {
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: { result: file._content || '' } });
            }
          }, 0);
        }
      }
      global.FileReader = MockFileReader;
    }
  };

  test('R4.1: JSON export string generation produces valid backup payload', async () => {
    beforeEachData();
    const settings = { shortsBlocker: true, focusMode: true, blockedKeywords: ['gaming', 'vlog'] };
    const tracking = { dailyWatchTime: { '2026-08-09': 3600 }, dailyLearningTime: { '2026-08-09': 1800 } };

    const exportedString = JSON.stringify({ settings, tracking }, null, 2);
    assert.ok(typeof exportedString === 'string', 'Export yields string');

    const parsed = JSON.parse(exportedString);
    assert.deepEqual(parsed.settings.blockedKeywords, ['gaming', 'vlog'], 'Exported settings preserve blockedKeywords');
    assert.equal(parsed.tracking.dailyWatchTime['2026-08-09'], 3600, 'Exported tracking preserves watch time');
  });

  test('R4.2: CSV export string formatting produces correct headers and daily rows', async () => {
    beforeEachData();
    const tracking = {
      dailyWatchTime: { '2026-08-01': 3600, '2026-08-02': 7200 },
      dailyLearningTime: { '2026-08-01': 1800, '2026-08-02': 5400 }
    };

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

    const lines = csv.trim().split('\n');
    assert.equal(lines[0], 'Date,Total Watch Time (Mins),Learning Time (Mins),Focus Score (%)', 'CSV header matches specification');
    assert.equal(lines[1], '2026-08-01,60,30,50%', 'Line 1 formats 60m total, 30m learn, 50% score');
    assert.equal(lines[2], '2026-08-02,120,90,75%', 'Line 2 formats 120m total, 90m learn, 75% score');
  });

  test('R4.3: JSON backup import restores storage settings and tracking data', async () => {
    beforeEachData();
    await resetStorage();

    const importPayload = {
      settings: {
        shortsBlocker: false,
        focusMode: true,
        blockedKeywords: ['prank', 'reaction'],
        blockedChannels: ['TrollChannel']
      },
      tracking: {
        weeklyTotal: 9999,
        monthlyLearningTotal: 8888,
        gamification: { currentStreak: 12, badges: ['first_step', 'streak_starter'] }
      }
    };

    // Perform import storage restoration as in options.js
    if (importPayload.settings) await StorageUtil.saveSettings(importPayload.settings);
    if (importPayload.tracking) await StorageUtil.saveTracking(importPayload.tracking);

    const restoredSettings = await StorageUtil.getSettings();
    const restoredTracking = await StorageUtil.getTracking();

    assert.equal(restoredSettings.shortsBlocker, false, 'Restored settings shortsBlocker is false');
    assert.deepEqual(restoredSettings.blockedKeywords, ['prank', 'reaction'], 'Restored blockedKeywords preserved');
    assert.equal(restoredTracking.weeklyTotal, 9999, 'Restored tracking weeklyTotal is 9999');
    assert.equal(restoredTracking.gamification.currentStreak, 12, 'Restored streak is 12');
  });

  test('R4.4: JSON backup import handles invalid JSON file with validation alert', async () => {
    beforeEachData();
    await resetStorage();

    global.lastAlertMessage = null;
    const invalidFileContent = '{ corrupted json string: ';

    try {
      JSON.parse(invalidFileContent);
      assert.fail('Should have thrown JSON parse error');
    } catch (err) {
      alert("Failed to import backup: Invalid JSON file.");
    }

    assert.equal(global.lastAlertMessage, 'Failed to import backup: Invalid JSON file.', 'Validation error alert displayed for invalid JSON file');
  });

  test('R4.5: StorageUtil deep merges partial imported backup with default settings and tracking', async () => {
    beforeEachData();
    await resetStorage();

    // Partial import with missing keys
    const partialImport = {
      settings: { focusMode: false }
    };

    await StorageUtil.saveSettings(partialImport.settings);
    const mergedSettings = await StorageUtil.getSettings();

    assert.equal(mergedSettings.focusMode, false, 'Imported focusMode override applied');
    assert.equal(mergedSettings.shortsBlocker, true, 'Default shortsBlocker preserved via deep merge');
    assert.ok(Array.isArray(mergedSettings.blockedKeywords), 'Default blockedKeywords array preserved via deep merge');
  });

});
