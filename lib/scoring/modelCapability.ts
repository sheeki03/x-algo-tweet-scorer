import { env, fallbackModelList } from "@/lib/env";
import { log } from "@/lib/infra/logger";

type ModelEndpointsResponse = {
  data?: {
    endpoints?: Array<{
      provider_name?: string;
      supported_parameters?: string[];
    }>;
  };
};

export type StructuredMode = "json_schema" | "tools";

export type ModelEntry = { id: string; mode: StructuredMode };

const CAPABILITY_TIMEOUT_MS = 1_500;
let cachedChain: ModelEntry[] | null = null;

async function modelMode(id: string): Promise<StructuredMode | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CAPABILITY_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://openrouter.ai/api/v1/models/${id}/endpoints`,
      {
        headers: { Authorization: `Bearer ${env().OPENROUTER_API_KEY}` },
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      log("warn", "model_capability.fetch_not_ok", { id, status: res.status });
      return null;
    }
    const body = (await res.json()) as ModelEndpointsResponse;
    const endpoints = body.data?.endpoints ?? [];
    // Prefer json_schema when available; fall back to tools.
    let hasSchema = false;
    let hasTools = false;
    for (const ep of endpoints) {
      const params = ep.supported_parameters ?? [];
      if (params.includes("response_format") || params.includes("structured_outputs")) {
        hasSchema = true;
      }
      if (params.includes("tools") && params.includes("tool_choice")) {
        hasTools = true;
      }
    }
    if (hasSchema) return "json_schema";
    if (hasTools) return "tools";
    return null;
  } catch (err) {
    log("warn", "model_capability.fetch_failed", {
      id,
      message: err instanceof Error ? err.message : "unknown",
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveModelChain(): Promise<ModelEntry[]> {
  if (cachedChain) return cachedChain;
  const e = env();
  const candidates = [e.OPENROUTER_SCORER_MODEL, ...fallbackModelList()];
  const resolved = await Promise.all(
    candidates.map(async (id) => ({ id, mode: await modelMode(id) })),
  );
  const kept: ModelEntry[] = [];
  for (const { id, mode } of resolved) {
    if (mode) {
      kept.push({ id, mode });
    } else {
      log("warn", "model_capability.dropped", { id, reason: "no_structured_output" });
    }
  }
  if (kept.length === 0) {
    log("error", "model_capability.empty_chain", { candidates });
  } else {
    log("info", "model_capability.chain_resolved", {
      chain: kept.map((e) => `${e.id}(${e.mode})`),
    });
    cachedChain = kept;
  }
  return kept;
}

export function resetModelChainCache(): void {
  cachedChain = null;
}
