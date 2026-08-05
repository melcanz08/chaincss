// ============================================================================
// FILE: src/compiler/pipeline/ir/index.ts
// ============================================================================

// Factory
export * from "./factory.js";

// Parser
export { parseIR } from "./parser.js";

// CSS Printer
export { generateCSS, compileIR, type CSSPrinterOptions } from "./css-printer.js";

// Utilities
export {
  countNodes,
  findRule,
  cloneIR,
  debugIR,
  recordHistory,
  ensureRuleMeta,
  ensureDeclMeta,
  ensurePassMeta,
  ensureMeta,
} from "./utils.js";

// Types
export type * from "./types.js";

// Graph Builder
export {
  buildIRGraph,
  traverseGraph,
  findAffectedNodes,
  getGraphStats,
} from "./graph-builder.js";

// CSS AST
export {
  parseCSSValue,
  optimizeAST,
  printAST,
  isConstant,
  fromParsedValue,
  type CSSValueNode,
} from "./css-ast.js";

// Metadata
export {
  type PassMetadata,
  initMetadata,
  setPassMetadata,
  getPassMetadata,
  hasPassRun,
  setIncrementalMeta,
  markDirty,
} from "./metadata.js";