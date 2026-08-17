// ============================================================================
// FILE: __tests__/unit/incremental/graph-propagation.test.ts (FIXED)
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildIRGraph, findAffectedNodes } from "../../../src/compiler/incremental/graph-builder.js";
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
    id: "test",
    rules,
    meta: {
      version: "1.0",
      createdAt: Date.now(),
      sourceFiles: [],
      passCount: 0,
      passes: [],
      dirtyRules: 0,
      compiledAt: Date.now(),
    },
    diagnostics: [],
  };
}

describe("Dependency Propagation", () => {
  it("should find dependent rules when a token changes", () => {
    // Create rules with token references that buildIRGraph can detect
    const tokenRule = createRule("token-1", "$colors.primary");
    
    // These rules reference the token in their declarations
    const buttonRule = createRule("rule-1", ".button", [
      { property: "background-color", value: "$colors.primary" },
    ]);
    
    const cardRule = createRule("rule-2", ".card", [
      { property: "border-color", value: "$colors.primary" },
    ]);
    
    const navigationRule = createRule("rule-3", ".navigation", [
      { property: "color", value: "$colors.primary" },
    ]);
    
    const unrelatedRule = createRule("rule-4", ".footer", [
      { property: "color", value: "black" },
    ]);

    const ir = createIR([
      tokenRule,
      buttonRule,
      cardRule,
      navigationRule,
      unrelatedRule,
    ]);

    const graph = buildIRGraph(ir);
    
    // Find the token node ID
    const tokenNodeId = "token-colors.primary"; // Note: normalized from $colors.primary
    
    const affected = findAffectedNodes(graph, tokenNodeId);

    expect(affected).toContain("rule-1");
    expect(affected).toContain("rule-2");
    expect(affected).toContain("rule-3");
    expect(affected).not.toContain("rule-4");
  });

  it("should handle nested rule dependencies", () => {
    // Create parent rule with nested rules
    const parentRule = {
      ...createRule("parent-1", ".button"),
      nestedRules: [
        createRule("nested-1", "&:hover", [
          { property: "color", value: "red" },
        ]),
        createRule("nested-2", "&:focus", [
          { property: "color", value: "blue" },
        ]),
      ],
    };

    const ir = createIR([parentRule]);
    const graph = buildIRGraph(ir);

    // Parent should have nested rules as dependents
    const affected = findAffectedNodes(graph, "parent-1");

    expect(affected).toContain("nested-1");
    expect(affected).toContain("nested-2");
  });

  it("should find rules using specific token references", () => {
    const rules = [
      createRule("rule-1", ".primary-button", [
        { property: "background", value: "$colors.primary" },
      ]),
      createRule("rule-2", ".secondary-button", [
        { property: "background", value: "$colors.secondary" },
      ]),
      createRule("rule-3", ".text", [
        { property: "color", value: "$colors.primary" },
      ]),
    ];

    const ir = createIR(rules);
    const graph = buildIRGraph(ir);

    // Find rules using $colors.primary
    const affected = findAffectedNodes(graph, "token-colors.primary");

    expect(affected).toContain("rule-1");
    expect(affected).toContain("rule-3");
    expect(affected).not.toContain("rule-2");
  });
});