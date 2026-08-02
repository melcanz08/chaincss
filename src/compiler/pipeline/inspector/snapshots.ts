// ============================================================================
// FILE: src/compiler/pipeline/inspector/snapshots.ts
// ============================================================================

import type { IRRule } from '../ir/types.js';
import type { InspectorSnapshot } from './types.js';
import type { PipelineReportEntry } from '../pipeline-types.js';
import { getAffectedDeclarations } from './history.js';

/**
 * Reconstructs a clean step-by-step visual timeline of style changes across compiler passes.
 * Optimized to run in strict linear O(N) time efficiency.
 */
export function buildSnapshots(
  rule: IRRule,
  pipelineReport: PipelineReportEntry[]
): InspectorSnapshot[] {
  if (!rule || !pipelineReport || pipelineReport.length === 0) return [];

  // 1. Establish initial baseline properties directly from declaration history roots
  const currentRollingState = new Map<string, string>();
  
  if (rule.declarations) {
    for (const d of (rule.declarations || [])) {
      if (!d || !d.property) continue;
      
      const firstRecord = d.history?.[0];
      const original = String(
        (firstRecord as any)?.previous??
        (firstRecord as any)?.before??
        (firstRecord as any)?.from??
        d.value
      );
        
      currentRollingState.set(d.property, original);
    }
  }

  const snapshots: InspectorSnapshot[] = [];
  let lastSerializedSnapshot = '';

  // 2. Step forward lineally through the pipeline execution report
  for (const entry of pipelineReport) {
    if (!entry) continue;

    // Pull modifications introduced specifically by *this* standalone pass
    const affected = getAffectedDeclarations(rule, entry);
    
    // Mutation track: If no modifications occurred, skip calculation early
    if (affected.length === 0 && snapshots.length > 0) {
      continue;
    }

    // Apply incremental changes immediately to our persistent rolling state map
    for (const change of affected) {
      if (change && change.property) {
        currentRollingState.set(change.property, change.after);
      }
    }

    // Transform mapping values into a standardized, sorted presentation layout array
    const declarations = Array.from(currentRollingState.entries())
      .map(([property, value]) => ({ property, value }))
      .sort((a, b) => a.property.localeCompare(b.property));

    // Stringify signatures to filter out null-op steps quickly
    const currentSerialized = JSON.stringify(declarations);
    if (currentSerialized === lastSerializedSnapshot) {
      continue;
    }
    
    lastSerializedSnapshot = currentSerialized;

    snapshots.push({
      pass: entry.pass || 'unknown-pass',
      stage: entry.stage || 'unknown-stage',
      declarations,
    });
  }

  return snapshots;
}