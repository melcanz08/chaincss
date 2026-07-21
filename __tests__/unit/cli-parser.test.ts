import { describe, it, expect } from 'vitest';
import { parseStyleObject } from '../../src/core/types.js';

interface MinimistParsed {
  _: string[];
  [key: string]: any;
}

function resolveCliArguments(argv: MinimistParsed, fallbackConfig: Record<string, any> = {}): Record<string, any> {
  const result: Record<string, any> = { ...fallbackConfig };

  if (argv._ && argv._.length > 0) {
    result.inputs = argv._.map(String);
  }

  for (const [key, value] of Object.entries(argv)) {
    if (key === '_') continue;

    if (value === 'true' || value === true) {
      result[key] = true;
    } else if (value === 'false' || value === false) {
      result[key] = false;
    } else if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
      result[key] = Number(value);
    } else if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }

  return result;
}

describe('CLI Parser Configuration Engine', () => {
  const mockFallback = {
    minify: false,
    atomic: { enabled: true, mode: 'standard' },
    cachePath: '.chaincss/cache',
    threshold: 5,
    framework: 'auto'
  };

  describe('Boolean Flag Primitives', () => {
    it('should correctly parse true boolean values and literal strings', () => {
      const explicitTrue = resolveCliArguments({ _: [], minify: true }, mockFallback);
      const stringTrue = resolveCliArguments({ _: [], minify: 'true' }, mockFallback);

      expect(explicitTrue.minify).toBe(true);
      expect(stringTrue.minify).toBe(true);
    });

    it('should correctly parse false boolean flags and override default true settings', () => {
      const defaultTrueFallback = { verbose: true };
      const explicitFalse = resolveCliArguments({ _: [], verbose: false }, defaultTrueFallback);
      const stringFalse = resolveCliArguments({ _: [], verbose: 'false' }, defaultTrueFallback);

      expect(explicitFalse.verbose).toBe(false);
      expect(stringFalse.verbose).toBe(false);
    });
  });

  describe('Path and Structural Arguments', () => {
    it('should assign bare elements to structural input arrays', () => {
      const args: MinimistParsed = {
        _: ['src/components/Button.tsx', 'src/styles/global.css']
      };
      
      const parsed = resolveCliArguments(args, mockFallback);
      expect(parsed.inputs).toBeDefined();
      expect(parsed.inputs).toHaveLength(2);
      expect(parsed.inputs).toContain('src/components/Button.tsx');
    });

    it('should ingest custom explicit path declarations gracefully', () => {
      const args: MinimistParsed = {
        _: [],
        cachePath: './custom-build/.cache-bucket'
      };

      const parsed = resolveCliArguments(args, mockFallback);
      expect(parsed.cachePath).toBe('./custom-build/.cache-bucket');
    });
  });

  describe('Numeric Configurations', () => {
    it('should cast numeric strings into javascript numbers', () => {
      const args: MinimistParsed = {
        _: [],
        threshold: '12',
        maxAtomicClasses: 500
      };

      const parsed = resolveCliArguments(args, mockFallback);
      expect(parsed.threshold).toBe(12);
      expect(parsed.maxAtomicClasses).toBe(500);
    });
  });

  describe('Fallback and Merge Topologies', () => {
    it('should fallback to foundational rules when explicit args are missing', () => {
      const parsed = resolveCliArguments({ _: [] }, mockFallback);
      expect(parsed.minify).toBe(false);
      expect(parsed.framework).toBe('auto');
      expect(parsed.cachePath).toBe('.chaincss/cache');
    });

    it('should maintain underlying reference objects during surface-level overrides', () => {
      const parsed = resolveCliArguments({ _: [], customFlag: 'active' }, mockFallback);
      expect(parsed.atomic).toEqual({ enabled: true, mode: 'standard' });
      expect(parsed.customFlag).toBe('active');
    });
  });

  describe('Integration with Style Objects Core Parser', () => {
    it('should verify parsed style objects filter internal attributes safely', () => {
      const rawStylePayload = {
        selectors: ['.btn-primary'],
        backgroundColor: '#007acc',
        _atRules: [{ type: 'media', query: '(max-width: 768px)' }],
        nestedRules: [
          {
            selector: '&:hover',
            styles: { backgroundColor: '#005999' }
          }
        ]
      };

      const parsedStructure = parseStyleObject(rawStylePayload);
      
      expect(parsedStructure.selectors).toEqual(['.btn-primary']);
      expect(parsedStructure.regularProps).toHaveProperty('backgroundColor', '#007acc');
      expect(parsedStructure.nestedRules).toHaveLength(1);
      expect(parsedStructure.nestedRules[0].selector).toBe('&:hover');
      
      // Make sure private variables do not bleed into the consumer properties model
      expect(parsedStructure.regularProps).not.toHaveProperty('_atRules');
    });
  });
});
