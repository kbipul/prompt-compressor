// Thin wrapper around gpt-tokenizer (o200k_base — the modern OpenAI-style BPE).
// Every vendor's tokenizer differs slightly; pricing.ts corrects with a per-model
// multiplier. Isolating the dependency here keeps compress.ts pure and testable.
import { encode } from "gpt-tokenizer/encoding/o200k_base";

/** Count tokens in a string. Empty => 0. */
export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    return encode(text).length;
  } catch {
    // Defensive: never let a tokenizer edge case break the UI.
    return Math.ceil(text.length / 4);
  }
}

export const TOKENIZER_NAME = "o200k_base";
