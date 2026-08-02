// src/compiler/pipeline/ir/immutable.ts
// Immutable IR helpers — deep clone, freeze, and immutable updates

import type {
  StyleIR,
  IRRule,
  IRDeclaration,
  IRPseudoClass,
  IRAtRule,
  IRCondition,
  IRTransformRecord,
} from "./types.js";

/**
 * Deep clone a StyleIR. Returns a new object with no shared references.
 */
export function cloneIR(ir: StyleIR): StyleIR {
  return {
    id: ir.id,
    rules: ir.rules.map(cloneRule),
    diagnostics: ir.diagnostics.map((d) => ({ ...d })),
    meta: {
      ...ir.meta,
      sourceFiles: [...ir.meta.sourceFiles],
      passes: [...ir.meta.passes],
    },
    graph: ir.graph ? cloneGraph(ir.graph) : undefined,
  };
}

function cloneGraph(graph: any): any {
  return {
    nodes:
      graph.nodes instanceof Map
        ? new Map(graph.nodes)
        : Array.isArray(graph.nodes)
          ? new Map(graph.nodes)
          : new Map(Object.entries(graph.nodes || {})),
    edges: Array.isArray(graph.edges)
      ? graph.edges.map((e: any) => ({
          ...e,
          metadata: e.metadata ? { ...e.metadata } : undefined,
        }))
      : [],
    rootNodes: graph.rootNodes ? [...graph.rootNodes] : [],
    leafNodes: graph.leafNodes ? [...graph.leafNodes] : [],
  };
}

function cloneRule(rule: IRRule): IRRule {
  return {
    id: rule.id,
    parentId: rule.parentId,
    selector: rule.selector,
    declarations: rule.declarations.map(cloneDeclaration),
    pseudoClasses: rule.pseudoClasses.map(clonePseudoClass),
    atRules: rule.atRules.map(cloneAtRule),
    nestedRules: rule.nestedRules.map(cloneRule),
    conditions: rule.conditions.map((c) => ({ ...c })),
    _dirty: rule._dirty,
    meta: { ...rule.meta },
    passMeta: rule.passMeta
      ? JSON.parse(JSON.stringify(rule.passMeta))
      : undefined,
    isDead: rule.isDead,
    specificity: rule.specificity,
    hash: rule.hash,
    source: { ...rule.source },
    history: rule.history.map((h) => ({ ...h })),
  };
}

function cloneDeclaration(decl: IRDeclaration): IRDeclaration {
  return {
    id: decl.id,
    property: decl.property,
    value: decl.value,
    important: decl.important,
    source: decl.source ? { ...decl.source } : undefined,
    history: decl.history.map((h) => ({ ...h })),
    meta: { ...decl.meta },
  };
}

function clonePseudoClass(pc: IRPseudoClass): IRPseudoClass {
  return {
    id: pc.id,
    parentId: pc.parentId,
    name: pc.name,
    declarations: pc.declarations.map(cloneDeclaration),
    source: { ...pc.source },
    history: pc.history.map((h) => ({ ...h })),
  };
}

function cloneAtRule(atRule: IRAtRule): IRAtRule {
  return {
    id: atRule.id,
    parentId: atRule.parentId,
    type: atRule.type,
    query: atRule.query,
    name: atRule.name,
    declarations: atRule.declarations.map(cloneDeclaration),
    nestedRules: atRule.nestedRules.map(cloneRule),
    keyframes: atRule.keyframes?.map((kf) => ({
      id: kf.id,
      keyText: kf.keyText,
      declarations: kf.declarations.map(cloneDeclaration),
      source: { ...kf.source },
    })),
    source: { ...atRule.source },
    history: atRule.history.map((h) => ({ ...h })),
  };
}

/**
 * Immutable update helpers — return a new object with the specified changes.
 * Much faster than full deep clone for small changes.
 */

export function updateRule(rule: IRRule, changes: Partial<IRRule>): IRRule {
  return { ...rule, ...changes };
}

export function addDeclaration(rule: IRRule, decl: IRDeclaration): IRRule {
  return {
    ...rule,
    declarations: [...rule.declarations, decl],
  };
}

export function removeDeclaration(rule: IRRule, declId: string): IRRule {
  return {
    ...rule,
    declarations: rule.declarations.filter((d) => d.id !== declId),
  };
}

export function updateDeclaration(
  rule: IRRule,
  declId: string,
  changes: Partial<IRDeclaration>,
): IRRule {
  return {
    ...rule,
    declarations: rule.declarations.map((d) =>
      d.id === declId ? { ...d, ...changes } : d,
    ),
  };
}

export function markDead(rule: IRRule): IRRule {
  return { ...rule, isDead: true };
}

export function addDiagnostic(
  ir: StyleIR,
  diag: StyleIR["diagnostics"][0],
): StyleIR {
  return {
    ...ir,
    diagnostics: [...ir.diagnostics, diag],
  };
}

export function addHistory(rule: IRRule, record: IRTransformRecord): IRRule {
  return {
    ...rule,
    history: [...rule.history, record],
  };
}

/**
 * Freeze an IR object deeply (for debugging — catches accidental mutations).
 */
export function freezeIR(ir: StyleIR): StyleIR {
  return deepFreeze(ir) as StyleIR;
}

function deepFreeze(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepFreeze);
  if (obj instanceof Map) {
    const frozen = new Map();
    obj.forEach((v, k) => frozen.set(k, deepFreeze(v)));
    return frozen;
  }
  const frozen: any = {};
  for (const key of Object.keys(obj)) {
    frozen[key] = deepFreeze(obj[key]);
  }
  return Object.freeze(frozen);
}
