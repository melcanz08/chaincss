// ============================================================================
// FILE: src/compiler/pipeline/inspector/store.ts
// ============================================================================

import type { InspectorRule, InspectorExport } from './types.js';
import { buildInspectorExport, type ExporterOptions } from './exporter.js';

export class InspectorStore {
  private rules = new Map<string, InspectorRule>();

  add(rule: InspectorRule): void {
    if (!rule || !rule.id) return;
    this.rules.set(rule.id, rule);
  }

  addAll(rules: InspectorRule[]): void {
    if (!Array.isArray(rules)) return;
    for (const rule of rules) {
      if (rule && rule.id) {
        this.rules.set(rule.id, rule);
      }
    }
  }

  clearFileContext(sourceFile: string): void {
    if (!sourceFile) return;
    const matchPrefix = `${sourceFile}::`;
    for (const key of Array.from(this.rules.keys())) {
      if (key.startsWith(matchPrefix)) {
        this.rules.delete(key);
      }
    }
  }

  clear(): void {
    this.rules.clear();
  }

  export(options: ExporterOptions = {}): InspectorExport | null {
    if (this.rules.size === 0) return null;
    return buildInspectorExport(this.rules, options);
  }

  get size(): number {
    return this.rules.size;
  }
}