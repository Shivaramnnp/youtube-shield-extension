# Project: YouTube Shield — Comprehensive UI/UX Polish, Interactive Verification & Pre-Deployment Audit

## Architecture
YouTube Shield is a multi-browser Manifest V3 web extension providing distraction-free YouTube browsing, deep study & goal enforcement, sound studio DSP audio enhancement, and gamified productivity tracking.

```
                                  ┌────────────────────────┐
                                  │   YouTube Web Pages    │
                                  │ (Desktop & Mobile Web) │
                                  └───────────┬────────────┘
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     ▼                                                 ▼
        ┌─────────────────────────┐                       ┌─────────────────────────┐
        │  Isolated Content World │                       │    Main Execution World │
        │  - header-button.js     │                       │  - page-ad-skipper.js   │
        │  - shorts-blocker.js    │◄─── CustomEvents ────►│  - page-audio-dsp.js    │
        │  - ui-cleaner.js        │      (__SS_*)         │  - native player APIs   │
        │  - focus-mode.js        │                       └─────────────────────────┘
        │  - study-mode.js        │
        │  - goal-mode.js         │
        │  - time-manager.js      │
        │  - quick-block.js       │
        │  - ad-skipper.js        │
        │  - volume-booster.js    │
        └────────────┬────────────┘
                     │
                     ▼
        ┌──────────────────────────────────────────────────────────┐
        │                 Shared Utility Layer                     │
        │  - design-tokens.js (Glassmorphism, colors, z-indices)   │
        │  - browser-detection.js (Safari vs Chrome/Firefox/Edge)  │
        │  - storage.js (3-tier cascade: sync -> local -> memory)  │
        │  - time-tracker.js (Session state machine, 24h charts)   │
        │  - gamification-engine.js (22 badges, 6 rank tiers, EXP) │
        │  - audio-engine.js (Web Audio DSP graph & fallback)      │
        └────────────────────────────┬─────────────────────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
        ┌─────────────────────────┐     ┌─────────────────────────┐
        │    Popup Menu (328px)   │     │ Options Studio (8 Tabs) │
        │  - popup.html/.css/.js  │     │  - options.html/.css/.js│
        │  - 8 core toggles       │     │  - Focus / Audio Studio │
        │  - Sound Studio Pro     │     │  - Blocklist Studio     │
        │  - Study Hero card      │     │  - Analytics / Badges   │
        └─────────────────────────┘     └─────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Glassmorphism & Token Conformance | Obsidian dark glass, backdrop-blur, neon accents, typography scale, 4px grid | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Masthead HUD Popover Dialog | Twin masthead pills, 4 accordion sections, minimize pill, z-index 99998 backdrop | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Popup Menu Interface | 328px compact glass UI, 8 feature switches, Sound Studio Pro rack, summary stats | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Options Studio Dashboard | 8-tab studio dashboard, responsive grid, visualizer modes, demo synthesizer | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Floating Modals & Z-Index Stacking | Strict stratification for Goal Mode, Time Manager, Focus Reminder, Study Banner | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Master Power & Core Toggles | Master power switch, minimize bar, accordion expand/collapse, quick action buttons | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Shorts Blocker & Clean UI | Complete Shorts hiding, SPA URL redirect, 7 granular Clean UI toggles | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Focus Mode & Study Mode | Distraction stripping, Pomodoro state machine (Focus/Break/Long Break), alignment alerts | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Goal Mode Strict Zero-Bypass | Keyword relevance filtering, entertainment blocker, unskippable overlay | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Time Manager & Emergency Snooze | 5s limit checks, scheduled focus hours, +5m snooze extension modal | M2 | ORIGINAL_REQUEST §R2 |
| 11 | Ghost Shield & Quick Block | Zero-trace feed purging, 1-click channel block, 5s countdown undo toast, keyword tokens | M2 | ORIGINAL_REQUEST §R2 |
| 12 | Multi-Strategy Ad Skipper | MAIN-world acceleration, instant skip click sequence, anti-adblock modal dismissal | M2 | ORIGINAL_REQUEST §R2 |
| 13 | Cross-Browser Detection & Gating | Safari macOS detection, capability gating, disabled audio controls & warning badges | M3 | ORIGINAL_REQUEST §R3 |
| 14 | Web Audio DSP Engine | 100–600% volume boost, +20dB bass boost, 10-band graphic EQ, 8 presets, 60fps FFT | M3 | ORIGINAL_REQUEST §R3 |
| 15 | Gamification System | 22 achievement badges, 6 PUBG/Free Fire rank tiers, quadratic EXP/AP progression | M4 | ORIGINAL_REQUEST §R2 |
| 16 | Analytics Engine & Backup | 24-hr hourly distribution charts, session timeline feed, JSON/CSV export & import | M4 | ORIGINAL_REQUEST §R2 |
| 17 | 3-Tier Storage Cascade | Sync -> Local -> Memory fallback, schema auto-repair, custom blocklist sync | M4 | ORIGINAL_REQUEST §R2 |
| 18 | E2E Opaque-Box Test Suite | 522 master automated tests spanning Tiers 1-4 (Features, Boundaries, Cross-Module, E2E) | M5 | ORIGINAL_REQUEST §R3 |
| 19 | Adversarial Coverage Hardening | 6 empirical challenger suites (655+ assertions) stress-testing edge cases & attacks | M5 | ORIGINAL_REQUEST §R3 |
| 20 | Pre-Deployment Build Certification | Manifest V3 validation, syntax checks (131/131 clean), Chrome & Firefox zip packages | M5 | ORIGINAL_REQUEST §R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | UI/UX & Visual Design Polish | Masthead HUD, Popup menu, Options Studio, Floating Modals, Glassmorphic tokens, ARIA attributes | none | PLANNED |
| M2 | Interactive Components & Defense Modes | Master toggle, Shorts Blocker, Clean UI (7 toggles), Focus Mode, Study Mode/Pomodoro, Goal Mode zero-bypass, Time Manager, Ghost Shield, Quick Block, Ad Skipper | M1 | PLANNED |
| M3 | Cross-Browser Compatibility & Audio DSP | Safari on macOS capability detection & warning badges, Chrome/Firefox Web Audio DSP engine (volume, bass, 10-band EQ, presets, live visualizer) | M1 | PLANNED |
| M4 | Gamification, Analytics & Storage | 22 achievement badges, Mastery Ranks (AP/EXP formulas), 24h charts, JSON/CSV backup/import, 3-tier storage cascade | M2 | PLANNED |
| M5 | Final Milestone: Full Acceptance & Hardening | Phase 1: 100% E2E test pass (Tiers 1-4). Phase 2: Adversarial coverage hardening (Tier 5 challenger suites), Forensic integrity audit, Build certification | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### Design Tokens ↔ UI Components
- `utils/design-tokens.js` exports `tokens` containing `colors`, `glass`, `typography`, `spacing`, `radii`, `shadows`, and `zIndex`.
- All CSS stylesheets (`header-button.css`, `popup.css`, `options.css`, `quick-block.css`, `clean-ui.css`) consume exact matching token variables.

### Storage ↔ Content / Popup / Options
- `StorageManager.getSettings()` / `StorageManager.saveSettings(delta)` returns Promise with merged settings schema.
- `StorageManager.getTracking()` / `StorageManager.saveTracking(delta)` returns Promise with 24h timeline and daily maps.
- `chrome.storage.onChanged` broadcasts updates across all active contexts.

### Isolated Content Scripts ↔ Main World Scripts
- CustomEvent `__SS_AUDIO_UPDATE__` dispatched on `document` with `{ detail: { volume, bass, eqGains, enabled } }`.
- CustomEvent `__SS_AUDIO_STATE__` dispatched on `document` reporting live acoustic telemetry and peak dBFS.

## Code Layout
- `background/`: Background service worker (`background.js`).
- `content/js/`: Isolated content scripts (`header-button.js`, `shorts-blocker.js`, `ui-cleaner.js`, `focus-mode.js`, `study-mode.js`, `goal-mode.js`, `time-manager.js`, `feed-controller.js`, `quick-block.js`, `ad-skipper.js`, `volume-booster.js`, `main.js`).
- `content/js/page-*.js`: Main execution world scripts (`page-ad-skipper.js`, `page-audio-dsp.js`).
- `content/css/`: Content stylesheets (`header-button.css`, `quick-block.css`, `clean-ui.css`, `hide-shorts.css`, `focus-mode.css`, `study-mode.css`).
- `popup/`: Extension popup (`popup.html`, `popup.css`, `popup.js`).
- `options/`: Options studio dashboard (`options.html`, `options.css`, `options.js`).
- `utils/`: Core utilities (`design-tokens.js`, `browser-detection.js`, `storage.js`, `time-tracker.js`, `gamification-engine.js`, `audio-engine.js`, `dom-utils.js`).
- `tests/`: 4-tier test suites (`tests/tier1/`, `tests/tier2/`, `tests/tier3/`, `tests/tier4/`, `tests/harness/`, `tests/syntax/`, challenger suites).
- `dist/`: Production extension packages (`youtube-shield-chrome.zip`, `youtube-shield-firefox.zip`).
- `scripts/`: Build and validation scripts (`validate-manifest.js`, `package-extension.js`, `clean.js`).
- `docs/`: Installation and architecture documentation (`SAFARI.md`, `ARCHITECTURE.md`).
