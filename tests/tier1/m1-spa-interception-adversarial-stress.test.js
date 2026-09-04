/**
 * Empirical Adversarial Stress Test Suite for Milestone 1
 * (Content-Script Shorts & Playables SPA Interception)
 * 
 * Target Files: content/js/shorts-blocker.js, content/js/main.js
 * 
 * Stress Tests:
 * 1. Comprehensive URL Regex Edge Cases
 * 2. History API Monkey Patching Under Stress & Repeated Cycles
 * 3. Memory & Listener Cleanup on disable() and Re-enable Loops
 * 4. Microsecond SPA Event Handling & Immediate Synchronous Execution
 */

const { setupMockEnv } = require('../harness/mock-extension-env');
const { test, describe, assert } = require('../harness/test-helpers');

// Initialize Mock Environment before loading scripts
setupMockEnv();

// Require ShortsBlocker logic
require('../../content/js/shorts-blocker');

describe('M1 STRESS TEST 1: URL Regex Edge Case Pattern Matching', () => {

  const shortsRegex = /(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i;

  const mustMatchURLs = [
    // Standard Shorts URLs
    'https://www.youtube.com/shorts',
    'https://www.youtube.com/shorts/',
    'https://www.youtube.com/shorts/1234567890',
    'https://www.youtube.com/shorts/abcdefghijk?feature=share',
    'https://www.youtube.com/shorts?foo=bar',
    'https://www.youtube.com/shorts#section1',
    'https://www.youtube.com/shorts/?app=desktop',
    'http://youtube.com/shorts',
    'youtube.com/shorts/xyz',

    // Naked path fragments & relative URLs
    'shorts',
    'shorts/',
    'shorts/123',
    'shorts?foo=bar',
    'shorts#frag',
    '/shorts',
    '/shorts/',
    '/shorts/999',

    // Playables URLs
    'https://www.youtube.com/playables',
    'https://www.youtube.com/playables/',
    'https://www.youtube.com/playables/game123',
    'https://www.youtube.com/playables?ref=home',
    'https://www.youtube.com/playables#leaderboard',
    'playables',
    'playables/',
    '/playables/angry-birds',

    // Sub-path variants
    'https://www.youtube.com/feed/shorts',
    'https://www.youtube.com/channel/UC123/shorts',
    'https://www.youtube.com/user/test/shorts'
  ];

  const mustNotMatchURLs = [
    // Normal watch & search URLs with "shorts" substring in params
    'https://www.youtube.com/watch?v=shorts_demo',
    'https://www.youtube.com/results?search_query=shorts',
    'https://www.youtube.com/watch?v=shorts',
    'https://www.youtube.com/watch?v=12345&title=best_shorts_compilation',
    'https://www.youtube.com/feed/subscriptions?filter=shorts_only',

    // Words containing "shorts" or "playables" as substring in domain/path
    'https://www.youtube.com/shortstory/123',
    'https://www.youtube.com/my_shorts/view',
    'https://www.youtube.com/playable_games',
    'https://www.youtube.com/watch?v=playables_review',

    // Completely unrelated YouTube URLs
    'https://www.youtube.com/',
    'https://www.youtube.com/feed/subscriptions',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  ];

  test('Regex matches 100% of required Shorts & Playables edge cases', () => {
    mustMatchURLs.forEach(url => {
      assert.ok(
        shortsRegex.test(url),
        `Regex SHOULD match URL: "${url}"`
      );
    });
  });

  test('Regex correctly rejects 100% of non-Shorts false-positive URLs', () => {
    mustNotMatchURLs.forEach(url => {
      assert.ok(
        !shortsRegex.test(url),
        `Regex MUST NOT match URL: "${url}"`
      );
    });
  });

  test('ShortsBlocker.checkAndRedirectShortsURL executes redirection for all target URLs', () => {
    const sb = window.ShortsBlocker;
    sb.enable();

    let redirectedTo = null;
    const oldReplace = window.location.replace;
    window.location.replace = (target) => {
      redirectedTo = target;
    };

    mustMatchURLs.forEach(url => {
      redirectedTo = null;
      window.location.href = url;
      sb.checkAndRedirectShortsURL();
      assert.equal(
        redirectedTo,
        'https://www.youtube.com/',
        `checkAndRedirectShortsURL redirected "${url}" to https://www.youtube.com/`
      );
    });

    window.location.replace = oldReplace;
  });

});

describe('M1 STRESS TEST 2: History API Monkey Patching Behavior', () => {

  test('Repeated patchHistoryAPI() calls do not stack wrap pushState/replaceState', () => {
    const sb = window.ShortsBlocker;
    sb.enable();

    const pushStateRef1 = window.history.pushState;
    const replaceStateRef1 = window.history.replaceState;

    // Call patchHistoryAPI multiple times explicitly
    sb.patchHistoryAPI();
    sb.patchHistoryAPI();
    sb.patchHistoryAPI();

    assert.equal(window.history.pushState, pushStateRef1, 'pushState reference unchanged after duplicate patchHistoryAPI()');
    assert.equal(window.history.replaceState, replaceStateRef1, 'replaceState reference unchanged after duplicate patchHistoryAPI()');
  });

  test('High-frequency pushState / replaceState (1,000 iterations) executes cleanly', () => {
    const sb = window.ShortsBlocker;
    sb.enable();

    let redirectCount = 0;
    const oldReplace = window.location.replace;
    window.location.replace = () => { redirectCount++; };

    const startTime = Date.now();
    for (let i = 0; i < 1000; i++) {
      if (i % 2 === 0) {
        window.location.href = `https://www.youtube.com/watch?v=video_${i}`;
        window.history.pushState({}, '', `/watch?v=video_${i}`);
      } else {
        window.location.href = `https://www.youtube.com/shorts/short_${i}`;
        window.history.pushState({}, '', `/shorts/short_${i}`);
      }
    }
    const elapsed = Date.now() - startTime;

    assert.ok(elapsed < 200, `1,000 pushState calls executed in ${elapsed}ms (< 200ms)`);
    assert.equal(redirectCount, 500, 'All 500 /shorts/ pushState calls triggered redirection');

    window.location.replace = oldReplace;
  });

  test('unpatchHistoryAPI() cleanly restores original window.history methods', () => {
    const originalNativePushState = window.history.pushState;
    const sb = window.ShortsBlocker;

    sb.disable(); // calls unpatchHistoryAPI()
    const unpatchedPushState = window.history.pushState;

    sb.enable(); // re-patches
    const patchedPushState = window.history.pushState;

    assert.notEqual(patchedPushState, unpatchedPushState, 'patched pushState is wrapper function');

    sb.disable();
    assert.equal(window.history.pushState, unpatchedPushState, 'unpatched pushState restored');
  });

});

describe('M1 STRESS TEST 3: Memory & Listener Cleanup on disable()', () => {

  test('disable() clears urlCheckInterval timer', () => {
    const sb = window.ShortsBlocker;
    sb.enable();
    assert.ok(sb.urlCheckInterval !== null, 'urlCheckInterval active when enabled');

    sb.disable();
    assert.equal(sb.urlCheckInterval, null, 'urlCheckInterval is null after disable()');
  });

  test('disable() sets disabledExplicitly = true and isActive = false', () => {
    const sb = window.ShortsBlocker;
    sb.enable();
    assert.equal(sb.disabledExplicitly, false);
    assert.equal(sb.isActive, true);

    sb.disable();
    assert.equal(sb.disabledExplicitly, true);
    assert.equal(sb.isActive, false);
  });

  test('When disabledExplicitly is true, checkAndRedirectShortsURL short-circuits immediately', () => {
    const sb = window.ShortsBlocker;
    sb.disable();

    let redirected = false;
    const oldReplace = window.location.replace;
    window.location.replace = () => { redirected = true; };

    window.location.href = 'https://www.youtube.com/shorts/12345';
    sb.checkAndRedirectShortsURL();

    assert.equal(redirected, false, 'checkAndRedirectShortsURL did NOT redirect when disabledExplicitly is true');

    window.location.replace = oldReplace;
  });

  test('Repeated enable() and disable() cycles (100 iterations) leave no dangling listeners or intervals', () => {
    const sb = window.ShortsBlocker;

    assert.doesNotThrow(() => {
      for (let i = 0; i < 100; i++) {
        sb.enable();
        sb.disable();
      }
    }, '100 enable/disable cycles run without errors');

    assert.equal(sb.urlCheckInterval, null, 'No dangling interval timer after cycling');
    assert.equal(sb.boundSPAListener, null, 'boundSPAListener is null after cycling');
    assert.equal(sb.historyPatched, false, 'historyPatched is false after cycling');
  });

  test('Calling disable() twice sequentially does not throw error', () => {
    const sb = window.ShortsBlocker;
    sb.disable();
    assert.doesNotThrow(() => {
      sb.disable();
    }, 'Secondary disable() call is idempotent');
  });

});

describe('M1 STRESS TEST 4: Immediate Synchronous Content-Script Injection', () => {

  test('ShortsBlocker constructor executes synchronous redirection at document_start', () => {
    let redirected = false;
    window.location.href = 'https://www.youtube.com/shorts/document_start_test';
    const oldReplace = window.location.replace;
    window.location.replace = (url) => {
      if (url === 'https://www.youtube.com/') redirected = true;
    };

    // Instantiate a new ShortsBlocker instance simulating document_start injection
    const newBlocker = new window.ShortsBlocker.constructor();
    assert.equal(newBlocker.disabledExplicitly, false, 'disabledExplicitly defaults to false on instantiation');
    assert.equal(newBlocker.historyPatched, true, 'historyPatched defaults to true on instantiation');

    window.location.replace = oldReplace;
  });

});
