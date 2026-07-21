// ============================================================================
// FILE: src/compiler/pipeline/inspector/history.ts
// ============================================================================

import type { IRRule } from '../ir/types.js';
import type { InspectorAffectedDeclaration } from './types.js';
import type { PipelineReportEntry } from '../pipeline-types.js';

export function getAffectedDeclarations(
  rule: IRRule,
  entry: PipelineReportEntry
): InspectorAffectedDeclaration[] {
  if (!rule ||!rule.declarations ||!entry?.pass) return [];

  const affected: InspectorAffectedDeclaration[] = [];
  const targetPass = entry.pass;

  for (const d of rule.declarations) {
    if (!d?.history?.length) continue;

    const passEvents = d.history.filter(h => h?.pass === targetPass);
    if (passEvents.length === 0) continue;

    const firstEvent = passEvents[0] as any;
    const lastEvent = passEvents[passEvents.length - 1] as any;

    // find lastEvent index safely (not indexOf which hits first duplicate)
    let lastIdx = -1;
    for (let i = d.history.length - 1; i >= 0; i--) {
      if (d.history[i] === lastEvent) { lastIdx = i; break; }
    }
    if (lastIdx === -1) lastIdx = d.history.length - 1;

    const nextEvent = d.history[lastIdx + 1] as any;

    const calculatedAfter = nextEvent?.previous!== undefined && nextEvent?.previous!== null
     ? String(nextEvent.previous)
      : String(d.value);

    const beforeVal = firstEvent?.previous!== undefined && firstEvent?.previous!== null
     ? String(firstEvent.previous)
      : calculatedAfter;

    // skip no-ops early (saves snapshot dedup work)
    if (beforeVal === calculatedAfter && passEvents.length === 1 && firstEvent?.previous === undefined) {
      // first add — still report as affected for initial snapshot
    }

    affected.push({
      property: d.property,
      before: beforeVal,
      after: calculatedAfter,
      reason: (lastEvent?.reason as string) || `Transformed by ${targetPass}`,
    });
  }

  return affected;
}