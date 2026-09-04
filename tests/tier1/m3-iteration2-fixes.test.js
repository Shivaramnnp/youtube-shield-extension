/**
 * Tier 1 Test Suite: Iteration 2 Bug Fixes Verification
 * Tests Bug 1 (strict off-topic goal blocking without fallback),
 * Bug 2 (defensive non-string handling in GoalMode.extractGoalKeywords),
 * and Bug 3 (clearing autoDismiss timeouts on manual banner dismissal in StudyMode).
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetDOM } = require('../harness/test-helpers');

require('../../utils/dom-utils');
require('../../content/js/feed-controller');
require('../../content/js/goal-mode');
require('../../content/js/study-mode');

describe('Iteration 2 Bug Fixes: Goal Mode & Study Mode', () => {

  test('Bug 1: GoalMode.checkVideoGoalAlignment blocks off-topic non-entertainment videos when keywords set', async () => {
    await resetDOM();
    const gm = window.GoalMode;
    gm.enable('Learn Python');

    // Mock watch page location
    global.window.location = {
      pathname: '/watch',
      search: '?v=offtopic123'
    };

    // Create title element without Python keywords, non-entertainment (e.g., baking tutorial)
    const titleEl = global.document.createElement('h1');
    titleEl.className = 'ytd-watch-metadata';
    const textEl = global.document.createElement('yt-formatted-string');
    textEl.textContent = 'How to Bake a Perfect Chocolate Cake';
    titleEl.appendChild(textEl);
    global.document.body.appendChild(titleEl);

    gm.checkVideoGoalAlignment();

    assert.equal(gm.isBlocked, true, 'Off-topic video is blocked when goal keywords are set');
    const overlay = global.document.getElementById('ss-goal-block-overlay');
    assert.ok(overlay, 'Goal block overlay displayed for off-topic video');

    gm.disable();
  });

  test('Bug 2: GoalMode.extractGoalKeywords handles non-string inputs defensively', async () => {
    const gm = window.GoalMode;

    assert.doesNotThrow(() => {
      assert.deepEqual(gm.extractGoalKeywords(123), [], 'Number input returns empty array');
      assert.deepEqual(gm.extractGoalKeywords(null), [], 'Null input returns empty array');
      assert.deepEqual(gm.extractGoalKeywords(undefined), [], 'Undefined input returns empty array');
      assert.deepEqual(gm.extractGoalKeywords({ goal: 'Python' }), [], 'Object input returns empty array');
    }, 'Non-string inputs do not throw exceptions');
  });

  test('Bug 3: StudyMode clears pending autoDismiss timeout on manual banner dismissal', async () => {
    await resetDOM();
    const sm = window.StudyMode;

    // Test showPomoAlert manual click
    sm.showPomoAlert('Test Pomo Notice');
    const notice = global.document.getElementById('ss-pomo-notice');
    assert.ok(notice, 'Pomo notice created');
    assert.equal(sm._noticeTimeouts.length, 1, 'One timeout tracked before click');

    // Click notice
    notice.dispatchEvent('click');
    assert.equal(sm._noticeTimeouts.length, 1, 'Only fade removal timeout remains after click (autoDismiss cleared)');

    // Test showAlignmentWarning manual click
    sm.showAlignmentWarning();
    const warning = global.document.getElementById('ss-alignment-warning');
    assert.ok(warning, 'Alignment warning created');
    const dismissBtn = warning.querySelector('#ss-dismiss-warning');
    assert.ok(dismissBtn, 'Dismiss button present');

    dismissBtn.dispatchEvent('click');
    assert.equal(sm._warningTimeouts.length, 1, 'Only fade removal timeout remains after click (autoDismiss cleared)');
  });

});
