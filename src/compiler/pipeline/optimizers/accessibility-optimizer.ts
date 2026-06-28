// src/compiler/pipeline/optimizers/accessibility-optimizer.ts

import { recordHistory } from '../ir/utils.js';

import type { StyleIR } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';
import { createDeclaration } from '../ir/factory.js';

const WCAG = {
  MIN_FONT_SIZE: 12,
  MIN_TOUCH_TARGET: 44,
};

function extractPx(value: string): number {
  const match = value.match(/^(\d+(\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : Infinity;
}

/**
 * Check if a rule already has adequate touch target sizing.
 * Looks for min-width/min-height >= 44px OR explicit width/height >= 44px.
 */
function hasAdequateTouchTarget(rule: any): { width: boolean; height: boolean } {
  const checkProp = (props: string[]) => {
    for (const decl of rule.declarations) {
      const propName = decl.property;
      if (props.includes(propName) && extractPx(String(decl.value)) >= WCAG.MIN_TOUCH_TARGET) {
        return true;
      }
    }
    return false;
  };

  return {
    width: checkProp(['min-width', 'minWidth', 'width']),
    height: checkProp(['min-height', 'minHeight', 'height']),
  };
}

/**
 * Check if the rule is a small inline element that would be visually
 * distorted by forced min-width/min-height (e.g., icons, breadcrumbs, badges).
 */
function isSmallElement(rule: any): boolean {
  const selector = rule.selector.toLowerCase();
  const smallPatterns = [
    'icon', 'close', 'x-btn', 'badge', 'tag', 'chip',
    'breadcrumb', 'crumb', 'arrow', 'dot', 'indicator',
    'avatar-xs', 'avatar-sm',
  ];
  
  // Check selector patterns
  if (smallPatterns.some(p => selector.includes(p))) return true;

  // Check if element has explicit small dimensions
  for (const decl of rule.declarations) {
    if ((decl.property === 'width' || decl.property === 'height') &&
        typeof decl.value === 'string') {
      const px = extractPx(decl.value);
      if (px > 0 && px < 30) return true;
    }
    if ((decl.property === 'fontSize' || decl.property === 'font-size') &&
        typeof decl.value === 'string') {
      const px = extractPx(decl.value);
      if (px > 0 && px < 14) return true;
    }
  }

  return false;
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
            recordHistory(decl, 'accessibility-optimizer', 'auto-fix-min-font', undefined, `Ensured minimum font size of ${WCAG.MIN_FONT_SIZE}px`);
            changes++;
          }
        }
      }

      // Auto-fix touch targets on interactive elements
      const isInteractive = rule.declarations.some(d => d.property === 'cursor' && d.value === 'pointer');
      const isButton = rule.selector.includes('btn') || rule.selector.includes('button');

      if (isInteractive || isButton) {
        const small = isSmallElement(rule);
        const targets = hasAdequateTouchTarget(rule);

        if (small) {
          // Small elements: use invisible ::after pseudo-element to expand touch area
          // without distorting visual layout
          if (!targets.width || !targets.height) {
            const existingAfter = rule.pseudoClasses.find(pc => pc.name === 'after' &&
              pc.declarations.some(d => d.meta?.a11yTouchTarget));

            if (!existingAfter) {
              const afterDecls = [
                createDeclaration('content', '""', rule.source, { a11yTouchTarget: true }),
                createDeclaration('position', 'absolute', rule.source, { a11yTouchTarget: true }),
                createDeclaration('top', '-4px', rule.source, { a11yTouchTarget: true }),
                createDeclaration('left', '-4px', rule.source, { a11yTouchTarget: true }),
                createDeclaration('width', `${WCAG.MIN_TOUCH_TARGET}px`, rule.source, { a11yTouchTarget: true }),
                createDeclaration('height', `${WCAG.MIN_TOUCH_TARGET}px`, rule.source, { a11yTouchTarget: true }),
              ];

              rule.pseudoClasses.push({
                id: `a11y-touch-${rule.id}`,
                name: 'after',
                declarations: afterDecls,
                source: rule.source,
                history: [{
                  pass: 'accessibility-optimizer',
                  action: 'auto-fix-touch-target',
                  timestamp: Date.now(),
                  reason: `Added invisible ::after pseudo-element for ${WCAG.MIN_TOUCH_TARGET}px touch target (element too small for min-width/min-height)`,
                }],
              });

              // Ensure parent has position: relative for the absolute ::after
              const hasPosition = rule.declarations.some(d =>
                d.property === 'position' && ['relative', 'absolute', 'fixed', 'sticky'].includes(String(d.value))
              );
              if (!hasPosition) {
                rule.declarations.push(
                  createDeclaration('position', 'relative', rule.source, { a11yTouchTarget: true })
                );
              }

              changes++;
            }
          }
        } else {
          // Normal-sized elements: use min-width/min-height (safe, won't distort)
          if (!targets.width) {
            rule.declarations.push(
              createDeclaration('min-width', `${WCAG.MIN_TOUCH_TARGET}px`, rule.source, { a11y: true })
            );
            changes++;
          }
          if (!targets.height) {
            rule.declarations.push(
              createDeclaration('min-height', `${WCAG.MIN_TOUCH_TARGET}px`, rule.source, { a11y: true })
            );
            changes++;
          }
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
