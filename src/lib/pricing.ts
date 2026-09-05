// Input pricing, July 2026. Compression only ever saves INPUT tokens, so output
// prices are deliberately absent — quoting them would inflate the saving.
//
// tokenMultiplier corrects o200k_base counts toward each vendor's real
// tokenizer. These are approximations from published behaviour, not exact; the
// UI says so, and every price is editable in the sheet below.

export interface Model {
  id: string;
  label: string;
  vendor: string;
  /** USD per 1M input tokens. */
  inputPerM: number;
  /** Multiply an o200k_base count to approximate this vendor's tokenizer. */
  tokenMultiplier: number;
  asOf: string;
}

export const MODELS: readonly Model[] = [
  { id: "gemini-3.5-pro", label: "Gemini 3.5 Pro", vendor: "Google", inputPerM: 1.25, tokenMultiplier: 1.0, asOf: "2026-07-17" },
  { id: "kimi-k3", label: "Kimi K3", vendor: "Moonshot", inputPerM: 3.0, tokenMultiplier: 1.05, asOf: "2026-07-16" },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", vendor: "OpenAI", inputPerM: 1.25, tokenMultiplier: 1.0, asOf: "2026-07-09" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", vendor: "Anthropic", inputPerM: 3.0, tokenMultiplier: 1.42, asOf: "2026-07-11" },
  { id: "grok-4.5", label: "Grok 4.5", vendor: "xAI", inputPerM: 3.0, tokenMultiplier: 1.08, asOf: "2026-07-08" },
] as const;

/** Cost in USD of sending `tokens` (o200k_base count) as input to `model`. */
export function inputCost(tokens: number, model: Model): number {
  return (tokens * model.tokenMultiplier * model.inputPerM) / 1_000_000;
}

/** Dollars saved per request, and per 1k requests — the number a budget owner feels. */
export function savings(
  originalTokens: number,
  compressedTokens: number,
  model: Model,
): { perRequest: number; perThousand: number } {
  const delta = inputCost(originalTokens, model) - inputCost(compressedTokens, model);
  return { perRequest: delta, perThousand: delta * 1000 };
}

export function formatUsd(v: number): string {
  if (v === 0) return "$0";
  if (Math.abs(v) < 0.01) return `$${v.toFixed(4)}`;
  if (Math.abs(v) < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}
