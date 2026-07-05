// src/compiler/pipeline/inspector-store.ts
// Accumulates inspector rules during compilation and exports them

import type { InspectorRule, InspectorExport } from './types.js';
import { buildInspectorExport } from './exporter.js';

export class InspectorStore {
  private rules = new Map<string, InspectorRule>();

  add(rule: InspectorRule): void {
    this.rules.set(rule.id, rule);
  }

  addAll(rules: InspectorRule[]): void {
    for (const rule of rules) {
      this.rules.set(rule.id, rule);
    }
  }

  clear(): void {
    this.rules.clear();
  }

  export(): InspectorExport | null {
    return buildInspectorExport(this.rules);
  }

  get size(): number {
    return this.rules.size;
  }
}