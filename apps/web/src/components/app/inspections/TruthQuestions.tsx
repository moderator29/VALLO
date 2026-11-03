"use client";

import { useState } from "react";
import { formatDate, type Dictionary, type Locale } from "@vallo/i18n/core";
import { panelClass } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Segmented";
import { Button } from "@/components/ui/Button";
import { answerTruthQuestions } from "@/lib/inspections/truth-actions";
import {
  TRUTH_QUESTIONS,
  truthComplete,
  type TruthAnswer,
  type TruthAnswers,
} from "@/lib/inspections/truth";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * FOUR TRUTH QUESTIONS CLOSE EVERY INSPECTION (V-05): the renter's side.
 *
 * Four one-tap rows and one button, above the room checklist, on the
 * renter's own inspection card once the agreed time has passed. It is the
 * cheapest eight seconds in the product and the only moment anybody who was
 * actually at the gate is asked whether the listing was honest.
 *
 * STATES, ALL WRITTEN HERE:
 *   answering  four Yes / No / Not sure rows; Send is refused, in words,
 *              until all four have a value
 *   sending    the button carries its own spinner and the rows stay put
 *   done       one dated sentence, and, when money was asked for outside
 *              Vallo, the sentence that says a report is already open
 *   failed     the refusal the action returns, word for word, with the
 *              answers still in place so a retry is one tap
 *
 * The answers are never shown back as a verdict on the listing. The renter
 * is told they are counted, privately, and nothing more.
 */
export function TruthQuestions({
  inspectionId,
  answeredAt,
  copy,
  locale,
}: {
  inspectionId: string;
  /** When the viewer answered, or null while the questions are open. */
  answeredAt: string | null;
  copy: Dictionary["trustVisible"]["truth"];
  locale: Locale;
}) {
  const [answers, setAnswers] = useState<TruthAnswers>({});
  const [done, setDone] = useState<{ at: string; reportOpened: boolean } | null>(
    answeredAt ? { at: answeredAt, reportOpened: false } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useSafeTransition();

  const options = [
    { value: "yes" as const, label: copy.yes },
    { value: "no" as const, label: copy.no },
    { value: "not_sure" as const, label: copy.notSure },
  ];

  if (done) {
    return (
      <section className={panelClass({ className: "p-card" })} aria-label={copy.title} data-testid="truth-done">
        <p role="status" className="nf-body text-[var(--nf-content-secondary)]">
          {copy.done.replace("{date}", formatDate(new Date(done.at), locale))}
        </p>
        {done.reportOpened && <p className="nf-body-sm mt-xs text-[var(--nf-content-muted)]">{copy.offPlatformNote}</p>}
      </section>
    );
  }

  function send() {
    setError(null);
    if (!truthComplete(answers)) {
      setError(copy.incomplete);
      return;
    }
    const complete = answers;
    startTransition(async () => {
      try {
        const result = await answerTruthQuestions({ inspectionId, answers: complete });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setDone({ at: new Date().toISOString(), reportOpened: result.data.reportOpened });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <section className={panelClass({ className: "p-card" })} aria-label={copy.title} data-testid="truth-questions">
      <h3 className="nf-body font-semibold text-[var(--nf-content-primary)]">{copy.title}</h3>
      <p className="nf-body-sm mt-3xs text-[var(--nf-content-muted)]">{copy.lede}</p>
      <ol className="mt-md grid gap-md">
        {TRUTH_QUESTIONS.map((question) => (
          <li key={question} className="grid gap-xs">
            <p className="nf-body-sm text-[var(--nf-content-primary)]">{copy.questions[question]}</p>
            <Segmented<TruthAnswer | "">
              semantics="radio"
              size="md"
              full
              label={copy.questions[question]}
              options={options}
              value={answers[question] ?? ""}
              onChange={(next) => {
                if (next !== "") setAnswers((prev) => ({ ...prev, [question]: next }));
              }}
            />
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="nf-body-sm mt-md text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
      <Button type="button" variant="primary" full className="mt-md" loading={pending} onClick={send}>
        {pending ? copy.sending : copy.submit}
      </Button>
    </section>
  );
}
