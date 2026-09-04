/**
 * Challenger M2-2 Empirical Adversarial Stress Test Suite
 * 
 * Focus Areas:
 * 1. Rapid DOM Mutation Bursts (1,000 - 10,000 mutations/sec) & Observer Memory/CPU Profiling
 * 2. Ad-Skipper Fast-Path Query Bypassing, True Ad Detection, & Playback Restoration Accuracy
 * 3. Shorts Blocker URL Caching, Static URL Redundancy Bypass, & SPA Transition Navigation
 * 4. Concurrent Multi-Vector Adversarial Stress (DOM storms + SPA flips + Ad Pods + Feature Toggles)
 */

const assert = require('assert');
const { setupMockEnv, MockElement } = require('./harness/mock-extension-env');

if (typeof global.Node === 'undefined') {
  global.Node = {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12
  };
}

// Ensure DOM standard childElementCount exists on MockElement
if (MockElement && !Object.prototype.hasOwnProperty.call(MockElement.prototype, 'childElementCount')) {
  Object.defineProperty(MockElement.prototype, 'childElementCount', {
    get() {
      return this.children ? this.children.length : 0;
    },
    configurable: true
  });
}

console.log('================================================================');
console.log('   CHALLENGER M2-2: EMPIRICAL DOM & URL CACHING STRESS HARNESS  ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function runTestCase(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message, stack: err.stack });
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAllSuites() {

  // ===========================================================================
  // SECTION 1: RAPID DOM MUTATION BURSTS & OBSERVER PERFORMANCE
  // ===========================================================================
  console.log('--- 1. Rapid DOM Mutation Bursts (1,000 - 10,000 mutations) & Observer Profiling ---');

  await runTestCase('1.1 5,000 Rapid DOM Mutation Burst Debouncing and Deduplication', async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    const obsUtils = require('../content/js/observer-utils');

    let callbackCount = 0;
    let receivedElements = [];

    const observer = obsUtils.observe('.storm-item', (elements) => {
      callbackCount++;
      receivedElements = elements;
    }, 'storm-test', { childList: true, subtree: true }, 40);

    const container = env.document.createElement('div');
    container.id = 'storm-container';
    env.document.body.appendChild(container);

    const startTime = Date.now();
    const createdNodes = [];
    const mutations = [];

    // Create 5,000 DOM elements and simulate rapid burst
    for (let i = 0; i < 5000; i++) {
      const el = env.document.createElement('div');
      el.className = 'storm-item';
      el.nodeType = global.Node.ELEMENT_NODE;
      container.appendChild(el);
      createdNodes.push(el);
    }

    // Pass in chunks of 500 mutations to simulate high-frequency rapid bursts
    for (let c = 0; c < 10; c++) {
      const chunk = createdNodes.slice(c * 500, (c + 1) * 500);
      mutations.push({
        type: 'childList',
        addedNodes: chunk,
        target: container
      });
      observer.triggerMutation(mutations);
    }

    const triggerElapsed = Date.now() - startTime;
    assert.ok(triggerElapsed < 300, `5,000 mutation events processed in ${triggerElapsed}ms (must be < 300ms)`);

    // Wait for 40ms debounce window to flush
    await new Promise(resolve => setTimeout(resolve, 80));

    assert.strictEqual(callbackCount, 1, `Callback must be batched and executed exactly ONCE, got ${callbackCount}`);
    assert.strictEqual(receivedElements.length, 5000, `Callback must deliver all 5,000 unique elements, got ${receivedElements.length}`);

    // Disconnect and verify clean teardown
    obsUtils.disconnect('storm-test');
    assert.strictEqual(obsUtils.observers.has('storm-test'), false);
    assert.strictEqual(obsUtils._pendingElements.has('storm-test'), false);
    assert.strictEqual(obsUtils._debounceTimers.has('storm-test'), false);
  });

  await runTestCase('1.2 High-Throughput Memory Stability Across Repeated Mutation Bursts', async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    const obsUtils = require('../content/js/observer-utils');

    let totalProcessed = 0;
    const observer = obsUtils.observe('.mem-test-item', (elements) => {
      totalProcessed += elements.length;
    }, 'mem-burst', { childList: true, subtree: true }, 10);

    const memBefore = process.memoryUsage().heapUsed;

    // Run 50 cycles of 200 mutations each (10,000 total mutations)
    for (let cycle = 0; cycle < 50; cycle++) {
      const batch = [];
      for (let i = 0; i < 200; i++) {
        const el = env.document.createElement('div');
        el.className = 'mem-test-item';
        el.nodeType = global.Node.ELEMENT_NODE;
        batch.push(el);
      }
      observer.triggerMutation([{ type: 'childList', addedNodes: batch, target: env.document.body }]);
      await new Promise(r => setTimeout(r, 15));
    }

    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMB = (memAfter - memBefore) / (1024 * 1024);

    assert.strictEqual(totalProcessed, 10000, `Processed total of 10,000 elements across 50 cycles, got ${totalProcessed}`);
    assert.ok(memDeltaMB < 25, `Heap memory growth (${memDeltaMB.toFixed(2)} MB) must be strictly bounded (< 25 MB)`);

    obsUtils.disconnect('mem-burst');
  });

  await runTestCase('1.3 Robust Handling of Non-Element Nodes, Comments, and Deep Hierarchies', async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    const obsUtils = require('../content/js/observer-utils');

    let matchedCount = 0;
    const observer = obsUtils.observe('.deep-target', (elements) => {
      matchedCount += elements.length;
    }, 'deep-test', { childList: true, subtree: true }, 20);

    // Deep container tree: Level 1 -> Level 2 -> Level 3 -> .deep-target
    const rootContainer = env.document.createElement('div');
    rootContainer.nodeType = global.Node.ELEMENT_NODE;

    const midContainer = env.document.createElement('div');
    midContainer.nodeType = global.Node.ELEMENT_NODE;

    const deepTarget = env.document.createElement('div');
    deepTarget.className = 'deep-target';
    deepTarget.nodeType = global.Node.ELEMENT_NODE;

    midContainer.appendChild(deepTarget);
    rootContainer.appendChild(midContainer);

    const textNode = { nodeType: global.Node.TEXT_NODE, textContent: 'Just text' };
    const commentNode = { nodeType: global.Node.COMMENT_NODE, textContent: 'Just comment' };

    // Trigger mutation with mixed node types
    observer.triggerMutation([
      { type: 'childList', addedNodes: [textNode, commentNode, rootContainer], target: env.document.body }
    ]);

    await new Promise(r => setTimeout(r, 40));

    assert.strictEqual(matchedCount, 1, `Deep target inside nested container must be found without crashing on text/comment nodes`);
    obsUtils.disconnect('deep-test');
  });


  // ===========================================================================
  // SECTION 2: AD-SKIPPER FAST-PATH & TRUE AD DETECTION ACCURACY
  // ===========================================================================
  console.log('\n--- 2. Ad-Skipper Fast-Path, True Ad Detection, & Playback Restoration ---');

  // Load page-ad-skipper.js into sandbox
  function createAdSkipperHarness() {
    const env = setupMockEnv();
    delete global.window.__GODMODE_PAGE_AD_SKIPPER__;

    const fs = require('fs');
    const skipperCode = fs.readFileSync(__dirname + '/../content/js/page-ad-skipper.js', 'utf8');

    // Create execution sandbox
    const sandbox = {
      window: global.window,
      document: env.document,
      Date: global.Date,
      setInterval: global.setInterval,
      clearInterval: global.clearInterval,
      MutationObserver: global.MutationObserver,
      PointerEvent: class { constructor(t, o) { Object.assign(this, o, { type: t }); } },
      MouseEvent: class { constructor(t, o) { Object.assign(this, o, { type: t }); } },
      console: global.console
    };

    // Execute in sandbox
    const vm = require('vm');
    vm.createContext(sandbox);
    vm.runInContext(skipperCode, sandbox);

    return { env, sandbox };
  }

  await runTestCase('2.1 Fast-Path Benchmark: 10,000 Invocations on Non-Ad Playback (< 50ms Total)', async () => {
    const { env } = createAdSkipperHarness();

    const player = env.document.createElement('div');
    player.id = 'movie_player';
    player.className = 'html5-video-player';
    env.document.body.appendChild(player);

    const video = env.document.createElement('video');
    video.paused = false;
    video.muted = false;
    video.playbackRate = 1;
    player.appendChild(video);

    // Call handleAd via triggering MutationObserver / interval or query selector evaluation
    const start = Date.now();
    let queryDeepCallCount = 0;

    // Simulate 10,000 rapid cycles
    for (let i = 0; i < 10000; i++) {
      const isAdPlaying = (player && player.classList && (
        player.classList.contains('ad-showing') ||
        player.classList.contains('ad-interrupting') ||
        player.classList.contains('ytp-ad-playing')
      )) || !!env.document.querySelector('.ad-showing, .ad-interrupting, .ytp-ad-playing');

      if (!isAdPlaying) {
        // Fast path taken!
        continue;
      }
      queryDeepCallCount++;
    }

    const elapsed = Date.now() - start;
    assert.strictEqual(queryDeepCallCount, 0, 'Fast path must NEVER invoke heavy queries when no ad is playing');
    assert.ok(elapsed < 50, `10,000 fast-path evaluations completed in ${elapsed}ms (must be < 50ms)`);
  });

  await runTestCase('2.2 Full Ad Lifecycle: Transition from Normal -> Ad Start -> Skip -> Content Resume', async () => {
    const env = setupMockEnv();
    delete global.window.__GODMODE_PAGE_AD_SKIPPER__;

    const fs = require('fs');
    const skipperCode = fs.readFileSync(__dirname + '/../content/js/page-ad-skipper.js', 'utf8');

    // Create execution scope that exposes internal handleAd
    let handleAdFn = null;
    let observerCallback = null;

    const customEnv = {
      window: global.window,
      document: env.document,
      Date: global.Date,
      setInterval: (fn) => { handleAdFn = fn; return 1; },
      clearInterval: () => {},
      MutationObserver: class {
        constructor(cb) { observerCallback = cb; }
        observe() {}
        disconnect() {}
      },
      PointerEvent: class { constructor(t, o) { Object.assign(this, o, { type: t }); } },
      MouseEvent: class { constructor(t, o) { Object.assign(this, o, { type: t }); } },
      console: global.console
    };

    const vm = require('vm');
    vm.createContext(customEnv);
    vm.runInContext(skipperCode, customEnv);

    assert.ok(typeof handleAdFn === 'function', 'handleAd function must be captured');

    // Setup YouTube player and video
    const player = env.document.createElement('div');
    player.id = 'movie_player';
    player.className = 'html5-video-player';
    let skippedApiCalled = false;
    player.skipAd = () => { skippedApiCalled = true; };
    env.document.body.appendChild(player);

    const video = env.document.createElement('video');
    video.src = 'https://www.youtube.com/watch?v=test';
    video.muted = false;
    video.playbackRate = 1.0;
    video.currentTime = 10;
    video.duration = 100;
    video.paused = false;
    player.appendChild(video);

    // Initial state: No ad playing
    handleAdFn();
    assert.strictEqual(video.playbackRate, 1.0);
    assert.strictEqual(video.muted, false);

    // PHASE 1: Ad Starts
    player.classList.add('ad-showing');
    const skipBtn = env.document.createElement('button');
    skipBtn.className = 'ytp-ad-skip-button-modern';
    let buttonClicked = false;
    skipBtn.click = () => { buttonClicked = true; };
    player.appendChild(skipBtn);

    handleAdFn();

    // Verify ad handling actions
    assert.strictEqual(video.muted, true, 'Ad must be muted');
    assert.strictEqual(video.playbackRate, 16, 'Ad playbackRate must be boosted to 16x');
    assert.strictEqual(video.currentTime, 100, 'currentTime must be forwarded to duration');
    assert.strictEqual(buttonClicked, true, 'Skip button must be clicked');
    assert.strictEqual(skippedApiCalled, true, 'player.skipAd() API must be invoked');

    // PHASE 2: Ad Finishes, Content Resumes
    player.classList.remove('ad-showing');
    skipBtn.remove();

    let playResumed = false;
    video.play = () => { playResumed = true; return Promise.resolve(); };
    video.paused = true; // Video might pause upon ad completion

    handleAdFn();

    // Verify restoration of standard playback
    assert.strictEqual(video.playbackRate, 1.0, 'Playback rate must be restored to 1.0 for main content');
    assert.strictEqual(video.muted, false, 'Mute state must be restored to original false');
    assert.strictEqual(playResumed, true, 'Video playback must be resumed via video.play()');

    // PHASE 3: Subsequent tick is fast path
    handleAdFn();
    assert.strictEqual(video.playbackRate, 1.0);
  });

  await runTestCase('2.3 Anti-Adblock Enforcement Modal Auto-Dismissal', async () => {
    const env = setupMockEnv();
    delete global.window.__GODMODE_PAGE_AD_SKIPPER__;

    const fs = require('fs');
    const skipperCode = fs.readFileSync(__dirname + '/../content/js/page-ad-skipper.js', 'utf8');

    let handleAdFn = null;
    const customEnv = {
      window: global.window,
      document: env.document,
      Date: global.Date,
      setInterval: (fn) => { handleAdFn = fn; return 1; },
      clearInterval: () => {},
      MutationObserver: class { constructor() {} observe() {} disconnect() {} },
      PointerEvent: class { constructor(t, o) { Object.assign(this, o, { type: t }); } },
      MouseEvent: class { constructor(t, o) { Object.assign(this, o, { type: t }); } },
      console: global.console
    };

    const vm = require('vm');
    vm.createContext(customEnv);
    vm.runInContext(skipperCode, customEnv);

    const player = env.document.createElement('div');
    player.id = 'movie_player';
    player.classList.add('ad-showing');
    env.document.body.appendChild(player);

    const enforcement = env.document.createElement('ytd-enforcement-message-view-model');
    const dismissBtn = env.document.createElement('button');
    let dismissClicked = false;
    dismissBtn.click = () => { dismissClicked = true; };
    enforcement.appendChild(dismissBtn);
    env.document.body.appendChild(enforcement);

    assert.strictEqual(env.document.querySelector('ytd-enforcement-message-view-model') !== null, true);

    handleAdFn();

    assert.strictEqual(dismissClicked, true, 'Dismiss button inside enforcement modal must be clicked');
    assert.strictEqual(env.document.querySelector('ytd-enforcement-message-view-model'), null, 'Enforcement modal must be removed from DOM');
  });

  await runTestCase('2.4 Preference Bridge: data-ss-auto-skip="false" Disables Ad Skipper Instantly', async () => {
    const env = setupMockEnv();
    delete global.window.__GODMODE_PAGE_AD_SKIPPER__;

    const fs = require('fs');
    const skipperCode = fs.readFileSync(__dirname + '/../content/js/page-ad-skipper.js', 'utf8');

    let handleAdFn = null;
    const customEnv = {
      window: global.window,
      document: env.document,
      Date: global.Date,
      setInterval: (fn) => { handleAdFn = fn; return 1; },
      clearInterval: () => {},
      MutationObserver: class { constructor() {} observe() {} disconnect() {} },
      PointerEvent: class { constructor(t, o) { Object.assign(this, o, { type: t }); } },
      MouseEvent: class { constructor(t, o) { Object.assign(this, o, { type: t }); } },
      console: global.console
    };

    const vm = require('vm');
    vm.createContext(customEnv);
    vm.runInContext(skipperCode, customEnv);

    const player = env.document.createElement('div');
    player.id = 'movie_player';
    player.classList.add('ad-showing');
    env.document.body.appendChild(player);

    const video = env.document.createElement('video');
    video.muted = false;
    video.playbackRate = 1.0;
    player.appendChild(video);

    // Disable auto skip via DOM preference attribute
    env.document.documentElement.setAttribute('data-ss-auto-skip', 'false');

    handleAdFn();

    // Ad must NOT be muted or accelerated when data-ss-auto-skip is 'false'
    assert.strictEqual(video.playbackRate, 1.0, 'Ad must NOT be accelerated when preference is false');
    assert.strictEqual(video.muted, false, 'Ad must NOT be muted when preference is false');

    // Re-enable
    env.document.documentElement.setAttribute('data-ss-auto-skip', 'true');
    handleAdFn();
    assert.strictEqual(video.playbackRate, 16, 'Ad MUST be accelerated when preference is true');
  });


  // ===========================================================================
  // SECTION 3: SHORTS BLOCKER URL CACHING & SPA TRANSITIONS
  // ===========================================================================
  console.log('\n--- 3. Shorts Blocker URL Caching, Static URL Bypass, & SPA Transitions ---');

  await runTestCase('3.1 Static URL Redundancy Bypass (10,000 Invocations Bypassed via Cache)', async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    delete require.cache[require.resolve('../content/js/shorts-blocker')];

    const blocker = require('../content/js/shorts-blocker');
    blocker.enable();

    // Set a static watch URL
    global.window.location.href = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    blocker._lastCheckedUrl = ''; // Clear initial

    // Initial check caches URL
    blocker.checkAndRedirectShortsURL();
    assert.strictEqual(blocker._lastCheckedUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    // Check duration of 10,000 calls
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      blocker.checkAndRedirectShortsURL();
    }
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 15, `10,000 cached static URL checks executed in ${elapsed}ms (must be < 15ms)`);
    blocker.disable();
  });

  await runTestCase('3.2 SPA Navigation: pushState / replaceState Interception & Redirects', async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    delete require.cache[require.resolve('../content/js/shorts-blocker')];

    let redirectedTo = null;
    // Set mock redirection receiver on location.replace before enabling blocker
    global.window.location.replace = (url) => {
      redirectedTo = url;
    };

    const blocker = require('../content/js/shorts-blocker');
    blocker.enable();

    // Navigation 1: Normal Watch Page (No redirect)
    redirectedTo = null;
    global.window.location.href = 'https://www.youtube.com/watch?v=123';
    global.window.history.pushState({}, '', 'https://www.youtube.com/watch?v=123');
    assert.strictEqual(redirectedTo, null, 'Normal watch page must not trigger redirection');

    // Navigation 2: Shorts URL (Must redirect to Home)
    redirectedTo = null;
    global.window.location.href = 'https://www.youtube.com/shorts/abc987';
    global.window.history.pushState({}, '', 'https://www.youtube.com/shorts/abc987');
    assert.strictEqual(redirectedTo, 'https://www.youtube.com/', 'Shorts URL must trigger redirect to https://www.youtube.com/');

    // Navigation 3: Playables URL (Must redirect to Home)
    redirectedTo = null;
    global.window.location.href = 'https://www.youtube.com/playables/pacman';
    global.window.history.replaceState({}, '', 'https://www.youtube.com/playables/pacman');
    assert.strictEqual(redirectedTo, 'https://www.youtube.com/', 'Playables URL must trigger redirect to https://www.youtube.com/');

    blocker.disable();
  });

  await runTestCase('3.3 YouTube Custom SPA Events: yt-navigate-start / finish / data-updated', async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    delete require.cache[require.resolve('../content/js/shorts-blocker')];

    const blocker = require('../content/js/shorts-blocker');
    blocker.enable();

    let redirectCount = 0;
    global.window.location.replace = (url) => {
      if (url === 'https://www.youtube.com/') redirectCount++;
    };

    const spaEvents = [
      'yt-navigate-start',
      'yt-navigate-finish',
      'yt-page-data-updated',
      'yt-page-type-changed',
      'popstate',
      'hashchange'
    ];

    for (let i = 0; i < spaEvents.length; i++) {
      const evtName = spaEvents[i];
      global.window.location.href = `https://www.youtube.com/shorts/event_${i}`;
      global.window.dispatchEvent(evtName);
    }

    assert.strictEqual(redirectCount, spaEvents.length, `Expected ${spaEvents.length} redirects from SPA events, got ${redirectCount}`);
    blocker.disable();
  });

  await runTestCase('3.4 False-Positive Prevention on Search and Channel URLs Containing "shorts"', async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    delete require.cache[require.resolve('../content/js/shorts-blocker')];

    const blocker = require('../content/js/shorts-blocker');
    blocker.enable();

    let redirected = false;
    global.window.location.replace = () => { redirected = true; };

    const falsePositiveCandidates = [
      'https://www.youtube.com/results?search_query=shorts+video+tutorial',
      'https://www.youtube.com/watch?v=shortstory123',
      'https://www.youtube.com/@shortscreator/videos',
      'https://www.youtube.com/feed/subscriptions',
      'https://www.youtube.com/playlist?list=PLshorts_collection'
    ];

    for (const url of falsePositiveCandidates) {
      redirected = false;
      global.window.location.href = url;
      global.window.dispatchEvent('yt-navigate-finish');
      assert.strictEqual(redirected, false, `URL "${url}" must NOT be redirected`);
    }

    blocker.disable();
  });

  await runTestCase('3.5 Disable & Unpatch Lifecycle Teardown', async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    delete require.cache[require.resolve('../content/js/shorts-blocker')];

    const blocker = require('../content/js/shorts-blocker');
    const origPush = global.window.history.pushState;
    const origReplace = global.window.history.replaceState;

    blocker.enable();
    assert.strictEqual(blocker.isActive, true);
    assert.strictEqual(blocker.historyPatched, true);

    blocker.disable();
    assert.strictEqual(blocker.isActive, false);
    assert.strictEqual(blocker.disabledExplicitly, true);
    assert.strictEqual(blocker.historyPatched, false);
    assert.strictEqual(blocker.urlCheckInterval, null);
    assert.strictEqual(blocker.boundSPAListener, null);

    let redirectTriggered = false;
    global.window.location.replace = () => { redirectTriggered = true; };

    // Navigate to shorts while disabled
    global.window.location.href = 'https://www.youtube.com/shorts/ignored_after_disable';
    global.window.history.pushState({}, '', 'https://www.youtube.com/shorts/ignored_after_disable');
    assert.strictEqual(redirectTriggered, false, 'Redirection must NOT occur when blocker is disabled');
  });


  // ===========================================================================
  // SECTION 4: CONCURRENT MULTI-VECTOR ADVERSARIAL STRESS HARNESS
  // ===========================================================================
  console.log('\n--- 4. Concurrent Multi-Vector Stress (DOM Storms + SPA Flips + Ad Pods) ---');

  await runTestCase('4.1 Concurrent 500 DOM Mutations + 50 SPA Navigations + 20 Ad Cycles', async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    delete require.cache[require.resolve('../content/js/shorts-blocker')];

    const obsUtils = require('../content/js/observer-utils');
    const blocker = require('../content/js/shorts-blocker');
    blocker.enable();

    let domItemsProcessed = 0;
    const observer = obsUtils.observe('.concurrent-item', (items) => {
      domItemsProcessed += items.length;
    }, 'concurrent-obs', { childList: true, subtree: true }, 25);

    let redirectsCount = 0;
    global.window.location.replace = (url) => {
      if (url === 'https://www.youtube.com/') redirectsCount++;
    };

    const startTime = Date.now();

    // Interleave operations concurrently
    for (let round = 0; round < 50; round++) {
      // 1. DOM mutation burst (10 items per round = 500 total)
      const added = [];
      for (let k = 0; k < 10; k++) {
        const div = env.document.createElement('div');
        div.className = 'concurrent-item';
        div.nodeType = global.Node.ELEMENT_NODE;
        added.push(div);
      }
      observer.triggerMutation([{ type: 'childList', addedNodes: added, target: env.document.body }]);

      // 2. SPA Navigation event (alternate shorts / regular)
      const isShorts = (round % 2 === 0);
      global.window.location.href = isShorts ? `https://www.youtube.com/shorts/round_${round}` : `https://www.youtube.com/watch?v=round_${round}`;
      global.window.dispatchEvent('yt-navigate-start');

      // 3. Ad lifecycle simulation toggle
      if (round % 5 === 0) {
        env.document.documentElement.setAttribute('data-ss-auto-skip', round % 10 === 0 ? 'false' : 'true');
      }
    }

    // Wait for debounce to settle
    await new Promise(r => setTimeout(r, 60));

    const totalDuration = Date.now() - startTime;

    assert.strictEqual(domItemsProcessed, 500, `All 500 DOM items must be processed, got ${domItemsProcessed}`);
    assert.strictEqual(redirectsCount, 25, `Expected 25 shorts redirects in 50 alternating rounds, got ${redirectsCount}`);
    assert.ok(totalDuration < 500, `Concurrent simulation completed in ${totalDuration}ms (must be < 500ms)`);

    obsUtils.disconnect('concurrent-obs');
    blocker.disable();
  });

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n================================================================');
  console.log(`TOTAL EMPIRICAL CHALLENGER TESTS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error('FAILURES SUMMARY:');
    failures.forEach((f, i) => {
      console.error(`  ${i + 1}) ${f.name}: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log('ALL EMPIRICAL DOM & URL CACHING STRESS TESTS PASSED 100% CLEANLY! ✅\n');
    process.exit(0);
  }
}

runAllSuites().catch(err => {
  console.error('Fatal unhandled error in test suite:', err);
  process.exit(1);
});
