// src/compiler/pipeline/symbol-table.ts
// Central symbol table for resolving tokens, variables, components, animations

import type { IRNodeId, StyleIR, IRRule, IRAtRule } from './ir/types.js';

export type SymbolKind = 
  | 'token' 
  | 'variable' 
  | 'component' 
  | 'selector' 
  | 'animation' 
  | 'keyframe' 
  | 'media-query' 
  | 'layer' 
  | 'alias';

export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  nodeId: IRNodeId;
  value?: string | number;
  source?: string;
  /** Symbols this entry depends on */
  dependencies: string[];
  /** Symbols that depend on this entry */
  dependents: string[];
  /** Metadata from passes */
  meta: Record<string, unknown>;
}

export interface SymbolTable {
  symbols: Map<string, SymbolEntry>;
  /** Lookup by kind */
  byKind: Map<SymbolKind, Map<string, SymbolEntry>>;
  /** Statistics */
  stats: {
    totalSymbols: number;
    byKind: Record<SymbolKind, number>;
  };
}

/**
 * Build a symbol table from the StyleIR.
 * Extracts: tokens ($prefix), variables (--prefix), components, selectors, animations
 */
export function buildSymbolTable(ir: StyleIR): SymbolTable {
  const symbols = new Map<string, SymbolEntry>();
  const byKind = new Map<SymbolKind, Map<string, SymbolEntry>>();
  
  const addSymbol = (entry: SymbolEntry) => {
    symbols.set(entry.name, entry);
    if (!byKind.has(entry.kind)) {
      byKind.set(entry.kind, new Map());
    }
    byKind.get(entry.kind)!.set(entry.name, entry);
  };

  // Extract from rules
  for (const rule of ir.rules) {
    if (rule.isDead) continue;

    // Selector as a symbol
    addSymbol({
      name: rule.selector,
      kind: 'selector',
      nodeId: rule.id,
      source: rule.source?.component,
      dependencies: rule.meta.dependencies || [],
      dependents: rule.meta.dependents || [],
      meta: { specificity: rule.specificity },
    });

    // Component name
    if (rule.source?.component) {
      addSymbol({
        name: rule.source.component,
        kind: 'component',
        nodeId: rule.id,
        source: rule.source.file,
        dependencies: [],
        dependents: [rule.id],
        meta: {},
      });
    }

    // Declarations with token references ($name)
    for (const decl of (rule.declarations || [])) {
      // Token references
      const tokenMatches = String(decl.value).matchAll(/\$([a-zA-Z0-9_.-]+)/g);
      for (const match of tokenMatches) {
        const tokenName = match[1];
        if (!symbols.has(tokenName)) {
          addSymbol({
            name: tokenName,
            kind: 'token',
            nodeId: decl.id,
            value: decl.value,
            source: rule.source?.file,
            dependencies: [],
            dependents: [rule.id],
            meta: {},
          });
        } else {
          // Add this rule as a dependent
          const existing = symbols.get(tokenName)!;
          if (!existing.dependents.includes(rule.id)) {
            existing.dependents.push(rule.id);
          }
        }
      }

      // CSS custom properties (--name)
      if (decl.property.startsWith('--')) {
        addSymbol({
          name: decl.property,
          kind: 'variable',
          nodeId: decl.id,
          value: decl.value,
          source: rule.source?.file,
          dependencies: [],
          dependents: [rule.id],
          meta: {},
        });
      }
    }

    // At-rules (keyframes, media queries)
    if (rule.atRules) {
      for (const atRule of (rule.atRules || [])) {
        if (atRule.type === 'keyframes' && atRule.name) {
          addSymbol({
            name: atRule.name,
            kind: 'animation',
            nodeId: atRule.id,
            source: rule.source?.file,
            dependencies: [],
            dependents: [rule.id],
            meta: { type: 'keyframes' },
          });
        }
        if (atRule.type === 'media' && atRule.query) {
          addSymbol({
            name: atRule.query,
            kind: 'media-query',
            nodeId: atRule.id,
            source: rule.source?.file,
            dependencies: [],
            dependents: [rule.id],
            meta: {},
          });
        }
      }
    }
  }

  // Compute stats
  const stats = {
    totalSymbols: symbols.size,
    byKind: {} as Record<SymbolKind, number>,
  };
  for (const [kind, map] of byKind) {
    stats.byKind[kind] = map.size;
  }

  return { symbols, byKind, stats };
}

/**
 * Resolve a symbol by name. Returns undefined if not found.
 */
export function resolveSymbol(table: SymbolTable, name: string): SymbolEntry | undefined {
  return table.symbols.get(name);
}

/**
 * Find all symbols that depend on a given symbol.
 */
export function findDependents(table: SymbolTable, name: string): SymbolEntry[] {
  const entry = table.symbols.get(name);
  if (!entry) return [];
  return entry.dependents
    .map(id => table.symbols.get(id))
    .filter(Boolean) as SymbolEntry[];
}

/**
 * Find all symbols that a given symbol depends on.
 */
export function findDependencies(table: SymbolTable, name: string): SymbolEntry[] {
  const entry = table.symbols.get(name);
  if (!entry) return [];
  return entry.dependencies
    .map(id => table.symbols.get(id))
    .filter(Boolean) as SymbolEntry[];
}

/**
 * Get all symbols of a specific kind.
 */
export function getSymbolsByKind(table: SymbolTable, kind: SymbolKind): SymbolEntry[] {
  const map = table.byKind.get(kind);
  return map ? Array.from(map.values()) : [];
}

/**
 * Check if a symbol is unused (no dependents).
 */
export function isUnused(table: SymbolTable, name: string): boolean {
  const entry = table.symbols.get(name);
  return entry ? entry.dependents.length === 0 : true;
}

/**
 * Find unused symbols (tokens, variables, animations that nothing references).
 */
export function findUnusedSymbols(table: SymbolTable): SymbolEntry[] {
  return Array.from(table.symbols.values()).filter(s => s.dependents.length === 0);
}
