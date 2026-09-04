/**
 * Empirical Stress Testing Suite by Challenger 2 (challenger_final_2)
 * Audits:
 * 1. YouTube DOM mutations and Shorts Blocker redirection.
 * 2. Study Mode & Goal Mode keyword extraction and play locking.
 * 3. Daily watch limit calculation and emergency snooze.
 */

const path = require('path');
const { setupMockEnv } = require('./harness/mock-extension-env');

async function runEmpiricalStressHarness() {
  console.log("================================================================");
  console.log("     CHALLENGER 2 - EMPIRICAL STRESS HARNESS EXECUTION          ");
  console.log("================================================================");

  // Setup DOM & Chrome MV3 environment
  const mockEnv = setupMockEnv();
  
  // Require modules in order
  require('../utils/dom-utils');
  require('../content/js/observer-utils');
  require('../utils/storage');
  require('../utils/gamification-engine');
  require('../content/js/shorts-blocker');
  require('../content/js/feed-controller');
  require('../content/js/study-mode');
  require('../content/js/goal-mode');
  require('../content/js/time-manager');

  let passed = 0;
  let failed = 0;
  const failures = [];

  function assert(condition, message) {
    if (condition) {
      passed++;
      console.log(`  ✓ [PASS] ${message}`);
    } else {
      failed++;
      failures.push(message);
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  console.log("\n--- Suite 1: YouTube DOM Mutations & Shorts Blocker Redirection ---");
  
  // 1.1 Regex matching on Shorts URLs
  const sb = window.ShortsBlocker;
  sb.enable();
  
  const testUrls = [
    { url: 'https://www.youtube.com/shorts/abc12345', shouldRedirect: true },
    { url: 'https://www.youtube.com/playables/game123', shouldRedirect: true },
    { url: 'https://www.youtube.com/watch?v=normal_vid', shouldRedirect: false },
    { url: 'https://www.youtube.com/feed/subscriptions', shouldRedirect: false },
    { url: 'https://www.youtube.com/shorts?v=67890', shouldRedirect: true }
  ];

  for (const item of testUrls) {
    window.location.href = item.url;
    let redirected = false;
    window.location.replace = (newUrl) => { redirected = (newUrl === 'https://www.youtube.com/'); };
    window.history.replaceState = (data, title, newUrl) => { if (newUrl === 'https://www.youtube.com/') redirected = true; };
    
    sb.checkAndRedirectShortsURL();
    assert(redirected === item.shouldRedirect, `Shorts Blocker URL redirect check for ${item.url} (Expected redirect: ${item.shouldRedirect}, Actual: ${redirected})`);
  }

  // 1.2 History API patching & unpatching
  const origPushState = window.history.pushState;
  sb.patchHistoryAPI();
  assert(sb.historyPatched === true, "History API patched successfully");
  sb.unpatchHistoryAPI();
  assert(sb.historyPatched === false, "History API unpatched successfully");

  // Ensure ShortsBlocker is disabled before setting up test 1.3 DOM elements
  sb.disable();

  // 1.3 DOM mutation shelf hiding
  const shelfContainer = document.createElement('ytd-rich-section-renderer');
  shelfContainer.id = 'shelf-1';
  const shortsLink = document.createElement('a');
  shortsLink.setAttribute('href', '/shorts/12345');
  shortsLink.setAttribute('title', 'Shorts');
  shelfContainer.appendChild(shortsLink);
  document.body.appendChild(shelfContainer);

  sb.enable();
  assert(document.querySelector('a[href*="shorts"]') !== null, "Shorts link present in DOM");
  assert(document.getElementById('shelf-1') !== null, "Shelf container present in DOM");
  
  const isHidden = shelfContainer.style.display === 'none' || shortsLink.style.display === 'none';
  assert(isHidden, "Shorts parent shelf container or link styled with display: none");

  sb.disable();
  assert(sb.isActive === false, "ShortsBlocker disabled successfully");

  console.log("\n--- Suite 2: Study Mode & Goal Mode Keyword Extraction & Play Locking ---");

  // 2.1 Keyword extraction
  const gm = window.GoalMode;
  const technicalKw = gm.extractGoalKeywords("Master C++ Programming and UI/UX Design");
  assert(technicalKw.includes("cplusplus"), "GoalMode extracted C++ as 'cplusplus'");
  assert(technicalKw.includes("uiux"), "GoalMode extracted UI/UX as 'uiux'");
  assert(technicalKw.includes("programming"), "GoalMode extracted 'programming'");
  assert(technicalKw.includes("design"), "GoalMode extracted 'design'");

  // Short word boundary matching (e.g., 'js' vs 'json')
  assert(gm.isKeywordMatch("learn js from scratch", "js") === true, "Boundary match for 'js' in 'learn js from scratch'");
  assert(gm.isKeywordMatch("working with json format", "js") === false, "Boundary match for 'js' in 'working with json format' returns false");

  // 2.2 Play locking & Allow Once bypass
  // Properly set location pathname and search
  window.location.pathname = '/watch';
  window.location.search = '?v=cat_video_123';
  window.location.href = 'https://www.youtube.com/watch?v=cat_video_123';

  // Build video element and watch title metadata elements
  const titleContainer = document.createElement('h1');
  titleContainer.className = 'ytd-watch-metadata';
  const titleTextNode = document.createElement('yt-formatted-string');
  titleTextNode.textContent = 'Funny Cat Clips 2026';
  titleContainer.appendChild(titleTextNode);
  document.body.appendChild(titleContainer);

  const videoEl = document.createElement('video');
  videoEl.id = 'main-video';
  document.body.appendChild(videoEl);

  gm.enable("Quantum Physics Tutorial");
  gm.checkVideoGoalAlignment();
  
  assert(gm.isBlocked === true, "GoalMode blocked off-topic video ('Funny Cat Clips' for goal 'Quantum Physics')");
  
  let pauseCalled = false;
  videoEl.pause = () => { pauseCalled = true; };
  
  // Simulate user pressing play on video
  videoEl.dispatchEvent('play');
  assert(pauseCalled === true, "GoalMode play lock paused off-topic video execution");

  // Bypass via Allow Once
  gm.allowCurrentVideoOnce();
  assert(gm.isBlocked === false, "GoalMode unblocked video after allowCurrentVideoOnce()");
  assert(document.getElementById('ss-goal-block-overlay') === null, "GoalMode overlay removed after allowCurrentVideoOnce()");

  gm.disable();

  // 2.3 StudyMode Pomodoro state machine & AP awards
  const sm = window.StudyMode;
  sm.enable("Data Structures");
  assert(sm.isActive === true, "StudyMode enabled");
  assert(sm.pomoState === 'FOCUS', "Pomodoro initial state is FOCUS");

  // Setup storage with initial tracking
  const initialAP = 50;
  await StorageUtil.saveTracking({ gamification: { totalAP: initialAP, bonusAP: 0, level: 1 } });
  
  sm.advancePomoPhase();
  await sm.awardPomodoroAP(); // wait for async AP award save
  assert(sm.pomoState === 'BREAK', "Pomodoro state advanced to BREAK after 1st Focus sprint");
  assert(sm.pomoTotalCompleted === 1, "Completed Pomodoro sprints count = 1");
  
  // Verify awarded AP in storage
  const trackingData = await StorageUtil.getTracking();
  assert(trackingData.gamification.totalAP === initialAP + 10, "Awarded 10 AP for completing Pomodoro sprint");

  sm.disable();

  console.log("\n--- Suite 3: Daily Watch Limit Calculation & Emergency Snooze ---");

  const tm = window.TimeManager;
  
  // 3.1 Date key generation
  const localKey = tm.getLocalDateKey();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  assert(dateRegex.test(localKey), `getLocalDateKey() generated valid YYYY-MM-DD format: ${localKey}`);

  // 3.2 Daily limit calculation
  tm.enable({ enabled: true, dailyLimitMinutes: 60 });
  
  // Case A: Below limit (55 min = 3300 sec)
  await StorageUtil.saveTracking({ dailyWatchTime: { [localKey]: 3300 } });
  await tm.evaluate();
  assert(document.getElementById('ss-time-manager-overlay') === null, "TimeManager overlay NOT shown when watch time (55m) is below limit (60m)");

  // Case B: At limit (60 min = 3600 sec)
  await StorageUtil.saveTracking({ dailyWatchTime: { [localKey]: 3600 } });
  await tm.evaluate();
  assert(document.getElementById('ss-time-manager-overlay') !== null, "TimeManager overlay SHOWN when watch time (60m) reaches daily limit (60m)");

  // 3.3 Emergency Snooze extension
  const snoozeUntil = Date.now() + 300000; // 5 min from now
  tm.config.snoozeUntil = snoozeUntil;
  await tm.evaluate();
  assert(document.getElementById('ss-time-manager-overlay') === null, "TimeManager overlay REMOVED while emergency snooze is active");

  // Clear snooze
  tm.config.snoozeUntil = 0;
  await tm.evaluate();
  assert(document.getElementById('ss-time-manager-overlay') !== null, "TimeManager overlay RESUMED after snooze expires");

  tm.disable();

  // 3.4 Schedule block logic
  tm.config = {
    enabled: true,
    dailyLimitMinutes: 0,
    scheduleEnabled: true,
    scheduleStart: "00:00",
    scheduleEnd: "23:59"
  };
  assert(tm.isScheduleBlocked() === true, "Schedule block active for 00:00-23:59 all-day schedule");

  console.log("\n================================================================");
  console.log(` EMPIRICAL HARNESS RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================");

  if (failed > 0) {
    console.error("Failures:");
    failures.forEach((f, i) => console.error(`  ${i+1}. ${f}`));
    process.exit(1);
  } else {
    console.log("✅ ALL EMPIRICAL STRESS TESTS PASSED CLEANLY!");
  }
}

if (require.main === module) {
  runEmpiricalStressHarness().catch(err => {
    console.error("Fatal error in empirical harness:", err);
    process.exit(1);
  });
}

module.exports = { runEmpiricalStressHarness };
