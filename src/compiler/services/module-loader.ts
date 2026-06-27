// src/compiler/services/module-loader.ts

/**
 * Module Loader — Handles dynamic imports and dependency tracking.
 * Extracted from ChainCSSCompiler for separation of concerns.
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export class ModuleLoader {
  private importedModules = new Map<string, { timestamp: number; hash: string }>();
  private dependencyGraph = new Map<string, Set<string>>();

  /**
   * Import a module from the given file path.
   * Handles caching, cache-busting, and dependency tracking.
   */
  async import(filePath: string): Promise<Record<string, any>> {
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    
    const fileUrl = pathToFileURL(absolutePath).href;
    
    try {
      if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        throw new Error(`Component file ${path.basename(filePath)} will be processed by scanner`);
      }
      
      // Cache-bust with timestamp for development
      const moduleId = `${fileUrl}?t=${Date.now()}`;
      const imported = await import(/* @vite-ignore */ moduleId);
      
      // Track the import
      const stat = fs.statSync(absolutePath);
      this.importedModules.set(absolutePath, {
        timestamp: stat.mtimeMs,
        hash: '', // Could compute content hash here for cache validation
      });
      
      return imported.default && typeof imported.default === 'object'
        ? { ...imported.default, ...imported }
        : imported;
    } catch (error: any) {
      error.message = `Failed to import ${path.basename(filePath)}: ${error.message}`;
      throw error;
    }
  }

  /**
   * Check if a module has changed since last import.
   */
  hasChanged(filePath: string): boolean {
    const absolutePath = path.resolve(filePath);
    const cached = this.importedModules.get(absolutePath);
    if (!cached) return true;
    
    try {
      const stat = fs.statSync(absolutePath);
      return stat.mtimeMs > cached.timestamp;
    } catch {
      return true;
    }
  }

  /**
   * Add a dependency relationship between two modules.
   */
  addDependency(parent: string, child: string): void {
    if (!this.dependencyGraph.has(parent)) {
      this.dependencyGraph.set(parent, new Set());
    }
    this.dependencyGraph.get(parent)!.add(child);
  }

  /**
   * Get all dependencies for a module (recursive).
   */
  getDependencies(filePath: string): Set<string> {
    const visited = new Set<string>();
    const collect = (fp: string) => {
      if (visited.has(fp)) return;
      visited.add(fp);
      const deps = this.dependencyGraph.get(fp);
      if (deps) {
        for (const dep of deps) {
          collect(dep);
        }
      }
    };
    collect(filePath);
    return visited;
  }

  /**
   * Clear all cached modules.
   */
  clear(): void {
    this.importedModules.clear();
    this.dependencyGraph.clear();
  }
}