/**
 * Static Syntax Checker for Shorts Shield.
 * Programmatically verifies JavaScript syntax across all source and test files using `node -c`.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../');

const SOURCE_DIRS = [
  'background',
  'content',
  'options',
  'popup',
  'utils',
  'tests'
];

const INDIVIDUAL_FILES = [
  'run-tests.js'
];

function getAllJsFiles(dirPath) {
  let results = [];
  if (!fs.existsSync(dirPath)) return results;

  const list = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

function collectTargetFiles() {
  const files = new Set();

  for (const relDir of SOURCE_DIRS) {
    const fullDir = path.join(PROJECT_ROOT, relDir);
    const found = getAllJsFiles(fullDir);
    found.forEach(f => files.add(f));
  }

  for (const relFile of INDIVIDUAL_FILES) {
    const fullFile = path.join(PROJECT_ROOT, relFile);
    if (fs.existsSync(fullFile)) {
      files.add(fullFile);
    }
  }

  return Array.from(files).sort();
}

function runSyntaxChecks(options = { verbose: true }) {
  const targetFiles = collectTargetFiles();
  const failedFiles = [];
  let passedCount = 0;

  if (options.verbose) {
    console.log(`\n🔍 Phase 1: Static Syntax Validation (node -c)`);
    console.log(`Scanning ${targetFiles.length} JavaScript file(s)...\n`);
  }

  for (const filePath of targetFiles) {
    const relPath = path.relative(PROJECT_ROOT, filePath);
    const result = spawnSync(process.execPath, ['-c', filePath], { encoding: 'utf-8' });

    if (result.status === 0) {
      passedCount++;
      if (options.verbose) {
        console.log(`  ✓ [SYNTAX OK] ${relPath}`);
      }
    } else {
      const errorOutput = (result.stderr || result.stdout || 'Unknown syntax error').trim();
      failedFiles.push({ path: relPath, fullPath: filePath, error: errorOutput });
      if (options.verbose) {
        console.error(`  ❌ [SYNTAX ERROR] ${relPath}`);
        console.error(`     ${errorOutput.split('\n').join('\n     ')}`);
      }
    }
  }

  const success = failedFiles.length === 0;

  if (options.verbose) {
    console.log(`\n--- Syntax Check Summary ---`);
    console.log(`Total Checked : ${targetFiles.length}`);
    console.log(`Passed        : ${passedCount}`);
    console.log(`Failed        : ${failedFiles.length}`);
    if (!success) {
      console.error(`\n❌ Syntax validation failed in ${failedFiles.length} file(s).`);
    } else {
      console.log(`\n✅ All ${passedCount} JavaScript files passed syntax check cleanly.\n`);
    }
  }

  return {
    success,
    totalChecked: targetFiles.length,
    passedCount,
    failedFiles
  };
}

if (require.main === module) {
  const result = runSyntaxChecks({ verbose: true });
  process.exit(result.success ? 0 : 1);
}

module.exports = {
  runSyntaxChecks,
  collectTargetFiles
};
