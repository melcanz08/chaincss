// src/compiler/pipeline/persistent-compiler.ts
// Persistent compiler state — keeps IR alive between compiles

import crypto from 'crypto';
import type { StyleIR, IRRule, IRNodeId } from './ir/types.js';
import { buildIRGraph, findAffectedNodes } from './ir/graph-builder.js';
import { cloneIR } from './ir/immutable.js';
import type { PassMetadata } from './ir/metadata.js';
import { setIncrementalMeta, markDirty, hasPassRun, getPassMetadata } from './ir/metadata.js';
import type { PersistentCache } from '../cache/content-addressable-cache.js';

export interface CompilerState {
  /** The current IR (persisted between compiles) */
  ir: StyleIR;
  /** Per-rule metadata (persisted between compiles) */
  metadata: Map<IRNodeId, PassMetadata>;
  /** Files that have been compiled */
  compiledFiles: Set<string>;
  /** Compilation statistics */
  stats: {
    totalCompiles: number;
    incrementalCompiles: number;
    fullCompiles: number;
    totalRulesEver: number;
    currentLiveRules: number;
    averageRecompilePercent: number;
  };
  /** Last compilation timestamp */
  lastCompiledAt: number;
}

/**
 * Create a new persistent compiler state.
 */
export function createCompilerState(ir: StyleIR): CompilerState {
  const metadata = new Map<IRNodeId, PassMetadata>();

  // Initialize metadata for all rules
  function initRuleMeta(rule: IRRule) {
    metadata.set(rule.id, setIncrementalMeta({}, [], []));
    for (const nested of rule.nestedRules || []) {
      initRuleMeta(nested);
    }
  }
  for (const rule of ir.rules) {
    initRuleMeta(rule);
  }

  return {
    ir: cloneIR(ir),
    metadata,
    compiledFiles: new Set(ir.meta.sourceFiles),
    stats: {
      totalCompiles: 1,
      incrementalCompiles: 0,
      fullCompiles: 1,
      totalRulesEver: ir.rules.length,
      currentLiveRules: ir.rules.filter(r => !r.isDead).length,
      averageRecompilePercent: 100,
    },
    lastCompiledAt: Date.now(),
  };
}

/**
 * Mark specific rules as changed (from file watcher).
 * Finds all affected rules via the dependency graph.
 */
export function markChangedRules(state: CompilerState, changedRuleIds: IRNodeId[]): void {
  // Rebuild graph from current IR
  const graph = state.ir.graph || buildIRGraph(state.ir);

  // Find all affected nodes
  const allAffected = new Set<IRNodeId>();
  for (const id of changedRuleIds) {
    allAffected.add(id);
    const affected = findAffectedNodes(graph, id);
    for (const affId of affected) {
      allAffected.add(affId);
    }
  }

  // Mark dirty in metadata
  for (const id of allAffected) {
    const meta = state.metadata.get(id);
    if (meta) {
      state.metadata.set(id, markDirty(meta));
    }
  }
}

/**
 * Get only the dirty rules for recompilation.
 */
export function getDirtyRules(state: CompilerState): IRRule[] {
  const dirty: IRRule[] = [];

  function collectDirty(rules: IRRule[]) {
    for (const rule of rules) {
      if (rule.isDead) continue;
      const meta = state.metadata.get(rule.id);
      const inc = meta ? getPassMetadata<{ dirty: boolean }>(meta, 'incremental') : undefined;
      if (inc?.dirty) {
        dirty.push(rule);
      }
      if (rule.nestedRules) {
        collectDirty(rule.nestedRules);
      }
    }
  }

  collectDirty(state.ir.rules);
  return dirty;
}

/**
 * Mark a rule as clean after successful compilation.
 */
export function markClean(state: CompilerState, ruleId: IRNodeId): void {
  const meta = state.metadata.get(ruleId);
  if (meta) {
    state.metadata.set(ruleId, setIncrementalMeta(meta, [], []));
  }
}

/**
 * Update the persistent state with new compilation results.
 */
export function updateState(
  state: CompilerState,
  newIR: StyleIR,
  changedFiles: string[]
): void {
  state.ir = cloneIR(newIR);
  
  for (const file of changedFiles) {
    state.compiledFiles.add(file);
  }

  // Mark all rules as clean
  for (const [id] of state.metadata) {
    markClean(state, id);
  }

  // Update stats
  state.stats.totalCompiles++;
  state.stats.currentLiveRules = newIR.rules.filter(r => !r.isDead).length;
  
  const dirtyCount = getDirtyRules(state).length;
  const totalRules = newIR.rules.length;
  const recompilePercent = totalRules > 0 ? Math.round((dirtyCount / totalRules) * 100) : 100;
  
  state.stats.averageRecompilePercent = Math.round(
    (state.stats.averageRecompilePercent * (state.stats.totalCompiles - 1) + recompilePercent) / 
    state.stats.totalCompiles
  );
  
  state.stats.incrementalCompiles++;
  state.lastCompiledAt = Date.now();
}

/**
 * Check if a full recompilation is needed (e.g., config change, new file type).
 */
export function needsFullRecompile(state: CompilerState, reason: string): boolean {
  // Full recompile if more than 50% of rules are dirty
  const dirtyCount = getDirtyRules(state).length;
  const totalRules = state.ir.rules.length;
  
  if (totalRules === 0) return true;
  if (dirtyCount > totalRules * 0.5) return true;
  
  return false;
}

/**
 * Get compiler state statistics.
 */
export function getStateStats(state: CompilerState) {
  const dirtyCount = getDirtyRules(state).length;
  const totalRules = state.ir.rules.length;

  return {
    ...state.stats,
    dirtyRules: dirtyCount,
    totalRules,
    recompilePercent: totalRules > 0 ? Math.round((dirtyCount / totalRules) * 100) : 0,
    compiledFiles: state.compiledFiles.size,
    uptime: Date.now() - state.lastCompiledAt,
  };
}

// ============================================================================
// Cold-Start Persistence (via PersistentCache)
// ============================================================================

export async function saveCompilerStateToDisk(
  state: CompilerState,
  cache: PersistentCache,
  projectHash: string
): Promise<void> {
  const key = `compiler-state-${projectHash}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const payload = {
    ir: state.ir,
    metadata: Array.from(state.metadata.entries()),
    compiledFiles: Array.from(state.compiledFiles),
    stats: state.stats,
    lastCompiledAt: state.lastCompiledAt,
  };
  await cache.setByHash(hash, payload);
}

export async function restoreCompilerStateFromDisk(
  cache: PersistentCache,
  projectHash: string
): Promise<CompilerState | null> {
  const key = `compiler-state-${projectHash}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const cached = await cache.getByHash(hash);
  if (!cached) return null;

  return {
    ir: cached.ir,
    metadata: new Map(cached.metadata),
    compiledFiles: new Set(cached.compiledFiles),
    stats: cached.stats,
    lastCompiledAt: cached.lastCompiledAt,
  };
}