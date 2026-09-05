// Compression strategies, weakest to most aggressive.
//
// Each is a pure string -> string transform applied ONLY to prose segments.
// They are deliberately deterministic and rule-based: an LLM-based compressor
// would need an API key and would make the fidelity measurement circular (you'd
// be asking a model to grade its own rewrite).
//
// The caveman strategy is a faithful reimplementation of the register that
// JuliusBrussee/caveman asks the model to adopt — drop articles, drop copulas,
// drop hedges, keep the content words — rebuilt from the described behaviour
// rather than copied from the repo.

export type StrategyId = "whitespace" | "hedges" | "abbreviate" | "caveman";

export interface Strategy {
  id: StrategyId;
  name: string;
  blurb: string;
  /** Rough guide for the UI: does this strategy change meaning-bearing words? */
  lossy: boolean;
  apply: (prose: string) => string;
}

/** Collapse runs of whitespace and blank lines. Losslessly reversible in meaning. */
function whitespace(prose: string): string {
  return prose
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

// Filler that carries no instruction: politeness, hedging, throat-clearing.
const HEDGE_PATTERNS: RegExp[] = [
  /\b(?:please|kindly)\b/gi,
  /\b(?:just|simply|really|very|quite|actually|basically|essentially|literally)\b/gi,
  /\b(?:i think|i believe|i would like you to|i'd like you to|i want you to|could you|can you|would you)\b/gi,
  /\b(?:it (?:is|'s) important to note that|note that|keep in mind that|bear in mind that)\b/gi,
  /\b(?:in order to)\b/gi,
  /\b(?:as you (?:can see|know)|obviously|of course)\b/gi,
  /\b(?:make sure (?:to|that you)|be sure to)\b/gi,
];

function hedges(prose: string): string {
  let out = prose;
  for (const re of HEDGE_PATTERNS) out = out.replace(re, "");
  // "in order to" -> "to" reads better than deleting it outright.
  out = out.replace(/\s{2,}/g, " ");
  return whitespace(out).replace(/^\s*[,;]\s*/gm, "");
}

const ABBREVIATIONS: ReadonlyArray<[RegExp, string]> = [
  [/\bfor example\b/gi, "e.g."],
  [/\bthat is\b/gi, "i.e."],
  [/\band so on\b/gi, "etc."],
  [/\bwith respect to\b/gi, "re"],
  [/\bwith regard to\b/gi, "re"],
  [/\bas soon as possible\b/gi, "ASAP"],
  [/\bdocumentation\b/gi, "docs"],
  [/\brepository\b/gi, "repo"],
  [/\bconfiguration\b/gi, "config"],
  [/\bdirectory\b/gi, "dir"],
  [/\benvironment\b/gi, "env"],
  [/\bapplication\b/gi, "app"],
  [/\bfunction\b/gi, "fn"],
  [/\bparameter(s)?\b/gi, "param$1"],
  [/\bimplementation\b/gi, "impl"],
  [/\bperformance\b/gi, "perf"],
  [/\bdatabase\b/gi, "db"],
  [/\brequirements?\b/gi, "reqs"],
  [/\bapproximately\b/gi, "~"],
  [/\bnumber of\b/gi, "n of"],
];

function abbreviate(prose: string): string {
  let out = hedges(prose);
  for (const [re, rep] of ABBREVIATIONS) out = out.replace(re, rep);
  return whitespace(out);
}

// Caveman register: articles, copulas, auxiliaries, and most prepositions go.
const CAVEMAN_STOPWORDS = new Set([
  "a", "an", "the",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "do", "does", "did", "doing",
  "have", "has", "had", "having",
  "will", "would", "shall", "should", "may", "might", "must",
  "of", "to", "in", "on", "at", "by", "for", "with", "from", "into", "onto",
  "about", "as", "that", "this", "these", "those", "there", "here",
  "and", "or", "but", "so", "then", "than",
  "it", "its", "we", "you", "your", "our", "i", "my", "me", "us",
  "if", "when", "while", "which", "who", "whom",
]);

function caveman(prose: string): string {
  const base = abbreviate(prose);
  return base
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;
      const kept = line
        .split(/(\s+)/)
        .filter((tok) => {
          if (!tok.trim()) return true; // keep the spacing tokens
          const bare = tok.replace(/[^\w'-]/g, "").toLowerCase();
          if (!bare) return true; // pure punctuation — keep, it delimits
          return !CAVEMAN_STOPWORDS.has(bare);
        })
        .join("");
      return kept.replace(/\s{2,}/g, " ").trim();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export const STRATEGIES: readonly Strategy[] = [
  {
    id: "whitespace",
    name: "Tidy whitespace",
    blurb: "Collapse repeated spaces and blank lines. Nothing meaning-bearing is touched.",
    lossy: false,
    apply: whitespace,
  },
  {
    id: "hedges",
    name: "Drop hedges & politeness",
    blurb: "Remove please/just/actually and 'I would like you to' throat-clearing.",
    lossy: false,
    apply: hedges,
  },
  {
    id: "abbreviate",
    name: "Abbreviate",
    blurb: "Hedges plus a domain abbreviation pass: repository→repo, configuration→config.",
    lossy: true,
    apply: abbreviate,
  },
  {
    id: "caveman",
    name: "Caveman",
    blurb: "Strip articles, copulas and most function words. Keep content words only.",
    lossy: true,
    apply: caveman,
  },
] as const;

export function getStrategy(id: StrategyId): Strategy {
  const s = STRATEGIES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown strategy: ${id}`);
  return s;
}
