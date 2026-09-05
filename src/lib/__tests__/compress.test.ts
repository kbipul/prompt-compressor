import { describe, it, expect } from "vitest";
import { compress, compressAll, compressSegments } from "../compress";
import { segment } from "../segment";
import { SAMPLES, DEFAULT_SAMPLE } from "../samples";
import { STRATEGIES } from "../strategies";

const ALL_IDS = STRATEGIES.map((s) => s.id);

describe("compressSegments", () => {
  it("never rewrites a protected segment", () => {
    const segs = segment("Please just fix it.\n```ts\nconst please = 1; // just simply\n```");
    const out = compressSegments(segs, "caveman");
    const code = out.find((s) => s.kind === "code")!;
    const originalCode = segs.find((s) => s.kind === "code")!;
    expect(code.text).toBe(originalCode.text);
    expect(code.text).toContain("const please = 1; // just simply");
  });

  it("does rewrite prose segments", () => {
    const segs = segment("Please just fix it.");
    const out = compressSegments(segs, "caveman");
    expect(out[0].text).not.toBe(segs[0].text);
  });
});

describe("compress", () => {
  it("preserves a shell command byte-for-byte", () => {
    const r = compress("Run this for me please:\n$ npm ci --legacy-peer-deps", "caveman");
    expect(r.compressed).toContain("$ npm ci --legacy-peer-deps");
  });

  it("preserves a stack trace byte-for-byte", () => {
    const trace = "    at refreshSession (src/auth/session.ts:42:19)";
    const r = compress(`It is basically failing here:\n${trace}`, "caveman");
    expect(r.compressed).toContain(trace);
  });

  it("preserves urls and paths", () => {
    const r = compress("Please see:\nhttps://example.com/a\npackages/auth/package.json", "caveman");
    expect(r.compressed).toContain("https://example.com/a");
    expect(r.compressed).toContain("packages/auth/package.json");
  });

  it("saves tokens on prose-heavy text", () => {
    const r = compress(SAMPLES.find((s) => s.id === "chat-prose")!.text, "caveman");
    expect(r.tokensSaved).toBeGreaterThan(0);
    expect(r.savedShare).toBeGreaterThan(0);
  });

  it("saves nothing on pure code — the honest zero", () => {
    const r = compress("```ts\nconst x = 1;\nconst y = 2;\n```", "caveman");
    expect(r.tokensSaved).toBe(0);
    expect(r.savedShare).toBe(0);
    expect(r.compressed).toBe(r.original);
  });

  it("reports a lower total saving than prose-only saving on mixed text", () => {
    // This is the whole thesis: the advertised (prose) number overstates reality.
    const r = compress(DEFAULT_SAMPLE.text, "caveman");
    expect(r.composition.compressibleShare).toBeGreaterThan(0);
    expect(r.composition.compressibleShare).toBeLessThan(1);
    expect(r.proseSavedShare).toBeGreaterThan(r.savedShare);
  });

  it("never reports a negative saving", () => {
    for (const sample of SAMPLES) {
      for (const id of ALL_IDS) {
        const r = compress(sample.text, id);
        expect(r.tokensSaved).toBeGreaterThanOrEqual(0);
        expect(r.savedShare).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("handles empty input without NaN", () => {
    const r = compress("", "caveman");
    expect(r.savedShare).toBe(0);
    expect(r.proseSavedShare).toBe(0);
    expect(r.originalTokens).toBe(0);
  });

  it("orders strategies monotonically: caveman saves at least as much as whitespace", () => {
    const text = SAMPLES.find((s) => s.id === "chat-prose")!.text;
    const ws = compress(text, "whitespace").tokensSaved;
    const cave = compress(text, "caveman").tokensSaved;
    expect(cave).toBeGreaterThanOrEqual(ws);
  });
});

describe("compressAll", () => {
  it("returns one result per requested strategy, in order", () => {
    const results = compressAll(DEFAULT_SAMPLE.text, ALL_IDS);
    expect(results).toHaveLength(ALL_IDS.length);
    expect(results.map((r) => r.strategy)).toEqual(ALL_IDS);
  });
});
