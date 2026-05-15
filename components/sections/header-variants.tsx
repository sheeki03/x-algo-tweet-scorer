"use client";

import Link from "next/link";
import { SettingsDrawer } from "@/components/settings-drawer";
import type { ByokConfig } from "@/app/page";

type Props = {
  byok: ByokConfig;
  onByokChange: (next: ByokConfig) => void;
};

/* ─── Lights Out Editorial — pure black, big serif wordmark ── */
export function HeaderV2(props: Props) {
  return (
    <header className="v-lightsout sticky top-0 z-40 border-b border-hairline bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-5 sm:px-10">
        <Link href="/" aria-label="Homepage" className="flex items-baseline gap-3">
          <Logo className="size-5 fill-tw-blue" />
          <span
            className="font-serif text-[1.5rem] leading-none tracking-tight text-ink"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            score<span className="italic text-tw-blue">.</span>
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/sheeki03/x-algo-tweet-scorer"
            target="_blank"
            rel="noreferrer"
            className="tick hidden text-[11px] uppercase tracking-[0.18em] text-ink-faint hover:text-tw-blue sm:inline"
          >
            Source ↗
          </a>
          <SettingsDrawer {...props} />
        </div>
      </div>
    </header>
  );
}

/* ─── shared ─────────────────────────────────────────────── */

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
