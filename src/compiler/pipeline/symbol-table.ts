// src/compiler/pipeline/symbol-table.ts
// Central symbol table for resolving tokens, variables, components, animations

import type { IRNodeId, StyleIR, IRRule, IRAtRule } from "./ir/types.js";
import { ensureRuleMeta } from "./ir/utils.js";

export type SymbolKind =
  | "token"
  | "variable"
  | "component"
  | "selector"
  | "animation"
  | "keyframe"
  | "media-query"
  | "layer"
  | "alias";

export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  nodeId: IRNodeId;
  value?: string | number;
  source?: string;
  /** Symbol IDs or names this entry depends on */
  dependencies: string[];
  /** Symbol IDs or names that depend on this entry */
  dependents: string[];
  /** Metadata from passes */
  meta: Record<string, unknown>;
}

export interface SymbolTable {
  /** Composite key lookup: `${kind}:${name}` */
  symbols: Map<string, SymbolEntry>;
  /** Map by kind for targeted searches */
  byKind: Map<SymbolKind, Map<string, SymbolEntry>>;
  /** Fast node ID -> Symbol keys lookup */
  nodeToSymbols: Map<IRNodeId, Set<string>>;
  /** Statistics */
  stats: {
    totalSymbols: number;
    byKind: Record<SymbolKind, number>;
  };
}

/** Generate unique key to prevent kind collision */
function makeSymbolKey(kind: SymbolKind, name: string): string {
  return `${kind}:${name}`;
}

const ALL_KINDS: SymbolKind[] = [
  "token",
  "variable",
  "component",
  "selector",
  "animation",
  "keyframe",
  "media-query",
  "layer",
  "alias",
];

/**
 * Build a symbol table from the StyleIR.
 * Extracts: tokens ($prefix), variables (--prefix), components, selectors, animations
 */
export function buildSymbolTable(ir: StyleIR): SymbolTable {
  const symbols = new Map<string, SymbolEntry>();
  const byKind = new Map<SymbolKind, Map<string, SymbolEntry>>();
  const nodeToSymbols = new Map<IRNodeId, Set<string>>();

  // Initialize byKind maps for all kinds
  for (const kind of ALL_KINDS) {
    byKind.set(kind, new Map());
  }

  const addSymbol = (entry: SymbolEntry) => {
    const key = makeSymbolKey(entry.kind, entry.name);
    
    if (!symbols.has(key)) {
      symbols.set(key, entry);
      byKind.get(entry.kind)!.set(entry.name, entry);
    } else {
      // Merge dependents/dependencies if symbol already exists
      const existing = symbols.get(key)!;
      for (const dep of entry.dependents) {
        if (!existing.dependents.includes(dep)) existing.dependents.push(dep);
      }
      for (const dep of entry.dependencies) {
        if (!existing.dependencies.includes(dep)) existing.dependencies.push(dep);
      }
    }

    // Index node ID to composite symbol keys
    if (!nodeToSymbols.has(entry.nodeId)) {
      nodeToSymbols.set(entry.nodeId, new Set());
    }
    nodeToSymbols.get(entry.nodeId)!.add(key);
  };

  function processRules(rules: IRRule[]) {
    for (const rule of rules) {
      if (rule.isDead) continue;
      const meta = ensureRuleMeta(rule);

      // 1. Selector as a symbol
      addSymbol({
        name: rule.selector,
        kind: "selector",
        nodeId: rule.id,
        source: rule.source?.component,
        dependencies: meta.dependencies ?? [],
        dependents: meta.dependents ?? [],
        meta: { specificity: rule.specificity },
      });

      // 2. Component name
      if (rule.source?.component) {
        addSymbol({
          name: rule.source.component,
          kind: "component",
          nodeId: rule.id,
          source: rule.source.file,
          dependencies: [],
          dependents: [rule.id],
          meta: {},
        });
      }

      // 3. Declarations (Tokens & CSS Variables)
      for (const decl of rule.declarations || []) {
        const valStr = String(decl.value);

        // Extract $token references
        const tokenMatches = valStr.matchAll(/\$([a-zA-Z0-9_.-]+)/g);
        for (const match of tokenMatches) {
          const tokenName = match[1];
          addSymbol({
            name: tokenName,
            kind: "token",
            nodeId: decl.id,
            value: decl.value,
            source: rule.source?.file,
            dependencies: [],
            dependents: [rule.id],
            meta: {},
          });
        }

        // Extract var(--variable) references
        const varMatches = valStr.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g);
        for (const match of varMatches) {
          const varName = match[1];
          addSymbol({
            name: varName,
            kind: "variable",
            nodeId: decl.id,
            value: decl.value,
            source: rule.source?.file,
            dependencies: [],
            dependents: [rule.id],
            meta: { isReference: true },
          });
        }

        // CSS custom property declarations (--name: value)
        if (decl.property.startsWith("--")) {
          addSymbol({
            name: decl.property,
            kind: "variable",
            nodeId: decl.id,
            value: decl.value,
            source: rule.source?.file,
            dependencies: [],
            dependents: [rule.id],
            meta: { isDeclaration: true },
          });
        }
      }

      // 4. At-rules (keyframes, media queries)
      if (rule.atRules) {
        for (const atRule of rule.atRules) {
          if (atRule.type === "keyframes" && atRule.name) {
            addSymbol({
              name: atRule.name,
              kind: "animation",
              nodeId: atRule.id,
              source: rule.source?.file,
              dependencies: [],
              dependents: [rule.id],
              meta: { type: "keyframes" },
            });
          }
          if (atRule.type === "media" && atRule.query) {
            addSymbol({
              name: atRule.query,
              kind: "media-query",
              nodeId: atRule.id,
              source: rule.source?.file,
              dependencies: [],
              dependents: [rule.id],
              meta: {},
            });
          }
        }
      }

      // 5. Recurse nested rules
      if (rule.nestedRules && rule.nestedRules.length > 0) {
        processRules(rule.nestedRules);
      }
    }
  }

  processRules(ir.rules);

  // Compute stats
  const stats = {
    totalSymbols: symbols.size,
    byKind: {} as Record<SymbolKind, number>,
  };
  for (const kind of ALL_KINDS) {
    stats.byKind[kind] = byKind.get(kind)?.size ?? 0;
  }

  return { symbols, byKind, nodeToSymbols, stats };
}

/**
 * Resolve a symbol by name and optional kind.
 */
export function resolveSymbol(
  table: SymbolTable,
  name: string,
  kind?: SymbolKind,
): SymbolEntry | undefined {
  if (kind) {
    return table.byKind.get(kind)?.get(name);
  }
  for (const map of table.byKind.values()) {
    if (map.has(name)) return map.get(name);
  }
  return undefined;
}

/**
 * Find all symbol entries for node IDs dependent on a given symbol.
 */
export function findDependents(
  table: SymbolTable,
  name: string,
  kind?: SymbolKind,
): SymbolEntry[] {
  const entry = resolveSymbol(table, name, kind);
  if (!entry) return [];

  const results = new Set<SymbolEntry>();
  for (const nodeId of entry.dependents) {
    const symbolKeys = table.nodeToSymbols.get(nodeId);
    if (symbolKeys) {
      for (const key of symbolKeys) {
        const sym = table.symbols.get(key);
        if (sym && sym !== entry) results.add(sym);
      }
    }
  }
  return Array.from(results);
}

/**
 * Find all symbol entries that a given symbol depends on.
 */
export function findDependencies(
  table: SymbolTable,
  name: string,
  kind?: SymbolKind,
): SymbolEntry[] {
  const entry = resolveSymbol(table, name, kind);
  if (!entry) return [];

  const results = new Set<SymbolEntry>();
  for (const nodeId of entry.dependencies) {
    const symbolKeys = table.nodeToSymbols.get(nodeId);
    if (symbolKeys) {
      for (const key of symbolKeys) {
        const sym = table.symbols.get(key);
        if (sym && sym !== entry) results.add(sym);
      }
    }
  }
  return Array.from(results);
}

/**
 * Get all symbols of a specific kind.
 */
export function getSymbolsByKind(
  table: SymbolTable,
  kind: SymbolKind,
): SymbolEntry[] {
  const map = table.byKind.get(kind);
  return map ? Array.from(map.values()) : [];
}

/**
 * Check if a symbol is unused (no dependents).
 */
export function isUnused(
  table: SymbolTable,
  name: string,
  kind?: SymbolKind,
): boolean {
  const entry = resolveSymbol(table, name, kind);
  return entry ? entry.dependents.length === 0 : true;
}

/**
 * Find unused symbols (tokens, variables, animations that nothing references).
 */
export function findUnusedSymbols(table: SymbolTable): SymbolEntry[] {
  return Array.from(table.symbols.values()).filter(
    (s) => s.dependents.length === 0,
  );
}