// ============================================================================
// FILE: src/compiler/style-graph.ts
// Style Graph Compiler — Dependency Graph, Dead Elimination, Rule Merging
// ============================================================================

import crypto from 'crypto';
import type {
  StyleDefinition,
  StyleGraph,
  StyleGraphNode,
  StyleGraphEdge,
  GraphCompileOptions,
  GraphCompileResult,
  CompileResult,
  AtomicClass,
  CompileStats,
} from '../core/types.js';

// ============================================================================
// Types
// ============================================================================

export type { StyleGraph, StyleGraphNode, StyleGraphEdge, GraphCompileOptions, GraphCompileResult };

interface StyleEntry {
  selector: string;
  properties: Record<string, string | number>;
  sourceComponent: string;
  sourceOrder: number;
  mediaQuery?: string;
}

// ============================================================================
// Specificity Calculator
// ============================================================================

function calculateSpecificity(selector: string): number {
  let a = 0; // IDs
  let b = 0; // Classes, attributes, pseudo-classes
  let c = 0; // Elements, pseudo-elements

  // Count IDs
  const idMatches = selector.match(/#[a-zA-Z0-9_-]+/g);
  if (idMatches) a += idMatches.length;

  // Count classes, attributes, pseudo-classes
  const classMatches = selector.match(/\.[a-zA-Z0-9_-]+/g);
  if (classMatches) b += classMatches.length;

  const attrMatches = selector.match(/\[[^\]]+\]/g);
  if (attrMatches) b += attrMatches.length;

  const pseudoClassMatches = selector.match(/:[a-zA-Z-]+(?:\([^)]*\))?/g);
  if (pseudoClassMatches) {
    // :not() doesn't add specificity, but its argument does
    const notMatches = selector.match(/:not\(([^)]+)\)/g);
    const regularPseudoClasses = pseudoClassMatches.length - (notMatches?.length || 0);
    b += Math.max(0, regularPseudoClasses);
  }

  // Count element selectors
  const elementMatches = selector.match(/^[a-zA-Z]+|[a-zA-Z]+(?=[.#[:])/g);
  if (elementMatches) c += elementMatches.length;

  // Combine into single number (a*10000 + b*100 + c)
  return a * 10000 + b * 100 + c;
}

// ============================================================================
// Hash Generator
// ============================================================================

function hashProperties(properties: Record<string, string | number>): string {
  const sorted = Object.entries(properties)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

  return crypto.createHash('md5').update(sorted).digest('hex').slice(0, 8);
}

function hashNode(node: StyleGraphNode): string {
  return crypto
    .createHash('md5')
    .update(`${node.selector}:${node.mediaQuery || ''}:${JSON.stringify(node.properties)}`)
    .digest('hex')
    .slice(0, 8);
}


function kebab(prop: string): string {
  return prop.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// ============================================================================
// Graph Builder
// ============================================================================

class StyleGraphBuilder {
  private entries: StyleEntry[] = [];
  private nodes: Map<string, StyleGraphNode> = new Map();
  private edges: StyleGraphEdge[] = [];
  private orderCounter = 0;

  addEntry(entry: StyleEntry): void {
    entry.sourceOrder = this.orderCounter++;
    this.entries.push(entry);
  }

  build(): StyleGraph {
    this.nodes.clear();
    this.edges = [];

    // Create nodes
    for (const entry of this.entries) {
      const id = `node-${this.nodes.size}`;
      const node: StyleGraphNode = {
        id,
        selector: entry.selector,
        properties: entry.properties,
        specificity: calculateSpecificity(entry.selector),
        dependencies: [],
        dependents: [],
        mediaQuery: entry.mediaQuery,
        isDead: false,
        hash: hashProperties(entry.properties),
        sourceComponent: entry.sourceComponent,
      };
      this.nodes.set(id, node);
    }

    // Build dependency edges
    const nodeArray = Array.from(this.nodes.values());
    for (let i = 0; i < nodeArray.length; i++) {
      for (let j = i + 1; j < nodeArray.length; j++) {
        const a = nodeArray[i];
        const b = nodeArray[j];

        // Check if they target overlapping selectors
        if (this.selectorsOverlap(a.selector, b.selector)) {
          if (a.specificity <= b.specificity) {
            // b overrides a
            this.edges.push({ from: a.id, to: b.id, type: 'overrides' });
            a.dependents.push(b.id);
            b.dependencies.push(a.id);
          }
          if (b.specificity <= a.specificity) {
            // a overrides b
            this.edges.push({ from: b.id, to: a.id, type: 'overrides' });
            b.dependents.push(a.id);
            a.dependencies.push(b.id);
          }
        }
      }
    }

    const rootNodes = nodeArray
      .filter(n => n.dependencies.length === 0)
      .map(n => n.id);

    const leafNodes = nodeArray
      .filter(n => n.dependents.length === 0)
      .map(n => n.id);

    return {
      nodes: this.nodes,
      edges: this.edges,
      rootNodes,
      leafNodes,
    };
  }

  private selectorsOverlap(a: string, b: string): boolean {
    // Simple heuristic: if one selector is a substring of the other, or they share
    // the same base element/class prefix
    const partsA = a.split(/[\s>+~]+/).filter(Boolean);
    const partsB = b.split(/[\s>+~]+/).filter(Boolean);

    for (const pa of partsA) {
      for (const pb of partsB) {
        if (pa === pb) return true;
        if (pa.startsWith('.') && pb.startsWith('.') && pa === pb) return true;
      }
    }
    return false;
  }
}

// ============================================================================
// Dead Style Elimination
// ============================================================================

function eliminateDeadStyles(
  graph: StyleGraph,
  knownSelectors: string[]
): { eliminated: number; graph: StyleGraph } {
  if (knownSelectors.length === 0) {
    return { eliminated: 0, graph };
  }

  const reachable = new Set<string>();
  const queue: string[] = [];

  // Mark root nodes that match known selectors as reachable
  for (const [id, node] of graph.nodes) {
    if (knownSelectors.some(ks => node.selector.includes(ks) || ks.includes(node.selector))) {
      reachable.add(id);
      queue.push(id);
    }
  }

  // BFS to find all reachable nodes
  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = graph.nodes.get(current);
    if (!node) continue;

    for (const depId of node.dependents) {
      if (!reachable.has(depId)) {
        reachable.add(depId);
        queue.push(depId);
      }
    }
  }

  // Mark unreachable nodes as dead
  let eliminated = 0;
  for (const [id, node] of graph.nodes) {
    if (!reachable.has(id)) {
      node.isDead = true;
      eliminated++;
    }
  }

  return { eliminated, graph };
}

// ============================================================================
// Identical Rule Merging
// ============================================================================

function mergeIdenticalRules(
  graph: StyleGraph,
  threshold: number
): { merged: number; graph: StyleGraph } {
  const hashGroups = new Map<string, StyleGraphNode[]>();

  // Group by property hash
  for (const [, node] of graph.nodes) {
    if (node.isDead) continue;
    if (Object.keys(node.properties).length < threshold) continue;

    const existing = hashGroups.get(node.hash) || [];
    existing.push(node);
    hashGroups.set(node.hash, existing);
  }

  let merged = 0;

  for (const [, group] of hashGroups) {
    if (group.length < 2) continue;

    // Merge selectors
    const mergedSelector = group.map(n => n.selector).join(', ');
    const primary = group[0];
    
    // Update primary node
    primary.selector = mergedSelector;

    // Mark others as dead
    for (let i = 1; i < group.length; i++) {
      group[i].isDead = true;
      merged++;
    }
  }

  return { merged, graph };
}

// ============================================================================
// Topological Sort
// ============================================================================

function topologicalSort(graph: StyleGraph): StyleGraphNode[] {
  const visited = new Set<string>();
  const sorted: StyleGraphNode[] = [];
  const visiting = new Set<string>();

  function visit(id: string): boolean {
    if (visited.has(id)) return true;
    if (visiting.has(id)) return false; // Cycle detected

    visiting.add(id);
    const node = graph.nodes.get(id);
    if (node) {
      for (const depId of node.dependencies) {
        if (!visit(depId)) return false;
      }
    }

    visiting.delete(id);
    visited.add(id);
    if (node && !node.isDead) {
      sorted.push(node);
    }
    return true;
  }

  for (const id of graph.rootNodes) {
    if (!visit(id)) {
      // Cycle detected, fall back to source order
      return Array.from(graph.nodes.values())
        .filter(n => !n.isDead)
        .sort((a, b) => a.sourceComponent?.localeCompare(b.sourceComponent || '') || 0);
    }
  }

  // Visit any remaining nodes
  for (const [id] of graph.nodes) {
    if (!visited.has(id)) {
      visit(id);
    }
  }

  return sorted;
}

// ============================================================================
// CSS Generation from Graph
// ============================================================================

function generateCSSFromGraph(
  graph: StyleGraph,
  sortOutput: GraphCompileOptions['sortOutput'] = 'specificity'
): string {
  let nodes: StyleGraphNode[];

  switch (sortOutput) {
    case 'specificity':
      nodes = Array.from(graph.nodes.values())
        .filter(n => !n.isDead)
        .sort((a, b) => a.specificity - b.specificity);
      break;
    case 'topological':
      nodes = topologicalSort(graph);
      break;
    case 'source-order':
    default:
      nodes = Array.from(graph.nodes.values())
        .filter(n => !n.isDead);
      break;
  }

  let css = '';
  let currentMediaQuery: string | undefined;

  for (const node of nodes) {
    if (node.isDead) continue;

    // Handle media query transitions
    if (node.mediaQuery !== currentMediaQuery) {
      if (currentMediaQuery) {
        css += '}\n\n';
      }
      if (node.mediaQuery) {
        css += `@media ${node.mediaQuery} {\n`;
      }
      currentMediaQuery = node.mediaQuery;
    }

    const rules = Object.entries(node.properties)
      .map(([prop, value]) => `  ${kebab(prop)}: ${value};`)
      .join('\n');

    if (rules) {
      css += `${node.selector} {\n${rules}\n}\n`;
    }
  }

  if (currentMediaQuery) {
    css += '}\n';
  }

  return css;
}

// ============================================================================
// Public API
// ============================================================================

export class StyleGraphCompiler {
  private options: Required<GraphCompileOptions>;

  constructor(options: GraphCompileOptions = {}) {
    this.options = {
      eliminateDead: options.eliminateDead ?? false,
      knownSelectors: options.knownSelectors ?? [],
      mergeIdentical: options.mergeIdentical ?? false,
      mergeThreshold: options.mergeThreshold ?? 3,
      sortOutput: options.sortOutput ?? 'specificity',
      verbose: options.verbose ?? false,
    };
  }

  /**
   * Compile a set of style definitions through the graph compiler.
   */
  compile(styles: Record<string, StyleDefinition>): GraphCompileResult {
    const startTime = Date.now();
    const builder = new StyleGraphBuilder();

    // Phase 1: Extract entries from style definitions
    let preOptimizationSize = 0;

    for (const [componentName, styleDef] of Object.entries(styles)) {
      if (!styleDef || !styleDef.selectors) continue;

      for (const selector of styleDef.selectors) {
        const properties: Record<string, string | number> = {};

        for (const [prop, value] of Object.entries(styleDef)) {
          if (
            prop === 'selectors' ||
            prop === 'atRules' ||
            prop === 'nestedRules' ||
            prop === 'hover' ||
            prop === 'themes' ||
            prop.startsWith('_')
          ) {
            continue;
          }

          if (typeof value === 'string' || typeof value === 'number') {
            properties[prop] = String(value);
            preOptimizationSize += String(value).length + prop.length;
          }
        }

        if (Object.keys(properties).length > 0) {
          builder.addEntry({
            selector,
            properties,
            sourceComponent: componentName,
            sourceOrder: 0,
          });
        }

        // Handle hover states
        if (styleDef.hover && typeof styleDef.hover === 'object') {
          const hoverProperties: Record<string, string | number> = {};
          for (const [prop, value] of Object.entries(styleDef.hover)) {
            if (typeof value === 'string' || typeof value === 'number') {
              hoverProperties[prop] = String(value);
            }
          }
          if (Object.keys(hoverProperties).length > 0) {
            builder.addEntry({
              selector: `${selector}:hover`,
              properties: hoverProperties,
              sourceComponent: componentName,
              sourceOrder: 0,
            });
          }
        }

        // Handle atRules (media queries)
        if (styleDef.atRules) {
          for (const rule of styleDef.atRules) {
            if (rule.type === 'media' && rule.styles && rule.query) {
              const mediaProperties: Record<string, string | number> = {};
              for (const [prop, value] of Object.entries(rule.styles)) {
                if (typeof value === 'string' || typeof value === 'number') {
                  mediaProperties[prop] = String(value);
                }
              }
              if (Object.keys(mediaProperties).length > 0) {
                builder.addEntry({
                  selector,
                  properties: mediaProperties,
                  sourceComponent: componentName,
                  sourceOrder: 0,
                  mediaQuery: rule.query,
                });
              }
            }
          }
        }
      }
    }

    // Phase 2: Build graph
    let graph = builder.build();

    // Phase 3: Dead style elimination
    let eliminatedDead = 0;
    if (this.options.eliminateDead && this.options.knownSelectors!.length > 0) {
      const result = eliminateDeadStyles(graph, this.options.knownSelectors!);
      eliminatedDead = result.eliminated;
      graph = result.graph;
    }

    // Phase 4: Merge identical rules
    let mergedRules = 0;
    if (this.options.mergeIdentical) {
      const result = mergeIdenticalRules(graph, this.options.mergeThreshold);
      mergedRules = result.merged;
      graph = result.graph;
    }

    // Phase 5: Generate CSS
    const css = generateCSSFromGraph(graph, this.options.sortOutput);

    let postOptimizationSize = css.length;
    if (postOptimizationSize === 0) {
      postOptimizationSize = preOptimizationSize; // No output means no savings to report
    }

    // Build classMap from non-dead nodes
    const classMap: Record<string, string> = {};
    for (const [, node] of graph.nodes) {
      if (!node.isDead && node.sourceComponent) {
        if (classMap[node.sourceComponent]) {
          classMap[node.sourceComponent] += ` ${node.selector.replace(/^\./, '')}`;
        } else {
          classMap[node.sourceComponent] = node.selector.replace(/^\./, '');
        }
      }
    }

    const totalNodes = graph.nodes.size;
    const aliveNodes = totalNodes - eliminatedDead;
    const savingsPercent =
      preOptimizationSize > 0
        ? `${(((preOptimizationSize - postOptimizationSize) / preOptimizationSize) * 100).toFixed(1)}%`
        : '0%';

    const stats: CompileStats = {
      totalStyles: totalNodes,
      atomicStyles: 0,
      uniqueProperties: new Set(
        Array.from(graph.nodes.values())
          .filter(n => !n.isDead)
          .flatMap(n => Object.keys(n.properties))
      ).size,
      savings: savingsPercent,
      compileTime: Date.now() - startTime,
    };

    return {
      css,
      classMap,
      atomicClasses: [] as AtomicClass[],
      stats,
      graph,
      eliminatedDead,
      mergedRules,
      optimizationTime: Date.now() - startTime,
      preOptimizationSize,
      postOptimizationSize,
    };
  }

  /**
   * Analyze a style graph without generating CSS.
   */
  analyze(styles: Record<string, StyleDefinition>): StyleGraph {
    const builder = new StyleGraphBuilder();

    for (const [componentName, styleDef] of Object.entries(styles)) {
      if (!styleDef || !styleDef.selectors) continue;

      for (const selector of styleDef.selectors) {
        const properties: Record<string, string | number> = {};
        for (const [prop, value] of Object.entries(styleDef)) {
          if (prop === 'selectors' || prop.startsWith('_')) continue;
          if (typeof value === 'string' || typeof value === 'number') {
            properties[prop] = String(value);
          }
        }
        if (Object.keys(properties).length > 0) {
          builder.addEntry({ selector, properties, sourceComponent: componentName, sourceOrder: 0 });
        }
      }
    }

    return builder.build();
  }

  /**
   * Get optimization statistics for a graph.
   */
  getStats(graph: StyleGraph): {
    totalNodes: number;
    deadNodes: number;
    mergedGroups: number;
    averageSpecificity: number;
    deepestDependencyChain: number;
  } {
    const nodes = Array.from(graph.nodes.values());
    const deadNodes = nodes.filter(n => n.isDead).length;
    const averageSpecificity =
      nodes.length > 0
        ? nodes.reduce((sum, n) => sum + n.specificity, 0) / nodes.length
        : 0;

    // Find deepest dependency chain
    let maxDepth = 0;
    const depths = new Map<string, number>();

    function getDepth(id: string): number {
      if (depths.has(id)) return depths.get(id)!;
      const node = graph.nodes.get(id);
      if (!node || node.dependencies.length === 0) {
        depths.set(id, 0);
        return 0;
      }
      const max = Math.max(...node.dependencies.map(d => getDepth(d)));
      const depth = max + 1;
      depths.set(id, depth);
      return depth;
    }

    for (const [id] of graph.nodes) {
      maxDepth = Math.max(maxDepth, getDepth(id));
    }

    return {
      totalNodes: nodes.length,
      deadNodes,
      mergedGroups: 0,
      averageSpecificity: Math.round(averageSpecificity * 100) / 100,
      deepestDependencyChain: maxDepth,
    };
  }

  /**
   * Update options.
   */
  configure(options: Partial<GraphCompileOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

// ============================================================================
// Convenience function
// ============================================================================

export function compileGraph(
  styles: Record<string, StyleDefinition>,
  options?: GraphCompileOptions
): GraphCompileResult {
  const compiler = new StyleGraphCompiler(options);
  return compiler.compile(styles);
}

// ============================================================================
// Default export
// ============================================================================

export default StyleGraphCompiler;