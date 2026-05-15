"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ByokConfig } from "@/app/page";

type Props = {
  byok: ByokConfig;
  onByokChange: (next: ByokConfig) => void;
};

export function SettingsDrawer({
  byok,
  onByokChange,
}: Props) {
  const [keyDraft, setKeyDraft] = useState(byok.apiKey);
  const [baseDraft, setBaseDraft] = useState(byok.baseUrl);
  const [modelDraft, setModelDraft] = useState(byok.modelId);
  const [showKey, setShowKey] = useState(false);

  const applyByok = () => {
    onByokChange({
      enabled: true,
      apiKey: keyDraft.trim(),
      baseUrl: baseDraft.trim() || "https://openrouter.ai/api/v1",
      modelId: modelDraft.trim(),
    });
  };

  const disableByok = () => {
    onByokChange({ ...byok, enabled: false });
  };

  const byokReady = byok.enabled && byok.apiKey && byok.modelId;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Settings"
          className="relative rounded-full border border-hairline-strong bg-transparent text-ink hover:border-tw-blue hover:bg-tw-blue-soft hover:text-tw-blue"
        >
          <SettingsIcon />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[440px] overflow-y-auto rounded-l-3xl border-l border-hairline bg-canvas text-ink sm:w-[560px] sm:max-w-none">
        <SheetHeader className="border-b border-hairline px-7 py-6">
          <p className="eyebrow">§ Settings</p>
          <SheetTitle className="mt-2 text-[1.5rem] font-bold leading-tight tracking-tight text-ink">
            Run configuration
          </SheetTitle>
          <SheetDescription className="mt-1 text-[13px] leading-[1.55] text-ink-soft">
            The bundled scorer is hard-locked to Arcee. Bring your own key
            (BYOK) if you want to use a different provider or model.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-7 px-7 py-7">
          <section className="flex flex-col gap-3 rounded-2xl border border-hairline bg-canvas-2 px-5 py-5">
            <header className="flex items-baseline justify-between">
              <Label className="text-[13px] font-semibold text-ink">
                Bundled scorer
              </Label>
              <span className="tick text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                {byok.enabled ? "disabled · using BYOK" : "locked"}
              </span>
            </header>
            <p className="text-[12.5px] leading-[1.55] text-ink-soft">
              Server-funded scoring always uses the single hardcoded model
              below. Client-side model overrides are ignored unless BYOK is
              enabled with your own key.
            </p>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline-strong bg-canvas px-4 py-3">
              <span className="text-[13px] font-medium text-ink">
                Arcee Trinity Large Thinking
              </span>
              <code className="tick min-w-0 truncate text-[11px] text-ink-faint">
                arcee-ai/trinity-large-thinking:free
              </code>
            </div>
          </section>

          {/* ─── BYOK toggle + form ─────────────────────────────────── */}
          <section className="flex flex-col gap-4 rounded-2xl border border-tw-blue/30 bg-tw-blue-soft px-5 py-5">
            <header className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-[13px] font-semibold text-ink">
                  Bring your own key (BYOK)
                </p>
                <p className="text-[12.5px] leading-[1.55] text-ink-soft">
                  Route scoring through your own OpenRouter (or
                  OpenAI-compatible) endpoint with your own API key and any
                  model you want.
                </p>
              </div>
              <Switch
                aria-label="Enable BYOK"
                checked={Boolean(byok.enabled)}
                onCheckedChange={(v) =>
                  v
                    ? onByokChange({
                        enabled: true,
                        apiKey: keyDraft.trim(),
                        baseUrl: baseDraft.trim() || "https://openrouter.ai/api/v1",
                        modelId: modelDraft.trim(),
                      })
                    : disableByok()
                }
              />
            </header>

            {byok.enabled && (
              <div className="flex flex-col gap-4">
                {/* Base URL */}
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="byokBase"
                    className="text-[12px] font-medium text-ink"
                  >
                    Base URL
                  </Label>
                  <Input
                    id="byokBase"
                    name="byokBase"
                    placeholder="https://openrouter.ai/api/v1"
                    value={baseDraft}
                    onChange={(e) => setBaseDraft(e.target.value)}
                    aria-label="OpenAI-compatible base URL"
                    className="tick rounded-full border border-hairline-strong bg-canvas px-3 text-[13px] text-ink shadow-none placeholder:text-ink-faint focus-visible:border-tw-blue focus-visible:ring-2 focus-visible:ring-tw-blue/30 md:text-[13px]"
                  />
                  <p className="text-[11.5px] leading-[1.4] text-ink-faint">
                    Public HTTPS OpenAI-compatible v1 endpoint. Defaults to
                    OpenRouter; private/local URLs are rejected server-side.
                  </p>
                </div>

                {/* API key */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label
                      htmlFor="byokKey"
                      className="text-[12px] font-medium text-ink"
                    >
                      API key
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="tick text-[10px] uppercase tracking-wide text-ink-faint hover:text-tw-blue"
                    >
                      {showKey ? "hide" : "show"}
                    </button>
                  </div>
                  <Input
                    id="byokKey"
                    name="byokKey"
                    type={showKey ? "text" : "password"}
                    placeholder="sk-or-v1-…"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    aria-label="OpenRouter API key"
                    autoComplete="off"
                    spellCheck={false}
                    className="tick rounded-full border border-hairline-strong bg-canvas px-3 text-[13px] text-ink shadow-none placeholder:text-ink-faint focus-visible:border-tw-blue focus-visible:ring-2 focus-visible:ring-tw-blue/30 md:text-[13px]"
                  />
                  <p className="text-[11.5px] leading-[1.4] text-ink-faint">
                    Held in-memory only. Sent to the scoring endpoint over
                    HTTPS. Not stored in localStorage.
                  </p>
                </div>

                {/* Model id — free text since user brings their own quota */}
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="byokModel"
                    className="text-[12px] font-medium text-ink"
                  >
                    Model
                  </Label>
                  <Input
                    id="byokModel"
                    name="byokModel"
                    placeholder="e.g. anthropic/claude-sonnet-4.5 or openai/gpt-4o"
                    value={modelDraft}
                    onChange={(e) => setModelDraft(e.target.value)}
                    aria-label="Model identifier"
                    autoComplete="off"
                    spellCheck={false}
                    className="tick rounded-full border border-hairline-strong bg-canvas px-3 text-[13px] text-ink shadow-none placeholder:text-ink-faint focus-visible:border-tw-blue focus-visible:ring-2 focus-visible:ring-tw-blue/30 md:text-[13px]"
                  />
                  <p className="text-[11.5px] leading-[1.4] text-ink-faint">
                    Any model your provider exposes. Structured-output
                    capable models work best.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={applyByok}
                    disabled={!keyDraft.trim() || !modelDraft.trim()}
                    className="rounded-full bg-tw-blue px-4 text-[13px] font-semibold text-white hover:bg-tw-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Apply BYOK
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={disableByok}
                    className="rounded-full border-hairline-strong bg-transparent px-4 text-[13px] text-ink hover:border-tw-blue hover:text-tw-blue"
                  >
                    Use bundled scorer
                  </Button>
                </div>

                {byokReady && (
                  <p className="tick text-[11px] text-tw-blue">
                    Active · sending requests through{" "}
                    <code className="text-ink">{byok.baseUrl}</code> as{" "}
                    <code className="text-ink">{byok.modelId}</code>
                  </p>
                )}

                {byok.enabled && (!byok.apiKey || !byok.modelId) && (
                  <p className="tick text-[11px] text-warn">
                    BYOK toggled on but missing key or model — apply to
                    activate.
                  </p>
                )}
              </div>
            )}

            <p className="text-[11px] leading-[1.4] text-ink-faint">
              Note: BYOK fields are sent to the scoring endpoint as{" "}
              <code className="text-ink">openrouterApiKey</code>,{" "}
              <code className="text-ink">openrouterBaseUrl</code>, and{" "}
              <code className="text-ink">modelOverride</code>. The server
              validates them, rejects private/non-HTTPS base URLs, and skips
              cache writes for BYOK results.
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
