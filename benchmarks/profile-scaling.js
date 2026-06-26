import { createDefaultPipeline } from '../src/compiler/pipeline/default-pipeline.js';
import { createDeclaration, createRule, createIR, resetIdCounter } from '../src/compiler/pipeline/ir/factory.js';

const pipeline = createDefaultPipeline();
const sizes = [50, 100, 200, 300, 400, 500];

console.log('Rules | Total | pattern-detector | delta | O(n) expected\n');

let prevTime = 0;
for (const n of sizes) {
  resetIdCounter();
  const ir = createIR(['t.css']);
  for (let i = 0; i < n; i++) {
    const rule = createRule(`.c-${i}`);
    for (let j = 0; j < 8; j++) rule.declarations.push(createDeclaration(`p-${j}`, `v-${j}`));
    if (i % 5 === 0) rule.pseudoClasses.push({ id: `ps-${i}`, name: 'hover', declarations: [createDeclaration('opacity', '0.8')], source: {}, history: [] });
    ir.rules.push(rule);
  }
  pipeline.executeSync(JSON.parse(JSON.stringify(ir)));
  
  const times = [];
  for (let i = 0; i < 5; i++) {
    resetIdCounter();
    const start = performance.now();
    const r = pipeline.executeSync(JSON.parse(JSON.stringify(ir)));
    times.push(performance.now() - start);
    if (i === 0) var pdTime = r.timeline.find(t => t.pass === 'pattern-detector')?.duration || 0;
  }
  times.sort((a, b) => a - b);
  const total = times[2];
  const delta = prevTime ? `${((total / prevTime)).toFixed(1)}x` : '-';
  const expected = prevTime ? `${(n / (sizes[sizes.indexOf(n)-1] || n)).toFixed(1)}x` : '-';
  console.log(`${String(n).padEnd(5)} | ${String(total).padEnd(5)} | ${String(pdTime).padEnd(18)} | ${delta.padEnd(5)} | ${expected}`);
  prevTime = total;
}
