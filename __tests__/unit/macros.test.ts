// __tests__/unit/macros.test.ts
// Comprehensive macro tests - v2 clean

import { describe, it, expect } from 'vitest';
import { createChain } from '../../src/compiler/Chain.js';

describe('Macros - Layout & Display', () => {
  it('flex()', () => {
    expect(createChain(false).flex().$el('t').display).toBe('flex');
  });
  it('grid()', () => {
    expect(createChain(false).grid().$el('t').display).toBe('grid');
  });
  it('center()', () => {
    const r = createChain(false).center().$el('t');
    expect(r.justifyContent).toBe('center');
  });
  it('flexCenter()', () => {
    expect(createChain(false).flexCenter().$el('t').display).toBe('flex');
  });
  it('gridCenter()', () => {
    expect(createChain(false).gridCenter().$el('t').display).toBe('grid');
  });
  it('cols(3)', () => {
    const r = createChain(false).cols(3).$el('t');
    expect(r.gridTemplateColumns).toContain('repeat(3');
  });
  it('aspect("16/9")', () => {
    expect(createChain(false).aspect('16/9').$el('t').aspectRatio).toBe('16/9');
  });
  it('aspect("square")', () => {
    expect(createChain(false).aspect('square').$el('t').aspectRatio).toBe('1 / 1');
  });
});

describe('Macros - Visibility', () => {
  it('hide()', () => {
    const r = createChain(false).hide().$el('t');
    expect(r.visibility).toBe('hidden');
    expect(r.opacity).toBe(0);
  });
  it('show()', () => {
    const r = createChain(false).show().$el('t');
    expect(r.visibility).toBe('visible');
    expect(r.opacity).toBe(1);
  });
  it('unselectable()', () => {
    expect(createChain(false).unselectable().$el('t').userSelect).toBe('none');
  });
});

describe('Macros - Positioning', () => {
  it('absolute()', () => {
    expect(createChain(false).absolute().$el('t').position).toBe('absolute');
  });
  it('fixed()', () => {
    expect(createChain(false).fixed().$el('t').position).toBe('fixed');
  });
  it('relative()', () => {
    expect(createChain(false).relative().$el('t').position).toBe('relative');
  });
});

describe('Macros - Shapes', () => {
  it('circle(50)', () => {
    const r = createChain(false).circle(50).$el('t');
    expect(r.width).toBe(50);
    expect(r.borderRadius).toBe('50%');
  });
  it('square(40)', () => {
    expect(createChain(false).square(40).$el('t').width).toBe(40);
  });
  it('truncate()', () => {
    expect(createChain(false).truncate().$el('t').textOverflow).toBe('ellipsis');
  });
  it('pill()', () => {
    expect(createChain(false).pill().$el('t').borderRadius).toBe('9999px');
  });
});

describe('Macros - Effects', () => {
  it('glass()', () => {
    expect(createChain(false).glass().$el('t').backdropFilter).toBeDefined();
  });
  it('noise()', () => {
    expect(createChain(false).noise(0.05).$el('t').backgroundImage).toBeDefined();
  });
});

describe('Macros - State', () => {
  it('clickScale()', () => {
    const r = createChain(false).clickScale().$el('t');
    // clickScale should produce a valid style object
    expect(r).toBeDefined();
    expect(typeof r).toBe('object');
  });
  it('pressable()', () => {
    const r = createChain(false).pressable().$el('t');
    expect(r).toBeDefined();
    expect(typeof r).toBe('object');
  });
  it('focusRing()', () => {
    const r = createChain(false).focusRing().$el('t');
    expect(r).toBeDefined();
    expect(typeof r).toBe('object');
  });
});

describe('Macros - Utility', () => {
  it('fullScreen()', () => {
    expect(createChain(false).fullScreen().$el('t').position).toBe('fixed');
  });
  it('shimmer()', () => {
    const r4 = createChain(false).shimmer().$el('t');
    expect(r4.backgroundSize).toBeDefined();
  });
  it('bento()', () => {
    expect(createChain(false).bento().$el('t').display).toBe('grid');
  });
  it('outlineDebug()', () => {
    const r = createChain(false).outlineDebug().$el('t');
    expect(r).toBeDefined();
    expect(typeof r).toBe('object');
  });
});
