// ============================================================================
// FILE: src/compiler/pipeline/optimizers/accessibility-optimizer.ts
// ============================================================================

import { recordHistory } from '../ir/utils.js';
import { createDeclaration } from '../ir/factory.js';
import type { StyleIR, IRRule } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

const WCAG = {
  MIN_FONT_SIZE: 12,
  MIN_TOUCH_TARGET: 44,
};

function extractPx(value: string): number {
  const match = value.match(/^(\d+(\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : Infinity;
}

function hasAdequateTouchTarget(rule: IRRule): { width: boolean; height: boolean } {
  const declarations = rule.declarations || [];
  const checkProp = (props: string[]) => {
    for (const decl of declarations) {
      if (props.includes(decl.property) && extractPx(String(decl.value)) >= WCAG.MIN_TOUCH_TARGET) {
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

function isSmallElement(rule: IRRule): boolean {
  if (!rule.selector) return false;
  const selector = rule.selector.toLowerCase();
  const smallPatterns = [
    'icon', 'close', 'x-btn', 'badge', 'tag', 'chip',
    'breadcrumb', 'crumb', 'arrow', 'dot', 'indicator',
    'avatar-xs', 'avatar-sm',
  ];
  
  if (smallPatterns.some(p => selector.includes(p))) return true;

  const declarations = rule.declarations || [];
  for (const decl of declarations) {
    const prop = decl.property;
    if ((prop === 'width' || prop === 'height') && typeof decl.value === 'string') {
      const px = extractPx(decl.value);
      if (px > 0 && px < 30) return true;
    }
    if ((prop === 'fontSize' || prop === 'font-size') && typeof decl.value === 'string') {
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

    if (!ir || !ir.rules) {
      return { ir, savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 }, changes: 0 };
    }

    for (const rule of ir.rules) {
      if (rule.isDead || !rule.declarations) continue;

      // Ensure pseudoClasses array structure exists safely
      if (!rule.pseudoClasses) {
        rule.pseudoClasses = [];
      }

      // 1. Auto-fix font sizes safely using CSS max() fallback structures
      for (const decl of rule.declarations) {
        if ((decl.property === 'fontSize' || decl.property === 'font-size') && typeof decl.value === 'string') {
          const pxMatch = decl.value.match(/^(\d+(\.\d+)?)px$/);
          if (pxMatch && parseFloat(pxMatch[1]) < WCAG.MIN_FONT_SIZE) {
            const originalValue = decl.value;
            decl.value = `max(${WCAG.MIN_FONT_SIZE}px, ${originalValue})`;
            recordHistory(decl as any, 'accessibility-optimizer', 'auto-fix-min-font', undefined, `Ensured minimum font size of ${WCAG.MIN_FONT_SIZE}px`);
            changes++;
          }
        }
      }

      // 2. Touch target parsing infrastructure validation
      const isInteractive = rule.declarations.some(d => d.property === 'cursor' && d.value === 'pointer');
      const isButton = rule.selector && /(\bbutton\b|\[role=["']button["']\]|btn)/i.test(rule.selector);

      if (isInteractive || isButton) {
        const small = isSmallElement(rule);
        const targets = hasAdequateTouchTarget(rule);

        if (small) {
          if (!targets.width || !targets.height) {
            const existingAfter = rule.pseudoClasses.find(pc => pc.name === 'after' &&
              pc.declarations?.some(d => d.meta?.a11yTouchTarget));

            if (!existingAfter) {
              // Centered dynamic hit-box enlargement structure to avoid small bounds skewing
              const afterDecls = [
                createDeclaration('content', '""', rule.source, { a11yTouchTarget: true }),
                createDeclaration('position', 'absolute', rule.source, { a11yTouchTarget: true }),
                createDeclaration('top', '50%', rule.source, { a11yTouchTarget: true }),
                createDeclaration('left', '50%', rule.source, { a11yTouchTarget: true }),
                createDeclaration('minWidth', `${WCAG.MIN_TOUCH_TARGET}px`, rule.source, { a11yTouchTarget: true }),
                createDeclaration('minHeight', `${WCAG.MIN_TOUCH_TARGET}px`, rule.source, { a11yTouchTarget: true }),
                createDeclaration('transform', 'translate(-50%, -50%)', rule.source, { a11yTouchTarget: true }),
              ];

              rule.pseudoClasses.push({
                id: `a11y-touch-${rule.id}`,
                name: 'after',
                parentId: rule.id,
                declarations: afterDecls,
                source: rule.source,
                history: [{
                  pass: 'accessibility-optimizer',
                  action: 'auto-fix-touch-target',
                  timestamp: Date.now(),
                  reason: `Added center-aligned absolute ::after pseudo-element for reliable ${WCAG.MIN_TOUCH_TARGET}px touch scaling`,
                }],
              });

              // Guarantee relative bounding context mapping on host layer
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
          // Standard structural layouts get safe min boundaries
          if (!targets.width) {
            rule.declarations.push(createDeclaration('min-width', `${WCAG.MIN_TOUCH_TARGET}px`, rule.source, { a11y: true }));
            changes++;
          }
          if (!targets.height) {
            rule.declarations.push(createDeclaration('min-height', `${WCAG.MIN_TOUCH_TARGET}px`, rule.source, { a11y: true }));
            changes++;
          }
        }
      }

      // 3. Robust validation of missing focus rings (catches none, 0, transparent, outline-style)
      const explicitlyStripsOutline = rule.declarations.some(d => 
        (d.property === 'outline' && ['none', '0', 'transparent'].includes(String(d.value).trim())) ||
        (d.property === 'outline-style' && String(d.value).trim() === 'none')
      );

      const hasFocusStyle = rule.pseudoClasses.some(pc =>
        (pc.name === 'focus' || pc.name === 'focus-visible') && pc.declarations && pc.declarations.length > 0
      );

      if (explicitlyStripsOutline && !hasFocusStyle) {
        rule.pseudoClasses.push({
          id: `a11y-focus-${rule.id}`,
          name: 'focus-visible',
          parentId: rule.id,
          // Utilizes currentcolor fallback mapping to stay highly context-agnostic and accessible
          declarations: [
            createDeclaration('outline', '2px dashed currentColor', rule.source),
            createDeclaration('outlineOffset', '2px', rule.source),
          ],
          source: rule.source,
          history: [{
            pass: 'accessibility-optimizer',
            action: 'auto-fix-focus',
            timestamp: Date.now(),
            reason: 'Injected adaptive currentColor dashed ring into :focus-visible scope to replace stripped outline',
          }],
        });
        changes++;
      }
    }

    return {
      ir,
      savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 },
      changes,
    };
  },
};