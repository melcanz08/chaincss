// ============================================================================
// FILE: src/compiler/pipeline/inspector/exporter.ts
// ============================================================================

import type { InspectorRule, InspectorExport } from './types.js';
import { VERSION } from "@shared/constants/index.js";

export interface ExporterOptions {
  /** Target execution context layout tag (e.g., 'dev', 'prod', 'ci') */
  pipelinePreset?: string;
  /** Deterministic fallback timestamp string from core compilation metadata records */
  compiledAt?: string;
}

/**
 * Packs accumulated pipeline analysis telemetry records into a standardized export payload.
 * Modeled to run as a deterministic, cache-safe transformation layer.
 */
export function buildInspectorExport(
  rules: Map<string, InspectorRule>,
  options: ExporterOptions = {}
): InspectorExport | null {
  if (!rules || rules.size === 0) return null;

  // 1. Enforce strict build determinism: 
  // Prioritize compilation meta context timestamps over volatile live environment run clocks.
  const finalTimestamp = options.compiledAt 
    ? String(options.compiledAt) 
    : new Date().toISOString();

  // 2. Resolve environment mode settings cleanly
  const currentPipeline = options.pipelinePreset 
    ? String(options.pipelinePreset).trim() 
    : 'standard-build';

  return {
    schemaVersion: 1,
    compilerVersion: VERSION || 'unknown-version',
    pipeline: currentPipeline,
    generatedAt: finalTimestamp,
    rules: Array.from(rules.values()),
  };
}