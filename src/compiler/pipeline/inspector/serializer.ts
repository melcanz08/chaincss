// src/compiler/pipeline/inspector/inspector-serializer.ts
// Strips compiler IR down to only what the inspector needs.
// Each serialization concern is a separate function.

import type { StyleIR, IRRule } from '../ir/types.js';
import type {
  InspectorRule,
  InspectorDiagnostic,
  InspectorDeclaration,
  InspectorHistoryEntry,
  InspectorPipelineEntry,
  InspectorSnapshot,
  InspectorSuggestion,
} from './types.js';
import type { PipelineReportEntry, PipelineDiagnostic } from '../pipeline-types.js';
import { computeStats } from './metrics.js';
import { buildSnapshots } from './snapshots.js';

import { getAffectedDeclarations } from './history.js';

import { collectSuggestions } from './suggestions.js';

// ============================================================================
// Main Entry Point
// ============================================================================

export function serializeForInspector(
  ir: StyleIR,
  pipelineReport: PipelineReportEntry[],
  diagnostics: PipelineDiagnostic[],
  sourceFile: string,
  componentName: string
): InspectorRule[] {
  const rules: InspectorRule[] = [];

  for (const rule of ir.rules) {
    if (rule.isDead) continue;
    rules.push(serializeInspectorRule(rule, pipelineReport, diagnostics, sourceFile, componentName));
  }

  return rules;
}

// ============================================================================
// Rule Serialization
// ============================================================================

function serializeInspectorRule(
  rule: IRRule,
  pipelineReport: PipelineReportEntry[],
  diagnostics: PipelineDiagnostic[],
  sourceFile: string,
  componentName: string
): InspectorRule {
  const ruleId = `${sourceFile}::${rule.selector}`;

  return {
    id: ruleId,
    selector: rule.selector,
    source: { file: sourceFile, component: componentName },
    diagnostics: serializeDiagnostics(diagnostics),
    declarations: serializeDeclarations(rule),
    stats: computeStats(rule, pipelineReport?.length || 0),
    pipeline: serializePipeline(rule, pipelineReport),
    snapshots: serializeSnapshots(rule, pipelineReport),
    suggestions: serializeSuggestions(diagnostics),
  };
}

// ============================================================================
// Individual Serializers
// ============================================================================

function serializeDiagnostics(diagnostics: PipelineDiagnostic[]): InspectorDiagnostic[] {
  return diagnostics
    .filter(d => !d.message?.includes('Skipped') || !d.message?.includes('pass(es)'))
    .map(d => ({
      severity: d.severity,
      category: d.category || '',
      message: d.message || '',
      suggestion: d.suggestion || '',
      wcag: d.wcagCriterion || '',
      autoFixable: d.autoFixable || false,
    }));
}

function serializeDeclarations(rule: IRRule): InspectorDeclaration[] {
  return rule.declarations.map(d => ({
    property: d.property,
    value: d.value,
    history: (d.history || []).map(h => ({
      pass: h.pass,
      action: h.action,
      reason: h.reason,
      previous: h.previous,
    })) as InspectorHistoryEntry[],
  }));
}

function serializePipeline(
  rule: IRRule,
  pipelineReport: PipelineReportEntry[]
): InspectorPipelineEntry[] {
  return (pipelineReport || []).map(entry => ({
    stage: entry.stage,
    pass: entry.pass,
    duration: entry.duration || 0,
    changes: entry.result?.changes || 0,
    hasError: entry.result?.diagnostics?.some(d => d.severity === 'error'),
    affectedDeclarations: getAffectedDeclarations(rule, entry),
  }));
}

function serializeSnapshots(
  rule: IRRule,
  pipelineReport: PipelineReportEntry[]
): InspectorSnapshot[] {
  return buildSnapshots(rule, pipelineReport);
}

function serializeSuggestions(diagnostics: PipelineDiagnostic[]): InspectorSuggestion[] {
  return collectSuggestions(diagnostics);
}