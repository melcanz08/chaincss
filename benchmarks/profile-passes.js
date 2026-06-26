import { createDefaultPipeline } from '../src/compiler/pipeline/default-pipeline.js';
import { createDeclaration, createRule, createIR, resetIdCounter } from '../src/compiler/pipeline/ir/factory.js';

const pipeline = createDefaultPipeline();

const sizes = [50, 100, 200, 300, 400, 500];

console.log('🔍 Profiling Medium→Large scaling\n');
console.log('Rules | Total(ms) | norm | valid | analysis | opt  | lower | skipped');
console.log('-'.repeat(75));

for (const ruleCount of sizes) {
  resetIdCounter();
  const ir = createIR(['prof.css']);
  for (let i = 0; i < ruleCount; i++) {
    const rule = createRule(`.c-${i}`);
    for (let j = 0; j < 10; j++) {
      rule.declarations.push(createDeclaration(`prop-${j}`, `value-${j}`));
    }
    if (i % 5 === 0) {
      rule.pseudoClasses.push({
        id: `p-${i}`, name: 'hover',
        declarations: [createDeclaration('opacity', '0.8')],
        source: {}, history: [],
      });
    }
    if (i % 10 === 0) {
      rule.atRules.push({
        id: `m-${i}`, type: 'media', query: '(min-width: 768px)',
        declarations: [createDeclaration('flex-direction', 'row')],
        nestedRules: [], source: {}, history: [],
      });
    }
    ir.rules.push(rule);
  }

  pipeline.executeSync(JSON.parse(JSON.stringify(ir)));

  const times = [];
  for (let i = 0; i < 5; i++) {
    resetIdCounter();
    const start = performance.now();
    const result = pipeline.executeSync(JSON.parse(JSON.stringify(ir)));
    times.push({ total: performance.now() - start, timeline: result.timeline });
  }

  // Use median
  times.sort((a, b) => a.total - b.total);
  const best = times[2];

  const stages = {};
  for (const t of best.timeline) {
    stages[t.stage] = (stages[t.stage] || 0) + t.duration;
  }

  const n = stages.normalization || 0;
  const v = stages.validation || 0;
  const a = stages.analysis || 0;
  const o = stages.optimization || 0;
  const l = stages.lowering || 0;
  const skipped = best.timeline.filter(t => t.duration === 0).length;

  console.log(
    `${String(ruleCount).padEnd(5)} | ${best.total.toFixed(0).padEnd(9)} | ${n.toFixed(0).padEnd(4)} | ${v.toFixed(0).padEnd(5)} | ${a.toFixed(0).padEnd(8)} | ${o.toFixed(0).padEnd(4)} | ${l.toFixed(0).padEnd(5)} | ${skipped}`
  );
}

// Print per-pass detail for 500 rules
console.log('\n\n📋 Per-pass detail (500 rules):');
const ir500 = createIR(['prof.css']);
for (let i = 0; i < 500; i++) {
  const rule = createRule(`.c-${i}`);
  for (let j = 0; j < 10; j++) rule.declarations.push(createDeclaration(`p-${j}`, `v-${j}`));
  ir500.rules.push(rule);
}
const r500 = pipeline.executeSync(JSON.parse(JSON.stringify(ir500)));
for (const t of r500.timeline) {
  if (t.duration > 0) {
    console.log(`  ${t.stage.padEnd(14)} | ${t.pass.padEnd(28)} | ${String(t.duration).padEnd(4)}ms`);
  }
}
