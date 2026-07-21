// src/compiler/services/manifest-writer.ts

import fs from 'fs/promises';
import { existsSync, writeFileSync, readFileSync, renameSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';

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
  generatedArtifacts?: Record<string, {
    framework: string;
    hash: string;
    filepath: string;
  }>;
}

export interface ManifestOptions {
  minify?: boolean;
  outputDir?: string;
}

export class ManifestWriter {
  private outputDir: string;
  private options: Required<ManifestOptions>;
  private lastWrittenContentHash: string = '';

  constructor(options: ManifestOptions = {}) {
    this.options = {
      minify: options.minify ?? process.env.NODE_ENV === 'production',
      outputDir: options.outputDir || path.resolve(process.cwd(), '.chaincss', 'manifest')
    };
    this.outputDir = this.options.outputDir;
  }

  private serialize(data: ManifestData): string {
    return this.options.minify 
      ? JSON.stringify(data)
      : JSON.stringify(data, null, 2);
  }

  private getStableData(data: ManifestData): Omit<ManifestData, 'timestamp'> {
    const { timestamp, ...stable } = data;
    return stable;
  }

  private stableStringify(data: Omit<ManifestData, 'timestamp'>): string {
    return JSON.stringify(data, (key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.fromEntries(Object.entries(value).sort());
      }
      return value;
    });
  }

  private hashString(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
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
    const manifestPath = path.join(this.outputDir, 'manifest.json');
    const stableHash = this.computeStableHash(data);

    if (stableHash === this.lastWrittenContentHash) {
      return { path: manifestPath, skipped: true };
    }

    // Also check on-disk file to survive restart
    try {
      const existingRaw = await fs.readFile(manifestPath, 'utf8');
      const existingHash = this.computeStableHashFromRaw(existingRaw);
      if (existingHash === stableHash) {
        this.lastWrittenContentHash = stableHash;
        return { path: manifestPath, skipped: true };
      }
    } catch {}

    const content = this.serialize(data);

    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // Direct write is safer than rename on Windows
      // If you want atomic, use tmp + unlink + rename
      const tmpPath = `${manifestPath}.${process.pid}.${Date.now()}.tmp`
      await fs.writeFile(tmpPath, content, 'utf8');
      try {
        await fs.rename(tmpPath, manifestPath);
      } catch {
        // Windows: target exists, unlink first
        await fs.unlink(manifestPath).catch(() => {});
        await fs.rename(tmpPath, manifestPath);
      }

      this.lastWrittenContentHash = stableHash;
      return { path: manifestPath, skipped: false };
    } catch (error) {
      throw new Error(`Failed to write manifest: ${(error as Error).message}`);
    }
  }

  writeSync(data: ManifestData): { path: string; skipped: boolean } {
    const manifestPath = path.join(this.outputDir, 'manifest.json');
    const stableHash = this.computeStableHash(data);

    if (stableHash === this.lastWrittenContentHash) {
      return { path: manifestPath, skipped: true };
    }

    try {
      if (existsSync(manifestPath)) {
        const raw = readFileSync(manifestPath, 'utf8');
        if (this.computeStableHashFromRaw(raw) === stableHash) {
          this.lastWrittenContentHash = stableHash;
          return { path: manifestPath, skipped: true };
        }
      }
    } catch {}

    const content = this.serialize(data);

    try {
      if (!existsSync(this.outputDir)) {
        mkdirSync(this.outputDir, { recursive: true });
      }

      // Direct write avoids Windows EPERM on rename
     const tmpPath = `${manifestPath}.${process.pid}.${Date.now()}.tmp`
      writeFileSync(tmpPath, content, 'utf8');
      try {
        renameSync(tmpPath, manifestPath);
      } catch {
        try { unlinkSync(manifestPath); } catch {}
        renameSync(tmpPath, manifestPath);
      }

      this.lastWrittenContentHash = stableHash;
      return { path: manifestPath, skipped: false };
    } catch (error) {
      throw new Error(`Failed to write manifest (sync): ${(error as Error).message}`);
    }
  }

  async read(): Promise<ManifestData | null> {
    const manifestPath = path.join(this.outputDir, 'manifest.json');
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      this.lastWrittenContentHash = this.computeStableHashFromRaw(raw);
      return JSON.parse(raw) as ManifestData;
    } catch {
      return null;
    }
  }

  readSync(): ManifestData | null {
    const manifestPath = path.join(this.outputDir, 'manifest.json');
    if (!existsSync(manifestPath)) return null;

    try {
      const raw = readFileSync(manifestPath, 'utf8');
      this.lastWrittenContentHash = this.computeStableHashFromRaw(raw);
      return JSON.parse(raw) as ManifestData;
    } catch {
      return null;
    }
  }

  async clean(): Promise<void> {
    const manifestPath = path.join(this.outputDir, 'manifest.json');
    try {
      await fs.unlink(manifestPath);
      this.lastWrittenContentHash = '';
    } catch {}
  }

  cleanSync(): void {
    const manifestPath = path.join(this.outputDir, 'manifest.json');
    if (existsSync(manifestPath)) {
      try {
        unlinkSync(manifestPath);
        this.lastWrittenContentHash = '';
      } catch {}
    }
  }
}