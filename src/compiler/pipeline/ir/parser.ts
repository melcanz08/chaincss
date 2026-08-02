// ============================================================================
// FILE: src/compiler/pipeline/ir/parser.ts
// ============================================================================

import type { StyleDefinition } from '@shared/types/index.js';
import { createIR, createRule, createDeclaration, nextId, record } from './index.js';
import type { IRPseudoClass, IRAtRule, IRCondition, StyleIR, IRRule, IRKeyframeFrame } from './types.js';

// ============================================================================
// Case Normalization
// ============================================================================

/**
 * Normalize a CSS property name to kebab-case.
 * Enforced at parse time so downstream passes don't handle duplicate cases.
 */
function normalizeProperty(prop: string): string {
  if (!/[A-Z]/.test(prop)) return prop;
  
  const needsLeadingDash = /^[A-Z]/.test(prop) || /^ms[A-Z]/.test(prop);
  const kebabed = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
  
  return needsLeadingDash ? (kebabed.startsWith('-') ? kebabed : '-' + kebabed) : kebabed;
}

// ============================================================================
// Parser: StyleDefinition → StyleIR
// ============================================================================

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

    // Track rules explicitly generated within this component block to avoid scanning the global array
    const componentRules: IRRule[] = [];

    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const rule = createRule(selector, {
        file: sourceFile,
        component: componentName,
      });

      // Parse declarations and pseudo-classes
      const entries = Object.entries(styleDef);
      for (let j = 0; j < entries.length; j++) {
        const [prop, value] = entries[j];
        
        if (prop === 'selectors' || prop === 'selector' || prop.startsWith('_')) continue;
        if (prop === 'atRules' || prop === 'nestedRules' || prop === 'themes') continue;

        // ── Pseudo-classes & pseudo-elements ──
        if ((prop.startsWith('&:') || prop.startsWith('&::')) && typeof value === 'object' && value!== null) {
          const isElement = prop.startsWith('&::');
          const pseudoName = prop.replace(/^&::?/, ''); // hover, before
          const pc: IRPseudoClass = {
            id: nextId(pseudoName),
            parentId: rule.id,
            name: isElement? `::${pseudoName}` : pseudoName, // keep :: for emitter
            declarations: [],
            source: rule.source,
            history: [record('parser', 'created', undefined, `Parsed ${pseudoName}`)],
          };
          for (const [p,v] of Object.entries(value)) {
            if (typeof v === 'string' || typeof v === 'number') {
              pc.declarations.push(createDeclaration(normalizeProperty(p), v, rule.source));
            }
          }
          if (pc.declarations.length) rule.pseudoClasses.push(pc);
          continue;
        }

        // ── Nested selectors: & .icon, &[data-active], & > div ──
        if (prop.startsWith('&') && typeof value === 'object' && value!== null) {
          // create nested rule for later lowering
          const nestedSelector = prop.replace(/^&/, rule.selector); // ".btn .child"
          const nestedRule = createRule(nestedSelector, rule.source);
          (nestedRule as any).parentId = rule.id;
          for (const [p,v] of Object.entries(value)) {
            if (typeof v === 'string' || typeof v === 'number') {
              nestedRule.declarations.push(createDeclaration(normalizeProperty(p), v, rule.source));
            }
          }
          rule.nestedRules.push(nestedRule);
          continue;
        }

        // ── Legacy `hover` key fallback ──
        if (prop === 'hover' && typeof value === 'object' && value !== null && !styleDef['&:hover']) {
          const pc: IRPseudoClass = {
            id: nextId('hover'),
            parentId: rule.id,
            name: 'hover',
            declarations: [],
            source: rule.source,
            history: [record('parser', 'created', undefined, 'Parsed hover block')],
          };
          
          const hEntries = Object.entries(value);
          for (let k = 0; k < hEntries.length; k++) {
            const [p, v] = hEntries[k];
            if (typeof v === 'string' || typeof v === 'number') {
              pc.declarations.push(createDeclaration(normalizeProperty(p), v, rule.source));
            }
          }
          if (pc.declarations.length > 0) {
            rule.pseudoClasses.push(pc);
          }
          continue;
        }

        // ── Regular CSS Declarations ──
        if (typeof value === 'string' || typeof value === 'number') {
          rule.declarations.push(createDeclaration(normalizeProperty(prop), value, rule.source));
        }
      }

      ir.rules.push(rule);
      componentRules.push(rule);
    }

    // ── Parse At-Rules Localized strictly to this Component ──
    const allAtRules = styleDef._atRules || styleDef.atRules;
    if (allAtRules && Array.isArray(allAtRules)) {
      for (let i = 0; i < allAtRules.length; i++) {
        const atRule = allAtRules[i];
        const type = atRule.type || 'media';
        
        const templateAtRule: IRAtRule = {
          id: nextId('atrule'),
          type,
          query: atRule.query,
          name: atRule.name,
          declarations: [],
          nestedRules: [],
          keyframes: [],
          source: { file: sourceFile, component: componentName },
          history: [record('parser', 'created', undefined, `Parsed @${type} block`)],
        };

        // Handle standard at-rule styles
        if (atRule.styles && typeof atRule.styles === 'object') {
          const sEntries = Object.entries(atRule.styles);
          for (let j = 0; j < sEntries.length; j++) {
            const [prop, value] = sEntries[j];
            if (typeof value === 'string' || typeof value === 'number') {
              templateAtRule.declarations.push(
                createDeclaration(normalizeProperty(prop), value, templateAtRule.source)
              );
            }
          }
        }

        // Phase 2: Structural processing for keyframe steps
        if (type === 'keyframes' && atRule.frames && typeof atRule.frames === 'object') {
          const fEntries = Object.entries(atRule.frames);
          for (let j = 0; j < fEntries.length; j++) {
            const [keyText, frameStyles] = fEntries[j];
            if (frameStyles && typeof frameStyles === 'object') {
              const frame: IRKeyframeFrame = {
                id: nextId('frame'),
                keyText,
                declarations: [],
                source: templateAtRule.source
              };
              
              const fsEntries = Object.entries(frameStyles);
              for (let k = 0; k < fsEntries.length; k++) {
                const [p, v] = fsEntries[k];
                if (typeof v === 'string' || typeof v === 'number') {
                  frame.declarations.push(createDeclaration(normalizeProperty(p), v, frame.source));
                }
              }
              templateAtRule.keyframes!.push(frame);
            }
          }
        }

        // Attach safely to rules generated by this component block
        for (let j = 0; j < componentRules.length; j++) {
          const rule = componentRules[j];
          rule.atRules.push({
            ...templateAtRule,
            id: nextId('atrule'),
            parentId: rule.id,
            declarations: [...templateAtRule.declarations],
            keyframes: templateAtRule.keyframes ? templateAtRule.keyframes.map(f => ({...f, declarations: [...f.declarations]})) : undefined,
            nestedRules: [...templateAtRule.nestedRules]
          });
        }
      }
    }

    // ── Parse CSS if() Conditions strictly for this Component ──
    if (styleDef._ifConditions && Array.isArray(styleDef._ifConditions)) {
      for (let i = 0; i < styleDef._ifConditions.length; i++) {
        const cond = styleDef._ifConditions[i];
        if (!cond.property || !cond.variable) {
          ir.diagnostics.push({
            id: nextId('diag'),
            nodeId: ir.id,
            severity: 'warning',
            message: `Skipping malformed if() condition in ${componentName}: missing property or variable`,
            pass: 'parser',
          });
          continue;
        }

        const templateCond: IRCondition = {
          id: nextId('cond'),
          property: normalizeProperty(cond.property),
          variable: cond.variable,
          conditions: cond.conditions || {},
          defaultValue: cond.defaultValue || '',
          source: { file: sourceFile, component: componentName },
        };

        for (let j = 0; j < componentRules.length; j++) {
          const rule = componentRules[j];
          rule.conditions.push({ ...templateCond, id: nextId('cond') });
        }
      }
    }
  }

  return ir;
}