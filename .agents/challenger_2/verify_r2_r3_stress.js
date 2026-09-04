const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../../');

console.log('========================================================================');
console.log('   CHALLENGER 2: EMPIRICAL STRESS TEST & VERIFICATION HARNESS (R2/R3)   ');
console.log('========================================================================\n');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failures = [];

function assert(condition, message, details = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedAssertions++;
    const errMsg = `  ❌ FAIL: ${message} ${details ? '(' + details + ')' : ''}`;
    console.error(errMsg);
    failures.push({ message, details });
  }
}

// ----------------------------------------------------------------------------
// SUITE 1: Ripgrep / Regex / String Search for Deprecated Attributes
// ----------------------------------------------------------------------------
console.log('--- Suite 1: Deprecated Slider Attribute & Property Sweeps ---');

function searchPattern(pattern, dirs, flags = '') {
  let matches = [];
  for (const d of dirs) {
    const targetDir = path.join(REPO_ROOT, d);
    if (!fs.existsSync(targetDir)) continue;
    try {
      const cmd = `grep -rn ${flags} "${pattern}" "${targetDir}"`;
      const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      if (out.trim()) {
        matches = matches.concat(out.trim().split('\n'));
      }
    } catch (e) {
      // Exit code 1 means no match, which is expected
    }
  }
  return matches;
}

const orientMatches = searchPattern('orient="vertical"', ['popup', 'options', 'content', 'utils', 'background']);
assert(orientMatches.length === 0, 'Zero occurrences of orient="vertical" in repo', `Found: ${orientMatches.join(', ')}`);

const orientSingleMatches = searchPattern("orient='vertical'", ['popup', 'options', 'content', 'utils', 'background']);
assert(orientSingleMatches.length === 0, 'Zero occurrences of orient=\'vertical\' in repo', `Found: ${orientSingleMatches.join(', ')}`);

const sliderVerticalMatches = searchPattern('slider-vertical', ['popup', 'options', 'content', 'utils', 'background']);
assert(sliderVerticalMatches.length === 0, 'Zero occurrences of slider-vertical in repo', `Found: ${sliderVerticalMatches.join(', ')}`);

const webkitSliderVertMatches = searchPattern('-webkit-appearance: slider-vertical', ['popup', 'options', 'content', 'utils', 'background', 'assets']);
assert(webkitSliderVertMatches.length === 0, 'Zero occurrences of -webkit-appearance: slider-vertical in CSS/HTML/JS', `Found: ${webkitSliderVertMatches.join(', ')}`);

const appearanceSliderVertMatches = searchPattern('appearance: slider-vertical', ['popup', 'options', 'content', 'utils', 'background', 'assets']);
assert(appearanceSliderVertMatches.length === 0, 'Zero occurrences of appearance: slider-vertical in CSS/HTML/JS', `Found: ${appearanceSliderVertMatches.join(', ')}`);

// Case insensitive sweep
const orientCaseMatches = searchPattern('orient=.*vertical', ['popup', 'options', 'content', 'utils', 'background'], '-i');
assert(orientCaseMatches.length === 0, 'Zero occurrences of case-insensitive orient=vertical in repo', `Found: ${orientCaseMatches.join(', ')}`);


// ----------------------------------------------------------------------------
// SUITE 2: EQ_PRESETS & EQ_FREQUENCIES Declarations (R1/R3 Cross-Check)
// ----------------------------------------------------------------------------
console.log('\n--- Suite 2: EQ_PRESETS & EQ_FREQUENCIES Declarations Check ---');

const eqPresetsContentMatches = searchPattern('const EQ_PRESETS\\|let EQ_PRESETS\\|var EQ_PRESETS', ['content']);
assert(eqPresetsContentMatches.length === 0, 'Zero EQ_PRESETS declarations in content/', `Found: ${eqPresetsContentMatches.join(', ')}`);

const eqFreqsContentMatches = searchPattern('EQ_FREQUENCIES', ['content', 'utils']);
assert(eqFreqsContentMatches.length === 0, 'Zero EQ_FREQUENCIES declarations in content/ and utils/', `Found: ${eqFreqsContentMatches.join(', ')}`);

const audioEngineContent = fs.readFileSync(path.join(REPO_ROOT, 'utils/audio-engine.js'), 'utf8');
const eqPresetsDeclMatches = (audioEngineContent.match(/const\s+EQ_PRESETS\s*=/g) || []);
assert(eqPresetsDeclMatches.length === 1, 'utils/audio-engine.js contains exactly 1 const EQ_PRESETS declaration', `Count: ${eqPresetsDeclMatches.length}`);

const windowEqPresetsMatch = audioEngineContent.includes('window._SS_EQ_PRESETS = EQ_PRESETS;');
assert(windowEqPresetsMatch, 'utils/audio-engine.js assigns window._SS_EQ_PRESETS = EQ_PRESETS');


// ----------------------------------------------------------------------------
// SUITE 3: HTML Parsing & Range Slider Validation in popup/popup.html
// ----------------------------------------------------------------------------
console.log('\n--- Suite 3: popup/popup.html Range Slider Parsing & Validation ---');

const popupHtmlPath = path.join(REPO_ROOT, 'popup/popup.html');
assert(fs.existsSync(popupHtmlPath), 'popup/popup.html exists');
const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');

// Check horizontal sliders in popup.html
const popVolMatch = popupHtml.match(/<input[^>]*id=["']pop-vol-slider["'][^>]*>/i);
assert(popVolMatch !== null, 'popup/popup.html contains pop-vol-slider');
if (popVolMatch) {
  assert(!popVolMatch[0].includes('orient='), 'pop-vol-slider has no orient attribute');
  assert(!popVolMatch[0].includes('slider-vertical'), 'pop-vol-slider does not use slider-vertical');
}

const popBassMatch = popupHtml.match(/<input[^>]*id=["']pop-bass-slider["'][^>]*>/i);
assert(popBassMatch !== null, 'popup/popup.html contains pop-bass-slider');
if (popBassMatch) {
  assert(!popBassMatch[0].includes('orient='), 'pop-bass-slider has no orient attribute');
  assert(!popBassMatch[0].includes('slider-vertical'), 'pop-bass-slider does not use slider-vertical');
}

// Regex to find all 10 EQ range sliders in popup.html
const popupEqSliderRegex = /<input[^>]*id=["']pop-eq-slider-\d+["'][^>]*>/gi;
const popupEqSliders = popupHtml.match(popupEqSliderRegex) || [];
assert(popupEqSliders.length === 10, 'popup/popup.html contains exactly 10 EQ range sliders', `Found: ${popupEqSliders.length}`);

const expectedFreqs = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

for (let i = 0; i < 10; i++) {
  const sliderStr = popupEqSliders[i] || '';
  const idMatch = sliderStr.match(/id=["']pop-eq-slider-(\d+)["']/i);
  const classMatch = sliderStr.match(/class=["']([^"']+)["']/i);
  const minMatch = sliderStr.match(/min=["']([^"']+)["']/i);
  const maxMatch = sliderStr.match(/max=["']([^"']+)["']/i);
  const stepMatch = sliderStr.match(/step=["']([^"']+)["']/i);
  const valMatch = sliderStr.match(/value=["']([^"']+)["']/i);
  const styleMatch = sliderStr.match(/style=["']([^"']+)["']/i);
  const orientMatch = sliderStr.match(/orient=/i);

  assert(idMatch && parseInt(idMatch[1], 10) === i, `popup EQ slider #${i} has id="pop-eq-slider-${i}"`, sliderStr);
  assert(classMatch && classMatch[1].includes('pop-eq-slider'), `popup EQ slider #${i} has class="pop-eq-slider"`, sliderStr);
  assert(minMatch && minMatch[1] === '-12', `popup EQ slider #${i} has min="-12"`, sliderStr);
  assert(maxMatch && maxMatch[1] === '12', `popup EQ slider #${i} has max="12"`, sliderStr);
  assert(stepMatch && (stepMatch[1] === '0.5' || stepMatch[1] === '1'), `popup EQ slider #${i} has step="0.5" or "1"`, sliderStr);
  assert(valMatch && valMatch[1] === '0', `popup EQ slider #${i} has initial value="0"`, sliderStr);
  assert(!orientMatch, `popup EQ slider #${i} does NOT have orient attribute`, sliderStr);
  assert(styleMatch && styleMatch[1].includes('writing-mode: vertical-lr') && styleMatch[1].includes('direction: rtl'),
    `popup EQ slider #${i} has inline style "writing-mode: vertical-lr; direction: rtl;"`, sliderStr);
  
  // Verify companion label elements exist
  const valSpanExists = popupHtml.includes(`id="pop-eq-val-${i}"`);
  assert(valSpanExists, `popup EQ slider #${i} companion value span id="pop-eq-val-${i}" exists in HTML`);
}


// ----------------------------------------------------------------------------
// SUITE 4: HTML Parsing & Range Slider Validation in options/options.html
// ----------------------------------------------------------------------------
console.log('\n--- Suite 4: options/options.html Range Slider Parsing & Validation ---');

const optionsHtmlPath = path.join(REPO_ROOT, 'options/options.html');
assert(fs.existsSync(optionsHtmlPath), 'options/options.html exists');
const optionsHtml = fs.readFileSync(optionsHtmlPath, 'utf8');

// Check horizontal sliders in options.html
const optVolMatch = optionsHtml.match(/<input[^>]*id=["']opt-vol-slider["'][^>]*>/i);
assert(optVolMatch !== null, 'options/options.html contains opt-vol-slider');
if (optVolMatch) {
  assert(!optVolMatch[0].includes('orient='), 'opt-vol-slider has no orient attribute');
  assert(!optVolMatch[0].includes('slider-vertical'), 'opt-vol-slider does not use slider-vertical');
}

const optBassMatch = optionsHtml.match(/<input[^>]*id=["']opt-bass-slider["'][^>]*>/i);
assert(optBassMatch !== null, 'options/options.html contains opt-bass-slider');
if (optBassMatch) {
  assert(!optBassMatch[0].includes('orient='), 'opt-bass-slider has no orient attribute');
  assert(!optBassMatch[0].includes('slider-vertical'), 'opt-bass-slider does not use slider-vertical');
}

const optSliderRegex = /<input[^>]*id=["']opt-eq-slider-\d+["'][^>]*>/gi;
const optSliders = optionsHtml.match(optSliderRegex) || [];
assert(optSliders.length === 10, 'options/options.html contains exactly 10 EQ range sliders', `Found: ${optSliders.length}`);

for (let i = 0; i < 10; i++) {
  const sliderStr = optSliders[i] || '';
  const idMatch = sliderStr.match(/id=["']opt-eq-slider-(\d+)["']/i);
  const classMatch = sliderStr.match(/class=["']([^"']+)["']/i);
  const minMatch = sliderStr.match(/min=["']([^"']+)["']/i);
  const maxMatch = sliderStr.match(/max=["']([^"']+)["']/i);
  const stepMatch = sliderStr.match(/step=["']([^"']+)["']/i);
  const valMatch = sliderStr.match(/value=["']([^"']+)["']/i);
  const styleMatch = sliderStr.match(/style=["']([^"']+)["']/i);
  const orientMatch = sliderStr.match(/orient=/i);

  assert(idMatch && parseInt(idMatch[1], 10) === i, `options slider #${i} has id="opt-eq-slider-${i}"`, sliderStr);
  assert(classMatch && classMatch[1].includes('opt-eq-slider'), `options slider #${i} has class="opt-eq-slider"`, sliderStr);
  assert(minMatch && minMatch[1] === '-12', `options slider #${i} has min="-12"`, sliderStr);
  assert(maxMatch && maxMatch[1] === '12', `options slider #${i} has max="12"`, sliderStr);
  assert(stepMatch && (stepMatch[1] === '0.5' || stepMatch[1] === '1'), `options slider #${i} has step="0.5" or "1"`, sliderStr);
  assert(valMatch && valMatch[1] === '0', `options slider #${i} has initial value="0"`, sliderStr);
  assert(!orientMatch, `options slider #${i} does NOT have orient attribute`, sliderStr);
  assert(styleMatch && styleMatch[1].includes('writing-mode: vertical-lr') && styleMatch[1].includes('direction: rtl'),
    `options slider #${i} has inline style "writing-mode: vertical-lr; direction: rtl;"`, sliderStr);

  const valSpanExists = optionsHtml.includes(`id="opt-eq-val-${i}"`);
  assert(valSpanExists, `options slider #${i} companion value span id="opt-eq-val-${i}" exists in HTML`);
}


// ----------------------------------------------------------------------------
// SUITE 5: Dynamic Slider Template in content/js/header-button.js
// ----------------------------------------------------------------------------
console.log('\n--- Suite 5: Dynamic Slider Template Validation in header-button.js ---');

const headerButtonJsPath = path.join(REPO_ROOT, 'content/js/header-button.js');
assert(fs.existsSync(headerButtonJsPath), 'content/js/header-button.js exists');
const headerButtonJs = fs.readFileSync(headerButtonJsPath, 'utf8');

assert(!headerButtonJs.includes('orient="vertical"'), 'header-button.js contains zero orient="vertical"');
assert(!headerButtonJs.includes('orient=\'vertical\''), 'header-button.js contains zero orient=\'vertical\'');
assert(!headerButtonJs.includes('slider-vertical'), 'header-button.js contains zero slider-vertical');

const dynamicSliderTemplateMatch = headerButtonJs.includes('class="ss-eq-slider"');
assert(dynamicSliderTemplateMatch, 'header-button.js contains .ss-eq-slider template generation');

const dynamicStyleMatch = headerButtonJs.includes('style="writing-mode: vertical-lr; direction: rtl;"');
assert(dynamicStyleMatch, 'header-button.js dynamically outputs style="writing-mode: vertical-lr; direction: rtl;"');


// ----------------------------------------------------------------------------
// SUITE 6: CSS Rules Inspection (.opt-eq-slider, .pop-eq-slider, .ss-eq-slider)
// ----------------------------------------------------------------------------
console.log('\n--- Suite 6: CSS Rules & Syntax Validation ---');

function extractCssRule(filePath, selector) {
  const content = fs.readFileSync(filePath, 'utf8');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}\\s*\\{([^\\}]+)\\}`, 'm');
  const match = content.match(regex);
  return match ? match[1] : null;
}

// 1. options/options.css
const optCssPath = path.join(REPO_ROOT, 'options/options.css');
const optRule = extractCssRule(optCssPath, '.opt-eq-slider');
assert(optRule !== null, 'options/options.css defines .opt-eq-slider rule block');
if (optRule) {
  assert(optRule.includes('writing-mode: vertical-lr'), '.opt-eq-slider includes writing-mode: vertical-lr');
  assert(optRule.includes('direction: rtl'), '.opt-eq-slider includes direction: rtl');
  assert(!optRule.includes('slider-vertical'), '.opt-eq-slider does not include slider-vertical');
  assert(!optRule.includes('-webkit-appearance: slider-vertical'), '.opt-eq-slider does not include -webkit-appearance: slider-vertical');
  assert(optRule.includes('cursor: pointer'), '.opt-eq-slider includes cursor: pointer');
  assert(optRule.includes('accent-color: #6366f1'), '.opt-eq-slider includes accent-color');
}

// 2. popup/popup.css
const popCssPath = path.join(REPO_ROOT, 'popup/popup.css');
const popRule = extractCssRule(popCssPath, '.pop-eq-slider');
assert(popRule !== null, 'popup/popup.css defines .pop-eq-slider rule block');
if (popRule) {
  assert(popRule.includes('writing-mode: vertical-lr'), '.pop-eq-slider includes writing-mode: vertical-lr');
  assert(popRule.includes('direction: rtl'), '.pop-eq-slider includes direction: rtl');
  assert(!popRule.includes('slider-vertical'), '.pop-eq-slider does not include slider-vertical');
  assert(!popRule.includes('-webkit-appearance: slider-vertical'), '.pop-eq-slider does not include -webkit-appearance: slider-vertical');
  assert(popRule.includes('cursor: pointer'), '.pop-eq-slider includes cursor: pointer');
  assert(popRule.includes('accent-color: #6366f1'), '.pop-eq-slider includes accent-color');
}

// 3. content/css/header-button.css
const headerCssPath = path.join(REPO_ROOT, 'content/css/header-button.css');
const ssRule = extractCssRule(headerCssPath, '.ss-eq-slider');
assert(ssRule !== null, 'content/css/header-button.css defines .ss-eq-slider rule block');
if (ssRule) {
  assert(ssRule.includes('writing-mode: vertical-lr'), '.ss-eq-slider includes writing-mode: vertical-lr');
  assert(ssRule.includes('direction: rtl'), '.ss-eq-slider includes direction: rtl');
  assert(!ssRule.includes('slider-vertical'), '.ss-eq-slider does not include slider-vertical');
  assert(!ssRule.includes('-webkit-appearance: slider-vertical'), '.ss-eq-slider does not include -webkit-appearance: slider-vertical');
  assert(ssRule.includes('cursor: pointer'), '.ss-eq-slider includes cursor: pointer');
  assert(ssRule.includes('accent-color: #6366f1'), '.ss-eq-slider includes accent-color');
}


// ----------------------------------------------------------------------------
// SUITE 7: Static JavaScript Syntax Check (node -c)
// ----------------------------------------------------------------------------
console.log('\n--- Suite 7: Static Syntax Check (node -c) on all JS files ---');

const { runSyntaxChecks } = require(path.join(REPO_ROOT, 'tests/syntax/syntax-checker.js'));
const syntaxResult = runSyntaxChecks({ verbose: false });
assert(syntaxResult.success === true, `syntax-checker.js returns success=true (${syntaxResult.passedCount}/${syntaxResult.totalChecked} clean)`);
assert(Array.isArray(syntaxResult.failedFiles) && syntaxResult.failedFiles.length === 0,
  `syntax-checker.js reports 0 failed files (actual: ${syntaxResult.failedFiles.length})`);


// ----------------------------------------------------------------------------
// SUITE 8: Isolated Test Runner Execution for All 4 Tiers
// ----------------------------------------------------------------------------
console.log('\n--- Suite 8: Automated Test Suite Execution (Tiers 1-4) ---');

const { setupMockEnv } = require(path.join(REPO_ROOT, 'tests/harness/mock-extension-env.js'));
mockEnv = setupMockEnv();

const TIER_DIRS = ['tier1', 'tier2', 'tier3', 'tier4'];
let totalTestsFound = 0;
let totalTestsPassed = 0;
let totalTestsFailed = 0;

global._testCollector = [];
global._pendingTestPromises = [];

async function runAllTiers() {
  for (const tier of TIER_DIRS) {
    const tierDir = path.join(REPO_ROOT, 'tests', tier);
    if (!fs.existsSync(tierDir)) continue;

    const files = fs.readdirSync(tierDir).filter(f => f.endsWith('.js')).sort();
    console.log(`\n  Running Tier ${tier.toUpperCase()} (${files.length} test files)...`);

    for (const file of files) {
      const fullPath = path.join(tierDir, file);
      const beforeCount = global._testCollector.length;
      global._pendingTestPromises = [];

      // Mute console logs during individual test execution to avoid clutter
      const origLog = console.log;
      const origWarn = console.warn;
      const origError = console.error;
      console.log = () => {};
      console.warn = () => {};
      console.error = () => {};

      try {
        await global.chrome.storage.local.clear();
        await global.chrome.storage.sync.clear();

        const exported = require(fullPath);
        if (typeof exported === 'function') {
          await exported();
        }
        if (global._pendingTestPromises.length > 0) {
          await Promise.all(global._pendingTestPromises);
          global._pendingTestPromises = [];
        }
      } catch (err) {
        global._testCollector.push({
          name: `File load: ${file}`,
          success: false,
          duration: 0,
          error: err
        });
      } finally {
        console.log = origLog;
        console.warn = origWarn;
        console.error = origError;
      }

      const fileResults = global._testCollector.slice(beforeCount);
      let filePassed = 0;
      let fileFailed = 0;

      for (const res of fileResults) {
        totalTestsFound++;
        if (res.success) {
          totalTestsPassed++;
          filePassed++;
        } else {
          totalTestsFailed++;
          fileFailed++;
          failures.push({ message: `Test failure in ${tier}/${file}: ${res.name}`, details: res.error ? res.error.message : 'Unknown' });
        }
      }
      console.log(`    ✓ [${tier}/${file}]: ${filePassed}/${fileResults.length} passed (failed: ${fileFailed})`);
    }
  }

  assert(totalTestsFailed === 0, `All automated tests pass with 0 failures (Passed: ${totalTestsPassed}, Failed: ${totalTestsFailed})`);
  assert(totalTestsPassed >= 331, `Total executed tests meets or exceeds expected 331 (Actual: ${totalTestsPassed})`);

  console.log('\n========================================================================');
  console.log('                 EMPIRICAL STRESS TEST SUMMARY REPORT                   ');
  console.log('========================================================================');
  console.log(`  Total Assertions Checked : ${totalAssertions}`);
  console.log(`  Total Assertions Passed  : ${passedAssertions}`);
  console.log(`  Total Assertions Failed  : ${failedAssertions}`);
  console.log(`  Automated Unit Tests Run : ${totalTestsPassed}/${totalTestsFound} passed`);
  console.log('========================================================================\n');

  if (failedAssertions > 0) {
    console.error('❌ STRESS TEST FAILED! Failures:');
    failures.forEach((f, i) => console.error(`  ${i + 1}. ${f.message} -> ${f.details}`));
    process.exit(1);
  } else {
    console.log('✅ ALL EMPIRICAL STRESS TESTS & VERIFICATIONS PASSED CLEANLY (100%)');
    process.exit(0);
  }
}

runAllTiers().catch(err => {
  console.error('Fatal harness error:', err);
  process.exit(1);
});
