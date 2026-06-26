#!/usr/bin/env node
import { writeFileSync } from 'fs';
import { resolve } from 'path';

// Run benchmark and capture the JSON output
const { createDefaultPipeline } = await import('../src/compiler/pipeline/default-pipeline.js');
const { createDeclaration, createRule, createIR, resetIdCounter } = await import('../src/compiler/pipeline/ir/factory.js');

const pipeline = createDefaultPipeline();
const scenarios = [
  { name: 'small', rules: 5, declPerRule: 4, iterations: 100 },
  { name: 'medium', rules: 50, declPerRule: 8, iterations: 50 },
  { name: 'large', rules: 500, declPerRule: 10, iterations: 30 },
  { name: 'xlarge', rules: 2000, declPerRule: 10, iterations: 10 },
];

const results = {};

for (const s of scenarios) {
  resetIdCounter();
  const ir = createIR(['baseline.css']);
  for (let i = 0; i < s.rules; i++) {
    const rule = createRule(`.c-${i}`);
    for (let j = 0; j < s.declPerRule; j++) rule.declarations.push(createDeclaration(`p-${j}`, `v-${j}`));
    if (i % 5 === 0) rule.pseudoClasses.push({ id: `ps-${i}`, name: 'hover', declarations: [createDeclaration('opacity', '0.8')], source: {}, history: [] });
    if (i % 10 === 0) rule.atRules.push({ id: `m-${i}`, type: 'media', query: '(min-width: 768px)', declarations: [createDeclaration('flex-direction', 'row')], nestedRules: [], source: {}, history: [] });
    ir.rules.push(rule);
  }

  pipeline.executeSync(JSON.parse(JSON.stringify(ir)));
  const times = [];
  for (let i = 0; i < s.iterations; i++) {
    resetIdCounter();
    const start = performance.now();
    pipeline.executeSync(JSON.parse(JSON.stringify(ir)));
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  results[s.name] = { avg: +avg.toFixed(3), rules: s.rules, decls: s.rules * s.declPerRule };
}

// Cold start
resetIdCounter();
const coldIR = createIR(['cold.css']);
for (let i = 0; i < 200; i++) {
  const rule = createRule(`.cold-${i}`);
  for (let j = 0; j < 8; j++) rule.declarations.push(createDeclaration(`p-${j}`, `v-${j}`));
  coldIR.rules.push(rule);
}
const coldStart = performance.now();
pipeline.executeSync(JSON.parse(JSON.stringify(coldIR)));
results.coldStart = +((performance.now() - coldStart)).toFixed(2);

const baseline = {
  version: '2.8.1',
  date: new Date().toISOString(),
  node: process.version,
  results,
};

writeFileSync(resolve('benchmarks/baseline.json'), JSON.stringify(baseline, null, 2));
console.log('✅ Baseline saved to benchmarks/baseline.json');
console.log(JSON.stringify(baseline, null, 2));
