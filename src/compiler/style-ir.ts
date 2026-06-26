/**
 * ChainCSS Intermediate Representation (IR)
 * 
 * @deprecated Import directly from './pipeline/ir/' instead.
 * This file re-exports for backward compatibility and will be simplified in v3.0.
 */

// Import everything from the new ir/ modules
import {
  createDeclaration,
  createRule,
  createIR,
  resetIdCounter,
} from './pipeline/ir/factory.js';

import { parseIR } from './pipeline/ir/parser.js';
import { generateCSS } from './pipeline/ir/css-printer.js';
import {
  countNodes,
  findRule,
  cloneIR,
  debugIR,
} from './pipeline/ir/utils.js';

import type {
  IRNodeId,
  SourceLocation,
  IRDeclaration,
  IRRule,
  IRPseudoClass,
  IRAtRule,
  IRCondition,
  IRTransformRecord,
  StyleIR,
  IRDiagnostic,
} from './pipeline/ir/types.js';

// Re-export everything
export type {
  IRNodeId,
  SourceLocation,
  IRDeclaration,
  IRRule,
  IRPseudoClass,
  IRAtRule,
  IRCondition,
  IRTransformRecord,
  StyleIR,
  IRDiagnostic,
};

export {
  createDeclaration,
  createRule,
  createIR,
  resetIdCounter,
  parseIR,
  generateCSS,
  countNodes,
  findRule,
  cloneIR,
  debugIR,
};

// ============================================================================
// Pass Infrastructure (legacy)
// ============================================================================

export type IRPass = (ir: StyleIR) => StyleIR;

export function applyPass(ir: StyleIR, pass: IRPass, passName: string): StyleIR {
  const result = pass(ir);
  result.meta.passCount++;
  result.meta.passes.push(passName);
  return result;
}

export function applyPasses(ir: StyleIR, passes: Array<{ name: string; pass: IRPass }>): StyleIR {
  let current = ir;
  for (const { name, pass } of passes) {
    current = applyPass(current, pass, name);
  }
  return current;
}

export function compileViaIR(
  styles: Record<string, any>,
  passes: Array<{ name: string; pass: IRPass }> = [],
  options?: { minify?: boolean; sourceFile?: string }
): { css: string; ir: StyleIR } {
  let ir = parseIR(styles, options?.sourceFile);
  for (const { name, pass } of passes) {
    ir = applyPass(ir, pass, name);
  }
  const css = generateCSS(ir, options);
  return { css, ir };
}

export const styleIR = {
  createIR,
  parseIR,
  generateCSS,
  createRule,
  createDeclaration,
  countNodes,
  findRule,
  cloneIR,
  debugIR,
  applyPass,
  applyPasses,
  compileViaIR,
  resetIdCounter,
};

export default styleIR;
