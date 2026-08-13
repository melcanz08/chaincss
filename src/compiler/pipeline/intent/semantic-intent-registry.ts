// ============================================================================
// FILE: src/compiler/pipeline/intent/semantic-intent-registry.ts
// Registry for user-defined semantic intents
// ============================================================================

import {
  SemanticIntentProperties,
  SemanticIntentMap,
  SemanticIntentDefinition,
  SemanticIntentContext,
  SemanticIntentResult,
  type IntentDefinition,
} from "./semantic-intent-types.js";
import { registerIntent } from "../lowering/intent-resolver.js";
import { getIntentCatalog } from "./intent-catalog.js";

// ============================================================================
// Registry State
// ============================================================================

const registry = new Map<string, SemanticIntentDefinition>();

// ============================================================================
// Public API
// ============================================================================

/**
 * Register a single semantic intent.
 * Converts it to the existing IntentDefinition format and registers
 * with the intent-resolver so the lowering stage picks it up automatically.
 */
export function registerSemanticIntent(
  def: SemanticIntentDefinition,
  allowOverride = false,
): void {
  if (!allowOverride && registry.has(def.name)) {
    console.warn(
      `[ChainCSS] Semantic intent "${def.name}" already registered. Use allowOverride:true to replace.`,
    );
    return;
  }

  registry.set(def.name, def);

  // Convert to existing IntentDefinition so intent-resolver can use it
  const resolved = resolveSemanticIntent(def.name, {});
  if (resolved && !isComposite(resolved)) {
    const intentDef: IntentDefinition = {
      name: def.name,
      category: def.category,
      description: def.description ?? `Semantic intent: ${def.name}`,
      properties: resolved.properties,
      states: resolved.states,
      responsive: resolved.responsive,
      a11y: resolved.a11y,
    };
    registerIntent(def.name, intentDef, allowOverride);
  }
}

/**
 * Register multiple semantic intents at once.
 */
export function registerSemanticIntents(
  intents: SemanticIntentMap,
  allowOverride = false,
): void {
  for (const def of Object.values(intents)) {
    registerSemanticIntent(def, allowOverride);
  }
}

/**
 * Resolve a semantic intent by name.
 * Handles composite intents recursively (with cycle detection).
 */
export function resolveSemanticIntent(
  name: string,
  ctx: SemanticIntentContext,
  visited = new Set<string>(),
): SemanticIntentResult | null {
  if (visited.has(name)) {
    console.warn(`[ChainCSS] Circular intent reference detected: "${name}"`);
    return null;
  }

  const def = registry.get(name);
  visited.add(name);

  if (def) {
    const result = def.resolve(ctx);

    if (isComposite(result)) {
      const merged: Required<SemanticIntentProperties> = {
        properties: {},
        states: {},
        responsive: {},
        a11y: [],
      };

      for (const subName of result.expandsTo) {
        const subResult = resolveSemanticIntent(subName, {
          ...ctx,
          args: result.args ?? ctx.args,
        }, new Set(visited));

        if (subResult && !isComposite(subResult)) {
          Object.assign(merged.properties, subResult.properties);
          if (subResult.states) {
            for (const [state, props] of Object.entries(subResult.states)) {
              merged.states[state] = { ...merged.states[state], ...props };
            }
          }
          if (subResult.responsive) {
            for (const [bp, props] of Object.entries(subResult.responsive)) {
              merged.responsive[bp] = { ...merged.responsive[bp], ...props };
            }
          }
          if (subResult.a11y) {
            merged.a11y = [...new Set([...merged.a11y, ...subResult.a11y])];
          }
        }
      }

      return merged;
    }

    return result;
  }

  // Fall back to flat INTENT_CATALOG for leaf intents
  const flat = getIntentCatalog()[name];

  if (flat) {
    return {
      properties: { ...(flat.properties || {}) },
      states: { ...(flat.states || {}) },
      responsive: { ...(flat.responsive || {}) },
      a11y: flat.a11y ? [...flat.a11y] : [],
    };
  }

  return null;
}

/**
 * Check if an intent is registered.
 */
export function hasSemanticIntent(name: string): boolean {
  return registry.has(name);
}

/**
 * Get all registered semantic intent names.
 */
export function getSemanticIntentNames(): string[] {
  return Array.from(registry.keys());
}

/**
 * Clear all registered semantic intents (useful for testing).
 */
export function clearSemanticIntents(): void {
  registry.clear();
}

// ============================================================================
// Helpers
// ============================================================================

function isComposite(
  result: SemanticIntentResult,
): result is { expandsTo: string[]; args?: Record<string, unknown> } {
  return "expandsTo" in result && Array.isArray((result as any).expandsTo);
}