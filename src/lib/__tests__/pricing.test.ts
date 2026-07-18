import { describe, it, expect } from "vitest";
import { MODELS, inputCost, savings, formatUsd } from "../pricing";

describe("MODELS", () => {
  it("has unique ids and sane prices", () => {
    const ids = MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MODELS) {
      expect(m.inputPerM).toBeGreaterThan(0);
      expect(m.tokenMultiplier).toBeGreaterThan(0);
      expect(m.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("inputCost", () => {
  it("is zero for zero tokens", () => {
    expect(inputCost(0, MODELS[0])).toBe(0);
  });

  it("scales linearly with tokens", () => {
    const m = MODELS[0];
    expect(inputCost(2000, m)).toBeCloseTo(2 * inputCost(1000, m), 10);
  });

  it("applies the tokenizer multiplier", () => {
    const sonnet = MODELS.find((m) => m.id === "claude-sonnet-5")!;
    const plain = { ...sonnet, tokenMultiplier: 1 };
    expect(inputCost(1000, sonnet)).toBeGreaterThan(inputCost(1000, plain));
  });
});

describe("savings", () => {
  it("is zero when nothing was compressed", () => {
    expect(savings(1000, 1000, MODELS[0]).perRequest).toBe(0);
  });

  it("is positive when tokens went down", () => {
    expect(savings(1000, 600, MODELS[0]).perRequest).toBeGreaterThan(0);
  });

  it("scales perThousand as 1000x perRequest", () => {
    const s = savings(1000, 600, MODELS[0]);
    expect(s.perThousand).toBeCloseTo(s.perRequest * 1000, 10);
  });
});

describe("formatUsd", () => {
  it("formats zero plainly", () => {
    expect(formatUsd(0)).toBe("$0");
  });

  it("keeps precision on tiny amounts", () => {
    expect(formatUsd(0.0001234)).toBe("$0.0001");
  });

  it("uses two decimals on dollar amounts", () => {
    expect(formatUsd(12.345)).toBe("$12.35");
  });
});
