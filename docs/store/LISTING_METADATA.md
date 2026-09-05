# 🏪 Store Publishing Metadata & Reviewer Guidelines

This document contains pre-formatted, copy-paste-ready metadata for submitting **YouTube Shield** to the **Chrome Web Store Developer Dashboard**, **Microsoft Partner Center (Edge Add-ons)**, and **Mozilla Add-on Developer Hub (AMO)**.

---

## 1. General Listing Metadata

| Field | Content | Character Limit |
|---|---|---|
| **Extension Title** | `YouTube Shield — Focus, Ad Skip & Audio DSP` | Max 45 chars (43 chars) |
| **Short Description** | `Block Shorts, eliminate distractions, boost audio up to 600%, sculpt sound with 10-band EQ, skip ads, and gamify your learning.` | Max 132 chars (125 chars) |
| **Category** | `Productivity` / `Workflow & Planning` | — |
| **Primary Language** | `English` | — |
| **Pricing** | `Free (100% Free & Open Source)` | — |

---

## 2. Full Store Description (Markdown & Plain Text Format)

```text
🛡️ YouTube Shield — Total Control Over Your YouTube Experience

Transform YouTube from an addictive dopamine trap into an intentional learning workstation and studio-grade entertainment platform. 

YouTube Shield combines intelligent Shorts elimination, distraction-free study modes with an integrated Pomodoro timer, intentional goal enforcement, studio-quality 10-band audio equalization, 600% volume boosting, native ad skipping, and an RPG gamification ranking system.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 CORE HIGHLIGHTS & FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 1. TOTAL SHORTS ELIMINATION
• Strips out Shorts carousels and shelves from your Home feed, Subscriptions, Search results, and Channel pages.
• Automatically intercepts and redirects direct `/shorts/*` links back to your clean home feed.
• Earn Action Points (AP) and level up every time a Short is blocked!

📚 2. STUDY MODE & INTEGRATED POMODORO TIMER
• Sticky top floating status banner anchors your focus above the video player.
• Built-in 25-minute focus, 5-minute short break, and 15-minute long break Pomodoro cycles.
• AI Content Validation: Detects if a video drifts away from your educational goal and displays an alignment warning.
• Converts your study sessions into tracked "Learning Time" to unlock scholar achievements.

🎯 3. GOAL MODE (INTENTIONAL BROWSING)
• Lock your browsing to a specific objective (e.g. "Learn Python", "React Architecture").
• Automatically pauses and displays a frosted-glass Goal Block Modal when opening unrelated videos.
• Includes an "Allow Once" emergency button for edge-case research.

🎛️ 4. STUDIO-GRADE AUDIO DSP & 10-BAND EQUALIZER
• 600% Volume Booster (6x): Amplifies quiet podcasts, lectures, and tutorials with zero distortion.
• Dedicated Bass Subsystem: Adds up to +20dB of deep, punchy low-end via high-order low-shelf filtering.
• 10-Band Graphic Equalizer: Sliders for 32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, and 16kHz (±12dB gain).
• 8 Curated Presets: Flat, Bass Boost, Vocal Booster, Treble Boost, Rock, Pop, Acoustic, and Electronic + Custom profiles.

⚡ 5. NATIVE AUTO AD SKIPPER & PLAYBACK ASSURANCE
• MAIN-World Execution: Native player integration without synthetic click blockages.
• 16x Speedup Engine: Fast-forwards countdowns and unskippable ads silently in milliseconds.
• Active Playback Assurance: Automatically resumes playback after ads to eliminate frozen end frames.

🧹 6. UI CLEANER (ZEN INTERFACE)
• Granular toggles to hide notification bells, subscriber counts, live chat, trending tabs, autoplay switches, and comments.

⏱️ 7. TIME MANAGER & FOCUS REMINDERS
• Set daily watch time allowances (e.g. 45 min/day), scheduled browsing hours, and periodic check-in reminders.
• Includes an emergency "+5 Min Snooze" button.

🏆 8. RPG GAMIFICATION & RANK PROGRESSION
• Earn Action Points (AP) and EXP for learning, maintaining study streaks, and blocking Shorts.
• Progress across 6 Rank Tiers: Bronze Focus 🥉 → Silver Scholar 🥈 → Gold Mastermind 🥇 → Diamond Warrior 💎 → Heroic Monk 🧘 → Grandmaster Legend 👑.

📊 9. ANALYTICS & WATCH TIMELINE DASHBOARD
• Interactive 7-day bar charts comparing Entertainment Watch Time vs. Productive Learning Time.
• Searchable chronological video timeline log with duration and category tracking.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 PRIVACY & SECURITY FIRST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 100% Local Storage: Zero user data or browsing history is ever transmitted to external servers.
• No Account Required: Install and use immediately without signing in.
• Zero Tracking / Analytics: Contains no telemetry SDKs or analytics scripts.
• Open Source: Fully transparent codebase licensed under the MIT License.

Built for learners, developers, and intentional thinkers.
```

---

## 3. Chrome Web Store Reviewer Justifications

When submitting to the Chrome Web Store, paste these exact justifications into the **"Single Purpose"** and **"Permissions Justification"** fields:

### A. Single Purpose Justification:
> *"YouTube Shield has a single, unified purpose: to provide users with a comprehensive focus, distraction-defense, and audio customization environment tailored specifically for YouTube."*

### B. Permissions Justification Table:

| Permission | Reviewer Explanation |
|---|---|
| **`storage`** | *"Required to save user preferences (focus toggles, equalizer gains, Pomodoro intervals, learning goals, and watch time statistics) locally on the user's device using `chrome.storage.local` and `chrome.storage.sync`."* |
| **`tabs`** | *"Used strictly to switch focus to the options dashboard tab when the user clicks 'Open Dashboard' from the in-page HUD or browser action popup, avoiding duplicate tab opening."* |
| **`scripting`** | *"Used to execute MAIN-world player commands (such as native ad skipping and Web Audio graph initialization) directly inside YouTube's player execution context."* |
| **`webNavigation`** | *"Used to intercept client-side navigation to `/shorts/*` URLs and seamlessly redirect the user to the YouTube home feed without triggering page reload loops."* |
| **`host_permissions` (`*://*.youtube.com/*`)** | *"Strictly limited to YouTube domains to inject the focus HUD button, audio equalizer nodes, and UI cleaning stylesheets exclusively on YouTube."* |

---

## 4. Visual Asset Specifications for Store Dashboards

* **Store Icon:** `assets/icons/icon128.png` (128x128 px, PNG format).
* **Small Promotional Tile:** `440 x 280 px` (PNG/JPEG, max 2MB).
* **Marquee Promotional Banner:** `1400 x 560 px` (PNG/JPEG, max 2MB).
* **Screenshot Previews (At least 1 required):** `1280 x 800 px` (or `640 x 400 px`).
  1. *Screenshot 1: The Quick-Access Shield HUD on YouTube.*
  2. *Screenshot 2: Studio Audio Equalizer & Visualizer.*
  3. *Screenshot 3: Study Mode with Pomodoro Banner.*
  4. *Screenshot 4: Analytics Dashboard & Gamification Ranks.*

---

## 5. Developer Account & Support Details

| Field | Value |
|---|---|
| **Developer / Author** | Shivaram |
| **Developer Support & Bug Report Email** | `shivaramnnp@gmail.com` |
| **Official Repository** | `https://github.com/Shivaramnnp/youtube-shield-extension` |
| **Microsoft Edge Add-ons Store URL** | `https://microsoftedge.microsoft.com/addons/detail/youtube-shield/ppdioanimggmhgoheogajbjmkededhnc` |
| **Developer LinkedIn Profile** | `https://www.linkedin.com/in/shivaramnnp/` |
| **Privacy Policy URL** | `https://github.com/Shivaramnnp/youtube-shield-extension/blob/main/PRIVACY.md` |
| **Terms of Service URL** | `https://github.com/Shivaramnnp/youtube-shield-extension/blob/main/TERMS.md` |

