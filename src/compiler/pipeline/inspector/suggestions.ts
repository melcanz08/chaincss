// src/compiler/pipeline/inspector-suggestions.ts
// Collects optimization and pattern suggestions from pipeline diagnostics

import type { InspectorSuggestion } from './types.js';
import type { PipelineDiagnostic } from '../pipeline-types.js';

const SUGGESTION_PASSES = [
  'pattern-detector',
  'layout-analyzer',
  'responsive-analyzer',
  'accessibility-validator',
  'accessibility-optimizer',
];

export function collectSuggestions(diagnostics: PipelineDiagnostic[]): InspectorSuggestion[] {
  return diagnostics
    .filter(d => d.pass && SUGGESTION_PASSES.includes(d.pass))
    .map(d => ({
      message: d.message || '',
      suggestion: d.suggestion || '',
    }));
}