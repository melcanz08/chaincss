/**
 * Tests for the unified Chain API (StyleCollector) - v3.0
 * Only 16 typed shorthands: grid, flex, animation, background, typography, box, position, transition, transform, filter, shadow, containerQuery, outline, scroll, list, raw
 * + kept macros (center, pill, hide, mx/my, size, glass, etc)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { chain } from '../../src/core/entities/style-collector.js';
import { compileToCSS, partitionForBuild } from '../../src/core/usecases/style-compiler.js';
import { classifyValue } from '../../src/core/usecases/value-classifier.js';
import { ChainCSSCompiler } from '../../src/core/usecases/compiler.js';

const getHover = (s: any) => s._nestedRules?.find((r: any) => r.selector === '&:hover')?.styles

// ============================================================================
// Basic Properties
// ============================================================================

describe('Chain API — Basic Properties', () => {
  it('collects style properties with $el()', () => {
    const result = chain()
     .flex()
     .box({ padding: 20 })
     .$el('my-component');

    expect(result.selectors).toEqual(['.chain-my-component']);
    expect(result.display).toBe('flex');
    expect(result.padding).toBe('20px');
  });

  it('handles multiple selectors', () => {
    const result = chain()
     .typography({ color: 'red' })
     .$el('component-a', 'component-b');

    expect(result.selectors).toEqual(['.chain-component-a', '.chain-component-b']);
  });

  it('returns raw styles with build() when no selectors', () => {
    const result = chain()
     .background('blue')
     .typography({ fontSize: 16 })
     .build();

    expect(result.selectors).toBeUndefined();
    expect(result.background).toBe('blue');
    expect(result.fontSize).toBe('16px');
  });

  it('converts numeric values to px automatically', () => {
    const result = chain()
     .box({ width: 100, height: 50, margin: 10 })
     .$el('test');

    expect(result.width).toBe('100px');
    expect(result.height).toBe('50px');
    expect(result.margin).toBe('10px');
  });

  it('does not add px to unitless properties', () => {
    const result = chain()
     .position({ zIndex: 10 })
     .typography({ opacity: 0.5, fontWeight: 700 })
     .flex({ grow: 1 })
     .$el('test');

    expect(result.zIndex).toBe(10);
    expect(result.opacity).toBe(0.5);
    expect(result.flexGrow).toBe(1);
    expect(result.fontWeight).toBe(700);
  });
});

// ============================================================================
// Selector Handling
// ============================================================================

describe('Chain API — Selector Handling', () => {
  it('preserves user dot prefixes', () => {
    const result = chain()
     .typography({ color: 'red' })
     .$el('.my-class');

    expect(result.selectors).toContain('.my-class');
  });

  it('adds.chain- prefix for plain names', () => {
    const result = chain()
     .typography({ color: 'red' })
     .$el('plain-component');

    expect(result.selectors).toContain('.chain-plain-component');
  });

  it('does not double-prefix selectors that already have prefixes', () => {
    const result = chain()
     .typography({ color: 'red' })
     .$el('.btn', '#card', '[data-test]', ':hover');

    expect(result.selectors).toEqual(['.btn', '#card', '[data-test]', ':hover']);
  });

  it('handles wildcard selector', () => {
    const result = chain()
     .typography({ color: 'red' })
     .$el('*');

    expect(result.selectors).toContain('*');
  });
});

// ============================================================================
// Isolation (no shared references)
// ============================================================================

describe('Chain API — Isolation', () => {
  it('does not share state between $el calls', () => {
    const c = chain();

    const result1 = c
     .typography({ color: 'red' })
     .hover()
       .typography({ color: 'blue' })
     .end()
     .$el('test1');

    const result2 = c
     .typography({ color: 'green' })
     .$el('test2');

    expect(result2['&:hover']).toBeUndefined();
    expect(result2.color).toBe('green');
  });

  it('does not mutate previous results', () => {
    const c = chain();

    const result1 = c
     .typography({ color: 'red' })
     .$el('first');

    const savedColor = result1.color;

    c.typography({ color: 'blue' }).$el('second');

    expect(result1.color).toBe(savedColor);
  });
});

// ============================================================================
// Hover & States
// ============================================================================

describe('Chain API — Hover & States', () => {
  it('captures hover styles', () => {
    const result = chain()
     .typography({ color: 'black' })
     .hover()
       .typography({ color: 'red' })
       .background('blue')
     .end()
     .$el('btn');

    expect(getHover(result)).toBeDefined();
    expect(getHover(result).color).toBe('red');
    expect(getHover(result).background).toBe('blue');
  });

  it('clears hover after end()', () => {
    const result = chain()
     .hover()
       .typography({ color: 'red' })
     .end()
     .typography({ color: 'blue' })
     .$el('test');

    expect(result.color).toBe('blue');
    expect(getHover(result).color).toBe('red');
  });
});

// ============================================================================
// Macros
// ============================================================================

describe('Chain API — Macros', () => {
  it('flex() sets display flex', () => {
    const result = chain().flex().$el('test');
    expect(result.display).toBe('flex');
  });

  it('grid() sets display grid', () => {
    const result = chain().grid().$el('test');
    expect(result.display).toBe('grid');
  });

  it('center() creates flex centering', () => {
    const result = chain().center().$el('centered');
    expect(result.display).toBe('flex');
    expect(result.justifyContent).toBe('center');
    expect(result.alignItems).toBe('center');
  });

  it('pill() creates pill shape', () => {
    const result = chain().pill().$el('badge');
    expect(result.borderRadius).toBe('9999px');
  });

  it('hide() sets visibility hidden', () => {
    const result = chain().hide().$el('hidden');
    expect(result.visibility).toBe('hidden');
    expect(result.opacity).toBe(0);
  });

  it('gap() sets gap with px', () => {
    const result = chain().flex({ gap: 16 }).$el('spaced');
    expect(result.gap).toBe('16px');
  });

  it('mx/my/px/py spacing macros work', () => {
    const result = chain()
     .mx(10)
     .my(20)
     .$el('spaced');

    expect(result.marginLeft).toBe('10px');
    expect(result.marginRight).toBe('10px');
    expect(result.marginTop).toBe('20px');
    expect(result.marginBottom).toBe('20px');
  });

  it('size() sets width and height', () => {
    const result = chain().size(50).$el('square');
    expect(result.width).toBe('50px');
    expect(result.height).toBe('50px');
  });

  it('glass() creates glassmorphism effect', () => {
    const result = chain().glass().$el('card');
    expect(result.backdropFilter).toBeDefined();
    expect(result.backgroundColor).toBe('rgba(255, 255, 255, 0.1)');
  });
});

// ============================================================================
// Nested Selectors
// ============================================================================

describe('Chain API — Nested Selectors', () => {
  it('nest() creates child selectors', () => {
    const result = chain()
     .typography({ color: 'black' })
     .nest('.child', (c: any) => c.typography({ color: 'red', fontSize: 14 }))
     .$el('parent');

    expect(result._nestedRules).toBeDefined();
    expect(result._nestedRules.length).toBe(1);
    expect(result._nestedRules[0].selector).toBe('.child');
    expect(result._nestedRules[0].styles.color).toBe('red');
  });

  it('handles multiple nested selectors', () => {
    const result = chain()
     .nest('&:hover', (c) => c.typography({ color: 'red' }))
     .nest('&::before', (c) => c.flex())
     .$el('element');

    expect(result._nestedRules?.length).toBe(2);
  });
});

// ============================================================================
// Conditional Styles
// ============================================================================

describe('Chain API — Conditional Styles', () => {
  it('applies styles when condition is true', () => {
    const result = chain()
     .typography({ color: 'black' })
     .when(true, (c: any) => c.typography({ color: 'red', fontSize: 20 }))
     .$el('conditional');

    expect(result.color).toBe('red');
    expect(result.fontSize).toBe('20px');
  });

  it('does NOT apply styles when condition is false', () => {
    const result = chain()
     .typography({ color: 'black' })
     .when(false, (c:any) => c.typography({ color: 'red' }))
     .$el('conditional');

    expect(result.color).toBe('black');
  });
});

// ============================================================================
// At-Rules
// ============================================================================

describe('Chain API — At-Rules', () => {
  it('media() wraps styles in media query', () => {
    const result = chain()
     .background('red')
     .media('(min-width: 768px)', (c:any) => {
        c.background('blue');
      })
     .$el('element');

    expect(result._atRules).toBeDefined();
    expect(result._atRules[0].type).toBe('media');
    expect(result._atRules[0].query).toBe('(min-width: 768px)');
  });

  it('supports() wraps in feature query', () => {
    const result = chain()
     .supports('display: grid', (c) => {
        c.grid();
      })
     .$el('element');

    expect(result._atRules![0].type).toBe('supports');
  });

  it('container() handles @container queries', () => {
    const result = chain()
     .container('(min-width: 400px)', (c) => c.typography({ color: 'red' }))
     .$el('responsive');

    expect(result._atRules![0].type).toBe('container');
    expect(result._atRules![0].condition).toBe('(min-width: 400px)');
  });

  it('keyframes() creates animation', () => {
    const result = chain()
     .keyframes('fadeIn', {
        '0%': { opacity: 0 },
        '100%': { opacity: 1 },
      })
     .build();

    expect(result._atRules![0].type).toBe('keyframes');
    expect(result._atRules![0].name).toBe('fadeIn');
  });
});

// ============================================================================
// Dynamic Values (Runtime)
// ============================================================================

describe('Chain API — Dynamic Values', () => {
  it('preserves functions for runtime', () => {
    const dynamicColor = () => 'red';
    const result = chain()
     .background('white')
     .raw('color', dynamicColor)
     .$el('button');

    expect(result.background).toBe('white');
    expect(result.color).toBe(dynamicColor);
  });

  it('preserves theme references for token resolution', () => {
    const result = chain()
     .typography({ color: 'theme.primary' })
     .$el('themed');

    expect(result.color).toBeDefined();
  });
});

// ============================================================================
// Transform Methods
// ============================================================================

describe('Chain API — Transforms', () => {
  it('scale() adds scale transform', () => {
    const result = chain().transform({ scale: 1.5 }).$el('scaled');
    expect(result.transform).toContain('scale(1.5)');
  });

  it('combines multiple transforms', () => {
    const result = chain()
     .transform({ scale: 1.2, rotate: '45deg', translateX: 10, translateY: 20 })
     .$el('transformed');

    expect(result.transform).toContain('scale(1.2)');
    expect(result.transform).toContain('rotate(45deg)');
    expect(result.transform).toContain('translateX(10px)');
    expect(result.transform).toContain('translateY(20px)');
  });

  it('adds px to translate values', () => {
    const result = chain().transform({ translateX: 50 }).$el('moved');
    expect(result.transform).toBe('translateX(50px)');
  });
});

// ============================================================================
// Debug / Explain
// ============================================================================

describe('Chain API — Explain (Debug)', () => {
  it('returns explanation in debug mode', () => {
    const c = chain({ debug: true });
    c.background('red');
    c.raw('color', () => 'blue');
    c.box({ padding: 16 });

    const explanation = c.explain();
    expect(explanation.summary.totalNodes).toBe(3);
    expect(explanation.summary.staticNodes).toBe(2);
    expect(explanation.summary.dynamicNodes).toBe(1);
    expect(explanation.visualization).toContain('ChainCSS Style Explanation');
  });

  it('shows message when debug is off', () => {
    const c = chain();
    c.background('red');
    const explanation = c.explain();
    expect(explanation.visualization).toContain('Enable debug mode');
  });
});

// ============================================================================
// CSS Compilation
// ============================================================================

describe('CSS Compilation', () => {
  it('compiles basic styles to CSS', () => {
    const styles = chain()
     .background('red')
     .typography({ color: 'white' })
     .box({ padding: 16 })
     .build();

    const css = compileToCSS(styles, { scopeSelector: '.button' });

    expect(css).toContain('.button {');
    expect(css).toContain('background: red;');
    expect(css).toContain('color: white;');
    expect(css).toContain('padding: 16px;');
  });

  it('preserves intents through build()', () => {
    const styles = chain()
      .intents(['card'])
      .build();

    expect(styles._intents).toEqual(['card']);
  });

  it('resolves a single intent through the fluent API', () => {
    const compiler = new ChainCSSCompiler({
      tokens: {},
      atomic: { enabled: false },
      output: { minify: false },
    });

    const styles = chain()
      .intents(['card'])
      .$el('card');

    const result = compiler.compileStyle('card', styles);
    const css = result.css;

    expect(css).toContain('display: flex');
    expect(css).toContain('flex-direction: column');
    expect(css).toContain('overflow: hidden');
  });

  it('emits CSS custom property placeholder for functions', () => {
    const styles = chain()
     .background('red')
     .raw('color', () => 'dynamic')
     .build();

    const css = compileToCSS(styles, { scopeSelector: '.button' });
    expect(css).toContain('background: red;');
    const lines = css.split('\n');
    const colorLine = lines.find(l => l.trim().startsWith('color:'));
    expect(colorLine).toBeDefined();
    expect(colorLine).toContain('var(--button-color');
  });

  it('partitions static and dynamic values for build', () => {
    const styles = chain()
     .background('red')
     .raw('color', () => 'dynamic')
     .box({ padding: 16 })
     .build(['button']);

    const { css, dynamicValues, hasDynamic } = partitionForBuild(styles, { scopeSelector: '.button' });

    expect(css).toContain('background: red;');
    expect(css).toContain('padding: 16px;');
    expect(hasDynamic).toBe(true);
    expect(typeof dynamicValues.color).toBe('function');
  });
});

// ============================================================================
// Value Classifier
// ============================================================================

describe('Value Classifier', () => {
  it('classifies static values', () => {
    expect(classifyValue('red')).toBe('static');
    expect(classifyValue('#ff0000')).toBe('static');
    expect(classifyValue('10px')).toBe('static');
    expect(classifyValue(20)).toBe('static');
    expect(classifyValue(1.5)).toBe('static');
  });

  it('classifies functions as dynamic', () => {
    expect(classifyValue(() => 'red')).toBe('dynamic');
  });

  it('classifies theme/prop references as dynamic', () => {
    expect(classifyValue('theme.primary')).toBe('dynamic');
    expect(classifyValue('props.color')).toBe('dynamic');
    expect(classifyValue('${someVar}')).toBe('dynamic');
  });
});