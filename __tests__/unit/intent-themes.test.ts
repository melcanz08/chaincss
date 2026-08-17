// ============================================================================
// FILE: __tests__/unit/intent-themes.test.ts (FIXED)
// ============================================================================

import { describe, it, expect, beforeAll } from "vitest";

// IMPORTANT: Import intent-resolver first to trigger setIntentCatalog()
import "../../src/compiler/pipeline/lowering/intent-resolver.js";
import { getIntentCatalog } from "../../src/compiler/pipeline/intent/intent-catalog.js";

beforeAll(() => {
  // Verify catalog is populated
  const catalog = getIntentCatalog();
  expect(Object.keys(catalog).length).toBeGreaterThan(0);
});

describe("Intent Themes & Variants (Phase 2)", () => {
  describe("Theme Support", () => {
    it("should have dark theme for card", () => {
      const catalog = getIntentCatalog();
      expect(catalog["card"]?.themes?.dark).toBeDefined();
      expect(catalog["card"]?.themes?.dark?.properties?.backgroundColor).toBe("#1e293b");
    });

    it("should have high-contrast theme for card", () => {
      const catalog = getIntentCatalog();
      expect(catalog["card"]?.themes?.["high-contrast"]).toBeDefined();
    });

    it("should have dark theme for glass", () => {
      const catalog = getIntentCatalog();
      expect(catalog["glass"]?.themes?.dark).toBeDefined();
    });

    it("should have dark theme for button-primary", () => {
      const catalog = getIntentCatalog();
      expect(catalog["button-primary"]?.themes?.dark).toBeDefined();
    });
  });

  describe("Variant Support", () => {
    it("should have premium variant for card", () => {
      const catalog = getIntentCatalog();
      expect(catalog["card"]?.variants?.premium).toBeDefined();
    });

    it("should have outlined variant for card", () => {
      const catalog = getIntentCatalog();
      expect(catalog["card"]?.variants?.outlined).toBeDefined();
    });

    it("premium variant should have gradient background", () => {
      const catalog = getIntentCatalog();
      const premium = catalog["card"]?.variants?.premium;
      expect(premium?.properties?.background).toContain("linear-gradient");
    });

    it("outlined variant should have border", () => {
      const catalog = getIntentCatalog();
      const outlined = catalog["card"]?.variants?.outlined;
      expect(outlined?.properties?.border).toContain("2px");
    });
  });

  describe("Combined Theme + Variant", () => {
    it("should support both theme and variant simultaneously", () => {
      const catalog = getIntentCatalog();
      const card = catalog["card"];
      expect(card?.themes?.dark).toBeDefined();
      expect(card?.variants?.premium).toBeDefined();
    });
  });
});
