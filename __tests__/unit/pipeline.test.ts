// __tests__/unit/pipeline.test.ts

// __tests__/unit/pipeline.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { Pipeline } from '../../src/compiler/pipeline/pipeline.js';
import { createDefaultPipeline, createFullPipeline } from '../../src/compiler/pipeline/unified-pipeline.js';
import { createIR, createRule, createDeclaration, resetIdCounter } from '../../src/style-ir.js';
import type { StyleIR } from '../../src/style-ir.js';

describe('Pipeline (New Architecture)', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('Pipeline Orchestrator', () => {
    it('executes stages in correct order', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      ir.rules.push(createRule('.test'));

      const result = await pipeline.execute(ir);
      const stages = result.timeline.map(t => t.stage);

      // Validation must come before Optimization
      const validationIdx = stages.indexOf('validation');
      const optimizationIdx = stages.indexOf('optimization');
      expect(validationIdx).toBeLessThan(optimizationIdx);
    });

    it('runs without errors on empty IR', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR();

      const result = await pipeline.execute(ir);
      expect(result.ir).toBeDefined();
      expect(result.timeline.length).toBeGreaterThan(0);
    });

    it('generates a readable report', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR();
      ir.rules.push(createRule('.test'));

      const result = await pipeline.execute(ir);
      const report = pipeline.report(result.timeline);

      expect(report).toContain('Pipeline Report');
      expect(report).toContain('VALIDATION');
      expect(report).toContain('OPTIMIZATION');
      expect(report).toContain('NORMALIZATION');
    });

    it('tracks timing for each stage', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR();
      ir.rules.push(createRule('.test'));

      const result = await pipeline.execute(ir);
      
      for (const entry of result.timeline) {
        expect(entry.duration).toBeGreaterThanOrEqual(0);
        expect(entry.stage).toBeDefined();
        expect(entry.pass).toBeDefined();
      }
    });
  });

  describe('Accessibility Validator (Stage 2)', () => {
    it('flags font sizes below minimum', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.small-text');
      rule.declarations.push(createDeclaration('fontSize', '10px'));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      
      const diags = result.ir.diagnostics.filter(d => d.pass.includes('accessibility'));
      expect(diags.length).toBeGreaterThan(0);
      expect(diags[0].message).toContain('font-size');
    });

    it('flags missing focus indicators', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.interactive');
      rule.declarations.push(createDeclaration('cursor', 'pointer'));
      rule.declarations.push(createDeclaration('outline', 'none'));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      
      const focusDiags = result.ir.diagnostics.filter(d => 
        d.pass.includes('accessibility') && d.message.toLowerCase().includes('focus')
      );
      expect(focusDiags.length).toBeGreaterThan(0);
    });

    it('passes validation for compliant styles', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.good');
      rule.declarations.push(createDeclaration('fontSize', '16px'));
      rule.declarations.push(createDeclaration('color', '#333'));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      
      const errors = result.ir.diagnostics.filter(d => d.severity === 'error');
      expect(errors.length).toBe(0);
    });
  });

  describe('Accessibility Optimizer (Stage 4)', () => {
    it('auto-fixes small font sizes', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.tiny');
      rule.declarations.push(createDeclaration('fontSize', '10px'));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const decl = result.ir.rules[0].declarations[0];
      
      // Should be wrapped in max()
      expect(decl.value).toContain('max');
      expect(decl.value).toContain('12px');
      expect(decl.value).toContain('10px');
    });

    it('adds touch targets to interactive elements', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.btn');
      rule.declarations.push(createDeclaration('cursor', 'pointer'));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      
      const hasMinWidth = result.ir.rules[0].declarations.some(d => d.property === 'min-width');
      const hasMinHeight = result.ir.rules[0].declarations.some(d => d.property === 'min-height');
      expect(hasMinWidth).toBe(true);
      expect(hasMinHeight).toBe(true);
    });

    it('does not modify already compliant elements', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.fine');
      rule.declarations.push(createDeclaration('fontSize', '16px'));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const decl = result.ir.rules[0].declarations[0];
      
      expect(decl.value).toBe('16px');
    });
  });

  describe('Intent Resolver (Stage 5)', () => {
    it('resolves center-content intent', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.container');
      rule.meta._intent = 'center-content';
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      
      const props = result.ir.rules[0].declarations.map(d => d.property);
      expect(props).toContain('display');
      expect(props).toContain('justifyContent');
      expect(props).toContain('alignItems');
    });

    it('resolves card intent with hover state', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.card');
      rule.meta._intent = 'card';
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      
      const hasHover = result.ir.rules[0].pseudoClasses.some(pc => pc.name === 'hover');
      expect(hasHover).toBe(true);
    });

    it('handles unknown intent gracefully', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      rule.meta._intent = 'nonexistent-intent';
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      
      // Should not crash, just no declarations added
      expect(result.ir.rules[0].declarations.length).toBe(0);
    });
  });

  describe('End-to-End Pipeline', () => {
    it('validates, optimizes, and resolves in one pass', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);

      // Rule 1: Has accessibility issues
      const rule1 = createRule('.btn');
      rule1.declarations.push(createDeclaration('cursor', 'pointer'));
      rule1.declarations.push(createDeclaration('fontSize', '11px'));
      rule1.declarations.push(createDeclaration('outline', 'none'));
      ir.rules.push(rule1);

      // Rule 2: Has intent
      const rule2 = createRule('.hero');
      rule2.meta._intent = 'hero-section';
      ir.rules.push(rule2);

      const result = await pipeline.execute(ir);

      // Validation should have caught accessibility issues
      const a11yDiags = result.ir.diagnostics.filter(d => d.pass.includes('accessibility'));
      expect(a11yDiags.length).toBeGreaterThan(0);

      // Optimization should have fixed font size
      const btnFontSize = result.ir.rules[0].declarations
        .find(d => d.property === 'fontSize' || d.property === 'font-size');
      expect(btnFontSize!.value).toContain('max');

      // Optimization should have added touch targets
      const hasMinWidth = result.ir.rules[0].declarations.some(d => d.property === 'min-width');
      expect(hasMinWidth).toBe(true);

      // Lowering should have resolved intent
      const heroRule = result.ir.rules.find(r => r.selector === '.hero' || r.selector?.includes('hero'));
      expect(heroRule).toBeDefined();
      expect(heroRule?.declarations?.length).toBeGreaterThan(0);
    });

    it('stages do not interfere with each other', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('fontSize', '10px'));
      rule.meta._intent = 'center-content';
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);

      // Validation should have caught the font size
      const diags = result.ir.diagnostics.filter(d => d.pass.includes('accessibility'));
      expect(diags.length).toBeGreaterThan(0);

      // Optimization should have fixed it
      const fontSize = result.ir.rules[0].declarations
        .find(d => d.property === 'fontSize' || d.property === 'font-size');
      expect(fontSize!.value).toContain('max');

      // Lowering should have added intent declarations ON TOP of the fixed ones
      const props = result.ir.rules[0].declarations.map(d => d.property);
      expect(props).toContain('display');
      expect(props).toContain('justifyContent');
    });
  });

    describe('Intent Normalizer (Stage 1)', () => {
    it('fixes flexbox → flex', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.btn');
      rule.declarations.push(createDeclaration('display', 'flexbox'));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      expect(result.ir.rules[0].declarations[0].value).toBe('flex');
    });

    it('adds centering defaults for flexbox', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.btn');
      rule.declarations.push(createDeclaration('display', 'flexbox'));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const props = result.ir.rules[0].declarations.map(d => d.property);
      expect(props).toContain('justifyContent');
      expect(props).toContain('alignItems');
    });

    it('fixes abs → absolute', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.el');
      rule.declarations.push(createDeclaration('position', 'abs'));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      expect(result.ir.rules[0].declarations[0].value).toBe('absolute');
    });
  });

  describe('Unit Normalizer (Stage 1)', () => {
    it('adds px to number values', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('width', 100 as any));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      expect(result.ir.rules[0].declarations[0].value).toBe('100px');
    });

    it('does not add px to unitless properties', async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.test');
      rule.declarations.push(createDeclaration('opacity', 0.5));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      expect(result.ir.rules[0].declarations[0].value).toBe(0.5);
    });
  });

  describe('Conflict Validator (Stage 2)', () => {
    it('flags z-index on static elements', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.el');
      rule.declarations.push(createDeclaration('position', 'static'));
      rule.declarations.push(createDeclaration('zIndex', '999'));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.pass.includes('conflict'));
      expect(diags.length).toBeGreaterThan(0);
      expect(diags[0].message).toContain('z-index');
    });

    it('flags flex properties without display:flex', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule = createRule('.el');
      rule.declarations.push(createDeclaration('justifyContent', 'center'));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.pass.includes('conflict'));
      expect(diags.length).toBeGreaterThan(0);
      expect(diags[0].message).toContain('Flex properties');
    });

    it('flags duplicate selectors', async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(['test.ts']);
      const rule1 = createRule('.dup');
      const rule2 = createRule('.dup');
      rule1.declarations.push(createDeclaration('color', 'red'));
      rule2.declarations.push(createDeclaration('color', 'blue'));
      ir.rules.push(rule1, rule2);

      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.message.includes('appears'));
      expect(diags.length).toBeGreaterThan(0);
    });

  describe("Conditional Execution", () => {
    it("skips token-lowering when no semantic tokens present", async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".test");
      rule.declarations.push(createDeclaration("color", "red"));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const tokenPass = result.timeline.find(t => t.pass === "token-lowering");
      expect(tokenPass).toBeUndefined();
    });

    it("skips constraint-resolver when no constraints present", async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".test");
      rule.declarations.push(createDeclaration("color", "red"));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const constraintPass = result.timeline.find(t => t.pass === "constraint-resolver");
      expect(constraintPass).toBeUndefined();
    });

    it("skips intent-resolver when no intent present", async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".test");
      rule.declarations.push(createDeclaration("color", "red"));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const intentPass = result.timeline.find(t => t.pass === "intent-resolver");
      expect(intentPass).toBeUndefined();
    });

    it("still runs css-emitter even when others are skipped", async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".test");
      rule.declarations.push(createDeclaration("color", "red"));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const cssPass = result.timeline.find(t => t.pass === "css-emitter");
      expect(cssPass).toBeDefined();
      expect(result.finalCSS).toContain(".test");
    });

    it("skips media-query-packer when no at-rules present", async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".test");
      rule.declarations.push(createDeclaration("color", "red"));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const mqPass = result.timeline.find(t => t.pass === "media-query-packer");
      expect(mqPass).toBeUndefined();
    });
  });

  describe("CSS Lowering (Stage 5)", () => {
    it("produces CSS output", async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".test");
      rule.declarations.push(createDeclaration("color", "red"));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      expect(result.finalCSS).toBeDefined();
      expect(result.finalCSS).toContain(".test");
      expect(result.finalCSS).toContain("color: red");
    });

    it("compresses hex colors in output", async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".test");
      rule.declarations.push(createDeclaration("color", "#ffffff"));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      expect(result.finalCSS).toContain("#fff");
    });
  });
  });

  describe("Specificity Sorter (Stage 4)", () => {
    it("sorts rules by specificity", async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(["test.ts"]);
      const low = createRule(".low");
      low.declarations.push(createDeclaration("color", "red"));
      const high = createRule("#high");
      high.declarations.push(createDeclaration("color", "blue"));
      ir.rules.push(high, low);

      const result = await pipeline.execute(ir);
      expect(result.ir.rules[0].selector).toBe(".low");
      expect(result.ir.rules[1].selector).toBe("#high");
    });
  });

  describe("Dead Code Eliminator (Stage 4)", () => {
    it("removes dead rules", async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(["test.ts"]);
      const dead = createRule(".dead");
      dead.isDead = true;
      dead.declarations.push(createDeclaration("color", "red"));
      const alive = createRule(".alive");
      alive.declarations.push(createDeclaration("color", "blue"));
      ir.rules.push(dead, alive);

      const result = await pipeline.execute(ir);
      expect(result.ir.rules.length).toBe(1);
      expect(result.ir.rules[0].selector).toBe(".alive");
    });
  });

  describe("CSS Compressor (Stage 4)", () => {
    it("shortens hex colors", async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".test");
      rule.declarations.push(createDeclaration("color", "#ffffff"));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      expect(result.ir.rules[0].declarations[0].value).toBe("#fff");
    });

    it("keeps non-shortenable hex", async () => {
      const pipeline = createDefaultPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".test");
      rule.declarations.push(createDeclaration("color", "#1a2b3c"));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      expect(result.ir.rules[0].declarations[0].value).toBe("#1a2b3c");
    });
  });

  describe("Responsive Analyzer (Stage 3)", () => {
    it("flags fixed widths that overflow mobile", async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".wide");
      rule.declarations.push(createDeclaration("width", "1200px"));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.pass.includes("responsive"));
      expect(diags.length).toBeGreaterThan(0);
      expect(diags[0].message).toContain("overflow");
    });

    it("flags 100vh usage", async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".full");
      rule.declarations.push(createDeclaration("height", "100vh"));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.message.includes("100vh"));
      expect(diags.length).toBeGreaterThan(0);
    });

    it("ignores small fixed widths", async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".narrow");
      rule.declarations.push(createDeclaration("width", "300px"));
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.pass.includes("responsive"));
      expect(diags.length).toBe(0);
    });
  });

  describe("Layout Analyzer (Stage 3)", () => {
    it("detects flex-center pattern", async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(["test.ts"]);
      const rule = createRule(".centered");
      rule.declarations.push(
        createDeclaration("display", "flex"),
        createDeclaration("justifyContent", "center"),
        createDeclaration("alignItems", "center"),
      );
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.pass.includes("layout-analyzer"));
      expect(diags.length).toBe(0); // Layout analyzer only reports duplicates (2+ occurrences)
    });

    it("detects duplicate layout patterns", async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(["test.ts"]);
      
      const rule1 = createRule(".a");
      rule1.declarations.push(
        createDeclaration("display", "flex"),
        createDeclaration("justifyContent", "center"),
        createDeclaration("alignItems", "center"),
      );
      
      const rule2 = createRule(".b");
      rule2.declarations.push(
        createDeclaration("display", "flex"),
        createDeclaration("justifyContent", "center"),
        createDeclaration("alignItems", "center"),
      );
      
      ir.rules.push(rule1, rule2);

      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.message.includes("found 2 times"));
      expect(diags.length).toBeGreaterThan(0);
    });
  });

  describe("Pattern Detector (Stage 3)", () => {
    it("finds repeated style patterns", async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(["test.ts"]);
      
      const shared = [
        createDeclaration("display", "flex"),
        createDeclaration("padding", "16px"),
        createDeclaration("borderRadius", "8px"),
        createDeclaration("backgroundColor", "#f0f0f0"),
      ];

      const rule1 = createRule(".card1");
      rule1.declarations.push(...shared);
      
      const rule2 = createRule(".card2");
      rule2.declarations.push(...shared);
      
      const rule3 = createRule(".card3");
      rule3.declarations.push(...shared);
      
      ir.rules.push(rule1, rule2, rule3);

      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.pass.includes("pattern-detector"));
      expect(diags.length).toBeGreaterThan(0);
      expect(diags[0].message).toContain("found 3 times");
    });

    it("ignores single-occurrence patterns", async () => {
      const pipeline = createFullPipeline();
      const ir = createIR(["test.ts"]);
      
      const rule = createRule(".unique");
      rule.declarations.push(
        createDeclaration("display", "grid"),
        createDeclaration("gap", "24px"),
        createDeclaration("padding", "32px"),
      );
      ir.rules.push(rule);

      const result = await pipeline.execute(ir);
      const diags = result.ir.diagnostics.filter(d => d.pass.includes("pattern-detector"));
      expect(diags.length).toBe(0);
    });
  });
  
});