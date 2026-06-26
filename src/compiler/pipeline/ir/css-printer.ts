// src/compiler/pipeline/ir/generator.ts
/** Generate CSS string from the IR. */

import type { StyleIR } from './types.js';

// ============================================================================
// Generator: StyleIR → CSS string
// ============================================================================

function kebab(prop: string): string {
  return prop.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Generate a CSS string from the IR.
 * This replaces the ad-hoc CSS generation scattered across modules.
 */
export function generateCSS(ir: StyleIR, options?: { minify?: boolean }): string {
  let css = '';

  for (const rule of ir.rules) {
    if (rule.isDead) continue;

    // Regular declarations
    if (rule.declarations.length > 0) {
      css += rule.selector + ' {\n';
      for (const decl of rule.declarations) {
        css += '  ' + kebab(decl.property) + ': ' + decl.value + ';\n';
      }
      css += '}\n';
    }

    // Pseudo-classes
    for (const pc of rule.pseudoClasses) {
      if (pc.declarations.length > 0) {
        css += rule.selector + ':' + pc.name + ' {\n';
        for (const decl of pc.declarations) {
          css += '  ' + kebab(decl.property) + ': ' + decl.value + ';\n';
        }
        css += '}\n';
      }
    }

    // At-rules
    for (const atRule of rule.atRules) {
      if (atRule.type === 'media' && atRule.query) {
        css += '@media ' + atRule.query + ' {\n';
        css += rule.selector + ' {\n';
        for (const decl of atRule.declarations) {
          css += '  ' + kebab(decl.property) + ': ' + decl.value + ';\n';
        }
        css += '}\n}\n';
      } else if (atRule.type === 'keyframes' && atRule.name) {
        css += '@keyframes ' + atRule.name + ' {\n';
        for (const decl of atRule.declarations) {
          css += '  ' + decl.property + ' { ' + kebab(decl.property) + ': ' + decl.value + '; }\n';
        }
        css += '}\n';
      }
    }

    // CSS if() conditions
    if (rule.conditions.length > 0) {
      css += '/* Native CSS if() */\n';
      css += rule.selector + ' {\n';
      for (const cond of rule.conditions) {
        const entries = Object.entries(cond.conditions);
        if (entries.length === 1) {
          const [c, v] = entries[0];
          css += '  ' + kebab(cond.property) + ': if(style(' + cond.variable + ': ' + c + '): ' + v + ' else ' + cond.defaultValue + ');\n';
        }
      }
      css += '}\n';
    }
  }

  return css;
}
