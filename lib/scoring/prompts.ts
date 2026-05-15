import type { ScoringInput, SignalDirection } from "./types";
import { PTOS_CATEGORIES } from "./types";

const LLM_FULL_TEXT_LIMIT = 6_000;
const LLM_HEAD_CHARS = 4_000;
const LLM_TAIL_CHARS = 1_500;

function llmVisibleText(text: string): string {
  if (text.length <= LLM_FULL_TEXT_LIMIT) return text;
  return [
    text.slice(0, LLM_HEAD_CHARS),
    `\n\n[...middle omitted for scoring budget; original length ${text.length} characters...]\n\n`,
    text.slice(-LLM_TAIL_CHARS),
  ].join("");
}

export const JUDGE_ALL_SYSTEM_PROMPT = `You are a scorer for a tool that analyzes how well a draft tweet aligns with the publicly open-sourced X (Twitter) recommendation algorithm at xai-org/x-algorithm@e414c17. You are NOT predicting whether a tweet will actually break out — you produce explainable, source-anchored judgments only.

ALGORITHM ANCHORS (the only rules you may reference):

1. Slop classifier — \`grox/classifiers/content/banger_initial_screen.py\` (BangerInitialScreenClassifier). It outputs \`slop_score\` and \`quality_score\`. Slop = engagement bait, low-effort content, ragebait, copypasta, reply-guy filler, generic motivational posts, "RT if you agree" style. Quality = original thought, useful information, specificity, a clear point, a real hook.

2. PTOS safety — \`grox/classifiers/content/safety_ptos.py\`. EXACTLY these 7 category names (case-sensitive, no others permitted): ${PTOS_CATEGORIES.join(", ")}. Severity is 0 (none) | 1 (low) | 2 (medium) | 3 (high — hard floor on reach). Return category = null and severity = 0 when nothing applies.

3. ReplyScorer — \`grox/classifiers/content/reply_ranking.py\`. Scores a reply 0-3 against the parent post quality, but ONLY runs on the high-follower path. If the input is not a reply, or targetFollowerSize == "lt1k", reply_quality MUST be null.

4. Topic-based discovery — \`phoenix_topics_source.rs\`, \`followed_grok_topics_query_hydrator.rs\`, \`inferred_grok_topics_query_hydrator.rs\`. Tweets with a single, clear topic surface in the topics path; vague/multi-topic tweets do not. Tags should be short noun-phrase topic labels (e.g. "AI safety", "founder advice", "F1"), 1-3 of them.

5. X Premium longer posts — Premium subscribers can post longer drafts, but this tool still treats the first 280 characters as the in-feed preview surface. Long-form support changes the allowed length, not the importance of hook quality and topic clarity.

HARD RULES:
- You do NOT have engagement counts, follow graph, viewer history, or live impressions. You CANNOT predict actual rank or breakout. Never claim calibrated predictions.
- You do NOT know the production weight values. Never invent or cite specific numeric weights.
- Output strictly the JSON shape required by the schema. No extra fields, no prose outside JSON.
- \`reply_quality\` is null whenever isReply == false OR targetFollowerSize == "lt1k". Otherwise it is { score: 0|1|2|3, reason: string }.
- \`ptos_safety.category\` must be one of: ${PTOS_CATEGORIES.join(" | ")} or null. No other strings.
- Reasons are one short English sentence, max ~120 characters, no quoting of the tweet text.
- Scores are integers within their stated ranges.`;

export const JUDGE_ALL_USER_TEMPLATE = (input: ScoringInput) => `Score the following tweet draft against the algorithm anchors.

TWEET:
${llmVisibleText(input.text)}

CONTEXT:
- originalCharCount: ${input.text.length}
- premiumLongPost: ${input.premiumLongPost}
- hasMedia: ${input.hasMedia}
- videoHasAudio: ${input.videoHasAudio}
- isReply: ${input.isReply}
- isThread: ${input.isThread}
- newAccount: ${input.newAccount}
- tweetsInLastHour: ${input.tweetsInLastHour}
- targetFollowerSize: ${input.targetFollowerSize ?? "n/a"}

Return ONLY the JSON object matching the schema. Set reply_quality to null when isReply is false or targetFollowerSize is "lt1k".`;

export const SUGGESTIONS_SYSTEM_PROMPT = `You rewrite tweet drafts to better align with the publicly open-sourced X algorithm at xai-org/x-algorithm@e414c17.

You will be given:
1. The original tweet text.
2. The current judge scores (slop, quality, topic_clarity, ptos_safety, optional reply_quality).
3. The deterministic signal weaknesses (the signals currently dragging the score down or signals that, if boosted, would raise it).

Return 3-5 suggestions. Each one must:
- Identify a concrete weakness (\`issue\`) by name (e.g. "slop: engagement-bait phrasing", "topic_clarity: two unrelated ideas", "length: under sweet spot", "hook: weak opener", "specificity: vague", "originality: starts as quote/RT").
- Provide a \`suggestion\` that is a concrete rewrite or specific edit a human can apply in under 30 seconds. Where feasible, include a short example rewrite in quotes.
- Estimate \`expected_lift_pp\`: an integer percentage-point lift on the Algorithm Fit Score if applied alone. Realistic range is 0-30. Values above 15 must be reserved for fixing a clearly high-weight signal (slop, quality, ptos_safety, topic_clarity, reply_quality). Heuristic-only fixes (length, hashtag spam, link count, mentions) max out around 8.

Hard rules:
- Anchor every suggestion to one of: slop, quality, topic_clarity, ptos_safety, reply_quality, originality, has_media, audio_video, length_in_sweet_spot, hook_present, specificity, cadence_penalty, hashtag_spam, link_heavy, mention_excess, thread_dump.
- Do not invent X algorithm features that are not in that list.
- Do not claim calibrated predictions; the lift number is an explainable estimate.
- No advice about posting time, follower count, or off-content tactics — only edits to the draft itself.
- For standard posts, example rewrites should fit under 280 characters. For Premium long posts, prioritize the opening 280 characters, structure, topic focus, and safety/quality improvements rather than rewriting the whole post.
- Output strictly the JSON shape required by the schema.`;

type SuggestionSignal = { id: string; value: number; direction: SignalDirection };

export const SUGGESTIONS_USER_TEMPLATE = (
  input: ScoringInput,
  signals: SuggestionSignal[],
  judge: {
    slop: { score: number };
    quality: { score: number };
    topic_clarity: { score: number; tags: string[] };
    ptos_safety: { category: string | null; severity: number };
    reply_quality: { score: number } | null;
  },
) => `TWEET:
${llmVisibleText(input.text)}

POST MODE:
- originalCharCount: ${input.text.length}
- premiumLongPost: ${input.premiumLongPost}
- activeCharacterLimit: ${input.premiumLongPost ? "25000" : "280"}

JUDGE SCORES:
- slop: ${judge.slop.score}/10
- quality: ${judge.quality.score}/10
- topic_clarity: ${judge.topic_clarity.score}/10 (tags: ${judge.topic_clarity.tags.join(", ") || "none"})
- ptos_safety: category=${judge.ptos_safety.category ?? "none"}, severity=${judge.ptos_safety.severity}
- reply_quality: ${judge.reply_quality ? `${judge.reply_quality.score}/3` : "n/a"}

DETERMINISTIC SIGNALS (id | value | direction):
${signals.map((s) => `- ${s.id} | ${s.value.toFixed(3)} | ${s.direction}`).join("\n") || "- (none)"}

Return ONLY the JSON object matching the schema with 3-5 suggestions, ranked by expected_lift_pp descending.`;

export const JUDGE_ALL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["slop", "quality", "topic_clarity", "ptos_safety", "reply_quality"],
  properties: {
    slop: {
      type: "object",
      additionalProperties: false,
      required: ["score", "reason"],
      properties: {
        score: { type: "integer", minimum: 0, maximum: 10 },
        reason: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
    quality: {
      type: "object",
      additionalProperties: false,
      required: ["score", "reason"],
      properties: {
        score: { type: "integer", minimum: 0, maximum: 10 },
        reason: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
    topic_clarity: {
      type: "object",
      additionalProperties: false,
      required: ["score", "tags"],
      properties: {
        score: { type: "integer", minimum: 0, maximum: 10 },
        tags: {
          type: "array",
          minItems: 0,
          maxItems: 5,
          items: { type: "string", minLength: 1, maxLength: 40 },
        },
      },
    },
    ptos_safety: {
      type: "object",
      additionalProperties: false,
      required: ["category", "severity", "reason"],
      properties: {
        category: {
          type: ["string", "null"],
          enum: [...PTOS_CATEGORIES, null],
        },
        severity: { type: "integer", minimum: 0, maximum: 3 },
        reason: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
    reply_quality: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["score", "reason"],
      properties: {
        score: { type: "integer", minimum: 0, maximum: 3 },
        reason: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
  },
} as const;

export const SUGGESTIONS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["issue", "suggestion", "expected_lift_pp"],
        properties: {
          issue: { type: "string", minLength: 1, maxLength: 120 },
          suggestion: { type: "string", minLength: 1, maxLength: 480 },
          expected_lift_pp: { type: "integer", minimum: 0, maximum: 30 },
        },
      },
    },
  },
} as const;
