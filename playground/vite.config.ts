import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: [
      { find: '@core', replacement: path.resolve(__dirname, '../src/core') },
      { find: '@compiler', replacement: path.resolve(__dirname, '../src/compiler') },
      { find: '@adapters', replacement: path.resolve(__dirname, '../src/adapters') },
      { find: '@shared', replacement: path.resolve(__dirname, '../src/shared') },
      { find: '@frameworks', replacement: path.resolve(__dirname, '../src/frameworks') },
      { find: 'chaincss', replacement: path.resolve(__dirname, '../src/playground-entry.ts') },
    ],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
  },
  define: {
    // Polyfill process.env for the browser
    'process.env': JSON.stringify({ NODE_ENV: 'production' }),
    // Polyfill process itself
    'process': JSON.stringify({ env: { NODE_ENV: 'production' } }),
  },
});