# Detailed Bug Root Causes & Architectural Analysis

> **Auditor**: Principal Software Architect & Lead Investigator  
> **Target**: GodMode Codebase Diagnostic Report

---

## Technical Root Cause Analysis Ledger

### BUG ID: BUG-001 — Ad-Blocker TOS Violation Warning Trigger
- **Observed Behavior**: YouTube displayed full-screen warning: *"Ad blockers violate YouTube's Terms of Service"*.
- **Affected Files**: [`content/js/ad-skipper.js`](file:///Users/shivarampatel/Desktop/shorts-shield/content/js/ad-skipper.js)
- **Affected Functions**: `_seekAdToEnd()`, `_applyFallbackDOMRemoval()`
- **Root Cause**: `_seekAdToEnd()` artificially forced `video.currentTime = video.duration` during unskippable ads, triggering YouTube's client-side ad-tamper detection. `_applyFallbackDOMRemoval()` set `.ytp-ad-module { display: none }`, triggering DOM manipulation detection.
- **Fix Implemented**: Replaced artificial seeking and DOM deletion with a non-intrusive pure button clicker that waits for YouTube's official "Skip Ad" button and clicks it automatically within 300ms.

---

### BUG ID: BUG-002 — Shield Popover Menu Clipping & Immediate Closing
- **Observed Behavior**: Clicking the Shield button caused the HUD popover menu to clip inside YouTube's header or open and instantly close.
- **Affected Files**: [`content/js/header-button.js`](file:///Users/shivarampatel/Desktop/shorts-shield/content/js/header-button.js), [`content/css/header-button.css`](file:///Users/shivarampatel/Desktop/shorts-shield/content/css/header-button.css)
- **Affected Functions**: `openPopup()`, `onOutsideClick(e)`, `tryInject()`
- **Root Cause**: 
  1. `ytd-masthead #buttons` container applies `overflow: hidden` / `contain: layout paint` (56px height), clipping absolutely positioned children.
  2. Trailing mouse/pointer events on YouTube Polymer topbar elements bubbled to `document`. `onOutsideClick(e)` checked `!dialog.contains(e.target)`, but Polymer node re-renders detached `e.target` from the DOM, causing `document.contains(e.target)` to evaluate as `false` and instantly call `closePopup()`.
- **Fix Implemented**: Re-anchored `.ss-popup-dialog` to `position: fixed !important; z-index: 2147483647 !important;` attached to `document.body`. Added `document.contains(e.target)` guard and `e.target.closest('#ss-header-btn-container, #ss-popup-dialog')` check in `onOutsideClick(e)`. Added pointer/mouse event propagation stopping on `#ss-header-btn`.

---

### BUG ID: BUG-003 — UI Toggle Parity in Popup Toolbar
- **Observed Behavior**: `autoSkipAds` toggle was missing from extension popup toolbar.
- **Affected Files**: [`popup/popup.html`](file:///Users/shivarampatel/Desktop/shorts-shield/popup/popup.html), [`popup/popup.js`](file:///Users/shivarampatel/Desktop/shorts-shield/popup/popup.js)
- **Root Cause**: Popup UI did not render the `autoSkipAds` row or bind event listeners to sync storage state.
- **Fix Implemented**: Added `#toggle-auto-skip-ads` markup row to `popup.html` and bound two-way storage synchronization in `popup.js`.
