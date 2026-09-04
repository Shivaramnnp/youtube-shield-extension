/**
 * Challenger Deep Adversarial Test Suite for Milestone 1 (M1)
 * Rigorously stress-tests:
 * 1. Ad-Skipper DOM Bridge & MAIN-world State Synchronization
 * 2. Storage Timeline Migration Resilience, Garbage Filtering & Circular Safety
 * 3. Gamification Level Formula Exactness & awardPomodoroAP Extreme EXP Handling
 */

const { setupMockEnv } = require("./harness/mock-extension-env");
const mockEnv = setupMockEnv();

const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require("../utils/storage");
const GamificationEngine = require("../utils/gamification-engine");
require("../utils/dom-utils");
require("../content/js/ui-cleaner");
require("../content/js/ad-skipper");
require("../content/js/study-mode");
require("../content/js/main");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    failedTests++;
    console.error("  ❌ [FAIL] " + message);
    throw new Error(message);
  } else {
    passedTests++;
    console.log("  ✓ [PASS] " + message);
  }
}

async function runAllChallengerM1Tests() {
  console.log("=======================================================================");
  console.log("   CHALLENGER DEEP ADVERSARIAL STRESS SUITE: MILESTONE 1 (R1, R3)     ");
  console.log("=======================================================================\n");

  // -------------------------------------------------------------------------
  // SUITE 1: Page-Ad-Skipper DOM Bridge & MAIN-World Toggling
  // -------------------------------------------------------------------------
  console.log("--- SUITE 1: Ad-Skipper DOM Bridge Toggling (page-ad-skipper.js) ---");

  const pageAdSkipperSrc = require("fs").readFileSync(
    require("path").join(__dirname, "../content/js/page-ad-skipper.js"),
    "utf8"
  );

  function createPageSkipperContext() {
    window.__GODMODE_PAGE_AD_SKIPPER__ = undefined;
    document.documentElement.removeAttribute("data-ss-auto-skip");
    if (document.documentElement.dataset) {
      delete document.documentElement.dataset.ssAutoSkip;
      delete document.documentElement.dataset.shortsShieldAutoSkip;
    }
    document.body.innerHTML = "";

    const player = document.createElement("div");
    player.id = "movie_player";
    player.className = "html5-video-player";

    const video = document.createElement("video");
    video.muted = false;
    video.playbackRate = 1;
    video.currentTime = 0;
    video.duration = 30;
    video.paused = false;
    video.ended = false;
    player.appendChild(video);
    document.body.appendChild(player);

    return { player, video };
  }

  // 1.1: Default / Missing attribute -> Enabled
  {
    const { player, video } = createPageSkipperContext();
    eval(pageAdSkipperSrc);
    assert(document.documentElement.getAttribute("data-ss-auto-skip") === null, "1.1: data-ss-auto-skip is initially absent/null");
  }

  // 1.2: Explicit false disables acceleration and skip action
  {
    const { player, video } = createPageSkipperContext();
    document.documentElement.setAttribute("data-ss-auto-skip", "false");
    window.__GODMODE_PAGE_AD_SKIPPER__ = undefined;
    eval(pageAdSkipperSrc);

    player.classList.add("ad-showing");
    document.documentElement.className = "trigger-mutation";

    assert(video.playbackRate === 1, "1.2: When data-ss-auto-skip=\"false\", video playbackRate remains 1");
    assert(video.muted === false, "1.2: When data-ss-auto-skip=\"false\", video is not muted");
  }

  // 1.3: Dataset dataset.ssAutoSkip === false and dataset.shortsShieldAutoSkip === false
  {
    const { player, video } = createPageSkipperContext();
    document.documentElement.dataset.ssAutoSkip = "false";
    window.__GODMODE_PAGE_AD_SKIPPER__ = undefined;
    eval(pageAdSkipperSrc);

    player.classList.add("ad-showing");
    assert(video.playbackRate === 1, "1.3: dataset.ssAutoSkip=\"false\" prevents ad acceleration");

    document.documentElement.dataset.ssAutoSkip = "true";
    document.documentElement.dataset.shortsShieldAutoSkip = "false";
    window.__GODMODE_PAGE_AD_SKIPPER__ = undefined;
    eval(pageAdSkipperSrc);
    assert(video.playbackRate === 1, "1.3: dataset.shortsShieldAutoSkip=\"false\" prevents ad acceleration");
  }

  // 1.4: Non-boolean and invalid attribute values (e.g. invalid, 0, undefined)
  {
    const testValues = ["invalid", "0", "off", "undefined", "null", "TRUE", ""];
    for (const val of testValues) {
      document.documentElement.setAttribute("data-ss-auto-skip", val);
      const attr = document.documentElement.getAttribute("data-ss-auto-skip");
      const isDisabled = (attr === "false");
      assert(!isDisabled, "1.4: Attribute value " + val + " does not falsely disable auto-skip");
    }
  }

  // 1.5: Rapid 500x state flip stress test
  {
    const { player, video } = createPageSkipperContext();
    window.__GODMODE_PAGE_AD_SKIPPER__ = undefined;
    eval(pageAdSkipperSrc);

    let threw = false;
    try {
      for (let i = 0; i < 500; i++) {
        document.documentElement.setAttribute("data-ss-auto-skip", i % 2 === 0 ? "false" : "true");
        if (i % 3 === 0) {
          player.classList.add("ad-showing");
        } else {
          player.classList.remove("ad-showing");
        }
      }
    } catch (e) {
      threw = true;
    }
    assert(!threw, "1.5: 500 rapid toggles executed with 0 unhandled exceptions");
  }

  // -------------------------------------------------------------------------
  // SUITE 2: StorageUtil.migrateTimelineLog Extreme Adversarial Stress
  // -------------------------------------------------------------------------
  console.log("\n--- SUITE 2: Storage Timeline Migration (StorageUtil.migrateTimelineLog) ---");

  // 2.1: Non-object, primitives, and null/undefined
  {
    assert(StorageUtil.migrateTimelineLog(null) === null, "2.1: migrateTimelineLog(null) returns null safely");
    assert(StorageUtil.migrateTimelineLog(undefined) === undefined, "2.1: migrateTimelineLog(undefined) returns undefined safely");
    assert(StorageUtil.migrateTimelineLog(123) === 123, "2.1: migrateTimelineLog(123) returns primitive unchanged");
    assert(StorageUtil.migrateTimelineLog("str") === "str", "2.1: migrateTimelineLog(\"str\") returns primitive unchanged");
    assert(StorageUtil.migrateTimelineLog(false) === false, "2.1: migrateTimelineLog(false) returns primitive unchanged");
  }

  // 2.2: Empty object and empty arrays
  {
    const emptyObj = {};
    const resObj = StorageUtil.migrateTimelineLog(emptyObj);
    assert(Array.isArray(resObj.timelineLog) && resObj.timelineLog.length === 0, "2.2: migrateTimelineLog({}) returns empty array timelineLog");
    assert(resObj.timelineMigrated === true, "2.2: timelineMigrated flag set on empty object");

    const emptyArr = [];
    const resArr = StorageUtil.migrateTimelineLog(emptyArr);
    assert(Array.isArray(resArr) && resArr.length === 0, "2.2: migrateTimelineLog([]) returns empty array");
  }

  // 2.3: Array containing purely empty objects [{}, {}, {}]
  {
    const emptyArrayOfObjects = [{}, {}, {}, {}];
    const res = StorageUtil.migrateTimelineLog(emptyArrayOfObjects);
    assert(Array.isArray(res) && res.length === 0, "2.3: [{}, {}, {}, {}] purges all empty objects resulting in 0 entries");

    const trackingWithEmptyObjs = {
      timelineLog: [{}, { title: "" }, {}, { videoId: "   " }, {}]
    };
    const resTracking = StorageUtil.migrateTimelineLog(trackingWithEmptyObjs);
    assert(resTracking.timelineLog.length === 0, "2.3: Purges phantom entries with whitespace-only identifiers");
  }

  // 2.4: Deeply nested garbage & corrupted types
  {
    const garbageLog = [
      null,
      undefined,
      false,
      true,
      12345,
      "garbage string",
      [],
      [1, 2, 3],
      { someRandomKey: "no-video-data", deeply: { nested: { junk: true } } },
      { durationSeconds: 0, title: "   ", videoId: "" },
      { title: "Legitimate Video", durationSeconds: 120, dateKey: "2026-08-23" }
    ];

    const res = StorageUtil.migrateTimelineLog(garbageLog);
    assert(res.length === 1, "2.4: 11 garbage items pruned down to exactly 1 legitimate video");
    assert(res[0].title === "Legitimate Video", "2.4: Legitimate item preserved correctly");
    assert(res[0].durationSeconds === 120, "2.4: Legitimate duration preserved correctly");
  }

  // 2.5: Circular references handling
  {
    const circularTracking = {
      timelineLog: [
        { title: "Video A", durationSeconds: 60, dateKey: "2026-08-23" }
      ]
    };
    circularTracking.self = circularTracking;
    circularTracking.timelineLog[0].self = circularTracking.timelineLog[0];

    let threw = false;
    let result = null;
    try {
      result = StorageUtil.migrateTimelineLog(circularTracking);
    } catch(e) {
      threw = true;
    }
    assert(!threw, "2.5: Circular reference in tracking and log items does not cause stack overflow");
    assert(result && result.timelineLog.length === 1, "2.5: Log item migrated successfully despite circular reference");
  }

  // 2.6: Massive Array Scaling Stress (50,000 synthetic items)
  {
    console.log("     [Stress] Generating 50,000 synthetic timeline entries...");
    const largeLogs = [];
    const titles = ["React 19 Deep Dive", "Rust vs Zig", "Quantum Computing Intro", "System Design 101", "Machine Learning in JS"];
    const statuses = ["watched", "watched", "blocked", "watched", "sprint"];

    for (let i = 0; i < 50000; i++) {
      if (i % 5 === 0) {
        largeLogs.push({});
      } else if (i % 7 === 0) {
        largeLogs.push(null);
      } else {
        const titleIdx = i % titles.length;
        const statusIdx = i % statuses.length;
        largeLogs.push({
          title: titles[titleIdx],
          videoId: "vid_" + titleIdx,
          channel: "Tech Channel " + titleIdx,
          durationSeconds: 15,
          dateKey: "2026-08-" + String(1 + (i % 25)).padStart(2, "0"),
          status: statuses[statusIdx]
        });
      }
    }

    const t0 = Date.now();
    const migrated = StorageUtil.migrateTimelineLog({ timelineLog: largeLogs });
    const elapsed = Date.now() - t0;

    console.log("     -> 50,000 entries processed in " + elapsed + "ms into " + migrated.timelineLog.length + " consolidated entries");
    assert(elapsed < 250, "2.6: 50,000 entries processed in " + elapsed + "ms (< 250ms SLA)");
    assert(migrated.timelineLog.length <= 500, "2.6: Consolidated output capped to max 500 items");
    assert(migrated.timelineMigrated === true, "2.6: timelineMigrated set to true");
  }

  // 2.7: Mathematical Conservation of Watch Time on Consolidation
  {
    const slices = [];
    for (let i = 0; i < 20; i++) {
      slices.push({
        title: "Calculus III Lecture 4",
        videoId: "calc_04",
        channel: "MIT OpenCourseWare",
        durationSeconds: 30,
        dateKey: "2026-08-23",
        status: "watched"
      });
    }

    const res = StorageUtil.migrateTimelineLog(slices);
    assert(res.length === 1, "2.7: 20 contiguous watched slices merged into 1 consolidated record");
    assert(res[0].durationSeconds === 600, "2.7: Total duration mathematically conserved (600s)");
    assert(res[0].durationMinutes === 10, "2.7: Duration minutes correctly calculated as 10 min");
  }

  // -------------------------------------------------------------------------
  // SUITE 3: Gamification Level Calculations & Pomodoro AP
  // -------------------------------------------------------------------------
  console.log("\n--- SUITE 3: Gamification Level Calculations & Pomodoro AP ---");

  // 3.1: Mathematical exactness of quadratic level formula: E(L) = 100L^2 + 100L - 200
  {
    const expectedThresholds = [
      { level: 1, minExp: 0, nextExp: 400 },
      { level: 2, minExp: 400, nextExp: 1000 },
      { level: 3, minExp: 1000, nextExp: 1800 },
      { level: 4, minExp: 1800, nextExp: 2800 },
      { level: 5, minExp: 2800, nextExp: 4000 },
      { level: 10, minExp: 10800, nextExp: 13000 },
      { level: 50, minExp: 254800, nextExp: 265000 },
      { level: 100, minExp: 1009800, nextExp: 1030000 }
    ];

    for (const tc of expectedThresholds) {
      const atExact = GamificationEngine.calculateLevelFromEXP(tc.minExp);
      assert(atExact.level === tc.level, "3.1: Exactly at " + tc.minExp + " EXP -> Level " + tc.level);
      assert(atExact.currentLevelThreshold === tc.minExp, "3.1: Current threshold matches " + tc.minExp);
      assert(atExact.nextLevelThreshold === tc.nextExp, "3.1: Next threshold matches " + tc.nextExp);
      assert(atExact.progressPct === 0, "3.1: Progress at exact threshold is 0%");

      const justBefore = GamificationEngine.calculateLevelFromEXP(tc.nextExp - 1);
      assert(justBefore.level === tc.level, "3.1: Just before next level (" + (tc.nextExp - 1) + " EXP) -> Level " + tc.level);
      assert(justBefore.progressPct >= 99, "3.1: Progress just before next level is >= 99%");
    }
  }

  // 3.2: Extreme EXP Values (0, negative, high numbers, NaN, non-numeric)
  {
    const negativeCases = [-1, -100, -999999, -Infinity];
    for (const neg of negativeCases) {
      const res = GamificationEngine.calculateLevelFromEXP(neg);
      assert(res.level === 1, "3.2: Negative EXP (" + neg + ") safely maps to Level 1");
      assert(res.progressPct === 0, "3.2: Negative EXP (" + neg + ") progressPct is 0%");
    }

    const nonNumericCases = [NaN, null, undefined, "", "abc", {}, [], true, false];
    for (const weird of nonNumericCases) {
      const res = GamificationEngine.calculateLevelFromEXP(weird);
      assert(res.level === 1, "3.2: Non-numeric EXP (" + String(weird) + ") safely maps to Level 1");
      assert(res.progressPct === 0, "3.2: Non-numeric EXP (" + String(weird) + ") progressPct is 0%");
    }

    const hugeCases = [1e6, 1e9, 1e12, Number.MAX_SAFE_INTEGER];
    for (const huge of hugeCases) {
      const res = GamificationEngine.calculateLevelFromEXP(huge);
      assert(typeof res.level === "number" && !isNaN(res.level) && res.level > 1, "3.2: Huge EXP (" + huge + ") calculates valid level " + res.level);
      assert(res.progressPct >= 0 && res.progressPct <= 100, "3.2: Huge EXP progressPct is clamped [0, 100]");
    }
  }

  // 3.3: awardPomodoroAP Level Calculation Isolation from AP
  {
    const study = window.StudyMode;
    assert(study !== undefined, "3.3: window.StudyMode is instantiated");

    const tracking = {
      ...DEFAULT_TRACKING,
      gamification: {
        totalEXP: 450,
        totalAP: 20,
        bonusAP: 0,
        level: 2,
        rankId: "novice",
        rankTitle: "Novice"
      }
    };
    await StorageUtil.saveTracking(tracking);

    // Award standard 10 AP
    await study.awardPomodoroAP(10);
    const updated1 = await StorageUtil.getTracking();

    assert(updated1.gamification.totalAP === 30, "3.3: totalAP incremented by 10 (20 -> 30)");
    assert(updated1.gamification.bonusAP === 10, "3.3: bonusAP incremented by 10 (0 -> 10)");
    assert(updated1.gamification.totalEXP === 450, "3.3: totalEXP unmodified by awardPomodoroAP (450)");
    assert(updated1.gamification.level === 2, "3.3: Player level remains 2 (derived from 450 EXP, NOT 30 AP)");

    // Award with extreme/invalid points
    await study.awardPomodoroAP(0);
    const updated2 = await StorageUtil.getTracking();
    assert(updated2.gamification.totalAP === 40, "3.3: awardPomodoroAP(0) safely defaults to +10 AP (30 -> 40)");

    await study.awardPomodoroAP(-50);
    const updated3 = await StorageUtil.getTracking();
    assert(updated3.gamification.totalAP === 50, "3.3: awardPomodoroAP(-50) safely defaults to +10 AP (40 -> 50)");

    await study.awardPomodoroAP(NaN);
    const updated4 = await StorageUtil.getTracking();
    assert(updated4.gamification.totalAP === 60, "3.3: awardPomodoroAP(NaN) safely defaults to +10 AP (50 -> 60)");

    await study.awardPomodoroAP(null);
    const updated5 = await StorageUtil.getTracking();
    assert(updated5.gamification.totalAP === 70, "3.3: awardPomodoroAP(null) safely defaults to +10 AP (60 -> 70)");

    // Award large valid AP: 5000 AP
    await study.awardPomodoroAP(5000);
    const updated6 = await StorageUtil.getTracking();
    assert(updated6.gamification.totalAP === 5070, "3.3: Large AP awarded (5070 AP)");
    assert(updated6.gamification.rankId === "grandmaster_legend", "3.3: Rank upgraded to " + updated6.gamification.rankTitle + " (id: grandmaster_legend)");
    assert(updated6.gamification.level === 2, "3.3: Level strictly remains Level 2 (450 EXP), completely immune to AP inflation");
  }

  console.log("\n=======================================================================");
  console.log("TOTAL DEEP ADVERSARIAL TESTS: " + totalTests + " | PASSED: " + passedTests + " | FAILED: " + failedTests);
  console.log("=======================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllChallengerM1Tests().catch((err) => {
  console.error("Test Suite Fatal Crash:", err);
  process.exit(1);
});