#!/usr/bin/env node
/**
 * Manifest & Asset Integrity Validator for YouTube Shield
 * Strictly verifies that all declared files, scripts, styles, and icons exist on disk.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.resolve(ROOT_DIR, 'manifest.json');

console.log('🔍 Validating manifest.json & asset references...\n');

let hasErrors = false;

function checkFile(relPath, description) {
  const fullPath = path.resolve(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing ${description}: ${relPath}`);
    hasErrors = true;
    return false;
  }
  console.log(`  ✓ Found ${description}: ${relPath}`);
  return true;
}

try {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);

  // 1. Basic properties
  console.log(`Checking Metadata: ${manifest.name} (v${manifest.version})`);
  if (!manifest.name || !manifest.version || manifest.manifest_version !== 3) {
    console.error('❌ Manifest missing required name, version, or manifest_version !== 3');
    hasErrors = true;
  }

  // 2. Background service worker
  console.log('\nChecking Background Worker:');
  if (manifest.background && manifest.background.service_worker) {
    checkFile(manifest.background.service_worker, 'service worker');
  }

  // 3. Action & Popup
  console.log('\nChecking Action & Popup:');
  if (manifest.action) {
    if (manifest.action.default_popup) {
      checkFile(manifest.action.default_popup, 'default popup');
    }
    if (manifest.action.default_icon) {
      for (const [size, iconPath] of Object.entries(manifest.action.default_icon)) {
        checkFile(iconPath, `action icon (${size}px)`);
      }
    }
  }

  // 4. Options UI
  console.log('\nChecking Options UI:');
  if (manifest.options_ui && manifest.options_ui.page) {
    checkFile(manifest.options_ui.page, 'options page');
  }

  // 5. Global Icons
  console.log('\nChecking Global Icons:');
  if (manifest.icons) {
    for (const [size, iconPath] of Object.entries(manifest.icons)) {
      checkFile(iconPath, `global icon (${size}px)`);
    }
  }

  // 6. Content Scripts
  console.log('\nChecking Content Scripts:');
  if (Array.isArray(manifest.content_scripts)) {
    manifest.content_scripts.forEach((cs, idx) => {
      console.log(` [Content Script Block ${idx + 1}] (world: ${cs.world || 'ISOLATED'})`);
      if (Array.isArray(cs.js)) {
        cs.js.forEach(jsFile => checkFile(jsFile, 'content JS script'));
      }
      if (Array.isArray(cs.css)) {
        cs.css.forEach(cssFile => checkFile(cssFile, 'content CSS stylesheet'));
      }
    });
  }

  // 7. Web Accessible Resources
  console.log('\nChecking Web Accessible Resources:');
  if (Array.isArray(manifest.web_accessible_resources)) {
    manifest.web_accessible_resources.forEach((war) => {
      if (Array.isArray(war.resources)) {
        war.resources.forEach(res => checkFile(res, 'accessible resource'));
      }
    });
  }

} catch (err) {
  console.error('❌ Failed to parse manifest.json:', err.message);
  hasErrors = true;
}

if (hasErrors) {
  console.error('\n💥 Validation failed with errors! Check the log above.\n');
  process.exit(1);
} else {
  console.log('\n✨ Manifest and all declared assets are 100% valid!\n');
  process.exit(0);
}
