// ============================================================================
// FILE: src/compiler/pipeline/validators/accessibility-validator.ts
// ============================================================================

import type { StyleIR, IRRule, IRDeclaration } from "../ir/types.js";
import type {
  ValidationPass,
  ValidationResult,
  Diagnostic,
} from "../pipeline-types.js";
import { contrastRatio } from "../../tokens/design-orchestrator.js";

const WCAG = {
  MIN_CONTRAST_AA: 4.5,
  MIN_FONT_SIZE: 12,
  MIN_TOUCH_TARGET: 44,
  DEFAULT_REM_BASE: 16,
};

function convertToPx(value: string): number {
  if (!value || typeof value !== "string") return Infinity;
  const match = value.trim().match(/^([+-]?\d+(\.\d+)?)\s*([a-zA-Z%]+)?$/);
  if (!match) return Infinity;
  const num = parseFloat(match[1]);
  if (num === 0) return 0; // Prevent unitless zero returning Infinity

  const unit = match[3]?.toLowerCase();
  switch (unit) {
    case "px":
      return num;
    case "rem":
    case "em":
      return num * WCAG.DEFAULT_REM_BASE;
    case "pt":
      return num * (4 / 3);
    default:
      return Infinity;
  }
}

function detectContrastIssues(
  rule: IRRule,
  globalContext: Map<string, string>,
): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const colorDecl = rule.declarations.find(
    (d) => d.property === "color" && typeof d.value === "string",
  );
  const bgDecl = rule.declarations.find(
    (d) =>
      ["backgroundColor", "background-color", "background"].includes(
        d.property,
      ) &&
      typeof d.value === "string" &&
      !d.value.includes("url(") &&
      !d.value.includes("gradient"),
  );

  // Skip if rule defines neither text color nor background (prevents global fallback duplication)
  if (!colorDecl && !bgDecl) return issues;

  const colorVal = colorDecl
    ? String(colorDecl.value)
    : globalContext.get("color");
  const bgVal = bgDecl ? String(bgDecl.value) : globalContext.get("background");

  if (colorVal && bgVal) {
    if (
      colorVal.includes("var(") ||
      bgVal.includes("var(") ||
      colorVal === "currentColor" ||
      bgVal === "currentColor"
    ) {
      return issues;
    }
    try {
      const ratio = contrastRatio(colorVal, bgVal);
      if (ratio > 0 && ratio < WCAG.MIN_CONTRAST_AA) {
        issues.push({
          id: `a11y-contrast-${rule.id}`,
          nodeId: rule.id,
          severity: "error",
          category: "contrast",
          message: `Contrast ratio ${ratio.toFixed(1)}:1 fails WCAG AA standards (requires ≥ ${WCAG.MIN_CONTRAST_AA}:1)`,
          suggestion: `Darken text color or lighten background layer. Current configuration: ${colorVal} text on ${bgVal} background`,
          wcagCriterion: "1.4.3 Contrast (Minimum) — AA",
          autoFixable: false,
        });
      }
    } catch {
      // Complex CSS color expression or unparseable token
    }
  }
  return issues;
}

function detectFontSizeIssues(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  for (const decl of rule.declarations || []) {
    if (typeof decl.value !== "string") continue;
    
    let fontValue: string | null = null;
    if (["fontSize", "font-size"].includes(decl.property)) {
      fontValue = decl.value;
    } else if (decl.property === "font") {
      // Handle shorthand font syntax (e.g. "10px/1.5 sans-serif")
      const sizeMatch = decl.value
        .split(/\s+/)
        .find((p) => /^([+-]?\d+(\.\d+)?)(px|rem|em|pt)/i.test(p));
      if (sizeMatch) fontValue = sizeMatch.split("/")[0];
    }

    if (fontValue) {
      const pxValue = convertToPx(fontValue);
      if (pxValue < WCAG.MIN_FONT_SIZE) {
        issues.push({
          id: `a11y-fontsize-${rule.id}`,
          nodeId: rule.id,
          severity: "warning",
          category: "font-size",
          message: `font-size: ${fontValue} is below the readable WCAG recommendation of ${WCAG.MIN_FONT_SIZE}px`,
          suggestion: `Set font-size: max(${WCAG.MIN_FONT_SIZE}px, ${fontValue}) or convert to scalable units (rem)`,
          wcagCriterion: "1.4.4 Resize Text — AA",
          autoFixable: true,
        });
      }
    }
  }
  return issues;
}

function detectTouchTargetIssues(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const selector = (rule.selector || "").toLowerCase();
  const isInteractive = rule.declarations.some(
    (d) => d.property === "cursor" && d.value === "pointer",
  );
  const isSemanticClickable =
    /\b(button|btn|input|select|textarea|card-link|clickable)\b|(\ba\b|\[href\])/i.test(
      selector,
    );

  if (!isInteractive && !isSemanticClickable) return issues;

  let declaredWidth = 0;
  let declaredMinWidth = 0;
  let declaredHeight = 0;
  let declaredMinHeight = 0;
  let hasWidth = false;
  let hasHeight = false;

  for (const d of rule.declarations || []) {
    if (typeof d.value !== "string") continue;
    const px = convertToPx(d.value);
    if (px === Infinity) continue;

    if (d.property === "width") {
      declaredWidth = Math.max(declaredWidth, px);
      hasWidth = true;
    }
    if (["min-width", "min-inline-size"].includes(d.property)) {
      declaredMinWidth = Math.max(declaredMinWidth, px);
      hasWidth = true;
    }
    if (d.property === "height") {
      declaredHeight = Math.max(declaredHeight, px);
      hasHeight = true;
    }
    if (["min-height", "min-block-size"].includes(d.property)) {
      declaredMinHeight = Math.max(declaredMinHeight, px);
      hasHeight = true;
    }
  }

  const effectiveWidth = hasWidth
    ? Math.max(declaredWidth, declaredMinWidth)
    : Infinity;
  const effectiveHeight = hasHeight
    ? Math.max(declaredHeight, declaredMinHeight)
    : Infinity;

  if (
    effectiveWidth < WCAG.MIN_TOUCH_TARGET ||
    effectiveHeight < WCAG.MIN_TOUCH_TARGET
  ) {
    issues.push({
      id: `a11y-touch-${rule.id}`,
      nodeId: rule.id,
      severity: "warning",
      category: "touch-target",
      message: `Interactive element "${rule.selector}" target size may be too small (found ${effectiveWidth === Infinity ? "auto" : effectiveWidth + "px"} × ${effectiveHeight === Infinity ? "auto" : effectiveHeight + "px"}, requires ≥ ${WCAG.MIN_TOUCH_TARGET}×${WCAG.MIN_TOUCH_TARGET}px)`,
      suggestion: `Apply min-width: ${WCAG.MIN_TOUCH_TARGET}px; min-height: ${WCAG.MIN_TOUCH_TARGET}px; or expand interactive bounds with padding`,
      wcagCriterion: "2.5.8 Target Size — AA",
      autoFixable: true,
    });
  }
  return issues;
}

function detectFocusIssues(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const hasPointer = rule.declarations.some(
    (d) => d.property === "cursor" && d.value === "pointer",
  );
  const isSemanticInput = /\b(button|input|select|textarea)\b|(\ba\b|\[href\])/i.test(
    rule.selector || "",
  );
  if (!hasPointer && !isSemanticInput) return issues;

  const outline = rule.declarations.find((d) =>
    ["outline", "outline-style", "outline-width"].includes(d.property),
  );

  const hasNoneOutline =
    outline &&
    (String(outline.value).toLowerCase().includes("none") ||
      String(outline.value).trim() === "0" ||
      (outline.property === "outline-width" &&
        convertToPx(String(outline.value)) === 0));

  const pseudoClasses = (rule as any).pseudoClasses || [];
  const hasFocusStyle = pseudoClasses.some(
    (pc: any) =>
      ["focus", "focus-visible", "focus-within"].includes(pc.name) &&
      pc.declarations?.length > 0,
  );

  if (hasNoneOutline && !hasFocusStyle) {
    issues.push({
      id: `a11y-focus-${rule.id}`,
      nodeId: rule.id,
      severity: "error",
      category: "focus",
      message: `"${rule.selector}" removes the default outline without a keyboard :focus-visible override`,
      suggestion:
        "Add :focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }",
      wcagCriterion: "2.4.7 Focus Visible — AA",
      autoFixable: true,
    });
  }
  return issues;
}

function detectMotionIssues(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const allDecls = [
    ...rule.declarations,
    ...((rule as any).pseudoClasses?.flatMap(
      (pc: any) => pc.declarations || [],
    ) || []),
  ];
  const hasAnimation = allDecls.some(
    (d) =>
      [
        "animation",
        "transition",
        "animation-name",
        "transition-property",
      ].includes(d.property) && !String(d.value).includes("none"),
  );
  const atRules = rule.atRules || [];
  const hasReducedMotion = atRules.some(
    (at) =>
      at.type === "media" &&
      at.query &&
      at.query.toLowerCase().includes("prefers-reduced-motion"),
  );
  if (hasAnimation && !hasReducedMotion) {
    issues.push({
      id: `a11y-motion-${rule.id}`,
      nodeId: rule.id,
      severity: "warning",
      category: "motion",
      message: `"${rule.selector}" deploys animations without prefers-reduced-motion`,
      suggestion:
        "Wrap in @media (prefers-reduced-motion: no-preference) { ... }",
      wcagCriterion: "2.3.3 Animation from Interactions — AAA",
      autoFixable: true,
    });
  }
  return issues;
}

function detectHoverOnlyIssues(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const pseudoClasses = (rule as any).pseudoClasses || [];
  const hasHover = pseudoClasses.some(
    (pc: any) => pc.name === "hover" && pc.declarations?.length > 0,
  );
  const hasFocus = pseudoClasses.some(
    (pc: any) =>
      ["focus", "focus-visible"].includes(pc.name) &&
      pc.declarations?.length > 0,
  );
  if (hasHover && !hasFocus) {
    issues.push({
      id: `a11y-hover-${rule.id}`,
      nodeId: rule.id,
      severity: "warning",
      category: "hover-only",
      message: `"${rule.selector}" has :hover but no :focus-visible fallback`,
      suggestion: "Mirror hover styles to :focus-visible for keyboard users.",
      wcagCriterion: "1.4.13 Content on Hover or Focus — AA",
      autoFixable: true,
    });
  }
  return issues;
}

export const accessibilityValidator: ValidationPass = {
  name: "accessibility-validator",
  validate(ir: StyleIR): ValidationResult {
    const diagnostics: Diagnostic[] = [];
    if (!ir || !ir.rules) {
      return {
        diagnostics: [],
        passed: true,
        stats: { errors: 0, warnings: 0, info: 0, hints: 0 },
      };
    }
    const globalContext = new Map<string, string>();
    for (const rule of ir.rules) {
      if ([":root", "body", "html"].includes(rule.selector)) {
        for (const d of rule.declarations || []) {
          if (d.property === "color")
            globalContext.set("color", String(d.value));
          if (
            ["backgroundColor", "background-color", "background"].includes(
              d.property,
            )
          ) {
            globalContext.set("background", String(d.value));
          }
        }
      }
    }
    for (const rule of ir.rules) {
      if (rule.isDead) continue;
      diagnostics.push(
        ...detectContrastIssues(rule, globalContext),
        ...detectFontSizeIssues(rule),
        ...detectTouchTargetIssues(rule),
        ...detectFocusIssues(rule),
        ...detectMotionIssues(rule),
        ...detectHoverOnlyIssues(rule),
      );
    }
    const errors = diagnostics.filter((d) => d.severity === "error").length;
    const warnings = diagnostics.filter((d) => d.severity === "warning").length;
    const info = diagnostics.filter((d) => d.severity === "info").length;
    const hints = diagnostics.filter((d) => d.severity === "hint").length;
    return {
      diagnostics,
      passed: errors === 0,
      stats: { errors, warnings, info, hints },
    };
  },
};