"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Locale } from "@vallo/i18n/core";
import { CANCELLATION_REASONS, type CancellationReason } from "@/lib/trust/cancellation";
import { cancelBookingAsAdmin, previewCancellation } from "@/lib/admin/bookings-actions";
import { recordVerificationCheck } from "@/lib/admin/verification-actions";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Chip, ChipRow } from "@/components/ui/Chip";
import type { ActionResult } from "@/lib/actions/envelope";
import { fill, type AdminCommon, type AdminCopy } from "./copy";
import {
  replySupportTicket,
  resolveReport,
  resolveRiskAlert,
  reviewAgentApplication,
  reviewListing,
  reviewMessageFlag,
  setTicketStatus,
  toggleFeatureFlag,
} from "@/lib/admin/actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * Every hand the console offers, in one client module.
 *
 * They all share one confirm sheet, so a decision always looks and behaves the
 * same wherever it is taken: state what is about to happen, take the reviewer's
 * note, run the server action, then either show the plain-language refusal the
 * envelope carried or refresh the page so the queue re-renders from the
 * database rather than from optimistic guesswork.
 *
 * The sheet mechanics (portal, drag handle, detents, focus trap, focus
 * restoration, Escape, backdrop and body scroll lock) belong to `<Sheet>`.
 * What stays here is the decision: the required note, the refusal, the
 * in-sheet success state.
 *
 * Every string arrives as a dictionary slice from the queue page that renders
 * the control: these are client components, so none of them resolves a locale
 * or reads a dictionary itself.
 */

type Runner = (notes: string) => Promise<ActionResult<null>>;

type SheetProps = {
  common: AdminCommon;
  title: string;
  description: string;
  confirmLabel: string;
  successTitle: string;
  successBody: string;
  run: Runner;
  onClose: () => void;
  withNotes?: boolean;
  notesLabel?: string;
  notesRequired?: boolean;
  destructive?: boolean;
  /**
   * A block above the note field, for a decision that needs more than a
   * sentence: the cancellation sheet puts its reason picker and its live
   * refund preview here, so an operator sees what the guest gets back before
   * they confirm rather than after.
   */
  extra?: ReactNode;
};

function ActionSheet({
  common,
  title,
  description,
  confirmLabel,
  successTitle,
  successBody,
  run,
  onClose,
  withNotes = false,
  notesLabel,
  notesRequired = false,
  destructive = false,
  extra,
}: SheetProps) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useSafeTransition();

  /* The outcome goes to the banner: done closes the sheet and says what
     happened; a refusal keeps the sheet open, with the same tap one away. */
  const submit = (): void => {
    startTransition(async () => {
      try {
        const outcome = await run(notes.trim());
        if (outcome.ok) {
          banner.success(`${successTitle}. ${successBody}`);
          onClose();
          router.refresh();
        } else banner.error(outcome.error, { retry: submit });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const blocked = notesRequired && notes.trim().length === 0;

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      footer={
        <div className="grid gap-sm">
          <Button
            variant={destructive ? "dangerQuiet" : "primary"}
            full
            onClick={submit}
            disabled={blocked}
            loading={pending}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" full onClick={onClose}>
            {common.notNow}
          </Button>
        </div>
      }
    >
      <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
        {description}
      </p>

      {extra}

      {withNotes && (
        <label className="mt-md block">
          <span className="nf-label">
            {notesLabel}
            {notesRequired ? "" : ` ${common.optional}`}
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={2000}
            className="nf-field mt-2xs w-full resize-y"
            placeholder={common.notePlaceholder}
          />
        </label>
      )}
    </Sheet>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="mt-md flex flex-wrap gap-xs">{children}</div>;
}

/** ------------------------------------------------------------ message flags */

export function FlagDecision({
  flagId,
  copy,
  common,
}: {
  flagId: string;
  copy: AdminCopy["flags"];
  common: AdminCommon;
}) {
  const [sheet, setSheet] = useState<null | "cleared" | "escalated">(null);

  return (
    <>
      <Row>
        <Button variant="primary" onClick={() => setSheet("cleared")}>
          {copy.clear}
        </Button>
        <Button variant="secondary" onClick={() => setSheet("escalated")}>
          {copy.escalate}
        </Button>
      </Row>

      {sheet === "cleared" && (
        <ActionSheet
          common={common}
          title={copy.clearSheet.title}
          description={copy.clearSheet.body}
          confirmLabel={copy.clearSheet.confirm}
          successTitle={copy.clearSheet.successTitle}
          successBody={copy.clearSheet.successBody}
          run={() => reviewMessageFlag({ flagId, resolution: "cleared" })}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "escalated" && (
        <ActionSheet
          common={common}
          title={copy.escalateSheet.title}
          description={copy.escalateSheet.body}
          confirmLabel={copy.escalateSheet.confirm}
          successTitle={copy.escalateSheet.successTitle}
          successBody={copy.escalateSheet.successBody}
          run={() => reviewMessageFlag({ flagId, resolution: "escalated" })}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

/** -------------------------------------------------------------- risk alerts */

export function AlertResolve({
  alertId,
  copy,
  common,
}: {
  alertId: string;
  copy: AdminCopy["alerts"];
  common: AdminCommon;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Row>
        {/* SECONDARY, NOT PRIMARY: this opener sits on every card in a queue,
            and four lit primaries on one phone screen is four glows where the
            north star allows one (checklist point 1, measured on /admin/alerts
            in the C1 sweep). The commit in the sheet is the primary. */}
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {copy.resolve}
        </Button>
      </Row>

      {open && (
        <ActionSheet
          common={common}
          title={copy.sheet.title}
          description={copy.sheet.body}
          confirmLabel={copy.sheet.confirm}
          successTitle={copy.sheet.successTitle}
          successBody={copy.sheet.successBody}
          withNotes
          notesLabel={copy.sheet.notesLabel}
          run={(notes) => resolveRiskAlert({ alertId, notes })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** ------------------------------------------------------------------ reports */

export function ReportDecision({
  reportId,
  status,
  copy,
  common,
  reporterNoteLabel,
}: {
  reportId: string;
  status: string;
  copy: AdminCopy["reports"];
  common: AdminCommon;
  /** The reporter-note field's label, from the server page, so this client file never imports the dictionary. */
  reporterNoteLabel: string;
}) {
  const [sheet, setSheet] = useState<null | "reviewing" | "resolved" | "dismissed">(null);
  /* V-89: the one line the reporter is shown on /settings/help. */
  const [reporterNote, setReporterNote] = useState("");
  const reporterField = (
    <label className="mt-md block">
      <span className="nf-label">
        {reporterNoteLabel} {common.optional}
      </span>
      <input
        value={reporterNote}
        onChange={(event) => setReporterNote(event.target.value)}
        maxLength={200}
        className="nf-field mt-2xs w-full"
      />
    </label>
  );

  return (
    <>
      <Row>
        {status === "open" && (
          <Button variant="secondary" onClick={() => setSheet("reviewing")}>
            {copy.startReview}
          </Button>
        )}
        <Button variant="primary" onClick={() => setSheet("resolved")}>
          {copy.resolve}
        </Button>
        <Button variant="secondary" onClick={() => setSheet("dismissed")}>
          {copy.dismiss}
        </Button>
      </Row>

      {sheet === "reviewing" && (
        <ActionSheet
          common={common}
          title={copy.reviewSheet.title}
          description={copy.reviewSheet.body}
          confirmLabel={copy.reviewSheet.confirm}
          successTitle={copy.reviewSheet.successTitle}
          successBody={copy.reviewSheet.successBody}
          withNotes
          notesLabel={copy.reviewSheet.notesLabel}
          run={(notes) => resolveReport({ reportId, decision: "reviewing", notes })}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "resolved" && (
        <ActionSheet
          common={common}
          title={copy.resolveSheet.title}
          description={copy.resolveSheet.body}
          confirmLabel={copy.resolveSheet.confirm}
          successTitle={copy.resolveSheet.successTitle}
          successBody={copy.resolveSheet.successBody}
          withNotes
          notesLabel={copy.resolveSheet.notesLabel}
          extra={reporterField}
          run={(notes) => resolveReport({ reportId, decision: "resolved", notes, reporterNote: reporterNote.trim() })}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "dismissed" && (
        <ActionSheet
          common={common}
          title={copy.dismissSheet.title}
          description={copy.dismissSheet.body}
          confirmLabel={copy.dismissSheet.confirm}
          successTitle={copy.dismissSheet.successTitle}
          successBody={copy.dismissSheet.successBody}
          withNotes
          notesRequired
          notesLabel={copy.dismissSheet.notesLabel}
          extra={reporterField}
          run={(notes) => resolveReport({ reportId, decision: "dismissed", notes, reporterNote: reporterNote.trim() })}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

/** ------------------------------------------------------- agent applications */

export function ApplicationDecision({
  applicationId,
  applicantName,
  copy,
  common,
}: {
  applicationId: string;
  applicantName: string;
  copy: AdminCopy["applications"];
  common: AdminCommon;
}) {
  const [sheet, setSheet] = useState<null | "approve" | "request_changes" | "reject">(null);

  return (
    <>
      <Row>
        <Button variant="primary" onClick={() => setSheet("approve")}>
          {copy.approve}
        </Button>
        <Button variant="secondary" onClick={() => setSheet("request_changes")}>
          {copy.requestChanges}
        </Button>
        <Button variant="dangerQuiet" onClick={() => setSheet("reject")}>
          {copy.reject}
        </Button>
      </Row>

      {sheet === "approve" && (
        <ActionSheet
          common={common}
          title={fill(copy.approveSheet.title, { name: applicantName })}
          description={copy.approveSheet.body}
          confirmLabel={copy.approveSheet.confirm}
          successTitle={copy.approveSheet.successTitle}
          successBody={copy.approveSheet.successBody}
          withNotes
          notesLabel={copy.approveSheet.notesLabel}
          run={(notes) => reviewAgentApplication({ applicationId, decision: "approve", notes })}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "request_changes" && (
        <ActionSheet
          common={common}
          title={copy.changesSheet.title}
          description={copy.changesSheet.body}
          confirmLabel={copy.changesSheet.confirm}
          successTitle={copy.changesSheet.successTitle}
          successBody={copy.changesSheet.successBody}
          withNotes
          notesRequired
          notesLabel={copy.changesSheet.notesLabel}
          run={(notes) =>
            reviewAgentApplication({ applicationId, decision: "request_changes", notes })
          }
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "reject" && (
        <ActionSheet
          common={common}
          title={fill(copy.rejectSheet.title, { name: applicantName })}
          description={copy.rejectSheet.body}
          confirmLabel={copy.rejectSheet.confirm}
          successTitle={copy.rejectSheet.successTitle}
          successBody={copy.rejectSheet.successBody}
          withNotes
          /* The sheet says the reason is the only explanation the applicant
             gets; the server refuses a refusal without one. */
          notesRequired
          notesLabel={copy.rejectSheet.notesLabel}
          destructive
          run={(notes) => reviewAgentApplication({ applicationId, decision: "reject", notes })}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

/** ----------------------------------------------------------------- listings */

export function ListingDecision({
  listingId,
  status,
  title,
  copy,
  common,
}: {
  listingId: string;
  status: string;
  title: string;
  copy: AdminCopy["listings"];
  common: AdminCommon;
}) {
  const [sheet, setSheet] = useState<null | "approve" | "publish" | "request_changes" | "reject">(
    null,
  );

  return (
    <>
      <Row>
        {status === "APPROVED" ? (
          <Button variant="primary" onClick={() => setSheet("publish")}>
            {copy.publish}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setSheet("approve")}>
            {copy.approve}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setSheet("request_changes")}>
          {copy.requestChanges}
        </Button>
        <Button variant="dangerQuiet" onClick={() => setSheet("reject")}>
          {copy.reject}
        </Button>
      </Row>

      {sheet === "approve" && (
        <ActionSheet
          common={common}
          title={fill(copy.approveSheet.title, { title })}
          description={copy.approveSheet.body}
          confirmLabel={copy.approveSheet.confirm}
          successTitle={copy.approveSheet.successTitle}
          successBody={copy.approveSheet.successBody}
          withNotes
          notesLabel={copy.approveSheet.notesLabel}
          run={(notes) => reviewListing({ listingId, decision: "approve", notes })}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "publish" && (
        <ActionSheet
          common={common}
          title={fill(copy.publishSheet.title, { title })}
          description={copy.publishSheet.body}
          confirmLabel={copy.publishSheet.confirm}
          successTitle={copy.publishSheet.successTitle}
          successBody={copy.publishSheet.successBody}
          withNotes
          notesLabel={copy.publishSheet.notesLabel}
          run={(notes) => reviewListing({ listingId, decision: "publish", notes })}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "request_changes" && (
        <ActionSheet
          common={common}
          title={copy.changesSheet.title}
          description={copy.changesSheet.body}
          confirmLabel={copy.changesSheet.confirm}
          successTitle={copy.changesSheet.successTitle}
          successBody={copy.changesSheet.successBody}
          withNotes
          notesRequired
          notesLabel={copy.changesSheet.notesLabel}
          run={(notes) => reviewListing({ listingId, decision: "request_changes", notes })}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "reject" && (
        <ActionSheet
          common={common}
          title={fill(copy.rejectSheet.title, { title })}
          description={copy.rejectSheet.body}
          confirmLabel={copy.rejectSheet.confirm}
          successTitle={copy.rejectSheet.successTitle}
          successBody={copy.rejectSheet.successBody}
          withNotes
          notesRequired
          notesLabel={copy.rejectSheet.notesLabel}
          destructive
          run={(notes) => reviewListing({ listingId, decision: "reject", notes })}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

/** ---------------------------------------------------------- support tickets */

export function TicketReply({
  ticketId,
  copy,
}: {
  ticketId: string;
  copy: AdminCopy["support"];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useSafeTransition();

  const send = (): void => {
    startTransition(async () => {
      try {
        const outcome = await replySupportTicket({ ticketId, body });
        if (outcome.ok) {
          banner.success(copy.reply.sent);
          setBody("");
          router.refresh();
        } else banner.error(outcome.error, { retry: send });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <div className="mt-md">
      <label className="block">
        <span className="nf-label">{copy.reply.label}</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          maxLength={4000}
          className="nf-field mt-2xs w-full resize-y"
          placeholder={copy.reply.placeholder}
        />
      </label>

      <div className="mt-xs flex flex-wrap items-center gap-md">
        <Button
          variant="primary"
          onClick={send}
          disabled={body.trim().length < 2}
          loading={pending}
        >
          {copy.reply.send}
        </Button>
        <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">{copy.reply.note}</span>
      </div>
    </div>
  );
}

const TICKET_STATES = ["open", "pending", "resolved", "closed"] as const;

export function TicketStatusControl({
  ticketId,
  status,
  copy,
}: {
  ticketId: string;
  status: string;
  copy: AdminCopy["support"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useSafeTransition();

  const [closing, setClosing] = useState(false);
  const [closingNote, setClosingNote] = useState("");

  const move = (next: (typeof TICKET_STATES)[number], note?: string): void => {
    /* Closing always says what was done, so the ticket's end is on record. */
    if (next === "closed" && note === undefined) {
      setClosing(true);
      return;
    }
    startTransition(async () => {
      try {
        const outcome = await setTicketStatus({ ticketId, status: next, ...(note ? { note } : {}) });
        if (outcome.ok) {
          setClosing(false);
          setClosingNote("");
          router.refresh();
        } else banner.error(outcome.error, { retry: () => move(next, note) });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <div className="mt-md">
      <span className="nf-label">{copy.stateLabel}</span>
      {/* The shared rail. The current state stays disabled - moving a ticket to
          where it already is is not a move - and selection is now a ring and a
          fill rather than a hairline glow, which is the difference between an
          operator seeing the current state and guessing at it. */}
      <ChipRow bleed={false} fadeEdges={false} className="mt-2xs">
        {TICKET_STATES.map((state) => (
          <Chip
            key={state}
            size="sm"
            disabled={pending || state === status}
            selected={state === status}
            onSelectedChange={() => move(state)}
          >
            {copy.states[state]}
          </Chip>
        ))}
      </ChipRow>
      {closing ? (
        <div className="mt-xs grid gap-2xs">
          <label className="nf-label" htmlFor={`close-${ticketId}`}>
            Closing note: what was done (kept in the audit trail)
          </label>
          <textarea
            id={`close-${ticketId}`}
            className="nf-field"
            rows={2}
            maxLength={1000}
            value={closingNote}
            onChange={(e) => setClosingNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-xs">
            <Button
              variant="primary"
              size="sm"
              disabled={pending || closingNote.trim().length < 8}
              onClick={() => move("closed", closingNote.trim())}
            >
              Close the ticket
            </Button>
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => setClosing(false)}>
              Keep it open
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** ------------------------------------------------------------ kill switches */

export function SwitchControl({
  flagKey,
  label,
  enabled,
  copy,
  common,
}: {
  flagKey: string;
  label: string;
  enabled: boolean;
  copy: AdminCopy["switches"];
  common: AdminCommon;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useSafeTransition();

  const turnOn = (): void => {
    startTransition(async () => {
      try {
        const outcome = await toggleFeatureFlag({ key: flagKey, enabled: true });
        if (outcome.ok) router.refresh();
        else banner.error(outcome.error, { retry: turnOn });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <>
      {enabled ? (
        <Button variant="dangerQuiet" onClick={() => setConfirming(true)} className="shrink-0">
          {copy.switchOff}
        </Button>
      ) : (
        <Button variant="primary" onClick={turnOn} loading={pending} className="shrink-0">
          {copy.switchOn}
        </Button>
      )}

      {confirming && (
        <ActionSheet
          common={common}
          title={fill(copy.sheet.title, { label })}
          description={copy.sheet.body}
          confirmLabel={copy.sheet.confirm}
          successTitle={copy.sheet.successTitle}
          successBody={copy.sheet.successBody}
          destructive
          run={() => toggleFeatureFlag({ key: flagKey, enabled: false })}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}

/** ----------------------------------------------------------------- stays */

/**
 * Cancelling a stay, and returning what the published schedule says is owed.
 *
 * There is no amount field here, and there never will be. The operator picks
 * WHY, and the figure is read back from the server through the same function
 * that will move the money, so the number on screen before the tap is the
 * number in the ledger after it. Three of the four reasons return everything,
 * because /cancellations promises exactly that in those three cases, and each
 * of those three has to say what was actually established.
 *
 * The preview runs on every change of reason. While it is in flight the sheet
 * says so rather than showing a stale figure, because a stale figure about
 * somebody's money is worse than no figure.
 */
export function StayCancel({
  bookingId,
  copy,
  common,
  locale,
}: {
  bookingId: string;
  copy: AdminCopy["bookings"];
  common: AdminCommon;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CancellationReason>("guest_choice");
  const [preview, setPreview] = useState<
    { paidMinor: number; refundMinor: number; retainedMinor: number } | null
  >(null);
  const [previewing, startPreview] = useSafeTransition();

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    startPreview(async () => {
      try {
        const outcome = await previewCancellation({ bookingId, reason });
        if (outcome.ok && outcome.data) setPreview(outcome.data);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }, [open, reason, bookingId]);

  const money = (minor: number) => formatMoney(minor, locale);

  const extra = (
    <div className="mt-md">
      <span className="nf-label">{copy.sheet.reasonLabel}</span>
      <div className="mt-2xs grid gap-xs">
        {CANCELLATION_REASONS.map((option) => (
          <button
            key={option.code}
            type="button"
            onClick={() => setReason(option.code)}
            aria-pressed={reason === option.code}
            className={`rounded-[var(--nf-radius-md)] border p-sm text-left ${
              reason === option.code
                ? "border-[var(--nf-brand-primary)] bg-[var(--nf-brand-primary-soft)]"
                : "border-[var(--nf-border-subtle)]"
            }`}
          >
            <span className="block text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
              {copy.reasons[option.code]}
            </span>
            <span className="mt-3xs block text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-secondary)]">
              {option.detail}
            </span>
          </button>
        ))}
      </div>

      <p
        aria-live="polite"
        className="mt-sm rounded-[var(--nf-radius-md)] border border-[var(--nf-border-subtle)] p-sm text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-primary)]"
      >
        {previewing || !preview
          ? copy.sheet.working
          : preview.paidMinor === 0
            ? copy.sheet.nothingPaid
            : `${fill(copy.sheet.owed, { refund: money(preview.refundMinor) })} ${
                preview.retainedMinor > 0
                  ? fill(copy.sheet.kept, { retained: money(preview.retainedMinor) })
                  : ""
              }`.trim()}
      </p>
    </div>
  );

  return (
    <>
      <Row>
        <Button variant="dangerQuiet" onClick={() => setOpen(true)}>
          {copy.cancel}
        </Button>
      </Row>

      {open && (
        <ActionSheet
          common={common}
          title={copy.sheet.title}
          description={copy.sheet.body}
          confirmLabel={copy.sheet.confirm}
          successTitle={copy.sheet.successTitle}
          successBody={copy.sheet.successBody}
          destructive
          extra={extra}
          withNotes
          notesLabel={copy.sheet.notesLabel}
          notesRequired={reason !== "guest_choice"}
          run={async (note) => {
            const outcome = await cancelBookingAsAdmin({ bookingId, reason, note });
            return outcome.ok ? { ok: true, data: null } : outcome;
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * One rung of the verification ladder.
 *
 * Two decisions, not three: a rung has either been checked and passed, or been
 * checked and failed. "Not looked at yet" is the absence of a row, not a state
 * somebody records, which is why there is no third button here.
 *
 * Failing a rung is the destructive one. It can lower a tier a guest can
 * already see, so it takes the same confirm sheet as every other consequential
 * decision on the console and it requires a note, enforced again in the server
 * action rather than only here.
 */
export function VerificationRungDecision({
  agentId,
  kind,
  copy,
  common,
  disabled,
}: {
  agentId: string;
  kind: "identity" | "address" | "payout" | "in_person";
  copy: AdminCopy["verification"];
  common: AdminCommon;
  /** True while the rung below this one has not passed. */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<"passed" | "failed" | null>(null);

  return (
    <>
      <Row>
        <Button
          variant="primary"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen("passed")}
        >
          {copy.pass}
        </Button>
        <Button variant="dangerQuiet" size="sm" onClick={() => setOpen("failed")}>
          {copy.fail}
        </Button>
      </Row>

      {open && (
        <ActionSheet
          common={common}
          title={open === "passed" ? copy.sheet.passTitle : copy.sheet.failTitle}
          description={open === "passed" ? copy.sheet.passBody : copy.sheet.failBody}
          confirmLabel={copy.sheet.confirm}
          successTitle={copy.sheet.successTitle}
          successBody={copy.sheet.successBody}
          withNotes
          notesLabel={copy.sheet.notesLabel}
          notesRequired={open === "failed"}
          destructive={open === "failed"}
          run={(note) => recordVerificationCheck({ agentId, kind, status: open, note })}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
