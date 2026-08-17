// ============================================================================
// FILE: src/compiler/pipeline/intent/intent-composer.ts
// Phase 3: Intent Composition Patterns
// ============================================================================

import { getIntentCatalog } from "./intent-catalog.js";
import type { IntentDefinition } from "./semantic-intent-types.js";

export interface CompositionResult {
  /** Final list of intents after composition */
  intents: string[];
  /** Arguments for each intent */
  args: Record<string, Record<string, unknown>>;
  /** Warnings from composition */
  warnings: string[];
  /** Whether any conditions were triggered */
  conditionsTriggered: Array<{
    when: Record<string, any>;
    added: string[];
    removed: string[];
  }>;
}

export interface CompositionContext {
  theme?: string;
  variant?: string;
  config?: Record<string, any>;
  [key: string]: any;
}

/**
 * Check if a condition matches the current context
 */
function conditionMatches(
  when: Record<string, any>,
  context: CompositionContext,
): boolean {
  return Object.entries(when).every(([key, value]) => {
    return context[key] === value;
  });
}

/**
 * Resolve composition patterns for an intent
 */
export function resolveComposition(
  intentName: string,
  context: CompositionContext = {},
  visited: Set<string> = new Set(),
): CompositionResult {
  const catalog = getIntentCatalog();
  const intent = catalog[intentName];
  
  if (!intent) {
    return {
      intents: [intentName],
      args: {},
      warnings: [`Unknown intent: "${intentName}"`],
      conditionsTriggered: [],
    };
  }
  
  if (visited.has(intentName)) {
    return {
      intents: [],
      args: {},
      warnings: [`Circular composition detected: "${intentName}"`],
      conditionsTriggered: [],
    };
  }
  
  visited.add(intentName);
  
  const intents: string[] = [intentName];
  const args: Record<string, Record<string, unknown>> = {};
  const warnings: string[] = [];
  const conditionsTriggered: CompositionResult["conditionsTriggered"] = [];
  
  // Process compose patterns
  if (intent.compose && intent.compose.length > 0) {
    for (const item of intent.compose) {
      if (!intents.includes(item.intent)) {
        intents.push(item.intent);
      }
      if (item.args) {
        args[item.intent] = item.args;
      }
    }
  }
  
  // Process conditions
  if (intent.conditions && intent.conditions.length > 0) {
    for (const condition of intent.conditions) {
      if (conditionMatches(condition.when, context)) {
        const added: string[] = [];
        const removed: string[] = [];
        
        // Add intents
        for (const addName of condition.add || []) {
          if (!intents.includes(addName)) {
            intents.push(addName);
            added.push(addName);
          }
        }
        
        // Remove intents
        for (const removeName of condition.remove || []) {
          const index = intents.indexOf(removeName);
          if (index !== -1) {
            intents.splice(index, 1);
            removed.push(removeName);
          }
        }
        
        conditionsTriggered.push({
          when: condition.when,
          added,
          removed,
        });
      }
    }
  }
  
  return { intents, args, warnings, conditionsTriggered };
}

/**
 * Recursively resolve composition for multiple intents
 */
export function resolveCompositions(
  intentNames: string[],
  context: CompositionContext = {},
): CompositionResult {
  const allIntents: string[] = [];
  const allArgs: Record<string, Record<string, unknown>> = {};
  const allWarnings: string[] = [];
  const allConditions: CompositionResult["conditionsTriggered"] = [];
  const visited = new Set<string>();
  
  for (const name of intentNames) {
    const result = resolveComposition(name, context, visited);
    for (const intent of result.intents) {
      if (!allIntents.includes(intent)) {
        allIntents.push(intent);
      }
    }
    Object.assign(allArgs, result.args);
    allWarnings.push(...result.warnings);
    allConditions.push(...result.conditionsTriggered);
  }
  
  return {
    intents: allIntents,
    args: allArgs,
    warnings: allWarnings,
    conditionsTriggered: allConditions,
  };
}