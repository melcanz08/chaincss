// src/core/style-compiler.ts

/**
 * ChainCSS Style Compiler
 * 
 * Compiles StyleObjects to CSS strings. This is the single compilation path
 * used by the build pipeline, CLI, runtime injector, and plugins.
 */

import type { StyleObject, AtRule, NestedRule } from './style-collector.js';
import { partitionStyles } from './value-classifier.js';

// ============================================================================
// Types
// ============================================================================

export interface CompileOptions {
  minify?: boolean;
  sourceMap?: boolean;
  scopeSelector?: string;
  sourceFile?: string;
}

export interface CompileResult {
  css: string;
  dynamicValues: Record<string, any>;
  hasDynamic: boolean;
}

// ============================================================================
// CSS String Generation
// ============================================================================

export function compileToCSS(
  styleObject: StyleObject,
  options: CompileOptions = {}
): string {
  const parts: string[] = [];
  const scope = options.scopeSelector || '';
  const indent = options.minify ? '' : '  ';
  const newline = options.minify ? '' : '\n';
  
  const {
    _classes,
    _transforms,
    _atRules = [],
    _nestedRules = [],
    _name,
    selectors,
    ...properties
  } = styleObject as any;
  
  const effectiveSelector = Array.isArray(selectors) ? selectors.join(', ') : (typeof selectors === 'string' ? selectors : scope);
  
  const pseudoClasses: Record<string, Record<string, any>> = {};
  const regularProps: Record<string, any> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (key.startsWith('&:')) {
      pseudoClasses[key.substring(1)] = value as Record<string, any>;
    } else if (!key.startsWith('_')) {
      regularProps[key] = value;
    }
  }
  
  const mainDeclarations = compileDeclarations(regularProps, indent, options);
  
  if (mainDeclarations.length > 0 && effectiveSelector) {
    const source = options.sourceMap && options.sourceFile
      ? `/* ${options.sourceFile} */${newline}`
      : '';
    parts.push(`${source}${effectiveSelector} {${newline}${mainDeclarations.join(newline)}${newline}}`);
  }
  
  for (const [pseudo, pseudoStyles] of Object.entries(pseudoClasses)) {
    const pseudoSelector = `${effectiveSelector}${pseudo}`;
    const pseudoDeclarations = compileDeclarations(pseudoStyles, indent, options);
    if (pseudoDeclarations.length > 0) {
      parts.push(`${pseudoSelector} {${newline}${pseudoDeclarations.join(newline)}${newline}}`);
    }
  }
  
  // Process nested rules
  const allNestedRules = [
    ...(_nestedRules || []),
    ...(Array.isArray(properties.nestedRules) ? properties.nestedRules : [])
  ];
  for (const rule of allNestedRules) {
    const nestedScope = effectiveSelector
      ? rule.selector.startsWith('&') 
        ? `${effectiveSelector}${rule.selector.slice(1)}`
        : `${effectiveSelector} ${rule.selector}`
      : rule.selector;
    
    const nestedCSS = compileToCSS(rule.styles, {
      ...options,
      scopeSelector: nestedScope
    });
    if (nestedCSS) parts.push(nestedCSS);
  }
  
  // Process at-rules (media queries, keyframes, supports, etc.)
  for (const rule of _atRules) {
    const atRuleCSS = compileAtRule(rule, effectiveSelector, indent, newline, options);
    if (atRuleCSS) parts.push(atRuleCSS);
  }
  
  return parts.join(options.minify ? '' : '\n\n');
}

function compileDeclarations(
  properties: Record<string, any>,
  indent: string,
  options: CompileOptions
): string[] {
  const lines: string[] = [];
  
  for (const [prop, value] of Object.entries(properties)) {
    if (prop.startsWith('_')) continue;
    if (typeof value === 'function') continue;
    if (prop === 'nestedRules' || prop === 'atRules') continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) continue;
    
    const cssProp = camelToKebab(prop);
    let finalValue = value;
    if (typeof value === 'number' && ['width','height','min-width','max-width','min-height','max-height'].includes(cssProp)) {
      finalValue = value + 'px';
    }
    lines.push(`${indent}${cssProp}: ${finalValue};`);
  }
  
  return lines;
}

function compileAtRule(
  rule: AtRule,
  parentSelector: string,
  indent: string,
  newline: string,
  options: CompileOptions
): string {
  switch (rule.type) {
    case 'media': {
      const inner = compileToCSS(rule.styles || {}, {
        ...options,
        scopeSelector: parentSelector
      });
      if (!inner.trim()) return '';
      return `@media ${rule.query} {${newline}${indent}${inner.replace(/\n/g, `\n${indent}`)}${newline}}`;
    }
    
    case 'keyframes': {
      let kf = `@keyframes ${rule.name} {${newline}`;
      for (const [step, props] of Object.entries(rule.steps || {})) {
        kf += `${indent}${step} {${newline}`;
        for (const [p, v] of Object.entries(props as Record<string, any>)) {
          kf += `${indent}${indent}${camelToKebab(p)}: ${v};${newline}`;
        }
        kf += `${indent}}${newline}`;
      }
      kf += '}';
      return kf;
    }
    
    case 'font-face': {
      let ff = '@font-face {' + newline;
      for (const [p, v] of Object.entries(rule.properties || {})) {
        ff += `${indent}${camelToKebab(p)}: ${v};${newline}`;
      }
      ff += '}';
      return ff;
    }
    
    case 'supports': {
      const inner = compileToCSS(rule.styles || {}, {
        ...options,
        scopeSelector: parentSelector
      });
      if (!inner.trim()) return '';
      return `@supports (${rule.condition}) {${newline}${indent}${inner.replace(/\n/g, `\n${indent}`)}${newline}}`;
    }
    
    case 'container': {
      const inner = compileToCSS(rule.styles || {}, {
        ...options,
        scopeSelector: parentSelector
      });
      if (!inner.trim()) return '';
      return `@container ${rule.condition || ''} {${newline}${indent}${inner.replace(/\n/g, `\n${indent}`)}${newline}}`.replace('@container ', '@container ');
    }
    
    case 'layer': {
      const inner = compileToCSS(rule.styles || {}, {
        ...options,
        scopeSelector: parentSelector
      });
      if (!inner.trim()) return '';
      return `@layer ${rule.name || ''} {${newline}${indent}${inner.replace(/\n/g, `\n${indent}`)}${newline}}`;
    }
    
    default:
      return '';
  }
}

// ============================================================================
// Build-Time Partitioning
// ============================================================================

export function partitionForBuild(
  styleObject: StyleObject,
  options: CompileOptions = {}
): CompileResult {
  const { static: staticProps, dynamic: dynamicProps } = partitionStyles(
    stripMetadata(styleObject)
  );
  
  const staticStyleObject: StyleObject = {
    ...staticProps,
    _atRules: styleObject._atRules,
    _nestedRules: styleObject._nestedRules
  };
  
  const css = compileToCSS(staticStyleObject, options);
  
  return {
    css,
    dynamicValues: dynamicProps,
    hasDynamic: Object.keys(dynamicProps).length > 0
  };
}

// ============================================================================
// Helpers
// ============================================================================

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function stripMetadata(obj: StyleObject): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith('_')) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export function run(...styleObjects: StyleObject[]): string {
  return styleObjects
    .map(obj => compileToCSS(obj))
    .filter(Boolean)
    .join('\n\n');
}