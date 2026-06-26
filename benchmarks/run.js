#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import os from 'os';

async function main() {
  console.log('🚀 ChainCSS Pipeline Benchmark Suite v2\n');

  const { createDefaultPipeline } = await import('../src/compiler/pipeline/default-pipeline.js');
  const { createDeclaration, createRule, createIR, resetIdCounter } = await import('../src/compiler/pipeline/ir/factory.js');

  const pipeline = createDefaultPipeline();
  const results = [];
  const startTime = Date.now();

  const scenarios = [
    { name: 'small', label: 'Small (5 rules)', rules: 5, declPerRule: 4, iterations: 100 },
    { name: 'medium', label: 'Medium (50 rules)', rules: 50, declPerRule: 8, iterations: 50 },
    { name: 'large', label: 'Large (500 rules)', rules: 500, declPerRule: 10, iterations: 30 },
    { name: 'xlarge', label: 'X-Large (2000 rules)', rules: 2000, declPerRule: 10, iterations: 10 },
  ];

  const systemInfo = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    memoryGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
  };

  console.log('📊 System:', `${systemInfo.node} | ${systemInfo.platform} | ${systemInfo.cpus} CPUs | ${systemInfo.memoryGB}GB RAM`);
  console.log('🔬 Pipeline: 18 passes across 6 stages');
  console.log('📦 Version: 2.7.2\n');
  console.log('─'.repeat(90) + '\n');

  // Cold vs Warm
  console.log('🧊 COLD vs WARM START\n');
  resetIdCounter();
  const coldIR = createIR(['cold-bench.css']);
  for (let i = 0; i < 200; i++) {
    const rule = createRule(`.cold-${i}`);
    for (let j = 0; j < 8; j++) rule.declarations.push(createDeclaration(`prop-${j}`, `value-${j}`));
    coldIR.rules.push(rule);
  }
  const coldStart = performance.now();
  pipeline.executeSync(JSON.parse(JSON.stringify(coldIR)));
  const coldTime = performance.now() - coldStart;
  const warmTimes = [];
  for (let i = 0; i < 50; i++) {
    resetIdCounter();
    const s = performance.now();
    pipeline.executeSync(JSON.parse(JSON.stringify(coldIR)));
    warmTimes.push(performance.now() - s);
  }
  const warmAvg = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;
  console.log(`  Cold start: ${coldTime.toFixed(2)}ms  |  Warm avg: ${warmAvg.toFixed(2)}ms  |  Overhead: ${(coldTime - warmAvg).toFixed(2)}ms\n`);
  console.log('─'.repeat(90) + '\n');

  // Scenario benchmarks
  console.log('📊 SCENARIO BENCHMARKS\n');

  for (const scenario of scenarios) {
    resetIdCounter();
    const ir = createIR(['bench.css']);

    for (let i = 0; i < scenario.rules; i++) {
      const rule = createRule(`.component-${i}`);
      for (let j = 0; j < scenario.declPerRule; j++) {
        rule.declarations.push(createDeclaration(`prop-${j}`, `value-${j}`));
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

    // Measure input size
    const inputDecls = ir.rules.reduce((s, r) => s + r.declarations.length, 0);
    const inputRules = ir.rules.length;

    // Warmup
    pipeline.executeSync(JSON.parse(JSON.stringify(ir)));

    // Measure
    const times = [];
    let lastResult = null;
    if (global.gc) global.gc();
    const memStart = process.memoryUsage().heapUsed;

    for (let i = 0; i < scenario.iterations; i++) {
      resetIdCounter();
      if (global.gc) global.gc();
      const fresh = JSON.parse(JSON.stringify(ir));
      const s = performance.now();
      lastResult = pipeline.executeSync(fresh);
      times.push(performance.now() - s);
    }

    const memEnd = process.memoryUsage().heapUsed;
    const sorted = [...times].sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;

    // Output metrics
    const outDecls = lastResult.ir.rules.reduce((s, r) => s + r.declarations.length, 0);
    const deadRules = lastResult.ir.rules.filter(r => r.isDead).length;
    const cssBytes = lastResult.finalCSS ? lastResult.finalCSS.length : 0;
    const inputBytes = inputDecls * 25; // rough estimate
    const bytesSaved = inputBytes - cssBytes;
    const savingsPct = inputBytes > 0 ? ((bytesSaved / inputBytes) * 100).toFixed(1) : '0';

    // Pass breakdown
    const stageMap = {};
    for (const t of lastResult.timeline) {
      if (!stageMap[t.stage]) stageMap[t.stage] = { total: 0, passes: [] };
      stageMap[t.stage].total += t.duration;
      stageMap[t.stage].passes.push({ name: t.pass, duration: t.duration });
    }

    const totalDecls = inputDecls;
    const totalPseudo = ir.rules.reduce((s, r) => s + r.pseudoClasses.length, 0);
    const totalAtRules = ir.rules.reduce((s, r) => s + r.atRules.length, 0);

    const result = {
      scenario: scenario.name,
      label: scenario.label,
      rulesIn: inputRules,
      rulesOut: inputRules - deadRules,
      deadRules,
      declarationsIn: inputDecls,
      declarationsOut: outDecls,
      pseudoClasses: totalPseudo,
      atRules: totalAtRules,
      cssBytes,
      bytesSaved,
      savingsPct,
      iterations: scenario.iterations,
      metrics: {
        avg: +avg.toFixed(3),
        median: +sorted[Math.floor(sorted.length / 2)].toFixed(3),
        min: +sorted[0].toFixed(3),
        max: +sorted[sorted.length - 1].toFixed(3),
        p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(3),
        p99: +sorted[Math.floor(sorted.length * 0.99)].toFixed(3),
        stdDev: +Math.sqrt(times.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / times.length).toFixed(3),
      },
      memory: {
        startMB: +((memStart) / 1024 / 1024).toFixed(2),
        endMB: +((memEnd) / 1024 / 1024).toFixed(2),
        deltaMB: +((memEnd - memStart) / 1024 / 1024).toFixed(2),
      },
      passBreakdown: stageMap,
    };
    results.push(result);

    console.log(`${scenario.label}:`);
    console.log(`  Rules: ${inputRules} in → ${inputRules - deadRules} out | Decls: ${inputDecls} in → ${outDecls} out | Dead: ${deadRules}`);
    console.log(`  ⏱️  ${result.metrics.avg}ms avg | P95: ${result.metrics.p95}ms | Median: ${result.metrics.median}ms`);
    console.log(`  📏 CSS: ${cssBytes}B | Saved: ${bytesSaved}B (${savingsPct}%) | 💾 Mem: ${result.memory.startMB}→${result.memory.endMB}MB`);
    if (Object.keys(stageMap).length > 0) {
      const stages = ['normalization', 'validation', 'analysis', 'optimization', 'lowering'];
      const parts = stages.filter(s => stageMap[s]).map(s => `${s}: ${stageMap[s].total}ms`).join(' | ');
      console.log(`  🔬 ${parts}`);
    }
    console.log();
  }

  console.log('─'.repeat(90));

  // Output files
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = resolve(process.cwd(), 'benchmarks/results');
  mkdirSync(outputDir, { recursive: true });

  const benchResult = { compiler: 'chaincss', version: '2.7.2', timestamp, systemInfo, coldWarm: { coldMs: +coldTime.toFixed(2), warmAvgMs: +warmAvg.toFixed(2), overheadMs: +(coldTime - warmAvg).toFixed(2) }, results };

  const jsonPath = resolve(outputDir, `benchmark-${timestamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(benchResult, null, 2));

  // Markdown
  let md = `# ChainCSS Pipeline Benchmark\n\n**Version:** 2.7.2 | **Date:** ${new Date().toISOString().split('T')[0]}\n`;
  md += `**System:** ${systemInfo.node} | ${systemInfo.platform} | ${systemInfo.cpus} CPUs | ${systemInfo.memoryGB}GB RAM\n\n`;
  md += `## Cold vs Warm\n\n| Cold | Warm Avg | Overhead |\n|------|----------|----------|\n`;
  md += `| ${coldTime.toFixed(2)}ms | ${warmAvg.toFixed(2)}ms | ${(coldTime - warmAvg).toFixed(2)}ms |\n\n`;
  md += `## Results\n\n| Scenario | Rules In→Out | Decls In→Out | Dead | Avg | P95 | CSS | Saved | Mem Δ |\n`;
  md += `|----------|-------------|-------------|------|-----|-----|-----|-------|------|\n`;
  for (const r of results) {
    md += `| ${r.label} | ${r.rulesIn}→${r.rulesOut} | ${r.declarationsIn}→${r.declarationsOut} | ${r.deadRules} | ${r.metrics.avg}ms | ${r.metrics.p95}ms | ${r.cssBytes}B | ${r.bytesSaved}B (${r.savingsPct}%) | ${r.memory.deltaMB}MB |\n`;
  }

  // Scaling
  const [s, m, l, xl] = results;
  md += `\n## Scaling\n\n| Metric | Small→Medium | Medium→Large | Large→X-Large |\n|--------|-------------|-------------|---------------|\n`;
  md += `| Rules | ${(m.rulesIn/s.rulesIn).toFixed(1)}x | ${(l.rulesIn/m.rulesIn).toFixed(1)}x | ${(xl.rulesIn/l.rulesIn).toFixed(1)}x |\n`;
  md += `| Time | ${(m.metrics.avg/s.metrics.avg).toFixed(1)}x | ${(l.metrics.avg/m.metrics.avg).toFixed(1)}x | ${(xl.metrics.avg/l.metrics.avg).toFixed(1)}x |\n`;

  // Pass breakdown for largest
  const xlBreakdown = xl.passBreakdown;
  if (Object.keys(xlBreakdown).length > 0) {
    md += `\n## Pass Breakdown (X-Large)\n\n| Stage | Pass | Duration |\n|-------|------|----------|\n`;
    for (const [stage, data] of Object.entries(xlBreakdown)) {
      for (const p of data.passes) {
        md += `| ${stage} | ${p.name} | ${p.duration}ms |\n`;
      }
    }
  }

  md += `\n## Notes\n- CSS bytes measured from pipeline finalCSS output\n- Memory delta = heap growth during benchmark\n- Dead rules eliminated by dead-code-eliminator pass\n`;

  const mdPath = resolve(outputDir, `benchmark-${timestamp}.md`);
  writeFileSync(mdPath, md);

  console.log(`📄 JSON: ${jsonPath}`);
  console.log(`📄 Markdown: ${mdPath}`);
  console.log(`\n✅ Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
}

main();