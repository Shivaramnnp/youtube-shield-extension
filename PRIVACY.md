# 🔒 Privacy Policy for YouTube Shield

*Last Updated: August 22, 2026*

**YouTube Shield** ("we", "our", or "the extension") is committed to protecting your privacy. This Privacy Policy explains our practices regarding user data and outlines our strict **Local-First, Zero-Telemetry** architecture.

---

## 1. Summary of Core Privacy Principles

* 🚫 **No Personal Data Collection:** We do not collect, harvest, store, or transmit any personally identifiable information (PII) such as your name, email address, IP address, browsing history, or payment details.
* 🚫 **No External Telemetry or Analytics:** The extension contains zero tracking SDKs, third-party analytics (such as Google Analytics or Mixpanel), advertising networks, or remote telemetry pings.
* 🚫 **No Account Required:** You do not need to create an account, log in, or provide credentials to use any feature of YouTube Shield.
* 💾 **100% Local Storage:** All configuration settings, daily watch time summaries, learning AP points, and custom audio equalizer presets are stored exclusively on your device.

---

## 2. Information We Handle Locally on Your Device

To provide its functionality, YouTube Shield stores non-identifying operational preferences locally using standard browser APIs (`chrome.storage.local` and `chrome.storage.sync`):

| Data Type | Purpose | Storage Location | Transmitted Externally? |
|---|---|---|---|
| **User Preferences** (Focus modes, toggles, Pomodoro durations, whitelist keywords) | Restores your customized settings across browser sessions. | `chrome.storage.sync` (synced via your browser profile) & local memory cache | **NO** |
| **Watch & Learning Totals** (Daily seconds watched vs. learned) | Computes local analytics charts and streak progression. | `chrome.storage.local` | **NO** |
| **Gamification Ranks & Badges** (Action Points, Level, unlocked achievements) | Calculates RPG level progression locally. | `chrome.storage.local` | **NO** |
| **Audio Equalizer Presets** (Custom 10-band gain values, volume levels) | Restores your audio curve on YouTube video playback. | `chrome.storage.local` | **NO** |

---

## 3. Permissions Justification (Chrome Web Store & Browser Stores)

YouTube Shield adheres to the principle of least privilege. The extension requests only the minimum permissions necessary for its features:

* **`storage`**: Used to save your focus settings, equalizer presets, and watch time statistics locally.
* **`tabs`**: Used to switch or focus open dashboard tabs when you click "Open Dashboard" from the HUD or popup.
* **`scripting`**: Used to execute MAIN-world player commands (such as native ad skipping and audio Web Audio graph routing) directly in the YouTube player context.
* **`webNavigation`**: Used to intercept YouTube Shorts navigation URLs (`youtube.com/shorts/*`) and seamlessly redirect them to your home feed without page reload loops.
* **`host_permissions` (`*://*.youtube.com/*`)**: Restricted exclusively to YouTube domains to inject focus controls, audio DSP nodes, and UI cleaning stylesheets. The extension has zero access to any other website or domain you visit.

---

## 4. Third-Party Services & Data Sharing

* We do not sell, rent, monetize, or trade user data under any circumstances.
* We do not transfer data to any third-party servers, data brokers, or advertising networks.

---

## 5. User Control & Data Deletion

You have complete control over your stored data:
* **Export Data:** You can export your full settings and statistics as a JSON file at any time from the **Options Dashboard**.
* **Delete / Reset Data:** Clicking **"Reset All Data"** in the Dashboard immediately erases all stored watch totals, streaks, and custom presets from your device.
* **Uninstalling:** Removing YouTube Shield from your browser automatically deletes all locally stored extension data.

---

## 6. Children's Privacy (COPPA & GDPR Compliance)

YouTube Shield does not collect any personal information from any user, including children under the age of 13.

---

## 7. Changes to This Privacy Policy

If we make updates to this Privacy Policy, the revised version will be posted in this repository with an updated "Last Updated" date.

---

## 8. Contact Information

If you have questions, feedback, bug reports, or concerns regarding this Privacy Policy, please contact the developer:

* **Author:** Shivaram
* **Bug Reports & Inquiries:** [`shivaramnnp@gmail.com`](mailto:shivaramnnp@gmail.com)
* **GitHub Repository:** [https://github.com/Shivaramnnp/youtube-shield-extension](https://github.com/Shivaramnnp/youtube-shield-extension)
* **LinkedIn Profile:** [https://www.linkedin.com/in/shivaramnnp/](https://www.linkedin.com/in/shivaramnnp/)
