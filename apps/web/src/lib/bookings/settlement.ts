import "server-only";

import type { AdminClient } from "@/lib/supabase/service";

/**
 * Booking settlement: the one place a card charge becomes a paid booking.
 *
 * Shared deliberately. The Paystack webhook and the return-from-Paystack
 * verify path both call `settleBookingCharge`, so whichever arrives first does
 * the work and the second is a no-op. Nothing here is duplicated between the
 * two callers, because two implementations of settlement is two chances to
 * disagree about money.
 *
 * WHAT MAKES IT IDEMPOTENT, AND SAFE AGAINST A SECOND PAYMENT. The decision is
 * the database's, in `private.settle_booking_charge`, under the booking's lock:
 * an attempt already SUCCESSFUL or REFUNDED moves nothing; the first charge
 * that matches an approved agreement settles it and writes one ledger row and
 * one Guarantee contribution; any other charge the processor has taken (no
 * approved agreement, the booking is already paid, cancelled or finished, or
 * the amount is not its price) is marked refund-due and goes back to the CARD.
 * Vallo never keeps it and never credits it anywhere: there is no wallet
 * (Track A, 25 September 2026).
 *
 * A stay can be CONFIRMED and still unpaid, because a host accepting a
 * request-to-book stay confirms it without any money arriving. So "did the
 * status change" is not the same question as "did money move on this call",
 * and a receipt must be gated on `outcome: "settled"`, never on `confirmed`.
 *
 * THE SPLIT. The charge was opened with a Paystack split that the database
 * computed (`public.payment_split_for_booking`): the lister's share to their
 * subaccount, the Guarantee contribution to the reserve subaccount, and
 * Vallo's commission to the main account. The ledger row records exactly
 * that: gross = platform fee + lister share + processor fee + guarantee, in
 * integer kobo, with the processor's fee borne by the lister's subaccount as
 * the split's bearer.
 *
 * THE RATE IS NOT ZERO, WHATEVER THIS COMMENT USED TO SAY. The only money
 * policy version on the live database runs from 5 October 2026 and carries
 * `commission_bps = 200`, two per cent, the founder's decision of 6 October
 * 2026 for both rails. That version is also where the Guarantee was retired,
 * at `guarantee_bps = 0`, so the reserve leg of the split computes to nothing
 * unless an agreement carries a `guarantee_bps` of its own in its terms
 * (`private.b3_guarantee_bps_for`), which none does today.
 *
 * NEITHER NUMBER IS READ FROM HERE, AND NEITHER IS A CONSTANT.
 * `private.b3_commission_for_booking` picks the commission, and a listing's
 * own accepted rate (`listing_rate_acceptances`, `listing_fee_acceptances`)
 * wins over the policy when one exists, as does a hotel-room scope rate and
 * an agreement's own terms. So the figure in a ledger row is per booking and
 * the only honest place to read it is the row. Do not carry a rate in a
 * comment again.
 */

/** Every calendar date in [checkIn, checkOut), ISO strings. Half-open nights. */
export function nightsOf(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  let cursor = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(cursor) || Number.isNaN(end)) return out;
  while (cursor < end) {
    out.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86_400_000;
  }
  return out;
}

/**
 * Hold the calendar for a stay's nights. Called at reserve, so the next guest
 * sees the dates closed on the calendar rather than meeting the database
 * refusal after filling in the whole form, and again on settlement, where it
 * is a harmless upsert over rows that already say the same thing.
 */
export async function writeBookedNights(
  admin: AdminClient,
  listingId: string | null,
  checkIn: string,
  checkOut: string,
): Promise<void> {
  /* ROOM BOOKINGS 1: a hotel room's nights live in room_inventory, held and
     released by the booking's own trigger; there is no listing calendar. */
  if (!listingId) return;
  const rows = nightsOf(checkIn, checkOut).map((date) => ({
    listing_id: listingId,
    date,
    status: "booked" as const,
  }));
  if (rows.length === 0) return;
  const { error } = await admin
    .from("availability")
    .upsert(rows, { onConflict: "listing_id,date" });
  if (error) throw new Error(error.message);
}

/**
 * Release a stay's nights back to the calendar. Only rows this platform marked
 * `booked` are removed, so a night an agent closed by hand stays closed.
 */
export async function releaseBookedNights(
  admin: AdminClient,
  listingId: string | null,
  checkIn: string,
  checkOut: string,
): Promise<void> {
  if (!listingId) return;
  const { error } = await admin
    .from("availability")
    .delete()
    .eq("listing_id", listingId)
    .eq("status", "booked")
    .gte("date", checkIn)
    .lt("date", checkOut);
  if (error) throw new Error(error.message);
}

/** The four parts of a settled charge, in integer kobo, balanced by construction. */
export type ChargeDecomposition = {
  grossMinor: number;
  platformFeeMinor: number;
  agentShareMinor: number;
  processorFeeMinor: number;
  netSettlementMinor: number;
  /** The Guarantee contribution that settled to the reserve with this charge. */
  guaranteeMinor?: number;
};

/**
 * Split a charge the way the ledger does, MINUS THE COMMISSION, which is why
 * nothing calls this and nothing should start.
 *
 * It was written when the platform take really was zero, and it still returns
 * `platformFeeMinor: 0` unconditionally. The live money policy has carried
 * `commission_bps = 200` since 5 October 2026, so on a charge of a hundred
 * thousand naira this hands back a platform fee two thousand naira short and
 * an agent's share two thousand naira over. `public.settle_booking_charge`
 * computes the real split (`private.b3_commission_for_booking`, which prefers
 * the listing's own accepted rate over the policy) and `readSettlement` reads
 * it out of the answer, so every ledger row on this platform comes from the
 * database and not from here. This is kept for the clamp it documents and for
 * the shape of `ChargeDecomposition`: a wrong figure for the processor can
 * never drive the agent's share negative and break the constraint.
 *
 * If a caller ever needs this, it needs the commission passed in. Do not wire
 * it up as it stands.
 */
export function decomposeCharge(
  grossMinor: number,
  processorFeeMinor: number | null | undefined,
): ChargeDecomposition {
  const gross = Math.max(0, Math.trunc(grossMinor));
  const reported = Math.trunc(processorFeeMinor ?? 0);
  const processor = Math.min(gross, Math.max(0, Number.isFinite(reported) ? reported : 0));
  const platform = 0;
  const agent = gross - platform - processor;
  return {
    grossMinor: gross,
    platformFeeMinor: platform,
    agentShareMinor: agent,
    processorFeeMinor: processor,
    netSettlementMinor: agent,
  };
}

export type ChargeSettlement =
  | {
      outcome: "settled";
      bookingId: string;
      /**
       * True only when THIS call moved the booking PENDING to CONFIRMED. False
       * means the stay was already CONFIRMED, by a host accepting a request,
       * and this call is what paid for it. Either way `outcome: "settled"` is
       * the flag that says money moved on this call and exactly once, so a
       * receipt should be gated on the outcome and never on this field.
       */
      confirmed: boolean;
      amountMinor: number;
      /**
       * What the booking cost in all: the move-in total for a rent charge
       * (which the last flatmate's share completes, so it is more than this
       * charge), the gross otherwise. The confirmation announces this.
       */
      totalMinor: number;
      ledger: ChargeDecomposition;
    }
  /**
   * The processor took the money but it could not be applied to the booking:
   * no approved agreement, already paid, no longer open, a check-in that passed
   * while unconfirmed, or the wrong amount. The database marked the attempt
   * FAILED and raised an alert. The caller refunds the whole charge to the
   * card (`refundChargeToCard`). Nothing is announced as paid.
   */
  | { outcome: "refund-due"; bookingId: string; reason: string; amountMinor: number; reference: string }
  /**
   * V-86. A flatmate's share of a shared move-in settled to the lister, but
   * the shares do not yet reach the move-in total, so the booking stays
   * PENDING and nothing is announced as confirmed. Money moved on this call.
   */
  | {
      outcome: "share-settled";
      bookingId: string;
      amountMinor: number;
      paidMinor: number;
      totalMinor: number;
      ledger: ChargeDecomposition;
    }
  /**
   * The reference was already settled, or already found refund-due (the
   * database answers transaction_status REFUND_DUE and the refund is not
   * sent again). Nothing moved, nothing to announce.
   */
  | {
      outcome: "already-settled";
      bookingId: string | null;
      /** SUCCESSFUL, REFUNDED, or REFUND_DUE (found refund-due before; the refund may not have gone out). */
      transactionStatus?: string | null;
    }
  /** No transaction carries this reference and no booking was named for it. */
  | { outcome: "unknown-reference" };

/** Read what `public.settle_booking_charge` answered. Throws on a shape it did not promise. */
export function readSettlement(data: unknown): ChargeSettlement {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("settle_booking_charge answered no object");
  }
  const r = data as Record<string, unknown>;
  const bookingId = typeof r.booking_id === "string" ? r.booking_id : null;
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  switch (r.outcome) {
    case "settled": {
      if (!bookingId) throw new Error("settle_booking_charge settled no booking");
      const l = (typeof r.ledger === "object" && r.ledger !== null ? r.ledger : {}) as Record<string, unknown>;
      return {
        outcome: "settled",
        bookingId,
        confirmed: r.confirmed === true,
        amountMinor: num(r.amount_minor),
        totalMinor: num(r.total_minor) > 0 ? num(r.total_minor) : num(r.amount_minor),
        ledger: {
          grossMinor: num(l.grossMinor),
          platformFeeMinor: num(l.platformFeeMinor),
          agentShareMinor: num(l.agentShareMinor),
          processorFeeMinor: num(l.processorFeeMinor),
          netSettlementMinor: num(l.netSettlementMinor),
          guaranteeMinor: num(l.guaranteeMinor),
        },
      };
    }
    case "refund-due":
      if (!bookingId) throw new Error("settle_booking_charge returned no booking");
      return {
        outcome: "refund-due",
        bookingId,
        reason: typeof r.reason === "string" ? r.reason : "unknown",
        amountMinor: num(r.amount_minor),
        reference: typeof r.reference === "string" ? r.reference : "",
      };
    case "share-settled": {
      if (!bookingId) throw new Error("settle_booking_charge settled a share of no booking");
      const l = (typeof r.ledger === "object" && r.ledger !== null ? r.ledger : {}) as Record<string, unknown>;
      return {
        outcome: "share-settled",
        bookingId,
        amountMinor: num(r.amount_minor),
        paidMinor: num(r.paid_minor),
        totalMinor: num(r.total_minor),
        ledger: {
          grossMinor: num(l.grossMinor),
          platformFeeMinor: num(l.platformFeeMinor),
          agentShareMinor: num(l.agentShareMinor),
          processorFeeMinor: num(l.processorFeeMinor),
          netSettlementMinor: num(l.netSettlementMinor),
          guaranteeMinor: num(l.guaranteeMinor),
        },
      };
    }
    case "already-settled":
      return {
        outcome: "already-settled",
        bookingId,
        transactionStatus: typeof r.transaction_status === "string" ? r.transaction_status : null,
      };
    case "unknown-reference":
      return { outcome: "unknown-reference" };
    default:
      throw new Error(`settle_booking_charge answered ${String(r.outcome)}`);
  }
}

/**
 * Settle a successful charge against its booking. Safe to call any number of
 * times with the same reference.
 *
 * MON-05. This used to be four separate writes with no lock (flip the attempt,
 * write the ledger, move the booking, write the history), keyed on the
 * reference alone, so a second successful charge on the same booking was
 * recorded as a second success and a charge landing on a cancelled booking was
 * kept. It is now one call to `public.settle_booking_charge`, which decides
 * everything under the booking's lock in one transaction: the first matching
 * charge settles it; any other charge the processor has taken is marked for a
 * refund to the card. It never raises for a charge that moved money, so the
 * webhook can always answer 200.
 *
 * `fallbackBookingId` heals the one case where the processor knows about a
 * charge this platform has no attempt row for. It comes from the payment
 * metadata the checkout action set, never from a request body a client
 * controls, and it only ever creates the PENDING attempt the settlement then
 * moves.
 */
export async function settleBookingCharge(
  admin: AdminClient,
  params: {
    reference: string;
    /** Kobo the processor actually charged. */
    amountMinor: number;
    /** Kobo the processor kept, when it said. Absent means zero. */
    processorFeeMinor?: number | null;
    fallbackBookingId?: string | null;
  },
): Promise<ChargeSettlement> {
  const fee = params.processorFeeMinor;
  const { data, error } = await admin.rpc("settle_booking_charge", {
    p_reference: params.reference,
    p_amount_minor: Math.max(0, Math.trunc(params.amountMinor)),
    ...(typeof fee === "number" && Number.isFinite(fee) ? { p_processor_fee_minor: Math.trunc(fee) } : {}),
    ...(params.fallbackBookingId ? { p_fallback_booking: params.fallbackBookingId } : {}),
  });
  if (error) throw new Error(error.message);
  return readSettlement(data);
}

/**
 * Mark a payment attempt FAILED and leave the booking exactly as it was.
 *
 * A failed card attempt must not cancel the stay: the guest still holds their
 * dates and can try again. Only a PENDING
 * attempt moves, so a delivery arriving after a successful settlement cannot
 * unpick it. Returns true when this call moved the row.
 */
export async function markChargeFailed(
  admin: AdminClient,
  reference: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("transactions")
    .update({ status: "FAILED" })
    .eq("provider_ref", reference)
    .eq("status", "PENDING")
    .select("id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/** The booking a reference is attached to, for authorising a caller. */
export async function bookingForReference(
  admin: AdminClient,
  reference: string,
): Promise<{ bookingId: string; guestId: string } | null> {
  const { data, error } = await admin
    .from("transactions")
    .select("booking_id, bookings!inner(guest_id)")
    .eq("provider_ref", reference)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { bookingId: data.booking_id, guestId: data.bookings.guest_id };
}
