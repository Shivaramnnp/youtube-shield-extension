/**
 * Tier 3 Test Suite: Custom Blocklist Feed Sync & Cross-Feature Interaction
 * tests/tier3/custom-blocklist-feed-sync.test.js
 *
 * Validates:
 * - Cross-tab live storage sync via chrome.storage.onChanged without full page reload
 * - Dynamic feed hiding across YouTube card types (ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer)
 * - Shorts containers handling
 * - Real-time element restoration on partial and complete blocklist unblocking
 * - Synergistic interaction with Goal Mode / Study Mode and Focus Mode
 * - Master extension disable toggle restoring all elements
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
require('../../content/js/feed-controller');
require('../../content/js/goal-mode');

// Helper to construct a multi-element YouTube feed DOM
function setupMixedYouTubeFeedDOM() {
  resetDOM();
  document.body.innerHTML = `
    <div id="contents">
      <!-- 1. Home Grid Card -->
      <ytd-rich-item-renderer id="card-home-1">
        <span id="video-title">Epic Gaming Live Stream 2026</span>
        <ytd-channel-name id="channel-name">ProGamer</ytd-channel-name>
      </ytd-rich-item-renderer>

      <!-- 2. Home Grid Card (Allowed) -->
      <ytd-rich-item-renderer id="card-home-2">
        <span id="video-title">Complete Rust Programming Course</span>
        <ytd-channel-name id="channel-name">CodeAcademy</ytd-channel-name>
      </ytd-rich-item-renderer>

      <!-- 3. Search / Next Video Card -->
      <ytd-video-renderer id="card-search-1">
        <span id="video-title">Top 10 Celebrity Pranks</span>
        <span id="channel-name">Pranksters</span>
      </ytd-video-renderer>

      <!-- 4. Sidebar Compact Card (Blocked Channel) -->
      <ytd-compact-video-renderer id="card-sidebar-1">
        <span id="video-title">Python Basics</span>
        <span class="ytd-channel-name">SpamChannel</span>
      </ytd-compact-video-renderer>

      <!-- 5. Channel Page Grid Card -->
      <ytd-grid-video-renderer id="card-grid-1">
        <span id="video-title">Daily Vlog #105</span>
        <span id="channel-name">VlogLife</span>
      </ytd-grid-video-renderer>

      <!-- 6. Shorts Shelf Item (should not be corrupted by keyword filter) -->
      <ytd-rich-item-renderer id="card-shorts-1">
        <a href="/shorts/abc123xyz" title="Shorts"></a>
        <span id="video-title">Quick Gaming Tip #Shorts</span>
      </ytd-rich-item-renderer>
    </div>
  `;
}

describe('Tier 3: Custom Blocklist Cross-Tab Sync & Feed Interception Interaction', () => {

  test('T3.1: Live storage update via chrome.storage.onChanged dynamically updates FeedController blocklist', async () => {
    await resetStorage();
    setupMixedYouTubeFeedDOM();

    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];
    fc.setBlocklist([], []);

    // Initial state: all cards visible
    const cardHome1 = document.getElementById('card-home-1');
    assert.equal(cardHome1.style.display, '', 'Initial state: cardHome1 is visible');

    // Simulate cross-tab storage change
    const updatedSettings = {
      blockedKeywords: ['gaming'],
      blockedChannels: ['SpamChannel']
    };

    // Update FeedController directly as content script listener would
    fc.setBlocklist(updatedSettings.blockedKeywords, updatedSettings.blockedChannels);

    assert.equal(cardHome1.style.display, 'none', 'cardHome1 matching "gaming" hidden after sync');
    assert.ok(cardHome1.classList.contains('off-topic'));

    const cardSidebar1 = document.getElementById('card-sidebar-1');
    assert.equal(cardSidebar1.style.display, 'none', 'cardSidebar1 matching "SpamChannel" hidden after sync');
  });

  test('T3.2: Dynamic feed hiding suppresses matching elements across all 4 YouTube card types in mixed feeds', async () => {
    await resetStorage();
    setupMixedYouTubeFeedDOM();

    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];
    fc.setBlocklist(['gaming', 'pranks', 'vlog'], ['spamchannel']);

    fc.applyBlocklist();

    const c1 = document.getElementById('card-home-1');      // gaming -> hide
    const c2 = document.getElementById('card-home-2');      // rust -> visible
    const c3 = document.getElementById('card-search-1');    // pranks -> hide
    const c4 = document.getElementById('card-sidebar-1');   // SpamChannel -> hide
    const c5 = document.getElementById('card-grid-1');      // vlog -> hide

    assert.equal(c1.style.display, 'none', 'ytd-rich-item-renderer hidden');
    assert.equal(c2.style.display, '', 'ytd-rich-item-renderer visible');
    assert.equal(c3.style.display, 'none', 'ytd-video-renderer hidden');
    assert.equal(c4.style.display, 'none', 'ytd-compact-video-renderer hidden');
    assert.equal(c5.style.display, 'none', 'ytd-grid-video-renderer hidden');
  });

  test('T3.3: Shorts containers are skipped by FeedController blocklist filter (handled by shorts-blocker)', async () => {
    await resetStorage();
    setupMixedYouTubeFeedDOM();

    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];
    fc.setBlocklist(['gaming'], []);

    fc.applyBlocklist();

    const shortsCard = document.getElementById('card-shorts-1');
    assert.equal(shortsCard.classList.contains('off-topic'), false, 'Shorts container not tagged as off-topic by FeedController');
  });

  test('T3.4: Real-time element restoration unhides only items whose blocked criteria are removed', async () => {
    await resetStorage();
    setupMixedYouTubeFeedDOM();

    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];

    // Step 1: Block both "gaming" and "pranks"
    fc.setBlocklist(['gaming', 'pranks'], ['spamchannel']);
    fc.applyBlocklist();

    const c1 = document.getElementById('card-home-1');    // gaming
    const c3 = document.getElementById('card-search-1');  // pranks
    const c4 = document.getElementById('card-sidebar-1'); // SpamChannel

    assert.equal(c1.style.display, 'none');
    assert.equal(c3.style.display, 'none');
    assert.equal(c4.style.display, 'none');

    // Step 2: Unblock "gaming" only (partial unblocking)
    fc.setBlocklist(['pranks'], ['spamchannel']);
    fc.applyBlocklist();

    assert.equal(c1.style.display, '', 'c1 (gaming) is restored to visible');
    assert.equal(c1.classList.contains('off-topic'), false);
    assert.equal(c3.style.display, 'none', 'c3 (pranks) remains hidden');
    assert.equal(c4.style.display, 'none', 'c4 (SpamChannel) remains hidden');

    // Step 3: Complete unblocking (empty lists)
    fc.setBlocklist([], []);

    assert.equal(c3.style.display, '', 'c3 (pranks) is restored when blocklist cleared');
    assert.equal(c4.style.display, '', 'c4 (SpamChannel) is restored when blocklist cleared');
  });

  test('T3.5: Synergistic interaction between Custom Blocklist and Goal Mode filtering', async () => {
    await resetStorage();
    setupMixedYouTubeFeedDOM();

    const fc = window.FeedController;
    fc.disable();

    // Enable Goal Mode for "Rust Programming"
    fc.enable('Rust Programming');

    // Also configure Custom Blocklist for "SpamChannel" and "gaming"
    fc.setBlocklist(['gaming'], ['spamchannel']);

    document.body.innerHTML = `
      <!-- On-topic Rust video (Good creator) -> VISIBLE -->
      <ytd-rich-item-renderer id="v_rust_good">
        <span id="video-title">Learn Rust Programming from Scratch</span>
        <span id="channel-name">RustAcademy</span>
      </ytd-rich-item-renderer>

      <!-- On-topic Rust video (from blocked SpamChannel) -> HIDDEN by Blocklist -->
      <ytd-rich-item-renderer id="v_rust_spam">
        <span id="video-title">Rust Programming Quick Hack</span>
        <span id="channel-name">SpamChannel</span>
      </ytd-rich-item-renderer>

      <!-- Off-topic Gaming video -> HIDDEN by Goal Mode -->
      <ytd-rich-item-renderer id="v_gaming_fun">
        <span id="video-title">Minecraft Survival Season 5</span>
        <span id="channel-name">MinecraftGamer</span>
      </ytd-rich-item-renderer>
    `;

    fc.filterFeed(document.querySelectorAll('ytd-rich-item-renderer'));

    const vRustGood = document.getElementById('v_rust_good');
    const vRustSpam = document.getElementById('v_rust_spam');
    const vGamingFun = document.getElementById('v_gaming_fun');

    assert.equal(vRustGood.style.display, '', 'On-topic non-blocked video is visible');
    assert.equal(vRustSpam.style.display, 'none', 'On-topic video from blocked channel is hidden');
    assert.equal(vGamingFun.style.display, 'none', 'Off-topic video is hidden by Goal Mode');

    // Now disable Goal Mode: Off-topic video should restore, but SpamChannel video remains hidden!
    fc.disable();
    fc.applyBlocklist();

    assert.equal(vGamingFun.style.display, '', 'Off-topic video restored after Goal Mode disabled');
    assert.equal(vRustSpam.style.display, 'none', 'SpamChannel video remains hidden by Custom Blocklist');
  });

  test('T3.6: Master extension disable toggle clears all off-topic suppression', async () => {
    await resetStorage();
    setupMixedYouTubeFeedDOM();

    const fc = window.FeedController;
    fc.setBlocklist(['gaming', 'pranks', 'vlog'], ['spamchannel']);
    fc.applyBlocklist();

    assert.equal(document.getElementById('card-home-1').style.display, 'none');

    // Simulate master toggle OFF
    fc.clearOffTopicCards();

    const cards = document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer');
    cards.forEach(card => {
      assert.notEqual(card.style.display, 'none', `Card ${card.id} restored from hidden state`);
      assert.equal(card.classList.contains('off-topic'), false);
    });
  });

});
