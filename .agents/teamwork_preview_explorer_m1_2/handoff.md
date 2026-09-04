# M1 Explorer 2 Handoff Report: Floating Modals & Z-Index Stacking Investigation

## Summary of Core Findings
All 7 floating overlays, modals, and toasts in YouTube Shield have been thoroughly audited across `content/js/`, `content/css/`, `utils/design-tokens.js`, and test suites. The extension enforces a strictly stratified z-index hierarchy spanning from fixed masthead anchors (`z-index: 100`) to top-tier defensive blockers (`z-index: 2147483647`). All overlays implement frosted glassmorphic backdrops (`backdrop-filter: blur(16px)` to `blur(28px)`) with Obsidian color schemes (`#0b0f19` / `#0f172a`). Specific polish recommendations are provided for Worker implementation covering ARIA roles, auto-focus management, keyboard trapping, and smooth exit fade transitions.

---

## 1. Observation

### 1.1 Target Components & Architecture Inventory

| # | Component Name | DOM Selector | Primary JS File & Line Range | Stylesheet File & Line Range | Z-Index Value | Backdrop Blur Filter |
|---|---|---|---|---|---|---|
| 1 | **Goal Mode Overlay** | `#ss-goal-block-overlay` | `content/js/goal-mode.js`:355–438 | `content/css/header-button.css`:1233–1280 | `2147483647` | `blur(16px)` (inline & CSS) |
| 2 | **Time Manager Snooze Modal** | `#ss-time-manager-overlay` | `content/js/time-manager.js`:143–214 | `content/css/header-button.css`:1233–1280 | `2147483646` | `blur(16px)` (inline & CSS) |
| 3 | **Focus Reminder Modal** | `#ss-focus-reminder` | `content/js/main.js`:154–213 | `content/css/header-button.css`:1233–1280 | `2147483645` | `blur(16px)` (inline & CSS) |
| 4 | **Alignment Warning Toast** | `#ss-alignment-warning` | `content/js/study-mode.js`:636–708 | `content/js/study-mode.js`:644–663 | `10000` | `blur(16px)` (inline) |
| 5 | **Study Pomodoro Banner** | `#ss-study-banner` | `content/js/study-mode.js`:141–274 | `content/js/study-mode.js`:186–202 | `9999` | `blur(16px)` (inline) |
| 6 | **Ghost Shield Strict Block Modal** | `#ss-blocked-content-overlay` | `content/js/quick-block.js`:469–546 | `content/css/quick-block.css`:480–666 | `2147483647` | `blur(28px)` (`quick-block.css`:487) |
| 7 | **Quick Block Popover & Toast** | `#ss-quick-block-menu`, `#ss-block-toast` | `content/js/quick-block.js`:585–772, 861–931 | `content/css/quick-block.css`:74–477 | `2147483647` | `blur(24px)` popover / `blur(16px)` toast |

---

### 1.2 Deep-Dive Component Observations

#### Component 1: Goal Mode Overlay (`#ss-goal-block-overlay`)
- **Direct Observation (`content/js/goal-mode.js`:380–401)**:
  ```javascript
  const overlay = document.createElement('div');
  overlay.id = 'ss-goal-block-overlay';
  overlay.className = 'ss-overlay-backdrop';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    color: '#f8fafc',
    zIndex: '2147483647',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: '24px',
    textAlign: 'center',
    backdropFilter: 'blur(16px)',
    webkitBackdropFilter: 'blur(16px)',
    boxSizing: 'border-box'
  });
  ```
- **Modal Card Markup (`goal-mode.js`:406–430)**:
  - Inner card: `class="ss-modal-card"` with `background: rgba(15, 15, 26, 0.94); border: 1px solid rgba(99, 102, 241, 0.35); max-width: 540px; width: min(90vw, 540px); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.25); animation: ssModalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)`.
  - Buttons: `#ss-btn-search-goal` (Search keyword on YouTube) and `#ss-btn-go-home` (Return to Safe Feed).
  - Invariant: Zero-bypass invariant strictly respected — no `#ss-btn-allow-once` button is generated in DOM.
- **Teardown (`goal-mode.js`:458–463)**: Instant DOM removal via `overlay.parentNode.removeChild(overlay)`.

#### Component 2: Time Manager Snooze Modal (`#ss-time-manager-overlay`)
- **Direct Observation (`content/js/time-manager.js`:150–172)**:
  ```javascript
  const overlay = document.createElement('div');
  overlay.id = 'ss-time-manager-overlay';
  overlay.className = 'ss-overlay-backdrop';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    color: '#f8fafc',
    zIndex: '2147483646',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: '20px',
    textAlign: 'center',
    backdropFilter: 'blur(16px)',
    webkitBackdropFilter: 'blur(16px)',
    boxSizing: 'border-box'
  });
  ```
- **Modal Card Markup (`time-manager.js`:181–191)**:
  - Inner card: `class="ss-modal-card"` with `border: 1px solid rgba(168, 85, 247, 0.35); max-width: 480px; width: min(90vw, 480px)`.
  - Action button: `#ss-tm-snooze` (`+5 Min Emergency Extension`).
  - Audio alert: triggers `AudioEngine.playAlarm()` upon appearance (`time-manager.js`:146–148).

#### Component 3: Focus Reminder Modal (`#ss-focus-reminder`)
- **Direct Observation (`content/js/main.js`:158–178)**:
  ```javascript
  const overlay = document.createElement('div');
  overlay.id = 'ss-focus-reminder';
  overlay.className = 'ss-focus-reminder-backdrop';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    color: '#f8fafc',
    zIndex: '2147483645',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    backdropFilter: 'blur(16px)',
    webkitBackdropFilter: 'blur(16px)',
    boxSizing: 'border-box'
  });
  ```
- **Modal Card Markup (`main.js`:180–189)**:
  - Inner card: `class="ss-modal-card"` with `border: 1px solid rgba(99, 102, 241, 0.35); max-width: 500px; width: min(90vw, 500px)`.
  - Action buttons: `#ss-btn-continue` and `#ss-btn-break`.

#### Component 4: Alignment Warning Toast (`#ss-alignment-warning`)
- **Direct Observation (`content/js/study-mode.js`:639–663)**:
  ```javascript
  const warning = document.createElement('div');
  warning.id = 'ss-alignment-warning';
  Object.assign(warning.style, {
    position: 'fixed',
    top: '60px',
    right: '20px',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    padding: '14px 22px',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 12px 32px rgba(239, 68, 68, 0.4), 0 0 20px rgba(239, 68, 68, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    zIndex: '10000',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backdropFilter: 'blur(16px)',
    webkitBackdropFilter: 'blur(16px)',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    boxSizing: 'border-box'
  });
  ```
- **Dismissal Lifecycle (`study-mode.js`:679–696)**: Auto-dismisses after 10,000ms or on click; sets `warning.style.opacity = '0'` and unmounts after 300ms transition.

#### Component 5: Study Pomodoro Banner (`#ss-study-banner`)
- **Direct Observation (`content/js/study-mode.js`:148–202)**:
  ```javascript
  const banner = document.createElement('div');
  banner.id = 'ss-study-banner';
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    background: 'linear-gradient(90deg, #1e1b4b 0%, #312e81 50%, #1e3a8a 100%)',
    color: 'white',
    zIndex: '9999',
    padding: '7px 0',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: '14px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(16px)',
    webkitBackdropFilter: 'blur(16px)',
    transition: 'background 0.4s ease',
    boxSizing: 'border-box'
  });
  ```
- **Masthead Offset Handling (`study-mode.js`:204–220)**:
  - `ytMasthead.style.top = '36px'`
  - `document.body.style.paddingTop = '36px'`
  - `document.documentElement.style.setProperty('--ytd-masthead-height', '92px')`
  - Restored cleanly in `removeBanner()` (`study-mode.js`:319–330).

#### Component 6: Ghost Shield Strict Block Modal (`#ss-blocked-content-overlay`)
- **Direct Observation (`content/css/quick-block.css`:480–522)**:
  ```css
  .ss-blocked-content-backdrop {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    background: rgba(3, 7, 18, 0.94) !important;
    backdrop-filter: blur(28px) !important;
    -webkit-backdrop-filter: blur(28px) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 20px !important;
    box-sizing: border-box !important;
    pointer-events: auto !important;
    animation: ssBackdropFade 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
  }
  .ss-blocked-modal {
    background: radial-gradient(circle at 50% 0%, #2b1115 0%, #150d18 50%, #0b0f19 100%) !important;
    border: 1px solid rgba(239, 68, 68, 0.45) !important;
    border-radius: 24px !important;
    padding: 36px 32px !important;
    max-width: 480px !important;
    width: 100% !important;
    text-align: center !important;
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.9), 0 0 50px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
    animation: ssModalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
  }
  ```
- **Shield Glow Pulse (`quick-block.css`:547–550)**: `animation: ssShieldPulse 2.5s infinite ease-in-out !important;`.

#### Component 7: Quick Block Popover & Toast (`#ss-quick-block-menu`, `#ss-block-toast`)
- **Popover Positioning Engine (`content/js/quick-block.js`:740–766)**:
  - Dynamically calculates anchor bounding client rect.
  - Viewport-safe horizontal boundary: `leftPos = Math.max(16, winWidth - menuWidth - 16)`.
  - Viewport-safe vertical flip: flips above anchor button if `topPos + menuHeight > winHeight`.
  - Enforces `maxHeight = 'calc(100vh - 32px)'` and `overflowY = 'auto'`.
- **Floating Toast Notification (`content/css/quick-block.css`:353–455)**:
  - `bottom: 24px; left: 24px; z-index: 2147483647; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(16px);`.
  - Slide up animation: `animation: ssToastSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);`.
  - Progress bar animation: `animation: ssToastProgress 5s linear forwards;`.
  - Dynamic interactive 5-second countdown with Undo callback.

---

### 1.3 Test Suite Execution Observations
- Executed `npm test`: **522/522 test cases passed cleanly (0 errors, duration 6.7s)**.
- Executed `node tests/challenger-adversarial-hud-and-modals.js`: **101/101 empirical challenger assertions passed (0 failures)**.
- Executed `tests/tier3/study-mode-alignment-interactions.test.js`: Verified strict stacking `Study Banner (9999) < Alignment Warning (10000) < Goal Block Overlay (2147483647)`.

---

## 2. Logic Chain

1. **Z-Index Layering Integrity**:
   - The system layers UI elements into distinct non-overlapping bands:
     - In-page Masthead Elements: `100` (Pill button container) and `1000` (Tooltip).
     - Page Top Banners: `9999` (Study Pomodoro Banner) — higher than YouTube's `#masthead-container` (`z-index: 2020`), preventing YouTube header clipping.
     - Contextual Toasts / Notifications: `10000` (Alignment Warning Toast) & `10001` (Pomodoro Sprint Complete Notice).
     - User-initiated Interactive Menus & HUD: `2147483640` / `2147483647` (HUD dialog, Quick Block menu, Block toast).
     - Defensive Interception Modals: `2147483645` (Focus Reminder) < `2147483646` (Time Manager Snooze) < `2147483647` (Goal Mode & Ghost Shield).
   - This prevents lower-priority reminders from obscuring critical time limits or unskippable goal blocks.

2. **Glassmorphic Theme Conformance**:
   - Every floating modal consistently incorporates `backdrop-filter: blur(16px)` up to `blur(28px)`, with `-webkit-backdrop-filter` prefixes for WebKit/Safari compatibility.
   - Dark Obsidian backgrounds (`rgba(15, 23, 42, 0.88)` to `rgba(3, 7, 18, 0.94)`) and glowing colored accents (Indigo `#6366f1`, Purple `#a855f7`, Danger `#ef4444`, Emerald `#10b981`) adhere to `utils/design-tokens.js`.

3. **Viewport Responsiveness**:
   - Modals utilize CSS clamp logic `width: min(90vw, 540px)` with `box-sizing: border-box` and flexible button layouts (`flex-wrap: wrap`), preventing horizontal overflow on smaller screens.
   - Quick Block popover dynamically measures viewport geometry and auto-adjusts its offset, preventing cutoffs regardless of YouTube layout shifts.

4. **Identified Polish & Accessibility Opportunities**:
   - **ARIA Roles & Attributes**: Overlays currently rely on `<div>` tags without `role="dialog"` or `role="alertdialog"`, `aria-modal="true"`, or `aria-labelledby`.
   - **Focus Management**: Focus is not explicitly transferred into modals when opened (e.g., auto-focusing `#ss-btn-search-goal` or `#ss-tm-snooze`).
   - **Exit Transitions**: Overlays detach immediately from the DOM on close rather than running a brief (150–200ms) fade/scale-out transition (except `#ss-alignment-warning` and `#ss-pomo-notice` which already have 300ms fade-outs).

---

## 3. Caveats

1. **Strict Zero-Bypass Constraint**: Goal Mode and Ghost Shield strict modals intentionally do not dismiss upon `Escape` key press. This is a functional requirement to prevent users from bypassing focus mode, not an accessibility defect. However, Tab-focus cycling should remain trapped within the permitted action buttons.
2. **Design Tokens File Parity**: `utils/design-tokens.js` lists `studyBanner: 2147483642`, whereas `study-mode.js` and all test suites explicitly use and verify `zIndex: '9999'`. The Worker should consider updating `design-tokens.js` to align with the actual tested code (`studyBanner: 9999`, `alignmentWarning: 10000`, `pomoNotice: 10001`).
3. **YouTube CSS Overrides**: On YouTube watch pages with Polymer/Lit Web Components, `!important` flags are essential to prevent native YouTube CSS rules from overriding modal backdrops.

---

## 4. Conclusion & Polish Recommendations for Worker Implementation

### Actionable Polish Checklist for Worker:

1. **Enhance ARIA & Accessibility Semantics**:
   - In `content/js/goal-mode.js`: Add `overlay.setAttribute('role', 'alertdialog')`, `overlay.setAttribute('aria-modal', 'true')`, and add `id="ss-goal-heading"` to `<h1>`.
   - In `content/js/time-manager.js`: Add `overlay.setAttribute('role', 'alertdialog')`, `overlay.setAttribute('aria-modal', 'true')`.
   - In `content/js/main.js`: Add `overlay.setAttribute('role', 'dialog')`, `overlay.setAttribute('aria-modal', 'true')`.
   - In `content/js/quick-block.js`: Add `role="dialog"` and `aria-label="Quick Block Shield"` to `#ss-quick-block-menu`; add `role="status"` / `aria-live="polite"` to `#ss-block-toast`.
   - In `content/js/study-mode.js`: Add `aria-label` attributes to Pomodoro banner control buttons (`#ss-pomo-btn-pause`, `#ss-pomo-btn-skip`, `#ss-pomo-btn-reset`, `#ss-banner-shield-btn`) and add `role="timer"` to `#ss-pomo-timer`.

2. **Implement Modal Focus Transfer**:
   - In `goal-mode.js`: Call `const searchBtn = overlay.querySelector('#ss-btn-search-goal'); if (searchBtn) searchBtn.focus();` after appending overlay.
   - In `time-manager.js`: Call `snoozeBtn.focus();` after appending overlay.
   - In `main.js`: Call `continueBtn.focus();` after appending overlay.
   - In `quick-block.js`: Call `homeBtn.focus();` inside `renderBlockedOverlay`.

3. **Smooth Exit Transition Handling**:
   - Define a shared `@keyframes ssModalScaleOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }` in `content/css/header-button.css`.
   - Add a 150ms fade-out helper in `removeOverlay()` before removing DOM elements.

4. **Align `utils/design-tokens.js`**:
   - Update `zIndex` in `utils/design-tokens.js`:
     ```javascript
     zIndex: {
       base: 1,
       dropdown: 10,
       header: 100,
       sticky: 200,
       tooltip: 1000,
       studyBanner: 9999,
       alignmentWarning: 10000,
       pomoNotice: 10001,
       hud: 2147483640,
       focusReminder: 2147483645,
       timeManagerModal: 2147483646,
       goalModeModal: 2147483647,
       modalBackdrop: 2147483646,
       modal: 2147483647,
       overlay: 2147483647
     }
     ```

---

## 5. Verification Method

To independently verify all observations and conclusions:

1. **Execute Master Test Suite**:
   ```bash
   npm test
   ```
   *Expected Result*: All 522 tests across Tiers 1–4 pass with 0 errors.

2. **Execute HUD and Modals Challenger Suite**:
   ```bash
   node tests/challenger-adversarial-hud-and-modals.js
   ```
   *Expected Result*: 101/101 assertions pass, validating:
   - `#ss-goal-block-overlay` has z-index `2147483647`
   - `#ss-time-manager-overlay` has z-index `2147483646`
   - `#ss-focus-reminder` has z-index `2147483645`
   - `#ss-alignment-warning` has z-index `10000`
   - `#ss-study-banner` has z-index `9999`
   - All frosted glass backdrop filters (`blur(16px)`+) are verified
   - All button callbacks and lifecycles trigger without throwing errors.

3. **Execute Design Tokens Stress Suite**:
   ```bash
   node tests/challenger-m1-design-tokens-stress.js
   ```
   *Expected Result*: All token format, CSS custom property, and layer assertions pass cleanly.

4. **Invalidation Conditions**:
   - Any test failure in `npm test` or challenger suites.
   - Any z-index collision where a lower-tier notification overlaps an active strict modal.
   - Any missing backdrop filter property on Chrome, Firefox, or Safari WebKit.
