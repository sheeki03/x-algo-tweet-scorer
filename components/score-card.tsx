type Props = {
  fitScore: number;
};

function bandFor(score: number): {
  label: string;
  tone: string;
  bar: string;
  dot: string;
} {
  if (score >= 70)
    return { label: "Strong fit", tone: "text-pos", bar: "bg-pos", dot: "bg-pos" };
  if (score >= 50)
    return { label: "Mixed fit", tone: "text-warn", bar: "bg-warn", dot: "bg-warn" };
  if (score >= 30)
    return { label: "Weak fit", tone: "text-warn", bar: "bg-warn", dot: "bg-warn" };
  return { label: "Misaligned", tone: "text-neg", bar: "bg-neg", dot: "bg-neg" };
}

export function ScoreCard({ fitScore }: Props) {
  const rounded = Math.max(0, Math.min(100, Math.round(fitScore)));
  const band = bandFor(rounded);

  return (
    <div className="relative flex h-full flex-col px-6 py-7 sm:px-8 sm:py-8">
      <header className="flex items-baseline justify-between gap-6">
        <p className="eyebrow">Algorithm fit · 0–100</p>
        <span
          className={`tick inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] ${band.tone}`}
        >
          <span aria-hidden="true" className={`size-1.5 rounded-full ${band.dot}`} />
          {band.label}
        </span>
      </header>

      <div className="mt-6 flex items-end gap-3">
        <span
          className={`tabular-nums leading-[0.85] tracking-[-0.04em] ${band.tone}`}
          style={{
            fontSize: "clamp(6rem, 14vw, 11rem)",
            fontWeight: 700,
          }}
        >
          {rounded}
        </span>
        <span className="tick mb-3 text-sm text-ink-faint">/ 100</span>
      </div>

      <div className="mt-8" aria-hidden="true">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-canvas-3">
          <div
            className={`absolute left-0 top-0 h-full rounded-full ${band.bar} w-(--bar)`}
            style={{ "--bar": `${rounded}%` } as React.CSSProperties}
          />
          <span className="absolute top-0 left-[30%] h-full w-px bg-ink/20" />
          <span className="absolute top-0 left-[50%] h-full w-px bg-ink/20" />
          <span className="absolute top-0 left-[70%] h-full w-px bg-ink/20" />
        </div>
        <div className="tick mt-2.5 flex items-baseline justify-between text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          <span>0</span>
          <span>30</span>
          <span>50</span>
          <span>70</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}
