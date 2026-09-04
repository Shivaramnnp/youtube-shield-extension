#!/usr/bin/env node

/**
 * Master E2E CLI Test Runner for Shorts Shield.
 * Executes Phase 1 (Syntax Validation), Phase 2 (Mock Setup),
 * Phase 3 (Suite Execution for Tiers 1-4), and Phase 4 (Summary & Exit Determination).
 */

const fs = require('node:fs');
const path = require('node:path');
const { runSyntaxChecks } = require('./tests/syntax/syntax-checker');
const { setupMockEnv } = require('./tests/harness/mock-extension-env');

const TIER_DIRS = ['tier1', 'tier2', 'tier3', 'tier4'];

async function runMasterTestSuite() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('       SHORTS SHIELD E2E TEST RUNNER & HARNESS SUITE            ');
  console.log('================================================================');

  // PHASE 1: Static Syntax Check across all JS files
  const syntaxResult = runSyntaxChecks({ verbose: true });
  if (!syntaxResult.success) {
    console.error('\n❌ Phase 1 Failed: Syntax errors detected in codebase.');
    console.error('Aborting test execution.\n');
    process.exit(1);
  }

  // PHASE 2: Initialize Mock Extension & Browser DOM Environment
  console.log('⚙️  Phase 2: Initializing Mock Extension & DOM Environment...');
  const mockEnv = setupMockEnv();
  console.log('   ✓ Chrome MV3 APIs (storage.sync, storage.local, runtime, tabs, scripting) initialized.');
  console.log('   ✓ Browser DOM Environment (window, document, DOMParser, MutationObserver) initialized.\n');

  // PHASE 3: Suite Discovery & Execution
  console.log('🚀 Phase 3: Discovering and Executing Test Suites (Tiers 1-4)...\n');

  global._testCollector = [];
  global._pendingTestPromises = [];

  const tierSummary = {
    tier1: { total: 0, passed: 0, failed: 0, files: 0 },
    tier2: { total: 0, passed: 0, failed: 0, files: 0 },
    tier3: { total: 0, passed: 0, failed: 0, files: 0 },
    tier4: { total: 0, passed: 0, failed: 0, files: 0 }
  };

  let totalTestsExecuted = 0;
  let totalTestsPassed = 0;
  let totalTestsFailed = 0;
  const failureDetails = [];

  for (const tier of TIER_DIRS) {
    const tierDir = path.join(__dirname, 'tests', tier);
    if (!fs.existsSync(tierDir)) {
      continue;
    }

    const files = fs.readdirSync(tierDir)
      .filter(f => f.endsWith('.js'))
      .sort();

    if (files.length === 0) {
      continue;
    }

    console.log(`----------------------------------------------------------------`);
    console.log(`📁 Executing ${tier.toUpperCase()} Suites (${files.length} file(s))`);
    console.log(`----------------------------------------------------------------`);

    for (const file of files) {
      const fullPath = path.join(tierDir, file);
      const relPath = path.relative(__dirname, fullPath);
      tierSummary[tier].files++;

      console.log(`\n  📄 Suite File: ${relPath}`);
      const beforeCount = global._testCollector.length;
      global._pendingTestPromises = [];

      try {
        // Reset storage & DOM before requiring each test file
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
      } catch (fileErr) {
        console.error(`  ❌ Failed loading/executing ${file}: ${fileErr.message}`);
        global._testCollector.push({
          name: `File Execution: ${file}`,
          success: false,
          duration: 0,
          error: fileErr
        });
      }

      const fileResults = global._testCollector.slice(beforeCount);
      for (const res of fileResults) {
        tierSummary[tier].total++;
        totalTestsExecuted++;
        if (res.success) {
          tierSummary[tier].passed++;
          totalTestsPassed++;
          console.log(`    ✓ ${res.name} (${res.duration}ms)`);
        } else {
          tierSummary[tier].failed++;
          totalTestsFailed++;
          failureDetails.push({ file: relPath, testName: res.name, error: res.error });
          console.error(`    ❌ ${res.name} (${res.duration}ms): ${res.error ? res.error.message : 'Failed'}`);
        }
      }
    }
    console.log('');
  }

  const totalDuration = Date.now() - startTime;

  // PHASE 4: Summary & Exit Determination
  console.log('================================================================');
  console.log('                   E2E TEST SUMMARY REPORT                      ');
  console.log('================================================================');
  console.log(`  Phase 1 Syntax Validation : PASS (${syntaxResult.passedCount}/${syntaxResult.totalChecked} clean)`);
  console.log(`  Phase 2 Environment Mock  : PASS (Chrome MV3 + DOM)`);
  console.log(`  Phase 3 Suites Executed   : ${totalTestsExecuted} test(s) across 4 tiers`);
  console.log('');
  console.log(`  Tier 1 (Core Logic)      : ${tierSummary.tier1.passed}/${tierSummary.tier1.total} passed (${tierSummary.tier1.files} files)`);
  console.log(`  Tier 2 (Boundaries)      : ${tierSummary.tier2.passed}/${tierSummary.tier2.total} passed (${tierSummary.tier2.files} files)`);
  console.log(`  Tier 3 (Interactions)    : ${tierSummary.tier3.passed}/${tierSummary.tier3.total} passed (${tierSummary.tier3.files} files)`);
  console.log(`  Tier 4 (Real-World E2E)  : ${tierSummary.tier4.passed}/${tierSummary.tier4.total} passed (${tierSummary.tier4.files} files)`);
  console.log('----------------------------------------------------------------');
  console.log(`  Total Executed           : ${totalTestsExecuted}`);
  console.log(`  Total Passed             : ${totalTestsPassed}`);
  console.log(`  Total Failed             : ${totalTestsFailed}`);
  console.log(`  Duration                 : ${totalDuration} ms`);
  console.log('================================================================');

  if (failureDetails.length > 0) {
    console.error('\n❌ FAILURE DETAILS:');
    failureDetails.forEach((f, idx) => {
      console.error(`  ${idx + 1}. [${f.file}] ${f.testName}`);
      console.error(`     Error: ${f.error ? f.error.message : 'Unknown failure'}`);
    });
    console.error('\n❌ OVERALL TEST SUITE RESULT: FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ OVERALL TEST SUITE RESULT: ALL PASSED CLEANLY');
    process.exit(0);
  }
}

if (require.main === module) {
  runMasterTestSuite().catch(err => {
    console.error('Fatal error during test runner execution:', err);
    process.exit(1);
  });
}

module.exports = {
  runMasterTestSuite
};
