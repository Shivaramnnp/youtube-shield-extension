const assert = require('assert');
const { setupMockEnv } = require('./harness/mock-extension-env');

async function testTracking() {
  const env = setupMockEnv();
  delete require.cache[require.resolve('../utils/storage.js')];
  const { StorageUtil, DEFAULT_TRACKING } = require('../utils/storage.js');

  const customTracking = { ...DEFAULT_TRACKING, weeklyTotal: 7200 };
  console.log("Saving custom tracking...", customTracking.weeklyTotal);
  await StorageUtil.saveTracking(customTracking);

  console.log("Memory tracking cache after save:", StorageUtil.getTracking);
  env.chrome.storage.local.get = async () => ({});

  const tracking = await StorageUtil.getTracking();
  console.log("Retrieved tracking:", tracking);
}

testTracking();
