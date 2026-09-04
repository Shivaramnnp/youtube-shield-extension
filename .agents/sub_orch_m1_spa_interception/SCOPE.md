# Scope: Milestone 1 — Content-Script Level Shorts & Playables URL Interception

## Objective
Implement immediate, synchronous content-script level interception and instant redirection for `/shorts/` and `/playables/` URLs on YouTube to handle Safari SPA navigation where background webNavigation events fail or lag.

## Target Files
- `content/js/shorts-blocker.js`
- `content/js/main.js`

## Technical Requirements
1. **Synchronous Immediate URL Check**: Run URL check synchronously at `document_start` before waiting for async IPC settings resolution.
2. **Early SPA Event Hooks**: Listen to YouTube SPA events (`yt-navigate-start`, `yt-navigate-finish`, `yt-page-data-updated`, `yt-page-type-changed`) and standard HTML5 events (`popstate`, `hashchange`).
3. **Monkey-Patch History API**: Override `history.pushState` and `history.replaceState` to intercept SPA route changes at the microsecond level.
4. **Expanded Matching Pattern**: Update regex to `/(?:^|\/)(shorts|playables)(?:[\/\?#]|$)/i` to reliably catch `youtube.com/shorts`, `youtube.com/shorts/`, `youtube.com/playables`, etc.
5. **Redirection Logic**: Instantly redirect matching URLs to `https://www.youtube.com/` using `window.location.replace()`.
6. **Fallback Polling**: Reduce backup polling timer interval to 100ms.

## References
- Global project plan: `/Users/shivarampatel/Desktop/shorts-shield/PROJECT.md`
- Survey analysis report: `/Users/shivarampatel/Desktop/shorts-shield/.agents/explorer_survey_1/analysis.md`
- Original request: `/Users/shivarampatel/Desktop/shorts-shield/.agents/ORIGINAL_REQUEST.md`

## Workflow Protocol
Execute iteration loop: Explorer -> Worker -> Reviewer -> Challenger -> Forensic Auditor -> Gate check (`GATE_STATUS.md`).
All subagents must verify `node -c` syntax checks pass.
Auditor must return CLEAN verdict.
