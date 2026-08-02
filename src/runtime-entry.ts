// chaincss/runtime - Framework adapters
// Usage: import { useChainStyles } from 'chaincss/runtime'

// Core runtime
export {
  compileToCSS,
  compile as compileRuntime,
  run as runRuntime,
  styleInjector,
  setManifest,
  injectChainStyles,
} from "@frameworks/index.js";

// React
export {
  useChainStyles,
  useChainStylesApplied,
  useDynamicChainStyles,
  ChainCSSGlobal,
  cx,
  withChainStyles,
  enableChainCSSDebug,
  disableChainCSSDebug,
  isDebugEnabled,
  createStyledComponent,
  createStyledComponents,
  useComputedStyles,
} from "@frameworks/index.js";

// Vue
export {
  useChainStylesVue,
  useAtomicClassesVue,
  useComputedStylesVue,
  provideStyleContext,
  injectStyleContext,
  ChainCSSGlobalVue,
  createStyledVueComponent,
  createStyledVueComponents,
} from "@frameworks/index.js";

// Svelte
export {
  useChainStylesSvelte,
  useAtomicClassesSvelte,
  cxSvelte,
  useComputedStylesSvelte,
  provideStyleContextSvelte,
  injectStyleContextSvelte,
  chainStyles,
  ChainCSSGlobalSvelte,
  createStyledSvelteComponent,
  createStyledSvelteComponents,
} from "@frameworks/index.js";

// Solid
export {
  useChainStylesSolid,
  useComputedStylesSolid,
  createStyledComponentSolid,
  cxSolid,
  createStyleContext,
} from "@frameworks/index.js";

// Runtime Types
export type {
  RuntimeStyleDefinition,
  UseChainStylesOptions,
  UseChainStylesReturn,
  RuntimeCompiledResult,
  StyleInjector,
  UseAtomicClassesReturn,
  UseChainStylesReturnVue,
  UseChainStylesReturnSvelte,
  UseChainStylesReturnSolid,
  HMRPayload,
  ChainCSSDebugger,
} from "@frameworks/index.js";
