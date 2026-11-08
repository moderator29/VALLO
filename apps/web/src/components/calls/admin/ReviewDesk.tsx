"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@/app/css/calls.css";
import { Button } from "@/components/ui/Button";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { addReviewEntry, cancelReviewCall, rescheduleReviewCall, startReviewCall } from "@/lib/calls/review-actions";
import { reviewActions } from "@/lib/calls/reviews";
import { fill, isoToLagosInput, lagosInputToIso, lagosWords } from "@/lib/calls/screen";
import type { StaffReview } from "@/lib/calls/types";
import { showCall } from "../call-store";
import { resolveDeepLink } from "../CallLayer";
import type { CallsCopy } from "../views";
import { ReviewOutcomeForm } from "./ReviewOutcomeForm";
import { banner } from "@/lib/ui/toast";

export type DeskEntry = {
  id: string;
  kind: "NOTE" | "EVIDENCE" | "CORRECTION" | "ATTENDANCE" | "OUTCOME";
  body: string;
  evidenceRef: string | null;
  correctsId: string | null;
  createdAt: string;
  byMe: boolean;
};
export type DeskAudit = { id: string; action: string; at: string; reason: string | null };

/**
 * THE REVIEW DESK: one review call, for the staff member whose scope covers
 * its case. Everything a button does is a server action that the database
 * re-checks (scope, console proof, the review's state); this screen only
 * draws what `reviewActions` says the state allows.
 *
 *   the case       its kind, the person, the purpose they were shown, a link
 *                  to the case's own desk (which shows only what that desk
 *                  already shows this staff member)
 *   the call       Start (accepted, or 10 minutes before to 30 after a
 *                  scheduled time), Rejoin when one is live; the call screen is
 *                  the Messages one, with the review's end confirmation
 *   the time       reschedule with a reason, cancel with a reason
 *   the record     notes, evidence references and corrections, append-only
 *                  (a correction points at the entry it corrects; nothing is
 *                  edited), the system's attendance lines, the audit trail
 *   the outcome    the five outcomes, a summary, a due date for a follow-up
 *
 * A review call verifies nothing by itself; the banner says so.
 */
/* What each desk action did, said by the one banner at the top of the
   screen (founder, 7 November 2026, "THE BANNER EVERYWHERE"). */
const WORDS = { moved: "Review call moved", cancelled: "Review call cancelled", added: "Added to the record" };

export function ReviewDesk({
  review,
  entries,
  audit,
  subjectName,
  liveCallId,
  caseLink,
  nowIso,
  copy,
}: {
  review: StaffReview;
  entries: DeskEntry[];
  audit: DeskAudit[];
  subjectName: string | null;
  liveCallId: string | null;
  caseLink: string;
  nowIso: string;
  copy: CallsCopy;
}) {
  const router = useRouter();
  const s = copy.staff;
  const allowed = reviewActions(review.status, review.scheduledFor, new Date(nowIso));
  const closed = review.status === "COMPLETED" || review.status === "CANCELLED";
  const [busy, setBusy] = useState<string | null>(null);

  const start = async () => {
    setBusy("start");
    const answer = await startReviewCall({ reviewId: review.id }).catch(() => null);
    setBusy(null);
    if (!answer || !answer.ok) {
      banner.error(answer ? answer.error : copy.connecting.body, { retry: () => void start() });
      return;
    }
    if (answer.data.state === "BUSY") {
      banner.info(fill(copy.outgoing.busy, { name: subjectName ?? s.subject }));
      router.refresh();
      return;
    }
    showCall(answer.data, { context: { line: s.caseKinds[review.caseKind] } });
  };

  return (
    <div className="nf-review-call" data-testid="review-desk">
      <p className="nf-review-call__disclaimer">
        <UiIcon name="info" size={16} />
        <span>{copy.review.notVerificationStaff}</span>
      </p>

      <section className="nf-review-call__card" aria-labelledby="rc-case">
        <h2 id="rc-case" className="nf-h3">
          {s.caseSummary}
        </h2>
        <Row label={s.columns.case} value={s.caseKinds[review.caseKind]} />
        {subjectName ? <Row label={s.subject} value={subjectName} /> : null}
        <Row label={copy.review.purpose} value={review.purpose} />
        <Row label={s.kindLabel} value={review.kind === "VIDEO" ? copy.buttons.video : copy.buttons.voice} />
        <Row label={s.columns.status} value={s.statuses[review.status]} />
        {review.scheduledFor ? (
          <Row label={s.scheduled} value={`${lagosWords(review.scheduledFor)} (${copy.review.lagosTime})`} />
        ) : null}
        {review.proposedFor ? (
          <Row label={s.proposed} value={`${lagosWords(review.proposedFor)} (${copy.review.lagosTime})`} />
        ) : null}
        {review.outcome ? <Row label={s.outcome} value={s.outcomes[review.outcome]} /> : null}
        <div>
          <Link className="nf-link inline-flex items-center gap-3xs" href={caseLink}>
            {s.openCase}
            <UiIcon name="arrow-right" size={16} />
          </Link>
        </div>
      </section>

      {!closed ? (
        <section className="nf-review-call__card" aria-labelledby="rc-call">
          <h2 id="rc-call" className="nf-h3">
            {review.kind === "VIDEO" ? copy.buttons.video : copy.buttons.voice}
          </h2>
          {liveCallId ? (
            <Button variant="primary" size="lg" leadingIcon="video" onClick={() => void resolveDeepLink(liveCallId)} data-testid="review-rejoin">
              {copy.connecting.rejoin}
            </Button>
          ) : allowed.canStart ? (
            <Button
              variant="primary"
              size="lg"
              leadingIcon={review.kind === "VIDEO" ? "video" : "phone"}
              loading={busy === "start"}
              onClick={() => void start()}
              data-testid="review-start"
            >
              {s.start}
            </Button>
          ) : (
            <p className="nf-call__note">{s.startHint}</p>
          )}
          {allowed.canReschedule ? <Reschedule review={review} copy={copy} onDone={() => router.refresh()} /> : null}
          {allowed.canCancel ? <CancelReview reviewId={review.id} copy={copy} onDone={() => router.refresh()} /> : null}
        </section>
      ) : (
        <p className="nf-call__note">{s.closed}</p>
      )}

      <section className="nf-review-call__card" aria-labelledby="rc-notes">
        <h2 id="rc-notes" className="nf-h3">
          {s.notes}
        </h2>
        <p className="nf-call__note">{s.appendOnly}</p>
        {entries.length === 0 ? (
          <p className="nf-call__note">{s.noEntries}</p>
        ) : (
          <ol className="nf-review-call__entries">
            {entries.map((e) => (
              <li key={e.id} className="nf-review-call__entry" data-testid="review-entry">
                <span className="nf-review-call__entry-head">
                  <strong>{s.entryKind[e.kind]}</strong>
                  <span>{lagosWords(e.createdAt)}</span>
                </span>
                {e.correctsId ? (
                  <span className="nf-call__note">
                    {s.corrects}: {lagosWords(entries.find((x) => x.id === e.correctsId)?.createdAt ?? null)}
                  </span>
                ) : null}
                <span>{e.body}</span>
                {e.evidenceRef ? <code className="nf-call__note">{e.evidenceRef}</code> : null}
              </li>
            ))}
          </ol>
        )}
        <AddEntry reviewId={review.id} entries={entries} copy={copy} onDone={() => router.refresh()} />
      </section>

      {!closed ? (
        <section aria-labelledby="rc-outcome" className="grid gap-xs">
          <h2 id="rc-outcome" className="nf-h3">
            {s.outcome}
          </h2>
          <ReviewOutcomeForm reviewId={review.id} copy={copy} onDone={() => router.refresh()} />
        </section>
      ) : null}

      {audit.length > 0 ? (
        <section className="nf-review-call__card" aria-labelledby="rc-audit">
          <h2 id="rc-audit" className="nf-h3">
            {s.audit}
          </h2>
          <ol className="nf-review-call__entries">
            {audit.map((a) => (
              <li key={a.id} className="nf-review-call__entry">
                <span className="nf-review-call__entry-head">
                  <strong>{a.action}</strong>
                  <span>{lagosWords(a.at)}</span>
                </span>
                {a.reason ? <span>{a.reason}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="nf-review-call__label">{label}</p>
      <p className="nf-review-call__value">{value}</p>
    </div>
  );
}

function Reschedule({ review, copy, onDone }: { review: StaffReview; copy: CallsCopy; onDone: () => void }) {
  const s = copy.staff;
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(isoToLagosInput(review.proposedFor ?? review.scheduledFor));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <Button variant="secondary" size="md" leadingIcon="calendar-clock" onClick={() => setOpen(true)}>
        {s.reschedule}
      </Button>
    );
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const iso = lagosInputToIso(at);
    if (!iso) return void banner.error(s.errors.time);
    if (reason.trim().length < 3) return void banner.error(s.errors.reason);
    setBusy(true);
    const answer = await rescheduleReviewCall({ reviewId: review.id, scheduledFor: iso, reason: reason.trim() }).catch(() => null);
    setBusy(false);
    if (!answer || !answer.ok) return void banner.error(answer ? answer.error : copy.connecting.body);
    setOpen(false);
    banner.success(WORDS.moved);
    onDone();
  };
  return (
    <form className="grid gap-xs" onSubmit={(e) => void submit(e)} noValidate>
      <TextField type="datetime-local" label={s.scheduleLabel} value={at} onChange={(e) => setAt(e.target.value)} />
      <TextField label={s.rescheduleReason} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      <div className="flex flex-wrap gap-xs">
        <Button type="submit" variant="primary" size="md" loading={busy}>
          {s.saveTime}
        </Button>
        <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
          {copy.ended.close}
        </Button>
      </div>
    </form>
  );
}

function CancelReview({ reviewId, copy, onDone }: { reviewId: string; copy: CallsCopy; onDone: () => void }) {
  const s = copy.staff;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <Button variant="dangerQuiet" size="md" onClick={() => setOpen(true)}>
        {s.cancel}
      </Button>
    );
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 3) return void banner.error(s.errors.reason);
    setBusy(true);
    const answer = await cancelReviewCall({ reviewId, reason: reason.trim() }).catch(() => null);
    setBusy(false);
    if (!answer || !answer.ok) return void banner.error(answer ? answer.error : copy.connecting.body);
    banner.success(WORDS.cancelled);
    onDone();
  };
  return (
    <form className="grid gap-xs" onSubmit={(e) => void submit(e)} noValidate>
      <TextField label={s.cancelReason} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      <div className="flex flex-wrap gap-xs">
        <Button type="submit" variant="danger" size="md" loading={busy}>
          {s.confirmCancel}
        </Button>
        <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
          {copy.ended.close}
        </Button>
      </div>
    </form>
  );
}

function AddEntry({
  reviewId,
  entries,
  copy,
  onDone,
}: {
  reviewId: string;
  entries: DeskEntry[];
  copy: CallsCopy;
  onDone: () => void;
}) {
  const s = copy.staff;
  const [kind, setKind] = useState<"NOTE" | "EVIDENCE" | "CORRECTION">("NOTE");
  const [body, setBody] = useState("");
  const [ref, setRef] = useState("");
  const [corrects, setCorrects] = useState("");
  const [busy, setBusy] = useState(false);
  const correctable = entries.filter((e) => e.kind === "NOTE" || e.kind === "EVIDENCE" || e.kind === "CORRECTION");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return void banner.error(s.errors.body);
    if (kind === "EVIDENCE" && !/^[a-z_]{2,40}:[0-9a-f-]{36}$/.test(ref.trim())) return void banner.error(s.errors.evidence);
    if (kind === "CORRECTION" && !corrects) return void banner.error(s.errors.corrects);
    setBusy(true);
    const answer = await addReviewEntry({
      reviewId,
      kind,
      body: body.trim(),
      ...(kind === "EVIDENCE" ? { evidenceRef: ref.trim() } : {}),
      ...(kind === "CORRECTION" ? { correctsId: corrects } : {}),
    }).catch(() => null);
    setBusy(false);
    if (!answer || !answer.ok) return void banner.error(answer ? answer.error : copy.connecting.body);
    setBody("");
    setRef("");
    setCorrects("");
    banner.success(WORDS.added);
    onDone();
  };

  return (
    <form className="grid gap-xs" onSubmit={(e) => void submit(e)} noValidate data-testid="review-entry-form">
      <SelectField label={s.noteBody} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
        <option value="NOTE">{s.noteKind.NOTE}</option>
        <option value="EVIDENCE">{s.noteKind.EVIDENCE}</option>
        {correctable.length > 0 ? <option value="CORRECTION">{s.noteKind.CORRECTION}</option> : null}
      </SelectField>
      {kind === "CORRECTION" ? (
        <SelectField label={s.corrects} value={corrects} onChange={(e) => setCorrects(e.target.value)}>
          <option value="" />
          {correctable.map((e) => (
            <option key={e.id} value={e.id}>
              {`${s.entryKind[e.kind]}, ${lagosWords(e.createdAt)}: ${e.body.slice(0, 40)}`}
            </option>
          ))}
        </SelectField>
      ) : null}
      {kind === "EVIDENCE" ? (
        <TextField label={s.evidenceRef} value={ref} onChange={(e) => setRef(e.target.value)} spellCheck={false} autoComplete="off" />
      ) : null}
      <TextArea label={s.noteBody} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={3} />
      <div>
        <Button type="submit" variant="secondary" size="md" loading={busy}>
          {s.addEntry}
        </Button>
      </div>
    </form>
  );
}
