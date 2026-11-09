"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { banner } from "@/lib/ui/toast";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { ResultScreen } from "@/components/app/ResultSheet";
import type { ActionResult } from "@/lib/actions/envelope";
import { answerPrincipalQuestion, stopPrincipalMessages, type AnswerOutcome } from "@/lib/landlord/actions";

type ReplyCopy = Dictionary["landlord"]["reply"];

/**
 * THE LANDLORD'S BUTTONS, AND WHAT THEY SAY BACK.
 *
 * One form per answer rather than one form with several submit buttons, so the
 * answer travels as a hidden field that cannot depend on which button a
 * browser decided was the submitter. Every button is a full-width 48px
 * rounded rectangle: somebody answering on a small Android phone in the sun
 * should not have to aim.
 *
 * "That is not what I agreed" opens a note first, because the figure they DID
 * agree is the one thing our team needs before ringing them, and then sends.
 * The note is optional; the dispute stands without it.
 *
 * After an answer the question is replaced by what the answer did, in the
 * past tense, because by then it has happened.
 */
export function ReplyActions({
  token,
  purpose,
  copy,
}: {
  token: string;
  purpose: "vacancy" | "rent";
  copy: ReplyCopy;
}) {
  const [answerState, answer, answering] = useActionState<ActionResult<AnswerOutcome> | null, FormData>(
    answerPrincipalQuestion,
    null,
  );
  const [stopState, stop, stopping] = useActionState<ActionResult<AnswerOutcome> | null, FormData>(
    stopPrincipalMessages,
    null,
  );
  const [disputing, setDisputing] = useState(false);
  const noteId = useId();

  /* A refusal is said by the one banner at the top of the screen (founder,
     7 November 2026); a settled answer becomes its own result screen. */
  const refused = (answerState && !answerState.ok ? answerState : null) ?? (stopState && !stopState.ok ? stopState : null);
  useEffect(() => {
    if (refused) banner.error(copy.failed);
    // Once per answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refused]);

  const settled = (stopState?.ok ? stopState.data : null) ?? (answerState?.ok ? answerState.data : null);
  if (settled) {
    if ("done" in settled) {
      const done = copy.done[settled.done];
      return (
        <ResultScreen
          state={settled.done === "disputed" || settled.done === "notInstructed" ? "review" : "confirmed"}
          verdict={done.title}
          consequence={done.body}
          data-testid="landlord-done"
        />
      );
    }
    const quiet = copy.states[settled.state];
    return <ResultScreen state={settled.state === "expired" ? "expired" : "pending"} verdict={quiet.title} consequence={quiet.body} />;
  }

  const busy = answering || stopping;

  const choice = (value: string, label: string, variant: "primary" | "secondary" | "dangerQuiet", testId: string) => (
    <form action={answer}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="answer" value={value} />
      <Button type="submit" variant={variant} size="md" full loading={answering} disabled={busy} data-testid={testId}>
        {label}
      </Button>
    </form>
  );

  return (
    <div className="mt-block">

      {purpose === "vacancy" ? (
        <div className="grid gap-sm">
          {choice("available", copy.yes, "primary", "landlord-yes")}
          {choice("let", copy.let, "secondary", "landlord-let")}
          {choice("not_instructed", copy.notInstructed, "dangerQuiet", "landlord-not-instructed")}
          <p className="nf-caption text-[var(--nf-content-muted)]">{copy.whatHappens}</p>
        </div>
      ) : disputing ? (
        <form action={answer} className="grid gap-sm">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="answer" value="disputed" />
          <label htmlFor={noteId} className="nf-label">
            {copy.noteLabel}
          </label>
          <textarea id={noteId} name="note" maxLength={400} rows={3} className="nf-field" />
          <p className="nf-caption text-[var(--nf-content-muted)]">{copy.noteHint}</p>
          <Button type="submit" variant="dangerQuiet" size="md" full loading={answering} disabled={busy} data-testid="landlord-dispute-send">
            {copy.notAgreed}
          </Button>
        </form>
      ) : (
        <div className="grid gap-sm">
          {choice("confirmed", copy.right, "primary", "landlord-right")}
          <Button type="button" variant="secondary" size="md" full disabled={busy} onClick={() => setDisputing(true)} data-testid="landlord-not-agreed">
            {copy.notAgreed}
          </Button>
        </div>
      )}

      <form action={stop} className="mt-block border-t border-[var(--nf-border-subtle)] pt-md">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" variant="ghost" size="sm" loading={stopping} disabled={busy} data-testid="landlord-stop">
          {copy.stop}
        </Button>
        <p className="nf-caption mt-2xs text-[var(--nf-content-muted)]">{copy.stopHint}</p>
      </form>
    </div>
  );
}
