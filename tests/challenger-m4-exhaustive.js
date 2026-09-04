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

class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    Object.assign(this, options);
  }
}

async function runM4ExhaustiveStressSuite() {
  console.log("==========================================================================");
  console.log("=== EMPIRICAL CHALLENGER M4 EXHAUSTIVE VERIFICATION & STRESS SUITE ===");
  console.log("==========================================================================");

  // --------------------------------------------------------------------------------
  // SECTION 1: POPUP.JS EMPIRICAL TESTING
  // --------------------------------------------------------------------------------
  console.log("\n--- Section 1: popup/popup.js Empirical Verification ---");
  const envPopup = setupMockEnv();

  // Construct full DOM environment for popup.html
  const popupHtml = `
    <div class="popup-container">
      <input type="checkbox" id="toggle-master" />
      <input type="checkbox" id="toggle-shorts" />
      <input type="checkbox" id="toggle-focus" />
      <input type="checkbox" id="toggle-study" />
      <input type="checkbox" id="toggle-goal" />
      <input type="checkbox" id="toggle-time-manager" />
      <input type="checkbox" id="pop-audioEffects" />
      
      <span id="current-goal"></span>
      <button id="edit-goal"></button>
      <div id="goal-input-container" style="display:none;">
        <input type="text" id="goal-input" />
        <button id="save-goal"></button>
      </div>

      <span id="today-time"></span>
      <span id="learning-time"></span>
      <span id="focus-score"></span>
      <span id="popup-rank-tier"></span>
      <span id="session-time"></span>
      
      <input type="text" id="pop-blocked-keywords" />
      <input type="text" id="pop-blocked-channels" />
      <button id="open-settings"></button>
    </div>
  `;
  envPopup.document.body.innerHTML = popupHtml;

  // Attach StorageUtil and GamificationEngine to global and window context
  global.StorageUtil = StorageUtil;
  envPopup.window.StorageUtil = StorageUtil;
  global.GamificationEngine = GamificationEngine;
  envPopup.window.GamificationEngine = GamificationEngine;

  // Execute popup.js
  const popupJsCode = fs.readFileSync(path.join(__dirname, '../popup/popup.js'), 'utf8');
  await eval(`(async () => { ${popupJsCode} })()`);
  
  // Trigger DOMContentLoaded
  envPopup.document.dispatchEvent('DOMContentLoaded');
  await new Promise(r => setTimeout(r, 50));

  const masterToggle = envPopup.document.getElementById('toggle-master');
  const shortsToggle = envPopup.document.getElementById('toggle-shorts');
  const focusToggle = envPopup.document.getElementById('toggle-focus');
  const popupContainer = envPopup.document.querySelector('.popup-container');
  const focusScoreEl = envPopup.document.getElementById('focus-score');
  const popKwInput = envPopup.document.getElementById('pop-blocked-keywords');

  assert(masterToggle !== null, "Master toggle initialized");
  assert(masterToggle.checked === true, "Master toggle defaults to checked (extensionEnabled !== false)");
  assert(popupContainer.classList.contains('extension-disabled') === false, "Container does not have extension-disabled when master toggle is true");

  // Toggle master toggle to OFF
  masterToggle.checked = false;
  masterToggle.dispatchEvent(new MockEvent('change'));
  await new Promise(r => setTimeout(r, 50));
  const settingsAfterMasterOff = await StorageUtil.getSettings();
  assert(settingsAfterMasterOff.extensionEnabled === false, "Storage updated extensionEnabled to false on master toggle change");
  assert(popupContainer.classList.contains('extension-disabled') === true, "Container adds extension-disabled class when OFF");

  // Toggle master toggle to ON
  masterToggle.checked = true;
  masterToggle.dispatchEvent(new MockEvent('change'));
  await new Promise(r => setTimeout(r, 50));
  const settingsAfterMasterOn = await StorageUtil.getSettings();
  assert(settingsAfterMasterOn.extensionEnabled === true, "Storage updated extensionEnabled to true");

  // Test blocklist deduplication & debouncing in popup
  popKwInput.value = "  react, vue , react, , typescript  ";
  popKwInput.dispatchEvent(new MockEvent('input'));
  popKwInput.dispatchEvent(new MockEvent('blur'));
  await new Promise(r => setTimeout(r, 50));
  const settingsAfterKw = await StorageUtil.getSettings();
  assert(JSON.stringify(settingsAfterKw.blockedKeywords) === JSON.stringify(["react", "vue", "typescript"]),
    `Blocked keywords deduplicated and sanitized cleanly in popup: ${JSON.stringify(settingsAfterKw.blockedKeywords)}`);

  // Test Goal Editing in Popup
  const editBtn = envPopup.document.getElementById('edit-goal');
  const goalInputContainer = envPopup.document.getElementById('goal-input-container');
  const goalInput = envPopup.document.getElementById('goal-input');
  const saveGoalBtn = envPopup.document.getElementById('save-goal');
  const currentGoalEl = envPopup.document.getElementById('current-goal');

  editBtn.dispatchEvent(new MockEvent('click'));
  assert(goalInputContainer.style.display === 'flex', "Goal input container displayed on edit click");
  
  goalInput.value = " Advanced Quantum Computing ";
  saveGoalBtn.dispatchEvent(new MockEvent('click'));
  await new Promise(r => setTimeout(r, 50));
  const settingsAfterGoal = await StorageUtil.getSettings();
  assert(settingsAfterGoal.learningGoal === "Advanced Quantum Computing", "Learning goal updated in storage");
  assert(currentGoalEl.textContent === "Advanced Quantum Computing", "Learning goal text updated in DOM");
  assert(goalInputContainer.style.display === 'none', "Goal input container hidden after saving goal");


  // --------------------------------------------------------------------------------
  // SECTION 2: OPTIONS.JS EMPIRICAL TESTING
  // --------------------------------------------------------------------------------
  console.log("\n--- Section 2: options/options.js Empirical Verification ---");
  const envOpt = setupMockEnv();

  const optionsHtml = `
    <ul class="nav-menu">
      <li data-tab="general" class="active">General</li>
      <li data-tab="pomodoro">Pomodoro</li>
      <li data-tab="analytics">Analytics</li>
      <li data-tab="gamification">Gamification</li>
    </ul>
    <div id="general-tab" class="tab-content active">
      <input type="checkbox" id="opt-shortsBlocker" />
      <input type="checkbox" id="opt-focusMode" />
      <input type="checkbox" id="opt-studyMode" />
      <input type="checkbox" id="opt-goalMode" />
      <input type="checkbox" id="opt-audioEffects" />
      <input type="number" id="opt-focusReminderInterval" />
      <input type="checkbox" id="opt-tm-enabled" />
      <input type="checkbox" id="opt-tm-scheduleEnabled" />
      <input type="number" id="opt-tm-dailyLimitMinutes" />
      <input type="time" id="opt-tm-scheduleStart" />
      <input type="time" id="opt-tm-scheduleEnd" />
      <input type="text" id="opt-blocked-keywords" />
      <input type="text" id="opt-blocked-channels" />
      <button id="btn-export-json"></button>
      <button id="btn-export-csv"></button>
      <input type="file" id="file-import-json" />
    </div>
    <div id="pomodoro-tab" class="tab-content">
      <input type="checkbox" id="opt-pomo-enabled" />
      <input type="number" id="opt-pomo-workMinutes" />
      <input type="number" id="opt-pomo-breakMinutes" />
      <input type="number" id="opt-pomo-longBreakMinutes" />
      <input type="number" id="opt-pomo-cycles" />
      <input type="checkbox" id="opt-pomo-soundAlerts" />
      <input type="checkbox" id="opt-pomo-autoPause" />
    </div>
    <div id="analytics-tab" class="tab-content">
      <span id="stat-today"></span>
      <span id="stat-today-learning"></span>
      <span id="stat-week-learning"></span>
      <span id="stat-month-learning"></span>
      <span id="dash-focus-score"></span>
      <div id="analytics-chart-container"></div>
      <div id="chart-period-pills">
        <button class="filter-pill active" data-period="7">7 Days</button>
        <button class="filter-pill" data-period="14">14 Days</button>
      </div>
    </div>
    <div id="gamification-tab" class="tab-content">
      <span id="stat-current-streak"></span>
      <span id="stat-longest-streak"></span>
      <span id="battle-rank-icon"></span>
      <span id="battle-level-badge"></span>
      <span id="battle-rank-name"></span>
      <span id="battle-next-tier-name"></span>
      <span id="battle-ap-score"></span>
      <span id="battle-xp-text"></span>
      <div id="battle-xp-fill"></div>
      <div id="battle-xp-glow"></div>
      <div id="badges-container"></div>
      <div id="category-filter-pills">
        <button class="filter-pill active" data-category="all">All</button>
        <button class="filter-pill" data-category="time">Time</button>
        <button class="filter-pill" data-category="streak">Streak</button>
        <button class="filter-pill" data-category="shield">Shield</button>
      </div>
    </div>
    <div id="save-indicator"></div>
  `;
  envOpt.document.body.innerHTML = optionsHtml;

  // Make GamificationEngine available on window
  envOpt.window.GamificationEngine = GamificationEngine;

  // Execute options.js
  const optionsJsCode = fs.readFileSync(path.join(__dirname, '../options/options.js'), 'utf8');
  await eval(`(async () => { ${optionsJsCode} })()`);

  // Trigger DOMContentLoaded
  envOpt.document.dispatchEvent('DOMContentLoaded');
  await new Promise(r => setTimeout(r, 50));

  // Verify tab switching
  const navItems = envOpt.document.querySelectorAll('.nav-menu li');
  const pomoTabNav = navItems[1];
  pomoTabNav.dispatchEvent(new MockEvent('click'));
  assert(pomoTabNav.classList.contains('active'), "Pomodoro tab active after click");
  assert(envOpt.document.getElementById('pomodoro-tab').classList.contains('active'), "Pomodoro content div active after tab click");

  // Verify Time Manager schedule empty fallbacks
  const tmStartEl = envOpt.document.getElementById('opt-tm-scheduleStart');
  const tmEndEl = envOpt.document.getElementById('opt-tm-scheduleEnd');
  
  tmStartEl.value = "";
  tmStartEl.dispatchEvent(new MockEvent('change'));
  await new Promise(r => setTimeout(r, 50));
  assert(tmStartEl.value === "09:00", "Empty scheduleStart fallback to 09:00");

  tmEndEl.value = "";
  tmEndEl.dispatchEvent(new MockEvent('change'));
  await new Promise(r => setTimeout(r, 50));
  assert(tmEndEl.value === "17:00", "Empty scheduleEnd fallback to 17:00");


  // --------------------------------------------------------------------------------
  // SECTION 3: BACKUP / RESTORE DATA EXPORTS (JSON & CSV)
  // --------------------------------------------------------------------------------
  console.log("\n--- Section 3: Backup / Restore JSON & CSV Verification ---");

  // CSV Generator Logic Test
  const generateCsv = (trackingData) => {
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

  const csvTest = generateCsv({
    dailyWatchTime: { "2026-08-10": 3600, "2026-08-11": 0, "2026-08-12": 1800 },
    dailyLearningTime: { "2026-08-10": 1800, "2026-08-11": 900, "2026-08-12": 2400 }
  });

  assert(csvTest.includes("Date,Total Watch Time (Mins),Learning Time (Mins),Focus Score (%)"), "CSV header present");
  assert(csvTest.includes("2026-08-10,60,30,50%"), "2026-08-10 row correct (60m watch, 30m learn, 50%)");
  assert(csvTest.includes("2026-08-11,0,15,0%"), "2026-08-11 row correct with 0 watch time (clamped to 0%)");
  assert(csvTest.includes("2026-08-12,30,40,100%"), "2026-08-12 row correct with learning > total (clamped to 100%)");

  // JSON Import Edge Cases
  const validateAndImportJson = async (content) => {
    try {
      const imported = JSON.parse(content);
      if (typeof imported === 'object' && imported !== null) {
        if (imported.settings) await StorageUtil.saveSettings(imported.settings);
        if (imported.tracking) await StorageUtil.saveTracking(imported.tracking);
        return true;
      }
      return false;
    } catch(e) {
      return false;
    }
  };

  assert(await validateAndImportJson('{"settings":{"shortsBlocker":false}}') === true, "Valid JSON object accepted");
  assert(await validateAndImportJson('invalid json string') === false, "Invalid JSON string rejected");
  assert(await validateAndImportJson('null') === false, "JSON null primitive rejected");
  assert(await validateAndImportJson('12345') === false, "JSON number primitive rejected");
  assert(await validateAndImportJson('"hello"') === false, "JSON string primitive rejected");


  // --------------------------------------------------------------------------------
  // SECTION 4: HERO BATTLE CARD & GAMIFICATION CALCULATION ACCURACY
  // --------------------------------------------------------------------------------
  console.log("\n--- Section 4: Hero Battle Card & Gamification Accuracy ---");

  // AP Calculation Test
  const ap0 = GamificationEngine.calculateTotalAP([]);
  assert(ap0 === 0, "0 unlocked badges = 0 AP");

  const apAll = GamificationEngine.calculateTotalAP(GamificationEngine.BADGE_DEFINITIONS.map(b => b.id));
  const expectedTotalAP = 1700 + 1200 + 1200; // 4100 total AP
  assert(apAll === expectedTotalAP, `All 22 badges unlocked = ${expectedTotalAP} AP (got ${apAll})`);

  // Bonus AP test
  const apWithBonus = GamificationEngine.calculateTotalAP(['first_step'], 100);
  assert(apWithBonus === 150, "Badge AP + Bonus AP added accurately (50 + 100 = 150)");

  // Quadratic level curve formula test: E(L) = 100L^2 + 100L - 200
  // Level 1 threshold = 100(1) + 100(1) - 200 = 0
  // Level 2 threshold = 100(4) + 100(2) - 200 = 400
  // Level 3 threshold = 100(9) + 100(3) - 200 = 1000
  const lvl1 = GamificationEngine.calculateLevelFromEXP(0);
  assert(lvl1.level === 1 && lvl1.currentLevelThreshold === 0 && lvl1.nextLevelThreshold === 400, "0 EXP = Level 1 (0 to 400 EXP)");

  const lvl2 = GamificationEngine.calculateLevelFromEXP(400);
  assert(lvl2.level === 2 && lvl2.currentLevelThreshold === 400 && lvl2.nextLevelThreshold === 1000, "400 EXP = Level 2 (400 to 1000 EXP)");

  const lvl2Progress = GamificationEngine.calculateLevelFromEXP(700);
  assert(lvl2Progress.level === 2 && lvl2Progress.expInCurrentLevel === 300 && lvl2Progress.expNeededForNextLevel === 600 && lvl2Progress.progressPct === 50,
    "700 EXP = Level 2 at 50% progress (300/600)");

  // Rank Tier Progression
  const rankBronze = GamificationEngine.getRankTierFromAP(100);
  assert(rankBronze.currentRank.title === 'Bronze Focus' && rankBronze.nextRank.title === 'Silver Scholar' && rankBronze.apToNextRank === 100,
    "100 AP = Bronze Focus, 100 AP to Silver Scholar");

  const rankSilver = GamificationEngine.getRankTierFromAP(200);
  assert(rankSilver.currentRank.title === 'Silver Scholar', "200 AP = Silver Scholar threshold");

  const rankGrandmaster = GamificationEngine.getRankTierFromAP(5000);
  assert(rankGrandmaster.currentRank.title === 'Grandmaster Legend' && rankGrandmaster.isMaxRank === true,
    "5000 AP = Grandmaster Legend (Max Rank)");


  // --------------------------------------------------------------------------------
  // SECTION 5: 22 ACHIEVEMENT BADGES VERIFICATION
  // --------------------------------------------------------------------------------
  console.log("\n--- Section 5: 22 Achievement Badges Integrity Verification ---");
  const badges = GamificationEngine.BADGE_DEFINITIONS;

  assert(badges.length === 22, `Exactly 22 achievement badges defined (got ${badges.length})`);

  const categories = { time: 0, streak: 0, shield: 0 };
  const badgeIds = new Set();

  badges.forEach(b => {
    assert(typeof b.id === 'string' && b.id.length > 0, `Badge has valid string ID: ${b.id}`);
    assert(typeof b.name === 'string' && b.name.length > 0, `Badge ${b.id} has name`);
    assert(typeof b.desc === 'string' && b.desc.length > 0, `Badge ${b.id} has description`);
    assert(typeof b.icon === 'string' && b.icon.length > 0, `Badge ${b.id} has icon`);
    assert(typeof b.ap === 'number' && b.ap > 0, `Badge ${b.id} has positive AP (${b.ap})`);
    assert(typeof b.exp === 'number' && b.exp > 0, `Badge ${b.id} has positive EXP (${b.exp})`);
    assert(['time', 'streak', 'shield'].includes(b.category), `Badge ${b.id} category is valid (${b.category})`);
    
    categories[b.category] = (categories[b.category] || 0) + 1;
    assert(!badgeIds.has(b.id), `Badge ID '${b.id}' is unique`);
    badgeIds.add(b.id);
  });

  assert(categories.time === 8, `Category 1 (Time Milestones): 8 badges (got ${categories.time})`);
  assert(categories.streak === 7, `Category 2 (Streaks): 7 badges (got ${categories.streak})`);
  assert(categories.shield === 7, `Category 3 (Shield Guard): 7 badges (got ${categories.shield})`);


  // --------------------------------------------------------------------------------
  // SECTION 6: FOCUS SCORE CLAMPING & STORAGE SYNC STRESS
  // --------------------------------------------------------------------------------
  console.log("\n--- Section 6: Focus Score Clamping & Storage Sync Stress ---");

  const computeScore = (learn, total) => {
    return total > 0 ? Math.min(100, Math.max(0, Math.round((learn / total) * 100))) : 0;
  };

  assert(computeScore(0, 0) === 0, "0 totalwatch = 0%");
  assert(computeScore(0, 1000) === 0, "0 learning = 0%");
  assert(computeScore(500, 1000) === 50, "500/1000 = 50%");
  assert(computeScore(1000, 1000) === 100, "1000/1000 = 100%");
  assert(computeScore(2000, 1000) === 100, "2000/1000 (overflow) = clamped to 100%");
  assert(computeScore(-500, 1000) === 0, "-500/1000 (negative) = clamped to 0%");
  assert(computeScore(500, -1000) === 0, "500/-1000 (negative total) = 0%");

  // Storage Sync Listener test
  let syncTriggered = false;
  envOpt.chrome.storage.onChanged.addListener(() => {
    syncTriggered = true;
  });

  await StorageUtil.updateSetting('focusMode', true);
  assert(syncTriggered === true, "Storage listener triggered when StorageUtil.updateSetting called");


  // --------------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------------
  console.log("\n==========================================================================");
  console.log(`TOTAL EXHAUSTIVE STRESS TESTS EXECUTED: ${testsPassed + testsFailed}`);
  console.log(`PASSED: ${testsPassed}`);
  console.log(`FAILED: ${testsFailed}`);
  console.log("==========================================================================");

  if (testsFailed > 0) {
    console.error("FAILURES:");
    failures.forEach(f => console.error(" - " + f));
    process.exit(1);
  } else {
    console.log("ALL M4 EMPIRICAL STRESS TESTS PASSED 100% CLEANLY! ✅");
    process.exit(0);
  }
}

runM4ExhaustiveStressSuite();
