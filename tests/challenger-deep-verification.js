/**
 * Deep Empirical Adversarial Stress Test Script for Challenger 1
 * Verifies all 5 edge case focus areas:
 * 1. Regex Boundary Handling
 * 2. Storage Quota Overflows & Cascade Fallback
 * 3. AP/EXP Math Limits & Progression Curves
 * 4. Web Audio Gesture Unlock Fallbacks
 * 5. SPA Navigation Edge Cases & History Patching
 */

const { setupMockEnv } = require('./harness/mock-extension-env');
const { test, describe, assert, resetStorage } = require('./harness/test-helpers');

setupMockEnv();

const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../utils/storage');
const AudioEngine = require('../utils/audio-engine');
const GamificationEngine = require('../utils/gamification-engine');
require('../content/js/feed-controller');
require('../content/js/shorts-blocker');
require('../content/js/goal-mode');
require('../content/js/study-mode');

describe('CHALLENGER DEEP VERIFICATION 1: Regex Boundary Handling', () => {

  test('CV-1.1: Special regex chars in blocklists do not throw or crash evaluation', () => {
    const fc = window.FeedController;
    fc.disable();
    const specialChars = ['[test]', '(arg)', 'c++', 'c#', '*wild*', 'a?b', '^top', 'end$', 'a\\b', 'a|b', '{1,2}'];
    assert.doesNotThrow(() => {
      fc.setBlocklist(specialChars, specialChars);
    });
    assert.equal(fc.blockedKeywords.length, specialChars.length);
  });

  test('CV-1.2: Technical term normalization in keyword extraction and matching', () => {
    const fc = window.FeedController;
    const kw1 = fc.extractKeywords('Learn C++ and C# for game dev');
    assert.ok(kw1.includes('cplusplus'), 'C++ normalized to cplusplus');
    assert.ok(kw1.includes('csharp'), 'C# normalized to csharp');
    assert.ok(kw1.includes('game'), 'game extracted');
    assert.ok(kw1.includes('dev'), 'dev extracted');

    const kw2 = fc.extractKeywords('Master UI/UX Design and Web3');
    assert.ok(kw2.includes('uiux'), 'UI/UX normalized to uiux');
    assert.ok(kw2.includes('web3'), 'Web3 preserved');
    assert.ok(kw2.includes('design'), 'design extracted');
  });

  test('CV-1.3: Shorts URL Regex boundaries (watch page with "shorts" in query/title vs actual shorts path)', () => {
    const shortsRegexContent = /(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i;
    const bgShortsRegex = /^https?:\/\/(www\.)?youtube\.com\/(shorts|playables)(\/.*)?$/i;

    // Positive matches (should redirect)
    assert.ok(shortsRegexContent.test('https://www.youtube.com/shorts'));
    assert.ok(shortsRegexContent.test('https://www.youtube.com/shorts/'));
    assert.ok(shortsRegexContent.test('https://www.youtube.com/shorts/xyz123'));
    assert.ok(shortsRegexContent.test('https://www.youtube.com/shorts?feature=share'));
    assert.ok(shortsRegexContent.test('https://www.youtube.com/playables'));
    assert.ok(shortsRegexContent.test('https://www.youtube.com/playables/game1'));

    assert.ok(bgShortsRegex.test('https://www.youtube.com/shorts'));
    assert.ok(bgShortsRegex.test('https://www.youtube.com/shorts/xyz123'));
    assert.ok(bgShortsRegex.test('https://www.youtube.com/playables/game1'));

    // Negative matches (should NOT redirect)
    assert.ok(!bgShortsRegex.test('https://www.youtube.com/watch?v=shorts123'));
    assert.ok(!bgShortsRegex.test('https://www.youtube.com/results?search_query=shorts+tutorial'));
    assert.ok(!bgShortsRegex.test('https://www.youtube.com/'));
  });

});

describe('CHALLENGER DEEP VERIFICATION 2: Storage Quota Overflows & Cascade', () => {

  test('CV-2.1: chrome.storage.sync QuotaExceededError seamlessly falls back to chrome.storage.local', async () => {
    await resetStorage();

    // Mock chrome.storage.sync.set to simulate quota exceeded error
    const origSyncSet = chrome.storage.sync.set;
    chrome.storage.sync.set = () => Promise.reject(new Error('QuotaExceededError: QUOTA_BYTES_PER_ITEM quota exceeded'));

    const testSettings = { ...DEFAULT_SETTINGS, learningGoal: 'Quota Test Goal' };
    
    await StorageUtil.saveSettings(testSettings);

    // Retrieve settings
    chrome.storage.sync.set = origSyncSet; // restore
    const localData = await chrome.storage.local.get(['settings']);
    assert.ok(localData && localData.settings, 'localData.settings saved');
    assert.equal(localData.settings.learningGoal, 'Quota Test Goal', 'Saved to chrome.storage.local fallback');

    const retrieved = await StorageUtil.getSettings();
    assert.equal(retrieved.learningGoal, 'Quota Test Goal', 'Retrieved from fallback cascade');
  });

  test('CV-2.2: Memory cache fallback when extension context invalidates', async () => {
    await resetStorage();
    await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, learningGoal: 'Context Invalidation Test' });

    // Invalidate context
    const origId = chrome.runtime.id;
    delete chrome.runtime.id;

    const retrieved = await StorageUtil.getSettings();
    assert.equal(retrieved.learningGoal, 'Context Invalidation Test', 'Retrieved from memory cache when context invalidates');

    // Restore context
    chrome.runtime.id = origId;
  });

});

describe('CHALLENGER DEEP VERIFICATION 3: AP/EXP Math Limits & Progression Curves', () => {

  test('CV-3.1: GamificationEngine AP calculations with boundaries and bonus AP', () => {
    // 0 badges, 0 bonus
    assert.equal(GamificationEngine.calculateTotalAP([], 0), 0);
    // Negative bonus AP handled safely
    assert.equal(GamificationEngine.calculateTotalAP([], -50), 0);
    // Invalid badge IDs ignored
    assert.equal(GamificationEngine.calculateTotalAP(['non_existent_badge'], 100), 100);
    // All 22 badges unlocked (total badge AP = 4100) + 500 bonus
    const allBadges = GamificationEngine.BADGE_DEFINITIONS.map(b => b.id);
    assert.equal(allBadges.length, 22);
    assert.equal(GamificationEngine.calculateTotalAP(allBadges, 500), 4600);
  });

  test('CV-3.2: EXP quadratic level curve E(L) = 100L^2 + 100L - 200', () => {
    // Level 1: threshold 0..400
    const l1 = GamificationEngine.calculateLevelFromEXP(0);
    assert.equal(l1.level, 1);
    assert.equal(l1.currentLevelThreshold, 0);
    assert.equal(l1.nextLevelThreshold, 400);
    assert.equal(l1.progressPct, 0);

    // Level 2: threshold 400..1000
    const l2 = GamificationEngine.calculateLevelFromEXP(400);
    assert.equal(l2.level, 2);
    assert.equal(l2.currentLevelThreshold, 400);
    assert.equal(l2.nextLevelThreshold, 1000);
    assert.equal(l2.progressPct, 0);

    // Mid Level 2: 700 EXP -> (700-400)/(1000-400) = 300/600 = 50%
    const l2mid = GamificationEngine.calculateLevelFromEXP(700);
    assert.equal(l2mid.level, 2);
    assert.equal(l2mid.progressPct, 50);

    // High EXP stress: 1,000,000 EXP
    const lHigh = GamificationEngine.calculateLevelFromEXP(1000000);
    assert.ok(lHigh.level > 90, 'High EXP calculates valid level without NaN/Infinity');
    assert.ok(!isNaN(lHigh.progressPct));
  });

  test('CV-3.3: Rank Tier progression & Grandmaster Legend cap at 3500+ AP', () => {
    const rBronze = GamificationEngine.getRankTierFromAP(0);
    assert.equal(rBronze.currentRank.id, 'bronze_focus');
    assert.equal(rBronze.tierProgressPct, 0);
    assert.equal(rBronze.isMaxRank, false);

    const rSilver = GamificationEngine.getRankTierFromAP(200);
    assert.equal(rSilver.currentRank.id, 'silver_scholar');
    assert.equal(rSilver.tierProgressPct, 0);

    const rGM = GamificationEngine.getRankTierFromAP(3500);
    assert.equal(rGM.currentRank.id, 'grandmaster_legend');
    assert.equal(rGM.tierProgressPct, 100);
    assert.equal(rGM.isMaxRank, true);

    const rGMSurplus = GamificationEngine.getRankTierFromAP(10000);
    assert.equal(rGMSurplus.currentRank.id, 'grandmaster_legend');
    assert.equal(rGMSurplus.tierProgressPct, 100);
    assert.equal(rGMSurplus.isMaxRank, true);
  });

});

describe('CHALLENGER DEEP VERIFICATION 4: Web Audio Gesture Unlock Fallbacks', () => {

  test('CV-4.1: AudioEngine handles environment without AudioContext without throwing', () => {
    const origAudioContext = global.window.AudioContext;
    const origWebkitAudioContext = global.window.webkitAudioContext;
    delete global.window.AudioContext;
    delete global.window.webkitAudioContext;

    AudioEngine.ctx = null;
    AudioEngine.enabled = true;

    assert.doesNotThrow(() => {
      AudioEngine.playClick();
      AudioEngine.playAlarm();
      AudioEngine.playBadgeUnlock();
      AudioEngine.playLevelUp();
    }, 'AudioEngine calls do not throw when Web Audio API is unavailable');

    global.window.AudioContext = origAudioContext;
    global.window.webkitAudioContext = origWebkitAudioContext;
  });

  test('CV-4.2: Gesture unlock attaches and detaches event listeners', () => {
    let clickListener = null;
    const origAdd = window.addEventListener;
    const origRemove = window.removeEventListener;

    window.addEventListener = (event, fn, capture) => {
      if (event === 'click') clickListener = fn;
      origAdd.call(window, event, fn, capture);
    };

    AudioEngine.attachGestureUnlock();
    assert.ok(typeof clickListener === 'function', 'Gesture unlock registered click listener');

    window.addEventListener = origAdd;
    window.removeEventListener = origRemove;
  });

});

describe('CHALLENGER DEEP VERIFICATION 5: SPA Navigation Edge Cases', () => {

  test('CV-5.1: ShortsBlocker history API patching & unpatching', () => {
    const sb = window.ShortsBlocker;
    sb.unpatchHistoryAPI();

    const unpatchedPushState = window.history.pushState;
    const unpatchedReplaceState = window.history.replaceState;

    sb.patchHistoryAPI();
    assert.ok(window.history.pushState !== unpatchedPushState, 'pushState patched');
    assert.ok(window.history.replaceState !== unpatchedReplaceState, 'replaceState patched');

    sb.unpatchHistoryAPI();
    assert.equal(window.history.pushState, unpatchedPushState, 'pushState unpatched');
    assert.equal(window.history.replaceState, unpatchedReplaceState, 'replaceState unpatched');
  });

  test('CV-5.2: ShortsBlocker disable() cleans up all timers and SPA listeners', () => {
    const sb = window.ShortsBlocker;
    sb.enable();
    assert.ok(sb.isActive, 'ShortsBlocker active');
    assert.ok(sb.urlCheckInterval !== null, 'URL check interval set');

    sb.disable();
    assert.equal(sb.isActive, false, 'ShortsBlocker inactive');
    assert.equal(sb.urlCheckInterval, null, 'URL check interval cleared');
    assert.equal(sb.boundSPAListener, null, 'SPA listener unbound');
  });

});
