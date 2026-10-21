"use client";

import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { isPhoneGate, isSignedOutRefusal } from "@/lib/actions/envelope";
import { useActionState, useId, useState, useMemo } from "react";
import Link from "next/link";
import { withNext } from "@/lib/auth/next-link";
import { plural, type Dictionary, type Locale } from "@vallo/i18n/core";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { reserve, type ReserveReceipt } from "@/lib/bookings/actions";
import type { ActionResult } from "@/lib/actions/envelope";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ICON } from "@/components/app/Screen";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Amount } from "@/components/ui/Amount";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy, type SuccessWords } from "@/lib/ui/success-moments";
import { Switch } from "@/components/ui/Switch";
import { addDaysIso, useStayDates } from "@/components/app/listing/StayDates";
import { PhoneField } from "@/components/app/PhoneField";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Icon3D } from "@/components/ui/Icon3D";
import { DoorTotal, type DoorTotalCopy } from "@/components/stays/DoorTotal";
import type { DoorCharge } from "@/lib/stays/door-total";

/**
 * The next fourteen days, as ISO dates.
 *
 * Fourteen because it covers the window nearly every shortlet booking falls
 * in while still fitting a swipe; beyond that the native picker below is the
 * right tool and the rail would just be a worse calendar.
 */
function nextDays(fromIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDaysIso(fromIso, i));
}

/**
 * The lengths a shortlet is actually taken for.
 *
 * A weekend, a week, a fortnight, a month. Thirty nights rather than a calendar
 * month, because a calendar month is 28, 29, 30 or 31 nights depending on where
 * the check-in lands, and a chip that means a different stay in February than in
 * March is a chip that quotes a different price for the same word. Thirty is one
 * number, always, and the dates under it say exactly which nights they are.
 */
const STAY_LENGTHS: { key: keyof ReservePanelCopy["stayReserve"]["lengths"]; nights: number }[] = [
  { key: "weekend", nights: 2 },
  { key: "week", nights: 7 },
  { key: "twoWeeks", nights: 14 },
  { key: "month", nights: 30 },
];

/** The panel's words (`t.memberFlows`): its own lines and the two day names. */
export type ReservePanelCopy = Pick<Dictionary["memberFlows"], "stayReserve" | "days">;

/**
 * "Today", "Tomorrow", then a short weekday and day number.
 *
 * Built from the ISO string with a midday anchor rather than `new Date(iso)`,
 * which parses as UTC and can land on the previous day for anyone west of
 * Greenwich - a booking app that labels tomorrow as today is worse than one
 * that shows a raw date. The anchor is midday UTC, read in UTC, so the server
 * and every phone name the same day.
 */
function quickDateLabel(iso: string, todayIso: string, days: ReservePanelCopy["days"]): string {
  if (iso === todayIso) return days.today;
  if (iso === addDaysIso(todayIso, 1)) return days.tomorrow;
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * The reserve panel on a listing detail page.
 *
 * Native date inputs and a guest stepper feed a live kobo price breakdown,
 * then a server action that validates everything again and writes the booking
 * under RLS. Nights that are already booked or blocked arrive from the server
 * and are rejected inline the moment a clashing range is picked, before any
 * round trip. Success replaces the form with the confirmation moment; every
 * failure states what happened and what to do next.
 *
 * The dates themselves live in `StayDates`, one level up, because the sticky
 * bottom bar has to quote the same total this form is about to submit and the
 * panel renders twice on one page.
 */

const STAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function labelDate(iso: string): string {
  return STAY_LABEL.format(new Date(`${iso}T12:00:00Z`));
}

function Stepper({
  label,
  fewerLabel,
  moreLabel,
  name,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  /** The minus button's accessible name. */
  fewerLabel: string;
  /** The plus button's accessible name. */
  moreLabel: string;
  name: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-group">
      <span className="nf-body-sm text-[var(--nf-content-secondary)]">{label}</span>
      <span className="flex items-center gap-row">
        <button
          type="button"
          aria-label={fewerLabel}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="nf-icon-btn h-11 w-11 disabled:opacity-40"
        >
          <span aria-hidden="true" className="text-[length:var(--nf-text-body)] leading-none">
            &minus;
          </span>
        </button>
        <span className="nf-numeric w-5 text-center nf-body font-semibold">{value}</span>
        <Button
          variant="glass"
          size="sm"
          iconOnly
          aria-label={moreLabel}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="h-9 w-9 rounded-[var(--nf-radius-sm)] disabled:opacity-40"
        >
          <span aria-hidden="true" className="text-[length:var(--nf-text-body)] leading-none">
            +
          </span>
        </Button>
      </span>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

export function ReservePanel({
  listingId,
  currency,
  locale,
  instantBook,
  success,
  messageHref,
  door = [],
  doorCopy,
  copy,
}: {
  /** The panel's words, in the reader's language. */
  copy: ReservePanelCopy;
  /** The page's `t.success`, for "Dates held" or "Booking requested". Absent, no sheet. */
  success?: SuccessWords;
  /**
   * The charges this stay declared for the door (V-57). With them the guest
   * reads the whole cost before booking: each charge for these dates and this
   * party, and the all-in figure.
   */
  door?: readonly DoorCharge[];
  /** The words for the door charges; without them nothing about the door is drawn. */
  doorCopy?: DoorTotalCopy;
  listingId: string;
  currency: string;
  locale: Locale;
  instantBook: boolean;
  /** Deep link into the conversation about this listing, when one exists. */
  messageHref: string;
}) {
  // The panel renders twice on one page (inline on phones, sticky aside from
  // lg up), so input ids must be instance-unique.
  const uid = useId();

  /* The counted phrases on this panel used to be written as
     `nights === 1 ? "night" : "nights"`, which is two defects in one
     expression: it assumes every language has exactly two forms, and it writes
     the English ones straight into a product that ships in four languages.
     Both go through the dictionary now. The sentences that WRAP a count come
     from `t.reserve`, because a counted noun cannot be pluralised properly
     without also owning the words on either side of it. */
  const t = useClientCopy();
  const w = copy.stayReserve;

  const [state, formAction, pending] = useActionState<
    ActionResult<ReserveReceipt> | null,
    FormData
  >(reserve, null);
  /* The success sheet over the "Booking requested" panel, once per reserve. */
  const [successClosed, setSuccessClosed] = useState(false);

  /* Booking for somebody else. The three fields are not rendered at all until
     this is on, so an untouched form submits nothing about a third party and
     the server sees the absence rather than three empty strings.
     They are controlled rather than left to the DOM on purpose: React resets
     an uncontrolled field once a form action settles, so a refusal used to
     wipe all three and send the guest back to type a name and a phone number
     again to fix a date. */
  const [forSomeoneElse, setForSomeoneElse] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  /* Switching it off takes the third party with it. A change of mind must not
     leave a name half attached to a booking nobody meant to name. */
  const toggleForSomeoneElse = (next: boolean) => {
    setForSomeoneElse(next);
    if (!next) {
      setGuestName("");
      setGuestPhone("");
      setGuestEmail("");
    }
  };

  const stay = useStayDates();
  const {
    checkIn,
    checkOut,
    adults,
    children,
    capacity,
    setCheckIn,
    setCheckOut,
    setAdults,
    setChildren,
    today,
    priceMinor,
    nights,
    hint,
    ready,
    subtotalMinor,
    cleaningMinor,
    serviceMinor,
    totalMinor,
  } = stay;

  /* Memoised so the fourteen chips are not rebuilt on every keystroke in the
     guests field beneath them. */
  const quickDates = useMemo(() => nextDays(today, 14), [today]);

  /* Collapsed by default: the total is the decision, and the arithmetic behind
     it is for the person who wants to check it or compare per night. */
  const [showPerNight, setShowPerNight] = useState(false);

  const fieldError = (key: string): string | undefined =>
    state && !state.ok ? state.fieldErrors?.[key] : undefined;

  // ------------------------------------------------- the confirmation moment
  // A brief, choreographed beat rather than a flat state swap: the room
  // behind the card dims, the confirmed calendar tile pops in on its own
  // (CSS reacts to data-state="confirmed"), a band of light crosses the
  // card, then the details settle in. All transform/opacity, all under 1.4s,
  // and it collapses to the end state immediately under reduced motion.
  if (state?.ok) {
    const r = state.data;
    /* Held when the stay books instantly, requested when the agent confirms
       it personally: the words follow what is true, and neither is "paid". */
    const words = success ? successCopy(success, instantBook || r.instant ? "stayHeld" : "stayRequested") : null;
    return (
      <div className="nf-panel nf-panel--card isolate nf-confirm-sweep p-card" data-testid="reserve-success">
        {success && words ? (
        <SuccessSheet
          open={!successClosed}
          onOpenChange={(open) => {
            if (!open) setSuccessClosed(true);
          }}
          variant={words.variant}
          haptic={words.haptic}
          object={words.object}
          title={words.title}
          body={words.body}
          amount={{ minorUnits: r.totalMinor, currency, locale }}
          details={[
            {
              label: success.detail.when,
              value: w.range.replace("{from}", labelDate(r.checkIn)).replace("{to}", labelDate(r.checkOut)),
            },
          ]}
          primary={{ label: success.continue }}
        />
        ) : null}
        <span aria-hidden="true" className="nf-confirm-dim" />
        <div className="flex flex-col items-center gap-xs text-center">
          <span className="grid size-[4.5rem] shrink-0 place-items-center" aria-hidden="true" data-art="calendar-pending">
            <Icon3D name="calendar-pending" size={72} />
          </span>
          <p className="nf-lede font-semibold text-[var(--nf-content-primary)]">
            {instantBook || r.instant ? w.heldTitle : w.requestedTitle}
          </p>
        </div>
        <p className="nf-rise mt-heading text-center nf-body-sm leading-relaxed text-[var(--nf-content-secondary)]">
          {t.reserve.confirmedRange
            .replace("{from}", labelDate(r.checkIn))
            .replace("{to}", labelDate(r.checkOut))
            .replace("{nights}", plural(r.nights, t.counts.nights, locale))
            .replace("{guests}", plural(r.adults + r.children, t.counts.guests, locale))}
        </p>
        {r.arrivingName && (
          <p
            data-testid="reserve-arriving"
            className="nf-rise mt-row text-center nf-body-sm leading-relaxed text-[var(--nf-content-muted)]"
          >
            {w.arriving.replace("{name}", r.arrivingName)}
          </p>
        )}
        <dl className="nf-rise nf-body-sm mt-heading space-y-inline border-t border-[var(--nf-panel-hair)] pt-heading">
          {r.cleaningMinor > 0 && (
            <div className="flex items-center justify-between text-[var(--nf-content-secondary)]">
              <dt>{w.cleaning}</dt>
              <dd>
                <Amount minorUnits={r.cleaningMinor} locale={locale} currency={currency} />
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between font-semibold text-[var(--nf-content-primary)]">
            <dt>{w.totalRow}</dt>
            <dd>
              <Amount minorUnits={r.totalMinor} locale={locale} currency={currency} />
            </dd>
          </div>
        </dl>
        <p className="nf-rise mt-heading nf-body-sm leading-relaxed text-[var(--nf-content-muted)]">
          {instantBook || r.instant ? w.heldBody : w.requestedBody}
        </p>
        {/* Paying is the primary act, so it is the primary button. Leaving this
            moment with only a link to a list was the one gap between reserving
            and paying: the guest had to go and find the pay button themselves. */}
        <ButtonLink
          href={`/checkout/${r.bookingId}`}
          variant="primary"
          full
          className="mt-block"
        >
          {w.pay.split("{amount}")[0]}
          <Amount minorUnits={r.totalMinor} locale={locale} currency={currency} />
          {w.pay.split("{amount}")[1]}
        </ButtonLink>
        <ButtonLink
          href={`/bookings?side=stays&from=stays&justBooked=${r.bookingId}`}
          variant="ghost"
          full
          className="mt-row"
        >
          {w.payLater}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="nf-panel nf-panel--card isolate p-card" data-testid="reserve-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-row gap-y-inline-tight">
        <p>
          <Amount
            minorUnits={priceMinor}
            locale={locale}
            currency={currency}
            /*
              Hardcoded, and unlike `RentalPanel` that is correct here.

              This is not a label describing the row; it is a label describing
              the arithmetic directly underneath it, which is rate times NIGHTS
              in `StayDates` and again in `reserve()`. A per-head experience
              priced with `rate_period = 'guest'` would still be charged by the
              night by this panel, so reading the period off the row and
              printing "/ head" would make the caption disagree with the total
              it sits above. That gap is in the model, not in this string, and
              closing it means a per-head booking path rather than a new word.
            */
            suffix={w.perNight}
            className="text-[1.5rem] font-bold leading-none tracking-tight text-[var(--nf-content-primary)]"
            secondaryClassName="text-[length:max(0.54em,0.75rem)] font-semibold opacity-60"
          />
        </p>

        {instantBook && (
          <p className="flex items-center gap-inline nf-caption font-semibold text-[var(--nf-state-warning)]">
            <UiIcon name="calendar-check" size={ICON.inline} />
            {w.instantBook}
          </p>
        )}
      </div>

      <form action={formAction} noValidate className="mt-block">
        <input type="hidden" name="listingId" value={listingId} />

        {/* ------------------------------------------------------- dates */}
        {/*
          The quick-date rail.

          Reference 4 opens its booking flow on a horizontal strip of day chips
          rather than a date field, because on a phone the answer is nearly
          always "one of the next couple of weeks" and a native date picker
          makes that three taps and a modal.

          The native inputs stay directly beneath, and that is deliberate on two
          counts. They are the escape hatch for a date outside the fortnight,
          which a chip rail can never cover. And three Playwright specs -
          listing-detail, book-for-someone-else and capacity - drive this panel
          by filling `input[name="checkIn"]`, which requires the element visible
          and editable; hiding them behind a sheet would break all three. The
          chips write to the same `useStayDates` setters, so the two controls
          are one state, not two.
        */}
        <div className="mb-heading">
          <p className="nf-label mb-inline">{w.checkInRail}</p>
          <ChipRow label={w.checkInRailLabel} radiogroup>
            {quickDates.map((iso) => (
              <Chip
                key={iso}
                behaviour="choice"
                selected={checkIn === iso}
                onSelectedChange={() => {
                  setCheckIn(iso);
                  /* A check-out already behind the new check-in is not a date
                     range, so it is cleared rather than left to fail server
                     validation with a message the user cannot act on. */
                  if (checkOut && checkOut <= iso) setCheckOut("");
                }}
              >
                {quickDateLabel(iso, today, copy.days)}
              </Chip>
            ))}
          </ChipRow>
        </div>

        {/* `[&>*]:min-w-0`: a grid item defaults to `min-width: auto`, which is
            its min-content width, so a date input's intrinsic size decided the
            column rather than the column deciding the input. Two of them then
            measured wider than the card. */}
        {/* --------------------------------------------------- how long */}
        {/*
          WEEKLY AND MONTHLY, WITHOUT A WEEKLY OR MONTHLY PRICE.

          A shortlet quoted "per night" and then asked for two dates, so
          somebody who wanted a week set a check-in, opened a calendar, counted
          seven days and set a check-out. The rail answers that in one tap.

          The important part is what this is NOT. It does not introduce a weekly
          rate or a monthly rate. There is no such column, and inventing one
          would mean a second price to keep in step with the first and a second
          total to compute - and the total is computed TWICE already, once in
          `StayDates` for the panel and once in `reserve()` for the charge. The
          comment on `totalMinor` records what happened last time those two
          disagreed: the guest saw one number and was billed a bigger one.

          A length is a check-out date. It writes to the same setter the
          calendar writes to, the nights come out as 7 or 30, and the existing
          rate times nights is the answer on both sides. Nothing new to keep in
          step.
        */}
        <div className="mb-heading">
          <p className="nf-label mb-inline">{w.howLong}</p>
          <ChipRow label={w.howLongLabel} radiogroup>
            {STAY_LENGTHS.map((length) => {
              const from = checkIn || today;
              const target = addDaysIso(from, length.nights);
              return (
                <Chip
                  key={length.key}
                  behaviour="choice"
                  selected={checkIn !== "" && checkOut === target}
                  onSelectedChange={() => {
                    /* A length with no check-in yet means today, so the chip
                       does something on first tap rather than sitting inert
                       waiting for a date the person has not been asked for. */
                    if (!checkIn) setCheckIn(from);
                    setCheckOut(target);
                  }}
                >
                  {w.lengths[length.key]}
                </Chip>
              );
            })}
          </ChipRow>
        </div>

        <div className="grid grid-cols-2 gap-row [&>*]:min-w-0">
          <div>
            <label htmlFor={`${uid}-checkin`} className="nf-label">
              {w.checkIn}
            </label>
            <input
              id={`${uid}-checkin`}
              name="checkIn"
              type="date"
              min={today}
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              aria-invalid={hint || fieldError("checkIn") ? true : undefined}
              className="nf-field"
            />
          </div>
          <div>
            <label htmlFor={`${uid}-checkout`} className="nf-label">
              {w.checkOut}
            </label>
            <input
              id={`${uid}-checkout`}
              name="checkOut"
              type="date"
              min={checkIn ? addDaysIso(checkIn, 1) : addDaysIso(today, 1)}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              aria-invalid={hint || fieldError("checkOut") ? true : undefined}
              className="nf-field"
            />
          </div>
        </div>
        {(hint || fieldError("checkIn") || fieldError("checkOut")) && (
          <p role="alert" className="mt-row nf-body-sm text-[var(--nf-state-error)]">
            {hint ?? fieldError("checkIn") ?? fieldError("checkOut")}
          </p>
        )}

        {/* ------------------------------------------------------ guests */}
        {/* The host's declared capacity is the ceiling, split live between the
            two steppers, so a party the agent would turn away at the gate can
            never be assembled here. The server checks it again against the
            listing row; this is the courtesy, not the guard. */}
        <div className="mt-block space-y-row rounded-[var(--nf-container-radius)] border border-[var(--nf-panel-hair)] p-card-sm">
          <Stepper
            label={w.adults}
            fewerLabel={w.fewer.replace("{what}", w.adults)}
            moreLabel={w.more.replace("{what}", w.adults)}
            name="adults"
            value={adults}
            min={1}
            max={capacity === null ? 16 : Math.max(1, capacity - children)}
            onChange={setAdults}
          />
          <Stepper
            label={w.children}
            fewerLabel={w.fewer.replace("{what}", w.children)}
            moreLabel={w.more.replace("{what}", w.children)}
            name="children"
            value={children}
            min={0}
            max={capacity === null ? 10 : Math.max(0, capacity - adults)}
            onChange={setChildren}
          />
          {capacity !== null && (
            <p className="border-t border-[var(--nf-panel-hair)] pt-row nf-caption text-[var(--nf-content-muted)]">
              {t.reserve.capacityNote.replace(
                "{guests}",
                plural(capacity, t.counts.guests, locale),
              )}
            </p>
          )}
        </div>

        {/* -------------------------------------- the person arriving */}
        {/* The payer is often not the guest here: a sister in London books for
            a cousin flying into Lagos, and the arrival directions used to go
            to London. Naming somebody means giving a number the gate can ring,
            which is why the phone is required alongside the name and the email
            is not. */}
        <div className="mt-block rounded-[var(--nf-container-radius)] border border-[var(--nf-panel-hair)] px-md py-2xs">
          {/* The primitive's own row, not a fourth wrapper around it. The
              `py-sm` rhythm the deleted adapter carried moves here, where it
              is a property of THIS list rather than of every switch row on the
              platform. */}
          <Switch
            className="py-sm first:pt-0 last:pb-0"
            checked={forSomeoneElse}
            onCheckedChange={toggleForSomeoneElse}
            label={w.someoneElse}
            description={w.someoneElseBody}
          />
        </div>

        {forSomeoneElse && (
          <div className="nf-rise mt-heading grid gap-row">
            <div>
              <label htmlFor={`${uid}-guest-name`} className="nf-label">
                {w.theirName}
              </label>
              <input
                id={`${uid}-guest-name`}
                name="guestName"
                type="text"
                autoComplete="off"
                maxLength={80}
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={w.theirNamePlaceholder}
                aria-invalid={fieldError("guestName") ? true : undefined}
                className="nf-field"
              />
              {fieldError("guestName") && (
                /* A FIELD ERROR IS AN ERROR. `--nf-state-warning` resolves to
                  `--nf-cyan-400`, the same token `--nf-status-pending` is
                  defined as, so a refused input was drawn in the colour that
                  means "still going through". `Field.tsx` already gets this
                  right; these hand-rolled messages did not. */
                <p role="alert" className="mt-row nf-body-sm text-[var(--nf-state-error)]">
                  {fieldError("guestName")}
                </p>
              )}
            </div>
            {/* The one field on this form where a wrong character is not
                caught until somebody is standing at a gate. It states its
                country code, groups as it is typed and names the network, and
                what it posts is the canonical +234 form. */}
            <PhoneField
              id={`${uid}-guest-phone`}
              name="guestPhone"
              label={w.theirPhone}
              value={guestPhone}
              onChange={setGuestPhone}
              error={fieldError("guestPhone")}
              hint={w.theirPhoneHint}
              autoComplete="off"
            />
            <div>
              <label htmlFor={`${uid}-guest-email`} className="nf-label">
                {w.theirEmail}
              </label>
              <input
                id={`${uid}-guest-email`}
                name="guestEmail"
                type="email"
                autoComplete="off"
                maxLength={160}
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder={w.optional}
                aria-describedby={`${uid}-guest-email-hint`}
                aria-invalid={fieldError("guestEmail") ? true : undefined}
                className="nf-field"
              />
              <p
                id={`${uid}-guest-email-hint`}
                className="mt-row nf-caption leading-relaxed text-[var(--nf-content-muted)]"
              >
                {w.theirEmailHint}
              </p>
              {fieldError("guestEmail") && (
                <p role="alert" className="mt-row nf-body-sm text-[var(--nf-state-error)]">
                  {fieldError("guestEmail")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------- price breakdown
            Every figure the guest will be charged, named, before they tap.

            This block used to print the SUBTOTAL against a row labelled
            "Total", while `reserve()` went on to charge subtotal plus cleaning
            plus service. The guest read one number and was billed a larger one,
            and neither fee appeared anywhere on the page.

            The total leads, because that is the number somebody decides on.
            The per-night figure is one tap away for anybody comparing places,
            which is the only reason a per-night number is worth printing at
            all. */}
        {ready && (
          <div className="nf-hairline mt-block pt-block">
            <div className="flex items-baseline justify-between gap-row">
              {/* The `Amount` primitive, not a hand-assembled figure: the
                  tabular digits, the locale-built currency symbol and the
                  two-tone qualifier all come from one place. "total" is the
                  suffix the primitive was written for. */}
              <Amount
                minorUnits={totalMinor}
                locale={locale}
                currency={currency}
                suffix={w.total}
                className="nf-lede font-bold text-[var(--nf-content-primary)]"
                secondaryClassName="nf-body-sm font-normal text-[var(--nf-content-muted)]"
              />
              {/* The 44px floor DRAWN, not faked (the system's tertiary). This
                  was a 17px-tall link with a `before:-inset-2` overlay that
                  pushed the hit region over the total beside it. */}
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setShowPerNight((v) => !v)}
                aria-expanded={showPerNight}
                className="shrink-0"
              >
                {showPerNight ? w.hideBreakdown : w.showBreakdown}
              </Button>
            </div>

            {showPerNight && (
              <dl className="nf-body-sm mt-heading space-y-inline">
                <div className="flex items-center justify-between text-[var(--nf-content-secondary)]">
                  <dt>
                    <Amount minorUnits={priceMinor} locale={locale} currency={currency} /> &times;{" "}
                    {plural(nights, t.counts.nights, locale)}
                  </dt>
                  <dd>
                    <Amount minorUnits={subtotalMinor} locale={locale} currency={currency} />
                  </dd>
                </div>
                {/* Named separately, never folded into one figure. A guest
                    comparing two places has to be able to see which of them
                    charges what. */}
                {cleaningMinor > 0 && (
                  <div className="flex items-center justify-between text-[var(--nf-content-secondary)]">
                    <dt>{w.cleaning}</dt>
                    <dd>
                      <Amount minorUnits={cleaningMinor} locale={locale} currency={currency} />
                    </dd>
                  </div>
                )}
                {serviceMinor > 0 && (
                  <div className="flex items-center justify-between text-[var(--nf-content-secondary)]">
                    <dt>{w.serviceCharge}</dt>
                    <dd>
                      <Amount minorUnits={serviceMinor} locale={locale} currency={currency} />
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-[var(--nf-panel-hair)] pt-inline font-semibold text-[var(--nf-content-primary)]">
                  <dt>{w.totalRow}</dt>
                  <dd>
                    <Amount minorUnits={totalMinor} locale={locale} currency={currency} />
                  </dd>
                </div>
                <p className="pt-2xs nf-caption leading-relaxed text-[var(--nf-content-muted)]">
                  {w.nothingAdded}
                </p>
              </dl>
            )}
            {/* Every cost before booking, the charges at the door included,
                open rather than behind the breakdown toggle. */}
            {doorCopy && door.length > 0 && (
              <div className="mt-block">
                <DoorTotal
                  charges={door}
                  nights={nights}
                  guests={adults + children}
                  priceMinor={totalMinor}
                  locale={locale}
                  copy={doorCopy}
                />
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- failures */}
        {state && !state.ok && (
          <div
            role="alert"
            className="mt-block rounded-[var(--nf-container-radius)] border border-[var(--nf-panel-hair)] bg-[color-mix(in_oklab,var(--nf-state-warning)_12%,transparent)] p-card-sm nf-body-sm leading-relaxed text-[var(--nf-content-secondary)]"
          >
            {state.error}
            {isSignedOutRefusal(state.error) && (
              <Link
                href={withNext("/sign-in", `/listing/${encodeURIComponent(listingId)}`)}
                className="mt-row inline-flex min-h-11 items-center font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline"
              >
                {w.signIn}
              </Link>
            )}
            <PhoneGateLink show={isPhoneGate(state)} full className="mt-sm" />
          </div>
        )}

        <div className="mt-block grid gap-row">
          <Button type="submit" variant="primary" full disabled={!ready} loading={pending}>
            {w.reserve}
          </Button>
          {/* The second action under the blue Reserve is the warm spark (D81). */}
          <ButtonLink href={messageHref} variant="spark" full>
            {w.message}
          </ButtonLink>
        </div>
      </form>

      {/* 12.5px on the sentence that is this platform's single most important
          piece of consumer protection. Caption is the floor, and this line is
          the reason somebody does not wire money to a stranger. */}
      <p className="mt-block flex items-start gap-inline nf-caption leading-relaxed text-[var(--nf-content-muted)]">
        {/* Advice, so a neutral glyph in the line's own ink: the green shield
            means an earned check, and this line is not one (A9). */}
        <UiIcon name="info" size={ICON.inline} className="mt-3xs shrink-0" />
        {w.payAfterInspecting}
      </p>
    </div>
  );
}
