#!/usr/bin/env node
// ============================================================================
// FILE: benchmarks/benchmark-stateful-incremental.js
// Benchmark for the new StatefulIncrementalCompiler
// ============================================================================

import { performance } from "perf_hooks";
import { createPipeline } from "../src/compiler/pipeline/pipeline.js";
import { StatefulIncrementalCompiler } from "../src/compiler/incremental/stateful-compiler.js";

// ============================================================================
// Fixture Generation
// ============================================================================

function createRule(id, selector, declarations = [], sourceFile = "/test/styles.chain.ts") {
  return {
    id,
    selector,
    declarations,
    pseudoClasses: [],
    atRules: [],
    nestedRules: [],
    conditions: [],
    meta: { dependencies: [], dependents: [] },
    isDead: false,
    specificity: 10,
    hash: `hash-${id}`,
    source: { file: sourceFile, line: 1, column: 1 },
    history: [],
  };
}

function createIR(rules, sourceFiles = []) {
  return {
    id: "benchmark-ir",
    rules,
    meta: {
      version: "1.0",
      createdAt: Date.now(),
      sourceFiles,
      passCount: 0,
      passes: [],
      dirtyRules: 0,
      compiledAt: Date.now(),
    },
    diagnostics: [],
  };
}

function generateProject(fileCount, rulesPerFile) {
  const allRules = [];
  const files = new Map();
  const sourceFiles = [];

  for (let f = 0; f < fileCount; f++) {
    const filePath = `/test/styles-${f}.chain.ts`;
    sourceFiles.push(filePath);
    const fileRules = [];

    for (let r = 0; r < rulesPerFile; r++) {
      const rule = createRule(
        `rule-${f}-${r}`,
        `.component-${f}-${r}`,
        [
          { property: "color", value: `rgb(${f}, ${r}, 0)` },
          { property: "padding", value: `${r}px` },
          { property: "margin", value: `${r % 10}px` },
        ],
        filePath
      );
      fileRules.push(rule);
      allRules.push(rule);
    }

    files.set(filePath, fileRules);
  }

  return { ir: createIR(allRules, sourceFiles), files, sourceFiles };
}

// ============================================================================
// Benchmark Scenarios
// ============================================================================

async function createCompiler(project, pipeline) {
  return new StatefulIncrementalCompiler({
    pipeline,
    parseFile: async (filePath) => {
      const fileRules = project.files.get(filePath) || [];
      return createIR(fileRules, [filePath]);
    },
    generateRuleId: (filePath, stableName) => `${filePath}:${stableName}`,
    rebuild: async () => project.ir,
    initialIR: project.ir,
  });
}

async function benchmarkScenario(name, description, fn, iterations = 10) {
  console.log(`\n${name}`);
  console.log(`  ${description}`);
  console.log("  " + "─".repeat(50));

  // Warm up
  await fn();
  
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

  console.log(`  Avg: ${avg.toFixed(3)}ms`);
  console.log(`  Min: ${min.toFixed(3)}ms`);
  console.log(`  Max: ${max.toFixed(3)}ms`);
  console.log(`  P95: ${p95.toFixed(3)}ms`);

  return { avg, min, max, p95 };
}

// ============================================================================
// Main Benchmark
// ============================================================================

async function main() {
  console.log("🚀 ChainCSS StatefulIncrementalCompiler Benchmark");
  console.log("═".repeat(70));

  const scenarios = [
    { name: "Small Project", fileCount: 10, rulesPerFile: 10 },     // 100 rules
    { name: "Medium Project", fileCount: 50, rulesPerFile: 10 },    // 500 rules
    { name: "Large Project", fileCount: 100, rulesPerFile: 10 },    // 1000 rules
  ];

  for (const scenario of scenarios) {
    const totalRules = scenario.fileCount * scenario.rulesPerFile;
    console.log(`\n\n${"═".repeat(70)}`);
    console.log(`📦 ${scenario.name} (${totalRules} rules)`);
    console.log("═".repeat(70));

    const project = generateProject(scenario.fileCount, scenario.rulesPerFile);
    const pipeline = createPipeline("default");
    const compiler = await createCompiler(project, pipeline);

    // Scenario 1: Unchanged file (0 rules affected)
    await benchmarkScenario(
      "📝 Unchanged File",
      `${scenario.fileCount} files, 1 file "changed" but identical content`,
      async () => {
        await compiler.update({
          changedFiles: [{
            filePath: "/test/styles-0.chain.ts",
            kind: "style",
            source: "unchanged",
          }],
        });
      },
      20
    );

    // Scenario 2: Single file change (1 file, N rules per file affected)
    await benchmarkScenario(
      "📝 Single File Change",
      `1 file changed (${scenario.rulesPerFile} rules affected)`,
      async () => {
        const fileIdx = Math.floor(Math.random() * scenario.fileCount);
        await compiler.update({
          changedFiles: [{
            filePath: `/test/styles-${fileIdx}.chain.ts`,
            kind: "style",
            source: `change-${Date.now()}`,
          }],
        });
      },
      20
    );

    // Scenario 3: 10% of files changed
    const tenPercentFiles = Math.max(1, Math.floor(scenario.fileCount * 0.1));
    await benchmarkScenario(
      "📝 10% Files Changed",
      `${tenPercentFiles} files changed (${tenPercentFiles * scenario.rulesPerFile} rules affected)`,
      async () => {
        const changedFiles = [];
        for (let i = 0; i < tenPercentFiles; i++) {
          changedFiles.push({
            filePath: `/test/styles-${i}.chain.ts`,
            kind: "style",
            source: `change-${Date.now()}-${i}`,
          });
        }
        await compiler.update({ changedFiles });
      },
      10
    );

    // Scenario 4: Full rebuild (config change)
    await benchmarkScenario(
      "🔄 Full Rebuild",
      `Config change triggers full rebuild (${totalRules} rules)`,
      async () => {
        await compiler.update({
          changedFiles: [{
            filePath: "/test/chaincss.config.ts",
            kind: "config",
            source: "config",
          }],
        });
      },
      5
    );
  }

  console.log("\n\n" + "═".repeat(70));
  console.log("✅ Benchmark complete!");
  console.log("═".repeat(70));
}

main().catch(console.error);