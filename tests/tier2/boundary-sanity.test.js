/**
 * Tier 2 Boundary & Edge Case Harness Sanity Test Suite.
 */

const { test, assert, resetDOM } = require('../harness/test-helpers');

test('Tier 2: DOM reset clears child elements and attributes cleanly', async () => {
  const el = global.document.createElement('div');
  el.id = 'test-boundary-div';
  el.className = 'active-boundary-class';
  global.document.body.appendChild(el);

  assert.ok(global.document.getElementById('test-boundary-div'));
  resetDOM();
  assert.equal(global.document.getElementById('test-boundary-div'), null);
});

test('Tier 2: Storage area gracefully handles null and undefined query keys', async () => {
  await global.chrome.storage.local.set({ key1: 'val1', key2: 'val2' });
  const allData = await global.chrome.storage.local.get(null);
  assert.equal(allData.key1, 'val1');
  assert.equal(allData.key2, 'val2');
});
