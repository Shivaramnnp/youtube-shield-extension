#!/usr/bin/env node
/**
 * Automated Packaging Script for YouTube Shield
 * Generates clean distribution zip archives for Chrome Web Store and Firefox AMO.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const MANIFEST_PATH = path.resolve(ROOT_DIR, 'manifest.json');

console.log('🚀 Packaging YouTube Shield for Store Distribution...\n');

// 1. Validate manifest.json
try {
  const manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  console.log(`✅ Manifest valid: ${manifest.name} v${manifest.version}`);

  // Validate declared icons exist
  if (manifest.icons) {
    for (const [size, iconPath] of Object.entries(manifest.icons)) {
      const fullPath = path.resolve(ROOT_DIR, iconPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Declared icon not found: ${iconPath} (size: ${size})`);
      }
    }
    console.log('✅ All declared icons verified on disk.');
  }
} catch (e) {
  console.error('❌ Manifest validation failed:', e.message);
  process.exit(1);
}

// 2. Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// 3. Define files and directories to include in distribution
const INCLUDE_PATHS = [
  'manifest.json',
  'background',
  'content',
  'popup',
  'options',
  'utils',
  'assets',
  '_locales',
  'PRIVACY.md',
  'LICENSE',
  'README.md'
];

// Verify all included directories exist
for (const item of INCLUDE_PATHS) {
  const p = path.resolve(ROOT_DIR, item);
  if (!fs.existsSync(p)) {
    console.warn(`⚠️ Warning: Distribution item not found: ${item}`);
  }
}

const CHROME_ZIP = path.resolve(DIST_DIR, 'youtube-shield-chrome.zip');
const FIREFOX_ZIP = path.resolve(DIST_DIR, 'youtube-shield-firefox.zip');

// Clean existing zip files
if (fs.existsSync(CHROME_ZIP)) fs.unlinkSync(CHROME_ZIP);
if (fs.existsSync(FIREFOX_ZIP)) fs.unlinkSync(FIREFOX_ZIP);

// Build Chrome / Edge package
console.log('\n📦 Creating Chrome & Edge distribution package...');
try {
  const itemsStr = INCLUDE_PATHS.join(' ');
  execSync(`zip -r "${CHROME_ZIP}" ${itemsStr} -x "*.DS_Store*" "*test*" "*.log*"`, {
    cwd: ROOT_DIR,
    stdio: 'ignore'
  });
  const chromeStats = fs.statSync(CHROME_ZIP);
  console.log(`✅ Chrome Package created: dist/youtube-shield-chrome.zip (${(chromeStats.size / 1024).toFixed(1)} KB)`);
} catch (e) {
  console.error('❌ Failed to create Chrome package:', e.message);
}

// Build Firefox package (same archive format ready for AMO signing)
console.log('\n📦 Creating Firefox distribution package...');
try {
  const itemsStr = INCLUDE_PATHS.join(' ');
  execSync(`zip -r "${FIREFOX_ZIP}" ${itemsStr} -x "*.DS_Store*" "*test*" "*.log*"`, {
    cwd: ROOT_DIR,
    stdio: 'ignore'
  });
  const ffStats = fs.statSync(FIREFOX_ZIP);
  console.log(`✅ Firefox Package created: dist/youtube-shield-firefox.zip (${(ffStats.size / 1024).toFixed(1)} KB)`);
} catch (e) {
  console.error('❌ Failed to create Firefox package:', e.message);
}

console.log('\n✨ Store Distribution Archives Ready in dist/ directory!');
console.log('👉 Upload dist/youtube-shield-chrome.zip to Chrome Web Store & Edge Add-ons');
console.log('👉 Upload dist/youtube-shield-firefox.zip to Mozilla Add-ons (AMO)\n');
