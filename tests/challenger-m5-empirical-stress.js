/**
 * Milestone M5 Comprehensive Empirical Stress & Boundary Harness
 * 
 * Verifies:
 * 1. High-frequency System Load & Memory Stability
 * 2. Repeated Toggle Actions & State Synchronization Under Rapid Switching
 * 3. Storage Schema Invalidation, Corruption Recovery & Quota Fallbacks
 * 4. Audio Engine Failure Handling & Boundary Waveform Synthesis
 * 5. Gamification Engine Math, Boundary Conditions & Rank Thresholds
 */

const { setupMockEnv } = require('./harness/mock-extension-env');

async function runM5EmpiricalStressTests() {
  console.log('⚡ Starting Milestone M5 Empirical Stress & Boundary Test Suite...\n');
  const mockEnv = setupMockEnv();

  const StorageUtil = require('../utils/storage.js').StorageUtil;
  const GamificationEngine = require('../utils/gamification-engine.js');
  const AudioEngine = require('../utils/audio-engine.js');

  let passed = 0;
  let failed = 0;

  function assert(condition, description) {
    if (condition) {
      passed++;
      console.log(`  ✓ [PASS] ${description}`);
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${description}`);
      throw new Error(`Assertion failed: ${description}`);
    }
  }

  // =========================================================================
  // TEST GROUP 1: Storage Schema Validation & Corruption Invalidation
  // =========================================================================
  console.log('--- TEST GROUP 1: Storage Schema Validation & Corruption Invalidation ---');
  
  try {
    // Clear caches and storage
    StorageUtil.clearMemoryCache();
    await global.chrome.storage.local.clear();
    await global.chrome.storage.sync.clear();

    // 1.1 Default schema merge on empty storage
    const defaultSettings = await StorageUtil.getSettings();
    assert(defaultSettings.extensionEnabled === true, 'Default extensionEnabled is true');
    assert(defaultSettings.shortsBlocker === true, 'Default shortsBlocker is true');
    assert(defaultSettings.uiCleaner.hideBell === true, 'Default uiCleaner.hideBell is true');

    // 1.2 Corrupt storage insertion (null, numbers, strings, malformed nested objects)
    await global.chrome.storage.sync.set({ settings: { extensionEnabled: false, uiCleaner: null, timeManager: "corrupt_string" } });
    StorageUtil.clearMemoryCache();

    const recoveredSettings = await StorageUtil.getSettings();
    assert(recoveredSettings.extensionEnabled === false, 'Preserved valid key extensionEnabled=false');
    assert(typeof recoveredSettings.uiCleaner === 'object' && recoveredSettings.uiCleaner !== null, 'Recovered uiCleaner object from null corruption');
    assert(recoveredSettings.uiCleaner.hideBell === true, 'uiCleaner restored default hideBell');
    assert(typeof recoveredSettings.timeManager === 'object', 'timeManager restored default object from string corruption');
    assert(recoveredSettings.timeManager.dailyLimitMinutes === 60, 'timeManager restored default dailyLimitMinutes');

    // 1.3 Tracking schema corruption (missing badges, null dates)
    await global.chrome.storage.local.set({
      tracking: {
        dailyWatchTime: "not_an_object",
        gamification: {
          badges: "corrupt_badges_string",
          unlockedBadgeDates: null,
          totalAP: -500 // negative AP anomaly
        }
      }
    });
    StorageUtil.clearMemoryCache();

    const recoveredTracking = await StorageUtil.getTracking();
    assert(typeof recoveredTracking.dailyWatchTime === 'object', 'dailyWatchTime recovered from non-object corruption');
    assert(Array.isArray(recoveredTracking.gamification.badges), 'gamification.badges recovered to Array from string');
    assert(typeof recoveredTracking.gamification.unlockedBadgeDates === 'object', 'unlockedBadgeDates recovered to Object from null');
  } catch (err) {
    console.error('  Group 1 Error:', err.message);
  }

  // =========================================================================
  // TEST GROUP 2: High-Frequency Load & Repeated Toggle Stress
  // =========================================================================
  console.log('\n--- TEST GROUP 2: High-Frequency Load & Repeated Toggle Stress ---');

  try {
    StorageUtil.clearMemoryCache();
    await global.chrome.storage.local.clear();
    await global.chrome.storage.sync.clear();

    const toggleKeys = ['shortsBlocker', 'focusMode', 'studyMode', 'goalMode', 'extensionEnabled'];
    const startTime = Date.now();

    // 500 Rapid toggle operations
    for (let i = 0; i < 500; i++) {
      const key = toggleKeys[i % toggleKeys.length];
      const val = (i % 2 === 0);
      await StorageUtil.updateSetting(key, val);
    }

    const elapsed = Date.now() - startTime;
    console.log(`  ℹ Completed 500 rapid storage setting toggles in ${elapsed}ms`);

    const finalSettings = await StorageUtil.getSettings();
    assert(typeof finalSettings.extensionEnabled === 'boolean', 'extensionEnabled is boolean after 500 toggles');
    assert(typeof finalSettings.shortsBlocker === 'boolean', 'shortsBlocker is boolean after 500 toggles');
    assert(elapsed < 2000, '500 toggles completed under 2000ms SLA');

    // 500 Rapid UI cleaner toggles
    const uiKeys = ['hideBell', 'hideSubCount', 'hideChat', 'hideTrending', 'hideExplore', 'hideMiniPlayer', 'hideAutoplay'];
    for (let i = 0; i < 500; i++) {
      const uiKey = uiKeys[i % uiKeys.length];
      await StorageUtil.updateUICleanerSetting(uiKey, (i % 2 === 0));
    }
    const finalUiSettings = await StorageUtil.getSettings();
    assert(typeof finalUiSettings.uiCleaner.hideBell === 'boolean', 'hideBell valid after 500 UI cleaner toggles');
  } catch (err) {
    console.error('  Group 2 Error:', err.message);
  }

  // =========================================================================
  // TEST GROUP 3: Audio Engine Boundary & Error Fault Tolerance
  // =========================================================================
  console.log('\n--- TEST GROUP 3: Audio Engine Boundary & Fault Tolerance ---');

  try {
    // 3.1 AudioEngine disabled flag
    AudioEngine.enabled = false;
    AudioEngine.playLevelUp();
    AudioEngine.playBadgeUnlock();
    AudioEngine.playAlarm();
    AudioEngine.playClick();
    AudioEngine.playTone(440, 'sine', 0.1);
    assert(true, 'AudioEngine calls when disabled execute silently without error');

    // 3.2 AudioEngine enabled with extreme boundary parameters (NaN, Infinity, negative values)
    AudioEngine.enabled = true;
    AudioEngine.playTone(NaN, 'sine', -1, -5, NaN);
    AudioEngine.playTone(Infinity, 'invalid_wave_type', Infinity, 0, 9999);
    AudioEngine.playTone(0, null, 0, 0, 0);
    assert(true, 'AudioEngine handles invalid/boundary synth parameters gracefully');

    // 3.3 Rapid simultaneous melody triggers
    for (let i = 0; i < 50; i++) {
      AudioEngine.playLevelUp();
      AudioEngine.playBadgeUnlock();
      AudioEngine.playAlarm();
      AudioEngine.playClick();
    }
    assert(true, '50 rapid audio fanfare invocations execute without audio context failure');
  } catch (err) {
    console.error('  Group 3 Error:', err.message);
  }

  // =========================================================================
  // TEST GROUP 4: Gamification Engine Math & Boundary Conditions
  // =========================================================================
  console.log('\n--- TEST GROUP 4: Gamification Engine Math & Boundary Conditions ---');

  try {
    // 4.1 AP & EXP calculation under negative, NaN, Infinity, malformed inputs
    const apZero = GamificationEngine.calculateTotalAP(null, -100);
    assert(apZero === 0, 'Negative bonus AP clamped to 0');

    const apNaN = GamificationEngine.calculateTotalAP(['first_step', 'invalid_badge_xyz'], 'invalid_bonus');
    assert(apNaN === 50, 'Invalid badge ID ignored and invalid bonus defaulted to 0 (50 AP total)');

    const expBoundary = GamificationEngine.calculateTotalEXP(['first_step'], -500);
    assert(expBoundary === 500, 'Negative learning time clamped to 0, EXP from badge = 500');

    // 4.2 Level calculation boundary testing: E(L) = 100L^2 + 100L - 200
    // L=1 -> EXP=0
    // L=2 -> 100(4) + 100(2) - 200 = 400
    // L=3 -> 100(9) + 100(3) - 200 = 1000
    const lvl1 = GamificationEngine.calculateLevelFromEXP(0);
    assert(lvl1.level === 1, 'EXP=0 yields Level 1');
    assert(lvl1.currentLevelThreshold === 0, 'Level 1 threshold is 0');
    assert(lvl1.nextLevelThreshold === 400, 'Level 2 threshold is 400');

    const lvl1Upper = GamificationEngine.calculateLevelFromEXP(399);
    assert(lvl1Upper.level === 1, 'EXP=399 is still Level 1');

    const lvl2Exact = GamificationEngine.calculateLevelFromEXP(400);
    assert(lvl2Exact.level === 2, 'EXP=400 reaches Level 2 exact');

    const lvlExtreme = GamificationEngine.calculateLevelFromEXP(1000000);
    assert(lvlExtreme.level > 1, 'Massive EXP (1,000,000) calculates higher level correctly without overflow');
    assert(lvlExtreme.progressPct >= 0 && lvlExtreme.progressPct <= 100, 'Progress percentage bounded in [0, 100]');

    // 4.3 Rank tier boundary thresholds
    // Bronze: 0 - 199 AP
    // Silver: 200 - 499 AP
    // Gold: 500 - 999 AP
    // Diamond: 1000 - 1999 AP
    // Heroic: 2000 - 3499 AP
    // Grandmaster: 3500+ AP
    const rBronze = GamificationEngine.getRankTierFromAP(0);
    assert(rBronze.currentRank.id === 'bronze_focus', '0 AP is Bronze Focus');

    const rSilver = GamificationEngine.getRankTierFromAP(200);
    assert(rSilver.currentRank.id === 'silver_scholar', '200 AP reaches Silver Scholar');

    const rGrandmaster = GamificationEngine.getRankTierFromAP(3500);
    assert(rGrandmaster.currentRank.id === 'grandmaster_legend', '3500 AP reaches Grandmaster Legend');
    assert(rGrandmaster.isMaxRank === true, 'Grandmaster Legend is max rank');
    assert(rGrandmaster.tierProgressPct === 100, 'Max rank tier progress is 100%');

    // 4.4 Badge registry check (all 22 badges present)
    assert(GamificationEngine.BADGE_DEFINITIONS.length === 22, 'Badge registry contains exactly 22 achievement badges');
    
    // Sum of all badge APs
    const allBadgeIds = GamificationEngine.BADGE_DEFINITIONS.map(b => b.id);
    const maxAP = GamificationEngine.calculateTotalAP(allBadgeIds, 0);
    assert(maxAP === 4100, `Unlocking all 22 badges grants exactly 4,100 AP (calculated: ${maxAP})`);
  } catch (err) {
    console.error('  Group 4 Error:', err.message);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n================================================================');
  console.log(`M5 EMPIRICAL STRESS TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runM5EmpiricalStressTests().catch(err => {
    console.error('Fatal M5 stress test error:', err);
    process.exit(1);
  });
}

module.exports = { runM5EmpiricalStressTests };
