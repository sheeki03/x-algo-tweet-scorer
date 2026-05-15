export type SignalTag =
  | "verified"
  | "verified-feature-estimated-effect"
  | "heuristic";

export type SignalDirection = "boost" | "drag";

export type SignalRecord = {
  /** Stable identifier used in the WEIGHTS table and the verified registry. */
  id: string;
  /** Human-readable label shown in the UI breakdown row. */
  label: string;
  /** Normalized numeric value in [0, 1] for boolean signals or [0, 10]/[0, 3] for scored signals. */
  value: number;
  /** Final contribution to the fitScore (weight × normalized signal). */
  contribution: number;
  /** Display direction in the Boosts/Drags table. */
  direction: SignalDirection;
  /** Tag describing how source-backed the rule is. */
  tag: SignalTag;
  /** Optional reference to the source file in xai-org/x-algorithm@e414c17. */
  sourceFile?: string;
  /** Optional short reason string surfaced in the UI tooltip. */
  reason?: string;
};

export type PtosCategory =
  | "ViolentMedia"
  | "AdultContent"
  | "Spam"
  | "IllegalAndRegulatedBehaviors"
  | "HateOrAbuse"
  | "ViolentSpeech"
  | "SuicideOrSelfHarm";

export const PTOS_CATEGORIES: readonly PtosCategory[] = [
  "ViolentMedia",
  "AdultContent",
  "Spam",
  "IllegalAndRegulatedBehaviors",
  "HateOrAbuse",
  "ViolentSpeech",
  "SuicideOrSelfHarm",
] as const;

export type TargetFollowerSize = "lt1k" | "1k_100k" | "gt100k";

export type ScoringInput = {
  text: string;
  hasMedia: boolean;
  videoHasAudio: boolean;
  isReply: boolean;
  isThread: boolean;
  /** Allows X Premium long-form posts up to 25,000 characters. */
  premiumLongPost: boolean;
  newAccount: boolean;
  tweetsInLastHour: number;
  /** Only relevant when isReply is true. */
  targetFollowerSize: TargetFollowerSize | null;
  /** BYOK model id only. Server-funded scoring must keep this null. */
  modelOverride: string | null;
};

export type JudgeAllResult = {
  slop: { score: number; reason: string };
  quality: { score: number; reason: string };
  topic_clarity: { score: number; tags: string[] };
  ptos_safety: {
    category: PtosCategory | null;
    severity: 0 | 1 | 2 | 3;
    reason: string;
  };
  /** null when not applicable (not a reply, or low-follower target). */
  reply_quality: { score: 0 | 1 | 2 | 3; reason: string } | null;
};

export type SuggestionItem = {
  issue: string;
  suggestion: string;
  expected_lift_pp: number;
};

export type LlmStatus =
  | "ok"
  | "cached"
  | "fallback"
  | "rate_limited"
  | "degraded";

export type Confidence = "low" | "medium" | "high";

export type BreakoutBucket = "low" | "medium" | "high";

export type ScoreResult = {
  fitScore: number;
  breakout: {
    bucket: BreakoutBucket;
    /** Uncalibrated percentage. Always rendered with an "(uncalibrated)" tag. */
    percent: number;
  };
  confidence: Confidence;
  llmStatus: LlmStatus;
  modelUsed: string | null;
  signals: SignalRecord[];
  suggestions: SuggestionItem[];
  /** True when the API response should ask the client to render Turnstile next time. */
  turnstileRequired: boolean;
  /** Cold-start mode banner, surfaced when newAccount=true. */
  coldStartMode: boolean;
  /** Any non-fatal warnings (e.g. "PTOS keyword precheck hit; LLM safety judge confirmed"). */
  warnings: string[];
};

export type ApiErrorBody = {
  error: "rate_limited" | "body_too_large" | "turnstile_failed";
  retryAfterSeconds?: number;
  message: string;
};
