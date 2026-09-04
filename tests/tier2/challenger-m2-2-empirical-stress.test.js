/**
 * Challenger M2-2 Empirical Stress & Boundary Test Suite
 * Tests UICleaner, FeedController, and 5 CSS Stylesheets.
 */

const fs = require('node:fs');
const path = require('node:path');
const { test, describe, assert, resetDOM } = require('../harness/test-helpers');
const { setupMockEnv } = require('../harness/mock-extension-env');

// Ensure mock environment is active
setupMockEnv();

// Require ObserverUtils & DOMUtils mock/implementation
if (fs.existsSync(path.join(__dirname, '../../utils/dom-utils.js'))) {
  require('../../utils/dom-utils');
}
if (fs.existsSync(path.join(__dirname, '../../content/js/observer-utils.js'))) {
  require('../../content/js/observer-utils');
}
const UICleaner = require('../../content/js/ui-cleaner');
const FeedController = require('../../content/js/feed-controller');

describe('Challenger M2-2: UICleaner 7 Toggles & Fallback Stress', () => {
  test('UICleaner: All 7 toggle keys map to correct CSS classes', () => {
    resetDOM();
    const expectedClasses = {
      hideBell: 'ss-hide-bell',
      hideSubCount: 'ss-hide-sub-count',
      hideChat: 'ss-hide-chat',
      hideTrending: 'ss-hide-trending',
      hideExplore: 'ss-hide-explore',
      hideMiniPlayer: 'ss-hide-mini-player',
      hideAutoplay: 'ss-hide-autoplay'
    };

    assert.deepEqual(UICleaner.classes, expectedClasses);
  });

  test('UICleaner: Rapid 50x toggle stress cycle across all 7 toggles', () => {
    resetDOM();
    const keys = Object.keys(UICleaner.classes);

    for (let cycle = 0; cycle < 50; cycle++) {
      const state = cycle % 2 === 0;
      const settings = {};
      keys.forEach(k => { settings[k] = state; });

      UICleaner.applySettings(settings);

      keys.forEach(k => {
        const cls = UICleaner.classes[k];
        if (state) {
          assert.ok(document.documentElement.classList.contains(cls), `Cycle ${cycle}: ${cls} missing from root`);
          assert.ok(document.body.classList.contains(cls), `Cycle ${cycle}: ${cls} missing from body`);
        } else {
          assert.ok(!document.documentElement.classList.contains(cls), `Cycle ${cycle}: ${cls} present on root when off`);
          assert.ok(!document.body.classList.contains(cls), `Cycle ${cycle}: ${cls} present on body when off`);
        }
      });
    }

    // Reset clean
    UICleaner.cleanup();
    keys.forEach(k => {
      const cls = UICleaner.classes[k];
      assert.ok(!document.documentElement.classList.contains(cls), `Cleanup failed: ${cls} on root`);
      assert.ok(!document.body.classList.contains(cls), `Cleanup failed: ${cls} on body`);
    });
  });

  test('UICleaner: Defensive handling of invalid settings object or keys', () => {
    resetDOM();
    // Non-object settings should not throw
    assert.doesNotThrow(() => UICleaner.applySettings(null));
    assert.doesNotThrow(() => UICleaner.applySettings(undefined));
    assert.doesNotThrow(() => UICleaner.applySettings(123));
    assert.doesNotThrow(() => UICleaner.applySettings("invalid"));

    // Unknown keys should be ignored
    assert.doesNotThrow(() => UICleaner.updateSetting("nonExistentKey", true));
    assert.doesNotThrow(() => UICleaner.updateSetting(null, true));

    // Cleanup when no classes applied should pass cleanly
    assert.doesNotThrow(() => UICleaner.cleanup());
  });

  test('UICleaner: Direct DOM fallback when DOMUtils is not present', () => {
    resetDOM();
    const oldDOMUtils = window.DOMUtils;
    delete window.DOMUtils;

    try {
      UICleaner.updateSetting('hideBell', true);
      assert.ok(document.documentElement.classList.contains('ss-hide-bell'));
      assert.ok(document.body.classList.contains('ss-hide-bell'));

      UICleaner.updateSetting('hideBell', false);
      assert.ok(!document.documentElement.classList.contains('ss-hide-bell'));
      assert.ok(!document.body.classList.contains('ss-hide-bell'));
    } finally {
      window.DOMUtils = oldDOMUtils;
    }
  });
});

describe('Challenger M2-2: FeedController Keyword Extraction & Technical Term Normalization', () => {
  test('FeedController: Technical terms (C++, C#, UI/UX, AI, ML, SQL, Web3) preservation', () => {
    const fc = FeedController;

    const kw1 = fc.extractKeywords('Learn C++ programming and C# development');
    assert.ok(kw1.includes('cplusplus'), `C++ should normalize to cplusplus. Got: ${JSON.stringify(kw1)}`);
    assert.ok(kw1.includes('csharp'), `C# should normalize to csharp. Got: ${JSON.stringify(kw1)}`);

    const kw2 = fc.extractKeywords('UI/UX design for web3 applications');
    assert.ok(kw2.includes('uiux'), `UI/UX should normalize to uiux. Got: ${JSON.stringify(kw2)}`);
    assert.ok(kw2.includes('web3'), `web3 should be preserved. Got: ${JSON.stringify(kw2)}`);

    const kw3 = fc.extractKeywords('AI and ML models with Python and SQL');
    assert.ok(kw3.includes('ai'), `AI should be kept. Got: ${JSON.stringify(kw3)}`);
    assert.ok(kw3.includes('ml'), `ML should be kept. Got: ${JSON.stringify(kw3)}`);
    assert.ok(kw3.includes('sql'), `SQL should be kept. Got: ${JSON.stringify(kw3)}`);
    assert.ok(kw3.includes('python'), `Python should be kept. Got: ${JSON.stringify(kw3)}`);
  });

  test('FeedController: Category expansion for coding, english, upsc, communication', () => {
    const fc = FeedController;

    const kwCoding = fc.extractKeywords('study coding');
    assert.ok(kwCoding.includes('programming'), `coding category should expand synonyms`);
    assert.ok(kwCoding.includes('developer'));

    const kwComm = fc.extractKeywords('master communication');
    assert.ok(kwComm.includes('speaking'));
    assert.ok(kwComm.includes('presentation'));
  });

  test('FeedController: Blocklist normalization and filtering edge cases', () => {
    resetDOM();
    const fc = FeedController;

    fc.setBlocklist(['  SPAM  ', 'Clickbait', 123], [' BadChannel ']);
    assert.deepEqual(fc.blockedKeywords, ['spam', 'clickbait', '123']);
    assert.deepEqual(fc.blockedChannels, ['badchannel']);

    // Create DOM video cards
    const card1 = document.createElement('ytd-rich-item-renderer');
    const title1 = document.createElement('div');
    title1.id = 'video-title';
    title1.textContent = 'Awesome SPAM video tutorial';
    const ch1 = document.createElement('div');
    ch1.id = 'channel-name';
    ch1.textContent = 'Good Channel';
    card1.appendChild(title1);
    card1.appendChild(ch1);

    const card2 = document.createElement('ytd-rich-item-renderer');
    const title2 = document.createElement('div');
    title2.id = 'video-title';
    title2.textContent = 'Great tutorial video';
    const ch2 = document.createElement('div');
    ch2.id = 'channel-name';
    ch2.textContent = 'BadChannel Tech';
    card2.appendChild(title2);
    card2.appendChild(ch2);

    document.body.appendChild(card1);
    document.body.appendChild(card2);

    fc.applyBlocklist();

    assert.equal(card1.style.display, 'none');
    assert.ok(card1.classList.contains('off-topic'));
    assert.equal(card2.style.display, 'none');
    assert.ok(card2.classList.contains('off-topic'));

    // Clear blocklist and verify unhiding
    fc.setBlocklist([], []);
    assert.equal(card1.style.display, '');
    assert.ok(!card1.classList.contains('off-topic'));
    assert.equal(card2.style.display, '');
    assert.ok(!card2.classList.contains('off-topic'));
  });
});

describe('Challenger M2-2: Dynamic DOM Injection & Search Page Behavior', () => {
  test('FeedController: Dynamic injection of 200 video cards while observing', () => {
    resetDOM();
    const fc = FeedController;
    fc.enable('Learn Python Programming');

    const createdCards = [];
    for (let i = 0; i < 200; i++) {
      const card = document.createElement('ytd-rich-item-renderer');
      const title = document.createElement('div');
      title.id = 'video-title';
      title.textContent = (i % 2 === 0) ? `Python Tutorial Part ${i}` : `Random Gaming Stream ${i}`;

      const ch = document.createElement('div');
      ch.id = 'channel-name';
      ch.textContent = `Channel ${i}`;

      card.appendChild(title);
      card.appendChild(ch);
      document.body.appendChild(card);
      createdCards.push(card);
    }

    // Run filter on all cards
    fc.filterFeed(createdCards);

    let hiddenCount = 0;
    let visibleCount = 0;

    createdCards.forEach((card, idx) => {
      if (idx % 2 === 0) {
        // Relevant Python tutorial
        assert.equal(card.style.display, '', `Card ${idx} (Python) should be visible`);
        assert.ok(!card.classList.contains('off-topic'));
        visibleCount++;
      } else {
        // Off-topic gaming stream
        assert.equal(card.style.display, 'none', `Card ${idx} (Gaming) should be hidden`);
        assert.ok(card.classList.contains('off-topic'));
        hiddenCount++;
      }
    });

    assert.equal(visibleCount, 100);
    assert.equal(hiddenCount, 100);

    fc.disable();
    // After disable, cards should be unhidden
    createdCards.forEach(card => {
      assert.equal(card.style.display, '');
      assert.ok(!card.classList.contains('off-topic'));
    });
  });

  test('FeedController: Search Page (/results) preserves search results during Study Mode', () => {
    resetDOM();
    const fc = FeedController;

    // Simulate window.location.pathname = '/results'
    const origPathname = window.location.pathname;
    window.location.pathname = '/results';

    try {
      fc.enable('Python');

      const card = document.createElement('ytd-video-renderer');
      const title = document.createElement('div');
      title.id = 'video-title';
      title.textContent = 'Cooking Pasta Recipe'; // Unrelated to Python
      card.appendChild(title);
      document.body.appendChild(card);

      fc.filterFeed([card]);

      // On /results page, Study Mode should NOT hide search results
      assert.equal(card.style.display, '');
      assert.ok(!card.classList.contains('off-topic'));

      fc.disable();
    } finally {
      window.location.pathname = origPathname;
    }
  });

  test('FeedController: Defensive guards against malformed cards or Shorts cards', () => {
    resetDOM();
    const fc = FeedController;
    fc.enable('JavaScript');

    // 1. Card missing #video-title
    const emptyCard = document.createElement('ytd-rich-item-renderer');
    assert.doesNotThrow(() => fc.filterFeed([emptyCard]));

    // 2. Card with Shorts link (should be skipped by FeedController, left for shorts-blocker)
    const shortsCard = document.createElement('ytd-rich-item-renderer');
    const title = document.createElement('div');
    title.id = 'video-title';
    title.textContent = 'Funny Cat';
    const shortsLink = document.createElement('a');
    shortsLink.setAttribute('href', '/shorts/12345');
    shortsCard.appendChild(title);
    shortsCard.appendChild(shortsLink);

    fc.filterFeed([shortsCard]);
    // Should NOT be marked off-topic by FeedController
    assert.ok(!shortsCard.classList.contains('off-topic'));

    fc.disable();
  });
});

describe('Challenger M2-2: 5 CSS Stylesheets Structural & Selector Validation', () => {
  const cssFiles = [
    'content/css/clean-ui.css',
    'content/css/feed-controller.css',
    'content/css/focus-mode.css',
    'content/css/header-button.css',
    'content/css/hide-shorts.css'
  ];

  cssFiles.forEach(relPath => {
    test(`CSS Audit: ${relPath} file integrity, syntax, and rule coverage`, () => {
      const fullPath = path.join(__dirname, '../../', relPath);
      assert.ok(fs.existsSync(fullPath), `CSS file exists: ${relPath}`);

      const cssContent = fs.readFileSync(fullPath, 'utf8');
      assert.ok(cssContent.trim().length > 0, `CSS file is not empty: ${relPath}`);

      // Check brace balancing
      let openBraces = 0;
      let openParens = 0;
      for (const char of cssContent) {
        if (char === '{') openBraces++;
        if (char === '}') openBraces--;
        if (char === '(') openParens++;
        if (char === ')') openParens--;
        assert.ok(openBraces >= 0, `Unmatched closing brace in ${relPath}`);
        assert.ok(openParens >= 0, `Unmatched closing paren in ${relPath}`);
      }
      assert.equal(openBraces, 0, `Unclosed brace in ${relPath}`);
      assert.equal(openParens, 0, `Unclosed paren in ${relPath}`);

      // Check key rules per file
      if (relPath.includes('clean-ui.css')) {
        assert.ok(cssContent.includes('.ss-hide-bell'), `clean-ui.css contains .ss-hide-bell`);
        assert.ok(cssContent.includes('.ss-hide-trending'), `clean-ui.css contains .ss-hide-trending`);
        assert.ok(cssContent.includes('body.ss-hide-bell'), `clean-ui.css supports body fallback`);
        assert.ok(cssContent.includes('a[href="/feed/trending"]'), `clean-ui.css includes Firefox fallback`);
      }

      if (relPath.includes('focus-mode.css')) {
        assert.ok(cssContent.includes('.shorts-shield-focus-mode'), `focus-mode.css contains root class`);
        assert.ok(cssContent.includes('--ytd-watch-flexy-sidebar-width: 0px'), `focus-mode.css centers flexy video player`);
      }

      if (relPath.includes('hide-shorts.css')) {
        assert.ok(cssContent.includes('.shorts-shield-block-shorts'), `hide-shorts.css contains blocker class`);
        assert.ok(cssContent.includes('a[href^="/shorts/"]'), `hide-shorts.css contains narrowed shorts URL path selector`);
      }
    });
  });
});
