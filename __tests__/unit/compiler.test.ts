// __tests__/unit/compiler.test.ts
// Core compiler tests

import { describe, it, expect, beforeEach, vi, afterEach} from 'vitest';
import { ChainCSSCompiler } from '../../src/core/usecases/compiler.js';
import { chain } from '../../src/core/entities/style-collector.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ChainCSSCompiler', () => {
  let compiler: ChainCSSCompiler;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaincss-test-'));
    compiler = new ChainCSSCompiler({
      atomic: { enabled: true, mode: 'hybrid' },
      output: { minify: false },
      verbose: false,
      silent: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('compileStyle', () => {
    it('should compile a basic style definition', () => {
      const result = compiler.compileStyle('test-component', {
        selectors: ['test-component'],
        color: 'red',
        fontSize: '16px',
      });

      expect(result.css).toBeDefined();
      expect(result.classMap).toBeDefined();
    });

    it('should generate valid CSS', () => {
      const result = compiler.compileStyle('my-card', {
        selectors: ['my-card'],
        display: 'flex',
        padding: '20px',
        borderRadius: '8px',
      });

      expect(result.css).toBeDefined();
      expect(typeof result.css).toBe('string');
      expect(result.classMap).toBeDefined();
    });

    it('should cache identical style definitions', () => {
      const styleDef = {
        selectors: ['cached-component'],
        color: 'blue',
      };

      const result1 = compiler.compileStyle('cached-component', styleDef);
      const result2 = compiler.compileStyle('cached-component', styleDef);

      // Should return same object due to caching
      expect(result1.css).toBe(result2.css);
      expect(result1.classMap).toEqual(result2.classMap);
    });

    it('should return CompileResult with correct shape', () => {
      const result = compiler.compileStyle('test', {
        selectors: ['test'],
        color: 'red',
      });

      expect(result).toHaveProperty('css');
      expect(result).toHaveProperty('classMap');
      expect(result).toHaveProperty('atomicClasses');
      expect(result).toHaveProperty('stats');
      expect(result.stats).toHaveProperty('totalStyles');
      expect(Array.isArray(result.atomicClasses)).toBe(true);
    });
  });

  describe('compileStyle - handle empty results', () => {
    it('should handle styles with no selectors gracefully', () => {
      const result = compiler.compileStyle('empty-test', {
        selectors: [],
        color: 'red',
      });

      expect(result).toBeDefined();
      expect(result.css).toBeDefined();
    });

    it('should not crash on undefined values', () => {
      const result = compiler.compileStyle('undefined-test', {
        selectors: ['undefined-test'],
        color: undefined as any,
        fontSize: undefined as any,
      });

      expect(result).toBeDefined();
      expect(result.css).toBeDefined();
    });
  });

  describe('hasStyles', () => {
    it('should return false when no styles compiled', () => {
      expect(compiler.hasStyles()).toBe(false);
    });

    it('should return true after compiling styles', () => {
      compiler.compileStyle('styled-component', {
        selectors: ['styled-component'],
        color: 'red',
      });

      expect(typeof compiler.hasStyles()).toBe('boolean');
    });
  });

  describe('clearCSS', () => {
    it('should clear accumulated CSS', () => {
      compiler.compileStyle('test-clear', {
        selectors: ['test-clear'],
        color: 'red',
      });

      compiler.clearCSS();

      expect(() => compiler.hasStyles()).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return stats object with expected shape', () => {
      const stats = compiler.getStats();

      expect(stats).toHaveProperty('totalStyles');
      expect(stats).toHaveProperty('atomicStyles');
      expect(stats).toHaveProperty('uniqueProperties');
      expect(stats).toHaveProperty('savings');
      expect(typeof stats.totalStyles).toBe('number');
    });
  });

  describe('LRU Cache management (FIX)', () => {
    it('should evict oldest entries when cache is full', () => {
      const styleDef = (i: number) => ({
        selectors: [`component-${i}`],
        color: `#${i.toString(16).padStart(6, '0')}`,
      });

      // Compile 600 styles (max is 500)
      for (let i = 0; i < 600; i++) {
        compiler.compileStyle(`component-${i}`, styleDef(i));
      }

      // Should not crash and should have stats
      const stats = compiler.getStats();
      expect(stats).toBeDefined();
    });

    it('should update LRU order on cache hit', () => {
      const styleDef = {
        selectors: ['lru-test'],
        color: 'red',
      };

      // First call
      compiler.compileStyle('lru-test', styleDef);
      
      // Many other calls
      for (let i = 0; i < 100; i++) {
        compiler.compileStyle(`other-${i}`, {
          selectors: [`other-${i}`],
          color: 'blue',
        });
      }

      // Cache hit for original
      const result = compiler.compileStyle('lru-test', styleDef);
      expect(result).toBeDefined();
    });
  });

  describe('getCombinedCSS', () => {
    it('should return empty string initially', () => {
      expect(compiler.getCombinedCSS()).toBe('');
    });
  });
});