/**
 * Tier 3: Study Mode & Goal Mode Pairwise Interaction Test Suite
 * Validates warning banner overlay z-index hierarchy, priority resolution, and DOM overlay lifecycle.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetDOM, resetStorage } = require('../harness/test-helpers');

require('../../utils/dom-utils');
require('../../content/js/study-mode');
require('../../content/js/goal-mode');

function cleanupModes() {
  if (window.StudyMode) {
    window.StudyMode.disable();
    window.StudyMode.bannerElement = null;
  }
  if (window.GoalMode) {
    window.GoalMode.disable();
  }
  resetDOM();
}

describe('Tier 3: Study Mode & Goal Mode Priority & Z-Index Interaction', () => {

  test('Study Mode injects top status banner (#ss-study-banner) with zIndex 9999', async () => {
    cleanupModes();
    const studyMode = window.StudyMode;
    studyMode.enable('Learn Data Structures');

    const banner = document.getElementById('ss-study-banner');
    assert.ok(banner, 'Expected Study Mode banner element in DOM');
    assert.equal(banner.style.zIndex, '9999', 'Study Mode banner zIndex must be 9999');

    studyMode.disable();
    assert.equal(document.getElementById('ss-study-banner'), null, 'Banner must be removed on disable');
  });

  test('Study Mode alignment warning overlay (#ss-alignment-warning) has higher zIndex (10000) than banner (9999)', async () => {
    cleanupModes();
    const studyMode = window.StudyMode;
    studyMode.enable('Learn Python');
    studyMode.showAlignmentWarning();

    const banner = document.getElementById('ss-study-banner');
    const warning = document.getElementById('ss-alignment-warning');

    assert.ok(banner, 'Banner must exist');
    assert.ok(warning, 'Warning overlay must exist');

    const bannerZ = parseInt(banner.style.zIndex, 10);
    const warningZ = parseInt(warning.style.zIndex, 10);

    assert.ok(warningZ > bannerZ, `Warning zIndex (${warningZ}) must be higher than banner zIndex (${bannerZ})`);
    assert.equal(warning.style.zIndex, '10000');

    studyMode.disable();
  });

  test('Goal Mode block overlay (#ss-goal-block-overlay) has max zIndex (2147483647) over Study Mode elements', async () => {
    cleanupModes();
    const studyMode = window.StudyMode;
    const goalMode = window.GoalMode;

    studyMode.enable('Learn Machine Learning');
    studyMode.showAlignmentWarning();
    goalMode.enable('Learn Machine Learning');
    goalMode.showGoalBlockOverlay('Gaming Stream #42');

    const banner = document.getElementById('ss-study-banner');
    const warning = document.getElementById('ss-alignment-warning');
    const goalOverlay = document.getElementById('ss-goal-block-overlay');

    assert.ok(banner, 'Banner exists');
    assert.ok(warning, 'Warning exists');
    assert.ok(goalOverlay, 'Goal block overlay exists');

    const bannerZ = parseInt(banner.style.zIndex, 10);
    const warningZ = parseInt(warning.style.zIndex, 10);
    const goalZ = parseInt(goalOverlay.style.zIndex, 10);

    assert.equal(goalZ, 2147483647, 'Goal Mode overlay must have maximum 32-bit int zIndex');
    assert.ok(goalZ > warningZ && goalZ > bannerZ, 'Goal overlay must take visual priority over Study Mode elements');

    goalMode.disable();
    studyMode.disable();
  });

  test('Disabling Goal Mode removes block overlay while preserving active Study Mode banner', async () => {
    cleanupModes();
    const studyMode = window.StudyMode;
    const goalMode = window.GoalMode;

    studyMode.enable('Learn Web Development');
    goalMode.enable('Learn Web Development');
    goalMode.showGoalBlockOverlay('Random VLOG');

    assert.ok(document.getElementById('ss-study-banner'));
    assert.ok(document.getElementById('ss-goal-block-overlay'));

    goalMode.disable();

    assert.equal(document.getElementById('ss-goal-block-overlay'), null, 'Goal block overlay must be removed');
    assert.ok(document.getElementById('ss-study-banner'), 'Study banner must remain in DOM');

    studyMode.disable();
  });

  test('On-topic video title validation suppresses warning overlay in Study Mode and block overlay in Goal Mode', async () => {
    cleanupModes();
    const studyMode = window.StudyMode;
    const goalMode = window.GoalMode;

    const goal = 'JavaScript Programming';

    const goalKeywords = goalMode.extractGoalKeywords(goal);
    assert.ok(goalKeywords.includes('javascript'), 'Keywords should include javascript');
    assert.ok(goalKeywords.includes('programming'), 'Keywords should include programming');

    studyMode.enable(goal);
    goalMode.enable(goal);

    assert.equal(document.getElementById('ss-alignment-warning'), null, 'No alignment warning for on-topic session');
    assert.equal(document.getElementById('ss-goal-block-overlay'), null, 'No goal block overlay for on-topic session');

    goalMode.disable();
    studyMode.disable();
  });

});
