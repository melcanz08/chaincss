// src/compiler/pipeline/inspector/inspector-exporter.ts
// Builds the final InspectorExport from accumulated rules

import type { InspectorRule, InspectorExport } from './types.js';
import { VERSION } from '../../../core/constants.js';

export function buildInspectorExport(rules: Map<string, InspectorRule>): InspectorExport | null {
  if (rules.size === 0) return null;
  return {
    schemaVersion: 1,
    compilerVersion: VERSION,
    pipeline: 'ci',  // TODO: pass actual preset from context
    generatedAt: new Date().toISOString(),  // TODO: use ir.meta.compiledAt for determinism
    rules: Array.from(rules.values()),
  };
}