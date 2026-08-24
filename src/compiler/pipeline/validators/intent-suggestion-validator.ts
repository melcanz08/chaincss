// ============================================================================
// FILE: src/compiler/pipeline/validators/intent-suggestion-validator.ts
// ============================================================================

import type { StyleIR, IRRule } from "../ir/types.js";
import type {
  ValidationPass,
  ValidationResult,
  Diagnostic,
} from "../pipeline-types.js";
import { getIntentCatalog } from "../intent/intent-catalog.js";
import { applyIntentRelationships } from "../intent/intent-relationships.js";
import type { IntentDefinition } from "../intent/semantic-intent-types.js";

function normalizeProp(prop: string): string {
  return prop.replace(/([A-Z])/g, "-$1").toLowerCase();
}

function getNormalizedDeclMap(rule: IRRule): Map<string, string> {
  const map = new Map<string, string>();
  for (const decl of rule.declarations || []) {
    if (decl?.property) {
      map.set(normalizeProp(decl.property), String(decl.value || ""));
    }
  }
  return map;
}

interface IntentMatch {
  intentName: string;
  intentDef: IntentDefinition;
  matchingProps: string[];
  totalProps: number;
  matchRatio: number;
}

function detectIntentSuggestions(rule: IRRule): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const declMap = getNormalizedDeclMap(rule);
  
  // Get the effective catalog with relationships applied
  const catalog = getIntentCatalog();
  applyIntentRelationships(catalog);
  
  // Get already-used intents from the rule's passMeta
  const usedIntents = (rule.passMeta?.analysis?.semantic?.intents as string[]) || [];

  const matches: IntentMatch[] = [];

  for (const [intentName, intentDef] of Object.entries(catalog)) {
    const props = intentDef.properties || {};
    const propNames = Object.keys(props);
    
    if (propNames.length === 0) continue;
    
    const matchingProps = propNames.filter((prop) => 
      declMap.has(normalizeProp(prop))
    );
    const matchRatio = matchingProps.length / propNames.length;
    
    // If 75% or more of the intent's properties are present, consider it
    if (matchRatio >= 0.75 && matchingProps.length >= 2) {
      matches.push({
        intentName,
        intentDef,
        matchingProps,
        totalProps: propNames.length,
        matchRatio,
      });
    }
  }

  // Sort by priority (higher first), then by match ratio
  matches.sort((a, b) => {
    const priorityA = a.intentDef.priority ?? 0;
    const priorityB = b.intentDef.priority ?? 0;
    if (priorityA !== priorityB) return priorityB - priorityA;
    return b.matchRatio - a.matchRatio;
  });

  // Limit to top 3 suggestions
  const topMatches = matches.slice(0, 3);

  for (const match of topMatches) {
    const isAlreadyUsed = usedIntents.includes(match.intentName);
    
    if (isAlreadyUsed) continue;

    // Check if this suggestion conflicts with a used intent
    const conflictsWith = (match.intentDef.conflicts || []).filter((c) => 
      usedIntents.includes(c)
    );

    if (conflictsWith.length > 0) {
      diagnostics.push({
        id: `intent-conflict-${match.intentName}-${rule.id}`,
        nodeId: rule.id,
        severity: "warning",
        category: "intent-suggestion",
        message: `"${rule.selector}" uses properties matching "${match.intentName}" but this conflicts with "${conflictsWith.join(', ')}".`,
        suggestion: `Remove the conflicting intent or remove these properties.`,
        autoFixable: false,
      });
      continue;
    }

    // Check for missing requirements
    const missingRequirements = (match.intentDef.requires || []).filter((r) => 
      !usedIntents.includes(r)
    );

    // Check for enhancements
    const enhancements = (match.intentDef.enhances || []).filter((e) => 
      !usedIntents.includes(e)
    );

    let suggestion = `Use .intents(['${match.intentName}']) instead of writing ${match.matchingProps.length} properties manually.`;
    if (match.intentDef.description) {
      suggestion += ` ${match.intentDef.description}.`;
    }
    if (missingRequirements.length > 0) {
      suggestion += ` Note: This intent requires: ${missingRequirements.map(r => `'${r}'`).join(', ')}.`;
    }
    if (enhancements.length > 0) {
      suggestion += ` Consider also adding: ${enhancements.slice(0, 2).map(e => `'${e}'`).join(', ')}.`;
    }

    diagnostics.push({
      id: `intent-suggest-${match.intentName}-${rule.id}`,
      nodeId: rule.id,
      severity: "hint",
      category: "intent-suggestion",
      message: `"${rule.selector}" uses ${match.matchingProps.length}/${match.totalProps} properties from the "${match.intentName}" intent (priority: ${match.intentDef.priority ?? 0}).`,
      suggestion: suggestion.trim(),
      autoFixable: false,
    });
  }

  return diagnostics;
}

export const intentSuggestionValidator: ValidationPass = {
  name: "intent-suggestion-validator",

  validate(ir: StyleIR): ValidationResult {
    const diagnostics: Diagnostic[] = [];

    if (!ir || !ir.rules) {
      return {
        diagnostics: [],
        passed: true,
        stats: { errors: 0, warnings: 0, info: 0, hints: 0 },
      };
    }

    for (const rule of ir.rules) {
      if (rule.isDead) continue;
      diagnostics.push(...detectIntentSuggestions(rule));
    }

    const errors = diagnostics.filter((d) => d.severity === "error").length;
    const warnings = diagnostics.filter((d) => d.severity === "warning").length;
    const info = diagnostics.filter((d) => d.severity === "info").length;
    const hints = diagnostics.filter((d) => d.severity === "hint").length;

    return {
      diagnostics,
      passed: errors === 0,
      stats: { errors, warnings, info, hints },
    };
  },
};