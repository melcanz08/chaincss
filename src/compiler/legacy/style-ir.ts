// src/compiler/legacy/style-ir.ts

/**
 * LEGACY — Pre-pipeline pass system.
 * 
 * This was the original pass infrastructure before the five-stage
 * Pipeline was introduced. It still works but new code should use
 * createPipeline() from './pipeline/unified-pipeline.js'.
 * 
 * Will be removed in v3.0.
 */

import type { StyleIR } from '../pipeline/ir/types.js';
import { parseIR } from '../pipeline/ir/parser.js';
import { generateCSS } from '../pipeline/ir/css-printer.js';

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