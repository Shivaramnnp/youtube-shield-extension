# 🛡️ YouTube Shield — YouTube Focus & Audio Superpower Suite

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Microsoft Edge Add-ons](https://img.shields.io/badge/Microsoft%20Edge-Get%20it%20on%20Edge%20Add--ons-0078D7?logo=microsoft-edge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/youtube-shield/ppdioanimggmhgoheogajbjmkededhnc)
[![Mozilla Firefox AMO](https://img.shields.io/badge/Firefox%20AMO-Get%20it%20on%20Firefox-FF7139?logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/youtube-shield/)
[![Cross Browser](https://img.shields.io/badge/Browsers-Chrome%20%7C%20Edge%20%7C%20Brave%20%7C%20Firefox%20%7C%20Safari%20%7C%20Android-blue.svg)](#-multi-platform-installation-guides)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests Passing](https://img.shields.io/badge/Tests-530%2F530%20Passed-brightgreen.svg)](#-test-suite--quality-gate)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Local%20Storage-purple.svg)](#-privacy--local-first-architecture)

**YouTube Shield** is an open-source, privacy-first browser extension that transforms YouTube from an addictive distraction trap into an intentional learning workstation and studio-grade entertainment platform.

### 📥 Install Extension

[<img src="https://img.shields.io/badge/Microsoft%20Edge-Get%20Extension-0078D7?style=for-the-badge&logo=microsoft-edge&logoColor=white" height="38">](https://microsoftedge.microsoft.com/addons/detail/youtube-shield/ppdioanimggmhgoheogajbjmkededhnc)
[<img src="https://img.shields.io/badge/Firefox%20AMO-Desktop%20%26%20Android-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white" height="38">](https://addons.mozilla.org/en-US/firefox/addon/youtube-shield/)
[<img src="https://img.shields.io/badge/GitHub-Download%20ZIP-181717?style=for-the-badge&logo=github&logoColor=white" height="38">](https://github.com/Shivaramnnp/youtube-shield-extension/releases)

It combines intelligent Shorts elimination, focus modes, Pomodoro cycles, intentional goal enforcement, studio-quality 10-band audio equalization with live 60 FPS spectrum visualizer, 600% volume boosting, native ad acceleration/skipping, and an RPG gamification ranking system.

---

## 🌟 Key Features

```
                              [ YouTube Shield Suite ]
                                         │
    ┌────────────────┬───────────────────┼───────────────────┬────────────────┐
    ▼                ▼                   ▼                   ▼                ▼
[ Focus & Defense ] [ Audio Studio ]   [ Automation ]    [ Gamification ]  [ Analytics ]
• Shorts Blocker    • 10-Band EQ        • Native Ad Skip  • 6 Rank Tiers    • 7-Day Charts
• Study Mode + Pomo • 600% Volume Boost • 16x Ad Speedup  • Level & EXP Bar • Timeline Log
• Goal Mode Guard   • +20dB Bass Boost  • Anti-Adblock    • Unlockable AP   • Category Tags
• Feed Controller   • 60 FPS Visualizer • Playback Resume • Action Badges   • JSON Export
• UI Cleaner (Zen)  • Noise Clarifier   • Zero Freezing   • Streak Keeper   • Local Backup
```

### 1. 🛡️ Quick-Access Masthead HUD
* Injected seamlessly beside YouTube's **Create** button.
* Single-click popover for master toggles, live session tracking, volume boost, bass boost, and instant audio EQ preset switching.

### 2. 🚫 Shorts Blocker (Total Shorts Elimination)
* Completely eliminates the "Shorts" tab from the sidebar, reels from home feeds, search results, and channel pages.
* Automatically intercepts `/shorts/*` navigation links and redirects to safety without page reloads.

### 3. 📚 Study Mode & Integrated Pomodoro Engine
* Top floating status banner (`#ss-study-banner`) with integrated **25/5/15 Pomodoro timer**.
* AI content alignment checks: warns you when a video drifts away from your study topic.
* Automatically converts study time into **Learning Time** and awards Action Points (AP).

### 4. 🎯 Goal Mode (Intentional Browsing)
* Enforces single-purpose sessions (e.g. *"Learn Next.js 14"*).
* Blocks off-topic videos with a frosted-glass **Goal Block Modal** with an "Allow Once" emergency bypass.

### 5. 🔍 Feed Controller (AI Whitelist Recommendations)
* Replaces clickbait with high-signal content by filtering your home and search feeds using whitelist keywords.

### 6. 🎛️ Studio-Grade Audio Engine & 10-Band Graphic EQ
* **600% Volume Booster (6x):** Amplifies quiet audio tracks and lectures cleanly with zero distortion.
* **Dedicated Bass Subsystem:** Adds up to **+20dB** of punchy low-end punch via biquad low-shelf filtering.
* **10-Band Equalizer:** Sliders spanning 32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, and 16kHz (±12dB gain range).
* **8 Curated Presets:** *Flat*, *Bass Boost*, *Vocal Booster*, *Treble Boost*, *Rock*, *Pop*, *Acoustic*, *Electronic*, and *Custom*.
* **60 FPS Spectrum Analyzer:** Real-time dual-speed ballistics (fast attack, smooth exponential decay) with logarithmic frequency distribution and peak-hold caps.

### 7. ⚡ Auto Ad Skipper & Playback Assurance
* **Native MAIN-World Execution:** Executes within the page's own context to trigger genuine trusted skip commands.
* **16x Acceleration Engine:** Fast-forwards unskippable ads and countdown timers in < 1 second.
* **Playback Assurance:** Auto-resumes `video.play()` post-skip to eliminate frozen end frames.

### 8. ⏱️ Time Manager & Focus Reminders
* Daily watch-time limits, scheduled browsing hours, periodic check-in reminders, and a **+5 Min Emergency Snooze**.

### 9. 🏆 RPG Gamification & Rank Progression
* Earn Action Points (AP) and EXP for learning, maintaining streaks, and destroying Shorts.
* Progress across **6 Rank Tiers:** *Bronze Focus* 🥉 → *Silver Scholar* 🥈 → *Gold Mastermind* 🥇 → *Diamond Warrior* 💎 → *Heroic Monk* 🧘 → *Grandmaster Legend* 👑.

### 10. 📊 Analytics & Watch Timeline Dashboard (`options.html`)
* Interactive 7-day bar charts comparing **Entertainment Watch Time** vs. **Productive Learning Time**.
* Searchable, chronological video timeline log with channel deduplication and duration tracking.

---

## 🌐 Multi-Platform Installation Guides

YouTube Shield is engineered for 100% cross-browser and cross-operating-system compatibility. Select your platform below:

---

### 1. 🖥️ Google Chrome & Chromium Browsers (Brave, Edge, Arc, Opera, Vivaldi)

Works on **Windows, macOS, Linux, and ChromeOS**.

#### Step-by-Step Installation:
1. **Download or Clone the Repository:**
   ```bash
   git clone https://github.com/Shivaramnnp/youtube-shield-extension.git
   ```
   *(Or download and extract the ZIP file to your computer).*

2. **Open Extensions Page:**
   - **Microsoft Edge (Official Store):** [Install directly from Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/youtube-shield/ppdioanimggmhgoheogajbjmkededhnc)
   - **Google Chrome:** `chrome://extensions`
   - **Brave Browser:** `brave://extensions`
   - **Arc Browser:** `arc://extensions` (or `Cmd+T` → type `extensions`)
   - **Opera / Opera GX:** `opera://extensions`
   - **Vivaldi:** `vivaldi://extensions`

3. **Enable Developer Mode:**
   - Toggle the **"Developer mode"** switch in the **top-right corner** to **ON**.

4. **Load the Extension:**
   - Click the **"Load unpacked"** button in the top-left corner.
   - Select the `youtube-shield-extension` folder (the directory containing `manifest.json`).

5. **Pin & Access:**
   - Click the puzzle piece icon (🧩) in your browser toolbar and click the **Pin (📌)** icon.
   - Open **[YouTube](https://www.youtube.com/)** and click the **`Shield 🛡️`** button in the top navigation bar!

---

### 2. 🦊 Mozilla Firefox (Desktop & Android)

Works on **Windows, macOS, Linux, and Firefox for Android**.

#### 🚀 Official One-Click Installation (Recommended):
Install directly from the official Mozilla Add-ons Store:
👉 **[Get YouTube Shield on Firefox Add-ons (AMO)](https://addons.mozilla.org/en-US/firefox/addon/youtube-shield/)**

#### Method B: Manual / Developer Installation
1. Open Firefox and navigate to `about:debugging` in the address bar.
2. In the left sidebar, click **"This Firefox"**.
3. Under the **Temporary Extensions** section, click **"Load Temporary Add-on..."**.
4. Navigate to the `youtube-shield-extension` folder and select the **`manifest.json`** file.
5. Open **[YouTube](https://www.youtube.com/)** to start using the extension.

#### Method C: Permanent Installation (Firefox Developer Edition / Nightly)
1. In Developer Edition or Nightly, navigate to `about:config`.
2. Search for `xpinstall.signatures.required` and set it to **`false`**.
3. Zip the contents of the `youtube-shield-extension` folder and rename the file extension to `.xpi` (e.g. `youtube-shield.xpi`).
4. Drag and drop `youtube-shield.xpi` into any open Firefox window to install permanently.

---

### 3. 🧭 Apple Safari (macOS)

Requires **macOS Ventura, Sonoma, Sequoia or later** and **Xcode** (or Xcode Command Line Tools).

#### Step-by-Step Build & Setup:
1. **Convert to Safari Web Extension:**
   Open Terminal and run:
   ```bash
   xcrun safari-web-extension-converter /path/to/shorts-shield --project-location ~/Desktop/YouTubeShieldSafari --app-name "YouTube Shield" --bundle-identifier "com.shivaram.youtubeshield" --macos-only --force
   ```

2. **Open and Build in Xcode:**
   ```bash
   open ~/Desktop/YouTubeShieldSafari/"YouTube Shield"/"YouTube Shield.xcodeproj"
   ```
   - In Xcode, select both targets (**YouTube Shield** app and **YouTube Shield Extension**) and set the **Signing & Capabilities** to your Personal Apple Team.
   - Ensure the Extension target's bundle ID is `com.shivaram.youtubeshield.Extension`.
   - Press **`Cmd + R`** (or click ▶ **Run**) to build and launch the companion app.

3. **Enable in Safari:**
   - Open **Safari** → **Settings...** (`Cmd + ,`) → **Advanced** tab → check **"Show features for web developers"**.
   - In Safari's top menu bar, click **Develop** → check **"Allow Unsigned Extensions"**.
   - Go to Safari Settings → **Extensions** tab → check the box next to **YouTube Shield**.
   - Open [YouTube](https://www.youtube.com/) and choose **"Always Allow on This Website"**.

---

### 4. 📱 Mobile Android (Kiwi & Lemur Browsers)

Google Chrome on Android does not natively support extensions, but Chromium-based mobile browsers like **Kiwi Browser** and **Lemur Browser** provide full Manifest V3 extension support.

#### Step-by-Step Installation (Kiwi Browser):
1. **Package Extension:**
   On your computer, create a ZIP file of the repository:
   ```bash
   zip -r shorts-shield.zip . -x "*.git*" "tests/*" "node_modules/*"
   ```
   Send `shorts-shield.zip` to your Android device.

2. **Install Kiwi Browser:**
   - Download and install **Kiwi Browser** from the Google Play Store.

3. **Load the Extension:**
   - Open Kiwi Browser and tap the **three dots menu (`⋮`)** in the top-right corner.
   - Tap **Extensions** (or type `kiwi://extensions` in the address bar).
   - Toggle ON **"Developer mode"** in the top-right corner.
   - Tap **`+ (from .zip / .crx / .user.js)`** and select `shorts-shield.zip` from your phone's storage.

4. **Use on YouTube:**
   - Navigate to [youtube.com](https://youtube.com).
   - Tap `⋮` → Check **Desktop site** for the full top masthead HUD menu & Audio Studio rack.
   - Access the extension popup anytime via Kiwi's `⋮` menu → **Shorts Shield**.

---

### 5. 📱 Apple iOS & iPadOS (iPhone / iPad)

1. Run the Safari converter with `--ios-only`:
   ```bash
   xcrun safari-web-extension-converter /path/to/shorts-shield --project-location ~/Desktop/YouTubeShieldiOS --app-name "YouTube Shield" --bundle-identifier "com.shivaram.youtubeshield" --ios-only --force
   ```
2. Open the project in Xcode, connect your iPhone or iPad, and deploy using your Apple Developer account or free Personal Team profile.
3. On your iOS device, go to **Settings** → **Safari** → **Extensions** → enable **YouTube Shield**.

---

## 🧪 Test Suite & Quality Gate

YouTube Shield includes an exhaustive, multi-tier automated test harness verifying syntax, MV3 mocks, state transitions, audio DSP, and adversarial edge cases.

```bash
# Run all unit, boundary, interaction, and E2E suites
npm test

# Run specific stress tests
node run-tests.js
```

**Quality Gate Result:** **530 / 530 Tests Passed Cleanly (100% Pass Rate, 0 Failures)**.

---

## 🔒 Privacy & Local-First Architecture

* **Zero External Telemetry:** No user data, video history, or telemetry is sent to any external server.
* **100% Local Storage:** Settings, AP points, streaks, and video timelines are stored strictly on your local device via `chrome.storage.local` and `chrome.storage.sync`.
* **Zero Dependencies:** Built entirely with vanilla JavaScript, HTML5 Web Audio API, and CSS3.

---

## 👨‍💻 Author & Connect

* **Developer:** Shivaram
* **Bug Reports & Inquiries:** [`shivaramnnp@gmail.com`](mailto:shivaramnnp@gmail.com)
* **GitHub:** [https://github.com/Shivaramnnp/](https://github.com/Shivaramnnp/)
* **LinkedIn:** [https://www.linkedin.com/in/shivaramnnp/](https://www.linkedin.com/in/shivaramnnp/)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
