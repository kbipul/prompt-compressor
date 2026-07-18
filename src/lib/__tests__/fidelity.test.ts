import { describe, it, expect } from "vitest";
import { cosine, fidelity } from "../fidelity";

// The embedding model is a 25MB network download, so these tests cover the pure
// maths and the short-circuits. The model path itself is exercised by the live
// demo — and is deliberately never on the critical path for first paint.

describe("cosine", () => {
  it("is 1 for identical vectors", () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("is -1 for opposed vectors", () => {
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  it("is scale invariant", () => {
    expect(cosine([1, 2], [2, 4])).toBeCloseTo(1, 10);
  });

  it("returns 0 on length mismatch or empty input", () => {
    expect(cosine([1, 2], [1])).toBe(0);
    expect(cosine([], [])).toBe(0);
  });

  it("returns 0 rather than NaN for a zero vector", () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe("fidelity short-circuits", () => {
  it("returns 1 for identical text without loading a model", async () => {
    await expect(fidelity("same text", "same text")).resolves.toBe(1);
  });

  it("returns 0 when the compressed side is empty", async () => {
    await expect(fidelity("some text", "   ")).resolves.toBe(0);
  });
});
