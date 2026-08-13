// src/core/usecases/style-compiler.ts

import type {
  StyleObject,
  CSSProperties,
  PseudoStyles,
  AtRule,
  NestedRule,
  CSSPrimitiveValue,
} from "@shared/types/index.js";
import {
  parseStyleObject,
  isCSSPrimitiveValue,
  isDynamicValue,
} from "@shared/types/index.js";
import { partitionStyles } from "./value-classifier.js";

import { parseIR } from "../../compiler/pipeline/ir/parser.js";
import { generateCSS } from "../../compiler/pipeline/ir/css-printer.js";
import { createDefaultPipeline } from "../../compiler/pipeline/pipeline.js";

interface InternalCompileOptions {
  minify?: boolean;
  sourceMap?: boolean;
  scopeSelector?: string;
  sourceFile?: string;
}

const kebabCache = new Map<string, string>();
// Track access order for LRU (linked list via Map iteration order)
const kebabAccessOrder: string[] = [];
const KEBAB_CACHE_LIMIT = 1000;

function camelToKebab(str: string): string {
  const cached = kebabCache.get(str);
  if (cached !== undefined) {
    // Move to end of access order (most recently used)
    const idx = kebabAccessOrder.indexOf(str);
    if (idx > -1) {
      kebabAccessOrder.splice(idx, 1);
      kebabAccessOrder.push(str);
    }
    return cached;
  }
  
  // Evict least recently used if at capacity
  if (kebabCache.size >= KEBAB_CACHE_LIMIT && kebabAccessOrder.length > 0) {
    const lruKey = kebabAccessOrder.shift()!;
    kebabCache.delete(lruKey);
  }
  
  const result = str.replace(/([A-Z])/g, "-$1").toLowerCase();
  kebabCache.set(str, result);
  kebabAccessOrder.push(str);
  return result;
}

function safeIndent(cssText: string, indent: string): string {
  if (!indent) return cssText;
  return cssText.replace(/^(?=.+)/gm, indent);
}
function sanitizeCSSValue(v: string): string {
  // Only block </style> tag injection attacks
  if (/<\/style/i.test(v)) {
    throw new Error(
      `[ChainCSS] Invalid CSS value containing style tag injection: ${v.slice(0, 80)}`
    );
  }
  return v.replace(/[\r\n]+/g, " ").trim();
}
function getEffectiveSelector(
  selectors: string | string[] | undefined,
  fallback: string,
): string {
  if (Array.isArray(selectors)) return selectors.join(", ");
  return selectors || fallback;
}
function resolveNestedSelector(parent: string, child: string): string {
  if (!parent) return child;
  if (child.includes("&")) return child.replace(/&/g, parent);
  return `${parent} ${child}`;
}
function buildAtRuleKey(atRule: AtRule): string {
  const parts: string[] = [`@${atRule.type}`];
  if (atRule.query) parts.push(atRule.query);
  if (atRule.condition) parts.push(atRule.condition);
  if (atRule.name) parts.push(atRule.name);
  return parts.join(" ");
}

export function compileToCSS(
  styleObject: StyleObject,
  options: InternalCompileOptions = {},
): string {
  try {
    // Build a StyleDefinition with the scopeSelector as the rule selector
    const styleDef: any = { ...styleObject };
    if (options.scopeSelector && !styleDef.selectors) {
      styleDef.selectors = [options.scopeSelector];
    }

    const ir = parseIR(
      { style: styleDef },
      options.sourceFile,
    );

    // Run through the canonical pipeline
    const pipeline = createDefaultPipeline();
    const result = pipeline.execute(ir);

    return generateCSS(result.ir, {
      minify: !!options.minify,
    });
  } catch (error) {
    const context = options.sourceFile || options.scopeSelector || "unknown";
    throw new Error(
      `[ChainCSS] Failed to compile style for "${context}": ${(error as Error).message}`,
    );
  }
}

function compilePseudoClass(
  parentSelector: string,
  pseudoClass: string,
  styles: PseudoStyles,
  indent: string,
  newline: string,
): string | null {
  const declarations = compileDeclarations(styles, indent, newline);
  if (!declarations) return null;
  const selector = resolveNestedSelector(parentSelector, pseudoClass);
  return `${selector} {${newline}${declarations}${newline}}`;
}
function compileNestedRule(
  parentSelector: string,
  rule: NestedRule,
  options: InternalCompileOptions,
): string | null {
  if (!rule?.selector) return null;
  const nestedSelector = resolveNestedSelector(parentSelector, rule.selector);
  const css = compileToCSS(rule.styles as StyleObject, {
    ...options,
    scopeSelector: nestedSelector,
  });
  return css || null;
}
function compileDeclarations(
  properties: CSSProperties,
  indent: string,
  newline: string,
  varPrefix?: string,
): string {
  let css = "";
  for (const [prop, value] of Object.entries(properties)) {
    const kebabProp = camelToKebab(prop);

    if (isDynamicValue(value)) {
      const prefix = varPrefix || "chain-dynamic";
      css += `${indent}${kebabProp}: var(--${prefix}-${kebabProp});${newline}`;
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" || typeof item === "number") {
          css += `${indent}${kebabProp}: ${sanitizeCSSValue(String(item))};${newline}`;
        }
      }
      continue;
    }
    if (isCSSPrimitiveValue(value)) {
      css += `${indent}${kebabProp}: ${sanitizeCSSValue(String(value))};${newline}`;
    }
  }
  return css.endsWith(newline) ? css.slice(0, -newline.length) : css;
}
function compileWrapper(
  tag: string,
  inner: string,
  indent: string,
  newline: string,
) {
  if (!inner.trim()) return "";
  return `${tag} {${newline}${safeIndent(inner, indent)}${newline}}`;
}
function compileAtRule(
  rule: AtRule,
  parentSelector: string,
  indent: string,
  newline: string,
  options: InternalCompileOptions,
): string {
  switch (rule.type) {
    case "media": {
      if (!rule.styles) return "";
      const inner = compileToCSS(rule.styles as StyleObject, {
        ...options,
        scopeSelector: parentSelector,
      });
      if (!inner.trim()) return "";
      return compileWrapper(`@media ${rule.query}`, inner, indent, newline);
    }
    case "keyframes": {
      let kf = `@keyframes ${rule.name} {${newline}`;
      for (const [step, props] of Object.entries(rule.steps || {})) {
        kf += `${indent}${step} {${newline}`;
        for (const [p, v] of Object.entries(
          props as Record<string, CSSPrimitiveValue>,
        )) {
          kf += `${indent}${indent}${camelToKebab(p)}: ${sanitizeCSSValue(String(v))};${newline}`;
        }
        kf += `${indent}}${newline}`;
      }
      kf += "}";
      return kf;
    }
    case "font-face": {
      let ff = "@font-face {" + newline;
      for (const [p, v] of Object.entries(rule.properties || {}))
        ff += `${indent}${camelToKebab(p)}: ${sanitizeCSSValue(String(v))};${newline}`;
      ff += "}";
      return ff;
    }
    case "supports":
    case "container":
    case "layer": {
      if (!rule.styles) return "";
      const inner = compileToCSS(rule.styles as StyleObject, {
        ...options,
        scopeSelector: parentSelector,
      });
      if (!inner.trim()) return "";
      const prefix =
        rule.type === "supports"
          ? "@supports"
          : rule.type === "container"
            ? "@container"
            : "@layer";
      const queryStr = rule.query || rule.condition || rule.name || "";
      return compileWrapper(`${prefix} ${queryStr}`.trim(), inner, indent, newline);
    }
    default:
      return "";
  }
}

export function partitionForBuild(
  styleObject: StyleObject,
  options: InternalCompileOptions = {},
  visited = new Set<any>(),
): any {
  try {
    if (visited.has(styleObject))
      throw new Error(`Circular style reference detected`);
    visited.add(styleObject);
    const parsed = parseStyleObject(styleObject as Record<string, unknown>);
    // parseStyleObject already handles _atRules and _nestedRules — no manual extraction needed
    const allNested = parsed.nestedRules || [];
    const allAt = parsed.atRules || [];
    const { static: topStatic, dynamic: topDynamic } = partitionStyles(
      parsed.regularProps,
    );
    const staticNestedRules: NestedRule[] = [];
    const dynamicNestedRules: Record<string, any> = {};
    for (const rule of allNested) {
      const nestedResult = partitionForBuild(
        rule.styles as StyleObject,
        options,
        visited,
      );
      if (nestedResult.hasDynamic)
        dynamicNestedRules[rule.selector] = nestedResult.dynamicValues;
      staticNestedRules.push({
        selector: rule.selector,
        styles: nestedResult.staticObject,
      });
    }
    const staticAtRules: AtRule[] = [];
    const dynamicAtRules: Record<string, any> = {};
    for (const atRule of allAt) {
      if (atRule.styles) {
        const atResult = partitionForBuild(
          atRule.styles as StyleObject,
          options,
          visited,
        );
        if (atResult.hasDynamic) {
          const key = buildAtRuleKey(atRule);
          dynamicAtRules[key] = atResult.dynamicValues;
        }
        staticAtRules.push({
          ...atRule,
          styles: atResult.staticObject,
        });
      } else staticAtRules.push(atRule);
    }
    const staticPseudoClasses: any = {};
    const dynamicPseudoClasses: Record<string, any> = {};
    for (const [pseudo, styles] of Object.entries(parsed.pseudoClasses)) {
      const { static: s, dynamic: d } = partitionStyles(
        styles as CSSProperties,
      );
      if (Object.keys(s).length > 0)
        staticPseudoClasses[pseudo as `&:${string}`] = s as PseudoStyles;
      if (Object.keys(d).length > 0) dynamicPseudoClasses[pseudo] = d;
    }
    const staticStyleObject: StyleObject = {
      ...topStatic,
      ...staticPseudoClasses,
      _atRules: staticAtRules,
      _nestedRules: staticNestedRules,
    };
    if (parsed.selectors) staticStyleObject.selectors = parsed.selectors;
    const css = compileToCSS(staticStyleObject, options);
    const dynamicValues: Record<string, any> = {
      ...topDynamic,
      ...dynamicPseudoClasses,
    };
    if (Object.keys(dynamicNestedRules).length > 0)
      dynamicValues._nestedRules = dynamicNestedRules;
    if (Object.keys(dynamicAtRules).length > 0)
      dynamicValues._atRules = dynamicAtRules;
    const hasDynamic = Object.keys(dynamicValues).length > 0;
    visited.delete(styleObject);
    return { css, dynamicValues, hasDynamic, staticObject: staticStyleObject };
  } catch (error) {
    visited.delete(styleObject);
    const context = options.sourceFile || options.scopeSelector || "unknown";
    throw new Error(
      `[ChainCSS] Failed to partition style for "${context}": ${(error as Error).message}`,
    );
  }
}

export function run(...styleObjects: StyleObject[]): string {
  return styleObjects
    .map((obj) => compileToCSS(obj))
    .filter(Boolean)
    .join('\n\n');
}

// New: transpile — accepts object or spread arguments
export function transpile(...args: StyleObject[]): string {
  const objects = args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0]) && !(args[0] as any).selectors
    ? Object.values(args[0])
    : args;
  
  return run(...(objects as StyleObject[]));
}