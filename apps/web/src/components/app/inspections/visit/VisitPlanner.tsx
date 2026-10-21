"use client";

import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import "@/app/css/visit.css";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { countOf, type Dictionary, type Locale } from "@vallo/i18n/core";
import { ActionBar } from "@/components/ui/ActionBar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Segmented } from "@/components/ui/Segmented";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { requestInspection } from "@/lib/inspections/actions";
import { bookViewingSlot } from "@/lib/viewings/actions";
import { sendOrKeep } from "@/lib/offline/send-or-keep";
import { newTapKey } from "@/components/calls/place-call";
import {
  addMonths,
  askDays,
  askTimesOn,
  dayPartOf,
  daysFrom,
  firstDayPart,
  groupByDayPart,
  lagosDayOf,
  monthGrid,
  monthOf,
  slotCounts,
  slotsOn,
  STRIP_DAYS,
  VISIT_NOTE_LIMIT,
  type DayPart,
  type OpenSlot,
  type VisitMode,
} from "@/lib/inspections/visit";
import { createVisitSubmitter, type VisitChoice } from "@/lib/inspections/visit-submit";
import { dateOf, dayLong, dayNumber, monthLabel, timeOf, weekdayHeaders, weekdayShort } from "./format";
import { onRadioKeys, radioTabIndex } from "./radio";

/**
 * STEP 1 OF SCHEDULE A VISIT: choose how, which day and what time, add a
 * line for the lister, check it, send it.
 *
 * TWO PATHS, BOTH THE EXISTING ACTIONS, AND THE SCREEN SAYS WHICH.
 *
 *   open times   the lister set viewing windows, so `viewing_slots` offers
 *                real free slots and the one picked is booked CONFIRMED by
 *                `book_viewing_slot` in one write.
 *   suggest      the lister has opened none (or the read failed, which is
 *                said as a failure, not as "none"): the renter suggests a
 *                time, `requestInspection` files it REQUESTED, and the
 *                screen says plainly that the lister will confirm.
 *
 * Nothing here takes or mentions a payment: viewing is free.
 */

type Copy = Dictionary["visit"];

/** One tap's key: the outbox's own, or the moment as a fallback. Read when a
    tap happens, never during a render. */
function visitTapKey(): string {
  return newTapKey() ?? `${Date.now()}`;
}

export function VisitPlanner({
  listingId,
  locale,
  now,
  copy,
  slots,
  videoOn,
  initialSlot,
  roleNoun,
  lister,
}: {
  listingId: string;
  locale: Locale;
  /** The render's clock, so the server and the first client render agree. */
  now: number;
  copy: Copy;
  /** The lister's open slots; null when the read failed. */
  slots: OpenSlot[] | null;
  videoOn: boolean;
  /** `?slot=` from a slot chosen on the listing page, when it is still open. */
  initialSlot: string | null;
  /** "owner", "agent" or "agency", for the suggest path's sentence. */
  roleNoun: string | null;
  /** The lister card, drawn by the page. */
  lister: ReactNode;
}) {
  const router = useRouter();
  const open = slots !== null && slots.length > 0;

  /* ------------------------------------------------------------ the days */
  const counts = useMemo(() => slotCounts(slots ?? []), [slots]);
  const days = useMemo(() => (open ? daysFrom(lagosDayOf(now), STRIP_DAYS) : askDays(now)), [open, now]);
  const enabled = (day: string) => (open ? (counts.get(day) ?? 0) > 0 : days.includes(day));
  const startSlot = open && initialSlot ? (slots ?? []).find((slot) => slot.slotAt === initialSlot) ?? null : null;
  const firstDay = startSlot ? lagosDayOf(startSlot.slotAt) : (days.find(enabled) ?? null);

  const [mode, setMode] = useState<VisitMode>("in_person");
  const [day, setDay] = useState<string | null>(firstDay);
  const [time, setTime] = useState<string | null>(startSlot?.slotAt ?? null);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [phoneGate, setPhoneGate] = useState(false);
  const [kept, setKept] = useState(false);

  /* ----------------------------------------------------------- the times */
  const times = useMemo(
    () => (day ? (open ? slotsOn(slots ?? [], day) : askTimesOn(day, now)) : []),
    [day, open, slots, now],
  );
  const groups = useMemo(() => groupByDayPart(times), [times]);
  const [part, setPart] = useState<DayPart>(() => (startSlot ? dayPartOf(startSlot.slotAt) : firstDayPart(groups)));

  function chooseDay(next: string) {
    setDay(next);
    setTime(null);
    setProblem(null);
    const nextTimes = open ? slotsOn(slots ?? [], next) : askTimesOn(next, now);
    setPart(firstDayPart(groupByDayPart(nextTimes)));
  }

  /* ---------------------------------------------------------- the submit */
  const submitter = useRef(
    createVisitSubmitter({
      book: (input) => bookViewingSlot(input),
      request: (input) => requestInspection(input),
      sendOrKeep: (payload, send) => sendOrKeep("request_inspection", payload, () => send()),
      newKey: visitTapKey,
    }),
  );

  function review() {
    if (!day) return setProblem(copy.problems.pickDay);
    if (!time) return setProblem(copy.problems.pickTime);
    setProblem(null);
    setSendError(null);
    setReviewOpen(true);
  }

  async function send() {
    if (!time || sending) return;
    setSending(true);
    setSendError(null);
    setPhoneGate(false);
    const choice: VisitChoice = { listingId, mode, kind: open ? "slot" : "ask", at: time, note };
    const outcome = await submitter.current(choice);
    if (outcome.state === "busy") return;
    setSending(false);
    if (outcome.state === "done") {
      setReviewOpen(false);
      router.replace(`/listing/${listingId}/visit/${outcome.id}`);
      setSending(true);
      return;
    }
    if (outcome.state === "kept") {
      setReviewOpen(false);
      setKept(true);
      return;
    }
    setSendError(outcome.state === "notKept" ? copy.problems.notKept : outcome.error || copy.problems.failed);
    setPhoneGate(outcome.state === "failed" && outcome.phoneGate === true);
  }

  /* ---------------------------------------------------------- rendering */
  const remaining = VISIT_NOTE_LIMIT - note.length;
  const dayIndexFirst = days.findIndex(enabled);
  const anyDay = day !== null && days.includes(day);
  const shownTimes = groups[part];
  const timeFirst = shownTimes.length > 0 ? 0 : -1;

  const modes: { value: VisitMode; title: string; sub: string; icon: "house" | "video" }[] = [
    { value: "in_person", title: copy.mode.inPerson, sub: copy.mode.inPersonSub, icon: "house" },
    ...(videoOn ? [{ value: "video" as const, title: copy.mode.video, sub: copy.mode.videoSub, icon: "video" as const }] : []),
  ];

  return (
    <>
      <div className="nf-visit__main">
        {/* ----------------------------------------------------- visit type */}
        <section className="nf-visit__section" aria-labelledby="visit-mode-heading">
          <h2 id="visit-mode-heading" className="nf-visit__heading">
            {copy.mode.heading}
          </h2>
          <div className="nf-visit-modes" role="radiogroup" aria-labelledby="visit-mode-heading" onKeyDown={onRadioKeys}>
            {modes.map((option, index) => {
              const checked = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={radioTabIndex(checked, index, 0, true)}
                  className="nf-visit-choice nf-tap"
                  onClick={() => setMode(option.value)}
                  data-testid={`visit-mode-${option.value}`}
                >
                  <UiIcon name={option.icon} size={20} className="nf-visit-choice__icon" />
                  <span className="nf-visit-choice__title">{option.title}</span>
                  <span className="nf-visit-choice__sub">{option.sub}</span>
                  <span className="nf-visit-choice__mark" aria-hidden="true">
                    {checked ? <UiIcon name="check" size={14} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ----------------------------------------------------------- date */}
        <section className="nf-visit__section" aria-labelledby="visit-date-heading">
          <div className="nf-visit__row">
            <h2 id="visit-date-heading" className="nf-visit__heading">
              {copy.date.heading}
            </h2>
            <span className="nf-visit__tools">
              <span className="nf-visit__month">
                <UiIcon name="calendar-booking" size={16} />
                {monthLabel(monthOf(day ?? days[0] ?? lagosDayOf(now)), locale)}
              </span>
              <button type="button" className="nf-visit__link nf-tap" onClick={() => setCalendarOpen(true)} data-testid="visit-full-view">
                {copy.date.fullView}
              </button>
            </span>
          </div>
          {open ? null : (
            <p className="nf-visit__lead" data-testid="visit-ask-lead">
              {slots === null
                ? copy.ask.slotsFailed
                : roleNoun
                  ? copy.ask.lead.replace("{role}", roleNoun)
                  : copy.ask.leadNoRole}
            </p>
          )}
          {open ? <p className="nf-visit__lead">{copy.open.lead}</p> : null}
          <div className="nf-visit-days" role="radiogroup" aria-labelledby="visit-date-heading" onKeyDown={onRadioKeys} data-testid="visit-days">
            {days.map((d, index) => {
              const checked = d === day;
              const on = enabled(d);
              const name = dayLong(d, locale);
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-label={open ? (on ? copy.date.dayWithTimes : copy.date.dayNoTimes).replace("{day}", name) : name}
                  disabled={!on}
                  tabIndex={radioTabIndex(checked, index, dayIndexFirst, anyDay)}
                  className="nf-visit-day nf-tap"
                  onClick={() => chooseDay(d)}
                  data-day={d}
                >
                  <span className="nf-visit-day__name">{weekdayShort(d, locale)}</span>
                  <span className="nf-visit-day__num nf-numeric">{dayNumber(d, locale)}</span>
                  <span className="nf-visit-day__dot" data-empty={open && on ? "false" : "true"} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

        {/* ----------------------------------------------------------- time */}
        <section className="nf-visit__section" aria-labelledby="visit-time-heading">
          <div className="nf-visit__row">
            <h2 id="visit-time-heading" className="nf-visit__heading">
              {open ? copy.time.heading : copy.ask.heading}
            </h2>
            <span className="nf-visit__muted">{copy.time.lagos}</span>
          </div>
          {day === null ? (
            <p className="nf-visit__muted">{copy.problems.pickDay}</p>
          ) : times.length === 0 ? (
            <p className="nf-visit__muted">{copy.time.noneThatDay}</p>
          ) : (
            <>
              <Segmented<DayPart>
                label={copy.time.heading}
                full
                size="sm"
                value={part}
                onChange={setPart}
                options={(["morning", "afternoon", "evening"] as const).map((value) => ({
                  value,
                  label: copy.time[value],
                  count: groups[value].length,
                }))}
              />
              {shownTimes.length === 0 ? (
                <p className="nf-visit__muted">{copy.time.noneInPart}</p>
              ) : (
                <div
                  className="nf-visit-times"
                  role="radiogroup"
                  aria-label={`${copy.time.heading}, ${dayLong(day, locale)}`}
                  onKeyDown={onRadioKeys}
                  data-testid="visit-times"
                >
                  {shownTimes.map((option, index) => {
                    const checked = option.slotAt === time;
                    return (
                      <button
                        key={option.slotAt}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        tabIndex={radioTabIndex(checked, index, timeFirst, shownTimes.some((t) => t.slotAt === time))}
                        className="nf-visit-time nf-tap"
                        onClick={() => {
                          setTime(option.slotAt);
                          setProblem(null);
                        }}
                        data-testid="visit-time"
                      >
                        {timeOf(option.slotAt, locale)}
                      </button>
                    );
                  })}
                </div>
              )}
              {open ? <p className="nf-visit__muted">{countOf(times.length, "openTimes", locale)}</p> : <p className="nf-visit__muted">{copy.time.askEarliest}</p>}
            </>
          )}
        </section>

        {/* --------------------------------------------------------- lister */}
        {lister}

        {/* ----------------------------------------------------------- note */}
        <section className="nf-visit__section">
          <label htmlFor="visit-note" className="nf-visit__heading">
            {copy.note.heading} <span className="nf-visit__heading-aside">{copy.note.optional}</span>
          </label>
          <textarea
            id="visit-note"
            className="nf-field nf-visit-note"
            value={note}
            maxLength={VISIT_NOTE_LIMIT}
            placeholder={copy.note.placeholder}
            aria-describedby="visit-note-count"
            onChange={(event) => setNote(event.target.value.slice(0, VISIT_NOTE_LIMIT))}
            data-testid="visit-note"
          />
          <span id="visit-note-count" className="nf-visit-note__count" aria-live="polite">
            {countOf(remaining, "charactersLeft", locale)}
          </span>
        </section>

        {kept ? (
          <p className="nf-visit__lead" role="status" data-testid="visit-kept">
            {copy.problems.kept}
          </p>
        ) : null}
        {problem ? (
          <p className="nf-visit__error" role="alert" data-testid="visit-problem">
            {problem}
          </p>
        ) : null}
      </div>

      {/* ------------------------------------------------------ the footer */}
      <ActionBar>
        <div className="nf-visit-bar">
          <ButtonLink href={`/listing/${listingId}`} variant="secondary" size="lg" replace data-testid="visit-cancel">
            {copy.footer.cancel}
          </ButtonLink>
          <Button variant="primary" size="lg" onClick={review} disabled={kept} data-testid="visit-continue">
            {copy.footer.continue}
          </Button>
        </div>
      </ActionBar>

      {/* --------------------------------------------------- the full month */}
      <MonthSheet
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        copy={copy}
        locale={locale}
        days={days}
        selected={day}
        hasTimes={(d) => open && (counts.get(d) ?? 0) > 0}
        enabled={enabled}
        askMode={!open}
        onPick={(d) => {
          chooseDay(d);
          setCalendarOpen(false);
        }}
      />

      {/* ------------------------------------------------------ the review */}
      <Sheet open={reviewOpen} onOpenChange={(next) => !sending && setReviewOpen(next)} title={copy.review.title} closeLabel={copy.close}>
        {time ? (
          <div className="nf-visit__section" data-testid="visit-review">
            <dl className="nf-visit-review">
              <div className="nf-visit-review__row">
                <dt>{copy.review.date}</dt>
                <dd>{dateOf(time, locale)}</dd>
              </div>
              <div className="nf-visit-review__row">
                <dt>{copy.review.time}</dt>
                <dd>
                  {timeOf(time, locale)} <span className="nf-visit__heading-aside">{copy.time.lagos}</span>
                </dd>
              </div>
              <div className="nf-visit-review__row">
                <dt>{copy.review.type}</dt>
                <dd>{mode === "video" ? copy.mode.video : copy.mode.inPerson}</dd>
              </div>
              {note.trim() ? (
                <div className="nf-visit-review__row">
                  <dt>{copy.review.note}</dt>
                  <dd>{note.trim()}</dd>
                </div>
              ) : null}
            </dl>
            <p className="nf-visit__lead">{open ? copy.review.bookLine : copy.review.askLine}</p>
            <p className="nf-visit__muted">{copy.review.free}</p>
            {sendError ? (
              <p className="nf-visit__error" role="alert" data-testid="visit-send-error">
                {sendError}
              </p>
            ) : null}
            <PhoneGateLink show={phoneGate} full />
            <Button variant="primary" size="lg" full loading={sending} onClick={() => void send()} data-testid="visit-send">
              {sending ? copy.footer.sending : open ? copy.footer.book : copy.footer.send}
            </Button>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------ the month */

function MonthSheet({
  open,
  onOpenChange,
  copy,
  locale,
  days,
  selected,
  hasTimes,
  enabled,
  askMode,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: Copy;
  locale: Locale;
  days: string[];
  selected: string | null;
  hasTimes: (day: string) => boolean;
  enabled: (day: string) => boolean;
  askMode: boolean;
  onPick: (day: string) => void;
}) {
  const first = days[0] ?? "";
  const last = days[days.length - 1] ?? first;
  const [month, setMonth] = useState(() => monthOf(selected ?? first));
  const weeks = monthGrid(month);
  const headers = weekdayHeaders(locale);
  const anyChecked = selected !== null && monthOf(selected) === month;
  const firstEnabled = weeks.flat().findIndex((d) => d !== null && enabled(d));

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={copy.date.calendarTitle} closeLabel={copy.date.done}>
      <div className="nf-visit-cal" data-testid="visit-calendar">
        <div className="nf-visit-cal__nav">
          <button
            type="button"
            className="nf-visit-cal__step nf-tap"
            aria-label={copy.date.previousMonth}
            disabled={month <= monthOf(first)}
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <UiIcon name="arrow-left" size={20} />
          </button>
          <p className="nf-visit-cal__month" aria-live="polite">
            {monthLabel(month, locale)}
          </p>
          <button
            type="button"
            className="nf-visit-cal__step nf-tap"
            aria-label={copy.date.nextMonth}
            disabled={month >= monthOf(last)}
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <UiIcon name="arrow-right" size={20} />
          </button>
        </div>
        <div className="nf-visit-cal__grid" aria-hidden="true">
          {headers.map((h, i) => (
            <span key={i} className="nf-visit-cal__weekday">
              {h}
            </span>
          ))}
        </div>
        <div className="nf-visit-cal__grid" role="radiogroup" aria-label={monthLabel(month, locale)} onKeyDown={onRadioKeys}>
          {weeks.flat().map((d, index) =>
            d === null ? (
              <span key={`blank-${index}`} className="nf-visit-cal__cell" />
            ) : (
              <span key={d} className="nf-visit-cal__cell">
                <button
                  type="button"
                  role="radio"
                  aria-checked={d === selected}
                  aria-label={
                    askMode ? dayLong(d, locale) : (hasTimes(d) ? copy.date.dayWithTimes : copy.date.dayNoTimes).replace("{day}", dayLong(d, locale))
                  }
                  disabled={!enabled(d)}
                  tabIndex={radioTabIndex(d === selected, index, firstEnabled, anyChecked)}
                  data-times={hasTimes(d) || (askMode && enabled(d)) ? "true" : "false"}
                  className="nf-visit-cal__day nf-tap nf-numeric"
                  onClick={() => onPick(d)}
                >
                  {dayNumber(d, locale)}
                </button>
              </span>
            ),
          )}
        </div>
        <ul className="nf-visit-cal__legend">
          <li className="nf-visit-cal__key">
            <span className="nf-visit-cal__swatch" data-kind="selected" aria-hidden="true" />
            {copy.date.legendSelected}
          </li>
          <li className="nf-visit-cal__key">
            <span className="nf-visit-cal__swatch" data-kind="times" aria-hidden="true" />
            {askMode ? copy.date.legendAsk : copy.date.legendTimes}
          </li>
          <li className="nf-visit-cal__key">
            <span className="nf-visit-cal__swatch" aria-hidden="true" />
            {copy.date.legendNone}
          </li>
        </ul>
      </div>
    </Sheet>
  );
}
