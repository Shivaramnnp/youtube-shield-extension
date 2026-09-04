/**
 * Tier 1 Harness Sanity & Mock Verification Test Suite.
 */

const { test, assert, resetStorage, createMockStorage, assertGamificationData } = require('../harness/test-helpers');

test('Tier 1: Storage reset initializes clean chrome.storage.local', async () => {
  await resetStorage();
  const data = await global.chrome.storage.local.get(null);
  assert.deepEqual(data, {});
});

test('Tier 1: Mock storage creation saves pre-configured gamification data', async () => {
  const initialGamification = {
    tracking: {
      gamification: {
        totalAP: 250,
        totalEXP: 250,
        level: 2,
        rankTier: "Silver Scholar",
        badges: ["first_step"]
      }
    }
  };
  await createMockStorage(initialGamification);
  await assertGamificationData({ totalAP: 250, level: 2, rankTier: "Silver Scholar", badgeCount: 1 });
});
