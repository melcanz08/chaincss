// src/style-ir.ts — canonical IR re-exports + legacy pass system

export * from './compiler/pipeline/ir/index.js';

import type { StyleIR } from './compiler/pipeline/ir/types.js';
import { parseIR } from './compiler/pipeline/ir/parser.js';
import { generateCSS } from './compiler/pipeline/ir/css-printer.js';

// Legacy pass system (moved from compiler/legacy/style-ir.ts)
export type IRPass = (ir: StyleIR) => StyleIR;

export function applyPass(ir: StyleIR, pass: IRPass, passName: string): StyleIR {
  const result = pass(ir);
  result.meta.passCount++;
  result.meta.passes.push(passName);
  return result;
}

export function applyPasses(
  ir: StyleIR, 
  passes: Array<{ name: string; pass: IRPass }>
): StyleIR {
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

// Backward-compat namespace
import * as ir from './compiler/pipeline/ir/index.js';

export const styleIR = {
  createIR: ir.createIR,
  parseIR: ir.parseIR,
  generateCSS: ir.generateCSS,
  createRule: ir.createRule,
  createDeclaration: ir.createDeclaration,
  countNodes: ir.countNodes,
  findRule: ir.findRule,
  cloneIR: ir.cloneIR,
  debugIR: ir.debugIR,
  resetIdCounter: ir.resetIdCounter,
  applyPass,
  applyPasses,
  compileViaIR,
};

export default styleIR;
