## 2026-08-14T05:53:51Z
You are the Project Orchestrator for the GodMode Chrome Extension project.

Your working directory is: `/Users/shivarampatel/Desktop/shorts-shield/.agents/orchestrator_fix`
The authoritative user request is in: `/Users/shivarampatel/Desktop/shorts-shield/ORIGINAL_REQUEST.md` (and `.agents/ORIGINAL_REQUEST.md`).

## Mission & Scope
Fix two categories of Chrome extension errors in the GodMode extension at `/Users/shivarampatel/Desktop/shorts-shield`:

### R1. Fix `EQ_PRESETS` Duplicate Declaration SyntaxError
- Search ALL content scripts listed in `manifest.json` `content_scripts[].js` for ANY declaration of `EQ_PRESETS` or `EQ_FREQUENCIES` (const, let, or var).
- The ONLY authoritative declaration must be in `utils/audio-engine.js` as `const EQ_PRESETS`.
- `utils/audio-engine.js` must also set `window._SS_EQ_PRESETS = EQ_PRESETS` immediately after the declaration so other scripts can reference it via `window._SS_EQ_PRESETS`.
- All other content scripts (`content/js/header-button.js`, `content/js/volume-booster.js`, and any others) must NOT declare `EQ_PRESETS` or `EQ_FREQUENCIES` at any scope level — they must reference `window._SS_EQ_PRESETS` directly in code where needed.
- Verify: `grep -rn "const EQ_PRESETS\|let EQ_PRESETS\|var EQ_PRESETS" content/ utils/` must ONLY match `utils/audio-engine.js`.

### R2. Fix Deprecated `orient="vertical"` / `slider-vertical` CSS Warning
- Find ALL `<input type="range">` elements with `orient="vertical"` attribute in ALL HTML files (`popup/popup.html`, `options/options.html`, any others).
- Remove `orient="vertical"` attribute from every such input.
- Add `writing-mode: vertical-lr; direction: rtl;` to their inline `style` attribute (or append to existing style).
- Find and remove any CSS rule containing `-webkit-appearance: slider-vertical` or `appearance: slider-vertical` in ALL CSS files.
- Verify: `grep -rn "orient=\"vertical\"\|slider-vertical" popup/ options/ content/` must return ZERO matches.

### R3. Run Full Test Suite and Syntax Verification
- Run `node -c` on ALL JavaScript files to verify zero syntax errors.
- Run `npm test` to verify all tests continue to pass (331/331 or more tests passing).

Please decompose into milestones, dispatch to workers/specialists, maintain your `BRIEFING.md` and `progress.md` in your working directory (`/Users/shivarampatel/Desktop/shorts-shield/.agents/orchestrator_fix`), and report when all milestones are complete so that Victory Audit can be initiated.
