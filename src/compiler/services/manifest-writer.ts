// src/compiler/services/manifest-writer.ts

/**
 * Manifest Writer — Handles manifest generation and file output.
 * Extracted from ChainCSSCompiler for separation of concerns.
 */

import fs from 'fs';
import path from 'path';

export interface ManifestData {
  version: string;
  timestamp: string;
  atomicMap: Record<string, any>;
  stats: {
    totalStyles: number;
    atomicStyles: number;
    uniqueProperties: number;
    savings: string;
  };
  pipelineEnabled: boolean;
  diagnosticsCount: number;
  classFiles: string[];
}

export class ManifestWriter {
  private outputDir: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || path.resolve(process.cwd(), '.chaincss', 'manifest');
  }

  /**
   * Write the manifest to disk.
   */
  write(data: ManifestData): string {
    // Ensure directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const manifestPath = path.join(this.outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2));
    
    return manifestPath;
  }

  /**
   * Read the current manifest (if it exists).
   */
  read(): ManifestData | null {
    const manifestPath = path.join(this.outputDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    
    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      return JSON.parse(raw) as ManifestData;
    } catch {
      return null;
    }
  }

  /**
   * Clean old manifest files.
   */
  clean(): void {
    const manifestPath = path.join(this.outputDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
    }
  }
}