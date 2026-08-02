// src/frameworks/core/adapter/factory.ts
// Adapter factory

import { RuntimeAdapter } from './types.js';
import { BrowserAdapter } from './browser-adapter.js';
import { SSRAdapter } from './ssr-adapter.js';

let currentAdapter: RuntimeAdapter | null = null;

/**
 * Create the appropriate runtime adapter based on environment
 */
export function createRuntimeAdapter(): RuntimeAdapter {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return new BrowserAdapter();
  }
  return new SSRAdapter();
}

/**
 * Get the current runtime adapter (singleton)
 */
export function getRuntimeAdapter(): RuntimeAdapter {
  if (!currentAdapter) {
    currentAdapter = createRuntimeAdapter();
  }
  return currentAdapter;
}

/**
 * Set a custom runtime adapter (for testing)
 */
export function setRuntimeAdapter(adapter: RuntimeAdapter): void {
  currentAdapter = adapter;
}

/**
 * Reset to default adapter
 */
export function resetRuntimeAdapter(): void {
  currentAdapter = null;
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return getRuntimeAdapter().isBrowser;
}
