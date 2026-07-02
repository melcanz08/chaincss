// src/compiler/pipeline/ir/css-printer.ts
//
// ChainCSS IR → CSS Printer
// Generates CSS strings from the intermediate representation.
// Optimized for the hot path: property kebabing is cached,
// string building uses array join with pre-sized arrays.

import type { StyleIR, IRRule, IRDeclaration, IRAtRule } from './types.js';

// ============================================================================
// Cached helpers
// ============================================================================

const kebabCache = new Map<string, string>();

function kebab(prop: string): string {
  const cached = kebabCache.get(prop);
  if (cached !== undefined) return cached;
  const result = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
  kebabCache.set(prop, result);
  return result;
}

function formatValue(value: string | number): string {
  return typeof value === 'number' ? String(value) : value;
}

/** Check if a declaration has a renderable value */
function hasValue(d: IRDeclaration): boolean {
  return d.value !== undefined && d.value !== null;
}

// ============================================================================
// Main Generator
// ============================================================================

export function generateCSS(ir: StyleIR, options?: { minify?: boolean }): string {
  const minify = options?.minify ?? false;
  const nl = minify ? '' : '\n';
  const indent = minify ? '' : '  ';
  const space = minify ? '' : ' ';

  // Pre-allocate array with estimated capacity
  const parts: string[] = new Array(ir.rules.length);
  let partIndex = 0;

  for (const rule of ir.rules) {
    if (rule.isDead) continue;
    const ruleCSS = emitRule(rule, indent, nl, space, minify);
    if (ruleCSS) {
      parts[partIndex++] = ruleCSS;
    }
  }

  parts.length = partIndex; // Trim to actual size
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

  // Regular declarations — single pass, no filter() allocation
  const activeDecls: IRDeclaration[] = [];
  for (const d of rule.declarations) {
    if (hasValue(d)) activeDecls.push(d);
  }
  if (activeDecls.length > 0) {
    parts.push(emitDeclBlock(rule.selector, activeDecls, indent, nl, space));
  }

  // Pseudo-classes
  for (const pc of rule.pseudoClasses) {
    const pcDecls: IRDeclaration[] = [];
    for (const d of pc.declarations) {
      if (hasValue(d)) pcDecls.push(d);
    }
    if (pcDecls.length > 0) {
      parts.push(emitDeclBlock(`${rule.selector}:${pc.name}`, pcDecls, indent, nl, space));
    }
  }

  // At-rules
  for (const atRule of rule.atRules) {
    const atCSS = emitAtRule(rule.selector, atRule, indent, nl, space, minify);
    if (atCSS) parts.push(atCSS);
  }

  // Nested rules
  for (const nested of rule.nestedRules) {
    if (nested.isDead) continue;
    const nestedCSS = emitRule(nested, indent, nl, space, minify);
    if (nestedCSS) parts.push(nestedCSS);
  }

  // CSS if() conditions
  if (rule.conditions.length > 0) {
    const condCSS = emitConditions(rule.selector, rule.conditions, indent, nl, space);
    if (condCSS) parts.push(condCSS);
  }

  return parts.join(minify ? '' : '\n\n');
}

// ============================================================================
// Declaration Block Emission
// ============================================================================

function emitDeclBlock(
  selector: string,
  declarations: IRDeclaration[],
  indent: string,
  nl: string,
  space: string
): string {
  const lines: string[] = new Array(declarations.length);
  for (let i = 0; i < declarations.length; i++) {
    const d = declarations[i];
    lines[i] = `${indent}${kebab(d.property)}:${space}${formatValue(d.value)};`;
  }
  return `${selector}${space}{${nl}${lines.join(nl)}${nl}}`;
}

// ============================================================================
// At-Rule Emission
// ============================================================================

/**
 * Emit inner CSS indented by the given depth.
 * Avoids post-processing string replacement — builds indented output directly.
 */
function emitIndented(
  inner: string,
  indent: string,
  nl: string,
  minify: boolean
): string {
  if (minify || !nl) return inner;
  
  const lines = inner.split('\n');
  const indentedLines: string[] = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    indentedLines[i] = lines[i] ? indent + lines[i] : lines[i];
  }
  return indentedLines.join(nl);
}

function emitAtRule(
  parentSelector: string,
  atRule: IRAtRule,
  indent: string,
  nl: string,
  space: string,
  minify: boolean
): string {
  const activeDecls: IRDeclaration[] = [];
  for (const d of atRule.declarations) {
    if (hasValue(d)) activeDecls.push(d);
  }

  switch (atRule.type) {
    case 'media': {
      if (activeDecls.length === 0 && atRule.nestedRules.length === 0) return '';

      let inner = '';
      if (activeDecls.length > 0) {
        inner += emitDeclBlock(parentSelector, activeDecls, indent, nl, space);
      }
      for (const nested of atRule.nestedRules) {
        if (nested.isDead) continue;
        const nestedCSS = emitRule(nested, indent, nl, space, minify);
        if (nestedCSS) {
          inner += (inner ? (minify ? '' : '\n\n') : '') + nestedCSS;
        }
      }

      if (!inner.trim()) return '';
      return `@media ${atRule.query} {${nl}${emitIndented(inner, indent, nl, minify)}${nl}}`;
    }

    case 'supports': {
      if (activeDecls.length === 0) return '';
      const inner = emitDeclBlock(parentSelector, activeDecls, indent, nl, space);
      return `@supports ${atRule.query || ''} {${nl}${emitIndented(inner, indent, nl, minify)}${nl}}`;
    }

    case 'container': {
      if (activeDecls.length === 0) return '';
      const inner = emitDeclBlock(parentSelector, activeDecls, indent, nl, space);
      return `@container ${atRule.query || ''} {${nl}${emitIndented(inner, indent, nl, minify)}${nl}}`;
    }

    case 'layer': {
      if (activeDecls.length === 0) return '';
      const inner = emitDeclBlock(parentSelector, activeDecls, indent, nl, space);
      return `@layer ${atRule.name || ''} {${nl}${emitIndented(inner, indent, nl, minify)}${nl}}`;
    }

    case 'font-face': {
      if (activeDecls.length === 0) return '';
      const lines: string[] = new Array(activeDecls.length);
      for (let i = 0; i < activeDecls.length; i++) {
        const d = activeDecls[i];
        lines[i] = `${indent}${kebab(d.property)}:${space}${formatValue(d.value)};`;
      }
      return `@font-face {${nl}${lines.join(nl)}${nl}}`;
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
  const steps = new Map<string, IRDeclaration[]>();

  for (const decl of declarations) {
    const step = (decl.meta?._keyframeStep as string) || '50%';
    if (!steps.has(step)) steps.set(step, []);
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
  const parts: string[] = [];

  for (const cond of conditions) {
    const entries = Object.entries(cond.conditions);
    if (entries.length === 0) continue;

    if (entries.length === 1) {
      const [conditionValue, styleValue] = entries[0];
      parts.push(
        `${indent}${kebab(cond.property)}:${space}if(style(${cond.variable}:${space}${conditionValue}):${space}${styleValue}${space}else${space}${cond.defaultValue});`
      );
    } else {
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
      parts.push(result);
    }
  }

  if (parts.length === 0) return '';
  return `${selector}${space}{${nl}${parts.join(nl)}${nl}}`;
}

// ============================================================================
// Convenience
// ============================================================================

export function compileIR(ir: StyleIR, minify: boolean = false): string {
  return generateCSS(ir, { minify });
}