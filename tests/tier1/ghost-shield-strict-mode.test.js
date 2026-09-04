/**
 * Tier 1 Test Suite: Ghost Shield (Strict Purge Mode) & Header-Adjacent Quick Block Button
 * tests/tier1/ghost-shield-strict-mode.test.js
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil, DEFAULT_SETTINGS } = require('../../utils/storage');
global.StorageUtil = StorageUtil;
globalThis.StorageUtil = StorageUtil;
if (typeof window !== 'undefined') window.StorageUtil = StorageUtil;

require('../../content/js/observer-utils');
require('../../content/js/feed-controller');
require('../../content/js/header-button');
const { QuickBlock } = require('../../content/js/quick-block');

describe('Ghost Shield (Strict Purge Mode) & Header-Adjacent Block Button', () => {

  test('GS.1: HeaderButton renders both Shield and Quick Block buttons side-by-side in masthead container', async () => {
    await resetStorage();
    resetDOM();

    document.body.innerHTML = `
      <ytd-masthead id="masthead">
        <div id="end">
          <div id="buttons">
            <button id="upload-button">Create</button>
          </div>
        </div>
      </ytd-masthead>
    `;

    const hb = window.HeaderButton;
    hb.enable();
    const injected = hb.tryInject();

    assert.equal(injected, true, 'Header container injected');
    const container = document.getElementById('ss-header-btn-container');
    assert.ok(container, 'Container exists in DOM');

    const shieldBtn = container.querySelector('#ss-header-btn');
    const blockBtn = container.querySelector('#ss-quick-block-btn');

    assert.ok(shieldBtn, 'Shield button rendered');
    assert.ok(blockBtn, 'Block button rendered beside Shield button');
    assert.ok(blockBtn.classList.contains('ss-header-block-btn'), 'Block button has header-block-btn class');
    assert.ok(blockBtn.textContent.includes('Block'), 'Block button has Block text');
    assert.ok(blockBtn.textContent.includes('🚫'), 'Block button has 🚫 icon');

    hb.disable();
  });

  test('GS.2: Ghost Shield purges blocked channel items with .ss-ghost-purged and display:none', async () => {
    await resetStorage();
    resetDOM();

    const fc = window.FeedController;
    fc.setBlocklist([], ['ForbiddenGamer']);

    document.body.innerHTML = `
      <div id="contents">
        <ytd-rich-item-renderer id="card-1">
          <h3 id="video-title">Epic Gameplay Part 1</h3>
          <ytd-channel-name id="channel-name">ForbiddenGamer</ytd-channel-name>
        </ytd-rich-item-renderer>
        <ytd-rich-item-renderer id="card-2">
          <h3 id="video-title">Computer Science Lecture</h3>
          <ytd-channel-name id="channel-name">MIT OpenCourseWare</ytd-channel-name>
        </ytd-rich-item-renderer>
      </div>
    `;

    fc.applyBlocklist();

    const card1 = document.getElementById('card-1');
    const card2 = document.getElementById('card-2');

    assert.ok(card1.classList.contains('ss-ghost-purged'), 'Blocked card has .ss-ghost-purged');
    assert.equal(card1.getAttribute('data-ss-blocked'), 'true', 'Blocked card marked data-ss-blocked');
    assert.equal(card1.style.display, 'none', 'Blocked card is hidden from feed');

    assert.equal(card2.classList.contains('ss-ghost-purged'), false, 'Clean card not purged');
    assert.notEqual(card2.style.display, 'none', 'Clean card remains visible');
  });

  test('GS.3: Ghost Shield purges blocked keyword items from feed', async () => {
    await resetStorage();
    resetDOM();

    const fc = window.FeedController;
    fc.setBlocklist(['prank', 'clickbait'], []);

    document.body.innerHTML = `
      <div id="contents">
        <ytd-rich-item-renderer id="card-prank">
          <h3 id="video-title">Craziest Public Prank Ever</h3>
          <ytd-channel-name id="channel-name">FunChannel</ytd-channel-name>
        </ytd-rich-item-renderer>
        <ytd-rich-item-renderer id="card-learning">
          <h3 id="video-title">Calculus Full Course</h3>
          <ytd-channel-name id="channel-name">MathAcademy</ytd-channel-name>
        </ytd-rich-item-renderer>
      </div>
    `;

    fc.applyBlocklist();

    const prankCard = document.getElementById('card-prank');
    const mathCard = document.getElementById('card-learning');

    assert.ok(prankCard.classList.contains('ss-ghost-purged'), 'Prank card purged');
    assert.equal(prankCard.style.display, 'none', 'Prank card hidden');

    assert.equal(mathCard.classList.contains('ss-ghost-purged'), false, 'Math card untouched');
  });

  test('GS.4: Direct watch page navigation to blocked creator halts video and displays strict overlay', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['BannedInfluencer']);
    await StorageUtil.updateSetting('ghostShield', true);

    resetDOM();
    global.location.pathname = '/watch';
    global.location.href = 'https://www.youtube.com/watch?v=blocked99';

    document.body.innerHTML = `
      <div id="above-the-fold">
        <div id="title"><h1 class="ytd-watch-metadata">My Latest Video</h1></div>
        <div id="owner">
          <ytd-channel-name id="channel-name"><a class="yt-simple-endpoint">BannedInfluencer</a></ytd-channel-name>
        </div>
      </div>
      <div id="movie_player"><video id="movie_player_video"></video></div>
    `;

    const qb = new QuickBlock();
    const blocked = await qb.checkAndEnforceStrictBlock();

    assert.equal(blocked, true, 'Blocked creator intercepted on watch page');
    const overlay = document.getElementById('ss-blocked-content-overlay');
    assert.ok(overlay, 'Strict overlay mounted');
    assert.ok(overlay.textContent.includes('BannedInfluencer'), 'Contains creator name');

    qb.disable();
  });

  test('GS.5: Strict overlay contains safe Return to Feed and Blocklist Studio buttons with zero bypass', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedKeywords', ['spoiler']);
    await StorageUtil.updateSetting('ghostShield', true);

    resetDOM();
    global.location.pathname = '/watch';
    document.body.innerHTML = `
      <div id="above-the-fold">
        <div id="title"><h1 class="ytd-watch-metadata">Huge Movie Spoiler Review</h1></div>
        <div id="owner"><ytd-channel-name id="channel-name">MovieReviewer</ytd-channel-name></div>
      </div>
    `;

    const qb = new QuickBlock();
    await qb.checkAndEnforceStrictBlock();

    const overlay = document.getElementById('ss-blocked-content-overlay');
    assert.ok(overlay);

    const homeBtn = overlay.querySelector('#ss-btn-blocked-home');
    const studioBtn = overlay.querySelector('#ss-btn-blocked-studio');

    assert.ok(homeBtn, 'Home button present');
    assert.ok(studioBtn, 'Studio button present');
    assert.equal(overlay.querySelector('#ss-btn-bypass'), null, 'No bypass button allowed');

    qb.disable();
  });

  test('GS.6: Header popup HUD contains Ghost Shield (Strict Purge) toggle row with storage sync', async () => {
    await resetStorage();
    resetDOM();

    document.body.innerHTML = `
      <ytd-masthead id="masthead">
        <div id="end"><div id="buttons"></div></div>
      </ytd-masthead>
    `;

    const hb = window.HeaderButton;
    hb.enable();
    hb.tryInject();
    await hb.openPopup();

    const dialog = document.getElementById('ss-popup-dialog');
    assert.ok(dialog, 'Popup dialog open');

    const ghostToggle = dialog.querySelector('#ss-toggle-ghost-shield');
    assert.ok(ghostToggle, 'Ghost Shield toggle row exists in HUD');
    assert.equal(ghostToggle.checked, true, 'Ghost Shield checked by default');

    // Toggle off
    ghostToggle.checked = false;
    if (typeof ghostToggle.dispatchEvent === 'function') {
      ghostToggle.dispatchEvent('change');
    }

    hb.closePopup();
    hb.disable();
  });

  test('GS.7: Block button is hidden on home screen (/) and visible on watch pages (/watch)', async () => {
    await resetStorage();
    resetDOM();

    document.body.innerHTML = `
      <ytd-masthead id="masthead">
        <div id="end"><div id="buttons"></div></div>
      </ytd-masthead>
    `;

    // 1. On Home Screen (/)
    global.location.pathname = '/';
    global.location.href = 'https://www.youtube.com/';

    const hb = window.HeaderButton;
    hb.enable();
    hb.tryInject();

    const qb = new QuickBlock();
    qb.enable();

    const blockBtn = document.getElementById('ss-quick-block-btn');
    assert.ok(blockBtn, 'Block button exists in DOM');
    assert.equal(blockBtn.style.display, 'none', 'Block button is hidden on homescreen (display: none)');

    const shieldBtn = document.getElementById('ss-header-btn');
    assert.ok(shieldBtn, 'Shield button exists in DOM');
    assert.notEqual(shieldBtn.style.display, 'none', 'Shield button remains visible on homescreen');

    // 2. Navigate to Watch Page (/watch)
    global.location.pathname = '/watch';
    global.location.href = 'https://www.youtube.com/watch?v=12345';
    hb.onNavigate();
    qb.onNavigate();

    assert.equal(blockBtn.style.display, 'inline-flex', 'Block button is visible on watch page (display: inline-flex)');

    // 3. Navigate back to Home (/)
    global.location.pathname = '/';
    global.location.href = 'https://www.youtube.com/';
    hb.onNavigate();
    qb.onNavigate();

    assert.equal(blockBtn.style.display, 'none', 'Block button is hidden again on homescreen');

    hb.disable();
    qb.disable();
  });

});
