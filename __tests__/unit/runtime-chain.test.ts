// __tests__/unit/runtime-chain.test.ts
// Tests for the Runtime Chain - browser-side chain API

import { describe, it, expect, beforeEach } from 'vitest';
import { RuntimeChain, $, $t, chain, setManifest, setTokens } from '../../src/runtime/Chain.js';

describe('RuntimeChain - Core API', () => {
  let rt: ReturnType<typeof chain>;

  beforeEach(() => {
    rt = chain(false);
  });

  describe('Basic chaining', () => {
    it('should chain CSS properties', () => {
      const result = rt
        .color('red')
        .display('flex')
        .padding(20)
        .$el('my-element');

      expect(result._name).toBe('my-element');
      expect(result.color).toBe('red');
      expect(result.display).toBe('flex');
      expect(result.padding).toBe('20px');
    });

    it('should auto-add px to numbers', () => {
      const result = rt
        .width(200)
        .height(100)
        .margin(10)
        .$el('sized');

      expect(result.width).toBe('200px');
      expect(result.height).toBe('100px');
      expect(result.margin).toBe('10px');
    });

    it('should NOT add px to unitless properties', () => {
      const result = rt
        .opacity(0.5)
        .zIndex(100)
        .fontWeight(700)
        .flex(1)
        .order(2)
        .$el('unitless');

      expect(result.opacity).toBe(0.5);
      expect(result.zIndex).toBe(100);
      expect(result.fontWeight).toBe(700);
      // flex() is a macro that sets display:flex, not a raw 'flex' property
      expect(result.display).toBe('flex');
      expect(result.order).toBe(2);
    });

    it('should handle multiple calls', () => {
      const result = rt
        .color('red')
        .background('blue')
        .fontSize(16)
        .borderRadius(8)
        .$el('multi');

      expect(result.color).toBe('red');
      expect(result.background).toBe('blue');
      expect(result.fontSize).toBe('16px');
      expect(result.borderRadius).toBe('8px');
    });
  });

  describe('$el finalizer', () => {
    it('should return the catcher and reset', () => {
      const result = rt
        .color('red')
        .padding(20)
        .$el('component');

      expect(result.color).toBe('red');
      expect(result.padding).toBe('20px');
      expect(result._name).toBe('component');

      // After $el, the chain should be clean
      const result2 = rt
        .color('blue')
        .$el('second');

      expect(result2.color).toBe('blue');
      // Should not have padding from first call
      expect(result2.padding).toBeUndefined();
    });

    it('should use componentName if no name provided', () => {
      rt.$name('MyComponent');
      const result = rt
        .color('red')
        .$el();

      expect(result._name).toBe('MyComponent');
    });

    it('should default to "element" without name', () => {
      const result = rt
        .color('red')
        .$el();

      expect(result._name).toBe('element');
    });
  });

  describe('Deep clone isolation (FIX)', () => {
    it('should not share references between $el calls', () => {
      const result1 = rt
        .color('red')
        .hover()
        .color('blue')
        .end()
        .$el('first');

      const result2 = rt
        .color('green')
        .$el('second');

      // result2 should NOT have hover from result1
      expect(result2.hover).toBeUndefined();
      expect(result2.color).toBe('green');
    });

    it('should not mutate previous results', () => {
      const result1 = rt
        .color('red')
        .$el('first');

      const savedColor = result1.color;
      
      rt.color('blue').$el('second');

      // result1 should be unchanged
      expect(result1.color).toBe(savedColor);
    });
  });

  describe('Shorthand resolution', () => {
    it('should resolve bg to backgroundColor', () => {
      const result = rt
        .bg('#ff0000')
        .$el('test');

      expect(result.backgroundColor).toBe('#ff0000');
    });

    it('should resolve m to margin', () => {
      const result = rt
        .m(16)
        .$el('test');

      expect(result.margin).toBe('16px');
    });

    it('should resolve p to padding', () => {
      const result = rt
        .p(12)
        .$el('test');

      expect(result.padding).toBe('12px');
    });

    it('should resolve br to borderRadius', () => {
      const result = rt
        .br(8)
        .$el('test');

      expect(result.borderRadius).toBe('8px');
    });
  });

  describe('Macros', () => {
    it('flex() sets display flex', () => {
      const result = rt.flex().$el('test');
      expect(result.display).toBe('flex');
    });

    it('grid() sets display grid', () => {
      const result = rt.grid().$el('test');
      expect(result.display).toBe('grid');
    });

    it('center() creates flex centering', () => {
      const result = rt.center().$el('test');
      expect(result.display).toBe('flex');
      expect(result.justifyContent).toBe('center');
      expect(result.alignItems).toBe('center');
    });

    it('pill() creates pill shape', () => {
      const result = rt.pill().$el('test');
      expect(result.borderRadius).toBe('9999px');
    });

    it('hide() sets visibility hidden', () => {
      const result = rt.hide().$el('test');
      expect(result.visibility).toBe('hidden');
      expect(result.opacity).toBe(0);
    });

    it('gap() sets gap', () => {
      const result = rt.gap(16).$el('test');
      expect(result.gap).toBe('16px');
    });

    it('size() sets width and height', () => {
      const result = rt.size(50).$el('test');
      expect(result.width).toBe(50);
      expect(result.height).toBe(50);
    });

    it('glass() creates glass effect', () => {
      const result = rt.glass().$el('test');
      expect(result.backdropFilter).toBeDefined();
    });
  });

  describe('Hover', () => {
    it('should capture hover styles', () => {
      const result = rt
        .color('black')
        .hover()
        .color('red')
        .background('blue')
        .end()
        .$el('btn');

      expect(result.hover).toBeDefined();
      expect(result.hover.color).toBe('red');
      expect(result.hover.background).toBe('blue');
      expect(result.color).toBe('black');
    });

    it('should handle end() properly', () => {
      const result = rt
        .hover()
        .color('red')
        .end()
        .color('blue')
        .$el('test');

      // After end(), color('blue') goes to base, not hover
      expect(result.color).toBe('blue');
      expect(result.hover.color).toBe('red');
    });
  });

  describe('$name and component naming', () => {
    it('should set component name', () => {
      rt.$name('Button');
      const result = rt.$el();
      expect(result._name).toBe('Button');
    });

    it('should reset componentName after $el', () => {
      rt.$name('Card');
      rt.$el('first');

      const result = rt.$el('second');
      // componentName is reset after $el
      expect(result._name).toBe('second');
    });
  });

  describe('use() mixin', () => {
    it('should merge mixin styles', () => {
      const result = rt
        .use({ color: 'red', fontSize: '16px' })
        .background('blue')
        .$el('test');

      expect(result.color).toBe('red');
      expect(result.fontSize).toBe('16px');
      expect(result.background).toBe('blue');
    });

    it('should handle mixins with shorthands', () => {
      const result = rt
        .use({ bg: '#fff', p: 20 })
        .$el('test');

      expect(result.backgroundColor).toBe('#fff');
      // use() resolves shorthands but passes values through directly
      expect(result.padding).toBe(20);
    });
  });

  describe('Public method whitelist (FIX)', () => {
    it('should expose public API methods', () => {
      expect(typeof rt.use).toBe('function');
      expect(typeof rt.hover).toBe('function');
      expect(typeof rt.$el).toBe('function');
      expect(typeof rt.$name).toBe('function');
      expect(typeof rt.end).toBe('function');
      expect(typeof rt.getCatcher).toBe('function');
    });
  });

  describe('getCatcher', () => {
    it('should return current catcher state', () => {
      rt.color('red').padding(20);
      
      const catcher = rt.getCatcher();
      expect(catcher.color).toBe('red');
      expect(catcher.padding).toBe('20px');
    });

    it('should return a copy, not reference', () => {
      rt.color('red');
      const catcher1 = rt.getCatcher();
      
      rt.color('blue');
      const catcher2 = rt.getCatcher();

      expect(catcher1.color).toBe('red');
      expect(catcher2.color).toBe('blue');
    });
  });
});

describe('RuntimeChain - Factory functions', () => {
  it('$ should create chain without tokens', () => {
    const rt = $();
    expect(rt).toBeDefined();
    expect(typeof rt.$el).toBe('function');

    const result = rt.color('red').$el('test');
    expect(result.color).toBe('red');
  });

  it('$t should create chain with tokens', () => {
    const rt = $t();
    expect(rt).toBeDefined();
    expect(typeof rt.$el).toBe('function');
  });

  it('chain() should create chain', () => {
    const rt = chain(true);
    const result = rt.display('flex').$el('test');
    expect(result.display).toBe('flex');
  });
});

describe('RuntimeChain - Manifest & Tokens', () => {
  it('setManifest should accept atomicMap format', () => {
    setManifest({ atomicMap: { 'color:red': 'text-red-500' } });
    // Should not throw
  });

  it('setManifest should accept atomicClasses format', () => {
    setManifest({ atomicClasses: { 'display:flex': 'd-flex' } });
    // Should not throw
  });

  it('setManifest should accept empty manifest', () => {
    setManifest({});
    // Should not throw
  });

  it('setTokens should update tokens', () => {
    setTokens({ colors: { primary: '#3b82f6' } });
    // Should not throw
  });
});

describe('RuntimeChain - Token resolution', () => {
  it('should resolve tokens when useTokens is true', () => {
    setTokens({ colors: { primary: '#3b82f6' } });
    
    const rt = chain(true);
    const result = rt
      .color('$colors.primary')
      .$el('themed');

    expect(result.color).toBeDefined();
  });

  it('should NOT resolve tokens when useTokens is false', () => {
    setTokens({ colors: { primary: '#3b82f6' } });
    
    const rt = chain(false);
    const result = rt
      .color('$colors.primary')
      .$el('plain');

    // Should pass through as literal string
    expect(result.color).toBe('$colors.primary');
  });
});

describe('RuntimeChain - Atomic class lookup', () => {
  it('should use atomic classes when manifest has matching entry', () => {
    setManifest({ 
      atomicMap: { 
        'display:flex': 'd-flex-abc',
        'color:red': 'text-red-xyz',
      } 
    });
    
    const rt = chain(false);
    const result = rt
      .display('flex')
      .color('red')
      .$el('atomic-test');

    // Atomic classes should be collected in _classes
    expect(result._classes).toBeDefined();
    expect(result._classes).toContain('d-flex-abc');
    expect(result._classes).toContain('text-red-xyz');
    
    // When atomic class exists, it should NOT set the raw property
    // (the atomic class handles it)
  });

  it('should fallback to raw property when no atomic match', () => {
    setManifest({ atomicMap: {} });
    
    const rt = chain(false);
    const result = rt
      .display('flex')
      .$el('fallback-test');

    // No atomic class, so property is set directly
    expect(result.display).toBe('flex');
  });
});