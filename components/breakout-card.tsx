import type { BreakoutBucket } from "@/lib/scoring/types";

type Props = {
  bucket: BreakoutBucket;
  percent: number;
};

const BUCKET_STYLE: Record<BreakoutBucket, { tone: string; rule: string; dot: string }> = {
  low: { tone: "text-neg", rule: "bg-neg", dot: "bg-neg" },
  medium: { tone: "text-warn", rule: "bg-warn", dot: "bg-warn" },
  high: { tone: "text-pos", rule: "bg-pos", dot: "bg-pos" },
};

const BUCKET_LABEL: Record<BreakoutBucket, string> = {
  low: "Low",
  medium: "Mid",
  high: "High",
};

export function BreakoutCard({ bucket, percent }: Props) {
  const style = BUCKET_STYLE[bucket];
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative flex h-full flex-col px-5 py-6 sm:px-6 sm:py-7">
      <header className="flex items-baseline justify-between gap-2">
        <p className="eyebrow">Breakout</p>
        <span
          className="tick text-[10px] uppercase tracking-[0.16em] text-ink-faint"
          title="No real outcome labels collected yet; this number is not calibrated against actual virality."
        >
          (uncalibrated)
        </span>
      </header>

      <p
        className={`mt-5 tabular-nums leading-none ${style.tone}`}
        style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", fontWeight: 700 }}
      >
        {BUCKET_LABEL[bucket]}
      </p>

      <div className="mt-auto pt-6">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow inline-flex items-center gap-2">
            <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
            Breakout index
          </span>
          <span className={`tick text-[1.25rem] ${style.tone}`}>
            {pct}
            <span className="text-ink-faint">%</span>
          </span>
        </div>
        <div
          aria-hidden="true"
          className="relative mt-2.5 h-1 w-full overflow-hidden rounded-full bg-canvas-3"
        >
          <span
            className={`absolute top-0 left-0 h-full rounded-full ${style.rule} w-(--pct)`}
            style={{ "--pct": `${pct}%` } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  );
}
