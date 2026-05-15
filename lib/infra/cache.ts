import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { getRedisClient } from "@/lib/infra/ratelimit";

export type CacheKeyInput = {
  normalizedText: string;
  toggles: Record<string, boolean | number | string | null>;
  modelId: string;
};

const DEFAULT_TTL_SECONDS = 86_400;
const CACHE_TIMEOUT_MS = 1_000;
const KEY_PREFIX = "score:cache:";

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map(
      (k) =>
        `${JSON.stringify(k)}:${stableStringify(
          (value as Record<string, unknown>)[k]
        )}`
    )
    .join(",");
  return `{${body}}`;
}

export function cacheKey(input: CacheKeyInput): string {
  const payload = stableStringify({
    normalizedText: normalizeText(input.normalizedText),
    toggles: input.toggles,
    modelId: input.modelId,
  });
  return createHmac("sha256", env().CACHE_HMAC_SECRET)
    .update(payload)
    .digest("hex");
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("cache_timeout")), ms);
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

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const raw = await withTimeout(
      redis.get<string | T>(KEY_PREFIX + key),
      CACHE_TIMEOUT_MS
    );
    if (raw == null) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
    return raw as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await withTimeout(
      redis.set(KEY_PREFIX + key, JSON.stringify(value), { ex: ttlSeconds }),
      CACHE_TIMEOUT_MS
    );
  } catch {
    return;
  }
}
