// src/compiler/pipeline/ir/factory.ts
/** Factory functions for creating IR nodes safely. */

import type { IRNodeId, IRDeclaration, IRRule, IRPseudoClass, IRAtRule, IRCondition, IRTransformRecord, StyleIR, SourceLocation } from './types.js';

// ============================================================================
// ID Generator
// ============================================================================

let idCounter = 0;
export function nextId(prefix: string = 'ir'): IRNodeId {
  return prefix + '-' + (idCounter++).toString(36) + '-' + Date.now().toString(36);
}

export function resetIdCounter(): void {
  idCounter = 0;
}

// ============================================================================
// IR Factory — create nodes safely
// ============================================================================

export function record(pass: string, action: string, previous?: any, reason?: string): IRTransformRecord {
  return { pass, action, timestamp: Date.now(), previous, reason };
}

export function createDeclaration(
  property: string,
  value: string | number,
  source?: SourceLocation,
  meta: Record<string, any> = {}
): IRDeclaration {
  return {
    id: nextId('decl'),
    property,
    value,
    source,
    history: [record('parser', 'created', undefined, 'Parsed from StyleDefinition')],
    meta,
  };
}

export function createRule(
  selector: string,
  source?: SourceLocation
): IRRule {
  return {
    id: nextId('rule'),
    selector,
    declarations: [],
    pseudoClasses: [],
    atRules: [],
    nestedRules: [],
    conditions: [],
    _dirty: true,
    isDead: false,
    specificity: 0,
    hash: '',
    source: source || {},
    history: [record('parser', 'created', undefined, 'Parsed from StyleDefinition')],
    meta: {},
  };
}

export function createIR(sourceFiles: string[] = []): StyleIR {
  return {
    id: nextId('ir'),
    rules: [],
    diagnostics: [],
    meta: {
      version: '1.0.0',
      createdAt: Date.now(),
      sourceFiles,
      passCount: 0,
      passes: [],
      dirtyRules: 0,
      compiledAt: Date.now(),
    },
  };
}
