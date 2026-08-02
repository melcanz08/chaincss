// ============================================================================
// FILE: src/compiler/pipeline/inspector/metrics.ts
// ============================================================================

import type { IRRule } from "../ir/types.js";
import type { InspectorStats } from "./types.js";

/**
 * Generates sizing assessments and behavioral metadata records for an individual target rule.
 */
export function computeStats(
  rule: IRRule,
  pipelineReportLength: number,
): InspectorStats {
  if (!rule) {
    return {
      declarationCount: 0,
      estimatedBytes: 0,
      pipelinePasses: 0,
      hasHover: false,
    };
  }

  const decls = rule.declarations || [];

  const baseSelectorBytes = rule.selector ? rule.selector.trim().length + 3 : 3;

  const declarationBytes = decls.reduce((sum, d) => {
    if (!d || !d.property) return sum;
    const propLen = String(d.property).length;
    const valLen = d.value !== undefined ? String(d.value).length : 0;
    return sum + propLen + valLen + 4;
  }, 0);

  const hasHoverHistory = decls.some((d) =>
    d?.history?.some((h) => {
      const r = h.reason;
      return !!r && r.toLowerCase().includes("hover");
    }),
  );

  const rawPseudoClasses = (rule as any).pseudoClasses;
  let hasHoverPseudo = false;

  if (Array.isArray(rawPseudoClasses)) {
    hasHoverPseudo = rawPseudoClasses.some((pc) => {
      if (!pc) return false;
      if (typeof pc === "string") {
        return pc.toLowerCase() === "hover";
      }
      return String(pc.name || "").toLowerCase() === "hover";
    });
  }

  return {
    declarationCount: decls.length,
    estimatedBytes: baseSelectorBytes + declarationBytes,
    pipelinePasses: Math.max(0, pipelineReportLength),
    hasHover: hasHoverHistory || hasHoverPseudo,
  };
}
