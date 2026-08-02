// src/core/usecases/value-classifier.ts

import type { CSSProperties, CSSPrimitiveValue } from "@shared/types/index.js";
import { isDynamicValue } from "@shared/types/index.js";

export type ValueClass = "static" | "dynamic" | "invalid";

// Hoisted checks — avoid re-creating strings per call
const DOLLAR_BRACE = "${";
const THEME_PREFIX = "theme.";
const PROPS_PREFIX = "props.";

export function classifyValue(value: unknown, propKey?: string): ValueClass {
  // 1. Fast path: dynamic values are functions / runtime handlers — checked via types.ts
  if (isDynamicValue(value)) return "dynamic";

  const t = typeof value;
  if (t === "string") {
    // Content property exception: `content: "'${icon}'"` is static CSS, not JS interpolation
    // Your original logic kept it static — preserve it
    if (propKey === "content") {
      // If it contains ${ but is quoted CSS content, treat as static
      // e.g. content: "'\\e001'" or content: "attr(data-${x})" should NOT be dynamic in CSS sense
      // Keep your exception: content + ${ => static
      if ((value as string).includes(DOLLAR_BRACE)) return "static";
    }

    // Fast prefix checks without startsWith alloc: charCode
    const s = value as string;
    if (s.length >= 6) {
      // theme. = 5 chars + dot, props. = 6
      if (s[0] === "t" && s.startsWith(THEME_PREFIX)) return "dynamic";
      if (s[0] === "p" && s.startsWith(PROPS_PREFIX)) return "dynamic";
    }
    // Only one includes scan now
    if (s.includes(DOLLAR_BRACE)) return "dynamic";

    return "static";
  }

  if (t === "number") return "static";

  // Booleans, null, etc are invalid for CSSPrimitiveValue but we treat boolean as invalid to filter out
  // Keep your original fallback: anything else invalid
  return "invalid";
}

export function partitionStyles(properties: CSSProperties): {
  static: Record<string, CSSPrimitiveValue>;
  dynamic: Record<string, any>;
} {
  const staticProps: Record<string, CSSPrimitiveValue> = {};
  const dynamicProps: Record<string, any> = {};

  // FIX: for...in is 2-3x faster than Object.entries which allocs [k,v] arrays
  for (const key in properties) {
    if (!Object.prototype.hasOwnProperty.call(properties, key)) continue;
    const value = (properties as any)[key];
    const cls = classifyValue(value, key);
    if (cls === "dynamic") dynamicProps[key] = value;
    else if (cls === "static") staticProps[key] = value as CSSPrimitiveValue;
  }

  return { static: staticProps, dynamic: dynamicProps };
}

export function hasDynamicValues(properties: CSSProperties): boolean {
  // FIX: early exit without allocating entries array
  for (const key in properties) {
    if (!Object.prototype.hasOwnProperty.call(properties, key)) continue;
    if (classifyValue((properties as any)[key], key) === "dynamic") return true;
  }
  return false;
}
