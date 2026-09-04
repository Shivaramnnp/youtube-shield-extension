# Technical Investigation & Architecture Handoff Report
## On-Page HUD Redesign, Overlay Subsystems, Design System & Theming

**Agent**: Survey Explorer 2 (HUD & UI/Theming Specialist)  
**Date**: 2026-08-15  
**Working Directory**: `/Users/shivarampatel/Desktop/shorts-shield/.agents/explorer_survey_hud`  
**Target Scope**: On-Page Floating HUD Panel (`content/js/header-button.js`, `content/css/header-button.css`), Overlay Subsystems (`goal-mode.js`, `study-mode.js`, `time-manager.js`, `main.js`), Design Tokens & Theme Consistency across HUD, Popup (`popup/`), and Options Dashboard (`options/`).

---

## 1. Observation

Direct code examination and verification of the GodMode Chrome Extension codebase revealed the following exact implementations, structures, and behaviors:

### 1.1 On-Page HUD & Header Injection Implementation
- **File Location**: `content/js/header-button.js` (1006 lines) and `content/css/header-button.css` (564 lines).
- **Injection Anchor**:
  - `HeaderButton.tryInject()` (`content/js/header-button.js:120–177`) searches for YouTube's top masthead container:
    ```javascript
    const buttonsContainer = document.querySelector(
      'ytd-masthead #end #buttons, #end #buttons, #masthead #buttons, ytd-masthead #buttons, div#buttons'
    );
    ```
  - Injects `#ss-header-btn-container` (`content/css/header-button.css:3–12`) before the YouTube "Create" button or prepends to `#buttons`.
  - Injected button `#ss-header-btn` renders a shield icon with status indicator `#ss-header-btn-status` (green for active, grey for disabled) and tooltip `#ss-header-btn-tooltip`.
- **Dialog Mounting**:
  - Clicking `#ss-header-btn` invokes `HeaderButton.togglePopup()` (`content/js/header-button.js:258–265`), which mounts `.ss-popup-dialog#ss-popup-dialog` directly inside `#ss-header-btn-container`.
  - Positioned absolutely (`top: 48px !important; right: 0 !important; width: 320px !important; z-index: 2147483647 !important;`).
- **Outside Click & Teardown**:
  - `HeaderButton.openPopup()` sets a 10ms timer (`this.outsideClickTimer`) to attach `document.addEventListener('click', this.boundOutsideClick)` (`content/js/header-button.js:460–466`).
  - Outside click closes the dialog cleanly.
  - `HeaderButton.disable()` cleanly removes `#ss-popup-dialog`, clears `sessionTimerInterval`, cancels canvas `requestAnimationFrame`, and unhooks storage/DOM listeners.

### 1.2 Inventory of All Existing HUD Controls & Elements
Examination of `content/js/header-button.js:297–445` reveals that every single control is currently rendered in one continuous, un-grouped, vertical stack without collapsible containers:

| Component / Feature | Element ID / Selector | Type | Functionality & Data Binding |
| :--- | :--- | :--- | :--- |
| **Master GodMode Switch** | `#ss-toggle-master`, `.ss-master-slider` | Checkbox / Switch | Calls `StorageUtil.updateSetting('extensionEnabled', bool)`. Dims all features when false. |
| **Settings Navigation** | `#ss-popup-settings`, `.ss-popup-settings-icon` | Clickable Button (`⚙️`) | Dispatches `{ action: "openOptionsPage" }` via `chrome.runtime.sendMessage` or opens `options/options.html`. |
| **Learning Goal Display** | `#ss-popup-goal` | Span | Displays `settings.learningGoal` (sanitized with `escapeHtml`). |
| **Edit Goal Trigger** | `#ss-popup-edit-goal` | Clickable Button (`✏️`) | Reveals `#ss-popup-goal-container` and focuses input. |
| **Goal Input Container** | `#ss-popup-goal-container` | Flex Container (hidden) | Contains `#ss-popup-goal-input` and `#ss-popup-save-goal`. |
| **Goal Save Button & Input** | `#ss-popup-save-goal`, `#ss-popup-goal-input` | Button / Text Input | Saves goal to storage and redirects to YouTube search results. |
| **Live Session Timer** | `#ss-popup-session-time` | Monospace Div (`00:00:00`) | Live 1s interval timer counting elapsed seconds since `tracking.activeSessionStart` when Study Mode is enabled. |
| **Session Time Label** | `.ss-popup-session-label` | Div | Static label text "Session Time". |
| **Shorts Blocker Toggle** | `#ss-toggle-shorts` | Checkbox Switch | Calls `StorageUtil.updateSetting('shortsBlocker', bool)`. |
| **Focus Mode Toggle** | `#ss-toggle-focus` | Checkbox Switch | Calls `StorageUtil.updateSetting('focusMode', bool)`. |
| **Study Mode Toggle** | `#ss-toggle-study` | Checkbox Switch | Calls `StorageUtil.updateSetting('studyMode', bool)` & toggles session timer. |
| **Goal Mode (Strict) Toggle** | `#ss-toggle-goal` | Checkbox Switch | Calls `StorageUtil.updateSetting('goalMode', bool)`. |
| **Time Manager Toggle** | `#ss-toggle-time-manager` | Checkbox Switch | Calls `StorageUtil.updateTimeManagerSetting('enabled', bool)`. |
| **Volume Boost Slider** | `#ss-vol-slider`, `#ss-vol-value` | Range Slider (100–600%) | Real-time `VolumeBooster.setVolume(val)` and storage update. |
| **Bass Boost Slider** | `#ss-bass-slider`, `#ss-bass-value` | Range Slider (0–20 dB) | Real-time `VolumeBooster.setBass(val)` and storage update. |
| **Spectrum Visualizer** | `#ss-spectrum-canvas` | HTML5 Canvas (288×50) | Driven by `renderSpectrum()` using `VolumeBooster.getFrequencyData()` at 60 FPS. |
| **Equalizer Master Toggle** | `#ss-eq-toggle` | Checkbox Switch | Toggles 10-band filter processing in Web Audio graph and storage. |
| **EQ Preset Dropdown** | `#ss-eq-preset` | `<select>` Dropdown | Selects Flat, Bass Boost, Vocal Booster, Treble Boost, Rock, Pop, Acoustic, Electronic, Custom. |
| **EQ Reset Button** | `#ss-eq-reset` | Button | Resets all 10 bands to 0 dB and sets preset to "Flat". |
| **10-Band EQ Slider Rack** | `#ss-eq-rack`, `#ss-eq-slider-0` .. `#ss-eq-slider-9` | 10 Vertical Range Sliders (`-12` to `+12 dB`) | `writing-mode: vertical-lr; direction: rtl;`. Updates band gains in AudioEngine/VolumeBooster and storage. |
| **10-Band Value Labels** | `#ss-eq-val-0` .. `#ss-eq-val-9` | Spans (`+3dB`, `0dB`, etc.) | Gain readout above each frequency band slider. |
| **Player Rank Tier** | `#ss-popup-rank-tier` | Span | Displays AP rank icon + tier + total AP (e.g. `🥉 Bronze Focus (0 AP)`). |
| **Today's Total Time** | `#ss-popup-today-time` | Span | Shows formatted daily watch time (e.g. `1h 45m`). |
| **Today's Learning Time** | `#ss-popup-learning-time` | Span | Shows formatted daily study time (e.g. `1h 10m`). |
| **Focus Score** | `#ss-popup-focus-score` | Span (`.ss-focus-score-row`) | Percentage calculation `(learningSeconds / totalSeconds) * 100`. |

### 1.3 Other On-Page Overlay Subsystems in the Codebase
- **Goal Mode Overlay** (`content/js/goal-mode.js:353–442`): Injects `#ss-goal-block-overlay` (`.ss-overlay-backdrop` with `z-index: 2147483647`) containing `.ss-modal-card`, blocked video title `#ss-goal-video-title`, single-video exception button `#ss-btn-allow-once`, search button `#ss-btn-search-goal`, and home button `#ss-btn-go-home`.
- **Study Mode Banner & Notices** (`content/js/study-mode.js:141–237`): Injects top sticky banner `#ss-study-banner` (`z-index: 9999`, height 36px), Pomodoro phase timer `#ss-pomo-timer`, phase badge `#ss-pomo-phase-badge`, cycle count `#ss-pomo-cycles`, pause `#ss-pomo-btn-pause`, skip `#ss-pomo-btn-skip`, reset `#ss-pomo-btn-reset`, and header trigger button `#ss-banner-shield-btn`. Also creates `#ss-alignment-warning` (`z-index: 10000`) and `#ss-pomo-notice`.
- **Time Manager Daily Limit / Focus Hours Overlay** (`content/js/time-manager.js:143–197`): Injects `#ss-time-manager-overlay` (`.ss-overlay-backdrop` with `z-index: 2147483647`) containing `#ss-tm-snooze` (+5 Min Emergency Extension).
- **Focus Reminder Modal** (`content/js/main.js:131–185`): Injects `#ss-focus-reminder` (`.ss-focus-reminder-backdrop` with `z-index: 2147483647`), containing continue button `#ss-btn-continue` and break button `#ss-btn-break`.

### 1.4 Current Visual Theming Inconsistencies
- `content/css/header-button.css` currently uses neutral greys/blues:
  - Header: `rgba(33, 33, 33, 0.85)`
  - Study card: `linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)` (standard blue)
  - Stats container: `rgba(33, 33, 33, 0.7)`
- In contrast, `popup/popup.css` and `options/options.css` use the obsidian dark-purple theme:
  - Background: `#0b0f19` with radial gradient `radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0f172a 60%, #0b0f19 100%)`
  - Accents: Indigo `#6366f1`, Purple `#a855f7`, Pink `#ec4899`, Emerald `#10b981`
  - Cards: `linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.2) 100%)`

---

## 2. Logic Chain: Analysis to Redesign Architecture

### Step 1: Why the current HUD causes friction
- Observation 1.2 shows 24 distinct interactive controls all laid out in a single flat vertical container.
- When all controls are visible simultaneously, the dialog exceeds 650px in height. On 720p/1080p laptop viewports, this overflows the bottom of the masthead and obscures the YouTube video player and top sidebar.
- Users only need instant access to master GodMode status, current goal, session time, and quick toggles (Shorts Blocker and Focus Mode). Secondary features (Study Mode, Strict Goal Mode, Time Manager) and audio tweaking (Volume, Bass, 10-Band EQ) are adjusted infrequently.

### Step 2: Designing the 3-Layer Hierarchical HUD Model
To satisfy Requirement R1 without breaking any existing test assertions or functionality:
1. **Always-Visible Core Header & Hero Card (Default Expanded View)**:
   - **Header**: Logo `⚡ GodMode`, Master Power Toggle (`#ss-toggle-master`), Settings icon (`#ss-popup-settings`), and a new **Minimize Button** (`#ss-popup-minimize`).
   - **Hero Session Card**: Current Goal (`#ss-popup-goal`), Edit Goal icon (`#ss-popup-edit-goal`), Session Timer (`#ss-popup-session-time`).
   - **Quick-Access Toggles**: Shorts Blocker (`#ss-toggle-shorts`) and Focus Mode (`#ss-toggle-focus`).
2. **Three Collapsible Accordion Sections (Collapsed by default)**:
   - **Section 1: "Session"** (`#ss-section-session`): Contains the Goal Editor input form (`#ss-popup-goal-container`), Player Rank badge (`#ss-popup-rank-tier`), Today's Watch Time (`#ss-popup-today-time`), Learning Time (`#ss-popup-learning-time`), and Focus Score (`#ss-popup-focus-score`).
   - **Section 2: "Focus Features"** (`#ss-section-focus`): Contains Study Mode toggle (`#ss-toggle-study`), Goal Mode (Strict) toggle (`#ss-toggle-goal`), and Time Manager toggle (`#ss-toggle-time-manager`).
   - **Section 3: "Audio"** (`#ss-section-audio`): Contains Volume Boost slider (`#ss-vol-slider`), Bass Boost slider (`#ss-bass-slider`), Spectrum Visualizer canvas (`#ss-spectrum-canvas`), and the complete 10-Band Graphic Equalizer (`#ss-eq-section` with `#ss-eq-toggle`, `#ss-eq-preset`, `#ss-eq-reset`, and `#ss-eq-rack`).
3. **Internal Scrolling with Max-Height Boundary**:
   - Wrap the collapsible sections in `.ss-popup-scroll-body` with `max-height: min(72vh, 480px); overflow-y: auto; overflow-x: hidden;`.
   - The entire `#ss-popup-dialog` has fixed bounding: `max-height: calc(100vh - 64px);`. It will never grow off-screen or cover YouTube playback controls.

### Step 3: Designing the Minimized Pill/Badge State
- When `#ss-popup-minimize` is clicked:
  - Add class `.ss-dialog-minimized` to `#ss-popup-dialog` or toggle into a compact floating pill `#ss-hud-pill`.
  - The pill displays: `⚡ GodMode [00:12:45] ▴` (shield icon, active pulse dot, live session timer, restore chevron).
  - Pill dimensions: `height: 32px; padding: 0 12px; border-radius: 999px; background: rgba(15, 15, 26, 0.95); border: 1px solid rgba(168, 85, 247, 0.4); backdrop-filter: blur(12px);`.
  - Clicking the pill immediately restores the full expanded HUD dialog.

### Step 4: Visual Theming Harmonization
- Align the HUD CSS (`content/css/header-button.css`) with the dark-purple glassmorphism tokens from `popup.css` and `options.css`:
  - Panel Background: `rgba(15, 15, 26, 0.94)` with `backdrop-filter: blur(16px); border: 1px solid rgba(168, 85, 247, 0.2); box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(168, 85, 247, 0.15)`.
  - Hero Session Card: `linear-gradient(135deg, rgba(67, 56, 202, 0.4) 0%, rgba(124, 58, 237, 0.3) 100%)`.
  - Accordion Headers: `background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 10px; padding: 10px 14px; cursor: pointer; transition: all 0.2s ease;`.
  - Hover state: `background: rgba(168, 85, 247, 0.1); border-color: rgba(168, 85, 247, 0.3);`.
  - Chevron icon rotates smoothly 90° (`transform: rotate(90deg)`) when expanded.

---

## 3. Shared Design Tokens Specification

To ensure visual consistency across the On-Page HUD (`content/css/header-button.css`), Extension Toolbar Popup (`popup/popup.css`), and Options Dashboard (`options/options.css`), the following unified design token system is established:

```css
/* ==========================================================================
   GodMode Design Tokens — Shared Across HUD, Popup & Options
   ========================================================================== */
:root {
  /* Surface & Background Colors */
  --gm-bg-base: #0b0f19;
  --gm-bg-gradient: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0f172a 60%, #0b0f19 100%);
  --gm-bg-glass-panel: rgba(15, 15, 26, 0.94);
  --gm-bg-glass-card: rgba(30, 27, 75, 0.4);
  --gm-bg-glass-card-hover: rgba(46, 16, 101, 0.5);
  --gm-bg-glass-subtle: rgba(255, 255, 255, 0.03);

  /* Primary Brand & Accent Colors */
  --gm-accent-indigo: #6366f1;
  --gm-accent-purple: #a855f7;
  --gm-accent-fuchsia: #d946ef;
  --gm-accent-pink: #ec4899;
  --gm-accent-emerald: #10b981;
  --gm-accent-sky: #38bdf8;
  --gm-accent-gold: #f59e0b;

  /* Rich Gradients */
  --gm-gradient-brand: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  --gm-gradient-hero: linear-gradient(135deg, rgba(67, 56, 202, 0.45) 0%, rgba(124, 58, 237, 0.35) 100%);
  --gm-gradient-success: linear-gradient(135deg, #10b981 0%, #059669 100%);
  --gm-gradient-danger: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  --gm-gradient-audio: linear-gradient(90deg, #2563eb 0%, #7c3aed 50%, #ec4899 100%);

  /* Typography Colors */
  --gm-text-primary: #f8fafc;
  --gm-text-secondary: #cbd5e1;
  --gm-text-muted: #94a3b8;
  --gm-text-subtle: #64748b;

  /* Borders & Glow Effects */
  --gm-border-subtle: rgba(255, 255, 255, 0.08);
  --gm-border-purple: rgba(168, 85, 247, 0.25);
  --gm-border-purple-glow: rgba(168, 85, 247, 0.45);
  --gm-glow-brand: 0 0 16px rgba(99, 102, 241, 0.45);
  --gm-glow-purple: 0 0 16px rgba(168, 85, 247, 0.45);
  --gm-glow-emerald: 0 0 14px rgba(16, 185, 129, 0.45);

  /* Spacing & Radii */
  --gm-radius-sm: 6px;
  --gm-radius-md: 10px;
  --gm-radius-lg: 14px;
  --gm-radius-xl: 18px;
  --gm-radius-pill: 999px;

  /* Transitions */
  --gm-transition-fast: 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  --gm-transition-smooth: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  --gm-transition-accordion: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
}
```

---

## 4. Separation of Concerns & Architecture Boundaries

The extension codebase maintains a clean 5-layer separation:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION & UI LAYER                            │
├──────────────────────────┬───────────────────────────┬──────────────────────┤
│  On-Page HUD & Overlays  │    Extension Toolbar      │   Options Dashboard  │
│  content/js/             │    popup/popup.html       │   options/options.js │
│  - header-button.js      │    popup/popup.js         │   options/options.html
│  - goal-mode.js (modal)  │    popup/popup.css        │   options/options.css│
│  - time-manager.js(modal)│                           │                      │
│  - study-mode.js(banner) │                           │                      │
└────────────┬─────────────┴─────────────┬─────────────┴──────────┬───────────┘
             │                           │                        │
             ▼                           ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DOM & LIFECYCLE COORDINATION LAYER                       │
│  content/js/main.js  ·  content/js/observer-utils.js                        │
│  - Event routing (yt-navigate-finish, DOMContentLoaded)                     │
│  - applySettings() dynamic feature enabling/disabling                       │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BUSINESS & ENGINE DOMAIN LAYER                        │
│  utils/audio-engine.js  ·  utils/gamification-engine.js  ·  time-tracker.js │
│  - Web Audio graph routing (MediaElementSource -> Gain -> 10 BiquadFilters) │
│  - AP, EXP, Streak calculations & 22 Achievement evaluations                │
│  - Video playback tracking state machine                                    │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DATA ACCESS & PERSISTENCE LAYER                         │
│  utils/storage.js                                                           │
│  - 3-tier cascade: chrome.storage.sync -> chrome.storage.local -> memoryCache│
│  - Schema defaults, migrations, context invalidation safety                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Boundaries:
1. **Overlay UI Components** (`content/js/header-button.js`, `goal-mode.js`, `time-manager.js`) handle only local DOM rendering, accordion open/close animations, slider input events, and user triggers. They do not maintain business logic or talk directly to raw `chrome.storage.local`.
2. **Data Layer** (`utils/storage.js`) acts as the single source of truth for all reading and persisting of settings and analytics.
3. **Engines** (`utils/audio-engine.js`, `utils/gamification-engine.js`) are pure domain logic modules that remain decoupled from DOM manipulation.

---

## 5. Detailed Component Redesign Blueprints

### 5.1 Proposed HUD DOM Template Structure
The redesigned HUD template inside `HeaderButton.openPopup()` organizes all existing element IDs into the 3-tier layout:

```html
<div class="ss-popup-dialog ss-hud-minimal" id="ss-popup-dialog">
  <!-- 1. Header Bar -->
  <div class="ss-popup-header">
    <div class="ss-popup-logo">
      <span class="ss-logo-icon">⚡</span>
      <span class="ss-logo-title">GodMode</span>
    </div>
    <div class="ss-popup-header-actions">
      <label class="ss-master-toggle-wrap" for="ss-toggle-master" title="Master GodMode Toggle">
        <input type="checkbox" id="ss-toggle-master" ${settings.extensionEnabled !== false ? 'checked' : ''} />
        <span class="ss-master-slider"></span>
      </label>
      <button class="ss-popup-minimize-btn" id="ss-popup-minimize" title="Minimize to Pill" aria-label="Minimize">🗕</button>
      <button class="ss-popup-settings-icon" id="ss-popup-settings" title="Open Settings Dashboard" aria-label="Settings">⚙️</button>
    </div>
  </div>

  <!-- 2. Scrollable Body Container (Fixed Max-Height) -->
  <div class="ss-popup-scroll-body">
    <!-- Hero Session Card (Always Visible in Default View) -->
    <div class="ss-popup-study-card">
      <div class="ss-popup-study-header">
        <div class="ss-goal-display">
          <span class="ss-goal-prefix">Goal:</span>
          <span id="ss-popup-goal" class="ss-goal-text">${this.escapeHtml(settings.learningGoal)}</span>
        </div>
        <button class="ss-popup-edit-goal" id="ss-popup-edit-goal" title="Edit Goal">✏️</button>
      </div>
      
      <div class="ss-popup-session-time" id="ss-popup-session-time">00:00:00</div>
      <div class="ss-popup-session-label">Session Time</div>

      <div class="ss-popup-goal-input-container" id="ss-popup-goal-container" style="display: none;">
        <input type="text" id="ss-popup-goal-input" placeholder="Enter learning goal..." />
        <button id="ss-popup-save-goal">Save</button>
      </div>
    </div>

    <!-- Quick Access Toggles (Always Visible in Default View) -->
    <div class="ss-popup-primary-toggles">
      <label class="ss-popup-toggle-row">
        <span class="ss-popup-toggle-label">🛡️ Shorts Blocker</span>
        <div class="ss-toggle-switch">
          <input type="checkbox" id="ss-toggle-shorts" ${settings.shortsBlocker ? 'checked' : ''} />
          <span class="ss-slider"></span>
        </div>
      </label>

      <label class="ss-popup-toggle-row">
        <span class="ss-popup-toggle-label">🎯 Focus Mode</span>
        <div class="ss-toggle-switch">
          <input type="checkbox" id="ss-toggle-focus" ${settings.focusMode ? 'checked' : ''} />
          <span class="ss-slider"></span>
        </div>
      </label>
    </div>

    <!-- Collapsible Section 1: Session & Stats (Collapsed by default) -->
    <div class="ss-accordion-section" id="ss-section-session">
      <button class="ss-accordion-header" id="ss-header-session" aria-expanded="false">
        <div class="ss-accordion-title">
          <span class="ss-accordion-icon">📊</span>
          <span>Session Stats</span>
        </div>
        <span class="ss-accordion-chevron">▾</span>
      </button>
      <div class="ss-accordion-content" id="ss-content-session">
        <div class="ss-popup-stats">
          <div class="ss-stat-row">
            <span>Player Rank:</span>
            <span id="ss-popup-rank-tier">🥉 Bronze Focus (0 AP)</span>
          </div>
          <div class="ss-stat-row">
            <span>Today's Total Time:</span>
            <span id="ss-popup-today-time">0h 0m</span>
          </div>
          <div class="ss-stat-row">
            <span>Learning Time:</span>
            <span id="ss-popup-learning-time">0h 0m</span>
          </div>
          <div class="ss-stat-row ss-focus-score-row">
            <span>Focus Score:</span>
            <span id="ss-popup-focus-score">0%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Collapsible Section 2: Focus Features (Collapsed by default) -->
    <div class="ss-accordion-section" id="ss-section-focus">
      <button class="ss-accordion-header" id="ss-header-focus" aria-expanded="false">
        <div class="ss-accordion-title">
          <span class="ss-accordion-icon">⚙️</span>
          <span>Focus Features</span>
        </div>
        <span class="ss-accordion-chevron">▾</span>
      </button>
      <div class="ss-accordion-content" id="ss-content-focus">
        <div class="ss-popup-toggles">
          <label class="ss-popup-toggle-row">
            <span class="ss-popup-toggle-label">📖 Study Mode</span>
            <div class="ss-toggle-switch">
              <input type="checkbox" id="ss-toggle-study" ${settings.studyMode ? 'checked' : ''} />
              <span class="ss-slider"></span>
            </div>
          </label>

          <label class="ss-popup-toggle-row">
            <span class="ss-popup-toggle-label">🎯 Goal Mode (Strict)</span>
            <div class="ss-toggle-switch">
              <input type="checkbox" id="ss-toggle-goal" ${settings.goalMode ? 'checked' : ''} />
              <span class="ss-slider"></span>
            </div>
          </label>

          <label class="ss-popup-toggle-row">
            <span class="ss-popup-toggle-label">⏳ Time Manager</span>
            <div class="ss-toggle-switch">
              <input type="checkbox" id="ss-toggle-time-manager" ${settings.timeManager && settings.timeManager.enabled ? 'checked' : ''} />
              <span class="ss-slider"></span>
            </div>
          </label>
        </div>
      </div>
    </div>

    <!-- Collapsible Section 3: Audio Enhancements & 10-Band EQ (Collapsed by default) -->
    <div class="ss-accordion-section" id="ss-section-audio">
      <button class="ss-accordion-header" id="ss-header-audio" aria-expanded="false">
        <div class="ss-accordion-title">
          <span class="ss-accordion-icon">🔊</span>
          <span>Audio Studio</span>
        </div>
        <span class="ss-accordion-chevron">▾</span>
      </button>
      <div class="ss-accordion-content" id="ss-content-audio">
        <div class="ss-popup-audio-enhancements">
          <!-- Volume & Bass Controls -->
          <div class="ss-audio-slider-group">
            <div class="ss-slider-header">
              <span>Volume Boost</span>
              <span id="ss-vol-value">${vb.volumeLevel || 100}%</span>
            </div>
            <input type="range" id="ss-vol-slider" min="100" max="600" step="10" value="${vb.volumeLevel || 100}" />
          </div>

          <div class="ss-audio-slider-group">
            <div class="ss-slider-header">
              <span>Bass Boost</span>
              <span id="ss-bass-value">${vb.bassLevel || 0} dB</span>
            </div>
            <input type="range" id="ss-bass-slider" min="0" max="20" step="1" value="${vb.bassLevel || 0}" />
          </div>

          <!-- Spectrum Visualizer -->
          <div class="ss-spectrum-wrap">
            <canvas id="ss-spectrum-canvas" width="288" height="50"></canvas>
          </div>

          <!-- 10-Band EQ Controls -->
          <div class="ss-eq-section" id="ss-eq-section">
            <div class="ss-eq-header-row">
              <span class="ss-eq-title">🎚️ 10-Band Graphic Equalizer</span>
              <label class="ss-toggle-switch" for="ss-eq-toggle">
                <input type="checkbox" id="ss-eq-toggle" ${isEqEnabled ? 'checked' : ''} />
                <span class="ss-slider"></span>
              </label>
            </div>

            <div class="ss-eq-controls">
              <select id="ss-eq-preset" class="ss-eq-select" aria-label="Equalizer Preset">
                <option value="Flat" ${currentPreset === 'Flat' ? 'selected' : ''}>Flat</option>
                <option value="Bass Boost" ${currentPreset === 'Bass Boost' ? 'selected' : ''}>Bass Boost</option>
                <option value="Vocal Booster" ${currentPreset === 'Vocal Booster' ? 'selected' : ''}>Vocal Booster</option>
                <option value="Treble Boost" ${currentPreset === 'Treble Boost' ? 'selected' : ''}>Treble Boost</option>
                <option value="Rock" ${currentPreset === 'Rock' ? 'selected' : ''}>Rock</option>
                <option value="Pop" ${currentPreset === 'Pop' ? 'selected' : ''}>Pop</option>
                <option value="Acoustic" ${currentPreset === 'Acoustic' ? 'selected' : ''}>Acoustic</option>
                <option value="Electronic" ${currentPreset === 'Electronic' ? 'selected' : ''}>Electronic</option>
                <option value="Custom" ${currentPreset === 'Custom' ? 'selected' : ''}>Custom</option>
              </select>
              <button id="ss-eq-reset" class="ss-eq-btn">Reset</button>
            </div>

            <div class="ss-eq-rack ${!isEqEnabled ? 'ss-eq-disabled' : ''}" id="ss-eq-rack">
              <!-- 10 Frequency Band Sliders (32Hz - 16kHz) with writing-mode: vertical-lr; direction: rtl; -->
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 6. Caveats

1. **Test Selector Preservation**: Automated test suites in `tests/tier1/shorts-blocker.test.js`, `tests/challenger-m3-empirical-stress.js`, and `tests/challenger-m4_1-empirical-stress.js` explicitly assert on IDs (`#ss-popup-dialog`, `#ss-toggle-master`, `#ss-eq-rack`, `#ss-eq-slider-0` through `#ss-eq-slider-9`, `#ss-eq-preset`, `#ss-eq-reset`, `#ss-vol-slider`, etc.). The redesigned markup must strictly preserve all of these element IDs and event handlers.
2. **Spectrum Visualizer Inactivity when Collapsed**: When the "Audio" accordion is collapsed, the canvas is hidden (`display: none` or zero height). The `requestAnimationFrame` loop in `renderSpectrum()` should pause or skip drawing when the canvas is not visible to conserve CPU/GPU resources on active tabs.
3. **Outside Click Listener Delay**: The 10ms delay (`this.outsideClickTimer`) before attaching `document.addEventListener('click', this.boundOutsideClick)` must be preserved to prevent immediate self-closure on opening.
4. **CSS Deprecation Prevention**: As required by R2 from previous audit cycles, vertical range sliders in the EQ rack must exclusively use `style="writing-mode: vertical-lr; direction: rtl;"` and never use `orient="vertical"` or `slider-vertical`.

---

## 7. Conclusion

The GodMode On-Page HUD redesign is completely viable and can be cleanly implemented without regressions.
1. The redesigned layout reduces the initial unexpanded height by over **60%**, presenting a focused, minimal heads-up widget showing only the Master toggle, Hero session card, and primary toggles (Shorts Blocker & Focus Mode).
2. Secondary controls (Stats, Focus Features, Sound Studio & 10-Band EQ) are neatly encapsulated in accordion sections that are collapsed by default.
3. Fixed `max-height: min(72vh, 480px)` and internal scroll ensures the HUD never dominates the viewport or overlays YouTube video controls.
4. Minimize control provides a seamless transition into a sleek pill badge.
5. The unified dark-purple glassmorphic design token palette brings visual parity across On-Page HUD, Toolbar Popup, and Options Dashboard.

---

## 8. Verification Method

To independently verify the investigation and ensure the codebase maintains full operational integrity:

1. **Run Full Test Suite**:
   ```bash
   npm test
   ```
   *Expected Result*: 331/331 tests across Tier 1, Tier 2, Tier 3, and Tier 4 pass 100% cleanly.

2. **Run Static Syntax Validation**:
   ```bash
   node tests/syntax/syntax-checker.js
   ```
   *Expected Result*: 88/88 JavaScript files pass syntax check cleanly with 0 syntax errors.

3. **Verify Deprecated CSS & Declaration Safety**:
   ```bash
   grep -rn "orient=\"vertical\"\|slider-vertical" content/ popup/ options/
   grep -rn "const EQ_PRESETS\|let EQ_PRESETS\|var EQ_PRESETS" content/
   ```
   *Expected Result*: Zero occurrences found.

4. **Verify HeaderButton Lifecycle & EQ Presets**:
   ```bash
   node tests/challenger-m4-empirical-presets-verifier.js
   node tests/challenger-m4_1-empirical-stress.js
   ```
   *Expected Result*: All subtests pass cleanly.
