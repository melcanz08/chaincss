#!/usr/bin/env node
import { createDefaultPipeline } from '../src/compiler/pipeline/default-pipeline.js';
import { createDeclaration, createRule, createIR, resetIdCounter } from '../src/compiler/pipeline/ir/factory.js';

async function main() {
  console.log('🔄 ChainCSS Incremental Compilation Benchmark\n');
  console.log('═'.repeat(70) + '\n');

  const { createDefaultPipeline } = await import('../src/compiler/pipeline/default-pipeline.js');
  const { createDeclaration, createRule, createIR, resetIdCounter } = await import('../src/compiler/pipeline/ir/factory.js');

  const pipeline = createDefaultPipeline();

  // Build a base project of 500 rules (simulating a medium app)
  const BASE_RULES = 500;
  const DECLS_PER_RULE = 8;

  function buildIR(name, ruleCount, startIdx = 0) {
    resetIdCounter();
    const ir = createIR([name]);
    for (let i = startIdx; i < startIdx + ruleCount; i++) {
      const rule = createRule(`.component-${i}`);
      for (let j = 0; j < DECLS_PER_RULE; j++) {
        rule.declarations.push(createDeclaration(`prop-${j}`, `value-${i}-${j}`));
      }
      if (i % 5 === 0) {
        rule.pseudoClasses.push({
          id: `pseudo-${i}`, name: 'hover',
          declarations: [createDeclaration('opacity', '0.8')],
          source: {}, history: [],
        });
      }
      if (i % 10 === 0) {
        rule.atRules.push({
          id: `media-${i}`, type: 'media', query: '(min-width: 768px)',
          declarations: [createDeclaration('flex-direction', 'row')],
          nestedRules: [], source: {}, history: [],
        });
      }
      ir.rules.push(rule);
    }
    return ir;
  }

  // ── Test 1: Full rebuild (cold) ──
  console.log('📦 FULL REBUILD (no cache)\n');
  const fullIR = buildIR('full.css', BASE_RULES);
  
  const fullTimes = [];
  for (let i = 0; i < 10; i++) {
    const fresh = JSON.parse(JSON.stringify(fullIR));
    const start = performance.now();
    pipeline.executeSync(fresh);
    fullTimes.push(performance.now() - start);
  }
  const fullAvg = fullTimes.reduce((a, b) => a + b, 0) / fullTimes.length;
  console.log(`  500 rules, ${BASE_RULES * DECLS_PER_RULE} decls`);
  console.log(`  Full rebuild: ${fullAvg.toFixed(2)}ms avg\n`);

  // ── Test 2: Change 1 file (1 rule modified) ──
  console.log('📝 INCREMENTAL: 1 rule changed\n');
  
  const baseIR = buildIR('base.css', BASE_RULES);
  
  // Modified IR — change the last rule
  const modifiedIR = buildIR('base.css', BASE_RULES);
  const lastRule = modifiedIR.rules[modifiedIR.rules.length - 1];
  lastRule.declarations[0] = createDeclaration('prop-0', 'CHANGED-VALUE');
  lastRule.selector = '.component-499-modified';

  // Warm both
  pipeline.executeSync(JSON.parse(JSON.stringify(baseIR)));
  pipeline.executeSync(JSON.parse(JSON.stringify(modifiedIR)));

  const incTimes = [];
  for (let i = 0; i < 10; i++) {
    resetIdCounter();
    const fresh = JSON.parse(JSON.stringify(modifiedIR));
    const start = performance.now();
    pipeline.executeSync(fresh);
    incTimes.push(performance.now() - start);
  }
  const incAvg = incTimes.reduce((a, b) => a + b, 0) / incTimes.length;
  
  // Simulate what incremental WOULD be if we only re-ran passes on changed rules
  // Best case: only re-run lowering + emit (2 passes)
  const bestCaseTime = fullAvg * (2 / 8); // 2 of 8 active passes
  console.log(`  1 rule changed out of ${BASE_RULES}`);
  console.log(`  Current (full recompile): ${incAvg.toFixed(2)}ms`);
  console.log(`  Best case (skip to emit): ~${bestCaseTime.toFixed(2)}ms`);
  console.log(`  Potential speedup: ${(incAvg / bestCaseTime).toFixed(1)}x\n`);

  // ── Test 3: Scaling — change N rules ──
  console.log('📊 INCREMENTAL SCALING\n');
  console.log('Changed | Time(ms) | vs Full | Speedup');
  console.log('─'.repeat(50));

  const changeCounts = [1, 5, 10, 25, 50, 100];
  
  for (const changeCount of changeCounts) {
    const testIR = buildIR('test.css', BASE_RULES);
    // Modify first N rules
    for (let i = 0; i < changeCount; i++) {
      testIR.rules[i].declarations[0] = createDeclaration('prop-0', `CHANGED-${i}`);
      testIR.rules[i].selector = `.component-${i}-modified`;
    }

    const times = [];
    for (let i = 0; i < 5; i++) {
      resetIdCounter();
      const fresh = JSON.parse(JSON.stringify(testIR));
      const start = performance.now();
      pipeline.executeSync(fresh);
      times.push(performance.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const speedup = (fullAvg / avg).toFixed(1);
    
    console.log(`${String(changeCount).padEnd(7)} | ${String(avg.toFixed(2)).padEnd(9)} | ${String(fullAvg.toFixed(2)).padEnd(7)} | ${speedup}x`);
  }

  // ── Test 4: Feature flags — which passes can skip? ──
  console.log('\n🔬 PASSES THAT COULD SKIP ON INCREMENTAL\n');
  
  const testIR = buildIR('test.css', BASE_RULES);
  const result = pipeline.executeSync(JSON.parse(JSON.stringify(testIR)));
  
  const passInfo = [];
  for (const t of result.timeline) {
    passInfo.push({ stage: t.stage, pass: t.pass, duration: t.duration });
  }

  // Categorize passes
  const stateful = ['pattern-detector', 'conflict-validator', 'accessibility-validator'];
  const stateless = ['intent-normalizer', 'unit-normalizer', 'css-compressor', 'css-emitter', 'specificity-sorter', 'dead-code-eliminator'];
  
  console.log('Stateful (need full IR):');
  for (const p of passInfo) {
    if (stateful.some(s => p.pass.includes(s))) {
      console.log(`  ${p.pass.padEnd(28)} ${p.duration}ms — needs all rules`);
    }
  }
  console.log('\nStateless (can run on changed only):');
  for (const p of passInfo) {
    if (stateless.some(s => p.pass.includes(s))) {
      console.log(`  ${p.pass.padEnd(28)} ${p.duration}ms — can isolate`);
    }
  }

  console.log('\n✅ Done!');
  console.log('\n💡 Recommendation: Implement dirty flag per-rule so stateless');
  console.log('   passes only process changed rules on incremental builds.');
}

main();
