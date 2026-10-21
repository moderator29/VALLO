"use server";

/**
 * FOUNDER DECISION D: restaurants pay only for completed deals.
 *
 * The restaurant seats a table by the diner's check-in code (or by tapping
 * Seated, `markReservationOutcome`), the diner answers "Did you dine?" when
 * the restaurant never did, only a seated table can be reviewed, and the
 * bill can be paid through Vallo with the money split straight to the
 * restaurant's own Paystack subaccount.
 *
 * Every decision is the database's (migration 20261013100000, pending): the
 * functions check who the caller is and what the table allows, and these
 * actions only call them through the caller's own client and turn the answer
 * into a sentence. The bill's checkout is opened with the service client
 * after `restaurant_bill_open` answers, the same shape as the table deposit.
 *
 * Paying the bill degrades to an honest "not available yet" when Paystack has
 * no key, `restaurant_bill_pay` is off (`bill-pay.ts`, fail-closed), the
 * Paystack provider switch is off, the founder has not set the commission,
 * or the restaurant cannot be paid. While `restaurant_bill_pay` is off no bill
 * is entered or confirmed either, since the diner could not then pay it. No key is in this file and nothing here
 * charges anybody by itself: the diner opens the checkout and pays there.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { phoneGateFor } from "../phone-otp/gate";
import {
  PaystackError,
  PaystackUnknownOutcome,
  currentPaystackMode,
  isPaystackConfigured,
  verifyTransaction,
} from "../payments/paystack";
import { assertProviderEnabled, openCheckout, paystackSeam } from "../payments/providers";
import { isBillReference } from "../payments/references";
import { getAdminClient } from "@/lib/supabase/service";
import {
  PAY_BILL_NOT_AVAILABLE,
  PAY_BILL_PAYEE_NOT_SET_UP,
  SEATING_NOT_READY,
  cleanCode,
  nairaToMinor,
  seatingRefusal,
} from "./seating";
import { seatingMissing } from "./seating-missing";
import { billPayOn } from "./bill-pay";

type Rpc = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Answer = { status?: string } & Record<string, unknown>;

/** Call one seating function as the signed-in person. */
async function callAsMe(fn: string, args: Record<string, unknown>): Promise<ActionResult<Answer>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  const { data, error } = await (session.supabase as unknown as Rpc).rpc(fn, args);
  if (error) return fail(seatingMissing(error) ? SEATING_NOT_READY : "That did not go through. Please try again.");
  return ok((data ?? {}) as Answer);
}

function touch() {
  revalidatePath("/host/reservations");
  revalidatePath("/bookings");
}

/** The restaurant types the six digits the diner shows. */
export async function seatByCode(typed: string): Promise<ActionResult<{ partySize: number }>> {
  const code = cleanCode(typeof typed === "string" ? typed : "");
  if (!code) return fail(seatingRefusal("bad_code"));
  const result = await callAsMe("reservation_seat_by_code", { p_code: code });
  if (!result.ok) return result;
  if (result.data.status !== "seated") return fail(seatingRefusal(result.data.status));
  touch();
  return ok({ partySize: Number(result.data.party_size) || 1 });
}

/** "Did you dine at X?", answered by the diner. */
export async function answerDidYouDine(
  reservationId: string,
  dined: boolean,
): Promise<ActionResult<{ status: "recorded" | "agreed" | "disputed" }>> {
  if (!UUID.test(reservationId ?? "") || typeof dined !== "boolean") return fail(seatingRefusal("not_found"));
  const result = await callAsMe("reservation_diner_answer", { p_reservation: reservationId, p_dined: dined });
  if (!result.ok) return result;
  const status = result.data.status;
  if (status !== "recorded" && status !== "agreed" && status !== "disputed") return fail(seatingRefusal(status));
  touch();
  return ok({ status });
}

/** A review, only for a seated table. */
export async function leaveTableReview(input: {
  reservationId: string;
  rating: number;
  body: string;
}): Promise<ActionResult<{ saved: true }>> {
  const rating = Number(input?.rating);
  const body = typeof input?.body === "string" ? input.body.trim().slice(0, 2000) : "";
  if (!UUID.test(input?.reservationId ?? "")) return fail(seatingRefusal("not_found"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail(seatingRefusal("bad_rating"));
  const result = await callAsMe("reservation_review_leave", {
    p_reservation: input.reservationId,
    p_rating: rating,
    p_body: body,
  });
  if (!result.ok) return result;
  if (result.data.status !== "saved") return fail(seatingRefusal(result.data.status));
  touch();
  return ok({ saved: true });
}

/** The bill, entered by the restaurant or by the diner, in naira as typed. */
export async function enterTableBill(reservationId: string, naira: string): Promise<ActionResult<{ billId: string }>> {
  if (!UUID.test(reservationId ?? "")) return fail(seatingRefusal("not_found"));
  const minor = nairaToMinor(typeof naira === "string" ? naira : "");
  if (minor === null) return fail(seatingRefusal("bad_amount"));
  if (!(await billPayOn())) return fail(PAY_BILL_NOT_AVAILABLE);
  const result = await callAsMe("restaurant_bill_enter", { p_reservation: reservationId, p_amount_minor: minor });
  if (!result.ok) return result;
  if (result.data.status !== "saved") return fail(seatingRefusal(result.data.status));
  touch();
  return ok({ billId: String(result.data.bill_id ?? "") });
}

/** The restaurant confirms a bill the diner entered. */
export async function confirmTableBill(billId: string): Promise<ActionResult<{ confirmed: true }>> {
  if (!UUID.test(billId ?? "")) return fail(seatingRefusal("not_found"));
  if (!(await billPayOn())) return fail(PAY_BILL_NOT_AVAILABLE);
  const result = await callAsMe("restaurant_bill_confirm", { p_bill: billId });
  if (!result.ok) return result;
  if (result.data.status !== "confirmed") return fail(seatingRefusal(result.data.status));
  touch();
  return ok({ confirmed: true });
}

/**
 * NOBODY DECIDES THEIR OWN TABLE, AND ONLY AN OPEN DISAGREEMENT IS DECIDED.
 *
 * `reservation_resolve_seating` checks only that the caller is staff, so a
 * staff member who booked the table, or owns or lists the restaurant, could
 * settle it in their own favour (the fee per seated table and the right to
 * review both follow the outcome), and any table could be overruled whether
 * or not anybody disputed it. Read with the service client, because staff
 * RLS does not reach every row this needs. The pending migration
 * `20261021104343_seating_dispute_guards` makes the database refuse the same.
 */
async function seatingDisputeRefusal(reservationId: string): Promise<string | null> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  const admin = getAdminClient();
  if (!admin) return "not_found";
  const db = admin as unknown as SupabaseClient;
  const [reservation, seating] = await Promise.all([
    db.from("reservations").select("guest_id, business_id, listing_id").eq("id", reservationId).maybeSingle(),
    db.from("reservation_seatings").select("disputed_at, dispute_resolved_at").eq("reservation_id", reservationId).maybeSingle(),
  ]);
  if (reservation.error || seating.error) return "not_found";
  const row = reservation.data as { guest_id: string | null; business_id: string | null; listing_id: string | null } | null;
  if (!row) return "not_found";
  const me = session.user.id;
  if (row.guest_id === me) return "own_table";
  if (row.business_id) {
    const owner = await db.from("businesses").select("owner_id").eq("id", row.business_id).maybeSingle();
    if (owner.error) return "not_found";
    if ((owner.data as { owner_id: string | null } | null)?.owner_id === me) return "own_table";
  }
  if (row.listing_id) {
    const lister = await db.from("listings").select("agents!listings_agent_id_fkey(user_id)").eq("id", row.listing_id).maybeSingle();
    if (lister.error) return "not_found";
    const agent = (lister.data as { agents: { user_id: string | null } | { user_id: string | null }[] | null } | null)?.agents;
    const userIds = (Array.isArray(agent) ? agent : agent ? [agent] : []).map((a) => a.user_id);
    if (userIds.includes(me)) return "own_table";
  }
  const seat = seating.data as { disputed_at: string | null; dispute_resolved_at: string | null } | null;
  if (!seat?.disputed_at || seat.dispute_resolved_at) return "not_disputed";
  return null;
}

/** Staff decide a disagreement between a restaurant and a diner. */
export async function resolveSeatingDispute(
  reservationId: string,
  outcome: "SEATED" | "NO_SHOW",
): Promise<ActionResult<{ resolved: true }>> {
  if (!UUID.test(reservationId ?? "") || (outcome !== "SEATED" && outcome !== "NO_SHOW")) {
    return fail(seatingRefusal("bad_outcome"));
  }
  const refusal = await seatingDisputeRefusal(reservationId);
  if (refusal) return fail(seatingRefusal(refusal));
  const result = await callAsMe("reservation_resolve_seating", { p_reservation: reservationId, p_outcome: outcome });
  if (!result.ok) return result;
  if (result.data.status !== "resolved") return fail(seatingRefusal(result.data.status));
  revalidatePath("/admin/restaurant-fees");
  touch();
  return ok({ resolved: true });
}

async function siteOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (explicit.length > 0) return explicit.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export type BillCheckout = { reference: string; amountMinor: number; authorizationUrl: string };

/**
 * The diner pays a confirmed bill. Refused in words, before anything is
 * written, when payment through Vallo is not available yet.
 */
export async function payTableBill(billId: string): Promise<ActionResult<BillCheckout>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (!UUID.test(billId ?? "")) return fail(seatingRefusal("not_found"));
  /* FULL GATE (13 October 2026): paying the table's bill is a payment. */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "payment");
  if (phoneGate) return phoneGate;
  const email = session.user.email ?? null;
  if (!email) return fail("Paying by card needs an email address on your account. Add one to your profile and try again.");
  if (!(await billPayOn())) return fail(PAY_BILL_NOT_AVAILABLE);
  try {
    await assertProviderEnabled("paystack");
  } catch {
    return fail(PAY_BILL_NOT_AVAILABLE);
  }
  const admin = getAdminClient();
  if (!admin) return fail(PAY_BILL_NOT_AVAILABLE);
  const db = admin as unknown as Rpc;

  const { data, error } = await db.rpc("restaurant_bill_open", {
    p_bill: billId,
    p_guest: session.user.id,
    p_mode: currentPaystackMode(),
  });
  if (error) return fail(seatingMissing(error) ? PAY_BILL_NOT_AVAILABLE : "Payment is temporarily unavailable. Nothing has been charged.");
  const opened = (data ?? {}) as Answer;
  if (opened.status === "pending" && typeof opened.authorization_url === "string" && typeof opened.reference === "string") {
    return ok({ reference: opened.reference, amountMinor: Number(opened.amount_minor), authorizationUrl: opened.authorization_url });
  }
  if (opened.status === "not_priced" || opened.status === "switched_off") return fail(PAY_BILL_NOT_AVAILABLE);
  if (opened.status === "payee_not_set_up") return fail(PAY_BILL_PAYEE_NOT_SET_UP);
  if (opened.status !== "ok") return fail(seatingRefusal(opened.status));

  const reference = String(opened.reference ?? "");
  const amountMinor = Number(opened.amount_minor);
  const shareMinor = Number(opened.restaurant_share_minor);
  const subaccount = typeof opened.payee_subaccount_code === "string" ? opened.payee_subaccount_code : "";
  if (
    !isBillReference(reference) ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    !Number.isSafeInteger(shareMinor) ||
    shareMinor <= 0 ||
    shareMinor > amountMinor ||
    !subaccount
  ) {
    await db.rpc("restaurant_bill_reopen", { p_reference: reference });
    return fail("Payment is temporarily unavailable. Nothing has been charged.");
  }

  try {
    const tx = await openCheckout(paystackSeam(), {
      reference,
      amountMinor,
      email,
      callbackUrl: `${await siteOrigin()}/bookings?side=stays&bill=${encodeURIComponent(reference)}`,
      metadata: { kind: "restaurant_bill", bill_id: billId, user_id: session.user.id },
      /* The restaurant's share to its own subaccount; what is left is
         Vallo's commission. No reserve leg. */
      split: { listerSubaccount: subaccount, listerShareMinor: shareMinor, reserveSubaccount: null, guaranteeMinor: 0 },
    });
    await db.rpc("restaurant_bill_checkout_saved", {
      p_reference: reference,
      p_url: tx.authorizationUrl,
      p_code: tx.accessCode,
    });
    return ok({ reference, amountMinor, authorizationUrl: tx.authorizationUrl });
  } catch (e) {
    if (e instanceof PaystackUnknownOutcome) {
      /* The checkout may exist: the bill stays pending and the return settles it. */
      return fail("We could not tell whether the payment page opened. Check your bill again in a minute. Nothing has been charged twice.");
    }
    if (e instanceof PaystackError) {
      await db.rpc("restaurant_bill_reopen", { p_reference: reference });
    }
    return fail("Payment is temporarily unavailable. Nothing has been charged.");
  }
}

/**
 * The diner comes back from Paystack. The charge is read back from Paystack
 * (never trusted from the address bar) and settled once: the bill is paid
 * and the table seated. Safe to call twice.
 */
export async function confirmTableBillReturn(reference: string): Promise<ActionResult<{ paid: boolean }>> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);
  if (!isBillReference(reference ?? "")) return fail(seatingRefusal("not_found"));
  if (!isPaystackConfigured()) return fail(PAY_BILL_NOT_AVAILABLE);
  /* Only the diner's own bill: read under their RLS (`restaurant_bills_guest`)
     before the service client touches it, so nobody can reopen or settle a
     bill by posting someone else's reference. The webhook settles every bill
     whatever happens here. */
  const mine = await (session.supabase as unknown as SupabaseClient)
    .from("restaurant_bills")
    .select("id")
    .eq("provider_ref", reference)
    .eq("guest_id", session.user.id)
    .maybeSingle();
  if (mine.error) return fail("We could not check the payment yet. You can try again in a minute.");
  if (!mine.data) return fail(seatingRefusal("not_found"));
  const admin = getAdminClient();
  if (!admin) return fail(PAY_BILL_NOT_AVAILABLE);
  const db = admin as unknown as Rpc;

  let verified;
  try {
    verified = await verifyTransaction(reference);
  } catch {
    return fail("We could not check the payment yet. You can try again in a minute.");
  }
  if (verified.status === "failed" || verified.status === "abandoned" || verified.status === "reversed") {
    await db.rpc("restaurant_bill_reopen", { p_reference: reference });
    touch();
    return ok({ paid: false });
  }
  if (verified.status !== "success") return ok({ paid: false });
  const { data, error } = await db.rpc("restaurant_bill_settle", {
    p_reference: reference,
    p_amount_minor: verified.amountMinor,
    p_currency: verified.currency,
  });
  if (error) return fail("We could not record the payment yet. You can try again in a minute.");
  const outcome = (data as { outcome?: string } | null)?.outcome;
  touch();
  return ok({ paid: outcome === "settled" || outcome === "duplicate" });
}
