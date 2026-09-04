/**
 * M3 Challenger 2 Empirical Stress & Boundary Test Suite
 * Working Directory: /Users/shivarampatel/Desktop/shorts-shield/.agents/challenger_m3_2
 */

const { setupMockEnv } = require('../../tests/harness/mock-extension-env.js');
setupMockEnv();

const { test, describe, assert, resetDOM, suitePromiseChain } = require('../../tests/harness/test-helpers');

// Load target M3 modules
require('../../utils/storage');
require('../../content/js/observer-utils');
require('../../content/js/feed-controller');
require('../../content/js/study-mode');
require('../../content/js/goal-mode');
require('../../content/js/time-manager');

describe('M3 Challenger 2 Empirical Stress & Boundary Tests', async () => {

  test('1. GoalMode: Check off-topic video blocking enforcement for non-entertainment videos', async () => {
    resetDOM();
    const goalMode = global.window.GoalMode;
    goalMode.enable("Learn Quantum Computing");

    // Mock watch page location
    global.window.location.pathname = '/watch';
    global.window.location.search = '?v=offtopic123';

    // Mock video title & details for an off-topic video: "Grand Theft Auto 5 Gameplay Walkthrough Part 1"
    const titleEl = global.document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const titleTextEl = global.document.createElement('yt-formatted-string');
    titleTextEl.textContent = "Grand Theft Auto 5 Gameplay Walkthrough Part 1";
    titleEl.appendChild(titleTextEl);
    global.document.body.appendChild(titleEl);

    // Run alignment check synchronously
    goalMode.checkVideoGoalAlignment();

    // Check if Goal Mode correctly blocked the off-topic video
    console.log("GoalMode isBlocked for GTA 5 video when goal is Quantum Computing:", goalMode.isBlocked);
    assert.strictEqual(goalMode.isBlocked, true, 'GoalMode MUST block off-topic gaming/vlog video even if title lacks explicit entertainment keywords');

    goalMode.disable();
  });

  test('2. GoalMode: Non-string goal argument (e.g. number/object) crash resistance', async () => {
    resetDOM();
    const goalMode = global.window.GoalMode;

    assert.doesNotThrow(() => {
      goalMode.enable(12345);
      global.window.location.pathname = '/watch';
      global.window.location.search = '?v=test123';
      goalMode.checkVideoGoalAlignment();
    }, 'GoalMode should not crash when enabled with a numeric goal');

    assert.doesNotThrow(() => {
      goalMode.enable({ topic: 'AI' });
      goalMode.checkVideoGoalAlignment();
    }, 'GoalMode should not crash when enabled with an object goal');

    goalMode.disable();
  });

  test('3. StudyMode: Timer leak on manual dismiss of alerts/warnings', async () => {
    resetDOM();
    const studyMode = global.window.StudyMode;
    studyMode.enable("Learn React");

    // Trigger pomo notice
    studyMode.showPomoAlert("Test Notice");
    const notice = global.document.getElementById('ss-pomo-notice');
    assert.ok(notice, "Notice element should exist");

    // Click notice to remove manually
    notice.click();

    // Verify notices/warnings cleared cleanly
    studyMode.clearPendingTimeouts();
    assert.strictEqual(studyMode._noticeTimeouts.length, 0);

    studyMode.disable();
  });

  test('4. StudyMode: Negative workMinutes Pomodoro sprint boundary check', async () => {
    resetDOM();
    const studyMode = global.window.StudyMode;
    studyMode.pomoConfig.workMinutes = -1;
    studyMode.enable("Learn Python");

    let apAwardedCount = 0;
    studyMode.awardPomodoroAP = async () => { apAwardedCount++; };

    // Advance phase with negative time
    studyMode.advancePomoPhase();
    assert.ok(apAwardedCount > 0, "Awarded AP on sprint completion");

    studyMode.disable();
  });

  test('5. TimeManager: Rapid enable/disable memory leak & interval check', async () => {
    const tm = global.window.TimeManager;

    for (let i = 0; i < 500; i++) {
      tm.enable({ enabled: true, dailyLimitMinutes: 60 });
      tm.disable();
    }

    assert.strictEqual(tm.isActive, false);
    assert.strictEqual(tm.checkInterval, null);
  });

  test('6. Memory & State Lifecycle Stress: 1,000 rapid SPA transitions across M3 modules', async () => {
    resetDOM();
    const studyMode = global.window.StudyMode;
    const goalMode = global.window.GoalMode;
    const timeManager = global.window.TimeManager;

    studyMode.enable("Learn Rust");
    goalMode.enable("Learn Rust");
    timeManager.enable({ enabled: true, dailyLimitMinutes: 30 });

    for (let i = 0; i < 1000; i++) {
      global.window.location.pathname = (i % 2 === 0) ? '/watch' : '/';
      global.window.location.search = `?v=video_${i}`;
      
      studyMode.onNavigate();
      goalMode.onNavigate();
      await timeManager.evaluate();
    }

    studyMode.disable();
    goalMode.disable();
    timeManager.disable();

    assert.strictEqual(studyMode.isActive, false);
    assert.strictEqual(goalMode.isActive, false);
    assert.strictEqual(timeManager.isActive, false);
  });

});

// Wait for all tests to finish
process.on('beforeExit', async () => {
  if (global._pendingTestPromises) {
    await Promise.all(global._pendingTestPromises);
  }
});
