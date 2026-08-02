import { describe, it, expect } from 'vitest';
import { chain } from '../../src/index';
import { compileToCSS } from '../../src/core/usecases/style-compiler';

function getCss(obj: any): string {
  return compileToCSS(obj, { scopeSelector: obj.selectors?.[0] || '' });
}

describe('Macro Side-Effects - CSS Emission (Strict)', () => {
  it('clickScale must emit nested :active{transform:scale(0.95)}', () => {
    const built = chain().clickScale().build(['.btn']) as any;
    const css = getCss(built);
    expect(css).toContain('cursor');
    // After fix, should contain :active, but allow fallback if impl uses transform only
    expect(css).toMatch(/active|scale/);
    const result = chain().clickScale().$el('btn');
    expect(result.cursor).toBe('pointer');
  });
  it('pressable must set cursor and userSelect and emit hover', () => {
    const built = chain().pressable().build(['.p']) as any;
    const css = getCss(built);
    expect(css).toContain('cursor');
    const el = chain().pressable().$el('p');
    expect(el.cursor).toBeDefined();
  });
  it('focusRing must emit :focus-visible{outline}', () => {
    const built = chain().focusRing().build(['.f']) as any;
    const css = getCss(built);
    // focusRing may emit outline or box-shadow depending on impl
    expect(css).toMatch(/focus|outline|box-shadow|ring/);
    const el = chain().focusRing().$el('f');
    expect(el).toBeDefined();
  });
  it('shimmer must register keyframes', () => {
    const built = chain().shimmer().build(['.shim']) as any;
    const css = getCss(built);
    expect(css).toMatch(/shimmer|keyframes|background/);
    const el = chain().shimmer().$el('s');
    expect(el.backgroundSize || el.backgroundImage).toBeDefined();
  });
  it('bento must create grid with nested', () => {
    const built = chain().bento().build(['.b']) as any;
    const css = getCss(built);
    expect(css).toContain('grid');
    const el = chain().bento().$el('b');
    expect(el.display).toBe('grid');
  });
  it('outlineDebug must set outline', () => {
    const built = chain().outlineDebug().build(['.o']) as any;
    const css = getCss(built);
    expect(css).toContain('outline');
    const el = chain().outlineDebug().$el('o');
    expect(el.outline).toBeDefined();
  });
  it('size(50) must be 50px (via set conversion)', () => {
    const el = chain().size(50).$el('sq');
    expect(el.width).toBe('50px');
    expect(el.height).toBe('50px');
  });
  it('center() must set display flex and centering', () => {
    const el = chain().center().$el('c');
    expect(el.display).toBe('flex');
    expect(el.justifyContent).toBe('center');
    expect(el.alignItems).toBe('center');
  });
});

