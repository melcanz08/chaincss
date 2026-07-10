// src/compiler/services/compiler-events.ts

/**
 * Compiler Event System — Lifecycle events + warnings/errors/diagnostics.
 * 
 * Lifecycle events:
 *   build:start        — Initial compilation started
 *   build:complete     — All files compiled, CSS + .class.js written
 *   css:written        — CSS file written to disk
 *   classFiles:written — .class.js files written to disk
 *   inspector:written  — chaincss-ir.json written to disk
 *   watch:rebuild      — File changed, recompiled
 *   error              — Compilation error
 */

import { EventEmitter } from 'events';

export type CompilerEventType = 
  | 'warning' | 'error' | 'info'
  | 'build:start' | 'build:complete'
  | 'css:written' | 'classFiles:written' | 'inspector:written'
  | 'watch:rebuild';

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
 * EventEmitter-based compiler events bus.
 * Used by dev.ts to react to build lifecycle without polling.
 */
export class CompilerEvents extends EventEmitter {
  emitBuildStart(fileCount: number): void {
    this.emit('build:start', { fileCount });
  }

  emitBuildComplete(stats: { files: number; duration: number; cssSize: number }): void {
    this.emit('build:complete', stats);
  }

  emitCSSWritten(filePath: string): void {
    this.emit('css:written', { file: filePath });
  }

  emitClassFilesWritten(filePath: string): void {
    this.emit('classFiles:written', { file: filePath });
  }

  emitInspectorWritten(filePath: string): void {
    this.emit('inspector:written', { file: filePath });
  }

  emitWatchRebuild(filePath: string): void {
    this.emit('watch:rebuild', { file: filePath });
  }

  emitError(error: Error, filePath?: string): void {
    this.emit('error', { error, file: filePath });
  }
}

/**
 * Create a standard compiler event (for diagnostics).
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
