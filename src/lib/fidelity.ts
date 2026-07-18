// Fidelity measurement — does the compressed text still mean the same thing?
//
// Token savings are trivial to measure and easy to brag about. The interesting
// number is what you paid for them. We embed the original and the compressed
// prose with a small sentence-transformer running in the browser and report the
// cosine similarity between them.
//
// This is deliberately a PROGRESSIVE ENHANCEMENT: the model is ~25MB and loads
// on demand, so the token/cost half of the tool is instant and works offline
// forever. Nothing here blocks first paint.
//
// Honest caveat, stated in the UI too: embedding similarity measures topical
// drift, not instruction fidelity. A compressed prompt that keeps every noun but
// inverts "don't" scores well here and would still ruin your day. It is a useful
// signal, not a proof.

import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

// transformers.js types every task variant into one giant overload union, which
// TS2590s when inferred at this call site. Narrowing the factory to the single
// task we use keeps the public API of this module fully typed.
type PipelineFactory = (
  task: "feature-extraction",
  model: string,
  opts: { progress_callback?: (p: { status: string; progress?: number }) => void },
) => Promise<FeatureExtractionPipeline>;

export function loadExtractor(
  onProgress?: (p: { status: string; progress?: number }) => void,
): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = (pipeline as unknown as PipelineFactory)(
      "feature-extraction",
      EMBED_MODEL,
      { progress_callback: onProgress },
    );
  }
  return extractorPromise;
}

/** Reset memoised state — tests only. */
export function _resetExtractor(): void {
  extractorPromise = null;
}

export function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

async function embed(extractor: FeatureExtractionPipeline, text: string): Promise<number[]> {
  const out = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}

/**
 * Cosine similarity between original and compressed text, 0..1.
 * Identical strings short-circuit to 1 (and skip the model entirely).
 */
export async function fidelity(
  original: string,
  compressed: string,
  onProgress?: (p: { status: string; progress?: number }) => void,
): Promise<number> {
  if (original === compressed) return 1;
  if (!original.trim() || !compressed.trim()) return 0;
  const extractor = await loadExtractor(onProgress);
  const [a, b] = await Promise.all([embed(extractor, original), embed(extractor, compressed)]);
  return Math.max(0, Math.min(1, cosine(a, b)));
}
