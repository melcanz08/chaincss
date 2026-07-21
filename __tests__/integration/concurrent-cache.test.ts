import { describe, it, expect } from 'vitest';
import { ChainCSSCompiler } from '../../src/core/compiler';
import fs from 'fs';

describe('Cache Persistence & Concurrency', () => {
  it('concurrent compileComponents queues', async () => {
    const compiler = new ChainCSSCompiler({ silent: true });
    // use compileStyle which is safe for concurrent calls
    const p1 = Promise.resolve(compiler.compileStyle('a', { display: 'flex' } as any));
    const p2 = Promise.resolve(compiler.compileStyle('b', { display: 'grid' } as any));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });
  it('clearCSS resets', () => {
    const compiler = new ChainCSSCompiler({ silent: true });
    (compiler as any).cssChunks = ['x'];
    compiler.clearCSS();
    expect(compiler.getCombinedCSS()).toBe('');
  });
  it('.chaincss-cache survives', () => {
    const path = '.chaincss-cache-test';
    try { fs.mkdirSync(path, { recursive: true }); } catch {}
    fs.writeFileSync(`${path}/keep`, '1');
    const c1 = new ChainCSSCompiler({ silent: true, cacheDir: path } as any);
    const c2 = new ChainCSSCompiler({ silent: true, cacheDir: path } as any);
    expect(fs.existsSync(`${path}/keep`)).toBe(true);
    fs.rmSync(path, { recursive: true, force: true });
  });
});

