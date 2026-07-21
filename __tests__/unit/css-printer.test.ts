// chaincss/__tests__/unit/css-printer.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createIR, createRule, createDeclaration, createKeyframeFrame } from '../../src/compiler/pipeline/ir/factory.js';
import { generateCSS } from '../../src/compiler/pipeline/ir/css-printer.js';
import type { IRAtRule } from '../../src/compiler/pipeline/ir/types.js';

describe('CSS Printer Structural Tests', () => {
  beforeEach(() => {
    // Ensure fresh IR IDs for tracking predictability across cases if needed
  });

  it('should correctly print structured @keyframes with isolated frames', () => {
    const ir = createIR(['test.ts']);
    const rule = createRule('.animate-box');
    
    const atRule: IRAtRule = {
      id: 'at-1',
      type: 'keyframes',
      name: 'slide-in',
      declarations: [],
      keyframes: [
        {
          ...createKeyframeFrame('from'),
          declarations: [createDeclaration('transform', 'translateX(-100%)')]
        },
        {
          ...createKeyframeFrame('to'),
          declarations: [createDeclaration('transform', 'translateX(0)')]
        }
      ],
      nestedRules: [],
      source: { line: 1, column: 1, file: 'test.ts' },
      history: []
    };
    
    rule.atRules.push(atRule);
    ir.rules.push(rule);

    const prettyCSS = generateCSS(ir, { minify: false });
    expect(prettyCSS).toContain('@keyframes slide-in {');
    expect(prettyCSS).toContain('from {');
    expect(prettyCSS).toContain('transform: translateX(-100%);');

    const minifiedCSS = generateCSS(ir, { minify: true });
    expect(minifiedCSS).toBe('@keyframes slide-in{from{transform:translateX(-100%);}to{transform:translateX(0);}}');
  });

  it('should cleanly strip whitespace when minify is true', () => {
    const ir = createIR(['test.ts']);
    const rule = createRule('.box');
    rule.declarations.push(createDeclaration('backgroundColor', '#ffffff'));
    rule.declarations.push(createDeclaration('padding', '1rem 2rem'));
    ir.rules.push(rule);

    const minified = generateCSS(ir, { minify: true });
    expect(minified).toBe('.box{background-color:#ffffff;padding:1rem 2rem;}');
  });
});