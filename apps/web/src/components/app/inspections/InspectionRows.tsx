"use client";

import { TierBadge } from "@/components/trust/TierBadge";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, type Locale, type Dictionary } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { ICON_PLATE_GLYPH, IconPlate } from "@/components/ui/IconPlate";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { Row, RowList, TYPE } from "@/components/app/Screen";
import {
  acceptProposedTime,
  answerInspection,
  closeInspection,
} from "@/lib/inspections/actions";
import { waitingOn, type Inspection, type InspectionState } from "@/lib/inspections/types";
import { ViewingStepSheet, ViewingTimeSheet, type StepResult } from "./ViewingSheets";
import { viewingWords } from "./viewing-words";
import { reportNoShow } from "@/lib/inspections/no-show-actions";

/**
 * INSPECTIONS, AS ROWS, WITH THE STATE VISIBLE ON BOTH SIDES.
 *
 * One component, two audiences, and that is the point rather than an economy.
 * The single worst thing about arranging an inspection by chat is that the two
 * people are looking at different things: the agent remembers saying Sunday,
 * the renter remembers asking for Saturday and hearing nothing. A row that
 * renders from the same record on both screens cannot disagree with itself.
 *
 * `side` changes WHAT YOU CAN DO, never what you can see. A lister answers; a
 * requester takes an offered time or pulls out. Both read the same state, the
 * same two times and the same two notes.
 *
 * THE SHAPE IS THE SWITCH-PROFILE SHEET'S. Rows in one surface with inset
 * hairlines, a glyph in a tinted circle, a title, a line of detail, a state on
 * the right. Not a card per request: an agent with eleven enquiries would be
 * looking at eleven bordered boxes.
 */

const STATE_TONE: Record<InspectionState, StatusTone> = {
  REQUESTED: "warning",
  CONFIRMED: "success",
  PROPOSED: "info",
  DECLINED: "neutral",
  COMPLETED: "success",
  WITHDRAWN: "neutral",
  NO_SHOW: "danger",
};


/**
 * The indent that puts a row's controls under its text.
 *
 * Each row is the plate (the shared `IconPlate`, md, 2.75rem like the old
 * `nf-role-mark`), then `gap-sm`, then the text column. The controls
 * sit below in their own full-width div, so lining them up under the title means
 * clearing exactly those two things: `.nf-role-mark` is 2.75rem in
 * `app/css/controls.css` and the gap is the 12px rung, which is 56px.
 *
 * IT MOVED TO THE STYLESHEET AND IT NOW HAS A WIDTH CONDITION. It was an
 * arbitrary Tailwind value here, which cannot carry one, and at 390px the
 * indent was spending a sixth of the card lining three buttons up under a
 * title: "Offer another time" and "Decline" wrapped onto a second row hard
 * against the right edge. `.nf-insp-row__controls` in `app/css/threads.css`
 * drops it on a phone and restores it at 640, with the sum written out so
 * that if either half moves the rule follows it.
 */
const CONTROL_INDENT = "nf-insp-row__controls";

function whenLine(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDate(date, locale, { weekday: "short", day: "numeric", month: "short" })}, ${formatDate(date, locale, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function InspectionRows({
  inspections,
  side,
  sideFor,
  highlightId,
  locale,
  viewingCopy,
  flowCopy,
}: {
  inspections: Inspection[];
  /** Which end of the request this screen is. Changes the controls only. */
  side: "lister" | "requester";
  /**
   * Per-row override of `side`, for the one screen where a person is both.
   *
   * `/inspections` merges what somebody asked to see with what they were asked
   * to show, so the side is a fact about the ROW there rather than about the
   * screen. Everywhere else the screen decides and this is left out.
   */
  sideFor?: (inspection: Inspection) => "lister" | "requester";
  /**
   * The row whose state just changed somewhere else (the thread banner, say),
   * which arrives with `nf-tx-in` so the eye lands on it. One row, once.
   */
  highlightId?: string | null;
  locale: Locale;
  /** The moves' words (`threads.rental`), from the server parent. */
  viewingCopy: Dictionary["threads"]["rental"];
  /** The rows' own words (`memberFlows.inspection`), from the server parent. */
  flowCopy: Dictionary["memberFlows"]["inspection"];
}) {
  return (
    <RowList boxed>
      {inspections.map((inspection) => (
        <InspectionRow
          key={inspection.id}
          inspection={inspection}
          side={sideFor ? sideFor(inspection) : side}
          highlighted={highlightId === inspection.id}
          locale={locale}
          viewingCopy={viewingCopy}
          flowCopy={flowCopy}
        />
      ))}
    </RowList>
  );
}

function InspectionRow({
  inspection,
  side,
  highlighted = false,
  locale,
  viewingCopy,
  flowCopy,
}: {
  /** The moves' words (`threads.rental`). */
  viewingCopy: Dictionary["threads"]["rental"];
  /** The row's own words (`memberFlows.inspection`). */
  flowCopy: Dictionary["memberFlows"]["inspection"];
  inspection: Inspection;
  side: "lister" | "requester";
  highlighted?: boolean;
  locale: Locale;
}) {
  const {
    VIEWING_WORDS,
    PROPOSE_WORDS,
    RESCHEDULE_WORDS,
    DECLINE_WORDS,
    LISTER_CANCEL_WORDS,
    WITHDRAW_WORDS,
    noShowWords,
    NO_SHOW_WORDS,
    RENTER_CANCEL_WORDS,
  } = viewingWords(viewingCopy);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /* The one sheet open over the row: a time to offer, or a final move asked
     before it is made (the same two sheets the card and the thread open). */
  const [sheet, setSheet] = useState<
    null | "propose" | "reschedule" | "decline" | "cancelLister" | "withdraw" | "cancelRenter" | "noShow"
  >(null);
  /* A second tap while the first is in flight is dropped, not sent twice. */
  const inFlight = useRef(false);
  /* Read once, as the card does: is the agreed time still ahead? */
  const [clock] = useState(() => Date.now());
  /*
   * THE ROW THAT JUST CHANGED ARRIVES, ONCE.
   *
   * After an answer lands the router re-reads the list and the row comes back
   * with its new state. `nf-tx-in` is the wallet's "something landed" nudge and
   * motion.css asks that nobody invent a second one, so it is reused here: the
   * row slides in a few pixels and settles, and reduced motion turns it off in
   * the stylesheet rather than here. `highlighted` is the same thing driven
   * from outside, for a change made in the thread and seen on this list.
   */
  const [justChanged, setJustChanged] = useState(false);
  const entrance = highlighted || justChanged ? "nf-tx-in" : "";

  const waiting = waitingOn(inspection.state);
  const yourMove = waiting === side;
  const labels = side === "lister" ? flowCopy.rowLister : flowCopy.rowRequester;

  /* The time that matters is the agreed one once there is one, and the asked
     one until then. Showing both on a row would be two dates competing on a
     390px screen for a distinction almost nobody needs at a glance. */
  const shown = inspection.slotAt ?? inspection.requestedAt;

  const timeCome = Date.parse(shown) <= clock;

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await work();
        if (!result.ok) {
          setError(result.error ?? flowCopy.failed);
          return;
        }
        setJustChanged(true);
        router.refresh();
      } finally {
        inFlight.current = false;
      }
    });
  }

  /* A move made from a sheet: the sheet draws the refusal, the row re-reads. */
  function settle(result: StepResult): StepResult {
    if (result.ok) {
      setJustChanged(true);
      startTransition(() => router.refresh());
    }
    return result;
  }
  const answerWith = (state: "PROPOSED" | "DECLINED", when: string | null, note: string) =>
    answerInspection({ id: inspection.id, state, ...(when ? { when } : {}), ...(note ? { note } : {}) }).then(settle);
  const withdraw = () => closeInspection({ id: inspection.id, state: "WITHDRAWN" }).then(settle);

  return (
    <Row className={`flex-col items-stretch gap-xs py-md ${entrance}`}>
      <div className="flex w-full flex-wrap items-start gap-sm">
        <IconPlate size="md" className="mt-3xs">
          <UiIcon name="calendar-booking" size={ICON_PLATE_GLYPH.md} />
        </IconPlate>

        <span className="min-w-0 flex-1">
          {/* The property first. It is what an agent with nine of them is
              scanning for, and it is what a renter who asked three agents on
              Tuesday needs to tell the rows apart. */}
          {/*
            THE PROPERTY IS A LINK, because the line above this one says the
            property comes first so a renter who asked three agents on Tuesday
            can tell the rows apart, and dead text is not how somebody checks
            which flat a row is about. A row whose listing has since been
            taken down carries no id, so it stays plain text rather than
            pointing at nothing.
          */}
          {inspection.listingId ? (
            <Link
              href={`/listing/${inspection.listingId}`}
              className={`nf-tap block ${TYPE.rowTitle} hover:underline`}
            >
              {inspection.listingTitle ?? flowCopy.gone}
            </Link>
          ) : (
            <span className={`block ${TYPE.rowTitle}`}>
              {inspection.listingTitle ?? flowCopy.gone}
            </span>
          )}
          <span className={`mt-3xs block ${TYPE.rowMeta}`}>
            {whenLine(shown, locale)}
            {inspection.counterpartName ? `\u00a0· ${inspection.counterpartName}` : ""}
            {inspection.counterpartName && inspection.counterpartBadge ? <TierBadge tier={inspection.counterpartBadge} size={14} className="nf-ix-name-tier" /> : null}
          </span>

          {/* The time that was ASKED for, kept beside the one that was agreed.
              A reschedule that overwrote the ask would hide the fact that
              somebody wanted Saturday and is being given Sunday. */}
          {inspection.slotAt && inspection.slotAt !== inspection.requestedAt && (
            <span className={`mt-3xs block ${TYPE.caption}`}>
              {flowCopy.askedFor} {whenLine(inspection.requestedAt, locale)}
            </span>
          )}

          {inspection.note && (
            <span className={`mt-2xs block ${TYPE.rowMeta}`}>{inspection.note}</span>
          )}
          {inspection.listerNote && (
            <span className={`mt-2xs block ${TYPE.rowMeta}`}>{inspection.listerNote}</span>
          )}
        </span>

        {/* Its own line under the text on a phone, back on the right where
            there is room. See `.nf-insp-row__state` in threads.css: as a
            `shrink-0` cell at 390 it took a third of the card and every line
            of the row broke over three. */}
        <span className="nf-insp-row__state shrink-0">
          <StatusPill tone={STATE_TONE[inspection.state]}>
            {labels[inspection.state]}
          </StatusPill>
        </span>
      </div>

      {error && (
        <p role="alert" className={`${TYPE.rowMeta} text-[var(--nf-state-error)]`}>
          {error}
        </p>
      )}

      {/*
        THE CONTROLS, and only when it is actually this person's move.

        A row that always carries three buttons is a list you cannot scan. A
        confirmed inspection needs nothing done to it until its time, so it
        offers only the way to move it or call it off, and then "Mark as
        inspected". Decline and Withdraw have no way back in the database, so
        both ask first, in the same sheets the card and the thread open.
      */}
      {yourMove && side === "lister" && (
        <div className={`flex flex-wrap gap-xs ${CONTROL_INDENT}`}>
          <Button
            size="sm"
            variant="primary"
            disabled={pending}
            onClick={() => run(() => answerInspection({ id: inspection.id, state: "CONFIRMED" }))}
          >
            {VIEWING_WORDS.confirm}
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => setSheet("propose")}>
            {VIEWING_WORDS.offerAnother}
          </Button>
          <Button size="sm" variant="quiet" disabled={pending} onClick={() => setSheet("decline")}>
            {VIEWING_WORDS.decline}
          </Button>
        </div>
      )}

      {side === "requester" && (inspection.state === "PROPOSED" || inspection.state === "REQUESTED") && (
        <div className={`flex flex-wrap gap-xs ${CONTROL_INDENT}`}>
          {inspection.state === "PROPOSED" && (
            <Button
              size="sm"
              variant="primary"
              disabled={pending}
              onClick={() => run(() => acceptProposedTime({ id: inspection.id }))}
            >
              {VIEWING_WORDS.acceptTime}
            </Button>
          )}
          <Button size="sm" variant="quiet" disabled={pending} onClick={() => setSheet("withdraw")}>
            {VIEWING_WORDS.withdraw}
          </Button>
        </div>
      )}

      {/* A confirmed inspection can be marked as done by either side once its
          time has come, because either of them might be the one holding the
          phone afterwards; before it, it can be moved or called off. */}
      {inspection.state === "CONFIRMED" && (
        <div className={`flex flex-wrap items-center gap-xs ${CONTROL_INDENT}`}>
          {timeCome ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => closeInspection({ id: inspection.id, state: "COMPLETED" }))}
              >
                {VIEWING_WORDS.markInspected}
              </Button>
              <Button size="sm" variant="quiet" disabled={pending} onClick={() => setSheet("noShow")}>
                {side === "lister" ? NO_SHOW_WORDS.markRenter : NO_SHOW_WORDS.markLister}
              </Button>
            </>
          ) : (
            <>
              {side === "lister" && (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => setSheet("reschedule")}>
                  {VIEWING_WORDS.offerAnother}
                </Button>
              )}
              <Button
                size="sm"
                variant="quiet"
                disabled={pending}
                onClick={() => setSheet(side === "lister" ? "cancelLister" : "cancelRenter")}
              >
                {VIEWING_WORDS.cancelViewing}
              </Button>
            </>
          )}
          {inspection.conversationId && (
            <Link
              href={`/messages/${inspection.conversationId}`}
              className={`nf-tap ${TYPE.rowMeta} font-semibold text-[var(--nf-content-link)] hover:underline`}
            >
              {VIEWING_WORDS.openChat}
            </Link>
          )}
        </div>
      )}

      {/*
        THE MORNING AFTER THE INSPECTION, AND IT WAS A DEAD END.

        A COMPLETED row drew nothing at all. The only doors into
        `/rent/pay/<inspectionId>` in the whole product were inside a thread
        (`components/app/threads/RentalFace.tsx`, on the CONFIRMED state) and
        the move-in ledger, so `/inspections`, the surface somebody opens the
        day after standing in a flat, offered a chat link and stopped, on a
        platform whose name is about rent.

        The requester pays, so only that side sees it, exactly as the thread
        face decides. The route itself owns every answer to "is there a charge
        yet": no keys, not accepted, no figure, the lister looking at the
        tenant's page, already paid, each a designed screen. So this is a
        control that acts, not a picture of one.
      */}
      {inspection.state === "COMPLETED" && side === "requester" && (
        <div className={`flex flex-wrap items-center gap-xs ${CONTROL_INDENT}`}>
          <Link
            href={`/rent/pay/${inspection.id}`}
            className="nf-btn nf-btn--primary nf-btn--sm"
            data-testid="inspection-rent-pay"
          >
            {VIEWING_WORDS.payRent}
            <UiIcon name="chevron-right" size={16} />
          </Link>
          {inspection.conversationId && (
            <Link
              href={`/messages/${inspection.conversationId}`}
              className={`nf-tap ${TYPE.rowMeta} font-semibold text-[var(--nf-content-link)] hover:underline`}
            >
              {VIEWING_WORDS.openChat}
            </Link>
          )}
        </div>
      )}

      {(sheet === "propose" || sheet === "reschedule") && (
        <ViewingTimeSheet
          open
          onOpenChange={(next) => setSheet(next ? sheet : null)}
          words={sheet === "reschedule" ? RESCHEDULE_WORDS : PROPOSE_WORDS}
          onSubmit={(when, note) => answerWith("PROPOSED", when, note)}
        />
      )}
      {(sheet === "decline" || sheet === "cancelLister") && (
        <ViewingStepSheet
          open
          onOpenChange={(next) => setSheet(next ? sheet : null)}
          words={sheet === "decline" ? DECLINE_WORDS : LISTER_CANCEL_WORDS}
          onConfirm={(note) => answerWith("DECLINED", null, note)}
        />
      )}
      {sheet === "noShow" && (
        <ViewingStepSheet
          open
          onOpenChange={(next) => setSheet(next ? sheet : null)}
          words={noShowWords(side === "lister" ? "requester" : "lister")}
          onConfirm={(note) => reportNoShow({ id: inspection.id, ...(note ? { note } : {}) }).then(settle)}
        />
      )}
      {(sheet === "withdraw" || sheet === "cancelRenter") && (
        <ViewingStepSheet
          open
          onOpenChange={(next) => setSheet(next ? sheet : null)}
          words={sheet === "withdraw" ? WITHDRAW_WORDS : RENTER_CANCEL_WORDS}
          onConfirm={() => withdraw()}
        />
      )}
    </Row>
  );
}


