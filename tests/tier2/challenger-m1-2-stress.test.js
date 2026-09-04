/**
 * Tier 2: Challenger 2 Empirical Stress Test Suite for Milestone 1
 * Target: content/js/shorts-blocker.js & content/js/main.js
 */

require('../harness/mock-extension-env').setupMockEnv();
const { test, describe, assert, resetDOM } = require('../harness/test-helpers');

require('../../utils/dom-utils');
require('../../content/js/observer-utils');
require('../../content/js/shorts-blocker');

describe('Milestone 1 Challenger 2 Empirical Stress Tests', () => {

  test('Challenger M1.2: Document_start direct instantiation & immediate redirection before IPC', async () => {
    await resetDOM();

    let redirectedTo = null;
    const origReplace = window.location.replace;
    const origReplaceState = window.history.replaceState;

    try {
      window.location.href = 'https://www.youtube.com/shorts/instant_check_123';
      window.history.replaceState = (state, title, url) => { redirectedTo = url; };
      window.location.replace = (url) => { redirectedTo = url; };

      // Re-instantiate ShortsBlocker at document_start
      const blocker = new (window.ShortsBlocker.constructor)();

      assert.equal(redirectedTo, 'https://www.youtube.com/', 'Direct instantiation at document_start redirects Shorts URL synchronously before any IPC call');
    } finally {
      window.location.replace = origReplace;
      window.history.replaceState = origReplaceState;
      window.location.href = 'https://www.youtube.com/';
    }
  });

  test('Challenger M1.2: YouTube Polymer Navigation Events & History API interception', async () => {
    await resetDOM();
    const blocker = window.ShortsBlocker;
    blocker.enable();

    const polymerEvents = [
      'yt-navigate-start',
      'yt-navigate-finish',
      'yt-page-data-updated',
      'yt-page-type-changed',
      'popstate',
      'hashchange'
    ];

    for (const evtName of polymerEvents) {
      let redirected = false;
      const origReplace = window.location.replace;
      const origReplaceState = window.history.replaceState;

      try {
        window.location.href = 'https://www.youtube.com/shorts/event_test_' + evtName;
        window.history.replaceState = (state, title, url) => { redirected = true; };
        window.location.replace = (url) => { redirected = true; };

        // Dispatch CustomEvent on window
        const evtWindow = new CustomEvent(evtName, { bubbles: true });
        window.dispatchEvent(evtWindow);

        assert.ok(redirected, `Event '${evtName}' on window triggers immediate Shorts redirection`);
      } finally {
        window.location.replace = origReplace;
        window.history.replaceState = origReplaceState;
        window.location.href = 'https://www.youtube.com/';
      }
    }
    blocker.disable();
  });

  test('Challenger M1.2: PushState & ReplaceState Microsecond Interception', async () => {
    await resetDOM();
    const blocker = window.ShortsBlocker;
    blocker.enable();

    let redirected = false;
    const origReplace = window.location.replace;
    const origReplaceState = window.history.replaceState;

    try {
      window.location.replace = (url) => { redirected = true; };
      window.history.replaceState = (state, title, url) => { redirected = true; };

      // Simulate YouTube SPA router pushState to Shorts
      window.history.pushState({}, '', '/shorts/pushState_test_999');
      assert.ok(redirected, 'history.pushState to /shorts/ triggers instant redirection');

      redirected = false;
      window.history.pushState({}, '', '/playables/pushState_game_888');
      assert.ok(redirected, 'history.pushState to /playables/ triggers instant redirection');
    } finally {
      window.location.replace = origReplace;
      window.history.replaceState = origReplaceState;
      window.location.href = 'https://www.youtube.com/';
      blocker.disable();
    }
  });

  test('Challenger M1.2: Absence of False Positive Redirections on Normal YouTube Navigation', async () => {
    await resetDOM();
    const blocker = window.ShortsBlocker;
    blocker.enable();

    const validUrls = [
      'https://www.youtube.com/',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=shorts_in_title_abc',
      'https://www.youtube.com/results?search_query=best+shorts+compilation',
      'https://www.youtube.com/results?search_query=how+to+make+shorts',
      'https://www.youtube.com/@ShortsMaster',
      'https://www.youtube.com/channel/UCshorts_id_123',
      'https://www.youtube.com/playlist?list=PLshorts_playlist',
      'https://www.youtube.com/feed/subscriptions',
      'https://www.youtube.com/feed/history'
    ];

    let redirectCount = 0;
    const origReplace = window.location.replace;
    const origReplaceState = window.history.replaceState;

    try {
      window.location.replace = () => { redirectCount++; };
      window.history.replaceState = () => { redirectCount++; };

      for (const validUrl of validUrls) {
        window.location.href = validUrl;
        blocker.checkAndRedirectShortsURL();
        assert.equal(redirectCount, 0, `Normal YouTube URL must NOT trigger redirection: ${validUrl}`);
      }
    } finally {
      window.location.replace = origReplace;
      window.history.replaceState = origReplaceState;
      window.location.href = 'https://www.youtube.com/';
      blocker.disable();
    }
  });

  test('Challenger M1.2: [EDGE CASE FINDING] disable() after constructor timer detachment check', async () => {
    await resetDOM();

    // Create fresh instance simulating document_start injection
    const testBlocker = new (window.ShortsBlocker.constructor)();
    
    assert.equal(testBlocker.isActive, false, 'Initial isActive is false');
    assert.ok(testBlocker.urlCheckInterval !== null, 'Interval timer running after constructor');

    // Simulate main.js loading settings with shortsBlocker: false
    testBlocker.disable();

    // Check if urlCheckInterval is cleared on disable() right after constructor
    const intervalCleared = (testBlocker.urlCheckInterval === null);
    
    // Document finding: urlCheckInterval is NOT cleared because disable() returns early on !isActive
    assert.equal(intervalCleared, false, 'urlCheckInterval remains un-cleared when disable() is called directly after constructor');
  });

});
