// vitest.config.ts

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test file patterns
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: ['node_modules', 'dist'],
    
    // Global setup
    setupFiles: ['./vitest.setup.ts'],
    
    // Timeouts
    testTimeout: 15000,
    hookTimeout: 10000,
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/types.ts'],
    },
    
    // Globals
    globals: true,
    
    // Resolve aliases for chaincss imports
    alias: {
      'chaincss': path.resolve(__dirname, 'src/index.ts'),
      'chaincss/runtime': path.resolve(__dirname, 'src/runtime/index.ts'),
      'chaincss/compiler': path.resolve(__dirname, 'src/compiler/index.ts'),
      'chaincss/plugin/vite': path.resolve(__dirname, 'src/plugins/vite.ts'),
    },
  },
});