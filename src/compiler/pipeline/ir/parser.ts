// src/compiler/pipeline/ir/parser.ts
/** Parse StyleDefinition objects into the IR. */

import type { StyleDefinition } from '../../../core/types.js';
import { createIR, createRule, createDeclaration, nextId, record } from './factory.js';
import type { IRPseudoClass, IRAtRule, IRCondition, StyleIR } from './types.js';

// ============================================================================
// Parser: StyleDefinition → StyleIR
// ============================================================================

/**
 * Parse a StyleDefinition (or Record<string, any>) into the IR.
 * This is the bridge — existing code produces StyleDefinition,
 * this converts it to typed IR for all downstream passes.
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

      // Parse declarations
      for (const [prop, value] of Object.entries(styleDef)) {
        // Skip metadata
        if (prop === 'selectors' || prop === 'selector' || prop.startsWith('_')) continue;
        // Skip complex sub-objects (handled separately)
        if (prop === 'hover' || prop === 'atRules' || prop === 'nestedRules' || prop === 'themes') continue;

        if (typeof value === 'string' || typeof value === 'number') {
          rule.declarations.push(createDeclaration(prop, value, rule.source));
        }
      }

      // Parse hover pseudo-class
            const hoverStyles = styleDef.hover || styleDef['&:hover'];
      if (hoverStyles && typeof hoverStyles === 'object') {
        const pc: IRPseudoClass = {
          id: nextId('hover'),
          name: 'hover',
          declarations: [],
          source: rule.source,
          history: [record('parser', 'created', undefined, 'Parsed hover block')],
        };
        for (const [prop, value] of Object.entries(hoverStyles)) {
          if (typeof value === 'string' || typeof value === 'number') {
            pc.declarations.push(createDeclaration(prop, value, rule.source));
          }
        }
        rule.pseudoClasses.push(pc);
      }

      // Parse at-rules
      if (styleDef.atRules && Array.isArray(styleDef.atRules)) {
        for (const atRule of styleDef.atRules) {
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
                irAtRule.declarations.push(createDeclaration(prop, value, rule.source));
              }
            }
          }

          rule.atRules.push(irAtRule);
        }
      }

      // Parse CSS if() conditions
      if (styleDef._ifConditions && Array.isArray(styleDef._ifConditions)) {
        for (const cond of styleDef._ifConditions) {
          rule.conditions.push({
            id: nextId('cond'),
            property: cond.property,
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
