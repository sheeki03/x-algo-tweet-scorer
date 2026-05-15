"use client";

import { TweetInput } from "@/components/tweet-input";
import type { ScoringInput } from "@/lib/scoring/types";

type Props = {
  input: ScoringInput;
  setInput: (next: ScoringInput) => void;
  submit: () => void;
  loading: boolean;
  error: string | null;
  turnstileRequired: boolean;
  turnstileSiteKey?: string;
  turnstileResetNonce: number;
  turnstileSatisfied: boolean;
  onTurnstileToken?: (t: string) => void;
};

function Tweet(props: Props) {
  return (
    <TweetInput
      value={props.input}
      onChange={props.setInput}
      onSubmit={props.submit}
      loading={props.loading}
      turnstileRequired={props.turnstileRequired}
      turnstileSiteKey={props.turnstileSiteKey}
      turnstileResetNonce={props.turnstileResetNonce}
      turnstileSatisfied={props.turnstileSatisfied}
      onTurnstileToken={props.onTurnstileToken}
    />
  );
}

function ErrorBlock({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rise mt-5 flex items-start gap-3 rounded-2xl border border-neg/40 bg-neg-soft px-4 py-3"
    >
      <span className="tick mt-0.5 shrink-0 rounded-full border border-neg/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neg">
        Err
      </span>
      <p className="text-[14px] leading-[1.5] text-ink">{error}</p>
    </div>
  );
}

/* ─── Lights Out — centered, magazine-style ──────────────── */
export function ComposeV2(props: Props) {
  return (
    <section
      id="compose"
      className="v-lightsout relative border-b border-hairline"
    >
      <div className="mx-auto max-w-[820px] px-6 py-20 sm:px-10 sm:py-28">
        <div className="text-center">
          <p className="eyebrow">§ 01 — Specimen draft</p>
          <h2
            className="font-serif mt-4 text-[clamp(2.25rem,4vw,3.25rem)] font-normal leading-[1.05] tracking-tight text-ink"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            Compose the{" "}
            <span className="italic text-tw-blue">specimen.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[58ch] text-pretty text-[15px] leading-[1.6] text-ink-soft">
            The form mirrors what the algorithm sees. Each toggle changes which
            rules fire.
          </p>
        </div>
        <div className="mt-12 rounded-2xl border border-hairline bg-canvas-2 p-7 sm:p-9">
          <Tweet {...props} />
        </div>
        <ErrorBlock error={props.error} />
      </div>
    </section>
  );
}
