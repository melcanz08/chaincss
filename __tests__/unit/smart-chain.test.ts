import { describe, it, expect } from 'vitest';
import { smartChain, buildChain, runtimeChain } from '../../src/core/smart-chain.js';
import { AutoDetector, autoDetector } from '../../src/core/auto-detector.js';

describe('Smart Chain — Auto Detection', () => {
  describe('smartChain()', () => {
    it('should return a chain proxy', () => {
      const chain = smartChain();
      expect(chain).toBeDefined();
      expect(typeof chain.$el).toBe('function');
    });

    it('should produce style output', () => {
      const result = smartChain()
        .display('flex')
        .padding(20)
        .color('red')
        .$el('test');
      expect(result).toBeDefined();
      expect(result.selectors).toBeDefined();
    });

    it('should mark static-only chains', () => {
      const result = smartChain()
        .display('flex')
        .padding(20)
        .$el('static-test');
      // Static-only should work without error
      expect(result.selectors).toContain('static-test');
    });
  });

  describe('buildChain()', () => {
    it('should force build mode', () => {
      const result = buildChain()
        .display('flex')
        .color('red')
        .$el('build-test');
      expect(result.selectors).toContain('build-test');
    });
  });

  describe('runtimeChain()', () => {
    it('should force runtime mode', () => {
      const result = runtimeChain()
        .display('flex')
        .color('red')
        .$el('runtime-test');
      expect(result._name).toBeDefined();
    });
  });

  describe('chainability', () => {
    it('should support multiple chained calls', () => {
      const result = smartChain()
        .display('flex')
        .padding(20)
        .gap(16)
        .bg('white')
        .rounded(12)
        .$el('chained');
      expect(result.display).toBe('flex');
      expect(result.padding).toBe('20px');
    });

    it('should support hover via $el nesting', () => {
      const result = smartChain()
        .color('red')
        .hover()
        .color('blue')
        .end()
        .$el('hover-test');
      expect(result.color).toBe('red');
      expect(result.hover).toBeDefined();
    });
  });
});

describe('AutoDetector', () => {
  describe('detectValueType', () => {
    it('should detect static strings', () => {
      expect(autoDetector.detectValueType('red')).toBe('static');
      expect(autoDetector.detectValueType('#ff0000')).toBe('static');
      expect(autoDetector.detectValueType('10px')).toBe('static');
    });

    it('should detect static numbers', () => {
      expect(autoDetector.detectValueType(20)).toBe('static');
      expect(autoDetector.detectValueType(1.5)).toBe('static');
    });

    it('should detect functions as runtime-only', () => {
      expect(autoDetector.detectValueType(() => 'red')).toBe('runtime-only');
    });

    it('should detect objects as dynamic', () => {
      expect(autoDetector.detectValueType({ color: 'red' })).toBe('dynamic');
    });
  });

  describe('analyzeChain', () => {
    it('should classify all-static chains as build mode', () => {
      const result = autoDetector.analyzeChain([
        { prop: 'display', value: 'flex', index: 0 },
        { prop: 'padding', value: 20, index: 1 },
      ]);
      expect(result.mode).toBe('build');
    });

    it('should classify mixed chains as hybrid', () => {
      const result = autoDetector.analyzeChain([
        { prop: 'display', value: 'flex', index: 0 },
        { prop: 'color', value: () => 'red', index: 1 },
      ]);
      expect(result.mode).toBe('hybrid');
      expect(result.isHybrid).toBe(true);
    });
  });
});