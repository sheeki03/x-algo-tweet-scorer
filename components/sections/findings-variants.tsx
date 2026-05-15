"use client";

import { ScoreCard } from "@/components/score-card";
import { BreakoutCard } from "@/components/breakout-card";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { SignalBreakdown } from "@/components/signal-breakdown";
import { SuggestionsList } from "@/components/suggestions-list";
import type { ScoreResult, SuggestionItem } from "@/lib/scoring/types";

type Props = {
  result: ScoreResult;
  applySuggestion: (item: SuggestionItem) => void;
};

function isSuggestionsUnavailable(result: ScoreResult): boolean {
  return (
    result.warnings.includes("Suggestions temporarily unavailable") ||
    (result.llmStatus !== "ok" &&
      result.llmStatus !== "fallback" &&
      result.llmStatus !== "cached")
  );
}

function WarningsList({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <ul
      role="list"
      className="rise mb-8 overflow-hidden rounded-2xl border border-warn/40 bg-warn-soft [animation-delay:60ms]"
    >
      {warnings.map((w, i) => (
        <li
          key={i}
          className="flex items-start gap-3 border-b border-warn/25 px-5 py-3 last:border-b-0"
        >
          <span className="tick mt-0.5 shrink-0 rounded-full border border-warn/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-warn">
            Note
          </span>
          <p className="flex-1 text-[14px] leading-[1.5] text-ink">{w}</p>
        </li>
      ))}
    </ul>
  );
}

/* ─── Lights Out — centered, oversized score reveal ─────── */
export function FindingsV2({ result, applySuggestion }: Props) {
  return (
    <section className="v-lightsout relative border-b border-hairline">
      <div className="mx-auto max-w-[1180px] px-6 py-20 sm:px-10 sm:py-28">
        <div className="rise mb-12 text-center">
          <p className="eyebrow">§ 02 — Findings</p>
          <h2
            className="font-serif mt-4 text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.05] tracking-tight text-ink"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            What the algorithm <em className="italic text-tw-blue">sees.</em>
          </h2>
        </div>
        <WarningsList warnings={result.warnings} />
        <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-12 [animation-delay:120ms]">
          <div className="rounded-2xl border border-hairline bg-canvas-2 lg:col-span-8">
            <ScoreCard fitScore={result.fitScore} />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-4">
            <div className="rounded-2xl border border-hairline bg-canvas-2">
              <BreakoutCard
                bucket={result.breakout.bucket}
                percent={result.breakout.percent}
              />
            </div>
            <div className="rounded-2xl border border-hairline bg-canvas-2">
              <ConfidenceBadge
                confidence={result.confidence}
                llmStatus={result.llmStatus}
                modelUsed={result.modelUsed}
                coldStartMode={result.coldStartMode}
              />
            </div>
          </div>
        </div>
        <div className="rise mt-10 [animation-delay:200ms]">
          <SignalBreakdown signals={result.signals} />
        </div>
        <div className="rise mt-10 [animation-delay:280ms]">
          <SuggestionsList
            suggestions={result.suggestions}
            unavailable={isSuggestionsUnavailable(result)}
            onApply={applySuggestion}
          />
        </div>
      </div>
    </section>
  );
}
