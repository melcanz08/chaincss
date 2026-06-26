// src/compiler/pipeline/optimizers/accessibility-optimizer.ts

import type { StyleIR } from '../../style-ir.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';
import { createDeclaration } from '../../style-ir.js';

const WCAG = {
  MIN_FONT_SIZE: 12,
  MIN_TOUCH_TARGET: 44,
};

function extractPx(value: string): number {
  const match = value.match(/^(\d+(\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : Infinity;
}

export const accessibilityOptimizer: OptimizationPass = {
  name: 'accessibility-optimizer',
  cost: 'cheap',
  requiredFor: ['css', 'atomic-css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      // Auto-fix font sizes that are too small
      for (const decl of rule.declarations) {
        if ((decl.property === 'fontSize' || decl.property === 'font-size') && typeof decl.value === 'string') {
          const pxMatch = decl.value.match(/^(\d+(\.\d+)?)px$/);
          if (pxMatch && parseFloat(pxMatch[1]) < WCAG.MIN_FONT_SIZE) {
            decl.value = `max(${WCAG.MIN_FONT_SIZE}px, ${decl.value})`;
            decl.history.push({
              pass: 'accessibility-optimizer',
              action: 'auto-fix-min-font',
              timestamp: Date.now(),
              reason: `Ensured minimum font size of ${WCAG.MIN_FONT_SIZE}px`,
            });
            changes++;
          }
        }
      }

      // Auto-fix touch targets on interactive elements
      const isInteractive = rule.declarations.some(d => d.property === 'cursor' && d.value === 'pointer');
      const isButton = rule.selector.includes('btn') || rule.selector.includes('button');
      
      if (isInteractive || isButton) {
        const hasMinWidth = rule.declarations.some(d => 
          (d.property === 'min-width' || d.property === 'minWidth') && 
          extractPx(String(d.value)) >= WCAG.MIN_TOUCH_TARGET
        );
        const hasMinHeight = rule.declarations.some(d => 
          (d.property === 'min-height' || d.property === 'minHeight') && 
          extractPx(String(d.value)) >= WCAG.MIN_TOUCH_TARGET
        );

        if (!hasMinWidth) {
          rule.declarations.push(
            createDeclaration('min-width', `${WCAG.MIN_TOUCH_TARGET}px`, rule.source, { a11y: true })
          );
          changes++;
        }
        if (!hasMinHeight) {
          rule.declarations.push(
            createDeclaration('min-height', `${WCAG.MIN_TOUCH_TARGET}px`, rule.source, { a11y: true })
          );
          changes++;
        }
      }

      // Auto-fix missing focus indicators
      const outline = rule.declarations.find(d => d.property === 'outline');
      const hasFocusStyle = rule.pseudoClasses.some(pc => 
        (pc.name === 'focus' || pc.name === 'focus-visible') && pc.declarations.length > 0
      );

      if (outline && String(outline.value) === 'none' && !hasFocusStyle) {
        rule.pseudoClasses.push({
          id: `a11y-focus-${rule.id}`,
          name: 'focus-visible',
          declarations: [
            createDeclaration('outline', '2px solid #3b82f6', rule.source),
            createDeclaration('outlineOffset', '2px', rule.source),
          ],
          source: rule.source,
          history: [{
            pass: 'accessibility-optimizer',
            action: 'auto-fix-focus',
            timestamp: Date.now(),
            reason: 'Added visible focus indicator for keyboard accessibility',
          }],
        });
        changes++;
      }
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: 0,
        bytesSaved: 0,
      },
      changes,
    };
  },
};