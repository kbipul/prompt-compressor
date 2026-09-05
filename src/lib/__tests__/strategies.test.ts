import { describe, it, expect } from "vitest";
import { STRATEGIES, getStrategy } from "../strategies";

describe("strategies", () => {
  it("exposes a stable set with unique ids", () => {
    const ids = STRATEGIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("caveman");
  });

  it("throws on an unknown id", () => {
    // @ts-expect-error deliberately invalid
    expect(() => getStrategy("nope")).toThrow();
  });

  it("every strategy is idempotent enough to not grow the text", () => {
    const input = "Please could you just simply update the configuration for the repository.";
    for (const s of STRATEGIES) {
      expect(s.apply(input).length).toBeLessThanOrEqual(input.length);
    }
  });

  it("every strategy leaves empty input empty", () => {
    for (const s of STRATEGIES) expect(s.apply("").trim()).toBe("");
  });
});

describe("whitespace", () => {
  const w = getStrategy("whitespace");

  it("collapses runs of spaces", () => {
    expect(w.apply("a     b")).toBe("a b");
  });

  it("collapses three or more newlines to a paragraph break", () => {
    expect(w.apply("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("keeps the words themselves", () => {
    expect(w.apply("keep   every    word")).toBe("keep every word");
  });
});

describe("hedges", () => {
  const h = getStrategy("hedges");

  it("removes politeness and filler", () => {
    const out = h.apply("Please just simply fix the bug.");
    expect(out).not.toMatch(/please/i);
    expect(out).not.toMatch(/simply/i);
    expect(out.toLowerCase()).toContain("fix");
    expect(out.toLowerCase()).toContain("bug");
  });

  it("removes throat-clearing phrases", () => {
    const out = h.apply("I would like you to review this.");
    expect(out.toLowerCase()).not.toContain("i would like you to");
    expect(out.toLowerCase()).toContain("review");
  });

  it("keeps content words intact", () => {
    const out = h.apply("Please update the authentication module.");
    expect(out).toContain("authentication");
    expect(out).toContain("module");
  });
});

describe("abbreviate", () => {
  const a = getStrategy("abbreviate");

  it("shortens known domain terms", () => {
    const out = a.apply("Update the configuration in the repository documentation.");
    expect(out).toContain("config");
    expect(out).toContain("repo");
    expect(out).toContain("docs");
  });

  it("still applies the hedge pass", () => {
    expect(a.apply("Please update the configuration.")).not.toMatch(/please/i);
  });
});

describe("caveman", () => {
  const c = getStrategy("caveman");

  it("strips articles and copulas", () => {
    const out = c.apply("The bug is in the parser.");
    expect(out.toLowerCase()).not.toMatch(/\bthe\b/);
    expect(out.toLowerCase()).not.toMatch(/\bis\b/);
    expect(out.toLowerCase()).toContain("bug");
    expect(out.toLowerCase()).toContain("parser");
  });

  it("keeps content words", () => {
    const out = c.apply("You should refactor the authentication handler.");
    expect(out.toLowerCase()).toContain("refactor");
    expect(out.toLowerCase()).toContain("authentication");
    expect(out.toLowerCase()).toContain("handler");
  });

  it("compresses harder than the gentler strategies", () => {
    const input =
      "I would like you to please take a look at the configuration that is in the repository.";
    const caveLen = c.apply(input).length;
    expect(caveLen).toBeLessThan(getStrategy("hedges").apply(input).length);
    expect(caveLen).toBeLessThan(input.length);
  });

  it("does not choke on punctuation-only tokens", () => {
    expect(() => c.apply("a — b … c")).not.toThrow();
  });
});
