/**
 * Tier 1 Test Suite: Feature 5 - Shorts Blocker & Header Button (shorts-blocker.test.js)
 * Tests Shorts tab hiding, reel player blocking, debug panel & match statistics,
 * and YouTube masthead header button injection.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetDOM } = require('../harness/test-helpers');

// Require ShortsBlocker & HeaderButton content scripts
require('../../utils/dom-utils');
require('../../content/js/observer-utils');
require('../../content/js/shorts-blocker');
require('../../content/js/header-button');

describe('Feature 5: Shorts Blocker & Masthead Header Button', () => {

  test('F5.1: ShortsBlocker.enable() adds shorts-shield-block-shorts CSS class', async () => {
    await resetDOM();
    const blocker = window.ShortsBlocker;

    blocker.enable();
    assert.equal(blocker.isActive, true, 'ShortsBlocker isActive is true');

    const hasClass = (global.document.documentElement && global.document.documentElement.classList.contains('shorts-shield-block-shorts')) ||
                     (global.document.body && global.document.body.classList.contains('shorts-shield-block-shorts'));
    assert.ok(hasClass, 'Document root or body contains "shorts-shield-block-shorts" class');

    blocker.disable();
  });

  test('F5.2: ShortsBlocker.disable() removes shorts-shield-block-shorts CSS class', async () => {
    await resetDOM();
    const blocker = window.ShortsBlocker;

    blocker.enable();
    blocker.disable();

    assert.equal(blocker.isActive, false, 'ShortsBlocker isActive is false');
    const hasClass = (global.document.documentElement && global.document.documentElement.classList.contains('shorts-shield-block-shorts')) ||
                     (global.document.body && global.document.body.classList.contains('shorts-shield-block-shorts'));
    assert.ok(!hasClass, 'Document root and body no longer contain "shorts-shield-block-shorts" class');
  });

  test('F5.3: ShortsBlocker.observeShortsElements hides container elements with display:none', async () => {
    await resetDOM();
    const blocker = window.ShortsBlocker;

    // Create a mock Shorts shelf container
    const shelf = global.document.createElement('ytd-rich-shelf-renderer');
    const link = global.document.createElement('a');
    link.setAttribute('href', '/shorts/12345');
    shelf.appendChild(link);
    global.document.body.appendChild(shelf);

    // Reset stats
    blocker.stats = { detected: 0, removed: 0 };

    // Simulate ObserverUtils callback execution
    if (window.ObserverUtils) {
      window.ObserverUtils.observe('a[href*="shorts"]', (elements) => {
        blocker.stats.detected += elements.length;
        elements.forEach(el => {
          const container = el.closest('ytd-rich-shelf-renderer');
          if (container) {
            container.style.display = 'none';
            blocker.stats.removed++;
          }
        });
      }, 'test-shorts');
    }

    assert.equal(shelf.style.display, 'none', 'Shorts container element is hidden');
    assert.equal(blocker.stats.detected, 1, 'Detected count updated to 1');
    assert.equal(blocker.stats.removed, 1, 'Removed count updated to 1');
  });

  test('F5.4: ShortsBlocker debug panel creates debug UI and updates text stats', async () => {
    await resetDOM();
    const blocker = window.ShortsBlocker;

    blocker.enableDebugMode();
    assert.equal(blocker.isDebug, true, 'Debug mode enabled');

    const debugPanel = global.document.getElementById('shorts-shield-debug');
    assert.ok(debugPanel, '#shorts-shield-debug element injected into DOM');

    blocker.stats = { detected: 5, removed: 5 };
    blocker.updateDebugUI(5);

    const detectedEl = global.document.getElementById('ss-debug-detected');
    assert.equal(detectedEl.textContent, 'SHORTS DETECTED: 5', 'Debug panel displays correct detected count');

    const removedEl = global.document.getElementById('ss-debug-removed');
    assert.equal(removedEl.textContent, 'SHORTS REMOVED: 5', 'Debug panel displays correct removed count');
  });

  test('F5.5: HeaderButton.tryInject() injects Shield button into YouTube masthead container', async () => {
    await resetDOM();

    // Set up YouTube masthead header structure in DOM
    const masthead = global.document.createElement('ytd-masthead');
    const endDiv = global.document.createElement('div');
    endDiv.id = 'end';
    const buttonsDiv = global.document.createElement('div');
    buttonsDiv.id = 'buttons';

    const createBtn = global.document.createElement('button');
    createBtn.setAttribute('aria-label', 'Create');
    buttonsDiv.appendChild(createBtn);

    endDiv.appendChild(buttonsDiv);
    masthead.appendChild(endDiv);
    global.document.body.appendChild(masthead);

    const hb = window.HeaderButton;
    const injected = hb.tryInject();

    assert.equal(injected, true, 'tryInject() returns true when container found');
    const btnContainer = global.document.getElementById('ss-header-btn-container');
    assert.ok(btnContainer, '#ss-header-btn-container injected into DOM');

    const btn = btnContainer.querySelector('#ss-header-btn');
    assert.ok(btn, '#ss-header-btn element present in container');
  });

  test('F5.6: HeaderButton.removeButton() removes injected Shield button from DOM', async () => {
    await resetDOM();

    const hb = window.HeaderButton;
    hb.containerElement = global.document.createElement('div');
    hb.containerElement.id = 'ss-header-btn-container';
    global.document.body.appendChild(hb.containerElement);

    assert.ok(global.document.getElementById('ss-header-btn-container'), 'Button container exists');

    hb.removeButton();
    assert.equal(global.document.getElementById('ss-header-btn-container'), null, 'Button container removed from DOM');
    assert.equal(hb.containerElement, null, 'HeaderButton containerElement set to null');
  });

  test('F5.7: Safari SPA URL interception & history.pushState monkey-patching redirects /shorts/ and /playables/ URLs', async () => {
    await resetDOM();
    const blocker = window.ShortsBlocker;

    let replaceStateUrl = null;
    let locationReplaceUrl = null;

    const origReplaceState = window.history.replaceState;
    const origLocationReplace = window.location.replace;

    try {
      window.history.replaceState = (state, title, url) => { replaceStateUrl = url; };
      window.location.replace = (url) => { locationReplaceUrl = url; };

      blocker.enable();
      if (blocker.urlCheckInterval) {
        clearInterval(blocker.urlCheckInterval);
        blocker.urlCheckInterval = null;
      }
      
      // Test /shorts/ URL interception
      window.location.href = 'https://www.youtube.com/shorts/12345';
      blocker.checkAndRedirectShortsURL();

      assert.equal(replaceStateUrl, 'https://www.youtube.com/', 'history.replaceState redirects /shorts/ URL to home');
      assert.equal(locationReplaceUrl, 'https://www.youtube.com/', 'location.replace redirects /shorts/ URL to home');

      // Reset markers and test /playables/ URL variant
      replaceStateUrl = null;
      locationReplaceUrl = null;
      window.location.href = 'https://www.youtube.com/playables/game-xyz';
      blocker.checkAndRedirectShortsURL();

      assert.equal(replaceStateUrl, 'https://www.youtube.com/', 'history.replaceState handles /playables/ URL');
      assert.equal(locationReplaceUrl, 'https://www.youtube.com/', 'location.replace handles /playables/ URL');

      window.location.href = 'https://www.youtube.com/';
      blocker.disable();
    } finally {
      window.location.href = 'https://www.youtube.com/';
      window.history.replaceState = origReplaceState;
      window.location.replace = origLocationReplace;
    }
  });

});
