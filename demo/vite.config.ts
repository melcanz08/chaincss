import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import chaincss from '../src/plugins/vite.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chaincssRoot = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [
    // ChainCSS plugin with proper build-time extraction
    chaincss({
      atomic: true,
      verbose: true,        // Show what's happening
      injectGlobal: true,   // Auto-inject CSS
      sourceComments: true, // Show source in generated CSS
      prefix: false,
      breakpoints: {
        sm: '(max-width: 640px)',
        md: '(max-width: 768px)',
        lg: '(max-width: 1024px)',
      },
    }),
    react(),
  ],
  root: __dirname,
  resolve: {
    alias: [
      { find: 'chaincss/runtime', replacement: path.resolve(chaincssRoot, 'src/runtime/index.ts') },
      { find: 'chaincss/plugin/vite', replacement: path.resolve(chaincssRoot, 'src/plugins/vite.ts') },
      { find: 'chaincss', replacement: path.resolve(__dirname, 'src/chaincss-barrel.ts') },
      { find: 'caniuse-db/fulldata-json/data-2.0.json', replacement: path.resolve(__dirname, 'node_modules/caniuse-db/fulldata-json/data-2.0.json') },
      { find: 'autoprefixer', replacement: path.resolve(__dirname, 'node_modules/autoprefixer/index.js') },
      { find: 'vue', replacement: path.resolve(__dirname, 'node_modules/vue/index.js') },
      { find: 'svelte/store', replacement: path.resolve(__dirname, 'node_modules/svelte/store/index.js') },
      { find: 'svelte', replacement: path.resolve(__dirname, 'node_modules/svelte/index.js') },
    ],
  },
  define: { 'process.env': JSON.stringify({ NODE_ENV: 'development' }) },
  optimizeDeps: { exclude: ['vue', 'svelte', 'svelte/store'] },
  server: { 
    fs: { allow: [__dirname, chaincssRoot] },
    hmr: { overlay: false },
  },
});