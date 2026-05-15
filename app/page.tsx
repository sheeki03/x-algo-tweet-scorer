"use client";

import { useCallback, useState } from "react";
import Script from "next/script";
import { HeaderV2 } from "@/components/sections/header-variants";
import { HeroV2 } from "@/components/sections/hero-variants";
import { ComposeV2 } from "@/components/sections/compose-variants";
import { FindingsV2 } from "@/components/sections/findings-variants";
import { FooterV2 } from "@/components/sections/footer-variants";
import { PrivacyBanner } from "@/components/privacy-banner";
import type {
  ScoreResult,
  ScoringInput,
  SuggestionItem,
} from "@/lib/scoring/types";

const DEFAULT_INPUT: ScoringInput = {
  text: "",
  hasMedia: false,
  videoHasAudio: false,
  isReply: false,
  isThread: false,
  premiumLongPost: false,
  newAccount: false,
  tweetsInLastHour: 0,
  targetFollowerSize: null,
  modelOverride: null,
};

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type ApiError = {
  error: string;
  message?: string;
  retryAfterSeconds?: number;
  details?: { path?: (string | number)[]; message?: string }[];
};

function formatApiError(body: ApiError): string {
  const detail = body.details?.[0];
  const path = detail?.path?.length ? `${detail.path.join(".")}: ` : "";
  const base =
    body.message ??
    (detail?.message ? `Request rejected: ${path}${detail.message}` : "Request rejected.");
  return body.retryAfterSeconds
    ? `${base} Try again in ${body.retryAfterSeconds}s.`
    : base;
}

export type ByokConfig = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  modelId: string;
};

const DEFAULT_BYOK: ByokConfig = {
  enabled: false,
  apiKey: "",
  baseUrl: "https://openrouter.ai/api/v1",
  modelId: "",
};

export default function Home() {
  const [input, setInput] = useState<ScoringInput>(DEFAULT_INPUT);
  const [byok, setByok] = useState<ByokConfig>(DEFAULT_BYOK);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetNonce, setTurnstileResetNonce] = useState(0);

  const scoreInput = useCallback(async (draft: ScoringInput) => {
    setLoading(true);
    setError(null);
    try {
      // Site-funded scoring is locked to the bundled model. A model id is sent
      // only when BYOK is enabled, so users cannot spend our key on arbitrary
      // OpenRouter models.
      const byokPayload = byok.enabled
        ? {
            openrouterApiKey: byok.apiKey || undefined,
            openrouterBaseUrl: byok.baseUrl || undefined,
          }
        : {};
      const modelOverride = byok.enabled
        ? byok.modelId || null
        : null;

      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          premiumLongPost: Boolean(draft.premiumLongPost),
          modelOverride,
          turnstileToken: turnstileToken ?? undefined,
          ...byokPayload,
        }),
      });
      if (
        res.status === 429 ||
        res.status === 413 ||
        res.status === 403 ||
        res.status === 400
      ) {
        const body = (await res.json()) as ApiError;
        setError(formatApiError(body));
        if (res.status === 403) {
          setTurnstileRequired(true);
          setTurnstileToken(null);
          setTurnstileResetNonce((n) => n + 1);
        }
        return;
      }
      if (!res.ok) {
        setError(`Server returned ${res.status}.`);
        return;
      }
      const data = (await res.json()) as ScoreResult;
      setResult(data);
      setTurnstileRequired(data.turnstileRequired);
      setTurnstileToken(null);
      if (data.turnstileRequired) setTurnstileResetNonce((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, [turnstileToken, byok]);

  const submit = useCallback(async () => {
    await scoreInput(input);
  }, [input, scoreInput]);

  const applySuggestion = useCallback((item: SuggestionItem) => {
    const next = { ...input, text: item.suggestion };
    setInput(next);
    setResult(null);
    void scoreInput(next);
  }, [input, scoreInput]);

  const settings = {
    byok,
    onByokChange: setByok,
  };

  const composeProps = {
    input,
    setInput,
    submit,
    loading,
    error,
    turnstileRequired,
    turnstileSiteKey: TURNSTILE_SITE_KEY,
    turnstileResetNonce,
    turnstileSatisfied: !turnstileRequired || !TURNSTILE_SITE_KEY || Boolean(turnstileToken),
    onTurnstileToken: setTurnstileToken,
  };

  return (
    <main className="relative isolate flex-1">
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          async
          defer
        />
      )}

      <div className="v-lightsout flex min-h-dvh flex-col">
        <HeaderV2 {...settings} />
        <HeroV2 />
        <ComposeV2 {...composeProps} />
        {result && (
          <FindingsV2 result={result} applySuggestion={applySuggestion} />
        )}
        <FooterV2 />
      </div>

      <PrivacyBanner />
    </main>
  );
}
