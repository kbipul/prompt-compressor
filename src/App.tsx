import { useMemo, useState, useCallback } from "react";
import { compressAll, type CompressionResult } from "./lib/compress";
import { STRATEGIES, type StrategyId } from "./lib/strategies";
import { MODELS, savings, formatUsd } from "./lib/pricing";
import { SAMPLES, DEFAULT_SAMPLE } from "./lib/samples";
import { KIND_LABEL, type SegmentKind } from "./lib/segment";
import { wordDiff } from "./lib/diff";
import { fidelity, EMBED_MODEL } from "./lib/fidelity";
import { TOKENIZER_NAME } from "./lib/tokenizer";

const ALL_IDS = STRATEGIES.map((s) => s.id);
const KIND_ORDER: SegmentKind[] = ["prose", "code", "command", "error", "url", "path"];

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

type FidelityState = Record<string, number | "loading" | undefined>;

export default function App() {
  const [text, setText] = useState(DEFAULT_SAMPLE.text);
  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE.id);
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [focus, setFocus] = useState<StrategyId>("caveman");
  const [fid, setFid] = useState<FidelityState>({});
  const [fidProgress, setFidProgress] = useState<string | null>(null);
  const [fidError, setFidError] = useState<string | null>(null);

  const results = useMemo(() => compressAll(text, ALL_IDS), [text]);
  const model = MODELS.find((m) => m.id === modelId)!;
  const focused = results.find((r) => r.strategy === focus)!;
  const comp = focused.composition;

  const loadSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setSampleId(id);
    setText(s.text);
    setFid({});
    setFidError(null);
  };

  const onEdit = (v: string) => {
    setText(v);
    setSampleId("custom");
    setFid({});
  };

  const measureFidelity = useCallback(async () => {
    setFidError(null);
    setFidProgress("Loading embedding model…");
    const next: FidelityState = {};
    for (const id of ALL_IDS) next[id] = "loading";
    setFid(next);
    try {
      for (const r of results) {
        const score = await fidelity(r.original, r.compressed, (p) => {
          if (p.status === "progress" && typeof p.progress === "number") {
            setFidProgress(`Loading embedding model… ${p.progress.toFixed(0)}%`);
          } else if (p.status === "ready" || p.status === "done") {
            setFidProgress("Embedding…");
          }
        });
        setFid((prev) => ({ ...prev, [r.strategy]: score }));
      }
      setFidProgress(null);
    } catch (e) {
      setFidProgress(null);
      setFid({});
      setFidError(
        e instanceof Error ? e.message : "Could not load the embedding model (offline?).",
      );
    }
  }, [results]);

  const sample = SAMPLES.find((s) => s.id === sampleId);
  const headline = results.find((r) => r.strategy === "caveman")!;

  return (
    <div className="app">
      <header className="hero">
        <div className="kicker">Day 11 · kb-daily-builds</div>
        <h1>Prompt Compressor</h1>
        <p className="sub">
          The most-starred AI coding skill on GitHub{" "}
          <a href="https://github.com/JuliusBrussee/caveman" target="_blank" rel="noreferrer">
            (caveman, 82k★)
          </a>{" "}
          promises <strong>65% fewer tokens</strong>. JetBrains measured{" "}
          <a
            href="https://blog.jetbrains.com/ai/2026/07/speak-to-ai-agents-like-cavemen-tosave-tokens/"
            target="_blank"
            rel="noreferrer"
          >
            8.5% on real agentic work
          </a>
          . Both are true — the gap is what your text is <em>made of</em>. Measure yours.
        </p>
      </header>

      <section className="verdict" aria-live="polite">
        <div className="verdict-grid">
          <div className="v-cell claimed">
            <div className="v-label">Advertised</div>
            <div className="v-num">65%</div>
            <div className="v-note">measured on chat prose</div>
          </div>
          <div className="v-arrow" aria-hidden="true">
            →
          </div>
          <div className="v-cell actual">
            <div className="v-label">Your text, caveman</div>
            <div className="v-num">{pct(headline.savedShare)}</div>
            <div className="v-note">
              {pct(comp.compressibleShare)} of this text is prose — the rest is protected
            </div>
          </div>
          <div className="v-cell">
            <div className="v-label">If it were all prose</div>
            <div className="v-num muted">{pct(headline.proseSavedShare)}</div>
            <div className="v-note">same strategy, prose only</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Your text</h2>
          <div className="samples">
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                className={s.id === sampleId ? "chip on" : "chip"}
                onClick={() => loadSample(s.id)}
              >
                {s.label}
              </button>
            ))}
            {sampleId === "custom" && <span className="chip on">Custom</span>}
          </div>
        </div>
        {sample && <p className="note">{sample.note}</p>}
        <textarea
          value={text}
          onChange={(e) => onEdit(e.target.value)}
          spellCheck={false}
          aria-label="Text to compress"
        />
        <div className="composition">
          <div className="bar" role="img" aria-label="Composition of your text by content type">
            {KIND_ORDER.map((k) =>
              comp.byKind[k] > 0 ? (
                <span
                  key={k}
                  className={`seg seg-${k}`}
                  style={{ width: `${(comp.byKind[k] / comp.totalChars) * 100}%` }}
                  title={`${KIND_LABEL[k]}: ${comp.byKind[k]} chars`}
                />
              ) : null,
            )}
          </div>
          <div className="legend">
            {KIND_ORDER.filter((k) => comp.byKind[k] > 0).map((k) => (
              <span key={k} className="lg">
                <i className={`dot seg-${k}`} /> {KIND_LABEL[k]}{" "}
                <b>{pct(comp.byKind[k] / comp.totalChars)}</b>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>The trade-off</h2>
          <div className="model-pick">
            <label htmlFor="model">Price against</label>
            <select id="model" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — ${m.inputPerM}/M in
                </option>
              ))}
            </select>
            {Object.keys(fid).length === 0 && (
              <button className="measure" onClick={measureFidelity}>
                Measure meaning loss →
              </button>
            )}
            {fidProgress && <span className="progress">{fidProgress}</span>}
          </div>
        </div>
        {fidError && <p className="error">{fidError}</p>}

        <table className="grid">
          <thead>
            <tr>
              <th>Strategy</th>
              <th className="num">Tokens</th>
              <th className="num">Saved</th>
              <th className="num">Real saving</th>
              <th className="num">Per 1k reqs</th>
              <th className="num">Fidelity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr className="base">
              <td>
                <b>Original</b>
                <div className="blurb">No compression. The baseline.</div>
              </td>
              <td className="num">{focused.originalTokens.toLocaleString()}</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">100%</td>
              <td></td>
            </tr>
            {results.map((r) => (
              <Row
                key={r.strategy}
                r={r}
                model={model}
                fid={fid[r.strategy]}
                focused={r.strategy === focus}
                onFocus={() => setFocus(r.strategy)}
              />
            ))}
          </tbody>
        </table>
        <p className="footnote">
          Fidelity = cosine similarity between the original and compressed text, embedded in your
          browser with <code>{EMBED_MODEL}</code>. It measures topical drift, not instruction
          fidelity — a rewrite that keeps every noun but drops a “don’t” scores well here and would
          still ruin your day. Useful signal, not proof.
        </p>
      </section>

      <section className="panel">
        <h2>
          What “{STRATEGIES.find((s) => s.id === focus)!.name}” actually did
        </h2>
        <p className="note">
          Struck-through text was dropped. Protected segments — code, commands, traces, URLs, paths —
          are copied byte-for-byte and never appear as changes.
        </p>
        <div className="diff">
          {wordDiff(focused.original, focused.compressed).map((t, i) => (
            <span key={i} className={`d d-${t.op}`}>
              {t.text}
            </span>
          ))}
        </div>
      </section>

      <footer>
        <p>
          Tokenised with <code>{TOKENIZER_NAME}</code>; per-vendor multipliers approximate each
          model’s real tokenizer. Input prices only — compression cannot save output tokens. Prices
          as of each model’s <code>asOf</code> date in <code>src/lib/pricing.ts</code>. Everything
          runs in your browser; nothing is uploaded.
        </p>
        <p>
          Built by{" "}
          <a href="https://www.kumarbipul.com" target="_blank" rel="noreferrer">
            <b>Kumar Bipul</b>
          </a>{" "}
          ·{" "}
          <a href="https://github.com/kbipul/prompt-compressor" target="_blank" rel="noreferrer">
            source
          </a>{" "}
          ·{" "}
          <a href="https://github.com/kbipul/kb-daily-builds" target="_blank" rel="noreferrer">
            kb-daily-builds
          </a>
        </p>
      </footer>
    </div>
  );
}

function Row({
  r,
  model,
  fid,
  focused,
  onFocus,
}: {
  r: CompressionResult;
  model: (typeof MODELS)[number];
  fid: number | "loading" | undefined;
  focused: boolean;
  onFocus: () => void;
}) {
  const s = STRATEGIES.find((x) => x.id === r.strategy)!;
  const money = savings(r.originalTokens, r.compressedTokens, model);
  return (
    <tr className={focused ? "on" : undefined}>
      <td>
        <b>{s.name}</b>
        {s.lossy && <span className="tag">lossy</span>}
        <div className="blurb">{s.blurb}</div>
      </td>
      <td className="num">{r.compressedTokens.toLocaleString()}</td>
      <td className="num">{r.tokensSaved.toLocaleString()}</td>
      <td className="num">
        <b>{pct(r.savedShare)}</b>
      </td>
      <td className="num">{formatUsd(money.perThousand)}</td>
      <td className="num">
        {fid === "loading" ? (
          <span className="muted">…</span>
        ) : typeof fid === "number" ? (
          <span className={fid < 0.85 ? "bad" : fid < 0.95 ? "warn" : "good"}>{pct(fid)}</span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        <button className="link" onClick={onFocus}>
          {focused ? "shown" : "diff"}
        </button>
      </td>
    </tr>
  );
}
