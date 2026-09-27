#!/usr/bin/env node
/**
 * Simple build script (no transpilation needed for Node.js ES modules)
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const distDir = 'dist';

async function build() {
  console.log('[BUILD] Starting build...');

  try {
    // Create dist directory
    await fs.mkdir(distDir, { recursive: true });
    console.log('[BUILD] dist/ created');

    // Copy all .js files from src/
    const copyDir = async (src, dest) => {
      const entries = await fs.readdir(src, { withFileTypes: true });
      await fs.mkdir(dest, { recursive: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          await copyDir(srcPath, destPath);
        } else if (entry.name.endsWith('.js')) {
          await fs.copyFile(srcPath, destPath);
        }
      }
    };

    await copyDir('src', distDir);
    console.log('[BUILD] Source files copied to dist/');
    console.log('[BUILD] ✓ Build complete');
  } catch (error) {
    console.error('[BUILD] ✗ Build failed:', error.message);
    process.exit(1);
  }
}

build();
