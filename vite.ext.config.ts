import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Extension build — outputs to dist-ext/
// popup.html + options.html are compiled as separate React apps.
// content.js and background.js are built separately by build-ext.mjs (esbuild).
export default defineConfig({
  plugins: [react()],
  base: './', // Relative asset paths required for Chrome extensions
  build: {
    outDir: 'dist-ext',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup:   path.resolve(__dirname, 'popup.html'),
        options: path.resolve(__dirname, 'options.html'),
      },
    },
  },
  // No process.env.GEMINI_API_KEY define — extension uses chrome.storage.local
});
