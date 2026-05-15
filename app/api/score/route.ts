import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { log } from "@/lib/infra/logger";
import { checkRateLimit } from "@/lib/infra/ratelimit";
import { cacheGet, cacheKey, cacheSet } from "@/lib/infra/cache";
import { turnstileGate } from "@/lib/infra/turnstile";
import { runHardFilters } from "@/lib/scoring/hardFilters";
import { extractContentSignals } from "@/lib/scoring/contentSignals";
import { extractContextSignals } from "@/lib/scoring/contextSignals";
import { runJudgeAll, runSuggestions } from "@/lib/scoring/llmJudges";
import { combine } from "@/lib/scoring/combine";
import { resolveModelChain } from "@/lib/scoring/modelCapability";
import type { ScoringInput, ScoreResult, ApiErrorBody } from "@/lib/scoring/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_STANDARD_CHARS = 280;
const MAX_PREMIUM_CHARS = 25_000;
const MAX_BODY_BYTES = 128 * 1024;
const ANON_COOKIE_NAME = "x-algo-anon";

const BodySchema = z.object({
  text: z.string().min(1).max(MAX_PREMIUM_CHARS),
  hasMedia: z.boolean(),
  videoHasAudio: z.boolean(),
  isReply: z.boolean(),
  isThread: z.boolean(),
  premiumLongPost: z.boolean().default(false),
  newAccount: z.boolean(),
  tweetsInLastHour: z.number().int().min(0).max(100),
  targetFollowerSize: z.enum(["lt1k", "1k_100k", "gt100k"]).nullable(),
  modelOverride: z.string().min(1).max(120).nullable(),
  turnstileToken: z.string().optional(),
  openrouterApiKey: z.string().min(20).max(200).optional(),
  openrouterBaseUrl: z.string().url().max(200).optional(),
});

/**
 * SSRF guard for BYOK base URLs. Requires https + a non-private hostname.
 * Blocks: localhost, IPv4 private/loopback/link-local, IPv6 loopback/ULA,
 * and obvious metadata endpoints (169.254.169.254, etc.).
 */
function isPublicHttpsUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
  // IPv4 private/loopback/link-local
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a >= 224) return false; // multicast + reserved
  }
  // IPv6 loopback / unique local / link local
  if (host === "::1" || host === "[::1]") return false;
  if (host.startsWith("fc") || host.startsWith("fd")) return false;
  if (host.startsWith("fe80")) return false;
  return true;
}

function getIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

function getOrCreateAnonCookie(req: Request): { value: string; setCookie: string | null } {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ANON_COOKIE_NAME}=([^;]+)`));
  if (match) return { value: match[1], setCookie: null };
  const fresh = crypto.randomBytes(16).toString("hex");
  const setCookie = `${ANON_COOKIE_NAME}=${fresh}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
  return { value: fresh, setCookie };
}

function errBody(error: ApiErrorBody["error"], message: string, retryAfterSeconds?: number): ApiErrorBody {
  return retryAfterSeconds === undefined ? { error, message } : { error, message, retryAfterSeconds };
}

async function readJsonWithLimit(req: Request): Promise<unknown> {
  if (!req.body) throw new Error("empty_body");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

function heuristicOnly(args: {
  input: ScoringInput;
  turnstileRequired: boolean;
  reason: "degraded" | "rate_limited";
  warnings: string[];
}): ScoreResult {
  const hard = runHardFilters(args.input);
  const content = extractContentSignals(args.input, hard);
  const context = extractContextSignals(args.input);
  return combine({
    hardCap: hard.hardCap,
    baitFlags: hard.baitFlags,
    contentSignals: content,
    contextSignals: context,
    judgeResult: null,
    ptosKeywordHits: hard.ptosKeywordHits,
    suggestions: null,
    input: args.input,
    llmStatus: args.reason === "rate_limited" ? "rate_limited" : "degraded",
    modelUsed: null,
    turnstileRequired: args.turnstileRequired,
    warnings: [...args.warnings, ...hard.warnings],
  });
}

export async function POST(req: Request): Promise<Response> {
  const startedAt = Date.now();
  const ip = getIp(req);
  const anon = getOrCreateAnonCookie(req);

  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    log("warn", "score.body_too_large", { ip, contentLength });
    return NextResponse.json<ApiErrorBody>(
      errBody("body_too_large", `Request body exceeds ${MAX_BODY_BYTES} bytes.`),
      { status: 413 },
    );
  }

  let raw: unknown;
  try {
    raw = await readJsonWithLimit(req);
  } catch (err) {
    if (err instanceof Error && err.message === "body_too_large") {
      log("warn", "score.body_too_large_stream", { ip });
      return NextResponse.json<ApiErrorBody>(
        errBody("body_too_large", `Request body exceeds ${MAX_BODY_BYTES} bytes.`),
        { status: 413 },
      );
    }
    return NextResponse.json<ApiErrorBody>(
      errBody("body_too_large", "Invalid JSON body."),
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  if (!body.premiumLongPost && body.text.length > MAX_STANDARD_CHARS) {
    return NextResponse.json(
      {
        error: "validation_failed",
        details: [
          {
            path: ["text"],
            message:
              "Standard posts are capped at 280 characters. Enable Premium long post mode for up to 25,000 characters.",
          },
        ],
      },
      { status: 400 },
    );
  }

  const rl = await checkRateLimit(ip, anon.value);
  if (!rl.allowed) {
    if (rl.reason === "minute" || rl.reason === "day") {
      log("info", "score.rate_limited", { ip, reason: rl.reason });
      const res = NextResponse.json<ApiErrorBody>(
        errBody("rate_limited", `Rate limit reached: ${rl.reason}.`, rl.retryAfterSeconds),
        { status: 429 },
      );
      if (anon.setCookie) res.headers.set("set-cookie", anon.setCookie);
      return res;
    }
    log("warn", "score.ratelimit_infra_fail_closed", { ip });
    const input: ScoringInput = {
      text: body.text,
      hasMedia: body.hasMedia,
      videoHasAudio: body.videoHasAudio,
      isReply: body.isReply,
      isThread: body.isThread,
      premiumLongPost: body.premiumLongPost,
      newAccount: body.newAccount,
      tweetsInLastHour: body.tweetsInLastHour,
      targetFollowerSize: body.targetFollowerSize,
      modelOverride: null,
    };
    const result = heuristicOnly({
      input,
      turnstileRequired: false,
      reason: "degraded",
      warnings: ["Rate-limit service unavailable; running heuristics only."],
    });
    const res = NextResponse.json(result);
    if (anon.setCookie) res.headers.set("set-cookie", anon.setCookie);
    return res;
  }

  const ts = await turnstileGate({
    ip,
    anonCookie: anon.value,
    token: body.turnstileToken,
  });
  if (!ts.ok) {
    if (ts.reason === "missing_token" || ts.reason === "siteverify_failed") {
      log("info", "score.turnstile_block", { ip, reason: ts.reason });
      const res = NextResponse.json<ApiErrorBody>(
        errBody("turnstile_failed", "Bot challenge required."),
        { status: 403 },
      );
      if (anon.setCookie) res.headers.set("set-cookie", anon.setCookie);
      return res;
    }
    // infra_unavailable -> fail closed
    log("warn", "score.turnstile_infra_fail_closed", { ip });
    const input: ScoringInput = {
      text: body.text,
      hasMedia: body.hasMedia,
      videoHasAudio: body.videoHasAudio,
      isReply: body.isReply,
      isThread: body.isThread,
      premiumLongPost: body.premiumLongPost,
      newAccount: body.newAccount,
      tweetsInLastHour: body.tweetsInLastHour,
      targetFollowerSize: body.targetFollowerSize,
      modelOverride: null,
    };
    const result = heuristicOnly({
      input,
      turnstileRequired: true,
      reason: "degraded",
      warnings: ["Bot-check service unavailable; running heuristics only."],
    });
    const res = NextResponse.json(result);
    if (anon.setCookie) res.headers.set("set-cookie", anon.setCookie);
    return res;
  }

  let input: ScoringInput = {
    text: body.text,
    hasMedia: body.hasMedia,
    videoHasAudio: body.videoHasAudio,
    isReply: body.isReply,
    isThread: body.isThread,
    premiumLongPost: body.premiumLongPost,
    newAccount: body.newAccount,
    tweetsInLastHour: body.tweetsInLastHour,
    targetFollowerSize: body.targetFollowerSize,
    modelOverride: null,
  };

  // BYOK extraction: only honored when key + url + modelOverride are all present
  // AND the URL passes the SSRF guard.
  const byokWarnings: string[] = [];
  let byok: { apiKey: string; baseUrl: string; modelId: string } | null = null;
  if (body.openrouterApiKey || body.openrouterBaseUrl) {
    if (!body.openrouterApiKey) {
      byokWarnings.push("BYOK base URL provided without a key — falling back to the bundled scorer.");
    } else if (!body.openrouterBaseUrl) {
      byokWarnings.push("BYOK key provided without a base URL — falling back to the bundled scorer.");
    } else if (!body.modelOverride) {
      byokWarnings.push("BYOK requires a model id (modelOverride) — falling back to the bundled scorer.");
    } else if (!isPublicHttpsUrl(body.openrouterBaseUrl)) {
      byokWarnings.push("BYOK base URL rejected (must be public https) — falling back to the bundled scorer.");
      log("warn", "score.byok_url_rejected", { ip });
    } else {
      byok = {
        apiKey: body.openrouterApiKey,
        baseUrl: body.openrouterBaseUrl,
        modelId: body.modelOverride,
      };
      input = { ...input, modelOverride: body.modelOverride };
    }
  }

  const togglesForCache: Record<string, boolean | number | string | null> = {
    hasMedia: input.hasMedia,
    videoHasAudio: input.videoHasAudio,
    isReply: input.isReply,
    isThread: input.isThread,
    premiumLongPost: input.premiumLongPost,
    newAccount: input.newAccount,
    tweetsInLastHour: input.tweetsInLastHour,
    targetFollowerSize: input.targetFollowerSize,
  };

  const chain = byok ? [] : await resolveModelChain();
  const modelForKey = chain[0]?.id ?? env().OPENROUTER_SCORER_MODEL;

  // BYOK results are never cached — different keys produce different scores
  // for the same input, and we don't want cross-user contamination.
  const useCache = byok === null;

  const key = cacheKey({
    normalizedText: input.text,
    toggles: togglesForCache,
    modelId: modelForKey,
  });
  if (useCache) {
    const cached = await cacheGet<ScoreResult>(key);
    if (cached) {
      log("info", "score.cache_hit", { durationMs: Date.now() - startedAt });
      const res = NextResponse.json<ScoreResult>({
        ...cached,
        llmStatus: "cached",
        turnstileRequired: ts.nextRequiresToken,
      });
      if (anon.setCookie) res.headers.set("set-cookie", anon.setCookie);
      return res;
    }
  }

  const hard = runHardFilters(input);
  const content = extractContentSignals(input, hard);
  const context = extractContextSignals(input);

  if (chain.length === 0 && !byok) {
    log("warn", "score.no_eligible_models");
    const result = heuristicOnly({
      input,
      turnstileRequired: ts.nextRequiresToken,
      reason: "degraded",
      warnings: ["No eligible scorer model available; running heuristics only.", ...byokWarnings],
    });
    const res = NextResponse.json(result);
    if (anon.setCookie) res.headers.set("set-cookie", anon.setCookie);
    return res;
  }

  const judge = await runJudgeAll(input, input.modelOverride, byok);

  let suggestions = null;
  if (judge.status !== "degraded" && judge.result) {
    const signalsForPrompt = [...content, ...context].map((s) => ({
      id: s.id,
      value: s.value,
      direction: s.direction,
    }));
    suggestions = await runSuggestions(
      input,
      signalsForPrompt,
      judge.result,
      input.modelOverride,
      judge.modelUsed,
      judge.modeUsed,
      byok,
    );
  }

  const result = combine({
    hardCap: hard.hardCap,
    baitFlags: hard.baitFlags,
    contentSignals: content,
    contextSignals: context,
    judgeResult: judge.result,
    ptosKeywordHits: hard.ptosKeywordHits,
    suggestions,
    input,
    llmStatus: judge.status === "degraded" ? "degraded" : judge.status === "fallback" ? "fallback" : "ok",
    modelUsed: judge.modelUsed,
    turnstileRequired: ts.nextRequiresToken,
    warnings: [...hard.warnings, ...byokWarnings],
  });

  if (
    useCache &&
    judge.status === "ok" &&
    judge.result &&
    suggestions !== null &&
    judge.modelUsed === modelForKey
  ) {
    await cacheSet(key, result, 60 * 60 * 24);
  }

  log("info", "score.complete", {
    durationMs: Date.now() - startedAt,
    llmStatus: result.llmStatus,
    modelUsed: result.modelUsed,
    fitScore: result.fitScore,
    breakoutBucket: result.breakout.bucket,
    confidence: result.confidence,
  });

  const res = NextResponse.json(result);
  if (anon.setCookie) res.headers.set("set-cookie", anon.setCookie);
  return res;
}
