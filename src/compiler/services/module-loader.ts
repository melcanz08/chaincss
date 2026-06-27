// src/compiler/services/module-loader.ts

/**
 * Module Loader — Handles dynamic imports and dependency tracking.
 * 
 * v2.8.6: Replaced Node's dynamic import() with direct file evaluation
 * to avoid ESM bundling issues with the $ Proxy.
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

export class ModuleLoader {
  private importedModules = new Map<string, { timestamp: number; hash: string }>();
  private dependencyGraph = new Map<string, Set<string>>();

  /**
   * Import a module from the given file path.
   * Uses createRequire for CJS and dynamic import for ESM as fallback.
   */
  async import(filePath: string): Promise<Record<string, any>> {
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    
    try {
      if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
        throw new Error(`Component file ${path.basename(filePath)} will be processed by scanner`);
      }
      
      // Try CJS require first (works reliably regardless of bundling)
      const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
      
      // Invalidate Node's require cache so we always get fresh content
      delete projectRequire.cache[projectRequire.resolve(absolutePath)];
      
      const imported = projectRequire(absolutePath);
      
      // Track the import
      const stat = fs.statSync(absolutePath);
      this.importedModules.set(absolutePath, {
        timestamp: stat.mtimeMs,
        hash: '',
      });
      
      return imported.default && typeof imported.default === 'object'
        ? { ...imported.default, ...imported }
        : imported;
    } catch (error: any) {
      // Fallback to dynamic import for ESM files
      if (error.code === 'ERR_REQUIRE_ESM') {
        try {
          const fileUrl = pathToFileURL(absolutePath).href;
          const imported = await import(fileUrl);
          
          const stat = fs.statSync(absolutePath);
          this.importedModules.set(absolutePath, {
            timestamp: stat.mtimeMs,
            hash: '',
          });
          
          return imported.default && typeof imported.default === 'object'
            ? { ...imported.default, ...imported }
            : imported;
        } catch (importError: any) {
          importError.message = `Failed to import ${path.basename(filePath)}: ${importError.message}`;
          throw importError;
        }
      }
      
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