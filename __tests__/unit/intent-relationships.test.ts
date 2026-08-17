// ============================================================================
// FILE: __tests__/unit/intent-relationships.test.ts (EXPANDED)
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  validateIntentCombination,
  areIntentsCompatible,
  getCompatibleIntents,
  getConflictingIntents,
  getRequiredIntents,
  getEnhancementSuggestions,
} from "../../src/compiler/pipeline/intent/intent-validator.js";

describe("Intent Relationships - Expanded", () => {
  describe("Layout Intents", () => {
    it("should conflict stack with flex-row", () => {
      expect(areIntentsCompatible("stack", "flex-row")).toBe(false);
    });

    it("should conflict container with full-width", () => {
      expect(areIntentsCompatible("container", "full-width")).toBe(false);
    });

    it("should enhance stack with card", () => {
      expect(getEnhancementSuggestions("stack")).toContain("card");
    });
  });

  describe("Component Intents", () => {
    it("should require focus-ring for button-primary", () => {
      expect(getRequiredIntents("button-primary")).toContain("focus-ring");
    });

    it("should require elevated for modal", () => {
      const required = getRequiredIntents("modal");
      expect(required).toContain("elevated");
      expect(required).toContain("rounded");
    });

    it("should conflict badge with transparent", () => {
      expect(getConflictingIntents("badge")).toContain("transparent");
    });

    it("should enhance toast with glass", () => {
      expect(getEnhancementSuggestions("toast")).toContain("glass");
    });
  });

  describe("Interaction Intents", () => {
    it("should conflict disabled with clickable", () => {
      expect(areIntentsCompatible("disabled", "clickable")).toBe(false);
    });

    it("should conflict disabled with hover-lift", () => {
      expect(getConflictingIntents("disabled")).toContain("hover-lift");
    });

    it("should enhance clickable with hover-lift", () => {
      expect(getEnhancementSuggestions("clickable")).toContain("hover-lift");
    });
  });

  describe("Visual Intents", () => {
    it("should require rounded for glass", () => {
      expect(getRequiredIntents("glass")).toContain("rounded");
    });

    it("should conflict flat with elevated", () => {
      expect(areIntentsCompatible("flat", "elevated")).toBe(false);
    });
  });

  describe("Complex Combinations", () => {
    it("should validate card + glass + elevated", () => {
      const result = validateIntentCombination(["card", "glass", "elevated"]);
      expect(result.valid).toBe(true);
      // Should auto-add rounded (required by both card and glass)
      expect(result.resolvedIntents).toContain("rounded");
    });

    it("should detect too many combinations for card", () => {
      const result = validateIntentCombination([
        "card", "glass", "elevated", "hover-lift", "gradient", "bordered",
      ]);
      expect(result.valid).toBe(false);
    });

    it("should handle modal with center-content and spacious", () => {
      const result = validateIntentCombination([
        "modal", "center-content", "spacious",
      ]);
      expect(result.valid).toBe(true);
      // Auto-adds elevated and rounded (required by modal)
      expect(result.resolvedIntents).toContain("elevated");
      expect(result.resolvedIntents).toContain("rounded");
    });
  });

  describe("Edge Cases", () => {
    it("should handle unknown intents gracefully", () => {
      const result = validateIntentCombination(["unknown-intent"]);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Unknown intent: "unknown-intent"');
    });

    it("should handle empty requires", () => {
      expect(getRequiredIntents("divider")).toHaveLength(0);
    });

    it("should handle multi-level requirements", () => {
      // card requires rounded, rounded enhances glass
      const result = validateIntentCombination(["card"]);
      expect(result.resolvedIntents).toContain("rounded");
      expect(result.suggestions).toContain("glass");
    });
  });
});