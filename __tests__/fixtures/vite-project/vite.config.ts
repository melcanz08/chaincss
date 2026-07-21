// vite-project/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import chaincssVite from '../../../dist/plugins/vite.js'; 

export default defineConfig({
  plugins: [
    react(),
    chaincssVite() 
  ],
  optimizeDeps: {
    // Stop Vite from trying to pre-bundle these in this fixture context
    exclude: [
      'react', 
      'react-dom', 
      'react/jsx-dev-runtime', 
      'react/jsx-runtime'
    ]
  },
  server: {
    fs: {
      // Allow Vite to safely serve the real files from your root node_modules
      allow: ['../../..']
    }
  }
});