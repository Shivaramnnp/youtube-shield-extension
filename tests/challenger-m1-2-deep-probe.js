/**
 * Deep Challenger M1-2 Empirical Investigation Harness
 */

const assert = require('assert');
require('./harness/mock-extension-env').setupMockEnv();
const { StorageUtil } = require('../utils/storage');

console.log('=== Deep Empirical Investigation for M1-2 ===\n');

// -------------------------------------------------------------
// Probe 1: Multi-word & repetition patterns in cleanChannelName
// -------------------------------------------------------------
console.log('1. Probing cleanChannelName repetition patterns:');
const repetitionCases = [
  { input: 'Firstpost Firstpost', expected: 'Firstpost' },
  { input: 'Linus Tech Tips Linus Tech Tips', expected: 'Linus Tech Tips' },
  { input: 'Tech News Tech News Tech News', expected: 'Tech News' }, // 6 words (3x2 words)
  { input: 'BBC BBC BBC', expected: 'BBC' }, // 3 words (3x1 word)
  { input: 'Vox Vox Vox Vox', expected: 'Vox' }, // 4 words (4x1 word)
  { input: 'IGN IGN IGN IGN', expected: 'IGN' },
  { input: 'A B C A B C A B C', expected: 'A B C' }, // 9 words (3x3 words)
  { input: 'The Verge The Verge The Verge', expected: 'The Verge' }, // 6 words (3x2 words)
  { input: 'CNN CNN', expected: 'CNN' },
  { input: 'firstpost Firstpost', expected: 'Firstpost' }, // Case insensitivity
  { input: 'FirstpostFirstpost', expected: 'Firstpost' }, // No space
  { input: 'LinusTechTipsLinusTechTips', expected: 'LinusTechTips' },
  { input: '日本語チャンネル日本語チャンネル', expected: '日本語チャンネル' }
];

for (const c of repetitionCases) {
  const result = StorageUtil.cleanChannelName(c.input);
  const pass = result.toLowerCase() === c.expected.toLowerCase();
  console.log(`  ${pass ? '✓' : '✗'} Input: "${c.input}" -> Got: "${result}" (Expected: "${c.expected}")`);
}

// -------------------------------------------------------------
// Probe 2: Trailing suffix stripping in cleanChannelName
// -------------------------------------------------------------
console.log('\n2. Probing cleanChannelName suffix stripping:');
const suffixCases = [
  { input: 'Fireship Subscribe', expected: 'Fireship' },
  { input: 'Veritasium Subscribed', expected: 'Veritasium' },
  { input: 'BBC News Verified', expected: 'BBC News' },
  { input: 'TechLead • Subscribe', expected: 'TechLead' },
  { input: 'TechLead •Subscribe', expected: 'TechLead' },
  { input: 'TechLead •   Subscribe', expected: 'TechLead' },
  { input: 'Channel Subscribe Subscribed', expected: 'Channel' }, // Multiple trailing suffixes
  { input: 'Subscribe', expected: 'YouTube Channel' }, // Just the keyword
  { input: 'Subscribed', expected: 'YouTube Channel' },
  { input: 'Verified', expected: 'YouTube Channel' },
  { input: 'Subscribe to PewDiePie', expected: 'Subscribe to PewDiePie' }, // Prefix
  { input: 'We Are Verified Creators', expected: 'We Are Verified Creators' } // Interior
];

for (const c of suffixCases) {
  const result = StorageUtil.cleanChannelName(c.input);
  const pass = result.toLowerCase() === c.expected.toLowerCase();
  console.log(`  ${pass ? '✓' : '✗'} Suffix Input: "${c.input}" -> Got: "${result}" (Expected: "${c.expected}")`);
}

// -------------------------------------------------------------
// Probe 3: Mathematical Conservation of Watch Time in migrateTimelineLog
// -------------------------------------------------------------
console.log('\n3. Probing Mathematical Conservation of Watch Time:');
function testConservation(numRecords, numVideos) {
  const rawLog = [];
  let expectedWatched = 0;
  for (let i = 0; i < numRecords; i++) {
    const v = i % numVideos;
    const dur = 10 + (i % 5) * 10; // 10..50s
    rawLog.push({
      id: `id_${i}`,
      videoId: `vid_${v}`,
      title: `Title ${v}`,
      channel: `Channel ${v} Channel ${v}`,
      durationSeconds: dur,
      status: 'watched',
      dateKey: '2026-08-15',
      timestamp: 1700000000000 + i * 10000
    });
    expectedWatched += dur;
  }

  const tracking = { timelineLog: rawLog };
  const migrated = StorageUtil.migrateTimelineLog(tracking);
  const actualWatched = migrated.timelineLog.reduce((acc, item) => acc + item.durationSeconds, 0);
  const conserved = actualWatched === expectedWatched;
  console.log(`  ${conserved ? '✓' : '✗'} Conservation test (${numRecords} records, ${numVideos} videos): Expected ${expectedWatched}s, Got ${actualWatched}s (Entries reduced from ${numRecords} to ${migrated.timelineLog.length})`);
  return conserved;
}

testConservation(100, 10);
testConservation(300, 1); // 300 ticks of 1 video -> 1 record
testConservation(500, 50);

// -------------------------------------------------------------
// Probe 4: Strict Idempotency under Complex Topologies
// -------------------------------------------------------------
console.log('\n4. Probing Idempotency:');
function testIdempotency() {
  const dataset = {
    timelineLog: [
      { id: '1', dateKey: '2026-08-15', videoId: 'v1', title: 'Video 1', channel: 'Ch 1 Ch 1', durationSeconds: 60, status: 'watched', timestamp: 100 },
      { id: '2', dateKey: '2026-08-15', videoId: 'v1', title: 'Video 1', channel: 'Ch 1', durationSeconds: 60, status: 'watched', timestamp: 200 },
      { id: '3', dateKey: '2026-08-15', videoId: 'v1', title: 'Video 1', channel: 'Ch 1', durationSeconds: 0, status: 'blocked', timestamp: 300 },
      { id: '4', dateKey: '2026-08-15', videoId: 'v1', title: 'Video 1', channel: 'Ch 1', durationSeconds: 60, status: 'watched', timestamp: 400 },
      { id: '5', dateKey: '2026-08-16', videoId: 'v1', title: 'Video 1', channel: 'Ch 1', durationSeconds: 60, status: 'watched', timestamp: 500 }
    ]
  };

  const pass1 = StorageUtil.migrateTimelineLog(dataset);
  const snap1 = JSON.stringify(pass1.timelineLog);
  const pass2 = StorageUtil.migrateTimelineLog(pass1);
  const snap2 = JSON.stringify(pass2.timelineLog);
  const pass3 = StorageUtil.migrateTimelineLog(pass2);
  const snap3 = JSON.stringify(pass3.timelineLog);

  const isIdempotent = (snap1 === snap2) && (snap2 === snap3);
  console.log(`  ${isIdempotent ? '✓' : '✗'} Strict Idempotency f(f(x)) === f(x) and f(f(f(x))) === f(x): ${isIdempotent}`);
}
testIdempotency();

// -------------------------------------------------------------
// Probe 5: Metadata & Flag Preservation during Merge
// -------------------------------------------------------------
console.log('\n5. Probing Metadata & Flag Preservation in migrateTimelineLog:');
const metaDataset = {
  timelineLog: [
    {
      id: 'evt_1',
      dateKey: '2026-08-15',
      videoId: null,
      title: 'Advanced Rust',
      channel: 'YouTube Channel',
      durationSeconds: 60,
      status: 'watched',
      startTime: '08:00',
      endTime: '08:01',
      timestamp: 1000,
      lastActiveTimestamp: 1000,
      isLearning: false,
      mode: 'Standard'
    },
    {
      id: 'evt_2',
      dateKey: '2026-08-15',
      videoId: 'rust_123',
      title: 'Advanced Rust',
      channel: 'RustLang Org RustLang Org',
      durationSeconds: 60,
      status: 'watched',
      startTime: '08:01',
      endTime: '08:02',
      timestamp: 2000,
      lastActiveTimestamp: 2000,
      isLearning: true,
      mode: 'Study Mode'
    }
  ]
};

const metaMigrated = StorageUtil.migrateTimelineLog(metaDataset);
const resSession = metaMigrated.timelineLog[0];
console.log('  Merged Session Properties:', {
  title: resSession.title,
  channel: resSession.channel,
  videoId: resSession.videoId,
  durationSeconds: resSession.durationSeconds,
  startTime: resSession.startTime,
  endTime: resSession.endTime,
  timestamp: resSession.timestamp,
  lastActiveTimestamp: resSession.lastActiveTimestamp,
  isLearning: resSession.isLearning,
  mode: resSession.mode
});

assert.strictEqual(resSession.durationSeconds, 120, 'Duration summed');
assert.strictEqual(resSession.channel, 'RustLang Org', 'Channel upgraded and cleaned');
assert.strictEqual(resSession.videoId, 'rust_123', 'VideoId promoted');
assert.strictEqual(resSession.startTime, '08:00', 'Earliest start time preserved');
assert.strictEqual(resSession.endTime, '08:02', 'Latest end time preserved');
assert.strictEqual(resSession.isLearning, true, 'isLearning promoted to true');
assert.strictEqual(resSession.mode, 'Study Mode', 'Mode upgraded to Study Mode');
assert.strictEqual(resSession.timestamp, 2000, 'Latest timestamp preserved');
assert.strictEqual(resSession.lastActiveTimestamp, 2000, 'Latest lastActiveTimestamp preserved');
console.log('  ✓ All metadata fields correctly promoted and preserved.');
