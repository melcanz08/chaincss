import { createDefaultPipeline } from '../src/compiler/pipeline/default-pipeline.js';
import { createDeclaration, createRule, createIR, resetIdCounter } from '../src/compiler/pipeline/ir/factory.js';

const pipeline = createDefaultPipeline();
resetIdCounter();

const ir = createIR(['test.css']);

// Create 20 rules with realistic CSS
const rule1 = createRule('.btn');
rule1.declarations = [
  createDeclaration('color', 'var(--text-primary)'),
  createDeclaration('padding', '12px 24px'),
  createDeclaration('border-radius', '8px'),
  createDeclaration('background', '#ff6633'),
  createDeclaration('font-size', '16px'),
];
rule1.pseudoClasses = [
  { id: 'h1', name: 'hover', declarations: [createDeclaration('opacity', '0.9')], source: {}, history: [] },
];
ir.rules.push(rule1);

for (let i = 0; i < 19; i++) {
  const rule = createRule(`.card-${i}`);
  rule.declarations = [
    createDeclaration('display', 'flex'),
    createDeclaration('flex-direction', 'column'),
    createDeclaration('padding', '16px'),
    createDeclaration('gap', '8px'),
    createDeclaration('background', '#ffffff'),
  ];
  ir.rules.push(rule);
}

// Measure input size
const inputDecls = ir.rules.reduce((s, r) => s + r.declarations.length, 0);
console.log(`Input: ${ir.rules.length} rules, ${inputDecls} declarations`);

// Run pipeline
const result = pipeline.executeSync(JSON.parse(JSON.stringify(ir)));

// Check output
console.log(`Final CSS: ${result.finalCSS ? 'YES' : 'NO'}`);
if (result.finalCSS) {
  console.log(`CSS length: ${result.finalCSS.length} bytes`);
  console.log(`CSS preview:\n${result.finalCSS.slice(0, 300)}`);
}

// Check what changed
console.log(`\nTimeline:`);
for (const t of result.timeline) {
  if (t.duration > 0) {
    console.log(`  ${t.pass}: ${t.duration}ms`);
  }
}

// Count output declarations
const outDecls = result.ir.rules.reduce((s, r) => s + r.declarations.length, 0);
console.log(`\nOutput: ${result.ir.rules.length} rules, ${outDecls} declarations`);
console.log(`Dead rules: ${result.ir.rules.filter(r => r.isDead).length}`);
