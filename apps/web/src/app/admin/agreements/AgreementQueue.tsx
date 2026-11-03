"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatMoney, type Locale } from "@vallo/i18n/core";
import { decideAgreement } from "@/lib/admin/agreements-actions";
import type { QueueRow } from "@/lib/admin/reads/agreements";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * THE QUEUE, BUILT TO BE WORKED AT SPEED.
 *
 * One row per agreement. Everything needed to decide is on the row: who, what
 * property, how much, the dates, the inspection evidence, whether a live
 * mandate stands behind the owner, and how long it has waited. Approve is one
 * tap. Reject opens a reason on the same row, with the common reasons one tap
 * away, because a rejection's reason is read by both parties and has to be
 * written, but it should not have to be typed from nothing every time.
 *
 * Keyboard: Tab moves between rows' controls; the reason field submits on
 * Enter. Nothing on this screen is a form per row.
 */

const QUICK_REASONS = [
  "The inspection photos do not show the property clearly. Please add clear photos of each room and submit again.",
  "The move-in date and the handover date do not match. Agree one date and confirm again.",
  "The mandate behind this listing is not current. The agent needs a live, approved mandate from the owner.",
  "The amount does not match the listing's published move-in cost. Correct the terms and confirm again.",
];

function waited(since: string | null, now: number): string {
  if (!since) return "";
  const hours = Math.max(0, Math.floor((now - Date.parse(since)) / 3_600_000));
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)} days`;
}

function Row({ row, locale, now }: { row: QueueRow; locale: Locale; now: number }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<{ kind: "done"; text: string } | { kind: "error"; text: string } | null>(null);

  const act = (decision: "approve" | "reject") =>
    start(async () => {
      try {
        const result = await decideAgreement({
          agreementId: row.id,
          decision,
          ...(decision === "reject" ? { reason } : {}),
        });
        setOutcome(
          result.ok
            ? { kind: "done", text: decision === "approve" ? "Approved. Both parties told; payment is open." : "Sent back. Both parties told with your reason." }
            : { kind: "error", text: result.error },
        );
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  if (outcome?.kind === "done") {
    return (
      <li className="nf-admin-queue-row nf-admin-queue-row--done" data-testid="agreement-row-done">
        <span className="font-semibold">{row.listingTitle}</span>
        <span className="text-[var(--nf-content-secondary)]"> · {outcome.text}</span>
      </li>
    );
  }

  return (
    <li className="nf-admin-queue-row" data-testid="agreement-row" data-agreement={row.id}>
      <div className="nf-admin-queue-row__main">
        <p className="font-semibold text-[var(--nf-content-primary)]">
          <Link href={row.subjectHref} className="underline-offset-2 hover:underline">
            {row.listingTitle}
          </Link>
          <span className="ml-inline nf-admin-badge nf-admin-badge--info">{row.kind === "rent" ? "Rental" : "Stay"}</span>
          {row.kind === "rent" && !row.mandate ? (
            <span className="ml-inline nf-admin-badge nf-admin-badge--pending">No mandate on file</span>
          ) : null}
        </p>
        <p className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
          {row.renterName} ← {row.ownerName} · <strong className="nf-numeric">{formatMoney(row.amountMinor, locale)}</strong>
          {row.startsOn ? ` · ${row.kind === "rent" ? "move in" : "check in"} ${row.startsOn}` : ""}
          {row.endsOn ? ` to ${row.endsOn}` : ""}
          {row.handoverOn && row.handoverOn !== row.startsOn ? ` · keys ${row.handoverOn}` : ""}
          {row.photos !== null ? ` · ${row.photos} inspection photos` : ""}
          {` · terms v${row.termsVersion} · waiting ${waited(row.submittedAt, now)}`}
        </p>
        {row.notes ? (
          <p className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">“{row.notes}”</p>
        ) : null}
        {outcome?.kind === "error" ? (
          <p role="alert" className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-status-error)]">
            {outcome.text}
          </p>
        ) : null}
      </div>
      <div className="nf-admin-queue-row__actions">
        {!rejecting ? (
          <>
            <Button variant="primary" type="button" disabled={pending} onClick={() => act("approve")}>
              Approve
            </Button>
            <Button variant="secondary" type="button" disabled={pending} onClick={() => setRejecting(true)}>
              Reject
            </Button>
          </>
        ) : (
          <form
            className="grid gap-inline"
            onSubmit={(e) => {
              e.preventDefault();
              act("reject");
            }}
          >
            <label className="sr-only" htmlFor={`reason-${row.id}`}>
              Reason both parties will read
            </label>
            <textarea
              id={`reason-${row.id}`}
              className="nf-field min-h-[4.5rem]"
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why, in a sentence both parties can act on"
              autoFocus
            />
            <div className="flex flex-wrap gap-2xs">
              {QUICK_REASONS.map((quick) => (
                <Chip
                  key={quick}
                  size="sm"
                  selected={reason === quick}
                  onSelectedChange={() => setReason(quick)}
                >
                  {quick.split(".")[0]}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-inline">
              <Button variant="primary" type="submit" disabled={pending || reason.trim().length < 10}>
                Send back
              </Button>
              <Button variant="quiet" type="button" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </li>
  );
}

export function AgreementQueue({ rows, locale, now }: { rows: QueueRow[]; locale: Locale; now: number }) {
  if (rows.length === 0) {
    return (
      <p className="nf-body text-[var(--nf-content-secondary)]" data-testid="agreement-queue-empty">
        Nothing waiting. Every agreement both parties confirmed has been decided.
      </p>
    );
  }
  return (
    <ul className="nf-admin-queue" data-testid="agreement-queue">
      {rows.map((row) => (
        <Row key={row.id} row={row} locale={locale} now={now} />
      ))}
    </ul>
  );
}
