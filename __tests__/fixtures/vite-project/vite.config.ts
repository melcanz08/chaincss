import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import chaincss from '../../../src/plugins/vite.js';

export default defineConfig({
  plugins: [
    chaincss({
      atomic: true,
      verbose: false,
      hmr: false,
      injectGlobal: true,
    }),
    react(),
  ],
  root: __dirname,
});