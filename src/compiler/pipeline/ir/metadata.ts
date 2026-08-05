// src/compiler/pipeline/ir/metadata.ts
// Pass-owned metadata namespaces — cleaner than _prefixed grab-bag

import type { IRNodeId } from "./types.js";

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
  [passNamespace: string]: unknown;
}

export interface SemanticAnalysis {
  tokens: string[]; // Token references ($primary.500)
  intents: string[]; // Detected intents
  constraints: string[]; // Detected constraints
}

export interface LayoutAnalysis {
  type: "flexbox" | "grid" | "block" | "absolute" | "unknown";
  hasViewportUnits: boolean;
  hasLargeFixed: boolean;
  responsiveBreakpoints: string[];
}

export interface AccessibilityAnalysis {
  contrastRatio?: number;
  wcagLevel?: "A" | "AA" | "AAA";
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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a value is a plain object (not null, not array, not primitive).
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Resolve a potentially dot-delimited namespace path within a metadata object.
 * Returns the value at the path, or undefined if any segment is missing.
 */
function resolvePath(
  obj: Record<string, unknown> | undefined | null,
  path: string,
): unknown {
  if (!obj) return undefined;
  const keys = path.split(".");
  let current: any = obj;
  for (const key of keys) {
    if (current === null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Set a value at a potentially dot-delimited namespace path.
 * Returns a new object with the value set (immutable update).
 */
function setPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const keys = path.split(".");

  if (keys.length === 1) {
    const existing = obj[keys[0]];
    if (isPlainObject(existing) && isPlainObject(value)) {
      return { ...obj, [keys[0]]: { ...existing, ...value } };
    }
    return { ...obj, [keys[0]]: value };
  }

  const [head, ...tail] = keys;
  const existing = obj[head];
  const headObj = isPlainObject(existing) ? { ...existing } : {};
  return {
    ...obj,
    [head]: setPath(headObj, tail.join("."), value),
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize empty pass metadata on a rule.
 */
export function initMetadata(): PassMetadata {
  return {};
}

/**
 * Set metadata for a specific pass namespace.
 * Supports dot-delimited paths (e.g., "analysis.semantic" or "incremental.dirty").
 * Safely initializes empty object if `meta` is null or undefined.
 */
export function setPassMetadata<T = unknown>(
  meta: PassMetadata | undefined | null,
  namespace: string,
  data: T,
): PassMetadata {
  const safeMeta =
    meta && typeof meta === "object"
      ? (meta as Record<string, unknown>)
      : {};
  return setPath(safeMeta, namespace, data) as PassMetadata;
}

/**
 * Get metadata for a specific pass namespace.
 * Supports dot-delimited paths.
 */
export function getPassMetadata<T = Record<string, unknown>>(
  meta: PassMetadata | undefined | null,
  namespace: string,
): T | undefined {
  if (!meta) return undefined;
  return resolvePath(meta, namespace) as T | undefined;
}

/**
 * Check if a pass has already run on this rule.
 */
export function hasPassRun(
  meta: PassMetadata | undefined | null,
  namespace: string,
): boolean {
  return getPassMetadata(meta, namespace) !== undefined;
}

/**
 * Merge incremental metadata (dependencies/dependents) into pass metadata.
 */
export function setIncrementalMeta(
  meta: PassMetadata | undefined | null,
  deps: IRNodeId[],
  dependents: IRNodeId[],
): PassMetadata {
  return setPassMetadata(meta, "incremental", {
    dependencies: [...deps],
    dependents: [...dependents],
    dirty: false,
    lastCompiledAt: Date.now(),
  });
}

/**
 * Mark a rule as dirty in its incremental metadata.
 */
export function markDirty(
  meta: PassMetadata | undefined | null,
): PassMetadata {
  const inc = getPassMetadata<Record<string, unknown>>(meta, "incremental");
  return setPassMetadata(meta, "incremental", {
    ...inc,
    dirty: true,
  });
}