// Segmentation — the heart of the honest measurement.
//
// Every "cut your tokens by N%" claim is measured on chat-style prose. Real
// agent traffic is mostly code, diffs, shell commands, stack traces and exact
// error strings — content that MUST survive byte-for-byte or the message becomes
// useless. Any honest compressor leaves those alone, which means the headline
// percentage only ever applies to the prose fraction of your text.
//
// So before compressing anything we split the input into typed segments and mark
// which ones are compressible. The ratio of compressible to protected bytes is
// what turns an advertised number into your actual number.

export type SegmentKind =
  | "prose"
  | "code" // fenced ``` blocks and indented code
  | "command" // shell lines: $ npm ci, > git push
  | "error" // stack traces, "Error:", file:line:col
  | "url" // bare URLs
  | "path"; // bare file paths

export interface Segment {
  kind: SegmentKind;
  text: string;
  /** Compressible segments may be rewritten; protected ones are copied verbatim. */
  protected: boolean;
}

/** Only prose can be safely reworded. Everything else is load-bearing. */
export const COMPRESSIBLE: ReadonlySet<SegmentKind> = new Set<SegmentKind>(["prose"]);

const FENCE_RE = /^\s*(```|~~~)/;
const COMMAND_RE = /^\s*[$>]\s+\S/;
const ERROR_RE =
  /^\s*(?:at\s+\S+\s*\(|Traceback\b|Caused by:|[\w.]*(?:Error|Exception)\b\s*:|\S+\.\w{1,4}:\d+:\d+)/;
const INDENTED_CODE_RE = /^(?:\t| {4,})\S/;
const URL_ONLY_RE = /^\s*https?:\/\/\S+\s*$/i;
const PATH_ONLY_RE = /^\s*(?:\.{0,2}\/)?(?:[\w.-]+\/)+[\w.-]+\s*$/;

function classifyLine(line: string): SegmentKind {
  if (!line.trim()) return "prose";
  if (COMMAND_RE.test(line)) return "command";
  if (ERROR_RE.test(line)) return "error";
  if (URL_ONLY_RE.test(line)) return "url";
  if (PATH_ONLY_RE.test(line)) return "path";
  if (INDENTED_CODE_RE.test(line)) return "code";
  return "prose";
}

/**
 * Split text into typed segments.
 *
 * Fenced code blocks win over everything (a ``` block containing prose is still
 * code — it was quoted for a reason). Outside fences we classify line by line and
 * merge runs of the same kind so the segment list stays readable.
 */
export function segment(text: string): Segment[] {
  if (!text) return [];

  const lines = text.split("\n");
  const segments: Segment[] = [];
  let buffer: string[] = [];
  let bufferKind: SegmentKind | null = null;
  let inFence = false;

  const flush = () => {
    if (bufferKind !== null && buffer.length) {
      segments.push({
        kind: bufferKind,
        text: buffer.join("\n"),
        protected: !COMPRESSIBLE.has(bufferKind),
      });
    }
    buffer = [];
    bufferKind = null;
  };

  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      if (!inFence) {
        flush();
        inFence = true;
        bufferKind = "code";
        buffer.push(line);
      } else {
        buffer.push(line);
        inFence = false;
        flush();
      }
      continue;
    }

    if (inFence) {
      buffer.push(line);
      continue;
    }

    const kind = classifyLine(line);
    if (bufferKind === null || kind === bufferKind) {
      bufferKind = kind;
      buffer.push(line);
    } else {
      flush();
      bufferKind = kind;
      buffer.push(line);
    }
  }

  // An unterminated fence is still code — never silently reword it.
  flush();

  return segments.filter((s) => s.text.length > 0);
}

/** Reassemble segments into a single string, preserving the newline joins. */
export function reassemble(segments: Segment[]): string {
  return segments.map((s) => s.text).join("\n");
}

export interface Composition {
  byKind: Record<SegmentKind, number>;
  compressibleChars: number;
  protectedChars: number;
  totalChars: number;
  /** 0..1 — the share of the text any compressor is even allowed to touch. */
  compressibleShare: number;
}

/**
 * How much of this text is eligible for compression at all?
 *
 * This is the number that collapses an advertised 65% into a single-digit saving
 * on agentic traffic — and it is knowable before you compress anything.
 */
export function composition(segments: Segment[]): Composition {
  const byKind: Record<SegmentKind, number> = {
    prose: 0,
    code: 0,
    command: 0,
    error: 0,
    url: 0,
    path: 0,
  };

  let compressibleChars = 0;
  let protectedChars = 0;

  for (const s of segments) {
    byKind[s.kind] += s.text.length;
    if (s.protected) protectedChars += s.text.length;
    else compressibleChars += s.text.length;
  }

  const totalChars = compressibleChars + protectedChars;
  return {
    byKind,
    compressibleChars,
    protectedChars,
    totalChars,
    compressibleShare: totalChars === 0 ? 0 : compressibleChars / totalChars,
  };
}

export const KIND_LABEL: Record<SegmentKind, string> = {
  prose: "Prose",
  code: "Code block",
  command: "Shell command",
  error: "Error / trace",
  url: "URL",
  path: "File path",
};
