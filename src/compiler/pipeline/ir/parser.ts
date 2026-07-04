// src/compiler/pipeline/ir/parser.ts
/** Parse StyleDefinition objects into the IR. */

import type { StyleDefinition } from '../../../core/types.js';
import { createIR, createRule, createDeclaration, nextId, record } from './factory.js';
import type { IRPseudoClass, IRAtRule, IRCondition, StyleIR } from './types.js';

// ============================================================================
// Case Normalization
// ============================================================================

/**
 * Normalize a CSS property name to kebab-case.
 * All properties entering the IR MUST be kebab-case.
 * This is enforced at parse time so no downstream pass needs
 * to check both camelCase and kebab-case variants.
 * 
 * fontSize      → font-size
 * backgroundColor → background-color
 * zIndex        → z-index
 * WebkitAppearance → -webkit-appearance
 */
function normalizeProperty(prop: string): string {
  // Already kebab-case
  if (!/[A-Z]/.test(prop)) return prop;
  
  // Handle vendor prefixes: WebkitAppearance → -webkit-appearance
  if (/^[A-Z]/.test(prop)) {
    return prop.replace(/([A-Z])/g, '-$1').toLowerCase();
}
  
  // Standard camelCase → kebab-case
  return prop.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// ============================================================================
// Parser: StyleDefinition → StyleIR
// ============================================================================

/**
 * Parse a StyleDefinition (or Record<string, any>) into the IR.
 * This is the bridge — existing code produces StyleDefinition,
 * this converts it to typed IR for all downstream passes.
 * 
 * ALL property names are normalized to kebab-case at this entry point.
 * Downstream passes can safely check for a single casing (kebab-case).
 */
export function parseIR(
  styles: Record<string, StyleDefinition> | Record<string, any>,
  sourceFile?: string
): StyleIR {
  const ir = createIR(sourceFile ? [sourceFile] : []);

  for (const [componentName, styleDef] of Object.entries(styles)) {
    if (!styleDef || typeof styleDef !== 'object') continue;

    const selectors = Array.isArray(styleDef.selectors)
      ? styleDef.selectors
      : styleDef.selector
        ? [styleDef.selector]
        : ['.' + componentName];

    for (const selector of selectors) {
      const rule = createRule(selector, {
        file: sourceFile,
        component: componentName,
      });

      // Parse declarations — normalize property to kebab-case
      for (const [prop, value] of Object.entries(styleDef)) {
        // Skip metadata keys
        if (prop === 'selectors' || prop === 'selector' || prop.startsWith('_')) continue;
        // Skip complex sub-objects handled separately
        if (prop === 'atRules' || prop === 'nestedRules' || prop === 'themes') continue;

        // ── Generic &:-prefixed pseudo-classes (hover, focus, active, checked, etc.) ──
        if (prop.startsWith('&:') && typeof value === 'object' && value !== null) {
          const pseudoName = prop.substring(2);
          const pc: IRPseudoClass = {
            id: nextId(pseudoName),
            name: pseudoName,
            declarations: [],
            source: rule.source,
            history: [record('parser', 'created', undefined, `Parsed ${pseudoName} pseudo-class`)],
          };
          for (const [p, v] of Object.entries(value as Record<string, any>)) {
            if (typeof v === 'string' || typeof v === 'number') {
              pc.declarations.push(createDeclaration(normalizeProperty(p), v, rule.source));
            }
          }
          if (pc.declarations.length > 0) {
            rule.pseudoClasses.push(pc);
          }
          continue;
        }

        // ── Legacy `hover` key (non-&: prefixed) ──
        if (prop === 'hover' && typeof value === 'object' && value !== null && !styleDef['&:hover']) {
          const pc: IRPseudoClass = {
            id: nextId('hover'),
            name: 'hover',
            declarations: [],
            source: rule.source,
            history: [record('parser', 'created', undefined, 'Parsed hover block')],
          };
          for (const [p, v] of Object.entries(value as Record<string, any>)) {
            if (typeof v === 'string' || typeof v === 'number') {
              pc.declarations.push(createDeclaration(normalizeProperty(p), v, rule.source));
            }
          }
          if (pc.declarations.length > 0) {
            rule.pseudoClasses.push(pc);
          }
          continue;
        }

        // ── Regular CSS declarations (string or number values) ──
        if (typeof value === 'string' || typeof value === 'number') {
          const normalizedProp = normalizeProperty(prop);
          rule.declarations.push(createDeclaration(normalizedProp, value, rule.source));
        }
      }

      // Parse at-rules — normalize properties
      if ((styleDef.atRules || styleDef._atRules) && Array.isArray(styleDef.atRules || styleDef._atRules)) {
        for (const atRule of (styleDef.atRules || styleDef._atRules)) {
          const irAtRule: IRAtRule = {
            id: nextId('atrule'),
            type: atRule.type || 'media',
            query: atRule.query,
            name: atRule.name,
            declarations: [],
            nestedRules: [],
            source: rule.source,
            history: [record('parser', 'created', undefined, 'Parsed at-rule')],
          };

          if (atRule.styles && typeof atRule.styles === 'object') {
            for (const [prop, value] of Object.entries(atRule.styles)) {
              if (typeof value === 'string' || typeof value === 'number') {
                const normalizedProp = normalizeProperty(prop);
                irAtRule.declarations.push(createDeclaration(normalizedProp, value, rule.source));
              }
            }
          }

          rule.atRules.push(irAtRule);
        }
      }

      // Parse CSS if() conditions — normalize property
      if (styleDef._ifConditions && Array.isArray(styleDef._ifConditions)) {
        for (const cond of styleDef._ifConditions) {
          rule.conditions.push({
            id: nextId('cond'),
            property: normalizeProperty(cond.property),
            variable: cond.variable,
            conditions: cond.conditions || {},
            defaultValue: cond.defaultValue || '',
            source: rule.source,
          });
        }
      }

      ir.rules.push(rule);
    }
  }

  return ir;
}
