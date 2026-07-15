// chaincss/src/compiler/pipeline/optimizers/atomic-optimizer.ts

import { ChainCSSConfig } from '../../../cli/types.js';
// crypto/fs/path replaced with browser-safe alternatives for v2.13
function createHash(algo: string) {
  return {
    update(s: string) { return { digest: (_format?: string) => s.split('').reduce((h,c)=>(h=((h<<5)-h)+c.charCodeAt(0),h&h),0).toString(36) } }
  };
}
const crypto = { createHash };

import type { AtomicClass } from '../../../core/types.js';
export type { AtomicClass };

// Types

export interface AtomicOptimizerStats {
  totalStyles: number;
  atomicStyles: number;
  standardStyles: number;
  uniqueProperties: number;
  savings: string;
  cacheHitRate?: number;
}

export interface AtomicOptimizerOptions {
  enabled?: boolean;
  threshold?: number;
  naming?: 'hash' | 'readable';
  cache?: boolean;
  cachePath?: string;
  minify?: boolean;
  mode?: 'standard' | 'atomic' | 'hybrid';
  outputStrategy?: 'component-first' | 'utility-first';
  alwaysAtomic?: string[];
  neverAtomic?: string[];
  frameworkOutput?: {
    react?: boolean;
    vue?: boolean;
    vanilla?: boolean;
  };
  preserveSelectors?: boolean;
  verbose?: boolean;
}

export interface ComponentClassMapEntry {
  atomicClasses: string[];
  hoverAtomicClasses: string[];
  selectors: string[];
  componentClassName?: string;
}

export interface OptimizeResult {
  css: string;
  map: Record<string, string>;
  stats: AtomicOptimizerStats;
  atomicCSS: string;
  componentCSS: string;
  componentMap?: Map<string, ComponentClassMapEntry>;
}

// Utility functions
function hashKey(key: string): string {
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 6);
}

function kebab(s: string): string {
  return s.replace(/([A-Z])/g, '-$1').toLowerCase();
}

export class AtomicOptimizer {
  // No-op stub — atomic extraction moved to pipeline/optimizers/atomic-extractor.ts
  private options: any;
  public atomicMap: Record<string, string> = {};

  constructor(options: any = {}) {
    this.options = options;
  }

  optimize(styles: Record<string, any>): { map: Record<string, string>; css: string } {
    return { map: {}, css: '' };
  }

  reset(): void {}

  getStats() {
    return {
      totalStyles: 0,
      atomicStyles: 0,
      uniqueProperties: 0,
      savings: '0.0%',
    };
  }

  getAtomicMap(): Record<string, string> {
    return {};
  }

  getComponentMapEntry(_id: string): { atomicClasses: string[] } | null {
    return null;
  }

  getAllAtomicClasses(): any[] {
    return [];
  }

  trackStyles(_styles: any[]): void {}
}
