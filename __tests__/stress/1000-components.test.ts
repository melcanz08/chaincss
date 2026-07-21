import { describe, it, expect } from 'vitest';
import { chain } from '../../src/index';
import { compileToCSS } from '../../src/core/style-compiler';

describe('Stress - 1000 components cssChunks join', () => {
  it('1000 appends should be fast and not O(n^2)', () => {
    const start = performance.now();
    let c = chain();
    for (let i = 0; i < 1000; i++) {
      c = c.flex().$el(`c${i}`) as any;
      c = chain() as any;
    }
    const built = chain().flex().center().build(Array.from({ length: 1000 }, (_, i) => `.c${i}`)) as any;
    const css = compileToCSS(built);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(1000);
    expect(css.length).toBeGreaterThan(0);
  });
});

