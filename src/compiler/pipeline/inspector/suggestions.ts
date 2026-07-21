// ============================================================================
// FILE: src/compiler/pipeline/inspector/suggestions.ts
// ============================================================================

import type { InspectorSuggestion } from './types.js';
import type { PipelineDiagnostic } from '../pipeline-types.js';

const SUGGESTION_PASSES = [
  'pattern-detector',
  'layout-analyzer',
  'responsive-analyzer',
  'accessibility-validator',
  'accessibility-optimizer',
];

/**
 * Extracts distinct architectural improvements and usability hints from compiler passes.
 */
export function collectSuggestions(diagnostics: PipelineDiagnostic[]): InspectorSuggestion[] {
  if (!diagnostics || diagnostics.length === 0) return [];

  const suggestions: InspectorSuggestion[] = [];
  const seenSignatures = new Set<string>();

  for (const d of diagnostics) {
    if (!d || !d.pass || !d.suggestion || !d.message) continue;

    const lowerPassName = d.pass.toLowerCase();
    
    // Resilient check: matches if any registered signature acts as a substring 
    // or namespace prefix of the diagnostic tracking token.
    const isTargetPass = SUGGESTION_PASSES.some(target => 
      lowerPassName.includes(target.toLowerCase())
    );

    if (!isTargetPass) continue;

    // Deduplication signature mapping block
    const uniqueKey = `${d.message.trim()}||${d.suggestion.trim()}`;
    if (seenSignatures.has(uniqueKey)) continue;

    seenSignatures.add(uniqueKey);
    suggestions.push({
      message: d.message.trim(),
      suggestion: d.suggestion.trim(),
    });
  }

  return suggestions;
}