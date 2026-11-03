"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setFeeRate } from "@/lib/admin/money-actions";
import { reviewKycDocument } from "@/lib/admin/kyc-actions";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmPanel } from "@/components/app/confirm/ConfirmPanel";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * The two decisions the money side of the console takes here (the escrow
 * ruling that was the third is retired: Vallo holds no money).
 *
 * Each one is a small inline form rather than a confirm sheet, and that is a
 * deliberate departure from AdminActions. A sheet is right when the decision is
 * a yes or no with a note attached, which is what the moderation queues are.
 * These are not: a fee change needs four fields, and a rejection needs the reviewer to be looking at
 * the document while they type why it is wrong. Putting any of those behind a
 * sheet hides the thing being judged behind the judgement.
 *
 * Every one of them refuses in place, in the sentence the server sent, and
 * refreshes the route on success so the queue re-reads from the database rather
 * than from an optimistic guess about what happened.
 */

function Refusal({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="nf-body-sm mt-row font-semibold text-[var(--nf-state-error)]"
    >
      {message}
    </p>
  );
}

/* ------------------------------------------------------------ KYC decision */

export function DocumentDecision({ documentId, kind }: { documentId: string; kind?: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [nameOnId, setNameOnId] = useState("");
  const [showReason, setShowReason] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  /* An ID is approved with the name printed on it; the bank account name is
     matched against that name, so the reviewer types it, exactly. */
  const isId = kind === "identity";
  const isSelfie = kind === "selfie";
  const nameReady = !isId || nameOnId.trim().length >= 2;

  function decide(approve: boolean) {
    setError(null);
    start(async () => {
      try {
        const result = await reviewKycDocument(
          approve
            ? { documentId, approve: true, ...(isId ? { nameOnId: nameOnId.trim() } : {}) }
            : { documentId, approve: false, reason },
        );
        if (!result.ok) {
          setError(result.fieldErrors?.["reason"] ?? result.fieldErrors?.["nameOnId"] ?? result.error);
          return;
        }
        setReason("");
        setShowReason(false);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <div className="nf-admin-decision mt-row" data-testid="document-decision">
      {isId && !showReason && (
        <label className="block">
          <span className="nf-label">Name exactly as printed on the ID</span>
          <input
            className="nf-field"
            value={nameOnId}
            maxLength={200}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setNameOnId(e.target.value)}
            placeholder="OKEKE CHIDI EMMANUEL"
            data-testid="name-on-id"
          />
          <span className="nf-caption mt-inline-tight block">
            Surname and given names as the ID writes them. The bank account they are paid into must match this name.
          </span>
        </label>
      )}
      {showReason && (
        <label className="block">
          <span className="nf-label">What is wrong with it</span>
          <textarea
            className="nf-field min-h-[64px] resize-y"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isSelfie
                ? "Your selfie is too dark to compare with your ID. Take it again facing a window, with your whole face in the oval."
                : "The name is covered by a thumb. Photograph it again with all four corners visible."
            }
          />
          <span className="nf-caption mt-inline-tight block">
            This is sent to them word for word, so it has to be something they
            can act on.
          </span>
        </label>
      )}
      <div className="nf-admin-decision__buttons mt-row flex flex-wrap gap-inline">
        {!showReason && (
          <Button type="button" size="md" disabled={pending || !nameReady} onClick={() => decide(true)} data-testid="document-approve">
            {isSelfie ? "Same person, approve" : isId ? "Approve ID" : "Approve"}
          </Button>
        )}
        {showReason ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => decide(false)}
          >
            {pending ? "Sending" : "Send it back"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => setShowReason(true)}
            data-testid="document-reject"
          >
            Reject
          </Button>
        )}
        {showReason && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setShowReason(false);
              setError(null);
            }}
          >
            Cancel
          </Button>
        )}
      </div>
      <Refusal message={error} />
    </div>
  );
}

/* ---------------------------------------------------------------- fee rate */

/**
 * Setting a rate.
 *
 * The operator types a PERCENTAGE because that is what a rate is called in
 * every conversation anybody will have about it, and it is converted to basis
 * points here, once, with Math.round. Storing basis points and typing
 * percentages is the right split: the database never sees a fraction, and
 * nobody has to think in ten-thousandths to set two and a half percent.
 *
 * The flat amount is typed in naira and converted to kobo the same way. It is
 * the only other float in this component and it is rounded away in the same
 * expression it is created in.
 */
export function FeeRateForm({
  kind,
  currentBasisPoints,
  currentFlatMinor,
}: {
  kind: "commission" | "listing_fee";
  currentBasisPoints: number;
  currentFlatMinor: number;
}) {
  const router = useRouter();
  const [percent, setPercent] = useState(String(currentBasisPoints / 100));
  const [flatNaira, setFlatNaira] = useState(String(currentFlatMinor / 100));
  const [startsAt, setStartsAt] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useSafeTransition();

  function submit() {
    setError(null);
    setDone(false);
    const percentValue = Number(percent);
    const flatValue = Number(flatNaira);
    if (!Number.isFinite(percentValue) || percentValue < 0 || percentValue > 100) {
      setError("Enter the rate as a percentage between 0 and 100.");
      return;
    }
    if (!Number.isFinite(flatValue) || flatValue < 0) {
      setError("Enter the flat amount in naira, or zero.");
      return;
    }

    /* The confirm step (plan item 22): the checks above are unchanged; a
       rate that passes them is shown in the confirm panel, whose primary
       records it with exactly the call this button made before. */
    setConfirming(true);
  }

  function record() {
    const percentValue = Number(percent);
    const flatValue = Number(flatNaira);
    start(async () => {
      try {
        const result = await setFeeRate({
          kind,
          basisPoints: Math.round(percentValue * 100),
          flatMinor: Math.round(flatValue * 100),
          /* Empty means now. The database refuses anything in the past, so an
             operator who leaves this blank gets the earliest legal start. */
          effectiveFrom: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
          note,
        });
        if (!result.ok) {
          setConfirming(false);
          setError(
            result.fieldErrors?.["note"] ?? result.fieldErrors?.["effectiveFrom"] ?? result.error,
          );
          return;
        }
        setNote("");
        setConfirming(false);
        setDone(true);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <div className="mt-group rounded-[var(--nf-radius-md)] border border-[var(--nf-border-subtle)] p-card">
      <p className="nf-body font-semibold text-content">
        Change the rate
      </p>
      <p className="nf-caption mt-inline-tight">
        This adds a new rate rather than editing the old one, so everything
        already charged stays explainable by the rate that was in force when it
        was charged. A rate cannot start in the past.
      </p>

      <div className="mt-group grid gap-row sm:grid-cols-2">
        <label className="block">
          <span className="nf-label">Percentage</span>
          <input
            className="nf-field"
            inputMode="decimal"
            value={percent}
            onChange={(e) => setPercent(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
          />
        </label>
        <label className="block">
          <span className="nf-label">Flat amount, in naira</span>
          <input
            className="nf-field"
            inputMode="decimal"
            value={flatNaira}
            onChange={(e) => setFlatNaira(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
          />
        </label>
      </div>

      <label className="mt-group block">
        <span className="nf-label">Starts</span>
        <input
          className="nf-field"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
        <span className="nf-caption mt-inline-tight block">
          Leave blank to start now. Announce a rate change before it bites by
          dating it a month out.
        </span>
      </label>

      <label className="mt-group block">
        <span className="nf-label">Why</span>
        <textarea
          className="nf-field min-h-[64px] resize-y"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Announced to listers on 1 September. Takes effect a month later."
        />
      </label>

      <div className="mt-group">
        <Button type="button" size="sm" disabled={pending} onClick={submit}>
          {pending ? "Recording" : "Record this rate"}
        </Button>
      </div>
      <Refusal message={error} />
      <Sheet
        open={confirming}
        onOpenChange={(next) => {
          if (!next && !pending) setConfirming(false);
        }}
        title="Record this rate?"
        hideTitle
        card
        detents={[0.9]}
      >
        <ConfirmPanel
          icon="price-tag"
          tone="warning"
          title={`Record a ${percent || "0"}% ${kind === "commission" ? "commission" : "listing fee"}?`}
          context="A new rate is added; the old one stays on record for what it already charged."
          summary={[
            { label: "Percentage", value: `${percent || "0"}%` },
            { label: "Flat amount", value: `₦${flatNaira || "0"}` },
            { label: "Starts", value: startsAt ? startsAt.replace("T", " ") : "Now" },
          ]}
          next={[
            { icon: "clock", text: "It applies to charges from its start, never to anything already charged." },
            { icon: "user-check", text: "It is recorded with your name on it." },
          ]}
          cancel={
            <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          }
          primary={
            <Button type="button" size="sm" disabled={pending} onClick={record}>
              {pending ? "Recording" : "Record this rate"}
            </Button>
          }
        />
      </Sheet>
      {done && (
        <p className="nf-body-sm mt-row font-semibold text-[var(--nf-state-success)]">
          Recorded, with your name on it.
        </p>
      )}
    </div>
  );
}
