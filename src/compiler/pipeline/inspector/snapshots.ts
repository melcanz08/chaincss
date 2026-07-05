// src/compiler/pipeline/inspector-snapshots.ts
// Reconstructs the timeline of CSS states across pipeline passes

import type { IRRule } from '../ir/types.js';
import type { InspectorSnapshot } from './types.js';
import type { PipelineReportEntry } from '../pipeline-types.js';
import { getAffectedDeclarations } from './history.js';

export function buildSnapshots(
  rule: IRRule,
  pipelineReport: PipelineReportEntry[]
): InspectorSnapshot[] {
  return (pipelineReport || []).map((entry, index) => {
    const declMap = new Map<string, string>();

    // Start with current values
    for (const d of rule.declarations) {
      declMap.set(d.property, String(d.value));
    }

    // Apply cumulative changes up to this pass
    for (let i = 0; i <= index; i++) {
      const affected = getAffectedDeclarations(rule, pipelineReport[i]);
      for (const a of affected) {
        declMap.set(a.property, a.after);
      }
    }

    return {
      pass: entry.pass,
      stage: entry.stage,
      declarations: Array.from(declMap.entries()).map(([property, value]) => ({
        property,
        value,
      })),
    };
  });
}
