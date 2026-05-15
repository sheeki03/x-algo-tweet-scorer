import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import { env, rateLimitConfigured } from "@/lib/env";

export type RateLimitResult =
  | { allowed: true; remaining: { minute: number; day: number } }
  | {
      allowed: false;
      reason: "minute" | "day" | "infra_unavailable";
      retryAfterSeconds: number;
    };

const RATE_LIMIT_TIMEOUT_MS = 1_500;

type LimiterBundle = {
  redis: Redis;
  identityMinute: Ratelimit;
  identityDay: Ratelimit;
  ipMinute: Ratelimit;
  ipDay: Ratelimit;
};

let bundle: LimiterBundle | null = null;

export function getRedisClient(): Redis | null {
  if (!rateLimitConfigured()) return null;
  if (bundle) return bundle.redis;
  return buildBundle().redis;
}

function buildBundle(): LimiterBundle {
  if (bundle) return bundle;
  const e = env();
  const redis = new Redis({
    url: e.UPSTASH_REDIS_REST_URL!,
    token: e.UPSTASH_REDIS_REST_TOKEN!,
  });
  bundle = {
    redis,
    identityMinute: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      prefix: "rl:score:id:min",
      analytics: false,
    }),
    identityDay: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(25, "1 d"),
      prefix: "rl:score:id:day",
      analytics: false,
    }),
    ipMinute: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "rl:score:ip:min",
      analytics: false,
    }),
    ipDay: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(250, "1 d"),
      prefix: "rl:score:ip:day",
      analytics: false,
    }),
  };
  return bundle;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ratelimit_timeout")), ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function infraUnavailable(): RateLimitResult {
  return {
    allowed: false,
    reason: "infra_unavailable",
    retryAfterSeconds: 60,
  };
}

function identity(ip: string, anonCookie: string): string {
  return createHash("sha256")
    .update(`${ip}\0${anonCookie}`)
    .digest("hex");
}

export async function checkRateLimit(
  ip: string,
  anonCookie: string,
): Promise<RateLimitResult> {
  if (!rateLimitConfigured()) return infraUnavailable();

  let limiters: LimiterBundle;
  try {
    limiters = buildBundle();
  } catch {
    return infraUnavailable();
  }

  const ipIdentifier = ip || "unknown";
  const identityIdentifier = identity(ipIdentifier, anonCookie || "unknown");

  try {
    const [identityMinuteRes, identityDayRes, ipMinuteRes, ipDayRes] =
      await withTimeout(
        Promise.all([
          limiters.identityMinute.limit(identityIdentifier),
          limiters.identityDay.limit(identityIdentifier),
          limiters.ipMinute.limit(ipIdentifier),
          limiters.ipDay.limit(ipIdentifier),
        ]),
        RATE_LIMIT_TIMEOUT_MS
      );

    if (!identityDayRes.success || !ipDayRes.success) {
      const reset = Math.max(identityDayRes.reset, ipDayRes.reset);
      const retry = Math.max(
        1,
        Math.ceil((reset - Date.now()) / 1000),
      );
      return { allowed: false, reason: "day", retryAfterSeconds: retry };
    }
    if (!identityMinuteRes.success || !ipMinuteRes.success) {
      const reset = Math.max(identityMinuteRes.reset, ipMinuteRes.reset);
      const retry = Math.max(
        1,
        Math.ceil((reset - Date.now()) / 1000),
      );
      return { allowed: false, reason: "minute", retryAfterSeconds: retry };
    }

    return {
      allowed: true,
      remaining: {
        minute: Math.min(identityMinuteRes.remaining, ipMinuteRes.remaining),
        day: Math.min(identityDayRes.remaining, ipDayRes.remaining),
      },
    };
  } catch {
    return infraUnavailable();
  }
}
