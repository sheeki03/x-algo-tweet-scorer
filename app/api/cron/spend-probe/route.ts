import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { log } from "@/lib/infra/logger";

export const runtime = "nodejs";

type OpenRouterKeyInfo = {
  data?: {
    label?: string;
    usage?: number;
    limit?: number | null;
    is_free_tier?: boolean;
    rate_limit?: { requests?: number; interval?: string };
  };
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    log("error", "spend_probe.missing_cron_secret");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let info: OpenRouterKeyInfo;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: {
        Authorization: `Bearer ${env().OPENROUTER_API_KEY}`,
      },
    });
    if (!res.ok) {
      log("warn", "spend_probe.openrouter_error", { status: res.status });
      return NextResponse.json({ ok: false, status: res.status }, { status: 200 });
    }
    info = (await res.json()) as OpenRouterKeyInfo;
  } catch (err) {
    log("error", "spend_probe.fetch_failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const usage = info.data?.usage ?? 0;
  const limit = info.data?.limit ?? null;
  const ratio = limit ? usage / limit : 0;

  log("info", "spend_probe.snapshot", {
    usage,
    limit,
    ratio,
    is_free_tier: info.data?.is_free_tier ?? null,
  });

  if (limit && ratio >= 0.9) {
    log("error", "spend_probe.alert", { level: "90pct", usage, limit, ratio });
  } else if (limit && ratio >= 0.75) {
    log("warn", "spend_probe.alert", { level: "75pct", usage, limit, ratio });
  }

  return NextResponse.json({
    ok: true,
    usage,
    limit,
    ratio,
  });
}
