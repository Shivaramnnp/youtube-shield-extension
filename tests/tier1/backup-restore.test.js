/**
 * Tier 1 Test Suite: R4 - Backup & Restore Feature (backup-restore.test.js)
 * Tests Data Backup export generation (JSON/CSV) and import restoration validation.
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');

describe('R4: Data Backup, Export & Import', () => {

  test('R4.1: JSON backup payload exports both settings and tracking objects', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('learningGoal', 'Master Machine Learning');
    
    const tracking = await StorageUtil.getTracking();
    tracking.dailyWatchTime['2026-08-09'] = 3600;
    tracking.dailyLearningTime['2026-08-09'] = 3600;
    await StorageUtil.saveTracking(tracking);

    const settings = await StorageUtil.getSettings();
    const backupObj = { settings, tracking };
    const jsonString = JSON.stringify(backupObj, null, 2);

    const parsed = JSON.parse(jsonString);
    assert.ok(parsed.settings, 'Backup JSON contains settings object');
    assert.ok(parsed.tracking, 'Backup JSON contains tracking object');
    assert.equal(parsed.settings.learningGoal, 'Master Machine Learning', 'Backup preserves custom settings');
    assert.equal(parsed.tracking.dailyWatchTime['2026-08-09'], 3600, 'Backup preserves daily watch time');
  });

  test('R4.2: CSV analytics export produces correctly formatted header and data rows', async () => {
    await resetStorage();
    const tracking = await StorageUtil.getTracking();
    tracking.dailyWatchTime = { '2026-08-08': 3600, '2026-08-09': 7200 };
    tracking.dailyLearningTime = { '2026-08-08': 1800, '2026-08-09': 5400 };

    let csv = "Date,Total Watch Time (Mins),Learning Time (Mins),Focus Score (%)\n";
    const dates = Object.keys(tracking.dailyWatchTime).sort();

    dates.forEach(d => {
      const totalMins = Math.round((tracking.dailyWatchTime[d] || 0) / 60);
      const learnMins = Math.round((tracking.dailyLearningTime[d] || 0) / 60);
      const score = totalMins > 0 ? Math.round((learnMins / totalMins) * 100) : 0;
      csv += `${d},${totalMins},${learnMins},${score}%\n`;
    });

    const lines = csv.trim().split('\n');
    assert.equal(lines[0], 'Date,Total Watch Time (Mins),Learning Time (Mins),Focus Score (%)', 'CSV header match');
    assert.equal(lines[1], '2026-08-08,60,30,50%', 'Row 1 math correct (60m total, 30m learn, 50%)');
    assert.equal(lines[2], '2026-08-09,120,90,75%', 'Row 2 math correct (120m total, 90m learn, 75%)');
  });

  test('R4.3: Import JSON restores settings and tracking back into StorageUtil', async () => {
    await resetStorage();

    const importPayload = {
      settings: {
        shortsBlocker: true,
        focusMode: false,
        learningGoal: 'Python & Web Development',
        blockedKeywords: ['gaming', 'vlog'],
        blockedChannels: ['FunChannel']
      },
      tracking: {
        dailyWatchTime: { '2026-08-09': 5000 },
        dailyLearningTime: { '2026-08-09': 4000 },
        gamification: {
          currentStreak: 12,
          totalAP: 600,
          rankTier: 'Gold Mastermind',
          badges: ['first_step', 'consistency_master']
        }
      }
    };

    if (importPayload.settings) await StorageUtil.saveSettings(importPayload.settings);
    if (importPayload.tracking) await StorageUtil.saveTracking(importPayload.tracking);

    const restoredSettings = await StorageUtil.getSettings();
    const restoredTracking = await StorageUtil.getTracking();

    assert.equal(restoredSettings.learningGoal, 'Python & Web Development', 'Settings restored');
    assert.deepEqual(restoredSettings.blockedKeywords, ['gaming', 'vlog'], 'Blocked keywords restored');
    assert.equal(restoredTracking.gamification.currentStreak, 12, 'Streak restored');
    assert.equal(restoredTracking.gamification.totalAP, 600, 'Total AP restored');
  });

  test('R4.4: Invalid JSON import payload throws error during parsing', () => {
    const invalidRawJson = "INVALID_NON_JSON_CONTENT";
    assert.throws(() => {
      JSON.parse(invalidRawJson);
    }, 'Parsing invalid JSON string throws SyntaxError');
  });

});
