// src/compiler/pipeline/inspector-serializer.ts
// Strips compiler IR down to only what the inspector needs.
// Uses proper types — no `any`.

import type { StyleIR, IRRule, IRDeclaration } from './ir/types.js';
import type {
  InspectorRule,
  InspectorDiagnostic,
  InspectorDeclaration,
  InspectorHistoryEntry,
  InspectorStats,
  InspectorPipelineEntry,
  InspectorAffectedDeclaration,
  InspectorSnapshot,
  InspectorSuggestion,
} from './inspector-types.js';

interface PipelineReportEntry {
  stage: string;
  pass: string;
  duration: number;
  result?: {
    changes?: number;
    diagnostics?: Array<{ severity: string }>;
  };
}

interface DiagnosticEntry {
  severity: string;
  category?: string;
  message?: string;
  suggestion?: string;
  wcagCriterion?: string;
  autoFixable?: boolean;
  pass?: string;
}

export function serializeForInspector(
  ir: StyleIR,
  pipelineReport: PipelineReportEntry[],
  diagnostics: DiagnosticEntry[],
  sourceFile: string,
  componentName: string
): InspectorRule[] {
  const rules: InspectorRule[] = [];

  for (const rule of ir.rules) {
    if (rule.isDead) continue;

    const ruleId = `${sourceFile}::${rule.selector}`;

    // Serialize diagnostics
    const serializedDiagnostics: InspectorDiagnostic[] = diagnostics
      .filter(d => !d.message?.includes('Skipped') || !d.message?.includes('pass(es)'))
      .map(d => ({
        severity: d.severity,
        category: d.category || '',
        message: d.message || '',
        suggestion: d.suggestion || '',
        wcag: d.wcagCriterion || '',
        autoFixable: d.autoFixable || false,
      }));

    // Serialize declarations
    const serializedDeclarations: InspectorDeclaration[] = rule.declarations.map(d => ({
      property: d.property,
      value: d.value,
      history: (d.history || []).map(h => ({
        pass: h.pass,
        action: h.action,
        reason: h.reason,
        previous: h.previous,
      })) as InspectorHistoryEntry[],
    }));

    // Serialize stats
    const serializedStats: InspectorStats = {
      declarationCount: rule.declarations.length,
      estimatedBytes: rule.declarations.reduce(
        (sum, d) => sum + String(d.property).length + String(d.value).length + 4, 0
      ),
      pipelinePasses: pipelineReport?.length || 0,
      hasHover: rule.declarations.some(d =>
        d.history?.some(h => h.reason?.includes('hover'))
      ),
    };

    // Serialize pipeline entries
    const serializedPipeline: InspectorPipelineEntry[] = (pipelineReport || []).map(entry => ({
      stage: entry.stage,
      pass: entry.pass,
      duration: entry.duration || 0,
      changes: entry.result?.changes || 0,
      hasError: entry.result?.diagnostics?.some(d => d.severity === 'error'),
      affectedDeclarations: getAffectedDeclarations(rule, entry),
    }));

    // Serialize snapshots with cumulative delta application
    const serializedSnapshots: InspectorSnapshot[] = (pipelineReport || []).map((entry, index) => {
      const declMap = new Map<string, string>();

      // Start with current values
      for (const d of rule.declarations) {
        declMap.set(d.property, String(d.value));
      }

      // Apply changes from passes 0..index to build cumulative state
      for (let i = 0; i <= index; i++) {
        const passEntry = pipelineReport[i];
        const affected = getAffectedDeclarations(rule, passEntry);
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

    // Serialize suggestions
    const serializedSuggestions: InspectorSuggestion[] = diagnostics
      .filter(d => d.pass === 'pattern-detector' || d.pass === 'layout-analyzer')
      .map(d => ({
        message: d.message || '',
        suggestion: d.suggestion || '',
      }));

    rules.push({
      id: ruleId,
      selector: rule.selector,
      source: { file: sourceFile, component: componentName },
      diagnostics: serializedDiagnostics,
      declarations: serializedDeclarations,
      stats: serializedStats,
      pipeline: serializedPipeline,
      snapshots: serializedSnapshots,
      suggestions: serializedSuggestions,
    });
  }

  return rules;
}

function getAffectedDeclarations(
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