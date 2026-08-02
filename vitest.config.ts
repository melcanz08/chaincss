// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 15000,
    hookTimeout: 10000,
    globals: true,

    // 🚀 Fixed Thread Scheduling for Dual-Core Architectures
    isolate: false,
    fileParallelism: true, 
    // Force 1 worker directly without dynamic pool calculations to avoid tinypool conflict
    maxWorkers: 1,
    minWorkers: 1,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/types.ts'],
    },

    alias: [
      { find: 'chaincss', replacement: path.resolve(__dirname, 'src/index.ts') },
      { find: 'chaincss/runtime', replacement: path.resolve(__dirname, 'src/frameworks/index.ts') },
      { find: 'chaincss/compiler', replacement: path.resolve(__dirname, 'src/compiler/index.ts') },
      { find: 'chaincss/plugin/vite', replacement: path.resolve(__dirname, 'src/frameworks/build-tools/vite/index.ts') },
      
      { find: /^@core\/(.*)$/, replacement: path.resolve(__dirname, 'src/core/$1') },
      { find: /^@compiler\/(.*)$/, replacement: path.resolve(__dirname, 'src/compiler/$1') },
      { find: /^@adapters\/(.*)$/, replacement: path.resolve(__dirname, 'src/adapters/$1') },
      { find: /^@shared\/(.*)$/, replacement: path.resolve(__dirname, 'src/shared/$1') },
      { find: /^@frameworks\/(.*)$/, replacement: path.resolve(__dirname, 'src/frameworks/$1') },
      
      { find: '@core', replacement: path.resolve(__dirname, 'src/core') },
      { find: '@compiler', replacement: path.resolve(__dirname, 'src/compiler') },
      { find: '@adapters', replacement: path.resolve(__dirname, 'src/adapters') },
      { find: '@shared', replacement: path.resolve(__dirname, 'src/shared') },
      // 🚀 Fixed typo: path.replace changed back to path.resolve
      { find: '@frameworks', replacement: path.resolve(__dirname, 'src/frameworks') },
    ],
  },
});
