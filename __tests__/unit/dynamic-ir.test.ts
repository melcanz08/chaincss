// ============================================================================
// __tests__/unit/dynamic-ir.test.ts
// Phase 2 + Phase 3: IR dynamic metadata + CSS printer var() emission
// ============================================================================

import { describe, it, expect } from 'vitest';
import { createIR, createRule, createDeclaration, generateCSS } from '../../src/compiler/pipeline/ir/index.js';
import { parseIR } from '../../src/compiler/pipeline/ir/parser.js';
import { getDynamicVariableName } from '../../src/compiler/pipeline/dynamic/dynamic-variable.js';
import { chain } from '../../src/core/entities/style-collector.js';
import { ChainCSSCompiler } from '../../src/core/usecases/compiler.js';
import { compileToCSS } from '../../src/core/usecases/style-compiler.js';

describe('Dynamic IR', () => {
  // ==========================================================================
  // Phase 2: IR metadata
  // ==========================================================================

  describe('parseIR preserves dynamic metadata', () => {
    it('preserves static declarations unchanged', () => {
      const ir = parseIR({
        test: { selectors: ['.btn'], color: 'red', padding: 16 },
      });

      const colorDecl = ir.rules[0].declarations.find(d => d.property === 'color');
      expect(colorDecl).toBeDefined();
      expect(colorDecl!.value).toBe('red');
      expect(colorDecl!.dynamic).toBeUndefined();

      const paddingDecl = ir.rules[0].declarations.find(d => d.property === 'padding');
      expect(paddingDecl).toBeDefined();
      expect(paddingDecl!.value).toBe(16);
      expect(paddingDecl!.dynamic).toBeUndefined();
    });

    it('captures function values as dynamic', () => {
      const fn = () => 'blue';
      const ir = parseIR({
        test: { selectors: ['.btn'], color: fn },
      });

      const decl = ir.rules[0].declarations[0];
      expect(decl.property).toBe('color');
      expect(decl.dynamic).toBeDefined();
      expect(decl.dynamic!.kind).toBe('function');
      expect(decl.dynamic!.variable).toBe('--btn-color');
      expect(decl.value).toBe('');
    });

    it('captures theme token strings as dynamic', () => {
      const ir = parseIR({
        test: { selectors: ['.btn'], color: 'theme.primary' },
      });

      const decl = ir.rules[0].declarations[0];
      expect(decl.dynamic).toBeDefined();
      expect(decl.dynamic!.kind).toBe('token');
      expect(decl.dynamic!.variable).toBe('--btn-color');
    });

    it('captures props token strings as dynamic', () => {
      const ir = parseIR({
        test: { selectors: ['.btn'], color: 'props.activeColor' },
      });

      const decl = ir.rules[0].declarations[0];
      expect(decl.dynamic).toBeDefined();
      expect(decl.dynamic!.kind).toBe('prop');
      expect(decl.dynamic!.variable).toBe('--btn-color');
    });

    it('captures template literal strings as dynamic', () => {
      const ir = parseIR({
        test: { selectors: ['.btn'], content: '${icon}' },
      });

      const decl = ir.rules[0].declarations[0];
      expect(decl.dynamic).toBeDefined();
      expect(decl.dynamic!.kind).toBe('prop');
    });

    it('preserves mixed static and dynamic declarations', () => {
      const fn = () => 'blue';
      const ir = parseIR({
        test: { selectors: ['.btn'], color: fn, padding: 16, margin: '8px' },
      });

      const decls = ir.rules[0].declarations;
      expect(decls.length).toBe(3);

      const staticDecls = decls.filter(d => !d.dynamic);
      expect(staticDecls.length).toBe(2);
      expect(staticDecls.map(d => d.property).sort()).toEqual(['margin', 'padding']);

      const dynamicDecls = decls.filter(d => d.dynamic);
      expect(dynamicDecls.length).toBe(1);
      expect(dynamicDecls[0].property).toBe('color');
    });

    it('produces deterministic variable names', () => {
      const name1 = getDynamicVariableName('.chain-btn', 'color');
      const name2 = getDynamicVariableName('.chain-btn', 'color');
      expect(name1).toBe(name2);
      expect(name1).toBe('--chain-btn-color');
    });

    it('handles ID selectors in variable names', () => {
      const name = getDynamicVariableName('#hero', 'fontSize');
      expect(name).toBe('--hero-font-size');
    });

    it('produces serializable IR (no functions in JSON)', () => {
      const fn = () => 'blue';
      const ir = parseIR({
        test: { selectors: ['.btn'], color: fn },
      });

      const serialized = JSON.stringify(ir);
      // No arrow functions in serialized IR
      expect(serialized).not.toContain('=>');
      // 'function' appears as the string "function" in "kind":"function" — that's safe
      // Verify the dynamic metadata survives round-trip
      const restored = JSON.parse(serialized);
      expect(restored.rules[0].declarations[0].dynamic.kind).toBe('function');
      expect(restored.rules[0].declarations[0].dynamic.variable).toBe('--btn-color');
    });
  });

  // ==========================================================================
  // Phase 3: CSS printer var() emission
  // ==========================================================================

  describe('css-printer emits var() for dynamic declarations', () => {
    it('emits CSS variable for a dynamic declaration', () => {
      const ir = createIR();
      const rule = createRule('.chain-btn');
      rule.declarations.push(
        createDeclaration('color', '', undefined, {
          dynamic: { kind: 'function', variable: '--chain-btn-color' },
        }),
      );
      ir.rules.push(rule);

      const css = generateCSS(ir);
      expect(css).toContain('color: var(--chain-btn-color);');
    });

    it('emits static values normally', () => {
      const ir = createIR();
      const rule = createRule('.chain-btn');
      rule.declarations.push(createDeclaration('padding', '16px'));
      ir.rules.push(rule);

      const css = generateCSS(ir);
      expect(css).toContain('padding: 16px;');
    });

    it('emits mixed static and dynamic declarations', () => {
      const ir = createIR();
      const rule = createRule('.chain-btn');
      rule.declarations.push(createDeclaration('padding', '16px'));
      rule.declarations.push(
        createDeclaration('color', '', undefined, {
          dynamic: { kind: 'function', variable: '--chain-btn-color' },
        }),
      );
      ir.rules.push(rule);

      const css = generateCSS(ir);
      expect(css).toContain('padding: 16px;');
      expect(css).toContain('color: var(--chain-btn-color);');
    });

    it('emits full rule block with selector', () => {
      const ir = createIR();
      const rule = createRule('.chain-btn');
      rule.declarations.push(
        createDeclaration('color', '', undefined, {
          dynamic: { kind: 'function', variable: '--chain-btn-color' },
        }),
      );
      ir.rules.push(rule);

      const css = generateCSS(ir);
      expect(css).toContain('.chain-btn {');
      expect(css).toContain('}');
    });

    /*it('preserves important flag on dynamic declarations', () => {
      const ir = createIR();
      const rule = createRule('.chain-btn');
      const decl = createDeclaration('color', '', undefined, {
        dynamic: { kind: 'function', variable: '--chain-btn-color' },
      });
      decl.important = true;
      rule.declarations.push(decl);
      ir.rules.push(rule);

      const css = generateCSS(ir);
      expect(css).toContain('color: var(--chain-btn-color) !important;');
    });*/
  });

  // ==========================================================================
  // Phase 3: End-to-end pipeline
  // ==========================================================================

  describe('end-to-end mixed mode through pipeline', () => {
    it('preserves mixed static and dynamic through the compiler', () => {
      const compiler = new ChainCSSCompiler({
        tokens: {},
        atomic: { enabled: false },
        output: { minify: false },
      });

      const fn = () => 'red';
      const styles = chain()
        .box({ padding: 16 })
        .raw('color', fn)
        .$el('btn');

      const result = compiler.compileStyle('btn', styles);
      const css = result.css;

      // Static value present
      expect(css).toContain('padding: 16px');
      // Dynamic value emitted as var()
      expect(css).toContain('color: var(--chain-btn-color)');
      // Both in the same rule block
      expect(css).toContain('.chain-btn');
    });
  });

  // ==========================================================================
  // Phase 4: Pipeline parity with direct (legacy) compiler
  // ==========================================================================

  describe('pipeline parity with compileToCSS', () => {
  it('produces equivalent CSS for static styles via both paths', () => {
    const styles = chain()
      .box({ padding: 16, borderRadius: 8 })
      .typography({ color: 'red', fontWeight: '600' })
      .$el('btn');

    const compiler = new ChainCSSCompiler({
      tokens: {},
      atomic: { enabled: false },
      output: { minify: false },
    });

    const pipelineCSS = compiler.compileStyle('btn', styles).css;
    const directCSS = compileToCSS(styles, { scopeSelector: '.chain-btn' });

    // Both paths produce equivalent structural CSS
    for (const expected of ['.chain-btn', 'padding: 16px', 'border-radius: 8px', 'color: red', 'font-weight: 600']) {
      expect(pipelineCSS).toContain(expected);
      expect(directCSS).toContain(expected);
    }
  });

  it('produces equivalent CSS for mixed static + dynamic styles', () => {
    const fn = () => 'blue';
    const styles = chain()
      .box({ padding: 16 })
      .raw('color', fn)
      .$el('btn');

    const compiler = new ChainCSSCompiler({
      tokens: {},
      atomic: { enabled: false },
      output: { minify: false },
    });

    const pipelineCSS = compiler.compileStyle('btn', styles).css;
    const directCSS = compileToCSS(styles, { scopeSelector: '.chain-btn' });

    expect(pipelineCSS).toContain('padding: 16px');
    expect(pipelineCSS).toContain('color: var(--chain-btn-color)');
    expect(directCSS).toContain('padding: 16px');
    expect(directCSS).toContain('color: var(--chain-btn-color)');
    expect(directCSS).not.toContain('[object Object]');
    expect(directCSS).not.toContain('style:');
  });

  it('preserves runtime bindings', () => {
    const fn = () => 'blue';
    const styles = chain()
      .raw('color', fn)
      .box({ padding: 16 })
      .$el('btn');

    const compiler = new ChainCSSCompiler({
      tokens: {},
      atomic: { enabled: false },
      output: { minify: false },
    });

    const result = compiler.compileStyle('btn', styles);
    expect(result.dynamic).toBeDefined();
    expect(result.dynamic!.color).toBeDefined();
    expect(typeof result.dynamic!.color).toBe('function');
  });
});
});