"use client";

import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import {
  DEFAULT_PREFS,
  FOCUSES,
  FORMATS,
  FRESH_AFTER,
  LANGUAGES,
  LENGTHS,
  type AssistantPrefs,
} from "@/lib/assistant/prefs";
import "@/app/css/home.css";

/**
 * The assistant's settings, in one quiet sheet.
 *
 * Six settings, each one line of label and one small control, in the order a
 * person reaches for them: how long the answers are, how they are laid out, the
 * language, what the assistant leans towards, when a conversation starts over,
 * and what is kept on the device. Every one is sent with the question and
 * stored on this device (`lib/assistant/prefs.ts`), and none of them can change
 * the assistant's rules: the route turns each KEY into a style line.
 *
 * The controls are the small segmented rail and a wrap of small chips, never
 * the full-width bars the first version used, so the whole sheet reads at a
 * glance on a phone without scrolling past five identical blocks.
 */
export function AssistantSettingsSheet({
  open,
  onOpenChange,
  prefs,
  onPrefsChange,
  onClearAll,
  threadCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: AssistantPrefs;
  onPrefsChange: (next: AssistantPrefs) => void;
  onClearAll: () => void;
  /** Drives the clear control's disabled state and its count. */
  threadCount: number;
}) {
  const set = <K extends keyof AssistantPrefs>(key: K, value: AssistantPrefs[K]) =>
    onPrefsChange({ ...prefs, [key]: value });
  const isDefault = (Object.keys(DEFAULT_PREFS) as (keyof AssistantPrefs)[]).every((k) => prefs[k] === DEFAULT_PREFS[k]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Assistant settings">
      <div className="nf-ai-set mx-auto w-full max-w-md">
        <Row title="Reply length" hint="How much it says.">
          <Segmented
            size="sm"
            full
            semantics="radio"
            label="Reply length"
            options={LENGTHS.map((value) => ({ value, label: value }))}
            value={prefs.length}
            onChange={(next) => set("length", next)}
          />
        </Row>

        <Row title="Layout" hint="Sentences or short points.">
          <Segmented
            size="sm"
            full
            semantics="radio"
            label="Layout"
            options={FORMATS.map((value) => ({ value, label: value }))}
            value={prefs.format}
            onChange={(next) => set("format", next)}
          />
        </Row>

        <Row title="Language" hint="The assistant understands all five.">
          <div role="radiogroup" aria-label="Language" className="nf-ai-set__chips">
            {LANGUAGES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={prefs.language === option}
                onClick={() => set("language", option)}
                className="nf-ai-set__chip nf-tap"
              >
                {option}
              </button>
            ))}
          </div>
        </Row>

        <Row title="Leans towards" hint="What it mentions first.">
          <Segmented
            size="sm"
            full
            semantics="radio"
            label="Leans towards"
            options={FOCUSES.map((value) => ({ value, label: value }))}
            value={prefs.focus}
            onChange={(next) => set("focus", next)}
          />
        </Row>

        <Row title="Start a new chat after" hint="The old one stays in history.">
          <Segmented
            size="sm"
            full
            semantics="radio"
            label="Start a new chat after"
            options={FRESH_AFTER.map((value) => ({ value, label: value }))}
            value={prefs.freshAfter}
            onChange={(next) => set("freshAfter", next)}
          />
        </Row>

        <div className="nf-ai-set__row nf-ai-set__row--switch">
          <Switch
            checked={prefs.keep}
            onCheckedChange={(next) => set("keep", next)}
            label="Keep conversations on this device"
            description="Off: nothing is saved, and chats vanish when you leave."
          />
        </div>

        <div className="nf-ai-set__foot">
          <Button variant="dangerQuiet" size="sm" onClick={onClearAll} disabled={threadCount === 0}>
            {threadCount === 0 ? "No conversations" : `Clear conversations (${threadCount})`}
          </Button>
          <Button variant="quiet" size="sm" onClick={() => onPrefsChange(DEFAULT_PREFS)} disabled={isDefault}>
            Reset settings
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="nf-ai-set__row">
      <div className="nf-ai-set__label">
        <h3 className="nf-ai-set__title">{title}</h3>
        <p className="nf-ai-set__hint">{hint}</p>
      </div>
      {children}
    </section>
  );
}
