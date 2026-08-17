// ============================================================================
// FILE: __tests__/unit/incremental/immutability.test.ts
// ============================================================================

import { describe, it, expect } from "vitest";
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

describe("IRUpdater Immutability", () => {
  it("should not mutate the original IR when updating files", async () => {
    const originalRule = createRule("rule-1", ".button", [
      { property: "color", value: "red" },
    ]);
    const originalIR = createIR([originalRule]);

    const updater = new IRUpdater({
      parseFile: async () => createIR([
        createRule("rule-1", ".button", [
          { property: "color", value: "blue" },
        ]),
      ]),
      generateRuleId: (filePath, stableName) => `gen-${stableName}`,
    });
    updater.indexIR(originalIR);

    const originalSnapshot = JSON.stringify(originalIR);

    await updater.updateFile(originalIR, {
      filePath: "/test/styles.chain.ts",
      source: "changed",
    });

    // Original IR should be unchanged
    expect(JSON.stringify(originalIR)).toBe(originalSnapshot);
    expect(originalRule.declarations[0].value).toBe("red");
  });

  it("should not mutate parser output", async () => {
    const parserRule = createRule("parser-rule", ".button", [
      { property: "color", value: "red" },
    ]);
    const parserIR = createIR([parserRule]);

    const updater = new IRUpdater({
      parseFile: async () => parserIR,
      generateRuleId: (filePath, stableName) => `gen-${stableName}`,
    });

    const currentIR = createIR([]);
    updater.indexIR(currentIR);

    const parserSnapshot = JSON.stringify(parserIR);

    await updater.addFile(currentIR, {
      filePath: "/test/new.chain.ts",
      source: "new file",
    });

    // Parser output should be unchanged
    expect(JSON.stringify(parserIR)).toBe(parserSnapshot);
  });
});