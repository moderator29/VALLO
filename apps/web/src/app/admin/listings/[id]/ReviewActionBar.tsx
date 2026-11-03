"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { reviewListing } from "@/lib/admin/actions";
import { Chip } from "@/components/ui/Chip";
import { REVIEW_REASONS, composeReviewNote } from "@/lib/admin/review-reasons";
import "../../_components/admin-material.css";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type Decision = "approve" | "publish" | "request_changes" | "reject";

/** The shortest rejection reason `reviewListing` accepts. */
const REJECT_REASON_MIN = 8;

/**
 * The action bar under the listing, C1D98B3C panel 2: a reason field and
 * Approve, Ask for more and Reject.
 *
 * Every button calls the existing `reviewListing` server action, unchanged:
 * it re-checks the admin role, validates, moves the listing's status through
 * the admin's own RLS-bound client, tells the lister in the app and by email
 * through `announce`, and appends the `listing.review` row to the audit log.
 * Nothing here is optimistic; the bar waits for the server's answer.
 *
 * WHAT THE RENDER DOES NOT DRAW AND THIS KEEPS. Approve and publish are two
 * separate acts (approve passes the checklist; publish puts the listing in
 * public search), so once a listing is approved the first button reads
 * Publish. Ask for more and Reject both send the lister the reason word for
 * word, so each stays disabled until there is a reason the server will take
 * (any for Ask for more, eight characters or a reason chip for Reject; the
 * server refuses either without one). Reject closes this round of review, the
 * lister has to edit and send it again, so it asks to be pressed a second time
 * within a few seconds. A listing sent back for changes is with the lister, so
 * it cannot be approved from here until they send it back.
 *
 * After a decision the next listing in the reviewer's queue loads, or the
 * queue itself when this was the last one.
 */
export function ReviewActionBar({
  listingId,
  status,
  nextHref,
  queueHref,
}: {
  listingId: string;
  status: string;
  nextHref: string | null;
  queueHref: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  /* C8: reason codes as chips; each sends the lister one reviewed sentence. */
  const [codes, setCodes] = useState<string[]>([]);
  const [pending, startTransition] = useSafeTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const disarm = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (disarm.current) clearTimeout(disarm.current);
    },
    [],
  );

  const approving: Decision = status === "APPROVED" ? "publish" : "approve";
  const reason = notes.trim();
  /* What the lister will read when sending back or rejecting. */
  const composed = composeReviewNote(codes, notes);
  /* The server's own floor for a rejection (`reviewListing`): a reason of at
     least eight characters. The button waited for nothing and the refusal
     arrived after the second press. */
  const canReject = composed.trim().length >= REJECT_REASON_MIN;
  /* With the lister for changes: the server will not approve it until they
     send it back, so the button does not offer to. */
  const withLister = status === "MORE_INFO_REQUIRED";

  const run = (decision: Decision) => {
    setError(null);
    startTransition(async () => {
      const sendsReasons = decision === "reject" || decision === "request_changes";
      const result = await reviewListing({
        listingId,
        decision,
        ...(reason.length > 0 ? { notes: reason } : {}),
        ...(sendsReasons && codes.length > 0 ? { reasons: codes } : {}),
      });
      if (!result.ok) {
        setError(result.fieldErrors?.["notes"] ?? result.error);
        return;
      }
      setDone(
        decision === "approve"
          ? "Approved. The lister has been told."
          : decision === "publish"
            ? "Live in search. The lister has been told."
            : decision === "reject"
              ? "Rejected. The lister has your reason."
              : "Sent back. The lister has your note.",
      );
      setNotes("");
      setCodes([]);
      router.push(nextHref ?? queueHref);
      router.refresh();
    });
  };

  const onReject = () => {
    if (!armed) {
      setArmed(true);
      if (disarm.current) clearTimeout(disarm.current);
      disarm.current = setTimeout(() => setArmed(false), 5000);
      return;
    }
    setArmed(false);
    run("reject");
  };

  return (
    <div className="nf-panel nf-rv-panel nf-rv-actionbar nf-admin-decision">
      <div className="nf-rv-actionbar__lead">
        <h2 className="nf-rv-actionbar__title">Your decision</h2>
        <Button
          full
          variant="primary"
          size="md"
          leadingIcon="verified"
          data-desk-approve
          disabled={pending || withLister}
          title={withLister ? "With the lister for changes. Approve it once they send it back." : undefined}
          onClick={() => run(approving)}
        >
          {approving === "publish" ? "Publish" : "Approve"}
        </Button>
      </div>
      <div className="nf-rv-actionbar__alt">
      <h3 className="nf-rv-actionbar__sub">Or send it back, or reject it</h3>
      <div className="flex flex-wrap gap-xs" role="group" aria-label="Reasons the lister will read" data-testid="rv-reasons">
        {REVIEW_REASONS.map((r) => (
          <Chip
            key={r.code}
            size="sm"
            behaviour="filter"
            selected={codes.includes(r.code)}
            disabled={pending}
            onSelectedChange={(next) =>
              setCodes((prev) => (next ? [...prev, r.code] : prev.filter((c) => c !== r.code)))
            }
          >
            {r.label}
          </Chip>
        ))}
      </div>
      {codes.length > 0 ? (
        <p className="nf-rv-msg" data-testid="rv-reasons-preview">
          The lister reads: {REVIEW_REASONS.filter((r) => codes.includes(r.code)).map((r) => r.sentence).join(" ")}
        </p>
      ) : null}
      <label className="sr-only" htmlFor="rv-reason">
        A reason for the lister
      </label>
      <textarea
        id="rv-reason"
        className="nf-rv-field"
        rows={1}
        maxLength={2000}
        value={notes}
        disabled={pending}
        placeholder="Add your own note (optional with a reason above)"
        onChange={(event) => setNotes(event.target.value)}
      />
      <div className="nf-rv-actionbar__buttons">
        <Button
          variant="secondary"
          size="sm"
          leadingIcon="info"
          disabled={pending || composed.length === 0}
          title={composed.length === 0 ? "Pick a reason or write what you need from the lister first" : undefined}
          onClick={() => run("request_changes")}
        >
          Ask for more
        </Button>
        {/* Destructive, so the red tint at rest and the solid red once armed
            for the confirming second press (section 19). */}
        <Button
          variant={armed ? "danger" : "dangerQuiet"}
          size="sm"
          leadingIcon="close"
          data-desk-decline
          disabled={pending || !canReject}
          title={canReject ? undefined : "Pick a reason or write why it is rejected first"}
          aria-describedby={armed ? "rv-reject-confirm" : undefined}
          onClick={onReject}
        >
          {armed ? "Press again to reject" : "Reject"}
        </Button>
      </div>
      </div>
      <div aria-live="polite">
        {withLister ? (
          <p className="nf-rv-msg" data-testid="rv-with-lister">
            Sent back for changes and with the lister. You can update the note or reject it; approve it once they send it back.
          </p>
        ) : null}
        {armed ? (
          <p id="rv-reject-confirm" className="nf-rv-msg">
            Rejecting tells the lister it did not pass. Press Reject again to confirm.
          </p>
        ) : null}
        {pending ? <p className="nf-rv-msg">Recording the decision.</p> : null}
        {done ? <p className="nf-rv-msg nf-rv-msg--ok">{done} Loading the next listing.</p> : null}
        {error ? (
          <p className="nf-rv-msg nf-rv-msg--error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
