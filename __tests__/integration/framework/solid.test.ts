// __tests__/integration/framework/solid.test.ts
// Tests for ChainCSS SolidJS Runtime

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the injector
vi.mock('@frameworks/core/injector.js', () => ({
  compileRuntime: vi.fn((styles: Record<string, any>, moduleId: string) => {
    const result: Record<string, string> = {};
    for (const key of Object.keys(styles)) {
      result[key] = `chaincss-${key}-${moduleId}`;
    }
    return result;
  }),
  removeRuntimeModule: vi.fn(),
  styleInjector: {
    setTokens: vi.fn(),
    getTokens: vi.fn(() => ({})),
  },
  setManifest: vi.fn(),
  setTokens: vi.fn(),
}));

import { setTokens as injectorSetTokens } from '@frameworks/core/injector.js';
import {
  cx,
  setTokens,
  enableSolidDebug,
  disableSolidDebug,
  isSolidDebugEnabled,
} from '@frameworks/solid/index.js';

// Ensure window exists for debug tests (vitest with jsdom provides it)
const win = typeof window !== 'undefined' ? window : (globalThis as any);

describe('Solid Runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof win !== 'undefined') {
      delete win.__CHAINCSS_SOLID_DEBUG__;
    }
  });

  describe('cx utility', () => {
    it('joins string arguments', () => {
      expect(cx('foo', 'bar')).toBe('foo bar');
    });

    it('filters falsy values', () => {
      expect(cx('foo', null, undefined, false, 'bar')).toBe('foo bar');
    });

    it('handles object with boolean values', () => {
      expect(cx('base', { active: true, disabled: false })).toBe('base active');
    });

    it('handles multiple objects', () => {
      expect(cx({ active: true }, { disabled: false, large: true }))
        .toBe('active large');
    });

    it('returns empty string for no arguments', () => {
      expect(cx()).toBe('');
    });
  });

  describe('setTokens', () => {
    it('calls the injector setTokens', () => {
      setTokens({ primary: '#1a73e8' });

      expect(injectorSetTokens).toHaveBeenCalledWith({ primary: '#1a73e8' });
    });
  });

  describe('debug utilities', () => {
    it('enableSolidDebug sets debug mode on', () => {
      disableSolidDebug();
      enableSolidDebug();
      expect(isSolidDebugEnabled()).toBe(true);
    });

    it('disableSolidDebug sets debug mode off', () => {
      enableSolidDebug();
      disableSolidDebug();
      expect(isSolidDebugEnabled()).toBe(false);
    });

    it('isSolidDebugEnabled returns correct state', () => {
      disableSolidDebug();
      expect(isSolidDebugEnabled()).toBe(false);

      enableSolidDebug();
      expect(isSolidDebugEnabled()).toBe(true);
    });
  });

  describe('Type exports', () => {
    it('exports all expected symbols', async () => {
      const solid = await import('@frameworks/solid/index.js');

      expect(solid.useAtomicClasses).toBeDefined();
      expect(solid.styled).toBeDefined();
      expect(solid.createStyledComponents).toBeDefined();
      expect(solid.useComputedStyles).toBeDefined();
      expect(solid.useDynamicStyles).toBeDefined();
      expect(solid.ChainCSSProvider).toBeDefined();
      expect(solid.useChainCSSContext).toBeDefined();
      expect(solid.setManifest).toBeDefined();
      expect(solid.setTokens).toBeDefined();
      expect(solid.cx).toBeDefined();
      expect(solid.withChainStyles).toBeDefined();
      expect(solid.createReactiveStyles).toBeDefined();
    });
  });
});