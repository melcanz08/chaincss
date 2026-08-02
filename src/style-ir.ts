// ============================================================================
// FILE: src/style-ir.ts
// Backward-compat barrel — deprecated in v3.0.
// Import directly from 'compiler/pipeline/ir/' instead.
// ============================================================================

// Re-export everything from the canonical IR module
export * from "@compiler/pipeline/ir/index.js";

// Legacy pass system
export type { IRPass } from "@compiler/pipeline/ir/types.js";
export {
  applyPass,
  applyPasses,
  compileViaIR,
} from "@compiler/pipeline/ir/legacy.js";

// Named namespace export for backward compat (used by advanced.ts and others)
import * as ir from "./compiler/pipeline/ir/index.js";
import {
  applyPass,
  applyPasses,
  compileViaIR,
} from "@compiler/pipeline/ir/legacy.js";

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
