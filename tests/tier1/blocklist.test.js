/**
 * Tier 1 Test Suite: R1 - Blocklist Feature (blocklist.test.js)
 * Tests Custom Keyword & Channel Blocklist filtering in FeedController.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage } = require('../harness/test-helpers');

// Load FeedController
require('../../content/js/feed-controller');

describe('R1: Custom Keyword & Channel Blocklist', () => {

  test('R1.1: setBlocklist normalizes keywords and channels to lowercase trimmed arrays', async () => {
    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];
    fc.setBlocklist(['  Gaming ', 'VLOG', '   '], [' ChannelOne ', 'CHANNELTWO']);

    assert.deepEqual(fc.blockedKeywords, ['gaming', 'vlog']);
    assert.deepEqual(fc.blockedChannels, ['channelone', 'channeltwo']);
  });

  test('R1.2: filterFeed hides video elements matching blocked keywords in title', async () => {
    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];
    fc.setBlocklist(['gaming', 'prank'], []);

    document.body.innerHTML = `
      <ytd-rich-item-renderer id="video1">
        <span id="video-title">Epic Gaming Walkthrough 2026</span>
        <span class="ytd-channel-name">Tech Channel</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="video2">
        <span id="video-title">Python Tutorial for Beginners</span>
        <span class="ytd-channel-name">Code Academy</span>
      </ytd-rich-item-renderer>
    `;

    fc.applyBlocklist();

    const video1 = document.getElementById('video1');
    const video2 = document.getElementById('video2');

    assert.equal(video1.style.display, 'none', 'Video matching blocked keyword "gaming" is hidden');
    assert.ok(video1.classList.contains('off-topic'), 'Video matching blocked keyword has off-topic class');

    assert.equal(video2.style.display, '', 'Video with non-blocked title remains visible');
    assert.equal(video2.classList.contains('off-topic'), false, 'Non-blocked video lacks off-topic class');
  });

  test('R1.3: filterFeed hides video elements matching blocked channels', async () => {
    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];
    fc.setBlocklist([], ['trashcontent']);

    document.body.innerHTML = `
      <ytd-video-renderer id="video1">
        <span id="video-title">Top 10 Fails</span>
        <span id="channel-name">TrashContent</span>
      </ytd-video-renderer>
      <ytd-video-renderer id="video2">
        <span id="video-title">Quantum Computing Intro</span>
        <span id="channel-name">Physics Hub</span>
      </ytd-video-renderer>
    `;

    fc.applyBlocklist();

    const video1 = document.getElementById('video1');
    const video2 = document.getElementById('video2');

    assert.equal(video1.style.display, 'none', 'Video from blocked channel "TrashContent" is hidden');
    assert.equal(video2.style.display, '', 'Video from allowed channel remains visible');
  });

  test('R1.4: Shorts containers are skipped by FeedController blocklist filtering', async () => {
    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];
    fc.setBlocklist(['gaming'], ['trashcontent']);

    const shorts1 = document.createElement('ytd-rich-item-renderer');
    shorts1.id = 'shorts1';
    const link = document.createElement('a');
    link.setAttribute('href', '/shorts/abc123xyz');
    const title = document.createElement('span');
    title.id = 'video-title';
    title.textContent = 'Gaming Short';

    shorts1.appendChild(link);
    shorts1.appendChild(title);
    document.body.appendChild(shorts1);

    fc.applyBlocklist();

    const shorts1_el = document.getElementById('shorts1');
    assert.notEqual(shorts1_el.style.display, 'none', 'Shorts item container is ignored by FeedController (handled by ShortsBlocker)');
    assert.ok(!shorts1_el.classList.contains('off-topic'), 'Shorts item does not get off-topic class');
  });

  test('R1.5: ObserverUtils observes feed items whenever custom blocklist terms exist even if Study Mode is inactive', async () => {
    require('../../content/js/observer-utils');
    const fc = window.FeedController;
    fc.disable();
    fc.isActive = false;

    let observedName = null;
    const origObserve = window.ObserverUtils.observe;
    try {
      window.ObserverUtils.observe = (selector, callback, name) => {
        observedName = name;
      };

      fc.setBlocklist(['clickbait'], []);

      assert.equal(observedName, 'feed-controller', 'ObserverUtils observes feed items for custom blocklist even when Study Mode is inactive');
    } finally {
      window.ObserverUtils.observe = origObserve;
    }
  });

});

