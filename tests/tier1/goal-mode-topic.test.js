/**
 * Tier 1 Test Suite: Feature 7 - Goal Mode & Topic Enforcement (goal-mode-topic.test.js)
 * Tests Goal mode banner, technical short-term keyword extraction (C++, UI/UX, AI, Go, SQL),
 * off-topic video alignment warnings, and play locks.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetDOM } = require('../harness/test-helpers');

require('../../utils/dom-utils');
require('../../content/js/feed-controller');
require('../../content/js/goal-mode');
require('../../content/js/study-mode');

describe('Feature 7: Goal Mode & Topic Alignment Engine', () => {

  test('F7.1: GoalMode.extractGoalKeywords preserves technical terms (C++, UI/UX, AI, Go, SQL)', async () => {
    const gm = window.GoalMode;

    const cppKeywords = gm.extractGoalKeywords('Learn C++ Programming Basics');
    assert.ok(cppKeywords.includes('cplusplus'), 'C++ extracted as cplusplus');

    const uiuxKeywords = gm.extractGoalKeywords('Master UI/UX Design');
    assert.ok(uiuxKeywords.includes('uiux') || uiuxKeywords.includes('ui'), 'UI/UX extracted correctly');

    const aiKeywords = gm.extractGoalKeywords('Build AI and ML models with Python');
    assert.ok(aiKeywords.includes('ai') && aiKeywords.includes('ml'), 'AI and ML extracted as technical keywords');

    const goKeywords = gm.extractGoalKeywords('Learn Go language microservices');
    assert.ok(goKeywords.includes('go'), 'Go extracted as technical keyword');

    const sqlKeywords = gm.extractGoalKeywords('Database design with SQL queries');
    assert.ok(sqlKeywords.includes('sql'), 'SQL extracted as technical keyword');
  });

  test('F7.2: StudyMode.injectBanner renders study banner with goal text and timer element', async () => {
    await resetDOM();
    const sm = window.StudyMode;

    sm.enable('Learn System Architecture');

    const banner = global.document.getElementById('ss-study-banner');
    assert.ok(banner, '#ss-study-banner injected into DOM');

    const goalTextEl = banner.querySelector('#ss-goal-text');
    assert.equal(goalTextEl.textContent, 'Learn System Architecture', 'Banner displays configured goal');

    const timerEl = banner.querySelector('#ss-session-timer');
    assert.ok(timerEl, 'Session timer element present in banner');

    sm.disable();
    assert.equal(global.document.getElementById('ss-study-banner'), null, 'Banner removed on disable');
  });

  test('F7.7: GoalMode.checkVideoGoalAlignment blocks song videos when goal is communication', async () => {
    await resetDOM();
    const gm = window.GoalMode;
    gm.enable('communication');

    global.window.location = {
      pathname: '/watch',
      search: '?v=song12345'
    };

    const titleEl = global.document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = global.document.createElement('yt-formatted-string');
    textEl.textContent = 'Popular Artist - Hit Song (Official Music Video)';
    titleEl.appendChild(textEl);
    global.document.body.appendChild(titleEl);

    gm.checkVideoGoalAlignment();

    assert.equal(gm.isBlocked, true, 'Song video is strictly blocked when goal is communication');
    const overlay = global.document.getElementById('ss-goal-block-overlay');
    assert.ok(overlay, 'Goal block overlay displayed for song video during communication study goal');

    gm.disable();
  });

  test('F7.3: GoalMode.showGoalBlockOverlay displays block overlay for off-topic videos', async () => {
    await resetDOM();
    const gm = window.GoalMode;
    gm.goal = 'Learn Data Structures & Algorithms';

    gm.showGoalBlockOverlay('Top 10 Gaming Clips 2026');

    const overlay = global.document.getElementById('ss-goal-block-overlay');
    assert.ok(overlay, '#ss-goal-block-overlay injected into DOM');

    const titleEl = overlay.querySelector('#ss-goal-video-title');
    assert.equal(titleEl.textContent, 'Top 10 Gaming Clips 2026', 'Overlay displays blocked video title');

    const searchBtn = overlay.querySelector('#ss-btn-search-goal');
    assert.ok(searchBtn, 'Search goal button present in overlay');

    gm.removeOverlay();
    assert.equal(global.document.getElementById('ss-goal-block-overlay'), null, 'Overlay removed by removeOverlay()');
  });

  test('F7.4: StudyMode.showAlignmentWarning displays warning banner for non-matching videos', async () => {
    await resetDOM();
    const sm = window.StudyMode;

    sm.showAlignmentWarning();

    const warning = global.document.getElementById('ss-alignment-warning');
    assert.ok(warning, '#ss-alignment-warning injected into DOM');
    assert.ok(warning.textContent.includes('This video may not match your current learning goal'), 'Warning text rendered');

    const dismissBtn = warning.querySelector('#ss-dismiss-warning');
    assert.ok(dismissBtn, 'Dismiss button present');
  });

  test('F7.5: GoalMode.enable and disable manage goal mode state and DOM classes', async () => {
    await resetDOM();
    const gm = window.GoalMode;

    gm.enable('Learn Rust Programming');
    assert.equal(gm.isActive, true, 'GoalMode isActive is true');
    assert.equal(gm.goal, 'Learn Rust Programming', 'Goal updated to "Learn Rust Programming"');

    const hasClass = (global.document.documentElement && global.document.documentElement.classList.contains('shorts-shield-goal-mode')) ||
                     (global.document.body && global.document.body.classList.contains('shorts-shield-goal-mode'));
    assert.ok(hasClass, 'Document root or body contains "shorts-shield-goal-mode" class');

    gm.disable();
    assert.equal(gm.isActive, false, 'GoalMode isActive is false');
  });

  test('F7.6: GoalMode.addPlayLock and removePlayLock manage video event listeners', async () => {
    await resetDOM();
    const gm = window.GoalMode;

    const video = global.document.createElement('video');
    global.document.body.appendChild(video);

    gm.isActive = true;
    gm.isBlocked = true;
    gm.addPlayLock();

    // Trigger video play event
    let paused = false;
    video.pause = () => { paused = true; };
    video.dispatchEvent('play');

    assert.equal(paused, true, 'Play lock pauses video playback when blocked');

    gm.removePlayLock();
    gm.isBlocked = false;
    gm.isActive = false;
  });

  test('F7.8: GoalMode.showGoalBlockOverlay strictly excludes Allow Once button to prevent bypass', async () => {
    await resetDOM();
    const gm = window.GoalMode;
    gm.goal = 'Learn Machine Learning';

    gm.showGoalBlockOverlay('Music Video Song');

    const overlay = global.document.getElementById('ss-goal-block-overlay');
    assert.ok(overlay, 'Goal block overlay mounted');

    const allowBtn = overlay.querySelector('#ss-btn-allow-once');
    assert.equal(allowBtn, null, 'Allow Video Once button is strictly excluded');

    const searchBtn = overlay.querySelector('#ss-btn-search-goal');
    assert.ok(searchBtn, 'Search goal button exists');

    const homeBtn = overlay.querySelector('#ss-btn-go-home');
    assert.ok(homeBtn, 'Return to Safe Feed button exists');

    gm.removeOverlay();
  });

});
