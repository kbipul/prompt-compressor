// A minimal word-level LCS diff, so "what got lost" is shown rather than claimed.
// Small enough to keep in-repo (no dependency) and fast enough for prompt-sized
// input; the O(n*m) table is fine for the few-thousand-token texts this tool targets.

export type DiffOp = "same" | "removed" | "added";

export interface DiffToken {
  op: DiffOp;
  text: string;
}

const MAX_TOKENS = 4000; // guard the quadratic table on pathological input

function tokenize(s: string): string[] {
  return s.split(/(\s+)/).filter((t) => t.length > 0);
}

export function wordDiff(before: string, after: string): DiffToken[] {
  const a = tokenize(before);
  const b = tokenize(after);

  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    return [
      { op: "removed", text: before },
      { op: "added", text: after },
    ];
  }

  // LCS length table
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ op: "same", text: a[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      out.push({ op: "removed", text: a[i] });
      i++;
    } else {
      out.push({ op: "added", text: b[j] });
      j++;
    }
  }
  while (i < a.length) out.push({ op: "removed", text: a[i++] });
  while (j < b.length) out.push({ op: "added", text: b[j++] });

  // Merge adjacent same-op runs so the rendered output isn't one span per word.
  const merged: DiffToken[] = [];
  for (const t of out) {
    const last = merged[merged.length - 1];
    if (last && last.op === t.op) last.text += t.text;
    else merged.push({ ...t });
  }
  return merged;
}

/** Share of original words dropped outright (0..1) — a crude but honest loss proxy. */
export function removedShare(diff: readonly DiffToken[]): number {
  let removed = 0;
  let total = 0;
  for (const t of diff) {
    const words = t.text.trim() ? t.text.trim().split(/\s+/).length : 0;
    if (t.op === "removed") {
      removed += words;
      total += words;
    } else if (t.op === "same") {
      total += words;
    }
  }
  return total === 0 ? 0 : removed / total;
}
