// ============================================================================
// FILE: src/compiler/pipeline/lowering/emitter-registry.ts
// Multi-target emission layer — CSS, Tailwind, Design Tokens, Figma, etc.
// ============================================================================

import type { StyleIR, IRGraph } from "../ir/types.js";
import { generateCSS } from "../ir/css-printer.js";
import { exportGraphAsJSON } from "../../incremental/graph-builder.js";

// ============================================================================
// Safe Graph Node Access
// ============================================================================

// Fix #2: Handle both Map and plain-object graph.nodes
function getGraphNode(graph: IRGraph, id: string): any {
  if (!graph?.nodes) return undefined;
  return graph.nodes instanceof Map
    ? graph.nodes.get(id)
    : (graph.nodes as Record<string, any>)[id];
}

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

    const css = generateCSS(ir, { minify });

    // Fix #1: Source map injection via comment prefix per rule's source file.
    // Instead of indexOf(selector) searching (which breaks on .btn vs .btn-primary),
    // we add comments by iterating rules and adding a comment block per source file
    // at the beginning of that file's section. But for now, we just append
    // a source summary comment at the top — no fragile string search.

    if (sourceMap && !minify && ir.rules) {
      const sourceFiles = new Set<string>();
      for (const rule of ir.rules) {
        if (!rule.isDead && rule.source?.file) {
          sourceFiles.add(rule.source.file);
        }
      }

      if (sourceFiles.size > 0) {
        const comments = Array.from(sourceFiles)
          .map((f) => `/* source: ${f.replace(/\*\//g, "*\\/")} */`)
          .join("\n");
        return comments + "\n" + css.trim();
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
      return cssEmitter.emit(ir, options);
    }

    const atomicIR: StyleIR = {
      ...ir,
      rules: atomicRules,
    };

    return generateCSS(atomicIR, { minify }).trim();
  },
};

// ============================================================================
// Tailwind Emitter
// ============================================================================

export const tailwindEmitter: Emitter = {
  target: "tailwind",
  fileName: "tailwind.config.generated.js",
  contentType: "application/javascript",

  emit(ir: StyleIR, _options?: Record<string, unknown>): string {
    const tokens: Record<string, Record<string, unknown>> = {};

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      for (const decl of rule.declarations || []) {
        if (decl.property.startsWith("--")) {
          const tokenName = decl.property.replace(/^--/, "").replace(/-/g, ".");
          setNestedValue(tokens, tokenName, decl.value);
        }
      }

      const semantic = rule.passMeta?.analysis?.semantic;
      if (semantic?.tokens) {
        for (const token of semantic.tokens) {
          if (typeof token === "string") {
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
// Design Tokens Emitter
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
          // Fix #2: Use safe getGraphNode
          const fromNode = getGraphNode(ir.graph, edge.from);
          const toNode = getGraphNode(ir.graph, edge.to);
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
// Figma Emitter
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
// Graph JSON Emitter
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