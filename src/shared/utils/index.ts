// src/shared/utils/index.ts

// Re-exports from browser-safe and node-safe utilities

export * from './browser.js';

// Node.js utilities (re-export from node.ts)
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
} from './node.js';

// Also re-export common-utils (browser-safe utilities)
export {
  kebabCase,
  camelCase,
  resolveToken,
  processStyleObject,
  extractCSS,
  extractHoverCSS,
  mergeStyles,
  isValidCSSLength,
  isValidCSSColor,
  escapeSelector,
  cleanClassName,
  extractNumericValue,
  extractUnit,
  addUnit,
  sortClassNames,
  cn,
  enableDebug,
  isDebugEnabled,
  debugLog,
} from './common-utils.js';
