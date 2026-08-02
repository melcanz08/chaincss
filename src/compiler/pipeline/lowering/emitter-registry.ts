// ============================================================================
// FILE: src/compiler/pipeline/lowering/emitter-registry.ts
// Multi-target emission layer — CSS, Tailwind, Design Tokens, Figma, etc.
// ============================================================================

import type { StyleIR, IRGraph } from '../ir/types.js';
import { generateCSS } from '../ir/css-printer.js';
import { exportGraphAsJSON } from '../ir/graph-builder.js';

// ============================================================================
// Emitter Interface
// ============================================================================

export type EmitterTarget = 'css' | 'atomic-css' | 'tailwind' | 'design-tokens' | 'figma' | 'react-native' | 'flutter' | 'graph-json';

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
  emit(ir: StyleIR, options?: Record<string, any>): string;
}

// ============================================================================
// CSS Emitter
// ============================================================================

export const cssEmitter: Emitter = {
  target: 'css',
  fileName: 'styles.css',
  contentType: 'text/css',

  emit(ir: StyleIR, options?: Record<string, any>): string {
    const minify = options?.minify ?? false;
    const sourceMap = options?.sourceMap ?? false;

    let css = generateCSS(ir, { minify });

    // Source map injection (non-minified only)
    if (sourceMap && !minify && ir.rules) {
      const liveRules = ir.rules.filter(r => !r.isDead && r.source?.file && r.selector);
      if (liveRules.length > 0 && css.includes('{')) {
        let injectedCss = css;
        let offset = 0;
        for (const rule of liveRules) {
          const idx = injectedCss.indexOf(rule.selector, offset);
          if (idx !== -1) {
            const file = String(rule.source?.file).replace(/\*\//g, '*\\/').replace(/\n/g, ' ');
            const comment = `/* source: ${file} */\n`;
            injectedCss = injectedCss.slice(0, idx) + comment + injectedCss.slice(idx);
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
  target: 'atomic-css',
  fileName: 'atomic.css',
  contentType: 'text/css',

  emit(ir: StyleIR, options?: Record<string, any>): string {
    const minify = options?.minify ?? false;
    const atomicRules = ir.rules.filter(r =>
      !r.isDead &&
      (r.passMeta?.optimization?.atomic?.isAtomic || r.meta?.atomic)
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
  target: 'tailwind',
  fileName: 'tailwind.config.generated.js',
  contentType: 'application/javascript',

  emit(ir: StyleIR, _options?: Record<string, any>): string {
    const tokens: Record<string, any> = {};

    // Extract design tokens from the graph/symbols
    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      for (const decl of (rule.declarations || [])) {
        if (decl.property.startsWith('--')) {
          const tokenName = decl.property.replace(/^--/, '').replace(/-/g, '.');
          setNestedValue(tokens, tokenName, decl.value);
        }
      }

      // Extract from passMeta semantic tokens
      const semantic = rule.passMeta?.analysis?.semantic;
      if (semantic?.tokens) {
        for (const token of semantic.tokens) {
          if (typeof token === 'string') {
            // Token references stored during lowering
            const resolvedValue = rule.declarations.find(
              d => d.history.some(h => h.reason?.includes(token))
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
          colors: tokens.colors || {},
          spacing: tokens.spacing || tokens.space || {},
          borderRadius: tokens.borderRadius || {},
          boxShadow: tokens.shadows || tokens.boxShadow || {},
          fontFamily: tokens.fontFamily || {},
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
  target: 'design-tokens',
  fileName: 'design-tokens.json',
  contentType: 'application/json',

  emit(ir: StyleIR, _options?: Record<string, any>): string {
    const tokens: Record<string, any> = {};

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      for (const decl of (rule.declarations || [])) {
        if (decl.property.startsWith('--')) {
          const path = decl.property.replace(/^--/, '').split('-');
          setNestedValue(tokens, path.join('.'), decl.value);
        }
      }

      // Include semantic token relationships from passMeta
      const semantic = rule.passMeta?.analysis?.semantic;
      if (semantic?.tokens && semantic.tokens.length > 0) {
        if (!tokens._relationships) tokens._relationships = [];
        for (const token of semantic.tokens) {
          tokens._relationships.push({
            token: typeof token === 'string' ? token : (token as any).name,
            ruleId: rule.id,
            selector: rule.selector,
          });
        }
      }
    }

    // Add token derivation info from graph edges
    if (ir.graph) {
      const derivationEdges = ir.graph.edges.filter(e => e.type === 'derives');
      if (derivationEdges.length > 0) {
        if (!tokens._derivations) tokens._derivations = [];
        for (const edge of derivationEdges) {
          const fromNode = ir.graph.nodes.get(edge.from);
          const toNode = ir.graph.nodes.get(edge.to);
          tokens._derivations.push({
            source: fromNode?.selector || edge.from,
            target: toNode?.selector || edge.to,
            method: edge.metadata?.method,
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
  target: 'figma',
  fileName: 'figma-tokens.json',
  contentType: 'application/json',

  emit(ir: StyleIR, _options?: Record<string, any>): string {
    const figmaTokens: Record<string, any> = {};

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      for (const decl of (rule.declarations || [])) {
        if (decl.property.startsWith('--')) {
          const name = decl.property.replace(/^--/, '');
          const value = String(decl.value);

          // Figma token format: {"colors": {"primary": {"500": {"value": "#6366f1", "type": "color"}}}}
          if (value.startsWith('#') || value.startsWith('rgb')) {
            const parts = name.split('-');
            buildFigmaToken(figmaTokens, parts, { value, type: 'color' });
          } else if (/^\d+(\.\d+)?(px|rem|em|%|vw|vh)$/.test(value)) {
            const parts = name.split('-');
            buildFigmaToken(figmaTokens, parts, { value, type: 'dimension' });
          } else {
            const parts = name.split('-');
            buildFigmaToken(figmaTokens, parts, { value, type: 'string' });
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
  target: 'graph-json',
  fileName: 'chaincss-graph.json',
  contentType: 'application/json',

  emit(ir: StyleIR, _options?: Record<string, any>): string {
    if (!ir.graph) return '{}';
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

export function emit(ir: StyleIR, target: EmitterTarget, options?: Record<string, any>): EmitterResult | null {
  const emitter = emitterRegistry.get(target);
  if (!emitter) return null;

  const output = emitter.emit(ir, options);
  return {
    target,
    output,
    fileName: emitter.fileName,
    contentType: emitter.contentType,
    nodeCount: ir.rules.filter(r => !r.isDead).length,
    bytes: Buffer.byteLength(output, 'utf8'),
  };
}

export function emitAll(ir: StyleIR, targets?: EmitterTarget[], options?: Record<string, any>): EmitterResult[] {
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

function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function buildFigmaToken(
  obj: Record<string, any>,
  pathParts: string[],
  token: { value: string; type: string }
): void {
  let current = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    if (!current[pathParts[i]]) current[pathParts[i]] = {};
    current = current[pathParts[i]];
  }
  current[pathParts[pathParts.length - 1]] = token;
}