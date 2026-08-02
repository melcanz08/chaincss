// ============================================================================
// FILE: src/compiler/pipeline/inspector/serializer.ts
// ============================================================================
import type { StyleIR, IRRule } from "../ir/types.js";
import type {
  InspectorRule,
  InspectorDiagnostic,
  InspectorDeclaration,
  InspectorHistoryEntry,
  InspectorPipelineEntry,
  InspectorSnapshot,
  InspectorSuggestion,
} from "./types.js";
import type {
  PipelineReportEntry,
  PipelineDiagnostic,
} from "../pipeline-types.js";
import { computeStats } from "./metrics.js";
import { buildSnapshots } from "./snapshots.js";
import { getAffectedDeclarations } from "./history.js";
import { collectSuggestions } from "./suggestions.js";

export function serializeForInspector(
  ir: StyleIR,
  pipelineReport: PipelineReportEntry[],
  diagnostics: PipelineDiagnostic[],
  sourceFile: string,
  componentName: string,
): InspectorRule[] {
  if (!ir || !ir.rules) return [];

  const reportEntries = pipelineReport || [];
  const globalDiagnostics = diagnostics || [];
  const rules: InspectorRule[] = [];

  for (const rule of ir.rules) {
    if (!rule || rule.isDead) continue;

    const contextualDiagnostics = globalDiagnostics.filter(
      (d: any) =>
        !d.selector || d.selector === rule.selector || d.nodeId === rule.id,
    );

    rules.push(
      serializeInspectorRule(
        rule,
        reportEntries,
        contextualDiagnostics,
        sourceFile,
        componentName,
      ),
    );
  }

  return rules;
}

function serializeInspectorRule(
  rule: IRRule,
  pipelineReport: PipelineReportEntry[],
  diagnostics: PipelineDiagnostic[],
  sourceFile: string,
  componentName: string,
): InspectorRule {
  const ruleId = `${sourceFile}::${rule.selector}`;

  return {
    id: ruleId,
    selector: rule.selector,
    source: { file: sourceFile, component: componentName },
    diagnostics: serializeDiagnostics(diagnostics),
    declarations: serializeDeclarations(rule),
    stats: computeStats(rule, pipelineReport.length),
    pipeline: serializePipeline(rule, pipelineReport),
    snapshots: serializeSnapshots(rule, pipelineReport),
    suggestions: serializeSuggestions(diagnostics),
  };
}

function serializeDiagnostics(
  diagnostics: PipelineDiagnostic[],
): InspectorDiagnostic[] {
  return diagnostics
    .filter(
      (d) =>
        d &&
        d.message &&
        // only hide noisy contrast skips, keep pass(es) logs for pipeline view
        !d.message.toLowerCase().includes("skipped contrast"),
    )
    .map((d) => ({
      severity: d.severity,
      category: d.category || "general",
      message: d.message || "",
      suggestion: d.suggestion || "",
      wcag: d.wcagCriterion || "",
      autoFixable: d.autoFixable || false,
    }));
}

function serializeDeclarations(rule: IRRule): InspectorDeclaration[] {
  if (!rule.declarations) return [];

  return rule.declarations.map((d) => ({
    property: d.property,
    value: d.value,
    history: (d.history || [])
      .filter((h) => h !== undefined)
      .map((h) => ({
        pass: h.pass,
        action: h.action,
        reason: h.reason,
        previous: h.previous,
      })) as InspectorHistoryEntry[],
  }));
}

function serializePipeline(
  rule: IRRule,
  pipelineReport: PipelineReportEntry[],
): InspectorPipelineEntry[] {
  return pipelineReport.map((entry) => {
    const entryChanges =
      entry.result?.changes !== undefined
        ? entry.result.changes
        : (entry as any).changes || 0;

    return {
      stage: entry.stage,
      pass: entry.pass,
      duration: entry.duration || 0,
      changes: entryChanges,
      hasError:
        entry.result?.diagnostics?.some((d) => d.severity === "error") || false,
      affectedDeclarations: getAffectedDeclarations(rule, entry),
    };
  });
}

function serializeSnapshots(
  rule: IRRule,
  pipelineReport: PipelineReportEntry[],
): InspectorSnapshot[] {
  return buildSnapshots(rule, pipelineReport);
}

function serializeSuggestions(
  diagnostics: PipelineDiagnostic[],
): InspectorSuggestion[] {
  return collectSuggestions(diagnostics);
}
