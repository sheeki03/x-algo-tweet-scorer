import type { Confidence, LlmStatus } from "@/lib/scoring/types";

type Props = {
  confidence: Confidence;
  llmStatus: LlmStatus;
  modelUsed: string | null;
  coldStartMode: boolean;
};

const STYLE: Record<Confidence, { tone: string; dot: string }> = {
  low: { tone: "text-neg", dot: "bg-neg" },
  medium: { tone: "text-warn", dot: "bg-warn" },
  high: { tone: "text-pos", dot: "bg-pos" },
};

const LABEL: Record<Confidence, string> = {
  low: "Low",
  medium: "Med",
  high: "High",
};

const STATUS_LABEL: Record<LlmStatus, string> = {
  ok: "live",
  cached: "cached",
  fallback: "fallback",
  rate_limited: "rate-limited",
  degraded: "heuristic only",
};

const STATUS_DOT: Record<LlmStatus, string> = {
  ok: "bg-pos",
  cached: "bg-ink-soft",
  fallback: "bg-warn",
  rate_limited: "bg-neg",
  degraded: "bg-neg",
};

export function ConfidenceBadge({
  confidence,
  llmStatus,
  modelUsed,
  coldStartMode,
}: Props) {
  const st = STYLE[confidence];
  return (
    <div className="relative flex h-full flex-col px-5 py-6 sm:px-6 sm:py-7">
      <header className="flex items-baseline justify-between gap-2">
        <p className="eyebrow">Confidence</p>
        <span className="tick text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Run state
        </span>
      </header>

      <div
        className={`mt-5 inline-flex items-baseline gap-3 leading-none ${st.tone}`}
        style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", fontWeight: 700 }}
      >
        <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${st.dot}`} />
        <span className="tabular-nums">{LABEL[confidence]}</span>
      </div>

      <dl className="mt-auto space-y-2 pt-6 text-[12px]">
        <div className="flex items-center justify-between gap-2 border-t border-hairline pt-2">
          <dt className="eyebrow">Status</dt>
          <dd className="tick flex items-center gap-2 text-ink">
            <span
              aria-hidden="true"
              className={`live-dot size-1.5 rounded-full ${STATUS_DOT[llmStatus]}`}
            />
            {STATUS_LABEL[llmStatus]}
          </dd>
        </div>
        {modelUsed && (
          <div className="flex items-center justify-between gap-2 border-t border-hairline pt-2">
            <dt className="eyebrow">Model</dt>
            <dd className="tick truncate text-ink" title={modelUsed}>
              {modelUsed.split("/").pop()}
            </dd>
          </div>
        )}
        {coldStartMode && (
          <div className="flex items-center justify-between gap-2 border-t border-warn/30 pt-2">
            <dt className="eyebrow">Mode</dt>
            <dd className="tick text-warn">Cold-start</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
