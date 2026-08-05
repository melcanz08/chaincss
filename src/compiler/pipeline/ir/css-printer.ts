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

// ============================================================================
// Helpers & Caching
// ============================================================================

const kebabCache = new Map<string, string>();

/** Convert camelCase property to kebab-case while preserving CSS custom variables */
function kebab(prop: string): string {
  if (prop.startsWith("--")) return prop;
  const cached = kebabCache.get(prop);
  if (cached !== undefined) return cached;
  const result = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
  kebabCache.set(prop, result);
  return result;
}

function formatValue(value: string | number): string {
  return typeof value === "number" ? String(value) : value;
}

function hasValue(d: IRDeclaration): boolean {
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

/** Resolve pseudo selector across multi-selector groups */
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
// Emission Context (Deduplication & Formatting state)
// ============================================================================

export interface CSSPrinterOptions {
  minify?: boolean;
}

class EmissionContext {
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
  const lines: string[] = new Array(declarations.length);
  for (let i = 0; i < declarations.length; i++) {
    const d = declarations[i];
    lines[i] = `${ctx.indent}${kebab(d.property)}:${ctx.space}${formatValue(d.value)};`;
  }
  return `${selector}${ctx.space}{${ctx.nl}${lines.join(ctx.nl)}${ctx.nl}}`;
}

function emitIndented(inner: string, ctx: EmissionContext): string {
  if (ctx.minify || !ctx.nl) return inner;
  const lines = inner.split("\n");
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
      return `@supports ${atRule.query || ""} {${ctx.nl}${emitIndented(inner, ctx)}${ctx.nl}}`;
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
      return `@container ${atRule.query || ""} {${ctx.nl}${emitIndented(inner, ctx)}${ctx.nl}}`;
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
      const signature = activeDecls.map((d) => `${d.property}:${d.value}`).join(";");
      if (ctx.emittedFontFaces.has(signature)) return "";
      ctx.emittedFontFaces.add(signature);

      const lines = new Array(activeDecls.length);
      for (let i = 0; i < activeDecls.length; i++) {
        const d = activeDecls[i];
        lines[i] = `${ctx.indent}${kebab(d.property)}:${ctx.space}${formatValue(d.value)};`;
      }
      return `@font-face {${ctx.nl}${lines.join(ctx.nl)}${ctx.nl}}`;
    }

    case "keyframes": {
      if (!atRule.keyframes || atRule.keyframes.length === 0) return "";
      const name = atRule.name || "unnamed";
      if (ctx.emittedKeyframes.has(name)) return "";
      ctx.emittedKeyframes.add(name);

      return emitKeyframesStructural(name, atRule.keyframes, ctx);
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
    for (let j = 0; j < activeDecls.length; j++) {
      const decl = activeDecls[j];
      css += `${ctx.indent}${ctx.indent}${kebab(decl.property)}:${ctx.space}${formatValue(decl.value)};${ctx.nl}`;
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
  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
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