"use client";

import { useActionState } from "react";
import { respondToReservation } from "@/lib/reservations/actions";
import type { ActionResult } from "@/lib/actions/envelope";
import type { HostReservation, HostReservationBoard } from "@/lib/agent/reservations-queries";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { StatusPill } from "@/components/ui/StatusPill";
import { countOf, type Locale } from "@vallo/i18n/core";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { dateTimeLabel } from "@/lib/format/when";

/**
 * Tonight's tables, and the requests still waiting on an answer.
 *
 * The restaurant's half of the reservation loop. Until this existed a guest
 * could ask for a table, the row landed PENDING under RLS, and nobody at the
 * restaurant had any way to see it or answer, which is the state KNOWN_GAPS
 * named rather than left implied.
 *
 * ## Why the time is formatted here and not on the server
 *
 * It is not: `Intl` runs identically in both, and the timezone is pinned to
 * Africa/Lagos rather than taken from the device. A restaurant in Ikeja reading
 * the board on a phone still set to London must see the table at the hour their
 * kitchen will actually serve it. That is the same rule the guest form follows
 * from the other side, and if the two ever disagreed the whole feature would be
 * quietly wrong for exactly the people who travel.
 *
 * ## Accept is not styled louder than decline
 *
 * Both are real answers and the restaurant is the one who knows which is true.
 * A console that makes accepting the easy tap and declining the small grey link
 * is a console that produces accepted tables nobody kept.
 */

/** "Today, 19:30", "Tomorrow, 13:00", then "Sat 25 Oct, 19:30": pinned to Lagos time, never the device's (see the note above). */
function whenLabel(iso: string): string {
  return dateTimeLabel(iso);
}

function waitedLabel(hours: number, locale: Locale): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${countOf(hours, "hours", locale)} ago`;
  return countOf(Math.floor(hours / 24), "daysAgo", locale);
}

function Decision({ reservationId }: { reservationId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult<null> | null, FormData>(
    respondToReservation,
    null,
  );

  if (state?.ok) {
    return (
      <p className="mt-sm text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
        Answered. The guest can see it.
      </p>
    );
  }

  return (
    <>
      <div className="mt-sm flex flex-wrap gap-xs">
        {/* Two forms rather than one with two submit values, so that a decision
            cannot be changed by a stray Enter key landing on the wrong button. */}
        <form action={formAction}>
          <input type="hidden" name="reservationId" value={reservationId} />
          <input type="hidden" name="decision" value="CONFIRMED" />
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving" : "Accept"}
          </Button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="reservationId" value={reservationId} />
          <input type="hidden" name="decision" value="CANCELLED" />
          <Button type="submit" variant="secondary" disabled={pending}>
            Decline
          </Button>
        </form>
      </div>
      {state && !state.ok && (
        <p role="alert" className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-state-error)]">
          {state.error}
        </p>
      )}
    </>
  );
}

function ReservationCard({
  reservation,
  decidable,
}: {
  reservation: HostReservation;
  decidable: boolean;
}) {
  const locale = useClientLocale();
  const tone =
    reservation.status === "CONFIRMED"
      ? "success"
      : reservation.status === "CANCELLED"
        ? "danger"
        : "warning";

  return (
    <li className="nf-panel nf-panel--card block p-md sm:p-panel">
      <div className="flex flex-wrap items-center gap-xs">
        <StatusPill tone={tone}>
          {reservation.status === "PENDING"
            ? "Waiting on you"
            : reservation.status === "CONFIRMED"
              ? "Accepted"
              : "Declined"}
        </StatusPill>
        <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          asked {waitedLabel(reservation.hoursWaiting, locale)}
        </span>
      </div>

      <p className="mt-xs text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">
        {whenLabel(reservation.reservedFor)}
      </p>

      <p className="mt-2xs flex flex-wrap items-center gap-x-sm gap-y-2xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
        <span className="inline-flex items-center gap-xs">
          <UiIcon name="user" size={16} className="opacity-70" aria-hidden />
          {reservation.guestName}
        </span>
        <span className="tabular-nums">
          {countOf(reservation.partySize, "guests", locale)}
        </span>
        <span className="text-[var(--nf-content-muted)]">{reservation.listingTitle}</span>
      </p>

      {/* Shown to the host in full, never truncated. A note is where an allergy
          goes, and a shortened allergy is worse than none. */}
      {reservation.note && (
        <p className="mt-xs rounded-[var(--nf-container-radius)] bg-[var(--nf-surface-raised)] px-sm py-xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
          {reservation.note}
        </p>
      )}

      {decidable && <Decision reservationId={reservation.id} />}
    </li>
  );
}

function Section({
  title,
  empty,
  reservations,
  decidable,
}: {
  title: string;
  empty: string;
  reservations: HostReservation[];
  decidable: boolean;
}) {
  return (
    <section className="mt-lg">
      <h3 className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
        {title}
        {reservations.length > 0 && (
          <span className="ml-xs text-[length:var(--nf-text-caption)] font-normal tabular-nums text-[var(--nf-content-muted)]">
            {reservations.length}
          </span>
        )}
      </h3>
      {reservations.length === 0 ? (
        <p className="mt-xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">{empty}</p>
      ) : (
        <ul className="mt-sm flex flex-col gap-sm">
          {reservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              decidable={decidable}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ReservationsBoard({ board }: { board: HostReservationBoard }) {
  /* An agent with no restaurant sees nothing at all rather than three empty
     headings explaining a product they do not sell. */
  if (board.total === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="text-[length:var(--nf-text-body-lg)] font-bold text-[var(--nf-content-primary)]">Tables</h2>
      <p className="mt-2xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
        Requests at your restaurants. Nothing is held for a guest until you accept it.
      </p>

      <Section
        title="Waiting on you"
        empty="No requests to answer."
        reservations={board.requests}
        decidable
      />
      <Section
        title="Coming up"
        empty="No tables booked yet."
        reservations={board.upcoming}
        decidable={false}
      />
      <Section
        title="Past"
        empty="Nothing yet."
        reservations={board.past}
        decidable={false}
      />
    </div>
  );
}
