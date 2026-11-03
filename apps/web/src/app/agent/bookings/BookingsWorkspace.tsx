"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  formatMoney,
  formatDate,
  formatParty,
  plural,
  type Dictionary,
  type Locale,
} from "@vallo/i18n/core";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { fill } from "../_copy";
import { acceptBooking, declineBooking } from "@/lib/agent/bookings-actions";
import { HOLD_WINDOW_HOURS } from "@/lib/agent/bookings-model";
import type { HostBooking, HostBookingBoard } from "@/lib/agent/bookings-queries";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { DecisionCard } from "@/components/app/confirm/DecisionCard";
import { StatusPill, toneForStatus } from "@/components/ui/StatusPill";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { TextArea } from "@/components/ui/Field";
import { Icon3D } from "@/components/ui/Icon3D";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * The host's bookings console: requests that need a decision, plus the stays
 * that decision produced.
 *
 * The board arrives pre-grouped from readHostBookings, in the same four
 * buckets the dictionary already names, so this file only has to render them
 * and wire the two decisions a host can make. Accept and decline both go
 * through the typed ActionResult envelope: a failure renders as one plain
 * sentence, never a code, and a success closes the sheet and refreshes the
 * page so the list comes back from the database.
 */

export type BookingsCopy = Dictionary["agentBookings"];

type TabKey = "requests" | "upcoming" | "completed" | "cancelled";

const TAB_KEYS: TabKey[] = ["requests", "upcoming", "completed", "cancelled"];

/** Date-only ISO strings (check_in/check_out) parsed at noon UTC so no local
    timezone can roll them onto the wrong day. */
function dateOnly(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function durationLabel(t: BookingsCopy, hours: number): string {
  if (hours < 24) {
    return hours === 1 ? t.card.hoursOne : fill(t.card.hours, { count: hours });
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? t.card.daysOne : fill(t.card.days, { count: days });
}

type SheetState = { kind: "accept" | "decline"; booking: HostBooking };

const SUGGESTION_KEYS = ["taken", "maintenance", "guests"] as const;

function DecisionSheet({
  t,
  state,
  onClose,
}: {
  t: BookingsCopy;
  state: SheetState;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const copy = state.kind === "accept" ? t.accept : t.decline;

  function run() {
    setError(null);
    setReasonError(null);
    startTransition(async () => {
      try {
        const result =
          state.kind === "accept"
            ? await acceptBooking({ bookingId: state.booking.id })
            : await declineBooking({ bookingId: state.booking.id, reason: reason.trim() });

        if (!result.ok) {
          setError(result.error);
          if (result.fieldErrors?.reason) setReasonError(result.fieldErrors.reason);
          return;
        }
        onClose();
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  const declineDisabled = state.kind === "decline" && reason.trim().length === 0;

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={copy.title}
      footer={
        <div className="flex flex-wrap gap-md">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t.actions.back}
          </Button>
          {/* Declining reaches a guest who is waiting on an answer, so it
              confirms as a destructive action rather than behind the same blue
              primary that accepts one. Quiet, because it is a sheet confirm. */}
          <Button
            variant={state.kind === "accept" ? "primary" : "dangerQuiet"}
            className="flex-1"
            onClick={run}
            disabled={declineDisabled}
            loading={pending}
          >
            {copy.confirm}
          </Button>
        </div>
      }
    >
      <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
        {copy.body}
      </p>
      <p className="mt-sm truncate text-[length:var(--nf-text-caption)] font-semibold">
        {state.booking.guestName} &middot; {state.booking.listingTitle}
      </p>

      {state.kind === "decline" && (
        <div className="mt-md">
          {/*
            The reason field carried `aria-invalid` and showed nothing for it.
            `.nf-field` paints its border with a border-box gradient, so the
            error rule underneath sets a colour on a surface the gradient
            covers - the field looked identical whether the server had rejected
            it or not. TextArea owns the invalid state, the message, the
            `aria-describedby` wiring and the hint together.
          */}
          <TextArea
            label={t.decline.reasonLabel}
            hint={t.decline.reasonHint}
            error={reasonError ?? undefined}
            placeholder={t.decline.reasonPlaceholder}
            value={reason}
            maxLength={240}
            rows={3}
            textAreaClassName="resize-none"
            onChange={(e) => setReason(e.target.value)}
          />

          <p className="mb-xs mt-sm text-[length:var(--nf-text-overline)] font-normal text-[var(--nf-content-muted)]">
            {t.decline.suggestionsLabel}
          </p>
          {/*
            The `!py-1.5 !text-[length:var(--nf-text-overline)]` these carried was somebody forcing a
            chip back down after the box had been inflated to chase a touch
            target. `Chip` keeps its painted height and grows only its hit
            region, so the overrides are gone. Picking one really does select
            it - the reason field now holds that exact text - so the pressed
            state is a fact rather than decoration.
          */}
          <ChipRow bleed={false} fadeEdges={false}>
            {SUGGESTION_KEYS.map((key) => (
              <Chip
                key={key}
                size="sm"
                selected={reason === t.decline.suggestions[key]}
                onSelectedChange={() => setReason(t.decline.suggestions[key])}
              >
                {t.decline.suggestions[key]}
              </Chip>
            ))}
          </ChipRow>
        </div>
      )}

      {error && (
        <p
          className="mt-sm rounded-[var(--nf-container-radius)] p-sm text-[length:var(--nf-text-caption)] font-semibold"
          style={{
            background: "var(--nf-state-warning-surface)",
            color: "var(--nf-state-warning)",
          }}
          role="alert"
        >
          {error}
        </p>
      )}

    </Sheet>
  );
}

function BookingCard({
  t,
  booking,
  locale,
  onDecide,
}: {
  t: BookingsCopy;
  booking: HostBooking;
  locale: Locale;
  onDecide: (kind: "accept" | "decline", booking: HostBooking) => void;
}) {
  const pending = booking.status === "PENDING";

  /* The three counted phrases on a host's card. The composition line carried
     the same defect the admin console did, stating "1 adults, 1 children" for a
     single parent and child, because the template had one form and no rule to
     pick another. All three now resolve their category through
     `Intl.PluralRules` for the host's own locale, and the shared `counts` block
     at the root of the dictionary means the agent surfaces and the console say
     the same words for the same number. */
  /* `counts` is in the root layout's client copy and `hostWorkspace` in the
     page's CopyScope (W13): no client dictionary read, which shipped the
     whole dictionary, 398KB gzipped, with this page. */
  const counts = useClientCopy().counts;
  const doors = useScopedCopy("hostWorkspace").doors;
  const nightsLabel = plural(booking.nights, counts.nights, locale);
  const guestsLabel = plural(booking.guests, counts.guests, locale);
  const compositionLabel = formatParty(booking.adults, booking.children, counts, locale);

  const waitingLabel =
    booking.hoursWaiting === 0
      ? t.card.waitingNew
      : fill(t.card.waiting, { duration: durationLabel(t, booking.hoursWaiting) });

  const releasesLabel =
    booking.holdHoursLeft === null
      ? null
      : booking.holdHoursLeft > 0
        ? fill(t.card.releasesIn, { duration: durationLabel(t, booking.holdHoursLeft) })
        : fill(t.card.releasingNow, { hours: HOLD_WINDOW_HOURS });

  /*
   * AWAITING YOU (plan item 22; spec section 14, reference 36). A request is
   * the one real decision on this board, so it is drawn as the tinted
   * decision card: the guest, how long they have waited, what happens if
   * nobody answers, the stay's lines and its total, Accept as the one
   * primary, and Decline and a look at the calendar beside it. Accept and
   * Decline open the same DecisionSheet they always did; the card holds no
   * action of its own.
   */
  if (pending) {
    const dates = fill(t.card.dates, {
      from: formatDate(dateOnly(booking.checkIn), locale, { day: "numeric", month: "short" }),
      to: formatDate(dateOnly(booking.checkOut), locale, { day: "numeric", month: "short" }),
    });
    return (
      <li className="block" data-testid="booking-awaiting-you">
        <DecisionCard
          label={t.status.PENDING}
          when={waitingLabel}
          title={booking.guestName}
          sub={[
            releasesLabel,
            booking.arrivingName ? fill(t.card.arriving, { name: booking.arrivingName }) : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined}
          lines={[
            { label: booking.listingTitle, amount: nightsLabel },
            {
              label: dates,
              amount: booking.children > 0 ? `${guestsLabel} · ${compositionLabel}` : guestsLabel,
            },
          ]}
          total={{ label: t.card.total, amount: formatMoney(booking.totalMinor, locale) }}
          primary={
            <Button variant="primary" full onClick={() => onDecide("accept", booking)}>
              {t.actions.accept}
            </Button>
          }
          secondary={[
            <Button
              key="decline"
              variant="secondary"
              className="text-[var(--nf-state-error)]"
              onClick={() => onDecide("decline", booking)}
            >
              {t.actions.decline}
            </Button>,
            <ButtonLink key="calendar" variant="secondary" href={`/agent/listings/${booking.listingId}/calendar`}>
              {/* The accept sheet asks the host to check the property is
                  genuinely free; this is the door to that check, on the
                  listing's own calendar. */}
              {doors.checkCalendar}
            </ButtonLink>,
          ]}
        />
      </li>
    );
  }

  const settlementLabel =
    booking.settlement === "settled"
      ? t.card.settled
      : booking.settlement === "awaiting"
        ? t.card.awaiting
        : t.card.unknown;

  return (
    <li className="nf-panel nf-panel--card block overflow-hidden p-0">
      <div className="p-md sm:p-md">
        <div className="flex items-start justify-between gap-xs">
          <div className="min-w-0">
            {/*
              F2-065. THE GUEST'S NAME WAS TRUNCATED ON THE SCREEN WHERE AN
              AGENT DECIDES ABOUT THAT GUEST.
              Nigerian names run long and compound, so "Oluwaseun Adebayo-
              Ogundimu" elided to "Oluwaseun Adeb…" on a 390px card, and the
              agent accepting or declining could not read who they were
              answering. It wraps now. A card that is one line taller is a
              smaller cost than a decision taken about a name nobody could see.

              The listing line keeps its ellipsis, deliberately: a title is
              recognised from its opening words and the agent already knows
              their own stock, so the two strings are not the same kind of
              string and do not want the same treatment.
            */}
            <h3 className="text-[length:var(--nf-text-body-sm)] font-semibold [overflow-wrap:anywhere]">
              {booking.guestName}
            </h3>
            <p className="mt-3xs flex items-center gap-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
              <UiIcon name="house" size={12} className="shrink-0" />
              <span className="min-w-0 line-clamp-2 [overflow-wrap:anywhere]" title={booking.listingTitle}>
                {booking.listingTitle}
              </span>
            </p>
          </div>
          {/* The CANCELLED branch used to return a bare `.nf-badge`, which
              paints no fill and no colour: the one status a host most needs to
              notice was the one that rendered invisible. */}
          <StatusPill tone={toneForStatus(booking.status)} className="shrink-0">
            {t.status[booking.status]}
          </StatusPill>
        </div>

        <p className="mt-sm flex items-center gap-xs text-[length:var(--nf-text-caption)] font-normal text-[var(--nf-content-secondary)]">
          <UiIcon name="calendar-booking" size={16} className="shrink-0" />
          {fill(t.card.dates, {
            from: formatDate(dateOnly(booking.checkIn), locale, { day: "numeric", month: "short" }),
            to: formatDate(dateOnly(booking.checkOut), locale, { day: "numeric", month: "short" }),
          })}
          <span className="text-[var(--nf-content-muted)]">&middot; {nightsLabel}</span>
        </p>

        <p className="mt-xs flex items-center gap-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
          <UiIcon name="user" size={16} className="shrink-0" />
          {guestsLabel}
          {/* The breakdown only earns its place when it says something the
              guest count did not. A party with no children reads "2 guests"
              followed by "2 adults", which is the same fact twice, so the
              second half is dropped rather than repeated. */}
          {booking.children > 0 && (
            <span className="text-[var(--nf-content-muted)]">&middot; {compositionLabel}</span>
          )}
        </p>

        {/* Somebody other than the booker is arriving. The host has to know
            this before the gate does: the name above is who paid, and this is
            who will actually be standing at the security post. */}
        {booking.arrivingName && (
          <p
            data-testid="host-booking-arriving"
            className="mt-xs flex flex-wrap items-center gap-x-xs text-[length:var(--nf-text-caption)] font-normal text-[var(--nf-content-secondary)]"
          >
            <UiIcon name="verified" size={16} className="shrink-0" />
            {fill(t.card.arriving, { name: booking.arrivingName })}
            {booking.arrivingPhone && (
              <span className="nf-numeric text-[var(--nf-content-muted)]">
                {fill(t.card.arrivingPhone, { phone: booking.arrivingPhone })}
              </span>
            )}
          </p>
        )}

        <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {fill(t.card.requested, { date: formatDate(new Date(booking.createdAt), locale) })}
        </p>

        {pending && (
          <p
            className="mt-xs text-[length:var(--nf-text-overline)] font-semibold"
            style={{ color: "var(--nf-state-warning)" }}
          >
            {waitingLabel}
            {releasesLabel ? ` · ${releasesLabel}` : ""}
          </p>
        )}

        {booking.status !== "CANCELLED" && !pending && (
          <p
            className="mt-xs flex items-center gap-xs text-[length:var(--nf-text-overline)] font-semibold"
            style={{
              color:
                booking.settlement === "settled"
                  ? "var(--nf-state-success)"
                  : "var(--nf-content-muted)",
            }}
          >
            <UiIcon name="wallet" size={12} className="shrink-0" />
            {settlementLabel}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-sm border-t border-[var(--nf-border-subtle)] px-md py-sm">
        <p className="flex items-baseline gap-xs">
          <span className="nf-numeric text-[length:var(--nf-text-body-sm)] font-bold">
            {formatMoney(booking.totalMinor, locale)}
          </span>
          <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">{t.card.total}</span>
        </p>
        {pending && (
          <span className="flex flex-wrap items-center gap-sm">
            <Button variant="secondary" size="sm" onClick={() => onDecide("decline", booking)}>
              {t.actions.decline}
            </Button>
            <Button variant="primary" size="sm" onClick={() => onDecide("accept", booking)}>
              {t.actions.accept}
            </Button>
          </span>
        )}
      </div>
    </li>
  );
}

export function BookingsWorkspace({
  t,
  board,
  locale,
}: {
  t: BookingsCopy;
  board: HostBookingBoard;
  locale: Locale;
}) {
  const [active, setActive] = useState<TabKey>("requests");
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const emptyCopy: Record<TabKey, { title: string; body: string }> = {
    requests: {
      title: t.empty.requestsTitle,
      body: fill(t.empty.requestsBody, { hours: HOLD_WINDOW_HOURS }),
    },
    upcoming: { title: t.empty.upcomingTitle, body: t.empty.upcomingBody },
    completed: { title: t.empty.completedTitle, body: t.empty.completedBody },
    cancelled: { title: t.empty.cancelledTitle, body: t.empty.cancelledBody },
  };

  const rows = board[active];
  const groupCopy = t.groups[active];

  return (
    <div>
      {board.requests.length > 0 && (
        <p className="nf-badge nf-badge--warning mb-md inline-flex">
          {board.requests.length === 1
            ? t.waitingOnOne
            : fill(t.waitingOn, { count: board.requests.length })}
        </p>
      )}

      <div
        role="tablist"
        aria-label={t.tabsLabel}
        className="flex gap-xs overflow-x-auto pb-2xs"
      >
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`bookings-tab-${key}`}
            aria-selected={active === key}
            /*
              Only the active panel is rendered, so pointing every tab at a
              `bookings-panel-<key>` id sent a screen reader following the
              relationship to an element that does not exist. Only the selected
              tab controls anything, so only the selected tab says so.
            */
            aria-controls={active === key ? `bookings-panel-${key}` : undefined}
            onClick={() => setActive(key)}
            className={`nf-chip shrink-0 whitespace-nowrap ${active === key ? "nf-chip--active" : ""}`}
          >
            {t.groups[key].title}
            <span className="nf-numeric">{board[key].length}</span>
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`bookings-panel-${active}`}
        aria-labelledby={`bookings-tab-${active}`}
        className="mt-md"
      >
        <p className="mb-sm text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
          {fill(groupCopy.blurb, { hours: HOLD_WINDOW_HOURS })}
        </p>

        {rows.length > 0 ? (
          <ul className="space-y-sm">
            {rows.map((booking) => (
              <BookingCard
                key={booking.id}
                t={t}
                booking={booking}
                locale={locale}
                onDecide={(kind, target) => setSheet({ kind, booking: target })}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-md py-10 text-center sm:py-14">
            <span className="grid size-[5.5rem] shrink-0 place-items-center" aria-hidden="true" data-art="calendar-booked">
              <Icon3D name="calendar-booked" size={88} />
            </span>
            <h3 className="nf-h3">{emptyCopy[active].title}</h3>
            <p className="mx-auto max-w-[38ch] text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
              {emptyCopy[active].body}
            </p>
            <ButtonLink href="/agent/listings" variant="secondary">
              {t.empty.openListings}
            </ButtonLink>
          </div>
        )}
      </div>

      {sheet && <DecisionSheet t={t} state={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}
