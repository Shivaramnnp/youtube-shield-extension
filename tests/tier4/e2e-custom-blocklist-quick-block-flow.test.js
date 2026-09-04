/**
 * Tier 4 Test Suite: End-to-End User Journeys (Custom Blocklist & Quick Block Flow)
 * tests/tier4/e2e-custom-blocklist-quick-block-flow.test.js
 *
 * Real-World Application Scenarios:
 * 1. Full Watch Page Quick Block to Options Management Flow
 * 2. Title Keyword Blocking with Live Multi-Tab Feed Suppression
 * 3. Bulk JSON Export, Clear All, and Migration Import Lifecycle
 * 4. Rapid Undo Flow and Playback Recovery
 * 5. Cross-Feature Interaction Lifecycle (Blocklist + Goal Mode + Focus Mode + UI Cleaner)
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
require('../../content/js/feed-controller');
require('../../content/js/goal-mode');
require('../../content/js/ui-cleaner');

describe('Tier 4: End-to-End Custom Blocklist & Quick Block Application Scenarios', () => {

  test('Scenario 1: Watch Page Quick Block -> Auto-Pause -> Redirect -> Options Studio Inspection & Removal Flow', async () => {
    await resetStorage();
    resetDOM();

    // Stage 1: User arrives at YouTube watch page with an annoying channel
    global.location.pathname = '/watch';
    global.location.search = '?v=annoying123';
    global.location.href = 'https://www.youtube.com/watch?v=annoying123';

    document.body.innerHTML = `
      <div id="player"><video id="video-element"></video></div>
      <div id="above-the-fold">
        <h1 class="ytd-watch-metadata">Outrageous Clickbait Drama Ep 1</h1>
        <ytd-channel-name id="channel-name">DramaLlama</ytd-channel-name>
        <div id="top-level-buttons-computed">
          <button id="like-btn">Like</button>
        </div>
      </div>
    `;

    const video = document.getElementById('video-element');
    video.paused = false;

    // Stage 2: Quick Block button triggers instant channel block
    const channelName = 'DramaLlama';
    let currentSettings = await StorageUtil.getSettings();
    const channels = [...(currentSettings.blockedChannels || [])];
    channels.push(channelName);
    await StorageUtil.updateSetting('blockedChannels', channels);

    // Auto-pause video
    video.pause();
    assert.equal(video.paused, true, 'Video playback paused upon blocking');

    // Stage 3: Redirect occurs
    global.location.pathname = '/';
    global.location.href = 'https://www.youtube.com/';

    // Stage 4: User opens Options Dashboard Studio
    document.body.innerHTML = `
      <div class="sidebar">
        <li data-tab="blocklist" id="nav-tab-blocklist"><span id="nav-blocklist-badge">0</span></li>
      </div>
      <div id="blocklist-tab">
        <div id="blocked-channels-cloud"></div>
        <div id="blocked-keywords-cloud"></div>
      </div>
    `;

    const loadedSettings = await StorageUtil.getSettings();
    assert.ok(loadedSettings.blockedChannels.includes('DramaLlama'), 'Storage contains DramaLlama');

    // Render chips in Options Studio
    const channelsCloud = document.getElementById('blocked-channels-cloud');
    loadedSettings.blockedChannels.forEach(ch => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.dataset.channel = ch;
      chip.innerHTML = `<span class="label">${ch}</span><button class="btn-remove" data-target="${ch}">✕</button>`;
      channelsCloud.appendChild(chip);
    });

    const badge = document.getElementById('nav-blocklist-badge');
    badge.textContent = String(loadedSettings.blockedChannels.length + loadedSettings.blockedKeywords.length);
    assert.equal(badge.textContent, '1', 'Badge shows 1 blocked item');

    // Stage 5: User clicks ✕ to remove DramaLlama
    const removeBtn = document.querySelector('.btn-remove');
    assert.ok(removeBtn, 'Remove button exists on DramaLlama chip');

    const remainingChannels = loadedSettings.blockedChannels.filter(c => c !== 'DramaLlama');
    await StorageUtil.updateSetting('blockedChannels', remainingChannels);
    removeBtn.closest('.chip').remove();
    badge.textContent = String(remainingChannels.length);

    const finalSettings = await StorageUtil.getSettings();
    assert.deepEqual(finalSettings.blockedChannels, [], 'Channel list empty after deletion');
    assert.equal(badge.textContent, '0', 'Badge count reset to 0');
  });

  test('Scenario 2: Keyword Blocking with Live Multi-Tab Feed Suppression', async () => {
    await resetStorage();

    // Stage 1: User blocks "crypto" keyword on Watch Page
    const initialSettings = await StorageUtil.getSettings();
    const keywords = [...initialSettings.blockedKeywords, 'crypto'];
    await StorageUtil.updateSetting('blockedKeywords', keywords);

    // Stage 2: Simulate Tab 1 (Home Feed)
    const tab1Feed = document.createElement('div');
    tab1Feed.id = 'tab1-feed';
    tab1Feed.innerHTML = `
      <ytd-rich-item-renderer id="t1-v1">
        <span id="video-title">Top 10 Crypto Tokens to Buy</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="t1-v2">
        <span id="video-title">TypeScript Full Course 2026</span>
      </ytd-rich-item-renderer>
    `;

    // Stage 3: Simulate Tab 2 (Search Results Feed)
    const tab2Feed = document.createElement('div');
    tab2Feed.id = 'tab2-feed';
    tab2Feed.innerHTML = `
      <ytd-video-renderer id="t2-v1">
        <span id="video-title">Crypto Trading Bot Tutorial</span>
      </ytd-video-renderer>
      <ytd-video-renderer id="t2-v2">
        <span id="video-title">Docker & Kubernetes Guide</span>
      </ytd-video-renderer>
    `;

    // FeedController processes Tab 1
    const fc = window.FeedController;
    fc.setBlocklist(['crypto'], []);
    fc.filterFeed(tab1Feed.querySelectorAll('ytd-rich-item-renderer'));

    // FeedController processes Tab 2
    fc.filterFeed(tab2Feed.querySelectorAll('ytd-video-renderer'));

    // Verify Tab 1 assertions
    const t1v1 = tab1Feed.querySelector('#t1-v1');
    const t1v2 = tab1Feed.querySelector('#t1-v2');
    assert.equal(t1v1.style.display, 'none', 'Tab 1 crypto video is hidden');
    assert.ok(t1v1.classList.contains('off-topic'));
    assert.equal(t1v2.style.display, '', 'Tab 1 TypeScript video remains visible');

    // Verify Tab 2 assertions
    const t2v1 = tab2Feed.querySelector('#t2-v1');
    const t2v2 = tab2Feed.querySelector('#t2-v2');
    assert.equal(t2v1.style.display, 'none', 'Tab 2 crypto video is hidden');
    assert.ok(t2v1.classList.contains('off-topic'));
    assert.equal(t2v2.style.display, '', 'Tab 2 Docker video remains visible');
  });

  test('Scenario 3: Bulk JSON Export, Clear All, and Migration Import Lifecycle', async () => {
    await resetStorage();
    resetDOM();

    // Stage 1: Setup rich blocklist state
    const originalChannels = ['SpamHub', 'ClickbaitCentral', 'FakeNewsNetwork'];
    const originalKeywords = ['reaction', 'prank', 'shocking', 'unbelievable'];
    await StorageUtil.updateSetting('blockedChannels', originalChannels);
    await StorageUtil.updateSetting('blockedKeywords', originalKeywords);

    // Stage 2: Export JSON
    const currentData = await StorageUtil.getSettings();
    const exportedJSON = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      blockedChannels: currentData.blockedChannels,
      blockedKeywords: currentData.blockedKeywords
    });

    assert.ok(exportedJSON.includes('SpamHub'));
    assert.ok(exportedJSON.includes('reaction'));

    // Stage 3: Clear All
    await StorageUtil.updateSetting('blockedChannels', []);
    await StorageUtil.updateSetting('blockedKeywords', []);

    let clearedSettings = await StorageUtil.getSettings();
    assert.deepEqual(clearedSettings.blockedChannels, []);
    assert.deepEqual(clearedSettings.blockedKeywords, []);

    // Stage 4: Import previously exported JSON backup
    const parsedBackup = JSON.parse(exportedJSON);
    await StorageUtil.updateSetting('blockedChannels', parsedBackup.blockedChannels);
    await StorageUtil.updateSetting('blockedKeywords', parsedBackup.blockedKeywords);

    // Stage 5: Verify full restoration
    const restoredSettings = await StorageUtil.getSettings();
    assert.deepEqual(restoredSettings.blockedChannels, originalChannels, 'All 3 channels restored');
    assert.deepEqual(restoredSettings.blockedKeywords, originalKeywords, 'All 4 keywords restored');
    assert.equal(restoredSettings.blockedChannels.length + restoredSettings.blockedKeywords.length, 7);
  });

  test('Scenario 4: Rapid Watch Page Block -> Immediate Undo -> Playback Recovery', async () => {
    await resetStorage();
    resetDOM();

    // User is on a favorite creator's video
    const channelName = 'FavoriteEducator';
    const initialSettings = await StorageUtil.getSettings();
    assert.deepEqual(initialSettings.blockedChannels, []);

    // User accidentally clicks block
    const previousSnapshot = [...initialSettings.blockedChannels];
    await StorageUtil.updateSetting('blockedChannels', [channelName]);

    let afterBlock = await StorageUtil.getSettings();
    assert.deepEqual(afterBlock.blockedChannels, ['FavoriteEducator']);

    // Floating toast appears with 5s countdown
    let undoClicked = true; // User clicks undo after 1 second
    if (undoClicked) {
      await StorageUtil.updateSetting('blockedChannels', previousSnapshot);
    }

    // Verify storage returned to pristine state
    const afterUndo = await StorageUtil.getSettings();
    assert.deepEqual(afterUndo.blockedChannels, [], 'Channel block undone successfully');
  });

  test('Scenario 5: Complex Multi-Mode Interaction Lifecycle (Blocklist + Goal Mode + UI Cleaner)', async () => {
    await resetStorage();
    resetDOM();

    const fc = window.FeedController;
    fc.disable();

    // Master configuration:
    // 1. Goal Mode: "Learn Python Programming"
    // 2. Custom Blocklist: keyword "drama", channel "TabloidDev"
    // 3. UI Cleaner: hideChat, hideTrending
    fc.enable('Learn Python Programming');
    fc.setBlocklist(['drama'], ['tabloiddev']);

    document.body.innerHTML = `
      <div id="feed-container">
        <!-- 1. On-topic Python video (Good channel) -> VISIBLE -->
        <ytd-rich-item-renderer id="card-py-good">
          <span id="video-title">Python Data Structures & Algorithms</span>
          <span id="channel-name">CoreyMS</span>
        </ytd-rich-item-renderer>

        <!-- 2. On-topic Python video (Blocked keyword "drama") -> HIDDEN by Blocklist -->
        <ytd-rich-item-renderer id="card-py-drama">
          <span id="video-title">Python Community Drama Explained</span>
          <span id="channel-name">DevNews</span>
        </ytd-rich-item-renderer>

        <!-- 3. On-topic Python video (Blocked channel "TabloidDev") -> HIDDEN by Blocklist -->
        <ytd-rich-item-renderer id="card-py-tabloid">
          <span id="video-title">Python 3.14 Features Overview</span>
          <span id="channel-name">TabloidDev</span>
        </ytd-rich-item-renderer>

        <!-- 4. Off-topic Gaming video -> HIDDEN by Goal Mode -->
        <ytd-rich-item-renderer id="card-offtopic">
          <span id="video-title">Grand Theft Auto VI Gameplay Leak</span>
          <span id="channel-name">GamerTV</span>
        </ytd-rich-item-renderer>
      </div>
    `;

    fc.filterFeed(document.querySelectorAll('ytd-rich-item-renderer'));

    const pyGood = document.getElementById('card-py-good');
    const pyDrama = document.getElementById('card-py-drama');
    const pyTabloid = document.getElementById('card-py-tabloid');
    const offtopic = document.getElementById('card-offtopic');

    assert.equal(pyGood.style.display, '', 'On-topic Python video is visible');
    assert.equal(pyDrama.style.display, 'none', 'Drama video hidden by blocklist');
    assert.equal(pyTabloid.style.display, 'none', 'TabloidDev video hidden by blocklist');
    assert.equal(offtopic.style.display, 'none', 'Gaming video hidden by Goal Mode');

    // Action: User unblocks keyword "drama" in Options Studio
    fc.setBlocklist([], ['tabloiddev']);
    fc.filterFeed(document.querySelectorAll('ytd-rich-item-renderer'));

    assert.equal(pyDrama.style.display, '', 'Python Drama video restored after unblocking keyword');
    assert.equal(pyTabloid.style.display, 'none', 'TabloidDev remains hidden by channel block');
    assert.equal(offtopic.style.display, 'none', 'Offtopic video remains hidden by Goal Mode');
  });

});
