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

function toPxSafe(value: string): number {
  try {
    const n = math.toPx(value);
    return isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function detectFixedWidth(
  rule: IRRule,
  bp: { md: number; lg: number },
): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  for (const decl of rule.declarations || []) {
    if (
      (decl.property === "width" || decl.property === "max-width") &&
      typeof decl.value === "string"
    ) {
      const px = toPxSafe(decl.value);
      if (px === 0) continue;
      // only flag if it's a fixed absolute value, not %
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
  bp: { md: number; lg: number },
): ResponsiveIssue[] {
  // unchanged - no units
  const issues: ResponsiveIssue[] = [];
  for (const decl of rule.declarations || []) {
    const isGridProp =
      decl.property === "gridTemplateColumns" ||
      decl.property === "grid-template-columns";
    if (isGridProp && typeof decl.value === "string") {
      const repeatMatch = decl.value.match(/repeat\((\d+)/);
      let colCount = 0;
      if (repeatMatch) colCount = parseInt(repeatMatch[1], 10);
      else {
        const sanitizedValue = decl.value.replace(/\([^)]*\)/g, "X");
        colCount = sanitizedValue
          .split(/\s+/)
          .filter(
            (c: string) =>
              c.includes("fr") ||
              c.includes("px") ||
              c.includes("%") ||
              c === "X",
          ).length;
      }
      if (colCount > MAX_GRID_COLUMNS) {
        issues.push({
          ruleId: rule.id,
          selector: rule.selector,
          property: decl.property,
          currentValue: decl.value,
          severity: colCount >= 4 ? "error" : "warning",
          category: "grid",
          message: `${colCount} columns will not fit on mobile screens (≤ ${bp.md}px)`,
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
    if (
      (decl.property === "fontSize" || decl.property === "font-size") &&
      typeof decl.value === "string"
    ) {
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
    const isHeightProp =
      decl.property === "height" || decl.property === "min-height";
    if (!isHeightProp || typeof decl.value !== "string") continue;
    const parsed = math.parse(decl.value);
    const cat = math.unitCategory(parsed.unit as any);
    const raw = decl.value;
    // catches 100vh, 100dvh, calc(100vh -...), etc.
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
    if (!decl.property.includes("padding") || typeof decl.value !== "string")
      continue;
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
    if (!decl.property.includes("gap") || typeof decl.value !== "string")
      continue;
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

    for (const rule of ir.rules) {
      if (rule.isDead) continue;
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
