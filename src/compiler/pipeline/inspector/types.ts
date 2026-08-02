// src/compiler/pipeline/inspector/types.ts
// Shared types for the ChainCSS inspector system

export interface InspectorRule {
  id: string;
  selector: string;
  source?: { file: string; component: string };
  diagnostics: InspectorDiagnostic[];
  declarations: InspectorDeclaration[];
  stats: InspectorStats;
  pipeline: InspectorPipelineEntry[];
  snapshots: InspectorSnapshot[];
  suggestions: InspectorSuggestion[];
}

export interface InspectorDiagnostic {
  severity: string;
  category: string;
  message: string;
  suggestion?: string;
  wcag?: string;
  autoFixable?: boolean;
}

export interface InspectorDeclaration {
  property: string;
  value: string | number;
  history: InspectorHistoryEntry[];
}

export interface InspectorHistoryEntry {
  pass: string;
  action: string;
  reason?: string;
  previous?: any;
}

export interface InspectorStats {
  declarationCount: number;
  estimatedBytes: number;
  pipelinePasses: number;
  hasHover: boolean;
}

export interface InspectorPipelineEntry {
  stage: string;
  pass: string;
  duration: number;
  changes: number;
  hasError?: boolean;
  affectedDeclarations?: InspectorAffectedDeclaration[];
}

export interface InspectorAffectedDeclaration {
  property: string;
  before: string;
  after: string;
  reason: string;
}

export interface InspectorSnapshot {
  pass: string;
  stage: string;
  declarations: Array<{ property: string; value: string }>;
}

export interface InspectorSuggestion {
  message: string;
  suggestion: string;
}

export interface InspectorExport {
  schemaVersion: number;
  compilerVersion: string;
  pipeline: string;
  generatedAt: string;
  rules: InspectorRule[];
}
