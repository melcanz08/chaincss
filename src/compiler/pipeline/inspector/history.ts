// src/compiler/pipeline/inspector/inspector-helpers.ts
// Shared helpers for inspector serialization

import type { IRRule } from '../ir/types.js';
import type { InspectorAffectedDeclaration } from './types.js';
import type { PipelineReportEntry } from '../pipeline-types.js';

export function getAffectedDeclarations(
  rule: IRRule,
  entry: PipelineReportEntry
): InspectorAffectedDeclaration[] {
  return rule.declarations
    .filter(d => d.history?.some(h => h.pass === entry.pass))
    .map(d => {
      const relevantHistory = (d.history || []).filter(h => h.pass === entry.pass);
      const firstTouch = relevantHistory[0];
      const lastTouch = relevantHistory[relevantHistory.length - 1];
      return {
        property: d.property,
        before: firstTouch?.previous !== undefined
          ? String(firstTouch.previous)
          : String(d.value),
        after: String(d.value),
        reason: lastTouch?.reason || '',
      };
    });
}