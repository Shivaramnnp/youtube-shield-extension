# Investigation Report: Content Scripts, Feed Interception, Watch Page Quick Block & DOM Architecture

## 1. Observation

### 1.1 Manifest & Content Script Lifecycle
- **Manifest Configuration** (`manifest.json:69-125`):
  ```json
  "content_scripts": [
    {
      "matches": ["*://*.youtube.com/*", "*://*.youtube-nocookie.com/*"],
      "exclude_matches": ["*://studio.youtube.com/*", "*://tv.youtube.com/*"],
      "js": [
        "utils/dom-utils.js",
        "utils/audio-engine.js",
        "utils/gamification-engine.js",
        "utils/storage.js",
        "utils/time-tracker.js",
        "content/js/observer-utils.js",
        "content/js/shorts-blocker.js",
        "content/js/focus-mode.js",
        "content/js/study-mode.js",
        "content/js/ui-cleaner.js",
        "content/js/feed-controller.js",
        "content/js/header-button.js",
        "content/js/time-manager.js",
        "content/js/volume-booster.js",
        "content/js/goal-mode.js",
        "content/js/ad-skipper.js",
        "content/js/main.js"
      ],
      "css": [
        "content/css/hide-shorts.css",
        "content/css/focus-mode.css",
        "content/css/clean-ui.css",
        "content/css/feed-controller.css",
        "content/css/header-button.css"
      ],
      "all_frames": true,
      "run_at": "document_start"
    }
  ]
  ```
  Content scripts load in ISOLATED world at `document_start`. All modules attach instances to `window` / `globalThis`.

### 1.2 Feed Interception & Filtering in FeedController
- **Source**: `content/js/feed-controller.js:1-130`
  - Observer setup:
    ```javascript
    window.ObserverUtils.observe(
      'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer',
      (elements) => this.filterFeed(elements),
      'feed-controller'
    );
    ```
  - Element query:
    - Title: `const titleEl = el.querySelector('#video-title');`
    - Channel: `const channelEl = el.querySelector('ytd-channel-name, #channel-name, .ytd-channel-name');`
  - Normalization:
    ```javascript
    const titleText = (titleEl.textContent || "").toLowerCase();
    const channelText = channelEl ? (channelEl.textContent || "").toLowerCase() : "";
    const normalizedTitle = titleText
      .replace(/c\+\+/gi, 'cplusplus')
      .replace(/c#/gi, 'csharp')
      .replace(/ui\/ux/gi, 'uiux');
    ```
  - Custom Blocklist Matching:
    ```javascript
    const isBlockedKeyword = this.blockedKeywords.some(kw => titleText.includes(kw) || normalizedTitle.includes(kw));
    const isBlockedChannel = this.blockedChannels.some(ch => channelText.includes(ch));
    if (isBlockedKeyword || isBlockedChannel) {
      el.classList.add('off-topic');
      el.style.display = 'none';
      return;
    }
    ```
  - Dynamic unhiding on blocklist removal (`clearOffTopicCards()`):
    ```javascript
    const offTopicCards = document.querySelectorAll('.off-topic');
    offTopicCards.forEach(el => {
      el.classList.remove('off-topic');
      el.style.display = '';
    });
    ```

### 1.3 YouTube Watch Page DOM Elements & Selectors
- **Action Bar Container (for `#ss-quick-block-btn` injection)**:
  - Modern YouTube watch metadata container: `ytd-watch-metadata #actions #top-level-buttons-computed`, `#top-level-buttons-computed`, `ytd-watch-metadata #actions-inner #top-level-buttons-computed`.
  - Buttons currently present in `#top-level-buttons-computed`: Like/Dislike segmented button (`like-button-view-model`, `segmented-like-dislike-button-view-model`), Share button (`share-button-view-model`, `ytd-button-renderer`), Download button, Clip button, 3-dots overflow button (`ytd-menu-renderer yt-icon-button`).
  - Insertion target: Prepended or inserted alongside Like / Share buttons in `#top-level-buttons-computed`.
- **Watch Page Video Title Selectors**:
  - `h1.ytd-watch-metadata yt-formatted-string`
  - `h1.ytd-video-primary-info-renderer yt-formatted-string`
  - `h1.ytd-watch-metadata`
  - `#title h1 yt-formatted-string`
  - `#title h1`
  - Fallback: `document.title.replace(/ - YouTube$/i, '').trim()`
- **Watch Page Channel Name Selectors**:
  - `ytd-watch-metadata #channel-name #text a`
  - `ytd-watch-metadata ytd-channel-name #text a`
  - `ytd-watch-metadata ytd-channel-name yt-formatted-string a`
  - `ytd-watch-metadata #owner #channel-name a`
  - `ytd-watch-metadata #upload-info #channel-name a`
  - Sanitization function: `StorageUtil.cleanChannelName(rawName)` (`utils/storage.js:111-164`) strips trailing tooltip artifacts ("Subscribe", "Verified") and deduplicates duplicated tokens ("Firstpost Firstpost" → "Firstpost").
- **Video Player Selectors & Media Control**:
  - Video tag: `document.querySelector('video')`
  - Video container API: `document.getElementById('movie_player')` or `document.querySelector('.html5-video-player')`
  - Pausing: `video.pause()` or `moviePlayer.pauseVideo()`
  - Safe Redirection: `window.location.replace('https://www.youtube.com/')` or `window.history.back()`.

### 1.4 Storage & Cross-Tab Synchronization
- **Storage Utilities** (`utils/storage.js:1-49, 336-438`):
  - Settings schema contains:
    - `blockedKeywords`: `Array<string>` (default: `[]`)
    - `blockedChannels`: `Array<string>` (default: `[]`)
  - Update methods:
    - `StorageUtil.updateSetting('blockedKeywords', keywordsArray)`
    - `StorageUtil.updateSetting('blockedChannels', channelsArray)`
  - Storage event listening (`content/js/main.js:256-270`):
    ```javascript
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if ((namespace === 'sync' || namespace === 'local') && changes.settings) {
        const newVal = changes.settings.newValue || {};
        applySettings(newVal);
      }
    });
    ```
  - `applySettings` (`content/js/main.js:75-77`):
    ```javascript
    if (window.FeedController) {
      window.FeedController.setBlocklist(newSettings.blockedKeywords || [], newSettings.blockedChannels || []);
    }
    ```

---

## 2. Logic Chain

### 2.1 Watch Page Button Injection Lifecycle
1. **Trigger Points**:
   - Navigation: YouTube is a Single Page Application (Polymer/Angular). Page transitions fire `yt-navigate-finish`, `yt-page-data-updated`, and `yt-navigate-start`.
   - Dynamic Re-rendering: YouTube dynamically recreates `#top-level-buttons-computed` when liking a video, switching video resolution, or closing ads.
2. **Injection Strategy**:
   - Query `#top-level-buttons-computed` inside `ytd-watch-metadata`.
   - Guard against duplicate insertion via `document.getElementById('ss-quick-block-btn')`.
   - Use `ObserverUtils.observe('ytd-watch-metadata, #top-level-buttons-computed', ...)` + `yt-navigate-finish` listener to automatically self-heal and reinject if YouTube removes the button during layout recomputation.
   - When injected, attach native YouTube button styling (pill-shaped, height 36px, `border-radius: 18px`, `background: rgba(255,255,255,0.1)`, `color: #fff`, icon `🚫`, text `Block`).

### 2.2 Watch Page Quick Block Interaction & Keyword Extraction
1. **Action Menu / Popover**:
   - Clicking `#ss-quick-block-btn` opens a sleek glassmorphic popover menu anchored below the button (`#ss-quick-block-menu`).
   - Popover contains two distinct sections:
     1. **Channel Block Item**: "🚫 Block Channel: **[Clean Channel Name]**"
     2. **Title Keyword Tag Picker**: Interactive clickable chip tags extracted from the video title.
2. **Title Keyword Parsing Algorithm**:
   - Extract title text from `h1.ytd-watch-metadata` or `document.title`.
   - Strip video junk/suffixes: brackets `[...]`, `(...)`, file resolutions `1080p`, `4K`, `Official Video`, `Music Video`, `Lyrics`, `Full Episode`.
   - Normalize technical compound terms (preserve `C++`, `C#`, `UI/UX`, `Node.js`, `Next.js`, `Web3`, `AI`, `ML`, `SQL`, `Python`, `React`).
   - Filter out standard stop words (`the`, `a`, `an`, `and`, `or`, `for`, `with`, `in`, `of`, `to`, `how`, `what`, `why`, `is`, `are`, `this`, `that`, `video`, `tutorial`).
   - Deduplicate tokens and output unique words/compounds as selectable clickable chips.
   - Clicking any chip immediately adds that keyword to `blockedKeywords` in storage.

### 2.3 Toast Notification, 5-Second Countdown & Undo Lifecycle
1. **Blocking Action Execution**:
   - When a channel or keyword is blocked:
     a) Append the channel name or keyword to `blockedChannels` or `blockedKeywords` in `chrome.storage.local`.
     b) Pause current video playback immediately (`video.pause()`).
     c) Trigger a non-intrusive floating toast notification: `#ss-block-toast`.
2. **Toast Specifications**:
   - Fixed position: bottom-left or bottom-center (`position: fixed; bottom: 24px; left: 24px; z-index: 2147483647`).
   - Display: Obsidian glassmorphic card with message (e.g. `🚫 Channel "TechHub" Blocked`), a 5-second animated progress countdown bar, an **"Undo"** button, and an immediate **"Go Home"** button.
3. **Undo vs Commit Flow**:
   - If user clicks **"Undo"** within 5 seconds:
     - Remove the blocked item from `blockedChannels` / `blockedKeywords` in storage.
     - Cancel pending redirection.
     - Dismiss the toast.
     - Unhide off-topic items.
     - Auto-resume video playback (`video.play()`).
   - If 5 seconds expire without Undo:
     - Toast auto-dismisses.
     - Content script safely redirects to `https://www.youtube.com/` (or previous page via `history.back()`).

### 2.4 Real-Time Live Cross-Tab Synchronization
1. **Event Flow**:
   - Tab A blocks a channel/keyword or User edits blocklist in Dashboard Studio (`options/options.html`).
   - `StorageUtil.updateSetting('blockedKeywords', ...)` or `StorageUtil.updateSetting('blockedChannels', ...)` saves to `chrome.storage.local` and `chrome.storage.sync`.
   - `chrome.storage.onChanged` fires across all open YouTube tabs (Tab B, Tab C, Tab D).
   - Content script `main.js` receives `changes.settings.newValue` and passes blocklists to `FeedController.setBlocklist(blockedKeywords, blockedChannels)`.
   - `FeedController`:
     a) Normalizes keywords and channels (trimmed, lowercase).
     b) Scans currently rendered video cards across Home feed (`ytd-rich-item-renderer`), search results (`ytd-video-renderer`), and watch page sidebar recommendations (`ytd-compact-video-renderer`).
     c) Sets `style.display = 'none'` and `.off-topic` class on matching elements instantly without requiring page reload.
     d) If an item was unblocked / removed from blocklist, restores `style.display = ''` and removes `.off-topic` class.

---

## 3. Caveats

1. **Watch Page Redirection Timing**:
   - In SPA navigation, immediate hard navigation `window.location.replace()` before the 5-second undo window would prevent the user from clicking Undo on the watch page. Therefore, the watch page should pause playback, show the toast with a 5s countdown timer, and navigate upon countdown expiration (or offer an immediate "Home" button if the user wants to leave immediately).
2. **Channel Name Dynamic Loading**:
   - YouTube sometimes delays rendering the channel name link inside `ytd-channel-name` by 100–300ms after the watch page loads. The quick block button handler should fallback to `StorageUtil.cleanChannelName()` on `document.querySelector('#channel-name, ytd-channel-name')` with retry/mutation support.
3. **Search Page Results Preservation vs Blocklist**:
   - On the search page (`/results`), Goal Mode preserves user search results, but Custom Blocklists must *always* strictly hide blocked channels and blocked keywords. `FeedController.filterFeed()` already supports this by checking custom blocklists prior to goal-mode evaluation.

---

## 4. Conclusion & Interface Contracts

### 4.1 Interface Contract: DOM Selectors Reference Table

| Target Component | Primary Selector | Fallback / Alternative Selectors |
| :--- | :--- | :--- |
| **Watch Action Bar** | `ytd-watch-metadata #actions #top-level-buttons-computed` | `#top-level-buttons-computed`, `ytd-menu-renderer.ytd-watch-metadata #top-level-buttons-computed`, `#actions-inner #top-level-buttons-computed` |
| **Quick Block Button** | `#ss-quick-block-btn` | Injected inside `#top-level-buttons-computed` |
| **Quick Block Popover** | `#ss-quick-block-menu` | Anchored absolute below `#ss-quick-block-btn` |
| **Video Title** | `h1.ytd-watch-metadata yt-formatted-string` | `h1.ytd-watch-metadata`, `h1.ytd-video-primary-info-renderer yt-formatted-string`, `#title h1`, `document.title` |
| **Channel Name** | `ytd-watch-metadata #channel-name #text a` | `ytd-channel-name #text a`, `ytd-watch-metadata ytd-channel-name yt-formatted-string a`, `#owner-name a`, `#channel-name #text` |
| **Video Player Element** | `video` | `#movie_player video`, `.html5-video-player video`, `.html5-main-video` |
| **Player Container** | `#movie_player` | `.html5-video-player`, `ytd-player` |
| **Home Feed Item** | `ytd-rich-item-renderer` | `.ytd-rich-item-renderer` |
| **Search Result Item** | `ytd-video-renderer` | `.ytd-video-renderer`, `ytd-channel-renderer` |
| **Sidebar Recommendation**| `ytd-compact-video-renderer`| `.ytd-compact-video-renderer` |
| **Toast Container** | `#ss-block-toast` | Appended to `document.body` with `z-index: 2147483647` |
| **Toast Undo Button** | `#ss-toast-undo-btn` | Child button inside `#ss-block-toast` |

### 4.2 Quick Block Component Architecture (`content/js/quick-block.js` / `feed-controller.js`)
- **Class `QuickBlock`**:
  - `init()`: Attach navigation listeners (`yt-navigate-finish`, `yt-page-data-updated`, `pageshow`) and MutationObserver on `ytd-watch-metadata`.
  - `tryInjectButton()`: Detect watch page (`/watch`), locate `#top-level-buttons-computed`, inject `#ss-quick-block-btn` if not present.
  - `toggleMenu()`: Render popover with channel block action and title keyword chips.
  - `extractTitleKeywords(title)`: Parse, clean, filter stopwords, normalize compound tech terms, return unique token list.
  - `blockChannel(channelName)`: Add to `blockedChannels`, pause video, trigger toast with 5s countdown & undo.
  - `blockKeyword(keyword)`: Add to `blockedKeywords`, pause video if current title matches, trigger toast with 5s countdown & undo.
  - `showToast(itemType, itemName, onUndo, onCommit)`: Render `#ss-block-toast` with 5s countdown progress bar.
  - `undoBlock(itemType, itemName)`: Remove item from storage, cancel redirect, resume playback if on watch page.

### 4.3 Data Flow & Storage Contracts
- Storage Keys (`chrome.storage.local` and `chrome.storage.sync` via `StorageUtil`):
  - `settings.blockedChannels`: `string[]` (e.g. `["TrashContent", "SpamChannel"]`)
  - `settings.blockedKeywords`: `string[]` (e.g. `["gaming", "vlog", "prank", "reaction"]`)
- Cross-Tab Sync:
  - Updates saved via `StorageUtil.updateSetting('blockedChannels', ...)` and `StorageUtil.updateSetting('blockedKeywords', ...)`.
  - Content script `chrome.storage.onChanged` listener in `main.js` automatically invokes `FeedController.setBlocklist()`, instantly updating all open YouTube tabs.

---

## 5. Verification Method

### 5.1 Automated Test Execution
Run test suite to verify baseline functionality:
```bash
npm test
```
*Current status*: 439 / 439 tests passing across all 4 tiers.

### 5.2 Unit & Integration Test Specifications to Implement
1. **`tests/tier1/quick-block.test.js`**:
   - Test `#ss-quick-block-btn` injection inside `#top-level-buttons-computed`.
   - Test channel extraction and title keyword parsing from sample YouTube titles.
   - Test toast creation, 5-second countdown timer, and Undo click reverting storage changes.
   - Test video pause and redirect invocation.
2. **`tests/tier1/feed-interception.test.js`**:
   - Test `FeedController` real-time feed item hiding on `setBlocklist` for home feed, search results, and sidebar recommendations.
   - Test instant cross-tab storage change simulation via `chrome.storage.onChanged`.
   - Test unhiding items when blocklist is cleared.

### 5.3 Invalidation Conditions
- YouTube DOM redesign replacing `#top-level-buttons-computed` with a different custom element tag.
- Video element detached or enclosed in closed shadow DOM without standard `video` selector access.
- Incompatible storage format (e.g., storing non-array values for `blockedKeywords` or `blockedChannels`).
