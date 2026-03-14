// @ts-check
import { build } from 'esbuild';
import { copyFileSync } from 'fs';
import { execSync } from 'child_process';

const OUT = 'dist-ext';

// ── 1. React pages (popup + options) via Vite ─────────────────────────────────
console.log('\n[1/4] Building popup + options (Vite)…');
execSync('npx vite build --config vite.ext.config.ts', { stdio: 'inherit' });

// ── 2. Content script — IIFE (ESM imports not allowed in MV3 content scripts) ─
console.log('\n[2/4] Building content script (esbuild)…');
await build({
  entryPoints: ['src/content/index.ts'],
  bundle: true,
  format: 'iife',
  outfile: `${OUT}/content.js`,
  platform: 'browser',
  target: ['chrome120'],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.GEMINI_API_KEY': '""',
  },
  minify: true,
});
console.log('  ✓ content.js');

// ── 3. Background service worker — ESM (MV3 supports "type":"module") ─────────
console.log('\n[3/4] Building background service worker (esbuild)…');
await build({
  entryPoints: ['src/background/index.ts'],
  bundle: true,
  format: 'esm',
  outfile: `${OUT}/background.js`,
  platform: 'browser',
  target: ['chrome120'],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.GEMINI_API_KEY': '""',
  },
  minify: true,
});
console.log('  ✓ background.js');

// ── 4. manifest.json ───────────────────────────────────────────────────────────
console.log('\n[4/4] Copying manifest.json…');
copyFileSync('manifest.json', `${OUT}/manifest.json`);
console.log('  ✓ manifest.json');

console.log('\n✅  Extension built → dist-ext/');
console.log('    Load in Chrome:  chrome://extensions  →  Developer mode  →  Load unpacked  →  select dist-ext/\n');
