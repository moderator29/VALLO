import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getMyBookings } from "@/lib/bookings/queries";
import { PageHeader } from "@/components/app/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState, TYPE } from "@/components/app/Screen";
import { EmptyActions } from "@/components/app/EmptyActions";
import { TenancyCard } from "@/components/app/bookings/TenancyCard";
import { BookingDetailCard } from "./BookingDetailCard";
import { Tracker } from "@/components/ui/Tracker";
import type { StatusTone } from "@/components/ui/StatusPill";
import { deriveBookingSteps } from "@/components/app/threads/booking-steps";
import { lagosDay, lagosWhen } from "@/components/app/threads/when";
import { readBookingStateEvents } from "@/lib/bookings/state-events";
import { BookingMoneyRecord } from "@/components/app/after-gate/BookingMoneyRecord";
import { ArrivalCheck } from "@/components/app/arrival-check/ArrivalCheck";
import { ArrivalChargesLine } from "@/components/stays/ArrivalChargesLine";
import { DoorChargeReport } from "@/components/stays/DoorChargeReport";
import { bookingChargeKind } from "@/lib/after-gate/is-rent-charge";
import { lagosToday } from "@/lib/rent/schema";
import { getCheckoutView } from "@/lib/bookings/checkout-view";
import { stayReceipt } from "@/components/app/money/receipt-model";
import { ReceiptSheet } from "@/components/app/money/ReceiptSheet";
import { ReceiptActions } from "@/components/money/ReceiptActions";
import { withNext } from "@/lib/auth/next-link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSession } from "@/lib/actions/session";
import { readStayDetails } from "@/lib/bookings/stay-details";
import { StayDetailsPanel } from "@/components/app/bookings/StayDetailsPanel";

/** A receipt for one commitment. Never indexed, and never in a tab title. */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getDictionary(await getLocale()).shape.plans.kinds.stay,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

/**
 * ONE BOOKING, AND THE ROUTE THAT DID NOT EXIST.
 *
 * R2 finding R2-2, confirmed critical: `components/app/messages/share.ts`
 * builds `/bookings/<id>` for a booking shared into a chat, and its own
 * comment called that "the trips hub's own detail route". There was no such
 * route. `app/(app)/bookings/` held `page.tsx` and `[bookingId]/review` and
 * nothing else, so TWO primary buttons (the booking card in a thread and the
 * thread's own context banner) ended the reservations-and-threads journey on
 * a 404, at the last tap, on the screen where somebody is checking a stay
 * they have paid for.
 *
 * It is built rather than repointed at the list. A shared card promises to
 * open the booking it shows, and a list is not that: on an account with nine
 * stays it asks the reader to find the one they were just sent.
 *
 * ---------------------------------------------------------------------------
 * THE READ, AND WHY IT IS `getMyBookings`.
 *
 * This link travels in a chat, so it reaches people who are not party to the
 * booking. `getMyBookings` reads `bookings` through the SIGNED-IN READER'S own
 * RLS-bound client, which is the only thing standing between a stranger and
 * somebody else's stay, and it is deliberately the only thing: a second
 * ownership check in this file would be a second place for the rule to live
 * and the weaker of two rules is the one that ends up enforced.
 *
 * Asking it for the whole account and picking one row costs one extra read on
 * a detail page and buys the thing that matters: `cancellable`, `reviewable`,
 * `payable` and the tenancy branch are computed in ONE place, so this page and
 * the hub can never disagree about whether a stay can still be called off.
 *
 * NOT YOURS AND NOT THERE LAND ON THE SAME PANEL, deliberately. Telling them
 * apart would confirm to somebody guessing ids that a booking exists, and the
 * two are indistinguishable to this reader anyway: neither is theirs.
 *
 * A TENANCY IS NOT A STAY HERE EITHER. A rent charge shares the bookings
 * table, so a shared link can resolve to one; it is drawn by `TenancyCard`,
 * with a move-in day and a period, and never with nights and guests.
 */
export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.catalogue.bookings;
  const loaded = await getMyBookings(locale);

  const shell = (children: React.ReactNode) => (
    <div className="nf-cat-surface mx-auto max-w-2xl">
      <PageHeader title={t.shape.plans.kinds.stay} fallback="/bookings?side=stays&from=stays" />
      <Reveal>{children}</Reveal>
    </div>
  );

  /* A read that failed says so. It must not say "not found", which would tell
     somebody their booking is gone when the database simply blinked. */
  if (loaded === "unavailable") {
    return shell(
      <div className="py-heading text-center" data-testid="booking-unavailable">
        <p className={TYPE.rowTitle}>{copy.unavailableTitle}</p>
        <p className={`mx-auto mt-row max-w-sm ${TYPE.body}`}>{copy.unavailableBody}</p>
      </div>,
    );
  }

  /* No session. The middleware sends a signed-out visitor to /sign-in before
     this file runs, so this is the unconfigured edge, and it is answered with
     the door rather than with a stranger's booking. */
  if (loaded === null) {
    return shell(
      <EmptyState
        icon="calendar-check"
        title={copy.signedOutTitle}
        body={copy.signedOutBody}
        action={
          <EmptyActions
            primary={{ label: copy.signIn, href: withNext("/sign-in", `/bookings/${bookingId}`) }}
            secondary={{ label: copy.findStay, href: "/search" }}
          />
        }
        data-testid="booking-signed-out"
      />,
    );
  }

  const tenancy = loaded.rent.find((row) => row.id === bookingId);
  if (tenancy) {
    return shell(
      <ul className="grid gap-md">
        <TenancyCard tenancy={tenancy} locale={locale} />
      </ul>,
    );
  }

  const booking = [...loaded.upcoming, ...loaded.completed, ...loaded.cancelled].find(
    (row) => row.id === bookingId,
  );

  if (!booking) {
    return shell(
      <EmptyState
        icon="calendar-check"
        title={copy.detailMissingTitle}
        body={copy.detailMissingBody}
        action={<EmptyActions primary={{ label: copy.openBookings, href: "/bookings?side=stays&from=stays" }} />}
        data-testid="booking-missing"
      />,
    );
  }

  /*
   * THE BOOKING'S RECEIPT, ON THE DOCUMENT SHEET (reference 7071's third
   * screen, 7082). Read through the checkout view, the one read that knows
   * whether a SUCCESSFUL transaction exists against this booking, under the
   * reader's own RLS; drawn from the one receipt model the email uses. An
   * unpaid stay, or a read that could not complete, draws no receipt at all:
   * a receipt is only ever for money that moved.
   */
  const checkout = await getCheckoutView(booking.id, locale);
  const receipt = checkout.state === "ready" ? stayReceipt(checkout.view, t, locale) : null;
  /* D75: the address, the way in and the host, revealed by the database once
     the stay is paid (my_stay_details). Not for a cancelled stay. */
  const session = booking.status === "CANCELLED" ? null : await resolveSession();
  const details =
    session && session.state === "signed-in"
      ? await readStayDetails(session.supabase as unknown as SupabaseClient, booking.id)
      : null;

  /* THE ONE TRACKER (ONE-PRODUCT-DECISIONS, recommendation 1): the stay's
     status in words, when it got there, what happens next and the guest's
     part, then the dated moments from its own state events. The reader's
     part is said only where the record settles it: a confirmed or completed
     stay asks nothing of the guest; a requested one is left unsaid, because
     whether payment is still owed is the checkout's to say, not this card's. */
  const events = await readBookingStateEvents(booking.id);
  const derived = deriveBookingSteps({ status: booking.status, checkIn: booking.checkIn.slice(0, 10), events, today: lagosToday() });
  const bookingWords = t.threads.booking;
  const steps = derived.steps.map((step) => ({
    key: step.key,
    label: bookingWords[step.key],
    when: step.at === null ? null : step.key === "arrival" ? lagosDay(step.at, locale) : lagosWhen(step.at, locale),
    state: derived.cancelled && step.state === "current" ? ("failed" as const) : step.state,
  }));
  const latest = events.length > 0 ? events[events.length - 1] : undefined;
  const statusWords = t.threads.reservation.status[booking.status] ?? booking.status;
  const next = derived.cancelled ? undefined : steps.find((step) => step.state === "upcoming");
  const BOOKING_TONE: Record<string, StatusTone> = {
    PENDING: "warning",
    CONFIRMED: "brand",
    COMPLETED: "success",
    CANCELLED: "neutral",
    NO_SHOW: "danger",
  };

  return shell(
    <>
      <p className="nf-tracker-place mt-inline">
        {booking.title} · {booking.dateRange}
      </p>
      <Tracker
        className="mt-inline"
        label={bookingWords.label}
        icon="bed"
        title={statusWords}
        tone={BOOKING_TONE[booking.status] ?? "neutral"}
        since={latest ? `${t.threads.reservation.status[latest.to] ?? latest.to} · ${lagosWhen(latest.at, locale)}` : null}
        cells={[
          ...(next ? [{ label: t.memberFlows.booking.nextStep, value: next.label }] : []),
          ...(booking.status === "CONFIRMED" || booking.status === "COMPLETED"
            ? [{ label: t.memberFlows.booking.yourPart, value: t.memberFlows.booking.noAction }]
            : []),
        ]}
        steps={steps}
        timelineLabel={bookingWords.label}
        glyphs={{ reserved: "calendar-check", paid: "wallet", arrival: "key", completed: "circle-check" }}
        testId="booking-track"
      />
      {derived.cancelled ? <p className="nf-caption mt-block text-[var(--nf-content-muted)]">{bookingWords.cancelled}</p> : null}
      <div className="mt-md">
        <BookingDetailCard booking={booking} locale={locale} />
      </div>
      {details && <StayDetailsPanel details={details} words={t.memberFlows.stayDetails} />}
      {receipt && (
        <div className="mt-lg" data-testid="booking-receipt">
          <h2 className="nf-overline mb-sm text-[var(--nf-content-muted)]">{t.experienceMoney.bookings.receiptTitle}</h2>
          <ReceiptSheet
            receipt={receipt}
            headingId="booking-receipt-title"
            testId="booking-receipt-sheet"
            actions={<ReceiptActions receipt={receipt} testId="booking-receipt-print" />}
          />
        </div>
      )}
      {/* V-20 and V-24: the terms this stay was paid under, and every refund
          with the date it is due by. Nothing at all for an unpaid stay. */}
      <BookingMoneyRecord
        bookingId={booking.id}
        checkIn={booking.checkIn}
        checkOut={booking.checkOut}
        cancelled={booking.status === "CANCELLED"}
        locale={locale}
      />
      {/* V-57: what the host declared at the door (as frozen at payment), and
          the report if asked for more. A stay only: a rent charge is settled
          in its own agreement, and every other bookings row is a nightly stay.
          A failed read shows neither. The report opens on the check-in day. */}
      {booking.status !== "CANCELLED" && (await bookingChargeKind(booking.id)) === "stay" && (
        <div className="mt-lg grid gap-md">
          <ArrivalChargesLine listingId={booking.listingId || null} accommodationId={booking.accommodationId} bookingId={booking.id} locale={locale} />
          {(booking.status === "CONFIRMED" || booking.status === "COMPLETED") && booking.checkIn.slice(0, 10) <= lagosToday() && (
            <DoorChargeReport bookingId={booking.id} copy={t.afterTheGate.arrival} />
          )}
        </div>
      )}
      {/* V-91: "Is it as listed?", from check-in time until three hours after. */}
      <ArrivalCheck bookingId={booking.id} checkIn={booking.checkIn} locale={locale} />
    </>,
  );
}
