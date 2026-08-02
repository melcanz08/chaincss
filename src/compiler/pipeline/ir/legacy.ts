// ============================================================================
// FILE: src/compiler/pipeline/ir/legacy.ts
// Legacy pass system — deprecated in v3.0. Use Pipeline + CompilerContext.
// ============================================================================

import type { StyleIR } from "./types.js";
import { parseIR } from "./parser.js";
import { generateCSS } from "./css-printer.js";

export type { IRPass } from "./types.js";

export function applyPass(
  ir: StyleIR,
  pass: (ir: StyleIR) => StyleIR,
  passName: string,
): StyleIR {
  const result = pass(ir);
  result.meta.passCount++;
  result.meta.passes.push(passName);
  return result;
}

export function applyPasses(
  ir: StyleIR,
  passes: Array<{ name: string; pass: (ir: StyleIR) => StyleIR }>,
): StyleIR {
  let current = ir;
  for (const { name, pass } of passes) {
    current = applyPass(current, pass, name);
  }
  return current;
}

export function compileViaIR(
  styles: Record<string, any>,
  passes: Array<{ name: string; pass: (ir: StyleIR) => StyleIR }> = [],
  options?: { minify?: boolean; sourceFile?: string },
): { css: string; ir: StyleIR } {
  let ir = parseIR(styles, options?.sourceFile);
  for (const { name, pass } of passes) {
    ir = applyPass(ir, pass, name);
  }
  const css = generateCSS(ir, options);
  return { css, ir };
}
