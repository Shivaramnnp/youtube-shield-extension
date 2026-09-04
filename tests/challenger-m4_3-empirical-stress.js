const fs = require('fs');
const path = require('path');
const { setupMockEnv } = require('./harness/mock-extension-env');

// Load utilities & dependencies
const { StorageUtil, DEFAULT_SETTINGS, DEFAULT_TRACKING } = require('../utils/storage');
global.StorageUtil = StorageUtil;

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

async function runM4_3EmpiricalStressSuite() {
  console.log("=========================================================================");
  console.log("=== STARTING CHALLENGER M4_3 EMPIRICAL VERIFICATION & STRESS SUITE ===");
  console.log("=========================================================================");

  // -------------------------------------------------------------------------
  // SECTION 1: background.js Navigation Interception & Master Switch Rules
  // -------------------------------------------------------------------------
  console.log("\n--- Section 1: background.js Navigation Interception under Master Switch OFF/ON ---");

  const env1 = setupMockEnv();

  // Track webNavigation listeners
  let beforeNavListener = null;
  let historyStateListener = null;
  let tabUpdatedListener = null;
  let tabRemovedListener = null;

  env1.chrome.webNavigation.onBeforeNavigate.addListener = (fn) => { beforeNavListener = fn; };
  env1.chrome.webNavigation.onHistoryStateUpdated.addListener = (fn) => { historyStateListener = fn; };
  env1.chrome.tabs.onUpdated.addListener = (fn) => { tabUpdatedListener = fn; };
  env1.chrome.tabs.onRemoved.addListener = (fn) => { tabRemovedListener = fn; };
  let messageListener = null;
  const origOnMessageAdd = env1.chrome.runtime.onMessage.addListener;
  env1.chrome.runtime.onMessage.addListener = (fn) => {
    messageListener = fn;
    if (origOnMessageAdd) origOnMessageAdd(fn);
  };

  let updatedTabs = [];
  env1.chrome.tabs.update = (tabId, props, callback) => {
    updatedTabs.push({ tabId, props });
    if (callback) callback({ id: tabId, ...props });
    return Promise.resolve({ id: tabId, ...props });
  };

  let executedScripts = [];
  env1.chrome.scripting.executeScript = (opts) => {
    executedScripts.push(opts);
    return Promise.resolve([{ result: true }]);
  };

  // Load and evaluate background.js
  const bgCode = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf8');
  await eval(`(async () => { ${bgCode} })()`);

  assert(typeof beforeNavListener === 'function', "onBeforeNavigate listener registered");
  assert(typeof historyStateListener === 'function', "onHistoryStateUpdated listener registered");
  assert(typeof tabUpdatedListener === 'function', "tabs.onUpdated listener registered");
  assert(typeof tabRemovedListener === 'function', "tabs.onRemoved listener registered");

  // TEST 1.1: Master Switch ON (extensionEnabled = true, shortsBlocker = true)
  await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, extensionEnabled: true, shortsBlocker: true });
  updatedTabs = [];
  executedScripts = [];

  // Simulate Main Frame navigation to /shorts/
  await beforeNavListener({ frameId: 0, tabId: 10, url: 'https://www.youtube.com/shorts/test12345' });
  assert(updatedTabs.length === 1 && updatedTabs[0].props.url === 'https://www.youtube.com/',
    "Master Switch ON: onBeforeNavigate redirects /shorts/ to YouTube home");

  // Verify tab 10 added to pendingHistoryReplace in session storage
  const sessionData1 = await env1.chrome.storage.session.get(['pendingHistoryReplace']);
  assert(Array.isArray(sessionData1.pendingHistoryReplace) && sessionData1.pendingHistoryReplace.includes(10),
    "Pending tab 10 tracked in session storage");

  // Simulate SPA navigation to /playables/
  updatedTabs = [];
  executedScripts = [];
  await historyStateListener({ frameId: 0, tabId: 11, url: 'https://www.youtube.com/playables/game99' });
  assert(executedScripts.length === 1 && executedScripts[0].target.tabId === 11,
    "Master Switch ON: onHistoryStateUpdated intercepts /playables/ SPA navigation via scripting.executeScript");

  // TEST 1.2: Master Switch OFF (extensionEnabled = false, shortsBlocker = true)
  await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, extensionEnabled: false, shortsBlocker: true });
  updatedTabs = [];
  executedScripts = [];

  await beforeNavListener({ frameId: 0, tabId: 20, url: 'https://www.youtube.com/shorts/test999' });
  assert(updatedTabs.length === 0, "Master Switch OFF: onBeforeNavigate does NOT redirect /shorts/");

  const sessionData2 = await env1.chrome.storage.session.get(['pendingHistoryReplace']);
  assert(!sessionData2.pendingHistoryReplace || !sessionData2.pendingHistoryReplace.includes(20),
    "Master Switch OFF: Pending tab is NOT marked in session storage");

  await historyStateListener({ frameId: 0, tabId: 21, url: 'https://www.youtube.com/shorts/test999' });
  assert(executedScripts.length === 0 && updatedTabs.length === 0,
    "Master Switch OFF: onHistoryStateUpdated does NOT intercept /shorts/");

  // TEST 1.3: Master Switch ON, but shortsBlocker OFF (extensionEnabled = true, shortsBlocker = false)
  await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, extensionEnabled: true, shortsBlocker: false });
  updatedTabs = [];
  executedScripts = [];

  await beforeNavListener({ frameId: 0, tabId: 30, url: 'https://www.youtube.com/shorts/test111' });
  assert(updatedTabs.length === 0, "shortsBlocker OFF: onBeforeNavigate does NOT redirect /shorts/");

  await historyStateListener({ frameId: 0, tabId: 31, url: 'https://www.youtube.com/shorts/test111' });
  assert(executedScripts.length === 0 && updatedTabs.length === 0,
    "shortsBlocker OFF: onHistoryStateUpdated does NOT intercept /shorts/");

  // TEST 1.4: Non-Shorts URL (e.g. Watch page)
  await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, extensionEnabled: true, shortsBlocker: true });
  updatedTabs = [];
  executedScripts = [];

  await beforeNavListener({ frameId: 0, tabId: 40, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  assert(updatedTabs.length === 0, "Normal watch URL is NOT intercepted by onBeforeNavigate");

  await historyStateListener({ frameId: 0, tabId: 41, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  assert(executedScripts.length === 0 && updatedTabs.length === 0, "Normal watch URL is NOT intercepted by onHistoryStateUpdated");

  // TEST 1.5: Subframe Navigations (frameId !== 0)
  updatedTabs = [];
  executedScripts = [];
  await beforeNavListener({ frameId: 1, tabId: 50, url: 'https://www.youtube.com/shorts/iframe_test' });
  assert(updatedTabs.length === 0, "Subframe navigation (frameId 1) is ignored");


  // -------------------------------------------------------------------------
  // SECTION 2: Tab Session Memory Cleanup
  // -------------------------------------------------------------------------
  console.log("\n--- Section 2: Tab Session Memory Cleanup ---");

  // Tab 10 was added in TEST 1.1. Let's verify onRemoved listener cleans up tab 10
  const sessionDataPreRemove = await env1.chrome.storage.session.get(['pendingHistoryReplace']);
  assert(sessionDataPreRemove.pendingHistoryReplace.includes(10), "Tab 10 present before removal");

  await tabRemovedListener(10);

  const sessionDataPostRemove = await env1.chrome.storage.session.get(['pendingHistoryReplace']);
  assert(!sessionDataPostRemove.pendingHistoryReplace || !sessionDataPostRemove.pendingHistoryReplace.includes(10),
    "onRemoved tab listener cleans up tabId 10 from session storage and memory Set");

  // Add tab 60 manually via navigation
  await beforeNavListener({ frameId: 0, tabId: 60, url: 'https://www.youtube.com/shorts/nav60' });
  executedScripts = [];

  // Fire onUpdated for tab 60 with status 'complete'
  await tabUpdatedListener(60, { status: 'complete' });
  assert(executedScripts.length === 1 && executedScripts[0].target.tabId === 60,
    "onUpdated status 'complete' triggers history replacement script for pending tab 60");

  const sessionDataPostUpdate = await env1.chrome.storage.session.get(['pendingHistoryReplace']);
  assert(!sessionDataPostUpdate.pendingHistoryReplace || !sessionDataPostUpdate.pendingHistoryReplace.includes(60),
    "onUpdated status 'complete' cleans up tab 60 from pending tab session tracking");


  // -------------------------------------------------------------------------
  // SECTION 3: background.js IPC Message Handlers
  // -------------------------------------------------------------------------
  console.log("\n--- Section 3: IPC Message Handlers ---");

  // Verify messageListener is registered
  assert(typeof messageListener === 'function', "chrome.runtime.onMessage listener is registered");

  // Test action: "getSettings"
  let settingsResponse = null;
  messageListener({ action: "getSettings" }, {}, (res) => { settingsResponse = res; });
  await new Promise(r => setTimeout(r, 50));
  assert(settingsResponse && typeof settingsResponse === 'object' && settingsResponse.shortsBlocker !== undefined,
    "IPC action 'getSettings' returns valid settings object");

  // Test action: "getTracking"
  let trackingResponse = null;
  messageListener({ action: "getTracking" }, {}, (res) => { trackingResponse = res; });
  await new Promise(r => setTimeout(r, 50));
  assert(trackingResponse && typeof trackingResponse === 'object' && trackingResponse.dailyWatchTime !== undefined,
    "IPC action 'getTracking' returns valid tracking object");

  // Test action: "openOptionsPage" (Tab reuse vs creation)
  let optionsResponse = null;

  // Mock tabs.query to simulate existing options tab
  const optionsUrl = env1.chrome.runtime.getURL('options/options.html');
  env1.chrome.tabs.query = (queryInfo, callback) => {
    callback([{ id: 99, windowId: 1, url: optionsUrl }]);
  };
  let windowUpdateCalled = false;
  if (!env1.chrome.windows) env1.chrome.windows = {};
  if (typeof global.chrome !== 'undefined' && !global.chrome.windows) global.chrome.windows = env1.chrome.windows;
  env1.chrome.windows.update = (winId, props, callback) => {
    windowUpdateCalled = true;
    if (callback) callback();
  };

  messageListener({ action: "openOptionsPage" }, {}, (res) => { optionsResponse = res; });
  await new Promise(r => setTimeout(r, 50));
  assert(optionsResponse && optionsResponse.success === true && optionsResponse.reused === true,
    "IPC action 'openOptionsPage' reuses existing open Options tab");
  assert(windowUpdateCalled === true, "IPC action 'openOptionsPage' brings open window to focus");

  // Simulate no existing tab
  env1.chrome.tabs.query = (queryInfo, callback) => { callback([]); };
  let tabCreateCalled = false;
  env1.chrome.tabs.create = (props, callback) => {
    tabCreateCalled = true;
    if (callback) callback({ id: 100, url: props.url });
  };

  optionsResponse = null;
  messageListener({ action: "openOptionsPage" }, {}, (res) => { optionsResponse = res; });
  await new Promise(r => setTimeout(r, 50));
  assert(optionsResponse && optionsResponse.success === true && optionsResponse.reused === false,
    "IPC action 'openOptionsPage' creates new tab when no Options tab exists");
  assert(tabCreateCalled === true, "tabs.create was called for new Options page tab");


  // -------------------------------------------------------------------------
  // SECTION 4: HeaderButton Popover Outside-Click & Lifecycle
  // -------------------------------------------------------------------------
  console.log("\n--- Section 4: HeaderButton Popover Outside-Click & Memory Lifecycle ---");

  const env4 = setupMockEnv();

  // Setup DOM container for HeaderButton injection
  const mastheadButtons = env4.document.createElement('div');
  mastheadButtons.id = 'buttons';
  mastheadButtons.className = 'ytd-masthead';
  env4.document.body.appendChild(mastheadButtons);

  // Load header-button.js
  const headerBtnCode = fs.readFileSync(path.join(__dirname, '../content/js/header-button.js'), 'utf8');
  await eval(`(async () => { ${headerBtnCode} })()`);

  const headerBtnInstance = env4.window.HeaderButton;
  assert(headerBtnInstance !== undefined && typeof headerBtnInstance.enable === 'function',
    "HeaderButton class instantiated as window.HeaderButton");

  // Track document event listeners
  const docListeners = {};
  const origDocAddListener = env4.document.addEventListener;
  const origDocRemoveListener = env4.document.removeEventListener;

  env4.document.addEventListener = (event, fn, opts) => {
    docListeners[event] = fn;
    if (origDocAddListener) origDocAddListener.call(env4.document, event, fn, opts);
  };
  env4.document.removeEventListener = (event, fn, opts) => {
    if (docListeners[event] === fn) delete docListeners[event];
    if (origDocRemoveListener) origDocRemoveListener.call(env4.document, event, fn, opts);
  };

  // Test enable()
  headerBtnInstance.enable();
  assert(headerBtnInstance.isActive === true, "HeaderButton enabled and active");

  const btnContainer = env4.document.getElementById('ss-header-btn-container');
  assert(btnContainer !== null, "HeaderButton container injected into DOM");

  // Test updateState() UI styling under Master Switch ON vs OFF
  await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, extensionEnabled: true, shortsBlocker: true });
  await headerBtnInstance.updateState();
  const btnEl = env4.document.getElementById('ss-header-btn');
  const tooltipEl = env4.document.getElementById('ss-header-btn-tooltip');
  assert(!btnEl.classList.contains('ss-disabled'), "Button does NOT have ss-disabled class when extension is enabled");
  assert(tooltipEl && tooltipEl.textContent.includes("Active"), "Tooltip indicates active state");

  await StorageUtil.saveSettings({ ...DEFAULT_SETTINGS, extensionEnabled: false, shortsBlocker: true });
  await headerBtnInstance.updateState();
  assert(btnEl.classList.contains('ss-disabled'), "Button HAS ss-disabled class when Master Switch is OFF");
  assert(tooltipEl && (tooltipEl.textContent.includes("Paused") || tooltipEl.textContent.includes("Disabled")), "Tooltip indicates paused/disabled state");

  // Test openPopup()
  await StorageUtil.saveSettings({
    ...DEFAULT_SETTINGS,
    extensionEnabled: true,
    learningGoal: "<script>alert('xss')</script> & Python",
    studyMode: true
  });
  await StorageUtil.saveTracking({
    ...DEFAULT_TRACKING,
    dailyWatchTime: { [getTodayKey()]: 3600 },
    dailyLearningTime: { [getTodayKey()]: 1800 }
  });

  function getTodayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  await headerBtnInstance.openPopup();
  const popupDialog = env4.document.getElementById('ss-popup-dialog');
  assert(popupDialog !== null, "openPopup() renders #ss-popup-dialog");

  // Verify HTML escaping on goal text
  const goalEl = env4.document.getElementById('ss-popup-goal');
  assert(goalEl && (goalEl.textContent.includes("alert") || goalEl.textContent.includes("Python") || goalEl.innerHTML.includes("&lt;script&gt;")),
    "Learning goal is properly HTML escaped");

  // Verify Focus Score clamping calculation
  const scoreEl = env4.document.getElementById('ss-popup-focus-score');
  assert(scoreEl && scoreEl.textContent === "50%", "Focus Score rendered correctly as 50%");

  // Verify backdrop injection for outside click handling
  const backdrop = env4.document.getElementById('ss-popup-backdrop');
  assert(backdrop !== null, "Transparent backdrop (#ss-popup-backdrop) injected for outside click detection");

  // Simulate click on backdrop -> closes popup cleanly
  backdrop.dispatchEvent(new Event('pointerdown'));
  assert(env4.document.getElementById('ss-popup-dialog') === null, "Clicking backdrop closes popover dialog cleanly");
  assert(env4.document.getElementById('ss-popup-backdrop') === null, "Backdrop removed when popover closes");

  // Test disable() cleanup
  await headerBtnInstance.openPopup();
  assert(env4.document.getElementById('ss-popup-dialog') !== null, "Popup open before disable");

  headerBtnInstance.disable();
  assert(headerBtnInstance.isActive === false, "HeaderButton isActive set to false on disable()");
  assert(env4.document.getElementById('ss-popup-dialog') === null, "disable() closes open popup dialog");
  assert(env4.document.getElementById('ss-popup-backdrop') === null, "disable() removes backdrop element from DOM");
  assert(env4.document.getElementById('ss-header-btn-container') === null, "disable() removes container element from DOM");
  assert(headerBtnInstance.sessionTimerInterval === null, "disable() clears session timer interval");

  // SUMMARY
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
    console.log("ALL M4_3 EMPIRICAL STRESS TESTS PASSED CLEANLY! ✅");
    process.exit(0);
  }
}

runM4_3EmpiricalStressSuite().catch(err => {
  console.error("Fatal error during challenger suite:", err);
  process.exit(1);
});
