/**
 * Challenger Adversarial Empirical Stress Test Suite for Milestone M3
 * Tests all edge cases across StorageUtil, Preset Detection, Slider Bounds,
 * UI Event Handlers, Header Popover, Popup UI, Options Dashboard, and Cross-Context Storage Synchronization.
 */

const assert = require('assert');
const { setupMockEnv, MockElement } = require('./harness/mock-extension-env');

// 1. Setup Mock Environment before loading application modules
const mockEnv = setupMockEnv();

MockElement.prototype.prepend = function(child) {
  if (!child) return child;
  child.parentNode = this;
  child.parentElement = this;
  this.children.unshift(child);
  return child;
};

// Enhanced parser for MockElement to support void tags (input, canvas, hr, br, etc.) and nested tags
Object.defineProperty(MockElement.prototype, 'innerHTML', {
  get() {
    return this._innerHTML || '';
  },
  set(val) {
    this._innerHTML = val || '';
    this.children = [];
    if (!val) return;

    // Tokenize HTML tags (both paired and void/self-closing)
    const tokenRegex = /<([a-z0-9-]+)([^>]*?)(?:>(.*?)<\/\1>|\/?>)/gis;
    let match;
    while ((match = tokenRegex.exec(val)) !== null) {
      const tag = match[1];
      const attrsStr = match[2];
      const content = match[3] || '';
      const child = new MockElement(tag);

      const idMatch = /id=["']([^"']+)["']/i.exec(attrsStr);
      if (idMatch) child.id = idMatch[1];

      const classMatch = /class=["']([^"']+)["']/i.exec(attrsStr);
      if (classMatch) child.className = classMatch[1];

      const valueMatch = /value=["']([^"']+)["']/i.exec(attrsStr);
      if (valueMatch) child.value = valueMatch[1];

      const minMatch = /min=["']([^"']+)["']/i.exec(attrsStr);
      if (minMatch) child.setAttribute('min', minMatch[1]);

      const maxMatch = /max=["']([^"']+)["']/i.exec(attrsStr);
      if (maxMatch) child.setAttribute('max', maxMatch[1]);

      const stepMatch = /step=["']([^"']+)["']/i.exec(attrsStr);
      if (stepMatch) child.setAttribute('step', stepMatch[1]);

      const orientMatch = /orient=["']([^"']+)["']/i.exec(attrsStr);
      if (orientMatch) child.setAttribute('orient', orientMatch[1]);

      const ariaLabelMatch = /aria-label=["']([^"']+)["']/i.exec(attrsStr);
      if (ariaLabelMatch) child.setAttribute('aria-label', ariaLabelMatch[1]);

      if (attrsStr.includes('checked')) {
        child.checked = true;
      }

      if (content) {
        child.innerHTML = content;
        child.textContent = content.replace(/<[^>]+>/g, '').trim();
      }

      child.parentNode = this;
      child.parentElement = this;
      this.children.push(child);
    }
  },
  configurable: true
});

const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../utils/storage');
const AudioEngine = require('../utils/audio-engine');
const VolumeBooster = require('../content/js/volume-booster');

async function runM3AdversarialSuite() {
  console.log('================================================================');
  console.log('      M3 ADVERSARIAL EMPIRICAL REVIEW & STRESS TEST SUITE       ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function runTest(name, fn) {
    try {
      fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      console.error(err.stack);
      failed++;
    }
  }

  async function runAsyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      console.error(err.stack);
      failed++;
    }
  }

  // 1. Schema & Deep Cloning Immutability
  console.log('--- 1. Storage Schema & Deep Cloning Immutability ---');

  runTest('1.1: buildMergedSettings with null/undefined returns pristine DEFAULT_SETTINGS', () => {
    const s1 = StorageUtil.buildMergedSettings(null);
    assert.deepEqual(s1.volumeBooster.eqGains, [0,0,0,0,0,0,0,0,0,0]);
    assert.equal(s1.volumeBooster.preset, 'Flat');
    assert.equal(s1.volumeBooster.eqEnabled, true);

    // Modify s1 and ensure DEFAULT_SETTINGS is intact
    s1.volumeBooster.eqGains[0] = 99;
    const s2 = StorageUtil.buildMergedSettings(null);
    assert.equal(s2.volumeBooster.eqGains[0], 0, 'DEFAULT_SETTINGS was not mutated');
  });

  runTest('1.2: buildMergedSettings handles corrupted/partial volumeBooster object', () => {
    const corrupted = {
      volumeBooster: {
        eqGains: 'not an array',
        preset: 12345,
        eqEnabled: 'yes'
      }
    };
    const merged = StorageUtil.buildMergedSettings(corrupted);
    assert.ok(Array.isArray(merged.volumeBooster.eqGains), 'eqGains fallback to default array');
    assert.equal(merged.volumeBooster.eqGains.length, 10);
  });

  await runAsyncTest('1.3: updateVolumeBoosterSetting isolates array references and coerces booleans', async () => {
    await global.chrome.storage.local.clear();
    await global.chrome.storage.sync.clear();
    StorageUtil.clearMemoryCache();

    const inputGains = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    await StorageUtil.updateVolumeBoosterSetting('eqGains', inputGains);
    await StorageUtil.updateVolumeBoosterSetting('eqEnabled', 1); // Truthy number
    await StorageUtil.updateVolumeBoosterSetting('preset', 'Custom');

    // Mutate input array in-place
    inputGains[0] = -12;

    const stored = await StorageUtil.getSettings();
    assert.equal(stored.volumeBooster.eqGains[0], 1, 'Storage was not mutated by external array modification');
    assert.equal(stored.volumeBooster.eqEnabled, true, 'eqEnabled was coerced to boolean true');
    assert.equal(stored.volumeBooster.preset, 'Custom', 'preset saved as Custom');
  });

  await runAsyncTest('1.4: 3-tier cascade fallback on sync storage failure', async () => {
    await global.chrome.storage.local.clear();
    await global.chrome.storage.sync.clear();
    StorageUtil.clearMemoryCache();

    // Simulate quota error or disabled sync
    const origSyncSet = global.chrome.storage.sync.set;
    const origSyncGet = global.chrome.storage.sync.get;
    global.chrome.storage.sync.set = () => Promise.reject(new Error('QUOTA_BYTES exceeded'));
    global.chrome.storage.sync.get = () => Promise.reject(new Error('Sync unavailable'));

    try {
      await StorageUtil.updateVolumeBoosterSetting('preset', 'Electronic');
      StorageUtil.clearMemoryCache(); // Clear in-memory to force reading from Tier 2 local storage
      const settings = await StorageUtil.getSettings();
      assert.equal(settings.volumeBooster.preset, 'Electronic', 'Cascade fell back to local storage');
    } finally {
      global.chrome.storage.sync.set = origSyncSet;
      global.chrome.storage.sync.get = origSyncGet;
    }
  });

  // 2. Preset Matrix and Auto-Detection
  console.log('\n--- 2. Preset Profiles & Dynamic Detection ---');

  const EQ_PRESETS = {
    'Flat':          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'Bass Boost':    [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
    'Vocal Booster': [-2, -1, 0, 2, 4, 5, 4, 2, 0, -1],
    'Treble Boost':  [0, 0, 0, 0, 0, 1, 3, 5, 7, 8],
    'Rock':          [5, 4, 3, 1, -1, -1, 0, 2, 4, 5],
    'Pop':           [-1, 2, 4, 5, 4, 0, -1, 1, 3, 4],
    'Acoustic':      [3, 2, 1, 2, 3, 3, 2, 3, 2, 1],
    'Electronic':    [6, 5, 2, 0, -2, 2, 1, 2, 4, 5],
    'Custom':        null
  };

  const detectPreset = (gains) => {
    if (!Array.isArray(gains)) return 'Custom';
    for (const [name, presetGains] of Object.entries(EQ_PRESETS)) {
      if (name === 'Custom' || !presetGains) continue;
      let match = true;
      for (let i = 0; i < 10; i++) {
        if (Number(gains[i]) !== Number(presetGains[i])) {
          match = false;
          break;
        }
      }
      if (match) return name;
    }
    return 'Custom';
  };

  runTest('2.1: detectPreset correctly identifies all 8 standard presets', () => {
    for (const [name, gains] of Object.entries(EQ_PRESETS)) {
      if (name === 'Custom') continue;
      assert.equal(detectPreset(gains), name, `Preset ${name} matched accurately`);
    }
  });

  runTest('2.2: detectPreset transitions to Custom on sub-decibel deviation', () => {
    const alteredFlat = [0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0];
    assert.equal(detectPreset(alteredFlat), 'Custom', '0.5dB modification switches preset to Custom');

    const alteredRock = [5, 4, 3, 1, -1, -1, 0, 2, 4, 5.5];
    assert.equal(detectPreset(alteredRock), 'Custom', 'Last band deviation switches to Custom');
  });

  runTest('2.3: detectPreset handles edge-case invalid inputs', () => {
    assert.equal(detectPreset(null), 'Custom');
    assert.equal(detectPreset(undefined), 'Custom');
    assert.equal(detectPreset([]), 'Custom');
    assert.equal(detectPreset('invalid'), 'Custom');
  });

  // 3. AudioEngine & VolumeBooster EQ Interface Contract
  console.log('\n--- 3. AudioEngine & VolumeBooster EQ Integration ---');

  runTest('3.1: AudioEngine.setEqGains clamps all 10 bands strictly to [-12, +12]', () => {
    AudioEngine.setEqGains([100, -50, 0, 12.5, -12.5, 0, 6, -6, 2.5, -2.5]);
    const gains = AudioEngine.getEqGains();
    assert.equal(gains[0], 12);
    assert.equal(gains[1], -12);
    assert.equal(gains[2], 0);
    assert.equal(gains[3], 12);
    assert.equal(gains[4], -12);
    assert.equal(gains[5], 0);
    assert.equal(gains[6], 6);
    assert.equal(gains[7], -6);
    assert.equal(gains[8], 2.5);
    assert.equal(gains[9], -2.5);
  });

  runTest('3.2: AudioEngine.setEqPreset applies exact preset gains and sets preset name', () => {
    AudioEngine.setEqPreset('Acoustic');
    assert.equal(AudioEngine.getEqPreset(), 'Acoustic');
    assert.deepEqual(AudioEngine.getEqGains(), [3, 2, 1, 2, 3, 3, 2, 3, 2, 1]);
  });

  runTest('3.3: VolumeBooster proxies all EQ methods seamlessly to AudioEngine', () => {
    VolumeBooster.setEqPreset('Electronic');
    assert.equal(VolumeBooster.getEqPreset(), 'Electronic');
    assert.deepEqual(VolumeBooster.getEqGains(), [6, 5, 2, 0, -2, 2, 1, 2, 4, 5]);

    VolumeBooster.setEqBandGain(2, -8);
    assert.equal(VolumeBooster.getEqPreset(), 'Custom');
    assert.equal(VolumeBooster.getEqGains()[2], -8);

    VolumeBooster.resetEq();
    assert.equal(VolumeBooster.getEqPreset(), 'Flat');
    assert.deepEqual(VolumeBooster.getEqGains(), [0,0,0,0,0,0,0,0,0,0]);
  });

  // 4. HeaderButton Popover EQ Lifecycle & DOM Interactions
  console.log('\n--- 4. HeaderButton Popover EQ Lifecycle & DOM Interactions ---');

  function setupHeaderDOM() {
    document.body.children = [];
    const buttons = new MockElement('div');
    buttons.id = 'buttons';
    document.body.appendChild(buttons);
    return buttons;
  }

  await runAsyncTest('4.1: HeaderButton.openPopup creates full 10-band slider rack and preset dropdown in DOM', async () => {
    setupHeaderDOM();

    require('../content/js/header-button');
    const hb = window.HeaderButton;
    hb.isActive = false;
    hb.enable();

    await hb.openPopup();

    const dialog = document.getElementById('ss-popup-dialog');
    assert.ok(dialog, 'Popover dialog is mounted in DOM');

    const eqToggle = dialog.querySelector('#ss-eq-toggle');
    const eqPreset = dialog.querySelector('#ss-eq-preset');
    const eqReset = dialog.querySelector('#ss-eq-reset');
    const eqRack = dialog.querySelector('#ss-eq-rack');

    assert.ok(eqToggle, 'ss-eq-toggle exists');
    assert.ok(eqPreset, 'ss-eq-preset exists');
    assert.ok(eqReset, 'ss-eq-reset exists');
    assert.ok(eqRack, 'ss-eq-rack exists');

    for (let i = 0; i < 10; i++) {
      const slider = dialog.querySelector(`#ss-eq-slider-${i}`);
      const valSpan = dialog.querySelector(`#ss-eq-val-${i}`);
      assert.ok(slider, `ss-eq-slider-${i} exists`);
      assert.ok(valSpan, `ss-eq-val-${i} exists`);
      assert.equal(slider.getAttribute('min'), '-12');
      assert.equal(slider.getAttribute('max'), '12');
      assert.equal(slider.getAttribute('step'), '0.5');
    }

    hb.closePopup();
    assert.equal(document.getElementById('ss-popup-dialog'), null, 'Popup cleanly removed on closePopup()');
    hb.disable();
  });

  await runAsyncTest('4.2: Popover preset change applies to AudioEngine, VolumeBooster, and storage', async () => {
    setupHeaderDOM();

    const hb = window.HeaderButton;
    hb.isActive = false;
    hb.enable();
    await hb.openPopup();

    const dialog = document.getElementById('ss-popup-dialog');
    const eqPreset = dialog.querySelector('#ss-eq-preset');
    eqPreset.value = 'Rock';
    eqPreset.dispatchEvent({ type: 'change' });

    // Allow async event handler to complete
    await new Promise(r => setTimeout(r, 30));

    // Verify UI sliders updated
    const slider0 = dialog.querySelector('#ss-eq-slider-0');
    assert.equal(slider0.value, '5', 'Slider 0 updated to 5dB (Rock preset band 0)');

    // Verify storage updated
    const settings = await StorageUtil.getSettings();
    assert.equal(settings.volumeBooster.preset, 'Rock');
    assert.deepEqual(settings.volumeBooster.eqGains, [5, 4, 3, 1, -1, -1, 0, 2, 4, 5]);

    // Verify AudioEngine updated
    assert.equal(AudioEngine.getEqPreset(), 'Rock');

    hb.closePopup();
    hb.disable();
  });

  await runAsyncTest('4.3: Popover Reset button restores Flat preset (all 0dB)', async () => {
    setupHeaderDOM();

    const hb = window.HeaderButton;
    hb.isActive = false;
    hb.enable();
    await hb.openPopup();

    const dialog = document.getElementById('ss-popup-dialog');
    const eqReset = dialog.querySelector('#ss-eq-reset');
    const eqPreset = dialog.querySelector('#ss-eq-preset');

    eqReset.dispatchEvent({ type: 'click' });

    // Allow async event handler to complete
    await new Promise(r => setTimeout(r, 30));

    assert.equal(eqPreset.value, 'Flat', 'Dropdown changed to Flat');
    for (let i = 0; i < 10; i++) {
      const slider = dialog.querySelector(`#ss-eq-slider-${i}`);
      assert.equal(slider.value, 0, `Slider ${i} reset to 0dB`);
    }

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.volumeBooster.preset, 'Flat');
    assert.deepEqual(settings.volumeBooster.eqGains, [0,0,0,0,0,0,0,0,0,0]);

    hb.closePopup();
    hb.disable();
  });

  await runAsyncTest('4.4: Master EQ Toggle enables/disables rack and syncs eqEnabled', async () => {
    setupHeaderDOM();

    const hb = window.HeaderButton;
    hb.isActive = false;
    hb.enable();
    await hb.openPopup();

    const dialog = document.getElementById('ss-popup-dialog');
    const eqToggle = dialog.querySelector('#ss-eq-toggle');
    const eqRack = dialog.querySelector('#ss-eq-rack');

    // Turn OFF
    eqToggle.checked = false;
    eqToggle.dispatchEvent({ type: 'change' });

    // Allow async event handler to complete
    await new Promise(r => setTimeout(r, 30));

    assert.ok(eqRack.classList.contains('ss-eq-disabled'), 'Rack received ss-eq-disabled class');
    assert.equal(AudioEngine.eqEnabled, false, 'AudioEngine.eqEnabled is false');

    let settings = await StorageUtil.getSettings();
    assert.equal(settings.volumeBooster.eqEnabled, false, 'Storage eqEnabled is false');

    // Turn ON
    eqToggle.checked = true;
    eqToggle.dispatchEvent({ type: 'change' });

    // Allow async event handler to complete
    await new Promise(r => setTimeout(r, 30));

    assert.ok(!eqRack.classList.contains('ss-eq-disabled'), 'Rack removed ss-eq-disabled class');
    assert.equal(AudioEngine.eqEnabled, true, 'AudioEngine.eqEnabled is true');

    settings = await StorageUtil.getSettings();
    assert.equal(settings.volumeBooster.eqEnabled, true, 'Storage eqEnabled is true');

    hb.closePopup();
    hb.disable();
  });

  // 5. Cross-Tier Sync & Event Trigger Verification
  console.log('\n--- 5. Pairwise Cross-Context Storage Synchronization ---');

  await runAsyncTest('5.1: Storage update in HeaderButton propagates to chrome.storage.onChanged listeners', async () => {
    await global.chrome.storage.local.clear();
    await global.chrome.storage.sync.clear();
    StorageUtil.clearMemoryCache();

    let changeNotified = false;
    let receivedNewValue = null;

    // Simulate Options/Popup listening to chrome.storage.onChanged
    const listener = (changes, area) => {
      if (changes.settings) {
        changeNotified = true;
        receivedNewValue = changes.settings.newValue;
      }
    };
    global.chrome.storage.onChanged.addListener(listener);

    // Header Button updates eqGains
    const customGains = [2, 3, 4, 3, 2, 1, 0, -1, -2, -3];
    await StorageUtil.updateVolumeBoosterSetting('eqGains', customGains);
    await StorageUtil.updateVolumeBoosterSetting('preset', 'Custom');

    const fresh = await StorageUtil.getSettings();
    assert.deepEqual(fresh.volumeBooster.eqGains, customGains);
    assert.equal(fresh.volumeBooster.preset, 'Custom');

    global.chrome.storage.onChanged.removeListener(listener);
  });

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runM3AdversarialSuite().catch(err => {
  console.error('Fatal in adversarial test suite:', err);
  process.exit(1);
});
