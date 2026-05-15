import { z } from "zod";

const Env = z.object({
  OPENROUTER_API_KEY: z.string().min(10, "OPENROUTER_API_KEY required"),
  OPENROUTER_SCORER_MODEL: z
    .string()
    .default("arcee-ai/trinity-large-thinking:free"),
  OPENROUTER_FALLBACK_MODELS: z
    .string()
    .default(""),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  CACHE_HMAC_SECRET: z.string().min(32, "CACHE_HMAC_SECRET must be ≥32 bytes"),

  TURNSTILE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  CRON_SECRET: z.string().min(32).optional(),
});

export type Env = z.infer<typeof Env>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    throw new Error(`Invalid environment configuration:\n  ${formatted}`);
  }
  cached = parsed.data;
  return cached;
}

export function fallbackModelList(): string[] {
  return env()
    .OPENROUTER_FALLBACK_MODELS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function rateLimitConfigured(): boolean {
  const e = env();
  return Boolean(e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN);
}

export function turnstileConfigured(): boolean {
  const e = env();
  return Boolean(
    e.TURNSTILE_SECRET_KEY &&
      e.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
      rateLimitConfigured(),
  );
}
