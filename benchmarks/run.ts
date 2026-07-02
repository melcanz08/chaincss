#!/usr/bin/env node

// benchmarks/run.js
//
// Consolidated ChainCSS Pipeline Benchmark Suite
// Replaces: run.js, run-profile.js
//
// Measures: cold/warm start, per-scenario throughput, pass breakdown,
//           memory usage, and scaling across 4 component sizes
// with realistic CSS properties that exercise the full pipeline.

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import os from 'os';

// ============================================================================
// Configuration
// ============================================================================

const SCENARIOS = [
  { name: 'small',  label: 'Small (5 rules)',     rules: 5,    declPerRule: 4,  iterations: 100, warmupIterations: 5 },
  { name: 'medium', label: 'Medium (50 rules)',    rules: 50,   declPerRule: 8,  iterations: 50,  warmupIterations: 3 },
  { name: 'large',  label: 'Large (500 rules)',    rules: 500,  declPerRule: 10, iterations: 30,  warmupIterations: 2 },
  { name: 'xlarge', label: 'X-Large (2000 rules)', rules: 2000, declPerRule: 10, iterations: 10,  warmupIterations: 1 },
];

// Realistic CSS properties that exercise the pipeline:
// - Hex colors → css-compressor shortens them
// - display: flex → feature detection finds flexbox-grid
// - px values → unit-normalizer validates them
// - Misspelled values → intent-normalizer corrects them
// - Custom properties → token-lowering
const REAL_PROPERTIES = [
  { prop: 'display',         values: ['flex', 'grid', 'block', 'inline-flex', 'flexbox'] },
  { prop: 'color',           values: ['#333333', '#ffffff', '#1a73e8', '#ff4444', '#888'] },
  { prop: 'backgroundColor', values: ['#f5f5f5', '#ffffff', '#1a73e8', '#222222'] },
  { prop: 'fontSize',        values: ['14px', '16px', '20px', '24px', '12px'] },
  { prop: 'padding',         values: ['8px', '16px', '24px', '32px', '48px'] },
  { prop: 'margin',          values: ['0', '8px', '16px', '24px', 'auto'] },
  { prop: 'borderRadius',    values: ['4px', '8px', '12px', '16px', '50%'] },
  { prop: 'width',           values: ['100%', '50%', '320px', '768px', 'auto'] },
  { prop: 'height',          values: ['auto', '100%', '48px', '64px', '100vh'] },
  { prop: 'boxShadow',       values: ['0 1px 3px rgba(0,0,0,0.12)', '0 4px 12px rgba(0,0,0,0.15)', 'none'] },
  { prop: 'opacity',         values: [1, 0.8, 0.5, 0.2] },
  { prop: 'transition',      values: ['all 0.2s ease', 'opacity 0.15s', 'transform 0.3s ease-in-out'] },
  { prop: 'position',        values: ['relative', 'abs', 'static', 'fixed'] },
  { prop: 'cursor',          values: ['pointer', 'default', 'hand', 'not-allowed'] },
  { prop: 'zIndex',          values: ['1', '10', '100', '999'] },
  { prop: 'overflow',        values: ['hidden', 'scrollable', 'auto', 'visible'] },
  { prop: 'textAlign',       values: ['center', 'left', 'centered', 'justify'] },
  { prop: 'justifyContent',  values: ['center', 'flex-start', 'flex-end', 'space-between'] },
  { prop: 'alignItems',      values: ['center', 'flex-start', 'stretch', 'baseline'] },
  { prop: 'gap',             values: ['8px', '16px', '24px', '32px'] },
];

// Some rules should have semantic intents and constraints
const INTENT_RULES = ['card', 'button-primary', 'center-content', 'sticky-header'];
const SEMANTIC_RULES = [
  { category: 'surface', intent: 'interactive' },
  { category: 'text', intent: 'primary' },
  { category: 'elevation', intent: 'floating' },
  { category: 'state', intent: 'hover' },
];

// ============================================================================
// Fixture Generation
// ============================================================================

async function generateRealisticIR(rules: number, declPerRule: number) {
  const { createDeclaration, createRule, createIR, resetIdCounter } = await import(
    '../src/compiler/pipeline/ir/factory.js'
  );

  resetIdCounter();
  const ir = createIR(['bench.css']);

  for (let i = 0; i < rules; i++) {
    const rule = createRule(`.component-${i % 100}-${Math.floor(i / 100)}`);

    // Add realistic declarations (cycling through the property table)
    for (let j = 0; j < declPerRule; j++) {
      const { prop, values } = REAL_PROPERTIES[(i + j) % REAL_PROPERTIES.length];
      const value = values[(i * 3 + j * 7) % values.length];
      rule.declarations.push(createDeclaration(prop, value));
    }

    // Add pseudo-classes to ~20% of rules
    if (i % 5 === 0) {
      rule.pseudoClasses.push({
        id: `pseudo-${i}`,
        name: 'hover',
        declarations: [
          createDeclaration('opacity', '0.8'),
          createDeclaration('transform', 'translateY(-1px)'),
        ],
        source: {},
        history: [],
      });
    }

    // Add at-rules (media queries) to ~10% of rules
    if (i % 10 === 0) {
      rule.atRules.push({
        id: `media-${i}`,
        type: 'media',
        query: i % 20 === 0 ? '(max-width: 768px)' : '(min-width: 1024px)',
        declarations: [
          createDeclaration('flexDirection', i % 3 === 0 ? 'column' : 'row'),
          createDeclaration('padding', i % 2 === 0 ? '16px' : '24px'),
        ],
        nestedRules: [],
        source: {},
        history: [],
      });
    }

    // Add intent metadata to ~5% of rules
    if (i % 20 === 0 && INTENT_RULES.length > 0) {
      rule.meta._intent = INTENT_RULES[i % INTENT_RULES.length];
    }

    // Add semantic token metadata to ~5% of rules
    if (i % 20 === 5 && SEMANTIC_RULES.length > 0) {
      rule.meta._semantic = [SEMANTIC_RULES[i % SEMANTIC_RULES.length]];
    }

    // Mark ~2% of rules as dead (for dead-code-eliminator)
    if (i % 50 === 0) {
      rule.isDead = true;
    }

    ir.rules.push(rule);
  }

  return ir;
}

// ============================================================================
// Statistics Helpers
// ============================================================================

function calculateStats(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((s, t) => s + t, 0) / times.length;
  const variance = times.reduce((s, t) => s + Math.pow(t - mean, 2), 0) / times.length;

  return {
    avg: +mean.toFixed(3),
    median: +sorted[Math.floor(sorted.length / 2)].toFixed(3),
    min: +sorted[0].toFixed(3),
    max: +sorted[sorted.length - 1].toFixed(3),
    p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(3),
    p99: +sorted[Math.floor(sorted.length * 0.99)].toFixed(3),
    stdDev: +Math.sqrt(variance).toFixed(3),
  };
}

function cloneViaJSON<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🚀 ChainCSS Pipeline Benchmark Suite\n');

  const { createPipeline } = await import(
    '../src/compiler/pipeline/unified-pipeline.js'
  );
  const pipeline = createPipeline('production');

  const systemInfo = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    memoryGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
  };

  console.log(`📊 System: ${systemInfo.node} | ${systemInfo.platform} | ${systemInfo.cpus} CPUs | ${systemInfo.memoryGB}GB RAM`);
  console.log(`🔬 Pipeline: 5-stage (normalize → validate → analyze → optimize → lower)`);
  console.log(`📦 Realistic fixtures: hex colors, misspellings, intents, media queries, dead rules\n`);
  console.log('─'.repeat(90) + '\n');

  const results = [];
  const startTime = Date.now();

  // ==========================================================================
  // Cold vs Warm Start
  // ==========================================================================
  console.log('🧊 COLD vs WARM START\n');

  const coldIR = await generateRealisticIR(200, 8);
  const coldStart = performance.now();
  pipeline.execute(cloneViaJSON(coldIR));
  const coldTime = performance.now() - coldStart;

  const warmTimes: number[] = [];
  for (let i = 0; i < 50; i++) {
    const start = performance.now();
    pipeline.execute(cloneViaJSON(coldIR));
    warmTimes.push(performance.now() - start);
  }
  const warmAvg = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;

  console.log(`  Cold start (first run):     ${coldTime.toFixed(2)}ms`);
  console.log(`  Warm average (50 runs):     ${warmAvg.toFixed(2)}ms`);
  console.log(`  JIT/load overhead:          ${(coldTime - warmAvg).toFixed(2)}ms\n`);

  // ==========================================================================
  // Per-Scenario Benchmarks
  // ==========================================================================
  console.log('─'.repeat(90));
  console.log('\n📊 SCENARIO BENCHMARKS\n');

  let masterPassBreakdown: Record<string, any> | null = null;

  for (const scenario of SCENARIOS) {
    const ir = await generateRealisticIR(scenario.rules, scenario.declPerRule);

    // Input metrics
    const inputDecls = ir.rules.reduce((s, r) => s + r.declarations.length, 0);
    const inputPseudo = ir.rules.reduce((s, r) => s + r.pseudoClasses.length, 0);
    const inputAtRules = ir.rules.reduce((s, r) => s + r.atRules.length, 0);
    const inputDead = ir.rules.filter(r => r.isDead).length;

    // Warmup
    for (let w = 0; w < scenario.warmupIterations; w++) {
      pipeline.execute(cloneViaJSON(ir));
    }

    // Measurement
    const times: number[] = [];
    const memorySnapshots: Array<{ before: number; after: number }> = [];
    let passBreakdown: Record<string, any> | null = null;
    let lastPipelineResult: any = null;

    if (global.gc) global.gc();
    const memStart = process.memoryUsage().heapUsed;

    for (let i = 0; i < scenario.iterations; i++) {
      if (global.gc) global.gc();
      const memBefore = process.memoryUsage().heapUsed;
      const fresh = cloneViaJSON(ir);
      const start = performance.now();
      lastPipelineResult = pipeline.execute(fresh);
      times.push(performance.now() - start);
      memorySnapshots.push({
        before: memBefore,
        after: process.memoryUsage().heapUsed,
      });
    }

    const memEnd = process.memoryUsage().heapUsed;
    const stats = calculateStats(times);
    const peakMem = Math.max(...memorySnapshots.map(s => Math.max(s.before, s.after)));

    // Output metrics from pipeline
    const outDecls = lastPipelineResult?.ir?.rules?.reduce(
      (s: number, r: any) => s + r.declarations.length, 0
    ) || inputDecls;
    const outRules = lastPipelineResult?.ir?.rules?.filter(
      (r: any) => !r.isDead
    ).length || scenario.rules;
    const eliminatedDead = inputDead - (lastPipelineResult?.ir?.rules?.filter(
      (r: any) => r.isDead
    ).length || 0);

    const cssBytes = lastPipelineResult?.finalCSS?.length || 0;
    const rawCSSBytes = inputDecls * 28; // rough estimate for uncompressed
    const bytesSaved = rawCSSBytes - cssBytes;
    const savingsPct = rawCSSBytes > 0 ? ((bytesSaved / rawCSSBytes) * 100).toFixed(1) : '0';

    // Build pass breakdown from timeline
    const stageMap: Record<string, { total: number; passes: Array<{ name: string; duration: number }> }> = {};
    if (lastPipelineResult?.timeline) {
      for (const entry of lastPipelineResult.timeline) {
        if (!stageMap[entry.stage]) {
          stageMap[entry.stage] = { total: 0, passes: [] };
        }
        stageMap[entry.stage].total += entry.duration;
        stageMap[entry.stage].passes.push({
          name: entry.pass,
          duration: entry.duration,
        });
      }
      masterPassBreakdown = stageMap;
    }

    const result = {
      scenario: scenario.name,
      label: scenario.label,
      rulesIn: scenario.rules,
      rulesOut: outRules,
      declarationsIn: inputDecls,
      declarationsOut: outDecls,
      pseudoClasses: inputPseudo,
      atRules: inputAtRules,
      deadRulesIn: inputDead,
      deadRulesOut: eliminatedDead,
      cssBytes,
      bytesSaved,
      savingsPct,
      iterations: scenario.iterations,
      metrics: stats,
      memory: {
        startMB: +(memStart / 1024 / 1024).toFixed(2),
        endMB: +(memEnd / 1024 / 1024).toFixed(2),
        peakMB: +(peakMem / 1024 / 1024).toFixed(2),
        deltaMB: +((memEnd - memStart) / 1024 / 1024).toFixed(2),
      },
      passBreakdown: stageMap,
    };

    results.push(result);

    // Console output
    console.log(`${scenario.label}:`);
    console.log(`  Rules: ${scenario.rules} in → ${outRules} out | Decls: ${inputDecls} in → ${outDecls} out`);
    console.log(`  Dead: ${inputDead} in → ${eliminatedDead} eliminated | Pseudo: ${inputPseudo} | @rules: ${inputAtRules}`);
    console.log(`  ⏱️  ${stats.avg}ms avg | P95: ${stats.p95}ms | Median: ${stats.median}ms | StdDev: ${stats.stdDev}ms`);
    console.log(`  📏 CSS: ${cssBytes}B (${(cssBytes / 1024).toFixed(1)}KB) | Saved: ${bytesSaved}B (${savingsPct}%)`);
    console.log(`  💾 Mem: ${result.memory.startMB}→${result.memory.peakMB}→${result.memory.endMB}MB (Δ${result.memory.deltaMB}MB)`);

    // Visual pass breakdown
    if (Object.keys(stageMap).length > 0) {
      const totalPassTime = Object.values(stageMap).reduce((s, d) => s + d.total, 0);
      const stages = ['normalization', 'validation', 'analysis', 'optimization', 'lowering'];
      console.log(`  🔬 Stage breakdown (${totalPassTime.toFixed(1)}ms total):`);
      for (const stage of stages) {
        if (stageMap[stage]) {
          const pct = ((stageMap[stage].total / totalPassTime) * 100).toFixed(0);
          const barLen = Math.max(1, Math.round(stageMap[stage].total / totalPassTime * 30));
          const bar = '█'.repeat(barLen);
          console.log(`     ${stage.padEnd(14)} ${stageMap[stage].total.toFixed(2).padStart(6)}ms  ${pct.padStart(3)}%  ${bar}`);
        }
      }
    }
    console.log();
  }

  console.log('─'.repeat(90));

  // ==========================================================================
  // Output Files
  // ==========================================================================

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = resolve(process.cwd(), 'benchmarks/results');
  mkdirSync(outputDir, { recursive: true });

  const benchResult = {
    compiler: 'chaincss',
    version: '2.8.15',
    pipeline: '5-stage (normalize→validate→analyze→optimize→lower)',
    timestamp,
    systemInfo,
    coldWarm: {
      coldMs: +coldTime.toFixed(2),
      warmAvgMs: +warmAvg.toFixed(2),
      overheadMs: +(coldTime - warmAvg).toFixed(2),
    },
    results,
  };

  // JSON output
  const jsonPath = resolve(outputDir, `benchmark-${timestamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(benchResult, null, 2));

  // Markdown output
  let md = `# ChainCSS Pipeline Benchmark\n\n`;
  md += `**Version:** ${benchResult.version} | **Date:** ${new Date().toISOString().split('T')[0]}\n`;
  md += `**System:** ${systemInfo.node} | ${systemInfo.platform} | ${systemInfo.cpus} CPUs | ${systemInfo.memoryGB}GB RAM\n`;
  md += `**Fixtures:** Realistic CSS with hex colors, misspellings, intents, media queries, dead rules\n\n`;

  md += `## Cold vs Warm Start\n\n`;
  md += `| Metric | Time |\n|--------|------|\n`;
  md += `| Cold start | ${coldTime.toFixed(2)}ms |\n`;
  md += `| Warm average | ${warmAvg.toFixed(2)}ms |\n`;
  md += `| Overhead | ${(coldTime - warmAvg).toFixed(2)}ms |\n\n`;

  md += `## Results\n\n`;
  md += `| Scenario | Rules In→Out | Decls In→Out | Dead In→Elim | Avg | P95 | StdDev | CSS | Saved | Mem Δ |\n`;
  md += `|----------|-------------|-------------|-------------|-----|-----|--------|-----|-------|------|\n`;

  for (const r of results) {
    md += `| ${r.label} | ${r.rulesIn}→${r.rulesOut} | ${r.declarationsIn}→${r.declarationsOut} | ${r.deadRulesIn}→${r.deadRulesOut} | ${r.metrics.avg}ms | ${r.metrics.p95}ms | ${r.metrics.stdDev}ms | ${r.cssBytes}B | ${r.bytesSaved}B (${r.savingsPct}%) | ${r.memory.deltaMB}MB |\n`;
  }

  // Scaling table
  if (results.length >= 4) {
    const [s, m, l, xl] = results;
    md += `\n## Scaling\n\n`;
    md += `| Metric | Small→Medium | Medium→Large | Large→X-Large |\n`;
    md += `|--------|-------------|-------------|---------------|\n`;
    md += `| Rules | ${(m.rulesIn / s.rulesIn).toFixed(1)}x | ${(l.rulesIn / m.rulesIn).toFixed(1)}x | ${(xl.rulesIn / l.rulesIn).toFixed(1)}x |\n`;
    md += `| Time | ${(m.metrics.avg / s.metrics.avg).toFixed(1)}x | ${(l.metrics.avg / m.metrics.avg).toFixed(1)}x | ${(xl.metrics.avg / l.metrics.avg).toFixed(1)}x |\n`;
    md += `| Memory | ${(m.memory.peakMB / s.memory.peakMB).toFixed(1)}x | ${(l.memory.peakMB / m.memory.peakMB).toFixed(1)}x | ${(xl.memory.peakMB / l.memory.peakMB).toFixed(1)}x |\n`;
  }

  // Pass breakdown for largest scenario
  if (masterPassBreakdown && Object.keys(masterPassBreakdown).length > 0) {
    const totalPassTime = Object.values(masterPassBreakdown).reduce(
      (s: number, d: any) => s + d.total, 0
    );

    md += `\n## Pass Breakdown (X-Large)\n\n`;
    md += `| Stage | Pass | Duration | % of Pipeline |\n`;
    md += `|-------|------|----------|---------------|\n`;

    for (const [stage, data] of Object.entries(masterPassBreakdown)) {
      for (const pass of (data as any).passes) {
        const pct = ((pass.duration / totalPassTime) * 100).toFixed(1);
        md += `| ${stage} | ${pass.name} | ${pass.duration}ms | ${pct}% |\n`;
      }
    }

    md += `\n### Stage Totals\n\n`;
    md += `| Stage | Total | % |\n|-------|-------|---|\n`;
    for (const [stage, data] of Object.entries(masterPassBreakdown)) {
      const pct = (((data as any).total / totalPassTime) * 100).toFixed(1);
      md += `| ${stage} | ${(data as any).total.toFixed(1)}ms | ${pct}% |\n`;
    }
  }

  md += `\n## Notes\n\n`;
  md += `- Fixtures include realistic CSS: hex colors (#fff, #1a73e8), misspellings (flexbox, abs, hand, centered), semantic intents, media queries, and dead rules\n`;
  md += `- Cold start includes Node.js JIT compilation and module loading\n`;
  md += `- Memory metrics: Start = before benchmark, Peak = highest during run, End = after all iterations\n`;
  md += `- Pass timings from pipeline's built-in timeline\n`;
  md += `- Dead rules: input fixtures have ~2% dead rules; dead-code-eliminator removes them\n`;
  md += `- CSS savings from css-compressor (hex shortening, whitespace removal)\n`;

  const mdPath = resolve(outputDir, `benchmark-${timestamp}.md`);
  writeFileSync(mdPath, md);

  console.log(`\n📄 JSON: ${jsonPath}`);
  console.log(`📄 Markdown: ${mdPath}`);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${totalTime}s`);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});