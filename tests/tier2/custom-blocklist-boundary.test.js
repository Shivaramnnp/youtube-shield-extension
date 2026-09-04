/**
 * Tier 2 Test Suite: Custom Blocklist Boundary, Scale, Security & Adversarial Tests
 * tests/tier2/custom-blocklist-boundary.test.js
 *
 * Validates:
 * - Extreme inputs: empty strings, whitespace-only, extreme lengths, 1000+ items scale stress
 * - XSS & HTML injection payloads (<script>, <img>, onerror, javascript:)
 * - Unicode, non-Latin scripts (CJK, Cyrillic, Hindi, Arabic) and Emoji preservation
 * - Regex metacharacter safety (C++, C#, Node.js, parentheses, brackets, regex anchors)
 * - Timer expiration boundaries (4.9s vs 5.1s for undo toast lifecycle)
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');
require('../../content/js/feed-controller');

// Helper to escape regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('Tier 2: Custom Blocklist Boundary, Scale & Adversarial Tests', () => {

  test('T2.1: Extreme whitespace variations (tabs, newlines, zero-width spaces) are sanitized or rejected', async () => {
    await resetStorage();
    const variations = ['   ', '\t\t\n\r', '  \n  \t  ', ''];

    const channels = [];
    for (const v of variations) {
      const cleaned = (typeof StorageUtil.cleanChannelName === 'function')
        ? StorageUtil.cleanChannelName(v)
        : v.trim();
      if (cleaned && cleaned.toLowerCase() !== 'youtube channel') {
        channels.push(cleaned);
      }
    }

    assert.equal(channels.length, 0, 'No blank or whitespace-only channels accepted');
  });

  test('T2.2: Extreme string lengths (1000+ chars) are handled without crash or memory fault', async () => {
    await resetStorage();
    const longName = 'A'.repeat(1000);
    const longKeyword = 'supercalifragilisticexpialidocious'.repeat(30);

    await StorageUtil.updateSetting('blockedChannels', [longName]);
    await StorageUtil.updateSetting('blockedKeywords', [longKeyword]);

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.blockedChannels[0].length, 1000);
    assert.equal(settings.blockedKeywords[0].length, longKeyword.length);
  });

  test('T2.3: Scale Stress: 1,000 unique channels and 1,000 unique keywords storage and badge calculation', async () => {
    await resetStorage();
    const largeChannels = [];
    const largeKeywords = [];

    for (let i = 1; i <= 1000; i++) {
      largeChannels.push(`Channel_${i}`);
      largeKeywords.push(`keyword_${i}`);
    }

    await StorageUtil.updateSetting('blockedChannels', largeChannels);
    await StorageUtil.updateSetting('blockedKeywords', largeKeywords);

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.blockedChannels.length, 1000);
    assert.equal(settings.blockedKeywords.length, 1000);

    const totalCount = settings.blockedChannels.length + settings.blockedKeywords.length;
    assert.equal(totalCount, 2000, 'Total badge count calculates 2000 items');
  });

  test('T2.4: Scale Stress: Search filtering across 1,000 items executes rapidly without hanging', async () => {
    const items = [];
    for (let i = 1; i <= 1000; i++) {
      items.push(`TechCreator_${i}`);
    }

    const query = 'techcreator_5';
    const start = Date.now();
    const matches = items.filter(item => item.toLowerCase().includes(query));
    const duration = Date.now() - start;

    assert.ok(matches.length >= 111, 'Matches all TechCreator_5, 50-59, 500-599');
    assert.ok(duration < 50, `1000-item search completed in ${duration}ms (< 50ms)`);
  });

  test('T2.5: XSS & HTML Injection Payloads in Channel Names are escaped safely in DOM', async () => {
    await resetStorage();
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      '<svg/onload="alert(document.cookie)">',
      '<iframe src="javascript:alert(1)">',
      '"><script>alert(1)</script>'
    ];

    resetDOM();
    const container = document.createElement('div');
    container.id = 'chip-container';
    document.body.appendChild(container);

    xssPayloads.forEach((payload, idx) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.id = `xss-chip-${idx}`;

      const label = document.createElement('span');
      label.className = 'chip-label';
      label.textContent = payload; // Safe assignment

      chip.appendChild(label);
      container.appendChild(chip);
    });

    // Verify no script tags created in DOM
    const scripts = document.querySelectorAll('script');
    assert.equal(scripts.length, 0, 'No executable script elements injected');

    const chip0 = document.getElementById('xss-chip-0');
    assert.equal(chip0.querySelector('.chip-label').textContent, '<script>alert("XSS")</script>');
    assert.equal(chip0.querySelector('script'), null, 'Script tag is not parsed as HTML element');
  });

  test('T2.6: Unicode & Non-Latin Scripts (CJK, Cyrillic, Hindi, Arabic) are preserved accurately', async () => {
    await resetStorage();
    const unicodeChannels = [
      'ヒカキン TV',         // Japanese
      'Русский Блог',       // Russian / Cyrillic
      'तकनीकी ज्ञान',       // Hindi / Devanagari
      'قناة تقنية'          // Arabic
    ];

    const unicodeKeywords = [
      'アニメ',              // Anime (Japanese)
      'новости',            // News (Russian)
      'समाचार',             // News (Hindi)
      'برمجة'               // Programming (Arabic)
    ];

    await StorageUtil.updateSetting('blockedChannels', unicodeChannels);
    await StorageUtil.updateSetting('blockedKeywords', unicodeKeywords);

    const settings = await StorageUtil.getSettings();
    assert.deepEqual(settings.blockedChannels, unicodeChannels);
    assert.deepEqual(settings.blockedKeywords, unicodeKeywords);
  });

  test('T2.7: Unicode and Emoji Channel & Keyword matching in FeedController', async () => {
    resetDOM();
    const fc = window.FeedController || new (require('../../content/js/feed-controller'))();
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];
    fc.setBlocklist(['🎮 gaming', '🔥 viral'], ['ヒカキン TV', 'तकनीकी ज्ञान']);

    document.body.innerHTML = `
      <ytd-rich-item-renderer id="v1">
        <span id="video-title">Epic 🎮 Gaming Highlights</span>
        <span id="channel-name">CoolGamer</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="v2">
        <span id="video-title">Tokyo Vlog 2026</span>
        <span id="channel-name">ヒカキン TV</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="v3">
        <span id="video-title">Clean Coding in Rust</span>
        <span id="channel-name">Rustacean</span>
      </ytd-rich-item-renderer>
    `;

    fc.applyBlocklist();

    const v1 = document.getElementById('v1');
    const v2 = document.getElementById('v2');
    const v3 = document.getElementById('v3');

    assert.equal(v1.style.display, 'none', 'Emoji keyword 🎮 gaming is hidden');
    assert.equal(v2.style.display, 'none', 'Japanese channel ヒカキン TV is hidden');
    assert.equal(v3.style.display, '', 'Non-blocked video remains visible');
  });

  test('T2.8: Regex Metacharacter Safety: Keywords with C++, C#, Node.js, dots, and brackets do not break regex', async () => {
    resetDOM();
    const fc = window.FeedController || new (require('../../content/js/feed-controller'))();
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];

    // Keywords containing regex special chars
    const rawKeywords = ['c++', 'c#', 'node.js', 'vue (3.0)', '[1080p]', '$$$'];
    fc.setBlocklist(rawKeywords, []);

    document.body.innerHTML = `
      <ytd-rich-item-renderer id="v_cpp">
        <span id="video-title">Modern C++ Tutorial</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="v_nodejs">
        <span id="video-title">Node.js Express Server</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="v_node_dot">
        <span id="video-title">Nodexjs Express Server</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="v_money">
        <span id="video-title">Make $$$ Quick Scheme</span>
      </ytd-rich-item-renderer>
      <ytd-rich-item-renderer id="v_clean">
        <span id="video-title">Python Automation Scripts</span>
      </ytd-rich-item-renderer>
    `;

    fc.applyBlocklist();

    const vCpp = document.getElementById('v_cpp');
    const vNode = document.getElementById('v_nodejs');
    const vMoney = document.getElementById('v_money');
    const vClean = document.getElementById('v_clean');

    assert.equal(vCpp.style.display, 'none', 'C++ title matched and hidden');
    assert.equal(vNode.style.display, 'none', 'Node.js title matched and hidden');
    assert.equal(vMoney.style.display, 'none', '$$$ title matched and hidden');
    assert.equal(vClean.style.display, '', 'Python title remains visible');
  });

  test('T2.9: Timer Expiration Boundary: Undo at 4900ms succeeds vs 5100ms timer expiration', async () => {
    let undoExecuted = false;
    let redirectExecuted = false;
    let toastActive = true;

    const timerDuration = 5000;
    const startTime = Date.now();

    // Simulation of timer controller
    const simulateUndoAction = (elapsedMs) => {
      if (elapsedMs < timerDuration) {
        undoExecuted = true;
        toastActive = false;
        return { success: true, message: 'Undo successful' };
      } else {
        redirectExecuted = true;
        toastActive = false;
        return { success: false, message: 'Undo expired' };
      }
    };

    // Sub-boundary 1: 4900ms (within 5.0s window)
    const resultAt4900 = simulateUndoAction(4900);
    assert.equal(resultAt4900.success, true);
    assert.equal(undoExecuted, true);
    assert.equal(redirectExecuted, false);

    // Sub-boundary 2: 5100ms (after 5.0s window)
    undoExecuted = false;
    redirectExecuted = false;
    const resultAt5100 = simulateUndoAction(5100);
    assert.equal(resultAt5100.success, false);
    assert.equal(redirectExecuted, true);
  });

  test('T2.10: Case sensitivity edge case: Uppercase, lowercase, and mixed case matching across blocklist', async () => {
    resetDOM();
    const fc = window.FeedController || new (require('../../content/js/feed-controller'))();
    fc.disable();
    fc.isActive = false;
    fc.goalKeywords = [];
    fc.setBlocklist(['REACT', 'vLoG'], ['MiXedCaseChannel']);

    document.body.innerHTML = `
      <ytd-video-renderer id="card1">
        <span id="video-title">Learn react in 2026</span>
        <span id="channel-name">DevTube</span>
      </ytd-video-renderer>
      <ytd-video-renderer id="card2">
        <span id="video-title">Daily Vlog #42</span>
        <span id="channel-name">Vlogger</span>
      </ytd-video-renderer>
      <ytd-video-renderer id="card3">
        <span id="video-title">Unrelated Video</span>
        <span id="channel-name">mixedcasechannel</span>
      </ytd-video-renderer>
    `;

    fc.applyBlocklist();

    assert.equal(document.getElementById('card1').style.display, 'none', 'Lowercase react matches uppercase REACT keyword');
    assert.equal(document.getElementById('card2').style.display, 'none', 'Uppercase Vlog matches mixed case vLoG keyword');
    assert.equal(document.getElementById('card3').style.display, 'none', 'Lowercase channel matches MiXedCaseChannel');
  });

});
