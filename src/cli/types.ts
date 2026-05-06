// src/cli/types.ts

import type { ChainCSSConfig as CoreChainCSSConfig } from '../core/types.js';

// Re-export core config
export type ChainCSSConfig = CoreChainCSSConfig;

// CLI-specific options
export interface CLIOptions {
  input?: string;
  output?: string;
  watch?: boolean;
  atomic?: boolean;
  minify?: boolean;
  prefix?: boolean;
  sourceMap?: boolean;
  verbose?: boolean;
  config?: string;
  help?: boolean;
  version?: boolean;
}

export interface CompileOptions {
  input: string;
  output: string;
  watch?: boolean;
  atomic?: boolean;
  minify?: boolean;
  prefix?: boolean;
  sourceMap?: boolean;
  verbose?: boolean;
}

export interface BuildOptions {
  config?: string;
  watch?: boolean;
  verbose?: boolean;
  atomic?: boolean;
  minify?: boolean;
}

export interface WatchOptions {
  config?: string;
  verbose?: boolean;
  atomic?: boolean;
}

export interface CacheOptions {
  action: 'clear' | 'stats' | 'prune' | 'list' | 'inspect' | 'delete' | 'validate' | 'backup';
  key?: string;
  force?: boolean;
  maxAge?: number;
  maxSize?: number;
  output?: string;
  verbose?: boolean;
}

export interface TimelineOptions {
  action: 'list' | 'diff' | 'changes' | 'stats' | 'export' | 'clear' | 'watch';
  snapshot1?: string;
  snapshot2?: string;
  output?: string;
  verbose?: boolean;
}

export interface InitOptions {
  force?: boolean;
  template?: 'full' | 'minimal';
  typescript?: boolean;
  framework?: 'react' | 'vue' | 'svelte' | 'solid';
}

// Utility type for command handlers
export type CommandHandler<T = any> = (options: T) => Promise<void> | void;

// CLI command definition
export interface CLICommand {
  name: string;
  description: string;
  options?: Array<{
    flags: string;
    description: string;
    defaultValue?: any;
  }>;
  handler: CommandHandler;
}

// Build result type
export interface BuildResult {
  success: boolean;
  compiledFiles: number;
  duration: number;
  errors: Error[];
  warnings: string[];
  stats?: {
    totalStyles: number;
    atomicStyles: number;
    cssSize: number;
  };
}