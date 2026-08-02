// src/compiler/pipeline/ir/metadata.ts
// Pass-owned metadata namespaces — cleaner than _prefixed grab-bag

import type { IRNodeId } from './types.js';

/**
 * Namespaced metadata registry.
 * Each pass owns its own namespace, preventing cross-pass pollution.
 */
export interface PassMetadata {
  /** Analysis-phase metadata */
  analysis?: {
    semantic?: SemanticAnalysis;
    layout?: LayoutAnalysis;
    accessibility?: AccessibilityAnalysis;
  };
  /** Optimization-phase metadata */
  optimization?: {
    atomic?: AtomicMetadata;
    deadCode?: DeadCodeMetadata;
    compression?: CompressionMetadata;
  };
  /** Incremental compilation metadata */
  incremental?: {
    dependencies?: IRNodeId[];
    dependents?: IRNodeId[];
    dirty?: boolean;
    lastCompiledAt?: number;
    sourceHash?: string;
  };
  /** Allow custom pass namespaces */
  [passNamespace: string]: Record<string, unknown> | undefined;
}

export interface SemanticAnalysis {
  tokens: string[];        // Token references ($primary.500)
  intents: string[];       // Detected intents
  constraints: string[];   // Detected constraints
}

export interface LayoutAnalysis {
  type: 'flexbox' | 'grid' | 'block' | 'absolute' | 'unknown';
  hasViewportUnits: boolean;
  hasLargeFixed: boolean;
  responsiveBreakpoints: string[];
}

export interface AccessibilityAnalysis {
  contrastRatio?: number;
  wcagLevel?: 'A' | 'AA' | 'AAA';
  hasFocusIndicator: boolean;
  hasAriaLabel: boolean;
  suggestions: string[];
}

export interface AtomicMetadata {
  isAtomic: boolean;
  className?: string;
  property?: string;
  usageCount?: number;
}

export interface DeadCodeMetadata {
  isDead: boolean;
  eliminatedBy?: string;
  eliminatedAt?: number;
}

export interface CompressionMetadata {
  originalBytes: number;
  compressedBytes: number;
  savingsPercent: number;
}

/**
 * Initialize empty pass metadata on a rule.
 */
export function initMetadata(): PassMetadata {
  return {};
}

/**
 * Set metadata for a specific pass namespace.
 */
export function setPassMetadata<T extends Record<string, unknown>>(
  meta: PassMetadata,
  namespace: string,
  data: T
): PassMetadata {
  return {
    ...meta,
    [namespace]: { ...(meta[namespace] as any || {}), ...data },
  };
}

/**
 * Get metadata for a specific pass namespace.
 */
export function getPassMetadata<T = Record<string, unknown>>(
  meta: PassMetadata,
  namespace: string
): T | undefined {
  return (meta as any)[namespace] as T | undefined;
}

/**
 * Check if a pass has already run on this rule (by checking its namespace).
 */
export function hasPassRun(meta: PassMetadata, namespace: string): boolean {
  return namespace in meta;
}

/**
 * Merge incremental metadata (dependencies/dependents) into pass metadata.
 */
export function setIncrementalMeta(
  meta: PassMetadata,
  deps: IRNodeId[],
  dependents: IRNodeId[]
): PassMetadata {
  return setPassMetadata(meta, 'incremental', {
    dependencies: deps,
    dependents,
    dirty: false,
    lastCompiledAt: Date.now(),
  });
}

/**
 * Mark a rule as dirty in its incremental metadata.
 */
export function markDirty(meta: PassMetadata): PassMetadata {
  const inc = getPassMetadata<{ dirty: boolean; lastCompiledAt: number }>(meta, 'incremental');
  return setPassMetadata(meta, 'incremental', {
    ...inc,
    dirty: true,
  });
}
