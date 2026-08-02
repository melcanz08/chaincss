// ============================================================================
// FILE: src/compiler/pipeline/optimizers/accessibility-optimizer.ts (OPTIMIZED)
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

// Fast-path guard prevents running RegExp on non-pixel values (colors, percentages, keywords)
function extractPx(value: string | number | undefined): number {
  if (typeof value !== "string" || !value.endsWith("px")) return Infinity;
  const match = value.match(/^(\d+(\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : Infinity;
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
        savings: {
          rulesEliminated: 0,
          declarationsEliminated: 0,
          bytesSaved: 0,
        },
        changes: 0,
      };
    }

    for (const rule of ir.rules) {
      if (rule.isDead || !rule.declarations) continue;

      if (!rule.pseudoClasses) {
        rule.pseudoClasses = [];
      }

      const declarations = rule.declarations;
      let hasCursorPointer = false;
      let explicitlyStripsOutline = false;
      let minWidthFound = false;
      let minHeightFound = false;

      // Single-pass inspection of declarations to avoid looping 4+ times
      for (const decl of declarations) {
        const prop = decl.property;
        const valStr = String(decl.value);

        // 1. Font size check & auto-fix
        if (
          (prop === "fontSize" || prop === "font-size") &&
          typeof decl.value === "string"
        ) {
          const px = extractPx(decl.value);
          if (px !== Infinity && px < WCAG.MIN_FONT_SIZE) {
            const originalValue = decl.value;
            decl.value = `max(${WCAG.MIN_FONT_SIZE}px, ${originalValue})`;
            recordHistory(
              decl as any,
              "accessibility-optimizer",
              "auto-fix-min-font",
              undefined,
              `Ensured minimum font size of ${WCAG.MIN_FONT_SIZE}px`,
            );
            changes++;
          }
        }

        // 2. Interactive & Touch Target flags
        if (prop === "cursor" && decl.value === "pointer") {
          hasCursorPointer = true;
        }
        if (prop === "min-width" || prop === "minWidth" || prop === "width") {
          if (extractPx(decl.value) >= WCAG.MIN_TOUCH_TARGET)
            minWidthFound = true;
        }
        if (
          prop === "min-height" ||
          prop === "minHeight" ||
          prop === "height"
        ) {
          if (extractPx(decl.value) >= WCAG.MIN_TOUCH_TARGET)
            minHeightFound = true;
        }

        // 3. Outline stripping checks
        if (
          (prop === "outline" &&
            ["none", "0", "transparent"].includes(valStr.trim())) ||
          (prop === "outline-style" && valStr.trim() === "none")
        ) {
          explicitlyStripsOutline = true;
        }
      }

      // Touch target adjustments
      const isButton =
        rule.selector &&
        /(\bbutton\b|\[role=["']button["']\]|btn)/i.test(rule.selector);
      if (hasCursorPointer || isButton) {
        const small = isSmallElementFast(rule, declarations);
        if (small) {
          if (!minWidthFound || !minHeightFound) {
            const existingAfter = rule.pseudoClasses.find(
              (pc) =>
                pc.name === "after" &&
                pc.declarations?.some((d) => d.meta?.a11yTouchTarget),
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
                  "minWidth",
                  `${WCAG.MIN_TOUCH_TARGET}px`,
                  rule.source,
                  { a11yTouchTarget: true },
                ),
                createDeclaration(
                  "minHeight",
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

              const hasPosition = declarations.some(
                (d) =>
                  d.property === "position" &&
                  ["relative", "absolute", "fixed", "sticky"].includes(
                    String(d.value),
                  ),
              );
              if (!hasPosition) {
                declarations.push(
                  createDeclaration("position", "relative", rule.source, {
                    a11yTouchTarget: true,
                  }),
                );
              }

              changes++;
            }
          }
        } else {
          if (!minWidthFound) {
            declarations.push(
              createDeclaration(
                "min-width",
                `${WCAG.MIN_TOUCH_TARGET}px`,
                rule.source,
                { a11y: true },
              ),
            );
            changes++;
          }
          if (!minHeightFound) {
            declarations.push(
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

      // Missing focus ring check
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
            createDeclaration("outlineOffset", "2px", rule.source),
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

function isSmallElementFast(rule: IRRule, declarations: any[]): boolean {
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

  for (const decl of declarations) {
    const prop = decl.property;
    if (
      prop === "width" ||
      prop === "height" ||
      prop === "fontSize" ||
      prop === "font-size"
    ) {
      const px = extractPx(decl.value);
      if (px > 0 && px < (prop.includes("font") ? 14 : 30)) return true;
    }
  }
  return false;
}
