// src/compiler/services/module-loader.ts
// Adds jiti for TS, content hash for change detection, and safer require cache handling

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

export class ModuleLoader {
  private importedModules = new Map<string, { timestamp: number; hash: string; size: number }>();
  private dependencyGraph = new Map<string, Set<string>>();

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private async loadWithJiti(filePath: string): Promise<any | null> {
    try {
      const jitiMod: any = await import('jiti').catch(() => null);
      const createJiti = jitiMod?.createJiti || jitiMod?.default?.createJiti || jitiMod?.default;
      if (!createJiti) return null;
      const jiti = createJiti(process.cwd(), { interopDefault: true, fsCache: false, moduleCache: false });
      return await jiti.import(filePath, { default: true });
    } catch { return null; }
  }

  async import(filePath: string): Promise<Record<string, any>> {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) throw new Error(`File not found: ${absolutePath}`);
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      throw new Error(`Component file ${path.basename(filePath)} will be processed by scanner`);
    }

    // v3.2: try jiti first for .ts/.mts/.cts — avoids ESM/CJS issues with $ Proxy
    if (/\.(ts|mts|cts|js|cjs|mjs)$/.test(absolutePath)) {
      const jitiResult = await this.loadWithJiti(absolutePath);
      if (jitiResult) {
        const content = fs.readFileSync(absolutePath, 'utf8');
        this.importedModules.set(absolutePath, {
          timestamp: Date.now(),
          hash: this.hashContent(content),
          size: content.length,
        });
        return jitiResult.default && typeof jitiResult.default === 'object' ? { ...jitiResult.default, ...jitiResult } : jitiResult;
      }
    }

    try {
      const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
      try { delete projectRequire.cache[projectRequire.resolve(absolutePath)]; } catch {}
      const imported = projectRequire(absolutePath);
      const stat = fs.statSync(absolutePath);
      const content = fs.readFileSync(absolutePath, 'utf8');
      this.importedModules.set(absolutePath, { timestamp: stat.mtimeMs, hash: this.hashContent(content), size: content.length });
      return imported.default && typeof imported.default === 'object' ? { ...imported.default, ...imported } : imported;
    } catch (error: any) {
      if (error.code === 'ERR_REQUIRE_ESM') {
        try {
          const fileUrl = pathToFileURL(absolutePath).href + `?t=${Date.now()}`;
          const imported = await import(fileUrl);
          const stat = fs.statSync(absolutePath);
          const content = fs.readFileSync(absolutePath, 'utf8');
          this.importedModules.set(absolutePath, { timestamp: stat.mtimeMs, hash: this.hashContent(content), size: content.length });
          return imported.default && typeof imported.default === 'object' ? { ...imported.default, ...imported } : imported;
        } catch (importError: any) {
          importError.message = `Failed to import ${path.basename(filePath)}: ${importError.message}`;
          throw importError;
        }
      }
      error.message = `Failed to import ${path.basename(filePath)}: ${error.message}`;
      throw error;
    }
  }

  hasChanged(filePath: string): boolean {
    const absolutePath = path.resolve(filePath);
    const cached = this.importedModules.get(absolutePath);
    if (!cached) return true;
    try {
      const content = fs.readFileSync(absolutePath, 'utf8');
      const hash = this.hashContent(content);
      // v3.2: use content hash, not just mtime, to handle python atomic writes (unlink+add)
      if (hash !== cached.hash) return true;
      const stat = fs.statSync(absolutePath);
      return stat.mtimeMs > cached.timestamp + 100; // 100ms grace for FS jitter
    } catch { return true; }
  }

  addDependency(parent: string, child: string): void {
    if (!this.dependencyGraph.has(parent)) this.dependencyGraph.set(parent, new Set());
    this.dependencyGraph.get(parent)!.add(child);
  }

  getDependencies(filePath: string): Set<string> {
    const visited = new Set<string>();
    const collect = (fp: string) => {
      if (visited.has(fp)) return;
      visited.add(fp);
      const deps = this.dependencyGraph.get(fp);
      if (deps) for (const dep of deps) collect(dep);
    };
    collect(filePath);
    return visited;
  }

  clear(): void { this.importedModules.clear(); this.dependencyGraph.clear(); }
}

