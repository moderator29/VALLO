"use client";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { CONSENT_SENTENCE } from "@/lib/landlord/consent";
import { recordPrincipalConsent } from "@/lib/landlord/admin-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type AdminCopy = Dictionary["landlord"]["admin"];

/**
 * V-31. THE CONSENT SENTENCE, READ ON THE MANDATE CALL, AND THE ANSWER RECORDED.
 *
 * Sits inside the opened mandate row, directly under the principal's number,
 * because that is the moment it belongs to: the reviewer is on the phone to
 * the principal already, ringing the number to check the instruction is real.
 * The sentence is on screen word for word so it is read rather than
 * paraphrased, and it is the same constant the server stores against the
 * mandate, so what the principal heard and what we hold cannot differ.
 *
 * ON TODAY, even with the landlord line switched off. Recording consent sends
 * nothing; the line under the buttons says so plainly, so a reviewer never
 * believes they have just switched messages on.
 *
 * Four states, each said in words: no number (nobody to ask), no consent yet,
 * consent recorded (when and by whom), consent withdrawn. And a failed read,
 * which says that nothing is sent without it, because that is the true
 * consequence of not knowing.
 */
export function MandateConsent({
  mandateId,
  hasNumber,
  initial,
  readFailed,
  lineOpen,
  copy,
  stoppedLine = null,
}: {
  mandateId: string;
  hasNumber: boolean;
  /** Pre-formatted on the server: "Consent recorded 24 Sep by Ada." or null. */
  initial: { state: "none" | "given" | "withdrawn"; line: string };
  readFailed: boolean;
  lineOpen: boolean;
  copy: AdminCopy;
  /** Pre-formatted: "This number asked us to stop on 3 Oct..." when it has. */
  stoppedLine?: string | null;
}) {
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useSafeTransition();
  const [note, setNote] = useState("");

  if (!hasNumber) {
    return (
      <div className="nf-rv-msg" data-testid="consent-no-number">
        <strong>{copy.consentTitle}.</strong> {copy.consentNoNumber}
      </div>
    );
  }

  function run(answer: "given" | "withdrawn") {
    setError(null);
    startTransition(async () => {
      try {
        const result = await recordPrincipalConsent({ mandateId, answer, note: answer === "given" ? note : null });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setStatus(
          answer === "given"
            ? { state: "given", line: copy.consentRecordedNow }
            : { state: "withdrawn", line: copy.consentWithdrawnNow },
        );
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <div className="grid gap-xs" data-testid="consent-control" data-consent={status.state}>
      <p className="nf-rv-msg">
        <strong>{copy.consentTitle}.</strong> {readFailed ? copy.consentReadFailed : status.line}
      </p>
      {status.state !== "given" && (
        <>
          <p className="nf-rv-panel__note">{copy.consentRead}</p>
          <blockquote
            className="rounded-[var(--nf-container-radius)] border border-[var(--nf-border-subtle)] px-md py-sm text-[length:var(--nf-text-body-sm)] leading-relaxed"
            data-testid="consent-sentence"
          >
            {CONSENT_SENTENCE}
          </blockquote>
        </>
      )}
      {stoppedLine && status.state !== "given" && (
        <>
          <p className="nf-rv-msg" style={{ color: "var(--nf-state-warning)" }} data-testid="consent-stopped-before">
            {stoppedLine}
          </p>
          <label className="nf-label" htmlFor={`consent-note-${mandateId}`}>
            {copy.reconsentNote}
          </label>
          <textarea
            id={`consent-note-${mandateId}`}
            className="nf-field"
            rows={2}
            maxLength={400}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </>
      )}
      <div className="flex flex-wrap gap-sm">
        {status.state !== "given" && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={pending}
            disabled={Boolean(stoppedLine) && note.trim().length < 8}
            onClick={() => run("given")}
            data-testid="consent-given"
          >
            {copy.consentGiven}
          </Button>
        )}
        {status.state === "given" && (
          <Button type="button" variant="dangerQuiet" size="sm" loading={pending} onClick={() => run("withdrawn")} data-testid="consent-withdraw">
            {copy.consentWithdraw}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="nf-rv-msg" style={{ color: "var(--nf-state-error)" }}>
          {error}
        </p>
      )}
      <p className="nf-rv-panel__note">{lineOpen ? copy.lineOn : copy.lineOff}</p>
    </div>
  );
}
