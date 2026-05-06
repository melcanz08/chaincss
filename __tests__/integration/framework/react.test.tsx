// __tests__/integration/framework/react.test.tsx
// React integration tests

import { describe, it, expect } from 'vitest';
import { createChain } from '../../../src/compiler/Chain.js';

describe('React Integration - Chain Styles', () => {
  it('should generate className-compatible selectors', () => {
    const styles = createChain()
      .display('flex')
      .padding(20)
      .color('red')
      .$el('my-component');

    // selectors should be usable as classNames in JSX
    expect(Array.isArray(styles.selectors)).toBe(true);
    expect(styles.selectors[0]).toBeTruthy();
    expect(typeof styles.selectors[0]).toBe('string');
  });

  it('should handle component naming', () => {
    const styles = createChain()
      .componentName('Button')
      .component('react')
      .display('inline-flex')
      .padding('8px 16px')
      .$el('btn');

    expect(styles.selectors).toBeDefined();
    // Component metadata should be stripped from output
    expect(styles._componentName).toBeUndefined();
    expect(styles._generateComponent).toBeUndefined();
    expect(styles._framework).toBeUndefined();
  });

  it('should handle hover states for interactive components', () => {
    const styles = createChain()
      .background('#3b82f6')
      .color('white')
      .hover()
      .background('#2563eb')
      .end()
      .$el('interactive-btn');

    expect(styles.hover).toBeDefined();
    expect(styles.hover.background).toBe('#2563eb');
  });

  it('should handle conditional styles for React state', () => {
    const isActive = true;
    const isDisabled = false;

    const styles = createChain()
      .padding(12)
      .when(isActive, (c) => c.background('#10b981').color('white'))
      .when(isDisabled, (c) => c.opacity(0.5).cursor('not-allowed'))
      .$el('stateful-btn');

    expect(styles.background).toBe('#10b981');
    expect(styles.color).toBe('white');
    expect(styles.opacity).toBeUndefined();
  });

  it('should support nested selectors for compound components', () => {
    const styles = createChain()
      .display('flex')
      .gap(8)
      .nest('& > *', (c) => c.flex(1))
      .nest('&:first-child', (c) => c.fontWeight(700))
      .$el('flex-container');

    expect(styles.nestedRules).toBeDefined();
    expect(styles.nestedRules.length).toBe(2);
  });

  it('should support media queries for responsive design', () => {
    const styles = createChain()
      .display('flex')
      .flexDirection('column')
      .media('(min-width: 768px)', (c) => c.flexDirection('row'))
      .$el('responsive-container');

    expect(styles.atRules).toBeDefined();
    expect(styles.atRules[0].type).toBe('media');
  });
});