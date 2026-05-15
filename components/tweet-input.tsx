"use client";

import { useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScoringInput, TargetFollowerSize } from "@/lib/scoring/types";

type Props = {
  value: ScoringInput;
  onChange: (next: ScoringInput) => void;
  onSubmit: () => void;
  loading: boolean;
  turnstileRequired: boolean;
  turnstileSiteKey?: string;
  turnstileResetNonce: number;
  turnstileSatisfied: boolean;
  onTurnstileToken?: (token: string) => void;
};

const SWEET_SPOT_MIN = 70;
const SWEET_SPOT_MAX = 240;
const STANDARD_MAX_LEN = 280;
const PREMIUM_MAX_LEN = 25_000;

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void },
      ) => string;
      reset: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

function lengthBadge(
  len: number,
  premiumLongPost: boolean,
): { label: string; tone: string; dot: string } {
  const maxLen = premiumLongPost ? PREMIUM_MAX_LEN : STANDARD_MAX_LEN;
  if (len === 0) return { label: "—", tone: "text-ink-faint", dot: "bg-ink-faint" };
  if (len < SWEET_SPOT_MIN) return { label: "too short", tone: "text-warn", dot: "bg-warn" };
  if (len > maxLen) return { label: "too long", tone: "text-neg", dot: "bg-neg" };
  if (premiumLongPost && len > STANDARD_MAX_LEN) {
    return { label: "premium long", tone: "text-tw-blue", dot: "bg-tw-blue" };
  }
  if (len > SWEET_SPOT_MAX) return { label: "long", tone: "text-warn", dot: "bg-warn" };
  return { label: "sweet spot", tone: "text-pos", dot: "bg-pos" };
}

export function TweetInput({
  value,
  onChange,
  onSubmit,
  loading,
  turnstileRequired,
  turnstileSiteKey,
  turnstileResetNonce,
  turnstileSatisfied,
  onTurnstileToken,
}: Props) {
  const len = value.text.length;
  const activeMaxLen = value.premiumLongPost ? PREMIUM_MAX_LEN : STANDARD_MAX_LEN;
  const lb = lengthBadge(len, value.premiumLongPost);
  const canSubmit = len > 0 && len <= activeMaxLen && !loading && turnstileSatisfied;
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!turnstileRequired || !turnstileSiteKey || !onTurnstileToken) return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const render = () => {
      if (cancelled || !turnstileRef.current) return;
      if (turnstileWidgetRef.current) {
        window.turnstile?.reset(turnstileWidgetRef.current);
        return;
      }
      if (window.turnstile?.render) {
        turnstileWidgetRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          callback: onTurnstileToken,
        });
        return;
      }
      if (attempts < 30) {
        attempts += 1;
        timer = setTimeout(render, 200);
      }
    };

    render();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [onTurnstileToken, turnstileRequired, turnstileResetNonce, turnstileSiteKey]);

  useEffect(() => {
    if (turnstileRequired || !turnstileWidgetRef.current) return;
    window.turnstile?.remove?.(turnstileWidgetRef.current);
    turnstileWidgetRef.current = null;
  }, [turnstileRequired]);

  return (
    <div className="flex flex-col gap-7">
      {/* Draft block */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="tweet" className="eyebrow">
            Draft tweet
          </Label>
          <div className="flex items-baseline gap-3">
            <span
              className={`tick inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] ${lb.tone}`}
            >
              <span aria-hidden="true" className={`size-1.5 rounded-full ${lb.dot}`} />
              {lb.label}
            </span>
            <span
              className={`tick text-[12px] ${
                len > activeMaxLen ? "text-neg" : "text-ink-faint"
              }`}
            >
              {len.toLocaleString()}/{activeMaxLen.toLocaleString()}
            </span>
          </div>
        </div>
        <Textarea
          id="tweet"
          name="tweet"
          rows={value.premiumLongPost ? 9 : 5}
          maxLength={PREMIUM_MAX_LEN}
          placeholder="What's happening? Paste your draft tweet here…"
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          className="resize-none rounded-2xl border border-hairline-strong bg-canvas px-4 py-3 text-[1.0625rem] leading-[1.5] text-ink shadow-none placeholder:text-ink-faint focus-visible:border-tw-blue focus-visible:ring-2 focus-visible:ring-tw-blue/30 md:text-[1.0625rem]"
        />
        <p className="text-[11.5px] leading-[1.45] text-ink-faint">
          Standard posts cap at 280 characters. Premium long-post mode accepts
          up to 25,000 characters, but the first 280 still matter most in-feed.
        </p>
      </div>

      {/* Parameters block */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Context parameters</p>
          <p className="tick text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            Affects signal weights
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ToggleRow
            id="hasMedia"
            label="Has image or video"
            checked={value.hasMedia}
            onChange={(v) =>
              onChange({
                ...value,
                hasMedia: v,
                videoHasAudio: v ? value.videoHasAudio : false,
              })
            }
          />
          <ToggleRow
            id="videoHasAudio"
            label="Video has spoken audio"
            disabled={!value.hasMedia}
            checked={value.videoHasAudio}
            onChange={(v) => onChange({ ...value, videoHasAudio: v })}
          />
          <ToggleRow
            id="isReply"
            label="Posting as a reply"
            checked={value.isReply}
            onChange={(v) =>
              onChange({
                ...value,
                isReply: v,
                targetFollowerSize: v
                  ? value.targetFollowerSize ?? "1k_100k"
                  : null,
              })
            }
          />
          <ToggleRow
            id="isThread"
            label="Part of a thread"
            checked={value.isThread}
            onChange={(v) => onChange({ ...value, isThread: v })}
          />
          <ToggleRow
            id="premiumLongPost"
            label="Premium long post (25k)"
            checked={Boolean(value.premiumLongPost)}
            onChange={(v) => onChange({ ...value, premiumLongPost: v })}
          />
          <ToggleRow
            id="newAccount"
            label="New account (< 30 days)"
            checked={value.newAccount}
            onChange={(v) => onChange({ ...value, newAccount: v })}
          />
          <NumericRow
            id="tph"
            label="Tweets in last hour"
            value={value.tweetsInLastHour}
            onChange={(n) =>
              onChange({ ...value, tweetsInLastHour: Math.max(0, n) })
            }
          />
          {value.isReply && (
            <div className="flex flex-col gap-2 rounded-2xl border border-hairline bg-canvas-2 px-4 py-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="tfs" className="text-[13px] font-medium text-ink">
                Target account followers
              </Label>
              <div className="relative inline-grid grid-cols-[1fr_--spacing(7)] items-center">
                <select
                  id="tfs"
                  name="targetFollowerSize"
                  value={value.targetFollowerSize ?? "1k_100k"}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      targetFollowerSize: e.target.value as TargetFollowerSize,
                    })
                  }
                  className="tick col-span-full row-start-1 appearance-none rounded-full border border-hairline-strong bg-canvas py-1.5 pr-7 pl-3 text-[13px] text-ink outline-none focus-visible:border-tw-blue focus-visible:ring-2 focus-visible:ring-tw-blue/30"
                >
                  <option value="lt1k">&lt; 1k</option>
                  <option value="1k_100k">1k – 100k</option>
                  <option value="gt100k">&gt; 100k</option>
                </select>
                <svg
                  viewBox="0 0 8 5"
                  width="8"
                  height="5"
                  fill="none"
                  className="pointer-events-none col-start-2 row-start-1 place-self-center"
                  aria-hidden="true"
                >
                  <path d="M.5.5 4 4 7.5.5" stroke="currentcolor" />
                </svg>
              </div>
            </div>
          )}
        </dl>
      </div>

      {turnstileRequired && turnstileSiteKey && (
        <div className="flex justify-center rounded-2xl border border-hairline bg-canvas px-3 py-3">
          <div ref={turnstileRef} />
        </div>
      )}

      <Button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="h-12 w-full justify-center rounded-full bg-tw-blue px-5 text-[15px] font-semibold text-white transition-colors hover:bg-tw-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Scoring…" : "Score this draft"}
      </Button>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-canvas-2 px-4 py-3 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <Label htmlFor={id} className="text-[13.5px] font-normal text-ink">
        {label}
      </Label>
      <Switch
        id={id}
        aria-label={label}
        checked={Boolean(checked)}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

function NumericRow({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-canvas-2 px-4 py-3">
      <Label htmlFor={id} className="text-[13.5px] font-normal text-ink">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        type="number"
        min={0}
        max={50}
        value={value}
        onChange={(e) =>
          onChange(Math.max(0, parseInt(e.target.value || "0", 10) || 0))
        }
        className="tick h-8 w-16 rounded-full border border-hairline-strong bg-canvas px-2.5 py-0 text-right text-[13px] text-ink shadow-none focus-visible:border-tw-blue focus-visible:ring-2 focus-visible:ring-tw-blue/30 md:text-[13px]"
      />
    </div>
  );
}
