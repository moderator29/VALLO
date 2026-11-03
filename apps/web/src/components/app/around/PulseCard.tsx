"use client";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { recordPulse } from "@/lib/around/pulse-actions";
import { PULSE_ANSWERS, type PulseKind, type PulseResult } from "@/lib/around/pulse";
import "@/app/css/catalogue.css";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * One tap for the neighbours' account (V-41), on an Around place a member
 * belongs to. One question at a time, chosen on the server by `nextQuestion`;
 * the reply is the database's own word, said in full. Nothing about the
 * member is shown to anybody: the answer becomes a count.
 */
export function PulseCard({
  areaId,
  areaName,
  question,
  copy,
}: {
  areaId: string;
  areaName: string;
  question: { kind: PulseKind } | { none: "too-new" | "lister" | "done" };
  copy: Dictionary["shape"]["neighbours"];
}) {
  const [result, setResult] = useState<PulseResult | null>(null);
  const [pending, startTransition] = useSafeTransition();
  const fill = (text: string) => text.replace("{area}", areaName);

  const body = (() => {
    if ("none" in question) {
      return (
        <p className="nf-body-sm mt-inline-tight text-[var(--nf-content-secondary)]">
          {question.none === "done" ? copy.done : fill(copy.results[question.none])}
        </p>
      );
    }
    if (result === "ok") {
      return (
        <p role="status" className="nf-body-sm mt-inline-tight text-[var(--nf-content-primary)]">
          {copy.results.ok}
        </p>
      );
    }
    const kind = question.kind;
    return (
      <>
        <p className="nf-body-sm mt-sm font-semibold text-[var(--nf-content-primary)]">{fill(copy.questions[kind])}</p>
        <div className="mt-sm flex flex-wrap gap-xs" role="group" aria-label={fill(copy.questions[kind])}>
          {PULSE_ANSWERS[kind].map((answer) => (
            <button
              key={answer}
              type="button"
              disabled={pending}
              data-testid={`pulse-${kind}-${answer}`}
              onClick={() =>
                startTransition(async () => {
                  try {
                    setResult(await recordPulse(areaId, kind, answer));
                  } catch (error) {
                    if (!tapFailedOffline(error)) throw error;
                  }
                })
              }
              className="nf-filters__tile min-h-11"
            >
              {(copy.choices[kind] as Record<string, string>)[answer]}
            </button>
          ))}
        </div>
        {result && (
          <p role="status" className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">
            {fill(copy.results[result])}
          </p>
        )}
      </>
    );
  })();

  return (
    <section className="nf-panel nf-panel--card mb-md block p-md" data-testid="pulse-card">
      <h2 className="nf-h3">{copy.cardTitle}</h2>
      <p className="nf-caption mt-2xs text-[var(--nf-content-muted)]">{fill(copy.cardLede)}</p>
      {body}
    </section>
  );
}
