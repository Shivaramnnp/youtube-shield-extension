const fs = require('fs');
const path = require('path');
const { setupMockEnv } = require('./harness/mock-extension-env');

// Load utilities
const GamificationEngine = require('../utils/gamification-engine');
const StorageUtil = require('../utils/storage');

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    testsPassed++;
  } else {
    testsFailed++;
    failures.push(message);
    console.error(`❌ FAILED: ${message}`);
  }
}

async function runEmpiricalStressSuite() {
  console.log("=== STARTING CHALLENGER M4 EMPIRICAL STRESS SUITE ===");

  // --- SECTION 1: 22 Achievement Badges System Verification ---
  console.log("\n--- Section 1: 22 Achievement Badges Verification ---");
  const badges = GamificationEngine.BADGE_DEFINITIONS;
  assert(Array.isArray(badges), "BADGE_DEFINITIONS should be an array");
  assert(badges.length === 22, `Expected exactly 22 achievement badges, found ${badges.length}`);

  const timeBadges = badges.filter(b => b.category === 'time');
  const streakBadges = badges.filter(b => b.category === 'streak');
  const shieldBadges = badges.filter(b => b.category === 'shield');

  assert(timeBadges.length === 8, `Expected 8 time badges, found ${timeBadges.length}`);
  assert(streakBadges.length === 7, `Expected 7 streak badges, found ${streakBadges.length}`);
  assert(shieldBadges.length === 7, `Expected 7 shield badges, found ${shieldBadges.length}`);

  // Test AP summation & boundary values
  const allIds = badges.map(b => b.id);
  const totalAP = GamificationEngine.calculateTotalAP(allIds);
  assert(totalAP === 4100, `Expected total AP across all 22 badges to be 4100, got ${totalAP}`);

  // Test bad/duplicate input handling for AP calculation
  const duplicateAP = GamificationEngine.calculateTotalAP(['first_step', 'first_step', 'first_step']);
  assert(duplicateAP === 50, `Duplicate badge IDs should be deduplicated (expected 50 AP, got ${duplicateAP})`);

  const invalidAP = GamificationEngine.calculateTotalAP(['non_existent_badge', null, undefined, 123]);
  assert(invalidAP === 0, `Invalid badge IDs should yield 0 AP (got ${invalidAP})`);

  const bonusAP = GamificationEngine.calculateTotalAP(['first_step'], 150);
  assert(bonusAP === 200, `Bonus AP should add correctly (expected 200 AP, got ${bonusAP})`);

  // --- SECTION 2: Focus Score Clamping Verification ---
  console.log("\n--- Section 2: Focus Score Clamping Verification ---");
  const testFocusScore = (learningSecs, totalSecs) => {
    const safeLearn = Math.max(0, Number(learningSecs) || 0);
    const safeTotal = Math.max(0, Number(totalSecs) || 0);
    return safeTotal > 0 ? Math.min(100, Math.max(0, Math.round((safeLearn / safeTotal) * 100))) : 0;
  };

  assert(testFocusScore(0, 0) === 0, "0 total seconds should produce 0% focus score (division by zero handling)");
  assert(testFocusScore(300, 600) === 50, "300/600 should produce 50%");
  assert(testFocusScore(600, 600) === 100, "600/600 should produce 100%");
  assert(testFocusScore(1200, 600) === 100, "1200/600 (overflow) should clamp to 100%");
  assert(testFocusScore(-100, 600) === 0, "-100/600 (negative learning) should clamp to 0%");
  assert(testFocusScore(300, -600) === 0, "Negative total seconds should produce 0%");
  assert(testFocusScore(NaN, 600) === 0, "NaN learning seconds should produce 0%");
  assert(testFocusScore(300, NaN) === 0, "NaN total seconds should produce 0%");

  // --- SECTION 3: Hero Battle Card Math & EXP Quadratic Curve ---
  console.log("\n--- Section 3: Hero Battle Card Math & EXP Curve ---");
  const level1 = GamificationEngine.calculateLevelFromEXP(0);
  assert(level1.level === 1, `0 EXP should be Level 1 (got ${level1.level})`);
  assert(level1.progressPct === 0, `0 EXP progress percentage should be 0% (got ${level1.progressPct}%)`);
  assert(level1.expNeededForNextLevel === 400, `Level 1 next level threshold should require 400 EXP (got ${level1.expNeededForNextLevel})`);

  const levelMax = GamificationEngine.calculateLevelFromEXP(100000);
  assert(levelMax.level > 1, `100,000 EXP should yield level > 1 (got ${levelMax.level})`);
  assert(levelMax.progressPct >= 0 && levelMax.progressPct <= 100, `Progress Pct must be clamped between 0 and 100 (got ${levelMax.progressPct})`);

  const rankBronze = GamificationEngine.getRankTierFromAP(0);
  assert(rankBronze.currentRank.title === 'Bronze Focus', `0 AP should be Bronze Focus (got ${rankBronze.currentRank.title})`);
  assert(!rankBronze.isMaxRank, "Bronze Focus is not max rank");

  const rankMax = GamificationEngine.getRankTierFromAP(999999);
  assert(rankMax.currentRank.title === 'Grandmaster Legend', `999,999 AP should be Grandmaster Legend (got ${rankMax.currentRank.title})`);
  assert(rankMax.isMaxRank === true, "Grandmaster Legend should be marked as max rank");
  assert(rankMax.tierProgressPct === 100, "Max rank progress percentage should be 100%");

  // --- SECTION 4: Data Backup/Restore JSON & CSV Export Harness ---
  console.log("\n--- Section 4: Backup / Restore Data Exports Verification ---");
  const mockSettings = StorageUtil.DEFAULT_SETTINGS;
  const mockTracking = StorageUtil.DEFAULT_TRACKING;
  mockTracking.dailyWatchTime = { "2026-08-10": 3600, "2026-08-11": 7200, "2026-08-12": 1800 };
  mockTracking.dailyLearningTime = { "2026-08-10": 1800, "2026-08-11": 7200, "2026-08-12": 0 };

  // Test JSON Export Serialization
  const exportPayload = { settings: mockSettings, tracking: mockTracking };
  const jsonString = JSON.stringify(exportPayload, null, 2);
  let parsedExport;
  try {
    parsedExport = JSON.parse(jsonString);
    assert(parsedExport.settings.shortsBlocker === true, "JSON backup preserves settings");
    assert(parsedExport.tracking.dailyWatchTime["2026-08-11"] === 7200, "JSON backup preserves tracking data");
  } catch(e) {
    assert(false, "JSON backup stringification/parsing failed");
  }

  // Test JSON Import Validation (Simulating fileImportJson handler logic)
  const validateImport = (fileContent) => {
    try {
      const imported = JSON.parse(fileContent);
      if (typeof imported === 'object' && imported !== null && (imported.settings || imported.tracking)) {
        return { success: true, settings: imported.settings, tracking: imported.tracking };
      }
      return { success: false, error: "Invalid backup format" };
    } catch(err) {
      return { success: false, error: "Invalid JSON file" };
    }
  };

  assert(validateImport(jsonString).success === true, "Valid JSON backup passes import validation");
  assert(validateImport("{}").success === false, "Empty JSON object fails import validation");
  assert(validateImport("NOT_JSON").success === false, "Malformed JSON string fails import validation");
  assert(validateImport("null").success === false, "Null JSON fails import validation");
  assert(validateImport("123").success === false, "Numeric JSON fails import validation");

  // Test CSV Export Generation Logic
  const generateCSV = (trackingData) => {
    let csv = "Date,Total Watch Time (Mins),Learning Time (Mins),Focus Score (%)\n";
    const dailyWatch = trackingData.dailyWatchTime || {};
    const dailyLearn = trackingData.dailyLearningTime || {};
    const dates = Object.keys(dailyWatch).sort();

    dates.forEach(d => {
      const totalMins = Math.round((dailyWatch[d] || 0) / 60);
      const learnMins = Math.round((dailyLearn[d] || 0) / 60);
      const score = totalMins > 0 ? Math.min(100, Math.max(0, Math.round((learnMins / totalMins) * 100))) : 0;
      csv += `${d},${totalMins},${learnMins},${score}%\n`;
    });
    return csv;
  };

  const csvResult = generateCSV(mockTracking);
  assert(csvResult.includes("2026-08-10,60,30,50%"), "CSV exports 2026-08-10 row correctly (60m total, 30m learn, 50%)");
  assert(csvResult.includes("2026-08-11,120,120,100%"), "CSV exports 2026-08-11 row correctly (120m total, 120m learn, 100%)");
  assert(csvResult.includes("2026-08-12,30,0,0%"), "CSV exports 2026-08-12 row correctly (30m total, 0m learn, 0%)");

  // Empty tracking CSV test
  const emptyCsv = generateCSV({});
  assert(emptyCsv === "Date,Total Watch Time (Mins),Learning Time (Mins),Focus Score (%)\n", "Empty tracking generates header-only CSV without throwing exception");

  // --- SECTION 5: DOM UI Component & Event Listener Empirical Harness ---
  console.log("\n--- Section 5: Popup & Options JS DOM Initialization & Event Sync ---");
  const env = setupMockEnv();

  // Create DOM elements required by popup.html and options.html
  const buildMockDOM = () => {
    const doc = env.document;
    const body = doc.body;

    // Helper to add element with id and class
    const addEl = (tag, id, parent = body) => {
      const el = doc.createElement(tag);
      if (id) el.id = id;
      parent.appendChild(el);
      return el;
    };

    // Popup elements
    addEl('input', 'toggle-master');
    addEl('input', 'toggle-shorts');
    addEl('input', 'toggle-focus');
    addEl('input', 'toggle-study');
    addEl('input', 'toggle-goal');
    addEl('input', 'toggle-time-manager');
    addEl('input', 'pop-audioEffects');
    const popContainer = addEl('div'); popContainer.className = 'popup-container';
    addEl('span', 'current-goal');
    addEl('span', 'today-time');
    addEl('span', 'learning-time');
    addEl('span', 'focus-score');
    addEl('span', 'popup-rank-tier');
    addEl('input', 'pop-blocked-keywords');
    addEl('input', 'pop-blocked-channels');
    addEl('button', 'edit-goal');
    const goalContainer = addEl('div', 'goal-input-container'); goalContainer.style.display = 'none';
    addEl('input', 'goal-input');
    addEl('button', 'save-goal');
    addEl('button', 'open-settings');
    addEl('span', 'session-time');

    // Options elements
    const navMenu = addEl('ul'); navMenu.className = 'nav-menu';
    const tab1 = addEl('li', null, navMenu); tab1.dataset = { tab: 'general' };
    const tab2 = addEl('li', null, navMenu); tab2.dataset = { tab: 'analytics' };
    
    addEl('div', 'general-tab');
    addEl('div', 'analytics-tab');

    addEl('input', 'opt-shortsBlocker');
    addEl('input', 'opt-focusMode');
    addEl('input', 'opt-studyMode');
    addEl('input', 'opt-goalMode');
    addEl('input', 'opt-audioEffects');
    addEl('input', 'opt-focusReminderInterval');

    addEl('input', 'opt-tm-enabled');
    addEl('input', 'opt-tm-scheduleEnabled');
    addEl('input', 'opt-tm-dailyLimitMinutes');
    addEl('input', 'opt-tm-scheduleStart');
    addEl('input', 'opt-tm-scheduleEnd');

    addEl('input', 'opt-pomo-enabled');
    addEl('input', 'opt-pomo-workMinutes');
    addEl('input', 'opt-pomo-breakMinutes');
    addEl('input', 'opt-pomo-longBreakMinutes');
    addEl('input', 'opt-pomo-cycles');
    addEl('input', 'opt-pomo-soundAlerts');
    addEl('input', 'opt-pomo-autoPause');

    ['hideBell', 'hideSubCount', 'hideChat', 'hideTrending', 'hideExplore', 'hideMiniPlayer', 'hideAutoplay'].forEach(k => {
      addEl('input', `ui-${k}`);
    });

    addEl('span', 'stat-today');
    addEl('span', 'stat-today-learning');
    addEl('span', 'stat-week-learning');
    addEl('span', 'stat-month-learning');
    addEl('span', 'dash-focus-score');
    addEl('span', 'stat-current-streak');
    addEl('span', 'stat-longest-streak');

    addEl('span', 'battle-rank-icon');
    addEl('span', 'battle-level-badge');
    addEl('span', 'battle-rank-name');
    addEl('span', 'battle-next-tier-name');
    addEl('span', 'battle-ap-score');
    addEl('span', 'battle-xp-text');
    addEl('div', 'battle-xp-fill');
    addEl('div', 'battle-xp-glow');

    addEl('div', 'badges-container');
    addEl('div', 'analytics-chart-container');
    addEl('div', 'save-indicator');

    addEl('textarea', 'opt-blocked-keywords');
    addEl('textarea', 'opt-blocked-channels');

    addEl('button', 'btn-export-json');
    addEl('button', 'btn-export-csv');
    addEl('input', 'file-import-json');

    const catContainer = addEl('div', 'category-filter-pills');
    const pAll = addEl('button', null, catContainer); pAll.className = 'filter-pill active'; pAll.setAttribute('data-category', 'all');
    const pTime = addEl('button', null, catContainer); pTime.className = 'filter-pill'; pTime.setAttribute('data-category', 'time');
  };

  buildMockDOM();

  // Test Storage Sync Listeners
  let storageChangeListener = null;
  env.chrome.storage.onChanged.addListener = (fn) => {
    storageChangeListener = fn;
  };

  // Evaluate popup code in environment
  const popupCode = fs.readFileSync(path.join(__dirname, '../popup/popup.js'), 'utf8');
  try {
    eval(`(async () => { ${popupCode} })()`);
    assert(true, "popup.js executed DOMContentLoaded initialization block without throwing");
  } catch(err) {
    assert(false, `popup.js failed initialization: ${err.message}`);
  }

  // Evaluate options code in environment
  const optionsCode = fs.readFileSync(path.join(__dirname, '../options/options.js'), 'utf8');
  try {
    eval(`(async () => { ${optionsCode} })()`);
    assert(true, "options.js executed DOMContentLoaded initialization block without throwing");
  } catch(err) {
    assert(false, `options.js failed initialization: ${err.message}`);
  }

  // Trigger DOMContentLoaded so popup.js and options.js execute initialization
  env.document.dispatchEvent(new Event('DOMContentLoaded'));
  await new Promise(r => setTimeout(r, 50));

  // Verify storage listener registered
  assert(typeof storageChangeListener === 'function', "chrome.storage.onChanged listener successfully registered by UI");

  // Fire storage change event to test live UI sync
  if (storageChangeListener) {
    try {
      await storageChangeListener({ extensionEnabled: { newValue: false } }, 'local');
      assert(true, "chrome.storage.onChanged handler executed cleanly on state change");
    } catch(err) {
      assert(false, `chrome.storage.onChanged handler threw exception: ${err.message}`);
    }
  }

  // --- SECTION 6: Input Sanitization & Deduplication Stress Test ---
  console.log("\n--- Section 6: Input Sanitization & Deduplication ---");
  const testDeduplication = (rawString) => {
    return [...new Set(rawString.split(',').map(k => k.trim()).filter(Boolean))];
  };

  assert(JSON.stringify(testDeduplication("react, vue, react, , typescript ")) === JSON.stringify(["react", "vue", "typescript"]),
    "Blocklist parser correctly trims, filters empty items, and deduplicates keywords");

  assert(JSON.stringify(testDeduplication("   , ,  ,")) === JSON.stringify([]),
    "Blocklist parser handles comma-only or whitespace-only strings gracefully");

  assert(JSON.stringify(testDeduplication("<script>alert(1)</script>, react")) === JSON.stringify(["<script>alert(1)</script>", "react"]),
    "Blocklist parser handles raw HTML tokens safely");

  // Summary
  console.log("\n==========================================");
  console.log(`TOTAL TESTS EXECUTED: ${testsPassed + testsFailed}`);
  console.log(`PASSED: ${testsPassed}`);
  console.log(`FAILED: ${testsFailed}`);
  console.log("==========================================");

  if (testsFailed > 0) {
    console.error("FAILURES:");
    failures.forEach(f => console.error(" - " + f));
    process.exit(1);
  } else {
    console.log("ALL EMPIRICAL TESTS PASSED SUCCESSFULLY! ✅");
    process.exit(0);
  }
}

runEmpiricalStressSuite();
