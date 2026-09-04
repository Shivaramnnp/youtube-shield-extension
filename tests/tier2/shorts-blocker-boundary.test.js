/**
 * Tier 2: Feature 5 Shorts Blocker Boundary & Corner Cases Suite
 */

require('../harness/mock-extension-env.js');
const { test, describe, assert, resetDOM } = require('../harness/test-helpers');
require('../../content/js/observer-utils');
require('../../content/js/shorts-blocker');

describe('Feature 5 Boundaries: Shorts Blocker', () => {

  test('Shorts Blocker: Rapid enable and disable toggling without state drift', async () => {
    resetDOM();
    const blocker = global.window.ShortsBlocker;

    for (let i = 0; i < 20; i++) {
      blocker.enable();
      assert.equal(blocker.isActive, true);
      assert.ok(global.document.documentElement.classList.contains('shorts-shield-block-shorts'));

      blocker.disable();
      assert.equal(blocker.isActive, false);
      assert.equal(global.document.documentElement.classList.contains('shorts-shield-block-shorts'), false);
    }
  });

  test('Shorts Blocker: Missing YouTube DOM elements handled gracefully without throwing', async () => {
    resetDOM();
    const blocker = global.window.ShortsBlocker;

    // Body is empty, no ytd-rich-shelf-renderer or shorts links present
    assert.doesNotThrow(() => {
      blocker.enable();
      blocker.observeShortsElements();
      blocker.disable();
    });
  });

  test('Shorts Blocker: Dynamically mutated DOM elements and closest container hiding', async () => {
    resetDOM();
    const blocker = global.window.ShortsBlocker;

    // Create container and shorts link element
    const container = global.document.createElement('ytd-rich-shelf-renderer');
    const link = global.document.createElement('a');
    link.setAttribute('href', '/shorts/sample123');
    link.setAttribute('title', 'Shorts');
    container.appendChild(link);
    global.document.body.appendChild(container);

    blocker.enable();

    // Verify container display style is set to none !important
    assert.equal(container.style.display, 'none');
    blocker.disable();
  });

  test('Shorts Blocker: Direct element fallback when no renderer container matches', async () => {
    resetDOM();
    const blocker = global.window.ShortsBlocker;

    // Standalone link without ytd-rich-section-renderer parent
    const link = global.document.createElement('a');
    link.setAttribute('href', '/shorts/standalone456');
    link.setAttribute('title', 'Shorts');
    global.document.body.appendChild(link);

    // Call observer callback directly
    blocker.enable();

    assert.equal(link.style.display, 'none');
    blocker.disable();
  });

  test('Shorts Blocker: High-frequency observer triggers with duplicate elements', async () => {
    resetDOM();
    const blocker = global.window.ShortsBlocker;
    blocker.stats = { detected: 0, removed: 0 };

    const elements = [];
    for (let i = 0; i < 10; i++) {
      const container = global.document.createElement('ytd-rich-item-renderer');
      const link = global.document.createElement('a');
      link.setAttribute('href', `/shorts/item_${i}`);
      container.appendChild(link);
      global.document.body.appendChild(container);
      elements.push(link);
    }

    // Trigger observer multiple times
    blocker.enable();
    for (let i = 0; i < 5; i++) {
      blocker.observeShortsElements();
    }

    assert.ok(blocker.stats.detected >= 10);
    blocker.disable();
  });

  test('Shorts Blocker: Debug panel UI creation and updates', async () => {
    resetDOM();
    const blocker = global.window.ShortsBlocker;

    blocker.enableDebugMode();
    const debugEl = global.document.getElementById('shorts-shield-debug');
    assert.ok(debugEl, 'Debug UI panel element should exist in DOM');

    blocker.stats = { detected: 5, removed: 5 };
    blocker.updateDebugUI(5);

    const detectedEl = global.document.getElementById('ss-debug-detected');
    assert.ok(detectedEl && detectedEl.textContent.includes('5'));
  });

});
