/**
 * Tier 2 Test Suite: M1 WebKit Web Audio API Adversarial Stress Verification
 * Adversarially stress-tests WebKit gesture unlock, persistent onstatechange re-attachment,
 * WeakMap node caching, DOM property fallback, and WebKit DOMException recovery.
 */

require('../harness/mock-extension-env').setupMockEnv();
const { test, describe, assert, resetDOM } = require('../harness/test-helpers');
const AudioEngine = require('../../utils/audio-engine');

describe('M1 WebKit Web Audio API Adversarial Stress Suite', () => {

  test('M1-Stress-1: Gesture unlock triggers context resume across all 6 specified gesture events', async () => {
    await resetDOM();

    const events = ['play', 'playing', 'click', 'touchstart', 'pointerdown', 'keydown'];

    for (const evtName of events) {
      let resumed = false;

      class MockContext {
        constructor() {
          this.state = 'suspended';
          this.destination = {};
          this.onstatechange = null;
        }
        resume() {
          resumed = true;
          this.state = 'running';
          return Promise.resolve();
        }
      }

      const origCtx = window.AudioContext;
      try {
        window.AudioContext = MockContext;
        AudioEngine.ctx = null;
        AudioEngine.initContext();

        // Explicitly set state to suspended and attach unlock listeners to test gesture unlock
        AudioEngine.ctx.state = 'suspended';
        AudioEngine.attachGestureUnlock();

        assert.equal(AudioEngine.ctx.state, 'suspended', `State for event '${evtName}' is suspended before event trigger`);

        // Create a video element in document
        const video = document.createElement('video');
        video.className = 'html5-main-video';
        document.body.appendChild(video);

        // Re-attach gesture unlock
        AudioEngine.attachGestureUnlock();

        // Dispatch event on video element
        const event = new Event(evtName, { bubbles: true });
        video.dispatchEvent(event);

        // Wait for microtask/promise resolution
        await new Promise(r => setTimeout(r, 10));

        assert.ok(resumed, `Gesture event '${evtName}' successfully called AudioContext.resume()`);
        assert.equal(AudioEngine.ctx.state, 'running', `AudioContext state transitioned to 'running' after '${evtName}'`);

        video.remove();
      } finally {
        window.AudioContext = origCtx;
      }
    }
  });

  test('M1-Stress-2: Persistent onstatechange listener re-attaches gesture unlock when context transitions back to suspended', async () => {
    await resetDOM();

    let resumeCount = 0;
    let addListenerCount = 0;

    const origAddEventListener = window.addEventListener;
    window.addEventListener = function(type, listener, useCapture) {
      addListenerCount++;
      return origAddEventListener.call(window, type, listener, useCapture);
    };

    class MockContext {
      constructor() {
        this.state = 'running';
        this.destination = {};
        this.onstatechange = null;
      }
      resume() {
        resumeCount++;
        this.state = 'running';
        return Promise.resolve();
      }
    }

    const origCtx = window.AudioContext;
    try {
      window.AudioContext = MockContext;
      AudioEngine.ctx = null;
      AudioEngine.initContext();

      assert.ok(typeof AudioEngine.ctx.onstatechange === 'function', 'onstatechange listener attached to AudioContext');

      // State cycle 1: transition to suspended (e.g. backgrounding / bluetooth disconnect)
      addListenerCount = 0;
      AudioEngine.ctx.state = 'suspended';
      AudioEngine.ctx.onstatechange();

      assert.ok(addListenerCount >= 6, 'onstatechange transition to suspended re-attaches all 6 gesture listeners');

      // Trigger gesture to unlock
      const clickEvt = new Event('click', { bubbles: true });
      window.dispatchEvent(clickEvt);
      await new Promise(r => setTimeout(r, 10));

      assert.equal(resumeCount, 1, 'First gesture resumes context');
      assert.equal(AudioEngine.ctx.state, 'running', 'Context is running again');

      // State cycle 2: transition to suspended again
      addListenerCount = 0;
      AudioEngine.ctx.state = 'suspended';
      AudioEngine.ctx.onstatechange();

      assert.ok(addListenerCount >= 6, 'Second onstatechange transition to suspended re-attaches gesture listeners again');

      // Trigger touchstart to unlock again
      const touchEvt = new Event('touchstart', { bubbles: true });
      window.dispatchEvent(touchEvt);
      await new Promise(r => setTimeout(r, 10));

      assert.equal(resumeCount, 2, 'Second gesture resumes context again');
      assert.equal(AudioEngine.ctx.state, 'running', 'Context running after second unlock cycle');
    } finally {
      window.AudioContext = origCtx;
      window.addEventListener = origAddEventListener;
    }
  });

  test('M1-Stress-3: WeakMap node caching and DOM property fallback under WebKit mock environments', () => {
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

      const mockVideo = document.createElement('video');
      mockVideo.src = 'https://www.youtube.com/watch?v=webkit_test';

      // 1. Initial attachment creates media element source
      const res1 = AudioEngine.attachToVideo(mockVideo);
      assert.ok(res1, 'First attachToVideo returns true');
      assert.equal(createMediaSourceCalls, 1, 'createMediaElementSource called exactly once initially');
      assert.ok(mockVideo._ssMediaSourceNode, 'DOM property fallback _ssMediaSourceNode populated');

      // 2. Second attachment on same video uses WeakMap cache
      const res2 = AudioEngine.attachToVideo(mockVideo);
      assert.ok(res2, 'Second attachToVideo returns true');
      assert.equal(createMediaSourceCalls, 1, 'createMediaElementSource NOT called again (WeakMap cache hit)');

      // 3. Clear WeakMap reference manually to test DOM property fallback
      AudioEngine._attachedSourceMap.delete(mockVideo);
      AudioEngine._connectedVideo = null; // simulate SPA video element re-attachment

      const res3 = AudioEngine.attachToVideo(mockVideo);
      assert.ok(res3, 'Third attachToVideo returns true');
      assert.equal(createMediaSourceCalls, 1, 'createMediaElementSource NOT called again (DOM property _ssMediaSourceNode fallback hit)');
    } finally {
      window.AudioContext = origCtx;
    }
  });

  test('M1-Stress-4: Fail-safe handling when WebKit throws InvalidStateError or CORS DOMExceptions on createMediaElementSource', () => {
    class MockContextThrowing {
      constructor() {
        this.state = 'running';
        this.destination = {};
      }
      createMediaElementSource(el) {
        const err = new Error('InvalidStateError: HTMLMediaElement already connected to another MediaElementSourceNode');
        err.name = 'InvalidStateError';
        throw err;
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
      window.AudioContext = MockContextThrowing;
      AudioEngine.ctx = null;

      const mockVideo = document.createElement('video');
      mockVideo.src = 'https://www.youtube.com/watch?v=exception_test';

      let attached = false;
      assert.doesNotThrow(() => {
        attached = AudioEngine.attachToVideo(mockVideo);
      }, 'attachToVideo does NOT throw unhandled exception when WebKit throws InvalidStateError');

      assert.ok(attached, 'attachToVideo returns true safely to preserve video element playback');
    } finally {
      window.AudioContext = origCtx;
    }
  });

});
