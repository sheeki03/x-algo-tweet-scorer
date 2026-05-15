import { PTOS_CATEGORIES, type PtosCategory, type ScoringInput } from "./types";

export type HardFilterResult = {
  hardCap: number | null;
  baitFlags: string[];
  threadDetected: boolean;
  rtPrefix: boolean;
  ptosKeywordHits: { category: string; phrase: string }[];
  warnings: string[];
};

const BAIT_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: "RT if", regex: /\bRT\s+if\b/i },
  { label: "like if", regex: /\blike\s+if\b/i },
  { label: "comment X for", regex: /\bcomment\s+\S+\s+(?:for|to)\b/i },
  { label: "\u{1F447} below", regex: /\u{1F447}[^\n]{0,30}\bbelow\b/iu },
  { label: "\u{1F9F5} thread", regex: /\u{1F9F5}[^\n]{0,20}\bthread\b/iu },
  { label: "repost if", regex: /\brepost\s+if\b/i },
  { label: "share if", regex: /\bshare\s+if\b/i },
  { label: "tag a friend", regex: /\btag\s+a\s+friend\b/i },
];

const THREAD_PATTERNS: RegExp[] = [
  /^\s*\d+\/\d+/,
  /^\s*\d+\//,
  /\u{1F9F5}/u,
  /\(thread\)/i,
];

const RT_PREFIX_PATTERNS: RegExp[] = [
  /^\s*RT\s+@/,
  /^\s*QT\s+@/,
  /^RT\b/,
];

const PTOS_LEXICON: Record<PtosCategory, RegExp[]> = {
  ViolentMedia: [
    /\bgore\b/i,
    /\bbeheading\b/i,
    /\bdismember(?:ed|ment)?\b/i,
    /\bmutilat(?:ed|ion)\b/i,
    /\bgraphic\s+violence\b/i,
    /\bbloodbath\b/i,
    /\bexecution\s+video\b/i,
  ],
  AdultContent: [
    /\bporn(?:ography)?\b/i,
    /\bnudes?\b/i,
    /\bxxx\b/i,
    /\bnsfw\b/i,
    /\bonlyfans\b/i,
    /\bcamgirl\b/i,
    /\bsexting\b/i,
  ],
  Spam: [
    /\bbuy\s+followers\b/i,
    /\bclick\s+(?:here|link)\b/i,
    /\bfree\s+gift\s+card\b/i,
    /\bcrypto\s+airdrop\b/i,
    /\bget\s+rich\s+quick\b/i,
    /\bmlm\b/i,
    /\bpyramid\s+scheme\b/i,
    /\bdm\s+me\s+to\s+earn\b/i,
  ],
  IllegalAndRegulatedBehaviors: [
    /\bcocaine\b/i,
    /\bheroin\b/i,
    /\bmeth(?:amphetamine)?\b/i,
    /\bfentanyl\b/i,
    /\bbuy\s+a?\s*gun\b/i,
    /\bsell(?:ing)?\s+drugs\b/i,
    /\bcounterfeit\b/i,
    /\bmoney\s+laundering\b/i,
  ],
  HateOrAbuse: [
    /\bslur\b/i,
    /\bk[i1]ll\s+all\s+\w+/i,
    /\bsubhuman\b/i,
    /\bvermin\b/i,
    /\bethnic\s+cleansing\b/i,
    /\bwhite\s+power\b/i,
    /\bhate\s+speech\b/i,
  ],
  ViolentSpeech: [
    /\bi(?:'|\s+a)m\s+going\s+to\s+kill\b/i,
    /\bshoot\s+(?:up|them|him|her)\b/i,
    /\bbomb\s+(?:the|a)\b/i,
    /\bmurder\s+you\b/i,
    /\bdeath\s+threat\b/i,
    /\bbeat\s+(?:you|them)\s+to\s+death\b/i,
    /\blynch\b/i,
  ],
  SuicideOrSelfHarm: [
    /\bkill\s+myself\b/i,
    /\bsuicide\s+method\b/i,
    /\bself[-\s]?harm\b/i,
    /\bcut\s+myself\b/i,
    /\bend\s+it\s+all\b/i,
    /\bhow\s+to\s+overdose\b/i,
    /\bnoose\b/i,
  ],
};

export function runHardFilters(input: ScoringInput): HardFilterResult {
  const text = input.text ?? "";
  const trimmed = text.trim();
  const nonWhitespaceLen = text.replace(/\s+/g, "").length;

  const warnings: string[] = [];
  let hardCap: number | null = null;

  if (trimmed.length === 0 || nonWhitespaceLen < 10) {
    hardCap = 20;
    warnings.push("Too short to evaluate.");
  }
  if (input.premiumLongPost && text.length > 280) {
    warnings.push(
      "Premium long post mode: the first 280 characters still carry the in-feed preview.",
    );
  }

  const baitFlags: string[] = [];
  for (const pattern of BAIT_PATTERNS) {
    if (pattern.regex.test(text)) baitFlags.push(pattern.label);
  }

  const threadDetected = THREAD_PATTERNS.some((re) => re.test(text));
  const rtPrefix = RT_PREFIX_PATTERNS.some((re) => re.test(text));

  const ptosKeywordHits: { category: string; phrase: string }[] = [];
  const hitCategories = new Set<string>();
  for (const category of PTOS_CATEGORIES) {
    const patterns = PTOS_LEXICON[category];
    for (const re of patterns) {
      const match = text.match(re);
      if (match) {
        ptosKeywordHits.push({ category, phrase: match[0] });
        hitCategories.add(category);
      }
    }
  }

  if (hitCategories.size >= 2) {
    warnings.push(
      "Multiple PTOS lexicon categories matched; safety judge will confirm.",
    );
  }

  return {
    hardCap,
    baitFlags,
    threadDetected,
    rtPrefix,
    ptosKeywordHits,
    warnings,
  };
}
