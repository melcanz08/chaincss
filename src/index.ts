// chaincss/src/index.ts

// Main exports for ChainCSS
export { ChainCSSCompiler, compileChainCSS } from './core/compiler.js';
export { $, recipe, createTokens, configureAtomic, tokens } from './compiler/btt.js';
export { AtomicOptimizer } from './compiler/atomic-optimizer.js';
export { ChainCSSPrefixer } from './compiler/prefixer.js';
export { DesignTokens, createTokens as createTokensUtil, responsive } from './compiler/tokens.js';
export { createThemeContract, validateTheme, createTheme, Theme } from './compiler/theme-contract.js';
export { CacheManager } from './compiler/cache-manager.js';

// Types
export type {
  StyleDefinition,
  AtRule,
  NestedRule,
  ThemeBlock
} from './compiler/btt.js';

export type {
  AtomicClass,
  AtomicOptimizerOptions,
  AtomicOptimizerStats
} from './compiler/atomic-optimizer.js';

export type {
  PrefixerConfig
} from './compiler/prefixer.js';

export type {
  ThemeContract,
  ThemeTokens,
  TokensStructure
} from './compiler/theme-contract.js';

export type {
  ChainCSSConfig,
  CompileResult
} from './core/types.js';