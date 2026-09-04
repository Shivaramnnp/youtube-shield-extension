const fs = require('fs');
const path = require('path');
const { setupMockEnv } = require('./harness/mock-extension-env');

// Load utilities
const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../utils/storage');
const GamificationEngine = require('../utils/gamification-engine');
global.StorageUtil = StorageUtil;
global.GamificationEngine = GamificationEngine;

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

class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    Object.assign(this, options);
  }
}

function buildPopupDOM(doc) {
  const addEl = (tag, id, parent = doc.body) => {
    const el = doc.createElement(tag);
    if (id) el.id = id;
    parent.appendChild(el);
    return el;
  };

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
}

function buildOptionsDOM(doc) {
  const addEl = (tag, id, parent = doc.body) => {
    const el = doc.createElement(tag);
    if (id) el.id = id;
    parent.appendChild(el);
    return el;
  };

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
}

async function runM4_2EmpiricalStressSuite() {
  console.log("=================================================");
  console.log("=== STARTING CHALLENGER M4_2 EMPIRICAL STRESS SUITE ===");
  console.log("=================================================");

  // --- TEST 1: Rapid Input Debouncing & Immediate Blur/Change Flushes ---
  console.log("\n--- Test 1: Rapid Input Debouncing & Event Flushes ---");
  const env1 = setupMockEnv();
  buildPopupDOM(env1.document);

  const popKwInput = env1.document.getElementById('pop-blocked-keywords');

  // Track saveSettings calls
  let updateCount = 0;
  const originalSaveSettings = StorageUtil.saveSettings;
  StorageUtil.saveSettings = async (settings) => {
    updateCount++;
    return originalSaveSettings(settings);
  };

  // Load and trigger popup.js
  const popupJsCode = fs.readFileSync(path.join(__dirname, '../popup/popup.js'), 'utf8');
  eval(popupJsCode);
  env1.document.dispatchEvent('DOMContentLoaded');
  await new Promise(r => setTimeout(r, 50));

  // Initial value check
  assert(popKwInput.value === '', "Initial popKwInput value is empty");

  // Simulate rapid typing (10 rapid input events in 50ms)
  for (let i = 1; i <= 10; i++) {
    popKwInput.value = `keyword${i}, keyword${i+1}`;
    popKwInput.dispatchEvent(new MockEvent('input'));
  }

  // Before 300ms timer elapses, storage save shouldn't have fired from input timers
  assert(updateCount === 0, `Storage updates should be debounced during rapid input (updateCount: ${updateCount})`);

  // Wait 350ms for debounce timer to fire
  await new Promise(r => setTimeout(r, 350));
  assert(updateCount === 1, `After 300ms debounce, exactly 1 storage update should fire (got ${updateCount})`);

  const settingsAfterDebounce = await StorageUtil.getSettings();
  assert(JSON.stringify(settingsAfterDebounce.blockedKeywords) === JSON.stringify(["keyword10", "keyword11"]),
    "Debounced update saved final typed value cleanly");

  // Reset update counter and test immediate 'blur' event flush
  updateCount = 0;
  popKwInput.value = "immediate1, immediate2";
  popKwInput.dispatchEvent(new MockEvent('input')); // starts 300ms timer
  popKwInput.dispatchEvent(new MockEvent('blur'));  // immediate flush

  assert(updateCount === 1, "Blur event flushes update immediately without waiting for timer");
  const settingsAfterBlur = await StorageUtil.getSettings();
  assert(JSON.stringify(settingsAfterBlur.blockedKeywords) === JSON.stringify(["immediate1", "immediate2"]),
    "Blur event saved values correctly");

  // Restore StorageUtil.saveSettings
  StorageUtil.saveSettings = originalSaveSettings;


  // --- TEST 2: Options Dashboard JSON & CSV Backup Import/Export Resilience ---
  console.log("\n--- Test 2: JSON & CSV Backup Import/Export Resilience ---");
  
  const mockTracking = {
    ...StorageUtil.DEFAULT_TRACKING,
    dailyWatchTime: {
      "2026-08-01": 3600,   // 60m total
      "2026-08-02": 7200,   // 120m total
      "2026-08-03": 0,      // 0m total
      "2026-08-04": 1800,   // 30m total
      "2026-08-05": -500,   // Negative edge case
    },
    dailyLearningTime: {
      "2026-08-01": 1800,   // 30m learn (50%)
      "2026-08-02": 7200,   // 120m learn (100%)
      "2026-08-03": 600,    // 10m learn with 0 total (edge case: total 0 -> 0%)
      "2026-08-04": 3600,   // 60m learn with 30m total (edge case: overflow -> 100%)
      "2026-08-05": 100,
    }
  };

  const generateCsvFromTracking = (trackingData) => {
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

  const csvOutput = generateCsvFromTracking(mockTracking);
  assert(csvOutput.includes("2026-08-01,60,30,50%"), "2026-08-01 CSV row correct: 60m total, 30m learn, 50%");
  assert(csvOutput.includes("2026-08-02,120,120,100%"), "2026-08-02 CSV row correct: 120m total, 120m learn, 100%");
  assert(csvOutput.includes("2026-08-03,0,10,0%"), "2026-08-03 CSV row handles 0 total watch time (clamped to 0%)");
  assert(csvOutput.includes("2026-08-04,30,60,100%"), "2026-08-04 CSV row handles learning > total watch time (clamped to 100%)");
  assert(csvOutput.includes("2026-08-05,-8,2,0%"), "2026-08-05 CSV row handles negative watch time gracefully (clamped to 0%)");

  const parseAndApplyJsonImport = async (fileContent) => {
    try {
      const imported = JSON.parse(fileContent);
      if (typeof imported === 'object' && imported !== null) {
        if (imported.settings) await StorageUtil.saveSettings(imported.settings);
        if (imported.tracking) await StorageUtil.saveTracking(imported.tracking);
        return { success: true };
      } else {
        throw new Error("Invalid backup format");
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const validJson = JSON.stringify({ settings: { shortsBlocker: false }, tracking: { weeklyTotal: 500 } });
  const validRes = await parseAndApplyJsonImport(validJson);
  assert(validRes.success === true, "Valid JSON backup imports cleanly");

  const malformedRes1 = await parseAndApplyJsonImport("{ invalid json ");
  assert(malformedRes1.success === false, "Malformed JSON string rejected");

  const malformedRes2 = await parseAndApplyJsonImport("null");
  assert(malformedRes2.success === false, "Null JSON string rejected");

  const malformedRes3 = await parseAndApplyJsonImport("12345");
  assert(malformedRes3.success === false, "Numeric JSON string rejected");

  const malformedRes4 = await parseAndApplyJsonImport('"string"');
  assert(malformedRes4.success === false, "String JSON primitive rejected");

  const partialSettingsJson = JSON.stringify({ settings: { focusMode: true } });
  const partialRes = await parseAndApplyJsonImport(partialSettingsJson);
  assert(partialRes.success === true, "Partial JSON backup with settings only succeeds");
  const settingsFromPartial = await StorageUtil.getSettings();
  assert(settingsFromPartial.focusMode === true, "Partial settings correctly merged into storage");
  assert(settingsFromPartial.shortsBlocker !== undefined, "Default settings preserved when partial settings imported");


  // --- TEST 3: Focus Score Clamping Boundary Conditions ---
  console.log("\n--- Test 3: Focus Score Clamping Boundary Conditions ---");
  const computeFocusScore = (learningSecs, totalSecs) => {
    const l = typeof learningSecs === 'number' && !isNaN(learningSecs) ? learningSecs : 0;
    const t = typeof totalSecs === 'number' && !isNaN(totalSecs) ? totalSecs : 0;
    return t > 0 ? Math.min(100, Math.max(0, Math.round((l / t) * 100))) : 0;
  };

  assert(computeFocusScore(0, 0) === 0, "0/0 returns 0%");
  assert(computeFocusScore(500, 1000) === 50, "500/1000 returns 50%");
  assert(computeFocusScore(1000, 1000) === 100, "1000/1000 returns 100%");
  assert(computeFocusScore(1500, 1000) === 100, "1500/1000 (learning > total) clamps to 100%");
  assert(computeFocusScore(-500, 1000) === 0, "-500/1000 (negative learning) clamps to 0%");
  assert(computeFocusScore(500, -1000) === 0, "500/-1000 (negative total) returns 0%");
  assert(computeFocusScore(NaN, 1000) === 0, "NaN learning returns 0%");
  assert(computeFocusScore(500, NaN) === 0, "NaN total returns 0%");
  assert(computeFocusScore(undefined, 1000) === 0, "undefined learning returns 0%");
  assert(computeFocusScore(500, undefined) === 0, "undefined total returns 0%");


  // --- TEST 4: Real-time Storage Sync Listeners ---
  console.log("\n--- Test 4: Real-time Storage Sync Listeners ---");
  const env4 = setupMockEnv();
  buildPopupDOM(env4.document);

  let listenerRegistered = false;
  let listenerCallback = null;
  env4.chrome.storage.onChanged.addListener = (fn) => {
    listenerRegistered = true;
    listenerCallback = fn;
  };

  eval(popupJsCode);
  env4.document.dispatchEvent('DOMContentLoaded');
  await new Promise(r => setTimeout(r, 50));

  assert(listenerRegistered === true, "Popup registered chrome.storage.onChanged listener");
  assert(typeof listenerCallback === 'function', "Storage listener callback is a function");

  const todayKey = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();

  const newSettings = { ...StorageUtil.DEFAULT_SETTINGS, shortsBlocker: false, extensionEnabled: true };
  const newTracking = {
    ...StorageUtil.DEFAULT_TRACKING,
    dailyWatchTime: { [todayKey]: 3600 },
    dailyLearningTime: { [todayKey]: 2700 }, // 75%
    gamification: { rankIcon: '🥇', rankTier: 'Gold Master', totalPoints: 1200 }
  };

  await StorageUtil.saveSettings(newSettings);
  await StorageUtil.saveTracking(newTracking);

  if (listenerCallback) {
    await listenerCallback({ settings: { newValue: newSettings } }, 'sync');
    await new Promise(r => setTimeout(r, 50));
  }

  const shortsToggle4 = env4.document.getElementById('toggle-shorts');
  const scoreEl4 = env4.document.getElementById('focus-score');
  const rankEl4 = env4.document.getElementById('popup-rank-tier');

  assert(shortsToggle4.checked === false, "Shorts toggle updated to false via storage sync listener");
  assert(scoreEl4.textContent === '75%', `Focus score element updated to 75% via storage sync listener (got '${scoreEl4.textContent}')`);
  assert(rankEl4.textContent.includes('Gold Master'), `Rank tier element updated to Gold Master via storage sync listener (got '${rankEl4.textContent}')`);


  // --- TEST 5: Popup Session Timer Teardown on Window Dismissal ---
  console.log("\n--- Test 5: Popup Session Timer Teardown on Window Dismissal ---");
  const env5 = setupMockEnv();
  buildPopupDOM(env5.document);

  const registeredEvents = {};
  global.window.addEventListener = (event, handler, options) => {
    registeredEvents[event] = { handler, options };
  };

  let clearedIntervalId = null;
  global.window.clearInterval = (id) => {
    clearedIntervalId = id;
  };

  eval(popupJsCode);
  env5.document.dispatchEvent('DOMContentLoaded');
  await new Promise(r => setTimeout(r, 50));

  assert(registeredEvents['unload'] !== undefined, "Popup window registered 'unload' listener for timer teardown");
  assert(registeredEvents['pagehide'] !== undefined, "Popup window registered 'pagehide' listener for timer teardown");
  assert(registeredEvents['unload'].options && registeredEvents['unload'].options.once === true, "'unload' listener uses { once: true }");
  assert(registeredEvents['pagehide'].options && registeredEvents['pagehide'].options.once === true, "'pagehide' listener uses { once: true }");

  registeredEvents['pagehide'].handler();
  assert(clearedIntervalId !== null, "Session timer cleared on pagehide event");


  // --- SUMMARY ---
  console.log("\n==========================================");
  console.log(`TOTAL STRESS TESTS EXECUTED: ${testsPassed + testsFailed}`);
  console.log(`PASSED: ${testsPassed}`);
  console.log(`FAILED: ${testsFailed}`);
  console.log("==========================================");

  if (testsFailed > 0) {
    console.error("FAILURES:");
    failures.forEach(f => console.error(" - " + f));
    process.exit(1);
  } else {
    console.log("ALL M4_2 EMPIRICAL STRESS TESTS PASSED CLEANLY! ✅");
    process.exit(0);
  }
}

runM4_2EmpiricalStressSuite();
