import type { ScoringInput, SignalRecord } from "./types";
import { tagFor } from "./verifiedRegistry";

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

export function extractContextSignals(input: ScoringInput): SignalRecord[] {
  const signals: SignalRecord[] = [];

  const hasMedia = input.hasMedia ? 1 : 0;
  signals.push({
    id: "has_media",
    label: "Has media",
    value: hasMedia,
    contribution: 0,
    direction: "boost",
    tag: tagFor("has_media"),
    reason: input.hasMedia
      ? "Media attached; has_media_hydrator surfaces this candidate-side."
      : "No media attached.",
  });

  const audioVideo = input.hasMedia && input.videoHasAudio ? 1 : 0;
  signals.push({
    id: "audio_video",
    label: "Audio/video with speech",
    value: audioVideo,
    contribution: 0,
    direction: "boost",
    tag: tagFor("audio_video"),
    reason:
      audioVideo === 1
        ? "Spoken audio feeds the ASR pipeline into the multimodal embedder."
        : "No spoken audio flagged.",
  });

  const cadenceValue = clamp((input.tweetsInLastHour - 2) / 4, 0, 1);
  if (cadenceValue > 0) {
    signals.push({
      id: "cadence_penalty",
      label: "Cadence penalty",
      value: cadenceValue,
      contribution: 0,
      direction: "drag",
      tag: tagFor("cadence_penalty"),
      reason: `${input.tweetsInLastHour} posts in the last hour; author-diversity scorer decays repeat authors.`,
    });
  }

  return signals;
}
