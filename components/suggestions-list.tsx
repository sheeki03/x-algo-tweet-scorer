"use client";

import { Button } from "@/components/ui/button";
import type { SuggestionItem } from "@/lib/scoring/types";

type Props = {
  suggestions: SuggestionItem[];
  unavailable: boolean;
  onApply?: (item: SuggestionItem) => void;
};

function Frame({
  children,
  empty,
}: {
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-hairline bg-canvas-2">
      <header className="flex flex-col gap-3 border-b border-hairline px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:py-7">
        <div>
          <p className="eyebrow">§ 02.2 — Rewrite suggestions</p>
          <h3 className="mt-1 text-[1.5rem] font-bold leading-[1.15] tracking-tight text-ink sm:text-[1.75rem]">
            Drafts the algorithm would prefer.
          </h3>
        </div>
        {!empty && (
          <p className="text-[12.5px] leading-[1.5] text-ink-faint sm:max-w-[26ch] sm:text-right">
            Click any suggestion to load it into the input above and re-score.
          </p>
        )}
      </header>
      <div className="px-6 py-7 sm:px-8 sm:py-8">{children}</div>
    </article>
  );
}

export function SuggestionsList({ suggestions, unavailable, onApply }: Props) {
  if (unavailable) {
    return (
      <Frame empty>
        <p className="text-[14px] italic text-ink-soft">
          Suggestions temporarily unavailable. The score above is unaffected.
        </p>
      </Frame>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Frame empty>
        <p className="text-[14px] italic text-ink-soft">
          No suggestions — this draft is already in good shape.
        </p>
      </Frame>
    );
  }

  return (
    <Frame>
      <ol
        role="list"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {suggestions.map((item, idx) => (
          <li
            key={idx}
            className="group/sugg relative flex h-full flex-col gap-4 rounded-2xl border border-hairline bg-canvas px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6"
          >
            <header className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2.5">
                <span className="tick text-[11px] uppercase tracking-[0.18em] text-tw-blue">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="eyebrow">{item.issue}</span>
              </div>
              <span
                className="tick inline-flex shrink-0 items-baseline gap-0.5 rounded-full border border-pos/45 bg-pos-soft px-2 py-0.5 text-[11px] text-pos"
                title="Expected percentage-point lift in fit score"
              >
                <span aria-hidden="true">+</span>
                {item.expected_lift_pp}
                <span className="text-pos/70">pp</span>
              </span>
            </header>
            <p className="flex-1 text-pretty text-[14px] leading-[1.55] text-ink">
              {item.suggestion}
            </p>
            {onApply && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-auto self-start rounded-full border-hairline-strong bg-transparent px-3.5 text-[13px] font-medium text-ink hover:border-tw-blue hover:bg-tw-blue hover:text-white"
                onClick={() => onApply(item)}
              >
                Apply & re-score
                <span aria-hidden="true" className="ml-1">
                  →
                </span>
              </Button>
            )}
          </li>
        ))}
      </ol>
    </Frame>
  );
}
