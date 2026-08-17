// ============================================================================
// FILE: __tests__/unit/incremental/stateful-compiler.test.ts
// ============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { StatefulIncrementalCompiler } from "../../../src/compiler/incremental/stateful-compiler.js";
import { createPipeline } from "../../../src/compiler/pipeline/pipeline.js";
import type { StyleIR, IRRule } from "../../../src/compiler/pipeline/ir/types.js";

function createRule(
  id: string,
  selector: string,
  declarations: Array<{ property: string; value: string }> = [],
): IRRule {
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
    source: { file: "/test/styles.chain.ts", line: 1, column: 1 },
    history: [],
  };
}

function createTestIR(rules: IRRule[]): StyleIR {
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

describe("StatefulIncrementalCompiler", () => {
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
      generateRuleId: (filePath: string, stableName: string) => {
        return `${filePath}:${stableName}`;
      },
      rebuild: rebuildMock,
      initialIR,
    });
  }

  describe("update", () => {
    it("should handle style change incrementally", async () => {
      const oldRule = createRule("rule-1", ".button", [
        { property: "color", value: "red" },
      ]);
      const newRule = createRule("rule-1", ".button", [
        { property: "color", value: "blue" },
      ]);
      const unchangedRule = createRule("rule-2", ".card", [
        { property: "padding", value: "10px" },
      ]);

      const oldIR = createTestIR([oldRule, unchangedRule]);
      parseFileMock.mockResolvedValue(createTestIR([newRule, unchangedRule]));
      
      const compiler = createCompiler(oldIR);

      const result = await compiler.update({
        changedFiles: [{
          filePath: "/test/styles.chain.ts",
          kind: "style",
          source: "changed content",
        }],
      });

      expect(result.incremental.fullRebuild).toBe(false);
      expect(result.incremental.recompiledCount).toBeGreaterThan(0);
      expect(result.incremental.reusedCount).toBeGreaterThan(0);
    });

    it("should full rebuild on config change", async () => {
      const rule = createRule("rule-1", ".button", [
        { property: "color", value: "red" },
      ]);
      const ir = createTestIR([rule]);
      
      rebuildMock.mockResolvedValue(createTestIR([rule]));
      const compiler = createCompiler(ir);

      const result = await compiler.update({
        changedFiles: [{
          filePath: "/test/chaincss.config.ts",
          kind: "config",
          source: "config content",
        }],
      });

      expect(result.incremental.fullRebuild).toBe(true);
      expect(rebuildMock).toHaveBeenCalled();
    });

    it("should handle file deletion", async () => {
      const rule1 = createRule("rule-1", ".button", [
        { property: "color", value: "red" },
      ]);
      const rule2 = createRule("rule-2", ".card", [
        { property: "padding", value: "10px" },
      ]);

      const ir = createTestIR([rule1, rule2]);
      const compiler = createCompiler(ir);

      const result = await compiler.update({
        changedFiles: [],
        deletedFiles: ["/test/styles.chain.ts"],
      });

      expect(result.incremental.removedRules).toHaveLength(2);
      expect(result.incremental.totalRules).toBe(0);
    });

    it("should track compilation statistics", async () => {
      const rule = createRule("rule-1", ".button", [
        { property: "color", value: "red" },
      ]);
      const ir = createTestIR([rule]);
      
      parseFileMock.mockResolvedValue(createTestIR([rule]));
      const compiler = createCompiler(ir);

      await compiler.update({
        changedFiles: [{
          filePath: "/test/styles.chain.ts",
          kind: "style",
          source: "content",
        }],
      });

      const stats = compiler.getStats();
      expect(stats.compileCount).toBe(1);
      expect(stats.totalFiles).toBe(1);
    });
  });
});