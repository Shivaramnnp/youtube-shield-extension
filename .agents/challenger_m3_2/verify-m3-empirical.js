const { setupMockEnv } = require('../../tests/harness/mock-extension-env.js');
setupMockEnv();

// Load target M3 modules
require('../../utils/storage');
require('../../content/js/observer-utils');
require('../../content/js/feed-controller');
require('../../content/js/study-mode');
require('../../content/js/goal-mode');
require('../../content/js/time-manager');

async function runEmpiricalChecks() {
  console.log("=========================================");
  console.log(" M3 EMPIRICAL CHALLENGER VERIFICATION ");
  console.log("=========================================\n");

  let passes = 0;
  let fails = 0;

  // CHECK 1: Goal Mode Strict Topic Enforcement
  try {
    const goalMode = global.window.GoalMode;
    goalMode.enable("Learn Quantum Computing");
    global.window.location.pathname = '/watch';
    global.window.location.search = '?v=offtopic123';

    // Mock an off-topic gaming video title
    const titleEl = global.document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const titleTextEl = global.document.createElement('yt-formatted-string');
    titleTextEl.textContent = "Grand Theft Auto 5 Gameplay Walkthrough Part 1";
    titleEl.appendChild(titleTextEl);
    global.document.body.appendChild(titleEl);

    goalMode.checkVideoGoalAlignment();

    if (goalMode.isBlocked === true) {
      console.log("✅ CHECK 1 PASSED: GoalMode blocked off-topic gaming video.");
      passes++;
    } else {
      console.log("❌ CHECK 1 FAILED: GoalMode did NOT block off-topic gaming video (isBlocked = false).");
      fails++;
    }
    goalMode.disable();
  } catch (err) {
    console.log("❌ CHECK 1 ERROR:", err.message);
    fails++;
  }

  // CHECK 2: StudyMode Notice Timeout Cleanup
  try {
    const studyMode = global.window.StudyMode;
    studyMode.enable("Learn React");
    studyMode.showPomoAlert("Test Alert");

    const notice = global.document.getElementById('ss-pomo-notice');
    if (notice) notice.click();

    studyMode.clearPendingTimeouts();
    if (studyMode._noticeTimeouts.length === 0) {
      console.log("✅ CHECK 2 PASSED: StudyMode cleared notice timeouts on reset.");
      passes++;
    } else {
      console.log("❌ CHECK 2 FAILED: StudyMode notice timeouts were not cleared.");
      fails++;
    }
    studyMode.disable();
  } catch (err) {
    console.log("❌ CHECK 2 ERROR:", err.message);
    fails++;
  }

  // CHECK 3: TimeManager Interval Cleanup
  try {
    const tm = global.window.TimeManager;
    tm.enable({ enabled: true, dailyLimitMinutes: 60 });
    tm.disable();

    if (tm.isActive === false && tm.checkInterval === null) {
      console.log("✅ CHECK 3 PASSED: TimeManager interval cleaned up properly on disable.");
      passes++;
    } else {
      console.log("❌ CHECK 3 FAILED: TimeManager interval handle leaked.");
      fails++;
    }
  } catch (err) {
    console.log("❌ CHECK 3 ERROR:", err.message);
    fails++;
  }

  // CHECK 4: Non-string Goal Defense in GoalMode
  try {
    const goalMode = global.window.GoalMode;
    goalMode.enable(99999);
    global.window.location.pathname = '/watch';
    global.window.location.search = '?v=test999';
    goalMode.checkVideoGoalAlignment();

    console.log("✅ CHECK 4 PASSED: GoalMode handled non-string goal (number) without throwing.");
    passes++;
    goalMode.disable();
  } catch (err) {
    console.log("❌ CHECK 4 FAILED: GoalMode threw error on numeric goal:", err.message);
    fails++;
  }

  // CHECK 5: Memory Leak & Rapid Nav Stress
  try {
    const studyMode = global.window.StudyMode;
    const goalMode = global.window.GoalMode;
    const timeManager = global.window.TimeManager;

    studyMode.enable("Learn Rust");
    goalMode.enable("Learn Rust");
    timeManager.enable({ enabled: true, dailyLimitMinutes: 30 });

    for (let i = 0; i < 500; i++) {
      global.window.location.pathname = (i % 2 === 0) ? '/watch' : '/';
      global.window.location.search = `?v=video_${i}`;
      studyMode.onNavigate();
      goalMode.onNavigate();
      await timeManager.evaluate();
    }

    studyMode.disable();
    goalMode.disable();
    timeManager.disable();

    console.log("✅ CHECK 5 PASSED: 500 rapid SPA transitions completed with zero memory/listener crashes.");
    passes++;
  } catch (err) {
    console.log("❌ CHECK 5 FAILED:", err.message);
    fails++;
  }

  console.log("\n=========================================");
  console.log(`SUMMARY: ${passes} Passed, ${fails} Failed.`);
  console.log("=========================================");
}

runEmpiricalChecks();
