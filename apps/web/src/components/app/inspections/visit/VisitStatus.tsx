"use client";

import { banner } from "@/lib/ui/toast";
import "@/app/css/visit.css";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { ActionBar } from "@/components/ui/ActionBar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { ViewingStepSheet, type StepResult } from "@/components/app/inspections/ViewingSheets";
import { acceptProposedTime, closeInspection } from "@/lib/inspections/actions";
import { icsFileName, viewingIcs } from "@/lib/viewings/day-kit";
import { placeCall } from "@/components/calls/place-call";
import {
  calendarState,
  videoJoinState,
  visitTimeline,
  visitView,
  type StepKey,
  type TimelineStep,
  type VisitPhase,
  type VisitReminders,
  type VisitRow,
} from "@/lib/inspections/visit";
import { dateOf, stampOf, timeOf } from "./format";

/**
 * STEP 2 OF SCHEDULE A VISIT: WHERE IT STANDS, FROM THE ROW AND NOTHING ELSE.
 *
 * The phase, the tick, the tiles, the timeline, the calendar file and the
 * video call are all decided by `lib/inspections/visit.ts` from the
 * requester's own row, so this screen cannot say "confirmed" about a request
 * the lister has not answered, or offer a calendar entry for a time nobody
 * agreed. Every move is an existing action: `acceptProposedTime` takes an
 * offered time, `closeInspection` (WITHDRAWN) cancels, and "change time" is
 * that cancel followed by a fresh pick, said before it happens.
 *
 * The video call is the calls feature, placed into the visit's own thread
 * (`placeCall`): no link carries a token, and the database refuses a call
 * the lister has not opened the thread to.
 */

type Copy = Dictionary["visit"];

const PHASE_TITLE: Record<VisitPhase, keyof Copy["status"]> = {
  sent: "sent",
  proposed: "proposed",
  confirmed: "confirmed",
  declined: "declined",
  cancelledByLister: "cancelledByLister",
  withdrawn: "withdrawn",
  withdrawnConfirmed: "withdrawnConfirmed",
  completed: "completed",
  noShow: "noShow",
};

const PHASE_GLYPH: Record<VisitPhase, UiIconName> = {
  sent: "check",
  confirmed: "check",
  proposed: "calendar-clock",
  declined: "circle-x",
  cancelledByLister: "circle-x",
  withdrawn: "circle-x",
  withdrawnConfirmed: "circle-x",
  completed: "circle-check",
  noShow: "alert-triangle",
};

function subline(copy: Copy, phase: VisitPhase, roleNoun: string | null): string {
  const s = copy.status;
  switch (phase) {
    case "sent":
      return roleNoun ? s.sentSub.replace("{role}", roleNoun) : s.sentSubNoRole;
    case "confirmed":
      return roleNoun ? s.confirmedSub.replace("{role}", roleNoun) : s.confirmedSubNoRole;
    case "proposed":
      return s.proposedSub;
    case "declined":
      return s.declinedSub;
    case "cancelledByLister":
      return s.cancelledByListerSub;
    case "withdrawn":
      return s.withdrawnSub;
    case "withdrawnConfirmed":
      return s.withdrawnConfirmedSub;
    case "completed":
      return s.completedSub;
    case "noShow":
      return s.noShowSub;
  }
}

const STEP_TITLE: Record<StepKey, keyof Copy["timeline"]> = {
  sent: "sent",
  confirm: "confirm",
  eve: "eve",
  day: "day",
  visit: "visit",
  decision: "decision",
};

function stepLine(copy: Copy["timeline"], step: TimelineStep, row: VisitRow, locale: Locale): string {
  const when = step.at ? stampOf(step.at, locale) : "";
  if (step.status === "stopped" && step.key !== "confirm") return copy.stopped;
  switch (step.key) {
    case "sent":
      return copy.sentSub.replace("{when}", when);
    case "confirm":
      if (step.detail === "booked") return copy.confirmBooked;
      if (step.detail === "done") return copy.confirmDone.replace("{when}", when);
      if (step.detail === "declined") return step.at ? copy.confirmDeclined.replace("{when}", when) : copy.stopped;
      if (step.detail === "offered") return copy.confirmOffered;
      return step.status === "stopped" ? copy.stopped : copy.confirmWaiting;
    case "eve":
      return step.status === "done" ? copy.reminderDone.replace("{when}", when) : copy.eveSub;
    case "day":
      return step.status === "done" ? copy.reminderDone.replace("{when}", when) : copy.daySub;
    case "visit":
      if (step.status === "done" && step.at) return copy.visitDone.replace("{when}", when);
      return row.visitMode === "video" ? copy.visitVideo : copy.visitInPerson;
    case "decision":
      return step.status === "done" && step.at ? copy.decisionDone.replace("{when}", when) : copy.decisionSub;
  }
}

export function VisitStatus({
  row,
  listingId,
  locale,
  now,
  copy,
  reminders,
  roleNoun,
  lister,
  area,
  place,
  calendarWords,
}: {
  row: VisitRow;
  listingId: string;
  locale: Locale;
  /** The render's clock. */
  now: number;
  copy: Copy;
  reminders: VisitReminders;
  /** "owner", "agent" or "agency", for the sub line. */
  roleNoun: string | null;
  lister: ReactNode;
  /** The area alone, for the calendar title. */
  area: string;
  /** Area and state, for the calendar location. Never a street. */
  place: string;
  calendarWords: Pick<Dictionary["memberKit"]["dayKit"], "calendarTitle" | "calendarAlarm">;
}) {
  const router = useRouter();
  /* The render's clock first, so the server and the first client render
     agree; a confirmed video visit then ticks every 30 seconds, so "Join
     video visit" appears ten minutes before without a reload. */
  const [clock, setClock] = useState(now);
  const ticks = row.state === "CONFIRMED" && row.visitMode === "video";
  useEffect(() => {
    if (!ticks) return;
    const id = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [ticks]);
  const view = visitView(row, clock);
  const steps = visitTimeline(row, reminders, clock);
  const calendar = calendarState(row, clock);
  const join = videoJoinState(row, clock);
  const [sheet, setSheet] = useState<null | "cancel" | "change">(null);
  const [busy, setBusy] = useState(false);

  const t = copy.status;
  const title = t[PHASE_TITLE[view.phase]];
  const mode = row.visitMode === "video" ? copy.mode.video : copy.mode.inPerson;

  async function accept() {
    if (busy) return;
    setBusy(true);
    try {
      /* Said by the one banner at the top of the screen (Grade 1). */
      const result = await acceptProposedTime({ id: row.id });
      if (!result.ok) banner.error(result.error, { retry: () => void accept() });
      else { banner.success(copy.sheets.confirmedBanner); router.refresh(); }
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(): Promise<StepResult> {
    const result = await closeInspection({ id: row.id, state: "WITHDRAWN" });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  function addToCalendar() {
    if (calendar !== "available" || !row.slotAt) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const ics = viewingIcs({
      inspectionId: row.id,
      slotAt: row.slotAt,
      title: calendarWords.calendarTitle.replace("{area}", area),
      location: place,
      url: `${origin}/listing/${listingId}/visit/${row.id}`,
      alarm: calendarWords.calendarAlarm,
    });
    if (!ics) return;
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = icsFileName(area);
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function joinCall() {
    if (!row.conversationId) {
      banner.info(copy.actions.joinNoThread);
      return;
    }
    const placed = await placeCall({ conversationId: row.conversationId, kind: "VIDEO", context: { line: null } });
    if (!placed.ok) banner.error(placed.error);
  }

  const calendarReason =
    calendar === "notConfirmed" ? copy.actions.calendarWhy : calendar === "passed" ? copy.actions.calendarPassed : null;

  return (
    <>
      <div className="nf-visit__main" data-testid="visit-status" data-phase={view.phase}>
        {/* -------------------------------------------------------- hero */}
        <section className="nf-visit-hero" aria-live="polite">
          {view.check ? (
            <span className="nf-visit-hero__seal" data-tone={view.tone} aria-hidden="true" data-testid="visit-check">
              <UiIcon name="check" size={40} />
            </span>
          ) : (
            <span className="nf-visit-hero__glyph" data-tone={view.tone} aria-hidden="true">
              <UiIcon name={PHASE_GLYPH[view.phase]} size={24} />
            </span>
          )}
          <h2 className="nf-visit-hero__title" data-testid="visit-status-title">
            {title}
          </h2>
          <p className="nf-visit-hero__sub">{subline(copy, view.phase, roleNoun)}</p>
        </section>

        {/* ----------------------------------------- a new time, to take */}
        {view.canAccept ? (
          <div className="nf-visit__section">
            <Button variant="primary" size="lg" full loading={busy} onClick={() => void accept()} data-testid="visit-accept">
              {t.accept}
            </Button>
          </div>
        ) : null}

        {/* ------------------------------------------------------- tiles */}
        <dl className="nf-visit-tiles" data-testid="visit-tiles">
          <div className="nf-panel nf-panel--card nf-visit-tile">
            <UiIcon name="calendar-booking" size={20} className="nf-visit-tile__icon" />
            <dt>{copy.tiles.date}</dt>
            <dd>
              {dateOf(view.shownAt, locale)}
              {view.askedAt && dateOf(view.askedAt, locale) !== dateOf(view.shownAt, locale) ? (
                <span className="nf-visit-tile__was">
                  <span className="sr-only">{t.asked} </span>
                  {dateOf(view.askedAt, locale)}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="nf-panel nf-panel--card nf-visit-tile">
            <UiIcon name="clock" size={20} className="nf-visit-tile__icon" />
            <dt>{copy.tiles.time}</dt>
            <dd>
              {timeOf(view.shownAt, locale)}
              <span className="nf-visit-tile__zone">{copy.tiles.lagos}</span>
              {view.askedAt && view.askedAt !== view.shownAt ? (
                <span className="nf-visit-tile__was">
                  <span className="sr-only">{t.asked} </span>
                  {timeOf(view.askedAt, locale)}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="nf-panel nf-panel--card nf-visit-tile">
            <UiIcon name={row.visitMode === "video" ? "video" : "house"} size={20} className="nf-visit-tile__icon" />
            <dt>{copy.tiles.type}</dt>
            <dd>{mode}</dd>
          </div>
        </dl>

        {/* -------------------------------------------- the video call */}
        {join === "open" ? (
          <div className="nf-visit__section">
            <Button variant="primary" size="lg" full leadingIcon="video" onClick={() => void joinCall()} data-testid="visit-join">
              {copy.actions.join}
            </Button>
          </div>
        ) : join === "early" && row.slotAt ? (
          <p className="nf-visit__muted" data-testid="visit-join-later">
            {copy.actions.joinOpens.replace("{time}", timeOf(row.slotAt, locale))}
          </p>
        ) : join === "over" ? (
          <p className="nf-visit__muted">{copy.actions.joinEnded}</p>
        ) : null}

        {/* ------------------------------------------- the notes, as sent */}
        {row.note ? (
          <section className="nf-panel nf-panel--card nf-visit-quote" data-testid="visit-sent-note">
            <UiIcon name="file-text" size={20} className="nf-visit-quote__icon" />
            <div>
              <p className="nf-visit-quote__label">{copy.sentNote}</p>
              <p className="nf-visit-quote__text">{row.note}</p>
            </div>
          </section>
        ) : null}
        {row.listerNote ? (
          <section className="nf-panel nf-panel--card nf-visit-quote">
            <UiIcon name="chat-bubble" size={20} className="nf-visit-quote__icon" />
            <div>
              <p className="nf-visit-quote__label">{t.listerNote}</p>
              <p className="nf-visit-quote__text">{row.listerNote}</p>
            </div>
          </section>
        ) : null}

        {lister}

        {/* ---------------------------------------------------- timeline */}
        <section className="nf-visit__section" aria-labelledby="visit-next-heading">
          <h2 id="visit-next-heading" className="nf-visit__heading">
            {copy.timeline.heading}
          </h2>
          <ol className="nf-visit-steps" data-testid="visit-timeline">
            {steps.map((step) => (
              <li key={step.key} className="nf-visit-step" data-status={step.status} data-step={step.key}>
                <span className="nf-visit-step__mark" aria-hidden="true">
                  {step.status === "done" ? <UiIcon name="check" size={14} /> : step.status === "stopped" ? <UiIcon name="close" size={14} /> : null}
                </span>
                <div>
                  <p className="nf-visit-step__title">
                    <span className="sr-only">
                      {step.status === "done" ? copy.timeline.done : step.status === "current" ? copy.timeline.current : copy.timeline.upcoming}:{" "}
                    </span>
                    {copy.timeline[STEP_TITLE[step.key]]}
                  </p>
                  <p className="nf-visit-step__sub">{stepLine(copy.timeline, step, row, locale)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* --------------------------------------------------- the moves */}
        {view.cancel || view.canChangeTime ? (
          <div className="nf-visit-moves">
            {view.canChangeTime ? (
              <Button variant="secondary" onClick={() => setSheet("change")} data-testid="visit-change">
                {copy.actions.changeTime}
              </Button>
            ) : null}
            {view.cancel ? (
              <Button variant="quiet" onClick={() => setSheet("cancel")} data-testid="visit-cancel-visit">
                {view.cancel === "visit" ? copy.actions.cancelVisit : copy.actions.cancelRequest}
              </Button>
            ) : null}
          </div>
        ) : null}
        <p className="nf-visit__muted">
          <Link href={`/bookings?kind=inspection&from=property#ix-${row.id}`} className="underline">
            {copy.actions.seeAll}
          </Link>
        </p>
        {calendarReason ? (
          <p id="visit-calendar-why" className="nf-visit__muted" data-testid="visit-calendar-why">
            {calendarReason}
          </p>
        ) : null}
      </div>

      {/* ------------------------------------------------------ the footer */}
      <ActionBar>
        <div className="nf-visit-bar nf-visit-bar--even">
          <ButtonLink href={`/listing/${listingId}`} variant="secondary" size="lg" data-testid="visit-view-property">
            {copy.actions.viewProperty}
          </ButtonLink>
          {calendar === "hidden" ? (
            view.canAskAgain ? (
              <ButtonLink href={`/listing/${listingId}/visit`} variant="primary" size="lg" data-testid="visit-ask-again">
                {t.askAgain}
              </ButtonLink>
            ) : (
              <span aria-hidden="true" />
            )
          ) : (
            <Button
              variant="primary"
              size="lg"
              disabled={calendar !== "available"}
              aria-describedby={calendarReason ? "visit-calendar-why" : undefined}
              onClick={addToCalendar}
              data-testid="visit-add-calendar"
            >
              {copy.actions.addToCalendar}
            </Button>
          )}
        </div>
      </ActionBar>

      {sheet === "cancel" ? (
        <ViewingStepSheet
          open
          onOpenChange={(next) => setSheet(next ? "cancel" : null)}
          words={{
            title: view.cancel === "visit" ? copy.sheets.cancelVisitTitle : copy.sheets.cancelRequestTitle,
            body: view.cancel === "visit" ? copy.sheets.cancelVisitBody : copy.sheets.cancelRequestBody,
            confirm: copy.sheets.confirmCancel,
            keep: copy.sheets.keep,
          }}
          onConfirm={async () => {
            const result = await withdraw();
            if (result.ok) {
              banner.success(copy.sheets.cancelledBanner);
              router.refresh();
            }
            return result;
          }}
        />
      ) : null}
      {sheet === "change" ? (
        <ViewingStepSheet
          open
          onOpenChange={(next) => setSheet(next ? "change" : null)}
          words={{
            title: copy.sheets.changeTitle,
            body: copy.sheets.changeBody,
            confirm: copy.sheets.confirmChange,
            keep: copy.sheets.keep,
          }}
          onConfirm={async () => {
            const result = await withdraw();
            if (result.ok) {
              banner.success(copy.sheets.cancelledBanner);
              router.replace(`/listing/${listingId}/visit`);
            }
            return result;
          }}
        />
      ) : null}
    </>
  );
}
