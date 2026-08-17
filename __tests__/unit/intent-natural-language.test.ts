import { describe, it, expect } from "vitest";
import "../../src/compiler/pipeline/lowering/intent-resolver.js";
import { parseDescription } from "../../src/compiler/pipeline/intent/semantic-intent-parser.js";

describe("Phase 4 — Natural Language Intents", () => {
  it("parses 'glass card'", () => {
    const r = parseDescription("glass card");
    expect(r.intents).toContain("glass-card");
  });

  it("parses 'frosted elevated card'", () => {
    const r = parseDescription("frosted elevated card");
    expect(r.intents).toContain("glass");
    expect(r.intents).toContain("elevated");
    expect(r.intents).toContain("card");
  });

  it("parses 'dark premium card'", () => {
    const r = parseDescription("dark premium card");
    expect(r.intents).toContain("premium-card");
    expect(r.theme).toBe("dark");
  });

  it("parses 'high contrast button'", () => {
    const r = parseDescription("high contrast button");
    expect(r.theme).toBe("high-contrast");
    expect(r.intents).toContain("button-primary");
  });

  it("parses 'spacious centered modal'", () => {
    const r = parseDescription("spacious centered modal");
    expect(r.intents).toContain("spacious");
    expect(r.intents).toContain("center-content");
    expect(r.intents).toContain("modal");
  });

  it("parses 'glass panel with rounded corners'", () => {
    const r = parseDescription("glass panel with rounded corners");
    expect(r.intents).toContain("glass-panel");
    expect(r.intents).toContain("rounded");
  });

  it("detects theme from 'dark card'", () => {
    const r = parseDescription("dark card");
    expect(r.theme).toBe("dark");
  });

  it("detects variant from 'premium button'", () => {
    const r = parseDescription("premium button");
    expect(r.intents).toContain("premium-button");
  });
});