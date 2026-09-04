/**
 * Tier 2: Feature 7 Goal Mode Boundary & Corner Cases Suite
 */

require('../harness/mock-extension-env.js');
const { test, describe, assert, resetDOM } = require('../harness/test-helpers');
require('../../content/js/observer-utils');
require('../../content/js/feed-controller');
require('../../content/js/goal-mode');

describe('Feature 7 Boundaries: Goal Mode', () => {

  test('Goal Mode: Technical keyword extraction for C++, UI/UX, AI, Go, SQL, Web3', async () => {
    const goalMode = global.window.GoalMode;

    const keywords1 = goalMode.extractGoalKeywords("Learn C++ programming and UI/UX design");
    assert.ok(keywords1.includes('cplusplus'), 'Should preserve C++ as cplusplus');
    assert.ok(keywords1.includes('uiux'), 'Should preserve UI/UX as uiux');

    const keywords2 = goalMode.extractGoalKeywords("Advanced AI & Go microservices with SQL & Web3");
    assert.ok(keywords2.includes('ai'), 'Should preserve AI');
    assert.ok(keywords2.includes('go'), 'Should preserve Go');
    assert.ok(keywords2.includes('sql'), 'Should preserve SQL');
    assert.ok(keywords2.includes('web3'), 'Should preserve Web3');
  });

  test('Goal Mode: Empty goal prompt or stop-words-only goal handling', async () => {
    const goalMode = global.window.GoalMode;

    const emptyKw = goalMode.extractGoalKeywords("");
    assert.deepEqual(emptyKw, []);

    const stopWordsOnlyKw = goalMode.extractGoalKeywords("Learn how to study");
    assert.deepEqual(stopWordsOnlyKw, []);
  });

  test('Goal Mode: Special regex characters in video titles and goals', async () => {
    const goalMode = global.window.GoalMode;
    const goalWithRegex = "Master C++ (v2.0) [regex+test] $100^2 *all*";

    assert.doesNotThrow(() => {
      const keywords = goalMode.extractGoalKeywords(goalWithRegex);
      assert.ok(Array.isArray(keywords));
    });
  });

  test('Goal Mode: Case-insensitive topic and title matching', async () => {
    const goalMode = global.window.GoalMode;
    const keywords = goalMode.extractGoalKeywords("Python Data Science");

    const textUpper = "PYTHON DATA SCIENCE TUTORIAL".toLowerCase();
    const textMixed = "PyThOn DaTa ScIeNcE GuIdE".toLowerCase();

    const isUpperMatch = keywords.some(kw => textUpper.includes(kw));
    const isMixedMatch = keywords.some(kw => textMixed.includes(kw));

    assert.equal(isUpperMatch, true);
    assert.equal(isMixedMatch, true);
  });

  test('Goal Mode: XSS prevention via HTML escaping in block overlay', async () => {
    const goalMode = global.window.GoalMode;

    const maliciousGoal = "<script>alert('xss')</script>";
    const maliciousTitle = "<img src=x onerror=alert(1)>";

    const escapedGoal = goalMode.escapeHtml(maliciousGoal);
    const escapedTitle = goalMode.escapeHtml(maliciousTitle);

    assert.equal(escapedGoal.includes('<script>'), false);
    assert.ok(escapedGoal.includes('&lt;script&gt;'));

    assert.equal(escapedTitle.includes('<img'), false);
    assert.ok(escapedTitle.includes('&lt;img'));
  });

  test('Goal Mode: Strict Play Lock enforcement when video is off-topic', async () => {
    resetDOM();
    const goalMode = global.window.GoalMode;

    // Mock video element with pause spy
    let pausedCalled = false;
    const video = global.document.createElement('video');
    video.pause = () => { pausedCalled = true; };
    global.document.body.appendChild(video);

    goalMode.isBlocked = true;
    goalMode.isActive = true;

    // Simulate play attempt
    goalMode.onPlayAttempt({ target: video });
    assert.equal(pausedCalled, true);

    goalMode.disable();
  });

});
