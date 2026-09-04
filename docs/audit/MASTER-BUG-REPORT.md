# Master Bug Report & Remediation Ledger

> **Auditor**: QA Commander & Principal Auditor  
> **Target**: GodMode Repository Audit Ledger

---

## Verified Bug Findings & Remediation Details

### Bug ID: BUG-001
- **Severity**: `P0 — Critical`
- **Category**: Functional / Compliance
- **File**: `content/js/ad-skipper.js`
- **Problem**: Artificial `video.currentTime` manipulation and DOM element removal triggered YouTube's anti-adblocker enforcement warning ("Ad blockers violate YouTube's Terms of Service").
- **Root Cause**: `_seekAdToEnd()` forced `video.currentTime = video.duration`, which is detected by YouTube player anti-tamper heuristics as programmatic stream skipping.
- **Fix**: Replaced media seek and DOM deletion with a pure, non-intrusive button clicker that waits for the official YouTube "Skip Ad" button to become active, skips countdown states, and dispatches native click events.
- **Verification**: Master test suite passes all ad-skipper tests; zero anti-adblock warnings triggered.
- **Status**: FIXED & VERIFIED.

### Bug ID: BUG-002
- **Severity**: `P1 — High`
- **Category**: UI / UX
- **File**: `content/js/header-button.js` & `content/css/header-button.css`
- **Problem**: Shield button popover menu was clipped inside YouTube masthead or opened and immediately closed.
- **Root Cause**: `ytd-masthead #buttons` applies `overflow: hidden` and `contain: layout paint`. Detached DOM nodes during Polymer re-renders triggered false outside click dismissals.
- **Fix**: Switched `.ss-popup-dialog` to `position: fixed !important; z-index: 2147483647 !important;` mounted on `document.body` with dynamic position coordinates and added `document.contains(e.target)` guard.
- **Verification**: `challenger-adversarial-hud-and-modals.js` passed all 99 assertions.
- **Status**: FIXED & VERIFIED.

### Bug ID: BUG-003
- **Severity**: `P2 — Medium`
- **Category**: UI Parity
- **File**: `popup/popup.html` & `popup/popup.js`
- **Problem**: `autoSkipAds` toggle was present in HUD popover and Options page, but missing from extension toolbar popup.
- **Fix**: Added `#toggle-auto-skip-ads` switch row to `popup.html` and wired two-way storage synchronization in `popup.js`.
- **Verification**: Storage sync verified across popup, HUD, and options.
- **Status**: FIXED & VERIFIED.

### Bug ID: BUG-004
- **Severity**: `P3 — Low`
- **Category**: Data Sanitation
- **File**: `utils/storage.js`
- **Problem**: YouTube channel names scraped from DOM sometimes contained duplicate tokens (e.g. "Firstpost Firstpost") or tooltip text.
- **Fix**: Implemented `cleanChannelName()` and `migrateTimelineLog()` in `utils/storage.js` to normalize channel strings and deduplicate consecutive timeline events.
- **Verification**: Tested across all timeline log test suites.
- **Status**: FIXED & VERIFIED.