"use client";

import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { PushPrompt } from "@/components/app/push/PushPrompt";
import { isPhoneGate } from "@/lib/actions/envelope";
import { useActionState, useId, useMemo, useState } from "react";
import Link from "next/link";
import { reserveTable } from "@/lib/reservations/actions";
import type { ActionResult } from "@/lib/actions/envelope";
import { MAX_PARTY } from "@/lib/reservations/limits";
import { Button } from "@/components/ui/Button";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy, type SuccessWords } from "@/lib/ui/success-moments";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { slotsFor, type ServiceWindow } from "./table-windows";
import { useClientMount } from "@/lib/ui/client-mount";
import { countOf, type Dictionary, type Locale } from "@vallo/i18n/core";
import type { ReservedDeposit } from "@/lib/reservations/actions";
import { lagosIso, matchDepositRule, type DepositRule, type DepositWindow } from "@/lib/reservations/deposit-rules";
import { DepositSummary } from "@/components/app/reservations/DepositSummary";
import { DepositStep } from "@/components/app/reservations/DepositStep";
import "@/app/css/catalogue.css";

/**
 * Asking a restaurant to hold a table.
 *
 * Three questions and nothing else: when, how many, and anything they should
 * know. A restaurant reservation is not a stay, and the temptation to reuse the
 * stay panel is exactly what this avoids. That panel asks for a date RANGE, a
 * guest count against a bed capacity and a per-night total, and every one of
 * those is the wrong question about dinner.
 *
 * ## What it will not pretend
 *
 * Sending this does NOT hold a table. It asks. The restaurant is a person who
 * has to look at their own book and answer, so the button says what it does and
 * the receipt says the request is with them. A form that said "Table booked"
 * and then produced somebody standing at a door with no table would be the
 * worst thing on this platform, and it is the exact failure the whole
 * PENDING status exists to prevent.
 *
 * ## The date and time are Lagos, not the phone's
 *
 * Both are sent as plain strings and turned into an instant server-side against
 * a fixed +01:00. Somebody picking "Friday 7pm" means seven in the evening
 * where the restaurant is, whatever their device believes about its own
 * timezone, and a diaspora guest booking dinner for their family should not
 * book it for two in the morning.
 */

/** ISO date `offset` days from today, read in Lagos rather than in the device. */
function lagosDayIso(offset: number): string {
  const now = new Date();
  const lagos = new Date(now.getTime() + offset * 86_400_000 + 60 * 60 * 1_000);
  return lagos.toISOString().slice(0, 10);
}

/** The current time in Lagos as HH:MM, so today never offers a past table. */
function lagosClockNow(): string {
  return new Date(Date.now() + 60 * 60 * 1_000).toISOString().slice(11, 16);
}

/** The words this form says (`t.memberFlows`): its own lines and the two day names. */
export type ReserveTableCopy = Pick<Dictionary["memberFlows"], "table" | "days">;

/** "Today", "Tomorrow", then a short weekday. Anchored at midday, see below. */
function dayLabel(iso: string, todayIso: string, days: ReserveTableCopy["days"]): string {
  if (iso === todayIso) return days.today;
  if (iso === lagosDayIso(1)) return days.tomorrow;
  /* Midday rather than midnight, because `new Date("2026-08-09")` parses as
     UTC and renders as the previous day for anybody west of Greenwich. A
     booking form that labels tomorrow as today is worse than a raw date.
     Midday UTC, read in UTC, so the server and every phone name the same day. */
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function ReserveTable({
  listingId,
  businessId,
  messageHref,
  success,
  windows,
  windowCopy,
  title,
  formId,
  deposit = null,
  copy,
  locale,
}: {
  /** The form's words, in the reader's language. */
  copy: ReserveTableCopy;
  /** The reader's language, for the counted party in the receipt. */
  locale: Locale;
  /**
   * D75 (track/restaurant-deposits): the venue's active deposit rules, when
   * `restaurant_deposits` is on and a deposit can reach the venue (read on
   * the server, `readVenueDeposit`). With them the form says, for the day,
   * time and party picked, whether a deposit applies and how much, before
   * the guest asks; without them the form is exactly the free form it was.
   */
  deposit?: {
    rules: DepositRule[];
    windows: DepositWindow[];
    words: Dictionary["tableDeposits"]["guest"];
    locale: Locale;
  } | null;
  /**
   * The card's own heading. A page that already heads the section (a
   * restaurant's "Hold a table") passes null, so one card does not carry two
   * titles. Absent, the heading it always had (`copy.table.title`).
   */
  title?: string | null;
  /** The form's element id, for an anchored foot that scrolls to it. */
  formId?: string;
  /**
   * The venue's published service windows. With them, the time row offers
   * only the half hours inside the picked day's windows (`table-windows.ts`);
   * without them, the familiar times, and the venue confirms.
   */
  windows?: readonly ServiceWindow[];
  /** The picker's two lines (`t.experienceDetail.window`). */
  windowCopy?: { closedThatDay: string; noTimesLeftToday?: string; withinHours: string };
  /** The page's `t.success`, for "Table request sent". Absent, no sheet. */
  success?: SuccessWords;
  /**
   * The catalogue restaurant this table is at. Exactly one of `listingId` and
   * `businessId` is set, which is `reservations_exactly_one_target_chk` said
   * in the component's own props: `reserveSchema` refuses a form carrying both
   * or neither, so the two are never merged into one loose string.
   */
  listingId?: string;
  /** An M7 business-grade venue, which is the other half of the same rule. */
  businessId?: string;
  /**
   * Where "message the restaurant" goes, and null where a thread cannot
   * exist: `startConversation` binds a conversation to a listing, so a
   * business venue has none to open and the line is not drawn.
   */
  messageHref?: string | null;
}) {
  const w = copy.table;
  const heading = title === undefined ? w.title : title;
  const todayIso = lagosDayIso(0);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => lagosDayIso(i)), []);

  const [date, setDate] = useState(todayIso);
  const [time, setTime] = useState("19:00");
  /* The times on offer for the picked day. A time that is not on offer for
     the new day moves to the first one that is, so the hidden field never
     submits a time the picker is not showing. */
  /* Past times are dropped only once mounted: the server and the phone read
     the clock at different moments, and the first paint must match. */
  const mounted = useClientMount();
  const slots = useMemo(
    () => slotsFor(date, windows, mounted && date === todayIso ? lagosClockNow() : undefined),
    [date, windows, todayIso, mounted],
  );
  /* Empty with the clock ignored, the venue does not seat on this weekday;
     empty only with it applied, today's last seating has passed. Those are
     different news, so they are told apart rather than both saying closed. */
  const seatsThisWeekday = useMemo(() => slotsFor(date, windows).length > 0, [date, windows]);
  const shownTime = slots.includes(time) ? time : (slots[0] ?? "");
  const hasHours = (windows?.length ?? 0) > 0;
  const [party, setParty] = useState(2);

  const dateId = useId();
  const timeId = useId();
  const partyId = useId();
  const noteId = useId();

  const [state, formAction, pending] = useActionState<
    ActionResult<{ reservationId: string; status: "PENDING"; deposit?: ReservedDeposit | null }> | null,
    FormData
  >(reserveTable, null);
  /* What the restaurant's rule asks of this party at this time, on the
     screen, before anything is sent. The database quotes again once the
     request exists, and that is the figure the guest pays. */
  const preview = useMemo(
    () =>
      deposit && shownTime
        ? matchDepositRule(deposit.rules, deposit.windows, party, lagosIso(date, shownTime))
        : null,
    [deposit, party, date, shownTime],
  );
  /* The success sheet over the "Request sent" panel, once per request. */
  const [successClosed, setSuccessClosed] = useState(false);

  if (state?.ok && state.data.deposit && deposit) {
    /* THE ONE STEP LEFT. The request exists and the restaurant's rule asks a
       deposit of it: the database's own quote, its refund rule, and the card
       button. No success sheet over it: the request is not done until this
       is paid, and the venue cannot confirm before. */
    return (
      <DepositStep
        reservationId={state.data.reservationId}
        due={state.data.deposit}
        party={party}
        words={deposit.words}
        locale={deposit.locale}
      />
    );
  }

  if (state?.ok) {
    /* "Table request sent", never "booked": nothing is held until the
       restaurant says so (see the note in the panel below). */
    const words = success ? successCopy(success, "tableRequested") : null;
    return (
      <div className="nf-panel nf-panel--card isolate p-lg">
        {success && words ? (
        <SuccessSheet
          open={!successClosed}
          onOpenChange={(open) => {
            if (!open) setSuccessClosed(true);
          }}
          variant={words.variant}
          object={words.object}
          title={words.title}
          body={words.body}
          details={[{ label: success.detail.when, value: `${dayLabel(date, todayIso, copy.days)}, ${shownTime}` }]}
          primary={{ label: success.continue }}
          secondary={{ label: w.seeBookings, href: "/bookings?side=stays&from=stays" }}
        />
        ) : null}
        <p className="flex items-center gap-xs text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">
          <UiIcon name="chat-bubble" size={20} className="shrink-0 opacity-80" aria-hidden />
          {w.sentTitle}
        </p>
        {/* Deliberately not "Table booked". Nothing is held until a person at
            the restaurant says so, and a receipt that claimed otherwise would
            put somebody at a door with no table. */}
        <p className="mt-xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          {w.sentBody
            .replace("{party}", countOf(party, "guests", locale))
            .replace("{day}", dayLabel(date, todayIso, copy.days))
            .replace("{time}", shownTime)}
        </p>
        <Link
          href="/bookings?side=stays&from=stays"
          className="mt-md inline-flex text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)] underline underline-offset-4"
        >
          {w.seeBookings}
        </Link>
        {/* The moment the value of a notification is plain: the restaurant's
            answer is coming. After the success sheet, never over it;
            PushPrompt decides whether to ask at all (moments.ts). */}
        {successClosed || !success ? <PushPrompt moment="booking_requested" /> : null}
      </div>
    );
  }

  return (
    <form id={formId} action={formAction} className="nf-panel nf-panel--card isolate scroll-mt-28 p-lg">
      {/* One target, never both: the field that is not this venue's is simply
          not in the form, which is what `reserveSchema`'s refine asks for. */}
      {listingId && <input type="hidden" name="listingId" value={listingId} />}
      {businessId && <input type="hidden" name="businessId" value={businessId} />}
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={shownTime} />

      {heading ? (
        <p className="text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">{heading}</p>
      ) : null}

      <div className={heading ? "mt-md" : undefined}>
        <span className="nf-label" id={dateId}>
          {w.day}
        </span>
        <div
          role="group"
          aria-labelledby={dateId}
          className="-mx-2xs mt-2xs flex gap-2xs overflow-x-auto px-2xs pb-2xs"
        >
          {days.map((iso) => {
            const active = iso === date;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setDate(iso)}
                aria-pressed={active}
                className="nf-choice shrink-0"
              >
                {dayLabel(iso, todayIso, copy.days)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-md">
        <span className="nf-label" id={timeId}>
          {w.time}
        </span>
        <div
          role="group"
          aria-labelledby={timeId}
          className="-mx-2xs mt-2xs flex gap-2xs overflow-x-auto px-2xs pb-2xs"
        >
          {slots.map((slot) => {
            const active = slot === shownTime;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setTime(slot)}
                aria-pressed={active}
                className="nf-choice shrink-0 tabular-nums"
              >
                {slot}
              </button>
            );
          })}
        </div>
        {slots.length === 0 ? (
          <p className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]" data-testid="table-closed-day">
            {seatsThisWeekday
              ? (windowCopy?.noTimesLeftToday ?? w.noTimesLeftToday)
              : (windowCopy?.closedThatDay ?? w.closedThatDay)}
          </p>
        ) : hasHours && windowCopy ? (
          <p className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">{windowCopy.withinHours}</p>
        ) : null}
      </div>

      <div className="mt-md">
        <label className="nf-label" htmlFor={partyId}>
          {w.guests}
        </label>
        {/* The two steppers are rectangles on the control radius, as the field
            between them is. They were circles. See the note in TenancyTerm.tsx:
            a circle survives the shape law only where a governing reference
            draws that control round, and none draws a stepper. */}
        <div className="mt-2xs flex items-center gap-sm">
          <Button
            variant="glass"
            size="sm"
            iconOnly
            onClick={() => setParty((n) => Math.max(1, n - 1))}
            aria-label={w.fewerGuests}
            className="grid h-11 w-11 rounded-[var(--nf-radius-sm)] place-items-center text-[var(--nf-content-secondary)] disabled:opacity-40"
            disabled={party <= 1}
          >
            <UiIcon name="minus" size={16} aria-hidden />
          </Button>
          <input
            id={partyId}
            name="partySize"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_PARTY}
            value={party}
            onChange={(event) => {
              const next = Number(event.target.value);
              setParty(Number.isFinite(next) ? Math.min(MAX_PARTY, Math.max(1, next)) : 1);
            }}
            className="h-11 w-16 nf-glass--well rounded-[var(--nf-radius-sm)] border px-xs py-0 text-center text-[length:var(--nf-text-body-sm)] tabular-nums text-[var(--nf-content-primary)]"
          />
          <Button
            variant="glass"
            size="sm"
            iconOnly
            onClick={() => setParty((n) => Math.min(MAX_PARTY, n + 1))}
            aria-label={w.moreGuests}
            className="grid h-11 w-11 rounded-[var(--nf-radius-sm)] place-items-center text-[var(--nf-content-secondary)] disabled:opacity-40"
            disabled={party >= MAX_PARTY}
          >
            <UiIcon name="plus" size={16} aria-hidden />
          </Button>
        </div>
        {/* Said before somebody counts to fifty and is refused, rather than
            after. The database enforces the same number. */}
        {party >= MAX_PARTY &&
          (messageHref ? (
            <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
              {w.largerParty.split("{link}")[0]}
              <Link href={messageHref} className="underline underline-offset-2">
                {w.largerPartyLink}
              </Link>
              {w.largerParty.split("{link}")[1]}
            </p>
          ) : (
            <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
              {w.largestTable}
            </p>
          ))}
      </div>

      <div className="mt-md">
        <label className="nf-label" htmlFor={noteId}>
          {w.note}
        </label>
        <textarea
          id={noteId}
          name="note"
          rows={2}
          maxLength={500}
          placeholder={w.notePlaceholder}
          className="mt-2xs w-full nf-glass--well rounded-[var(--nf-radius-control)] border px-sm py-xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-primary)] placeholder:text-[var(--nf-content-muted)]"
        />
      </div>

      {/* D75: a deposit, when this venue asks one of this party at this time;
          otherwise one quiet line that the table is free. Only drawn for a
          venue that sets deposits at all. */}
      {deposit && slots.length > 0 ? (
        <div className="mt-md" aria-live="polite">
          {preview ? (
            <DepositSummary
              amountMinor={preview.amountMinor}
              perGuest={preview.rule.perGuest}
              ratePerGuestMinor={preview.rule.perGuest ? preview.rule.amountMinor : null}
              refundUntilHours={preview.rule.refundUntilHours}
              words={deposit.words}
              locale={deposit.locale}
              testId="deposit-preview"
            />
          ) : (
            <p className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]" data-testid="deposit-free">
              {deposit.words.free}
            </p>
          )}
        </div>
      ) : null}

      {state && !state.ok && (
        <p role="alert" className="mt-sm text-[length:var(--nf-text-caption)] text-[var(--nf-state-error)]">
          {state.error}
        </p>
      )}
      <PhoneGateLink show={isPhoneGate(state)} full className="mt-sm" />

      <Button type="submit" variant="primary" full className="mt-md" disabled={pending || slots.length === 0}>
        {pending ? w.sending : w.submit}
      </Button>

      {/* The promise, kept small and directly under the button that makes it.
          Nothing is held until the restaurant answers. */}
      <p className="mt-xs text-center text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
        {w.promise}
      </p>
    </form>
  );
}

