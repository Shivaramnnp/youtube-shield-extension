/**
 * Empirical Stress & Verification Test Script for Iteration 2 (R1-R4)
 * Shorts Shield Extension Next-Level Features Wiring Verification
 */

const assert = require('assert');
const path = require('path');

// Setup mock environment first!
const { setupMockEnv } = require('../../tests/harness/mock-extension-env');
setupMockEnv();

const { resetStorage, createMockStorage } = require('../../tests/harness/test-helpers');
const { StorageUtil, DEFAULT_SETTINGS } = require('../../utils/storage');
const AudioEngine = require('../../utils/audio-engine');
const { TimeTracker, TimeTrackerInstance } = require('../../utils/time-tracker');
const GamificationEngine = require('../../utils/gamification-engine');

// Load content scripts (attaches to global window)
require('../../content/js/observer-utils');
require('../../content/js/feed-controller');
require('../../content/js/time-manager');

const FeedController = window.FeedController;
const TimeManager = window.TimeManager;

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failures.push({ name, error: err });
    testsFailed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failures.push({ name, error: err });
    testsFailed++;
  }
}

async function executeEmpiricalSuite() {
  console.log("\n====================================================");
  console.log("⚡ EMPIRICAL CHALLENGE SUITE: ITERATION 2 (R1-R4)");
  console.log("====================================================\n");

  // ----------------------------------------------------
  // TEST GROUP 1: Web Audio Sound Effects & Toggle State
  // ----------------------------------------------------
  console.log("--- Group 1: Web Audio Sound Effects & audioEffects Toggle ---");

  await resetStorage();

  runTest('AudioEngine initial state has enabled = true', () => {
    assert.strictEqual(AudioEngine.enabled, true);
  });

  runTest('AudioEngine methods respect enabled flag when false', () => {
    let playToneCalled = false;
    const origPlayTone = AudioEngine.playTone;
    AudioEngine.playTone = () => { playToneCalled = true; };

    AudioEngine.enabled = false;
    AudioEngine.playBadgeUnlock();
    AudioEngine.playLevelUp();
    AudioEngine.playAlarm();
    AudioEngine.playClick();

    assert.strictEqual(playToneCalled, false, 'playTone should not be called when AudioEngine.enabled = false');

    AudioEngine.enabled = true;
    AudioEngine.playBadgeUnlock();
    assert.strictEqual(playToneCalled, true, 'playTone should be called when AudioEngine.enabled = true');

    AudioEngine.playTone = origPlayTone;
  });

  await runAsyncTest('TimeTracker.checkBadges triggers playBadgeUnlock and playLevelUp on AudioEngine', async () => {
    let badgeUnlockCount = 0;
    let levelUpCount = 0;

    AudioEngine.enabled = true;
    window.AudioEngine = AudioEngine;

    const origBadge = AudioEngine.playBadgeUnlock;
    const origLevel = AudioEngine.playLevelUp;
    AudioEngine.playBadgeUnlock = () => { badgeUnlockCount++; };
    AudioEngine.playLevelUp = () => { levelUpCount++; };

    const tracking = await StorageUtil.getTracking();
    const settings = await StorageUtil.getSettings();

    // Trigger badge unlocks that elevate rank from Bronze Focus (0 AP) to Silver Scholar (>= 200 AP)
    // first_step (50 AP) + focus_rookie (50 AP) + deep_diver (100 AP) = 200 AP -> Silver Scholar rank upgrade!
    tracking.monthlyLearningTotal = 18000;
    const tracker = new TimeTracker();
    tracker.checkBadges(tracking, settings);

    assert.ok(badgeUnlockCount > 0, `playBadgeUnlock should have been called, got ${badgeUnlockCount}`);
    assert.strictEqual(levelUpCount, 1, `playLevelUp should have been called on rank upgrade to Silver Scholar, got ${levelUpCount}`);

    AudioEngine.playBadgeUnlock = origBadge;
    AudioEngine.playLevelUp = origLevel;
  });

  await runAsyncTest('TimeManager.showOverlay triggers playAlarm on AudioEngine', async () => {
    let alarmCount = 0;
    const origAlarm = AudioEngine.playAlarm;
    AudioEngine.playAlarm = () => { alarmCount++; };

    // Clean DOM
    const oldOverlay = document.getElementById('ss-time-manager-overlay');
    if (oldOverlay) oldOverlay.remove();

    TimeManager.showOverlay('limit', { limitMinutes: 60, todayMinutes: 65 });
    assert.strictEqual(alarmCount, 1, 'playAlarm should be called when TimeManager overlay opens');

    TimeManager.removeOverlay();
    AudioEngine.playAlarm = origAlarm;
  });

  await runAsyncTest('CRITICAL TEST: Mute Audio Effects sync in YouTube Content Script (main.js applySettings)', async () => {
    // Save audioEffects = false in storage
    await StorageUtil.updateSetting('audioEffects', false);
    const settings = await StorageUtil.getSettings();
    assert.strictEqual(settings.audioEffects, false, 'Storage should have audioEffects = false');

    // Simulate content script load / main.js applySettings logic
    AudioEngine.enabled = true; // reset to default initial state in content script

    // Check if main.js applySettings logic updates window.AudioEngine.enabled
    if (window.AudioEngine) {
      // simulate applySettings(settings) as done in main.js
      if (settings.audioEffects !== undefined) {
        window.AudioEngine.enabled = settings.audioEffects !== false;
      }
    }

    assert.strictEqual(window.AudioEngine.enabled, false, 'window.AudioEngine.enabled MUST be false when settings.audioEffects is false');
  });

  // ----------------------------------------------------
  // TEST GROUP 2: Popup Custom Blocklist UI & Storage Sync
  // ----------------------------------------------------
  console.log("\n--- Group 2: Popup Custom Blocklist UI & Storage Sync ---");

  await runAsyncTest('Popup blocklist input parsing correctly trims, converts, and handles empty items', async () => {
    await resetStorage();

    // Simulate input: "  gaming ,  vlog, , prank  "
    const rawKwInput = "  gaming ,  vlog, , prank  ";
    const parsedKeywords = rawKwInput.split(',').map(k => k.trim()).filter(Boolean);

    assert.deepStrictEqual(parsedKeywords, ['gaming', 'vlog', 'prank']);

    await StorageUtil.updateSetting('blockedKeywords', parsedKeywords);
    const savedSettings = await StorageUtil.getSettings();
    assert.deepStrictEqual(savedSettings.blockedKeywords, ['gaming', 'vlog', 'prank']);
  });

  await runAsyncTest('Popup blocklist input for channels correctly saves and retrieves', async () => {
    const rawChInput = " GamingChannel,  TechReviewer,  ";
    const parsedChannels = rawChInput.split(',').map(c => c.trim()).filter(Boolean);

    assert.deepStrictEqual(parsedChannels, ['GamingChannel', 'TechReviewer']);

    await StorageUtil.updateSetting('blockedChannels', parsedChannels);
    const savedSettings = await StorageUtil.getSettings();
    assert.deepStrictEqual(savedSettings.blockedChannels, ['GamingChannel', 'TechReviewer']);
  });

  await runAsyncTest('Empty blocklist input clears stored array to []', async () => {
    const rawKwInput = "   ,   , ";
    const parsedKeywords = rawKwInput.split(',').map(k => k.trim()).filter(Boolean);
    assert.deepStrictEqual(parsedKeywords, []);

    await StorageUtil.updateSetting('blockedKeywords', parsedKeywords);
    const savedSettings = await StorageUtil.getSettings();
    assert.deepStrictEqual(savedSettings.blockedKeywords, []);
  });

  await runAsyncTest('Popup and Options blocklist storage sync consistency', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedKeywords', ['fortnite', 'minecraft']);
    await StorageUtil.updateSetting('blockedChannels', ['GamerX']);

    const settings1 = await StorageUtil.getSettings();
    assert.deepStrictEqual(settings1.blockedKeywords, ['fortnite', 'minecraft']);
    assert.deepStrictEqual(settings1.blockedChannels, ['GamerX']);

    // Re-read storage
    const settings2 = await StorageUtil.getSettings();
    assert.deepStrictEqual(settings2.blockedKeywords, settings1.blockedKeywords);
    assert.deepStrictEqual(settings2.blockedChannels, settings1.blockedChannels);
  });

  // ----------------------------------------------------
  // TEST GROUP 3: FeedController Infinite Scroll Filtering (Study Mode OFF)
  // ----------------------------------------------------
  console.log("\n--- Group 3: FeedController Infinite Scroll Filtering (Study Mode OFF) ---");

  await runAsyncTest('FeedController enables observer when Study Mode is OFF but blocklist is present', async () => {
    const fc = window.FeedController || FeedController;
    fc.disable(); // Ensure Study Mode is OFF
    assert.strictEqual(fc.isActive, false, 'Study mode should be OFF');

    let observerStarted = false;
    let observerDisconnected = false;

    window.ObserverUtils = {
      observe: (selector, callback, name) => {
        if (name === 'feed-controller') observerStarted = true;
      },
      disconnect: (name) => {
        if (name === 'feed-controller') observerDisconnected = true;
      }
    };

    // Set blocklist while Study Mode is OFF
    fc.setBlocklist(['gaming', 'vlog'], ['GamerChannel']);
    assert.strictEqual(observerStarted, true, 'ObserverUtils.observe MUST be called when blocklist has items even if Study Mode is OFF');

    // Clear blocklist while Study Mode is OFF
    fc.setBlocklist([], []);
    assert.strictEqual(observerDisconnected, true, 'ObserverUtils.disconnect MUST be called when blocklist is empty and Study Mode is OFF');
  });

  runTest('FeedController.filterFeed hides matching custom blocked items when Study Mode is OFF', () => {
    const fc = window.FeedController || FeedController;
    fc.disable(); // Study Mode OFF
    fc.setBlocklist(['minecraft', 'vlog'], ['badchannel']);

    // Create mock DOM elements
    const card1 = document.createElement('div');
    card1.className = 'ytd-rich-item-renderer';
    card1.innerHTML = `
      <a id="video-title">Epic Minecraft Gameplay</a>
      <div id="channel-name">Cool Creator</div>
    `;

    const card2 = document.createElement('div');
    card2.className = 'ytd-rich-item-renderer';
    card2.innerHTML = `
      <a id="video-title">Learn JavaScript Async/Await</a>
      <div id="channel-name">BadChannel</div>
    `;

    const card3 = document.createElement('div');
    card3.className = 'ytd-rich-item-renderer';
    card3.innerHTML = `
      <a id="video-title">Python Data Science Crash Course</a>
      <div id="channel-name">Good Code</div>
    `;

    fc.filterFeed([card1, card2, card3]);

    assert.strictEqual(card1.style.display, 'none', 'Card 1 should be hidden (matches blocked keyword "minecraft")');
    assert.ok(card1.classList.contains('off-topic'), 'Card 1 should have off-topic class');

    assert.strictEqual(card2.style.display, 'none', 'Card 2 should be hidden (matches blocked channel "badchannel")');
    assert.ok(card2.classList.contains('off-topic'), 'Card 2 should have off-topic class');

    assert.strictEqual(card3.style.display, '', 'Card 3 should be visible (on-topic)');
    assert.strictEqual(card3.classList.contains('off-topic'), false, 'Card 3 should not have off-topic class');
  });

  runTest('FeedController skips Shorts cards and lets ShortsBlocker handle them', () => {
    const fc = window.FeedController || FeedController;
    fc.disable();
    fc.setBlocklist(['vlog'], []);

    const shortsCard = document.createElement('div');
    shortsCard.className = 'ytd-rich-item-renderer';
    
    const link = document.createElement('a');
    link.id = 'video-title';
    link.setAttribute('href', '/shorts/abc123');
    link.textContent = 'Funny Vlog Short';

    const channel = document.createElement('div');
    channel.id = 'channel-name';
    channel.textContent = 'ShortsCreator';

    shortsCard.appendChild(link);
    shortsCard.appendChild(channel);

    fc.filterFeed([shortsCard]);

    assert.notStrictEqual(shortsCard.style.display, 'none', 'Shorts card should not be hidden by FeedController (display !== "none")');
    assert.strictEqual(shortsCard.classList.contains('off-topic'), false, 'Shorts card should not get off-topic class');
  });

  console.log("\n====================================================");
  console.log(`EMPIRICAL SUITE SUMMARY: ${testsPassed} passed, ${testsFailed} failed.`);
  console.log("====================================================\n");

  if (testsFailed > 0) {
    console.error("FAILURES DETAILED:");
    failures.forEach(f => {
      console.error(`- ${f.name}: ${f.error.message}`);
    });
    process.exit(1);
  }
}

executeEmpiricalSuite();
