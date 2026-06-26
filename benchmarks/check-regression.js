#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load baseline
const baseline = JSON.parse(readFileSync(resolve('benchmarks/baseline.json'), 'utf-8'));

// Run current benchmark (same as save-baseline)
const { createDefaultPipeline } = await import('../src/compiler/pipeline/default-pipeline.js');
const { createDeclaration, createRule, createIR, resetIdCounter } = await import('../src/compiler/pipeline/ir/factory.js');

const pipeline = createDefaultPipeline();
const scenarios = [
  { name: 'small', rules: 5, declPerRule: 4, iterations: 100 },
  { name: 'medium', rules: 50, declPerRule: 8, iterations: 50 },
  { name: 'large', rules: 500, declPerRule: 10, iterations: 30 },
  { name: 'xlarge', rules: 2000, declPerRule: 10, iterations: 10 },
];

const THRESHOLD = 10; // percent — fail if >10% slower
const MIN_ABS_DIFF = 0.5; // ms — ignore changes smaller than this (noise floor)

console.log('🔍 ChainCSS Regression Check\n');
console.log(`Baseline: ${baseline.date} (Node ${baseline.node})`);
console.log(`Threshold: ${THRESHOLD}%\n`);
console.log('Scenario   | Baseline | Current  | Change   | Status');
console.log('-'.repeat(60));

let failed = false;
const currentResults = {};

for (const s of scenarios) {
  resetIdCounter();
  const ir = createIR(['regression.css']);
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
  currentResults[s.name] = +avg.toFixed(3);

  const bl = baseline.results[s.name].avg;
  const absDiff = avg - bl;
  const change = ((absDiff) / bl * 100);
  const sign = change > 0 ? '+' : '';
  const isRegression = change > THRESHOLD && absDiff > MIN_ABS_DIFF;
  const status = isRegression ? '❌ FAIL' : '✅ PASS';
  if (isRegression) failed = true;

  console.log(`${s.name.padEnd(10)} | ${String(bl).padEnd(8)} | ${String(+avg.toFixed(3)).padEnd(8)} | ${sign}${change.toFixed(1).padEnd(7)}% | ${status}`);
}

// Cold start skipped — too noisy for regression detection

console.log('\n' + '='.repeat(60));
if (failed) {
  console.log('❌ REGRESSION DETECTED — performance degraded by >10%');
  console.log('   Run "npm run bench:baseline" to update baseline if this is intentional.');
  process.exit(1);
} else {
  console.log('✅ All checks passed — no performance regression');
  process.exit(0);
}
