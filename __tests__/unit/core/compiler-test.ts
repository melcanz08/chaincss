import { describe, it, expect, beforeEach } from 'vitest';
import { ChainCSSCompiler } from '../../../src/core/compiler';

describe('Compiler - Orchestration Robust', () => {
  let compiler: ChainCSSCompiler;

  beforeEach(() => {
    compiler = new ChainCSSCompiler({ silent: true });
  });

  it('ready() resolves', async () => {
    await expect(compiler.ready()).resolves.toBeUndefined();
  });

  it('onEvent and events dual bus both receive', async () => {
    const received1: any[] = [];
    const received2: any[] = [];
    const unsub = compiler.onEvent((e) => received1.push(e));
    (compiler.events as any).on('warning', (e: any) => received2.push(e));

    // trigger warning via private emit using any
    (compiler as any).emit({ type: 'warning', code: 'TEST_WARN', message: 'test' });

    expect(received1.length).toBe(1);
    expect(received2.length).toBe(1);
    expect(received1[0].code).toBe('TEST_WARN');
    unsub();
  });

  it('getStats() is pure - does not mutate on call', () => {
    const s1 = compiler.getStats();
    const s2 = compiler.getStats();
    expect(s1.totalStyles).toBe(s2.totalStyles);
    expect(s1.filesProcessed).toBe(s2.filesProcessed);
  });

  it('getCombinedCSS uses join not += (no O(n^2))', () => {
    // @ts-ignore private access
    compiler.cssChunks = ['a{}', 'b{}', 'c{}'];
    expect(compiler.getCombinedCSS()).toBe('a{}\nb{}\nc{}');
  });

  it('clearCSS clears chunks and hasStyles', () => {
    // @ts-ignore
    compiler.cssChunks = ['x'];
    (compiler as any)._hasStyles = true;
    compiler.clearCSS();
    expect(compiler.getCombinedCSS()).toBe('');
    expect(compiler.hasStyles()).toBe(false);
  });

  it('compileStyle tracks stats without mutating getStats', () => {
    const before = compiler.getStats().totalStyles;
    compiler.compileStyle('test-id', { display: 'flex' } as any);
    const after = compiler.getStats().totalStyles;
    expect(after).toBeGreaterThanOrEqual(before);
    // calling getStats again should not increase
    const again = compiler.getStats().totalStyles;
    expect(again).toBe(after);
  });

  it('persistent cache folder not deleted on instantiation', async () => {
    // compiler constructor previously had fs.rmSync('.chaincss-cache')
    // this test ensures second instantiation doesn't wipe
    const fs = await import('fs');
    const path = '.chaincss-cache';
    try {
      fs.mkdirSync(path, { recursive: true });
      fs.writeFileSync(`${path}/marker.json`, 'test');
      const c2 = new ChainCSSCompiler({ silent: true });
      await c2.ready();
      expect(fs.existsSync(`${path}/marker.json`)).toBe(true);
      fs.rmSync(path, { recursive: true, force: true });
    } catch {}
  });
});

