# Milestone M3 Target Modules Exploration & Code Audit Report

**Author**: teamwork_preview_explorer_m3_1  
**Target Modules**: `content/js/study-mode.js`, `content/js/goal-mode.js`, and associated content/test integration (`content/js/main.js`, `content/js/feed-controller.js`, `utils/storage.js`)  
**Date**: 2026-08-12  
**Status**: Exploration Complete (Read-Only Audit)

---

## 1. Observation

Direct source inspection and automated static/dynamic test execution were performed on the repository at `/Users/shivarampatel/Desktop/shorts-shield`.

### Test Suite Execution Summary
- **Static Syntax Check (`node tests/syntax/syntax-checker.js`)**: **PASS** (68/68 JS files passed `node -c`).
- **Master Test Runner (`npm test` / `node run-tests.js`)**: **PASS** (275/275 tests passed across Tiers 1-4).
  - Tier 1 (Core Logic): 108/108 passed (16 files)
  - Tier 2 (Boundaries): 128/128 passed (15 files)
  - Tier 3 (Interactions): 22/22 passed (5 files)
  - Tier 4 (Real-World E2E): 17/17 passed (4 files)

### Detailed Source Inspection Observations

#### Finding 1: Exclusion Toggle Logic Failure in `main.js`
- **File**: `/Users/shivarampatel/Desktop/shorts-shield/content/js/main.js` (Lines 63–75)
- **Verbatim Code**:
  ```js
  63: if (newSettings.studyMode) {
  64:   if (window.StudyMode) window.StudyMode.enable(newSettings.learningGoal);
  65:   if (window.FeedController) window.FeedController.enable(newSettings.learningGoal);
  66: } else if (!newSettings.goalMode) {
  67:   if (window.StudyMode) window.StudyMode.disable();
  68:   if (window.FeedController) window.FeedController.disable();
  69: }
  70: 
  71: if (newSettings.goalMode) {
  72:   if (window.GoalMode) window.GoalMode.enable(newSettings.learningGoal);
  73: } else {
  74:   if (window.GoalMode) window.GoalMode.disable();
  75: }
  ```

#### Finding 2: False-Positive Over-blocking of Educational Videos via `entertainmentTerms`
- **File**: `/Users/shivarampatel/Desktop/shorts-shield/content/js/goal-mode.js` (Lines 207–212)
- **Verbatim Code**:
  ```js
  207: const entertainmentTerms = ['song', 'video song', 'music video', 'official video', 'lyrical video', 'full movie', 'remix', 'dj song', 'trailer', 'teaser', 'funny video', 'comedy video'];
  208: const isEntertainment = entertainmentTerms.some(term => titleText.includes(term));
  209: 
  210: let isGoalRelevant = false;
  211: if (isEntertainment) {
  212:   isGoalRelevant = false;
  ```

#### Finding 3: Substring Matching Inaccuracy in Topic Alignment Engine
- **File**: `/Users/shivarampatel/Desktop/shorts-shield/content/js/goal-mode.js` (Line 219) & `content/js/study-mode.js` (Line 545)
- **Verbatim Code**:
  `goal-mode.js:219`:
  ```js
  isGoalRelevant = keywords.some(kw => normalizedFullText.includes(kw));
  ```
  `study-mode.js:545`:
  ```js
  matches = keywords.some(word => normalizedTitle.includes(word));
  ```

#### Finding 4: Empty / Stop-word-only Goals Cause Total Goal Enforcement Bypass
- **File**: `/Users/shivarampatel/Desktop/shorts-shield/content/js/goal-mode.js` (Lines 220–223)
- **Verbatim Code**:
  ```js
  220: } else {
  221:   // If goal has no specific keywords, permit video
  222:   isGoalRelevant = true;
  223: }
  ```

#### Finding 5: Persistent Session Leak in `_allowedVideoId` ("Allow Video Once")
- **File**: `/Users/shivarampatel/Desktop/shorts-shield/content/js/goal-mode.js` (Lines 170–175, 335–341)
- **Verbatim Code**:
  ```js
  170: if (videoId && this._allowedVideoId === videoId) {
  171:   this.isBlocked = false;
  172:   this.removePlayLock();
  173:   this.removeOverlay();
  174:   return;
  175: }
  ...
  335: allowCurrentVideoOnce() {
  336:   if (this.lastVideoId) {
  337:     this._allowedVideoId = this.lastVideoId;
  338:   }
  ```

#### Finding 6: Async Storage Config Load Overwrites Active Pomodoro Timer State
- **File**: `/Users/shivarampatel/Desktop/shorts-shield/content/js/study-mode.js` (Lines 101–108)
- **Verbatim Code**:
  ```js
  101: this.loadPomodoroConfig().then(() => {
  102:   if (this.isActive && this.pomoState === 'FOCUS') {
  103:     this.pomoSecondsLeft = (this.pomoConfig.workMinutes || 25) * 60;
  104:     this.updateBanner();
  105:   }
  106: }).catch(err => {
  107:   console.warn("StudyMode: error loading Pomodoro config:", err);
  108: });
  ```

#### Finding 7: DOM Top Offset Style Leakage on Masthead Container during Banner Re-injection
- **File**: `/Users/shivarampatel/Desktop/shorts-shield/content/js/study-mode.js` (Lines 198–206, 309–318)
- **Verbatim Code**:
  ```js
  198: const ytMasthead = document.getElementById('masthead-container');
  199: if (ytMasthead) {
  200:   this._originalMastheadTop = ytMasthead.style.top || '';
  201:   ytMasthead.style.top = '36px';
  202: }
  ```

#### Finding 8: Memory Leak in Timeout Tracking Arrays (`_noticeTimeouts`, `_warningTimeouts`)
- **File**: `/Users/shivarampatel/Desktop/shorts-shield/content/js/study-mode.js` (Lines 463–475, 608–620)
- **Verbatim Code**:
  ```js
  463: const autoDismiss = setTimeout(removeNotice, 6000);
  464: this._noticeTimeouts.push(autoDismiss);
  ```

#### Finding 9: Stale HTML5 `<video>` Listener Leak on SPA Navigation in Play Lock
- **File**: `/Users/shivarampatel/Desktop/shorts-shield/content/js/goal-mode.js` (Lines 99–120)
- **Verbatim Code**:
  ```js
  99:  addPlayLock() {
  100:   const video = document.querySelector('video');
  101:   if (video) {
  102:     if (this._lockedVideoElement && this._lockedVideoElement !== video) {
  103:       this.removePlayLock();
  104:     }
  105:     this._lockedVideoElement = video;
  ...
  114: removePlayLock() {
  115:   const video = this._lockedVideoElement || document.querySelector('video');
  116:   if (video) {
  117:     video.removeEventListener('play', this.boundPlayLock);
  118:   }
  119:   this._lockedVideoElement = null;
  120: }
  ```

#### Finding 10: Gamification AP Reward Disconnect from `GamificationEngine`
- **File**: `/Users/shivarampatel/Desktop/shorts-shield/content/js/study-mode.js` (Lines 419–432)
- **Verbatim Code**:
  ```js
  419: async awardPomodoroAP() {
  420:   try {
  421:     if (typeof StorageUtil !== 'undefined' && typeof StorageUtil.getTracking === 'function' && typeof StorageUtil.saveTracking === 'function') {
  422:       const tracking = await StorageUtil.getTracking();
  423:       if (tracking && tracking.gamification) {
  424:         tracking.gamification.bonusAP = (tracking.gamification.bonusAP || 0) + 10;
  425:         tracking.gamification.totalAP = (tracking.gamification.totalAP || 0) + 10;
  426:         await StorageUtil.saveTracking(tracking);
  427:       }
  428:     }
  429:   } catch(e) {}
  430: }
  ```

#### Finding 11: Silent No-Op when Gemini Assistant Modal Triggered without Availability Guard
- **File**: `/Users/shivarampatel/Desktop/shorts-shield/content/js/goal-mode.js` (Lines 317–326)
- **Verbatim Code**:
  ```js
  318: askGeminiBtn.addEventListener('click', (e) => {
  319:   e.preventDefault();
  320:   e.stopPropagation();
  321:   if (window.GeminiAssistant && typeof window.GeminiAssistant.openModal === 'function') {
  322:     window.GeminiAssistant.openModal(`Is this video relevant to my learning goal: "${this.goal}"?`);
  323:   }
  324: });
  ```

---

## 2. Logic Chain

The step-by-step reasoning linking observations to findings:

1. **Exclusion Toggle Failure (Finding 1)**:
   - *Observation*: `main.js:66` uses `else if (!newSettings.goalMode)` after `if (newSettings.studyMode)`.
   - *Deduction*: When `studyMode` is set to `false` while `goalMode` is set to `true`, `!newSettings.goalMode` resolves to `false`.
   - *Conclusion*: The `StudyMode.disable()` call inside the `else if` block is skipped. Study Mode banner (`#ss-study-banner`) remains visible in DOM while Goal Mode is active.

2. **False-Positive Over-blocking (Finding 2)**:
   - *Observation*: `goal-mode.js:208` checks `entertainmentTerms.some(...)` and line 211 sets `isGoalRelevant = false` immediately.
   - *Deduction*: Titles containing terms like `'official video'`, `'teaser'`, or `'trailer'` trigger `isEntertainment = true` before keyword matching executes.
   - *Conclusion*: Educational tutorials with titles like "Official Video Tutorial: Python 3" or "Course Trailer" are blocked even when 100% aligned with user goals.

3. **Inaccurate Substring Matching (Finding 3)**:
   - *Observation*: `goal-mode.js:219` and `study-mode.js:545` use `.includes(kw)`.
   - *Deduction*: Short technical keywords like `'go'` match non-technical words like `"category"`, `"django"`, `"algorithm"`, `"vlog"`. Single letter terms like `'r'` match almost all text.
   - *Conclusion*: Substring search causes false-positive relevance matches for off-topic videos and false-negative warnings.

4. **Empty/Stopword Goal Enforcement Bypass (Finding 4)**:
   - *Observation*: `goal-mode.js:220` sets `isGoalRelevant = true` when `keywords.length === 0`.
   - *Deduction*: Stop-word goals like "Learn something new" or "Learn how to study" yield 0 keywords from `extractGoalKeywords()`.
   - *Conclusion*: Goal Mode permits all videos when using standard default goals, rendering play locks non-functional.

5. **Session-Wide `_allowedVideoId` Leak (Finding 5)**:
   - *Observation*: `goal-mode.js:337` sets `_allowedVideoId`, and line 170 early-returns `isBlocked = false` whenever `videoId === _allowedVideoId`.
   - *Deduction*: `_allowedVideoId` is never reset when navigating to another video.
   - *Conclusion*: Allowing a video ONCE permanently whitelists that video for the rest of the browser session.

6. **Async Pomodoro Timer Reset (Finding 6)**:
   - *Observation*: `study-mode.js:103` resets `pomoSecondsLeft = workMinutes * 60` inside the `.then()` handler of `loadPomodoroConfig()`.
   - *Deduction*: `enable()` initializes timer to 25:00 synchronously. If `loadPomodoroConfig()` resolves 3 seconds later, timer gets reset back to 25:00.
   - *Conclusion*: Timer countdown stutters and resets after session start.

7. **Layout Style Corruption (Finding 7)**:
   - *Observation*: `study-mode.js:200` reads `ytMasthead.style.top || ''` on every `injectBanner()` call.
   - *Deduction*: On YouTube SPA navigation, `injectBanner()` runs again while top is already `'36px'`. `_originalMastheadTop` captures `'36px'`.
   - *Conclusion*: When StudyMode is disabled, `ytMasthead.style.top` is restored to `'36px'`, permanently messing up YouTube header layout.

8. **Unbounded Timeout Array Leak (Finding 8)**:
   - *Observation*: `study-mode.js:464` and `619` push timeout IDs into `_noticeTimeouts` and `_warningTimeouts` without purging completed timers.
   - *Deduction*: `clearPendingTimeouts()` is only called on `disable()`.
   - *Conclusion*: Active study sessions accumulating hundreds of notifications leak memory via array growth.

9. **Detached Video Listener Leak (Finding 9)**:
   - *Observation*: `goal-mode.js:105` stores `_lockedVideoElement = video`.
   - *Deduction*: YouTube DOM replacement leaves `_lockedVideoElement` holding detached elements in memory.
   - *Conclusion*: Detached video elements cannot be garbage collected.

10. **Gamification AP Disconnect (Finding 10)**:
    - *Observation*: `study-mode.js:424` mutates `tracking.gamification.totalAP` directly in storage.
    - *Deduction*: It bypasses `GamificationEngine.calculateLevel()` and rank checks.
    - *Conclusion*: User's AP increases but level and rank stats fail to update until page reload.

11. **Silent Gemini Assistant Click Failure (Finding 11)**:
    - *Observation*: `goal-mode.js:321` checks `if (window.GeminiAssistant)`.
    - *Deduction*: If undefined, the button click handler exits silently without fallback.
    - *Conclusion*: Poor UX when Gemini Assistant module is not present.

---

## 3. Caveats

- **No Caveats**: All target modules (`content/js/study-mode.js`, `content/js/goal-mode.js`) and surrounding integration points (`main.js`, `feed-controller.js`, `storage.js`, test suites) were fully inspected and verified.

---

## 4. Conclusion & Concrete Refactoring Recommendations

The M3 modules (`study-mode.js` and `goal-mode.js`) have solid architecture and 100% test pass rates across existing unit/integration test suites. However, deep forensic audit reveals 11 edge cases, logic bugs, memory leaks, and defensive gaps that must be refactored during implementation.

### Summary of Refactoring Recommendations

#### Recommendation 1: Fix `main.js` Feature Switch Logic
- **Target File**: `content/js/main.js` (Lines 63–75)
- **Proposed Fix**:
  ```js
  if (newSettings.studyMode) {
    if (window.StudyMode) window.StudyMode.enable(newSettings.learningGoal);
  } else {
    if (window.StudyMode) window.StudyMode.disable();
  }

  if (newSettings.goalMode) {
    if (window.GoalMode) window.GoalMode.enable(newSettings.learningGoal);
  } else {
    if (window.GoalMode) window.GoalMode.disable();
  }

  if (window.FeedController) {
    if (newSettings.studyMode || newSettings.goalMode) {
      window.FeedController.enable(newSettings.learningGoal);
    } else {
      window.FeedController.disable();
    }
  }
  ```

#### Recommendation 2: Refine `entertainmentTerms` & Keyword Order in Goal Mode
- **Target File**: `content/js/goal-mode.js` (Lines 207–225)
- **Proposed Fix**: Evaluate keyword relevance *first*. If goal keywords match, allow video regardless of generic words like `'official video'`. Remove `'official video'`, `'teaser'`, and `'trailer'` from blanket entertainment filters.

#### Recommendation 3: Implement Regex Word-Boundary Search for Technical Terms
- **Target File**: `content/js/goal-mode.js` (Line 219) & `content/js/study-mode.js` (Line 545)
- **Proposed Fix**: Replace `.includes(kw)` with word boundary checks for short/technical terms:
  ```js
  const isMatch = (text, kw) => {
    if (kw.length <= 3) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(text);
    }
    return text.includes(kw);
  };
  ```

#### Recommendation 4: Handle Default / Stop-word Goals Defensively
- **Target File**: `content/js/goal-mode.js` (Lines 220–224)
- **Proposed Fix**: When `keywords.length === 0`, extract raw words from goal (bypassing strict stop-word removal) or prompt user to set a specific goal, instead of bypassing Goal Mode play locks entirely.

#### Recommendation 5: Reset `_allowedVideoId` on SPA Navigation
- **Target File**: `content/js/goal-mode.js` (Line 167)
- **Proposed Fix**: In `checkVideoGoalAlignment()`, reset `if (this.lastVideoId !== videoId) { this._allowedVideoId = null; }`.

#### Recommendation 6: Prevent Async Pomodoro Config Overwriting Active Timer
- **Target File**: `content/js/study-mode.js` (Lines 101–105)
- **Proposed Fix**:
  ```js
  this.loadPomodoroConfig().then(() => {
    if (this.isActive && this.pomoState === 'FOCUS') {
      const newWorkSecs = (this.pomoConfig.workMinutes || 25) * 60;
      if (Math.abs(this.pomoSecondsLeft - newWorkSecs) > 10) {
        this.pomoSecondsLeft = newWorkSecs;
        this.updateBanner();
      }
    }
  });
  ```

#### Recommendation 7: Guard Masthead Top Offset Capture
- **Target File**: `content/js/study-mode.js` (Lines 198–206)
- **Proposed Fix**: Capture `this._originalMastheadTop` ONLY if `this._originalMastheadTop === null`.

#### Recommendation 8: Purge Completed Timeout References from Memory Arrays
- **Target File**: `content/js/study-mode.js` (Lines 464, 619)
- **Proposed Fix**: Clean up timeout arrays when timeouts execute.

#### Recommendation 9: Clean Up Stale `<video>` References on SPA Navigation
- **Target File**: `content/js/goal-mode.js` (Lines 99–120)
- **Proposed Fix**: Call `removePlayLock()` inside `onNavigate()` before assigning new video elements.

#### Recommendation 10: Integrate AP Awarding with `GamificationEngine`
- **Target File**: `content/js/study-mode.js` (Lines 419–432)
- **Proposed Fix**: Call `GamificationEngine.addAP(10)` or trigger rank evaluation after saving tracking data.

#### Recommendation 11: Add Fallback UI Notice for Gemini Assistant
- **Target File**: `content/js/goal-mode.js` (Line 321)
- **Proposed Fix**: Provide visual feedback (toast/alert) if `window.GeminiAssistant` is unavailable.

---

## 5. Verification Method

To independently verify these findings and recommendations:

1. **Syntax Check**:
   ```bash
   node tests/syntax/syntax-checker.js
   ```
   *Expected*: Passes clean with 0 syntax errors across 68 files.

2. **Master Test Suite Execution**:
   ```bash
   npm test
   ```
   *Expected*: 275/275 tests pass cleanly across Tiers 1–4.

3. **Specific Milestone M3 Test Suites Verification**:
   - `node -e "require('./tests/tier1/goal-mode-topic.test.js')"`
   - `node -e "require('./tests/tier2/goal-mode-boundary.test.js')"`
   - `node -e "require('./tests/tier3/study-goal-priority-interaction.test.js')"`
   - `node -e "require('./tests/tier4/e2e-multi-session-focus-and-shield.test.js')"`

4. **Invalidation Conditions**:
   - If any fix proposal introduces syntax errors (`node -c` fails).
   - If any fix causes test regressions in `npm test`.
   - If `main.js` switch logic leaves Study Mode banner visible when `studyMode: false` and `goalMode: true`.
