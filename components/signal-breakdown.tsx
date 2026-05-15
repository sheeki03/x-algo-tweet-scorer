import type { SignalRecord, SignalTag } from "@/lib/scoring/types";

type Props = {
  signals: SignalRecord[];
};

const TAG_LABEL: Record<SignalTag, string> = {
  verified: "Officially verified",
  "verified-feature-estimated-effect": "Verified feature, estimated effect",
  heuristic: "Heuristic estimate",
};

const TAG_GLYPH: Record<SignalTag, string> = {
  verified: "V",
  "verified-feature-estimated-effect": "F",
  heuristic: "H",
};

const TAG_STYLE: Record<SignalTag, string> = {
  verified: "border-pos/45 bg-pos-soft text-pos",
  "verified-feature-estimated-effect": "border-tw-blue/45 bg-tw-blue-soft text-tw-blue",
  heuristic: "border-hairline-strong bg-canvas hatch text-ink-faint",
};

function Row({ signal, index }: { signal: SignalRecord; index: number }) {
  const sign = signal.contribution >= 0 ? "+" : "";
  const isPos = signal.contribution > 0;
  const isNeg = signal.contribution < 0;
  const num = String(index + 1).padStart(2, "0");
  return (
    <div className="group/row grid grid-cols-[--spacing(6)_--spacing(7)_1fr_auto] items-start gap-x-4 border-t border-hairline py-3.5 first:border-t-0">
      {/* running line number */}
      <span className="tick text-[10px] uppercase tracking-[0.18em] text-ink-faint">
        {num}
      </span>

      {/* honesty glyph chip — preserves the 3-tier badge */}
      <span
        title={TAG_LABEL[signal.tag]}
        className={`tick mt-0.5 inline-flex size-6 items-center justify-center border text-[10px] uppercase ${TAG_STYLE[signal.tag]}`}
        aria-label={TAG_LABEL[signal.tag]}
      >
        {TAG_GLYPH[signal.tag]}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-[0.9375rem] text-ink">{signal.label}</span>
          <span className="eyebrow" title={signal.sourceFile ?? undefined}>
            {TAG_LABEL[signal.tag]}
            {signal.sourceFile ? " · src" : ""}
          </span>
        </div>
        {signal.reason && (
          <p className="mt-1.5 text-pretty text-[13px] leading-[1.55] text-ink-soft">
            {signal.reason}
          </p>
        )}
      </div>

      <span
        className={`tick shrink-0 self-start text-[15px] ${
          isPos ? "text-pos" : isNeg ? "text-neg" : "text-ink-faint"
        }`}
      >
        {sign}
        {signal.contribution.toFixed(2)}
      </span>
    </div>
  );
}

function Column({
  heading,
  count,
  tone,
  rows,
  empty,
}: {
  heading: string;
  count: number;
  tone: string;
  rows: SignalRecord[];
  empty: string;
}) {
  return (
    <div>
      <header className="flex items-baseline justify-between gap-2 border-b border-ink/30 pb-2.5">
        <p className={`tick text-[11px] uppercase tracking-[0.2em] ${tone}`}>
          {heading}
        </p>
        <p className="tick text-[12px] text-ink-faint">
          {String(count).padStart(2, "0")}
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="border-t border-hairline py-4 text-[13px] italic text-ink-faint">
          {empty}
        </p>
      ) : (
        <div role="list">
          {rows.map((s, i) => (
            <Row key={s.id} signal={s} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SignalBreakdown({ signals }: Props) {
  const boosts = signals.filter((s) => s.contribution > 0);
  const drags = signals.filter((s) => s.contribution < 0);
  const zero = signals.filter((s) => s.contribution === 0);

  return (
    <article className="rounded-2xl border border-hairline bg-canvas-2">
      <header className="flex flex-col gap-5 border-b border-hairline px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:py-7">
        <div>
          <p className="eyebrow">§ 02.1 — Signal ledger</p>
          <h3 className="mt-1 text-[1.5rem] font-bold leading-[1.15] tracking-tight text-ink sm:text-[1.75rem]">
            Boosts, drags &amp; no-ops.
          </h3>
        </div>
        <Legend />
      </header>

      <div className="grid grid-cols-1 gap-x-10 gap-y-10 px-6 py-7 sm:px-8 sm:py-8 lg:grid-cols-2">
        <Column
          heading="Boosts"
          count={boosts.length}
          tone="text-pos"
          rows={boosts}
          empty="No active boosts."
        />
        <Column
          heading="Drags"
          count={drags.length}
          tone="text-neg"
          rows={drags}
          empty="No active drags."
        />
        {zero.length > 0 && (
          <div className="lg:col-span-2">
            <Column
              heading="Neutral · not applicable"
              count={zero.length}
              tone="text-ink-faint"
              rows={zero}
              empty=""
            />
          </div>
        )}
      </div>
    </article>
  );
}

function Legend() {
  const items: { glyph: string; label: string; cls: string }[] = [
    {
      glyph: "V",
      label: "Officially verified",
      cls: "border-pos/45 bg-pos-soft text-pos",
    },
    {
      glyph: "F",
      label: "Verified feature, estimated effect",
      cls: "border-tw-blue/45 bg-tw-blue-soft text-tw-blue",
    },
    {
      glyph: "H",
      label: "Heuristic estimate",
      cls: "border-hairline-strong bg-canvas hatch text-ink-faint",
    },
  ];
  return (
    <ul role="list" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {items.map((i) => (
        <li key={i.glyph} className="flex items-center gap-2">
          <span
            className={`tick inline-flex size-5 items-center justify-center border text-[10px] uppercase ${i.cls}`}
            aria-hidden="true"
          >
            {i.glyph}
          </span>
          <span className="eyebrow">{i.label}</span>
        </li>
      ))}
    </ul>
  );
}
