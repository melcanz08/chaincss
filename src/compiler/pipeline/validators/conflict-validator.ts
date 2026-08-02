// ============================================================================
// FILE: src/compiler/pipeline/validators/conflict-validator.ts
// ============================================================================

import type { StyleIR } from "../ir/types.js";
import type {
  ValidationPass,
  ValidationResult,
  Diagnostic,
} from "../pipeline-types.js";

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
          const kebabProp = d.property.replace(/([A-Z])/g, "-$1").toLowerCase();
          // strip !important for comparison
          declMap.set(
            kebabProp,
            String(d.value)
              .replace(/!important/g, "")
              .trim(),
          );
        }
      }

      const position = declMap.get("position");
      const zIndex = declMap.get("z-index");
      const display = declMap.get("display");

      if (position === "static" && zIndex && zIndex !== "auto") {
        diagnostics.push({
          id: `conflict-zindex-${rule.id}`,
          nodeId: rule.id,
          severity: "warning",
          category: "css-conflict",
          message: "z-index has no effect on position: static.",
          suggestion: "Change to position: relative, absolute, or fixed.",
          autoFixable: false,
        });
      }

      const parentFlexProps = [
        "justify-content",
        "align-items",
        "flex-direction",
        "flex-wrap",
        "align-content",
        "justify-items",
      ];
      const hasParentFlexProps = parentFlexProps.some((prop) =>
        declMap.has(prop),
      );
      if (
        hasParentFlexProps &&
        display !== "flex" &&
        display !== "inline-flex"
      ) {
        diagnostics.push({
          id: `conflict-parent-flex-${rule.id}`,
          nodeId: rule.id,
          severity: "warning",
          category: "css-conflict",
          message: `Flex properties require display: flex or display: inline-flex (found display: ${display || "not set"}).`,
          suggestion: "Set display: flex or inline-flex.",
          autoFixable: true,
        });
      }

      const parentGridProps = [
        "grid-template-columns",
        "grid-template-rows",
        "grid-template-areas",
        "grid-auto-flow",
        "grid-auto-columns",
        "grid-auto-rows",
      ];
      const hasParentGridProps = parentGridProps.some((prop) =>
        declMap.has(prop),
      );
      if (
        hasParentGridProps &&
        display !== "grid" &&
        display !== "inline-grid"
      ) {
        diagnostics.push({
          id: `conflict-parent-grid-${rule.id}`,
          nodeId: rule.id,
          severity: "warning",
          category: "css-conflict",
          message: `Grid properties require display: grid or display: inline-grid (found display: ${display || "not set"}).`,
          suggestion: "Set display: grid or inline-grid.",
          autoFixable: true,
        });
      }

      if (
        display === "inline" &&
        position &&
        ["absolute", "fixed"].includes(position)
      ) {
        diagnostics.push({
          id: `conflict-display-override-${rule.id}`,
          nodeId: rule.id,
          severity: "warning",
          category: "css-conflict",
          message: `display: inline is overridden by position: ${position}.`,
          suggestion: "Remove display: inline.",
          autoFixable: false,
        });
      }
    }

    // duplicate selector check with scope awareness
    const selectorMap = new Map<string, number>();
    for (const rule of ir.rules) {
      if (rule.isDead || !rule.selector) continue;
      const scope = `${rule.selector}::${(rule as any).meta?.mediaQuery || "all"}::${(rule as any).meta?.pseudo || "root"}`;
      selectorMap.set(scope, (selectorMap.get(scope) || 0) + 1);
    }

    for (const [scopedSelector, count] of selectorMap) {
      if (count > 1) {
        const [selector] = scopedSelector.split("::");
        const primaryRule = ir.rules.find((r) => r.selector === selector);
        if (primaryRule) {
          diagnostics.push({
            id: `conflict-duplicate-${hashString(scopedSelector)}`,
            nodeId: primaryRule.id,
            severity: "info",
            category: "css-conflict",
            message: `Selector "${selector}" appears ${count} times in same scope — will be merged by cascade.`,
            suggestion: "Consolidate into single rule to save bytes.",
            autoFixable: false,
          });
        }
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

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
