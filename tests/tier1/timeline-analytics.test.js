/**
 * Tier 1 Unit Test — Timeline Analytics & Session Activity Timeline
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');

describe('Timeline Analytics & Session Activity Tracking', () => {

  test('Timeline R1: should initialize DEFAULT_TRACKING with hourly metrics and timelineLog array', async () => {
    await resetStorage();
    const tracking = await StorageUtil.getTracking();
    assert.equal(typeof tracking.hourlyWatchTime, 'object', 'hourlyWatchTime should be object');
    assert.equal(typeof tracking.hourlyLearningTime, 'object', 'hourlyLearningTime should be object');
    assert.equal(Array.isArray(tracking.timelineLog), true, 'timelineLog should be an array');
  });

  test('Timeline R2: should log timeline events via StorageUtil.addTimelineEvent', async () => {
    await resetStorage();

    await StorageUtil.addTimelineEvent({
      title: 'Learn Quantum Physics in 30 Mins',
      channel: 'Science Daily',
      isLearning: true,
      mode: 'Study Mode',
      status: 'watched',
      durationSeconds: 120
    });

    const tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 1, 'Timeline log should contain 1 event');

    const event = tracking.timelineLog[0];
    assert.equal(event.title, 'Learn Quantum Physics in 30 Mins', 'Event title must match');
    assert.equal(event.channel, 'Science Daily', 'Event channel must match');
    assert.equal(event.isLearning, true, 'Event isLearning must be true');
    assert.equal(event.status, 'watched', 'Event status must be watched');
  });

  test('Timeline R3: should consolidate duplicate consecutive events within 30 seconds', async () => {
    await resetStorage();

    const eventData = {
      title: 'Advanced Communication Masterclass',
      channel: 'Skill Academy',
      isLearning: true,
      mode: 'Study Mode',
      status: 'watched',
      durationSeconds: 30
    };

    await StorageUtil.addTimelineEvent(eventData);
    await StorageUtil.addTimelineEvent({ ...eventData, durationSeconds: 40 });

    const tracking = await StorageUtil.getTracking();
    assert.equal(tracking.timelineLog.length, 1, 'Should consolidate consecutive events for same video');
    assert.equal(tracking.timelineLog[0].durationSeconds, 70, 'Duration should be summed to 70s');
  });

  test('Timeline R4: should log blocked video attempts when Goal Mode blocks an off-topic video', async () => {
    await resetStorage();

    await StorageUtil.addTimelineEvent({
      title: 'Gaming Funny Moments',
      channel: 'GamerZone',
      isLearning: false,
      mode: 'Goal Mode (Strict)',
      status: 'blocked',
      durationSeconds: 0
    });

    const tracking = await StorageUtil.getTracking();
    const blockedEvent = tracking.timelineLog.find(e => e.status === 'blocked');
    assert.equal(Boolean(blockedEvent), true, 'Blocked event should exist in timeline');
    assert.equal(blockedEvent.title, 'Gaming Funny Moments', 'Blocked event title must match');
    assert.equal(blockedEvent.status, 'blocked', 'Blocked event status must be blocked');
  });

});
