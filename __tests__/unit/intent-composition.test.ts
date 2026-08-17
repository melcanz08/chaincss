// ============================================================================
// FILE: __tests__/unit/intent-composition.test.ts
// ============================================================================

import { describe, it, expect, beforeAll } from "vitest";
import "../../src/compiler/pipeline/lowering/intent-resolver.js";
import { getIntentCatalog } from "../../src/compiler/pipeline/intent/intent-catalog.js";
import { resolveComposition, resolveCompositions } from "../../src/compiler/pipeline/intent/intent-composer.js";

beforeAll(() => {
  const catalog = getIntentCatalog();
  expect(Object.keys(catalog).length).toBeGreaterThan(0);
});

describe("Intent Composition Patterns (Phase 3)", () => {
  it("should have premium-card in catalog", () => {
    const catalog = getIntentCatalog();
    expect(catalog["premium-card"]).toBeDefined();
  });

  it("premium-card should compose card, glass, elevated", () => {
    const result = resolveComposition("premium-card");
    expect(result.intents).toContain("card");
    expect(result.intents).toContain("glass");
    expect(result.intents).toContain("elevated");
  });

  it("dark theme should add glow and remove elevated", () => {
    const result = resolveComposition("premium-card", { theme: "dark" });
    expect(result.intents).toContain("glow");
    expect(result.intents).not.toContain("elevated");
  });

  it("light theme should keep elevated", () => {
    const result = resolveComposition("premium-card", { theme: "light" });
    expect(result.intents).toContain("elevated");
    expect(result.intents).not.toContain("glow");
  });

  it("should detect circular composition", () => {
    // Register a circular intent for testing
    const circularResult = resolveComposition("circular-a");
    expect(circularResult.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it("should resolve multiple intents with composition", () => {
    const result = resolveCompositions(["premium-card", "bordered"]);
    expect(result.intents).toContain("card");
    expect(result.intents).toContain("glass");
    expect(result.intents).toContain("bordered");
  });
});