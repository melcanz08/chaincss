// src/compiler/pipeline/ir/css-printer.ts

/**
 * ChainCSS IR → CSS Printer
 * 
 * Generates CSS strings from the intermediate representation.
 * Handles all at-rule types, pseudo-classes, nested rules, 
 * conditions, minification, and dead code elimination.
 */

import type { StyleIR, IRRule, IRDeclaration, IRAtRule } from './types.js';

// ============================================================================
// Helpers
// ============================================================================

function kebab(prop: string): string {
  return prop.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function formatValue(value: string | number): string {
  if (typeof value === 'number') return String(value);
  return value;
}

// ============================================================================
// Main Generator
// ============================================================================

export function generateCSS(ir: StyleIR, options?: { minify?: boolean }): string {
  const minify = options?.minify ?? false;
  const nl = minify ? '' : '\n';
  const indent = minify ? '' : '  ';
  const space = minify ? '' : ' ';
  const parts: string[] = [];

  for (const rule of ir.rules) {
    if (rule.isDead) continue;
    
    const ruleCSS = emitRule(rule, indent, nl, space, minify);
    if (ruleCSS) {
      parts.push(ruleCSS);
    }
  }

  const separator = minify ? '' : '\n\n';
  return parts.join(separator);
}

// ============================================================================
// Rule Emission
// ============================================================================

function emitRule(
  rule: IRRule,
  indent: string,
  nl: string,
  space: string,
  minify: boolean
): string {
  const parts: string[] = [];

  // Regular declarations
  const activeDecls = rule.declarations.filter(d => d.value !== undefined && d.value !== null);
  if (activeDecls.length > 0) {
    parts.push(emitRuleBlock(rule.selector, activeDecls, indent, nl, space));
  }

  // Pseudo-classes
  for (const pc of rule.pseudoClasses) {
    const pcDecls = pc.declarations.filter(d => d.value !== undefined && d.value !== null);
    if (pcDecls.length > 0) {
      parts.push(emitRuleBlock(`${rule.selector}:${pc.name}`, pcDecls, indent, nl, space));
    }
  }

  // At-rules
  for (const atRule of rule.atRules) {
    const atCSS = emitAtRule(rule.selector, atRule, indent, nl, space, minify);
    if (atCSS) {
      parts.push(atCSS);
    }
  }

  // Nested rules (recurse)
  for (const nested of rule.nestedRules) {
    if (nested.isDead) continue;
    const nestedCSS = emitRule(nested, indent, nl, space, minify);
    if (nestedCSS) {
      parts.push(nestedCSS);
    }
  }

  // CSS if() conditions
  if (rule.conditions.length > 0) {
    const condCSS = emitConditions(rule.selector, rule.conditions, indent, nl, space);
    if (condCSS) {
      parts.push(condCSS);
    }
  }

  return parts.join(minify ? '' : '\n\n');
}

// ============================================================================
// Block Emission
// ============================================================================

function emitRuleBlock(
  selector: string,
  declarations: IRDeclaration[],
  indent: string,
  nl: string,
  space: string
): string {
  const decls = declarations
    .map(d => `${indent}${kebab(d.property)}:${space}${formatValue(d.value)};`)
    .join(nl);
  
  return `${selector}${space}{${nl}${decls}${nl}}`;
}

// ============================================================================
// At-Rule Emission
// ============================================================================

function emitAtRule(
  parentSelector: string,
  atRule: IRAtRule,
  indent: string,
  nl: string,
  space: string,
  minify: boolean
): string {
  const activeDecls = atRule.declarations.filter(d => d.value !== undefined && d.value !== null);

  switch (atRule.type) {
    case 'media': {
      if (activeDecls.length === 0 && atRule.nestedRules.length === 0) return '';
      
      let inner = '';
      if (activeDecls.length > 0) {
        inner += emitRuleBlock(parentSelector, activeDecls, indent, nl, space);
      }
      for (const nested of atRule.nestedRules) {
        if (nested.isDead) continue;
        inner += (inner ? (minify ? '' : '\n\n') : '') + emitRule(nested, indent, nl, space, minify);
      }
      
      if (!inner.trim()) return '';
      const indented = minify ? inner : inner.replace(/\n/g, `\n${indent}`);
      return `@media ${atRule.query} {${nl}${indent}${indented}${nl}}`;
    }

    case 'supports': {
      if (activeDecls.length === 0) return '';
      const inner = emitRuleBlock(parentSelector, activeDecls, indent, nl, space);
      const indented = minify ? inner : inner.replace(/\n/g, `\n${indent}`);
      // IRAtRule uses `query` for the supports condition
      return `@supports ${atRule.query || ''} {${nl}${indent}${indented}${nl}}`;
    }

    case 'container': {
      if (activeDecls.length === 0) return '';
      const inner = emitRuleBlock(parentSelector, activeDecls, indent, nl, space);
      const indented = minify ? inner : inner.replace(/\n/g, `\n${indent}`);
      // IRAtRule uses `query` for the container condition
      return `@container ${atRule.query || ''} {${nl}${indent}${indented}${nl}}`;
    }

    case 'layer': {
      if (activeDecls.length === 0) return '';
      const inner = emitRuleBlock(parentSelector, activeDecls, indent, nl, space);
      const indented = minify ? inner : inner.replace(/\n/g, `\n${indent}`);
      return `@layer ${atRule.name || ''} {${nl}${indent}${indented}${nl}}`;
    }

    case 'font-face': {
      if (activeDecls.length === 0) return '';
      // font-face doesn't use parent selector
      const inner = activeDecls
        .map(d => `${indent}${kebab(d.property)}:${space}${formatValue(d.value)};`)
        .join(nl);
      return `@font-face {${nl}${inner}${nl}}`;
    }

    case 'keyframes': {
      if (activeDecls.length === 0) return '';
      return emitKeyframes(atRule.name || 'unnamed', activeDecls, indent, nl, space, minify);
    }

    default:
      return '';
  }
}

// ============================================================================
// Keyframes Emission
// ============================================================================

function emitKeyframes(
  name: string,
  declarations: IRDeclaration[],
  indent: string,
  nl: string,
  space: string,
  minify: boolean
): string {
  // Group declarations by keyframe step
  // Steps are stored in declaration meta._keyframeStep, or default to '50%'
  const steps = new Map<string, IRDeclaration[]>();
  
  for (const decl of declarations) {
    const step = (decl.meta?._keyframeStep as string) || '50%';
    if (!steps.has(step)) {
      steps.set(step, []);
    }
    steps.get(step)!.push(decl);
  }

  if (steps.size === 0) return '';

  const kfIndent = indent;
  const propIndent = indent + indent;

  let css = `@keyframes ${name} {${nl}`;
  
  for (const [step, decls] of steps) {
    css += `${kfIndent}${step} {${nl}`;
    for (const decl of decls) {
      css += `${propIndent}${kebab(decl.property)}:${space}${formatValue(decl.value)};${nl}`;
    }
    css += `${kfIndent}}${nl}`;
  }
  
  css += `}`;
  return css;
}

// ============================================================================
// Condition Emission (CSS if())
// ============================================================================

function emitConditions(
  selector: string,
  conditions: IRRule['conditions'],
  indent: string,
  nl: string,
  space: string
): string {
  const decls = conditions.map(cond => {
    const entries = Object.entries(cond.conditions);
    if (entries.length === 0) return '';
    
    // Single condition
    if (entries.length === 1) {
      const [conditionValue, styleValue] = entries[0];
      return `${indent}${kebab(cond.property)}:${space}if(style(${cond.variable}:${space}${conditionValue}):${space}${styleValue}${space}else${space}${cond.defaultValue});`;
    }
    
    // Multiple conditions — chain them
    let result = `${indent}${kebab(cond.property)}:${space}`;
    for (let i = 0; i < entries.length; i++) {
      const [c, v] = entries[i];
      if (i === 0) {
        result += `if(style(${cond.variable}:${space}${c}):${space}${v}`;
      } else {
        result += `${space}else if(style(${cond.variable}:${space}${c}):${space}${v}`;
      }
    }
    result += `${space}else${space}${cond.defaultValue}`;
    result += ');'.repeat(entries.length);
    return result;
  }).filter(Boolean);

  if (decls.length === 0) return '';
  return `${selector}${space}{${nl}${decls.join(nl)}${nl}}`;
}

// ============================================================================
// Convenience: compile directly from IR without pipeline
// ============================================================================

/**
 * Quick one-shot compilation: StyleIR → CSS string.
 * Useful for testing and simple use cases.
 */
export function compileIR(ir: StyleIR, minify: boolean = false): string {
  return generateCSS(ir, { minify });
}