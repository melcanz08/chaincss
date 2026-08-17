// ============================================================================
// FILE: src/compiler/pipeline/intent/intent-validator.ts (FINAL FIXED)
// ============================================================================

import type {
  IntentDefinition,
  IntentCombinationResult,
  IntentRelation,
} from "./semantic-intent-types.js";
import { getIntentCatalog } from "./intent-catalog.js";
import { INTENT_RELATIONSHIPS } from "./intent-relationships.js";

// ============================================================================
// Helper: Get effective catalog (base + relationships)
// ============================================================================

function getEffectiveCatalog(): Record<string, IntentDefinition> {
  const baseCatalog = getIntentCatalog();
  const effective: Record<string, IntentDefinition> = { ...baseCatalog };

  // Apply relationships directly
  for (const [intentName, relationships] of Object.entries(INTENT_RELATIONSHIPS)) {
    if (effective[intentName]) {
      effective[intentName] = {
        ...effective[intentName],
        ...relationships,
      };
    } else {
      // Create minimal intent if it doesn't exist in base catalog
      effective[intentName] = {
        name: intentName,
        category: "custom",
        description: `Intent: ${intentName}`,
        ...relationships,
      };
    }
  }

  return effective;
}

// ============================================================================
// Main Validation Function
// ============================================================================

export function validateIntentCombination(
  intentNames: string[],
  options?: {
    autoResolve?: boolean;
    strict?: boolean;
    suggestEnhancements?: boolean;
  },
): IntentCombinationResult {
  const catalog = getEffectiveCatalog();
  const warnings: string[] = [];
  const errors: string[] = [];
  const suggestions: string[] = [];
  const resolved = new Set<string>(intentNames);
  const visited = new Set<string>();

  // 1. Auto-add required intents
  if (options?.autoResolve !== false) {
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (changed && iterations < MAX_ITERATIONS) {
      changed = false;
      iterations++;

      const currentIntents = Array.from(resolved);
      for (const intentName of currentIntents) {
        const intent = catalog[intentName];
        if (!intent?.requires || visited.has(intentName)) continue;

        visited.add(intentName);
        for (const required of intent.requires) {
          if (!resolved.has(required)) {
            resolved.add(required);
            changed = true;
            warnings.push(
              `Auto-added required intent: "${required}" (required by "${intentName}")`,
            );
          }
        }
      }
    }
  }

  // 2. Check for conflicts
  const intentArray = Array.from(resolved);
  for (let i = 0; i < intentArray.length; i++) {
    const intentA = catalog[intentArray[i]];
    if (!intentA?.conflicts) continue;

    for (let j = i + 1; j < intentArray.length; j++) {
      const intentB = intentArray[j];
      if (intentA.conflicts.includes(intentB)) {
        errors.push(
          `Conflict: "${intentArray[i]}" conflicts with "${intentB}"`,
        );
      }
    }
  }

  // 3. Check max combinations
  for (const intentName of intentArray) {
    const intent = catalog[intentName];
    if (intent?.maxCombinations && intentArray.length > intent.maxCombinations) {
      errors.push(
        `Too many intents: "${intentName}" allows max ${intent.maxCombinations}, got ${intentArray.length}`,
      );
    }
  }

  // 4. Collect enhancement suggestions
  if (options?.suggestEnhancements !== false) {
    for (const intentName of intentArray) {
      const intent = catalog[intentName];
      if (!intent?.enhances) continue;

      for (const enhancement of intent.enhances) {
        if (!resolved.has(enhancement) && !suggestions.includes(enhancement)) {
          suggestions.push(enhancement);
        }
      }
    }
  }

  // 5. Check for unknown intents
  for (const intentName of intentArray) {
    if (!catalog[intentName]) {
      warnings.push(`Unknown intent: "${intentName}"`);
    }
  }

  return {
    valid: errors.length === 0,
    resolvedIntents: intentArray,
    warnings,
    errors,
    suggestions,
  };
}

// ============================================================================
// Compatibility Checking
// ============================================================================

export function areIntentsCompatible(
  intentA: string,
  intentB: string,
): boolean {
  const catalog = getEffectiveCatalog();
  
  // Direct conflict check
  const intentADef = catalog[intentA];
  if (intentADef?.conflicts?.includes(intentB)) return false;
  
  const intentBDef = catalog[intentB];
  if (intentBDef?.conflicts?.includes(intentA)) return false;
  
  return true;
}

export function getCompatibleIntents(intentName: string): string[] {
  const catalog = getEffectiveCatalog();
  const compatible: string[] = [];

  for (const otherName of Object.keys(catalog)) {
    if (otherName === intentName) continue;
    if (areIntentsCompatible(intentName, otherName)) {
      compatible.push(otherName);
    }
  }

  return compatible;
}

export function getConflictingIntents(intentName: string): string[] {
  return INTENT_RELATIONSHIPS[intentName]?.conflicts || [];
}

export function getRequiredIntents(intentName: string): string[] {
  return INTENT_RELATIONSHIPS[intentName]?.requires || [];
}

export function getEnhancementSuggestions(intentName: string): string[] {
  return INTENT_RELATIONSHIPS[intentName]?.enhances || [];
}

// ============================================================================
// Relationship Graph Building
// ============================================================================

export function buildIntentRelationshipGraph(): Map<string, IntentRelation[]> {
  const catalog = getEffectiveCatalog();
  const graph = new Map<string, IntentRelation[]>();

  for (const [intentName, intent] of Object.entries(catalog)) {
    const relations: IntentRelation[] = [];

    if (intent.requires) {
      for (const required of intent.requires) {
        relations.push({
          source: intentName,
          target: required,
          type: "requires",
        });
      }
    }

    if (intent.conflicts) {
      for (const conflict of intent.conflicts) {
        relations.push({
          source: intentName,
          target: conflict,
          type: "conflicts",
        });
      }
    }

    if (intent.enhances) {
      for (const enhancement of intent.enhances) {
        relations.push({
          source: intentName,
          target: enhancement,
          type: "enhances",
        });
      }
    }

    if (relations.length > 0) {
      graph.set(intentName, relations);
    }
  }

  return graph;
}