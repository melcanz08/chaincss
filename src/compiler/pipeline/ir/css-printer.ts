// ============================================================================
// FILE: src/compiler/pipeline/ir/css-printer.ts 
// ============================================================================

import type { StyleIR, IRRule, IRDeclaration, IRAtRule, IRKeyframeFrame } from './types.js';

const kebabCache = new Map<string, string>();
function kebab(prop: string): string {
  if (prop.startsWith('--')) return prop;
  const cached = kebabCache.get(prop);
  if (cached !== undefined) return cached;
  const result = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
  kebabCache.set(prop, result);
  return result;
}

function formatValue(value: string | number): string { 
  return typeof value === 'number' ? String(value) : value; 
}

function hasValue(d: IRDeclaration): boolean { 
  return d.value !== undefined && d.value !== null; 
}

export function generateCSS(ir: StyleIR, options?: { minify?: boolean }): string {
  const minify = options?.minify ?? false;
  const nl = minify ? '' : '\n';
  const indent = minify ? '' : '  ';
  const space = minify ? '' : ' ';
  
  const parts: string[] = [];
  for (let i = 0; i < ir.rules.length; i++) {
    const rule = ir.rules[i];
    if (rule.isDead) continue;
    const ruleCSS = emitRule(rule, indent, nl, space, minify);
    if (ruleCSS) parts.push(ruleCSS);
  }
  
  return parts.join(minify ? '' : '\n\n');
}

function emitRule(rule: IRRule, indent: string, nl: string, space: string, minify: boolean): string {
  const parts: string[] = [];
  const activeDecls: IRDeclaration[] = [];
  
  for (let i = 0; i < rule.declarations.length; i++) {
    const d = rule.declarations[i];
    if (hasValue(d)) activeDecls.push(d);
  }
  
  if (activeDecls.length > 0) {
    parts.push(emitDeclBlock(rule.selector, activeDecls, indent, nl, space));
  }

  for (let i = 0; i < rule.pseudoClasses.length; i++) {
    const pc = rule.pseudoClasses[i];
    const pcDecls: IRDeclaration[] = [];
    for (let j = 0; j < pc.declarations.length; j++) {
      const d = pc.declarations[j];
      if (hasValue(d)) pcDecls.push(d);
    }
    if (pcDecls.length === 0) continue;
    
    const raw = pc.name;
    const resolved = raw.includes('&')
      ? raw.replace(/&/g, rule.selector)
      : `${rule.selector}${raw.startsWith(':') || raw.startsWith('[') ? '' : ':'}${raw}`;
    parts.push(emitDeclBlock(resolved, pcDecls, indent, nl, space));
  }

  for (let i = 0; i < rule.atRules.length; i++) {
    const atRule = rule.atRules[i];
    const atCSS = emitAtRule(rule.selector, atRule, indent, nl, space, minify);
    if (atCSS) parts.push(atCSS);
  }

  for (let i = 0; i < rule.nestedRules.length; i++) {
    const nested = rule.nestedRules[i];
    if (nested.isDead) continue;
    const nestedCSS = emitRule(nested, indent, nl, space, minify);
    if (nestedCSS) parts.push(nestedCSS);
  }

  if (rule.conditions.length > 0) {
    const condCSS = emitConditions(rule.selector, rule.conditions, indent, nl, space, minify);
    if (condCSS) parts.push(condCSS);
  }

  return parts.join(minify ? '' : '\n\n');
}

function emitDeclBlock(selector: string, declarations: IRDeclaration[], indent: string, nl: string, space: string): string {
  const lines: string[] = new Array(declarations.length);
  for (let i = 0; i < declarations.length; i++) {
    const d = declarations[i];
    lines[i] = `${indent}${kebab(d.property)}:${space}${formatValue(d.value)};`;
  }
  return `${selector}${space}{${nl}${lines.join(nl)}${nl}}`;
}

function emitIndented(inner: string, indent: string, nl: string, minify: boolean): string {
  if (minify || !nl) return inner;
  const lines = inner.split('\n');
  const indented: string[] = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    indented[i] = lines[i] ? indent + lines[i] : lines[i];
  }
  return indented.join(nl);
}

function emitAtRule(parentSelector: string, atRule: IRAtRule, indent: string, nl: string, space: string, minify: boolean): string {
  const activeDecls: IRDeclaration[] = [];
  for (let i = 0; i < atRule.declarations.length; i++) {
    const d = atRule.declarations[i];
    if (hasValue(d)) activeDecls.push(d);
  }

  switch (atRule.type) {
    case 'media': {
      if (activeDecls.length === 0 && atRule.nestedRules.length === 0) return '';
      let inner = '';
      if (activeDecls.length > 0) inner += emitDeclBlock(parentSelector, activeDecls, indent, nl, space);
      for (let i = 0; i < atRule.nestedRules.length; i++) {
        const nested = atRule.nestedRules[i];
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
      for (let i = 0; i < atRule.nestedRules.length; i++) {
        const c = emitRule(atRule.nestedRules[i], indent, nl, space, minify);
        if (c) inner += (inner ? (minify ? '' : '\n\n') : '') + c;
      }
      return `@supports ${atRule.query || ''} {${nl}${emitIndented(inner, indent, nl, minify)}${nl}}`;
    }
    case 'container': {
      if (activeDecls.length === 0 && !atRule.nestedRules?.length) return '';
      let inner = activeDecls.length ? emitDeclBlock(parentSelector, activeDecls, indent, nl, space) : '';
      for (let i = 0; i < atRule.nestedRules.length; i++) {
        const c = emitRule(atRule.nestedRules[i], indent, nl, space, minify);
        if (c) inner += (inner ? (minify ? '' : '\n\n') : '') + c;
      }
      return `@container ${atRule.query || ''} {${nl}${emitIndented(inner, indent, nl, minify)}${nl}}`;
    }
    case 'layer': {
      const hasNested = atRule.nestedRules && atRule.nestedRules.length > 0;
      if (!atRule.name && activeDecls.length === 0 && !hasNested) return '';
      if (activeDecls.length === 0 && !hasNested) return '';
      
      let inner = activeDecls.length ? emitDeclBlock(parentSelector, activeDecls, indent, nl, space) : '';
      for (let i = 0; i < atRule.nestedRules.length; i++) {
        const c = emitRule(atRule.nestedRules[i], indent, nl, space, minify);
        if (c) inner += (inner ? (minify ? '' : '\n\n') : '') + c;
      }
      return `@layer ${atRule.name || ''} {${nl}${emitIndented(inner, indent, nl, minify)}${nl}}`;
    }
    case 'font-face': {
      if (activeDecls.length === 0) return '';
      const lines = new Array(activeDecls.length);
      for (let i = 0; i < activeDecls.length; i++) {
        const d = activeDecls[i];
        lines[i] = `${indent}${kebab(d.property)}:${space}${formatValue(d.value)};`;
      }
      return `@font-face {${nl}${lines.join(nl)}${nl}}`;
    }
    case 'keyframes': {
      if (!atRule.keyframes || atRule.keyframes.length === 0) return '';
      return emitKeyframesStructural(atRule.name || 'unnamed', atRule.keyframes, indent, nl, space, minify);
    }
    default: {
      const name = atRule.type || 'unknown';
      const query = atRule.query || atRule.name || '';
      let inner = activeDecls.length ? emitDeclBlock(parentSelector, activeDecls, indent, nl, space) : '';
      for (let i = 0; i < atRule.nestedRules.length; i++) {
        const c = emitRule(atRule.nestedRules[i], indent, nl, space, minify);
        if (c) inner += (inner ? (minify ? '' : '\n\n') : '') + c;
      }
      if (!inner && !query) return '';
      const body = inner ? `${nl}${emitIndented(inner, indent, nl, minify)}${nl}` : '';
      return `@${name} ${query}${space}{${body}}`;
    }
  }
}

function emitKeyframesStructural(name: string, frames: IRKeyframeFrame[], indent: string, nl: string, space: string, minify: boolean): string {
  let css = `@keyframes ${name}${space}{${nl}`;
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const activeDecls: IRDeclaration[] = [];
    for (let j = 0; j < frame.declarations.length; j++) {
      const d = frame.declarations[j];
      if (hasValue(d)) activeDecls.push(d);
    }
    if (activeDecls.length === 0) continue;

    css += `${indent}${frame.keyText}${space}{${nl}`;
    for (let j = 0; j < activeDecls.length; j++) {
      const decl = activeDecls[j];
      css += `${indent}${indent}${kebab(decl.property)}:${space}${formatValue(decl.value)};${nl}`;
    }
    css += `${indent}}${i === frames.length - 1 ? '' : nl}`;
  }
  
  css += `${minify ? '' : nl}}`;
  return css;
}

function emitConditions(selector: string, conditions: IRRule['conditions'], indent: string, nl: string, space: string, minify: boolean): string {
  const parts: string[] = [];
  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    const entries = Object.entries(cond.conditions);
    if (entries.length === 0) continue;
    
    const clauses = entries.map(([c, v]) => `style(${cond.variable}:${space}${c}):${space}${v}`).join('; else: ');
    const result = `if(${clauses}; else:${space}${cond.defaultValue})`;
    parts.push(`${indent}${kebab(cond.property)}:${space}${result};`);
  }
  if (parts.length === 0) return '';
  return `${selector}${space}{${nl}${parts.join(nl)}${nl}}`;
}

export function compileIR(ir: StyleIR, minify: boolean = false): string { 
  return generateCSS(ir, { minify }); 
}