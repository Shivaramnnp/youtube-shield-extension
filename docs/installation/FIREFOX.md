# 🦊 Installation Guide: Mozilla Firefox

This guide covers installing GodMode on **Mozilla Firefox** (Desktop on Windows, macOS, and Linux).

---

## 🛠️ Method 1: Temporary Installation (Firefox Standard)

This method lets you run and test GodMode in your everyday Firefox browser without signing.

### Step 1: Open Firefox Debugging
1. Launch **Mozilla Firefox**.
2. Type `about:debugging` in the address bar and press **Enter**.
3. In the left-hand sidebar, click on **This Firefox**.

---

### Step 2: Load the Extension
1. Under the **Temporary Extensions** section, click the button labeled **Load Temporary Add-on...**.
2. A file selection dialog will appear.
3. Navigate into the `shorts-shield` folder and select the file named **`manifest.json`**.
4. Click **Open**.

---

### Step 3: Verification
* **GodMode** will now appear in your active extensions list.
* Open a new tab, navigate to **[YouTube](https://www.youtube.com/)**, and the **`Shield 🛡️`** HUD button will be live in the top navigation bar!

> **Note on Temporary Add-ons:** Firefox unloads temporary extensions when the browser is completely closed. For persistent installation, see Method 2 below.

---

## 🔒 Method 2: Permanent Installation (Firefox Developer Edition / Nightly)

To keep the extension permanently installed without signing on every restart:

1. Download and open **Firefox Developer Edition** or **Firefox Nightly**.
2. Navigate to `about:config` in the address bar.
3. Search for `xpinstall.signatures.required`.
4. Double-click the preference to set its value to **`false`**.
5. Zip the contents of your `shorts-shield` directory into a `.zip` file and rename the extension to `.xpi` (e.g. `godmode.xpi`).
6. Drag and drop `godmode.xpi` directly into any open Firefox window to install it permanently.
