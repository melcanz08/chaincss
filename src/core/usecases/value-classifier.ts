// src/core/usecases/value-classifier.ts

import type { CSSProperties, CSSPrimitiveValue } from "@shared/types/index.js";
import { isDynamicValue } from "@shared/types/index.js";

export type ValueClass = "static" | "dynamic" | "invalid";

// Fix #1: Hoisted regex — no re-creation per content call
const DOLLAR_BRACE = "${";
const THEME_PREFIX = "theme.";
const PROPS_PREFIX = "props.";
const QUOTED_DOLLAR_BRACE = /(['"])(?:(?!\1).)*\$\{(?:(?!\1).)*\1/;

export function classifyValue(value: unknown, propKey?: string): ValueClass {
  // Fast path: dynamic values are functions / runtime handlers
  if (isDynamicValue(value)) return "dynamic";

  const t = typeof value;

  if (t === "string") {
    const s = value as string;

    // Content property exception
    if (propKey === "content") {
      if (QUOTED_DOLLAR_BRACE.test(s)) {
        return "static";
      }
      if (s.includes(DOLLAR_BRACE)) return "dynamic";
      return "static";
    }

    // Fix #4: Only treat as dynamic if it's a token reference pattern
    // "theme." and "props." prefixes are legacy — restrict to actual token syntax
    if (s.includes(DOLLAR_BRACE)) return "dynamic";

    // Legacy prefix checks — only if followed by valid token path characters
    if (s.startsWith(THEME_PREFIX) || s.startsWith(PROPS_PREFIX)) {
      // Verify it looks like a token path: theme.foo.bar or props.foo
      const afterPrefix = s.slice(THEME_PREFIX.length);
      if (/^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*$/.test(afterPrefix)) {
        return "dynamic";
      }
      // Falls through as static — it's just text starting with "theme." or "props."
    }

    return "static";
  }

  if (t === "number") {
    // Fix #2: NaN and Infinity are invalid, not static
    return Number.isFinite(value as number) ? "static" : "invalid";
  }

  // Fix #3: Array with any dynamic element → dynamic
  if (Array.isArray(value)) {
    const arr = value as unknown[];
    // Check for dynamic elements first
    for (const v of arr) {
      if (isDynamicValue(v)) return "dynamic";
      if (typeof v === "string" && v.includes(DOLLAR_BRACE)) return "dynamic";
    }
    // Otherwise, all elements must be string | number for static
    return arr.every((v) => typeof v === "string" || typeof v === "number")
      ? "static"
      : "invalid";
  }

  // Fix #6: Explicit null/undefined/boolean/object → invalid
  return "invalid";
}

export function partitionStyles(properties: CSSProperties): {
  static: Record<string, CSSPrimitiveValue>;
  dynamic: Record<string, any>;
} {
  const staticProps: Record<string, CSSPrimitiveValue> = {};
  const dynamicProps: Record<string, any> = {};

  for (const key in properties) {
    if (!Object.prototype.hasOwnProperty.call(properties, key)) continue;
    const value = (properties as any)[key];
    const cls = classifyValue(value, key);

    // Fix #5: Skip invalid values instead of storing them
    if (cls === "dynamic") {
      dynamicProps[key] = value;
    } else if (cls === "static") {
      staticProps[key] = value as CSSPrimitiveValue;
    }
    // "invalid" is silently skipped
  }

  return { static: staticProps, dynamic: dynamicProps };
}

export function hasDynamicValues(properties: CSSProperties): boolean {
  for (const key in properties) {
    if (!Object.prototype.hasOwnProperty.call(properties, key)) continue;
    if (classifyValue((properties as any)[key], key) === "dynamic") return true;
  }
  return false;
}