"use client";

/* Lights Out Editorial hero — pure black, oversized Fraunces serif
   with italic Twitter Blue accent. Centered cinematic composition. */

const SHARED_LEAD =
  "Paste a draft tweet. We score it against the open weights and rules from xai-org/x-algorithm — heavy boosts, hard suppressors, the cold-start ceiling. Uncalibrated approximations, source-cited.";

export function HeroV2() {
  return (
    <section className="v-lightsout relative border-b border-hairline">
      <div className="mx-auto max-w-[1180px] px-6 py-24 text-center sm:px-10 sm:py-32">
        <p className="eyebrow rise inline-flex items-center gap-2">
          <span className="size-1 rounded-full bg-tw-blue" />
          Field instrument · uncalibrated
        </p>
        <h1
          className="rise font-serif mx-auto mt-8 text-balance leading-[0.9] tracking-tight text-ink [animation-delay:60ms]"
          style={{
            maxWidth: "16ch",
            fontSize: "clamp(3rem, 9vw, 7.5rem)",
            fontVariationSettings: '"opsz" 144',
          }}
        >
          Read the{" "}
          <span className="italic text-tw-blue">post-publish</span> algorithm,{" "}
          <span className="text-ink-soft">before you publish.</span>
        </h1>
        <p className="rise mx-auto mt-10 max-w-[60ch] text-pretty text-[1.0625rem] leading-[1.6] text-ink-soft [animation-delay:140ms]">
          {SHARED_LEAD}
        </p>
        <div className="rise mt-10 flex items-center justify-center gap-4 [animation-delay:200ms]">
          <a
            href="#compose"
            className="inline-flex h-12 items-center rounded-full bg-tw-blue px-7 text-[14px] font-semibold text-white hover:bg-tw-blue-hover"
          >
            Score a draft
          </a>
          <a
            href="https://github.com/xai-org/x-algorithm"
            target="_blank"
            rel="noreferrer"
            className="text-[14px] font-medium text-ink-soft underline-offset-4 hover:text-tw-blue hover:underline"
          >
            xai-org/x-algorithm ↗
          </a>
        </div>
      </div>
    </section>
  );
}
