// ============================================================================
// FILE: src/compiler/pipeline/ir/css-printer.ts
// ============================================================================

import type {
  StyleIR,
  IRRule,
  IRDeclaration,
  IRAtRule,
  IRKeyframeFrame,
  IRCondition,
} from "./types.js";
import { tokens as globalTokens } from "../../tokens/tokens.js";

// Fix #1: Import normalizeProperty from shared utils for consistent kebab-casing
function normalizeProperty(prop: string): string {
  if (prop.startsWith("--")) return prop;
  if (!/[A-Z]/.test(prop)) return prop;
  const needsLeadingDash = /^[A-Z]/.test(prop) || /^ms[A-Z]/.test(prop);
  const kebabed = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
  return needsLeadingDash
    ? kebabed.startsWith("-")
      ? kebabed
      : "-" + kebabed
    : kebabed;
}

// ============================================================================
// Helpers & Caching
// ============================================================================

const kebabCache = new Map<string, string>();
const KEBAB_CACHE_LIMIT = 1000;

/** Convert camelCase property to kebab-case while preserving CSS custom variables */
function kebab(prop: string): string {
  if (prop.startsWith("--")) return prop;
  if (kebabCache.has(prop)) return kebabCache.get(prop)!;
  // Fix #1: Use normalizeProperty for consistent msTransform handling
  const result = normalizeProperty(prop);
  // Fix #7: LRU eviction
  if (kebabCache.size >= KEBAB_CACHE_LIMIT) {
    const firstKey = kebabCache.keys().next().value as string | undefined;
    if (firstKey) kebabCache.delete(firstKey);
  }
  kebabCache.set(prop, result);
  return result;
}

// Fix #4: Array fallback values — emit multiple declarations
function formatValues(value: string | number | (string | number)[]): (string | number)[] {
  return Array.isArray(value) ? value : [value];
}

function formatValue(value: string | number): string {
  return typeof value === "number" ? String(value) : value;
}

function hasValue(d: IRDeclaration): boolean {
  if (d.dynamic) return true;
  if (Array.isArray(d.value)) return d.value.length > 0;
  return d.value !== undefined && d.value !== null && d.value !== "";
}

/** Split comma-separated selector lists respecting quotes and parentheses */
function splitSelectors(selector: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;
  let inQuote: string | null = null;

  for (let i = 0; i < selector.length; i++) {
    const char = selector[i];
    if (inQuote) {
      current += char;
      if (char === inQuote && selector[i - 1] !== "\\") inQuote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      inQuote = char;
      current += char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth--;

    if (char === "," && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function resolvePseudoSelector(parentSelector: string, pseudoName: string): string {
  const parents = splitSelectors(parentSelector);
  const isAmpersand = pseudoName.includes("&");

  return parents
    .map((parent) => {
      if (isAmpersand) {
        return pseudoName.replace(/&/g, parent);
      }
      const needsColon = !pseudoName.startsWith(":") && !pseudoName.startsWith("[");
      return `${parent}${needsColon ? ":" : ""}${pseudoName}`;
    })
    .join(", ");
}

// ============================================================================
// Emission Context
// ============================================================================

export interface CSSPrinterOptions {
  minify?: boolean;
}

class EmissionContext {
  // Fix #3: Keyframe dedup by name + content hash, not just name
  emittedKeyframes = new Set<string>();
  emittedFontFaces = new Set<string>();
  indent: string;
  nl: string;
  space: string;
  minify: boolean;

  constructor(options?: CSSPrinterOptions) {
    this.minify = options?.minify ?? false;
    this.nl = this.minify ? "" : "\n";
    this.indent = this.minify ? "" : "  ";
    this.space = this.minify ? "" : " ";
  }
}

// ============================================================================
// Main Generator Entry Point
// ============================================================================

export function generateCSS(ir: StyleIR, options?: CSSPrinterOptions): string {
  const ctx = new EmissionContext(options);
  const parts: string[] = [];

  // Emit global styles first (from reset intent)
  const globalCSS = emitGlobalStyles(ir, ctx);
  if (globalCSS) {
    parts.push(globalCSS);
  }

  // NEW: Emit token CSS variables before component styles
  const tokenVariables = emitTokenVariables(ir, ctx);
  if (tokenVariables) {
    parts.push(tokenVariables);
  }

  for (let i = 0; i < ir.rules.length; i++) {
    const rule = ir.rules[i];
    if (rule.isDead) continue;
    const ruleCSS = emitRule(rule, ctx);
    if (ruleCSS) parts.push(ruleCSS);
  }

  return parts.join(ctx.minify ? "" : "\n\n");
}

export function compileIR(ir: StyleIR, minify: boolean = false): string {
  return generateCSS(ir, { minify });
}

function emitGlobalStyles(ir: StyleIR, ctx: EmissionContext): string {
  const globalStyles = (ir.meta as any)?.globalStyles as
    | Record<string, Record<string, string | number>>
    | undefined;
    
  if (!globalStyles || Object.keys(globalStyles).length === 0) return '';
  
  const parts: string[] = [];
  
  for (const [selector, styles] of Object.entries(globalStyles)) {
    const declarations: IRDeclaration[] = Object.entries(styles as Record<string, string | number>).map(([prop, value], index) => ({
      id: `global-${selector}-${prop}-${index}`,
      property: prop,
      value: value,
      source: { file: "__global__", line: 0, column: 0 },
      history: [],
    }));
    
    if (declarations.length > 0) {
      parts.push(emitDeclBlock(selector, declarations, ctx));
    }
  }
  
  return parts.join(ctx.minify ? "" : "\n\n");
}

function emitTokenVariables(ir: StyleIR, ctx: EmissionContext): string {
  const tokenVarNames = new Set<string>();

  // Collect all var(--token-*) references from declarations
  const collectVars = (rules: IRRule[]) => {
    for (const rule of rules) {
      // Regular declarations
      for (const decl of rule.declarations || []) {
        collectVarsFromDeclaration(decl, tokenVarNames);
      }

      // Pseudo-class declarations
      for (const pc of rule.pseudoClasses || []) {
        for (const decl of pc.declarations || []) {
          collectVarsFromDeclaration(decl, tokenVarNames);
        }
      }

      // Nested rules
      if (rule.nestedRules && rule.nestedRules.length > 0) {
        collectVars(rule.nestedRules);
      }
    }
  };

  collectVars(ir.rules);

  if (tokenVarNames.size === 0) return "";

  // Resolve each variable name back to its token value
  const lines: string[] = [];
  for (const varName of tokenVarNames) {
    // Convert --colors-gray-100 → colors.gray.100
    const tokenPath = varName.replace(/-/g, ".");
    const value = globalTokens.get(tokenPath);
    if (value) {
      lines.push(`${ctx.indent}--${varName}: ${value};`);
    }
  }

  if (lines.length === 0) return "";

  return `:root {${ctx.nl}${lines.join(ctx.nl)}${ctx.nl}}`;
}

function collectVarsFromDeclaration(
  decl: IRDeclaration,
  tokenVarNames: Set<string>,
): void {
  const value = String(decl.value || "");
  const regex = /var\(--([a-zA-Z0-9-]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    tokenVarNames.add(match[1]);
  }
}

// ============================================================================
// Emitters
// ============================================================================

function emitRule(rule: IRRule, ctx: EmissionContext): string {
  const parts: string[] = [];
  const activeDecls: IRDeclaration[] = [];

  for (let i = 0; i < rule.declarations.length; i++) {
    const d = rule.declarations[i];
    if (hasValue(d)) activeDecls.push(d);
  }

  if (activeDecls.length > 0) {
    parts.push(emitDeclBlock(rule.selector, activeDecls, ctx));
  }

  for (let i = 0; i < rule.pseudoClasses.length; i++) {
    const pc = rule.pseudoClasses[i];
    const pcDecls: IRDeclaration[] = [];
    for (let j = 0; j < pc.declarations.length; j++) {
      const d = pc.declarations[j];
      if (hasValue(d)) pcDecls.push(d);
    }
    if (pcDecls.length === 0) continue;

    const resolvedSelector = resolvePseudoSelector(rule.selector, pc.name);
    parts.push(emitDeclBlock(resolvedSelector, pcDecls, ctx));
  }

  for (let i = 0; i < rule.atRules.length; i++) {
    const atRule = rule.atRules[i];
    const atCSS = emitAtRule(rule.selector, atRule, ctx);
    if (atCSS) parts.push(atCSS);
  }

  for (let i = 0; i < rule.nestedRules.length; i++) {
    const nested = rule.nestedRules[i];
    if (nested.isDead) continue;
    const nestedCSS = emitRule(nested, ctx);
    if (nestedCSS) parts.push(nestedCSS);
  }

  if (rule.conditions.length > 0) {
    const condCSS = emitConditions(rule.selector, rule.conditions, ctx);
    if (condCSS) parts.push(condCSS);
  }

  return parts.join(ctx.minify ? "" : "\n\n");
}

function emitDeclBlock(
  selector: string,
  declarations: IRDeclaration[],
  ctx: EmissionContext,
): string {
  const lines: string[] = [];

  for (let i = 0; i < declarations.length; i++) {
    const d = declarations[i];
    // Fix #6: var() with fallback for SSR safety
    const value = d.dynamic ? `var(${d.dynamic.variable})` : null;

    // Fix #4: Array fallback values emit multiple lines
    const values = value !== null
      ? [value]
      : formatValues(d.value as string | number | (string | number)[]);

    for (const v of values) {
      lines.push(
        `${ctx.indent}${kebab(d.property)}:${ctx.space}${formatValue(v as string | number)};`,
      );
    }
  }

  return `${selector}${ctx.space}{${ctx.nl}${lines.join(ctx.nl)}${ctx.nl}}`;
}

// Fix #5: Handle Windows \r\n
function emitIndented(inner: string, ctx: EmissionContext): string {
  if (ctx.minify || !ctx.nl) return inner;
  const lines = inner.split(/\r?\n/);
  const indented: string[] = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    indented[i] = lines[i] ? ctx.indent + lines[i] : lines[i];
  }
  return indented.join(ctx.nl);
}

function emitAtRule(
  parentSelector: string,
  atRule: IRAtRule,
  ctx: EmissionContext,
): string {
  const activeDecls: IRDeclaration[] = [];
  for (let i = 0; i < atRule.declarations.length; i++) {
    const d = atRule.declarations[i];
    if (hasValue(d)) activeDecls.push(d);
  }

  switch (atRule.type) {
    case "media": {
      if (activeDecls.length === 0 && (!atRule.nestedRules || atRule.nestedRules.length === 0)) {
        return "";
      }
      let inner = "";
      if (activeDecls.length > 0) {
        inner += emitDeclBlock(parentSelector, activeDecls, ctx);
      }
      if (atRule.nestedRules) {
        for (let i = 0; i < atRule.nestedRules.length; i++) {
          const nested = atRule.nestedRules[i];
          if (nested.isDead) continue;
          const nestedCSS = emitRule(nested, ctx);
          if (nestedCSS) {
            inner += (inner ? (ctx.minify ? "" : "\n\n") : "") + nestedCSS;
          }
        }
      }
      if (!inner.trim()) return "";
      return `@media ${atRule.query} {${ctx.nl}${emitIndented(inner, ctx)}${ctx.nl}}`;
    }

    case "supports": {
      if (activeDecls.length === 0 && !atRule.nestedRules?.length) return "";
      let inner = activeDecls.length ? emitDeclBlock(parentSelector, activeDecls, ctx) : "";
      if (atRule.nestedRules) {
        for (let i = 0; i < atRule.nestedRules.length; i++) {
          const c = emitRule(atRule.nestedRules[i], ctx);
          if (c) inner += (inner ? (ctx.minify ? "" : "\n\n") : "") + c;
        }
      }
      const query = atRule.query || "";
      return `@supports${query ? ` ${query}` : ""} {${ctx.nl}${emitIndented(inner, ctx)}${ctx.nl}}`;
    }

    case "container": {
      if (activeDecls.length === 0 && !atRule.nestedRules?.length) return "";
      let inner = activeDecls.length ? emitDeclBlock(parentSelector, activeDecls, ctx) : "";
      if (atRule.nestedRules) {
        for (let i = 0; i < atRule.nestedRules.length; i++) {
          const c = emitRule(atRule.nestedRules[i], ctx);
          if (c) inner += (inner ? (ctx.minify ? "" : "\n\n") : "") + c;
        }
      }
      const query = atRule.query || "";
      return `@container${query ? ` ${query}` : ""} {${ctx.nl}${emitIndented(inner, ctx)}${ctx.nl}}`;
    }

    case "layer": {
      const hasNested = atRule.nestedRules && atRule.nestedRules.length > 0;
      if (activeDecls.length === 0 && !hasNested) return "";

      let inner = activeDecls.length ? emitDeclBlock(parentSelector, activeDecls, ctx) : "";
      if (atRule.nestedRules) {
        for (let i = 0; i < atRule.nestedRules.length; i++) {
          const c = emitRule(atRule.nestedRules[i], ctx);
          if (c) inner += (inner ? (ctx.minify ? "" : "\n\n") : "") + c;
        }
      }
      return `@layer ${atRule.name || ""} {${ctx.nl}${emitIndented(inner, ctx)}${ctx.nl}}`;
    }

    case "font-face": {
      if (activeDecls.length === 0) return "";
      // Fix #2: Sort declarations for order-independent dedup
      const signature = activeDecls
        .slice()
        .sort((a, b) => a.property.localeCompare(b.property))
        .map((d) => `${d.property}:${d.value}`)
        .join(";");
      if (ctx.emittedFontFaces.has(signature)) return "";
      ctx.emittedFontFaces.add(signature);

      const lines: string[] = [];
      for (const d of activeDecls) {
        const values = formatValues(d.value as string | number | (string | number)[]);
        for (const v of values) {
          lines.push(
            `${ctx.indent}${kebab(d.property)}:${ctx.space}${formatValue(v as string | number)};`,
          );
        }
      }
      return `@font-face {${ctx.nl}${lines.join(ctx.nl)}${ctx.nl}}`;
    }

    case "keyframes": {
      if (!atRule.keyframes || atRule.keyframes.length === 0) return "";
      const name = atRule.name || "unnamed";
      // Fix #3: Dedup by name + content hash
      const contentStr = atRule.keyframes
        .map((f) => f.keyText + f.declarations.map((d) => `${d.property}:${d.value}`).join(","))
        .join("|");
      const key = `${name}:${contentStr}`;
      if (ctx.emittedKeyframes.has(key)) return "";
      ctx.emittedKeyframes.add(key);

      return emitKeyframesStructural(name, atRule.keyframes, ctx);
    }

    case "scope": {
      const query = atRule.query || "";
      let inner = activeDecls.length ? emitDeclBlock(parentSelector, activeDecls, ctx) : "";
      if (atRule.nestedRules) {
        for (let i = 0; i < atRule.nestedRules.length; i++) {
          const c = emitRule(atRule.nestedRules[i], ctx);
          if (c) inner += (inner ? (ctx.minify ? "" : "\n\n") : "") + c;
        }
      }
      if (!inner && !query) return "";
      return `@scope${query ? ` ${query}` : ""} {${ctx.nl}${emitIndented(inner, ctx)}${ctx.nl}}`;
    }

    case "starting-style": {
      const query = atRule.query || "";
      let inner = activeDecls.length ? emitDeclBlock(parentSelector, activeDecls, ctx) : "";
      if (atRule.nestedRules) {
        for (let i = 0; i < atRule.nestedRules.length; i++) {
          const c = emitRule(atRule.nestedRules[i], ctx);
          if (c) inner += (inner ? (ctx.minify ? "" : "\n\n") : "") + c;
        }
      }
      if (!inner && !query) return "";
      return `@starting-style${query ? ` ${query}` : ""} {${ctx.nl}${emitIndented(inner, ctx)}${ctx.nl}}`;
    }

    case "view-transition": {
      const name = atRule.name || "";
      let inner = activeDecls.length ? emitDeclBlock(parentSelector, activeDecls, ctx) : "";
      if (atRule.nestedRules) {
        for (let i = 0; i < atRule.nestedRules.length; i++) {
          const c = emitRule(atRule.nestedRules[i], ctx);
          if (c) inner += (inner ? (ctx.minify ? "" : "\n\n") : "") + c;
        }
      }
      if (!inner && !name) return "";
      return `@view-transition${name ? ` ${name}` : ""} {${ctx.nl}${emitIndented(inner, ctx)}${ctx.nl}}`;
    }

    case "property": {
      if (activeDecls.length === 0) return "";
      const name = atRule.name || "";
      const lines: string[] = [];
      for (const d of activeDecls) {
        const values = formatValues(d.value as string | number | (string | number)[]);
        for (const v of values) {
          lines.push(
            `${ctx.indent}${kebab(d.property)}:${ctx.space}${formatValue(v as string | number)};`,
          );
        }
      }
      return `@property ${name} {${ctx.nl}${lines.join(ctx.nl)}${ctx.nl}}`;
    }

    case "counter-style": {
      if (activeDecls.length === 0) return "";
      const name = atRule.name || "";
      const lines: string[] = [];
      for (const d of activeDecls) {
        const values = formatValues(d.value as string | number | (string | number)[]);
        for (const v of values) {
          lines.push(
            `${ctx.indent}${kebab(d.property)}:${ctx.space}${formatValue(v as string | number)};`,
          );
        }
      }
      return `@counter-style ${name} {${ctx.nl}${lines.join(ctx.nl)}${ctx.nl}}`;
    }

    case "page": {
      if (activeDecls.length === 0) return "";
      const query = atRule.query || "";
      const lines: string[] = [];
      for (const d of activeDecls) {
        const values = formatValues(d.value as string | number | (string | number)[]);
        for (const v of values) {
          lines.push(
            `${ctx.indent}${kebab(d.property)}:${ctx.space}${formatValue(v as string | number)};`,
          );
        }
      }
      return `@page${query ? ` ${query}` : ""} {${ctx.nl}${lines.join(ctx.nl)}${ctx.nl}}`;
    }

    case "import": {
      const url = atRule.query || "";
      const mediaQuery = atRule.name || "";
      return `@import ${url}${mediaQuery ? ` ${mediaQuery}` : ""};`;
    }

    case "namespace": {
      const url = atRule.query || "";
      const prefix = atRule.name || "";
      return `@namespace${prefix ? ` ${prefix}` : ""} ${url};`;
    }

    default: {
      const name = atRule.type || "unknown";
      const query = atRule.query || atRule.name || "";
      let inner = activeDecls.length ? emitDeclBlock(parentSelector, activeDecls, ctx) : "";
      if (atRule.nestedRules) {
        for (let i = 0; i < atRule.nestedRules.length; i++) {
          const c = emitRule(atRule.nestedRules[i], ctx);
          if (c) inner += (inner ? (ctx.minify ? "" : "\n\n") : "") + c;
        }
      }
      if (!inner && !query) return "";
      const body = inner ? `${ctx.nl}${emitIndented(inner, ctx)}${ctx.nl}` : "";
      return `@${name} ${query}${ctx.space}{${body}}`;
    }
  }
}

function emitKeyframesStructural(
  name: string,
  frames: IRKeyframeFrame[],
  ctx: EmissionContext,
): string {
  let css = `@keyframes ${name}${ctx.space}{${ctx.nl}`;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const activeDecls: IRDeclaration[] = [];
    for (let j = 0; j < frame.declarations.length; j++) {
      const d = frame.declarations[j];
      if (hasValue(d)) activeDecls.push(d);
    }
    if (activeDecls.length === 0) continue;

    css += `${ctx.indent}${frame.keyText}${ctx.space}{${ctx.nl}`;
    for (const decl of activeDecls) {
      const values = formatValues(decl.value as string | number | (string | number)[]);
      for (const v of values) {
        css += `${ctx.indent}${ctx.indent}${kebab(decl.property)}:${ctx.space}${formatValue(v as string | number)};${ctx.nl}`;
      }
    }
    css += `${ctx.indent}}${i === frames.length - 1 ? "" : ctx.nl}`;
  }

  css += `${ctx.minify ? "" : ctx.nl}}`;
  return css;
}

function emitConditions(
  selector: string,
  conditions: IRCondition[],
  ctx: EmissionContext,
): string {
  const parts: string[] = [];
  for (const cond of conditions) {
    const entries = Object.entries(cond.conditions);
    if (entries.length === 0) continue;

    const clauses = entries
      .map(([c, v]) => `style(${cond.variable}:${ctx.space}${c}):${ctx.space}${v}`)
      .join("; else: ");
    const result = `if(${clauses}; else:${ctx.space}${cond.defaultValue})`;
    parts.push(`${ctx.indent}${kebab(cond.property)}:${ctx.space}${result};`);
  }
  if (parts.length === 0) return "";
  return `${selector}${ctx.space}{${ctx.nl}${parts.join(ctx.nl)}${ctx.nl}}`;
}