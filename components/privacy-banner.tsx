"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "x-algo-privacy-ack-v1";

export function PrivacyBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setVisible(!localStorage.getItem(STORAGE_KEY));
      } catch {
        setVisible(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-hairline-strong bg-canvas px-5 py-4 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="tick mt-0.5 shrink-0 rounded-full border border-tw-blue/40 bg-tw-blue-soft px-2 py-0.5 text-[10px] uppercase tracking-wide text-tw-blue"
        >
          Note
        </span>
        <p className="text-[13px] leading-[1.55] text-ink">
          Drafts are sent to OpenRouter and the selected model provider for
          scoring. We do not store raw drafts. We temporarily cache derived
          analysis results keyed by a server-secret HMAC, expiring after 24h.
          Not affiliated with X or xAI.
        </p>
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={dismiss}
          className="rounded-full bg-tw-blue px-4 text-[13px] font-semibold text-white hover:bg-tw-blue-hover"
        >
          Understood
        </Button>
      </div>
    </div>
  );
}

/* PrivacyFooter intentionally exported but unused by the new page —
   footer variants own the closing slot. Kept for backwards-compat. */
export function PrivacyFooter() {
  return null;
}
