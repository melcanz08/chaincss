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
      const s = value as string;
      // Only treat as static if ${ appears inside CSS quotes (escaped content)
      // Pattern: ${ inside single or double quotes = static CSS content
      // Pattern: bare ${ outside quotes = dynamic JS interpolation
      const quotedDollarBrace = /(['"])(?:(?!\1).)*\$\{(?:(?!\1).)*\1/;
      if (quotedDollarBrace.test(s)) {
        // ${ inside CSS string quotes — e.g. content: "'\e${hex}'" or content: "attr(data-${x})"
        return "static";
      }
      // If ${ appears outside quotes, it IS dynamic — e.g. content: `${icon}`
      if (s.includes(DOLLAR_BRACE)) return "dynamic";
      return "static";
    }

    // Fast prefix checks without startsWith alloc: charCode
    const s = value as string;
    if (s.length >= 6) {
      // NOTE: "theme." and "props." string prefixes are classified as dynamic
      // but string-based token references are NOT fully supported yet.
      // Use $token.path syntax or function-based dynamic values instead.
      // See: token-resolver.ts for supported token reference formats.
      if (s[0] === "t" && s.startsWith(THEME_PREFIX)) return "dynamic";
      if (s[0] === "p" && s.startsWith(PROPS_PREFIX)) return "dynamic";
    }
    // Only one includes scan now
    if (s.includes(DOLLAR_BRACE)) return "dynamic";

    return "static";
  }

  if (t === "number") return "static";

  // Arrays: CSS fallback values like ["-webkit-flex", "flex"]
  if (Array.isArray(value)) {
    return (value as unknown[]).every(
      (v) => typeof v === "string" || typeof v === "number",
    )
      ? "static"
      : "invalid";
  }

  // Booleans, null, etc are invalid
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
