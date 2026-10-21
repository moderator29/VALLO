"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { TYPE } from "@/components/app/Screen";
import {
  acceptProposedTime,
  answerInspection,
  closeInspection,
} from "@/lib/inspections/actions";
import type { Inspection, InspectionOutcome, InspectionState } from "@/lib/inspections/types";
import { fill, lagosWhen } from "./when";
import { ViewingDayKit } from "@/components/app/inspections/ViewingDayKit";
import {
  ViewingStepSheet,
  ViewingTimeSheet,
  type StepResult,
  type StepSheetWords,
  type TimeSheetWords,
} from "@/components/app/inspections/ViewingSheets";
import { viewingWords } from "@/components/app/inspections/viewing-words";
import { reportNoShow } from "@/lib/inspections/no-show-actions";

/**
 * THE RENTAL FACE: the inspection request, inside the chat it was made in.
 *
 * Nothing in the thread used to surface the `inspection_requests` state
 * machine; the only inspection control was the after-the-visit safety record
 * in the options sheet, which is a different thing and stays where it is.
 * This is the accept button the research asked for (section 4.2, gap 2), and
 * it is the same record every list reads, so accepting here flips the row on
 * /inspections, /agent/inspections and /bookings at once.
 *
 * `role` changes what you can do, never what you can see. A lister answers:
 * yes, another time, or no. A requester takes an offered time or pulls out.
 * A booked viewing that is still ahead can be moved by the lister or called
 * off by either side; once its time has come, either side can say it
 * happened. Every move with no way back (decline, withdraw, cancel) asks
 * first, in the sheets the inspection card and the dashboard rows open too.
 *
 * Every write goes through the existing actions and the database's own guard.
 * The face shows its new state the moment the action returns and then asks
 * the router to re-read, so what is drawn is never ahead of what was saved.
 */

type RentalCopy = Dictionary["threads"]["rental"];

type OpenSheet =
  | null
  | "propose"
  | "reschedule"
  | "decline"
  | "cancelLister"
  | "withdraw"
  | "cancelRenter"
  | "outcome"
  | "noShow";


export function RentalFace({
  inspection,
  role,
  counterpartName,
  copy,
  locale,
  onAccepted,
  dayKit,
  conversationId = null,
  area = "",
  place = "",
  now,
}: {
  inspection: Inspection;
  role: "lister" | "requester";
  counterpartName: string;
  copy: RentalCopy;
  locale: Locale;
  /** The accept ceremony: the header tints once. Pitch 13. */
  onAccepted: () => void;
  /** B5: the viewing day kit's words. Absent, no kit. */
  dayKit?: Dictionary["memberKit"]["dayKit"];
  /** This thread, where On my way and Running late are sent. */
  conversationId?: string | null;
  /** The area alone, for the calendar title; never a street. */
  area?: string;
  /** Area and city, for the calendar location. */
  place?: string;
  /** The render's clock, so a preview can pin "before" and "after" the viewing. */
  now?: number;
}) {
  const {
    VIEWING_WORDS,
    RESCHEDULE_WORDS,
    LISTER_CANCEL_WORDS,
    WITHDRAW_WORDS,
    noShowWords,
    NO_SHOW_WORDS,
    RENTER_CANCEL_WORDS,
    REASON_LABEL,
  } = viewingWords(copy);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<InspectionState>(inspection.state);
  const [slotAt, setSlotAt] = useState<string | null>(inspection.slotAt);
  const [settled, setSettled] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<OpenSheet>(null);
  /* A second tap while the first is in flight is dropped, not sent twice. */
  const inFlight = useRef(false);
  /* Read once, as the day kit does: whether the agreed time has come. */
  const [clock] = useState(() => now ?? Date.now());

  function run(work: () => Promise<{ ok: boolean; error?: string }>, then: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await work();
        if (!result.ok) {
          setError(result.error ?? copy.failed);
          return;
        }
        then();
        router.refresh();
      } finally {
        inFlight.current = false;
      }
    });
  }

  /* A move made from a sheet: the sheet draws its own refusal; on success
     the face takes its new state and the thread re-reads. */
  function fromSheet(result: StepResult, then: () => void): StepResult {
    if (result.ok) {
      then();
      startTransition(() => router.refresh());
    }
    return result;
  }

  const accept = () =>
    run(
      () => answerInspection({ id: inspection.id, state: "CONFIRMED" }),
      () => {
        setState("CONFIRMED");
        setSlotAt(inspection.slotAt ?? inspection.requestedAt);
        setSettled(copy.accepted);
        onAccepted();
      },
    );

  const acceptTime = () =>
    run(
      () => acceptProposedTime({ id: inspection.id }),
      () => {
        setState("CONFIRMED");
        setSettled(copy.accepted);
        onAccepted();
      },
    );

  const propose = async (when: string, note: string) =>
    fromSheet(
      await answerInspection({ id: inspection.id, state: "PROPOSED", when, ...(note ? { note } : {}) }),
      () => {
        setState("PROPOSED");
        setSlotAt(when);
        setSettled(null);
      },
    );

  /* A decline of a request, or a lister calling off a booked viewing: the
     same move (to DECLINED), and the reason rides it into the notification. */
  const decline = async (note: string, booked: boolean) =>
    fromSheet(
      await answerInspection({ id: inspection.id, state: "DECLINED", ...(note ? { note } : {}) }),
      () => {
        setState("DECLINED");
        setSettled(booked ? VIEWING_WORDS.cancelled : copy.declined);
      },
    );

  /* A withdrawal of a request, or a renter calling off a booked viewing. */
  const withdraw = async (booked: boolean) =>
    fromSheet(await closeInspection({ id: inspection.id, state: "WITHDRAWN" }), () => {
      setState("WITHDRAWN");
      setSettled(booked ? VIEWING_WORDS.cancelled : copy.withdrawn);
    });

  /* Once the time has come: the other side did not turn up. */
  const noShow = async (note: string) =>
    fromSheet(await reportNoShow({ id: inspection.id, ...(note ? { note } : {}) }), () => {
      setState("NO_SHOW");
      setSettled(copy.noShowSettled);
    });

  const complete = async (outcome: InspectionOutcome) =>
    fromSheet(await closeInspection({ id: inspection.id, state: "COMPLETED", outcome }), () => {
      setState("COMPLETED");
      setSettled(copy.inspected);
    });

  const name = counterpartName;
  const asked = lagosWhen(inspection.requestedAt, locale);
  const agreed = slotAt ? lagosWhen(slotAt, locale) : asked;
  const agreedAt = slotAt ?? inspection.requestedAt;
  /* The agreed time has come: it can be marked as inspected (the server
     holds the same rule); until then it can still be moved or called off. */
  const timeCome = Date.parse(agreedAt) <= clock;

  let sentence = "";
  let detail: string | null = null;
  if (state === "CONFIRMED") {
    sentence = fill(copy.confirmedFor, { when: agreed });
  } else if (state === "REQUESTED") {
    sentence = role === "lister" ? copy.waitingOnYou : fill(copy.waitingOnThem, { name });
    detail = fill(copy.askedFor, { when: asked });
  } else if (state === "PROPOSED") {
    sentence =
      role === "lister"
        ? fill(copy.offeredByYou, { name })
        : fill(copy.offeredToYou, { name });
    detail = agreed;
  }

  const yourMove =
    (role === "lister" && state === "REQUESTED") ||
    (role === "requester" && state === "PROPOSED");

  /* The dictionary's words wherever it has them; the shared English ones
     (`viewing-words.ts`) for the moves it does not carry yet. */
  const proposeWords: TimeSheetWords = {
    title: copy.proposeTitle,
    body: sheet === "reschedule" ? RESCHEDULE_WORDS.body : copy.proposeBody,
    when: copy.proposeWhen,
    note: copy.proposeNote,
    send: copy.proposeSend,
  };
  const stepWords: Record<"decline" | "cancelLister" | "withdraw" | "cancelRenter", StepSheetWords> = {
    decline: {
      title: copy.declineTitle,
      body: copy.declineBody,
      note: REASON_LABEL,
      confirm: copy.declineConfirm,
      keep: copy.keep,
    },
    cancelLister: { ...LISTER_CANCEL_WORDS, keep: copy.keep },
    withdraw: { ...WITHDRAW_WORDS, keep: copy.keep },
    cancelRenter: { ...RENTER_CANCEL_WORDS, keep: copy.keep },
  };
  const closeSheet = (next: boolean) => setSheet(next ? sheet : null);

  return (
    <section
      aria-label={sentence || settled || undefined}
      data-testid="thread-rental-face"
      className="nf-panel nf-panel--card nf-context-card"
    >
      <div className="flex w-full items-start gap-row">
        {/* The same glass object the context card above carries, so the face
            reads as the second row of one object rather than a second box.
            A glass object where the render shows one, per the founder's
            ruling; the state is in the words and in the controls. */}
        <span className="nf-plate nf-plate--brand nf-plate--md nf-context-card__mark" aria-hidden="true">
          <UiIcon name={state === "CONFIRMED" ? "verified" : "calendar-booking"} size={24} />
        </span>

        <div className="min-w-0 flex-1">
          {settled ? (
            <p role="status" className={`${TYPE.rowTitle} nf-confirm-pop`}>
              {settled}
            </p>
          ) : (
            <p className={TYPE.rowTitle}>{sentence}</p>
          )}
          {!settled && detail && <p className={`mt-inline-tight ${TYPE.rowMeta}`}>{detail}</p>}
          {settled && state === "CONFIRMED" && (
            <p className={`mt-inline-tight ${TYPE.rowMeta}`}>{fill(copy.confirmedFor, { when: agreed })}</p>
          )}

          {error && (
            <p role="alert" className={`mt-inline-tight ${TYPE.rowMeta} text-[var(--nf-state-error)]`}>
              {error}
            </p>
          )}

          {yourMove && role === "lister" && (
            <div className="mt-row flex flex-wrap gap-xs">
              <Button size="sm" variant="primary" disabled={pending} onClick={accept}>
                {copy.accept}
              </Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => setSheet("propose")}>
                {copy.offerAnother}
              </Button>
              <Button size="sm" variant="quiet" disabled={pending} onClick={() => setSheet("decline")}>
                {copy.decline}
              </Button>
            </div>
          )}

          {role === "requester" && (state === "REQUESTED" || state === "PROPOSED") && (
            <div className="mt-row flex flex-wrap gap-xs">
              {state === "PROPOSED" && (
                <Button size="sm" variant="primary" disabled={pending} onClick={acceptTime}>
                  {copy.acceptTime}
                </Button>
              )}
              <Button size="sm" variant="quiet" disabled={pending} onClick={() => setSheet("withdraw")}>
                {copy.withdraw}
              </Button>
            </div>
          )}

          {state === "CONFIRMED" && (
            <div className="mt-row flex flex-wrap gap-xs">
              {/*
                THE ENTRY TO PAYING THE RENT, once the inspection is agreed.
                `/rent/pay/<inspectionId>` is the in-product rent step (BB's
                route, ledger section 2.1); it carries the inspection so the
                charge is tied to the inspection that earned it. The requester
                is the one who pays, so only that side sees it.
              */}
              {role === "requester" && (
                <Link
                  href={`/rent/pay/${inspection.id}`}
                  className="nf-btn nf-btn--primary nf-btn--sm"
                  data-testid="thread-rent-pay"
                >
                  {copy.payRent}
                  <UiIcon name="chevron-right" size={16} />
                </Link>
              )}
              {timeCome ? (
                <>
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => setSheet("outcome")}>
                    {copy.markInspected}
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    disabled={pending}
                    onClick={() => setSheet("noShow")}
                    data-testid="thread-no-show"
                  >
                    {role === "lister" ? NO_SHOW_WORDS.markRenter : NO_SHOW_WORDS.markLister}
                  </Button>
                </>
              ) : (
                <>
                  {role === "lister" && (
                    <Button size="sm" variant="secondary" disabled={pending} onClick={() => setSheet("reschedule")}>
                      {copy.offerAnother}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="quiet"
                    disabled={pending}
                    onClick={() => setSheet(role === "lister" ? "cancelLister" : "cancelRenter")}
                    data-testid="thread-cancel-viewing"
                  >
                    {VIEWING_WORDS.cancelViewing}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* B5: the viewing day kit, the same one the inspection card on
              Plans carries: add to calendar, and on the day On my way and
              Running late, sent into this conversation. It draws nothing
              once the viewing has passed. */}
          {state === "CONFIRMED" && dayKit && slotAt && (
            <div className="nf-context-card__kit">
              <ViewingDayKit
                inspectionId={inspection.id}
                slotAt={slotAt}
                area={area}
                place={place}
                conversationId={conversationId}
                copy={dayKit}
              />
            </div>
          )}
        </div>
      </div>

      {(sheet === "propose" || sheet === "reschedule") && (
        <ViewingTimeSheet open onOpenChange={closeSheet} words={proposeWords} onSubmit={propose} />
      )}
      {(sheet === "decline" || sheet === "cancelLister") && (
        <ViewingStepSheet
          open
          onOpenChange={closeSheet}
          words={stepWords[sheet]}
          onConfirm={(note) => decline(note, sheet === "cancelLister")}
        />
      )}
      {(sheet === "withdraw" || sheet === "cancelRenter") && (
        <ViewingStepSheet
          open
          onOpenChange={closeSheet}
          words={stepWords[sheet]}
          onConfirm={() => withdraw(sheet === "cancelRenter")}
        />
      )}
      {sheet === "noShow" && (
        <ViewingStepSheet
          open
          onOpenChange={closeSheet}
          words={{ ...noShowWords(role === "lister" ? "requester" : "lister"), keep: copy.keep }}
          onConfirm={noShow}
        />
      )}
      {sheet === "outcome" && <OutcomeSheet open onOpenChange={closeSheet} copy={copy} onSubmit={complete} />}
    </section>
  );
}

/**
 * How it went. Three answers, one of which is chosen before Save is live, so
 * a thumb cannot mark an inspection done by accident. The choice is a group of
 * pressed buttons rather than a segmented row: the labels are sentences and
 * three of them side by side at 390px would be three truncated words. A
 * refusal is drawn here, in the sheet, not on the face behind it.
 */
function OutcomeSheet({
  open,
  onOpenChange,
  copy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: RentalCopy;
  onSubmit: (outcome: InspectionOutcome) => Promise<StepResult>;
}) {
  const [outcome, setOutcome] = useState<InspectionOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const options: { value: InspectionOutcome; label: string }[] = [
    { value: "inspected", label: copy.outcomeInspected },
    { value: "deal_done", label: copy.outcomeDealDone },
    { value: "no_deal", label: copy.outcomeNoDeal },
  ];
  async function save(chosen: InspectionOutcome) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await onSubmit(chosen);
      if (!result.ok) {
        setError(result.error ?? copy.failed);
        return;
      }
      onOpenChange(false);
    } catch {
      setError(copy.failed);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={copy.outcomeTitle} detents={[0.55]}>
      <div role="group" aria-label={copy.outcomeTitle} className="flex flex-col gap-inline">
        {options.map((option) => {
          const chosen = outcome === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={chosen ? "primary" : "secondary"}
              full
              aria-pressed={chosen}
              leadingIcon={chosen ? "verified" : undefined}
              onClick={() => setOutcome(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className={`mt-sm ${TYPE.rowMeta} text-[var(--nf-state-error)]`}>
          {error}
        </p>
      )}
      <Button
        full
        size="lg"
        variant="primary"
        className="mt-lg"
        loading={busy}
        disabled={outcome === null}
        onClick={() => outcome && void save(outcome)}
      >
        {copy.outcomeSave}
      </Button>
    </Sheet>
  );
}
