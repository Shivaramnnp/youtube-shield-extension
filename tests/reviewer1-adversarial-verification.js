const { setupMockEnv } = require('./harness/mock-extension-env');
const mockEnv = setupMockEnv();

require('../utils/dom-utils');
require('../content/js/ad-skipper');

const skipper = window.AdSkipper;

function setupPlayer(initialTime = 0, duration = 30) {
  document.body.innerHTML = '';
  const player = document.createElement('div');
  player.id = 'movie_player';
  player.className = 'html5-video-player';

  const video = document.createElement('video');
  video.className = 'html5-main-video';
  video.currentTime = initialTime;
  video.duration = duration;
  video.playbackRate = 1;
  video.paused = false;
  player.appendChild(video);

  document.body.appendChild(player);
  return { player, video };
}

console.log('--- Adversarial Test 1: Log debouncing when lastSkippedEl is null (Strategy A) ---');
{
  const { player, video } = setupPlayer(0, 30);
  player.classList.add('ad-showing');
  skipper.enable();

  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  skipper._lastLogTime = 0;
  skipper._lastSkippedEl = null;

  // Call _trySkip 5 times in rapid succession (< 50ms)
  skipper._trySkip();
  skipper._trySkip();
  skipper._trySkip();
  skipper._trySkip();
  skipper._trySkip();

  console.log = origLog;

  const skipLogs = logs.filter(l => l.includes('[GodMode] AdSkipper: ad skipped ⚡'));
  console.log(`Rapid _trySkip() called 5 times with Strategy A. Skip log count: ${skipLogs.length}`);
  if (skipLogs.length > 1) {
    console.error(`❌ BUG REPRODUCED: _logSkip() logged ${skipLogs.length} times because _lastSkippedEl is null! Expected: 1`);
  } else {
    console.log(`✓ Debounce working correctly: logged exactly 1 time.`);
  }

  skipper.disable();
}

console.log('\n--- Adversarial Test 2: PlaybackRate should NOT be mutated to 16 ---');
{
  const { player, video } = setupPlayer(0, 30);
  player.classList.add('ad-showing');
  video.playbackRate = 1.0;
  skipper.enable();

  skipper._lastLogTime = 0;
  skipper._lastSkippedEl = null;
  skipper._trySkip();

  console.log(`Video playbackRate after Strategy A seek: ${video.playbackRate}`);
  if (video.playbackRate === 16) {
    console.error(`❌ BUG REPRODUCED: video.playbackRate was mutated to 16!`);
  } else {
    console.log(`✓ Playback rate remained normal: ${video.playbackRate}`);
  }

  skipper.disable();
}

console.log('\n--- Adversarial Test 3: Strategy B injected script should not click countdown buttons ---');
{
  const { player, video } = setupPlayer(0, 30);
  skipper.enable();

  const injected = document.getElementById('godmode-ad-skipper-injected');
  console.log(`Injected script exists: ${injected !== null}`);
  if (injected) {
    const code = injected.textContent;
    // Check if code contains countdown checking or blindly calls click()
    const hasGuards = code.includes('aria-disabled') || code.includes('countdown') || code.includes('ytp-ad-preview');
    console.log(`Injected script code has countdown/disabled guards: ${hasGuards}`);
    if (!hasGuards) {
      console.error(`❌ BUG REPRODUCED: Injected page script has no countdown or disabled guards!`);
    }
  }

  skipper.disable();
}

console.log('\n--- Adversarial Test 4: Hidden .ytp-ad-module should not trigger false ad detection ---');
{
  const { player, video } = setupPlayer(100, 500);
  // Player is playing main video (no ad-showing class)
  player.className = 'html5-video-player';

  // .ytp-ad-module is present with display: none (leftover from previous ad or Strategy C)
  const adModule = document.createElement('div');
  adModule.className = 'ytp-ad-module';
  adModule.style.display = 'none';
  const child = document.createElement('div');
  child.className = 'ytp-ad-player-overlay';
  adModule.appendChild(child);
  player.appendChild(adModule);

  skipper.enable();
  skipper._lastLogTime = 0;
  skipper._lastSkippedEl = null;

  const isAd = skipper._isAdPlaying();
  console.log(`_isAdPlaying() for hidden ad-module with no ad-showing class: ${isAd}`);
  if (isAd) {
    console.error(`❌ BUG REPRODUCED: Hidden .ytp-ad-module falsely detected as active ad! Main video would be skipped!`);
  } else {
    console.log(`✓ Correctly ignored hidden .ytp-ad-module.`);
  }

  skipper.disable();
}
