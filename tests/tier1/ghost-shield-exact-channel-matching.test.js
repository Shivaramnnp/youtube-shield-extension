/**
 * Tier 1 Test Suite: Ghost Shield Exact Channel Matching & Word-Boundary Keyword Filtering
 * Verifies that blocking channel "X" does NOT inadvertently block channel "Y" (e.g. "Fox News", "SpaceX", "Vox"),
 * and blocking keyword "X" does not match substrings inside words like "Next", "Fox", or "Matrix".
 */

require('../harness/mock-extension-env').setupMockEnv();
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');

require('../../content/js/feed-controller');
require('../../content/js/quick-block');

describe('Ghost Shield Exact Channel Matching & Word-Boundary Filtering', () => {

  test('GS.1: Blocking channel "X" strictly purges channel "X" and leaves channels containing "x" (Fox News, SpaceX, Vox, Y) unblocked', async () => {
    resetDOM();
    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];
    fc.setBlocklist([], ['x']);

    document.body.innerHTML = `
      <ytd-rich-item-renderer id="card-x">
        <span id="video-title">Official Announcements</span>
        <span id="channel-name">X</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="card-y">
        <span id="video-title">Documentary on Space</span>
        <span id="channel-name">Y Channel</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="card-fox">
        <span id="video-title">Live World News</span>
        <span id="channel-name">Fox News</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="card-spacex">
        <span id="video-title">Starship Launch Test</span>
        <span id="channel-name">SpaceX</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="card-vox">
        <span id="video-title">How Cities Are Designed</span>
        <span id="channel-name">Vox</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="card-at-x">
        <span id="video-title">Updates from Platform</span>
        <span id="channel-name">@X</span>
      </ytd-rich-item-renderer>
    `;

    fc.applyBlocklist();

    const cardX = document.getElementById('card-x');
    const cardY = document.getElementById('card-y');
    const cardFox = document.getElementById('card-fox');
    const cardSpaceX = document.getElementById('card-spacex');
    const cardVox = document.getElementById('card-vox');
    const cardAtX = document.getElementById('card-at-x');

    assert.equal(cardX.style.display, 'none', 'Channel "X" must be hidden');
    assert.equal(cardAtX.style.display, 'none', 'Channel "@X" must be hidden');

    assert.equal(cardY.style.display, '', 'Channel "Y Channel" must remain visible');
    assert.equal(cardFox.style.display, '', 'Channel "Fox News" must remain visible');
    assert.equal(cardSpaceX.style.display, '', 'Channel "SpaceX" must remain visible');
    assert.equal(cardVox.style.display, '', 'Channel "Vox" must remain visible');
  });

  test('GS.2: Watch page strict Ghost Shield blocks playback on channel "X" but allows playback on channel "Y" and "Fox News"', async () => {
    resetDOM();
    await resetStorage();
    await StorageUtil.updateSetting('ghostShield', true);
    await StorageUtil.updateSetting('blockedChannels', ['X']);
    await StorageUtil.updateSetting('blockedKeywords', []);

    const qb = window.QuickBlock;
    qb.enable();

    // 1. Test video on channel "Fox News" (contains 'x' as substring)
    document.body.innerHTML = `
      <div id="movie_player"><video></video></div>
      <ytd-watch-metadata>
        <div id="title"><h1 class="title">Breaking News Broadcast</h1></div>
        <div id="channel-name"><a href="/@foxnews">Fox News</a></div>
      </ytd-watch-metadata>
    `;

    // Mock watch page URL
    global.window.location = { pathname: '/watch', href: 'https://www.youtube.com/watch?v=123', search: '?v=123' };

    let isBlocked = await qb.checkAndEnforceStrictBlock();
    assert.equal(isBlocked, false, 'Fox News should NOT be blocked when only "X" is blocked');
    assert.equal(document.getElementById('ss-blocked-content-overlay'), null, 'No block overlay for Fox News');

    // 2. Test video on channel "X"
    document.body.innerHTML = `
      <div id="movie_player"><video></video></div>
      <ytd-watch-metadata>
        <div id="title"><h1 class="title">Platform Keynote</h1></div>
        <div id="channel-name"><a href="/@x">X</a></div>
      </ytd-watch-metadata>
    `;

    isBlocked = await qb.checkAndEnforceStrictBlock();
    assert.equal(isBlocked, true, 'Channel "X" must trigger Ghost Shield block overlay');
    assert.ok(document.getElementById('ss-blocked-content-overlay'), 'Block overlay must be rendered for channel X');

    qb.disable();
  });

  test('GS.3: Blocking keyword "x" uses word boundaries: blocks standalone "X" but allows "Next", "Matrix", and "Example"', async () => {
    resetDOM();
    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];
    fc.setBlocklist(['x'], []);

    document.body.innerHTML = `
      <ytd-rich-item-renderer id="card-x-title">
        <span id="video-title">Why X Is Rebranding Everything</span>
        <span id="channel-name">Tech Review</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="card-next">
        <span id="video-title">Next Level Web Development in 2026</span>
        <span id="channel-name">Dev Academy</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="card-matrix">
        <span id="video-title">Matrix Multiplication Explained</span>
        <span id="channel-name">Math World</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="card-example">
        <span id="video-title">Best Coding Example Projects</span>
        <span id="channel-name">Code Hub</span>
      </ytd-rich-item-renderer>
    `;

    fc.applyBlocklist();

    const cardXTitle = document.getElementById('card-x-title');
    const cardNext = document.getElementById('card-next');
    const cardMatrix = document.getElementById('card-matrix');
    const cardExample = document.getElementById('card-example');

    assert.equal(cardXTitle.style.display, 'none', 'Title containing standalone word "X" must be hidden');
    assert.equal(cardNext.style.display, '', 'Title containing "Next" must NOT be hidden');
    assert.equal(cardMatrix.style.display, '', 'Title containing "Matrix" must NOT be hidden');
    assert.equal(cardExample.style.display, '', 'Title containing "Example" must NOT be hidden');
  });

});
