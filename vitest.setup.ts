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
// Show metrics after tests
import { defaultMetrics } from './src/compiler/metrics/index.js';

afterAll(() => {
  const snapshot = defaultMetrics.snapshot();
  const hasData = Object.values(snapshot.counters).some(v => v > 0) || 
                  snapshot.timers.completed.length > 0;
  
  if (hasData) {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              📊 Test Metrics                                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`  Total Duration: ${snapshot.timers.totalDuration.toFixed(2)}ms`);
    console.log(`  Pipeline Passes: ${snapshot.counters.pipeline_passes_run || 0}`);
    console.log(`  Rules Compiled: ${snapshot.counters.rules_compiled || 0}`);
    console.log('');
  }
});
