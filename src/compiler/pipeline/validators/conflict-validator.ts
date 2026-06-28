// src/compiler/pipeline/validators/conflict-validator.ts

import type { StyleIR, IRRule } from '../ir/types.js';
import type { ValidationPass, ValidationResult, Diagnostic } from '../pipeline-types.js';

export const conflictValidator: ValidationPass = {
  name: 'conflict-validator',
  
  validate(ir: StyleIR): ValidationResult {
    const diagnostics: Diagnostic[] = [];

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      // Check z-index on static elements
      const position = rule.declarations.find(d => d.property === 'position');
      const zIndex = rule.declarations.find(d => d.property === 'zIndex' || d.property === 'z-index');

      if (position && position.value === 'static' && zIndex) {
        diagnostics.push({
          id: `conflict-zindex-${rule.id}`,
          nodeId: rule.id,
          severity: 'warning',
          category: 'css-conflict',
          message: 'z-index has no effect on static positioned elements',
          suggestion: 'Change position to relative, absolute, or fixed',
          autoFixable: false,
        });
      }

      // Check flex properties on non-flex containers
      const display = rule.declarations.find(d => d.property === 'display');
      const flexProps = ['justifyContent', 'alignItems', 'flexDirection', 'flexWrap', 'flexBasis', 'flexGrow', 'flexShrink'];
      const hasFlexProps = rule.declarations.some(d => flexProps.includes(d.property));

      if (hasFlexProps && (!display || (display.value !== 'flex' && display.value !== 'inline-flex'))) {
        diagnostics.push({
          id: `conflict-flex-${rule.id}`,
          nodeId: rule.id,
          severity: 'warning',
          category: 'css-conflict',
          message: 'Flex properties require display: flex or display: inline-flex',
          suggestion: 'Add display: flex to enable flex properties',
          autoFixable: true,
        });
      }

      // Check for conflicting display + position combinations
      if (display && position) {
        if (display.value === 'inline' && ['absolute', 'fixed'].includes(String(position.value))) {
          diagnostics.push({
            id: `conflict-display-${rule.id}`,
            nodeId: rule.id,
            severity: 'warning',
            category: 'css-conflict',
            message: `display: ${display.value} is overridden by position: ${position.value} (computed to block)`,
            suggestion: 'display: inline will be computed as block. Consider using display: inline-block if needed.',
            autoFixable: false,
          });
        }
      }

      // Check grid properties on non-grid containers
      const gridProps = ['gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow', 'gridArea'];
      const hasGridProps = rule.declarations.some(d => gridProps.includes(d.property));

      if (hasGridProps && (!display || (display.value !== 'grid' && display.value !== 'inline-grid'))) {
        diagnostics.push({
          id: `conflict-grid-${rule.id}`,
          nodeId: rule.id,
          severity: 'warning',
          category: 'css-conflict',
          message: 'Grid properties require display: grid or display: inline-grid',
          suggestion: 'Add display: grid to enable grid properties',
          autoFixable: true,
        });
      }
    }

    // Check for duplicate selectors across rules
    const selectorMap = new Map<string, number>();
    for (const rule of ir.rules) {
      if (rule.isDead) continue;
      selectorMap.set(rule.selector, (selectorMap.get(rule.selector) || 0) + 1);
    }
    for (const [selector, count] of selectorMap) {
      if (count > 1) {
        diagnostics.push({
          id: `conflict-duplicate-${selector}`,
          nodeId: ir.rules.find(r => r.selector === selector)!.id,
          severity: 'info',
          category: 'css-conflict',
          message: `Selector "${selector}" appears ${count} times — rules will be merged in cascade order`,
          suggestion: 'Consider consolidating duplicate selectors',
          autoFixable: false,
        });
      }
    }

    const errors = diagnostics.filter(d => d.severity === 'error').length;
    const warnings = diagnostics.filter(d => d.severity === 'warning').length;
    const info = diagnostics.filter(d => d.severity === 'info').length;
    const hints = diagnostics.filter(d => d.severity === 'hint').length;

    return {
      diagnostics,
      passed: errors === 0,
      stats: { errors, warnings, info, hints },
    };
  },
};