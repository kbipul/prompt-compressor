import { describe, it, expect } from "vitest";
import { segment, reassemble, composition } from "../segment";

describe("segment", () => {
  it("returns nothing for empty input", () => {
    expect(segment("")).toEqual([]);
  });

  it("treats plain text as compressible prose", () => {
    const segs = segment("Please fix the bug.");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("prose");
    expect(segs[0].protected).toBe(false);
  });

  it("protects fenced code blocks", () => {
    const segs = segment("Some prose.\n```ts\nconst x = 1;\n```\nMore prose.");
    const code = segs.find((s) => s.kind === "code");
    expect(code).toBeDefined();
    expect(code!.protected).toBe(true);
    expect(code!.text).toContain("const x = 1;");
  });

  it("keeps prose inside a fence as code — it was quoted for a reason", () => {
    const segs = segment("```\nplease just simply do the thing\n```");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("code");
    expect(segs[0].protected).toBe(true);
  });

  it("treats an unterminated fence as code rather than silently rewording it", () => {
    const segs = segment("intro\n```ts\nconst a = 1;");
    const code = segs.find((s) => s.kind === "code");
    expect(code).toBeDefined();
    expect(code!.protected).toBe(true);
  });

  it("detects shell commands", () => {
    const segs = segment("$ npm ci");
    expect(segs[0].kind).toBe("command");
    expect(segs[0].protected).toBe(true);
  });

  it("detects stack traces and error lines", () => {
    const t = "TypeError: Cannot read properties of undefined\n    at refresh (src/a.ts:42:19)";
    const kinds = segment(t).map((s) => s.kind);
    expect(kinds).toContain("error");
  });

  it("detects bare urls and paths", () => {
    expect(segment("https://example.com/a/b")[0].kind).toBe("url");
    expect(segment("packages/auth/package.json")[0].kind).toBe("path");
  });

  it("merges consecutive lines of the same kind", () => {
    const segs = segment("line one\nline two\nline three");
    expect(segs).toHaveLength(1);
    expect(segs[0].text).toBe("line one\nline two\nline three");
  });

  it("round-trips losslessly through reassemble", () => {
    const text = "Prose here.\n```ts\nconst x = 1;\n```\n$ npm test\nMore prose.";
    expect(reassemble(segment(text))).toBe(text);
  });
});

describe("composition", () => {
  it("reports an all-prose text as fully compressible", () => {
    const c = composition(segment("just some words here"));
    expect(c.compressibleShare).toBe(1);
    expect(c.protectedChars).toBe(0);
  });

  it("reports an all-code text as not compressible at all", () => {
    const c = composition(segment("```\nconst x = 1;\n```"));
    expect(c.compressibleShare).toBe(0);
    expect(c.compressibleChars).toBe(0);
  });

  it("puts a mixed text strictly between the two extremes", () => {
    const c = composition(segment("Some prose here.\n```\nconst x = 1;\n```"));
    expect(c.compressibleShare).toBeGreaterThan(0);
    expect(c.compressibleShare).toBeLessThan(1);
  });

  it("handles empty input without dividing by zero", () => {
    const c = composition([]);
    expect(c.compressibleShare).toBe(0);
    expect(c.totalChars).toBe(0);
  });
});
