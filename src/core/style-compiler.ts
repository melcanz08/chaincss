// src/core/style-compiler.ts

/**
 * ChainCSS Style Compiler
 * 
 * Compiles StyleObjects to CSS strings. This is the single compilation path
 * used by the build pipeline, CLI, runtime injector, and plugins.
 * 
 * Replaces: btt.ts run(), btt.ts compile(), injector.ts generateCSS()
 */

import type { StyleObject, AtRule, NestedRule } from './style-collector.js';
import { partitionStyles } from './value-classifier.js';

// ============================================================================
// Types
// ============================================================================

export interface CompileOptions {
  /** Minify output CSS */
  minify?: boolean;
  /** Add source comments */
  sourceMap?: boolean;
  /** Scope selector (e.g., '.my-component') */
  scopeSelector?: string;
  /** Source file path for comments */
  sourceFile?: string;
}

export interface CompileResult {
  /** Generated CSS string */
  css: string;
  /** Dynamic values that couldn't be compiled */
  dynamicValues: Record<string, any>;
  /** Whether the output contains any dynamic values */
  hasDynamic: boolean;
}

// ============================================================================
// CSS String Generation
// ============================================================================

/**
 * Compile a StyleObject to a CSS string.
 * Handles: properties, hover states, media queries, keyframes, nested rules.
 */
export function compileToCSS(
  styleObject: StyleObject,
  options: CompileOptions = {}
): string {
  const parts: string[] = [];
  const scope = options.scopeSelector || '';
  const indent = options.minify ? '' : '  ';
  const newline = options.minify ? '' : '\n';
  
  // Separate metadata from CSS properties
  const {
    _classes,
    _transforms,
    _atRules = [],
    _nestedRules = [],
    _name,
    selectors,
    ...properties
  } = styleObject as any;
  
  // Use explicit selectors if provided, otherwise use scopeSelector
  const effectiveSelector = selectors?.join(', ') || scope;
  
  // Separate pseudo-classes (&:hover, &:focus) from regular properties
  const pseudoClasses: Record<string, Record<string, any>> = {};
  const regularProps: Record<string, any> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (key.startsWith('&:')) {
      pseudoClasses[key.substring(1)] = value as Record<string, any>; // :hover, :focus
    } else if (!key.startsWith('_')) {
      regularProps[key] = value;
    }
  }
  
  // Generate main declarations (without pseudo-classes)
  const mainDeclarations = compileDeclarations(regularProps, indent, options);
  
  if (mainDeclarations.length > 0 && effectiveSelector) {
    const source = options.sourceMap && options.sourceFile
      ? `/* ${options.sourceFile} */${newline}`
      : '';
    parts.push(`${source}${effectiveSelector} {${newline}${mainDeclarations.join(newline)}${newline}}`);
  }
  
  // Generate pseudo-class rules as separate selectors
  for (const [pseudo, pseudoStyles] of Object.entries(pseudoClasses)) {
    const pseudoSelector = `${effectiveSelector}${pseudo}`;
    const pseudoDeclarations = compileDeclarations(pseudoStyles, indent, options);
    if (pseudoDeclarations.length > 0) {
      parts.push(`${pseudoSelector} {${newline}${pseudoDeclarations.join(newline)}${newline}}`);
    }
  }
  
  // Process at-rules
  for (const rule of _atRules) {
    const compiled = compileAtRule(rule, effectiveSelector, indent, newline, options);
    if (compiled) parts.push(compiled);
  }
  
  // Process nested rules
  for (const rule of _nestedRules) {
    const nestedScope = effectiveSelector
      ? `${effectiveSelector} ${rule.selector}`
      : rule.selector;
    
    const nestedCSS = compileToCSS(rule.styles, {
      ...options,
      scopeSelector: nestedScope
    });
    if (nestedCSS) parts.push(nestedCSS);
  }
  
  return parts.join(options.minify ? '' : '\n\n');
}

/**
 * Compile a flat record of CSS properties to declaration strings.
 */
function compileDeclarations(
  properties: Record<string, any>,
  indent: string,
  options: CompileOptions
): string[] {
  const lines: string[] = [];
  
  for (const [prop, value] of Object.entries(properties)) {
    // Skip internal keys
    if (prop.startsWith('_')) continue;
    
    // Skip functions (can't compile to static CSS)
    if (typeof value === 'function') continue;
    
    // Handle nested objects (could be nested pseudo-elements)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Skip — handled by nested rules or pseudo-class extraction
      continue;
    }
    
    // Regular property
    const cssProp = camelToKebab(prop);
    lines.push(`${indent}${cssProp}: ${value};`);
  }
  
  return lines;
}

/**
 * Compile an at-rule to CSS string.
 */
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

/**
 * Partition a style object for build-time CSS extraction.
 * Returns compiled static CSS and a map of dynamic values
 * that need runtime resolution.
 */
export function partitionForBuild(
  styleObject: StyleObject,
  options: CompileOptions = {}
): CompileResult {
  const { static: staticProps, dynamic: dynamicProps } = partitionStyles(
    stripMetadata(styleObject)
  );
  
  // Compile static properties to CSS
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
/**
 * Legacy run() — compile multiple style objects to a CSS string.
 * Used by recipe.ts. Prefer compileToCSS() for new code.
 */
export function run(...styleObjects: StyleObject[]): string {
  return styleObjects
    .map(obj => compileToCSS(obj))
    .filter(Boolean)
    .join('\n\n');
}
