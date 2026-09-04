# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-23

### Added
- **Initial Production Release of YouTube Shield**: Complete UI overhaul with glassmorphism design, Obsidian dark theme, and unified header HUD button.
- **Studio Web Audio DSP & 10-Band Graphic Equalizer**:
  - 10-Band EQ (32Hz to 16kHz) with ±12dB precision control and 8 curated presets (Bass Boost, Vocal, Treble, Rock, Pop, etc.).
  - 600% Volume Booster (6x gain) and dedicated +20dB Bass Subsystem.
  - Live animated FFT audio visualizer across popup and options pages.
- **Native MAIN-World Auto Ad Skipper**:
  - Dual-world execution architecture (`page-ad-skipper.js` in MAIN world).
  - 16x ad stream acceleration and instant native event dispatch on skip buttons.
  - Active Playback Assurance (`video.play()`) preventing stalled transitions.
- **Time Manager & Scheduled Browsing**:
  - Daily watch budget enforcement with emergency "+5 Min Snooze" option.
  - Scheduled browsing restriction hours.
- **Study Mode & Built-in Pomodoro Engine**:
  - Sticky top floating status banner above the video player.
  - Built-in 25-min focus, 5-min short break, and 15-min long break timer cycles.
  - AI content alignment detection and warning modals.
- **RPG Gamification & Mastery Ranks**:
  - Action Points (AP) system, EXP calculations, daily streaks, and 6 rank tiers.
  - 22 unlockable achievement badges.
- **Scope Expansion**:
  - Support for YouTube Music (`music.youtube.com`) audio equalization and volume boost.
  - Support for embedded YouTube players (`youtube.com/embed/*` and `youtube-nocookie.com`).
- **Internationalization (i18n)**:
  - 7 language locale packages (`en`, `es`, `hi`, `de`, `ja`, `fr`, `pt`).
- **Keyboard Accessibility**:
  - Global hotkeys (`Alt+Shift+S`, `Alt+Shift+Y`, `Alt+Shift+B`) registered in manifest and background worker.
- **Store Publishing & CI/CD**:
  - `PRIVACY.md`, `TERMS.md`, and `LISTING_METADATA.md`.
  - Multi-resolution icons (`16x16`, `32x32`, `48x48`, `128x128`, `512x512`).
  - Automated packaging script (`npm run package`) and GitHub Actions CI/CD workflows.

## [1.0.0] - 2026-06-19
### Added
- **Shorts Blocker**: Completely blocks YouTube Shorts from the homepage, sidebar, and search results using highly efficient CSS injections and localized `MutationObserver` logic.
- **SPA Redirection**: Automatically intercepts and redirects `/shorts/*` URLs back to the homepage without requiring full page reloads.
- **Focus Mode**: Hides distracting UI elements such as comments, related videos, live chat, and the notification bell.
- **Study Mode**: Displays a customizable learning goal banner.
- **Watch-Time Tracking**: Accurately tracks intentional learning time by measuring active `<video>` element play state and tab visibility.
- **Mindfulness Reminders**: Customizable full-screen prompts to ask users if they are still watching intentionally.
- **Settings Dashboard**: Premium UI dashboard for configuring all extension preferences.
- **Privacy-First Architecture**: Fully local storage (`chrome.storage.local` and `chrome.storage.sync`) with zero telemetry or tracking.
