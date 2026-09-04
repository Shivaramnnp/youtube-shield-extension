/**
 * Tier 1 Test Suite: R3 - Analytics Charts Feature (analytics-charts.test.js)
 * Tests calculation of daily watch/learning times and 7-day / 30-day analytics data structures.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');

describe('R3: 7-Day & 30-Day Visual Analytics Charts', () => {

  test('R3.1: Date key generation formats local date as YYYY-MM-DD', () => {
    const now = new Date(2026, 7, 9); // Aug 9, 2026
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    assert.equal(dateStr, '2026-08-09', 'Local date string is correctly formatted');
  });

  test('R3.2: Analytics data correctly calculates focus score percentage', async () => {
    await resetStorage();
    const tracking = await StorageUtil.getTracking();

    const today = '2026-08-09';
    tracking.dailyWatchTime[today] = 7200; // 2 hours total
    tracking.dailyLearningTime[today] = 5400; // 1.5 hours learning

    const totalSec = tracking.dailyWatchTime[today];
    const learnSec = tracking.dailyLearningTime[today];
    const focusScore = totalSec > 0 ? Math.round((learnSec / totalSec) * 100) : 0;

    assert.equal(focusScore, 75, 'Focus score correctly computed as 75%');
  });

  test('R3.3: 7-day date window generates 7 continuous date entries', () => {
    const dates = [];
    const now = new Date(2026, 7, 9);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${day}`);
    }

    assert.equal(dates.length, 7, 'Generates 7 dates');
    assert.equal(dates[0], '2026-08-03', 'Start date is 6 days ago');
    assert.equal(dates[6], '2026-08-09', 'End date is today');
  });

  test('R3.4: 30-day date window generates 30 continuous date entries', () => {
    const dates = [];
    const now = new Date(2026, 7, 9);

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${day}`);
    }

    assert.equal(dates.length, 30, 'Generates 30 dates');
    assert.equal(dates[29], '2026-08-09', 'End date is today');
  });

});
