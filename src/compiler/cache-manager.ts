// chaincss/src/compiler/cache-manager.ts

import fs from 'fs';
import path from 'path';

export interface CacheData {
  version: string;
  created: string;
  atomic: Record<string, any>;
  usage: Record<string, any>;
  [key: string]: any;
}

export class CacheManager {
  cachePath: string;
  cacheDir: string;
  cache: CacheData | Record<string, any>;

  constructor(cachePath: string = './.chaincss-cache') {
    this.cachePath = path.resolve(process.cwd(), cachePath);
    this.cacheDir = path.dirname(this.cachePath);
    this.cache = {};
    this.load();
  }

  load(): void {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = fs.readFileSync(this.cachePath, 'utf8');
        this.cache = JSON.parse(data);
      } else {
        // Ensure cache directory exists
        if (!fs.existsSync(this.cacheDir)) {
          fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        this.cache = {
          version: '1.0',
          created: new Date().toISOString(),
          atomic: {},
          usage: {}
        };
      }
    } catch (error) {
      console.warn('Could not load cache, starting fresh:', (error as Error).message);
      this.cache = {};
    }
  }

  get(key: string): any {
    return this.cache[key];
  }

  set(key: string, value: any): void {
    this.cache[key] = value;
  }

  save(): void {
    try {
      const data = JSON.stringify(this.cache, null, 2);
      fs.writeFileSync(this.cachePath, data, 'utf8');
    } catch (error) {
      console.warn('Could not save cache:', (error as Error).message);
    }
  }

  clear(): void {
    this.cache = {};
    if (fs.existsSync(this.cachePath)) {
      fs.unlinkSync(this.cachePath);
    }
    console.log('Cache cleared');
  }
}

// ESM Export
export { CacheManager as default };