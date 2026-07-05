// src/compiler/pipeline/inspector-metrics.ts
// Computes derived metrics for the inspector

import type { IRRule } from './ir/types.js';
import type { InspectorStats } from './inspector-types.js';

export function computeStats(rule: IRRule, pipelineReportLength: number): InspectorStats {
  return {
    declarationCount: rule.declarations.length,
    estimatedBytes: rule.declarations.reduce(
      (sum, d) => sum + String(d.property).length + String(d.value).length + 4, 0
    ),
    pipelinePasses: pipelineReportLength,
    hasHover: rule.declarations.some(d =>
      d.history?.some(h => h.reason?.includes('hover'))
    ),
  };
}