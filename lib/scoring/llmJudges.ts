import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import { z } from "zod";

import { env } from "../env";
import { resolveModelChain } from "./modelCapability";
import type { ModelEntry, StructuredMode } from "./modelCapability";
import {
  JUDGE_ALL_JSON_SCHEMA,
  JUDGE_ALL_SYSTEM_PROMPT,
  JUDGE_ALL_USER_TEMPLATE,
  SUGGESTIONS_JSON_SCHEMA,
  SUGGESTIONS_SYSTEM_PROMPT,
  SUGGESTIONS_USER_TEMPLATE,
} from "./prompts";
import { PTOS_CATEGORIES } from "./types";
import type {
  JudgeAllResult,
  ScoringInput,
  SignalDirection,
  SuggestionItem,
} from "./types";

const JUDGE_ALL_TIMEOUT_MS = 10_000;
const SUGGESTIONS_TIMEOUT_MS = 8_000;

const ptosCategorySchema = z.enum(PTOS_CATEGORIES as readonly [
  (typeof PTOS_CATEGORIES)[number],
  ...(typeof PTOS_CATEGORIES)[number][],
]);

const judgeAllSchema = z.object({
  slop: z.object({
    score: z.number().int().min(0).max(10),
    reason: z.string().min(1),
  }),
  quality: z.object({
    score: z.number().int().min(0).max(10),
    reason: z.string().min(1),
  }),
  topic_clarity: z.object({
    score: z.number().int().min(0).max(10),
    tags: z.array(z.string().min(1)).max(5),
  }),
  ptos_safety: z.object({
    category: ptosCategorySchema.nullable(),
    severity: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    reason: z.string().min(1),
  }),
  reply_quality: z
    .object({
      score: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
      reason: z.string().min(1),
    })
    .nullable(),
});

const suggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        issue: z.string().min(1),
        suggestion: z.string().min(1),
        expected_lift_pp: z.number().int().min(0).max(30),
      }),
    )
    .min(1)
    .max(5),
});

let cachedClient: OpenAI | undefined;

function client(): OpenAI {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({
    apiKey: env().OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });
  return cachedClient;
}

export type ByokOverride = {
  apiKey: string;
  baseUrl: string;
  modelId: string;
};

type JudgeStatus = "ok" | "fallback" | "degraded";

function pickClient(byok?: ByokOverride | null): OpenAI {
  if (!byok) return client();
  // Per-request, never cached. The caller's key never sits in process memory
  // beyond this call.
  return new OpenAI({ apiKey: byok.apiKey, baseURL: byok.baseUrl });
}

function log(event: {
  call: "judge_all" | "suggestions";
  model: string;
  status: "ok" | "error" | "timeout" | "parse_error" | "validation_error";
  durationMs: number;
  detail?: string;
}): void {
  console.log(
    JSON.stringify({
      scope: "llmJudges",
      call: event.call,
      model: event.model,
      status: event.status,
      durationMs: event.durationMs,
      ...(event.detail ? { detail: event.detail.slice(0, 200) } : {}),
    }),
  );
}

type StructuredCallParams = {
  model: string;
  mode: StructuredMode;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: unknown;
  timeoutMs: number;
  byok?: ByokOverride | null;
};

async function structuredCall(
  params: StructuredCallParams,
): Promise<{ ok: true; raw: string } | { ok: false; reason: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);

  const isOpenRouter =
    !params.byok || params.byok.baseUrl.includes("openrouter.ai/api/v1");
  const baseBody = {
    model: params.model,
    temperature: 0,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userPrompt },
    ],
    ...(isOpenRouter ? { provider: { require_parameters: true } } : {}),
  };

  const body =
    params.mode === "json_schema"
      ? ({
          ...baseBody,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: params.schemaName,
              strict: true,
              schema: params.schema,
            },
          },
        } as unknown as ChatCompletionCreateParamsNonStreaming)
      : ({
          ...baseBody,
          tools: [
            {
              type: "function",
              function: {
                name: params.schemaName,
                description: "Return the structured judgment.",
                parameters: params.schema,
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: params.schemaName },
          },
        } as unknown as ChatCompletionCreateParamsNonStreaming);

  try {
    const completion = (await pickClient(params.byok).chat.completions.create(body, {
      signal: controller.signal,
      timeout: params.timeoutMs,
      maxRetries: 0,
    })) as ChatCompletion;

    const message = completion.choices?.[0]?.message;
    if (params.mode === "tools") {
      const call = message?.tool_calls?.[0];
      const args =
        call && "function" in call
          ? (call.function as { arguments?: string }).arguments
          : undefined;
      if (typeof args !== "string" || !args.length) {
        return { ok: false, reason: "empty_tool_call" };
      }
      return { ok: true, raw: args };
    }
    const content = message?.content;
    if (typeof content !== "string" || !content.length) {
      return { ok: false, reason: "empty_content" };
    }
    return { ok: true, raw: content };
  } catch (err) {
    if (controller.signal.aborted) {
      return { ok: false, reason: "timeout" };
    }
    const code =
      err && typeof err === "object" && "status" in err
        ? String((err as { status: unknown }).status)
        : "error";
    return { ok: false, reason: `http_${code}` };
  } finally {
    clearTimeout(timer);
  }
}

function parseAndValidateJudgeAll(raw: string): JudgeAllResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = judgeAllSchema.safeParse(parsed);
  if (!result.success) return null;
  return result.data as JudgeAllResult;
}

function parseAndValidateSuggestions(raw: string): SuggestionItem[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = suggestionsSchema.safeParse(parsed);
  if (!result.success) return null;
  return result.data.suggestions;
}

function enforceReplyQualityNull(
  input: ScoringInput,
  out: JudgeAllResult,
): JudgeAllResult {
  if (!input.isReply || input.targetFollowerSize === "lt1k") {
    return { ...out, reply_quality: null };
  }
  return out;
}

async function effectiveChain(
  modelOverride: string | null,
  byok?: ByokOverride | null,
): Promise<ModelEntry[]> {
  if (byok) {
    // BYOK: user manages quota. Try strict json_schema first, then tools for
    // OpenRouter/free-model style providers.
    return [
      { id: byok.modelId, mode: "json_schema" },
      { id: byok.modelId, mode: "tools" },
    ];
  }
  void modelOverride;
  return resolveModelChain();
}

export async function runJudgeAll(
  input: ScoringInput,
  modelOverride: string | null,
  byok?: ByokOverride | null,
): Promise<{
  status: JudgeStatus;
  modelUsed: string | null;
  modeUsed: StructuredMode | null;
  result: JudgeAllResult | null;
}> {
  const chain = await effectiveChain(modelOverride, byok);
  if (chain.length === 0) {
    return { status: "degraded", modelUsed: null, modeUsed: null, result: null };
  }

  const systemPrompt = JUDGE_ALL_SYSTEM_PROMPT;
  const userPrompt = JUDGE_ALL_USER_TEMPLATE(input);

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    const model = entry.id;
    const start = Date.now();
    const callResult = await structuredCall({
      model,
      mode: entry.mode,
      systemPrompt,
      userPrompt,
      schemaName: "judge_all",
      schema: JUDGE_ALL_JSON_SCHEMA,
      timeoutMs: JUDGE_ALL_TIMEOUT_MS,
      byok,
    });
    const duration = Date.now() - start;

    if (!callResult.ok) {
      log({
        call: "judge_all",
        model,
        status: callResult.reason === "timeout" ? "timeout" : "error",
        durationMs: duration,
        detail: callResult.reason,
      });
      continue;
    }

    const validated = parseAndValidateJudgeAll(callResult.raw);
    if (!validated) {
      log({
        call: "judge_all",
        model,
        status: "validation_error",
        durationMs: duration,
      });
      continue;
    }

    const finalResult = enforceReplyQualityNull(input, validated);
    log({ call: "judge_all", model, status: "ok", durationMs: duration });
    return {
      status: i === 0 ? "ok" : "fallback",
      modelUsed: model,
      modeUsed: entry.mode,
      result: finalResult,
    };
  }

  return { status: "degraded", modelUsed: null, modeUsed: null, result: null };
}

export async function runSuggestions(
  input: ScoringInput,
  signals: { id: string; value: number; direction: SignalDirection }[],
  judgeResult: JudgeAllResult,
  modelOverride: string | null,
  preferredModel?: string | null,
  preferredMode?: StructuredMode | null,
  byok?: ByokOverride | null,
): Promise<SuggestionItem[] | null> {
  const chain = await effectiveChain(modelOverride, byok);
  if (chain.length === 0) return null;
  const entry =
    chain.find((c) => c.id === preferredModel && c.mode === preferredMode) ??
    chain.find((c) => c.id === preferredModel) ?? chain[0];
  const model = entry.id;

  const userPrompt = SUGGESTIONS_USER_TEMPLATE(input, signals, judgeResult);

  const start = Date.now();
  const callResult = await structuredCall({
    model,
    mode: entry.mode,
    systemPrompt: SUGGESTIONS_SYSTEM_PROMPT,
    userPrompt,
    schemaName: "suggestions",
    schema: SUGGESTIONS_JSON_SCHEMA,
    timeoutMs: SUGGESTIONS_TIMEOUT_MS,
    byok,
  });
  const duration = Date.now() - start;

  if (!callResult.ok) {
    log({
      call: "suggestions",
      model,
      status: callResult.reason === "timeout" ? "timeout" : "error",
      durationMs: duration,
      detail: callResult.reason,
    });
    return null;
  }

  const validated = parseAndValidateSuggestions(callResult.raw);
  if (!validated) {
    log({
      call: "suggestions",
      model,
      status: "validation_error",
      durationMs: duration,
    });
    return null;
  }

  log({ call: "suggestions", model, status: "ok", durationMs: duration });
  return validated;
}
