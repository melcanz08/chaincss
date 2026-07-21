// ============================================================================
// FILE: __tests__/style-graph.test.ts (NEW)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { StyleGraphCompiler, compileGraph } from '../../src/compiler/style-graph.js';
import type { StyleDefinition } from '../../src/core/types.js';

describe('Style Graph Compiler', () => {
  const createStyleDef = (
    selectors: string[],
    properties: Record<string, string | number>,
    overrides: Partial<StyleDefinition> = {}
  ): StyleDefinition => ({
    selectors,
    ...properties,
    ...overrides,
  } as StyleDefinition);

  describe('Graph Building', () => {
    it('builds a graph from style definitions', () => {
      const styles: Record<string, StyleDefinition> = {
        button: createStyleDef(['.btn'], {
          color: 'white',
          backgroundColor: 'blue',
          padding: '10px',
        }),
      };

      const compiler = new StyleGraphCompiler();
      const result = compiler.compile(styles);

      expect(result.graph.nodes.size).toBeGreaterThan(0);
      expect(result.css).toContain('.btn');
      expect(result.css).toContain('color');
    });

    it('builds nodes for each selector', () => {
      const styles: Record<string, StyleDefinition> = {
        header: createStyleDef(['.header'], { fontSize: '24px' }),
        footer: createStyleDef(['.footer'], { fontSize: '14px' }),
      };

      const compiler = new StyleGraphCompiler();
      const result = compiler.compile(styles);

      expect(result.graph.nodes.size).toBeGreaterThanOrEqual(2);
    });

    it('calculates specificity for selectors', () => {
      const styles: Record<string, StyleDefinition> = {
        main: createStyleDef(['.main'], { color: 'black' }),
        mainWithId: createStyleDef(['#app .main'], { color: 'red' }),
      };

      const compiler = new StyleGraphCompiler();
      const result = compiler.compile(styles);

      const nodes = Array.from(result.graph.nodes.values());
      const mainNode = nodes.find(n => n.selector === '.main');
      const mainWithIdNode = nodes.find(n => n.selector === '#app .main');

      expect(mainNode).toBeDefined();
      expect(mainWithIdNode).toBeDefined();
      expect(mainWithIdNode!.specificity).toBeGreaterThan(mainNode!.specificity);
    });

    it('detects dependency edges', () => {
      const styles: Record<string, StyleDefinition> = {
        base: createStyleDef(['.base'], { color: 'black' }),
        override: createStyleDef(['.base'], { color: 'red' }),
      };

      const compiler = new StyleGraphCompiler();
      const result = compiler.compile(styles);

      expect(result.graph.edges.length).toBeGreaterThan(0);
    });
  });

  describe('CSS Generation', () => {
    it('generates CSS from graph', () => {
      const styles: Record<string, StyleDefinition> = {
        card: createStyleDef(['.card'], {
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }),
      };

      const compiler = new StyleGraphCompiler();
      const result = compiler.compile(styles);

      expect(result.css).toContain('.card');
      expect(result.css).toContain('border-radius: 8px');
      expect(result.css).toContain('box-shadow');
    });

    it('generates hover styles', () => {
      const styles: Record<string, StyleDefinition> = {
        button: {
          selectors: ['.btn'],
          color: 'white',
          hover: {
            backgroundColor: 'darkblue',
          },
        } as StyleDefinition,
      };

      const compiler = new StyleGraphCompiler();
      const result = compiler.compile(styles);

      expect(result.css).toContain(':hover');
      expect(result.css).toContain('background-color');
    });

    it('groups media queries', () => {
      const styles: Record<string, StyleDefinition> = {
        responsive: {
          selectors: ['.responsive'],
          color: 'black',
          atRules: [
            {
              type: 'media',
              query: '(max-width: 768px)',
              styles: { color: 'blue' },
            },
          ],
        } as StyleDefinition,
      };

      const compiler = new StyleGraphCompiler();
      const result = compiler.compile(styles);

      expect(result.css).toContain('@media');
      expect(result.css).toContain('max-width: 768px');
    });

    it('sorts by specificity', () => {
      const styles: Record<string, StyleDefinition> = {
        low: createStyleDef(['.low'], { color: 'gray' }),
        high: createStyleDef(['#high'], { color: 'red' }),
      };

      const compiler = new StyleGraphCompiler({ sortOutput: 'specificity' });
      const result = compiler.compile(styles);

      // Higher specificity should come after lower specificity
      const lowIndex = result.css.indexOf('.low');
      const highIndex = result.css.indexOf('#high');
      expect(lowIndex).toBeLessThan(highIndex);
    });
  });

  describe('Dead Style Elimination', () => {
    it('eliminates styles not matching known selectors', () => {
      const styles: Record<string, StyleDefinition> = {
        used: createStyleDef(['.header'], { color: 'white' }),
        unused: createStyleDef(['.sidebar'], { color: 'gray' }),
      };

      const compiler = new StyleGraphCompiler({
        eliminateDead: true,
        knownSelectors: ['.header'],
      });
      const result = compiler.compile(styles);

      expect(result.eliminatedDead).toBeGreaterThan(0);
      expect(result.css).toContain('.header');
      expect(result.css).not.toContain('.sidebar');
    });

    it('keeps all styles when no known selectors provided', () => {
      const styles: Record<string, StyleDefinition> = {
        a: createStyleDef(['.a'], { color: 'red' }),
        b: createStyleDef(['.b'], { color: 'blue' }),
      };

      const compiler = new StyleGraphCompiler({
        eliminateDead: true,
        knownSelectors: [],
      });
      const result = compiler.compile(styles);

      expect(result.eliminatedDead).toBe(0);
    });

    it('reports optimization stats', () => {
      const styles: Record<string, StyleDefinition> = {
        kept: createStyleDef(['.kept'], { color: 'white' }),
        removed: createStyleDef(['.removed'], { color: 'gray' }),
      };

      const compiler = new StyleGraphCompiler({
        eliminateDead: true,
        knownSelectors: ['.kept'],
      });
      const result = compiler.compile(styles);

      expect(result.eliminatedDead).toBeGreaterThan(0);
      expect(result.optimizationTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Identical Rule Merging', () => {
    it('merges identical rules', () => {
      const styles: Record<string, StyleDefinition> = {
        red1: createStyleDef(['.red1'], { color: 'red', fontSize: '16px' }),
        red2: createStyleDef(['.red2'], { color: 'red', fontSize: '16px' }),
      };

      const compiler = new StyleGraphCompiler({
        mergeIdentical: true,
        mergeThreshold: 2,
      });
      const result = compiler.compile(styles);

      expect(result.mergedRules).toBe(1);
      // Should have merged selectors
      expect(result.css).toContain('.red1');
      expect(result.css).toContain('.red2');
    });

    it('does not merge when below threshold', () => {
      const styles: Record<string, StyleDefinition> = {
        a: createStyleDef(['.a'], { color: 'red' }),
        b: createStyleDef(['.b'], { color: 'red' }),
      };

      const compiler = new StyleGraphCompiler({
        mergeIdentical: true,
        mergeThreshold: 5, // Higher than property count
      });
      const result = compiler.compile(styles);

      expect(result.mergedRules).toBe(0);
    });

    it('does not merge different properties', () => {
      const styles: Record<string, StyleDefinition> = {
        a: createStyleDef(['.a'], { color: 'red' }),
        b: createStyleDef(['.b'], { color: 'blue' }),
      };

      const compiler = new StyleGraphCompiler({
        mergeIdentical: true,
        mergeThreshold: 1,
      });
      const result = compiler.compile(styles);

      expect(result.mergedRules).toBe(0);
    });
  });

  describe('Graph Analysis', () => {
    it('returns graph analysis without CSS', () => {
      const styles: Record<string, StyleDefinition> = {
        main: createStyleDef(['.main'], { color: 'black' }),
      };

      const compiler = new StyleGraphCompiler();
      const graph = compiler.analyze(styles);

      expect(graph.nodes.size).toBeGreaterThan(0);
      expect(graph.edges).toBeDefined();
    });

    it('computes graph statistics', () => {
      const styles: Record<string, StyleDefinition> = {
        a: createStyleDef(['.a'], { color: 'red' }),
        b: createStyleDef(['.b'], { color: 'blue' }),
      };

      const compiler = new StyleGraphCompiler();
      const graph = compiler.analyze(styles);
      const stats = compiler.getStats(graph);

      expect(stats.totalNodes).toBe(2);
      expect(stats.deadNodes).toBe(0);
      expect(stats.averageSpecificity).toBeGreaterThan(0);
    });
  });

  describe('Convenience Function', () => {
    it('compileGraph works as a function', () => {
      const styles: Record<string, StyleDefinition> = {
        test: createStyleDef(['.test'], { color: 'green' }),
      };

      const result = compileGraph(styles);
      expect(result.css).toContain('.test');
      expect(result.graph).toBeDefined();
    });
  });

  describe('ClassMap Generation', () => {
    it('generates classMap from non-dead nodes', () => {
      const styles: Record<string, StyleDefinition> = {
        button: createStyleDef(['.btn'], { color: 'white' }),
      };

      const compiler = new StyleGraphCompiler();
      const result = compiler.compile(styles);

      expect(result.classMap).toHaveProperty('button');
      expect(result.classMap.button).toContain('btn');
    });
  });

  describe('Compile Result Structure', () => {
    it('returns complete GraphCompileResult', () => {
      const styles: Record<string, StyleDefinition> = {
        test: createStyleDef(['.test'], { color: 'black' }),
      };

      const compiler = new StyleGraphCompiler();
      const result = compiler.compile(styles);

      expect(result).toMatchObject({
        css: expect.any(String),
        classMap: expect.any(Object),
        atomicClasses: expect.any(Array),
        stats: expect.any(Object),
        graph: expect.any(Object),
        eliminatedDead: expect.any(Number),
        mergedRules: expect.any(Number),
        optimizationTime: expect.any(Number),
        preOptimizationSize: expect.any(Number),
        postOptimizationSize: expect.any(Number),
      });
    });
  });
});