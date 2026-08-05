// ============================================================================
// FILE: src/compiler/pipeline/analyzers/layout-analyzer.ts
// ============================================================================

import type { StyleIR, IRRule } from "../ir/types.js";
import type {
  AnalysisPass,
  AnalysisResult,
  AnalysisAnnotation,
} from "../pipeline-types.js";

interface LayoutPattern {
  name: string;
  description: string;
  macro: string;
  required: Record<string, string | number | ((val: string) => boolean)>;
  optional?: string[];
  minMatches?: number;
}

const LAYOUT_PATTERNS: LayoutPattern[] = [
  {
    name: "flex-center",
    description: "Flexbox centering",
    macro: "center()",
    required: {
      display: "flex",
      "justify-content": "center",
      "align-items": "center",
    },
    minMatches: 3,
  },
  {
    name: "stack-vertical",
    description: "Vertical stack with centering",
    macro: "stack('vertical center')",
    required: {
      display: "flex",
      "flex-direction": "column",
      "justify-content": "center",
      "align-items": "center",
    },
    minMatches: 4,
  },
  {
    name: "flex-between",
    description: "Flexbox space-between",
    macro: "stack('between')",
    required: {
      display: "flex",
      "justify-content": "space-between",
      "align-items": "center",
    },
    minMatches: 3,
  },
  {
    name: "grid-center",
    description: "Grid centering",
    macro: "gridCenter()",
    required: { display: "grid", "place-items": "center" },
    minMatches: 2,
  },
  {
    name: "absolute-center",
    description: "Absolute centering",
    macro: "absolute({ top: '50%', left: '50%' })",
    required: { position: "absolute", top: "50%", left: "50%" },
    minMatches: 3,
  },
  {
    name: "truncate-text",
    description: "Text truncation",
    macro: "truncate()",
    required: {
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    },
    minMatches: 3,
  },
  {
    name: "card-layout",
    description: "Card container",
    macro: "card()",
    required: { "border-radius": "12px", overflow: "hidden" },
    minMatches: 2,
  },
  {
    name: "hero-section",
    description: "Hero section",
    macro: "hero()",
    required: {
      display: "flex",
      "flex-direction": "column",
      "justify-content": "center",
      "align-items": "center",
      width: "100%",
    },
    minMatches: 4,
  },
  {
    name: "sticky-top",
    description: "Sticky top element",
    macro: "stickyHeader()",
    required: { position: "sticky", top: "0" },
    minMatches: 2,
  },
  {
    name: "glass-effect",
    description: "Frosted glass",
    macro: "glass()",
    required: { "backdrop-filter": "blur(16px)" },
    minMatches: 1,
  },
  {
    name: "grid-list",
    description: "Auto-fit responsive grid",
    macro: "gridList()",
    required: {
      display: "grid",
      "grid-template-columns": "repeat(auto-fit, minmax(280px, 1fr))",
    },
    minMatches: 2,
  },
  {
    name: "sidebar-layout",
    description: "Sidebar + main content",
    macro: "sidebar()",
    required: { display: "grid", "min-height": "100vh" },
    minMatches: 2,
  },
  {
    name: "pill-element",
    description: "Fully rounded pill",
    macro: "pill()",
    required: {
      "border-radius": "9999px",
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
    },
    minMatches: 2,
  },
  {
    name: "sr-only",
    description: "Screen-reader only",
    macro: "srOnly()",
    required: {
      position: "absolute",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
    },
    minMatches: 4,
  },
  {
    name: "container-responsive",
    description: "Responsive container",
    macro: "container()",
    required: {
      width: "100%",
      "max-width": "1200px",
      "margin-left": "auto",
      "margin-right": "auto",
    },
    minMatches: 2,
  },
];

function toKebab(s: string) {
  return s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()).toLowerCase();
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalize a CSS value for comparison:
 * - Lowercase
 * - Collapse whitespace
 * - Normalize zero values (0px → 0, 0rem → 0, etc.)
 */
function normalizeValue(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .replace(/\b0(px|rem|em|%|vw|vh)\b/g, "0")
    .replace(/\s+/g, " ");
}

/**
 * Build a normalized property map from declarations.
 * Expands common shorthands so that patterns using longhand properties
 * still match when the author wrote shorthand.
 * Fix 4: Stores all values for duplicate properties (arrays).
 */
function buildNormalizedPropMap(
  declarations: IRRule["declarations"],
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const d of declarations) {
    const prop = toKebab(d.property).trim();
    const val = normalizeValue(String(d.value));

    const existing = map.get(prop) || [];
    existing.push(val);
    map.set(prop, existing);

    // Fix 2: Expand shorthand properties to longhand equivalents
    if (prop === "margin") {
      const parts = val.split(/\s+/);
      if (parts.length === 1 && parts[0] === "auto") {
        map.set("margin-left", ["auto"]);
        map.set("margin-right", ["auto"]);
        map.set("margin-top", ["auto"]);
        map.set("margin-bottom", ["auto"]);
      } else if (parts.length === 2) {
        map.set("margin-top", [parts[0]]);
        map.set("margin-bottom", [parts[0]]);
        map.set("margin-left", [parts[1]]);
        map.set("margin-right", [parts[1]]);
      }
    } else if (prop === "place-items" && val === "center") {
      if (!map.has("align-items")) map.set("align-items", ["center"]);
      if (!map.has("justify-items")) map.set("justify-items", ["center"]);
    }
  }

  return map;
}

function matchPattern(
  rule: IRRule,
  pattern: LayoutPattern,
): { confidence: number; matchedProperties: string[] } | null {
  const propMap = buildNormalizedPropMap(rule.declarations);
  const matchedProperties: string[] = [];
  let matched = 0;
  const totalRequired = Object.keys(pattern.required).length;

  for (const [prop, expected] of Object.entries(pattern.required)) {
    const actualValues = propMap.get(prop);
    if (!actualValues) continue;

    const matches = actualValues.some((actualValue) => {
      if (typeof expected === "function") {
        return (expected as (val: string) => boolean)(actualValue);
      }
      return actualValue === normalizeValue(String(expected));
    });

    if (matches) {
      matched++;
      matchedProperties.push(prop);
    }
  }

  if (pattern.optional) {
    for (const prop of pattern.optional) {
      if (propMap.has(prop)) matchedProperties.push(prop);
    }
  }

  const minMatches = pattern.minMatches || totalRequired;
  if (matched < minMatches) return null;

  const confidence = matched / totalRequired;
  return confidence >= 0.75 ? { confidence, matchedProperties } : null;
}

// ============================================================================
// Analyzer
// ============================================================================

export const layoutAnalyzer: AnalysisPass = {
  name: "layout-analyzer",

  analyze(ir: StyleIR): AnalysisResult {
    const annotations: AnalysisAnnotation[] = [];
    const patternCounts = new Map<
      string,
      { ids: string[]; selectors: string[] }
    >();

    // Fix 5: Guard against undefined diagnostics
    if (!ir.diagnostics) ir.diagnostics = [];

    // Fix 1: Recursively analyze rules including nested ones
    function analyzeRule(rule: IRRule): void {
      if (rule.isDead) return;

      // Fix 3: Track best match per rule to avoid duplicate annotations
      let bestMatch: {
        pattern: LayoutPattern;
        result: NonNullable<ReturnType<typeof matchPattern>>;
      } | null = null;

      for (const pattern of LAYOUT_PATTERNS) {
        const result = matchPattern(rule, pattern);
        if (result) {
          if (
            !bestMatch ||
            Object.keys(pattern.required).length >
              Object.keys(bestMatch.pattern.required).length
          ) {
            bestMatch = { pattern, result };
          }
        }
      }

      if (bestMatch) {
        annotations.push({
          nodeId: rule.id,
          type: "layout-pattern",
          data: {
            pattern: bestMatch.pattern.name,
            macro: bestMatch.pattern.macro,
            confidence: bestMatch.result.confidence,
            matchedProperties: bestMatch.result.matchedProperties,
          },
          confidence: bestMatch.result.confidence,
        });

        const entry = patternCounts.get(bestMatch.pattern.name) || {
          ids: [],
          selectors: [],
        };
        entry.ids.push(rule.id);
        entry.selectors.push(rule.selector);
        patternCounts.set(bestMatch.pattern.name, entry);
      }

      // Fix 1: Recurse into nested rules
      if (rule.nestedRules) {
        for (const nested of rule.nestedRules) {
          analyzeRule(nested);
        }
      }
    }

    for (const rule of ir.rules) {
      analyzeRule(rule);
    }

    // Process duplicate collection mappings
    for (const [patternName, { ids, selectors }] of patternCounts) {
      if (selectors.length >= 2) {
        const pattern = LAYOUT_PATTERNS.find((p) => p.name === patternName);
        ir.diagnostics.push({
          id: `layout-dup-${patternName}`,
          nodeId: ids[0],
          severity: "info",
          message: `Layout pattern "${patternName}" found ${selectors.length} times: ${selectors.join(", ")}`,
          suggestion: pattern
            ? `Consider extracting: ${pattern.macro}`
            : undefined,
          pass: "layout-analyzer",
        });
      }
    }

    return { ir, annotations };
  },
};