#!/usr/bin/env node
"use strict";
// benchmarks/run.ts
//
// Consolidated ChainCSS Pipeline Benchmark Suite
// Replaces: run.js, run-profile.js
//
// Measures: cold/warm start, per-scenario throughput, pass breakdown,
//           memory usage, and scaling across component sizes
// with realistic CSS properties and high-concurrency worker thread streaming.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var path_1 = require("path");
var os_1 = require("os");
var fixture_generator_js_1 = require("./fixture-generator.js");
// ============================================================================
// Configuration
// ============================================================================
var SCENARIOS = [
    { name: 'small', label: 'Small (5 rules)', rules: 5, declPerRule: 4, iterations: 100, warmupIterations: 5 },
    { name: 'medium', label: 'Medium (50 rules)', rules: 50, declPerRule: 8, iterations: 50, warmupIterations: 3 },
    { name: 'large', label: 'Large (500 rules)', rules: 500, declPerRule: 10, iterations: 30, warmupIterations: 2 },
    { name: 'xlarge', label: 'X-Large (2000 rules)', rules: 2000, declPerRule: 10, iterations: 10, warmupIterations: 1 },
];
// Realistic CSS properties that exercise the pipeline:
// - Hex colors → css-compressor shortens them
// - display: flex → feature detection finds flexbox-grid
// - px values → unit-normalizer validates them
// - Misspelled values → intent-normalizer corrects them
// - Custom properties → token-lowering
var REAL_PROPERTIES = [
    { prop: 'display', values: ['flex', 'grid', 'block', 'inline-flex', 'flexbox'] },
    { prop: 'color', values: ['#333333', '#ffffff', '#1a73e8', '#ff4444', '#888'] },
    { prop: 'backgroundColor', values: ['#f5f5f5', '#ffffff', '#1a73e8', '#222222'] },
    { prop: 'fontSize', values: ['14px', '16px', '20px', '24px', '12px'] },
    { prop: 'padding', values: ['8px', '16px', '24px', '32px', '48px'] },
    { prop: 'margin', values: ['0', '8px', '16px', '24px', 'auto'] },
    { prop: 'borderRadius', values: ['4px', '8px', '12px', '16px', '50%'] },
    { prop: 'width', values: ['100%', '50%', '320px', '768px', 'auto'] },
    { prop: 'height', values: ['auto', '100%', '48px', '64px', '100vh'] },
    { prop: 'boxShadow', values: ['0 1px 3px rgba(0,0,0,0.12)', '0 4px 12px rgba(0,0,0,0.15)', 'none'] },
    { prop: 'opacity', values: [1, 0.8, 0.5, 0.2] },
    { prop: 'transition', values: ['all 0.2s ease', 'opacity 0.15s', 'transform 0.3s ease-in-out'] },
    { prop: 'position', values: ['relative', 'abs', 'static', 'fixed'] },
    { prop: 'cursor', values: ['pointer', 'default', 'hand', 'not-allowed'] },
    { prop: 'zIndex', values: ['1', '10', '100', '999'] },
    { prop: 'overflow', values: ['hidden', 'scrollable', 'auto', 'visible'] },
    { prop: 'textAlign', values: ['center', 'left', 'centered', 'justify'] },
    { prop: 'justifyContent', values: ['center', 'flex-start', 'flex-end', 'space-between'] },
    { prop: 'alignItems', values: ['center', 'flex-start', 'stretch', 'baseline'] },
    { prop: 'gap', values: ['8px', '16px', '24px', '32px'] },
];
// Some rules should have semantic intents and constraints
var INTENT_RULES = ['card', 'button-primary', 'center-content', 'sticky-header'];
var SEMANTIC_RULES = [
    { category: 'surface', intent: 'interactive' },
    { category: 'text', intent: 'primary' },
    { category: 'elevation', intent: 'floating' },
    { category: 'state', intent: 'hover' },
];
// ============================================================================
// Fixture Generation
// ============================================================================
function generateRealisticIR(rules, declPerRule) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, createDeclaration, createRule, createIR, resetIdCounter, ir, i, rule, j, _b, prop, values, value;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../src/compiler/pipeline/ir/factory.js'); })];
                case 1:
                    _a = _c.sent(), createDeclaration = _a.createDeclaration, createRule = _a.createRule, createIR = _a.createIR, resetIdCounter = _a.resetIdCounter;
                    resetIdCounter();
                    ir = createIR(['bench.css']);
                    for (i = 0; i < rules; i++) {
                        rule = createRule(".component-".concat(i % 100, "-").concat(Math.floor(i / 100)));
                        // Add realistic declarations (cycling through the property table)
                        for (j = 0; j < declPerRule; j++) {
                            _b = REAL_PROPERTIES[(i + j) % REAL_PROPERTIES.length], prop = _b.prop, values = _b.values;
                            value = values[(i * 3 + j * 7) % values.length];
                            rule.declarations.push(createDeclaration(prop, value));
                        }
                        // Add pseudo-classes to ~20% of rules
                        if (i % 5 === 0) {
                            rule.pseudoClasses.push({
                                id: "pseudo-".concat(i),
                                parentId: rule.id,
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
                                id: "media-".concat(i),
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
                    return [2 /*return*/, ir];
            }
        });
    });
}
// ============================================================================
// Statistics Helpers
// ============================================================================
function calculateStats(times) {
    var sorted = __spreadArray([], times, true).sort(function (a, b) { return a - b; });
    var mean = times.reduce(function (s, t) { return s + t; }, 0) / times.length;
    var variance = times.reduce(function (s, t) { return s + Math.pow(t - mean, 2); }, 0) / times.length;
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
function cloneViaJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
}
// ============================================================================
// Main
// ============================================================================
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var createPipeline, pipeline, systemInfo, streamer, results, startTime, coldIR, coldStart, coldTime, warmTimes, i, start, warmAvg, masterPassBreakdown, _i, SCENARIOS_1, scenario, ir, inputDecls, inputPseudo, inputAtRules, inputDead, w, times, memorySnapshots, lastPipelineResult, memStart, i, memBefore, fresh, start, memEnd, stats, peakMem, outDecls, outRules, eliminatedDead, cssBytes, rawCSSBytes, bytesSaved, savingsPct, stageMap, _a, _b, entry, result, totalPassTime, stages, _c, stages_1, stage, pct, barLen, bar, timestamp, outputDir, benchResult, jsonPath, md, _d, results_1, r, s, m, l, xl, totalPassTime, _e, _f, _g, stage, data, _h, _j, pass, pct, _k, _l, _m, stage, data, pct, mdPath, totalTime;
        var _o, _p, _q, _r, _s, _t, _u;
        return __generator(this, function (_v) {
            switch (_v.label) {
                case 0:
                    console.log('🚀 ChainCSS Pipeline Benchmark Suite\n');
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../src/compiler/pipeline/index.js'); })];
                case 1:
                    createPipeline = (_v.sent()).createPipeline;
                    pipeline = createPipeline('production');
                    systemInfo = {
                        node: process.version,
                        platform: process.platform,
                        arch: process.arch,
                        cpus: os_1.default.cpus().length,
                        memoryGB: Math.round(os_1.default.totalmem() / 1024 / 1024 / 1024),
                    };
                    console.log("\uD83D\uDCCA System: ".concat(systemInfo.node, " | ").concat(systemInfo.platform, " | ").concat(systemInfo.cpus, " CPUs | ").concat(systemInfo.memoryGB, "GB RAM"));
                    console.log("\uD83D\uDD2C Pipeline: 5-stage (normalize \u2192 validate \u2192 analyze \u2192 optimize \u2192 lower)");
                    console.log("\uD83D\uDCE6 Realistic fixtures: hex colors, misspellings, intents, media queries, dead rules\n");
                    console.log('─'.repeat(90) + '\n');
                    // ==========================================================================
                    // Concurrent Worker Thread Disk Streaming
                    // ==========================================================================
                    console.log('🧵 CONCURRENT WORKER THREAD FIXTURE STREAMING\n');
                    streamer = new fixture_generator_js_1.ConcurrentFixtureStreamer();
                    return [4 /*yield*/, streamer.generateAndStream(500, 'extreme', true)];
                case 2:
                    _v.sent();
                    console.log('\n' + '─'.repeat(90) + '\n');
                    results = [];
                    startTime = Date.now();
                    // ==========================================================================
                    // Cold vs Warm Start
                    // ==========================================================================
                    console.log('🧊 COLD vs WARM START\n');
                    return [4 /*yield*/, generateRealisticIR(200, 8)];
                case 3:
                    coldIR = _v.sent();
                    coldStart = performance.now();
                    pipeline.execute(cloneViaJSON(coldIR));
                    coldTime = performance.now() - coldStart;
                    warmTimes = [];
                    for (i = 0; i < 50; i++) {
                        start = performance.now();
                        pipeline.execute(cloneViaJSON(coldIR));
                        warmTimes.push(performance.now() - start);
                    }
                    warmAvg = warmTimes.reduce(function (a, b) { return a + b; }, 0) / warmTimes.length;
                    console.log("  Cold start (first run):     ".concat(coldTime.toFixed(2), "ms"));
                    console.log("  Warm average (50 runs):     ".concat(warmAvg.toFixed(2), "ms"));
                    console.log("  JIT/load overhead:          ".concat((coldTime - warmAvg).toFixed(2), "ms\n"));
                    // ==========================================================================
                    // Per-Scenario Benchmarks
                    // ==========================================================================
                    console.log('─'.repeat(90));
                    console.log('\n📊 SCENARIO BENCHMARKS\n');
                    masterPassBreakdown = null;
                    _i = 0, SCENARIOS_1 = SCENARIOS;
                    _v.label = 4;
                case 4:
                    if (!(_i < SCENARIOS_1.length)) return [3 /*break*/, 7];
                    scenario = SCENARIOS_1[_i];
                    return [4 /*yield*/, generateRealisticIR(scenario.rules, scenario.declPerRule)];
                case 5:
                    ir = _v.sent();
                    inputDecls = ir.rules.reduce(function (s, r) { return s + r.declarations.length; }, 0);
                    inputPseudo = ir.rules.reduce(function (s, r) { return s + r.pseudoClasses.length; }, 0);
                    inputAtRules = ir.rules.reduce(function (s, r) { return s + r.atRules.length; }, 0);
                    inputDead = ir.rules.filter(function (r) { return r.isDead; }).length;
                    // Warmup
                    for (w = 0; w < scenario.warmupIterations; w++) {
                        pipeline.execute(cloneViaJSON(ir));
                    }
                    times = [];
                    memorySnapshots = [];
                    lastPipelineResult = null;
                    if (global.gc)
                        global.gc();
                    memStart = process.memoryUsage().heapUsed;
                    for (i = 0; i < scenario.iterations; i++) {
                        if (global.gc)
                            global.gc();
                        memBefore = process.memoryUsage().heapUsed;
                        fresh = cloneViaJSON(ir);
                        start = performance.now();
                        lastPipelineResult = pipeline.execute(fresh);
                        times.push(performance.now() - start);
                        memorySnapshots.push({
                            before: memBefore,
                            after: process.memoryUsage().heapUsed,
                        });
                    }
                    memEnd = process.memoryUsage().heapUsed;
                    stats = calculateStats(times);
                    peakMem = Math.max.apply(Math, memorySnapshots.map(function (s) { return Math.max(s.before, s.after); }));
                    outDecls = ((_p = (_o = lastPipelineResult === null || lastPipelineResult === void 0 ? void 0 : lastPipelineResult.ir) === null || _o === void 0 ? void 0 : _o.rules) === null || _p === void 0 ? void 0 : _p.reduce(function (s, r) { return s + r.declarations.length; }, 0)) || inputDecls;
                    outRules = ((_r = (_q = lastPipelineResult === null || lastPipelineResult === void 0 ? void 0 : lastPipelineResult.ir) === null || _q === void 0 ? void 0 : _q.rules) === null || _r === void 0 ? void 0 : _r.filter(function (r) { return !r.isDead; }).length) || scenario.rules;
                    eliminatedDead = inputDead - (((_t = (_s = lastPipelineResult === null || lastPipelineResult === void 0 ? void 0 : lastPipelineResult.ir) === null || _s === void 0 ? void 0 : _s.rules) === null || _t === void 0 ? void 0 : _t.filter(function (r) { return r.isDead; }).length) || 0);
                    cssBytes = ((_u = lastPipelineResult === null || lastPipelineResult === void 0 ? void 0 : lastPipelineResult.finalCSS) === null || _u === void 0 ? void 0 : _u.length) || 0;
                    rawCSSBytes = inputDecls * 28;
                    bytesSaved = rawCSSBytes - cssBytes;
                    savingsPct = rawCSSBytes > 0 ? ((bytesSaved / rawCSSBytes) * 100).toFixed(1) : '0';
                    stageMap = {};
                    if (lastPipelineResult === null || lastPipelineResult === void 0 ? void 0 : lastPipelineResult.timeline) {
                        for (_a = 0, _b = lastPipelineResult.timeline; _a < _b.length; _a++) {
                            entry = _b[_a];
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
                    result = {
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
                        cssBytes: cssBytes,
                        bytesSaved: bytesSaved,
                        savingsPct: savingsPct,
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
                    console.log("".concat(scenario.label, ":"));
                    console.log("  Rules: ".concat(scenario.rules, " in \u2192 ").concat(outRules, " out | Decls: ").concat(inputDecls, " in \u2192 ").concat(outDecls, " out"));
                    console.log("  Dead: ".concat(inputDead, " in \u2192 ").concat(eliminatedDead, " eliminated | Pseudo: ").concat(inputPseudo, " | @rules: ").concat(inputAtRules));
                    console.log("  \u23F1\uFE0F  ".concat(stats.avg, "ms avg | P95: ").concat(stats.p95, "ms | Median: ").concat(stats.median, "ms | StdDev: ").concat(stats.stdDev, "ms"));
                    console.log("  \uD83D\uDCCF CSS: ".concat(cssBytes, "B (").concat((cssBytes / 1024).toFixed(1), "KB) | Saved: ").concat(bytesSaved, "B (").concat(savingsPct, "%)"));
                    console.log("  \uD83D\uDCBE Mem: ".concat(result.memory.startMB, "\u2192").concat(result.memory.peakMB, "\u2192").concat(result.memory.endMB, "MB (\u0394").concat(result.memory.deltaMB, "MB)"));
                    // Visual pass breakdown
                    if (Object.keys(stageMap).length > 0) {
                        totalPassTime = Object.values(stageMap).reduce(function (s, d) { return s + d.total; }, 0);
                        stages = ['normalization', 'validation', 'analysis', 'optimization', 'lowering'];
                        console.log("  \uD83D\uDD2C Stage breakdown (".concat(totalPassTime.toFixed(1), "ms total):"));
                        for (_c = 0, stages_1 = stages; _c < stages_1.length; _c++) {
                            stage = stages_1[_c];
                            if (stageMap[stage]) {
                                pct = ((stageMap[stage].total / totalPassTime) * 100).toFixed(0);
                                barLen = Math.max(1, Math.round(stageMap[stage].total / totalPassTime * 30));
                                bar = '█'.repeat(barLen);
                                console.log("     ".concat(stage.padEnd(14), " ").concat(stageMap[stage].total.toFixed(2).padStart(6), "ms  ").concat(pct.padStart(3), "%  ").concat(bar));
                            }
                        }
                    }
                    console.log();
                    _v.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7:
                    console.log('─'.repeat(90));
                    timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    outputDir = (0, path_1.resolve)(process.cwd(), 'benchmarks/results');
                    (0, fs_1.mkdirSync)(outputDir, { recursive: true });
                    benchResult = {
                        compiler: 'chaincss',
                        version: '2.8.15',
                        pipeline: '5-stage (normalize→validate→analyze→optimize→lower)',
                        timestamp: timestamp,
                        systemInfo: systemInfo,
                        coldWarm: {
                            coldMs: +coldTime.toFixed(2),
                            warmAvgMs: +warmAvg.toFixed(2),
                            overheadMs: +(coldTime - warmAvg).toFixed(2),
                        },
                        results: results,
                    };
                    jsonPath = (0, path_1.resolve)(outputDir, "benchmark-".concat(timestamp, ".json"));
                    (0, fs_1.writeFileSync)(jsonPath, JSON.stringify(benchResult, null, 2));
                    md = "# ChainCSS Pipeline Benchmark\n\n";
                    md += "**Version:** ".concat(benchResult.version, " | **Date:** ").concat(new Date().toISOString().split('T')[0], "\n");
                    md += "**System:** ".concat(systemInfo.node, " | ").concat(systemInfo.platform, " | ").concat(systemInfo.cpus, " CPUs | ").concat(systemInfo.memoryGB, "GB RAM\n");
                    md += "**Fixtures:** Realistic CSS with hex colors, misspellings, intents, media queries, dead rules\n\n";
                    md += "## Cold vs Warm Start\n\n";
                    md += "| Metric | Time |\n|--------|------|\n";
                    md += "| Cold start | ".concat(coldTime.toFixed(2), "ms |\n");
                    md += "| Warm average | ".concat(warmAvg.toFixed(2), "ms |\n");
                    md += "| Overhead | ".concat((coldTime - warmAvg).toFixed(2), "ms |\n\n");
                    md += "## Results\n\n";
                    md += "| Scenario | Rules In\u2192Out | Decls In\u2192Out | Dead In\u2192Elim | Avg | P95 | StdDev | CSS | Saved | Mem \u0394 |\n";
                    md += "|----------|-------------|-------------|-------------|-----|-----|--------|-----|-------|------|\n";
                    for (_d = 0, results_1 = results; _d < results_1.length; _d++) {
                        r = results_1[_d];
                        md += "| ".concat(r.label, " | ").concat(r.rulesIn, "\u2192").concat(r.rulesOut, " | ").concat(r.declarationsIn, "\u2192").concat(r.declarationsOut, " | ").concat(r.deadRulesIn, "\u2192").concat(r.deadRulesOut, " | ").concat(r.metrics.avg, "ms | ").concat(r.metrics.p95, "ms | ").concat(r.metrics.stdDev, "ms | ").concat(r.cssBytes, "B | ").concat(r.bytesSaved, "B (").concat(r.savingsPct, "%) | ").concat(r.memory.deltaMB, "MB |\n");
                    }
                    // Scaling table
                    if (results.length >= 4) {
                        s = results[0], m = results[1], l = results[2], xl = results[3];
                        md += "\n## Scaling\n\n";
                        md += "| Metric | Small\u2192Medium | Medium\u2192Large | Large\u2192X-Large |\n";
                        md += "|--------|-------------|-------------|---------------|\n";
                        md += "| Rules | ".concat((m.rulesIn / s.rulesIn).toFixed(1), "x | ").concat((l.rulesIn / m.rulesIn).toFixed(1), "x | ").concat((xl.rulesIn / l.rulesIn).toFixed(1), "x |\n");
                        md += "| Time | ".concat((m.metrics.avg / s.metrics.avg).toFixed(1), "x | ").concat((l.metrics.avg / m.metrics.avg).toFixed(1), "x | ").concat((xl.metrics.avg / l.metrics.avg).toFixed(1), "x |\n");
                        md += "| Memory | ".concat((m.memory.peakMB / s.memory.peakMB).toFixed(1), "x | ").concat((l.memory.peakMB / m.memory.peakMB).toFixed(1), "x | ").concat((xl.memory.peakMB / l.memory.peakMB).toFixed(1), "x |\n");
                    }
                    // Pass breakdown for largest scenario
                    if (masterPassBreakdown && Object.keys(masterPassBreakdown).length > 0) {
                        totalPassTime = Object.values(masterPassBreakdown).reduce(function (s, d) { return s + d.total; }, 0);
                        md += "\n## Pass Breakdown (X-Large)\n\n";
                        md += "| Stage | Pass | Duration | % of Pipeline |\n";
                        md += "|-------|------|----------|---------------|\n";
                        for (_e = 0, _f = Object.entries(masterPassBreakdown); _e < _f.length; _e++) {
                            _g = _f[_e], stage = _g[0], data = _g[1];
                            for (_h = 0, _j = data.passes; _h < _j.length; _h++) {
                                pass = _j[_h];
                                pct = ((pass.duration / totalPassTime) * 100).toFixed(1);
                                md += "| ".concat(stage, " | ").concat(pass.name, " | ").concat(pass.duration, "ms | ").concat(pct, "% |\n");
                            }
                        }
                        md += "\n### Stage Totals\n\n";
                        md += "| Stage | Total | % |\n|-------|-------|---|\n";
                        for (_k = 0, _l = Object.entries(masterPassBreakdown); _k < _l.length; _k++) {
                            _m = _l[_k], stage = _m[0], data = _m[1];
                            pct = ((data.total / totalPassTime) * 100).toFixed(1);
                            md += "| ".concat(stage, " | ").concat(data.total.toFixed(1), "ms | ").concat(pct, "% |\n");
                        }
                    }
                    md += "\n## Notes\n\n";
                    md += "- Fixtures include realistic CSS: hex colors (#fff, #1a73e8), misspellings (flexbox, abs, hand, centered), semantic intents, media queries, and dead rules\n";
                    md += "- Cold start includes Node.js JIT compilation and module loading\n";
                    md += "- Memory metrics: Start = before benchmark, Peak = highest during run, End = after all iterations\n";
                    md += "- Pass timings from pipeline's built-in timeline\n";
                    md += "- Dead rules: input fixtures have ~2% dead rules; dead-code-eliminator removes them\n";
                    md += "- CSS savings from css-compressor (hex shortening, whitespace removal)\n";
                    mdPath = (0, path_1.resolve)(outputDir, "benchmark-".concat(timestamp, ".md"));
                    (0, fs_1.writeFileSync)(mdPath, md);
                    console.log("\n\uD83D\uDCC4 JSON: ".concat(jsonPath));
                    console.log("\uD83D\uDCC4 Markdown: ".concat(mdPath));
                    totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log("\n\u2705 Done in ".concat(totalTime, "s"));
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error('Benchmark failed:', err);
    process.exit(1);
});
