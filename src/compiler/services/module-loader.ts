import fs from "fs/promises";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import crypto from "crypto";
import { pathToFileURL } from "url";
import { createRequire } from "module";

interface CacheEntry {
  timestamp: number;
  hash: string;
  size: number;
  version: number;
}

export class ModuleLoader {
  private importedModules = new Map<string, CacheEntry>();
  private dependencyGraph = new Map<string, Set<string>>();
  private jitiInstance: any = null;
  private instanceSeed = crypto.randomUUID().slice(0, 8);

  private hashContent(c: string): string {
    return crypto.createHash("sha256").update(c).digest("hex").slice(0, 16);
  }

  private async getJiti(parentPath: string): Promise<any> {
    if (this.jitiInstance) return this.jitiInstance;
    try {
      const jitiMod: any = await import("jiti").catch(() => null);
      if (!jitiMod) return null;

      const createJiti =
        jitiMod.createJiti || jitiMod.default?.createJiti || jitiMod.default;
      if (typeof createJiti !== "function") return null;

      const parentURL = pathToFileURL(parentPath).href;
      this.jitiInstance = createJiti(parentURL, {
        interopDefault: true,
        fsCache: true,
        moduleCache: false,
      });
      return this.jitiInstance;
    } catch {
      return null;
    }
  }

  async importSource(
    source: string,
    virtualPath: string,
  ): Promise<Record<string, any>> {
    const jiti = await this.getJiti(virtualPath);
    if (!jiti) {
      throw new Error("Jiti is required for virtual module compilation.");
    }

    const contentHash = this.hashContent(source);

    try {
      // Use jiti to evaluate the source directly
      // This creates a temporary module from the source string
      const mod = await jiti.import(virtualPath, { default: true });

      this.importedModules.set(virtualPath, {
        timestamp: Date.now(),
        hash: contentHash,
        size: source.length,
        version: 0,
      });

      // Ensure we return a proper object
      const result = this.interopModule(mod);

      // If the result is not an object or is null/undefined, return empty object
      if (
        result === null ||
        result === undefined ||
        typeof result !== "object"
      ) {
        return {};
      }

      return result;
    } catch (e) {
      throw new Error(
        `Failed to compile virtual module: ${(e as Error).message}`,
      );
    }
  }

  private purgeRequireCache(
    resolvedPath: string,
    projectRequire: NodeRequire,
    seen = new Set<string>(),
  ): void {
    if (seen.has(resolvedPath) || resolvedPath.includes("node_modules")) return;
    seen.add(resolvedPath);

    const cached = projectRequire.cache[resolvedPath];
    if (cached) {
      for (const child of cached.children || []) {
        this.purgeRequireCache(child.id, projectRequire, seen);
      }
      delete projectRequire.cache[resolvedPath];
    }
  }

  private interopModule(mod: any) {
    if (!mod) return {};

    // If mod is already a plain object, return it
    if (typeof mod === "object" && !Array.isArray(mod) && !mod.default) {
      return mod;
    }

    const def = mod.default;
    if (def === undefined || def === null) {
      return mod;
    }

    // Preserve function type if default is a function (e.g. recipes)
    if (typeof def === "function") {
      const out = Object.assign(def.bind({}), def);
      for (const k of Object.keys(mod)) {
        if (k !== "default" && !(k in out)) {
          out[k] = mod[k];
        }
      }
      out.default = def;
      return out;
    }

    // Default is an object
    if (typeof def === "object") {
      const out = { ...def };
      for (const k of Object.keys(mod)) {
        if (k !== "default" && !(k in out)) {
          out[k] = mod[k];
        }
      }
      return out;
    }

    // Fallback
    const out: Record<string, any> = {};
    for (const k of Object.keys(mod)) {
      if (k !== "default") {
        out[k] = mod[k];
      }
    }
    return out;
  }

  async import(filePath: string): Promise<Record<string, any>> {
    const absolutePath = path.resolve(filePath);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new Error(`File not found: ${absolutePath}`);
    }

    if (/\.(tsx|jsx)$/.test(absolutePath)) {
      throw new Error(
        `Component file ${path.basename(filePath)} will be processed by scanner`,
      );
    }

    const stat = await fs.stat(absolutePath);
    const content = await fs.readFile(absolutePath, "utf8");
    const contentHash = this.hashContent(content);

    const existingCache = this.importedModules.get(absolutePath);
    let currentVersion = 0;

    if (existingCache) {
      currentVersion =
        existingCache.hash !== contentHash
          ? existingCache.version + 1
          : existingCache.version;
    }

    const cachePayload: CacheEntry = {
      timestamp: stat.mtimeMs,
      hash: contentHash,
      size: stat.size,
      version: currentVersion,
    };

    if (/\.(ts|mts|cts|js|cjs|mjs)$/.test(absolutePath)) {
      const jiti = await this.getJiti(absolutePath);
      if (jiti) {
        try {
          const r = await (typeof jiti.import === "function"
            ? jiti.import(absolutePath, { default: true })
            : jiti(absolutePath));

          this.dependencyGraph.delete(absolutePath);
          this.importedModules.set(absolutePath, cachePayload);
          const result = this.interopModule(r);
          // Ensure we return a valid object
          if (result && typeof result === "object") {
            return result;
          }
          return {};
        } catch (jitiError: any) {
          if (
            jitiError.name === "SyntaxError" ||
            jitiError.message?.includes("Transform")
          ) {
            throw new Error(
              `Compilation error in ${path.basename(filePath)}: ${jitiError.message}`,
            );
          }
        }
      }
    }

    try {
      const pkgPath = path.join(process.cwd(), "package.json");
      const baseRequire = existsSync(pkgPath) ? pkgPath : absolutePath;
      const projectRequire = createRequire(baseRequire);
      const resolvedPath = projectRequire.resolve(absolutePath);

      this.purgeRequireCache(resolvedPath, projectRequire);
      const imported = projectRequire(absolutePath);

      this.dependencyGraph.delete(absolutePath);
      this.importedModules.set(absolutePath, cachePayload);
      const result = this.interopModule(imported);
      if (result && typeof result === "object") {
        return result;
      }
      return {};
    } catch (error: any) {
      if (error.code === "ERR_REQUIRE_ESM") {
        try {
          const uniqueQuery = `v=${this.instanceSeed}-${currentVersion}`;
          const fileUrl = `${pathToFileURL(absolutePath).href}?${uniqueQuery}`;

          const imported = await import(fileUrl);
          this.dependencyGraph.delete(absolutePath);
          this.importedModules.set(absolutePath, cachePayload);
          const result = this.interopModule(imported);
          if (result && typeof result === "object") {
            return result;
          }
          return {};
        } catch (importError: any) {
          throw new Error(
            `Failed to native-import ${path.basename(filePath)}: ${importError.message}`,
          );
        }
      }
      throw new Error(
        `Failed to import ${path.basename(filePath)}: ${error.message}`,
      );
    }
  }

  hasChanged(filePath: string): boolean {
    const absolutePath = path.resolve(filePath);
    const cached = this.importedModules.get(absolutePath);
    if (!cached) return true;

    try {
      const stat = statSync(absolutePath);
      if (stat.mtimeMs === cached.timestamp && stat.size === cached.size)
        return false;

      const content = readFileSync(absolutePath, "utf8");
      const hash = this.hashContent(content);

      if (hash === cached.hash) {
        cached.timestamp = stat.mtimeMs;
        cached.size = stat.size;
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }

  addDependency(parent: string, child: string): void {
    const p = path.resolve(parent);
    const c = path.resolve(child);

    if (!this.dependencyGraph.has(p)) {
      this.dependencyGraph.set(p, new Set());
    }
    this.dependencyGraph.get(p)!.add(c);
  }

  getDependencies(filePath: string): Set<string> {
    const absolutePath = path.resolve(filePath);
    const visited = new Set<string>();

    const collect = (fp: string) => {
      if (visited.has(fp)) return;
      visited.add(fp);
      const deps = this.dependencyGraph.get(fp);
      if (deps) {
        for (const dep of deps) collect(dep);
      }
    };

    collect(absolutePath);
    return visited;
  }

  clear(): void {
    this.importedModules.clear();
    this.dependencyGraph.clear();
  }
}
