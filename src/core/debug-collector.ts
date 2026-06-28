// src/core/debug-collector.ts

/**
 * DebugCollector — Handles debug logging, style explanation, and
 * terminal visualization. Completely separate from style collection.
 * 
 * Extracted from StyleCollector so production builds can tree-shake
 * debug code entirely.
 */

import type { ValueClass } from './value-classifier.js';
import type { PropertyStoreEntry } from './property-store.js';

export interface DebugEntry {
  prop: string;
  realProp: string;
  originalValue: any;
  resolvedValue: any;
  classification: ValueClass;
  context: 'root' | 'hover';
}

export interface Explanation {
  summary: {
    totalNodes: number;
    staticNodes: number;
    dynamicNodes: number;
    estimatedPerformance: 'fast' | 'medium' | 'slow';
  };
  nodes: Array<{
    prop: string;
    cssProperty: string;
    value: string;
    resolved: any;
    mode: string;
    context: string;
    reasoning: string;
  }>;
  visualization: string;
}

export class DebugCollector {
  private entries: DebugEntry[] = [];
  private enabled: boolean;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  log(
    prop: string,
    entry: PropertyStoreEntry,
    originalValue: any,
    context: 'root' | 'hover'
  ): void {
    if (!this.enabled) return;

    this.entries.push({
      prop,
      realProp: entry.realProp,
      originalValue,
      resolvedValue: entry.value,
      classification: entry.classification,
      context
    });
  }

  explain(): Explanation {
    if (this.entries.length === 0) {
      return {
        summary: { totalNodes: 0, staticNodes: 0, dynamicNodes: 0, estimatedPerformance: 'fast' },
        nodes: [],
        visualization: this.enabled
          ? 'No styles recorded yet.'
          : 'Enable debug mode: chain({ debug: true })'
      };
    }

    const staticCount = this.entries.filter(e => e.classification === 'static').length;
    const dynamicCount = this.entries.filter(e => e.classification === 'dynamic').length;

    const summary = {
      totalNodes: this.entries.length,
      staticNodes: staticCount,
      dynamicNodes: dynamicCount,
      estimatedPerformance: (dynamicCount === 0 ? 'fast' :
        dynamicCount <= 3 ? 'medium' : 'slow') as 'fast' | 'medium' | 'slow'
    };

    const nodes = this.entries.map(e => ({
      prop: e.prop,
      cssProperty: e.realProp,
      value: typeof e.originalValue === 'function'
        ? '[Function]'
        : JSON.stringify(e.originalValue),
      resolved: e.resolvedValue,
      mode: e.classification === 'static' ? '📦 build' : '🏃 runtime',
      context: e.context,
      reasoning: e.classification === 'static'
        ? 'Static — extracted at build time'
        : typeof e.originalValue === 'function'
          ? 'Function — resolved at runtime'
          : 'Dynamic reference — resolved at runtime'
    }));

    const visualization = this.renderVisualization(summary);

    return { summary, nodes, visualization };
  }

  reset(): void {
    this.entries = [];
  }

  // ========================================================================
  // Visualization (private — not mixed into collection logic)
  // ========================================================================

  private renderVisualization(summary: Explanation['summary']): string {
    const lines: string[] = [];
    const width = 64;

    lines.push('┌' + '─'.repeat(width - 2) + '┐');
    lines.push('│' + ' ChainCSS Style Explanation '.padEnd(width - 2) + '│');
    lines.push('├' + '─'.repeat(width - 2) + '┤');

    for (const e of this.entries) {
      const icon = e.classification === 'static' ? '📦' : '🏃';
      const ctx = e.context === 'hover' ? ' (hover)' : '';
      let val = typeof e.originalValue === 'function'
        ? '<function>'
        : typeof e.originalValue === 'string' && e.originalValue.length > 22
          ? e.originalValue.substring(0, 19) + '...'
          : String(e.originalValue);

      const left = `${icon} ${e.prop}${ctx}`.padEnd(22);
      const right = val.padEnd(30);
      lines.push(`│ ${left}→ ${right}│`);
    }

    lines.push('├' + '─'.repeat(width - 2) + '┤');
    const perf = summary.estimatedPerformance.toUpperCase();
    lines.push(`│ Performance: ${perf.padEnd(width - 17)}│`);
    lines.push(`│ Static: ${summary.staticNodes} | Dynamic: ${summary.dynamicNodes}${' '.repeat(Math.max(0, width - 26 - String(summary.staticNodes).length - String(summary.dynamicNodes).length))}│`);
    lines.push('└' + '─'.repeat(width - 2) + '┘');

    return lines.join('\n');
  }
}