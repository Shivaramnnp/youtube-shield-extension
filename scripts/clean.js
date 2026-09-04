#!/usr/bin/env node
/**
 * Clean Script for YouTube Shield
 * Removes temporary test logs, caches, and build artifacts.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const TARGET_PATTERNS = [
  'dist',
  'test-run.log',
  'test_out.txt',
  'test_output.log',
  'test_output.tmp'
];

console.log('🧹 Cleaning workspace artifacts...\n');

TARGET_PATTERNS.forEach(relPath => {
  const fullPath = path.resolve(ROOT_DIR, relPath);
  if (fs.existsSync(fullPath)) {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`  ✓ Removed directory: ${relPath}/`);
    } else {
      fs.unlinkSync(fullPath);
      console.log(`  ✓ Removed file: ${relPath}`);
    }
  }
});

console.log('\n✨ Workspace cleaned!\n');
