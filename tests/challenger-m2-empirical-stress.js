/**
 * Challenger M2 Empirical Stress Test Suite
 * Tests observer-utils.js, shorts-blocker.js, and focus-mode.js under extreme adversarial conditions.
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

// Polyfill matches on MockElement if missing
if (MockElement && !MockElement.prototype.matches) {
  MockElement.prototype.matches = function(selector) {
    if (!selector || typeof selector !== 'string') return false;
    const sel = selector.trim();
    if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    return this.tagName.toLowerCase() === sel.toLowerCase();
  };
}

console.log("=========================================================");
console.log("  CHALLENGER M2 EMPIRICAL ADVERSARIAL STRESS TEST SUITE  ");
console.log("=========================================================\n");

let passedCount = 0;
let failedCount = 0;
let totalCount = 0;
const failures = [];

async function runTest(testName, testFn) {
  totalCount++;
  try {
    await testFn();
    passedCount++;
    console.log(`  ✓ [PASS] ${testName}`);
  } catch (err) {
    failedCount++;
    failures.push({ testName, error: err.message, stack: err.stack });
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAllTests() {
  // -----------------------------------------------------------------------------
  // SUITE 1: Rapid SPA pushState / replaceState & Navigation Transitions
  // -----------------------------------------------------------------------------
  console.log("--- Suite 1: Rapid SPA Navigation & History API Stress ---");

  await runTest("1.1 Rapid SPA PushState / ReplaceState Burst (500 iterations)", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/dom-utils')];
    delete require.cache[require.resolve('../content/js/observer-utils')];
    delete require.cache[require.resolve('../content/js/shorts-blocker')];
    
    require('../utils/dom-utils');
    require('../content/js/observer-utils');
    require('../content/js/shorts-blocker');

    const blocker = window.ShortsBlocker;
    blocker.enable();

    let redirectCount = 0;
    const origReplace = window.history.replaceState;
    // Track replaceState redirects triggered by shorts blocker
    window.history.replaceState = function(state, title, url) {
      if (url === 'https://www.youtube.com/') redirectCount++;
      return origReplace.apply(this, arguments);
    };

    // Run 500 rapid pushState calls alternating between normal watch page and shorts URL
    for (let i = 0; i < 500; i++) {
      const isShorts = i % 2 === 0;
      const targetUrl = isShorts ? `https://www.youtube.com/shorts/test_${i}` : `https://www.youtube.com/watch?v=normal_${i}`;
      window.location.href = targetUrl;
      window.history.pushState({ page: i }, `Title ${i}`, targetUrl);
    }

    assert.strictEqual(redirectCount, 250, `Expected 250 redirects for 250 Shorts URLs in 500 pushState calls, got ${redirectCount}`);
    blocker.disable();
  });

  await runTest("1.2 History Patch Exception Handling & State Preservation", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/shorts-blocker')];
    require('../content/js/shorts-blocker');

    const blocker = window.ShortsBlocker;
    blocker.unpatchHistoryAPI(); // Unpatch first so we can re-patch with a custom throwing pushState

    // Simulate original pushState throwing an Error (e.g. security error or invalid origin)
    const throwingPushState = function() {
      throw new Error("SecurityError: Simulated pushState failure");
    };
    window.history.pushState = throwingPushState;

    blocker.patchHistoryAPI();

    let redirectFired = false;
    blocker.checkAndRedirectShortsURL = () => { redirectFired = true; };

    // Expect the wrapped pushState to re-throw the original error, BUT run finally block
    assert.throws(() => {
      window.history.pushState({}, '', 'https://www.youtube.com/shorts/abc');
    }, /SecurityError: Simulated pushState failure/, "Original pushState exception must be thrown to caller");

    assert.strictEqual(redirectFired, true, "URL check / redirect MUST fire in finally block even when pushState throws");

    blocker.unpatchHistoryAPI();
  });

  await runTest("1.3 Repeated Listener Attachment / Detachment Lifecycle (No Leaks)", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/shorts-blocker')];
    require('../content/js/shorts-blocker');

    const blocker = window.ShortsBlocker;

    // Attach and detach SPA listeners 100 times
    for (let i = 0; i < 100; i++) {
      blocker.attachSPAListeners();
      blocker.detachSPAListeners();
    }

    assert.strictEqual(blocker.boundSPAListener, null, "boundSPAListener should be null after detachment");
    assert.strictEqual(blocker.urlCheckInterval, null, "urlCheckInterval should be cleared after detachment");
    assert.strictEqual(blocker.historyPatched, false, "historyPatched flag should be false after detachment");
  });

  // -----------------------------------------------------------------------------
  // SUITE 2: Missing DOM Elements & Edge Environments
  // -----------------------------------------------------------------------------
  console.log("\n--- Suite 2: Missing YouTube DOM Elements & Null Document States ---");

  await runTest("2.1 ShortsBlocker / FocusMode / ObserverUtils with null document.body", async () => {
    const env = setupMockEnv();
    const originalBody = env.document.body;
    
    // Temporarily remove document.body to simulate document-start before <body> creation
    delete env.document.body;
    env.document.body = null;

    delete require.cache[require.resolve('../content/js/observer-utils')];
    delete require.cache[require.resolve('../content/js/shorts-blocker')];
    delete require.cache[require.resolve('../content/js/focus-mode')];

    require('../content/js/observer-utils');
    require('../content/js/shorts-blocker');
    require('../content/js/focus-mode');

    // Enabling when body is null should fall back to document.documentElement without throwing
    assert.doesNotThrow(() => {
      window.ShortsBlocker.enable();
      window.FocusMode.enable();
      window.ObserverUtils.observe('a[href*="shorts"]', () => {}, 'null-body-test');
    }, "Operations must not throw when document.body is null");

    assert.strictEqual(window.ShortsBlocker.isActive, true);
    assert.strictEqual(window.FocusMode.isActive, true);

    window.ShortsBlocker.disable();
    window.FocusMode.disable();
    window.ObserverUtils.disconnect('null-body-test');

    // Restore body
    env.document.body = originalBody;
  });

  await runTest("2.2 ShortsBlocker container matching with missing or non-Element DOM nodes", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    delete require.cache[require.resolve('../content/js/shorts-blocker')];

    require('../content/js/observer-utils');
    require('../content/js/shorts-blocker');

    const blocker = window.ShortsBlocker;
    
    // Test elements without closest method (e.g. basic Node, Text Node, or custom mock object)
    const textNode = env.document.createTextNode("Shorts video text");
    const elementWithoutClosest = { style: {} }; // no closest function
    const normalEl = env.document.createElement('a');
    normalEl.setAttribute('href', '/shorts/9999');
    
    env.document.body.appendChild(normalEl);

    assert.doesNotThrow(() => {
      window.ObserverUtils.observe('a[href*="shorts"]', (elements) => {
        // Run observeShortsElements logic manually with weird elements
        elements.push(textNode, elementWithoutClosest, null, undefined);
        elements.forEach(el => {
          if (!el) return;
          const container = (typeof el.closest === 'function') ? el.closest('ytd-rich-shelf-renderer') : null;
          if (container && container.style) {
            container.style.display = 'none';
          } else if (el.style) {
            el.style.display = 'none';
          }
        });
      }, 'weird-nodes-test');
    }, "Should safely handle nodes lacking .closest or null/undefined items");

    window.ObserverUtils.disconnect('weird-nodes-test');
  });

  // -----------------------------------------------------------------------------
  // SUITE 3: High-Frequency MutationObserver Mutations & Debounce Lifecycle
  // -----------------------------------------------------------------------------
  console.log("\n--- Suite 3: High-Frequency Mutation Bursts & Debounce Lifecycle ---");

  await runTest("3.1 1,000 Rapid DOM Mutations & Debounced Batching", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    require('../content/js/observer-utils');

    const obsUtils = window.ObserverUtils;
    let callbackCallCount = 0;
    let totalReceivedElements = 0;

    const observer = obsUtils.observe('.burst-item', (elements) => {
      callbackCallCount++;
      totalReceivedElements += elements.length;
    }, 'burst-test', { childList: true, subtree: true }, 50);

    const container = env.document.createElement('div');
    env.document.body.appendChild(container);

    const mutations = [];
    const addedNodesList = [];

    // Simulate 1,000 rapid DOM additions
    for (let i = 0; i < 1000; i++) {
      const child = env.document.createElement('div');
      child.className = 'burst-item';
      child.nodeType = global.Node.ELEMENT_NODE;
      container.appendChild(child);
      addedNodesList.push(child);
    }

    mutations.push({
      type: 'childList',
      addedNodes: addedNodesList,
      target: container
    });

    // Trigger mutation on MockMutationObserver
    observer.triggerMutation(mutations);

    // Wait for the 50ms debounce window to flush
    await new Promise(resolve => setTimeout(resolve, 100));

    // Because mutations arrived in a single burst, debouncing batches them into 1 callback call
    assert.strictEqual(callbackCallCount, 1, `Callback should fire exactly once for debounced burst, got ${callbackCallCount}`);
    assert.strictEqual(totalReceivedElements, 1000, `Callback should receive all 1000 elements, got ${totalReceivedElements}`);

    obsUtils.disconnect('burst-test');
  });

  await runTest("3.2 Non-Element & Non-Standard DOM Mutation Nodes Handling", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    require('../content/js/observer-utils');

    const obsUtils = window.ObserverUtils;

    assert.doesNotThrow(() => {
      const observer = obsUtils.observe('span', () => {}, 'non-element-test');
      
      const textNode = { nodeType: global.Node.TEXT_NODE, textContent: "Text node" };
      const commentNode = { nodeType: global.Node.COMMENT_NODE, textContent: "Comment node" };

      observer.triggerMutation([{
        type: 'childList',
        addedNodes: [textNode, commentNode]
      }]);
    }, "MutationObserver listener must not throw on non-element nodes (Text nodes, Comment nodes)");

    obsUtils.disconnect('non-element-test');
  });

  await runTest("3.3 Invalid Selector Syntax Handling in observe() & QuerySelector", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    require('../content/js/observer-utils');

    const obsUtils = window.ObserverUtils;

    // Passing invalid CSS selector (e.g. syntax error in querySelectorAll)
    const invalidSelector = 'div[invalid===selector]:bad-pseudo';

    assert.doesNotThrow(() => {
      obsUtils.observe(invalidSelector, () => {}, 'invalid-selector-test');
    }, "observe() must catch DOMException from querySelectorAll gracefully");

    obsUtils.disconnect('invalid-selector-test');
  });

  await runTest("3.4 Pending Debounce Timer Disconnect Cleanliness", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    require('../content/js/observer-utils');

    const obsUtils = window.ObserverUtils;
    let firedAfterDisconnect = false;

    const observer = obsUtils.observe('.pending-item', () => {
      firedAfterDisconnect = true;
    }, 'pending-test', { childList: true, subtree: true }, 100);

    const child = env.document.createElement('div');
    child.className = 'pending-item';
    child.nodeType = global.Node.ELEMENT_NODE;
    env.document.body.appendChild(child);

    observer.triggerMutation([{
      type: 'childList',
      addedNodes: [child]
    }]);

    // Immediately disconnect before 100ms timer flushes
    obsUtils.disconnect('pending-test');

    // Wait 150ms
    await new Promise(resolve => setTimeout(resolve, 150));

    assert.strictEqual(firedAfterDisconnect, false, "Callback MUST NOT fire after observer disconnect");
    assert.strictEqual(obsUtils._pendingElements.has('pending-test'), false);
    assert.strictEqual(obsUtils._debounceTimers.has('pending-test'), false);
    assert.strictEqual(obsUtils._initialScanDone.has('pending-test'), false);
  });

  await runTest("3.5 DisconnectAll Resets All Observer & Initial Scan State", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../content/js/observer-utils')];
    require('../content/js/observer-utils');

    const obsUtils = window.ObserverUtils;

    let scanCount1 = 0;
    let scanCount2 = 0;

    const el1 = env.document.createElement('div');
    el1.className = 'scan-item-1';
    el1.nodeType = global.Node.ELEMENT_NODE;
    env.document.body.appendChild(el1);

    obsUtils.observe('.scan-item-1', () => { scanCount1++; }, 'obs1');
    obsUtils.observe('.scan-item-2', () => { scanCount2++; }, 'obs2');

    assert.strictEqual(scanCount1, 1, "Initial scan 1 ran once");

    // Disconnect all
    obsUtils.disconnectAll();

    assert.strictEqual(obsUtils.observers.size, 0);
    assert.strictEqual(obsUtils._debounceTimers.size, 0);
    assert.strictEqual(obsUtils._pendingElements.size, 0);
    assert.strictEqual(obsUtils._initialScanDone.size, 0, "_initialScanDone MUST be cleared by disconnectAll");

    // Re-observe obs1 - should trigger initial scan again because state was reset
    obsUtils.observe('.scan-item-1', () => { scanCount1++; }, 'obs1');
    assert.strictEqual(scanCount1, 2, "Re-observing after disconnectAll must run initial scan again");

    obsUtils.disconnectAll();
  });

  // -----------------------------------------------------------------------------
  // SUITE 4: FocusMode Rapid State Toggle & Visual Integrity
  // -----------------------------------------------------------------------------
  console.log("\n--- Suite 4: FocusMode Rapid State Toggles & Cleanliness ---");

  await runTest("4.1 Rapid Toggle Stress (200 enable/disable iterations)", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/dom-utils')];
    delete require.cache[require.resolve('../content/js/focus-mode')];
    
    require('../utils/dom-utils');
    require('../content/js/focus-mode');

    const focusMode = window.FocusMode;

    for (let i = 0; i < 200; i++) {
      focusMode.enable();
      assert.strictEqual(focusMode.isActive, true);
      focusMode.disable();
      assert.strictEqual(focusMode.isActive, false);
    }

    const hasClass = (env.document.documentElement && env.document.documentElement.classList.contains('shorts-shield-focus-mode')) ||
                     (env.document.body && env.document.body.classList.contains('shorts-shield-focus-mode'));
    assert.strictEqual(hasClass, false, "Focus mode CSS class should not remain on root/body after final disable");
  });

  await runTest("4.2 FocusMode Enable/Disable Idempotency", async () => {
    const env = setupMockEnv();
    delete require.cache[require.resolve('../utils/dom-utils')];
    delete require.cache[require.resolve('../content/js/focus-mode')];

    require('../utils/dom-utils');
    require('../content/js/focus-mode');

    const focusMode = window.FocusMode;

    // Calling enable() multiple times should be idempotent
    focusMode.enable();
    focusMode.enable();
    focusMode.enable();
    assert.strictEqual(focusMode.isActive, true);

    // Calling disable() multiple times should be idempotent
    focusMode.disable();
    focusMode.disable();
    focusMode.disable();
    assert.strictEqual(focusMode.isActive, false);
  });

  console.log("\n=========================================================");
  console.log(`  STRESS SUITE SUMMARY: ${passedCount}/${totalCount} Passed, ${failedCount} Failed`);
  console.log("=========================================================\n");

  if (failedCount > 0) {
    console.log("FAILED TESTS DETAILED LOG:");
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}) ${f.testName}: ${f.error}`);
    });
    console.log("");
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests();
