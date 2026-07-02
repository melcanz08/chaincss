// src/compiler/pipeline/ir/value-parser.ts (new file)

import type { ParsedValue } from './types.js';

/**
 * Lightweight CSS value parser.
 * Not a full CSS value grammar — just enough to detect features
 * without brittle string matching.
 */
export function parseValue(raw: string): ParsedValue {
  const trimmed = raw.trim();

  // Dimension: 16px, 2rem, 100vh, 50%
  const dimMatch = trimmed.match(/^([+-]?\d*\.?\d+)(px|rem|em|vh|vw|vmin|vmax|%|ch|ex|fr)$/);
  if (dimMatch) {
    return {
      kind: 'dimension',
      value: parseFloat(dimMatch[1]),
      unit: dimMatch[2],
    };
  }

  // Plain number: 0, 1.5, -2
  const numMatch = trimmed.match(/^[+-]?\d*\.?\d+$/);
  if (numMatch) {
    return { kind: 'number', value: parseFloat(trimmed) };
  }

  // Hex color: #fff, #a1b2c3
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return { kind: 'color', hex: trimmed };
  }

  // Function call: rgb(...), var(...), calc(...)
  const funcMatch = trimmed.match(/^([a-zA-Z][\w-]*)\((.+)\)$/);
  if (funcMatch) {
    return {
      kind: 'function',
      name: funcMatch[1],
      args: splitArgs(funcMatch[2]).map(parseValue),
    };
  }

  // Comma or space-separated list (like "1px solid red")
  if (trimmed.includes(' ') || trimmed.includes(',')) {
    const items = trimmed
      .split(/[,\s]+/)
      .filter(s => s.length > 0)
      .map(parseValue);
    if (items.length > 1) {
      return { kind: 'list', items };
    }
  }

  // Everything else is a keyword
  return { kind: 'keyword', value: trimmed };
}

function splitArgs(args: string): string[] {
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