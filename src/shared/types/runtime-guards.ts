// ============================================================================
// // src/shared/types/style-types.ts - Runtime type guards - separate from types to avoid browser bundling issues
// ============================================================================

import type { 
  StyleDefinition, 
  AtRule, 
  AtomicClass, 
  CompileResult, 
  CSSPrimitiveValue, 
  PseudoStyles, 
  NestedRule, 
  MathResult, 
  CorrectionResult, 
  GraphCompileResult,
  ParsedStyleObject
} from "./index.js";
import type {CSSProperties,PseudoClasses,DynamicValueGetter} from "./style-types.ts"

export function isStyleDefinition(value: unknown): value is StyleDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as StyleDefinition).selectors)
  );
}

export function isAtRule(value: unknown): value is AtRule {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as AtRule).type;
  return [
    "media", "keyframes", "font-face", "supports",
    "container", "layer", "counter-style", "property",
    "scope", "starting-style", "view-transition",
    "page", "import", "namespace",
  ].includes(type as string);
}

export function isAtomicClass(value: unknown): value is AtomicClass {
  if (typeof value !== "object" || value === null) return false;
  const a = value as AtomicClass;
  return typeof a.className === "string" && typeof a.prop === "string";
}

export function isCompileResult(value: unknown): value is CompileResult {
  if (typeof value !== "object" || value === null) return false;
  const c = value as CompileResult;
  return typeof c.css === "string" && typeof c.classMap === "object" && typeof c.stats === "object";
}

export function isPseudoStyles(value: unknown): value is PseudoStyles {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(
    (v) => isCSSPrimitiveValue(v) || isDynamicValue(v),
  );
}

export function isCSSPrimitiveValue(value: unknown): value is CSSPrimitiveValue {
  if (typeof value === "string" || typeof value === "number") return true;
  if (Array.isArray(value)) {
    return value.every((v) => typeof v === "string" || typeof v === "number");
  }
  return false;
}

export function isDynamicValue(
  value: unknown,
): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

export function isNestedRuleV2(value: unknown): value is NestedRule {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.selector === "string" && typeof obj.styles === "object" && obj.styles !== null;
}

export function isAtRuleV2(value: unknown): value is AtRule {
  return isAtRule(value);
}

// Fix #1: Internal keys that must never leak into regularProps
const INTERNAL_SKIP = new Set([
  "_classes", "_mixed", "_intents", "_transforms", "_name",
]);

export function parseStyleObject(
  obj: Record<string, unknown>,
): ParsedStyleObject {
  const regularProps: CSSProperties = {};
  const pseudoClasses: PseudoClasses = {};
  const atRules: AtRule[] = [];
  const nestedRules: NestedRule[] = [];
  let selectors: string | string[] | undefined;

  // Fix #2: Preserve insertion order for CSS cascade — no alphabetical sort
  const keys = Object.keys(obj);

  for (const key of keys) {
    const value = obj[key];

    // Fix #1: Skip internal metadata keys
    if (INTERNAL_SKIP.has(key)) continue;

    if (key === "_atRules" && Array.isArray(value)) {
      atRules.push(...value.filter(isAtRuleV2));
      continue;
    }
    if (key === "_nestedRules" && Array.isArray(value)) {
      nestedRules.push(...value.filter((r): r is NestedRule => isNestedRuleV2(r)));
      continue;
    }
    if (key === "_intents" && Array.isArray(value)) {
      continue; // already handled by INTERNAL_SKIP
    }

    if (key === "selectors") {
      if (
        typeof value === "string" ||
        (Array.isArray(value) && value.every((v) => typeof v === "string"))
      ) {
        selectors = value as string | string[];
      }
      continue;
    }

    if (key.startsWith("&:")) {
      if (isPseudoStyles(value)) {
        pseudoClasses[key as `&:${string}`] = value;
      }
      continue;
    }

    if (key === "nestedRules" && Array.isArray(value)) {
      nestedRules.push(...value.filter((r): r is NestedRule => isNestedRuleV2(r)));
      continue;
    }

    if (key === "atRules" && Array.isArray(value)) {
      atRules.push(...value.filter(isAtRuleV2));
      continue;
    }

    if (isCSSPrimitiveValue(value) || isDynamicValue(value)) {
      regularProps[key] = value as CSSPrimitiveValue | DynamicValueGetter;
    }
  }

  return { regularProps, pseudoClasses, atRules, nestedRules, selectors };
}

// ============================================================================
// Type Guards for new tools
// ============================================================================

export function isMathResult(value: unknown): value is MathResult {
  if (typeof value !== "object" || value === null) return false;
  const m = value as MathResult;
  return typeof m.expression === "string" && typeof m.toString === "function";
}

export function isCorrectionResult(value: unknown): value is CorrectionResult {
  if (typeof value !== "object" || value === null) return false;
  const c = value as CorrectionResult;
  return typeof c.original === "string" && typeof c.corrected === "string" && typeof c.confidence === "number";
}

export function isGraphCompileResult(value: unknown): value is GraphCompileResult {
  if (!isCompileResult(value)) return false;
  const g = value as GraphCompileResult;
  return typeof g.graph === "object" && typeof g.eliminatedDead === "number";
}