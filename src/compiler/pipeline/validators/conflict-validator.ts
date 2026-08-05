// ============================================================================
// FILE: src/compiler/pipeline/validators/conflict-validator.ts
// ============================================================================

import type { StyleIR, IRRule } from "../ir/types.js";
import type {
  ValidationPass,
  ValidationResult,
  Diagnostic,
} from "../pipeline-types.js";

// Strict layout-specific property categories
const FLEX_ONLY_PROPS = new Set(["flex-direction", "flex-wrap"]);

const GRID_ONLY_PROPS = new Set([
  "grid-template-columns",
  "grid-template-rows",
  "grid-template-areas",
  "grid-auto-flow",
  "grid-auto-columns",
  "grid-auto-rows",
]);

// Box Alignment properties valid on BOTH flex and grid containers
const BOX_ALIGNMENT_PROPS = new Set([
  "justify-content",
  "align-items",
  "align-content",
  "justify-items",
  "gap",
  "row-gap",
  "column-gap",
]);

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export const conflictValidator: ValidationPass = {
  name: "conflict-validator",
  validate(ir: StyleIR): ValidationResult {
    const diagnostics: Diagnostic[] = [];
    if (!ir || !ir.rules) {
      return {
        diagnostics: [],
        passed: true,
        stats: { errors: 0, warnings: 0, info: 0, hints: 0 },
      };
    }

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      const declMap = new Map<string, string>();
      for (const d of rule.declarations || []) {
        if (d.property && d.value !== undefined && d.value !== null) {
          const kebabProp = d.property
            .replace(/([A-Z])/g, "-$1")
            .toLowerCase();
          declMap.set(
            kebabProp,
            String(d.value)
              .replace(/!important/g, "")
              .trim(),
          );
        }
      }

      const position = declMap.get("position");
      const zIndex = declMap.get("zIndex") || declMap.get("z-index");
      const display = declMap.get("display");
      const floatVal = declMap.get("float");

      // 1. z-index on position: static
      if (position === "static" && zIndex && zIndex !== "auto") {
        diagnostics.push({
          id: `conflict-zindex-${rule.id}`,
          nodeId: rule.id,
          severity: "warning",
          category: "css-conflict",
          message: "z-index has no effect on position: static elements in normal flow.",
          suggestion: "Change position to relative, absolute, or fixed.",
          autoFixable: false,
        });
      }

      // 2. Strict Flexbox properties check
      const hasFlexOnlyProps = Array.from(declMap.keys()).some((prop) =>
        FLEX_ONLY_PROPS.has(prop),
      );
      if (
        hasFlexOnlyProps &&
        display !== "flex" &&
        display !== "inline-flex"
      ) {
        diagnostics.push({
          id: `conflict-parent-flex-${rule.id}`,
          nodeId: rule.id,
          severity: "warning",
          category: "css-conflict",
          message: `Flex container properties (flex-direction, flex-wrap) require display: flex or inline-flex (found display: ${display || "not set"}).`,
          suggestion: "Set display: flex or inline-flex.",
          autoFixable: true,
        });
      }

      // 3. Strict Grid properties check
      const hasGridOnlyProps = Array.from(declMap.keys()).some((prop) =>
        GRID_ONLY_PROPS.has(prop),
      );
      if (
        hasGridOnlyProps &&
        display !== "grid" &&
        display !== "inline-grid"
      ) {
        diagnostics.push({
          id: `conflict-parent-grid-${rule.id}`,
          nodeId: rule.id,
          severity: "warning",
          category: "css-conflict",
          message: `Grid container properties require display: grid or inline-grid (found display: ${display || "not set"}).`,
          suggestion: "Set display: grid or inline-grid.",
          autoFixable: true,
        });
      }

      // 4. Box alignment properties check (valid on both Flex and Grid)
      const hasBoxAlignmentProps = Array.from(declMap.keys()).some((prop) =>
        BOX_ALIGNMENT_PROPS.has(prop),
      );
      const isFlexOrGrid =
        display &&
        ["flex", "inline-flex", "grid", "inline-grid"].includes(display);

      if (hasBoxAlignmentProps && display && !isFlexOrGrid) {
        diagnostics.push({
          id: `conflict-box-alignment-${rule.id}`,
          nodeId: rule.id,
          severity: "warning",
          category: "css-conflict",
          message: `Box alignment properties require display: flex, grid, inline-flex, or inline-grid (found display: ${display}).`,
          suggestion: "Set display to flex or grid.",
          autoFixable: true,
        });
      }

      // 5. display: inline with dimensions
      if (display === "inline") {
        if (declMap.has("width") || declMap.has("height")) {
          diagnostics.push({
            id: `conflict-inline-dimensions-${rule.id}`,
            nodeId: rule.id,
            severity: "warning",
            category: "css-conflict",
            message: "width and height are ignored on display: inline elements.",
            suggestion: "Use display: inline-block or block instead.",
            autoFixable: true,
          });
        }

        if (
          position &&
          ["absolute", "fixed"].includes(position)
        ) {
          diagnostics.push({
            id: `conflict-display-override-${rule.id}`,
            nodeId: rule.id,
            severity: "warning",
            category: "css-conflict",
            message: `display: inline is overridden and computed to block by position: ${position}.`,
            suggestion: "Remove display: inline or set position to relative.",
            autoFixable: false,
          });
        }
      }

      // 6. Ignored float check
      if (floatVal && floatVal !== "none") {
        if (
          (position && ["absolute", "fixed"].includes(position)) ||
          isFlexOrGrid
        ) {
          diagnostics.push({
            id: `conflict-float-ignored-${rule.id}`,
            nodeId: rule.id,
            severity: "warning",
            category: "css-conflict",
            message: `float: ${floatVal} is ignored due to positioning or flex/grid display context.`,
            suggestion: "Remove float declaration.",
            autoFixable: true,
          });
        }
      }
    }

    // 7. Duplicate selector detection with scope awareness
    const scopedRuleMap = new Map<
      string,
      { count: number; primaryRule: IRRule }
    >();

    for (const rule of ir.rules) {
      if (rule.isDead || !rule.selector) continue;
      const media = (rule as any).meta?.mediaQuery || "all";
      const pseudo = (rule as any).meta?.pseudo || "root";
      const scopeKey = `${rule.selector}::${media}::${pseudo}`;

      const existing = scopedRuleMap.get(scopeKey);
      if (existing) {
        existing.count += 1;
      } else {
        scopedRuleMap.set(scopeKey, { count: 1, primaryRule: rule });
      }
    }

    for (const [scopeKey, { count, primaryRule }] of scopedRuleMap) {
      if (count > 1) {
        const [selector] = scopeKey.split("::");
        diagnostics.push({
          id: `conflict-duplicate-${hashString(scopeKey)}`,
          nodeId: primaryRule.id,
          severity: "info",
          category: "css-conflict",
          message: `Selector "${selector}" appears ${count} times in the same scope — declarations will be merged by the cascade.`,
          suggestion: "Consolidate into a single rule block to optimize bundle size.",
          autoFixable: false,
        });
      }
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