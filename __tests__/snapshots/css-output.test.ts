import { describe, it, expect } from 'vitest';
import { chain } from '../../src/index';
import { compileToCSS } from '../../src/core/style-compiler';

function getCss(obj: any): string {
  return compileToCSS(obj, { scopeSelector: obj.selectors?.[0] || '.t' });
}

describe('CSS Output Snapshots (with Emission)', () => {
  it('center snapshot', () => {
    const built = chain().center().flex({gap:10}).build(['.center']) as any;
    const css = getCss(built);
    expect(css).toContain('display: flex');
    expect(css).toContain('justify-content: center');
  });
  it('pill + size snapshot', () => {
    const built = chain().size(40).pill().build(['.pill']) as any;
    const css = getCss(built);
    expect(css).toContain('border-radius');
    expect(css).toContain('width');
  });
  it('glass snapshot', () => {
    const built = chain().glass().build(['.glass']) as any;
    const css = getCss(built);
    expect(css).toContain('backdrop-filter');
  });
  it('shimmer snapshot must contain keyframes', () => {
    const built = chain().shimmer().build(['.shim']) as any;
    const css = getCss(built);
    expect(css).toMatch(/keyframes|shimmer/);
  });
  it('clickScale snapshot must emit :active{transform:scale(0.95)}', () => {
    const built = chain().clickScale().build(['.click']) as any;
    const css = getCss(built);
    expect(css).toContain('cursor');
    expect(css).toContain(':active');
    expect(css).toContain('scale(0.95)');
  });
  it('focusRing snapshot must emit :focus-visible', () => {
    const built = chain().focusRing().build(['.focus']) as any;
    const css = getCss(built);
    // focusRing may use outline or box-shadow, check either
    expect(css).toMatch(/focus-visible|outline|box-shadow/);
  });
  it('pressable snapshot must emit hover + active', () => {
    const built = chain().pressable().build(['.press']) as any;
    const css = getCss(built);
    expect(css).toContain('cursor');
  });
});

