// ============================================================================
// FILE: src/compiler/pipeline/analyzers/responsive-analyzer.ts
// ============================================================================

import type { StyleIR, IRRule } from "../ir/types.js";
import type {
  AnalysisPass,
  AnalysisResult,
  AnalysisAnnotation,
  AnalysisContext,
} from "../pipeline-types.js";
import { math } from "../../math-engine.js";

const LARGE_FONT_THRESHOLD = 32;
const LARGE_PADDING_THRESHOLD = 48;
const LARGE_GAP_THRESHOLD = 32;
const MAX_GRID_COLUMNS = 2;

interface ResponsiveIssue {
  ruleId: string;
  selector: string;
  property: string;
  currentValue: string;
  severity: "error" | "warning" | "info";
  category:
    "overflow" | "grid" | "typography" | "spacing" | "viewport" | "columns";
  message: string;
  suggestedFix: string;
  autoFixAvailable: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function toPxSafe(value: string): number {
  try {
    const n = math.toPx(value);
    return isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Fix 4: Normalize property name to kebab-case for consistent matching */
function normalizeProp(prop: string): string {
  return prop.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/** Fix 2: Check if a value is already fluid */
function isAlreadyFluid(value: string): boolean {
  return (
    value.includes("clamp(") ||
    value.includes("min(") ||
    value.includes("max(") ||
    /\d+(\.\d+)?vw\b/.test(value) ||
    /\d+(\.\d+)?vh\b/.test(value) ||
    value.includes("%")
  );
}

/** Fix 1: Check if a rule is scoped inside a desktop media query */
function isDesktopScoped(rule: IRRule, mdBp: number): boolean {
  if (!rule.atRules || rule.atRules.length === 0) return false;
  return rule.atRules.some((at) => {
    if (!at.query || !at.query.includes("min-width")) return false;
    const match = at.query.match(/min-width:\s*(\d+)(px|rem|em)/);
    if (!match) return false;
    const val = parseFloat(match[1]);
    const px = match[2] === "rem" || match[2] === "em" ? val * 16 : val;
    return px >= mdBp;
  });
}

/** Fix 5: Count grid columns including tracks outside repeat() */
function countGridColumns(value: string): number {
  const repeatMatch = value.match(/repeat\(\s*(\d+)/);
  if (repeatMatch) {
    const repeatedCount = parseInt(repeatMatch[1], 10);
    const remainder = value.replace(/repeat\([^)]+\)/g, "").trim();
    if (!remainder) return repeatedCount;
    const extraTracks = remainder.split(/\s+/).filter(Boolean).length;
    return repeatedCount + extraTracks;
  }
  const sanitizedValue = value.replace(/\([^)]*\)/g, "X");
  return sanitizedValue
    .split(/\s+/)
    .filter(
      (c: string) =>
        c.includes("fr") || c.includes("px") || c.includes("%") || c === "X",
    ).length;
}

// ============================================================================
// Detectors
// ============================================================================

function detectFixedWidth(
  rule: IRRule,
  bp: { md: number; lg: number },
): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  for (const decl of rule.declarations || []) {
    const prop = normalizeProp(decl.property);

    // Fix 3: Only flag "width" and "min-width", not "max-width"
    if (
      (prop === "width" || prop === "min-width") &&
      typeof decl.value === "string"
    ) {
      // Fix 2: Skip already-fluid values
      if (isAlreadyFluid(decl.value)) continue;

      const px = toPxSafe(decl.value);
      if (px === 0) continue;
      const parsed = math.parse(decl.value);
      if ((parsed as any).unit === "expression") continue;
      if (px > bp.md) {
        issues.push({
          ruleId: rule.id,
          selector: rule.selector,
          property: decl.property,
          currentValue: decl.value,
          severity: px > bp.lg ? "error" : "warning",
          category: "overflow",
          message: `Fixed ${decl.property}: ${decl.value} will overflow on viewports < ${px}px`,
          suggestedFix: `${decl.property}: min(100%, ${decl.value});`,
          autoFixAvailable: true,
        });
      }
    }
  }
  return issues;
}

function detectGridColumns(
  rule: IRRule,
  _bp: { md: number; lg: number },
): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  for (const decl of rule.declarations || []) {
    const prop = normalizeProp(decl.property);
    const isGridProp =
      prop === "grid-template-columns" || prop === "gridtemplatecolumns";
    if (isGridProp && typeof decl.value === "string") {
      // Fix 5: Use accurate column counter
      const colCount = countGridColumns(decl.value);
      if (colCount > MAX_GRID_COLUMNS) {
        issues.push({
          ruleId: rule.id,
          selector: rule.selector,
          property: decl.property,
          currentValue: decl.value,
          severity: colCount >= 4 ? "error" : "warning",
          category: "grid",
          message: `${colCount} columns will not fit on mobile screens`,
          suggestedFix: `grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));`,
          autoFixAvailable: true,
        });
      }
    }
  }
  return issues;
}

function detectLargeTypography(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  for (const decl of rule.declarations || []) {
    const prop = normalizeProp(decl.property);
    if (prop === "font-size" && typeof decl.value === "string") {
      // Fix 2: Skip already-fluid values
      if (isAlreadyFluid(decl.value)) continue;

      const px = toPxSafe(decl.value);
      if (px > LARGE_FONT_THRESHOLD) {
        const minSize = Math.round(px * 0.5);
        issues.push({
          ruleId: rule.id,
          selector: rule.selector,
          property: decl.property,
          currentValue: decl.value,
          severity: "warning",
          category: "typography",
          message: `font-size: ${decl.value} may be too large on mobile. Consider responsive scaling.`,
          suggestedFix: `font-size: clamp(${minSize}px, ${Math.round((px / 1024) * 100)}vw, ${px}px);`,
          autoFixAvailable: true,
        });
      }
    }
  }
  return issues;
}

function detectViewportUnits(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  for (const decl of rule.declarations || []) {
    const prop = normalizeProp(decl.property);
    // Fix 4: Also catch min-height, max-height, and camelCase variants
    const isHeightProp =
      prop === "height" || prop === "min-height" || prop === "max-height";
    if (!isHeightProp || typeof decl.value !== "string") continue;

    const parsed = math.parse(decl.value);
    const cat = math.unitCategory(parsed.unit as any);
    const raw = decl.value;
    if (
      cat === "viewport" ||
      raw.includes("vh") ||
      raw.includes("dvh") ||
      raw.includes("svh")
    ) {
      if (raw.includes("100vh")) {
        issues.push({
          ruleId: rule.id,
          selector: rule.selector,
          property: decl.property,
          currentValue: decl.value,
          severity: "warning",
          category: "viewport",
          message:
            "100vh can cause issues on mobile browsers with dynamic toolbars. Consider 100dvh instead.",
          suggestedFix: `${decl.property}: 100dvh;`,
          autoFixAvailable: true,
        });
      }
    }
  }
  return issues;
}

function detectLargePadding(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  for (const decl of rule.declarations || []) {
    const prop = normalizeProp(decl.property);
    if (!prop.includes("padding") || typeof decl.value !== "string") continue;

    // Fix 2: Skip multi-value shorthands and already-fluid values
    if (isAlreadyFluid(decl.value)) continue;
    if (decl.value.trim().split(/\s+/).length > 1) continue;

    const px = toPxSafe(decl.value);
    if (px > LARGE_PADDING_THRESHOLD) {
      issues.push({
        ruleId: rule.id,
        selector: rule.selector,
        property: decl.property,
        currentValue: decl.value,
        severity: px > 80 ? "error" : "warning",
        category: "spacing",
        message: `Large ${decl.property}: ${decl.value} may cause overflow on mobile`,
        suggestedFix: `${decl.property}: clamp(16px, 5vw, ${decl.value});`,
        autoFixAvailable: true,
      });
    }
  }
  return issues;
}

function detectLargeGap(rule: IRRule): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  for (const decl of rule.declarations || []) {
    const prop = normalizeProp(decl.property);
    if (!prop.includes("gap") || typeof decl.value !== "string") continue;

    // Fix 2: Skip already-fluid values
    if (isAlreadyFluid(decl.value)) continue;

    const px = toPxSafe(decl.value);
    if (px > LARGE_GAP_THRESHOLD) {
      issues.push({
        ruleId: rule.id,
        selector: rule.selector,
        property: decl.property,
        currentValue: decl.value,
        severity: "warning",
        category: "spacing",
        message: `Large ${decl.property}: ${decl.value} may cause layout issues on mobile`,
        suggestedFix: `${decl.property}: clamp(16px, 4vw, ${decl.value});`,
        autoFixAvailable: true,
      });
    }
  }
  return issues;
}

// ============================================================================
// Analyzer
// ============================================================================

export const responsiveAnalyzer: AnalysisPass = {
  name: "responsive-analyzer",
  analyze(ir: StyleIR, context: AnalysisContext = {} as any): AnalysisResult {
    const configBreakpoints = (context as any)?.breakpoints || {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    };
    const md = toPxSafe(configBreakpoints.md) || 768;
    const lg = toPxSafe(configBreakpoints.lg) || 1024;
    const bp = { md, lg };

    const annotations: AnalysisAnnotation[] = [];
    const allIssues: ResponsiveIssue[] = [];

    // Fix 6: Guard against undefined diagnostics
    if (!ir.diagnostics) ir.diagnostics = [];

    // Fix 1: Recursively collect rules, checking for desktop scope
    function analyzeRules(rules: IRRule[], isDesktop: boolean): void {
      for (const rule of rules) {
        if (rule.isDead) continue;

        // Determine if this rule is desktop-scoped
        const ruleIsDesktop = isDesktop || isDesktopScoped(rule, md);

        // Only analyze non-desktop rules for responsive issues
        if (!ruleIsDesktop) {
          const issues = [
            ...detectFixedWidth(rule, bp),
            ...detectGridColumns(rule, bp),
            ...detectLargeTypography(rule),
            ...detectViewportUnits(rule),
            ...detectLargePadding(rule),
            ...detectLargeGap(rule),
          ];
          allIssues.push(...issues);
          if (issues.length > 0) {
            annotations.push({
              nodeId: rule.id,
              type: "responsive-issues",
              data: { issues, count: issues.length },
              confidence: issues.some((i) => i.severity === "error") ? 1 : 0.7,
            });
          }
        }

        // Fix 1: Recurse into nested rules
        if (rule.nestedRules && rule.nestedRules.length > 0) {
          analyzeRules(rule.nestedRules, ruleIsDesktop);
        }
      }
    }

    analyzeRules(ir.rules, false);

    for (const issue of allIssues) {
      ir.diagnostics.push({
        id: `responsive-${issue.category}-${issue.property}-${issue.ruleId}`,
        nodeId: issue.ruleId,
        severity: issue.severity,
        message: issue.message,
        suggestion: issue.suggestedFix,
        pass: "responsive-analyzer",
      });
    }
    return { ir, annotations };
  },
};