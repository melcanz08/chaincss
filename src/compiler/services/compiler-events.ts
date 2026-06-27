// src/compiler/services/compiler-events.ts

/**
 * Compiler Event System — Structured warnings, errors, and diagnostics.
 */

export type CompilerEventType = 'warning' | 'error' | 'info';

export interface CompilerEvent {
  type: CompilerEventType;
  code: string;
  message: string;
  sourceFile?: string;
  originalError?: Error;
  timestamp?: number;
}

export type CompilerEventHandler = (event: CompilerEvent) => void;

/**
 * Create a standard compiler event.
 */
export function createEvent(
  type: CompilerEventType,
  code: string,
  message: string,
  options?: { sourceFile?: string; originalError?: Error }
): CompilerEvent {
  return {
    type,
    code,
    message,
    sourceFile: options?.sourceFile,
    originalError: options?.originalError,
    timestamp: Date.now(),
  };
}