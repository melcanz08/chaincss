// ============================================================================
// FILE: src/compiler/pipeline/ir/factory.ts
// ============================================================================

import type {
  IRNodeId,
  IRDeclaration,
  IRRule,
  IRTransformRecord,
  IRDynamicValue,
  StyleIR,
  SourceLocation,
  ParsedValue,
  IRKeyframeFrame,
} from "./types.js";

import { VERSION } from "@shared/constants/index.js";

/** Split function arguments respecting nested parentheses and string literals */
function splitFuncArgs(args: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";
  let inQuote: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const char = args[i];

    if (inQuote) {
      current += char;
      if (char === inQuote && args[i - 1] !== "\\") {
        inQuote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inQuote = char;
      current += char;
      continue;
    }

    if (char === "(") depth++;
    if (char === ")") depth--;

    if (char === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

/** Verify if a string is wrapped in a single top-level CSS function call */
function isSingleFunction(
  trimmed: string,
): { name: string; args: string } | null {
  const match = trimmed.match(/^([a-zA-Z_][\w-]*)\((.*)\)$/s);
  if (!match) return null;

  const openParenIdx = trimmed.indexOf("(");
  let depth = 0;
  let inQuote: string | null = null;

  for (let i = openParenIdx; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (inQuote) {
      if (char === inQuote && trimmed[i - 1] !== "\\") inQuote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      inQuote = char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth--;

    // Reached depth 0 prior to end of input -> multiple tokens (e.g., `fn1() fn2()`)
    if (depth === 0 && i < trimmed.length - 1) {
      return null;
    }
  }

  return depth === 0 ? { name: match[1], args: match[2] } : null;
}

// ============================================================================
// Value Parser — lightweight, token-safe tokenizer
// ============================================================================

/**
 * Parse a CSS declaration value into structured form.
 * Stored in meta.parsed for use by feature detection and optimization passes.
 * Falls back to { kind: 'raw' } for unparseable values — no errors thrown.
 */
export function parseValue(raw: string | number): ParsedValue {
  if (typeof raw === "number") {
    return { kind: "number", value: raw };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { kind: "raw", value: trimmed };
  }

  // Quoted String: "foo", 'bar'
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return { kind: "string", value: trimmed.slice(1, -1) } as ParsedValue;
  }

  // Dimension: 16px, 2rem, 100vh, 50%, 0.5fr, 100cqw, 300ms, 45deg
  const dimMatch = trimmed.match(
    /^([+-]?\d*\.?\d+)(px|rem|em|vh|vw|vmin|vmax|dvh|dvw|svh|svw|lvh|lvw|cqw|cqh|cqi|cqb|cqmin|cqmax|%|ch|ex|cap|ic|lh|rlh|fr|cm|mm|in|pt|pc|ms|s|deg|rad|grad|turn|dpi|dpcm|dppx)$/i,
  );
  if (dimMatch) {
    return {
      kind: "dimension",
      value: parseFloat(dimMatch[1]),
      unit: dimMatch[2].toLowerCase(),
    };
  }

  // Plain number string: "0", "1.5", "-2"
  const numMatch = trimmed.match(/^[+-]?\d*\.?\d+$/);
  if (numMatch) {
    return { kind: "number", value: parseFloat(trimmed) };
  }

  // Hex color: #fff, #a1b2c3, #a1b2c3ff
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return { kind: "color", hex: trimmed };
  }

  // Top-level function call: rgb(...), var(...), calc(...), clamp(...)
  const funcCall = isSingleFunction(trimmed);
  if (funcCall) {
    return {
      kind: "function",
      name: funcCall.name,
      args: splitFuncArgs(funcCall.args).map((arg) => parseValue(arg)),
    };
  }

  // Space or comma-separated list handling without fracturing nested expressions or strings
  if (trimmed.includes(" ") || trimmed.includes(",")) {
    const separator = trimmed.includes(",") ? "," : " ";
    const rawItems: string[] = [];
    let current = "";
    let depth = 0;
    let inQuote: string | null = null;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (inQuote) {
        current += char;
        if (char === inQuote && trimmed[i - 1] !== "\\") inQuote = null;
        continue;
      }

      if (char === '"' || char === "'") {
        inQuote = char;
        current += char;
        continue;
      }

      if (char === "(") depth++;
      if (char === ")") depth--;

      if ((char === separator || (separator === " " && char === ",")) && depth === 0) {
        if (current.trim()) {
          rawItems.push(current.trim());
          current = "";
        }
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      rawItems.push(current.trim());
    }

    // Only recurse if the string was actually split into multiple distinct items
    if (rawItems.length > 1) {
      return {
        kind: "list",
        items: rawItems.map((item) => parseValue(item)),
        separator,
      } as ParsedValue;
    }
  }

  // Everything else: keyword (flex, grid, none, auto, center, etc.)
  return { kind: "keyword", value: trimmed };
}

// ============================================================================
// ID Generator
// ============================================================================

let idCounter = 0;
export function nextId(prefix: string = "ir"): IRNodeId {
  return prefix + "-" + (idCounter++).toString(36);
}

let _resetCount = 0;
function stableId(prefix: string, key: string): string {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

export function ruleId(selector: string, source?: SourceLocation): IRNodeId {
  return stableId("rule", `${source?.file ?? ""}:${selector}`);
}

export function declarationId(ruleSelector: string, property: string): IRNodeId {
  return stableId("decl", `${ruleSelector}:${property}`);
}

export function frameId(keyText: string, source?: SourceLocation): IRNodeId {
  return stableId("frame", `${source?.file ?? ""}:${keyText}`);
}

export function resetIdCounter(): void {
  idCounter = 0;
  _resetCount++;
  if (
    _resetCount > 1 &&
    typeof process !== "undefined" &&
    process.env?.NODE_ENV !== "production" &&
    process.env?.NODE_ENV !== "test"
  ) {
    console.warn(
      "[ChainCSS] resetIdCounter() called multiple times — possible dual-import of factory.ts.",
    );
  }
}

// ============================================================================
// IR Factory — create nodes safely
// ============================================================================

export function record(
  pass: string,
  action: string,
  previous?: any,
  reason?: string,
): IRTransformRecord {
  return { pass, action, timestamp: Date.now(), previous, reason };
}

export function createDeclaration(
  property: string,
  value: string | number,
  source?: SourceLocation,
  meta: Record<string, any> = {},
): IRDeclaration {
  const { dynamic, ...restMeta } = meta;
  return {
    id: declarationId(source?.file ?? "inline", property),
    property,
    value,
    source,
    history: [
      record("parser", "created", undefined, "Parsed from StyleDefinition"),
    ],
    meta: {
      ...restMeta,
      parsed: parseValue(value),
    },
    dynamic: dynamic as IRDynamicValue | undefined,
  };
}

export function createRule(
  selector: string,
  source?: SourceLocation,
  parentId?: IRNodeId,
): IRRule {
  return {
    id: ruleId(selector, source),
    parentId,
    selector,
    declarations: [],
    pseudoClasses: [],
    atRules: [],
    nestedRules: [],
    conditions: [],
    _dirty: true,
    isDead: false,
    specificity: 0,
    hash: "",
    source: source || {},
    history: [
      record("parser", "created", undefined, "Parsed from StyleDefinition"),
    ],
    meta: {},
  };
}

export function createKeyframeFrame(
  keyText: string,
  source?: SourceLocation,
): IRKeyframeFrame {
  return {
    id: frameId(keyText, source),
    keyText,
    declarations: [],
    source: source || {},
  };
}

export function createIR(sourceFiles: string[] = []): StyleIR {
  return {
    id: nextId("ir"),
    rules: [],
    atRules: [],
    diagnostics: [],
    meta: {
      version: VERSION,
      createdAt: Date.now(),
      sourceFiles,
      passCount: 0,
      passes: [],
      dirtyRules: 0,
      compiledAt: Date.now(),
    },
  };
}