// ============================================================================
// FILE: src/compiler/pipeline/lowering/constraint-resolver.ts
// ============================================================================

import type { StyleIR } from "../ir/types.js";
import type { LoweringPass, LoweringResult } from "../pipeline-types.js";
import { createDeclaration } from "../ir/index.js";
import { recordHistory } from "../ir/utils.js";

interface Constraint {
  property: string;
  operator: string;
  expression: string;
  condition?: string;
}

function resolveReference(ref: string): string {
  const known: Record<string, string> = {
    parent: "100%",
    "parent.width": "100%",
    "parent.height": "100%",
    viewport: "100vw",
    "viewport.width": "100vw",
    "viewport.height": "100vh",
  };
  return known[ref] || ref;
}

function resolveConstraint(constraint: Constraint): {
  cssProperty: string;
  cssValue: string;
  explanation: string;
} {
  const { property, operator, expression } = constraint;

  // 1. Structural Relative Size Constraints
  if ((operator === "<" || operator === "<=") && expression === "parent") {
    return {
      cssProperty: `max-${property}`,
      cssValue: "100%",
      explanation: `${property} <= parent → max-${property}: 100%`,
    };
  }

  if ((operator === ">" || operator === ">=") && expression === "parent") {
    return {
      cssProperty: `min-${property}`,
      cssValue: "100%",
      explanation: `${property} >= parent → min-${property}: 100%`,
    };
  }

  // 2. Algebraic Layout Expression Parsing (e.g., height = width * 0.5)
  if (operator === "=" && expression.includes("*")) {
    const parts = expression.split("*").map((s) => s.trim());
    if (parts.length === 2) {
      const leftIsDim = parts[0] === "width" || parts[0] === "height";
      const rightIsDim = parts[1] === "width" || parts[1] === "height";

      if (leftIsDim || rightIsDim) {
        const rawFactor = parseFloat(leftIsDim ? parts[1] : parts[0]);

        if (!isNaN(rawFactor)) {
          // Determine structural aspect-ratio (width / height)
          // height = width * factor -> width/height = 1 / factor
          // width = height * factor -> width/height = factor / 1
          let widthRatio = 1;
          let heightRatio = 1;

          if (
            property === "height" &&
            (parts[0] === "width" || parts[1] === "width")
          ) {
            widthRatio = 1;
            heightRatio = rawFactor;
          } else if (
            property === "width" &&
            (parts[0] === "height" || parts[1] === "height")
          ) {
            widthRatio = rawFactor;
            heightRatio = 1;
          }

          // Format aspect-ratio cleanly without running floating-point GCD loops
          // Using raw floats or structural fractions is fully valid in modern CSS engines
          const cssValue =
            widthRatio === 1 && heightRatio !== 0
              ? String(Number((1 / heightRatio).toFixed(4)))
              : `${Number(widthRatio.toFixed(4))} / ${Number(heightRatio.toFixed(4))}`;

          return {
            cssProperty: "aspect-ratio",
            cssValue,
            explanation: `${property} = ${expression} → aspect-ratio: ${cssValue}`,
          };
        }
      }
    }

    // Safe mathematical calc fallback if expression parsing yields structural variables
    const cleanLeft = resolveReference(parts[0]);
    const cleanRight = parts[1] ? resolveReference(parts[1]) : "1";
    return {
      cssProperty: property,
      cssValue: `calc(${cleanLeft} * ${cleanRight})`,
      explanation: `${property} = ${expression} → calc() fallback`,
    };
  }

  // 3. Direct Assignments
  if (operator === "=") {
    const resolved = resolveReference(expression);
    return {
      cssProperty: property,
      cssValue: resolved,
      explanation: `${property} = ${expression} → ${resolved}`,
    };
  }

  // 4. Default Passthrough Fallback
  return {
    cssProperty: property,
    cssValue: expression,
    explanation: `${property} ${operator} ${expression} (passthrough)`,
  };
}

export const constraintResolver: LoweringPass = {
  name: "constraint-resolver",

  generate(ir: StyleIR): LoweringResult {
    let generatedNodes = 0;

    if (!ir || !ir.rules) {
      return { ir, generatedNodes };
    }

    for (const rule of ir.rules) {
      const constraints = (rule.passMeta?.analysis?.semantic?.constraints ??
        rule.meta?._constraints ??
        []) as Constraint[];
      if (constraints.length === 0) continue;

      if (!rule.declarations) {
        rule.declarations = [];
      }

      for (const constraint of constraints) {
        const resolved = resolveConstraint(constraint);
        const decl = createDeclaration(resolved.cssProperty, resolved.cssValue);

        rule.declarations.push(decl);
        recordHistory(
          decl,
          "constraint-resolver",
          "resolved-constraint",
          undefined,
          resolved.explanation,
        );
        generatedNodes++;
      }
    }

    return { ir, generatedNodes };
  },
};
