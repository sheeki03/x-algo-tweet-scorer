"use client";

const PRIVACY =
  "Drafts are sent to OpenRouter and the selected model provider for scoring. We do not store raw drafts. We temporarily cache derived analysis results keyed by a server-secret HMAC, expiring after 24h. Not affiliated with X or xAI.";

/* ─── Lights Out — large centered cinematic ───────────── */
export function FooterV2() {
  return (
    <footer className="v-lightsout border-t border-hairline">
      <div className="mx-auto max-w-[820px] px-6 py-20 text-center sm:px-10 sm:py-28">
        <p
          className="font-serif text-[clamp(1.5rem,3vw,2rem)] leading-[1.3] tracking-tight text-ink"
          style={{ fontVariationSettings: '"opsz" 144' }}
        >
          Open source.{" "}
          <span className="italic text-tw-blue">Source-cited.</span>{" "}
          Uncalibrated.
        </p>
        <p className="mx-auto mt-6 max-w-[58ch] text-[13.5px] leading-[1.6] text-ink-soft">
          {PRIVACY}
        </p>
        <a
          href="https://github.com/sheeki03/x-algo-tweet-scorer"
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex h-11 items-center rounded-full bg-tw-blue px-6 text-[14px] font-semibold text-white hover:bg-tw-blue-hover"
        >
          Source on GitHub ↗
        </a>
      </div>
    </footer>
  );
}
