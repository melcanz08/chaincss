import { describe, it, expect } from 'vitest';
import { chain } from '../../src/index';
import { compileToCSS } from '../../src/core/style-compiler';

function getCss(obj: any): string {
  return compileToCSS(obj, { scopeSelector: obj.selectors?.[0] || '.t' });
}

describe('Macros - Layout & Display (Revamped)', () => {
  it('center()', () => {
    const r = chain().center().$el('t');
    expect(r.justifyContent).toBe('center');
    expect(r.alignItems).toBe('center');
    expect(r.display).toBe('flex');
  });
  it('flexCenter()', () => {
    const el = chain().flexCenter().$el('t');
    expect(el.display).toBe('flex');
    expect(el.justifyContent).toBe('center');
  });
  it('gridCenter()', () => {
    expect(chain().gridCenter().$el('t').display).toBe('grid');
  });
  it('cols(3)', () => {
    const r = chain().cols(3).$el('t');
    expect(r.gridTemplateColumns).toContain('repeat(3');
  });
  it('aspect("16/9")', () => {
    expect(chain().aspect('16/9').$el('t').aspectRatio).toBe('16/9');
  });
  it('aspect("square")', () => {
    expect(chain().aspect('square').$el('t').aspectRatio).toBe('1 / 1');
  });
});

describe('Macros - Visibility (Revamped)', () => {
  it('hide()', () => {
    const r = chain().hide().$el('t');
    expect(r.visibility).toBe('hidden');
    expect(r.opacity).toBe(0);
  });
  it('show()', () => {
    const r = chain().show().$el('t');
    expect(r.visibility).toBe('visible');
    expect(r.opacity).toBe(1);
  });
  it('unselectable()', () => {
    expect(chain().unselectable().$el('t').userSelect).toBe('none');
  });
});

describe('Macros - Positioning (Revamped)', () => {
  it('absolute()', () => {
    expect(chain().absolute().$el('t').position).toBe('absolute');
  });
  it('fixed()', () => {
    expect(chain().fixed().$el('t').position).toBe('fixed');
  });
  it('relative()', () => {
    expect(chain().relative().$el('t').position).toBe('relative');
  });
});

describe('Macros - Shapes (Revamped)', () => {
  it('circle(50)', () => {
    const r = chain().circle(50).$el('t');
    expect(r.width).toBe('50px');
    expect(r.borderRadius).toBe('50%');
  });
  it('square(40)', () => {
    expect(chain().square(40).$el('t').width).toBe('40px');
  });
  it('truncate()', () => {
    expect(chain().truncate().$el('t').textOverflow).toBe('ellipsis');
  });
  it('pill()', () => {
    expect(chain().pill().$el('t').borderRadius).toBe('9999px');
  });
});

describe('Macros - Effects (Revamped)', () => {
  it('glass()', () => {
    expect(chain().glass().$el('t').backdropFilter).toBeDefined();
  });
  it('noise()', () => {
    const el = chain().noise(0.05).$el('t');
    expect(el.backgroundImage).toBeDefined();
  });
});

describe('Macros - State (Revamped - was crashing)', () => {
  it('clickScale() must set cursor and emit :active{transform:scale(0.95)}', () => {
    const built = chain().clickScale().build(['.t']) as any;
    const css = getCss(built);
    expect(css).toContain('cursor');
    expect(css).toContain('scale');
    expect(css).toContain('active');
    expect(css).toContain('.t:active');
    expect(chain().clickScale().$el('t').cursor).toBe('pointer');
  });
  it('pressable() must set cursor', () => {
    const el = chain().pressable().$el('t');
    expect(el.cursor).toBe('pointer');
  });
  it('focusRing() must emit :focus-visible{outline}', () => {
    const built = chain().focusRing().build(['.t']) as any;
    const css = getCss(built);
    expect(css).toContain('focus');
    expect(css).toContain('outline');
  });
});

describe('Macros - Utility (Revamped - was crashing)', () => {
  it('fullScreen()', () => {
    expect(chain().fullScreen().$el('t').position).toBe('fixed');
  });
  it('shimmer() must emit keyframes', () => {
    const built = chain().shimmer().build(['.t']) as any;
    const css = getCss(built);
    expect(css).toMatch(/shimmer|keyframes/);
    expect(chain().shimmer().$el('t').backgroundSize).toBeDefined();
  });
  it('bento() must be grid', () => {
    const built = chain().bento().build(['.t']) as any;
    const css = getCss(built);
    expect(css).toContain('grid');
    expect(chain().bento().$el('t').display).toBe('grid');
  });
  it('outlineDebug() must set outline', () => {
    const el = chain().outlineDebug().$el('t');
    expect(el.outline).toBeDefined();
    const built = chain().outlineDebug().build(['.t']) as any;
    const css = getCss(built);
    expect(css).toContain('outline');
  });
});

