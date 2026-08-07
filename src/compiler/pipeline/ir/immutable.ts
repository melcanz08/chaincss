// src/compiler/pipeline/ir/immutable.ts
// Immutable IR helpers — deep clone, freeze, and immutable updates

import type {
  StyleIR,
  IRRule,
  IRDeclaration,
  IRPseudoClass,
  IRAtRule,
  IRTransformRecord,
} from "./types.js";

// ============================================================================
// Safe Cloning Utilities
// ============================================================================

/**
 * Recursively clone a passMeta object, preserving Map, Set, and nested objects.
 * Does NOT use JSON serialization — safe for circular references, Maps, and Sets.
 */
export function clonePassMeta(meta: any): any {
  if (meta === null || typeof meta !== "object") return meta;
  if (meta instanceof Set) return new Set(Array.from(meta).map(clonePassMeta));
  if (meta instanceof Map) {
    const copy = new Map();
    meta.forEach((v, k) => copy.set(k, clonePassMeta(v)));
    return copy;
  }
  if (Array.isArray(meta)) return meta.map(clonePassMeta);

  const copy: Record<string, any> = {};
  for (const key of Object.keys(meta)) {
    copy[key] = clonePassMeta(meta[key]);
  }
  return copy;
}

// ============================================================================
// Node Cloners
// ============================================================================

function cloneDeclaration(decl: IRDeclaration): IRDeclaration {
  return {
    id: decl.id,
    property: decl.property,
    value: decl.value,
    important: decl.important,
    source: decl.source ? { ...decl.source } : undefined,
    history: (decl.history || []).map((h) => ({ ...h })),
    meta: decl.meta ? clonePassMeta(decl.meta) : undefined,
  };
}

function clonePseudoClass(pc: IRPseudoClass): IRPseudoClass {
  return {
    id: pc.id,
    parentId: pc.parentId,
    name: pc.name,
    declarations: (pc.declarations || []).map(cloneDeclaration),
    source: pc.source ? { ...pc.source } : { file: "", line: 0, column: 0 },
    history: (pc.history || []).map((h) => ({ ...h })),
  };
}

function cloneAtRule(atRule: IRAtRule): IRAtRule {
  return {
    id: atRule.id,
    parentId: atRule.parentId,
    type: atRule.type,
    query: atRule.query,
    name: atRule.name,
    declarations: (atRule.declarations || []).map(cloneDeclaration),
    nestedRules: (atRule.nestedRules || []).map(cloneRule),
    keyframes: atRule.keyframes?.map((kf) => ({
      id: kf.id,
      keyText: kf.keyText,
      declarations: (kf.declarations || []).map(cloneDeclaration),
      source: kf.source ? { ...kf.source } : { file: "", line: 0, column: 0 },
    })),
    source: atRule.source
      ? { ...atRule.source }
      : { file: "", line: 0, column: 0 },
    history: (atRule.history || []).map((h) => ({ ...h })),
  };
}

function cloneRule(rule: IRRule): IRRule {
  return {
    id: rule.id,
    parentId: rule.parentId,
    selector: rule.selector,
    declarations: (rule.declarations || []).map(cloneDeclaration),
    pseudoClasses: (rule.pseudoClasses || []).map(clonePseudoClass),
    atRules: (rule.atRules || []).map(cloneAtRule),
    nestedRules: (rule.nestedRules || []).map(cloneRule),
    conditions: (rule.conditions || []).map((c) => ({ ...c })),
    _dirty: rule._dirty,
    meta: {
      ...rule.meta,
      dependencies: rule.meta?.dependencies ? [...rule.meta.dependencies] : [],
      dependents: rule.meta?.dependents ? [...rule.meta.dependents] : [],
    },
    passMeta: rule.passMeta ? clonePassMeta(rule.passMeta) : undefined,
    isDead: rule.isDead,
    specificity: rule.specificity,
    hash: rule.hash,
    source: rule.source
      ? { ...rule.source }
      : { file: "", line: 0, column: 0 },
    history: (rule.history || []).map((h) => ({ ...h })),
  };
}

// ============================================================================
// Graph Cloning
// ============================================================================

/**
 * Rebuild a cloned graph using newly cloned rules, preserving synthetic token
 * nodes and virtual at-rule nodes.
 */
function rebuildClonedGraph(graph: any, clonedRules: IRRule[]): any {
  const nodeMap = new Map<string, IRRule>();

  // Helper to index rule trees, including rules nested inside at-rules
  function indexRules(rules: IRRule[]): void {
    for (const rule of rules) {
      if (!rule) continue;
      nodeMap.set(rule.id, rule);
      if (rule.nestedRules) indexRules(rule.nestedRules);
      if (rule.atRules) {
        for (const atRule of rule.atRules) {
          if (atRule.nestedRules) indexRules(atRule.nestedRules);
        }
      }
    }
  }

  indexRules(clonedRules);

  // Preserve synthetic token nodes and virtual at-rule nodes from original graph
  if (graph?.nodes) {
    const entries: Array<[string, any]> =
      graph.nodes instanceof Map
        ? Array.from(graph.nodes.entries())
        : Object.entries(graph.nodes);

    for (const [id, originalNode] of entries) {
      if (!nodeMap.has(id) && originalNode) {
        nodeMap.set(id, cloneRule(originalNode as IRRule));
      }
    }
  }

  return {
    nodes: nodeMap,
    edges: (graph.edges || []).map((e: any) => ({
      ...e,
      metadata: e.metadata ? { ...e.metadata } : undefined,
    })),
    rootNodes: graph.rootNodes ? [...graph.rootNodes] : [],
    leafNodes: graph.leafNodes ? [...graph.leafNodes] : [],
  };
}

// ============================================================================
// IR Cloning
// ============================================================================

/**
 * Deep clone a StyleIR. Returns a new object with no shared references.
 */
export function cloneIR(ir: StyleIR): StyleIR {
  const clonedRules = (ir.rules || []).map(cloneRule);

  const clonedIR: StyleIR = {
    id: ir.id,
    rules: clonedRules,
    diagnostics: (ir.diagnostics || []).map((d) => ({ ...d })),
    meta: {
      ...ir.meta,
      sourceFiles: [...(ir.meta?.sourceFiles || [])],
      passes: [...(ir.meta?.passes || [])],
    },
    graph: undefined,
  };

  if (ir.graph) {
    clonedIR.graph = rebuildClonedGraph(ir.graph, clonedRules);
  }

  return clonedIR;
}

// ============================================================================
// Immutable Update Helpers
// ============================================================================

export function updateRule(rule: IRRule, changes: Partial<IRRule>): IRRule {
  return { ...rule, ...changes, _dirty: true };
}

export function addDeclaration(rule: IRRule, decl: IRDeclaration): IRRule {
  return {
    ...rule,
    _dirty: true,
    declarations: [...(rule.declarations || []), decl],
  };
}

export function removeDeclaration(rule: IRRule, declId: string): IRRule {
  return {
    ...rule,
    _dirty: true,
    declarations: (rule.declarations || []).filter((d) => d.id !== declId),
  };
}

export function updateDeclaration(
  rule: IRRule,
  declId: string,
  changes: Partial<IRDeclaration>,
): IRRule {
  return {
    ...rule,
    _dirty: true,
    declarations: (rule.declarations || []).map((d) =>
      d.id === declId ? { ...d, ...changes } : d,
    ),
  };
}

export function markDead(rule: IRRule): IRRule {
  return { ...rule, isDead: true, _dirty: true };
}

export function addDiagnostic(
  ir: StyleIR,
  diag: StyleIR["diagnostics"][0],
): StyleIR {
  return {
    ...ir,
    diagnostics: [...(ir.diagnostics || []), diag],
  };
}

export function addHistory(rule: IRRule, record: IRTransformRecord): IRRule {
  return {
    ...rule,
    _dirty: true,
    history: [...(rule.history || []), record],
  };
}

// ============================================================================
// Deep Freeze (for debugging — catches accidental mutations)
// ============================================================================

export function freezeIR(ir: StyleIR): StyleIR {
  return deepFreeze(ir) as StyleIR;
}

function deepFreeze(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return Object.freeze(obj.map(deepFreeze));
  }

  if (obj instanceof Map) {
    const frozen = new Map();
    obj.forEach((v, k) => frozen.set(k, deepFreeze(v)));
    frozen.set = () => {
      throw new Error("Cannot mutate frozen Map");
    };
    frozen.delete = () => {
      throw new Error("Cannot mutate frozen Map");
    };
    frozen.clear = () => {
      throw new Error("Cannot mutate frozen Map");
    };
    return frozen;
  }

  if (obj instanceof Set) {
    const frozen = new Set(Array.from(obj).map(deepFreeze));
    frozen.add = () => {
      throw new Error("Cannot mutate frozen Set");
    };
    frozen.delete = () => {
      throw new Error("Cannot mutate frozen Set");
    };
    frozen.clear = () => {
      throw new Error("Cannot mutate frozen Set");
    };
    return frozen;
  }

  const frozen: any = {};
  for (const key of Object.keys(obj)) {
    frozen[key] = deepFreeze(obj[key]);
  }
  return Object.freeze(frozen);
}