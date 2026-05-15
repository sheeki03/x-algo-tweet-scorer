import type { ScoringInput, SignalRecord } from "./types";
import { tagFor } from "./verifiedRegistry";
import { runHardFilters } from "./hardFilters";

const HOOK_PATTERNS: RegExp[] = [
  /\?/,
  /^\s*\d/,
  /^\s*How\b/,
  /^\s*Why\b/,
  /^\s*I\b/,
  /^\s*You\b/,
];

const URL_REGEX = /https?:\/\/\S+/gi;
const HASHTAG_REGEX = /(?:^|\s)#[\p{L}\p{N}_]+/giu;
const MENTION_REGEX = /(?:^|\s)@[A-Za-z0-9_]+/g;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function countMatches(text: string, regex: RegExp): number {
  const m = text.match(regex);
  return m ? m.length : 0;
}

function specificityScore(text: string): number {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  let properNouns = 0;
  let digitTokens = 0;

  tokens.forEach((tok, idx) => {
    const stripped = tok.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!stripped) return;
    if (/^\d[\d.,%]*$/.test(stripped)) {
      digitTokens += 1;
      return;
    }
    if (idx === 0) return;
    const first = stripped.charAt(0);
    if (first === first.toUpperCase() && first !== first.toLowerCase()) {
      properNouns += 1;
    }
  });

  return clamp01((properNouns + digitTokens) / 3);
}

export function extractContentSignals(
  input: ScoringInput,
  hard: ReturnType<typeof runHardFilters>,
): SignalRecord[] {
  const text = input.text ?? "";
  const charCount = text.length;
  const head = text.slice(0, 70);

  const inSweetSpot = charCount >= 70 && charCount <= 240 ? 1 : 0;
  const hookPresent = HOOK_PATTERNS.some((re) => re.test(head)) ? 1 : 0;
  const specificity = specificityScore(text);
  const originality = hard.rtPrefix ? 0 : 1;

  const hashtagCount = countMatches(text, HASHTAG_REGEX);
  const linkCount = countMatches(text, URL_REGEX);
  const mentionCount = countMatches(text, MENTION_REGEX);

  const hashtagSpam = Math.max(0, (hashtagCount - 2) / 4);
  const linkHeavy = Math.min(linkCount / 2, 1);
  const mentionExcess = Math.max(0, (mentionCount - 2) / 4);
  const threadDump = hard.threadDetected || input.isThread ? 1 : 0;

  const signals: SignalRecord[] = [
    {
      id: "length_in_sweet_spot",
      label: "Length in sweet spot",
      value: inSweetSpot,
      contribution: 0,
      direction: "boost",
      tag: tagFor("length_in_sweet_spot"),
      reason:
        inSweetSpot === 1
          ? `${charCount} chars sits in the 70-240 sweet spot.`
          : `${charCount} chars is outside the 70-240 sweet spot.`,
    },
    {
      id: "hook_present",
      label: "Hook in first 70 chars",
      value: hookPresent,
      contribution: 0,
      direction: "boost",
      tag: tagFor("hook_present"),
      reason:
        hookPresent === 1
          ? "Opens with a question, number, or strong pronoun/word."
          : "No question, number, or strong opener detected in the first 70 chars.",
    },
    {
      id: "specificity",
      label: "Specificity (proper nouns + numbers)",
      value: clamp01(specificity),
      contribution: 0,
      direction: "boost",
      tag: tagFor("specificity"),
      reason: "Proper-noun and digit tokens are proxies for concrete content.",
    },
    {
      id: "originality",
      label: "Originality (no RT/QT prefix)",
      value: originality,
      contribution: 0,
      direction: "boost",
      tag: tagFor("originality"),
      reason: hard.rtPrefix
        ? "Starts with RT/QT prefix; retweet-dedup collapses these."
        : "No retweet/quote prefix detected.",
    },
    {
      id: "hashtag_spam",
      label: "Hashtag spam",
      value: clamp01(hashtagSpam),
      contribution: 0,
      direction: "drag",
      tag: tagFor("hashtag_spam"),
      reason: `${hashtagCount} hashtags detected; >2 starts to depress reach.`,
    },
    {
      id: "link_heavy",
      label: "Link heavy",
      value: clamp01(linkHeavy),
      contribution: 0,
      direction: "drag",
      tag: tagFor("link_heavy"),
      reason: `${linkCount} link${linkCount === 1 ? "" : "s"} detected; X depresses link-heavy posts.`,
    },
    {
      id: "mention_excess",
      label: "Mention excess",
      value: clamp01(mentionExcess),
      contribution: 0,
      direction: "drag",
      tag: tagFor("mention_excess"),
      reason: `${mentionCount} @-mentions detected; >2 reads as spam.`,
    },
    {
      id: "thread_dump",
      label: "Thread dump",
      value: threadDump,
      contribution: 0,
      direction: "drag",
      tag: tagFor("thread_dump"),
      reason:
        hard.threadDetected || input.isThread
          ? "Conversation dedup keeps only the highest-scored thread tweet."
          : "No thread marker detected.",
    },
  ];

  return signals;
}
