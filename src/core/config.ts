// This file exists for DX only: `import { defineConfig } from 'chaincss'`
// Re-exports the pure defineConfig function. Node-dependent loadConfig/saveConfigTemplate 
// are available from 'chaincss/config' subpath only.

export type { ChainCSSUserConfig, MacroHandler } from '../cli/utils/config-loader.js'

// defineConfig is a pure identity function - safe for browser
function defineConfig(config: any): any {
  return config;
}

export { defineConfig };

// For users who import from 'chaincss/config'
export { defineConfig as default };
