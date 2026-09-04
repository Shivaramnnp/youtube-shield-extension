const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '../../');

console.log('========================================================================');
console.log('  CHALLENGER 2: ADVERSARIAL & EDGE-CASE SLIDER STRESS TEST               ');
console.log('========================================================================\n');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function check(cond, desc, errDetails = '') {
  totalChecks++;
  if (cond) {
    passedChecks++;
    console.log(`  ✓ [EDGE-CASE PASS] ${desc}`);
  } else {
    failedChecks++;
    console.error(`  ❌ [EDGE-CASE FAIL] ${desc}: ${errDetails}`);
  }
}

// 1. Stress test CSS rule parsing and syntax compliance
console.log('--- 1. CSS Syntax & Rule Structure Stress ---');
const cssFiles = [
  { path: 'options/options.css', cls: '.opt-eq-slider', expectedHeight: '110px' },
  { path: 'popup/popup.css', cls: '.pop-eq-slider', expectedHeight: '60px' },
  { path: 'content/css/header-button.css', cls: '.ss-eq-slider', expectedHeight: '55px' }
];

for (const { path: relPath, cls, expectedHeight } of cssFiles) {
  const fullPath = path.join(REPO_ROOT, relPath);
  const cssContent = fs.readFileSync(fullPath, 'utf8');

  // Check no forbidden syntax
  check(!cssContent.includes('slider-vertical'), `${relPath} has no occurrences of slider-vertical`);
  check(!cssContent.includes('-webkit-appearance: slider-vertical'), `${relPath} has no -webkit-appearance: slider-vertical`);
  check(!cssContent.includes('appearance: slider-vertical'), `${relPath} has no appearance: slider-vertical`);
  check(!cssContent.includes('orient='), `${relPath} has no orient=`);

  // Verify class existence
  const classIndex = cssContent.indexOf(cls);
  check(classIndex !== -1, `${relPath} contains definition for ${cls}`);

  // Check brackets balance
  const openBraces = (cssContent.match(/\{/g) || []).length;
  const closeBraces = (cssContent.match(/\}/g) || []).length;
  check(openBraces === closeBraces, `${relPath} has balanced CSS braces ({: ${openBraces}, }: ${closeBraces})`);
}

// 2. HTML Structure & DOM Parsing Stress Test
console.log('\n--- 2. HTML DOM Parsing & Attribute Boundary Stress ---');

function testHtmlSliders(relPath, prefix, count = 10) {
  const fullPath = path.join(REPO_ROOT, relPath);
  const html = fs.readFileSync(fullPath, 'utf8');

  for (let i = 0; i < count; i++) {
    const sliderId = `${prefix}-eq-slider-${i}`;
    const valId = `${prefix}-eq-val-${i}`;

    check(html.includes(`id="${sliderId}"`), `${relPath} contains slider id="${sliderId}"`);
    check(html.includes(`id="${valId}"`), `${relPath} contains label id="${valId}"`);

    // Match the exact tag
    const tagRegex = new RegExp(`<input[^>]*id=["']${sliderId}["'][^>]*>`, 'i');
    const match = html.match(tagRegex);
    check(match !== null, `${relPath} slider #${i} tag found`);

    if (match) {
      const tag = match[0];
      check(!tag.includes('orient='), `${sliderId} has NO orient attribute`);
      check(!tag.includes('slider-vertical'), `${sliderId} has NO slider-vertical`);
      check(tag.includes('writing-mode: vertical-lr'), `${sliderId} has writing-mode: vertical-lr`);
      check(tag.includes('direction: rtl'), `${sliderId} has direction: rtl`);
      check(tag.includes('min="-12"'), `${sliderId} has min="-12"`);
      check(tag.includes('max="12"'), `${sliderId} has max="12"`);
      check(tag.includes('value="0"'), `${sliderId} has value="0"`);
      check(tag.includes('type="range"'), `${sliderId} is type="range"`);
    }
  }
}

testHtmlSliders('popup/popup.html', 'pop', 10);
testHtmlSliders('options/options.html', 'opt', 10);

// 3. Audio Engine & Preset Value Validation
console.log('\n--- 3. Audio Engine & Preset Value Validation ---');
const audioEngineCode = fs.readFileSync(path.join(REPO_ROOT, 'utils/audio-engine.js'), 'utf8');

const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(audioEngineCode, sandbox);

const presets = sandbox.window._SS_EQ_PRESETS;
check(typeof presets === 'object' && presets !== null, 'window._SS_EQ_PRESETS is an object');

const expectedPresetNames = ['Flat', 'Bass Boost', 'Vocal Booster', 'Treble Boost', 'Rock', 'Pop', 'Acoustic', 'Electronic', 'Custom'];
for (const pName of expectedPresetNames) {
  check(pName in presets, `Preset "${pName}" exists in window._SS_EQ_PRESETS`);
  const gains = presets[pName];
  if (pName === 'Custom') {
    check(gains === null, 'Custom preset gains is null');
  } else {
    check(Array.isArray(gains) && gains.length === 10, `Preset "${pName}" has 10 band gain values`);
    if (Array.isArray(gains)) {
      const allInRange = gains.every(g => typeof g === 'number' && g >= -12 && g <= 12);
      check(allInRange, `All 10 band gains for "${pName}" are between -12dB and +12dB`);
    }
  }
}

console.log('\n========================================================================');
console.log(`  EDGE-CASE STRESS TEST SUMMARY: ${passedChecks}/${totalChecks} PASSED`);
console.log('========================================================================\n');

if (failedChecks > 0) {
  console.error(`❌ ${failedChecks} edge case checks failed!`);
  process.exit(1);
} else {
  console.log('✅ ALL EDGE CASE & ADVERSARIAL STRESS CHECKS PASSED CLEANLY');
  process.exit(0);
}
