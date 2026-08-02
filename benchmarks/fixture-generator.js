"use strict";
// ============================================================================
// FILE: benchmarks/fixture-generator.ts
// Enhanced Fixture Generator & Concurrent Streamer for ChainCSS Revamped Architecture
// ============================================================================
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcurrentFixtureStreamer = exports.FixtureGenerator = void 0;
var worker_threads_1 = require("worker_threads");
var os_1 = require("os");
var path_1 = require("path");
var url_1 = require("url");
var perf_hooks_1 = require("perf_hooks");
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
var FixtureGenerator = /** @class */ (function () {
    function FixtureGenerator() {
    }
    FixtureGenerator.prototype.generate = function (config) {
        var fixtures = {
            chaincss: this.generateChainCSS(config),
            stylex: this.generateStyleXPlaceholder(config),
            vanillaExtract: this.generateVanillaExtractPlaceholder(config),
        };
        return {
            config: config,
            fixtures: fixtures,
            metadata: {
                totalRules: this.countTotalRules(fixtures.chaincss, config.complexity),
                totalComponents: config.fileCount,
                complexityScore: this.calculateComplexity(config),
                tokenEntanglements: config.enableTokenGraph ? config.fileCount * 3 : 0,
            },
        };
    };
    FixtureGenerator.prototype.generateChainCSS = function (config) {
        var _this = this;
        return Array.from({ length: config.fileCount }, function (_, i) {
            var componentName = "Component".concat(i);
            var dependencies = config.enableTokenGraph && i > 0
                ? ["Component".concat(Math.max(0, i - 1)), "Component".concat(Math.max(0, i - 2))]
                : [];
            return {
                path: "components/".concat(componentName, ".css"),
                content: _this.generateChainCSSContent(i, config.complexity, config.enableMacros, dependencies),
                dependencies: dependencies,
            };
        });
    };
    FixtureGenerator.prototype.generateChainCSSContent = function (index, complexity, enableMacros, dependencies) {
        var tokenGraphAnnotations = dependencies.length > 0
            ? "  /* @entangle: [".concat(dependencies.join(', '), "] */\n")
            : '';
        if (complexity === 'simple') {
            return "\n@component Component".concat(index, " {\n").concat(tokenGraphAnnotations, "  color: var(--token-text-primary);\n  padding: var(--token-space-md);\n}\n");
        }
        if (complexity === 'moderate') {
            var macroBody = enableMacros ? "\n  /* Macro shorthands */\n  flex: row center between;\n  gap: var(--token-space-sm);\n  bg: var(--token-surface-card);\n  rounded: var(--token-radius-md);" : "\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  background-color: var(--token-surface-card);\n  border-radius: 6px;";
            return "\n@component Component".concat(index, " {\n").concat(tokenGraphAnnotations, "  color: var(--token-text-primary);\n  font: var(--token-font-body);\n  padding: var(--token-space-lg);\n").concat(macroBody, "\n\n  &:hover {\n    bg: var(--token-surface-hover);\n    shadow: var(--token-shadow-sm);\n  }\n}\n");
        }
        // Complex / Extreme with 136+ macro simulation & token dependency graph
        var macroPasses = enableMacros ? "\n  /* 136+ Macro Engine Shorthands */\n  flex: col stretch start;\n  size: 100% auto;\n  padding: var(--token-space-xl) var(--token-space-2xl);\n  bg: gradient(linear, var(--token-primary), var(--token-secondary));\n  rounded: var(--token-radius-lg);\n  shadow: var(--token-shadow-lg);\n  transition: all 250ms ease-in-out;" : "\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n  justify-content: flex-start;\n  width: 100%;\n  height: auto;\n  padding: 24px 32px;\n  background: linear-gradient(var(--token-primary), var(--token-secondary));\n  border-radius: 12px;\n  box-shadow: 0 10px 25px rgba(0,0,0,0.1);\n  transition: all 250ms ease-in-out;";
        var keyframesBlock = complexity === 'extreme' ? "\n@keyframes pulse-glow-".concat(index, " {\n  0% { opacity: 0.8; transform: scale(1); }\n  50% { opacity: 1; transform: scale(1.02); }\n  100% { opacity: 0.8; transform: scale(1); }\n}\n\n.animated-").concat(index, " {\n  animation: pulse-glow-").concat(index, " 3s infinite ease-in-out;\n}") : '';
        return "\n@component Component".concat(index, " {\n").concat(tokenGraphAnnotations, "  /* Design Token Contract Binding */\n  --local-accent: var(--token-brand-").concat(index % 5, ");\n  \n  color: var(--token-text-main);\n  font: var(--token-font-headline);\n").concat(macroPasses, "\n\n  @media (max-width: 768px) {\n    padding: var(--token-space-md);\n    flex: row center center;\n  }\n}\n").concat(keyframesBlock, "\n");
    };
    FixtureGenerator.prototype.generateStyleXPlaceholder = function (config) {
        return Array.from({ length: config.fileCount }, function (_, i) { return ({
            path: "components/Component".concat(i, ".stylex.js"),
            content: "import stylex from '@stylexjs/stylex';\nexport const styles = stylex.create({ root: { color: 'var(--text)' } });",
        }); });
    };
    FixtureGenerator.prototype.generateVanillaExtractPlaceholder = function (config) {
        return Array.from({ length: config.fileCount }, function (_, i) { return ({
            path: "components/Component".concat(i, ".css.ts"),
            content: "import { style } from '@vanilla-extract/css';\nexport const root = style({ color: 'var(--text)' });",
        }); });
    };
    FixtureGenerator.prototype.countTotalRules = function (fixtures, complexity) {
        var multiplier = complexity === 'simple' ? 2 : complexity === 'moderate' ? 8 : 25;
        return fixtures.length * multiplier;
    };
    FixtureGenerator.prototype.calculateComplexity = function (config) {
        var scores = { simple: 1, moderate: 3, complex: 7, extreme: 15 };
        return config.fileCount * (scores[config.complexity] || 3);
    };
    return FixtureGenerator;
}());
exports.FixtureGenerator = FixtureGenerator;
var ConcurrentFixtureStreamer = /** @class */ (function () {
    function ConcurrentFixtureStreamer() {
    }
    ConcurrentFixtureStreamer.prototype.generateAndStream = function (totalFiles, complexity, enableMacros) {
        return __awaiter(this, void 0, void 0, function () {
            var numWorkers, filesPerWorker, outputDir, startTime, workerPromises, duration;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        numWorkers = Math.max(1, os_1.default.cpus().length - 1);
                        filesPerWorker = Math.ceil(totalFiles / numWorkers);
                        outputDir = path_1.default.join(__dirname, 'generated_fixtures');
                        console.log("\uD83E\uDDF5 Spawning ".concat(numWorkers, " worker threads to stream ").concat(totalFiles, " fixtures to disk..."));
                        startTime = perf_hooks_1.performance.now();
                        workerPromises = Array.from({ length: numWorkers }, function (_, workerId) {
                            return new Promise(function (resolve, reject) {
                                var startIndex = workerId * filesPerWorker;
                                var count = Math.min(filesPerWorker, totalFiles - startIndex);
                                if (count <= 0) {
                                    return resolve({ filesWritten: 0 });
                                }
                                var worker = new worker_threads_1.Worker(path_1.default.join(__dirname, 'fixture-worker.ts'), {
                                    workerData: {
                                        workerId: workerId,
                                        startIndex: startIndex,
                                        count: count,
                                        outputDir: outputDir,
                                        complexity: complexity,
                                        enableMacros: enableMacros,
                                    },
                                });
                                worker.on('message', function (msg) {
                                    if (msg.success)
                                        resolve(msg);
                                    else
                                        reject(new Error(msg.error));
                                });
                                worker.on('error', reject);
                                worker.on('exit', function (code) {
                                    if (code !== 0)
                                        reject(new Error("Worker stopped with exit code ".concat(code)));
                                });
                            });
                        });
                        return [4 /*yield*/, Promise.all(workerPromises)];
                    case 1:
                        _a.sent();
                        duration = perf_hooks_1.performance.now() - startTime;
                        console.log("\u2705 Successfully streamed ".concat(totalFiles, " fixture files in ").concat(duration.toFixed(2), "ms using worker pool."));
                        return [2 /*return*/];
                }
            });
        });
    };
    return ConcurrentFixtureStreamer;
}());
exports.ConcurrentFixtureStreamer = ConcurrentFixtureStreamer;
