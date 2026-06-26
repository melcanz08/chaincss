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
  console.log(`🔬 Pipeline: 18 passes across 6 stages`);
  console.log(`📦 Version: 2.7.2\n`);
  console.log('─'.repeat(80) + '\n');

  // ── 1. Cold vs Warm ──
  console.log('🧊 COLD vs WARM START\n');

  resetIdCounter();
  const coldIR = createIR(['cold-bench.css']);
  for (let i = 0; i < 200; i++) {
    const rule = createRule(`.cold-${i}`);
    for (let j = 0; j < 8; j++) {
      rule.declarations.push(createDeclaration(`prop-${j}`, `value-${j}`));
    }
    coldIR.rules.push(rule);
  }

  // Cold run (first ever)
  const coldStart = performance.now();
  pipeline.executeSync(JSON.parse(JSON.stringify(coldIR)));
  const coldTime = performance.now() - coldStart;

  // Warm runs
  const warmTimes = [];
  for (let i = 0; i < 50; i++) {
    resetIdCounter();
    const start = performance.now();
    pipeline.executeSync(JSON.parse(JSON.stringify(coldIR)));
    warmTimes.push(performance.now() - start);
  }
  const warmAvg = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;

  console.log(`  Cold start (first run):     ${coldTime.toFixed(2)}ms`);
  console.log(`  Warm average (50 runs):     ${warmAvg.toFixed(2)}ms`);
  console.log(`  Warmup overhead:            ${(coldTime - warmAvg).toFixed(2)}ms\n`);

  // ── 2. Per-Scenario Benchmarks ──
  console.log('─'.repeat(80));
  console.log('\n📊 SCENARIO BENCHMARKS\n');

  // Store pass breakdown from largest scenario
  let masterPassBreakdown = null;

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
          id: `pseudo-${i}`,
          name: 'hover',
          declarations: [createDeclaration('opacity', '0.8')],
          source: {},
          history: [],
        });
      }
      if (i % 10 === 0) {
        rule.atRules.push({
          id: `media-${i}`,
          type: 'media',
          query: '(min-width: 768px)',
          declarations: [createDeclaration('flex-direction', 'row')],
          nestedRules: [],
          source: {},
          history: [],
        });
      }
      ir.rules.push(rule);
    }

    // Warmup
    pipeline.executeSync(JSON.parse(JSON.stringify(ir)));

    // Measure with memory tracking
    const times = [];
    const memorySnapshots = [];
    let passTimeline = null;

    if (global.gc) global.gc();
    const memStart = process.memoryUsage().heapUsed;

    for (let i = 0; i < scenario.iterations; i++) {
      resetIdCounter();
      if (global.gc) global.gc();
      
      const memBefore = process.memoryUsage().heapUsed;
      const fresh = JSON.parse(JSON.stringify(ir));
      const start = performance.now();
      const pipelineResult = pipeline.executeSync(fresh);
      times.push(performance.now() - start);
      const memAfter = process.memoryUsage().heapUsed;
      
      // Capture pass timeline from EVERY iteration for profiling
      if (!passTimeline) passTimeline = [];
      passTimeline.push(pipelineResult.timeline);
      
      memorySnapshots.push({
        before: memBefore,
        after: memAfter,
        peak: Math.max(memBefore, memAfter),
      });
    }

    const memEnd = process.memoryUsage().heapUsed;
    const sorted = [...times].sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    
    const peaks = memorySnapshots.map(s => s.peak);
    const peakMemory = Math.max(...peaks);
    const avgPeak = peaks.reduce((a, b) => a + b, 0) / peaks.length;

    // Build pass breakdown from timeline
    const stageMap = {};
    if (passTimeline) {
      for (const entry of passTimeline) {
        const stage = entry.stage;
        if (!stageMap[stage]) stageMap[stage] = { total: 0, passes: [] };
        stageMap[stage].total += entry.duration;
        stageMap[stage].passes.push({ name: entry.pass, duration: entry.duration });
      }
      masterPassBreakdown = stageMap;
    }

    const totalDecls = ir.rules.reduce((s, r) => s + r.declarations.length, 0);
    const totalPseudo = ir.rules.reduce((s, r) => s + r.pseudoClasses.length, 0);
    const totalAtRules = ir.rules.reduce((s, r) => s + r.atRules.length, 0);
    const estimatedCSSBytes = totalDecls * 25;

    const result = {
      scenario: scenario.name,
      label: scenario.label,
      rules: scenario.rules,
      declarations: totalDecls,
      pseudoClasses: totalPseudo,
      atRules: totalAtRules,
      estimatedCSSBytes,
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
        peakMB: +((peakMemory) / 1024 / 1024).toFixed(2),
        avgPeakMB: +((avgPeak) / 1024 / 1024).toFixed(2),
        deltaMB: +((memEnd - memStart) / 1024 / 1024).toFixed(2),
      },
      passBreakdown: stageMap,
    };

    results.push(result);

    // Console output
    console.log(`${scenario.label}:`);
    console.log(`  Rules: ${scenario.rules} | Decls: ${totalDecls} | Pseudo: ${totalPseudo} | @rules: ${totalAtRules}`);
    console.log(`  ⏱️  ${result.metrics.avg}ms avg | ${result.metrics.p95}ms p95 | ${result.metrics.median}ms median`);
    console.log(`  💾 Start: ${result.memory.startMB}MB | Peak: ${result.memory.peakMB}MB | End: ${result.memory.endMB}MB`);
    console.log(`  📏 Est CSS: ${(estimatedCSSBytes / 1024).toFixed(1)}KB`);

    // Pass breakdown
    if (Object.keys(stageMap).length > 0) {
      console.log(`  🔬 Pass breakdown:`);
      const stages = ['normalization', 'validation', 'analysis', 'optimization', 'lowering'];
      for (const stage of stages) {
        if (stageMap[stage]) {
          const barLen = Math.max(1, Math.round(stageMap[stage].total / avg * 15));
          const bar = '█'.repeat(barLen);
          console.log(`     ${stage.padEnd(14)} ${stageMap[stage].total.toFixed(2).padStart(6)}ms  ${bar}`);
        }
      }
    }
    console.log();
  }

  console.log('─'.repeat(80));

  // ── Output ──
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = resolve(process.cwd(), 'benchmarks/results');
  mkdirSync(outputDir, { recursive: true });

  const benchResult = {
    compiler: 'chaincss',
    version: '2.7.2',
    pipeline: '18 passes (normalize→validate→analyze→optimize→lower→emit)',
    timestamp,
    systemInfo,
    coldWarm: {
      coldMs: +coldTime.toFixed(2),
      warmAvgMs: +warmAvg.toFixed(2),
      overheadMs: +(coldTime - warmAvg).toFixed(2),
    },
    results,
  };

  // ── JSON ──
  const jsonPath = resolve(outputDir, `benchmark-${timestamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(benchResult, null, 2));
  console.log(`\n📄 JSON: ${jsonPath}`);

  // ── Markdown ──
  let md = `# ChainCSS Pipeline Benchmark\n\n`;
  md += `**Version:** 2.7.2 | **Date:** ${new Date().toISOString().split('T')[0]}\n`;
  md += `**System:** ${systemInfo.node} | ${systemInfo.platform} | ${systemInfo.cpus} CPUs | ${systemInfo.memoryGB}GB RAM\n\n`;

  md += `## Cold vs Warm Start\n\n`;
  md += `| Metric | Time |\n`;
  md += `|--------|------|\n`;
  md += `| Cold start (first run) | ${coldTime.toFixed(2)}ms |\n`;
  md += `| Warm average (50 runs) | ${warmAvg.toFixed(2)}ms |\n`;
  md += `| Warmup overhead | ${(coldTime - warmAvg).toFixed(2)}ms |\n\n`;

  md += `## Scenario Results\n\n`;
  md += `| Scenario | Rules | Decls | Avg (ms) | P95 (ms) | P99 (ms) | StdDev | Start MB | Peak MB | End MB | Est CSS |\n`;
  md += `|----------|-------|-------|----------|----------|----------|--------|----------|---------|--------|--------|\n`;

  for (const r of results) {
    md += `| ${r.label} | ${r.rules} | ${r.declarations} | ${r.metrics.avg} | ${r.metrics.p95} | ${r.metrics.p99} | ${r.metrics.stdDev} | ${r.memory.startMB} | ${r.memory.peakMB} | ${r.memory.endMB} | ${(r.estimatedCSSBytes / 1024).toFixed(1)}KB |\n`;
  }

  md += `\n## Scaling\n\n`;
  md += `| Metric | Small→Medium | Medium→Large | Large→X-Large |\n`;
  md += `|--------|-------------|-------------|---------------|\n`;

  const [small, medium, large, xlarge] = results;
  md += `| Rules | ${(medium.rules / small.rules).toFixed(1)}x | ${(large.rules / medium.rules).toFixed(1)}x | ${(xlarge.rules / large.rules).toFixed(1)}x |\n`;
  md += `| Time | ${(medium.metrics.avg / small.metrics.avg).toFixed(1)}x | ${(large.metrics.avg / medium.metrics.avg).toFixed(1)}x | ${(xlarge.metrics.avg / large.metrics.avg).toFixed(1)}x |\n`;
  md += `| Memory | ${(medium.memory.peakMB / small.memory.peakMB).toFixed(1)}x | ${(large.memory.peakMB / medium.memory.peakMB).toFixed(1)}x | ${(xlarge.memory.peakMB / large.memory.peakMB).toFixed(1)}x |\n`;

  // Per-pass breakdown table
  if (masterPassBreakdown && Object.keys(masterPassBreakdown).length > 0) {
    md += `\n## Pass Breakdown (X-Large Scenario)\n\n`;
    md += `| Stage | Pass | Duration (ms) |\n`;
    md += `|-------|------|---------------|\n`;
    for (const [stage, data] of Object.entries(masterPassBreakdown)) {
      for (const pass of data.passes) {
        md += `| ${stage} | ${pass.name} | ${pass.duration.toFixed(2)} |\n`;
      }
    }

    md += `\n### Stage Totals\n\n`;
    md += `| Stage | Total (ms) | % of Pipeline |\n`;
    md += `|-------|------------|---------------|\n`;
    const totalPassTime = Object.values(masterPassBreakdown).reduce((s, d) => s + d.total, 0);
    for (const [stage, data] of Object.entries(masterPassBreakdown)) {
      const pct = ((data.total / totalPassTime) * 100).toFixed(1);
      md += `| ${stage} | ${data.total.toFixed(2)} | ${pct}% |\n`;
    }
  }

  md += `\n## Notes\n\n`;
  md += `- Cold start includes Node.js JIT compilation overhead\n`;
  md += `- Memory metrics: Start = before benchmark, Peak = highest during run, End = after all iterations\n`;
  md += `- Pass timings captured from pipeline's built-in timeline (last iteration of each scenario)\n`;
  md += `- Estimated CSS size based on average declaration length (~25 bytes/decl)\n`;
  md += `- All measurements on Node.js ${systemInfo.node}, ${systemInfo.platform}\n`;

  const mdPath = resolve(outputDir, `benchmark-${timestamp}.md`);
  writeFileSync(mdPath, md);
  console.log(`📄 Markdown: ${mdPath}`);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${totalTime}s`);
}

main();