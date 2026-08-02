// ============================================================================
// FILE: src/compiler/pipeline/ir/index.ts
// ============================================================================

// Factory
export * from './factory.js';

// Parser
export { parseIR } from './parser.js';

// CSS Printer
export { generateCSS, compileIR } from './css-printer.js';

// Utilities
export {
  countNodes,
  findRule,
  cloneIR,
  debugIR,
} from './utils.js';

// Types
export type {
  IRNodeId,
  SourceLocation,
  IRDeclaration,
  IRRule,
  IRPseudoClass,
  IRAtRule,
  IRKeyframeFrame, // Added structural frame model type definition
  IRCondition,
  IRTransformRecord,
  StyleIR,
  IRDiagnostic,
} from './types.js';export { buildIRGraph, traverseGraph, findAffectedNodes, getGraphStats } from './graph-builder.js';
export { parseCSSValue, optimizeAST, printAST, isConstant, fromParsedValue, type CSSValueNode } from './css-ast.js';
export { type PassMetadata, initMetadata, setPassMetadata, getPassMetadata, hasPassRun, setIncrementalMeta, markDirty } from './metadata.js';
