/**
 * Tier 2 Test Suite: M1 Audio Node Graph Caching & Array Immutability Empirical Stress Test
 * 
 * Empirically tests:
 * 1. Audio node caching: Calling attachToVideo() multiple times on the same <video> element or across simulated SPA transitions uses WeakMap cache / DOM property fallback and never throws InvalidStateError.
 * 2. Array immutability: Returning getEqGains() returns a copy or safe representation so external code cannot mutate internal gains without calling setter methods.
 * 3. Exception handling: WebKit InvalidStateError / DOMException graceful recovery.
 */

require('../harness/mock-extension-env').setupMockEnv();
const { test, describe, assert, resetDOM } = require('../harness/test-helpers');
const AudioEngine = require('../../utils/audio-engine');
const VolumeBooster = require('../../content/js/volume-booster');

describe('M1 Empirical Stress Test: Audio Node Graph Caching & SPA Transitions', () => {

  test('M1-Empirical-1: Calling attachToVideo() 100 times on the SAME video element reuses WeakMap cached sourceNode and never throws InvalidStateError', async () => {
    await resetDOM();

    let createMediaSourceCalls = 0;

    class MockMediaSource {
      connect() {}
      disconnect() {}
    }

    class MockContext {
      constructor() {
        this.state = 'running';
        this.destination = {};
      }
      createMediaElementSource(el) {
        createMediaSourceCalls++;
        return new MockMediaSource();
      }
      createBiquadFilter() {
        return { type: 'lowshelf', frequency: { value: 150 }, gain: { value: 0 }, connect() {}, disconnect() {} };
      }
      createGain() {
        return { gain: { value: 1.0 }, connect() {}, disconnect() {} };
      }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockContext;
      AudioEngine.ctx = null;
      AudioEngine._connectedVideo = null;

      const video = document.createElement('video');
      video.src = 'https://www.youtube.com/watch?v=same_video_test';

      // Call attachToVideo 100 times on the same video element
      for (let i = 0; i < 100; i++) {
        let result = false;
        assert.doesNotThrow(() => {
          result = AudioEngine.attachToVideo(video);
        }, `attachToVideo call #${i+1} on same video element threw an exception!`);
        assert.ok(result, `attachToVideo call #${i+1} returned true`);
      }

      assert.equal(createMediaSourceCalls, 1, `createMediaElementSource must be called EXACTLY ONCE (actual: ${createMediaSourceCalls}), subsequent 99 calls must hit WeakMap cache`);
      assert.ok(video._ssMediaSourceNode, 'DOM property fallback _ssMediaSourceNode populated on video element');
    } finally {
      window.AudioContext = origCtx;
    }
  });

  test('M1-Empirical-2: Simulated SPA transitions cycling across multiple video elements reuses WeakMap cache without re-creating MediaElementSource', async () => {
    await resetDOM();

    let createMediaSourceCalls = 0;
    const createdNodesMap = new Map();

    class MockMediaSource {
      constructor(id) { this.id = id; }
      connect() {}
      disconnect() {}
    }

    class MockContext {
      constructor() {
        this.state = 'running';
        this.destination = {};
      }
      createMediaElementSource(el) {
        createMediaSourceCalls++;
        const node = new MockMediaSource(el.id);
        createdNodesMap.set(el.id, node);
        return node;
      }
      createBiquadFilter() {
        return { type: 'lowshelf', frequency: { value: 150 }, gain: { value: 0 }, connect() {}, disconnect() {} };
      }
      createGain() {
        return { gain: { value: 1.0 }, connect() {}, disconnect() {} };
      }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockContext;
      AudioEngine.ctx = null;
      AudioEngine._connectedVideo = null;

      // Create 5 distinct video elements simulating YouTube SPA video player switches
      const videos = [];
      for (let i = 1; i <= 5; i++) {
        const v = document.createElement('video');
        v.id = `spa-video-${i}`;
        v.src = `https://www.youtube.com/watch?v=spa_vid_${i}`;
        videos.push(v);
      }

      // Simulate 50 SPA video switches cycling through videos 1..5 repeatedly
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let idx = 0; idx < videos.length; idx++) {
          const vid = videos[idx];
          assert.doesNotThrow(() => {
            AudioEngine.attachToVideo(vid);
          }, `SPA transition cycle ${cycle+1} video ${vid.id} threw exception`);

          assert.equal(AudioEngine._connectedVideo, vid, `_connectedVideo correctly set to ${vid.id}`);
          assert.equal(AudioEngine.sourceNode, createdNodesMap.get(vid.id), `sourceNode correctly matches cached node for ${vid.id}`);
        }
      }

      assert.equal(createMediaSourceCalls, 5, `createMediaElementSource called exactly 5 times (1 per unique video), WeakMap cache reused for all 45 subsequent SPA switches`);
    } finally {
      window.AudioContext = origCtx;
    }
  });

  test('M1-Empirical-3: AudioEngine fallback to _ssMediaSourceNode DOM property when WeakMap cache reference is absent', async () => {
    await resetDOM();

    let createMediaSourceCalls = 0;

    class MockMediaSource {
      connect() {}
      disconnect() {}
    }

    class MockContext {
      constructor() {
        this.state = 'running';
        this.destination = {};
      }
      createMediaElementSource(el) {
        createMediaSourceCalls++;
        return new MockMediaSource();
      }
      createBiquadFilter() {
        return { type: 'lowshelf', frequency: { value: 150 }, gain: { value: 0 }, connect() {}, disconnect() {} };
      }
      createGain() {
        return { gain: { value: 1.0 }, connect() {}, disconnect() {} };
      }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockContext;
      AudioEngine.ctx = null;
      AudioEngine._connectedVideo = null;

      const video = document.createElement('video');
      video.src = 'https://www.youtube.com/watch?v=dom_fallback_test';

      // 1. First attachment
      AudioEngine.attachToVideo(video);
      assert.equal(createMediaSourceCalls, 1, 'First attachment calls createMediaElementSource once');
      const cachedNode = video._ssMediaSourceNode;
      assert.ok(cachedNode, '_ssMediaSourceNode populated on DOM element');

      // 2. Clear WeakMap entry explicitly & clear _connectedVideo reference
      AudioEngine._attachedSourceMap.delete(video);
      AudioEngine._connectedVideo = null;

      // 3. Second attachment on same video element
      AudioEngine.attachToVideo(video);
      assert.equal(createMediaSourceCalls, 1, 'createMediaElementSource NOT called again (hit DOM property fallback)');
      assert.equal(AudioEngine.sourceNode, cachedNode, 'sourceNode retrieved from DOM property _ssMediaSourceNode');
    } finally {
      window.AudioContext = origCtx;
    }
  });

  test('M1-Empirical-4: VolumeBooster standalone caching reuses WeakMap / DOM property across repeated connect() calls', async () => {
    await resetDOM();

    let createMediaSourceCalls = 0;

    class MockMediaSource {
      connect() {}
      disconnect() {}
    }

    class MockContext {
      constructor() {
        this.state = 'running';
        this.destination = {};
      }
      createMediaElementSource(el) {
        createMediaSourceCalls++;
        return new MockMediaSource();
      }
      createBiquadFilter() {
        return { type: 'lowshelf', frequency: { value: 150 }, gain: { value: 0 }, connect() {}, disconnect() {} };
      }
      createGain() {
        return { gain: { value: 1.0 }, connect() {}, disconnect() {} };
      }
    }

    const origCtx = window.AudioContext;
    const origAudioEngine = window.AudioEngine;

    try {
      // Temporarily remove AudioEngine to force VolumeBooster standalone mode
      delete window.AudioEngine;
      delete global.AudioEngine;

      window.AudioContext = MockContext;
      VolumeBooster.ctx = null;
      VolumeBooster.sourceNode = null;
      VolumeBooster._connectedVideo = null;

      const video = document.createElement('video');
      video.className = 'html5-main-video';
      document.body.appendChild(video);

      // Connect 20 times in standalone mode
      for (let i = 0; i < 20; i++) {
        VolumeBooster.connect();
      }

      assert.equal(createMediaSourceCalls, 1, 'VolumeBooster standalone mode calls createMediaElementSource exactly once');
      assert.ok(video._ssMediaSourceNode, 'VolumeBooster set _ssMediaSourceNode DOM property');

      video.remove();
    } finally {
      window.AudioContext = origCtx;
      if (origAudioEngine) {
        window.AudioEngine = origAudioEngine;
        global.AudioEngine = origAudioEngine;
      }
    }
  });

});

describe('M1 Empirical Stress Test: Array Immutability of getEqGains()', () => {

  test('M1-Empirical-5: AudioEngine.getEqGains() returns a new array copy protected against direct element mutation, push, splice, reverse, and fill', () => {
    AudioEngine.setEqPreset('Flat');
    const initialGains = AudioEngine.getEqGains();
    assert.deepEqual(initialGains, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'Initial gains are [0,0,0,0,0,0,0,0,0,0]');

    // Attempt 1: Direct element assignment
    initialGains[0] = 12;
    initialGains[5] = -12;
    assert.deepEqual(AudioEngine.getEqGains(), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'Internal gains unaffected by direct element assignment on returned array');

    // Attempt 2: Array push, pop, shift, unshift, splice
    const gains2 = AudioEngine.getEqGains();
    gains2.push(999, 888);
    gains2.shift();
    gains2.splice(0, 3, 10, 10, 10);
    assert.equal(gains2.length, 11, 'Mutated copy has modified length');
    assert.equal(AudioEngine.getEqGains().length, 10, 'Internal gains array length remains exactly 10');
    assert.deepEqual(AudioEngine.getEqGains(), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'Internal gains unaffected by array push/shift/splice');

    // Attempt 3: Array reverse, sort, fill
    const gains3 = AudioEngine.getEqGains();
    gains3.fill(12);
    gains3.reverse();
    assert.deepEqual(AudioEngine.getEqGains(), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'Internal gains unaffected by array fill/reverse');
  });

  test('M1-Empirical-6: VolumeBooster.getEqGains() returns a safe copy in both AudioEngine-proxied and standalone modes', () => {
    // 1. AudioEngine-proxied mode
    AudioEngine.setEqPreset('Pop');
    const popGains = VolumeBooster.getEqGains();
    assert.deepEqual(popGains, [-1, 2, 4, 5, 4, 0, -1, 1, 3, 4], 'VolumeBooster getEqGains returns Pop gains');

    popGains[0] = 999;
    popGains.push(12345);
    assert.deepEqual(VolumeBooster.getEqGains(), [-1, 2, 4, 5, 4, 0, -1, 1, 3, 4], 'VolumeBooster proxied gains protected against external mutation');

    // 2. Standalone mode (AudioEngine missing)
    const origAudioEngine = window.AudioEngine;
    try {
      delete window.AudioEngine;
      delete global.AudioEngine;

      VolumeBooster.setEqPreset('Rock');
      const rockGains = VolumeBooster.getEqGains();
      rockGains[0] = 777;
      rockGains.fill(-12);

      assert.deepEqual(VolumeBooster.getEqGains(), [5, 4, 3, 1, -1, -1, 0, 2, 4, 5], 'VolumeBooster standalone gains protected against external mutation');
    } finally {
      if (origAudioEngine) {
        window.AudioEngine = origAudioEngine;
        global.AudioEngine = origAudioEngine;
      }
    }
  });

  test('M1-Empirical-7: Verification that setEqGains() requires setter method call to modify gains, and validates inputs safely', () => {
    AudioEngine.setEqPreset('Flat');
    
    // External code attempting to modify gains without setter fails
    const gainsRef = AudioEngine.getEqGains();
    gainsRef[3] = 8;
    assert.equal(AudioEngine.getEqGains()[3], 0, 'Modifying returned array does NOT change internal gains');

    // Calling setEqGains() WITH setter successfully changes gains
    AudioEngine.setEqGains([0, 0, 0, 8, 0, 0, 0, 0, 0, 0]);
    assert.equal(AudioEngine.getEqGains()[3], 8, 'Calling setEqGains() setter correctly updates internal gains to 8dB');

    // Invalid inputs to setEqGains are clamped / safely defaulted
    AudioEngine.setEqGains([100, -100, 'abc', undefined, null, NaN, {}, [], 12, -12]);
    assert.deepEqual(AudioEngine.getEqGains(), [12, -12, 0, 0, 0, 0, 0, 0, 12, -12], 'Invalid/extreme inputs safely clamped and normalized');
  });

});
