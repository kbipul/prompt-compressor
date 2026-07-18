import { describe, it, expect } from "vitest";
import { wordDiff, removedShare } from "../diff";

describe("wordDiff", () => {
  it("marks identical text as entirely same", () => {
    const d = wordDiff("a b c", "a b c");
    expect(d.every((t) => t.op === "same")).toBe(true);
  });

  it("detects a removed word", () => {
    const d = wordDiff("please fix the bug", "fix the bug");
    const removed = d.filter((t) => t.op === "removed").map((t) => t.text).join("");
    expect(removed).toContain("please");
  });

  it("detects an added word", () => {
    const d = wordDiff("fix bug", "fix the bug");
    const added = d.filter((t) => t.op === "added").map((t) => t.text).join("");
    expect(added).toContain("the");
  });

  it("reconstructs the original from same+removed", () => {
    const before = "the quick brown fox jumps";
    const after = "quick fox jumps";
    const d = wordDiff(before, after);
    const rebuilt = d.filter((t) => t.op !== "added").map((t) => t.text).join("");
    expect(rebuilt).toBe(before);
  });

  it("reconstructs the compressed text from same+added", () => {
    const before = "the quick brown fox jumps";
    const after = "quick fox jumps";
    const d = wordDiff(before, after);
    const rebuilt = d.filter((t) => t.op !== "removed").map((t) => t.text).join("");
    expect(rebuilt).toBe(after);
  });

  it("merges adjacent runs of the same op", () => {
    const d = wordDiff("a b c", "a b c");
    expect(d).toHaveLength(1);
  });

  it("handles empty inputs", () => {
    expect(wordDiff("", "")).toEqual([]);
    expect(wordDiff("a", "").some((t) => t.op === "removed")).toBe(true);
  });
});

describe("removedShare", () => {
  it("is zero when nothing was removed", () => {
    expect(removedShare(wordDiff("a b c", "a b c"))).toBe(0);
  });

  it("is one when everything was removed", () => {
    expect(removedShare(wordDiff("a b c", ""))).toBe(1);
  });

  it("is between zero and one for a partial cut", () => {
    const s = removedShare(wordDiff("the quick brown fox", "quick fox"));
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
});
