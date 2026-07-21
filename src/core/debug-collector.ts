// src/core/debug-collector.ts 

import type { ValueClass } from './value-classifier.js';
import type { PropertyStoreEntry } from './property-store.js';

export interface DebugEntry {
  prop: string;
  realProp: string;
  originalValue: any;
  resolvedValue: any;
  classification: ValueClass;
  context: string;
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

// 1. Hoist regex, avoid re-alloc
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;
const supportsColor = typeof process !== 'undefined' && !!(process.stdout as any)?.isTTY && !process.env.NO_COLOR;

const ansi = {
  reset: supportsColor ? '\x1b[0m' : '',
  bold: supportsColor ? '\x1b[1m' : '',
  dim: supportsColor ? '\x1b[2m' : '',
  green: supportsColor ? '\x1b[32m' : '',
  cyan: supportsColor ? '\x1b[36m' : '',
  yellow: supportsColor ? '\x1b[33m' : '',
  magenta: supportsColor ? '\x1b[35m' : '',
} as const;

// Fast visible length: strip ANSI, then length. Only do emoji double-width check if string contains non-ascii
const HAS_WIDE_RE = /[^\x00-\x7F]/;

function getVisibleLength(str: string): number {
  // Strip ANSI once
  const stripped = str.replace(ANSI_REGEX, '');
  if (!stripped) return 0;
  if (!HAS_WIDE_RE.test(stripped)) return stripped.length; // fast path: ascii only
  // Slow path only for emoji / wide chars
  let count = 0;
  for (const char of stripped) {
    const cp = char.codePointAt(0) || 0;
    const isDouble = cp > 0xffff || (cp >= 0x2000 && cp <= 0x32ff);
    count += isDouble ? 2 : 1;
  }
  return count;
}

function truncateVisible(str: string, maxLength: number): string {
  if (getVisibleLength(str) <= maxLength) return str;
  // Fast truncate on stripped length, then re-add ...
  // We need to preserve ANSI, so iterate but early exit
  let current = '';
  let currentLen = 0;
  const strippedTarget = maxLength - 3;
  for (const char of str) {
    if (char === '\x1b') {
      // copy full ANSI sequence without counting
      const m = str.slice(current.length).match(/^\x1b\[[0-9;]*m/);
      if (m) {
        current += m[0];
        continue;
      }
    }
    const cp = char.codePointAt(0) || 0;
    const charLen = cp > 0xffff || (cp >= 0x2000 && cp <= 0x32ff) ? 2 : 1;
    if (currentLen + charLen > strippedTarget) break;
    current += char;
    currentLen += charLen;
  }
  return current + '...';
}

function safeSerialize(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  const t = typeof value;
  if (t === 'string') return value;
  if (t === 'number' || t === 'boolean') return String(value);
  if (t === 'function') return '[Function]';
  if (t === 'symbol') return value.toString();
  if (t !== 'object') return String(value);

  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === 'function') return '[Function]';
      if (v && typeof v === 'object') {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      return v;
    });
  } catch {
    return '[Unserializable]';
  }
}

export class DebugCollector {
  private entries: DebugEntry[] = [];
  private enabled: boolean;

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  log(prop: string, entry: PropertyStoreEntry, originalValue: any, context: string): void {
    if (!this.enabled) return;
    this.entries.push({
      prop,
      realProp: entry.realProp,
      originalValue,
      resolvedValue: entry.value,
      classification: entry.classification,
      context,
    });
  }

  explain(): Explanation {
    if (this.entries.length === 0) {
      return {
        summary: { totalNodes: 0, staticNodes: 0, dynamicNodes: 0, estimatedPerformance: 'fast' },
        nodes: [],
        visualization: this.enabled ? 'No styles recorded yet.' : 'Enable debug mode: chain({ debug: true })',
      };
    }

    let staticCount = 0;
    for (const e of this.entries) if (e.classification === 'static') staticCount++;
    const dynamicCount = this.entries.length - staticCount;

    const summary = {
      totalNodes: this.entries.length,
      staticNodes: staticCount,
      dynamicNodes: dynamicCount,
      estimatedPerformance: (dynamicCount === 0 ? 'fast' : dynamicCount <= 3 ? 'medium' : 'slow') as 'fast' | 'medium' | 'slow',
    };

    const nodes = this.entries.map(e => ({
      prop: e.prop,
      cssProperty: e.realProp,
      value: safeSerialize(e.originalValue),
      resolved: e.resolvedValue,
      mode: e.classification === 'static' ? '📦 build' : '🏃 runtime',
      context: e.context,
      reasoning:
        e.classification === 'static'
          ? 'Static — extracted at build time'
          : typeof e.originalValue === 'function'
            ? 'Function — resolved at runtime'
            : 'Dynamic reference — resolved at runtime',
    }));

    return { summary, nodes, visualization: this.renderVisualization(summary) };
  }

  reset(): void {
    this.entries = [];
  }

  private renderVisualization(summary: Explanation['summary']): string {
    const lines: string[] = [];
    const width = 66;
    const innerWidth = width - 4;

    lines.push('┌' + '─'.repeat(width - 2) + '┐');
    const titleText = ` ${ansi.bold}ChainCSS Style Explanation${ansi.reset} `;
    const titlePad = ' '.repeat(Math.max(0, innerWidth - getVisibleLength(titleText)));
    lines.push(`│ ${titleText}${titlePad} │`);
    lines.push('├' + '─'.repeat(width - 2) + '┤');

    for (const e of this.entries) {
      const isStatic = e.classification === 'static';
      const icon = isStatic ? '📦' : '🏃';
      const ctxText = e.context && e.context !== 'root' ? ` (${e.context})` : '';
      const propLabel = `${ansi.cyan}${e.prop}${ctxText}${ansi.reset}`;
      const rightVal = safeSerialize(e.originalValue);
      const valText = isStatic ? `${ansi.green}${rightVal}${ansi.reset}` : `${ansi.yellow}${rightVal}${ansi.reset}`;

      const leftPart = `${icon} ${propLabel}`;
      const rightPart = valText;
      const arrow = ' → ';

      const totalLen = getVisibleLength(leftPart) + arrow.length + getVisibleLength(rightPart);

      if (totalLen > innerWidth) {
        const maxRight = Math.max(15, innerWidth - getVisibleLength(leftPart) - arrow.length);
        const truncatedRight = truncateVisible(rightPart, maxRight);
        const pad = ' '.repeat(Math.max(0, innerWidth - (getVisibleLength(leftPart) + arrow.length + getVisibleLength(truncatedRight))));
        lines.push(`│ ${leftPart}${arrow}${truncatedRight}${pad} │`);
      } else {
        const pad = ' '.repeat(innerWidth - totalLen);
        lines.push(`│ ${leftPart}${arrow}${rightPart}${pad} │`);
      }
    }

    lines.push('├' + '─'.repeat(width - 2) + '┤');

    const pColor = summary.estimatedPerformance === 'fast' ? ansi.green : summary.estimatedPerformance === 'medium' ? ansi.yellow : ansi.magenta;
    const perfLabel = `Performance Profile : ${pColor}${ansi.bold}${summary.estimatedPerformance.toUpperCase()}${ansi.reset}`;
    lines.push(`│ ${perfLabel}${' '.repeat(Math.max(0, innerWidth - getVisibleLength(perfLabel)))} │`);

    const statsLabel = `${ansi.dim}Nodes Processed     : ${summary.totalNodes} total (${summary.staticNodes} static, ${summary.dynamicNodes} dynamic)${ansi.reset}`;
    lines.push(`│ ${statsLabel}${' '.repeat(Math.max(0, innerWidth - getVisibleLength(statsLabel)))} │`);

    lines.push('└' + '─'.repeat(width - 2) + '┘');
    return lines.join('\n');
  }
}

