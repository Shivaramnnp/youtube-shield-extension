/**
 * Tier 3 Cross-Feature Interaction Harness Sanity Test Suite.
 */

const { test, assert } = require('../harness/test-helpers');

test('Tier 3: Chrome runtime message passing triggers onMessage listeners', async () => {
  let receivedMessage = null;

  global.chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    receivedMessage = msg;
    sendResponse({ status: 'success' });
  });

  const response = await global.chrome.runtime.sendMessage({ action: 'SYNC_GAMIFICATION' });
  assert.equal(receivedMessage.action, 'SYNC_GAMIFICATION');
  assert.equal(response.status, 'success');
});
