import type { SignalTag } from "./types";

export type VerifiedEntry = {
  tag: SignalTag;
  sourceFile?: string;
  note?: string;
};

/**
 * Maps each signal id used by the scorer to its evidence tag.
 * - `verified`: rule + direction both present in xai-org/x-algorithm@e414c17.
 * - `verified-feature-estimated-effect`: feature exists in repo; size/direction is heuristic.
 * - `heuristic`: platform-hygiene best-practice, not source-backed.
 */
export const VERIFIED_REGISTRY: Record<string, VerifiedEntry> = {
  // Officially verified rules
  slop: {
    tag: "verified",
    sourceFile: "grox/classifiers/content/banger_initial_screen.py",
    note: "BangerInitialScreenClassifier outputs slop_score",
  },
  quality: {
    tag: "verified",
    sourceFile: "grox/classifiers/content/banger_initial_screen.py",
    note: "BangerInitialScreenClassifier.quality_score",
  },
  ptos_severity: {
    tag: "verified",
    sourceFile: "grox/classifiers/content/safety_ptos.py",
    note: "7-category PTOS safety classifier; severity 3 = hard floor",
  },
  topic_clarity: {
    tag: "verified",
    sourceFile: "home-mixer/sources/phoenix_topics_source.rs",
    note: "Topic-based discovery in May 15 update",
  },
  reply_quality: {
    tag: "verified",
    sourceFile: "grox/classifiers/content/reply_ranking.py",
    note: "ReplyScorer 0-3 for high-follower posts",
  },
  originality: {
    tag: "verified",
    sourceFile: "home-mixer/filters/retweet_deduplication_filter.rs",
    note: "Retweet dedup penalizes RT/quote prefixes",
  },
  thread_dump: {
    tag: "verified",
    sourceFile: "home-mixer/filters/dedup_conversation_filter.rs",
    note: "Conversation dedup picks highest-scored thread tweet only",
  },

  // Verified feature, estimated effect
  has_media: {
    tag: "verified-feature-estimated-effect",
    sourceFile: "home-mixer/candidate_hydrators/has_media_hydrator.rs",
    note: "has_media is hydrated; boost size is our heuristic",
  },
  audio_video: {
    tag: "verified-feature-estimated-effect",
    sourceFile: "grox/data_loaders/asr_processor.py",
    note: "FFmpeg ASR feeds into multimodal_post_embedder_v5; boost size heuristic",
  },
  cadence_penalty: {
    tag: "verified-feature-estimated-effect",
    sourceFile: "home-mixer/scorers/author_diversity_scorer.rs",
    note: "Author-diversity decay is real; >2-3 posts/hour trigger is our heuristic",
  },
  cold_start_mode: {
    tag: "verified-feature-estimated-effect",
    sourceFile: "home-mixer/scorers/vm_ranker.rs",
    note: "new_user_age_threshold_secs routes low-history users; we map this to confidence drop, not breakout penalty",
  },

  // Heuristic precheck signals (regex/lexicon proxies for the verified LLM judges)
  bait_detected: {
    tag: "heuristic",
    note: "Regex precheck for engagement-bait phrases (RT if, like if, 👇 below, ...). Verified slop classifier exists in grox/banger_initial_screen.py but this regex is our heuristic.",
  },
  ptos_keyword_precheck: {
    tag: "heuristic",
    note: "Lexicon precheck for the 7 PTOS categories. Applied only when the LLM safety judge is unavailable.",
  },

  // Heuristic (platform hygiene; NOT source-backed)
  length_in_sweet_spot: {
    tag: "heuristic",
    note: "70-240 char sweet spot is platform best-practice",
  },
  hook_present: {
    tag: "heuristic",
    note: "Question/number/strong opener in first 70 chars",
  },
  specificity: {
    tag: "heuristic",
    note: "Proper nouns or numbers indicate concrete content",
  },
  hashtag_spam: {
    tag: "heuristic",
    note: ">3 hashtags depresses reach (platform hygiene)",
  },
  link_heavy: {
    tag: "heuristic",
    note: "X tends to depress link-heavy posts (platform hygiene)",
  },
  mention_excess: {
    tag: "heuristic",
    note: "Excessive @-mentions read as spam (platform hygiene)",
  },
};

export function tagFor(id: string): SignalTag {
  return VERIFIED_REGISTRY[id]?.tag ?? "heuristic";
}

export function sourceFor(id: string): string | undefined {
  return VERIFIED_REGISTRY[id]?.sourceFile;
}

export function noteFor(id: string): string | undefined {
  return VERIFIED_REGISTRY[id]?.note;
}
