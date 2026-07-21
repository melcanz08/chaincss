// ============================================================================
// FILE: src/compiler/pipeline/ir/index.ts
// ============================================================================

// Factory
export {
  createDeclaration,
  createRule,
  createKeyframeFrame, // Added structural frame factory for Phase 2 layouts
  createIR,
  resetIdCounter,
} from './factory.js';

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
} from './types.js';