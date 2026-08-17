// __tests__/unit/intent-natural-language-polish.test.ts

import { describe, it, expect } from "vitest";
import { parseDescription } from "../../src/compiler/pipeline/intent/semantic-intent-parser.js";

describe("Phase 4 — parser polish", () => {
  it("ignores stop words", () => {
    const r = parseDescription("a simple card with rounded corners");
    expect(r.intents).toContain("card");
    expect(r.intents).toContain("rounded");
    expect(r.ignoredStopWords.length).toBeGreaterThan(0);
  });

  it("falls back from unknown adjective to known noun", () => {
    const r = parseDescription("modern card");
    expect(r.intents).toContain("card");
  });

  it("maps btn alias", () => {
    const r = parseDescription("btn");
    expect(r.intents).toContain("button-primary");
  });

  it("does not include stop words in unmatched", () => {
    const r = parseDescription("use a dark card");
    expect(r.unmatchedWords).not.toContain("use");
    expect(r.unmatchedWords).not.toContain("a");
    expect(r.theme).toBe("dark");
  });
});