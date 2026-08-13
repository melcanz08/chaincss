import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStyleProxy } from '../../../src/core/entities/style-proxy';

function createMockCollector() {
  const styles: Record<string, any> = {};
  const mk = () => vi.fn(function(this: any){ return this; });
  return {
    set: vi.fn((k: string, v: any) => { styles[k] = v; }),
    getStyles: () => styles,
    hover: mk(), focus: mk(), active: mk(), checked: mk(), disabled: mk(),
    before: mk(), after: mk(), end: mk(), placeholder: mk(),
    grid: mk(), flex: mk(), background: mk(), animation: mk(), typography: mk(),
    box: mk(), position: mk(), transform: mk(), transition: mk(), filter: mk(),
    shadow: mk(), containerQuery: mk(), outline: mk(), scroll: mk(), list: mk(),
    $el: vi.fn((...s: string[]) => ({ selector: s.join(','), ...styles })),
    build: vi.fn(() => styles),
    explain: vi.fn(() => 'explain'),
    isMixed: vi.fn(() => false),
    addClass: vi.fn(), enableDebug: vi.fn(), intents: vi.fn(),
    media: mk(), supports: mk(), container: mk(), layer: mk(), nest: mk(),
    children: mk(), when: mk(), keyframes: vi.fn((n,s)=>{styles[`@keyframes ${n}`]=s}), fontFace: vi.fn(),
  } as any;
}

describe('StyleProxy - Robust', () => {
  let collector: ReturnType<typeof createMockCollector>;
  beforeEach(() => { collector = createMockCollector(); });

  it('anti-promise: then is undefined', () => {
    const proxy = createStyleProxy(collector, {});
    expect((proxy as any).then).toBeUndefined();
  });
  it('symbol passthrough', () => {
    const proxy = createStyleProxy(collector, {});
    const sym = Symbol('test');
    (collector as any)[sym] = 'ok';
    expect(proxy[sym]).toBe('ok');
  });
  it('WeakMap cache returns same fn reference', () => {
    const proxy = createStyleProxy(collector, {});
    expect(proxy.flex).toBe(proxy.flex);
  });
  it('fallback sets via target.set', () => {
    const proxy = createStyleProxy(collector, {});
    // v3 strict: unknown props throw, use .raw() instead
    expect(() => (proxy as any).backgroundColor('red')).toThrow('[ChainCSS v3.0]');
    proxy.raw('backgroundColor', 'red');
    expect(collector.set).toHaveBeenCalledWith('backgroundColor', 'red');
  });
  it('macro with (value, collector) mutation API', () => {
    const macros = { center: (v: any, c: any) => { c.display = 'flex'; c.justifyContent = 'center'; } };
    const proxy = createStyleProxy(collector, macros);
    proxy.center();
    expect(collector.set).toHaveBeenCalledWith('display', 'flex');
  });
  it('macro with return-object API', () => {
    const macros = { pill: () => ({ borderRadius: '9999px' }) };
    const proxy = createStyleProxy(collector, macros);
    proxy.pill();
    expect(collector.set).toHaveBeenCalledWith('borderRadius', '9999px');
  });
  it('macro with nestedRules.push', () => {
    const macros = {
      clickScale: (v: any, c: any) => {
        if (!c.nestedRules) c.nestedRules = [];
        c.nestedRules.push({ selector: '&:active', styles: { transform: 'scale(0.95)' } });
        c.cursor = 'pointer';
      }
    };
    const proxy = createStyleProxy(collector, macros);
    proxy.clickScale();
    expect((collector as any).nestedRules[0].selector).toBe('&:active');
  });
  it('macro with atRules.push', () => {
    const macros = {
      shimmer: (v: any, c: any) => {
        if (!c.atRules) c.atRules = [];
        c.atRules.push({ type: 'keyframes', name: 'shimmer', steps: {} });
        c.backgroundSize = '200% 100%';
      }
    };
    const proxy = createStyleProxy(collector, macros);
    proxy.shimmer();
    expect((collector as any).atRules[0].name).toBe('shimmer');
  });
  it('chaining returns proxy', () => {
    const proxy = createStyleProxy(collector, {});
    expect(proxy.flex().hover()).toBe(proxy);
  });
  it('terminal $el returns build result', () => {
    const proxy = createStyleProxy(collector, {});
    proxy.flex();
    expect(proxy.$el('test').selector).toContain('test');
  });
  it('intents forwards names to collector', () => {
    const proxy = createStyleProxy(collector, {});

    proxy.intents(['card', 'button-primary']);

    expect(collector.intents).toHaveBeenCalledWith([
      'card',
      'button-primary',
    ]);
  });
});

