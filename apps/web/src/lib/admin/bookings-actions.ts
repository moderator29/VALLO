"use server";

/**
 * The refund desk.
 *
 * /cancellations tells a guest, in plain words, that a paid stay is cancelled
 * by a person rather than by a button, that the published schedule is applied
 * exactly as written, that the money returns to the card or account they paid
 * with, and that
 * they get the amount and the reason in writing. Until this file existed there
 * was no surface on which any person at support could do it, so the published
 * policy and the console disagreed. This is the console's half of that promise.
 *
 * THE FIGURE IS NEVER TYPED. There is no amount field anywhere on this path.
 * The refund is computed by `refundForReason` from lib/trust/cancellation, the
 * same module /cancellations renders its schedule from, against what the guest
 * actually settled. An operator chooses WHY a stay is being cancelled and reads
 * back what that is worth; they never choose HOW MUCH. Three of the four
 * reasons override the schedule upward to a full refund, because the published
 * page says they do. Nothing here can go below the schedule, except by what
 * has already gone back: a stay part refunded earlier without being cancelled
 * is bounded by what is still refundable (`boundedByRefundable`), which is the
 * only figure the database will accept and the only honest one to send.
 *
 * THE DECISION IS ONE TRANSACTION; THE MONEY GOES BACK THROUGH THE PROCESSOR.
 * The contra settlement row, the booking transition, the state event, the
 * calendar release, the amount owed back by the lister and the refund record
 * all happen inside
 * private.refund_and_cancel_booking, in one transaction, keyed on a unique
 * `rm-refund-` reference so a double tap is a no-op rather than a second
 * refund. The refund itself is then submitted to Paystack against the
 * original charge (lib/payments/refund.ts); Vallo holds no balance to pay it
 * from and credits nothing. That function re-proves the caller's admin role itself and
 * re-bounds the amount against the settled total, so this file is a second
 * check rather than the only one.
 *
 * The audit line and the guest's email happen after that transaction has
 * committed and are both best effort. A failed log line or a failed send must
 * never turn a completed, correct refund into an error an operator cannot act
 * on, and would leave them tempted to run it again.
 */

import { revalidatePath } from "next/cache";
import { stayTitle } from "../bookings/stay-title";
import { readFrozenTerms } from "../after-gate/refunds";
import { z } from "zod";
import { formatMoney } from "@vallo/i18n/core";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { bestEffortEmail, sendMessage } from "../email/client";
import { bookingRefunded } from "../email/messages";
import { contactForUser } from "../email/recipients";
import { mailLanguageFor } from "../email/mail-language";
import { refundReference } from "../payments/references";
import { submitBookingRefund } from "../payments/refund";
import { createAdminClient } from "../supabase/admin";
import {
  CANCELLATION_REASON_CODES,
  boundedByRefundable,
  refundForReasonUnderTerms,
  type CancellationReason,
} from "../trust/cancellation";
import { writeInAppNotice } from "../notify/in-app";
import { writeAudit } from "./audit";
import {
  RESERVATION_ALREADY_ANSWERED,
  reservationTransition,
  type ReservationStatus,
} from "./bookings-queries";
import { adminRefusal, requireAdmin } from "./guard";
import { decideReservationSchema, type ReservationDecision } from "./schema";

const SERVICE_DOWN =
  "The console could not reach the platform data just now. Nothing was cancelled and no money moved. Please try again.";

const GONE = "That booking is no longer there. Refresh the list to see the current state.";

const ALREADY =
  "This stay is already cancelled. Refresh to see the refund that was recorded against it.";

const cancelSchema = z.object({
  bookingId: z.string().uuid("That booking id is not one we recognise."),
  reason: z.enum(CANCELLATION_REASON_CODES, {
    message: "Pick one of the four reasons.",
  }),
  note: z
    .string()
    .trim()
    .max(2000, "Keep the note under 2000 characters.")
    .optional()
    .or(z.literal("")),
});

export type CancelBookingInput = z.infer<typeof cancelSchema>;

/** What the operator is told after the money has moved. */
export type CancelBookingReceipt = {
  refundMinor: number;
  retainedMinor: number;
  paidMinor: number;
  reference: string | null;
};

type RpcCaller = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string | null } | null }>;
};

/** The `status` the database function answered with, or null if it did not. */
function outcomeStatus(data: unknown): string | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const status = (data as Record<string, unknown>).status;
  return typeof status === "string" ? status : null;
}

function outcomeNumber(data: unknown, key: string): number | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

/**
 * The sentence the guest reads about their own money.
 *
 * Written from the reason and the two figures rather than picked from a list,
 * so it cannot describe an outcome different from the one that happened.
 */
function reasonLine(
  reason: CancellationReason,
  refundMinor: number,
  retainedMinor: number,
): string {
  if (reason === "host_cancelled") {
    return "The host cancelled this stay, so everything you paid comes back to you. The schedule never applies to a cancellation you did not choose.";
  }
  if (reason === "not_as_listed") {
    return "A person looked at what you reported about this place and agreed it was not what was listed, so everything you paid comes back to you.";
  }
  if (reason === "no_access") {
    return "A person confirmed you could not get into the property, so everything you paid comes back to you.";
  }
  if (retainedMinor === 0 && refundMinor > 0) {
    return "You cancelled more than 72 hours before check-in, so the published schedule returns the full amount to you.";
  }
  if (refundMinor > 0) {
    return "You cancelled inside the last 72 hours before check-in, so the published schedule returns half to you and the other half stays with the host, whose nights are now very hard to re-let.";
  }
  return "You cancelled on or after check-in day, so the published schedule returns nothing. If you never got in, or the place was not what was listed, reply to support and a person will look at the booking again.";
}

/**
 * Cancel a stay and return what the published schedule says is owed.
 *
 * Safe to call on an unpaid hold: the refund computes to zero against a zero
 * settled total, the stay still cancels, the calendar still reopens and the
 * refund record still says who decided it and why.
 */
export async function cancelBookingAsAdmin(
  input: CancelBookingInput,
): Promise<ActionResult<CancelBookingReceipt | null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(cancelSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { bookingId, reason } = parsed.data;
  const note = parsed.data.note && parsed.data.note.length > 0 ? parsed.data.note : null;

  // Anything more generous than the schedule is a statement about what
  // happened, so it has to carry the sentence that says what was established.
  if (reason !== "guest_choice" && note === null) {
    return fail("Say what was established.", {
      note: "A full refund outside the schedule has to record what a person actually confirmed.",
    });
  }

  // Read through the admin's own RLS-bound client, so Postgres re-proves the
  // role on the read as well as on the write.
  const { data: booking, error: readError } = await access.supabase
    .from("bookings")
    .select("id, listing_id, accommodation_id, guest_id, status, check_in, check_out, total_minor")
    .eq("id", bookingId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!booking) return fail(GONE);
  if (booking.status === "CANCELLED") return fail(ALREADY);

  // What actually settled. This is the same sum the database function computes
  // inside the transaction and bounds the refund against, so the figure shown
  // to the operator and the figure that moves cannot disagree.
  const { data: payments, error: paymentsError } = await access.supabase
    .from("transactions")
    .select("amount_minor")
    .eq("booking_id", booking.id)
    .eq("status", "SUCCESSFUL");
  if (paymentsError) return fail(SERVICE_DOWN);

  let paidMinor = 0;
  for (const payment of payments ?? []) paidMinor += payment.amount_minor;

  // What has already gone back on this booking. A goodwill or duplicate-charge
  // part refund (`refundBookingAsAdmin`) leaves the stay live, so the schedule
  // can still work out more than is refundable; the database refuses that
  // outright (`over_refund`) and the stay could then not be cancelled at all.
  const { data: priorRefunds, error: refundsError } = await access.supabase
    .from("booking_refunds")
    .select("refund_minor")
    .eq("booking_id", booking.id);
  if (refundsError) return fail(SERVICE_DOWN);
  let alreadyRefundedMinor = 0;
  for (const row of priorRefunds ?? []) alreadyRefundedMinor += row.refund_minor;

  // V-20. A guest's own cancellation is priced by the terms frozen onto the
  // booking at payment; with none frozen (no payment, or paid before V-20),
  // the platform schedule, exactly as before.
  const frozen = await readFrozenTerms(access.supabase, booking.id);
  const outcome = boundedByRefundable(
    refundForReasonUnderTerms(reason, paidMinor, booking.check_in, frozen?.terms ?? null),
    paidMinor,
    alreadyRefundedMinor,
  );
  const reference = refundReference();

  let data: unknown = null;
  try {
    const admin = createAdminClient();
    const caller = admin as unknown as RpcCaller;
    const called = await caller.rpc("refund_and_cancel_booking", {
      acting_admin: access.user.id,
      target_booking: booking.id,
      refund_amount: outcome.refundMinor,
      refund_reference: reference,
      reason_code: reason,
      decision_note: note ?? "",
    });
    if (called.error) return fail(SERVICE_DOWN);
    data = called.data;
  } catch {
    return fail(SERVICE_DOWN);
  }

  const status = outcomeStatus(data);
  if (status === "already_cancelled") return fail(ALREADY);
  if (status === "not_found") return fail(GONE);
  if (status === "forbidden") return fail(adminRefusal({ state: "not-admin" }));
  if (status === "over_refund") {
    const settled = outcomeNumber(data, "paid_minor") ?? paidMinor;
    return fail(
      `This stay has ${formatMoney(settled, "en")} settled against it, and the schedule worked out ${formatMoney(outcome.refundMinor, "en")}. Nothing was changed. Refresh and try again, and tell engineering if it happens twice.`,
    );
  }
  if (status === "duplicate") return fail(ALREADY);
  if (status !== "ok") return fail(SERVICE_DOWN);

  const refundMinor = outcomeNumber(data, "refund_minor") ?? outcome.refundMinor;
  /* The decision is recorded; the money goes back to the card through the
     processor. Vallo holds nothing, so there is no balance to credit. What the
     lister already received is recorded as owed back (rent_refunds_owed). A
     processor refusal leaves the refund row marked failed for the desk. */
  const refundRow = typeof (data as Record<string, unknown> | null)?.refund_id === "string"
    ? String((data as Record<string, unknown>).refund_id)
    : null;
  /* D40: the result is read. A booking cancelled with its refund unsent must
     never be reported as a clean success. */
  let refundProblem: string | null = null;
  if (refundMinor > 0 && refundRow) {
    const sent = await submitBookingRefund(createAdminClient(), {
      refundId: refundRow,
      bookingId: booking.id,
      amountMinor: refundMinor,
      reason,
      actor: { kind: "user", userId: access.user.id },
    });
    if (!sent.ok) refundProblem = refundProblemSentence(sent.reason);
  }
  const retainedMinor = outcomeNumber(data, "retained_minor") ?? outcome.retainedMinor;
  const settledMinor = outcomeNumber(data, "paid_minor") ?? paidMinor;

  // Everything above committed together or not at all. From here on, nothing
  // may turn a completed refund into an error.
  try {
    const admin = createAdminClient();
    await writeAudit(admin, {
      actorId: access.user.id,
      action: "booking.cancelled_with_refund",
      entityType: "booking",
      entityId: booking.id,
      detail: {
        reason,
        tier: outcome.tier,
        paid_minor: settledMinor,
        refund_minor: refundMinor,
        retained_minor: retainedMinor,
        hours_before_check_in: Math.round(outcome.hoursBeforeCheckIn),
        reference: refundMinor > 0 ? reference : null,
        previous_status: booking.status,
        note,
      },
    });

    // The amount and the reason in writing, which is the published promise.
    await bestEffortEmail(async () => {
      const guest = await contactForUser(admin, booking.guest_id, "bookings");
      if (!guest) return;
      const message = bookingRefunded({
        ...(await mailLanguageFor(admin, booking.guest_id)),
        guestName: guest.name,
        listingTitle: await stayTitle(admin, booking),
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        paidMinor: settledMinor,
        refundMinor,
        retainedMinor,
        reasonLine: reasonLine(reason, refundMinor, retainedMinor),
        reference: refundMinor > 0 ? reference : null,
      });
      await sendMessage(guest.email, message);
    });
  } catch {
    // The refund is recorded and the money has moved either way.
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${booking.id}`);
  revalidatePath("/bookings");

  if (refundProblem) return fail(`The booking is cancelled and its refund is recorded. ${refundProblem}`);
  return ok({
    refundMinor,
    retainedMinor,
    paidMinor: settledMinor,
    reference: refundMinor > 0 ? reference : null,
  });
}

/**
 * What a cancellation would be worth right now, without doing it.
 *
 * The console calls this as the operator changes the reason, so the confirm
 * sheet states the exact kobo before anybody commits to it. It reads only, and
 * it computes through the same `refundForReason` the write path uses, so the
 * figure previewed is the figure that moves.
 */
/* ------------------------------------------------ refund in any status */

const REFUND_REASONS = [
  "guest_choice",
  "host_cancelled",
  "not_as_listed",
  "no_access",
  "goodwill",
  "duplicate_charge",
] as const;

const refundSchema = z.object({
  bookingId: z.string().uuid("That booking id is not one we recognise."),
  amountMinor: z
    .number({ message: "Say how much to refund." })
    .int("Refunds are whole kobo.")
    .positive("A refund is more than nothing."),
  reason: z.enum(REFUND_REASONS, { message: "Pick a reason." }),
  note: z
    .string()
    .trim()
    .min(10, "Say what was established, in a sentence.")
    .max(2000, "Keep the note under 2000 characters."),
});

export type RefundBookingInput = z.infer<typeof refundSchema>;

/**
 * MON-P2-02. Refund a paid booking in any status, in part, without cancelling
 * it: a goodwill part-refund on a stay that goes ahead, a stay that ended and
 * was not as listed, a NO_SHOW marked too early, a second charge. The bound is
 * cumulative in the database (everything paid less everything already
 * refunded), so two operators cannot refund the same naira twice.
 */
export async function refundBookingAsAdmin(
  input: RefundBookingInput,
): Promise<ActionResult<{ refundMinor: number; refundableAfterMinor: number; reference: string }>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(refundSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { bookingId, amountMinor, reason, note } = parsed.data;
  const reference = refundReference();

  let data: unknown = null;
  try {
    const admin = createAdminClient();
    const caller = admin as unknown as RpcCaller;
    const called = await caller.rpc("refund_booking_payment", {
      acting_admin: access.user.id,
      target_booking: bookingId,
      refund_amount: amountMinor,
      refund_reference: reference,
      reason_code: reason,
      decision_note: note,
    });
    if (called.error) return fail(SERVICE_DOWN);
    data = called.data;
  } catch {
    return fail(SERVICE_DOWN);
  }

  const status = outcomeStatus(data);
  if (status === "not_found") return fail(GONE);
  if (status === "forbidden") return fail(adminRefusal({ state: "not-admin" }));
  if (status === "duplicate") return fail("This refund was already made. Refresh to see it.");
  if (status === "over_refund") {
    const refundable = outcomeNumber(data, "refundable_minor") ?? 0;
    return fail(
      `Only ${formatMoney(refundable, "en")} of what was paid is still refundable on this booking. Nothing was changed.`,
      { amountMinor: `At most ${formatMoney(refundable, "en")}.` },
    );
  }
  if (status !== "ok") return fail(SERVICE_DOWN);

  const refundRow = typeof (data as Record<string, unknown> | null)?.refund_id === "string"
    ? String((data as Record<string, unknown>).refund_id)
    : null;
  if (refundRow) {
    const sent = await submitBookingRefund(createAdminClient(), {
      refundId: refundRow,
      bookingId,
      amountMinor,
      reason,
      actor: { kind: "user", userId: access.user.id },
    });
    if (!sent.ok) return fail(`The refund is recorded. ${refundProblemSentence(sent.reason)} Reference ${reference}.`);
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/bookings");

  return ok({
    refundMinor: outcomeNumber(data, "refund_minor") ?? amountMinor,
    refundableAfterMinor: outcomeNumber(data, "refundable_after_minor") ?? 0,
    reference,
  });
}

export async function previewCancellation(input: {
  bookingId: string;
  reason: CancellationReason;
}): Promise<ActionResult<{ paidMinor: number; refundMinor: number; retainedMinor: number }>> {
  const access = await requireAdmin("operations");
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(
    z.object({
      bookingId: z.string().uuid("That booking id is not one we recognise."),
      reason: z.enum(CANCELLATION_REASON_CODES, { message: "Pick one of the four reasons." }),
    }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { data: booking, error } = await access.supabase
    .from("bookings")
    .select("id, check_in, status")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();
  if (error) return fail(SERVICE_DOWN);
  if (!booking) return fail(GONE);

  const { data: payments, error: paymentsError } = await access.supabase
    .from("transactions")
    .select("amount_minor")
    .eq("booking_id", booking.id)
    .eq("status", "SUCCESSFUL");
  if (paymentsError) return fail(SERVICE_DOWN);

  let paidMinor = 0;
  for (const payment of payments ?? []) paidMinor += payment.amount_minor;

  const { data: priorRefunds, error: refundsError } = await access.supabase
    .from("booking_refunds")
    .select("refund_minor")
    .eq("booking_id", booking.id);
  if (refundsError) return fail(SERVICE_DOWN);
  let alreadyRefundedMinor = 0;
  for (const row of priorRefunds ?? []) alreadyRefundedMinor += row.refund_minor;

  const frozen = await readFrozenTerms(access.supabase, booking.id);
  const outcome = boundedByRefundable(
    refundForReasonUnderTerms(
      parsed.data.reason,
      paidMinor,
      booking.check_in,
      frozen?.terms ?? null,
    ),
    paidMinor,
    alreadyRefundedMinor,
  );
  return ok({
    paidMinor,
    refundMinor: outcome.refundMinor,
    retainedMinor: outcome.retainedMinor,
  });
}

/* --------------------------------------------------------- reservations */

const RESERVATION_GONE =
  "That reservation is no longer there. Refresh the list to see the current state.";

/** What the guest reads. Written from the decision, not picked from a list. */
function reservationNotice(
  decision: ReservationDecision,
  placeName: string,
  reason: string | null,
): { title: string; body: string } {
  if (decision === "confirm") {
    return {
      title: `Your table at ${placeName} is confirmed`,
      body: "A member of the Vallo team confirmed it on the restaurant's behalf. Your booking has the time and the party size.",
    };
  }
  if (decision === "decline") {
    return {
      title: `${placeName} could not take your table`,
      body: `A member of the Vallo team answered on the restaurant's behalf.${reason ? ` They said: ${reason}` : ""} Nothing was charged.`,
    };
  }
  return {
    title: `Your table at ${placeName} was cancelled`,
    body: `A member of the Vallo team cancelled it.${reason ? ` They said: ${reason}` : ""} Nothing was charged. We are sorry for the trouble.`,
  };
}

/**
 * Take a host's decision on their behalf, or call a table off with a reason.
 *
 * The write goes through the service role because the reservation policies
 * are scoped to the guest and the host; the guard in front of it and the
 * status guard inside the update (only the status we read moves) are what
 * make that safe. The audit line and the guest's notification follow the
 * committed write and are best effort, for the same reason every other
 * decision on the console treats them so.
 */
export async function decideReservationAsAdmin(input: {
  reservationId: string;
  decision: ReservationDecision;
  reason?: string;
}): Promise<ActionResult<{ status: ReservationStatus }>> {
  const access = await requireAdmin("operations");
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(decideReservationSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { reservationId, decision } = parsed.data;
  const reason = parsed.data.reason && parsed.data.reason.length > 0 ? parsed.data.reason : null;

  if (decision !== "confirm" && (reason === null || reason.length < 10)) {
    return fail("Say why, in a sentence. The guest reads it word for word.", {
      reason: "A table taken away has to carry a reason.",
    });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return fail(SERVICE_DOWN);
  }

  const { data: row, error: readError } = await admin
    .from("reservations")
    .select("id, status, guest_id, listing_id, business_id, reserved_for")
    .eq("id", reservationId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!row) return fail(RESERVATION_GONE);

  const transition = reservationTransition(row.status, decision);
  if ("refusal" in transition) return fail(transition.refusal);

  const { data: moved, error: writeError } = await admin
    .from("reservations")
    .update({ status: transition.next, responded_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", row.status)
    .select("id")
    .maybeSingle();
  if (writeError) return fail(SERVICE_DOWN);
  if (!moved) return fail(RESERVATION_ALREADY_ANSWERED);

  // Committed. Nothing below may turn the decision into an error.
  try {
    await writeAudit(admin, {
      actorId: access.user.id,
      action: `reservation.${decision}`,
      entityType: "reservation",
      entityId: row.id,
      detail: {
        previous_status: row.status,
        status: transition.next,
        reason,
        reserved_for: row.reserved_for,
      },
    });

    let placeName = "the restaurant";
    if (row.business_id) {
      const { data: business } = await admin
        .from("businesses")
        .select("name")
        .eq("id", row.business_id)
        .maybeSingle();
      if (business?.name) placeName = business.name;
    } else if (row.listing_id) {
      const { data: listing } = await admin
        .from("listings")
        .select("title")
        .eq("id", row.listing_id)
        .maybeSingle();
      if (listing?.title) placeName = listing.title;
    }

    if (transition.tells) {
      const notice = reservationNotice(decision, placeName, reason);
      await writeInAppNotice(admin, {
        user_id: row.guest_id,
        kind: "booking",
        title: notice.title,
        body: notice.body,
        href: "/bookings?side=stays&from=stays",
      });
    }
  } catch {
    // Best effort: the decision stands and the row already says so.
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/bookings/reservations");
  revalidatePath("/bookings");
  revalidatePath("/agent/bookings");

  return ok({ status: transition.next });
}

/**
 * What the desk is told when a decided refund did not reach the card, true to
 * what actually happened to the refund row (D40 review: "marked failed" was
 * said when it was not).
 */
function refundProblemSentence(reason: string): string {
  switch (reason) {
    case "unknown_outcome":
    case "refund_already_claimed":
    case "refund_claim_unavailable":
    case "charges_unreadable":
      return "Whether the card refund went through is not known yet. It stays pending and the money team has been alerted; do not submit it again.";
    case "partial_refund":
      return "Some flatmates' cards were refunded and one was refused. It stays pending and the money team has been alerted to finish it.";
    case "mixed_charges":
    case "ambiguous_charge":
    case "charge_without_reference":
    case "no_settled_charge":
      return "The card refund could not be matched to the charges on this booking, so nothing was sent. It is marked failed for the money team.";
    case "refund_exceeds_paid":
      return "The refund is larger than what is still refundable on the cards that paid. Nothing was sent; it is marked failed.";
    default:
      return "The payment processor did not accept the card refund. It is marked failed on the booking; try again from the booking.";
  }
}
