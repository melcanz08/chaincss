// ============================================================================
// FILE: src/compiler/pipeline/optimizers/accessibility-optimizer.ts
// ============================================================================

import { recordHistory } from "../ir/utils.js";
import { createDeclaration } from "../ir/index.js";
import type { StyleIR, IRRule } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";

const WCAG = {
  MIN_FONT_SIZE: 12,
  MIN_TOUCH_TARGET: 44,
};

/**
 * Standardize property names to kebab-case for consistent IR inspection.
 */
function normalizeProp(prop: string): string {
  return prop.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Parses pixel values or unitless 0. Returns numeric value or null if relative/non-pixel.
 */
function parsePxValue(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;

  const str = String(value).trim().toLowerCase();
  if (str === "0") return 0;

  const match = str.match(/^(\d+(?:\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Detects if a rule represents a screen-reader-only or visually hidden utility.
 */
function isVisuallyHiddenRule(rule: IRRule, declMap: Map<string, string>): boolean {
  if (rule.selector) {
    const sel = rule.selector.toLowerCase();
    if (sel.includes("sr-only") || sel.includes("visually-hidden")) return true;
  }

  const width = declMap.get("width");
  const height = declMap.get("height");
  const clip = declMap.get("clip") || declMap.get("clip-path");
  const overflow = declMap.get("overflow");

  const isTiny =
    (width === "1px" || width === "0" || width === "0px") &&
    (height === "1px" || height === "0" || height === "0px");

  return Boolean(isTiny && (clip || overflow === "hidden"));
}

/**
 * Evaluates whether an outline declaration explicitly strips focus indicators.
 */
function isOutlineStripped(valStr: string): boolean {
  const clean = valStr.replace(/!important/g, "").trim().toLowerCase();
  return (
    clean === "none" ||
    clean === "0" ||
    clean === "0px" ||
    clean === "transparent" ||
    clean.startsWith("0 ") ||
    clean.startsWith("none ")
  );
}

function isSmallElementFast(rule: IRRule, declMap: Map<string, string>): boolean {
  if (!rule.selector) return false;
  const selector = rule.selector.toLowerCase();
  const smallPatterns = [
    "icon",
    "close",
    "x-btn",
    "badge",
    "tag",
    "chip",
    "breadcrumb",
    "crumb",
    "arrow",
    "dot",
    "indicator",
    "avatar-xs",
    "avatar-sm",
  ];

  if (smallPatterns.some((p) => selector.includes(p))) return true;

  const w = parsePxValue(declMap.get("width"));
  const h = parsePxValue(declMap.get("height"));
  const f = parsePxValue(declMap.get("font-size"));

  if (w !== null && w > 0 && w < 30) return true;
  if (h !== null && h > 0 && h < 30) return true;
  if (f !== null && f > 0 && f < 14) return true;

  return false;
}

export const accessibilityOptimizer: OptimizationPass = {
  name: "accessibility-optimizer",
  cost: "cheap",
  requiredFor: ["css", "atomic-css"],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;

    if (!ir || !ir.rules) {
      return {
        ir,
        savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 },
        changes: 0,
      };
    }

    for (const rule of ir.rules) {
      if (rule.isDead || !rule.declarations) continue;

      if (!rule.pseudoClasses) {
        rule.pseudoClasses = [];
      }

      // Pre-map normalized kebab-case declarations
      const declMap = new Map<string, string>();
      for (const d of rule.declarations) {
        if (d?.property && d.value !== undefined && d.value !== null) {
          declMap.set(normalizeProp(d.property), String(d.value).trim());
        }
      }

      // Skip accessibility mutations on screen reader utilities
      if (isVisuallyHiddenRule(rule, declMap)) continue;

      const hasCursorPointer = declMap.get("cursor") === "pointer";
      let explicitlyStripsOutline = false;

      // 1. Font size and outline stripping checks
      for (const decl of rule.declarations) {
        if (!decl?.property) continue;
        const prop = normalizeProp(decl.property);
        const valStr = String(decl.value);

        if (prop === "font-size") {
          const px = parsePxValue(decl.value);
          // Only adjust visible, positive font-sizes below WCAG threshold
          if (px !== null && px > 0 && px < WCAG.MIN_FONT_SIZE) {
            const originalValue = decl.value;
            decl.value = `max(${WCAG.MIN_FONT_SIZE}px, ${originalValue})`;
            recordHistory(
              decl,
              "accessibility-optimizer",
              "auto-fix-min-font",
              undefined,
              `Ensured minimum font size of ${WCAG.MIN_FONT_SIZE}px`,
            );
            changes++;
          }
        }

        if (
          (prop === "outline" && isOutlineStripped(valStr)) ||
          (prop === "outline-style" && valStr.trim().toLowerCase() === "none")
        ) {
          explicitlyStripsOutline = true;
        }
      }

      // 2. Touch Target Evaluation
      const isButton =
        rule.selector &&
        /(\bbutton\b|\[role=["']button["']\]|\bbtn\b)/i.test(rule.selector);

      if (hasCursorPointer || isButton) {
        const minWidthPx = parsePxValue(declMap.get("min-width") || declMap.get("width"));
        const minHeightPx = parsePxValue(declMap.get("min-height") || declMap.get("height"));

        const widthSufficient =
          minWidthPx !== null
            ? minWidthPx >= WCAG.MIN_TOUCH_TARGET
            : declMap.has("width") || declMap.has("min-width");

        const heightSufficient =
          minHeightPx !== null
            ? minHeightPx >= WCAG.MIN_TOUCH_TARGET
            : declMap.has("height") || declMap.has("min-height");

        const isSmall = isSmallElementFast(rule, declMap);

        if (isSmall) {
          if (!widthSufficient || !heightSufficient) {
            const existingAfter = rule.pseudoClasses.find(
              (pc) =>
                pc.name === "after" &&
                pc.declarations?.some(
                  (d) => (d.meta as { a11yTouchTarget?: boolean })?.a11yTouchTarget,
                ),
            );

            if (!existingAfter) {
              const afterDecls = [
                createDeclaration("content", '""', rule.source, {
                  a11yTouchTarget: true,
                }),
                createDeclaration("position", "absolute", rule.source, {
                  a11yTouchTarget: true,
                }),
                createDeclaration("top", "50%", rule.source, {
                  a11yTouchTarget: true,
                }),
                createDeclaration("left", "50%", rule.source, {
                  a11yTouchTarget: true,
                }),
                createDeclaration(
                  "min-width",
                  `${WCAG.MIN_TOUCH_TARGET}px`,
                  rule.source,
                  { a11yTouchTarget: true },
                ),
                createDeclaration(
                  "min-height",
                  `${WCAG.MIN_TOUCH_TARGET}px`,
                  rule.source,
                  { a11yTouchTarget: true },
                ),
                createDeclaration(
                  "transform",
                  "translate(-50%, -50%)",
                  rule.source,
                  { a11yTouchTarget: true },
                ),
              ];

              rule.pseudoClasses.push({
                id: `a11y-touch-${rule.id}`,
                name: "after",
                parentId: rule.id,
                declarations: afterDecls,
                source: rule.source,
                history: [
                  {
                    pass: "accessibility-optimizer",
                    action: "auto-fix-touch-target",
                    timestamp: Date.now(),
                    reason: `Added center-aligned absolute ::after pseudo-element for reliable ${WCAG.MIN_TOUCH_TARGET}px touch scaling`,
                  },
                ],
              });

              const pos = declMap.get("position");
              const hasPosition =
                pos && ["relative", "absolute", "fixed", "sticky"].includes(pos);
              if (!hasPosition) {
                rule.declarations.push(
                  createDeclaration("position", "relative", rule.source, {
                    a11yTouchTarget: true,
                  }),
                );
              }

              changes++;
            }
          }
        } else {
          if (!declMap.has("min-width") && minWidthPx === null) {
            rule.declarations.push(
              createDeclaration(
                "min-width",
                `${WCAG.MIN_TOUCH_TARGET}px`,
                rule.source,
                { a11y: true },
              ),
            );
            changes++;
          }
          if (!declMap.has("min-height") && minHeightPx === null) {
            rule.declarations.push(
              createDeclaration(
                "min-height",
                `${WCAG.MIN_TOUCH_TARGET}px`,
                rule.source,
                { a11y: true },
              ),
            );
            changes++;
          }
        }
      }

      // 3. Missing Focus Ring Check
      const hasFocusStyle = rule.pseudoClasses.some(
        (pc) =>
          (pc.name === "focus" || pc.name === "focus-visible") &&
          pc.declarations &&
          pc.declarations.length > 0,
      );

      if (explicitlyStripsOutline && !hasFocusStyle) {
        rule.pseudoClasses.push({
          id: `a11y-focus-${rule.id}`,
          name: "focus-visible",
          parentId: rule.id,
          declarations: [
            createDeclaration(
              "outline",
              "2px dashed currentColor",
              rule.source,
            ),
            createDeclaration("outline-offset", "2px", rule.source),
          ],
          source: rule.source,
          history: [
            {
              pass: "accessibility-optimizer",
              action: "auto-fix-focus",
              timestamp: Date.now(),
              reason:
                "Injected adaptive currentColor dashed ring into :focus-visible scope to replace stripped outline",
            },
          ],
        });
        changes++;
      }
    }

    return {
      ir,
      savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 },
      changes,
    };
  },
};