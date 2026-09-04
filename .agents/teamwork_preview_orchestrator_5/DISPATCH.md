# Dispatch Instructions

## 2026-08-22T10:25:41Z
You are the Project Orchestrator for the AdSkipper Robust Skip & Playback Assurance project.

Working directory for this project: /Users/shivarampatel/Desktop/shorts-shield
Your agent working directory: /Users/shivarampatel/Desktop/shorts-shield/.agents/teamwork_preview_orchestrator_5

Authoritative User Request:
Please view `/Users/shivarampatel/Desktop/shorts-shield/ORIGINAL_REQUEST.md` (and `.agents/ORIGINAL_REQUEST.md`) for the complete request history and the latest prompt under header `## 2026-08-22T10:21:11Z`.

Key Objectives & Requirements:
1. Pure Native Skip Click & Shadow DOM Interaction:
   - Target all modern (2024–2026), classic, slot, and overlay "Skip" / "Skip Ads" buttons strictly inside `#movie_player`, `.html5-video-player`, and `ytd-player`.
   - Exclude YouTube masthead, search box, profile menu, and homepage banner ads (e.g. `My Ad Center`, `ytd-banner-promo-renderer`).
   - Dispatch the full native event sequence (`pointerdown` → `mousedown` → `pointerup` → `mouseup` → `click`) directly on the skip button and container targets without altering `video.currentTime` during countdowns.

2. Active Playback Assurance & Multi-Part Ads:
   - Automatically handle sequential ads (Ad 1 of 2, Ad 2 of 2) so each ad is skipped the moment its skip button becomes active.
   - Verify playback state upon ad completion/skip: if YouTube's stream transition leaves the video paused on an ad end card or transition frame, invoke `video.play()` to ensure the user's main video continues playing seamlessly.

3. Anti-Adblock & Polymer Backdrop Isolation:
   - Auto-dismiss YouTube anti-adblock modals (`ytd-enforcement-message-view-model`) cleanly without removing or mutating YouTube's native menu backdrops (`tp-yt-iron-overlay-backdrop`).
   - Debounce console logging to guarantee zero infinite log loops.

4. Verification & Regression Protection:
   - Ensure 100% of unit, integration, and stress tests pass with 0 failures (`node run-tests.js && node tests/challenger-ad-skipper-adversarial.js`).
   - Validate that all 138+ files have 0 syntax errors or unhandled promise rejections.
