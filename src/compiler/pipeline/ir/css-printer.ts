// src/compiler/pipeline/ir/css-printer.ts 
// Performance + correctness: handles custom atRules, pseudo-elements, and layer ordering

import type { StyleIR, IRRule, IRDeclaration, IRAtRule } from './types.js';

const kebabCache = new Map<string, string>();
function kebab(prop: string): string {
  const cached = kebabCache.get(prop);
  if (cached !== undefined) return cached;
  const result = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
  kebabCache.set(prop, result);
  return result;
}
function formatValue(value: string | number): string { return typeof value === 'number' ? String(value) : value; }
function hasValue(d: IRDeclaration): boolean { return d.value !== undefined && d.value !== null; }

export function generateCSS(ir: StyleIR, options?: { minify?: boolean }): string {
  const minify = options?.minify ?? false;
  const nl = minify ? '' : '\n';
  const indent = minify ? '' : '  ';
  const space = minify ? '' : ' ';
  const parts: string[] = new Array(ir.rules.length);
  let partIndex = 0;
  for (const rule of ir.rules) {
    if (rule.isDead) continue;
    const ruleCSS = emitRule(rule, indent, nl, space, minify);
    if (ruleCSS) parts[partIndex++] = ruleCSS;
  }
  parts.length = partIndex;
  return parts.join(minify ? '' : '\n\n');
}

function emitRule(rule: IRRule, indent: string, nl: string, space: string, minify: boolean): string {
  const parts: string[] = [];
  const activeDecls: IRDeclaration[] = [];
  for (const d of rule.declarations) if (hasValue(d)) activeDecls.push(d);
  if (activeDecls.length > 0) parts.push(emitDeclBlock(rule.selector, activeDecls, indent, nl, space));

  for (const pc of rule.pseudoClasses) {
    const pcDecls: IRDeclaration[] = [];
    for (const d of pc.declarations) if (hasValue(d)) pcDecls.push(d);
    if (pcDecls.length === 0) continue;
    // v2.13: handle &-prefixed selectors, pseudo-elements, pseudo-classes, and attribute selectors
    const raw = pc.name;
    // Replace & with parent selector, handle :hover / ::before / [data-x] / &:is()
    const resolved = raw.includes('&')
      ? raw.replace(/&/g, rule.selector)
      : `${rule.selector}${raw.startsWith(':') || raw.startsWith('[') ? '' : ':'}${raw}`;
    parts.push(emitDeclBlock(resolved, pcDecls, indent, nl, space));
  }

  for (const atRule of rule.atRules) {
    const atCSS = emitAtRule(rule.selector, atRule, indent, nl, space, minify);
    if (atCSS) parts.push(atCSS);
  }

  for (const nested of rule.nestedRules) {
    if (nested.isDead) continue;
    const nestedCSS = emitRule(nested, indent, nl, space, minify);
    if (nestedCSS) parts.push(nestedCSS);
  }

  if (rule.conditions.length > 0) {
    const condCSS = emitConditions(rule.selector, rule.conditions, indent, nl, space);
    if (condCSS) parts.push(condCSS);
  }

  return parts.join(minify ? '' : '\n\n');
}

function emitDeclBlock(selector: string, declarations: IRDeclaration[], indent: string, nl: string, space: string): string {
  const lines: string[] = new Array(declarations.length);
  for (let i = 0; i < declarations.length; i++) { const d = declarations[i]; lines[i] = `${indent}${kebab(d.property)}:${space}${formatValue(d.value)};`; }
  return `${selector}${space}{${nl}${lines.join(nl)}${nl}}`;
}

function emitIndented(inner: string, indent: string, nl: string, minify: boolean): string {
  if (minify || !nl) return inner;
  const lines = inner.split('\n');
  const indented: string[] = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) indented[i] = lines[i] ? indent + lines[i] : lines[i];
  return indented.join(nl);
}

function emitAtRule(parentSelector: string, atRule: IRAtRule, indent: string, nl: string, space: string, minify: boolean): string {
  const activeDecls: IRDeclaration[] = [];
  for (const d of atRule.declarations) if (hasValue(d)) activeDecls.push(d);

  switch (atRule.type) {
    case 'media': {
      if (activeDecls.length === 0 && atRule.nestedRules.length === 0) return '';
      let inner = '';
      if (activeDecls.length > 0) inner += emitDeclBlock(parentSelector, activeDecls, indent, nl, space);
      for (const nested of atRule.nestedRules) {
        if (nested.isDead) continue;
        const nestedCSS = emitRule(nested, indent, nl, space, minify);
        if (nestedCSS) inner += (inner ? (minify ? '' : '\n\n') : '') + nestedCSS;
      }
      if (!inner.trim()) return '';
      return `@media ${atRule.query} {${nl}${emitIndented(inner, indent, nl, minify)}${nl}}`;
    }
    case 'supports': {
      if (activeDecls.length === 0 && !atRule.nestedRules?.length) return '';
      let inner = activeDecls.length ? emitDeclBlock(parentSelector, activeDecls, indent, nl, space) : '';
      for (const n of (atRule as any).nestedRules || []) { const c = emitRule(n, indent, nl, space, minify); if (c) inner += (inner ? '\n\n' : '') + c; }
      return `@supports ${atRule.query || ''} {${nl}${emitIndented(inner, indent, nl, minify)}${nl}}`;
    }
    case 'container': {
      if (activeDecls.length === 0) return '';
      const inner = emitDeclBlock(parentSelector, activeDecls, indent, nl, space);
      return `@container ${atRule.query || ''} {${nl}${emitIndented(inner, indent, nl, minify)}${nl}}`;
    }
    case 'layer': {
      // v3.2: support @layer order: @layer base, components, utilities;
      if (!atRule.name && activeDecls.length === 0 && !(atRule as any).nestedRules?.length) {
        // layer order declaration handled elsewhere
        return '';
      }
      if (activeDecls.length === 0 && !(atRule as any).nestedRules?.length) return '';
      let inner = activeDecls.length ? emitDeclBlock(parentSelector, activeDecls, indent, nl, space) : '';
      for (const n of (atRule as any).nestedRules || []) { const c = emitRule(n, indent, nl, space, minify); if (c) inner += (inner ? '\n\n' : '') + c; }
      return `@layer ${atRule.name || ''} {${nl}${emitIndented(inner, indent, nl, minify)}${nl}}`;
    }
    case 'font-face': {
      if (activeDecls.length === 0) return '';
      const lines = activeDecls.map(d => `${indent}${kebab(d.property)}:${space}${formatValue(d.value)};`);
      return `@font-face {${nl}${lines.join(nl)}${nl}}`;
    }
    case 'keyframes': {
      if (activeDecls.length === 0) return '';
      return emitKeyframes(atRule.name || 'unnamed', activeDecls, indent, nl, space, minify);
    }
    default: {
      // v2.13: custom at-rules like @starting-style, @scope, @layer
      const name = (atRule as any).type || 'unknown';
      const query = atRule.query || atRule.name || '';
      const inner = emitDeclBlock(parentSelector, activeDecls, indent, nl, space);
      if (!inner && !query) return '';
      const body = inner ? `${nl}${emitIndented(inner, indent, nl, minify)}${nl}` : '';
      return `@${name} ${query} {${body}}`;
    }
  }
}

function emitKeyframes(name: string, declarations: IRDeclaration[], indent: string, nl: string, space: string, minify: boolean): string {
  const steps = new Map<string, IRDeclaration[]>();
  for (const decl of declarations) {
    const rawStep = (decl.meta?._keyframeStep as string) || '50%';
    const step = rawStep.split(',').map(s => s.trim()).filter(Boolean).join(', ');
    if (!steps.has(step)) steps.set(step, []);
    steps.get(step)!.push(decl);
  }
  if (steps.size === 0) return '';
  let css = `@keyframes ${name} {${nl}`;
  for (const [step, decls] of steps) {
    css += `${indent}${step} {${nl}`;
    for (const decl of decls) css += `${indent}${indent}${kebab(decl.property)}:${space}${formatValue(decl.value)};${nl}`;
    css += `${indent}}${nl}`;
  }
  css += `}`;
  return css;
}

function emitConditions(selector: string, conditions: IRRule['conditions'], indent: string, nl: string, space: string): string {
  const parts: string[] = [];
  for (const cond of conditions) {
    const entries = Object.entries(cond.conditions);
    if (entries.length === 0) continue;
    // CSS if() spec: if(style(--var: val): result; else: fallback)
    // Multi-condition: if(style(--var: a): x; else: style(--var: b): y; else: z)
    const clauses = entries.map(([c, v]) => `style(${cond.variable}:${space}${c}):${space}${v}`).join('; else: ');
    const result = `if(${clauses}; else:${space}${cond.defaultValue})`;
    parts.push(`${indent}${kebab(cond.property)}:${space}${result};`);
  }
  if (parts.length === 0) return '';
  return `${selector}${space}{${nl}${parts.join(nl)}${nl}}`;
}

export function compileIR(ir: StyleIR, minify: boolean = false): string { return generateCSS(ir, { minify }); }

