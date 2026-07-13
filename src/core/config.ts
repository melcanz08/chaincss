// src/core/config.ts 
// This file exists for DX only: `import { defineConfig } from 'chaincss'`
// It re-exports everything from the single source of truth in cli/utils/config-loader.ts
// Do NOT duplicate loading logic here.

export type { ChainCSSUserConfig, MacroHandler } from '../cli/utils/config-loader.js'
export { defineConfig, loadConfig, saveConfigTemplate } from '../cli/utils/config-loader.js'

// For users who import from 'chaincss/config'
export { defineConfig as default } from '../cli/utils/config-loader.js'
