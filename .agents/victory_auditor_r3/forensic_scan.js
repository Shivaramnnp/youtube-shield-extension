const fs = require('fs');
const path = require('path');

const rootDir = '/Users/shivarampatel/Desktop/shorts-shield';

const results = {
  skippedTests: [],
  tautologicalAssertions: [],
  facadeFunctions: [],
  emptyTryCatch: [],
  hardcodedTestReturns: [],
  shortCircuits: []
};

function scanFile(filePath) {
  const relPath = path.relative(rootDir, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // 1. Test skipping detection
    if (/\b(it\.skip|describe\.skip|xit|xdescribe|test\.skip)\b/.test(trimmed) && !trimmed.startsWith('//')) {
      results.skippedTests.push({ file: relPath, line: lineNum, code: trimmed });
    }

    // 2. Tautological assertions
    if (/\b(assert\s*\(\s*true\s*\)|assert\.strictEqual\s*\(\s*true\s*,\s*true\s*\)|assert\.equal\s*\(\s*true\s*,\s*true\s*\)|expect\s*\(\s*true\s*\)\.to\w+\(\s*true\s*\))\b/.test(trimmed) && !trimmed.startsWith('//')) {
      results.tautologicalAssertions.push({ file: relPath, line: lineNum, code: trimmed });
    }
    if (/\bassert\s*\(\s*1\s*===\s*1\s*\)/.test(trimmed)) {
      results.tautologicalAssertions.push({ file: relPath, line: lineNum, code: trimmed });
    }

    // 3. Facade/stub detection in core code
    if (filePath.includes('/content/') || filePath.includes('/utils/') || filePath.includes('/background/') || filePath.includes('/options/') || filePath.includes('/popup/')) {
      if (/^\s*(function\s+\w+|const\s+\w+\s*=\s*(\(.*?\)|\[.*?\]|\w+)\s*=>)\s*\{\s*return\s+(true|false|null|0|""|''|\{\}|\[\]);\s*\}/.test(trimmed)) {
        results.facadeFunctions.push({ file: relPath, line: lineNum, code: trimmed });
      }
    }

    // 4. Empty try-catch blocks in test files
    if (filePath.includes('/tests/')) {
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(trimmed)) {
        results.emptyTryCatch.push({ file: relPath, line: lineNum, code: trimmed });
      }
    }

    // 5. Short-circuit exits in test files
    if (filePath.includes('/tests/') && !filePath.includes('syntax-checker')) {
      if (/process\.exit\(0\)/.test(trimmed) && !trimmed.startsWith('//')) {
        results.shortCircuits.push({ file: relPath, line: lineNum, code: trimmed });
      }
    }
  });
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.agents' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      scanFile(fullPath);
    }
  }
}

walkDir(rootDir);
console.log(JSON.stringify(results, null, 2));
