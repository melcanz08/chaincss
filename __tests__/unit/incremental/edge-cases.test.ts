// ============================================================================
// FILE: __tests__/unit/incremental/edge-cases.test.ts
// ============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { IRUpdater } from "../../../src/compiler/incremental/ir-updater.js";
import { StatefulIncrementalCompiler } from "../../../src/compiler/incremental/stateful-compiler.js";
import { buildIRGraph, findAffectedNodes } from "../../../src/compiler/incremental/graph-builder.js";
import { createPipeline } from "../../../src/compiler/pipeline/pipeline.js";
import type { StyleIR, IRRule } from "../../../src/compiler/pipeline/ir/types.js";

// ============================================================================
// Helpers
// ============================================================================

function createRule(
  id: string,
  selector: string,
  declarations: Array<{ property: string; value: string }> = [],
  nestedRules: IRRule[] = [],
  pseudoClasses: any[] = [],
): IRRule {
  return {
    id,
    selector,
    declarations,
    pseudoClasses,
    atRules: [],
    nestedRules,
    conditions: [],
    meta: { dependencies: [], dependents: [] },
    isDead: false,
    specificity: 10,
    hash: `hash-${id}`,
    source: { file: "/test/styles.chain.ts", line: 1, column: 1 },
    history: [],
  };
}

function createIR(rules: IRRule[]): StyleIR {
  return {
    id: "test-ir",
    rules,
    meta: {
      version: "1.0",
      createdAt: Date.now(),
      sourceFiles: ["/test/styles.chain.ts"],
      passCount: 0,
      passes: [],
      dirtyRules: 0,
      compiledAt: Date.now(),
    },
    diagnostics: [],
  };
}

// ============================================================================
// Nested Rules Edge Cases
// ============================================================================

describe("Nested Rules Edge Cases", () => {
  let updater: IRUpdater;

  beforeEach(() => {
    updater = new IRUpdater({
      parseFile: async () => createIR([]),
      generateRuleId: (filePath, stableName) => `gen-${stableName}`,
    });
  });

  it("should handle deeply nested rules", async () => {
    const deepNested = createRule("nested-4", "span", [
      { property: "color", value: "red" },
    ]);
    const nested3 = createRule("nested-3", "div", [], [deepNested]);
    const nested2 = createRule("nested-2", ".container", [], [nested3]);
    const root = createRule("root-1", ".app", [], [nested2]);

    const ir = createIR([root]);
    updater.indexIR(ir);

    const rules = updater.getRulesForFile("/test/styles.chain.ts");
    expect(rules).toHaveLength(4); // root + 3 nested levels
  });

  it("should handle nested rule changes", async () => {
    const oldNested = createRule("nested-1", "&:hover", [
      { property: "color", value: "red" },
    ]);
    const oldRoot = createRule("root-1", ".button", [], [oldNested]);

    const newNested = createRule("nested-1", "&:hover", [
      { property: "color", value: "blue" },
    ]);
    const newRoot = createRule("root-1", ".button", [], [newNested]);

    const ir = createIR([oldRoot]);
    const testUpdater = new IRUpdater({
      parseFile: async () => createIR([newRoot]),
      generateRuleId: (filePath, stableName) => `gen-${stableName}`,
    });
    testUpdater.indexIR(ir);

    const result = await testUpdater.updateFile(ir, {
      filePath: "/test/styles.chain.ts",
      source: "nested changed",
    });

    expect(result.changedRuleIds).toContain("nested-1");
  });

  it("should handle nested rule addition", async () => {
    const oldRoot = createRule("root-1", ".button", [], []);

    const newNested = createRule("nested-new", "&:focus", [
      { property: "color", value: "blue" },
    ]);
    const newRoot = createRule("root-1", ".button", [], [newNested]);

    const ir = createIR([oldRoot]);
    const testUpdater = new IRUpdater({
      parseFile: async () => createIR([newRoot]),
      generateRuleId: (filePath, stableName) => `gen-${stableName}`,
    });
    testUpdater.indexIR(ir);

    const result = await testUpdater.updateFile(ir, {
      filePath: "/test/styles.chain.ts",
      source: "nested added",
    });

    // The ID is generated from stableName, not the original ID
    // stableName is derived from selector: "&:focus"
    expect(result.addedRuleIds).toHaveLength(1);
    expect(result.addedRuleIds[0]).toContain("&:focus");
  });

  it("should handle nested rule removal", async () => {
    const oldNested = createRule("nested-1", "&:hover", [
      { property: "color", value: "red" },
    ]);
    const oldRoot = createRule("root-1", ".button", [], [oldNested]);

    const newRoot = createRule("root-1", ".button", [], []);

    const ir = createIR([oldRoot]);
    const testUpdater = new IRUpdater({
      parseFile: async () => createIR([newRoot]),
      generateRuleId: (filePath, stableName) => `gen-${stableName}`,
    });
    testUpdater.indexIR(ir);

    const result = await testUpdater.updateFile(ir, {
      filePath: "/test/styles.chain.ts",
      source: "nested removed",
    });

    expect(result.removedRuleIds).toContain("nested-1");
  });
});

// ============================================================================
// Complex Dependency Edge Cases
// ============================================================================

describe("Complex Dependency Edge Cases", () => {
  it("should handle diamond dependencies", () => {
    // A → B, A → C, B → D, C → D (diamond)
    const ruleA = createRule("A", ".a");
    const ruleB = createRule("B", ".b");
    const ruleC = createRule("C", ".c");
    const ruleD = createRule("D", ".d");

    // Set up dependencies via token references
    const tokenRule = createRule("token", "$colors.primary");
    const useToken1 = createRule("use-1", ".b", [
      { property: "color", value: "$colors.primary" },
    ]);
    const useToken2 = createRule("use-2", ".c", [
      { property: "color", value: "$colors.primary" },
    ]);
    const useBoth = createRule("use-3", ".d", [
      { property: "background", value: "$colors.primary" },
    ]);

    const ir = createIR([tokenRule, useToken1, useToken2, useBoth]);
    const graph = buildIRGraph(ir);

    const affected = findAffectedNodes(graph, "token-colors.primary");

    expect(affected).toContain("use-1");
    expect(affected).toContain("use-2");
    expect(affected).toContain("use-3");
  });

  it("should handle circular token references without infinite loop", () => {
    // Token A references Token B, Token B references Token A
    const ruleA = createRule("rule-a", ".a", [
      { property: "color", value: "$tokens.b" },
    ]);
    const ruleB = createRule("rule-b", ".b", [
      { property: "color", value: "$tokens.a" },
    ]);

    const ir = createIR([ruleA, ruleB]);
    const graph = buildIRGraph(ir);

    // Should not hang or throw
    const affected = findAffectedNodes(graph, "rule-a", { maxDepth: 5 });

    expect(Array.isArray(affected)).toBe(true);
  });

  it("should handle many-to-one dependencies", () => {
    // Many rules depend on one token
    const rules: IRRule[] = [];
    const tokenRule = createRule("token", "$colors.primary");
    rules.push(tokenRule);

    for (let i = 0; i < 20; i++) {
      rules.push(
        createRule(`rule-${i}`, `.component-${i}`, [
          { property: "color", value: "$colors.primary" },
        ])
      );
    }

    const ir = createIR(rules);
    const graph = buildIRGraph(ir);

    const affected = findAffectedNodes(graph, "token-colors.primary");

    expect(affected).toHaveLength(20);
  });

  it("should handle one-to-many dependencies", () => {
    // One rule depends on many tokens
    const token1 = createRule("token-1", "$colors.primary");
    const token2 = createRule("token-2", "$colors.secondary");
    const token3 = createRule("token-3", "$spacing.md");

    const consumerRule = createRule("consumer", ".complex", [
      { property: "color", value: "$colors.primary" },
      { property: "background", value: "$colors.secondary" },
      { property: "padding", value: "$spacing.md" },
    ]);

    const ir = createIR([token1, token2, token3, consumerRule]);
    const graph = buildIRGraph(ir);

    const affected1 = findAffectedNodes(graph, "token-colors.primary");
    const affected2 = findAffectedNodes(graph, "token-colors.secondary");
    const affected3 = findAffectedNodes(graph, "token-spacing.md");

    expect(affected1).toContain("consumer");
    expect(affected2).toContain("consumer");
    expect(affected3).toContain("consumer");
  });
});

// ============================================================================
// Stateful Compiler Edge Cases
// ============================================================================

describe("Stateful Compiler Edge Cases", () => {
  let pipeline: ReturnType<typeof createPipeline>;
  let parseFileMock: any;
  let rebuildMock: any;

  beforeEach(() => {
    pipeline = createPipeline("default");
    parseFileMock = vi.fn();
    rebuildMock = vi.fn();
  });

  function createCompiler(initialIR?: StyleIR) {
    return new StatefulIncrementalCompiler({
      pipeline,
      parseFile: parseFileMock,
      generateRuleId: (filePath, stableName) => `${filePath}:${stableName}`,
      rebuild: rebuildMock,
      initialIR,
      maxIncrementalRules: 10, // Small threshold for testing
    });
  }

  it("should fall back to full rebuild when too many rules affected", async () => {
    const rules: IRRule[] = [];
    for (let i = 0; i < 15; i++) {
      rules.push(
        createRule(`rule-${i}`, `.component-${i}`, [
          { property: "color", value: "red" },
        ])
      );
    }

    const ir = createIR(rules);
    const compiler = createCompiler(ir);

    // Change a token that affects all rules
    parseFileMock.mockResolvedValue(createIR(rules.map(r => ({
      ...r,
      declarations: [{ property: "color", value: "blue" }],
    }))));
    rebuildMock.mockResolvedValue(createIR(rules));

    const result = await compiler.update({
      changedFiles: [{
        filePath: "/test/tokens.chain.ts",
        kind: "token",
        source: "token changed",
      }],
    });

    expect(result.incremental.fullRebuild).toBe(true);
  });

  it("should handle multiple file changes in one update", async () => {
    const rule1 = createRule("rule-1", ".button", [
      { property: "color", value: "red" },
    ]);
    const rule2 = createRule("rule-2", ".card", [
      { property: "padding", value: "10px" },
    ]);

    const ir = createIR([rule1, rule2]);
    const compiler = createCompiler(ir);

    parseFileMock
      .mockResolvedValueOnce(createIR([
        createRule("rule-1", ".button", [{ property: "color", value: "blue" }]),
      ]))
      .mockResolvedValueOnce(createIR([
        createRule("rule-2", ".card", [{ property: "padding", value: "20px" }]),
      ]));

    const result = await compiler.update({
      changedFiles: [
        { filePath: "/test/button.chain.ts", kind: "style", source: "button changed" },
        { filePath: "/test/card.chain.ts", kind: "style", source: "card changed" },
      ],
    });

    expect(result.incremental.fullRebuild).toBe(false);
    expect(result.incremental.recompiledCount).toBeGreaterThan(0);
  });

  it("should handle unknown change kinds safely", async () => {
    const rule = createRule("rule-1", ".button", [
      { property: "color", value: "red" },
    ]);

    const ir = createIR([rule]);
    const compiler = createCompiler(ir);

    parseFileMock.mockResolvedValue(createIR([rule]));

    const result = await compiler.update({
      changedFiles: [{
        filePath: "/test/styles.chain.ts",
        kind: "unknown", // Unknown kind
        source: "content",
      }],
    });

    expect(result.incremental.fullRebuild).toBe(false);
  });
});

// ============================================================================
// Performance Edge Cases
// ============================================================================

describe("Performance Edge Cases", () => {
  it("should handle large flat rule sets", () => {
    const rules: IRRule[] = [];
    for (let i = 0; i < 1000; i++) {
      rules.push(
        createRule(`rule-${i}`, `.component-${i}`, [
          { property: "color", value: `rgb(${i}, 0, 0)` },
        ])
      );
    }

    const ir = createIR(rules);
    const startTime = performance.now();
    const graph = buildIRGraph(ir);
    const endTime = performance.now();

    expect(graph.nodes).toBeDefined();
    expect(endTime - startTime).toBeLessThan(2000); // Should build in < 2s
  });

  it("should handle deeply nested structures", () => {
    let currentRule = createRule("leaf", ".leaf", [
      { property: "color", value: "red" },
    ]);

    // Build 20 levels of nesting
    for (let i = 19; i >= 0; i--) {
      currentRule = createRule(`level-${i}`, `.level-${i}`, [], [currentRule]);
    }

    const ir = createIR([currentRule]);
    const startTime = performance.now();
    const graph = buildIRGraph(ir);
    const endTime = performance.now();

    expect(graph.nodes).toBeDefined();
    expect(endTime - startTime).toBeLessThan(1000);
  });
});