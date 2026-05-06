// vitest.setup.ts
// Global test setup for ChainCSS

import { beforeAll, afterAll, vi } from 'vitest';

// Suppress console noise during tests unless explicitly wanted
const originalConsole = { ...console };

beforeAll(() => {
  // Silence chalk and verbose output in tests
  process.env.FORCE_COLOR = '0';
  
  // Redirect console.log to debug unless CHAINCSS_TEST_VERBOSE is set
  if (!process.env.CHAINCSS_TEST_VERBOSE) {
    console.log = vi.fn();
    console.info = vi.fn();
  }
  
  // Keep warnings and errors visible
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

afterAll(() => {
  // Restore console
  console.log = originalConsole.log;
  console.info = originalConsole.info;
});