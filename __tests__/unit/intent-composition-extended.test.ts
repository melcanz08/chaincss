import { describe, it, expect, beforeAll } from "vitest";
import "../../src/compiler/pipeline/lowering/intent-resolver.js";
import { getIntentCatalog } from "../../src/compiler/pipeline/intent/intent-catalog.js";
import { resolveComposition } from "../../src/compiler/pipeline/intent/intent-composer.js";

beforeAll(() => {
  const catalog = getIntentCatalog();
  expect(Object.keys(catalog).length).toBeGreaterThan(0);
});

describe("Extended Composition Intents", () => {
  describe("premium-button", () => {
    it("should compose button-primary, elevated, hover-lift", () => {
      const result = resolveComposition("premium-button");
      expect(result.intents).toContain("button-primary");
      expect(result.intents).toContain("elevated");
      expect(result.intents).toContain("hover-lift");
    });

    it("dark theme should add glass", () => {
      const result = resolveComposition("premium-button", { theme: "dark" });
      expect(result.intents).toContain("glass");
    });

    it("light theme should not add glass", () => {
      const result = resolveComposition("premium-button", { theme: "light" });
      expect(result.intents).not.toContain("glass");
    });
  });

  describe("dark-card", () => {
    it("should compose card and bordered", () => {
      const result = resolveComposition("dark-card");
      expect(result.intents).toContain("card");
      expect(result.intents).toContain("bordered");
    });

    it("dark theme should add glass and remove elevated", () => {
      const result = resolveComposition("dark-card", { theme: "dark" });
      expect(result.intents).toContain("glass");
      expect(result.intents).not.toContain("elevated");
    });
  });

  describe("glass-panel", () => {
    it("should compose glass, bordered, spacious", () => {
      const result = resolveComposition("glass-panel");
      expect(result.intents).toContain("glass");
      expect(result.intents).toContain("bordered");
      expect(result.intents).toContain("spacious");
    });
  });

  describe("hero-banner", () => {
    it("should compose hero-section, gradient, center-content", () => {
      const result = resolveComposition("hero-banner");
      expect(result.intents).toContain("hero-section");
      expect(result.intents).toContain("gradient");
      expect(result.intents).toContain("center-content");
    });

    it("dark theme should add glass", () => {
      const result = resolveComposition("hero-banner", { theme: "dark" });
      expect(result.intents).toContain("glass");
    });
  });

  describe("modal-glass", () => {
    it("should compose modal, glass, elevated", () => {
      const result = resolveComposition("modal-glass");
      expect(result.intents).toContain("modal");
      expect(result.intents).toContain("glass");
      expect(result.intents).toContain("elevated");
    });
  });

  describe("input-group", () => {
    it("should compose input-field, bordered, compact", () => {
      const result = resolveComposition("input-group");
      expect(result.intents).toContain("input-field");
      expect(result.intents).toContain("bordered");
      expect(result.intents).toContain("compact");
    });
  });
});
