# 🧭 Installation Guide: Apple Safari (macOS)

Apple Safari requires converting standard WebExtension projects into a native macOS Safari Extension wrapper using Apple's built-in conversion utility.

---

## 📋 Prerequisites
* **macOS** (macOS Ventura, Sonoma, Sequoia, or later).
* **Xcode** (Installed from the Mac App Store) or Xcode Command Line Tools.

---

## 🛠️ Step-by-Step Conversion & Installation

### Step 1: Run Safari Web Extension Converter
Open your macOS **Terminal** and run the following command, pointing to your project folder:

```bash
xcrun safari-web-extension-converter "/Users/shivarampatel/Desktop/youtube shield - extension" --project-location ~/Desktop/YouTubeShieldSafari --app-name "YouTube Shield" --bundle-identifier "com.shivaram.youtubeshield" --macos-only --force
```

This command automatically converts the WebExtension into a native macOS Safari Extension Xcode project with full Page-Context Web Audio Engine Bridge support.

---

### Step 2: Open, Configure & Build in Xcode
1. Open the generated Xcode project:
   ```bash
   open ~/Desktop/YouTubeShieldSafari/"YouTube Shield"/"YouTube Shield.xcodeproj"
   ```
2. In Xcode's project navigator (blue top icon), check both **TARGETS**:
   * **Target 1 (`YouTube Shield` - macOS App):**
     * **Bundle Identifier:** `com.shivaram.youtubeshield`
     * **Signing & Capabilities:** Select your **Personal Team** (Apple ID).
   * **Target 2 (`YouTube Shield Extension` - Safari Plugin):**
     * **Bundle Identifier:** `com.shivaram.youtubeshield.Extension`  
       *(⚠️ Must start with the parent app's bundle identifier followed by `.Extension`)*
     * **Signing & Capabilities:** Select the **exact same Personal Team**.
3. Press **`Cmd + R`** (or click the **▶ Play** button) to build and run.
4. When the companion app launches, click **Quit and Open Safari Settings...**.

---

### Step 3: Enable Developer Extensions in Safari
1. Open **Safari**.
2. Go to **Safari** in top menu bar → **Settings...** (`Cmd + ,`) → **Advanced** tab → check **Show features for web developers**.
3. In Safari's top menu bar, click **Develop** → check **Allow Unsigned Extensions** (enter your Mac password if prompted).
4. In Safari Settings → **Extensions** tab, check the box next to **YouTube Shield** to enable it.

---

### Step 4: Grant YouTube Access Permission
1. Open **[YouTube](https://www.youtube.com/)** in Safari.
2. When the permission prompt appears:
   > *"The extension 'YouTube Shield' would like to access youtube.com."*
3. Click **"Always Allow on This Website"** (or **"Always Allow on Every Website..."**).

*(This allows YouTube Shield to inject the Focus HUD, UI Cleaners, and Web Audio DSP Engine seamlessly.)*

---

### Step 5: Verify Live Audio & Focus Features
1. Play any video on YouTube in Safari.
2. Click the **🛡️ Shield** button in YouTube's top header (or open the extension popup).
3. Drag the **Volume Booster** slider to `200%`–`600%` or adjust the **Bass Booster** / **10-Band Equalizer**:
   * Volume amplifies immediately up to 600%.
   * Equalizer frequency bands and presets sculpt sound in real-time through the native Web Audio DSP bridge!

---

## 🔧 Troubleshooting & Common Questions

### 1. Error: *"Embedded binary's bundle identifier is not prefixed with the parent app's bundle identifier"*
* **Cause:** Target 2's bundle ID does not start with Target 1's bundle ID.
* **Fix:** In Xcode → Select Project → Target 2 (`YouTube Shield Extension`) → General → set **Bundle Identifier** to `com.shivaram.youtubeshield.Extension`.

### 2. Extension does not appear in Safari Settings > Extensions
* **Fix:** Ensure **Develop** → **Allow Unsigned Extensions** is checked in Safari. If it was already checked, uncheck and re-check it, then restart Safari.
