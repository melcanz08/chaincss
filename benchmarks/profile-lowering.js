import { createDefaultPipeline } from '../src/compiler/pipeline/default-pipeline.js';
import { createDeclaration, createRule, createIR, resetIdCounter } from '../src/compiler/pipeline/ir/factory.js';

const pipeline = createDefaultPipeline();
resetIdCounter();

// Build 500 rules
const ir = createIR(['test.css']);
for (let i = 0; i < 500; i++) {
  const rule = createRule(`.c-${i}`);
  for (let j = 0; j < 10; j++) {
    rule.declarations.push(createDeclaration(`prop-${j}`, `value-${i}-${j}`));
  }
  if (i % 5 === 0) {
    rule.pseudoClasses.push({
      id: `ps-${i}`, name: 'hover',
      declarations: [createDeclaration('opacity', '0.8')],
      source: {}, history: [],
    });
  }
  ir.rules.push(rule);
}

// Warmup
pipeline.executeSync(JSON.parse(JSON.stringify(ir)));

// Measure lowering stage passes individually
const result = pipeline.executeSync(JSON.parse(JSON.stringify(ir)));

console.log('Lowering stage breakdown (500 rules):\n');
console.log('Pass                  | Time   | % of lowering');
console.log('-'.repeat(50));

const loweringPasses = result.timeline.filter(t => t.stage === 'lowering');
const totalLowering = loweringPasses.reduce((s, t) => s + t.duration, 0);

for (const t of loweringPasses) {
  const pct = totalLowering > 0 ? ((t.duration / totalLowering) * 100).toFixed(1) : '0';
  console.log(`${t.pass.padEnd(21)} | ${String(t.duration).padEnd(6)} | ${pct}%`);
}

console.log(`\nTotal lowering: ${totalLowering}ms`);

// Also check: what does css-emitter actually produce?
if (result.finalCSS) {
  console.log(`\nCSS output: ${result.finalCSS.length} bytes`);
  console.log(`First 200 chars: ${result.finalCSS.slice(0, 200)}`);
}
