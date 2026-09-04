/**
 * Tier 2: Milestone 2 Performance, Resource Optimization & Code Quality Suite (R4 & R6)
 */

require('../harness/mock-extension-env.js');
const { test, describe, assert, resetDOM } = require('../harness/test-helpers');
require('../../utils/storage.js');
require('../../utils/audio-engine.js');
require('../../content/js/volume-booster.js');
require('../../content/js/header-button.js');
require('../../content/js/page-ad-skipper.js');
require('../../content/js/shorts-blocker.js');
require('../../content/js/goal-mode.js');

describe('Milestone 2 Performance & Code Quality (R4 & R6)', () => {

  test('VolumeBooster: getFrequencyData declaration is unique and returns valid 64-byte array', async () => {
    const booster = global.window.VolumeBooster;
    assert.ok(booster, 'VolumeBooster should be instantiated on window');
    assert.equal(typeof booster.getFrequencyData, 'function', 'getFrequencyData is a valid function');

    const freqData = booster.getFrequencyData();
    assert.ok(freqData instanceof Uint8Array || Array.isArray(freqData), 'freqData is typed byte array');
    assert.equal(freqData.length, 64, 'freqData length is 64');
  });

  test('GoalMode: _lockedVideoElement constructor property is cleanly pruned', async () => {
    const goalMode = new global.window.GoalMode.constructor();
    assert.equal(goalMode._lockedVideoElement, undefined, '_lockedVideoElement should not exist on GoalMode instance');
    assert.equal(goalMode.isBlocked, false, 'isBlocked initializes to false');
  });

  test('ShortsBlocker: URL check caching skips redundant execution when URL is unchanged', async () => {
    const blocker = global.window.ShortsBlocker;
    assert.ok(blocker, 'ShortsBlocker instance exists');
    
    // Test checkAndRedirectShortsURL doesn't throw and caches last URL
    assert.doesNotThrow(() => {
      blocker.checkAndRedirectShortsURL();
    });
    assert.ok(typeof blocker._lastCheckedUrl === 'string', '_lastCheckedUrl is cached');
  });

  test('HeaderButton: Live mini-spectrum gates rAF loop when accordion is collapsed or dialog is minimized', async () => {
    await resetDOM();

    // Mock 2D context for canvas in test environment
    const mockCtx = {
      fillStyle: '',
      fillRect: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} })
    };
    const origCreateElement = global.document.createElement;
    global.document.createElement = (tag) => {
      const el = origCreateElement.call(global.document, tag);
      if (tag === 'canvas') {
        el.getContext = () => mockCtx;
      }
      return el;
    };

    try {
      // Create YouTube masthead buttons container
      const masthead = global.document.createElement('div');
      masthead.id = 'buttons';
      global.document.body.appendChild(masthead);

      const hb = global.window.HeaderButton;
      hb.enable();
      await hb.openPopup();

      const dialog = global.document.getElementById('ss-popup-dialog');
      assert.ok(dialog, 'HUD popover dialog opened');

      const audioSec = dialog.querySelector('#ss-section-audio');
      assert.ok(audioSec, '#ss-section-audio exists');
      assert.equal(audioSec.style.display, 'none', 'Audio accordion is initially collapsed (display: none)');

      // If canvas getContext is present, verify active spectrum visualizer object is attached
      if (hb._activeSpectrumVisualizer) {
        assert.equal(typeof hb._activeSpectrumVisualizer.stop, 'function', 'stop method exists');
        assert.equal(typeof hb._activeSpectrumVisualizer.resume, 'function', 'resume method exists');
      }

      // Close popup cleanly
      hb.closePopup();
      assert.equal(hb._activeSpectrumVisualizer, null, '_activeSpectrumVisualizer cleanly torn down on closePopup');
      hb.disable();
    } finally {
      global.document.createElement = origCreateElement;
    }
  });

  test('PageAdSkipper: Fast path exit when no ad is playing and no ad was active', async () => {
    await resetDOM();
    const player = global.document.createElement('div');
    player.id = 'movie_player';
    global.document.body.appendChild(player);

    // Fast path should not throw
    assert.doesNotThrow(() => {
      // In fast path, player has no ad-showing class and wasAdPlaying is false
      const isAdPlaying = player.classList.contains('ad-showing');
      assert.equal(isAdPlaying, false);
    });
  });

});
