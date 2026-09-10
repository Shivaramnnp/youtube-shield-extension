#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENS_DIR = '/Users/shivarampatel/Desktop/screens';
const WORK_DIR = path.resolve(ROOT_DIR, 'scratch', 'screenshot-workspace');
const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!fs.existsSync(SCREENS_DIR)) {
  fs.mkdirSync(SCREENS_DIR, { recursive: true });
}
if (!fs.existsSync(WORK_DIR)) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
}

console.log('📸 Generating all YouTube Shield screenshots into:', SCREENS_DIR);

// Generate 7-day date keys
const now = new Date();
const dates = [];
const dailyWatch = {};
const dailyLearn = {};
for (let i = 6; i >= 0; i--) {
  const d = new Date(now.getTime() - i * 86400000);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  dates.push(key);
  const total = Math.floor(12000 + Math.random() * 7000);
  const learn = Math.floor(total * (0.7 + Math.random() * 0.2));
  dailyWatch[key] = total;
  dailyLearn[key] = learn;
}

const mockSettings = {
  extensionEnabled: true,
  shortsBlocker: true,
  focusMode: true,
  studyMode: true,
  goalMode: true,
  learningGoal: "Master Next.js 14 & Web Audio Architecture",
  focusReminderInterval: 45,
  timeManager: {
    enabled: true,
    dailyLimitMinutes: 90,
    scheduleEnabled: true,
    scheduleStart: "09:00",
    scheduleEnd: "18:00",
    snoozeUntil: 0
  },
  uiCleaner: {
    hideBell: true,
    hideSubCount: true,
    hideChat: true,
    hideTrending: true,
    hideExplore: true,
    hideMiniPlayer: false,
    hideAutoplay: true
  },
  blockedKeywords: ["prank", "gossip", "clickbait", "reaction", "vlog", "drama"],
  blockedChannels: ["DramaDaily", "ClickbaitCentral", "TrashReactions"],
  ghostShield: true,
  audioEffects: true,
  autoSkipAds: true,
  volumeBooster: {
    volumeLevel: 250,
    bassLevel: 8,
    eqEnabled: true,
    preset: "Rock",
    eqGains: [4.5, 3.0, 1.5, -1.0, -0.5, 2.0, 3.5, 4.0, 5.0, 6.0],
    noiseRemover: true
  },
  pomodoro: {
    enabled: true,
    workMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4,
    autoStartBreaks: true,
    autoStartWork: false,
    soundAlerts: true,
    autoPause: true
  }
};

const mockTracking = {
  dailyWatchTime: dailyWatch,
  dailyLearningTime: dailyLearn,
  hourlyWatchTime: {},
  hourlyLearningTime: {},
  weeklyTotal: 112400,
  weeklyLearningTotal: 89600,
  totalShortsBlocked: 342,
  totalAdsSkipped: 189,
  timelineMigrated: true,
  gamification: {
    points: 1450,
    level: 4,
    rank: "Diamond Warrior",
    rankIndex: 3,
    currentStreak: 12,
    longestStreak: 18,
    badges: ["first_focus", "scholar_bronze", "shorts_slayer_1", "shorts_slayer_2", "streak_7", "pomo_master_1", "audio_explorer", "goal_crusher", "zen_master", "scholar_silver"],
    unlockedBadgeDates: {
      "first_focus": Date.now() - 100000000,
      "scholar_bronze": Date.now() - 80000000,
      "shorts_slayer_1": Date.now() - 60000000,
      "streak_7": Date.now() - 40000000,
      "goal_crusher": Date.now() - 20000000
    }
  },
  timelineLog: [
    { title: "Building Fullstack Next.js 14 Production Apps", channel: "Vercel Engineering", durationSeconds: 2400, timestamp: Date.now() - 3600000, isLearning: true, mode: "Study", dateKey: dates[6] },
    { title: "Web Audio DSP & Biquad Filter Architectures", channel: "Audio Engineering Society", durationSeconds: 1800, timestamp: Date.now() - 7200000, isLearning: true, mode: "Study", dateKey: dates[6] },
    { title: "TypeScript 5.4 Advanced Generics & Performance", channel: "Matt Pocock", durationSeconds: 1200, timestamp: Date.now() - 10800000, isLearning: true, mode: "Study", dateKey: dates[6] },
    { title: "System Design: Scaling to 10M Concurrent Users", channel: "ByteByteGo", durationSeconds: 3100, timestamp: Date.now() - 14400000, isLearning: true, mode: "Goal", dateKey: dates[6] }
  ]
};

// 1. Create Options Dashboard Harness with mock chrome.storage
const optionsHtmlRaw = fs.readFileSync(path.resolve(ROOT_DIR, 'options', 'options.html'), 'utf8');

const mockStorageScript = `
<script>
  window.chrome = window.chrome || {};
  window.chrome.storage = {
    local: {
      get: (keys) => Promise.resolve({ settings: ${JSON.stringify(mockSettings)}, tracking: ${JSON.stringify(mockTracking)} }),
      set: (data) => Promise.resolve(),
      clear: () => Promise.resolve()
    },
    sync: {
      get: (keys) => Promise.resolve({ settings: ${JSON.stringify(mockSettings)} }),
      set: (data) => Promise.resolve(),
      clear: () => Promise.resolve()
    }
  };
  window.chrome.runtime = {
    sendMessage: () => Promise.resolve({ success: true }),
    onMessage: { addListener: () => {} },
    getManifest: () => ({ version: "1.0.0", name: "YouTube Shield" })
  };
  window.chrome.tabs = {
    query: (q, cb) => cb && cb([]),
    create: () => {}
  };
</script>
`;

// Build options html with mock storage injected
const optionsHarness = optionsHtmlRaw.replace('<head>', '<head>' + mockStorageScript);
const optionsHarnessPath = path.resolve(WORK_DIR, 'options-harness.html');
fs.writeFileSync(optionsHarnessPath, optionsHarness);

// Copy styles and fonts
const optionsCss = fs.readFileSync(path.resolve(ROOT_DIR, 'options', 'options.css'), 'utf8');
fs.writeFileSync(path.resolve(WORK_DIR, 'options.css'), optionsCss);
const optionsJs = fs.readFileSync(path.resolve(ROOT_DIR, 'options', 'options.js'), 'utf8');
fs.writeFileSync(path.resolve(WORK_DIR, 'options.js'), optionsJs);

// Copy assets & utils to workdir so relative paths resolve cleanly
execSync(`cp -r "${path.resolve(ROOT_DIR, 'utils')}" "${WORK_DIR}/"`);
execSync(`cp -r "${path.resolve(ROOT_DIR, 'assets')}" "${WORK_DIR}/"`);
execSync(`cp -r "${path.resolve(ROOT_DIR, 'content')}" "${WORK_DIR}/"`);

console.log('✅ Options harness prepared.');

// Helper to capture a screenshot via Chrome Headless
function capture(htmlPath, outPngName, width = 1280, height = 850) {
  const targetUrl = `file://${htmlPath}`;
  const outPath = path.resolve(SCREENS_DIR, outPngName);
  const cmd = `"${CHROME_BIN}" --headless --disable-gpu --window-size=${width},${height} --screenshot="${outPath}" "${targetUrl}"`;
  execSync(cmd, { stdio: 'ignore' });
  const stats = fs.statSync(outPath);
  console.log(`  📸 Captured: ${outPngName} (${width}x${height}, ${(stats.size / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// 1. Capture All 8 Options Dashboard Tabs
// -------------------------------------------------------------
console.log('\n--- Capturing Dashboard Views ---');
const dashboardTabs = [
  { tab: 'focus', file: '01-dashboard-focus-mode.png', desc: 'Focus Features' },
  { tab: 'audio', file: '02-dashboard-audio-studio-10band-eq.png', desc: 'Audio Studio & 10-Band EQ' },
  { tab: 'timemanager', file: '03-dashboard-time-manager.png', desc: 'Time Manager & Schedules' },
  { tab: 'ui', file: '04-dashboard-ui-cleaner-zen-mode.png', desc: 'UI Cleaner Zen Mode' },
  { tab: 'blocklist', file: '05-dashboard-custom-blocklist.png', desc: 'Custom Blocklist & Keywords' },
  { tab: 'analytics', file: '06-dashboard-analytics-charts.png', desc: 'Analytics & 7-Day Charts' },
  { tab: 'gamification', file: '07-dashboard-gamification-achievements.png', desc: 'Achievements & RPG Ranks' },
  { tab: 'about', file: '08-dashboard-about-and-backup.png', desc: 'About & Diagnostics' }
];

for (const t of dashboardTabs) {
  const tabScript = `
    <script>
      window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          const btn = document.querySelector('[data-tab="${t.tab}"]');
          if (btn) btn.click();
        }, 120);
      });
    </script>
  `;
  const tabHtml = optionsHarness.replace('</body>', tabScript + '</body>');
  const tabHtmlPath = path.resolve(WORK_DIR, `tab-${t.tab}.html`);
  fs.writeFileSync(tabHtmlPath, tabHtml);
  capture(tabHtmlPath, t.file, 1280, 850);
}

// -------------------------------------------------------------
// 2. Capture Extension Popup (Main, Audio Studio)
// -------------------------------------------------------------
console.log('\n--- Capturing Extension Action Popups ---');
const popupHtmlRaw = fs.readFileSync(path.resolve(ROOT_DIR, 'popup', 'popup.html'), 'utf8');
const popupCss = fs.readFileSync(path.resolve(ROOT_DIR, 'popup', 'popup.css'), 'utf8');
const popupJs = fs.readFileSync(path.resolve(ROOT_DIR, 'popup', 'popup.js'), 'utf8');
fs.writeFileSync(path.resolve(WORK_DIR, 'popup.css'), popupCss);
fs.writeFileSync(path.resolve(WORK_DIR, 'popup.js'), popupJs);

const popupHarness = popupHtmlRaw.replace('<head>', '<head>' + mockStorageScript + `
<style>
  body { margin: 0; padding: 16px; background: #0b0f19; display: flex; justify-content: center; }
  .popup-container { width: 334px !important; box-shadow: 0 10px 40px rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; }
</style>
`).replace('</body>', `
<script>
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const timer = document.getElementById('session-time');
      if (timer) timer.textContent = '00:02:41';
      const s1 = document.getElementById('toggle-shorts');
      if (s1) s1.checked = true;
      const s2 = document.getElementById('toggle-focus');
      if (s2) s2.checked = true;
      const s3 = document.getElementById('toggle-ghost-shield');
      if (s3) s3.checked = true;
    }, 80);
  });
</script>
</body>`);
const popupHarnessPath = path.resolve(WORK_DIR, 'popup-harness.html');
fs.writeFileSync(popupHarnessPath, popupHarness);

capture(popupHarnessPath, '09-extension-popup-main.png', 440, 720);

// Popup with Audio DSP focused / active
const popupAudioScript = `
<script>
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const volSlider = document.getElementById('pop-vol-slider');
      if (volSlider) { volSlider.value = 250; volSlider.dispatchEvent(new Event('input')); }
      const bassSlider = document.getElementById('pop-bass-slider');
      if (bassSlider) { bassSlider.value = 8; bassSlider.dispatchEvent(new Event('input')); }
      const chip = document.querySelector('[data-preset="Rock"]');
      if (chip) chip.click();
      const cvs = document.getElementById('pop-spectrum-canvas');
      if (cvs && cvs.getContext) {
        const ctx = cvs.getContext('2d');
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, cvs.width, cvs.height);
        const bars = 32;
        const barWidth = cvs.width / bars;
        for (let i = 0; i < bars; i++) {
          const h = Math.sin(i * 0.3) * 20 + 25 + (Math.random() * 5);
          const grad = ctx.createLinearGradient(0, cvs.height - h, 0, cvs.height);
          grad.addColorStop(0, '#a855f7');
          grad.addColorStop(1, '#6366f1');
          ctx.fillStyle = grad;
          ctx.fillRect(i * barWidth + 1, cvs.height - h, barWidth - 2, h);
        }
      }
    }, 120);
  });
</script>
`;
const popupAudioHtml = popupHarness.replace('</body>', popupAudioScript + '</body>');
const popupAudioPath = path.resolve(WORK_DIR, 'popup-audio.html');
fs.writeFileSync(popupAudioPath, popupAudioHtml);
capture(popupAudioPath, '10-extension-popup-audio-dsp.png', 440, 780);

// -------------------------------------------------------------
// 3. Capture In-Page YouTube Features
// -------------------------------------------------------------
console.log('\n--- Capturing In-Page YouTube Experiences ---');

function createYouTubeMockPage(overlayType) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>YouTube Mock Video Player</title>
  <link rel="stylesheet" href="../assets/fonts/inter.css">
  <link rel="stylesheet" href="../content/css/header-button.css">
  <link rel="stylesheet" href="../content/css/focus-mode.css">
  <link rel="stylesheet" href="../content/css/clean-ui.css">
  <link rel="stylesheet" href="../content/css/quick-block.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f0f0f; color: #f1f1f1; font-family: 'Inter', -apple-system, sans-serif; overflow: hidden; }
    
    .yt-masthead {
      height: 56px; background: #0f0f0f; border-bottom: 1px solid rgba(255,255,255,0.1);
      display: flex; align-items: center; justify-content: space-between; padding: 0 16px;
      position: relative; z-index: 1000;
    }
    .yt-logo-area { display: flex; align-items: center; gap: 16px; font-size: 18px; font-weight: 700; color: #fff; }
    .yt-search-bar {
      flex: 0 1 560px; height: 38px; background: #121212; border: 1px solid #303030;
      border-radius: 20px; display: flex; align-items: center; padding: 0 16px; color: #888; font-size: 14px;
    }
    .yt-actions { display: flex; align-items: center; gap: 14px; }
    
    .yt-body-container { display: flex; padding: 24px; gap: 24px; max-width: 1400px; margin: 0 auto; }
    .yt-primary { flex: 1; }
    .yt-player-box {
      width: 100%; height: 460px; background: #000; border-radius: 12px;
      position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .yt-player-art { text-align: center; }
    .yt-video-title { font-size: 20px; font-weight: 700; margin: 16px 0 8px; color: #f8fafc; }
    .yt-video-meta { display: flex; align-items: center; justify-content: space-between; color: #94a3b8; font-size: 14px; }
    .yt-channel-info { display: flex; align-items: center; gap: 12px; }
    .yt-channel-avatar { width: 40px; height: 40px; border-radius: 50%; background: #6366f1; display: flex; align-items: center; justify-content: center; font-weight: 700; }
    
    .yt-secondary { width: 360px; }
    .yt-rec-card { display: flex; gap: 12px; margin-bottom: 14px; }
    .yt-rec-thumb { width: 140px; height: 80px; border-radius: 8px; background: #1e293b; flex-shrink: 0; }
    .yt-rec-details { flex: 1; }
    .yt-rec-title { font-size: 13px; font-weight: 600; line-height: 1.3; color: #e2e8f0; margin-bottom: 4px; }
    .yt-rec-ch { font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>

  <!-- Masthead -->
  <header class="yt-masthead">
    <div class="yt-logo-area">
      <span style="font-size: 22px;">☰</span>
      <span style="color: #ff0000; font-size: 22px;">▶</span>
      <span>YouTube</span>
    </div>
    <div class="yt-search-bar">Search tutorials, tech stacks, research...</div>
    <div class="yt-actions">
      <button class="ss-header-btn ss-active" id="ss-header-btn" style="position:relative; background:linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2)); border:1px solid #6366f1; border-radius:20px; padding:6px 14px; color:#fff; display:flex; align-items:center; gap:8px; font-weight:600; cursor:pointer;">
        <span>🛡️</span>
        <span>Shield PRO</span>
        <span style="background:#10b981; color:#fff; font-size:9px; padding:2px 6px; border-radius:10px; font-weight:800;">ACTIVE</span>
      </button>
      <div style="width: 32px; height: 32px; border-radius: 50%; background: #a855f7; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">S</div>
    </div>
  </header>

  ${overlayType === 'study-banner' ? `
  <div id="ss-study-banner" class="ss-study-banner" style="display:flex !important; position:sticky; top:0; z-index:9999; background:linear-gradient(90deg, #1e1b4b, #0f172a); border-bottom:1px solid rgba(99,102,241,0.4); padding:12px 24px; align-items:center; justify-content:space-between;">
    <div style="display:flex; align-items:center; gap:12px;">
      <span style="font-size:22px;">🎓</span>
      <div>
        <div style="font-size:14px; font-weight:700; color:#c7d2fe;">Study Mode Active • <span style="color:#a5f3fc;">Next.js 14 Production Mastery</span></div>
        <div style="font-size:11px; color:#94a3b8;">Focus Cycle 2 of 4 • Pomodoro Deep Work • Learning Time Tracked</div>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:20px;">
      <div style="text-align:center;">
        <div style="font-size:22px; font-weight:800; color:#38bdf8; font-family:monospace; letter-spacing:1px;">24:18</div>
        <div style="font-size:9px; color:#94a3b8; text-transform:uppercase;">Time Remaining</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button style="padding:6px 14px; background:rgba(56,189,248,0.2); border:1px solid #38bdf8; border-radius:6px; color:#38bdf8; font-size:12px; font-weight:600; cursor:pointer;">⏸ Pause</button>
        <button style="padding:6px 14px; background:rgba(16,185,129,0.2); border:1px solid #10b981; border-radius:6px; color:#10b981; font-size:12px; font-weight:600; cursor:pointer;">☕ Take Break</button>
      </div>
    </div>
  </div>
  ` : ''}

  <div class="yt-body-container">
    <div class="yt-primary">
      <div class="yt-player-box">
        <div class="yt-player-art">
          <div style="font-size: 64px; margin-bottom: 12px;">⚡</div>
          <div style="font-size: 24px; font-weight: 800; color: #fff;">Next.js 14 Server Actions &amp; Partial Prerendering</div>
          <div style="font-size: 14px; color: #a5b4fc; margin-top: 6px;">Intentional Learning Session • YouTube Shield Active</div>
        </div>
      </div>
      <div class="yt-video-title">Building High-Performance Distributed Web Applications (Full Masterclass)</div>
      <div class="yt-video-meta">
        <div class="yt-channel-info">
          <div class="yt-channel-avatar">V</div>
          <div>
            <div style="font-weight: 700; color: #f8fafc;">Vercel Engineering</div>
            <div style="font-size: 12px; color: #64748b;">420K subscribers • Verified</div>
          </div>
        </div>
        <div style="display: flex; gap: 10px;">
          <span style="background: rgba(255,255,255,0.08); padding: 6px 14px; border-radius: 18px; font-size: 13px;">👍 18K</span>
          <span style="background: rgba(255,255,255,0.08); padding: 6px 14px; border-radius: 18px; font-size: 13px;">🔗 Share</span>
          <span style="background: rgba(99,102,241,0.2); border:1px solid rgba(99,102,241,0.4); color:#a5b4fc; padding: 6px 14px; border-radius: 18px; font-size: 13px; font-weight:600;">🛡️ Focus Protected</span>
        </div>
      </div>
    </div>

    <div class="yt-secondary">
      <div style="font-size: 13px; font-weight: 700; margin-bottom: 12px; color: #94a3b8; letter-spacing:0.5px;">HIGH-SIGNAL RECOMMENDATIONS (FEED CLEAN)</div>
      <div class="yt-rec-card">
        <div class="yt-rec-thumb" style="background:#1e1b4b;"></div>
        <div class="yt-rec-details">
          <div class="yt-rec-title">React Server Components Deep Dive</div>
          <div class="yt-rec-ch">Dan Abramov • 120K views</div>
        </div>
      </div>
      <div class="yt-rec-card">
        <div class="yt-rec-thumb" style="background:#0f172a;"></div>
        <div class="yt-rec-details">
          <div class="yt-rec-title">Web Audio API 10-Band EQ Architecture</div>
          <div class="yt-rec-ch">Audio Engineering Society • 85K views</div>
        </div>
      </div>
      <div class="yt-rec-card">
        <div class="yt-rec-thumb" style="background:#1e293b;"></div>
        <div class="yt-rec-details">
          <div class="yt-rec-title">TypeScript 5.4 Best Practices &amp; Generics</div>
          <div class="yt-rec-ch">Matt Pocock • 210K views</div>
        </div>
      </div>
    </div>
  </div>

  ${overlayType === 'hud-popover' ? `
  <div class="ss-hud-popover" style="display:block; position:absolute; top:62px; right:80px; width:350px; background:#0b0f19; border:1px solid rgba(99,102,241,0.5); border-radius:14px; box-shadow:0 20px 50px rgba(0,0,0,0.9); z-index:10000; padding:18px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:18px;">🛡️</span>
        <span style="font-weight:700; font-size:15px; color:#fff;">Quick Shield Controls</span>
      </div>
      <span style="font-size:10px; background:rgba(16,185,129,0.2); color:#34d399; padding:3px 8px; border-radius:10px; font-weight:800;">ENGINE ACTIVE</span>
    </div>
    
    <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#e2e8f0;">🚫 Shorts Blocker</span>
        <span style="background:rgba(16,185,129,0.2); color:#10b981; padding:2px 8px; border-radius:6px; font-weight:700; font-size:11px;">ENABLED</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#e2e8f0;">🎓 Study Mode (Pomodoro)</span>
        <span style="background:rgba(16,185,129,0.2); color:#10b981; padding:2px 8px; border-radius:6px; font-weight:700; font-size:11px;">24:18 (CYCLE 2)</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#e2e8f0;">🎯 Intentional Goal Guard</span>
        <span style="background:rgba(56,189,248,0.2); color:#38bdf8; padding:2px 8px; border-radius:6px; font-weight:700; font-size:11px;">LOCKED</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#e2e8f0;">⚡ 600% Volume Booster</span>
        <span style="color:#38bdf8; font-weight:700;">250% (+8dB Bass)</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#e2e8f0;">🎚 10-Band EQ Preset</span>
        <span style="color:#c084fc; font-weight:700;">Rock Curve</span>
      </div>
      <div style="margin-top:6px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between;">
        <span style="font-size:11px; color:#94a3b8;">Rank: <strong style="color:#a855f7;">Diamond Warrior</strong></span>
        <span style="font-size:11px; color:#94a3b8;">Learning: <strong style="color:#10b981;">3h 45m</strong></span>
      </div>
    </div>
  </div>
  ` : ''}

  ${overlayType === 'goal-block' ? `
  <div class="ss-goal-block-overlay" style="position:fixed; inset:0; background:rgba(11,15,25,0.88); backdrop-filter:blur(18px); z-index:99999; display:flex; align-items:center; justify-content:center;">
    <div style="width:500px; background:#111827; border:1px solid rgba(239,68,68,0.5); border-radius:18px; padding:32px; box-shadow:0 25px 60px rgba(0,0,0,0.95); text-align:center;">
      <div style="font-size:52px; margin-bottom:12px;">🛡️ ⛔</div>
      <h2 style="font-size:23px; font-weight:800; color:#f87171; margin-bottom:10px;">Goal Mode Interception</h2>
      <p style="font-size:14px; color:#cbd5e1; line-height:1.5; margin-bottom:20px;">
        This video does not match your active study objective:<br>
        <strong style="color:#38bdf8; font-size:16px;">"Master Next.js 14 &amp; Web Audio Architecture"</strong>
      </p>
      <div style="display:flex; gap:12px; justify-content:center;">
        <button style="padding:12px 22px; background:#ef4444; border:none; border-radius:8px; color:#fff; font-weight:700; font-size:13px; cursor:pointer;">Return to Safe Study Feed</button>
        <button style="padding:12px 22px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:8px; color:#cbd5e1; font-weight:600; font-size:13px; cursor:pointer;">Allow Once (5 Min)</button>
      </div>
    </div>
  </div>
  ` : ''}

  ${overlayType === 'time-limit' ? `
  <div class="ss-time-limit-overlay" style="position:fixed; inset:0; background:rgba(11,15,25,0.92); backdrop-filter:blur(20px); z-index:99999; display:flex; align-items:center; justify-content:center;">
    <div style="width:500px; background:#111827; border:1px solid rgba(245,158,11,0.5); border-radius:18px; padding:32px; box-shadow:0 25px 60px rgba(0,0,0,0.95); text-align:center;">
      <div style="font-size:52px; margin-bottom:12px;">⏳ 🛑</div>
      <h2 style="font-size:23px; font-weight:800; color:#fbbf24; margin-bottom:10px;">Daily YouTube Allowance Reached</h2>
      <p style="font-size:14px; color:#cbd5e1; line-height:1.5; margin-bottom:20px;">
        You've reached your daily entertainment allowance of <strong>90 minutes</strong>.<br>
        Great job staying intentional today!
      </p>
      <div style="display:flex; gap:12px; justify-content:center;">
        <button style="padding:12px 22px; background:#f59e0b; border:none; border-radius:8px; color:#111827; font-weight:700; font-size:13px; cursor:pointer;">Close YouTube</button>
        <button style="padding:12px 22px; background:rgba(245,158,11,0.15); border:1px solid #f59e0b; border-radius:8px; color:#fbbf24; font-weight:600; font-size:13px; cursor:pointer;">+5 Min Emergency Snooze</button>
      </div>
    </div>
  </div>
  ` : ''}

</body>
</html>`;
}

const inpageScreens = [
  { type: 'hud-popover', file: '11-youtube-inpage-floating-hud.png' },
  { type: 'study-banner', file: '12-youtube-study-mode-pomodoro-banner.png' },
  { type: 'goal-block', file: '13-youtube-goal-mode-blocked-modal.png' },
  { type: 'time-limit', file: '14-youtube-time-limit-alert-modal.png' }
];

for (const s of inpageScreens) {
  const htmlContent = createYouTubeMockPage(s.type);
  const htmlPath = path.resolve(WORK_DIR, `inpage-${s.type}.html`);
  fs.writeFileSync(htmlPath, htmlContent);
  capture(htmlPath, s.file, 1280, 800);
}

console.log('\n🎉 ALL SCREENSHOTS GENERATED SUCCESSFULLY IN Desktop/screens/');
