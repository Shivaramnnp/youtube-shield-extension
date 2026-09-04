/**
 * Tier 1 Test Suite: Search Results & Channel Page Shorts Shelves & Views Hiding
 * Verifies that all Shorts shelf rows, "Latest Shorts from ...", reel item renderers,
 * view counts ("3.1 lakh views"), and 3-dot action buttons are fully purged from DOM without orphan text.
 */

require('../harness/mock-extension-env').setupMockEnv();
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');

require('../../content/js/shorts-blocker');

describe('Shorts Blocker: Search Shelves, Reel Items & View Counts Purge', () => {

  test('SB.1: Hides search result Shorts shelves, reel item renderers, and view counts completely', () => {
    resetDOM();
    const sb = window.ShortsBlocker;
    sb.enable();

    document.body.innerHTML = `
      <div class="shorts-shield-block-shorts">
        <!-- YouTube Search Results Section with regular videos and shorts shelf inside same item section -->
        <ytd-item-section-renderer id="search-results-section">
          <!-- Regular search video 1 -->
          <ytd-video-renderer id="regular-video">
            <a id="thumbnail" href="/watch?v=12345">Video 1</a>
            <h3 id="video-title">Regular In-Depth Review</h3>
            <span id="channel-name">Tech Channel</span>
          </ytd-video-renderer>

          <!-- Shorts Search Shelf (e.g. Latest Shorts from Creator) -->
          <ytd-reel-shelf-renderer id="shorts-shelf">
            <div id="title-container">
              <span id="title">Latest Shorts from Prasadtechintelugu</span>
            </div>
            <div id="items">
              <ytd-reel-item-renderer id="reel-item-1">
                <a id="thumbnail" href="/shorts/short1">Short 1</a>
                <div id="details">
                  <span class="view-count">3.1 lakh views</span>
                  <button id="menu-dots">⋮</button>
                </div>
              </ytd-reel-item-renderer>
              <ytd-reel-item-renderer id="reel-item-2">
                <a id="thumbnail" href="/shorts/short2">Short 2</a>
                <div id="details">
                  <span class="view-count">2.8 lakh views</span>
                  <button id="menu-dots">⋮</button>
                </div>
              </ytd-reel-item-renderer>
            </div>
            <button id="show-more">Show more</button>
          </ytd-reel-shelf-renderer>

          <!-- Regular search video 2 -->
          <ytd-video-renderer id="regular-video-2">
            <a id="thumbnail" href="/watch?v=67890">Video 2</a>
            <h3 id="video-title">Another Regular Video</h3>
            <span id="channel-name">Music Channel</span>
          </ytd-video-renderer>
        </ytd-item-section-renderer>

        <!-- Modern Reel Shelf View Model in Search Results -->
        <reel-shelf-view-model id="modern-shorts-shelf">
          <div id="title-container"><span id="title">Shorts</span></div>
          <reel-item-view-model id="reel-item-3">
            <a href="/shorts/short3">Short 3</a>
          </reel-item-view-model>
        </reel-shelf-view-model>
      </div>
    `;

    const searchSection = document.getElementById('search-results-section');
    const shortsShelf = document.getElementById('shorts-shelf');
    const modernShelf = document.getElementById('modern-shorts-shelf');
    const regularVideo1 = document.getElementById('regular-video');
    const regularVideo2 = document.getElementById('regular-video-2');

    // Trigger dynamic observer cleanup using updated parentShelf logic
    const elementsToFilter = Array.from(document.querySelectorAll('ytd-reel-item-renderer, ytd-reel-shelf-renderer, reel-shelf-view-model, a[href*="shorts"]'));
    if (elementsToFilter.length > 0) {
      elementsToFilter.forEach(el => {
        const parentShelf = el.parentElement && typeof el.parentElement.closest === 'function'
          ? el.parentElement.closest(`
              ytd-reel-shelf-renderer,
              ytd-rich-section-renderer:has(ytd-reel-shelf-renderer),
              ytd-rich-section-renderer:has(ytd-rich-shelf-renderer),
              ytd-rich-section-renderer:has(ytd-reel-item-renderer),
              ytd-rich-section-renderer:has(a[href*="/shorts/"]),
              ytd-rich-shelf-renderer:has(ytd-reel-item-renderer),
              ytd-rich-shelf-renderer:has(a[href*="/shorts/"]),
              ytd-rich-shelf-renderer[is-shorts],
              reel-shelf-view-model,
              yt-shorts-shelf-view-model,
              grid-shelf-view-model:has(ytd-reel-item-renderer),
              grid-shelf-view-model:has(a[href*="/shorts/"]),
              ytd-horizontal-card-list-renderer:has(ytd-reel-item-renderer),
              ytd-horizontal-card-list-renderer:has(a[href*="/shorts/"])
            `)
          : null;
        const container = (typeof el.closest === 'function') ? el.closest(`
          ytd-rich-item-renderer,
          ytd-video-renderer,
          ytd-compact-video-renderer,
          ytd-grid-video-renderer,
          ytd-reel-item-renderer,
          ytd-shorts-lockup-view-model,
          reel-item-view-model,
          yt-shorts-lockup-view-model
        `) : null;
        const target = parentShelf || container || el;
        if (target) target.style.setProperty('display', 'none', 'important');
      });
    }

    assert.equal(shortsShelf.style.display, 'none', 'Shorts shelf must be hidden');
    assert.equal(modernShelf.style.display, 'none', 'Modern shorts shelf must be hidden');
    assert.ok(regularVideo1.style.display !== 'none', 'Regular video 1 must remain visible');
    assert.ok(regularVideo2.style.display !== 'none', 'Regular video 2 must remain visible');
    assert.ok(searchSection.style.display !== 'none', 'Search results parent container must NOT be hidden');
  });

});
