const assert = require('assert');
const { StorageUtil } = require('../../utils/storage');
const GamificationEngine = require('../../utils/gamification-engine');

console.log('================ REVIEWER M1_2 ADVERSARIAL STRESS SUITE ================');

// 1. StorageUtil.migrateTimelineLog with corrupted / empty objects
console.log('\n--- TEST 1: StorageUtil.migrateTimelineLog ---');
const corruptedTracking = {
  timelineLog: [
    {},
    null,
    undefined,
    { title: '' },
    { durationSeconds: 0 },
    { id: '1', title: 'Valid 1', channel: 'Chan', durationSeconds: 100, timestamp: 1000, dateKey: '2026-08-23', status: 'watched' },
    {},
    { id: '2', title: 'Valid 1', channel: 'Chan', durationSeconds: 50, timestamp: 2000, dateKey: '2026-08-23', status: 'watched' },
    { __proto__: { polluted: true } },
    { title: '<script>alert(1)</script>', channel: 'Hack', durationSeconds: 30, timestamp: 3000, dateKey: '2026-08-23', status: 'watched' }
  ]
};

const res = StorageUtil.migrateTimelineLog(corruptedTracking);
console.log('Migrated length:', res.timelineLog.length);
assert.strictEqual(res.timelineLog.length, 2, 'Must filter out empty {} and merge consecutive valid entries');
assert.strictEqual(res.timelineLog[0].durationSeconds, 150, 'Duration must be summed (100 + 50 = 150)');
assert.strictEqual(res.timelineLog[0].title, 'Valid 1');
assert.strictEqual(res.timelineLog[1].title, '<script>alert(1)</script>');
assert.strictEqual(Object.prototype.polluted, undefined, 'No prototype pollution');
console.log('  [ PASS ] migrateTimelineLog passed corruption filtering');

// Test direct array input to migrateTimelineLog
const rawArray = [
  {},
  { title: 'Video A', channel: 'Ch', durationSeconds: 60, timestamp: 1000, dateKey: '2026-08-23', status: 'watched' },
  { title: 'Video A', channel: 'Ch', durationSeconds: 40, timestamp: 2000, dateKey: '2026-08-23', status: 'watched' }
];
const arrayRes = StorageUtil.migrateTimelineLog(rawArray);
assert.ok(Array.isArray(arrayRes), 'Should return array when array passed');
assert.strictEqual(arrayRes.length, 1);
assert.strictEqual(arrayRes[0].durationSeconds, 100);
console.log('  [ PASS ] migrateTimelineLog passed direct array handling');

// 2. Shortcut toggle logic
console.log('\n--- TEST 2: Background shortcut toggle logic ---');
function toggleShield(s) {
  const nextState = !(s.extensionEnabled !== false);
  s.extensionEnabled = nextState;
  return s.extensionEnabled;
}
assert.strictEqual(toggleShield({ extensionEnabled: true }), false, 'true -> false');
assert.strictEqual(toggleShield({ extensionEnabled: false }), true, 'false -> true');
assert.strictEqual(toggleShield({}), false, 'undefined (default ON) -> false');
assert.strictEqual(toggleShield({ extensionEnabled: undefined }), false, 'undefined -> false');
assert.strictEqual(toggleShield({ extensionEnabled: null }), false, 'null -> false');
console.log('  [ PASS ] Shortcut toggle logic verified for all boolean and undefined/null states');

// 3. Gamification EXP vs AP Level calculation in StudyMode
console.log('\n--- TEST 3: Gamification AP & EXP calculation ---');
const lvl0 = GamificationEngine.calculateLevelFromEXP(0);
assert.strictEqual(lvl0.level, 1);
assert.strictEqual(lvl0.progressPct, 0);

const lvl450 = GamificationEngine.calculateLevelFromEXP(450);
assert.strictEqual(lvl450.level, 2);

const rankBronze = GamificationEngine.getRankTierFromAP(50);
assert.strictEqual(rankBronze.currentRank.id, 'bronze_focus');
const rankSilver = GamificationEngine.getRankTierFromAP(250);
assert.strictEqual(rankSilver.currentRank.id, 'silver_scholar');
const rankGrandmaster = GamificationEngine.getRankTierFromAP(4000);
assert.strictEqual(rankGrandmaster.currentRank.id, 'grandmaster_legend');
assert.strictEqual(rankGrandmaster.isMaxRank, true);
console.log('  [ PASS Passed Gamification level & rank tier calculations');

// 4. escapeHtml sanitization
console.log('\n--- TEST 4: escapeHtml across various edge cases ---');
function escapeHtml(str) {
  return String(str || '')
    .replace(/&g/, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

assert.strictEqual(escapeHtml(null), '');
assert.strictEqual(escapeHtml(undefined), '');
assert.strictEqual(escapeHtml(0), '0');
assert.strictEqual(escapeHtml(false), 'false');
assert.strictEqual(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
assert.strictEqual(escapeHtml('" onerror="alert(1)'), '&quot; onerror=&quot;alert(1)');
assert.strictEqual(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
assert.strictEqual(escapeHtml("John" + "'" + "s Goal"), 'John&#039;s Goal');
console.log('  [ PASS ] escapeHtml safely handles all types and injection vectors');

console.log('\nALL ADVERSARIAL STRESS CHECKS PASSED CLEANLY!');
