// src/compiler/pipeline/ir/factory.ts
/** Factory functions for creating IR nodes safely. */

import type {
  IRNodeId, IRDeclaration, IRRule, IRPseudoClass,
  IRAtRule, IRCondition, IRTransformRecord, StyleIR,
  SourceLocation, ParsedValue
} from './types.js';


/** Split function arguments respecting nested parens */
function splitFuncArgs(args: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of args) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

// ============================================================================
// Value Parser — lightweight, best-effort
// ============================================================================

/**
 * Parse a CSS declaration value into structured form.
 * Stored in meta.parsed for use by feature detection and optimization passes.
 * Falls back to { kind: 'raw' } for unparseable values — no errors thrown.
 */
export function parseValue(raw: string | number): ParsedValue {
  // Numbers pass through directly
  if (typeof raw === 'number') {
    return { kind: 'number', value: raw };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { kind: 'raw', value: trimmed };
  }

  // Dimension: 16px, 2rem, 100vh, 50%, 0.5fr
  const dimMatch = trimmed.match(/^([+-]?\d*\.?\d+)(px|rem|em|vh|vw|vmin|vmax|%|ch|ex|fr|cm|mm|in|pt|pc)$/);
  if (dimMatch) {
    return {
      kind: 'dimension',
      value: parseFloat(dimMatch[1]),
      unit: dimMatch[2],
    };
  }

  // Plain number string: "0", "1.5", "-2"
  const numMatch = trimmed.match(/^[+-]?\d*\.?\d+$/);
  if (numMatch) {
    return { kind: 'number', value: parseFloat(trimmed) };
  }

  // Hex color: #fff, #a1b2c3, #a1b2c3ff
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return { kind: 'color', hex: trimmed };
  }

  // Function call: rgb(...), var(...), calc(...), clamp(...)
  const funcMatch = trimmed.match(/^([a-zA-Z_][\w-]*)\((.+)\)$/);
  if (funcMatch) {
    return {
      kind: 'function',
      name: funcMatch[1],
      args: splitFuncArgs(funcMatch[2]).map(parseValue),
    };
  }

  // Space or comma-separated list (e.g., "1px solid red", "0 1px 2px")
  if (trimmed.includes(' ') || trimmed.includes(',')) {
    const items = trimmed
      .split(/[,\s]+/)
      .filter(s => s.length > 0)
      .map(parseValue);
    if (items.length > 1) {
      return { kind: 'list', items };
    }
  }

  // Everything else: keyword (flex, grid, none, auto, center, etc.)
  return { kind: 'keyword', value: trimmed };
}

// ============================================================================
// ID Generator
// ============================================================================

let idCounter = 0;
export function nextId(prefix: string = 'ir'): IRNodeId {
  return prefix + '-' + (idCounter++).toString(36) + '-' + Date.now().toString(36);
}

let _resetCount = 0;
export function resetIdCounter(): void {
  idCounter = 0;
  _resetCount++;
  if (_resetCount > 1 && typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production' && process.env?.NODE_ENV !== 'test') {
    console.warn('[ChainCSS] resetIdCounter() called multiple times — possible dual-import of factory.ts. Import from a single canonical path.');
  }
}

// ============================================================================
// IR Factory — create nodes safely
// ============================================================================

export function record(
  pass: string,
  action: string,
  previous?: any,
  reason?: string
): IRTransformRecord {
  return { pass, action, timestamp: Date.now(), previous, reason };
}

export function createDeclaration(
  property: string,
  value: string | number,
  source?: SourceLocation,
  meta: Record<string, any> = {}
): IRDeclaration {
  return {
    id: nextId('decl'),
    property,
    value,
    source,
    history: [record('parser', 'created', undefined, 'Parsed from StyleDefinition')],
    meta: {
      ...meta,
      // Attach parsed value to meta — non-breaking addition
      parsed: parseValue(value),
    },
  };
}

export function createRule(
  selector: string,
  source?: SourceLocation
): IRRule {
  return {
    id: nextId('rule'),
    selector,
    declarations: [],
    pseudoClasses: [],
    atRules: [],
    nestedRules: [],
    conditions: [],
    _dirty: true,
    isDead: false,
    specificity: 0,
    hash: '',
    source: source || {},
    history: [record('parser', 'created', undefined, 'Parsed from StyleDefinition')],
    meta: {},
  };
}

export function createIR(sourceFiles: string[] = []): StyleIR {
  return {
    id: nextId('ir'),
    rules: [],
    diagnostics: [],
    meta: {
      version: '1.0.0',
      createdAt: Date.now(),
      sourceFiles,
      passCount: 0,
      passes: [],
      dirtyRules: 0,
      compiledAt: Date.now(),
    },
  };
}
