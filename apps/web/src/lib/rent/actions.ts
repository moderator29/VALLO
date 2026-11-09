"use server";

/**
 * The rent payment step: the one write that opens the charge.
 *
 * A1-001. Until this file existed a tenancy could be inspected and accepted
 * on the platform and then had to be paid for somewhere else. This action
 * opens the payable record for an accepted inspection; everything after it
 * rides the booking checkout exactly as a stay does. `payWithWallet`,
 * `payWithSavedCard` and `startCardCheckout` in `lib/bookings/checkout.ts`
 * take the booking this opens, under their own idempotency scopes, their own
 * `rm-book-` references, their own webhook settlement and the ledger row that
 * pays the agent. Nothing about money is re-implemented here, and there is
 * deliberately no second idempotency scope: opening the charge is idempotent
 * in the database (one charge per inspection), and paying it is guarded where
 * paying is guarded.
 *
 * The write is one call to `public.open_rent_charge`, the service-role door
 * to `private.open_rent_charge`, which checks that the inspection is the
 * caller's, that the lister accepted it, that the listing is a published
 * rental with a move-in figure, and inserts the booking and the tenancy
 * record in one transaction. The caller's id comes from the session, never
 * from the form. The figure is the listing's own move-in arithmetic, frozen
 * on the charge, and is never taken from the client.
 */

import { rentalVerificationGate } from "../identity/rental-verification-gate";
import { revalidatePath } from "next/cache";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { phoneGateFor } from "../phone-otp/gate";
import { payWithSavedCard } from "../bookings/checkout";
import { isFeatureEnabled } from "../flags";
import type { ChargeSavedCardOutcome } from "../payments/charge-saved-card";
import { getAdminClient } from "@/lib/supabase/service";
import { ALREADY_LET_MESSAGE, readOpenOutcome } from "./db";
import { lagosToday, rentPaymentIdSchema, startRentPaymentSchema, whyNotMoveIn } from "./schema";

const PAUSED_MESSAGE = "Payments are paused for maintenance. Please try again in a little while.";

const SERVICE_DOWN_MESSAGE =
  "The payment step could not be opened just now. Nothing has been charged. Please try again shortly.";

const NOT_FOUND_MESSAGE =
  "We could not find that inspection on your account. Open it again from Inspections and try from there.";

export type RentCharge = {
  inspectionId: string;
  bookingId: string;
  rentPaymentId: string;
  totalMinor: number;
  /** True when this call opened the charge; false when it was already open. */
  opened: boolean;
};

/**
 * Open, or find, the rent charge for an accepted inspection.
 *
 * Safe to call on every tap: an open or paid charge is handed straight back,
 * and only a charge whose booking the 48-hour sweep cancelled unpaid is
 * reopened. The move-in day is the tenant's to name and does not change the
 * figure.
 */
export async function startRentPayment(input: {
  inspectionId: string;
  moveIn?: string;
}): Promise<ActionResult<RentCharge>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  if (!(await isFeatureEnabled("bookings"))) return fail(PAUSED_MESSAGE);

  const parsed = validate(startRentPaymentSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  /* FULL GATE (13 October 2026): the first payment needs a confirmed phone,
     flag on; a payment fails closed on a failed read (`phone-otp/core.ts`). */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "payment");
  if (phoneGate) return phoneGate;

  /* Founder, 7 November 2026: a rental of 5 months or more asks for an
     identity check (pending or approved) before its first payment. */
  const identityGate = await rentalVerificationGate(session.supabase, session.user.id, parsed.data.inspectionId);
  if (identityGate) return identityGate;

  const moveIn = parsed.data.moveIn ?? lagosToday();
  const problem = whyNotMoveIn(moveIn);
  if (problem) return fail(problem, { moveIn: problem });

  const admin = getAdminClient();
  if (!admin) return fail(NOT_CONFIGURED_MESSAGE);

  let outcome;
  try {
    const { data, error } = await admin.rpc("open_rent_charge", {
      p_tenant: session.user.id,
      p_inspection: parsed.data.inspectionId,
      p_move_in: moveIn,
    });
    if (error) {
      // 23514 is the demo-refusal trigger: the listing is an example and no
      // charge may ever exist against it. Said in the trigger's own words.
      // VQ013 is V-13's guard: the charge would not match the quote frozen
      // when the lister said yes. Refused, and said, rather than charged.
      if (error.code === "VQ013") {
        return fail(
          "The figure on this listing no longer matches the quote you were given, so the payment has not been opened. Nothing has been charged. Contact support with this page open.",
        );
      }
      if (error.code === "23514") {
        return fail(
          "This listing is an example of what the catalogue will hold, so there is nothing to pay for. Open a real listing from search.",
        );
      }
      return fail(SERVICE_DOWN_MESSAGE);
    }
    outcome = readOpenOutcome(data);
  } catch {
    return fail(SERVICE_DOWN_MESSAGE);
  }
  if (!outcome) return fail(SERVICE_DOWN_MESSAGE);

  switch (outcome.status) {
    case "ok":
    case "exists":
      break;
    case "not_found":
      return fail(NOT_FOUND_MESSAGE);
    case "not_accepted":
      return fail(
        "The lister has not accepted this inspection yet, so there is nothing to pay. You will be told the moment they do.",
      );
    case "not_published":
      return fail("This listing is no longer available, so it cannot be paid for. Nothing was charged. Search for another place to rent.");
    case "not_a_rental":
    case "no_amount":
      return fail(
        "This listing does not carry a move-in figure to pay. Ask the lister to state the rent and fees on the listing first.",
      );
    case "own_listing":
      return fail("This is your own listing, so there is nothing to pay on it.");
    case "move_in_past":
      return fail("The move-in date has passed. Pick today or later.", { moveIn: "Pick today or later." });
    case "already_let":
      return fail(ALREADY_LET_MESSAGE);
    case "date_taken":
      return fail("That move-in date is already taken on this listing. Pick another day.", {
        moveIn: "Pick another day.",
      });
    default:
      return fail(SERVICE_DOWN_MESSAGE);
  }

  if (!outcome.booking_id || !outcome.rent_payment_id || typeof outcome.total_minor !== "number") {
    return fail(SERVICE_DOWN_MESSAGE);
  }

  revalidatePath(`/rent/pay/${parsed.data.inspectionId}`);
  revalidatePath("/bookings");
  return ok({
    inspectionId: parsed.data.inspectionId,
    bookingId: outcome.booking_id,
    rentPaymentId: outcome.rent_payment_id,
    totalMinor: outcome.total_minor,
    opened: outcome.status === "ok",
  });
}

/**
 * Charge a saved card for the rent, bound to the inspection rather than to a
 * booking id the browser could name.
 *
 * The booking is read back from the charge under the caller's own RLS, so
 * the only booking this can ever pay is the one behind their own inspection.
 * The charge itself, the idempotency key and the reference are
 * `payWithSavedCard`'s: this is a door, not a second money path.
 */
export async function payRentWithSavedCard(input: {
  inspectionId: string;
  methodId: string;
  idempotencyKey?: string;
}): Promise<ActionResult<ChargeSavedCardOutcome>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = validate(rentPaymentIdSchema, { inspectionId: input.inspectionId });
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { data: charge, error } = await session.supabase
    .from("rent_payments")
    .select("booking_id, tenant_id")
    .eq("inspection_id", parsed.data.inspectionId)
    .maybeSingle();
  if (error) return fail(SERVICE_DOWN_MESSAGE);
  if (!charge || charge.tenant_id !== session.user.id) return fail(NOT_FOUND_MESSAGE);

  return payWithSavedCard({
    bookingId: charge.booking_id,
    methodId: input.methodId,
    idempotencyKey: input.idempotencyKey,
  });
}
