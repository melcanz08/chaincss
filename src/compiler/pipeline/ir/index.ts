// src/compiler/pipeline/ir/index.ts

// Canonical entry point for the ChainCSS IR.
// Import from 'chaincss/ir' or './pipeline/ir/'.

// Factory
export {
  createDeclaration,
  createRule,
  createIR,
  resetIdCounter,
} from './factory.js';

// Parser
export { parseIR } from './parser.js';

// CSS Printer
export { generateCSS } from './css-printer.js';

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
  IRCondition,
  IRTransformRecord,
  StyleIR,
  IRDiagnostic,
} from './types.js';