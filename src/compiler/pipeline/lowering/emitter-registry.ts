// ============================================================================
// FILE: src/compiler/pipeline/lowering/emitter-registry.ts
// Multi-target emission layer — CSS, Tailwind, Design Tokens, Figma, etc.
// ============================================================================

import type { StyleIR, IRGraph } from "../ir/types.js";
import { generateCSS } from "../ir/css-printer.js";
import { exportGraphAsJSON } from "../ir/graph-builder.js";

// ============================================================================
// Emitter Interface
// ============================================================================

export type EmitterTarget =
  | "css"
  | "atomic-css"
  | "tailwind"
  | "design-tokens"
  | "figma"
  | "react-native"
  | "flutter"
  | "graph-json";

export interface EmitterResult {
  target: EmitterTarget;
  output: string;
  fileName: string;
  contentType: string;
  nodeCount: number;
  bytes: number;
}

export interface Emitter {
  readonly target: EmitterTarget;
  readonly fileName: string;
  readonly contentType: string;
  emit(ir: StyleIR, options?: Record<string, unknown>): string;
}

// ============================================================================
// CSS Emitter
// ============================================================================

export const cssEmitter: Emitter = {
  target: "css",
  fileName: "styles.css",
  contentType: "text/css",

  emit(ir: StyleIR, options?: Record<string, unknown>): string {
    const minify = Boolean(options?.minify);
    const sourceMap = Boolean(options?.sourceMap);

    let css = generateCSS(ir, { minify });

    // Source map injection (non-minified only)
    if (sourceMap && !minify && ir.rules) {
      const liveRules = ir.rules.filter(
        (r) => !r.isDead && r.source?.file && r.selector,
      );
      if (liveRules.length > 0 && css.includes("{")) {
        let injectedCss = css;
        let offset = 0;
        for (const rule of liveRules) {
          const idx = injectedCss.indexOf(rule.selector, offset);
          if (idx !== -1) {
            const file = String(rule.source?.file)
              .replace(/\*\//g, "*\\/")
              .replace(/\n/g, " ");
            const comment = `/* source: ${file} */\n`;
            injectedCss =
              injectedCss.slice(0, idx) + comment + injectedCss.slice(idx);
            offset = idx + comment.length + rule.selector.length;
          }
        }
        css = injectedCss;
      }
    }

    return css.trim();
  },
};

// ============================================================================
// Atomic CSS Emitter
// ============================================================================

export const atomicCSSEmitter: Emitter = {
  target: "atomic-css",
  fileName: "atomic.css",
  contentType: "text/css",

  emit(ir: StyleIR, options?: Record<string, unknown>): string {
    const minify = Boolean(options?.minify);
    const atomicRules = ir.rules.filter(
      (r) =>
        !r.isDead &&
        (r.passMeta?.optimization?.atomic?.isAtomic ||
          (r.meta as { atomic?: boolean })?.atomic),
    );

    if (atomicRules.length === 0) {
      // Fall back to full CSS if no atomic rules extracted
      return cssEmitter.emit(ir, options);
    }

    // Build a minimal IR with only atomic rules
    const atomicIR: StyleIR = {
      ...ir,
      rules: atomicRules,
    };

    return generateCSS(atomicIR, { minify }).trim();
  },
};

// ============================================================================
// Tailwind Emitter (generates tailwind.config.js tokens)
// ============================================================================

export const tailwindEmitter: Emitter = {
  target: "tailwind",
  fileName: "tailwind.config.generated.js",
  contentType: "application/javascript",

  emit(ir: StyleIR, _options?: Record<string, unknown>): string {
    const tokens: Record<string, Record<string, unknown>> = {};

    // Extract design tokens from the graph/symbols
    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      for (const decl of rule.declarations || []) {
        if (decl.property.startsWith("--")) {
          const tokenName = decl.property.replace(/^--/, "").replace(/-/g, ".");
          setNestedValue(tokens, tokenName, decl.value);
        }
      }

      // Extract from passMeta semantic tokens
      const semantic = rule.passMeta?.analysis?.semantic;
      if (semantic?.tokens) {
        for (const token of semantic.tokens) {
          if (typeof token === "string") {
            // Token references stored during lowering
            const resolvedValue = rule.declarations.find((d) =>
              d.history.some((h) => h.reason?.includes(token)),
            )?.value;
            if (resolvedValue) {
              setNestedValue(tokens, token, resolvedValue);
            }
          }
        }
      }
    }

    const config = {
      theme: {
        extend: {
          colors: tokens.colors || tokens.color || {},
          spacing: tokens.spacing || tokens.space || {},
          borderRadius: tokens.borderRadius || tokens.radius || {},
          boxShadow: tokens.boxShadow || tokens.shadows || tokens.shadow || {},
          fontFamily: tokens.fontFamily || tokens.font || {},
          fontSize: tokens.fontSize || {},
        },
      },
    };

    return `// Generated by ChainCSS — Tailwind config\nmodule.exports = ${JSON.stringify(config, null, 2)};\n`;
  },
};

// ============================================================================
// Design Tokens Emitter (JSON)
// ============================================================================

export const designTokensEmitter: Emitter = {
  target: "design-tokens",
  fileName: "design-tokens.json",
  contentType: "application/json",

  emit(ir: StyleIR, _options?: Record<string, unknown>): string {
    const tokens: Record<string, unknown> = {};

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      for (const decl of rule.declarations || []) {
        if (decl.property.startsWith("--")) {
          const path = decl.property.replace(/^--/, "").split("-");
          setNestedValue(tokens, path.join("."), decl.value);
        }
      }

      // Include semantic token relationships from passMeta
      const semantic = rule.passMeta?.analysis?.semantic;
      if (semantic?.tokens && semantic.tokens.length > 0) {
        if (!tokens._relationships) tokens._relationships = [];
        const rels = tokens._relationships as Array<{
          token: string;
          ruleId: string;
          selector: string;
        }>;
        for (const token of semantic.tokens) {
          rels.push({
            token: typeof token === "string" ? token : (token as { name: string }).name,
            ruleId: rule.id,
            selector: rule.selector,
          });
        }
      }
    }

    // Add token derivation info from graph edges
    if (ir.graph) {
      const derivationEdges = ir.graph.edges.filter(
        (e) => e.type === "derives",
      );
      if (derivationEdges.length > 0) {
        if (!tokens._derivations) tokens._derivations = [];
        const ders = tokens._derivations as Array<{
          source: string;
          target: string;
          method?: string;
        }>;
        for (const edge of derivationEdges) {
          const fromNode = ir.graph.nodes.get(edge.from);
          const toNode = ir.graph.nodes.get(edge.to);
          ders.push({
            source: fromNode?.selector || edge.from,
            target: toNode?.selector || edge.to,
            method:
              typeof edge.metadata?.method === "string"
                ? edge.metadata.method
                : undefined,
          });
        }
      }
    }

    return JSON.stringify(tokens, null, 2);
  },
};

// ============================================================================
// Figma Emitter (Figma-compatible tokens JSON)
// ============================================================================

export const figmaEmitter: Emitter = {
  target: "figma",
  fileName: "figma-tokens.json",
  contentType: "application/json",

  emit(ir: StyleIR, _options?: Record<string, unknown>): string {
    const figmaTokens: Record<string, unknown> = {};

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      for (const decl of rule.declarations || []) {
        if (decl.property.startsWith("--")) {
          const name = decl.property.replace(/^--/, "");
          const value = String(decl.value);

          const parts = name.split("-");
          if (value.startsWith("#") || value.startsWith("rgb")) {
            buildFigmaToken(figmaTokens, parts, { value, type: "color" });
          } else if (/^\d+(\.\d+)?(px|rem|em|%|vw|vh)$/.test(value)) {
            buildFigmaToken(figmaTokens, parts, { value, type: "dimension" });
          } else {
            buildFigmaToken(figmaTokens, parts, { value, type: "string" });
          }
        }
      }
    }

    return JSON.stringify(figmaTokens, null, 2);
  },
};

// ============================================================================
// Graph JSON Emitter (for visualization tools)
// ============================================================================

export const graphJSONEmitter: Emitter = {
  target: "graph-json",
  fileName: "chaincss-graph.json",
  contentType: "application/json",

  emit(ir: StyleIR, _options?: Record<string, unknown>): string {
    if (!ir.graph) return "{}";
    const exportData = exportGraphAsJSON(ir.graph, ir);
    return JSON.stringify(exportData, null, 2);
  },
};

// ============================================================================
// Emitter Registry
// ============================================================================

const emitterRegistry = new Map<EmitterTarget, Emitter>();

export function registerEmitter(emitter: Emitter): void {
  emitterRegistry.set(emitter.target, emitter);
}

export function getEmitter(target: EmitterTarget): Emitter | undefined {
  return emitterRegistry.get(target);
}

export function getAvailableTargets(): EmitterTarget[] {
  return Array.from(emitterRegistry.keys());
}

export function emit(
  ir: StyleIR,
  target: EmitterTarget,
  options?: Record<string, unknown>,
): EmitterResult | null {
  const emitter = emitterRegistry.get(target);
  if (!emitter) return null;

  const output = emitter.emit(ir, options);
  const encoder = new TextEncoder();

  return {
    target,
    output,
    fileName: emitter.fileName,
    contentType: emitter.contentType,
    nodeCount: ir.rules.filter((r) => !r.isDead).length,
    bytes: encoder.encode(output).length,
  };
}

export function emitAll(
  ir: StyleIR,
  targets?: EmitterTarget[],
  options?: Record<string, unknown>,
): EmitterResult[] {
  const targetsToUse = targets || getAvailableTargets();
  const results: EmitterResult[] = [];

  for (const target of targetsToUse) {
    const result = emit(ir, target, options);
    if (result) results.push(result);
  }

  return results;
}

// Register built-in emitters
registerEmitter(cssEmitter);
registerEmitter(atomicCSSEmitter);
registerEmitter(tailwindEmitter);
registerEmitter(designTokensEmitter);
registerEmitter(figmaEmitter);
registerEmitter(graphJSONEmitter);

// ============================================================================
// Helpers
// ============================================================================

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function buildFigmaToken(
  obj: Record<string, unknown>,
  pathParts: string[],
  token: { value: string; type: string },
): void {
  let current = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const key = pathParts[i];
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[pathParts[pathParts.length - 1]] = token;
}