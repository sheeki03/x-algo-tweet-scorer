# X-Algorithm-Inspired Tweet Scorer

Single-page Next.js app that scores tweet drafts against verified, public
signals from [`xai-org/x-algorithm`](https://github.com/xai-org/x-algorithm)
(the open-source "For You" ranking code released by xAI). The output is an
approximation, not a calibrated prediction of X rank.

Built as a hybrid: deterministic rules pulled directly from the source
algorithm + LLM judges that mimic the Grox content-understanding pipeline.
Every signal in the breakdown is tagged **Officially verified** (source-backed
rule and direction), **Verified feature, estimated effect** (feature exists in
the repo, our weight is a heuristic guess), or **Heuristic estimate**
(platform-hygiene rule, not source-backed).

Two outputs:

- **Algorithm Fit Score (0–100)** — weighted sum of all signals
- **Breakout Likelihood (Low / Medium / High + uncalibrated %)** — sigmoid
  estimate of out-of-network reach; the percentage is labeled uncalibrated
  because no real outcome labels have been collected yet

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · shadcn/ui ·
Upstash Redis (rate limits + HMAC cache) · Cloudflare Turnstile · OpenRouter
(any OpenAI-compatible LLM, with BYOK).

## Local Development

```bash
bun install
cp .env.local.example .env.local
bun run dev
```

Open `http://localhost:3000`.

Quality gate:

```bash
bun run check
```

## Required Environment

Set these locally and in Vercel:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_SCORER_MODEL=arcee-ai/trinity-large-thinking:free
OPENROUTER_FALLBACK_MODELS=

UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
CACHE_HMAC_SECRET=...

TURNSTILE_SECRET_KEY=...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...

CRON_SECRET=...
```

`CACHE_HMAC_SECRET` and `CRON_SECRET` should be fresh random values:

```bash
openssl rand -hex 32
```

## Model Policy

The site-funded OpenRouter path is hard-locked to:

```text
arcee-ai/trinity-large-thinking:free
```

The public API ignores `modelOverride` unless BYOK is active with all three
fields present:

- `openrouterApiKey`
- `openrouterBaseUrl`
- `modelOverride`

BYOK requests are never cached and use the user's key/quota. Server-funded
requests are cached by a server-secret HMAC of normalized input + toggles +
the hardcoded server model.

## Public Launch Checklist

Before going live:

1. Rotate the OpenRouter key if it has appeared in any chat/log/history.
2. Put all required env vars in Vercel production.
3. Add the production domain to the Cloudflare Turnstile site.
4. Set an OpenRouter credit cap and a Vercel spend cap.
5. Confirm Vercel Cron is active for `/api/cron/spend-probe`.
6. Run `bun run check`.

## API Behavior

`POST /api/score`

- Supports standard 280-character posts and X Premium long posts up to 25,000
  characters.
- Rejects bodies over 128 KB before model calls.
- Applies Upstash rate limits before model calls: per anonymous cookie for
  normal usage, with looser per-IP caps as an abuse backstop.
- Requires Turnstile after the Redis-backed request threshold.
- Falls back to heuristic-only scoring when model infrastructure is degraded.
- Never logs raw drafts or API keys.

`GET /api/cron/spend-probe`

- Requires `Authorization: Bearer $CRON_SECRET`.
- Reads OpenRouter key usage and logs spend-cap alerts.
- No automatic schedule — invoke manually with `curl -H "Authorization: Bearer $CRON_SECRET" <site>/api/cron/spend-probe`.
- Re-enable Vercel Cron by adding a `crons` array to `vercel.json` (requires Pro plan for sub-daily schedules).

## Privacy Disclosure

Drafts are sent to OpenRouter and the selected model provider for scoring. Raw
drafts are not stored. Derived score results are cached for 24 hours under a
server-secret HMAC key. This project is not affiliated with X or xAI.
