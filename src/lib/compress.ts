// Orchestration: segment -> compress prose only -> reassemble -> measure.
//
// The one rule that makes the whole tool honest: protected segments are copied
// through byte-for-byte. Every saving reported here is a saving a real compressor
// could actually achieve without corrupting code, commands or error strings.

import { countTokens } from "./tokenizer";
import { segment, reassemble, composition, type Segment, type Composition } from "./segment";
import { getStrategy, type StrategyId } from "./strategies";

export interface CompressionResult {
  strategy: StrategyId;
  original: string;
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  tokensSaved: number;
  /** 0..1 of TOTAL tokens — the number that matters. */
  savedShare: number;
  /** 0..1 measured against the prose fraction only — the number vendors quote. */
  proseSavedShare: number;
  composition: Composition;
  segments: Segment[];
}

/** Apply a strategy to prose segments only, leaving protected ones untouched. */
export function compressSegments(segments: Segment[], strategy: StrategyId): Segment[] {
  const { apply } = getStrategy(strategy);
  return segments.map((s) =>
    s.protected ? s : { ...s, text: apply(s.text) },
  );
}

export function compress(text: string, strategy: StrategyId): CompressionResult {
  const segments = segment(text);
  const comp = composition(segments);
  const compressedSegments = compressSegments(segments, strategy);
  const compressed = reassemble(compressedSegments);

  const originalTokens = countTokens(text);
  const compressedTokens = countTokens(compressed);
  const tokensSaved = Math.max(0, originalTokens - compressedTokens);

  // Prose-only view: what the same strategy achieves if you ignore everything
  // it is not allowed to touch. This is the apples-to-apples number against a
  // vendor's chat-prose benchmark.
  const proseOriginal = segments.filter((s) => !s.protected).map((s) => s.text).join("\n");
  const proseCompressed = compressedSegments.filter((s) => !s.protected).map((s) => s.text).join("\n");
  const proseOriginalTokens = countTokens(proseOriginal);
  const proseCompressedTokens = countTokens(proseCompressed);

  return {
    strategy,
    original: text,
    compressed,
    originalTokens,
    compressedTokens,
    tokensSaved,
    savedShare: originalTokens === 0 ? 0 : tokensSaved / originalTokens,
    proseSavedShare:
      proseOriginalTokens === 0
        ? 0
        : Math.max(0, proseOriginalTokens - proseCompressedTokens) / proseOriginalTokens,
    composition: comp,
    segments,
  };
}

/** Run every strategy over the same text — the trade-off curve. */
export function compressAll(text: string, strategies: readonly StrategyId[]): CompressionResult[] {
  return strategies.map((s) => compress(text, s));
}
