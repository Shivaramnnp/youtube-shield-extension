# Codebase Map & Architecture Topology

> **Auditor**: Codebase Reconnaissance Specialist  
> **Target**: GodMode YouTube Chrome Extension (MV3)  
> **Repository Root**: `/Users/shivarampatel/Desktop/shorts-shield`

---

## 1. System Architecture Overview

GodMode is an enterprise-grade Chrome Extension built under the **Manifest V3 (MV3)** specification. It delivers distraction elimination, study mode focus, Shorts blocking, intelligent feed filtering, graphic equalizer/volume boosting, gamification ranks, and reliable auto-ad-skipping without violating YouTube Terms of Service.

### Core Architecture Topology

```text
manifest.json (MV3 Configuration)
  ├── Background Service Worker (background/background.js)
  │     ├── Navigation Interception (/shorts/, /playables/)
  │     ├── Options Page Tab Deduplication & IPC Router
  │     └── History State Management (chrome.storage.session)
  │
  ├── Content Scripts Layer (content/js/main.js)
  │     ├── Shield HUD Popover Controller (content/js/header-button.js)
  │     ├── Auto-Skip Ads Engine (content/js/ad-skipper.js)
  │     ├── Shorts & Reels Blocker (content/js/shorts-blocker.js)
  │     ├── Focus Mode Controller (content/js/focus-mode.js)
  │     ├── Study Mode & Pomodoro (content/js/study-mode.js)
  │     ├── Goal Mode Topic Enforcer (content/js/goal-mode.js)
  │     ├── Time Manager & Watch Limits (content/js/time-manager.js)
  │     ├── UI Cleaner Distraction Filter (content/js/ui-cleaner.js)
  │     ├── Custom Feed & Blocklists (content/js/feed-controller.js)
  │     ├── Volume Booster & WebAudio (content/js/volume-booster.js)
  │     └── MutationObserver Utilities (content/js/observer-utils.js)
  │
  ├── Extension UIs
  │     ├── Toolbar Popup (popup/popup.html, popup/popup.js, popup/popup.css)
  │     └── Options Workspace (options/options.html, options/options.js, options/options.css)
  │
  └── Core Utility Layer
        ├── 3-Tier Storage Cascade (utils/storage.js)
        ├── DOM Manipulation & Sanitization (utils/dom-utils.js)
        ├── WebAudio Synthesis Engine (utils/audio-engine.js)
        ├── Gamification & Ranks System (utils/gamification-engine.js)
        ├── Watch Time & Streak Tracker (utils/time-tracker.js)
        └── Central Design Tokens (utils/design-tokens.js)
```

---

## 2. Comprehensive Directory & Module Breakdown

| Directory / File | Purpose | Key Exports / Responsibilities | Risk Level |
|---|---|---|---|
| `manifest.json` | Extension Configuration | Declarative MV3 permissions (`storage`, `tabs`, `scripting`, `webNavigation`), host permissions (`*://*.youtube.com/*`), content script injection order | Low |
| `background/background.js` | Background Service Worker | Intercepts `/shorts/` and `/playables/` via `webNavigation.onBeforeNavigate`, deduplicates options page tabs via IPC, manages pending tabs | Medium |
| `content/js/main.js` | Content Script Entrypoint | Central coordinator, listens for `chrome.storage.onChanged`, synchronizes all feature modules, handles SPA navigation events | High |
| `content/js/header-button.js` | Shield HUD Popover | Renders obsidian glass HUD dialog anchored to `document.body`, master toggle switch, quick feature toggles, goal editor, accordion panels | High |
| `content/js/ad-skipper.js` | Auto-Skip Ads Engine | Detects skippable ads across all modern and legacy YouTube DOM selectors, avoids countdown buttons, dispatches native clicks, injects main-world script | High |
| `content/js/shorts-blocker.js` | Shorts & Playables Blocker | Intercepts shorts URL navigation, hides shelves/reels via CSS and DOM MutationObserver, increments blocked count | Medium |
| `content/js/focus-mode.js` | Focus Mode Controller | Fluid centered video layout, hides sidebar, comments, end-screen, distractions | Medium |
| `content/js/study-mode.js` | Study Mode & Pomodoro | Top status banner (#ss-study-banner), 3-phase Pomodoro timer, off-topic detection, +10 AP bonus | Medium |
| `content/js/goal-mode.js` | Goal Mode Controller | Strict topic enforcement, off-topic full-screen lock overlay (#ss-goal-block-overlay), keyword search validation | Medium |
| `content/js/time-manager.js` | Daily Time Manager | Daily watch limits, schedule checks, alarm tone synthesis, emergency +5 min snooze | Medium |
| `content/js/ui-cleaner.js` | UI Distraction Cleaner | Granular toggles for bell, sub count, chat, trending, explore, miniplayer, autoplay | Low |
| `content/js/feed-controller.js` | Custom Feed & Blocklists | Filters home and search feeds against custom keyword and channel blocklists | Medium |
| `content/js/volume-booster.js` | Volume & EQ Controller | Connects HTML5 video to WebAudio GainNode and 10-band BiquadFilter EQ pipeline | Medium |
| `content/js/observer-utils.js` | DOM Observer Helper | Centralized MutationObserver management with debounced batching and lifecycle cleanup | Low |
| `popup/popup.js` & `popup.html` | Toolbar Popup | Master toggle switch, feature switches, volume booster slider, rank progress bar | Medium |
| `options/options.js` & `options.html` | Options Dashboard | Multi-tab settings panel (Hero Battle Card, 22 achievements, 30-day analytics charts, JSON/CSV backup/restore) | Low |
| `utils/storage.js` | 3-Tier Storage Engine | Cascading storage (sync -> local -> memory cache), schema migration, timeline event logging, channel name sanitization | High |
| `utils/dom-utils.js` | DOM & Sanitization Utilities | Element querying, style injection, safe HTML template interpolation (`escapeHtml`) | Low |
| `utils/audio-engine.js` | WebAudio Sound Synthesis | Synthesizes level-up chime, badge unlock, alarm sirens, button click feedback | Low |
| `utils/gamification-engine.js` | Gamification & Ranks | Calculates AP/EXP, rank tiers (Bronze to Grandmaster Legend), achievement badge unlocks | Medium |
| `utils/time-tracker.js` | Video Time Tracking | Tracks daily watch & learning seconds, daily rollover, streak maintenance, 60-day data retention pruning | Medium |
| `utils/design-tokens.js` | Central Design Tokens | Color palettes, frosted glass blur (16px), z-index hierarchy constants, typography | Low |
| `run-tests.js` | Master Test Runner | CLI test runner executing Phase 1 (syntax) and Phase 3 (Tiers 1-4, 418 assertions) across DOM/MV3 mocks | Low |
| `tests/syntax/syntax-checker.js` | Static Syntax Checker | Programmatic `node -c` static syntax validator verifying all 103 JS files | Low |