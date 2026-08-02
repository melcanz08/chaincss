// __tests__/integration/framework/react.test.tsx
// React integration tests

import { describe, it, expect } from 'vitest';
import { chain } from '../../../src/core/entities/style-collector.js';

const getHover = (s: any) => s._nestedRules?.find((r: any) => r.selector === '&:hover')?.styles

describe('React Integration - Chain Styles', () => {
  it('should generate className-compatible selectors', () => {
    const styles = chain().flex().box({p:20}).typography({color:'red'}).$el('my-component');

    // selectors should be usable as classNames in JSX
    expect(Array.isArray(styles.selectors)).toBe(true);
    expect(styles.selectors[0]).toBeTruthy();
    expect(typeof styles.selectors[0]).toBe('string');
  });

  it('should handle component naming', () => {
    const styles = chain()
  .flex({display:'inline-flex'}).box({p:'8px 16px'})
  .$el('btn');

    expect(styles.selectors).toBeDefined();
    // Component metadata should be stripped from output
    expect(styles._componentName).toBeUndefined();
    expect(styles._generateComponent).toBeUndefined();
    expect(styles._framework).toBeUndefined();
  });

  it('should handle hover states for interactive components', () => {
    const styles = chain().background('#3b82f6').typography({color:'white'}).hover().background('#2563eb').end().$el('interactive-btn');

    expect(getHover(styles)).toBeDefined();
    expect(getHover(styles).background).toBe('#2563eb');
  });

  it('should handle conditional styles for React state', () => {
    const isActive = true;
    const isDisabled = false;

    const styles = chain()
    .box({p:12})
    .when(isActive, (c:any) => c.background('#10b981').typography({color:'white'}))
    .when(isDisabled, (c:any) => c.raw('opacity',0.5).raw('cursor','not-allowed'))
    .$el('stateful-btn');

    expect(styles.background).toBe('#10b981');
    expect(styles.color).toBe('white');
    expect(styles.opacity).toBeUndefined();
  });

  it('should support nested selectors for compound components', () => {
    const styles = chain()
  .flex({gap:8}).nest('& > *', (c:any) => c.flex({flex:1})).nest('&:first-child', (c:any) => c.typography({weight:700}))
  .$el('flex-container');

    expect(styles._nestedRules).toBeDefined();
    expect(styles._nestedRules.length).toBe(2);
  });

  it('should support media queries for responsive design', () => {
    const styles = chain()
  .flex({direction:'column'}).media('(min-width: 768px)', (c:any) => c.flex({direction:'row'}))
  .$el('responsive-container');

    expect(styles._atRules).toBeDefined();
    expect(styles._atRules[0].type).toBe('media');
  });
});