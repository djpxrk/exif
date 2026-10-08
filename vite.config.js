import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// Shown in Settings → About: the commit and the day the site was built.
const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'local'; } })();

// Cross-origin isolation lets the libraw-wasm fallback use threads in dev.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

// Every browser the app supports reads WOFF2, so Fontsource's WOFF fallbacks
// only double the size of the site and the iOS app. Drop them.
const woff2Only = {
  name: 'woff2-only',
  enforce: 'pre',
  transform(code, id) {
    if (!/@fontsource\/.*\.css$/.test(id)) return null;
    return code.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '');
  },
};

export default defineConfig({
  base: './',
  plugins: [woff2Only],
  define: { __BUILD__: JSON.stringify(`${commit} · ${new Date().toISOString().slice(0, 10)}`) },
  server: { headers: isolation },
  preview: { headers: isolation },
  optimizeDeps: { exclude: ['libraw-wasm'] },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
