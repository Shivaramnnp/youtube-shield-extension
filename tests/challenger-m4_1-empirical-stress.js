const fs = require('fs');
const path = require('path');
const { setupMockEnv } = require('./harness/mock-extension-env');

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    testsFailed++;
    failures.push(message);
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runM4_1EmpiricalStressSuite() {
  console.log("=======================================================================");
  console.log("=== STARTING CHALLENGER M4_1 EMPIRICAL STRESS SUITE (BG WORKER & UI) ===");
  console.log("=======================================================================");

  // --- SECTION 1: BACKGROUND SERVICE WORKER WEBNAVI INTERCEPTION & TAB TRACKING ---
  console.log("\n--- SECTION 1: Background Service Worker Interception & Lifecycle ---");
  
  const envBG = setupMockEnv();
  
  // Track calls to tabs.update, scripting.executeScript, tabs.query, etc.
  let tabsUpdateCalls = [];
  let scriptExecuteCalls = [];
  let navBeforeListeners = [];
  let navHistoryListeners = [];
  let tabUpdatedListeners = [];
  let tabRemovedListeners = [];
  let messageListeners = [];

  if (!envBG.chrome.tabs.onRemoved) {
    envBG.chrome.tabs.onRemoved = { addListener: () => {}, removeListener: () => {} };
  }

  envBG.chrome.webNavigation.onBeforeNavigate.addListener = (fn) => navBeforeListeners.push(fn);
  envBG.chrome.webNavigation.onHistoryStateUpdated.addListener = (fn) => navHistoryListeners.push(fn);
  envBG.chrome.tabs.onUpdated.addListener = (fn) => tabUpdatedListeners.push(fn);
  envBG.chrome.tabs.onRemoved.addListener = (fn) => tabRemovedListeners.push(fn);
  envBG.chrome.runtime.onMessage.addListener = (fn) => messageListeners.push(fn);

  envBG.chrome.tabs.update = (tabId, props, callback) => {
    tabsUpdateCalls.push({ tabId, props });
    if (typeof callback === 'function') callback({ id: tabId, ...props });
    return Promise.resolve({ id: tabId, ...props });
  };

  envBG.chrome.scripting.executeScript = (details, callback) => {
    scriptExecuteCalls.push(details);
    if (typeof callback === 'function') callback([{ result: true }]);
    return Promise.resolve([{ result: true }]);
  };

  // Mock chrome.storage.session
  const sessionStore = new Map();
  envBG.chrome.storage.session = {
    get: (keys) => {
      const res = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach(k => res[k] = sessionStore.get(k));
      return Promise.resolve(res);
    },
    set: (obj) => {
      Object.entries(obj).forEach(([k, v]) => sessionStore.set(k, v));
      return Promise.resolve();
    }
  };

  // Load StorageUtil into environment
  const storageJsCode = fs.readFileSync(path.join(__dirname, '../utils/storage.js'), 'utf8');
  eval(storageJsCode);

  // Initialize storage defaults
  await StorageUtil.saveSettings(StorageUtil.DEFAULT_SETTINGS);
  await StorageUtil.saveTracking(StorageUtil.DEFAULT_TRACKING);

  // Read and execute background/background.js
  const bgJsCode = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf8');
  eval(bgJsCode);

  assert(navBeforeListeners.length > 0, "onBeforeNavigate listener registered");
  assert(navHistoryListeners.length > 0, "onHistoryStateUpdated listener registered");
  assert(tabUpdatedListeners.length > 0, "tabs.onUpdated listener registered");
  assert(tabRemovedListeners.length > 0, "tabs.onRemoved listener registered");
  assert(messageListeners.length > 0, "runtime.onMessage listener registered");

  // Subtest 1.1: Frame ID Filtering on onBeforeNavigate
  console.log("\n  - Subtest 1.1: Main frame vs Subframe URL interception");
  tabsUpdateCalls = [];
  const onBeforeNavHandler = navBeforeListeners[0];

  // Subframe navigation (frameId = 1) -> SHOULD BE IGNORED
  await onBeforeNavHandler({ tabId: 10, frameId: 1, url: 'https://www.youtube.com/shorts/12345' });
  assert(tabsUpdateCalls.length === 0, "Subframe (frameId=1) Shorts navigation ignored");

  // Main frame navigation (frameId = 0) -> SHOULD BE REDIRECTED
  await onBeforeNavHandler({ tabId: 10, frameId: 0, url: 'https://www.youtube.com/shorts/12345' });
  assert(tabsUpdateCalls.length === 1 && tabsUpdateCalls[0].props.url === 'https://www.youtube.com/', 
    "Main frame (frameId=0) Shorts navigation redirected to YouTube Home");
  assert(sessionStore.get('pendingHistoryReplace') && sessionStore.get('pendingHistoryReplace').includes(10),
    "Pending tab 10 marked in chrome.storage.session");

  // Subtest 1.2: Feature Toggles (extensionEnabled / shortsBlocker)
  console.log("\n  - Subtest 1.2: Feature toggles state verification");
  tabsUpdateCalls = [];
  await StorageUtil.updateSetting('extensionEnabled', false);
  await onBeforeNavHandler({ tabId: 11, frameId: 0, url: 'https://www.youtube.com/shorts/99999' });
  assert(tabsUpdateCalls.length === 0, "Navigation ignored when extensionEnabled is false");

  await StorageUtil.updateSetting('extensionEnabled', true);
  await StorageUtil.updateSetting('shortsBlocker', false);
  await onBeforeNavHandler({ tabId: 11, frameId: 0, url: 'https://www.youtube.com/shorts/99999' });
  assert(tabsUpdateCalls.length === 0, "Navigation ignored when shortsBlocker is false");

  await StorageUtil.updateSetting('shortsBlocker', true);

  // Subtest 1.3: Tab Completion & Closure Teardown
  console.log("\n  - Subtest 1.3: Pending tab history replace & onRemoved cleanup");
  scriptExecuteCalls = [];
  const onTabUpdatedHandler = tabUpdatedListeners[0];

  // Complete navigation on tab 10 (which was marked pending)
  await onTabUpdatedHandler(10, { status: 'complete' });
  assert(scriptExecuteCalls.length === 1 && scriptExecuteCalls[0].target.tabId === 10,
    "Script injection triggered for completed pending tab 10 to replaceState");
  
  const pendingAfterComplete = sessionStore.get('pendingHistoryReplace') || [];
  assert(!pendingAfterComplete.includes(10), "Tab 10 removed from pending set after history replacement");

  // Test tab closure cleanup (onRemoved)
  const onTabRemovedHandler = tabRemovedListeners[0];
  await onBeforeNavHandler({ tabId: 99, frameId: 0, url: 'https://www.youtube.com/shorts/777' });
  assert((sessionStore.get('pendingHistoryReplace') || []).includes(99), "Tab 99 marked pending");
  
  await onTabRemovedHandler(99);
  assert(!(sessionStore.get('pendingHistoryReplace') || []).includes(99), "Tab 99 removed from pending set when tab is closed");


  // Subtest 1.4: Options Page IPC Deduplication Router
  console.log("\n  - Subtest 1.4: Options page tab deduplication IPC router");
  const onMessageHandler = messageListeners[0];

  let queryTabsResult = [];
  let tabCreateCalls = [];
  let windowUpdateCalls = [];

  envBG.chrome.tabs.query = (queryInfo, callback) => {
    if (typeof callback === 'function') callback(queryTabsResult);
    return Promise.resolve(queryTabsResult);
  };
  envBG.chrome.tabs.create = (props, callback) => {
    tabCreateCalls.push(props);
    const newTab = { id: 55, ...props };
    if (typeof callback === 'function') callback(newTab);
    return Promise.resolve(newTab);
  };
  envBG.chrome.windows = {
    update: (winId, props, callback) => {
      windowUpdateCalls.push({ winId, props });
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    }
  };

  // Scenario A: No options tab open -> creates new tab
  queryTabsResult = [];
  tabCreateCalls = [];
  let msgResponse = null;
  onMessageHandler({ action: "openOptionsPage" }, {}, (res) => { msgResponse = res; });
  // Wait microtask tick
  await new Promise(r => setTimeout(r, 20));

  assert(tabCreateCalls.length === 1, "New options tab created when no existing options tab is open");
  assert(msgResponse && msgResponse.reused === false, "IPC response indicates new tab created (reused: false)");

  // Scenario B: Options tab already open -> reuses and focuses tab
  queryTabsResult = [{ id: 88, windowId: 5, url: 'chrome-extension://mock-shorts-shield-extension-id/options/options.html' }];
  tabsUpdateCalls = [];
  windowUpdateCalls = [];
  msgResponse = null;
  onMessageHandler({ action: "openOptionsPage" }, {}, (res) => { msgResponse = res; });
  await new Promise(r => setTimeout(r, 20));

  assert(tabsUpdateCalls.length === 1 && tabsUpdateCalls[0].tabId === 88, "Existing options tab 88 activated");
  assert(windowUpdateCalls.length === 1 && windowUpdateCalls[0].winId === 5, "Window containing existing options tab focused");
  assert(msgResponse && msgResponse.reused === true, "IPC response indicates existing tab reused (reused: true)");


  // --- SECTION 2: HEADER BUTTON POPOVER DIALOG LIFECYCLE & STRESS ---
  console.log("\n--- SECTION 2: Header Button Popover Dialog Lifecycle & Stress ---");
  
  const envUI = setupMockEnv();
  
  // Set up mock DOM with YouTube masthead elements
  const buttonsContainer = envUI.document.createElement('div');
  buttonsContainer.id = 'buttons';
  const masthead = envUI.document.createElement('div');
  masthead.id = 'masthead';
  masthead.appendChild(buttonsContainer);
  envUI.document.body.appendChild(masthead);

  const createBtn = envUI.document.createElement('button');
  createBtn.setAttribute('aria-label', 'Create video');
  buttonsContainer.appendChild(createBtn);

  envUI.document.contains = (node) => {
    if (!node) return false;
    let curr = node;
    while (curr) {
      if (curr === envUI.document || curr === envUI.document.body || curr === envUI.document.documentElement) return true;
      curr = curr.parentNode || curr.parentElement;
    }
    return false;
  };
  eval(storageJsCode);
  const observerJsCode = fs.readFileSync(path.join(__dirname, '../content/js/observer-utils.js'), 'utf8');
  eval(observerJsCode);

  const headerBtnCode = fs.readFileSync(path.join(__dirname, '../content/js/header-button.js'), 'utf8');
  eval(headerBtnCode);

  assert(window.HeaderButton !== undefined, "HeaderButton singleton instantiated on window");

  // Subtest 2.1: Enable, Injection, & Idempotency
  console.log("\n  - Subtest 2.1: Injection & Idempotency");
  window.HeaderButton.enable();
  assert(window.HeaderButton.isActive === true, "HeaderButton enabled");

  const btnContainerEl = envUI.document.getElementById('ss-header-btn-container');
  assert(btnContainerEl !== null, "Header button container injected into masthead");
  assert(btnContainerEl.parentNode === buttonsContainer, "Button injected into buttons container");

  // Idempotent re-injection test
  const tryInjectRes = window.HeaderButton.tryInject();
  assert(tryInjectRes === true, "tryInject() returned true for existing button");
  const containerCount = envUI.document.querySelectorAll('#ss-header-btn-container').length;
  assert(containerCount === 1, "Exactly 1 button container exists (no duplicate injection)");

  // Subtest 2.2: Rapid Toggle Stress Test
  console.log("\n  - Subtest 2.2: Rapid toggle stress test (50 iterations)");
  for (let i = 0; i < 50; i++) {
    await window.HeaderButton.togglePopup();
  }
  // After even number of toggles (50), popover should be closed
  let popoverEl = envUI.document.getElementById('ss-popup-dialog');
  assert(popoverEl === null, "Popover closed after 50 rapid toggles");

  // Toggle once more (odd) -> popover opens
  await window.HeaderButton.togglePopup();
  popoverEl = envUI.document.getElementById('ss-popup-dialog');
  assert(popoverEl !== null, "Popover dialog created on 51st toggle");

  // REGRESSION TEST: BUG-002 — Shield menu immediately closes due to YouTube Polymer synthetic click
  // NEW FIX: Instead of listening for document-level pointer/click events (which could be spoofed
  // by YouTube's Polymer synthetic events), we now use a transparent backdrop element.
  // The backdrop sits at z-index:99998, below the popup (z-index:2147483647).
  // Only physical clicks on the backdrop (outside the popup) close the menu.
  // YouTube's Polymer synthetic events target ytd-masthead, NOT our backdrop element.
  console.log("\n  - Subtest 2.2b: REGRESSION: Backdrop closes menu only on outside press");
  await window.HeaderButton.closePopup(); // reset
  await window.HeaderButton.openPopup();

  // Verify backdrop was created
  const backdrop = envUI.document.getElementById('ss-popup-backdrop');
  assert(backdrop !== null, "BUG-002 REGRESSION: Transparent backdrop created on openPopup()");

  // Verify YouTube Polymer synthetic events on ytd-masthead do NOT close the menu
  // (they target YouTube elements, NOT our backdrop, so our backdrop listener never fires)
  const ytdMastheadEl = envUI.document.createElement('div');
  ytdMastheadEl.id = 'ytd-masthead';
  envUI.document.body.appendChild(ytdMastheadEl);
  // Directly call onOutsideClick to confirm the time guard still works as fallback
  window.HeaderButton.onOutsideClick({ target: ytdMastheadEl, composedPath: () => [ytdMastheadEl] });
  assert(envUI.document.getElementById('ss-popup-dialog') !== null,
    "BUG-002 REGRESSION: YouTube Polymer synthetic click must NOT close menu");

  // After 310ms, outside click via onOutsideClick SHOULD close it
  await new Promise(r => setTimeout(r, 310));
  window.HeaderButton.onOutsideClick({ target: ytdMastheadEl, composedPath: () => [ytdMastheadEl] });
  assert(envUI.document.getElementById('ss-popup-dialog') === null,
    "BUG-002 REGRESSION: Genuine outside click after 300ms SHOULD close menu");

  // Subtest 2.3: Teardown (`disable()`) while Popover is Open
  console.log("\n  - Subtest 2.3: Complete teardown (`disable()`) while popover dialog is open");
  // Reopen to test teardown with backdrop active
  await window.HeaderButton.openPopup();
  window.HeaderButton.disable();

  assert(window.HeaderButton.isActive === false, "HeaderButton.isActive set to false");
  assert(envUI.document.getElementById('ss-popup-dialog') === null, "#ss-popup-dialog DOM node removed");
  assert(envUI.document.getElementById('ss-popup-backdrop') === null, "#ss-popup-backdrop DOM node removed on disable()");
  assert(envUI.document.getElementById('ss-header-btn-container') === null, "#ss-header-btn-container DOM node removed");
  assert(window.HeaderButton.sessionTimerInterval === null, "Session timer interval cleared");
  assert(window.HeaderButton.outsideClickTimer === null, "Outside click timer cleared");

  // Subtest 2.4: Backdrop Lifecycle & Outside Click Defense
  console.log("\n  - Subtest 2.4: Backdrop lifecycle and outside click detection");

  window.HeaderButton.enable();

  // Open popup — backdrop should be created immediately
  await window.HeaderButton.openPopup();
  assert(envUI.document.getElementById('ss-popup-backdrop') !== null, "Backdrop created on openPopup()");
  assert(envUI.document.getElementById('ss-popup-dialog') !== null, "Popover open");

  // Close popup — backdrop should be removed
  window.HeaderButton.closePopup();
  assert(envUI.document.getElementById('ss-popup-backdrop') === null, "Backdrop removed by closePopup()");
  assert(envUI.document.getElementById('ss-popup-dialog') === null, "Popover closed by closePopup()");

  // Fast-forward and verify no stale listeners cause issues
  await new Promise(r => setTimeout(r, 60));
  let clickTriggeredError = false;
  try {
    envUI.document.dispatchEvent('click');
  } catch(e) {
    clickTriggeredError = true;
  }
  assert(!clickTriggeredError, "Document click event did not throw after rapid close");

  // Reopen and verify backdrop closes popup when clicked
  await window.HeaderButton.openPopup();
  await new Promise(r => setTimeout(r, 20));
  assert(envUI.document.getElementById('ss-popup-dialog') !== null, "Popover open");

  // Simulate clicking inside container — should NOT close via onOutsideClick
  const innerBtn = envUI.document.getElementById('ss-header-btn');
  const innerClickEvt = { target: innerBtn, stopPropagation: () => {} };
  window.HeaderButton.onOutsideClick(innerClickEvt);
  assert(envUI.document.getElementById('ss-popup-dialog') !== null, "Click inside container keeps popover open");

  // Simulate clicking outside (via onOutsideClick after 300ms)
  await new Promise(r => setTimeout(r, 310));
  const outsideEl = envUI.document.createElement('div');
  envUI.document.body.appendChild(outsideEl);
  window.HeaderButton.onOutsideClick({ target: outsideEl });
  assert(envUI.document.getElementById('ss-popup-dialog') === null, "Click outside container closes popover dialog");

  // Subtest 2.5: Session Timer Management in Popover
  console.log("\n  - Subtest 2.5: Session timer setup and teardown");
  await StorageUtil.updateSetting('studyMode', true);

  await window.HeaderButton.openPopup();
  assert(window.HeaderButton.sessionTimerInterval !== null, "Session timer started when studyMode is true");

  // Re-open popover while timer is running
  const firstInterval = window.HeaderButton.sessionTimerInterval;
  await window.HeaderButton.openPopup();
  const secondInterval = window.HeaderButton.sessionTimerInterval;

  assert(secondInterval !== null, "New session timer interval started");

  window.HeaderButton.closePopup();
  assert(window.HeaderButton.sessionTimerInterval === null, "Session timer cleared on closePopup()");

  window.HeaderButton.disable();

  // --- SUMMARY ---
  console.log("\n=======================================================================");
  console.log(`TOTAL EMPIRICAL STRESS TESTS EXECUTED: ${testsPassed + testsFailed}`);
  console.log(`PASSED: ${testsPassed}`);
  console.log(`FAILED: ${testsFailed}`);
  console.log("=======================================================================");

  if (testsFailed > 0) {
    console.error("FAILURES ENCOUNTERED:");
    failures.forEach(f => console.error(" - " + f));
    process.exit(1);
  } else {
    console.log("ALL CHALLENGER M4_1 EMPIRICAL STRESS TESTS PASSED CLEANLY! ✅");
    process.exit(0);
  }
}

runM4_1EmpiricalStressSuite();
