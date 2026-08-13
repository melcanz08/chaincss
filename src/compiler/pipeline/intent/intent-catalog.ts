// ============================================================================
// FILE: src/compiler/pipeline/intent/intent-catalog.ts
// Shared intent catalog — imported by both intent-resolver and semantic-registry.
// Uses globalThis to share state across CLI and library bundles.
// No circular dependencies.
// ============================================================================

import type { IntentDefinition } from "./semantic-intent-types.js";

export type { IntentDefinition };

const GLOBAL_KEY = "__chaincss_intent_catalog__";

function getGlobalCatalog(): Record<string, IntentDefinition> {
  if (!(globalThis as any)[GLOBAL_KEY]) {
    (globalThis as any)[GLOBAL_KEY] = {};
  }
  return (globalThis as any)[GLOBAL_KEY];
}

export function getIntentCatalog(): Record<string, IntentDefinition> {
  return getGlobalCatalog();
}

export function setIntentCatalog(
  catalog: Record<string, IntentDefinition>,
): void {
  (globalThis as any)[GLOBAL_KEY] = { ...catalog };
}

export function addToCatalog(name: string, def: IntentDefinition): void {
  getGlobalCatalog()[name] = def;
}

export function resetCatalog(): void {
  (globalThis as any)[GLOBAL_KEY] = {};
}