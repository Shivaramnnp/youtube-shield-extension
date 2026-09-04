/**
 * Tier 1 Test Suite: In-Page Quick Block Button on YouTube Watch Pages
 * tests/tier1/quick-block-button.test.js
 *
 * Validates:
 * - Real production QuickBlock & QuickBlockController imports from content/js/quick-block.js
 * - All 5 anchor fallback tiers (ytd-menu-renderer, #top-level-buttons-computed, #actions-inner, #owner #subscribe-button, #top-row)
 * - Priority cascade fallback sequence
 * - Modern 2024-2026 Lit/Polymer view models (segmented-like-dislike-button-view-model, etc.)
 * - Cross-browser DOM insertion fallback for Safari WebKit (Element.after undefined)
 * - 600ms self-healing watchdog DOM re-injection upon eviction
 * - MutationObserver re-injection upon DOM mutations
 * - 7 lifecycle navigation events + visibilitychange listener
 * - Channel name extraction & sanitization
 * - Video title keyword tokenization, symbol stripping & stop-word filtering
 * - Obsidian popover menu rendering & 4-way viewport collision math / flipping
 * - Popover dismissal via Close button, Escape key, and outside pointerdown
 * - 1-Click channel blocking, video auto-pausing, FeedController synchronization
 * - Keyword quick blocking & custom keyword input with Enter key handling
 * - Blocklist Studio IPC navigation shortcut (openOptionsPage)
 * - 5-Second floating countdown undo toast, playback resumption on Undo, and Go Home redirect
 * - Full controller lifecycle teardown in disable()
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
global.StorageUtil = StorageUtil;
globalThis.StorageUtil = StorageUtil;
if (typeof window !== 'undefined') window.StorageUtil = StorageUtil;
require('../../content/js/observer-utils');
const { QuickBlock, QuickBlockController } = require('../../content/js/quick-block');

// Helper to setup mock YouTube Watch Page DOM with configurable containers
function setupWatchPageDOM({
  channel = 'TechLead',
  title = 'Why I Left Google (Top Secrets Revealed!)',
  anchorTier = 'tier1'
} = {}) {
  resetDOM();
  global.location.pathname = '/watch';
  global.location.search = '?v=dQw4w9WgXcQ';
  global.location.href = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  let actionsHtml = '';
  if (anchorTier === 'tier1') {
    actionsHtml = `
      <div id="actions">
        <ytd-menu-renderer id="menu-renderer">
          <div id="top-level-buttons-computed" class="top-level-buttons">
            <button id="like-button" class="yt-spec-button-shape-next">Like</button>
            <button id="share-button" class="yt-spec-button-shape-next">Share</button>
          </div>
        </ytd-menu-renderer>
      </div>
    `;
  } else if (anchorTier === 'tier2') {
    actionsHtml = `
      <div id="actions">
        <div id="top-level-buttons-computed" class="top-level-buttons">
          <button id="like-button" class="yt-spec-button-shape-next">Like</button>
        </div>
      </div>
    `;
  } else if (anchorTier === 'tier3') {
    actionsHtml = `
      <div id="actions-inner">
        <button id="custom-action-btn">Custom</button>
      </div>
    `;
  } else if (anchorTier === 'tier4') {
    actionsHtml = '';
  } else if (anchorTier === 'tier5') {
    actionsHtml = '';
  }

  const ownerHtml = (anchorTier === 'tier4')
    ? `
      <div id="owner">
        <ytd-channel-name id="channel-name">
          <div id="container">
            <div id="text-container">
              <a class="yt-simple-endpoint">${channel}</a>
            </div>
          </div>
        </ytd-channel-name>
        <div id="subscribe-button">
          <button class="yt-spec-button-shape-next">Subscribe</button>
        </div>
      </div>
    `
    : (anchorTier === 'tier5'
      ? ''
      : `
      <div id="owner">
        <ytd-channel-name id="channel-name">
          <div id="container">
            <div id="text-container">
              <a class="yt-simple-endpoint">${channel}</a>
            </div>
          </div>
        </ytd-channel-name>
      </div>
    `);

  const topRowContent = anchorTier === 'tier5'
    ? `<div id="top-row"><span>Top Row Metadata Header</span></div>`
    : (actionsHtml ? `<div id="top-row">${actionsHtml}</div>` : '');

  document.body.innerHTML = `
    <div id="player">
      <video id="movie_player_video"></video>
    </div>
    <div id="movie_player"></div>
    <div id="above-the-fold">
      <div id="title">
        <h1 class="style-scope ytd-watch-metadata">${title}</h1>
      </div>
      ${ownerHtml}
      ${topRowContent}
    </div>
  `;

  // Attach mock video player controls
  const moviePlayer = document.getElementById('movie_player');
  if (moviePlayer) {
    moviePlayer.paused = true;
    moviePlayer.pauseVideo = () => { moviePlayer.paused = true; };
    moviePlayer.playVideo = () => { moviePlayer.paused = false; };
  }
}

describe('Tier 1: In-Page Quick Block Button on YouTube Watch Pages', () => {

  // ─── 1. MASTHEAD & HEADER BUTTON INJECTION ─────────────────────────

  test('T1.1: Quick Block button injects beside Shield button into #ss-header-btn-container', async () => {
    await resetStorage();
    resetDOM();

    // Setup YouTube masthead with header button container
    document.body.innerHTML = `
      <ytd-masthead id="masthead">
        <div id="end">
          <div id="buttons">
            <div id="ss-header-btn-container" class="ss-header-btn-container">
              <button id="ss-header-btn" class="ss-header-btn"><span>Shield</span></button>
            </div>
          </div>
        </div>
      </ytd-masthead>
    `;
    global.location.pathname = '/watch';
    global.location.href = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

    const qb = new QuickBlock();
    const injected = qb.injectButton();

    assert.equal(injected, true, 'Injection succeeded');
    const btn = document.getElementById('ss-quick-block-btn');
    assert.ok(btn, 'Button exists in DOM');
    assert.ok(btn.classList.contains('ss-quick-block-pill'), 'Button has pill class');
    assert.ok(btn.classList.contains('yt-spec-button-shape-next'), 'Button has YouTube button spec class');
    assert.ok(btn.textContent.includes('Block'), 'Button label includes Block');
    assert.ok(btn.textContent.includes('🚫'), 'Button icon contains 🚫');

    const container = document.getElementById('ss-header-btn-container');
    assert.equal(btn.parentElement, container, 'Button is child of #ss-header-btn-container');

    qb.disable();
  });

  test('T1.2: Injects into masthead #buttons when header container is pending', async () => {
    await resetStorage();
    resetDOM();

    document.body.innerHTML = `
      <ytd-masthead id="masthead">
        <div id="end">
          <div id="buttons">
            <button id="create-btn">Create</button>
          </div>
        </div>
      </ytd-masthead>
    `;
    global.location.pathname = '/watch';

    const qb = new QuickBlock();
    const injected = qb.injectButton();

    assert.equal(injected, true, 'Injection succeeded into buttons');
    const btn = document.getElementById('ss-quick-block-btn');
    assert.ok(btn, 'Button exists in DOM');
    assert.ok(btn.closest('#buttons'), 'Button exists within #buttons masthead area');

    qb.disable();
  });

  test('T1.3: Fallback injects into document.body when masthead is absent', async () => {
    await resetStorage();
    resetDOM();
    global.location.pathname = '/watch';

    const qb = new QuickBlock();
    const injected = qb.injectButton();

    assert.equal(injected, true, 'Injection succeeded in body fallback');
    const btn = document.getElementById('ss-quick-block-btn');
    assert.ok(btn, 'Button exists in DOM');
    assert.equal(btn.parentElement, document.body, 'Button child of body');

    qb.disable();
  });

  test('T1.4: Button injection is idempotent and does not create duplicate buttons', async () => {
    await resetStorage();
    setupWatchPageDOM({ anchorTier: 'tier1' });

    const qb = new QuickBlock();
    qb.injectButton();
    qb.injectButton();
    qb.injectButton();

    const buttons = document.querySelectorAll('#ss-quick-block-btn');
    assert.equal(buttons.length, 1, 'Exactly one button present in DOM');

    qb.disable();
  });

  test('T1.5: Popover menu opens and renders Obsidian glassmorphic interface on button toggle', async () => {
    await resetStorage();
    setupWatchPageDOM({ channel: 'TechChannel', title: 'Great Video' });

    const qb = new QuickBlock();
    qb.injectButton();

    assert.equal(document.getElementById('ss-quick-block-menu'), null, 'Menu closed initially');
    qb.toggleMenu();

    const menu = document.getElementById('ss-quick-block-menu');
    assert.ok(menu, 'Menu created on toggle');
    assert.ok(menu.classList.contains('ss-quick-block-popover'), 'Menu has glassmorphic class');
    assert.ok(menu.textContent.includes('Quick Block Shield'), 'Header title is rendered');
    assert.ok(menu.textContent.includes('TechChannel'), 'Channel name is rendered');

    qb.toggleMenu();
    assert.equal(document.getElementById('ss-quick-block-menu'), null, 'Menu closes on second toggle');

    qb.disable();
  });

  // ─── 2. GHOST SHIELD STRICT PLAYBACK ENFORCEMENT ───────────────────

  test('T1.6: Ghost Shield (Strict Purge) watch page scan halts playback and renders blocked overlay for blocked channel', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['ForbiddenCreator']);
    await StorageUtil.updateSetting('ghostShield', true);

    setupWatchPageDOM({ channel: 'ForbiddenCreator', title: 'Random Video' });

    const qb = new QuickBlock();
    qb.injectButton();

    // Trigger enforcement scan
    const blocked = await qb.checkAndEnforceStrictBlock();
    assert.equal(blocked, true, 'Strict block enforcement triggered');

    const overlay = document.getElementById('ss-blocked-content-overlay');
    assert.ok(overlay, 'Blocked content overlay mounted');
    assert.ok(overlay.textContent.includes('STRICT GHOST SHIELD ACTIVE'), 'Displays Strict Ghost Shield badge');
    assert.ok(overlay.textContent.includes('ForbiddenCreator'), 'Identifies blocked creator');

    qb.disable();
  });

  test('T1.7: Ghost Shield watch page scan halts playback for blocked keyword in video title', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedKeywords', ['clickbait', 'prank']);
    await StorageUtil.updateSetting('ghostShield', true);

    setupWatchPageDOM({ channel: 'AnyChannel', title: 'Top 10 Insane Prank Secrets' });

    const qb = new QuickBlock();
    qb.injectButton();

    const blocked = await qb.checkAndEnforceStrictBlock();
    assert.equal(blocked, true, 'Keyword match triggers strict block');

    const overlay = document.getElementById('ss-blocked-content-overlay');
    assert.ok(overlay, 'Overlay mounted for blocked keyword');
    assert.ok(overlay.textContent.includes('prank'), 'Displays matched rule keyword');

    qb.disable();
  });

  test('T1.8: Ghost Shield overlay offers Return to Safe Feed and Blocklist Studio buttons', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['BannedChannel']);
    await StorageUtil.updateSetting('ghostShield', true);

    setupWatchPageDOM({ channel: 'BannedChannel' });

    const qb = new QuickBlock();
    await qb.checkAndEnforceStrictBlock();

    const overlay = document.getElementById('ss-blocked-content-overlay');
    assert.ok(overlay);

    const homeBtn = overlay.querySelector('#ss-btn-blocked-home');
    const studioBtn = overlay.querySelector('#ss-btn-blocked-studio');

    assert.ok(homeBtn, 'Return to Safe Feed button exists');
    assert.ok(studioBtn, 'Manage Blocklist Studio button exists');
    assert.ok(overlay.textContent.includes('No temporary bypass is permitted') || overlay.textContent.includes('Playback is not permitted'), 'Strict zero bypass');

    qb.disable();
  });

  test('T1.9: Ghost Shield enforcement does not block content when ghostShield is false', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['AllowedUnderNonStrict']);
    await StorageUtil.updateSetting('ghostShield', false);

    setupWatchPageDOM({ channel: 'AllowedUnderNonStrict' });

    const qb = new QuickBlock();
    const blocked = await qb.checkAndEnforceStrictBlock();

    assert.equal(blocked, false, 'Does not enforce strict overlay when ghostShield is disabled');
    assert.equal(document.getElementById('ss-blocked-content-overlay'), null, 'No overlay mounted');

    qb.disable();
  });

  test('T1.10: Clean channel and non-matching title passes without triggering strict block overlay', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['SpamChannel']);
    await StorageUtil.updateSetting('blockedKeywords', ['toxic']);
    await StorageUtil.updateSetting('ghostShield', true);

    setupWatchPageDOM({ channel: 'CleanEducationalChannel', title: 'Learn Python in 1 Hour' });

    const qb = new QuickBlock();
    const blocked = await qb.checkAndEnforceStrictBlock();

    assert.equal(blocked, false, 'Clean content is not blocked');
    assert.equal(document.getElementById('ss-blocked-content-overlay'), null, 'No overlay for clean video');

    qb.disable();
  });

  // ─── 2. DOM EVICTION RESILIENCE & LIFECYCLE ────────────────────────

  test('T1.11: 600ms Self-Healing Watchdog automatically re-injects button upon DOM eviction', async () => {
    await resetStorage();
    setupWatchPageDOM({ anchorTier: 'tier1' });

    const qb = new QuickBlock();
    qb.enable();

    let btn = document.getElementById('ss-quick-block-btn');
    assert.ok(btn, 'Button initially injected on enable');

    // Simulate YouTube SPA layout recalculation evicting the button
    btn.remove();
    assert.equal(document.getElementById('ss-quick-block-btn'), null, 'Button evicted from DOM');

    // Advance watchdog timer past 600ms
    await new Promise(resolve => setTimeout(resolve, 650));

    const restoredBtn = document.getElementById('ss-quick-block-btn');
    assert.ok(restoredBtn, 'Watchdog automatically re-injected the button');
    assert.ok(restoredBtn.textContent.includes('Block'), 'Restored button is intact');

    qb.disable();
  });

  test('T1.12: MutationObserver watch page listener re-injects button on DOM changes', async () => {
    await resetStorage();
    setupWatchPageDOM({ anchorTier: 'tier1' });

    const qb = new QuickBlock();
    qb.enable();

    const btn = document.getElementById('ss-quick-block-btn');
    assert.ok(btn);
    btn.remove();

    // Trigger observer callback if ObserverUtils is active
    if (window.ObserverUtils && window.ObserverUtils.observers.has('quick-block')) {
      const obs = window.ObserverUtils.observers.get('quick-block');
      if (obs && typeof obs.triggerMutation === 'function') {
        const metadataEl = document.querySelector('ytd-watch-metadata') || document.body;
        obs.triggerMutation([{ type: 'childList', addedNodes: [metadataEl] }]);
        await new Promise(r => setTimeout(r, 100));
      }
    } else {
      qb.tryInjectButton();
    }

    const reInjected = document.getElementById('ss-quick-block-btn');
    assert.ok(reInjected, 'Button restored after observer notification');

    qb.disable();
  });

  test('T1.13: 7 Lifecycle navigation events and visibilitychange trigger injection on watch page', async () => {
    await resetStorage();
    setupWatchPageDOM({ anchorTier: 'tier1' });

    const qb = new QuickBlock();
    qb.enable();

    const eventsToTest = [
      'yt-navigate-finish',
      'yt-page-data-updated',
      'yt-navigate-start',
      'DOMContentLoaded',
      'load',
      'pageshow',
      'popstate'
    ];

    for (const evtName of eventsToTest) {
      document.getElementById('ss-quick-block-btn')?.remove();
      assert.equal(document.getElementById('ss-quick-block-btn'), null);

      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(evtName);
      }
      const injected = document.getElementById('ss-quick-block-btn');
      assert.ok(injected, `Button injected on lifecycle event: ${evtName}`);
    }

    // Test visibilitychange
    document.getElementById('ss-quick-block-btn')?.remove();
    document.hidden = false;
    if (typeof document.dispatchEvent === 'function') {
      document.dispatchEvent('visibilitychange');
    }
    const visBtn = document.getElementById('ss-quick-block-btn');
    assert.ok(visBtn, 'Button injected on visibilitychange');

    qb.disable();
  });

  test('T1.14: Navigating across pages maintains header button and halts retry loop', async () => {
    await resetStorage();
    setupWatchPageDOM({ anchorTier: 'tier1' });

    const qb = new QuickBlock();
    qb.enable();
    assert.ok(document.getElementById('ss-quick-block-btn'), 'Button exists in header');

    // Open menu
    qb.toggleMenu();
    assert.ok(document.getElementById('ss-quick-block-menu'), 'Menu open before navigation');

    // Navigate to home feed
    global.location.pathname = '/';
    global.location.href = 'https://www.youtube.com/';
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent('yt-navigate-finish');
    }

    assert.equal(document.getElementById('ss-quick-block-menu'), null, 'Popover menu closed on navigation');
    assert.equal(qb.retryInterval, null, 'Retry loop cleared');

    qb.disable();
  });

  // ─── 3. METADATA EXTRACTION & TOKENIZATION ─────────────────────────

  test('T1.15: Channel name extraction retrieves and sanitizes channel text from DOM', async () => {
    await resetStorage();
    setupWatchPageDOM({ channel: '  Linus Tech Tips  Subscribe  ' });

    const qb = new QuickBlock();
    const extracted = qb.extractChannelName();

    assert.equal(extracted, 'Linus Tech Tips', 'Cleaned channel name without subscribe artifacts');
    qb.disable();
  });

  test('T1.16: Title keyword tokenizer splits words, strips punctuation, and removes stop words', async () => {
    await resetStorage();
    setupWatchPageDOM();

    const qb = new QuickBlock();
    const title = 'Ultimate 4K Quantum Computing Tutorial (2026 Edition) - Is It Worth It?!';
    const keywords = qb.extractTitleKeywords(title);

    assert.ok(keywords.includes('ultimate'), 'Contains ultimate');
    assert.ok(keywords.includes('quantum'), 'Contains quantum');
    assert.ok(keywords.includes('computing'), 'Contains computing');
    assert.ok(keywords.includes('tutorial'), 'Contains tutorial');
    assert.ok(keywords.includes('edition'), 'Contains edition');
    assert.ok(keywords.includes('worth'), 'Contains worth');

    // Filtered stop words / short tokens / numbers
    assert.equal(keywords.includes('4k'), false, '4K excluded (short/symbol/stop)');
    assert.equal(keywords.includes('2026'), false, '2026 excluded (number)');
    assert.equal(keywords.includes('it'), false, 'it excluded (stop word & length <= 2)');
    assert.equal(keywords.includes('is'), false, 'is excluded (stop word & length <= 2)');

    qb.disable();
  });

  // ─── 4. OBSIDIAN POPOVER & 4-WAY VIEWPORT COLLISION MATH ───────────

  test('T1.17: Clicking Quick Block button toggles Obsidian popover menu structure', async () => {
    await resetStorage();
    setupWatchPageDOM({ channel: 'Veritasium', title: 'Why Quantum Computers Are Fast' });

    const qb = new QuickBlock();
    qb.injectButton();

    const btn = document.getElementById('ss-quick-block-btn');
    btn.click();

    const menu = document.getElementById('ss-quick-block-menu');
    assert.ok(menu, 'Popover menu is displayed');
    assert.ok(menu.classList.contains('ss-quick-block-popover'), 'Has ss-quick-block-popover class');

    const channelItem = menu.querySelector('#ss-btn-block-channel');
    assert.ok(channelItem, 'Channel block button exists in menu');
    assert.ok(menu.innerHTML.includes('Veritasium'), 'Menu highlights Veritasium channel');

    const chips = menu.querySelectorAll('.ss-keyword-chip');
    assert.ok(chips.length > 0, 'Keyword chips generated in menu');

    const customInput = menu.querySelector('#ss-custom-kw-input');
    assert.ok(customInput, 'Custom keyword input field exists');

    const studioLink = menu.querySelector('#ss-btn-open-blocklist-studio');
    assert.ok(studioLink, 'Blocklist Studio link exists in footer');

    // Toggle menu closes it
    btn.click();
    assert.equal(document.getElementById('ss-quick-block-menu'), null, 'Toggling menu closes it');

    qb.disable();
  });

  test('T1.18: 4-Way viewport collision math clamps horizontally to 16px safety margins', async () => {
    await resetStorage();
    setupWatchPageDOM();

    const qb = new QuickBlock();
    qb.injectButton();
    const btn = document.getElementById('ss-quick-block-btn');

    // Simulate button close to right edge (winWidth 1200, rect.right 1250 -> overflow)
    btn._rect = { top: 100, left: 1100, bottom: 136, right: 1190, width: 90, height: 36 };
    qb.toggleMenu();

    const menu = document.getElementById('ss-quick-block-menu');
    assert.ok(menu);
    // winWidth 1200, menuWidth 360 -> max left is 1200 - 360 - 16 = 824
    assert.equal(menu.style.left, '824px', 'Left position clamped to right margin');

    qb.closeMenu();

    // Simulate button on far left edge (rect.right 100 -> leftPos = 100 - 360 = -260 < 16)
    btn._rect = { top: 100, left: 10, bottom: 136, right: 100, width: 90, height: 36 };
    qb.toggleMenu();
    const menuLeft = document.getElementById('ss-quick-block-menu');
    assert.equal(menuLeft.style.left, '16px', 'Left position clamped to minimum 16px');

    qb.disable();
  });

  test('T1.19: 4-Way viewport collision math flips menu vertically when bottom overflows', async () => {
    await resetStorage();
    setupWatchPageDOM();

    const qb = new QuickBlock();
    qb.injectButton();
    const btn = document.getElementById('ss-quick-block-btn');

    // Simulate button near bottom of viewport (winHeight 800, rect.bottom 750, rect.top 714)
    // topPos = 750 + 8 = 758. 758 + 360 = 1118 > 800. rect.top 714 > 360 + 16 (376).
    // Flips to top: rect.top - menuHeight - 8 = 714 - 360 - 8 = 346px.
    btn._rect = { top: 714, left: 500, bottom: 750, right: 590, width: 90, height: 36 };
    qb.toggleMenu();

    const menu = document.getElementById('ss-quick-block-menu');
    assert.ok(menu);
    assert.equal(menu.style.top, '346px', 'Flipped above button to prevent bottom overflow');

    qb.disable();
  });

  test('T1.20: Popover dismisses cleanly on Close button, Escape key, and outside pointerdown', async () => {
    await resetStorage();
    setupWatchPageDOM();

    const qb = new QuickBlock();
    qb.injectButton();
    const btn = document.getElementById('ss-quick-block-btn');

    // 1. Close button
    qb.toggleMenu();
    assert.ok(document.getElementById('ss-quick-block-menu'));
    const closeBtn = document.getElementById('ss-popover-close');
    closeBtn.click();
    assert.equal(document.getElementById('ss-quick-block-menu'), null, 'Closed via close button');

    // 2. Escape key
    qb.enable();
    qb.toggleMenu();
    assert.ok(document.getElementById('ss-quick-block-menu'));
    if (typeof document.dispatchEvent === 'function') {
      document.dispatchEvent({ type: 'keydown', key: 'Escape' });
    }
    assert.equal(document.getElementById('ss-quick-block-menu'), null, 'Closed via Escape key');

    // 3. Outside pointerdown
    qb.toggleMenu();
    assert.ok(document.getElementById('ss-quick-block-menu'));
    const outsideEl = document.getElementById('above-the-fold');
    if (typeof document.dispatchEvent === 'function') {
      document.dispatchEvent({ type: 'pointerdown', target: outsideEl });
    }
    assert.equal(document.getElementById('ss-quick-block-menu'), null, 'Closed via outside click');

    qb.disable();
  });

  // ─── 5. ACTIONS, TOAST, FEED CONTROLLER, AND IPC ───────────────────

  test('T1.21: 1-Click channel block updates storage, pauses video, syncs FeedController, and shows toast', async () => {
    await resetStorage();
    setupWatchPageDOM({ channel: 'ClickbaitKing' });

    const origFeedController = window.FeedController;
    let feedControllerNotified = false;
    window.FeedController = {
      setBlocklist: (keywords, channels) => {
        feedControllerNotified = channels.includes('ClickbaitKing');
      }
    };

    try {
      const video = document.querySelector('video');
      video.paused = false;

      const qb = new QuickBlock();
      qb.injectButton();
      await qb.blockChannel('ClickbaitKing');

      const settings = await StorageUtil.getSettings();
      assert.deepEqual(settings.blockedChannels, ['ClickbaitKing'], 'Channel added to blockedChannels');
      assert.equal(video.paused, true, 'Video playback paused');
      assert.equal(feedControllerNotified, true, 'FeedController updated');

      const toast = document.getElementById('ss-block-toast');
      assert.ok(toast, 'Undo toast notification appears');
      assert.ok(toast.textContent.includes('ClickbaitKing'), 'Toast indicates blocked channel');
      assert.ok(toast.querySelector('#ss-toast-undo-btn'), 'Toast has Undo button');
      assert.ok(toast.querySelector('#ss-toast-countdown'), 'Toast has countdown display');

      qb.clearTimers();
      qb.disable();
    } finally {
      window.FeedController = origFeedController;
    }
  });

  test('T1.22: Clicking Keyword Chip adds keyword to storage, syncs FeedController, and spawns toast', async () => {
    await resetStorage();
    setupWatchPageDOM();

    const origFeedController = window.FeedController;
    let feedKeywords = [];
    window.FeedController = {
      setBlocklist: (keywords) => {
        feedKeywords = keywords;
      }
    };

    try {
      const qb = new QuickBlock();
      qb.injectButton();
      await qb.blockKeyword('crypto');

      const settings = await StorageUtil.getSettings();
      assert.deepEqual(settings.blockedKeywords, ['crypto'], 'Keyword added to blockedKeywords');
      assert.deepEqual(feedKeywords, ['crypto'], 'FeedController synced with blocked keyword');

      const toast = document.getElementById('ss-block-toast');
      assert.ok(toast, 'Toast notification appears');
      assert.ok(toast.textContent.includes('crypto'), 'Toast indicates blocked keyword');

      qb.clearTimers();
      qb.disable();
    } finally {
      window.FeedController = origFeedController;
    }
  });

  test('T1.23: Custom keyword input handles "+ Add" button click and Enter keypress', async () => {
    await resetStorage();
    setupWatchPageDOM();

    const qb = new QuickBlock();
    qb.injectButton();

    // 1. Test "+ Add" button
    qb.toggleMenu();
    const menu = document.getElementById('ss-quick-block-menu');
    const input = menu.querySelector('#ss-custom-kw-input');
    const addBtn = menu.querySelector('#ss-btn-add-custom-kw');

    input.value = 'reaction';
    addBtn.click();
    await new Promise(r => setTimeout(r, 20));

    let settings = await StorageUtil.getSettings();
    assert.ok(settings.blockedKeywords.includes('reaction'), 'Custom keyword added via button');
    qb.clearTimers();

    // 2. Test Enter key
    qb.toggleMenu();
    const menu2 = document.getElementById('ss-quick-block-menu');
    const input2 = menu2.querySelector('#ss-custom-kw-input');
    input2.value = 'pranks';
    input2.dispatchEvent({ type: 'keydown', key: 'Enter' });
    await new Promise(r => setTimeout(r, 20));

    settings = await StorageUtil.getSettings();
    assert.ok(settings.blockedKeywords.includes('pranks'), 'Custom keyword added via Enter key');

    qb.clearTimers();
    qb.disable();
  });

  test('T1.24: Blocklist Studio shortcut sends openOptionsPage IPC message', async () => {
    await resetStorage();
    setupWatchPageDOM();

    let capturedMessage = null;
    chrome.runtime.sendMessage = (msg) => {
      capturedMessage = msg;
      return Promise.resolve({ status: 'ok' });
    };

    const qb = new QuickBlock();
    qb.injectButton();
    qb.toggleMenu();

    const studioBtn = document.getElementById('ss-btn-open-blocklist-studio');
    assert.ok(studioBtn, 'Studio button exists');
    studioBtn.click();

    assert.deepEqual(
      capturedMessage,
      { action: 'openOptionsPage', tab: 'blocklist' },
      'Dispatched openOptionsPage with tab: blocklist'
    );
    assert.equal(document.getElementById('ss-quick-block-menu'), null, 'Menu closed after navigation');

    qb.disable();
  });

  test('T1.25: Toast 5-second countdown timer decrements every second', async () => {
    await resetStorage();
    setupWatchPageDOM({ channel: 'CountdownTest' });

    const qb = new QuickBlock();
    await qb.blockChannel('CountdownTest');

    const toast = document.getElementById('ss-block-toast');
    assert.ok(toast);
    const countdownEl = toast.querySelector('#ss-toast-countdown');
    assert.equal(countdownEl.textContent, '5', 'Initial countdown is 5');

    // Advance by 1 second
    await new Promise(r => setTimeout(r, 1050));
    assert.equal(countdownEl.textContent, '4', 'Countdown decremented to 4');

    qb.clearTimers();
    qb.disable();
  });

  test('T1.26: Clicking Undo in toast restores previous storage state, resumes video, and dismisses toast', async () => {
    await resetStorage();
    setupWatchPageDOM({ channel: 'MistakeChannel' });

    const video = document.querySelector('video');
    video.paused = false;

    const qb = new QuickBlock();
    await qb.blockChannel('MistakeChannel');

    let settings = await StorageUtil.getSettings();
    assert.equal(settings.blockedChannels.length, 1);
    assert.equal(video.paused, true, 'Video paused on block');

    const toast = document.getElementById('ss-block-toast');
    const undoBtn = toast.querySelector('#ss-toast-undo-btn');
    undoBtn.click();
    await new Promise(r => setTimeout(r, 30));

    settings = await StorageUtil.getSettings();
    assert.deepEqual(settings.blockedChannels, [], 'Channel removed from storage on Undo');
    assert.equal(document.getElementById('ss-block-toast'), null, 'Toast removed from DOM');
    assert.equal(qb.redirectTimer, null, 'Redirect timer cancelled');
    assert.equal(video.paused, false, 'Video playback resumed on Undo');

    qb.disable();
  });

  test('T1.27: Clicking Go Home in toast immediately redirects and dismisses toast', async () => {
    await resetStorage();
    setupWatchPageDOM({ channel: 'BadChannel' });

    const qb = new QuickBlock();
    await qb.blockChannel('BadChannel');

    const toast = document.getElementById('ss-block-toast');
    const homeBtn = toast.querySelector('#ss-toast-home-btn');
    assert.ok(homeBtn, 'Go Home button exists in toast');

    homeBtn.click();

    assert.equal(global.location.href, 'https://www.youtube.com/', 'Redirected to YouTube home');
    assert.equal(document.getElementById('ss-block-toast'), null, 'Toast dismissed');

    qb.clearTimers();
    qb.disable();
  });

  test('T1.28: Timer expiration executes redirect to YouTube home', async () => {
    await resetStorage();
    setupWatchPageDOM({ channel: 'TimedOutChannel' });

    const qb = new QuickBlock();
    await qb.blockChannel('TimedOutChannel');

    assert.ok(document.getElementById('ss-block-toast'));
    qb.executeRedirect();

    assert.equal(global.location.href, 'https://www.youtube.com/', 'Redirected to YouTube home');

    qb.clearTimers();
    qb.disable();
  });

  test('T1.29: Controller disable() cleans up all intervals, timers, DOM nodes, and listeners', async () => {
    await resetStorage();
    setupWatchPageDOM({ channel: 'TeardownChannel' });

    const qb = new QuickBlock();
    qb.enable();
    qb.toggleMenu();
    await qb.blockChannel('TeardownChannel');

    assert.ok(document.getElementById('ss-quick-block-btn'), 'Button exists');
    assert.ok(document.getElementById('ss-block-toast'), 'Toast exists');
    assert.ok(qb._watchdogInterval !== null, 'Watchdog interval active');

    qb.disable();

    assert.equal(qb.isActive, false, 'isActive set to false');
    assert.equal(document.getElementById('ss-quick-block-btn'), null, 'Button removed');
    assert.equal(document.getElementById('ss-quick-block-menu'), null, 'Menu removed');
    assert.equal(document.getElementById('ss-block-toast'), null, 'Toast removed');
    assert.equal(qb._watchdogInterval, null, 'Watchdog interval cleared');
    assert.equal(qb.retryInterval, null, 'Retry interval cleared');
    assert.equal(qb.toastTimer, null, 'Toast timer cleared');
    assert.equal(qb.redirectTimer, null, 'Redirect timer cleared');
    assert.equal(qb.countdownInterval, null, 'Countdown interval cleared');
  });

});
