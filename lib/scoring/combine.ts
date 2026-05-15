import type {
  BreakoutBucket,
  Confidence,
  JudgeAllResult,
  LlmStatus,
  ScoreResult,
  ScoringInput,
  SignalRecord,
  SuggestionItem,
} from "./types";
import { tagFor } from "./verifiedRegistry";

export const WEIGHTS: Record<string, number> = {
  quality: 6.0,
  topic_clarity: 3.0,
  reply_quality: 4.0,
  originality: 2.0,
  has_media: 2.5,
  audio_video: 1.5,
  length_in_sweet_spot: 1.5,
  hook_present: 1.0,
  specificity: 1.0,
  slop: -8.0,
  ptos_severity: -10.0,
  thread_dump: -2.0,
  cadence_penalty: -2.0,
  hashtag_spam: -1.5,
  link_heavy: -1.0,
  mention_excess: -1.0,
  bait_detected: -4.0,
  ptos_keyword_precheck: -3.0,
};

export type CombineInput = {
  hardCap: number | null;
  baitFlags: string[];
  contentSignals: SignalRecord[];
  contextSignals: SignalRecord[];
  judgeResult: JudgeAllResult | null;
  ptosKeywordHits: { category: string; phrase: string }[];
  suggestions: SuggestionItem[] | null;
  input: ScoringInput;
  llmStatus: LlmStatus;
  modelUsed: string | null;
  turnstileRequired: boolean;
  warnings: string[];
};

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function weightFor(id: string): number {
  return WEIGHTS[id] ?? 0;
}

function applyContribution(sig: SignalRecord): SignalRecord {
  return { ...sig, contribution: weightFor(sig.id) * sig.value };
}

export function combine(args: CombineInput): ScoreResult {
  const {
    hardCap,
    contentSignals,
    contextSignals,
    judgeResult,
    ptosKeywordHits,
    suggestions,
    input,
    llmStatus,
    modelUsed,
    turnstileRequired,
  } = args;

  const warnings: string[] = [...args.warnings];

  const scoredContent = contentSignals.map(applyContribution);
  const scoredContext = contextSignals.map(applyContribution);

  const llmSignals: SignalRecord[] = [];

  if (judgeResult) {
    const slopValue = clamp(judgeResult.slop.score / 10, 0, 1);
    llmSignals.push({
      id: "slop",
      label: "Slop (LLM banger screen)",
      value: slopValue,
      contribution: WEIGHTS.slop * slopValue,
      direction: "drag",
      tag: tagFor("slop"),
      reason: judgeResult.slop.reason,
    });

    const qualityValue = clamp(judgeResult.quality.score / 10, 0, 1);
    llmSignals.push({
      id: "quality",
      label: "Quality (LLM banger screen)",
      value: qualityValue,
      contribution: WEIGHTS.quality * qualityValue,
      direction: "boost",
      tag: tagFor("quality"),
      reason: judgeResult.quality.reason,
    });

    const topicValue = clamp(judgeResult.topic_clarity.score / 10, 0, 1);
    llmSignals.push({
      id: "topic_clarity",
      label: "Topic clarity",
      value: topicValue,
      contribution: WEIGHTS.topic_clarity * topicValue,
      direction: "boost",
      tag: tagFor("topic_clarity"),
      reason:
        judgeResult.topic_clarity.tags.length > 0
          ? `Topics: ${judgeResult.topic_clarity.tags.join(", ")}`
          : "No clear topic tags identified.",
    });

    const ptosValue = clamp(judgeResult.ptos_safety.severity / 3, 0, 1);
    llmSignals.push({
      id: "ptos_severity",
      label: "PTOS safety severity",
      value: ptosValue,
      contribution: WEIGHTS.ptos_severity * ptosValue,
      direction: "drag",
      tag: tagFor("ptos_severity"),
      reason: judgeResult.ptos_safety.reason,
    });

    if (judgeResult.reply_quality) {
      const replyValue = clamp(judgeResult.reply_quality.score / 3, 0, 1);
      llmSignals.push({
        id: "reply_quality",
        label: "Reply quality",
        value: replyValue,
        contribution: WEIGHTS.reply_quality * replyValue,
        direction: "boost",
        tag: tagFor("reply_quality"),
        reason: judgeResult.reply_quality.reason,
      });
    }
  }

  const heuristicNegatives: SignalRecord[] = [];
  if (args.baitFlags.length > 0) {
    const baitValue = clamp(args.baitFlags.length / 2, 0, 1);
    heuristicNegatives.push({
      id: "bait_detected",
      label: "Engagement-bait phrase detected",
      value: baitValue,
      contribution: WEIGHTS.bait_detected * baitValue,
      direction: "drag",
      tag: tagFor("bait_detected"),
      reason: `Matched: ${args.baitFlags.slice(0, 3).join(", ")}`,
    });
  }
  if (ptosKeywordHits.length > 0 && !judgeResult) {
    const ptosValue = clamp(ptosKeywordHits.length / 2, 0, 1);
    heuristicNegatives.push({
      id: "ptos_keyword_precheck",
      label: "PTOS keyword precheck",
      value: ptosValue,
      contribution: WEIGHTS.ptos_keyword_precheck * ptosValue,
      direction: "drag",
      tag: tagFor("ptos_keyword_precheck"),
      reason: `Lexicon hit: ${ptosKeywordHits.slice(0, 2).map((h) => h.category).join(", ")}. (LLM safety judge unavailable.)`,
    });
  }

  const allSignals = [...scoredContent, ...scoredContext, ...llmSignals, ...heuristicNegatives];

  const sumContribution = allSignals.reduce(
    (acc, s) => acc + s.contribution,
    0,
  );

  let fitScore = clamp(50 + sumContribution, 0, 100);
  if (hardCap !== null) {
    fitScore = Math.min(fitScore, hardCap);
  }
  fitScore = Math.round(fitScore);

  const originalitySignal = scoredContent.find((s) => s.id === "originality");
  const originalityValue = originalitySignal?.value ?? 1;

  const topicClarityScore = judgeResult?.topic_clarity.score ?? 0;
  const ptosSeverity = judgeResult?.ptos_safety.severity ?? 0;
  const slopScore = judgeResult?.slop.score ?? 0;

  const x =
    0.6 * ((fitScore - 50) / 10) +
    1.5 * (topicClarityScore / 10) +
    1.0 * (input.hasMedia ? 1 : 0) +
    0.8 * originalityValue -
    2.5 * (ptosSeverity / 3) -
    1.8 * (slopScore / 10);
  const breakoutRaw = 1 / (1 + Math.exp(-x));
  let breakoutPercent = Math.round(breakoutRaw * 100);
  const rawBucket: BreakoutBucket =
    breakoutRaw < 0.25 ? "low" : breakoutRaw < 0.55 ? "medium" : "high";
  let bucket = rawBucket;

  if (ptosSeverity >= 3) {
    fitScore = Math.min(fitScore, 10);
    breakoutPercent = Math.min(breakoutPercent, 5);
    bucket = "low";
    warnings.push("High-severity PTOS safety result; applying hard reach floor.");
  } else if (
    !judgeResult &&
    new Set(ptosKeywordHits.map((h) => h.category)).size >= 2
  ) {
    fitScore = Math.min(fitScore, 30);
  }

  let inputsFilled = 1;
  inputsFilled += input.hasMedia ? 1 : 0;
  inputsFilled += input.videoHasAudio ? 1 : 0;
  inputsFilled += input.isReply ? 1 : 0;
  inputsFilled += input.isThread ? 1 : 0;
  inputsFilled += input.premiumLongPost ? 1 : 0;
  inputsFilled += input.tweetsInLastHour > 0 ? 1 : 0;
  inputsFilled += input.targetFollowerSize ? 1 : 0;
  const totalInputs = 8;
  const inputRatio = inputsFilled / totalInputs;

  let confidence: Confidence;
  if (llmStatus === "degraded") confidence = "low";
  else if (inputRatio < 0.4) confidence = "low";
  else if (inputRatio < 0.7) confidence = "medium";
  else confidence = "high";

  if (input.newAccount) {
    confidence =
      confidence === "high"
        ? "medium"
        : confidence === "medium"
          ? "low"
          : "low";
  }

  if (ptosKeywordHits.length > 0) {
    warnings.push("PTOS keyword precheck hit");
  }
  if (input.premiumLongPost && input.text.length > 280) {
    warnings.push(
      "Premium long post: optimize the first 280 characters because that is the in-feed preview.",
    );
  }

  let outSuggestions: SuggestionItem[];
  if (suggestions === null) {
    warnings.push("Suggestions temporarily unavailable");
    outSuggestions = [];
  } else {
    outSuggestions = suggestions;
  }

  const sortedSignals = [...allSignals].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
  );

  return {
    fitScore,
    breakout: { bucket, percent: breakoutPercent },
    confidence,
    llmStatus,
    modelUsed,
    signals: sortedSignals,
    suggestions: outSuggestions,
    turnstileRequired,
    coldStartMode: input.newAccount,
    warnings,
  };
}
