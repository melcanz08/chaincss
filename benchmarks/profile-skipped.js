import { createDefaultPipeline } from '../src/compiler/pipeline/default-pipeline.js';
import { createDeclaration, createRule, createIR, resetIdCounter } from '../src/compiler/pipeline/ir/factory.js';

const pipeline = createDefaultPipeline();
resetIdCounter();

const ir = createIR(['test.css']);
for (let i = 0; i < 50; i++) {
  const rule = createRule(`.c-${i}`);
  for (let j = 0; j < 8; j++) rule.declarations.push(createDeclaration(`p-${j}`, `v-${j}`));
  if (i % 5 === 0) rule.pseudoClasses.push({ id: `ps-${i}`, name: 'hover', declarations: [createDeclaration('opacity', '0.8')], source: {}, history: [] });
  ir.rules.push(rule);
}

const result = pipeline.executeSync(JSON.parse(JSON.stringify(ir)));

console.log('All passes and their status:\n');
console.log('Stage          | Pass                        | Time   | Status');
console.log('-'.repeat(70));

for (const t of result.timeline) {
  const status = t.duration === 0 ? '⏭️  SKIPPED' : '✅ RAN';
  console.log(`${t.stage.padEnd(14)} | ${t.pass.padEnd(27)} | ${String(t.duration).padEnd(6)} | ${status}`);
}

const ran = result.timeline.filter(t => t.duration > 0).length;
const skipped = result.timeline.filter(t => t.duration === 0).length;
console.log(`\nRan: ${ran}, Skipped: ${skipped}`);
