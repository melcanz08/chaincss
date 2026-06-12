import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'chaincss': path.resolve(__dirname, '../src/browser-entry.ts'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
    'process.env.DEBUG': JSON.stringify(''),
  },
});
