// src/compiler/services/compiler-events.ts

import { EventEmitter } from "events";

export interface CompilerEventMap {
  "build:start": { fileCount: number };
  "build:complete": { files: number; duration: number; cssSize: number };
  "css:written": { file: string };
  "classFiles:written": { file: string };
  "inspector:written": { file: string };
  "watch:rebuild": { file: string };
  error: { error: Error; file?: string };
  warning: CompilerEvent;
  info: CompilerEvent;
}

export type CompilerEventType = keyof CompilerEventMap;

export interface CompilerEvent {
  type: Extract<CompilerEventType, "warning" | "error" | "info">;
  code: string;
  message: string;
  sourceFile?: string;
  originalError?: Error;
  timestamp: number;
}

export type CompilerEventHandler<K extends keyof CompilerEventMap> = (
  payload: CompilerEventMap[K],
) => void;

// Declaration merging to strongly type Node's built-in EventEmitter
export interface CompilerEvents {
  on<K extends keyof CompilerEventMap>(
    event: K,
    listener: CompilerEventHandler<K>,
  ): this;
  once<K extends keyof CompilerEventMap>(
    event: K,
    listener: CompilerEventHandler<K>,
  ): this;
  off<K extends keyof CompilerEventMap>(
    event: K,
    listener: CompilerEventHandler<K>,
  ): this;
  addListener<K extends keyof CompilerEventMap>(
    event: K,
    listener: CompilerEventHandler<K>,
  ): this;
  removeListener<K extends keyof CompilerEventMap>(
    event: K,
    listener: CompilerEventHandler<K>,
  ): this;
  emit<K extends keyof CompilerEventMap>(
    event: K,
    payload: CompilerEventMap[K],
  ): boolean;
}

export class CompilerEvents extends EventEmitter {
  constructor(options?: { maxListeners?: number }) {
    super();
    if (options?.maxListeners !== undefined) {
      this.setMaxListeners(options.maxListeners);
    }
  }

  emitBuildStart(fileCount: number): void {
    this.emit("build:start", { fileCount });
  }

  emitBuildComplete(stats: {
    files: number;
    duration: number;
    cssSize: number;
  }): void {
    this.emit("build:complete", stats);
  }

  emitCSSWritten(filePath: string): void {
    this.emit("css:written", { file: filePath });
  }

  emitClassFilesWritten(filePath: string): void {
    this.emit("classFiles:written", { file: filePath });
  }

  emitInspectorWritten(filePath: string): void {
    this.emit("inspector:written", { file: filePath });
  }

  emitWatchRebuild(filePath: string): void {
    this.emit("watch:rebuild", { file: filePath });
  }

  emitError(error: Error, filePath?: string): void {
    // Prevent Node process crash if an error event has no listeners attached (e.g. background watch mode)
    if (this.listenerCount("error") === 0) {
      console.error(
        `[ChainCSS Error] ${filePath ? `(${filePath}): ` : ""}${error.stack || error.message}`,
      );
      return;
    }
    this.emit("error", { error, file: filePath });
  }

  emitWarning(event: CompilerEvent): void {
    this.emit("warning", event);
  }

  emitInfo(event: CompilerEvent): void {
    this.emit("info", event);
  }
}

export function createEvent(
  type: Extract<CompilerEventType, "warning" | "error" | "info">,
  code: string,
  message: string,
  options?: { sourceFile?: string; originalError?: Error },
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

export default CompilerEvents;