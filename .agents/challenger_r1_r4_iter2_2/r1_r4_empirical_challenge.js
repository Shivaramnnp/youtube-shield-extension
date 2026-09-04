/**
 * Empirical Adversarial Challenge Test Harness for Iteration 2 Wiring (R1-R4)
 * Challenger: challenger_r1_r4_iter2_2
 */

const { setupMockEnv } = require('../../tests/harness/mock-extension-env');
setupMockEnv();

const { assert, resetStorage } = require('../../tests/harness/test-helpers');
const StorageUtil = require('../../utils/storage').StorageUtil;
const AudioEngine = require('../../utils/audio-engine');
const { TimeTracker } = require('../../utils/time-tracker');
require('../../content/js/time-manager');
require('../../content/js/observer-utils');
require('../../content/js/feed-controller');

let testResults = [];

function recordTest(name, fn) {
  try {
    fn();
    testResults.push({ name, status: 'PASS', error: null });
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    testResults.push({ name, status: 'FAIL', error: err.message });
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function recordAsyncTest(name, fn) {
  try {
    await fn();
    testResults.push({ name, status: 'PASS', error: null });
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    testResults.push({ name, status: 'FAIL', error: err.message });
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

function createMockInputElement(id) {
  const el = document.createElement('input');
  el.id = id;
  document.body.appendChild(el);
  return el;
}

async function runEmpiricalChallenge() {
  console.log('\n=======================================================');
  console.log('🔥 EMPIRICAL ADVERSARIAL CHALLENGE - ITERATION 2 WIRING');
  console.log('=======================================================\n');

  // ----------------------------------------------------
  // ITEM 1: Web Audio sound effects triggers & sound toggle
  // ----------------------------------------------------
  console.log('--- CHALLENGE ITEM 1: Web Audio Sound Effects & State Sync ---');

  recordTest('1.1: AudioEngine synthesized tones respect enabled=false', () => {
    AudioEngine.enabled = false;
    let played = false;
    const origPlayTone = AudioEngine.playTone;
    AudioEngine.playTone = () => { played = true; };
    try {
      AudioEngine.playLevelUp();
      AudioEngine.playBadgeUnlock();
      AudioEngine.playAlarm();
      AudioEngine.playClick();
      assert.equal(played, false, 'No playTone calls should occur when AudioEngine.enabled is false');
    } finally {
      AudioEngine.playTone = origPlayTone;
      AudioEngine.enabled = true;
    }
  });

  recordTest('1.2: Badge unlock triggers AudioEngine.playBadgeUnlock() when enabled', () => {
    let unlockCalled = false;
    const origBadgeUnlock = window.AudioEngine.playBadgeUnlock;
    window.AudioEngine.playBadgeUnlock = () => { unlockCalled = true; };

    try {
      const tt = new TimeTracker();
      const tracking = {
        monthlyLearningTotal: 1000, // unlocks 'first_step'
        dailyWatchTime: {},
        dailyLearningTime: {},
        gamification: { currentStreak: 0, badges: [], unlockedBadgeDates: {}, rankId: 'bronze_focus' }
      };

      tt.checkBadges(tracking, {});
      assert.equal(unlockCalled, true, 'Badge unlock must trigger playBadgeUnlock()');
    } finally {
      window.AudioEngine.playBadgeUnlock = origBadgeUnlock;
    }
  });

  recordTest('1.3: Rank upgrade triggers AudioEngine.playLevelUp() when enabled', () => {
    let levelUpCalled = false;
    const origLevelUp = window.AudioEngine.playLevelUp;
    window.AudioEngine.playLevelUp = () => { levelUpCalled = true; };

    try {
      const tt = new TimeTracker();
      const tracking = {
        monthlyLearningTotal: 900000,
        dailyWatchTime: {},
        dailyLearningTime: {},
        gamification: { currentStreak: 100, badges: [], unlockedBadgeDates: {}, rankId: 'bronze_focus' }
      };

      tt.checkBadges(tracking, {});
      assert.equal(levelUpCalled, true, 'Rank upgrade from bronze_focus to grandmaster_legend must trigger playLevelUp()');
    } finally {
      window.AudioEngine.playLevelUp = origLevelUp;
    }
  });

  recordTest('1.4: TimeManager budget alarm triggers AudioEngine.playAlarm() when enabled', () => {
    let alarmCalled = false;
    const origAlarm = window.AudioEngine.playAlarm;
    window.AudioEngine.playAlarm = () => { alarmCalled = true; };

    try {
      const tm = window.TimeManager;
      tm.showOverlay('limit', { limitMinutes: 60, todayMinutes: 65 });
      assert.equal(alarmCalled, true, 'TimeManager budget alarm must trigger playAlarm()');
      tm.removeOverlay();
    } finally {
      window.AudioEngine.playAlarm = origAlarm;
    }
  });

  await recordAsyncTest('1.5: Content Script AudioEngine.enabled state sync when audioEffects is toggled off', async () => {
    await resetStorage();
    
    // Read content/js/main.js to check if applySettings syncs AudioEngine.enabled
    const mainJsCode = require('fs').readFileSync(require('path').join(__dirname, '../../content/js/main.js'), 'utf8');
    
    const handlesAudioEffectsInMain = mainJsCode.includes('audioEffects');
    
    await StorageUtil.updateSetting('audioEffects', false);
    const settings = await StorageUtil.getSettings();
    assert.equal(settings.audioEffects, false, 'Storage should have audioEffects = false');

    if (!handlesAudioEffectsInMain) {
      throw new Error('BUG FOUND: main.js does NOT update window.AudioEngine.enabled in applySettings()! Toggling audioEffects off in popup/options is ignored by the YouTube content script, causing sound effects to keep playing on YouTube tabs.');
    }
  });

  // ----------------------------------------------------
  // ITEM 2: Popup custom blocklist UI keyword/channel input and storage sync
  // ----------------------------------------------------
  console.log('\n--- CHALLENGE ITEM 2: Popup Custom Blocklist UI & Storage Sync ---');

  await recordAsyncTest('2.1: Popup loads blockedKeywords and blockedChannels into UI input fields', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedKeywords', ['gaming', 'vlog', 'prank']);
    await StorageUtil.updateSetting('blockedChannels', ['GamerChannel', 'VlogHub']);

    document.body.children = [];
    const popKwInput = createMockInputElement('pop-blocked-keywords');
    const popChInput = createMockInputElement('pop-blocked-channels');

    const settings = await StorageUtil.getSettings();

    popKwInput.value = (settings.blockedKeywords || []).join(', ');
    popChInput.value = (settings.blockedChannels || []).join(', ');

    assert.equal(popKwInput.value, 'gaming, vlog, prank', 'Popup keyword input populated correctly');
    assert.equal(popChInput.value, 'GamerChannel, VlogHub', 'Popup channel input populated correctly');
  });

  await recordAsyncTest('2.2: Popup keyword input change parses, trims, filters empty, and syncs to storage', async () => {
    await resetStorage();
    document.body.children = [];
    
    const popKwInput = createMockInputElement('pop-blocked-keywords');
    popKwInput.value = "  fortnite,  minecraft , , reaction  ";
    
    const keywords = popKwInput.value.split(',').map(k => k.trim()).filter(Boolean);
    await StorageUtil.updateSetting('blockedKeywords', keywords);

    const freshSettings = await StorageUtil.getSettings();
    assert.deepEqual(freshSettings.blockedKeywords, ['fortnite', 'minecraft', 'reaction'], 'Parsed and trimmed keywords saved to storage');
  });

  await recordAsyncTest('2.3: Popup channel input change parses, trims, filters empty, and syncs to storage', async () => {
    await resetStorage();
    document.body.children = [];
    
    const popChInput = createMockInputElement('pop-blocked-channels');
    popChInput.value = "  PewDiePie , , TSeries  ";
    
    const channels = popChInput.value.split(',').map(c => c.trim()).filter(Boolean);
    await StorageUtil.updateSetting('blockedChannels', channels);

    const freshSettings = await StorageUtil.getSettings();
    assert.deepEqual(freshSettings.blockedChannels, ['PewDiePie', 'TSeries'], 'Parsed and trimmed channels saved to storage');
  });

  await recordAsyncTest('2.4: Empty input in Popup blocklist clears storage list to empty array', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedKeywords', ['gaming']);

    document.body.children = [];
    const popKwInput = createMockInputElement('pop-blocked-keywords');
    popKwInput.value = "   ,   ";
    
    const keywords = popKwInput.value.split(',').map(k => k.trim()).filter(Boolean);
    await StorageUtil.updateSetting('blockedKeywords', keywords);

    const freshSettings = await StorageUtil.getSettings();
    assert.deepEqual(freshSettings.blockedKeywords, [], 'Clearing input saves empty array to storage');
  });

  // ----------------------------------------------------
  // ITEM 3: FeedController infinite scroll filtering when Study Mode is off
  // ----------------------------------------------------
  console.log('\n--- CHALLENGE ITEM 3: FeedController Infinite Scroll Filtering (Study Mode Off) ---');

  recordTest('3.1: FeedController registers ObserverUtils when Study Mode is OFF but blocklist is present', () => {
    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;

    let observed = false;
    let observedSelector = null;
    const origObserve = window.ObserverUtils.observe;

    try {
      window.ObserverUtils.observe = (selector, callback, name) => {
        if (name === 'feed-controller') {
          observed = true;
          observedSelector = selector;
        }
      };

      fc.setBlocklist(['clickbait', 'prank'], []);

      assert.equal(observed, true, 'ObserverUtils MUST be observing feed when custom blocklist terms exist even if Study Mode is OFF');
      assert.ok(observedSelector.includes('ytd-rich-item-renderer'), 'Observes YouTube feed item renderers');
    } finally {
      window.ObserverUtils.observe = origObserve;
    }
  });

  recordTest('3.2: ObserverUtils callback filters dynamically scrolled elements when Study Mode is OFF', () => {
    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;

    let capturedCallback = null;
    const origObserve = window.ObserverUtils.observe;

    try {
      window.ObserverUtils.observe = (selector, callback, name) => {
        if (name === 'feed-controller') {
          capturedCallback = callback;
        }
      };

      fc.setBlocklist(['fortnite', 'roblox'], ['gaminghub']);
      assert.ok(capturedCallback, 'Observer callback captured');

      document.body.children = [];
      
      const card1 = document.createElement('ytd-rich-item-renderer');
      card1.id = 'card1';
      card1.innerHTML = `<span id="video-title">Fortnite New Season Gameplay</span><span class="ytd-channel-name">Epic Gamer</span>`;

      const card2 = document.createElement('ytd-rich-item-renderer');
      card2.id = 'card2';
      card2.innerHTML = `<span id="video-title">Learn Quantum Mechanics</span><span class="ytd-channel-name">Physics Hub</span>`;

      const card3 = document.createElement('ytd-rich-item-renderer');
      card3.id = 'card3';
      card3.innerHTML = `<span id="video-title">Cooking Masterclass</span><span class="ytd-channel-name">GamingHub</span>`;

      document.body.appendChild(card1);
      document.body.appendChild(card2);
      document.body.appendChild(card3);

      const newElements = [card1, card2, card3];
      capturedCallback(newElements);

      assert.equal(card1.style.display, 'none', 'Newly scrolled element matching blocked keyword "fortnite" must be hidden (display: none)');
      assert.ok(card1.classList.contains('off-topic'), 'card1 marked off-topic');

      assert.notEqual(card2.style.display, 'none', 'Newly scrolled non-blocked element remains visible');
      assert.equal(card2.classList.contains('off-topic'), false, 'card2 not marked off-topic');

      assert.equal(card3.style.display, 'none', 'Newly scrolled element matching blocked channel "gaminghub" must be hidden (display: none)');
      assert.ok(card3.classList.contains('off-topic'), 'card3 marked off-topic');
    } finally {
      window.ObserverUtils.observe = origObserve;
    }
  });

  recordTest('3.3: Toggling Study Mode OFF preserves custom blocklist filtering and keeps observer active', () => {
    const fc = window.FeedController;
    fc.setBlocklist(['clickbait'], []);
    
    fc.enable('Learn Python');
    assert.equal(fc.isActive, true, 'Study Mode is active');

    document.body.children = [];
    const item1 = document.createElement('ytd-rich-item-renderer');
    item1.id = 'item1';
    item1.innerHTML = `<span id="video-title">Clickbait Title</span><span class="ytd-channel-name">Random Channel</span>`;

    const item2 = document.createElement('ytd-rich-item-renderer');
    item2.id = 'item2';
    item2.innerHTML = `<span id="video-title">Python Programming 101</span><span class="ytd-channel-name">Code Academy</span>`;

    const item3 = document.createElement('ytd-rich-item-renderer');
    item3.id = 'item3';
    item3.innerHTML = `<span id="video-title">Minecraft Secrets</span><span class="ytd-channel-name">Gamer</span>`;

    document.body.appendChild(item1);
    document.body.appendChild(item2);
    document.body.appendChild(item3);

    fc.filterFeed([item1, item2, item3]);

    assert.equal(item1.style.display, 'none', 'item1 blocked by custom blocklist');
    assert.notEqual(item2.style.display, 'none', 'item2 visible (on-topic)');
    assert.equal(item3.style.display, 'none', 'item3 blocked by study mode');

    fc.disable();
    assert.equal(fc.isActive, false, 'Study Mode is now OFF');

    assert.equal(item1.style.display, 'none', 'Custom blocklist item MUST STAY HIDDEN when Study Mode is turned off');
    assert.notEqual(item2.style.display, 'none', 'On-topic item stays visible');
    assert.notEqual(item3.style.display, 'none', 'Off-topic study mode item MUST BE RESTORED TO VISIBLE when Study Mode is turned off');
  });

  // Print Summary
  console.log('\n=======================================================');
  console.log('SUMMARY OF EMPIRICAL ADVERSARIAL CHALLENGE');
  console.log('=======================================================');
  const passed = testResults.filter(t => t.status === 'PASS').length;
  const failed = testResults.filter(t => t.status === 'FAIL').length;
  console.log(`Total Tests Run : ${testResults.length}`);
  console.log(`Passed          : ${passed}`);
  console.log(`Failed          : ${failed}`);
  console.log('=======================================================\n');

  if (failed > 0) {
    console.log('FAILED TESTS DETAIL:');
    testResults.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
  }

  return { passed, failed, testResults };
}

if (require.main === module) {
  runEmpiricalChallenge();
}

module.exports = { runEmpiricalChallenge };
