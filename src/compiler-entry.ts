// src/compiler-entry.ts

// chaincss/compiler - Compiler APIs
// Usage: import { compileToCSS, run } from 'chaincss/compiler'

// Style Compiler
export {
  compileToCSS,
  partitionForBuild,
  run,
} from "@core/usecases/style-compiler.js";
export {
  classifyValue,
  partitionStyles,
  hasDynamicValues,
} from "@core/usecases/value-classifier.js";
export type { ValueClass } from "@core/usecases/value-classifier.js";

// Tokens
export { defaultTokens } from "@compiler/tokens/tokens.js";
export type { DesignTokens } from "@compiler/tokens/tokens.js";
export type { ThemeContract as themeContract } from "@compiler/tokens/theme-contract.js";

// Recipe
export { recipe } from "@compiler/recipe.js";

// Node.js utilities (file system, etc.)
export {
  writeFile,
  writeFileAsync,
  readFile,
  fileExists,
  ensureDir,
  ensureDirAsync,
  getFileExtension,
  getBaseName,
  getDirName,
  resolvePath,
  isDirectory,
  getAllFiles,
  getMemoryUsage,
  formatBytes,
} from "@shared/utils/node.js";

export { ChainCSSCompiler, createPipeline } from "@compiler/index.js";
