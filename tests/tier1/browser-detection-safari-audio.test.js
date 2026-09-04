/**
 * Tier 1 Suite: Browser Detection & Safari Audio Capability Handling
 * Tests centralized browser detection, Web Audio DSP gating in Safari,
 * UI disabled states, messaging, and settings preservation.
 */

require('../harness/mock-extension-env').setupMockEnv();
const { test, describe, assert, resetDOM, resetStorage } = require('../harness/test-helpers');
const { StorageUtil, DEFAULT_SETTINGS } = require('../../utils/storage');

const BrowserDetection = require('../../utils/browser-detection');
const AudioEngine = require('../../utils/audio-engine');
const VolumeBooster = require('../../content/js/volume-booster');
require('../../content/js/header-button');

describe('Tier 1: Browser Detection & Safari Audio Capability Handling', () => {

  const SAFARI_MACOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const SAFARI_VENDOR = 'Apple Computer, Inc.';

  const CHROME_MACOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  const CHROME_VENDOR = 'Google Inc.';

  const BRAVE_MACOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  
  const EDGE_MACOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0';
  
  const FIREFOX_MACOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0';

  // ── 1. Centralized Browser Detection Tests ──
  test('BD1.1: correctly detects Apple Safari on macOS and flags supportsAudioDSP: false', () => {
    const caps = BrowserDetection.detect(SAFARI_MACOS_UA, SAFARI_VENDOR, {});
    assert.equal(caps.browserName, 'Safari', 'Browser name should be Safari');
    assert.equal(caps.isSafari, true, 'isSafari must be true');
    assert.equal(caps.isChrome, false, 'isChrome must be false for Safari');
    assert.equal(caps.isBrave, false, 'isBrave must be false for Safari');
    assert.equal(caps.isEdge, false, 'isEdge must be false for Safari');
    assert.equal(caps.isFirefox, false, 'isFirefox must be false for Safari');
    assert.equal(caps.supportsAudioDSP, false, 'Safari must have supportsAudioDSP: false');
  });

  test('BD1.2: correctly detects Google Chrome and flags supportsAudioDSP: true', () => {
    const caps = BrowserDetection.detect(CHROME_MACOS_UA, CHROME_VENDOR, {});
    assert.equal(caps.browserName, 'Chrome', 'Browser name should be Chrome');
    assert.equal(caps.isChrome, true, 'isChrome must be true');
    assert.equal(caps.isSafari, false, 'isSafari must be false for Chrome');
    assert.equal(caps.supportsAudioDSP, true, 'Chrome must have supportsAudioDSP: true');
  });

  test('BD1.3: correctly detects Brave without misclassifying as Safari', () => {
    const mockNav = {
      brave: {
        isBrave: () => true
      }
    };
    const caps = BrowserDetection.detect(BRAVE_MACOS_UA, CHROME_VENDOR, mockNav);
    assert.equal(caps.browserName, 'Brave', 'Browser name should be Brave');
    assert.equal(caps.isBrave, true, 'isBrave must be true');
    assert.equal(caps.isSafari, false, 'isSafari must be false for Brave');
    assert.equal(caps.supportsAudioDSP, true, 'Brave must have supportsAudioDSP: true');
  });

  test('BD1.4: correctly detects Microsoft Edge without misclassifying as Safari', () => {
    const caps = BrowserDetection.detect(EDGE_MACOS_UA, CHROME_VENDOR, {});
    assert.equal(caps.browserName, 'Edge', 'Browser name should be Edge');
    assert.equal(caps.isEdge, true, 'isEdge must be true');
    assert.equal(caps.isSafari, false, 'isSafari must be false for Edge');
    assert.equal(caps.supportsAudioDSP, true, 'Edge must have supportsAudioDSP: true');
  });

  test('BD1.5: correctly detects Mozilla Firefox and flags supportsAudioDSP: true', () => {
    const caps = BrowserDetection.detect(FIREFOX_MACOS_UA, '', {});
    assert.equal(caps.browserName, 'Firefox', 'Browser name should be Firefox');
    assert.equal(caps.isFirefox, true, 'isFirefox must be true');
    assert.equal(caps.isSafari, false, 'isSafari must be false for Firefox');
    assert.equal(caps.supportsAudioDSP, true, 'Firefox must have supportsAudioDSP: true');
  });

  // ── 2. Web Audio DSP Gating in Safari ──
  test('BD2.1: prevents Web Audio DSP node creation and page script injection when running in Safari', () => {
    try {
      BrowserDetection.override({
        browserName: 'Safari',
        isSafari: true,
        isChrome: false,
        isBrave: false,
        isEdge: false,
        isFirefox: false,
        supportsAudioDSP: false
      });

      // Mock DOM video element
      const video = document.createElement('video');
      video.src = 'blob:https://www.youtube.com/mock-stream';
      document.body.appendChild(video);

      VolumeBooster.enable();
      VolumeBooster.connect(video);

      // Assert that no page script was injected into document
      const injectedScript = document.getElementById('ss-page-audio-dsp-script');
      assert.equal(injectedScript, null, 'No page script should be injected in Safari');

      // Assert that VolumeBooster does not hold a Web Audio processing graph in Safari
      assert.equal(VolumeBooster.sourceNode, null, 'sourceNode must remain null in Safari');
      assert.equal(VolumeBooster.gainNode, null, 'gainNode must remain null in Safari');

      // Assert that getFrequencyData returns clean idle array without errors
      const freqData = VolumeBooster.getFrequencyData();
      assert.ok(freqData instanceof Uint8Array, 'Frequency data must be a Uint8Array');
      assert.equal(freqData.length, 64, 'Frequency data must have length 64');
      assert.equal(freqData.every(v => v === 0), true, 'Frequency data in Safari must be idle all-zeros');

      VolumeBooster.disable();
      video.remove();
    } finally {
      BrowserDetection.reset();
    }
  });

  test('BD2.2: allows full Web Audio DSP processing when running in Chrome/Brave/Edge/Firefox', () => {
    try {
      BrowserDetection.override({
        browserName: 'Chrome',
        isSafari: false,
        isChrome: true,
        isBrave: false,
        isEdge: false,
        isFirefox: false,
        supportsAudioDSP: true
      });

      const video = document.createElement('video');
      video.src = 'https://www.youtube.com/mock-video.mp4';
      document.body.appendChild(video);

      VolumeBooster.enable();
      VolumeBooster.connect(video);

      // Assert that VolumeBooster sets volume and bass levels
      VolumeBooster.setVolume(300);
      VolumeBooster.setBass(12);
      assert.equal(VolumeBooster.volumeLevel, 300, 'Volume level must be 300%');
      assert.equal(VolumeBooster.bassLevel, 12, 'Bass level must be 12 dB');

      VolumeBooster.disable();
      video.remove();
    } finally {
      BrowserDetection.reset();
    }
  });

  // ── 3. HUD Menu UI Disabled States & Informational Messaging ──
  test('BD3.1: renders disabled audio controls and Safari warning notice in HUD menu when in Safari', async () => {
    try {
      BrowserDetection.override({
        browserName: 'Safari',
        isSafari: true,
        isChrome: false,
        isBrave: false,
        isEdge: false,
        isFirefox: false,
        supportsAudioDSP: false
      });

      resetDOM();
      await resetStorage();
      const masthead = document.createElement('div');
      masthead.id = 'buttons';
      document.body.appendChild(masthead);

      const headerButton = window.HeaderButton;
      headerButton.enable();

      await headerButton.openPopup();
      const dialog = document.getElementById('ss-popup-dialog');
      assert.ok(dialog, 'HUD popup dialog should be opened');

      // Verify Safari notice banner is present in the audio section
      const safariNotice = dialog.querySelector('.ss-safari-audio-notice');
      assert.ok(safariNotice, 'Safari audio notice banner must be rendered');
      assert.ok(
        safariNotice.textContent.includes("Audio enhancement isn't supported in Safari"),
        'Notice banner text must clearly inform the user about Safari limitation'
      );

      // Verify sliders are disabled
      const volSlider = dialog.querySelector('#ss-vol-slider');
      const bassSlider = dialog.querySelector('#ss-bass-slider');
      const eqToggle = dialog.querySelector('#ss-eq-toggle');
      const eqPreset = dialog.querySelector('#ss-eq-preset');
      const eqReset = dialog.querySelector('#ss-eq-reset');

      assert.ok(volSlider, 'Volume slider should exist');
      assert.equal(volSlider.hasAttribute('disabled'), true, 'Volume slider must be disabled in Safari');

      assert.ok(bassSlider, 'Bass slider should exist');
      assert.equal(bassSlider.hasAttribute('disabled'), true, 'Bass slider must be disabled in Safari');

      assert.ok(eqToggle, 'EQ toggle should exist');
      assert.equal(eqToggle.hasAttribute('disabled'), true, 'EQ toggle must be disabled in Safari');

      assert.ok(eqPreset, 'EQ preset select should exist');
      assert.equal(eqPreset.hasAttribute('disabled'), true, 'EQ preset select must be disabled in Safari');

      assert.ok(eqReset, 'EQ reset button should exist');
      assert.equal(eqReset.hasAttribute('disabled'), true, 'EQ reset button must be disabled in Safari');

      headerButton.closePopup();
      headerButton.disable();
    } finally {
      BrowserDetection.reset();
    }
  });

  // ── 4. Settings Preservation Invariant ──
  test('BD4.1: preserves saved audio booster settings in storage without erasing them when opened in Safari', () => {
    try {
      BrowserDetection.override({
        browserName: 'Safari',
        isSafari: true,
        isChrome: false,
        isBrave: false,
        isEdge: false,
        isFirefox: false,
        supportsAudioDSP: false
      });

      // Simulate setting values
      VolumeBooster.setVolume(450);
      VolumeBooster.setBass(15);
      VolumeBooster.setEqPreset('Rock');

      assert.equal(VolumeBooster.volumeLevel, 450, 'Volume setting value preserved');
      assert.equal(VolumeBooster.bassLevel, 15, 'Bass setting value preserved');
      assert.equal(VolumeBooster.eqPreset, 'Rock', 'EQ preset value preserved');
    } finally {
      BrowserDetection.reset();
    }
  });

});
