"use server";

/**
 * D75: the guest pays a restaurant's table deposit by card, on the direct rail.
 *
 * Off unless `restaurant_deposits` is on (the database checks it again). The
 * amount, the venue's share and Vallo's commission are the database's
 * (`reservation_deposit_open`, behind `reservation_deposits_00_gate`); this
 * file never computes money. The deposit row is written before Paystack is
 * called, so a webhook that beats the redirect has something to settle. A
 * second press resumes the first checkout instead of opening another.
 *
 * CARD ONLY (the founder, 13 October 2026). A table deposit is the one
 * charge on this platform that is routinely sent back by the restaurant's
 * own cancellation rule, hourly and without a person, and a card is the
 * channel a refund reaches by itself. Escrow is never used for a restaurant:
 * the venue is paid at the charge through its own subaccount, and Vallo's
 * commission is the split's other leg.
 *
 * THE RETURN. Paystack sends the guest back to `/pay/deposit/<reservation>`,
 * which asks `confirmDepositReturn`: the charge is read back from Paystack
 * and settled through the same leg the webhook uses
 * (`handleDepositChargeSuccess`), so a guest who comes back before the
 * webhook sees "paid" at once, a charge that cannot be applied goes straight
 * back to the card, and a replay is a duplicate. Not gated on the switch: a
 * deposit already taken is always recorded, even if deposits are switched
 * off meanwhile (the webhook is not gated either).
 */

import { passcodeMoneyRefusal } from "@/lib/passcode/money";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDictionary } from "@vallo/i18n";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { phoneGateFor } from "../phone-otp/gate";
import { flagIsOn } from "../flags/read";
import { getLocale } from "../locale";
import {
  PaystackError,
  PaystackUnknownOutcome,
  currentPaystackMode,
  isPaystackConfigured,
  verifyTransaction,
} from "../payments/paystack";
import { assertProviderEnabled, openCheckout, paystackSeam } from "../payments/providers";
import { DEPOSIT_PREFIX, isDepositReference } from "../payments/references";
import { getAdminClient } from "@/lib/supabase/service";
import { RESTAURANT_DEPOSITS_FLAG, depositRefusal, type DepositWords } from "./deposits";
import { handleDepositChargeSuccess } from "./deposit-settlement";

export type DepositCheckout = { reference: string; amountMinor: number; authorizationUrl: string; accessCode: string };

const idSchema = z.string().uuid();

async function words(): Promise<DepositWords> {
  try {
    return getDictionary(await getLocale()).tableDeposits;
  } catch {
    return getDictionary("en").tableDeposits;
  }
}

async function siteOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (explicit.length > 0) return explicit.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

/** Where the guest lands after Paystack: the deposit's own page, which checks the charge. */
function depositReturnPath(reservationId: string, reference: string): string {
  return `/pay/deposit/${reservationId}?ref=${encodeURIComponent(reference)}`;
}

type Opened = {
  status?: string;
  reference?: string;
  amount_minor?: number;
  payee_subaccount_code?: string;
  lister_share_minor?: number;
  commission_minor?: number;
  authorization_url?: string | null;
  access_code?: string | null;
};

type Rpc = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

export async function payReservationDeposit(reservationId: string): Promise<ActionResult<DepositCheckout>> {
  const w = await words();
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  /* A passcode-locked session moves no money (docs/PASSCODE.md). */
  const lockedOut = await passcodeMoneyRefusal(session.user.id);
  if (lockedOut) return fail(lockedOut);
  if (!idSchema.safeParse(reservationId).success) return fail(depositRefusal("not_found", w.refusals));
  if (!(await flagIsOn(RESTAURANT_DEPOSITS_FLAG))) return fail(depositRefusal("switched_off", w.refusals));
  /* FULL GATE (13 October 2026): the first payment needs a confirmed phone,
     flag on; a payment fails closed on a failed read (`phone-otp/core.ts`). */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "payment");
  if (phoneGate) return phoneGate;
  const email = session.user.email ?? null;
  if (!email) return fail(w.refusals.needsEmail);

  try {
    await assertProviderEnabled("paystack");
  } catch {
    return fail(depositRefusal("unavailable", w.refusals));
  }
  const admin = getAdminClient();
  if (!admin) return fail(depositRefusal("unavailable", w.refusals));

  const { data, error } = await (admin as unknown as Rpc).rpc("reservation_deposit_open", {
    p_reservation: reservationId,
    p_guest: session.user.id,
    p_mode: currentPaystackMode(),
  });
  if (error || !data || typeof data !== "object") return fail(depositRefusal("unavailable", w.refusals));
  const opened = data as Opened;

  if (opened.status === "pending" && opened.reference && opened.authorization_url) {
    return ok({
      reference: opened.reference,
      amountMinor: Number(opened.amount_minor),
      authorizationUrl: opened.authorization_url,
      accessCode: opened.access_code ?? "",
    });
  }
  if (opened.status !== "ok") return fail(depositRefusal(opened.status ?? "unavailable", w.refusals));

  const reference = opened.reference ?? "";
  const amountMinor = Number(opened.amount_minor);
  const listerShareMinor = Number(opened.lister_share_minor);
  if (
    !reference.startsWith(DEPOSIT_PREFIX) ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    !Number.isSafeInteger(listerShareMinor) ||
    !opened.payee_subaccount_code
  ) {
    return fail(depositRefusal("unavailable", w.refusals));
  }

  const db = admin as unknown as Rpc & {
    from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (k: string, v: string) => PromiseLike<unknown> } };
  };
  try {
    const tx = await openCheckout(paystackSeam(), {
      reference,
      amountMinor,
      email,
      callbackUrl: `${await siteOrigin()}${depositReturnPath(reservationId, reference)}`,
      metadata: { kind: "reservation_deposit", reservation_id: reservationId, user_id: session.user.id },
      /* Card only: see the header. */
      channels: ["card"],
      /* The same dynamic split a stay uses: the venue's share to the venue's
         own subaccount, Vallo's commission stays with Vallo. No reserve leg. */
      split: { listerSubaccount: opened.payee_subaccount_code, listerShareMinor, reserveSubaccount: null, guaranteeMinor: 0 },
    });
    try {
      await db.from("reservation_deposits").update({ authorization_url: tx.authorizationUrl, access_code: tx.accessCode }).eq("provider_ref", reference);
    } catch {
      // Best effort: without it a second press opens a fresh checkout after this one is closed.
    }
    return ok({ reference, amountMinor, authorizationUrl: tx.authorizationUrl, accessCode: tx.accessCode });
  } catch (e) {
    if (e instanceof PaystackUnknownOutcome) {
      /* The checkout may exist: the row stays pending and the webhook settles
         it if the guest pays. Never closed on a guess. */
      return fail(depositRefusal("outcome_unknown", w.refusals));
    }
    if (e instanceof PaystackError) {
      await db.rpc("reservation_deposit_close", { p_reference: reference, p_status: "failed" });
      return fail(depositRefusal("unavailable", w.refusals));
    }
    return fail(depositRefusal("outcome_unknown", w.refusals));
  }
}

export type DepositReturn = { state: "paid" | "not_paid" | "open" | "going_back" };

/**
 * Back from Paystack: read the charge back and settle it through the
 * webhook's own leg. The reference must be this guest's, for this
 * reservation; anything else is not found and nothing is asked of Paystack.
 */
export async function confirmDepositReturn(reservationId: string, reference: string): Promise<ActionResult<DepositReturn>> {
  const w = await words();
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (!idSchema.safeParse(reservationId).success || !isDepositReference(reference ?? "")) {
    return fail(depositRefusal("not_found", w.refusals));
  }
  if (!isPaystackConfigured()) return fail(depositRefusal("unavailable", w.refusals));
  const admin = getAdminClient();
  if (!admin) return fail(depositRefusal("unavailable", w.refusals));

  const db = admin as unknown as Rpc & {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> };
      };
    };
  };
  const { data: row, error } = await db
    .from("reservation_deposits")
    .select("reservation_id, guest_id, status")
    .eq("provider_ref", reference)
    .maybeSingle();
  const mine = row as { reservation_id?: string; guest_id?: string; status?: string } | null;
  if (error || !mine || mine.guest_id !== session.user.id || mine.reservation_id !== reservationId) {
    return fail(depositRefusal("not_found", w.refusals));
  }
  const settled = (status: string | undefined): DepositReturn | null =>
    status === "paid" || status === "applied" || status === "forfeited"
      ? { state: "paid" }
      : status === "refund_due" || status === "refunded"
        ? { state: "going_back" }
        : null;
  const already = settled(mine.status);
  if (already) return ok(already);

  let verified;
  try {
    verified = await verifyTransaction(reference);
  } catch {
    return fail(w.refusals.checkLater);
  }
  if (verified.status === "failed" || verified.status === "abandoned" || verified.status === "reversed") {
    await db.rpc("reservation_deposit_close", {
      p_reference: reference,
      p_status: verified.status === "abandoned" ? "abandoned" : "failed",
    });
    revalidatePath("/bookings");
    return ok({ state: "not_paid" });
  }
  if (verified.status !== "success") return ok({ state: "open" });

  const verdict = await handleDepositChargeSuccess(admin, {
    reference,
    amount: verified.amountMinor,
    currency: verified.currency,
  });
  if (verdict.httpStatus >= 500) return fail(w.refusals.checkLater);
  revalidatePath("/bookings");
  revalidatePath(`/pay/deposit/${reservationId}`);
  if (verdict.reason === "deposit_paid" || verdict.reason === "deposit_already_settled") return ok({ state: "paid" });
  if (verdict.reason.startsWith("deposit_refund_due")) return ok({ state: "going_back" });
  return ok({ state: "open" });
}
