// src/compiler/services/manifest-writer.ts

import fs from "fs/promises";
import {
  existsSync,
  writeFileSync,
  readFileSync,
  renameSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import path from "path";
import { createHash } from "crypto";

export interface ManifestData {
  version: string;
  timestamp: string;
  atomicMap: Record<string, string>;
  stats: {
    totalStyles: number;
    atomicStyles: number;
    uniqueProperties: number;
    savings: string;
  };
  pipelineEnabled: boolean;
  diagnosticsCount: number;
  classFiles: string[];
  generatedArtifacts?: Record<
    string,
    {
      framework: string;
      hash: string;
      filepath: string;
    }
  >;
}

export interface ManifestOptions {
  minify?: boolean;
  outputDir?: string;
}

export class ManifestWriter {
  private outputDir: string;
  private options: Required<ManifestOptions>;
  private lastWrittenContentHash: string = "";

  constructor(options: ManifestOptions = {}) {
    this.options = {
      minify: options.minify ?? process.env.NODE_ENV === "production",
      outputDir:
        options.outputDir ||
        path.resolve(process.cwd(), ".chaincss", "manifest"),
    };
    this.outputDir = this.options.outputDir;
  }

  private get manifestPath(): string {
    return path.join(this.outputDir, "manifest.json");
  }

  private serialize(data: ManifestData): string {
    return this.options.minify
      ? JSON.stringify(data)
      : JSON.stringify(data, null, 2);
  }

  private getStableData(data: ManifestData): Omit<ManifestData, "timestamp"> {
    const { timestamp, ...stable } = data;
    return stable;
  }

  /**
   * Produces a canonical string representation for hashing.
   * Sorts keys recursively and normalizes non-deterministic array fields.
   */
  private stableStringify(data: Omit<ManifestData, "timestamp">): string {
    const normalize = (val: any): any => {
      if (Array.isArray(val)) {
        // Sort arrays of primitive strings (like classFiles) for stable hashing
        if (val.every((item) => typeof item === "string")) {
          return [...val].sort();
        }
        return val.map(normalize);
      }
      if (val && typeof val === "object") {
        const sortedKeys = Object.keys(val).sort();
        const result: Record<string, any> = {};
        for (const k of sortedKeys) {
          result[k] = normalize(val[k]);
        }
        return result;
      }
      return val;
    };

    return JSON.stringify(normalize(data));
  }

  private hashString(content: string): string {
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }

  private computeStableHash(data: ManifestData): string {
    return this.hashString(this.stableStringify(this.getStableData(data)));
  }

  private computeStableHashFromRaw(raw: string): string {
    try {
      const parsed = JSON.parse(raw) as ManifestData;
      return this.computeStableHash(parsed);
    } catch {
      return this.hashString(raw);
    }
  }

  async write(data: ManifestData): Promise<{ path: string; skipped: boolean }> {
    const targetPath = this.manifestPath;
    const stableHash = this.computeStableHash(data);

    if (stableHash === this.lastWrittenContentHash) {
      return { path: targetPath, skipped: true };
    }

    // Check existing on-disk file to survive process restarts
    try {
      const existingRaw = await fs.readFile(targetPath, "utf8");
      if (this.computeStableHashFromRaw(existingRaw) === stableHash) {
        this.lastWrittenContentHash = stableHash;
        return { path: targetPath, skipped: true };
      }
    } catch {}

    const content = this.serialize(data);

    try {
      await fs.mkdir(this.outputDir, { recursive: true });

      const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
      await fs.writeFile(tmpPath, content, "utf8");

      try {
        await fs.rename(tmpPath, targetPath);
      } catch {
        // Fallback for Windows lock scenarios: try unlinking first, or direct overwrite
        try {
          await fs.unlink(targetPath);
          await fs.rename(tmpPath, targetPath);
        } catch {
          await fs.writeFile(targetPath, content, "utf8");
          await fs.unlink(tmpPath).catch(() => {});
        }
      }

      this.lastWrittenContentHash = stableHash;
      return { path: targetPath, skipped: false };
    } catch (error) {
      throw new Error(`Failed to write manifest: ${(error as Error).message}`);
    }
  }

  writeSync(data: ManifestData): { path: string; skipped: boolean } {
    const targetPath = this.manifestPath;
    const stableHash = this.computeStableHash(data);

    if (stableHash === this.lastWrittenContentHash) {
      return { path: targetPath, skipped: true };
    }

    try {
      if (existsSync(targetPath)) {
        const raw = readFileSync(targetPath, "utf8");
        if (this.computeStableHashFromRaw(raw) === stableHash) {
          this.lastWrittenContentHash = stableHash;
          return { path: targetPath, skipped: true };
        }
      }
    } catch {}

    const content = this.serialize(data);

    try {
      if (!existsSync(this.outputDir)) {
        mkdirSync(this.outputDir, { recursive: true });
      }

      const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
      writeFileSync(tmpPath, content, "utf8");

      try {
        renameSync(tmpPath, targetPath);
      } catch {
        try {
          unlinkSync(targetPath);
          renameSync(tmpPath, targetPath);
        } catch {
          writeFileSync(targetPath, content, "utf8");
          try {
            unlinkSync(tmpPath);
          } catch {}
        }
      }

      this.lastWrittenContentHash = stableHash;
      return { path: targetPath, skipped: false };
    } catch (error) {
      throw new Error(
        `Failed to write manifest (sync): ${(error as Error).message}`,
      );
    }
  }

  async read(): Promise<ManifestData | null> {
    try {
      const raw = await fs.readFile(this.manifestPath, "utf8");
      this.lastWrittenContentHash = this.computeStableHashFromRaw(raw);
      return JSON.parse(raw) as ManifestData;
    } catch {
      return null;
    }
  }

  readSync(): ManifestData | null {
    const targetPath = this.manifestPath;
    if (!existsSync(targetPath)) return null;

    try {
      const raw = readFileSync(targetPath, "utf8");
      this.lastWrittenContentHash = this.computeStableHashFromRaw(raw);
      return JSON.parse(raw) as ManifestData;
    } catch {
      return null;
    }
  }

  async clean(): Promise<void> {
    try {
      await fs.unlink(this.manifestPath);
      this.lastWrittenContentHash = "";
    } catch {}
  }

  cleanSync(): void {
    const targetPath = this.manifestPath;
    if (existsSync(targetPath)) {
      try {
        unlinkSync(targetPath);
        this.lastWrittenContentHash = "";
      } catch {}
    }
  }
}

export default ManifestWriter;