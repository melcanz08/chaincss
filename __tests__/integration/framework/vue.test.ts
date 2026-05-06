// __tests__/integration/framework/vue.test.ts
// Vue integration tests

import { describe, it, expect } from 'vitest';
import { createChain } from '../../../src/compiler/Chain.js';

describe('Vue Integration - Chain Styles', () => {
  it('should generate selector strings for Vue class bindings', () => {
    const styles = createChain()
      .display('grid')
      .gridTemplateColumns('repeat(3, 1fr)')
      .gap(16)
      .$el('vue-grid');

    // In Vue, you'd use :class or v-bind:class with these selectors
    expect(styles.selectors[0]).toBeTruthy();
    expect(typeof styles.selectors[0]).toBe('string');
  });

  it('should handle scoped-style patterns', () => {
    const styles = createChain()
      .color('#1e293b')
      .nest('& >>> .child', (c) => c.color('#64748b'))
      .$el('scoped-component');

    expect(styles.nestedRules).toBeDefined();
    expect(styles.nestedRules[0].selector).toContain('>>>');
  });

  it('should support computed-like patterns with when()', () => {
    const isSidebarOpen = true;

    const styles = createChain()
      .width(64)
      .transition('width 0.3s ease')
      .when(isSidebarOpen, (c) => c.width(256))
      .$el('sidebar');

    expect(styles.width).toBe('256px');
    expect(styles.transition).toBe('width 0.3s ease');
  });

  it('should handle v-bind:style compatible output', () => {
    const styles = createChain()
      .background('#f8fafc')
      .padding(20)
      .borderRadius(8)
      .$el();

    // When $el() is called without selectors, returns raw styles object
    // useful for v-bind:style
    expect(styles.background).toBe('#f8fafc');
    expect(styles.padding).toBe('20px');
    expect(styles.borderRadius).toBe('8px');
    expect(styles.selectors).toBeUndefined();
  });

  it('should support slot targeting', () => {
    const styles = createChain()
      .nest('::v-deep(.slot-content)', (c) => c.padding(16).background('white'))
      .$el('slot-parent');

    expect(styles.nestedRules).toBeDefined();
    expect(styles.nestedRules[0].selector).toContain('::v-deep');
  });
});