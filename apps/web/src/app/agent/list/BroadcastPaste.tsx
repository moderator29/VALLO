"use client";

import { banner } from "@/lib/ui/toast";
import { useState } from "react";
import { formatMoney, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { draftFromBroadcast } from "@/lib/agent/broadcast-actions";
import type { BroadcastKey, BroadcastParse } from "@/lib/agent/broadcast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * "START FROM YOUR WHATSAPP MESSAGE" (V-09), the panel on the wizard's first
 * step.
 *
 * The agent pastes the broadcast they already send; the server reads it
 * (`draftFromBroadcast`, which writes nothing) and this hands the values to
 * the wizard, which fills only fields that are still empty and marks each one
 * "from your message". Then it shows, in two lists, exactly what was filled
 * and exactly what was not carried over (phone numbers, account numbers,
 * WhatsApp wording, facts with no field), so nothing disappears silently.
 *
 * NOTHING IS SUBMITTED. The draft is saved by the wizard's ordinary autosave
 * when the agent moves on, and the submit gate refuses to send a listing
 * whose money came from the message until each figure has been touched.
 */

type Copy = Dictionary["frontDoor"]["broadcast"];

export function BroadcastPaste({
  copy,
  locale,
  onApply,
}: {
  copy: Copy;
  locale: Locale;
  /** Fill the wizard. Returns the keys actually filled (empty fields only). */
  onApply: (result: BroadcastParse) => BroadcastKey[];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ filled: BroadcastKey[]; parse: BroadcastParse } | null>(null);
  const [pending, start] = useSafeTransition();

  function read() {
    start(async () => {
      try {
        const answer = await draftFromBroadcast({ text });
        if (!answer.ok) {
          banner.error(answer.error);
          return;
        }
        const filled = onApply(answer.data);
        setResult({ filled, parse: answer.data });
      } catch {
        banner.error(copy.failed);
      }
    });
  }

  if (!open) {
    return (
      <div className="nf-lw-broadcast" data-testid="broadcast-closed">
        <p className="nf-body font-semibold text-[var(--nf-content-primary)]">{copy.open}</p>
        <p className="mt-inline-tight nf-body-sm text-[var(--nf-content-secondary)]">{copy.openBody}</p>
        <Button variant="ghost" className="mt-row" leadingIcon="chat-bubble" onClick={() => setOpen(true)}>
          {copy.open}
        </Button>
      </div>
    );
  }

  const value = (key: BroadcastKey): string => {
    const raw = result?.parse.values[key];
    if (raw === undefined) return "";
    /* Money is shown from the kobo the server worked out, through the one
       money formatter; an enum is shown in words, never as its code. */
    const minor = result?.parse.kobo[key];
    if (minor !== undefined) return formatMoney(minor, locale);
    const words = copy.words as Record<string, string | undefined>;
    if (typeof raw === "string" && words[raw]) return words[raw] as string;
    if (typeof raw === "boolean") return raw ? copy.yes : copy.no;
    return String(raw);
  };

  return (
    <div className="nf-lw-broadcast" data-testid="broadcast-open">
      <label className="block">
        <span className="nf-label">{copy.label}</span>
        <textarea
          className="nf-field min-h-[9rem] py-sm"
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          placeholder={copy.placeholder}
          data-testid="broadcast-text"
        />
      </label>
      <div className="mt-row flex flex-wrap gap-row">
        <Button variant="primary" onClick={read} loading={pending} disabled={text.trim().length < 10}>
          {pending ? copy.reading : copy.read}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {copy.close}
        </Button>
      </div>

      {result && (
        <div className="mt-group space-y-row" data-testid="broadcast-result">
          {result.filled.length === 0 ? (
            <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.nothingFilled}</p>
          ) : (
            <div>
              <p className="nf-body font-semibold text-[var(--nf-content-primary)]">{copy.filledTitle}</p>
              <p className="mt-inline-tight nf-body-sm text-[var(--nf-content-secondary)]">
                {copy.filledBody} {copy.kept}
              </p>
              <ul className="mt-inline space-y-inline" data-testid="broadcast-filled">
                {result.filled
                  .filter((key) => key !== "description")
                  .map((key) => (
                    <li key={key} className="flex items-baseline justify-between gap-row nf-body-sm">
                      <span className="text-[var(--nf-content-muted)]">{copy.fields[key]}</span>
                      <span className="min-w-0 text-right text-[var(--nf-content-primary)] [overflow-wrap:anywhere]">
                        {value(key)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {result.parse.notCarried.length > 0 && (
            <div>
              <p className="nf-body font-semibold text-[var(--nf-content-primary)]">{copy.notCarriedTitle}</p>
              <p className="mt-inline-tight nf-body-sm text-[var(--nf-content-secondary)]">{copy.notCarriedBody}</p>
              <ul className="mt-inline space-y-inline" data-testid="broadcast-not-carried">
                {result.parse.notCarried.map((item) => (
                  <li key={`${item.kind}-${item.text}`} className="nf-body-sm">
                    <span className="text-[var(--nf-content-muted)]">{copy.kinds[item.kind]}: </span>
                    <span className="text-[var(--nf-content-primary)] [overflow-wrap:anywhere]">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
