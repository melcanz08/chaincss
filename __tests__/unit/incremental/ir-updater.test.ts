// ============================================================================
// FILE: __tests__/unit/incremental/ir-updater.test.ts
// ============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { IRUpdater } from "../../../src/compiler/incremental/ir-updater.js";
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

describe("IRUpdater", () => {
  let updater: IRUpdater;

  beforeEach(() => {
    updater = new IRUpdater({
      parseFile: async () => createTestIR([]),
      generateRuleId: (filePath: string, stableName: string) => {
        return `generated-${stableName.replace(/[^a-zA-Z0-9]/g, "-")}`;
      },
    });
  });

  describe("updateFile", () => {
    it("should detect unchanged rules", async () => {
      const rule = createRule("rule-1", ".button", [
        { property: "color", value: "red" },
      ]);
      const ir = createTestIR([rule]);
      updater.indexIR(ir);

      const testUpdater = new IRUpdater({
        parseFile: async () => createTestIR([rule]),
        generateRuleId: (filePath, stableName) => `generated-${stableName}`,
      });
      testUpdater.indexIR(ir);

      const result = await testUpdater.updateFile(ir, {
        filePath: "/test/styles.chain.ts",
        source: "same content",
      });

      expect(result.addedRuleIds).toHaveLength(0);
      expect(result.removedRuleIds).toHaveLength(0);
      expect(result.changedRuleIds).toHaveLength(0);
    });

    it("should detect changed rules", async () => {
      const oldRule = createRule("rule-1", ".button", [
        { property: "color", value: "red" },
      ]);
      const newRule = createRule("rule-1", ".button", [
        { property: "color", value: "blue" },
      ]);
      const ir = createTestIR([oldRule]);

      const testUpdater = new IRUpdater({
        parseFile: async () => createTestIR([newRule]),
        generateRuleId: (filePath, stableName) => `generated-${stableName}`,
      });
      testUpdater.indexIR(ir);

      const result = await testUpdater.updateFile(ir, {
        filePath: "/test/styles.chain.ts",
        source: "changed content",
      });

      expect(result.addedRuleIds).toHaveLength(0);
      expect(result.removedRuleIds).toHaveLength(0);
      expect(result.changedRuleIds).toHaveLength(1);
      expect(result.changedRuleIds[0]).toBe("rule-1");
    });

    it("should preserve stable IDs across changes", async () => {
      const oldRule = createRule("stable-id-1", ".button", [
        { property: "color", value: "red" },
      ]);
      const newRule = createRule("temp-parser-id-999", ".button", [
        { property: "color", value: "blue" },
      ]);
      const ir = createTestIR([oldRule]);

      const testUpdater = new IRUpdater({
        parseFile: async () => createTestIR([newRule]),
        generateRuleId: (filePath, stableName) => `generated-${stableName}`,
      });
      testUpdater.indexIR(ir);

      const result = await testUpdater.updateFile(ir, {
        filePath: "/test/styles.chain.ts",
        source: "changed content",
      });

      expect(result.changedRuleIds).toHaveLength(1);
      expect(result.changedRuleIds[0]).toBe("stable-id-1");
    });

    it("should detect added rules", async () => {
      const oldRule = createRule("rule-1", ".button", [
        { property: "color", value: "red" },
      ]);
      const newRule1 = createRule("rule-1", ".button", [
        { property: "color", value: "red" },
      ]);
      const newRule2 = createRule("rule-2", ".card", [
        { property: "padding", value: "10px" },
      ]);
      const ir = createTestIR([oldRule]);

      const testUpdater = new IRUpdater({
        parseFile: async () => createTestIR([newRule1, newRule2]),
        generateRuleId: (filePath, stableName) => `generated-${stableName}`,
      });
      testUpdater.indexIR(ir);

      const result = await testUpdater.updateFile(ir, {
        filePath: "/test/styles.chain.ts",
        source: "added rule",
      });

      expect(result.addedRuleIds).toHaveLength(1);
      expect(result.removedRuleIds).toHaveLength(0);
      expect(result.changedRuleIds).toHaveLength(0);
    });

    it("should detect removed rules", async () => {
      const oldRule1 = createRule("rule-1", ".button", [
        { property: "color", value: "red" },
      ]);
      const oldRule2 = createRule("rule-2", ".card", [
        { property: "padding", value: "10px" },
      ]);
      const newRule1 = createRule("rule-1", ".button", [
        { property: "color", value: "red" },
      ]);
      const ir = createTestIR([oldRule1, oldRule2]);

      const testUpdater = new IRUpdater({
        parseFile: async () => createTestIR([newRule1]),
        generateRuleId: (filePath, stableName) => `generated-${stableName}`,
      });
      testUpdater.indexIR(ir);

      const result = await testUpdater.updateFile(ir, {
        filePath: "/test/styles.chain.ts",
        source: "removed rule",
      });

      expect(result.addedRuleIds).toHaveLength(0);
      expect(result.removedRuleIds).toHaveLength(1);
      expect(result.removedRuleIds[0]).toBe("rule-2");
    });
  });

  describe("addFile", () => {
    it("should add new file rules", async () => {
      const currentIR = createTestIR([]);
      const newRule = createRule("new-rule", ".new-component", [
        { property: "color", value: "green" },
      ]);

      const testUpdater = new IRUpdater({
        parseFile: async () => createTestIR([newRule]),
        generateRuleId: (filePath, stableName) => `generated-${stableName}`,
      });
      testUpdater.indexIR(currentIR);

      const result = await testUpdater.addFile(currentIR, {
        filePath: "/test/new-styles.chain.ts",
        source: "new file",
      });

      expect(result.addedRuleIds).toHaveLength(1);
      expect(result.ir.rules).toHaveLength(1);
    });
  });

  describe("removeFile", () => {
    it("should remove all rules from file", async () => {
      const rule1 = createRule("rule-1", ".button", [
        { property: "color", value: "red" },
      ]);
      const rule2 = createRule("rule-2", ".card", [
        { property: "padding", value: "10px" },
      ]);
      const ir = createTestIR([rule1, rule2]);
      updater.indexIR(ir);

      const result = updater.removeFile(ir, "/test/styles.chain.ts");

      expect(result.removedRuleIds).toHaveLength(2);
      expect(result.ir.rules).toHaveLength(0);
    });
  });
});