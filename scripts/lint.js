#!/usr/bin/env node
/**
 * Linter: checks for security issues and common mistakes
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ERRORS = [];
const WARNINGS = [];

const checkFile = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // Check for hardcoded secrets
    if (/PRIVATE_KEY|private_key|SECRET|secret|APIKEY|apikey/.test(line) && !/env\.|\/\/|process\.env/.test(line)) {
      if (!/\.example|test\//.test(filePath)) {
        WARNINGS.push(`${filePath}:${lineNum} - Possible hardcoded secret: ${line.trim()}`);
      }
    }

    // Check for console.log in non-test source
    if (/console\.(log|debug)/.test(line) && !/test\//.test(filePath) && !/logger/.test(line)) {
      WARNINGS.push(`${filePath}:${lineNum} - Use logger instead of console.log: ${line.trim()}`);
    }

    // Check for direct process.env access outside safe places
    if (/process\.env\[/.test(line) && !/config\.js|server\.js/.test(filePath)) {
      WARNINGS.push(`${filePath}:${lineNum} - process.env access outside safe location: ${line.trim()}`);
    }
  });
};

const scanDir = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(entry.name)) {
        await scanDir(fullPath);
      }
    } else if (entry.name.endsWith('.js')) {
      await checkFile(fullPath);
    }
  }
};

async function lint() {
  console.log('[LINT] Starting linter...');
  try {
    await scanDir('src');
    await scanDir('test');
    await scanDir('scripts');

    if (ERRORS.length === 0 && WARNINGS.length === 0) {
      console.log('[LINT] ✓ No issues found');
      return;
    }

    if (ERRORS.length > 0) {
      console.error('[LINT] ✗ Errors:');
      ERRORS.forEach(e => console.error(`  ${e}`));
    }

    if (WARNINGS.length > 0) {
      console.warn('[LINT] ⚠ Warnings:');
      WARNINGS.forEach(w => console.warn(`  ${w}`));
    }

    if (ERRORS.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('[LINT] ✗ Linter failed:', error.message);
    process.exit(1);
  }
}

lint();
