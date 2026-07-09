// src/compiler/pipeline/optimizers/atomic-extractor.ts
//
// Atomic CSS Extractor — identifies frequently-used property:value pairs
// and extracts them into reusable utility classes.
//
// Phase 1: Detect — count usage of every property:value pair
// Phase 2: Extract — create utility rules for pairs used 3+ times
// Phase 3: Replace — swap original declarations for utility class references

import { recordHistory } from '../ir/utils.js';
import { createRule, createDeclaration } from '../ir/factory.js';

import type { StyleIR, IRRule } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

let diagnosticCounter = 0;

export const atomicExtractor: OptimizationPass = {
  name: 'atomic-extractor',
  cost: 'moderate',
  requiredFor: ['atomic-css'],

  optimize(ir: StyleIR): OptimizationResult {
    // ── Phase 1: Count usage of every property:value pair ──
    const usageMap = new Map<string, { count: number; property: string; value: string | number }>();

    for (const rule of ir.rules) {
      if (rule.isDead) continue;
      // Include pseudo + media scope to prevent base/hover specificity clashes
      const scope = [
        rule.meta?.pseudo || 'root',
        rule.meta?.mediaQuery || 'all'
      ].join('::');
      for (const decl of rule.declarations) {
        const key = scope + '::' + decl.property + ':' + String(decl.value);
        const existing = usageMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          usageMap.set(key, {
            count: 1,
            property: decl.property,
            value: decl.value,
          });
        }
      }
    }

    // ── Phase 2: Create utility rules for pairs used 3+ times ──
    const atomicRules: IRRule[] = [];
    const atomicClassMap = new Map<string, string>(); // key → class name

    for (const [key, data] of usageMap) {
      if (data.count < 3) continue;

      // Generate a readable class name
      const className = generateAtomicClassName(data.property, data.value);
      atomicClassMap.set(key, className);

      // Create the utility rule
      const atomicRule = createRule('.' + className);
      atomicRule.declarations.push(
        createDeclaration(data.property, data.value, undefined, {
          atomic: true,
          usageCount: data.count,
          atomicSource: 'extracted',
        })
      );
      atomicRule.meta.atomic = true;
      atomicRule.meta.usageCount = data.count;
      atomicRule.history.push({
        pass: 'atomic-extractor',
        action: 'extracted',
        timestamp: Date.now(),
        reason: `Extracted from ${data.count} usages of "${key}"`,
      });

      atomicRules.push(atomicRule);
    }

    // ── Phase 3: Replace original declarations with utility class references ──
    let declarationsReplaced = 0;
    let bytesSaved = 0;

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      const atomicClasses: string[] = [];

      // Filter out declarations that have been extracted to atomic classes
      rule.declarations = rule.declarations.filter(decl => {
        const scope = [
          rule.meta?.pseudo || 'root',
          rule.meta?.mediaQuery || 'all'
        ].join('::');
        const key = scope + '::' + decl.property + ':' + String(decl.value);
        const className = atomicClassMap.get(key);

        if (className) {
          // This declaration is now an atomic utility class
          atomicClasses.push(className);
          declarationsReplaced++;

          // Estimate bytes saved: original declaration (~30 bytes) minus class name (~10 bytes)
          bytesSaved += 20;

          recordHistory(
            decl,
            'atomic-extractor',
            'extracted-to-atomic',
            key,
            `Moved to atomic class .${className}`
          );

          return false; // Remove from declarations
        }
        return true; // Keep unique declarations
      });

      // Add atomic class references to the rule's selector
      if (atomicClasses.length > 0) {
        // Store atomic classes as metadata for the CSS printer
        rule.meta.atomicClasses = atomicClasses;
        rule.meta.atomicCount = atomicClasses.length;

        // Record the transformation
        rule.history.push({
          pass: 'atomic-extractor',
          action: 'atomic-replace',
          timestamp: Date.now(),
          reason: `Replaced ${declarationsReplaced} declarations with ${atomicClasses.length} atomic classes in "${rule.selector}"`,
        });
      }
    }

    // ── Phase 4: Add atomic utility rules to the IR ──
    // Place them at the beginning so component rules can override if needed
    ir.rules = [...atomicRules, ...ir.rules];

    // ── Diagnostics ──
    if (atomicRules.length > 0) {
      ir.diagnostics.push({
        id: 'atomic-extract-' + (++diagnosticCounter),
        nodeId: ir.id,
        severity: 'info',
        message: `Extracted ${atomicRules.length} atomic utility classes from ${declarationsReplaced} repeated declarations`,
        suggestion: `${bytesSaved} bytes estimated savings`,
        pass: 'atomic-extractor',
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: declarationsReplaced,
        bytesSaved,
      },
      changes: atomicRules.length + declarationsReplaced,
    };
  },
};

// ============================================================================
// Utility class name generator
// ============================================================================

/**
 * Generate a readable atomic class name from property + value.
 * Examples:
 *   display:flex → flex
 *   color:#ffffff → color-white (hex shortened)
 *   fontSize:16px → text-16
 *   padding:8px → p-8
 *   borderRadius:8px → rounded-8
 */
function generateAtomicClassName(property: string, value: string | number): string {
  const val = String(value);

  // Property-specific abbreviations
  const abbreviations: Record<string, string> = {
    'display': '',
    'position': '',
    'color': 'color-',
    'backgroundColor': 'bg-',
    'fontSize': 'text-',
    'fontWeight': 'font-',
    'padding': 'p-',
    'paddingTop': 'pt-',
    'paddingRight': 'pr-',
    'paddingBottom': 'pb-',
    'paddingLeft': 'pl-',
    'margin': 'm-',
    'marginTop': 'mt-',
    'marginRight': 'mr-',
    'marginBottom': 'mb-',
    'marginLeft': 'ml-',
    'width': 'w-',
    'height': 'h-',
    'borderRadius': 'rounded-',
    'border': 'border-',
    'opacity': 'opacity-',
    'zIndex': 'z-',
    'cursor': 'cursor-',
    'overflow': 'overflow-',
    'textAlign': 'text-',
    'justifyContent': 'justify-',
    'alignItems': 'items-',
    'gap': 'gap-',
    'boxShadow': 'shadow-',
    'transition': 'transition-',
    'flexDirection': 'flex-',
  };

  const prefix = abbreviations[property] || property + '-';

  // Clean up the value for a class name
  let cleanValue = val
    .replace(/^#/, '')           // Remove # from hex colors
    .replace(/[^a-zA-Z0-9-]/g, '-') // Replace special chars with -
    .replace(/-+/g, '-')         // Collapse multiple dashes
    .replace(/^-|-$/g, '')       // Remove leading/trailing dashes
    .toLowerCase();

  // Special case: display values don't need a prefix
  if (property === 'display') {
    return cleanValue; // e.g., "flex", "grid", "block"
  }

  // Special case: position values don't need a prefix
  if (property === 'position') {
    return cleanValue; // e.g., "relative", "absolute", "fixed"
  }

  return prefix + cleanValue;
}