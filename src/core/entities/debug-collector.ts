// src/core/entities/debug-collector.ts

import type { ValueClass } from "../usecases/value-classifier.js";
import type { PropertyStoreEntry } from "./property-store.js";

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
    estimatedPerformance: "fast" | "medium" | "slow";
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

// Fix #5: Responsive width from terminal or options
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;
const supportsColor =
  typeof process !== "undefined" &&
  !!(process.stdout as any)?.isTTY &&
  !process.env.NO_COLOR;

const ansi = {
  reset: supportsColor ? "\x1b[0m" : "",
  bold: supportsColor ? "\x1b[1m" : "",
  dim: supportsColor ? "\x1b[2m" : "",
  green: supportsColor ? "\x1b[32m" : "",
  cyan: supportsColor ? "\x1b[36m" : "",
  yellow: supportsColor ? "\x1b[33m" : "",
  magenta: supportsColor ? "\x1b[35m" : "",
} as const;

const HAS_WIDE_RE = /[^\x00-\x7F]/;

function getVisibleLength(str: string): number {
  const stripped = str.replace(ANSI_REGEX, "");
  if (!stripped) return 0;
  if (!HAS_WIDE_RE.test(stripped)) return stripped.length;
  let count = 0;
  for (const char of stripped) {
    const cp = char.codePointAt(0) || 0;
    const isDouble = cp > 0xffff || (cp >= 0x2000 && cp <= 0x32ff);
    count += isDouble ? 2 : 1;
  }
  return count;
}

// Fix #2: Iterate by original string index, not current.length
function truncateVisible(str: string, maxLength: number): string {
  if (getVisibleLength(str) <= maxLength) return str;

  let current = "";
  let currentLen = 0;
  const strippedTarget = maxLength - 3;
  let i = 0;

  while (i < str.length) {
    // Copy full ANSI sequence without counting
    if (str[i] === "\x1b") {
      const m = str.slice(i).match(/^\x1b\[[0-9;]*m/);
      if (m) {
        current += m[0];
        i += m[0].length;
        continue;
      }
    }

    const char = str[i];
    const cp = char.codePointAt(0) || 0;
    const charLen = cp > 0xffff || (cp >= 0x2000 && cp <= 0x32ff) ? 2 : 1;

    if (currentLen + charLen > strippedTarget) break;

    current += char;
    currentLen += charLen;
    i++;
  }

  return current + "...";
}

function safeSerialize(value: any): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  const t = typeof value;
  if (t === "string") return value;
  if (t === "number" || t === "boolean") return String(value);
  if (t === "function") return "[Function]";
  if (t === "symbol") return value.toString();
  if (t !== "object") return String(value);

  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === "function") return "[Function]";
      if (v && typeof v === "object") {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    });
  } catch {
    return "[Unserializable]";
  }
}

// Fix #5: Terminal width detection
function getTerminalWidth(): number {
  if (
    typeof process !== "undefined" &&
    (process.stdout as any)?.columns &&
    (process.stdout as any).columns > 20
  ) {
    return (process.stdout as any).columns;
  }
  return 80; // default fallback
}

const MAX_ENTRIES = 200;

export class DebugCollector {
  private entries: DebugEntry[] = [];
  private enabled: boolean;
  private width: number;

  constructor(enabled = false, options?: { width?: number; maxEntries?: number }) {
    this.enabled = enabled;
    // Fix #5: Width from options or terminal
    this.width = options?.width || Math.min(getTerminalWidth(), 100);
    // Fix #3: Entry cap via options
    this.maxEntries = options?.maxEntries || MAX_ENTRIES;
  }

  private maxEntries: number;

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
    context: string,
  ): void {
    if (!this.enabled) return;
    // Fix #3: Cap entries to prevent memory leak
    if (this.entries.length >= this.maxEntries) return;
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
        summary: {
          totalNodes: 0,
          staticNodes: 0,
          dynamicNodes: 0,
          estimatedPerformance: "fast",
        },
        nodes: [],
        visualization: this.enabled
          ? "No styles recorded yet."
          : "Enable debug mode: chain({ debug: true })",
      };
    }

    let staticCount = 0;
    for (const e of this.entries)
      if (e.classification === "static") staticCount++;
    const dynamicCount = this.entries.length - staticCount;

    const summary = {
      totalNodes: this.entries.length,
      staticNodes: staticCount,
      dynamicNodes: dynamicCount,
      estimatedPerformance: (dynamicCount === 0
        ? "fast"
        : dynamicCount <= 3
          ? "medium"
          : "slow") as "fast" | "medium" | "slow",
    };

    const nodes = this.entries.map((e) => ({
      prop: e.prop,
      cssProperty: e.realProp,
      // Fix #4: Quote strings in visualization
      value:
        typeof e.originalValue === "string"
          ? `"${e.originalValue}"`
          : safeSerialize(e.originalValue),
      resolved: e.resolvedValue,
      mode: e.classification === "static" ? "📦 build" : "🏃 runtime",
      context: e.context,
      reasoning:
        e.classification === "static"
          ? "Static — extracted at build time"
          : typeof e.originalValue === "function"
            ? "Function — resolved at runtime"
            : "Dynamic reference — resolved at runtime",
    }));

    return { summary, nodes, visualization: this.renderVisualization(summary) };
  }

  reset(): void {
    this.entries = [];
  }

  private renderVisualization(summary: Explanation["summary"]): string {
    const lines: string[] = [];
    // Fix #5: Use instance width instead of hardcoded 66
    const width = this.width;
    const innerWidth = width - 4;

    lines.push("┌" + "─".repeat(width - 2) + "┐");
    const titleText = ` ${ansi.bold}ChainCSS Style Explanation${ansi.reset} `;
    const titlePad = " ".repeat(
      Math.max(0, innerWidth - getVisibleLength(titleText)),
    );
    lines.push(`│ ${titleText}${titlePad} │`);
    lines.push("├" + "─".repeat(width - 2) + "┤");

    for (const e of this.entries) {
      const isStatic = e.classification === "static";
      const icon = isStatic ? "📦" : "🏃";
      const ctxText =
        e.context && e.context !== "root" ? ` (${e.context})` : "";
      const propLabel = `${ansi.cyan}${e.prop}${ctxText}${ansi.reset}`;
      const rightVal =
        typeof e.originalValue === "string"
          ? `"${e.originalValue}"`
          : safeSerialize(e.originalValue);
      const valText = isStatic
        ? `${ansi.green}${rightVal}${ansi.reset}`
        : `${ansi.yellow}${rightVal}${ansi.reset}`;

      const leftPart = `${icon} ${propLabel}`;
      const rightPart = valText;
      const arrow = " → ";

      // Fix #1: Cache getVisibleLength calls
      const leftLen = getVisibleLength(leftPart);
      const rightLen = getVisibleLength(rightPart);
      const totalLen = leftLen + arrow.length + rightLen;

      if (totalLen > innerWidth) {
        const maxRight = Math.max(15, innerWidth - leftLen - arrow.length);
        const truncatedRight = truncateVisible(rightPart, maxRight);
        const truncatedLen = getVisibleLength(truncatedRight);
        const pad = " ".repeat(
          Math.max(0, innerWidth - (leftLen + arrow.length + truncatedLen)),
        );
        lines.push(`│ ${leftPart}${arrow}${truncatedRight}${pad} │`);
      } else {
        const pad = " ".repeat(innerWidth - totalLen);
        lines.push(`│ ${leftPart}${arrow}${rightPart}${pad} │`);
      }
    }

    lines.push("├" + "─".repeat(width - 2) + "┤");

    const pColor =
      summary.estimatedPerformance === "fast"
        ? ansi.green
        : summary.estimatedPerformance === "medium"
          ? ansi.yellow
          : ansi.magenta;
    const perfLabel = `Performance Profile : ${pColor}${ansi.bold}${summary.estimatedPerformance.toUpperCase()}${ansi.reset}`;
    lines.push(
      `│ ${perfLabel}${" ".repeat(Math.max(0, innerWidth - getVisibleLength(perfLabel)))} │`,
    );

    const statsLabel = `${ansi.dim}Nodes Processed     : ${summary.totalNodes} total (${summary.staticNodes} static, ${summary.dynamicNodes} dynamic)${ansi.reset}`;
    lines.push(
      `│ ${statsLabel}${" ".repeat(Math.max(0, innerWidth - getVisibleLength(statsLabel)))} │`,
    );

    lines.push("└" + "─".repeat(width - 2) + "┘");
    return lines.join("\n");
  }
}