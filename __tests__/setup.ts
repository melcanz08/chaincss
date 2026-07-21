// __tests__/setup.ts
// ChainCSS test environment setup

import { vi } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock __dirname for ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set fixture path
export const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// Mock helpers for consistent tests
vi.mock('chalk', () => ({
  default: {
    blue: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
    cyan: (s: string) => s,
    gray: (s: string) => s,
    magenta: (s: string) => s,
  },
}));

// Reset modules between tests
beforeEach(() => {
  vi.resetModules();
});