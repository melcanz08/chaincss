// src/core/style-compiler.ts

/**
 * ChainCSS Style Compiler
 * 
 * Compiles StyleObjects to CSS strings. This is the single compilation path
 * used by the build pipeline, CLI, runtime injector, and plugins.
 */

import type { 
  StyleObject, 
  CSSProperties, 
  PseudoStyles, 
  PseudoClasses,
  AtRule, 
  NestedRule,
  CSSPrimitiveValue,
  CompileResult as CoreCompileResult
} from './types';
import { parseStyleObject, isCSSPrimitiveValue, isDynamicValue } from './types';
import { partitionStyles } from './value-classifier';

// Internal extended options (scopeSelector/sourceFile are internal, not public API)
interface InternalCompileOptions {
  minify?: boolean;
  sourceMap?: boolean;
  scopeSelector?: string;
  sourceFile?: string;
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
// CSS Value Sanitization — prevents injection via user input
// ============================================================================

/**
 * Sanitize a CSS value to prevent injection attacks.
 * Escapes characters that could break out of CSS context.
 */
function sanitizeCSSValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')       // Escape backslashes
    .replace(/<\//g, '<\\/')       // Prevent </style> injection
    .replace(/\n/g, '\\n')         // Escape newlines
    .replace(/\r/g, '\\r');        // Escape carriage returns
}


// ============================================================================
// Helpers
// ============================================================================

function getEffectiveSelector(selectors: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(selectors)) return selectors.join(', ');
  return selectors || fallback;
}

function resolveNestedSelector(parent: string, child: string): string {
  if (!parent) return child;
  if (child.startsWith('&')) return `${parent}${child.slice(1)}`;
  return `${parent} ${child}`;
}

function buildAtRuleKey(atRule: AtRule): string {
  const parts: string[] = [`@${atRule.type}`];
  if (atRule.query) parts.push(atRule.query);
  if (atRule.condition) parts.push(atRule.condition);
  if (atRule.name) parts.push(atRule.name);
  return parts.join(' ');
}

function stripMetadata(obj: StyleObject): StyleObject {
  const cleaned: StyleObject = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith('_')) {
      (cleaned as Record<string, unknown>)[key] = value;
    }
  }
  return cleaned;
}

function preserveStructure(obj: StyleObject): StyleObject {
  const cleaned = stripMetadata(obj);
  if (obj._nestedRules && obj._nestedRules.length > 0) {
    cleaned._nestedRules = obj._nestedRules;
  }
  if (obj._atRules && obj._atRules.length > 0) {
    cleaned._atRules = obj._atRules;
  }
  return cleaned;
}

// ============================================================================
// CSS String Generation
// ============================================================================

export function compileToCSS(
  styleObject: StyleObject,
  options: InternalCompileOptions = {}
): string {
  try {
  const parsed = parseStyleObject(styleObject as Record<string, unknown>);
  const parts: string[] = [];
  const scope = options.scopeSelector || '';
  const indent = options.minify ? '' : '  ';
  const newline = options.minify ? '' : '\n';
  
  const effectiveSelector = getEffectiveSelector(parsed.selectors, scope);
  
  // Compile main declarations
  const mainDeclarations = compileDeclarations(parsed.regularProps, indent);
  
  if (mainDeclarations.length > 0 && effectiveSelector) {
    const source = options.sourceMap && options.sourceFile
      ? `/* ${options.sourceFile} */${newline}`
      : '';
    parts.push(`${source}${effectiveSelector} {${newline}${mainDeclarations.join(newline)}${newline}}`);
  }
  
  // Compile pseudo-classes
  for (const [pseudo, pseudoStyles] of Object.entries(parsed.pseudoClasses)) {
    const pseudoCSS = compilePseudoClass(effectiveSelector, pseudo, pseudoStyles, indent, newline);
    if (pseudoCSS) parts.push(pseudoCSS);
  }
  
  // Compile nested rules
  for (const rule of parsed.nestedRules) {
    const nestedCSS = compileNestedRule(effectiveSelector, rule, options);
    if (nestedCSS) parts.push(nestedCSS);
  }
  
  // Compile at-rules
  for (const rule of parsed.atRules) {
    const atRuleCSS = compileAtRule(rule, effectiveSelector, indent, newline, options);
    if (atRuleCSS) parts.push(atRuleCSS);
  }
  
  return parts.join(options.minify ? '' : '\n\n');
  } catch (error) {
    const context = options.sourceFile || options.scopeSelector || 'unknown';
    throw new Error(`[ChainCSS] Failed to compile style for "${context}": ${(error as Error).message}`);
  }
}

// ============================================================================
// Specialized Compilation Functions
// ============================================================================

function compilePseudoClass(
  parentSelector: string,
  pseudoClass: string,
  styles: PseudoStyles,
  indent: string,
  newline: string
): string | null {
  const declarations = compileDeclarations(styles, indent);
  if (declarations.length === 0) return null;
  
  const selector = resolveNestedSelector(parentSelector, pseudoClass);
  return `${selector} {${newline}${declarations.join(newline)}${newline}}`;
}

function compileNestedRule(
  parentSelector: string,
  rule: NestedRule,
  options: InternalCompileOptions
): string | null {
  const nestedSelector = resolveNestedSelector(parentSelector, rule.selector);
  const css = compileToCSS(rule.styles as StyleObject, {
    ...options,
    scopeSelector: nestedSelector
  });
  return css || null;
}

// ============================================================================
// Declaration Compilation — single pass, no filter/map allocations
// ============================================================================

function compileDeclarations(
  properties: CSSProperties,
  indent: string
): string[] {
  const lines: string[] = [];
  
  for (const [prop, value] of Object.entries(properties)) {
    // Handle dynamic values (functions)
    if (isDynamicValue(value)) {
      lines.push(`${indent}${camelToKebab(prop)}: var(--chain-dynamic-${prop}, initial);`);
      continue;
    }
    
    // Handle static values
    if (isCSSPrimitiveValue(value)) {
      lines.push(`${indent}${camelToKebab(prop)}: ${sanitizeCSSValue(String(value))};`);
    }
    // Objects, arrays, and other non-primitive values are silently skipped
    // (they don't belong in CSS declarations)
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
  options: InternalCompileOptions
): string {
  switch (rule.type) {
    case 'media': {
      if (!rule.styles) return '';
      const inner = compileToCSS(rule.styles as StyleObject, {
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
        for (const [p, v] of Object.entries(props as Record<string, CSSPrimitiveValue>)) {
          kf += `${indent}${indent}${camelToKebab(p)}: ${sanitizeCSSValue(String(v))};${newline}`;
        }
        kf += `${indent}}${newline}`;
      }
      kf += '}';
      return kf;
    }
    
    case 'font-face': {
      let ff = '@font-face {' + newline;
      for (const [p, v] of Object.entries(rule.properties || {})) {
        ff += `${indent}${camelToKebab(p)}: ${sanitizeCSSValue(String(v))};${newline}`;
      }
      ff += '}';
      return ff;
    }
    
    case 'supports': {
      if (!rule.styles) return '';
      const inner = compileToCSS(rule.styles as StyleObject, {
        ...options,
        scopeSelector: parentSelector
      });
      if (!inner.trim()) return '';
      return `@supports (${rule.condition}) {${newline}${safeIndent(inner, indent)}${newline}}`;
    }
    
    case 'container': {
      if (!rule.styles) return '';
      const inner = compileToCSS(rule.styles as StyleObject, {
        ...options,
        scopeSelector: parentSelector
      });
      if (!inner.trim()) return '';
      return `@container ${rule.condition || ''} {${newline}${safeIndent(inner, indent)}${newline}}`;
    }
    
    case 'layer': {
      if (!rule.styles) return '';
      const inner = compileToCSS(rule.styles as StyleObject, {
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
  options: InternalCompileOptions = {}
): { css: string; dynamicValues: Record<string, any>; hasDynamic: boolean; staticObject: StyleObject } {
  try {
  const parsed = parseStyleObject(styleObject as Record<string, unknown>);

  // Partition top-level properties
  const { static: topStatic, dynamic: topDynamic } = partitionStyles(parsed.regularProps);

  // Recursively partition nested rules
  const staticNestedRules: NestedRule[] = [];
  const dynamicNestedRules: Record<string, any> = {};

  for (const rule of parsed.nestedRules) {
    const nestedResult = partitionForBuild(rule.styles as StyleObject, options);
    if (nestedResult.hasDynamic) {
      dynamicNestedRules[rule.selector] = nestedResult.dynamicValues;
    }
    // Preserve structural keys so deeply nested layouts survive
    staticNestedRules.push({
      selector: rule.selector,
      styles: preserveStructure(rule.styles as StyleObject),
    });
  }

  // Recursively partition at-rules
  const staticAtRules: AtRule[] = [];
  const dynamicAtRules: Record<string, any> = {};

  for (const atRule of parsed.atRules) {
    if (atRule.styles) {
      const atResult = partitionForBuild(atRule.styles as StyleObject, options);
      if (atResult.hasDynamic) {
        const key = buildAtRuleKey(atRule);
        dynamicAtRules[key] = atResult.dynamicValues;
      }
      staticAtRules.push({
        ...atRule,
        styles: preserveStructure(atRule.styles as StyleObject),
      });
    } else {
      staticAtRules.push(atRule);
    }
  }

  // Handle pseudo-classes (&:hover, &:focus, etc.)
  const staticPseudoClasses: PseudoClasses = {};
  const dynamicPseudoClasses: Record<string, any> = {};

  for (const [pseudo, styles] of Object.entries(parsed.pseudoClasses)) {
    const { static: s, dynamic: d } = partitionStyles(styles as CSSProperties);
    
    if (Object.keys(s).length > 0) {
      staticPseudoClasses[pseudo as `&:${string}`] = s as PseudoStyles;
    }
    if (Object.keys(d).length > 0) {
      dynamicPseudoClasses[pseudo] = d;
    }
  }

  // Build the static StyleObject
  const staticStyleObject: StyleObject = {
    ...topStatic,
    ...staticPseudoClasses,
    _atRules: staticAtRules,
    _nestedRules: staticNestedRules,
  };

  // Preserve selectors if they exist
  if (parsed.selectors) {
    staticStyleObject.selectors = parsed.selectors;
  }

  // Compile static CSS
  const css = compileToCSS(staticStyleObject, options);

  // Aggregate dynamic values
  const dynamicValues: Record<string, any> = {
    ...topDynamic,
    ...dynamicPseudoClasses,
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
    dynamicValues: dynamicValues as Record<string, any>,
    hasDynamic,
    staticObject: staticStyleObject,
  };
  } catch (error) {
    const context = options.sourceFile || options.scopeSelector || 'unknown';
    throw new Error(`[ChainCSS] Failed to partition style for "${context}": ${(error as Error).message}`);
  }
}

// ============================================================================
// Batch Compilation
// ============================================================================

/**
 * Batch compile multiple style objects and concatenate their CSS.
 */
export function run(...styleObjects: StyleObject[]): string {
  return styleObjects
    .map(obj => compileToCSS(obj))
    .filter(Boolean)
    .join('\n\n');
}