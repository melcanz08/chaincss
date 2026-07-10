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
  if (!pipelineReport || pipelineReport.length === 0) return [];

  // Reconstruct original values from history records.
  // History stores { previous, reason } — the first record's 'previous'
  // is the original value before any pass touched it.
  const originalValues = new Map<string, string>();
  for (const d of rule.declarations) {
    // Walk history backward to find the earliest recorded value
    const firstRecord = d.history?.[0];
    const original = firstRecord?.previous !== undefined
      ? String(firstRecord.previous)
      : String(d.value);
    originalValues.set(d.property, original);
  }

  // Track previous snapshot to skip duplicates
  let prevDeclStr = '';

  return pipelineReport
    .map((entry, index) => {
      const declMap = new Map(originalValues);

      // Apply cumulative changes up to this pass
      for (let i = 0; i <= index; i++) {
        const affected = getAffectedDeclarations(rule, pipelineReport[i]);
        for (const a of affected) {
          declMap.set(a.property, a.after);
        }
      }

      const declarations = Array.from(declMap.entries())
        .map(([property, value]) => ({ property, value }))
        .sort((a, b) => a.property.localeCompare(b.property));

      // Skip snapshots identical to previous (pass had no effect)
      const declStr = JSON.stringify(declarations);
      if (declStr === prevDeclStr) return null;
      prevDeclStr = declStr;

      return {
        pass: entry.pass,
        stage: entry.stage,
        declarations,
      };
    })
    .filter((s): s is InspectorSnapshot => s !== null);
}
