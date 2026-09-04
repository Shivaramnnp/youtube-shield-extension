# Project: GodMode Chrome Extension Fixes

## Architecture
The GodMode Chrome Extension comprises:
- `manifest.json`: Defines extension metadata, background service workers, and content script injection order.
- `utils/`: Shared utilities including `audio-engine.js`, `storage.js`, etc.
- `content/`: Content scripts injected into YouTube/web pages (`header-button.js`, `volume-booster.js`, etc.) and CSS styling (`content.css`, `header-button.css`, etc.).
- `popup/` and `options/`: Extension UI (HTML/JS/CSS) for configuration, audio equalizer controls, and settings.
- `tests/`: Automated unit & integration test suite executed via Jest / Node test runner.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Deduplicate EQ_PRESETS | Single declaration in `utils/audio-engine.js` as `const EQ_PRESETS`, expose `window._SS_EQ_PRESETS = EQ_PRESETS`, remove declarations in all other content scripts and replace with `window._SS_EQ_PRESETS` | M1 | User Request R1 |
| 2 | Deprecate `orient="vertical"` & `slider-vertical` | Remove `orient="vertical"` from all HTML range inputs, add `writing-mode: vertical-lr; direction: rtl;` inline style, remove `-webkit-appearance: slider-vertical` & `appearance: slider-vertical` CSS rules | M2 | User Request R2 |
| 3 | Full Syntax & Test Verification | Validate zero syntax errors across all JS files with `node -c` and verify all tests pass with `npm test` (>= 331 tests) | M3 | User Request R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | EQ_PRESETS Deduplication | `utils/audio-engine.js`, `content/js/*`, all content scripts in manifest | none | DONE |
| 2 | Vertical Slider Modernization | `popup/popup.html`, `options/options.html`, all HTML/CSS files | none | DONE |
| 3 | Verification & Auditing | `node -c` all JS, `npm test`, forensic integrity audit | M1, M2 | DONE |

## Interface Contracts
### Audio Engine ↔ Content Scripts
- `utils/audio-engine.js`: Declares `const EQ_PRESETS = ...; window._SS_EQ_PRESETS = EQ_PRESETS;`
- Consumers (`header-button.js`, `volume-booster.js`, etc.): MUST NOT declare `EQ_PRESETS` or `EQ_FREQUENCIES`. Access via `window._SS_EQ_PRESETS` (with safe fallback if needed).

### Equalizer Slider UI
- All vertical sliders in HTML: `<input type="range" ... style="writing-mode: vertical-lr; direction: rtl; ...">` without `orient="vertical"`.
- CSS files: No `-webkit-appearance: slider-vertical` or `appearance: slider-vertical`.

## Code Layout
- `utils/audio-engine.js`: Authoritative audio DSP & EQ preset definitions.
- `content/js/`: Injected page scripts.
- `popup/`, `options/`: Extension popups and settings pages.
- `tests/`: Test files.
