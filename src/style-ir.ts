// src/style-ir.ts — corrected

export * from './compiler/pipeline/ir/index.js';

// Legacy pass system (separate exports, not merged into the namespace)
export {
  applyPass,
  applyPasses,
  compileViaIR,
} from './compiler/legacy/style-ir.js';

// Type-only export — IRPass goes here
export type { IRPass } from './compiler/legacy/style-ir.js';

// For backward compat with code that does `import styleIR from '...'`
import * as ir from './compiler/pipeline/ir/index.js';
import * as legacy from './compiler/legacy/style-ir.js';

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
  applyPass: legacy.applyPass,
  applyPasses: legacy.applyPasses,
  compileViaIR: legacy.compileViaIR,
};

export default styleIR;