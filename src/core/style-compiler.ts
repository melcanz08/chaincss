// src/core/style-compiler.ts

/**
 * ChainCSS Style Compiler
 * 
 * Compiles StyleObjects to CSS strings. This is the single compilation path
 * used by the build pipeline, CLI, runtime injector, and plugins.
 */

import type { StyleObject, AtRule, NestedRule } from './style-collector.js';
import { partitionStyles, classifyValue } from './value-classifier.js';

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
// Cached camelCase → kebab-case conversion
// ============================================================================

const kebabCache = new Map<string, string>();

function camelToKebab(str: string): string {
  const cached = kebabCache.get(str);
  if (cached !== undefined) return cached;
  const result = str.replace(/([A-Z])/g, '-$1').toLowerCase();
  kebabCache.set(str, result);
  return result;
}

// ============================================================================
// Safe indentation — avoids corrupting newlines inside CSS string values
// ============================================================================

function safeIndent(cssText: string, indent: string): string {
  return cssText.split('\n').map(line => line ? indent + line : line).join('\n');
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
    _mixed,
    selectors,
    nestedRules: _explicitNestedRules,
    atRules: _explicitAtRules,
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

// ============================================================================
// Declaration Compilation — single pass, no filter/map allocations
// ============================================================================

function compileDeclarations(
  properties: Record<string, any>,
  indent: string,
  options: CompileOptions
): string[] {
  const lines: string[] = [];
  
  for (const [prop, value] of Object.entries(properties)) {
    if (prop.startsWith('_')) continue;
    if (typeof value === 'function') {
      lines.push(`${indent}${camelToKebab(prop)}: var(--chain-dynamic-${prop}, initial);`);
      continue;
    }
    if (prop === 'nestedRules' || prop === 'atRules') continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) continue;
    
    lines.push(`${indent}${camelToKebab(prop)}: ${value};`);
  }
  
  return lines;
}

// ============================================================================
// At-Rule Compilation — uses safeIndent to avoid newline corruption
// ============================================================================

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
      return `@media ${rule.query} {${newline}${safeIndent(inner, indent)}${newline}}`;
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
      return `@supports (${rule.condition}) {${newline}${safeIndent(inner, indent)}${newline}}`;
    }
    
    case 'container': {
      const inner = compileToCSS(rule.styles || {}, {
        ...options,
        scopeSelector: parentSelector
      });
      if (!inner.trim()) return '';
      return `@container ${rule.condition || ''} {${newline}${safeIndent(inner, indent)}${newline}}`;
    }
    
    case 'layer': {
      const inner = compileToCSS(rule.styles || {}, {
        ...options,
        scopeSelector: parentSelector
      });
      if (!inner.trim()) return '';
      return `@layer ${rule.name || ''} {${newline}${safeIndent(inner, indent)}${newline}}`;
    }
    
    default:
      return '';
  }
}

// ============================================================================
// Build-Time Partitioning (RECURSIVE — handles nested/at-rules)
// ============================================================================

/**
 * Partition a StyleObject into static CSS and dynamic values.
 * Recursively processes nested rules and at-rules so dynamic values
 * inside @media queries, hover states, and nested selectors are 
 * properly detected.
 * 
 * Preserves structural keys (_nestedRules, _atRules) in child contexts
 * so deeply nested layouts are not silently erased.
 */
export function partitionForBuild(
  styleObject: StyleObject,
  options: CompileOptions = {}
): CompileResult {
  const { static: topStatic, dynamic: topDynamic } = partitionStyles(
    stripMetadata(styleObject)
  );

  // Recursively partition nested rules
  const staticNestedRules: NestedRule[] = [];
  const dynamicNestedRules: Record<string, any> = {};
  
  const allNested = [
    ...(styleObject._nestedRules || []),
    ...(Array.isArray((styleObject as any).nestedRules) ? (styleObject as any).nestedRules : [])
  ];
  
  for (const rule of allNested) {
    const nestedResult = partitionForBuild(rule.styles, options);
    if (nestedResult.hasDynamic) {
      dynamicNestedRules[rule.selector] = nestedResult.dynamicValues;
    }
    // Preserve structural keys so deeply nested layouts survive
    staticNestedRules.push({
      selector: rule.selector,
      styles: {
        ...stripMetadata(rule.styles),
        _nestedRules: rule.styles._nestedRules,
        _atRules: rule.styles._atRules,
      }
    });
  }

  // Recursively partition at-rules
  const staticAtRules: AtRule[] = [];
  const dynamicAtRules: Record<string, any> = {};
  
  for (const atRule of (styleObject._atRules || [])) {
    if (atRule.styles) {
      const atResult = partitionForBuild(atRule.styles, options);
      if (atResult.hasDynamic) {
        dynamicAtRules[`@${atRule.type}${atRule.query ? ' ' + atRule.query : ''}`] = atResult.dynamicValues;
      }
      staticAtRules.push({
        ...atRule,
        styles: {
          ...stripMetadata(atRule.styles),
          _nestedRules: atRule.styles._nestedRules,
          _atRules: atRule.styles._atRules,
        }
      });
    } else {
      staticAtRules.push(atRule);
    }
  }

  // Handle pseudo-classes (&:hover, &:focus, etc.)
  const staticPseudoStyles: Record<string, any> = {};
  const dynamicPseudoStyles: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(styleObject)) {
    if (key.startsWith('&:') && typeof value === 'object' && value !== null) {
      const pseudoResult = partitionStyles(value as Record<string, any>);
      if (Object.keys(pseudoResult.static).length > 0) {
        staticPseudoStyles[key] = pseudoResult.static;
      }
      if (Object.keys(pseudoResult.dynamic).length > 0) {
        dynamicPseudoStyles[key] = pseudoResult.dynamic;
      }
    }
  }

  // Build the static StyleObject
  const staticStyleObject: StyleObject = {
    ...topStatic,
    ...staticPseudoStyles,
    _atRules: staticAtRules,
    _nestedRules: staticNestedRules
  };

  if ((styleObject as any).selectors) {
    (staticStyleObject as any).selectors = (styleObject as any).selectors;
  }

  const css = compileToCSS(staticStyleObject, options);

  const dynamicValues: Record<string, any> = {
    ...topDynamic,
    ...dynamicPseudoStyles,
  };

  if (Object.keys(dynamicNestedRules).length > 0) {
    dynamicValues._nestedRules = dynamicNestedRules;
  }
  if (Object.keys(dynamicAtRules).length > 0) {
    dynamicValues._atRules = dynamicAtRules;
  }

  const hasDynamic = Object.keys(dynamicValues).length > 0;

  return {
    css,
    dynamicValues,
    hasDynamic
  };
}

// ============================================================================
// Helpers
// ============================================================================

function stripMetadata(obj: StyleObject): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith('_')) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Batch compile multiple style objects and concatenate their CSS.
 */
export function run(...styleObjects: StyleObject[]): string {
  return styleObjects
    .map(obj => compileToCSS(obj))
    .filter(Boolean)
    .join('\n\n');
}