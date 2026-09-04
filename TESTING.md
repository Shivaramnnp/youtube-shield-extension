# Shorts Shield Testing & QA Plan

## 1. Manual Test Plan

**Preparation:**
1. Clone the `shorts-shield` repository.
2. Load unpacked extension in Chrome/Brave/Edge.
3. Open a fresh instance of YouTube.

**Execution Steps:**
- **Shorts Visibility Check:** Scroll through the home feed, search for queries known to yield Shorts, and verify absence of the Shorts shelf and sidebar icon.
- **SPA Redirection Check:** Manually type `youtube.com/shorts` into the address bar. Verify it redirects to `youtube.com`. Click a link on an external site leading to a Short; verify redirection.
- **Focus Mode Check:** Navigate to a standard video. Toggle "Focus Mode" from the extension popup. Verify comments and related videos disappear immediately without requiring a refresh.
- **Study Mode Check:** Toggle "Study Mode". Input a goal like "Learn Web Development". Navigate to a gaming video. Verify the banner is present and the red warning ("This video may not match...") appears.
- **Time Tracking:** Start a video. Check the popup after 11 seconds to verify "Today's Watch Time" has increased. Pause the video and wait 15 seconds; verify the time has *not* increased.

## 2. Regression Test Checklist

Before merging any PR, check the following to prevent regressions:
- [ ] CSS Selectors for Shorts blocker haven't broken due to YouTube DOM updates.
- [ ] MutationObserver does not exceed 1% CPU utilization during heavy scrolling.
- [ ] XSS vulnerabilities do not exist in the Study Mode banner (test input: `<img src=x onerror=alert(1)>`).
- [ ] Storage logic safely merges new settings with `DEFAULT_SETTINGS` without overwriting existing user data.
- [ ] SPA Navigation (clicks within YouTube) reliably triggers the title-checking polling logic.

## 3. Browser Compatibility Checklist

- [ ] **Google Chrome (Primary target)** - fully supported (MV3).
- [ ] **Microsoft Edge** - fully supported (Chromium based).
- [ ] **Brave Browser** - fully supported (Chromium based). Verify Brave Shields don't conflict with tracking logic.
- [ ] **Safari (Future Target)** - Verify `chrome.storage` mappings and CSS `:has()` pseudo-class compatibility in older WebKit versions.

## 4. Performance Benchmark Checklist

- [ ] **Idle CPU:** 0% when YouTube is in a background tab.
- [ ] **Scrolling CPU:** Extension observer should consume <2ms per frame during rapid scrolling on the YouTube homepage.
- [ ] **Memory Footprint:** `<10MB` overhead. No detached DOM nodes or memory leaks over a 1-hour session.

---

## 5. Quality Assurance Test Cases (50 Scenarios)

### Shorts Blocking (1-10)
1. Verify Shorts button is hidden from the left sidebar guide.
2. Verify Shorts button is hidden from the collapsed left sidebar (mini-guide).
3. Verify "Shorts" shelf is removed from the Home feed.
4. Verify "Shorts" shelf is removed from Search results.
5. Verify "Shorts" tab is hidden on channel pages.
6. Verify "Shorts" chips are hidden from the topic filters.
7. Verify clicking a direct Shorts link redirects to the homepage.
8. Verify Shorts are removed from the "Up Next" sidebar on video pages.
9. Verify Shorts do not reappear when scrolling dynamically (infinite scroll).
10. Verify mobile layout (`ytm-reel-shelf-renderer`) hides Shorts when browser window is resized.

### SPA Navigation (11-15)
11. Verify Shorts blocker remains active when clicking the YouTube logo to go home.
12. Verify Focus Mode re-applies when navigating from one video to another via the sidebar.
13. Verify Study Mode warning evaluates the *new* video title after SPA navigation.
14. Verify URL redirect works when navigating to `/shorts` from a history `pushState` (back/forward buttons).
15. Verify MutationObserver does not duplicate itself after multiple SPA navigations.

### Focus Mode (16-20)
16. Verify comments section is completely hidden when toggled ON.
17. Verify related videos sidebar is completely hidden when toggled ON.
18. Verify end-screen video recommendations are hidden when a video finishes.
19. Verify the primary video player expands properly when the sidebar is hidden.
20. Verify all hidden elements instantly reappear when toggled OFF without a page refresh.

### Study Mode (21-25)
21. Verify the Study Banner pushes down the YouTube masthead safely.
22. Verify the session timer increments every second.
23. Verify changing the goal in the popup instantly updates the banner.
24. Verify entering a goal with XSS payloads renders as plain text.
25. Verify alignment warning appears if the video title lacks keywords from the goal.

### Time Tracking (26-33)
26. Verify time is tracked when a video is playing and the tab is active.
27. Verify time tracking pauses when the video is paused.
28. Verify time tracking pauses when the tab is hidden or minimized.
29. Verify time tracking pauses when the video finishes (ends).
30. Verify daily watch time increments accurately by 10-second intervals.
31. Verify weekly total aggregates correctly.
32. Verify monthly total aggregates correctly.
33. Verify time tracker resets correctly at midnight local time.

### Settings Persistence (34-40)
34. Verify disabling "Hide Notification Bell" instantly shows the bell.
35. Verify settings sync across Chrome instances if the user is logged in (`chrome.storage.sync`).
36. Verify Focus Reminder Interval saves correctly (e.g., 60 minutes).
37. Verify invalid reminder interval inputs default to 60.
38. Verify all settings survive a browser restart.
39. Verify options page UI accurately reflects stored settings upon load.
40. Verify toggling "Minimal Mode" works correctly.

### Edge Scenarios & Multi-Window (41-50)
41. Verify tracking behaves correctly when navigating entirely off YouTube and returning.
42. Verify tracking behavior when two YouTube tabs are open and playing side-by-side (expected: potential race condition documented as a known low-severity issue).
43. Verify tracking pauses if the computer goes to sleep while playing.
44. Verify the Focus Reminder overlay triggers exactly when the daily time exceeds the interval.
45. Verify clicking "Continue" on the reminder overlay removes it and resumes tracking.
46. Verify CSS injections do not break YouTube Studio pages (`studio.youtube.com`).
47. Verify CSS injections do not break YouTube Music (`music.youtube.com`).
48. Verify the extension handles offline scenarios gracefully (no crashes).
49. Verify the popup displays accurate watch time even if opened immediately after 10 seconds of playback.
50. Verify extension removal cleans up any local storage (handled by browser natively).
