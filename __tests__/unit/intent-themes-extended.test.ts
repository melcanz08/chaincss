import { describe, it, expect, beforeAll } from "vitest";
import "../../src/compiler/pipeline/lowering/intent-resolver.js";
import { getIntentCatalog } from "../../src/compiler/pipeline/intent/intent-catalog.js";

describe("Extended Themes & Variants", () => {
  it("should have dark theme for button-secondary", () => {
    const catalog = getIntentCatalog();
    expect(catalog["button-secondary"]?.themes?.dark).toBeDefined();
  });

  it("should have dark theme for input-field", () => {
    const catalog = getIntentCatalog();
    expect(catalog["input-field"]?.themes?.dark).toBeDefined();
  });

  it("should have dark theme for modal", () => {
    const catalog = getIntentCatalog();
    expect(catalog["modal"]?.themes?.dark).toBeDefined();
  });

  it("should have fullscreen variant for modal", () => {
    const catalog = getIntentCatalog();
    expect(catalog["modal"]?.variants?.fullscreen).toBeDefined();
  });

  it("should have dark theme for sticky-header", () => {
    const catalog = getIntentCatalog();
    expect(catalog["sticky-header"]?.themes?.dark).toBeDefined();
  });

  it("should have success variant for badge", () => {
    const catalog = getIntentCatalog();
    expect(catalog["badge"]?.variants?.success).toBeDefined();
  });

  it("should have danger variant for badge", () => {
    const catalog = getIntentCatalog();
    expect(catalog["badge"]?.variants?.danger).toBeDefined();
  });

  it("should have success variant for banner", () => {
    const catalog = getIntentCatalog();
    expect(catalog["banner"]?.variants?.success).toBeDefined();
  });

  it("should have success variant for toast", () => {
    const catalog = getIntentCatalog();
    expect(catalog["toast"]?.variants?.success).toBeDefined();
  });
});
