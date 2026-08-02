// ============================================================================
// FILE: src/adapters/cli/types.ts
// ============================================================================

import type { ChainCSSConfig as CoreChainCSSConfig } from "@shared/types/index.js";

// Re-export core config for package entry-point consumers
export type ChainCSSConfig = CoreChainCSSConfig;

// ------------------------------------------------------------------
// Base/Shared Options for CLI Commands
// ------------------------------------------------------------------
export interface BaseCLIOptions {
  config?: string;
  verbose?: boolean;
}

export interface CompilerFlags {
  atomic?: boolean;
  minify?: boolean;
  prefix?: boolean;
  sourceMap?: boolean;
}

// ------------------------------------------------------------------
// Core Command Options
// ------------------------------------------------------------------

export interface CLIOptions extends BaseCLIOptions, CompilerFlags {
  input?: string | string[]; // Support single inputs or file arrays
  output?: string;
  watch?: boolean;
  help?: boolean;
  version?: boolean;
}

export interface CompileOptions extends CompilerFlags {
  input: string | string[];
  output: string;
  watch?: boolean;
  verbose?: boolean;
}

export interface BuildOptions extends BaseCLIOptions {
  watch?: boolean;
  atomic?: boolean;
  minify?: boolean;
  persistent?: boolean;
  target?: string;
}

export interface WatchOptions extends BaseCLIOptions {
  atomic?: boolean;
}

export interface DevOptions extends BaseCLIOptions {
  port?: number;
}

// ------------------------------------------------------------------
// Specialized Command Options
// ------------------------------------------------------------------

export interface CacheOptions extends BaseCLIOptions {
  action:
    | "clear"
    | "stats"
    | "prune"
    | "list"
    | "inspect"
    | "delete"
    | "validate"
    | "backup";
  key?: string;
  force?: boolean;
  maxAge?: number;
  maxSize?: number;
  output?: string;
}

export interface TimelineOptions extends BaseCLIOptions {
  action: "list" | "diff" | "changes" | "stats" | "export" | "clear" | "watch";
  snapshot1?: string;
  snapshot2?: string;
  output?: string;
}

export interface InitOptions {
  force?: boolean;
  template?: "full" | "minimal";
  typescript?: boolean; // Cleansed of raw CLI string artifacts
  framework?: "react" | "vue" | "svelte" | "solid";
}

// ------------------------------------------------------------------
// 🆕 Entanglement, Figma, Create & Audit
// ------------------------------------------------------------------

export interface EntanglementOptions extends BaseCLIOptions {
  input?: string;
  output?: string;
  watch?: boolean;
  figma?: boolean;
  fix?: boolean;
  debounceMs?: number;
}

export interface FigmaInitOptions extends BaseCLIOptions {
  repo?: string;
  fileId?: string;
  branch?: string;
  path?: string;
  yes?: boolean;
}

export interface CreateOptions extends BaseCLIOptions {
  template?: "minimal" | "entangled" | "react" | "vue";
  pm?: "npm" | "pnpm" | "yarn" | "bun";
  install?: boolean;
}

export interface AuditOptions extends BaseCLIOptions {
  theme?: string;
  contract?: string;
  failOn?: "warning" | "error" | string;
  target?: number;
  json?: string;
  strict?: boolean;
  fix?: boolean;
  write?: boolean;
}

export interface CheckOptions extends BaseCLIOptions {
  fix?: boolean;
}

// ------------------------------------------------------------------
// CLI Application Parsing & Handlers
// ------------------------------------------------------------------

/**
 * Utility function to cleanly normalize incoming CLI string choices into safe booleans.
 * Use this in your Commander action callbacks before hitting your business logic!
 */
export function normalizeBooleanFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  return false;
}

// Utility type for command handlers
export type CommandHandler<T = any> = (options: T) => Promise<void> | void;

// Structured flag definition for the parser interface
export interface CommandFlag {
  flags: string;
  description: string;
  defaultValue?: string | boolean | number | string[];
}

// CLI command definition
export interface CLICommand {
  name: string;
  description: string;
  options?: CommandFlag[];
  handler: CommandHandler;
}

// Build result type containing web performance metrics
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
    gzippedSize?: number; // Essential for checking compressed network payloads
    savings?: number; // Tracks performance metrics over legacy rulesets
  };
}
