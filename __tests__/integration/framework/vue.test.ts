// __tests__/integration/framework/vue.test.ts
// Vue integration tests

import { describe, it, expect } from 'vitest';
import { chain } from '../../../src/core/entities/style-collector.js';

describe('Vue Integration - Chain Styles', () => {
  it('should generate selector strings for Vue class bindings', () => {
    const styles = chain().grid({columns:'repeat(3, 1fr)', gap:16}).$el('vue-grid');

    // In Vue, you'd use :class or v-bind:class with these selectors
    expect(styles.selectors[0]).toBeTruthy();
    expect(typeof styles.selectors[0]).toBe('string');
  });

  it('should handle scoped-style patterns', () => {
    const styles = chain().typography({color:'#1e293b'}).nest('& >>> .child', (c:any) => c.typography({color:'#64748b'})).$el('scoped-component');

    expect(styles._nestedRules).toBeDefined();
    expect(styles._nestedRules[0].selector).toContain('>>>');
  });

  it('should support computed-like patterns with when()', () => {
    const isSidebarOpen = true;

    const styles = chain().box({w:64}).transition('width 0.3s ease').when(isSidebarOpen, (c:any) => c.box({w:256})).$el('sidebar');

    expect(styles.width).toBe('256px');
    expect(styles.transition).toBe('width 0.3s ease');
  });

  it('should handle v-bind:style compatible output', () => {
    const styles = chain().background('#f8fafc').box({p:20, borderRadius:8}).$el();

    // When $el() is called without selectors, returns raw styles object
    // useful for v-bind:style
    expect(styles.background).toBe('#f8fafc');
    expect(styles.padding).toBe('20px');
    expect(styles.borderRadius).toBe('8px');
    expect(styles.selectors).toBeUndefined();
  });

  it('should support slot targeting', () => {
    const styles = chain().nest('::v-deep(.slot-content)', (c:any) => c.box({p:16}).background('white')).$el('slot-parent');

    expect(styles._nestedRules).toBeDefined();
    expect(styles._nestedRules[0].selector).toContain('::v-deep');
  });
});