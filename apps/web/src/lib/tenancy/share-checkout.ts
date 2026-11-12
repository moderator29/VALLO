"use server";

/**
 * V-86. A flatmate (or the lead, for the remainder) pays their OWN share of a
 * shared move-in, by card, straight to the landlord or agent.
 *
 * Each share is its own Paystack charge against the one rent charge's
 * booking, opened with the split the database computed
 * (`public.payment_split_for_rent_share`): the lister's share to the lister's
 * subaccount, the Guarantee contribution to the reserve subaccount. Nothing
 * is held between shares: each settles to the lister the moment it is paid,
 * through the same settlement every charge uses (`settle_booking_charge`,
 * which answers `share-settled` until the shares reach the total and
 * `settled` for the one that completes it). The reference is an ordinary
 * `rm-book-` reference, so the webhook and the attempt sweep settle it with
 * no extra code.
 *
 * The amount is always the database's, never the client's. Integer kobo end
 * to end. Nothing here calls Paystack unless a key for the current mode is
 * configured (`lib/payments/paystack-mode.ts`).
 */

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { phoneGateFor } from "../phone-otp/gate";
import { getAdminClient } from "@/lib/supabase/service";
import {
  PaystackError,
  initializeTransaction,
  isPaystackConfigured,
  verifyTransaction,
} from "../payments/paystack";
import { currentPaystackMode, currentReserveSubaccount } from "../payments/paystack-mode";
import { bookingReference, isBookingReference } from "../payments/references";
import { markChargeFailed, settleBookingCharge } from "../bookings/settlement";
import { REFUND_ALREADY_CLAIMED, refundChargeToCard } from "../payments/refund";
import { guardMoney } from "../security/money-limits";
import { IN_FLIGHT_MESSAGE, withIdempotency } from "../security/idempotency";
import { recordCheckoutHandle, reuseLiveAttempt } from "../payments/attempts";
import { recordMoneyAudit } from "../money/audit";
import { announceConfirmedStay } from "../bookings/arrival";
import { railForBooking, railGate } from "../payments/router";
import { escrowRailLive } from "../payments/providers";
import { SHARE_NOT_PAYABLE } from "./share-words";

const SERVICE_DOWN = "Payment is temporarily unavailable. Nothing has been charged. Try again in a moment.";

type ShareSplit = {
  status: string;
  agreement_id?: string;
  booking_id?: string;
  amount_minor?: number;
  payee_user_id?: string;
  payee_subaccount_code?: string;
  lister_share_minor?: number;
  guarantee_minor?: number;
  commission_minor?: number;
};

export type ShareCheckout = { authorizationUrl: string; accessCode: string; reference: string; amountMinor: number };

async function siteOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (explicit.length > 0) return explicit.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

/** Where the payer comes back to: the share page for a flatmate, the tenancy file for the lead. */
function returnPath(input: { tenancyId: string; contributorId?: string | null }, reference: string): string {
  const query = `?paid=1&reference=${encodeURIComponent(reference)}`;
  return input.contributorId ? `/rent/share/${input.contributorId}${query}` : `/tenancy/${input.tenancyId}${query}`;
}

/**
 * Open the card checkout for the caller's own share of a move-in.
 * `contributorId` is the flatmate's share row; absent, the caller is the lead
 * paying the remainder.
 */
export async function startShareCheckout(input: {
  tenancyId: string;
  contributorId?: string | null;
  idempotencyKey?: string;
}): Promise<ActionResult<ShareCheckout | null>> {
  const parsed = validate(
    z.object({ tenancyId: z.uuid(), contributorId: z.uuid().nullable().optional(), idempotencyKey: z.string().max(100).optional() }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (!isPaystackConfigured()) return fail("We cannot reach card payment right now. Nothing has been charged.");
  /* FULL GATE (13 October 2026): the first payment needs a confirmed phone,
     flag on; a payment fails closed on a failed read (`phone-otp/core.ts`). */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "payment");
  if (phoneGate) return phoneGate;
  const email = session.user.email ?? null;
  if (!email) return fail("Your account has no email address, which card payment needs. Add one to your profile and try again.");
  const admin = getAdminClient();
  if (!admin) return fail(NOT_CONFIGURED_MESSAGE);
  const limit = await guardMoney("startCardCheckout", session.user.id);
  if (!limit.allowed) return fail(limit.message);

  const run = await withIdempotency<ActionResult<ShareCheckout | null>>(
    {
      scope: "rent.share.payment",
      key: parsed.data.idempotencyKey ?? null,
      subject: `${parsed.data.tenancyId}:${session.user.id}`,
      shouldRecord: (result) => result.ok,
    },
    async () => {
      const { data, error } = await admin.rpc("payment_split_for_rent_share" as never, {
        p_rent_payment: parsed.data.tenancyId,
        p_payer: session.user.id,
      } as never);
      if (error) return fail(SERVICE_DOWN);
      const split = (data ?? {}) as ShareSplit;
      if (split.status !== "ok") return fail(SHARE_NOT_PAYABLE[split.status] ?? "This share cannot be paid yet.");
      const amountMinor = Number(split.amount_minor);
      const listerShare = Number(split.lister_share_minor);
      const guarantee = Number(split.guarantee_minor);
      const commission = Number(split.commission_minor);
      if (
        !Number.isSafeInteger(amountMinor) || amountMinor <= 0 ||
        !Number.isSafeInteger(listerShare) || !Number.isSafeInteger(guarantee) || !Number.isSafeInteger(commission) ||
        listerShare + guarantee + commission !== amountMinor ||
        !split.payee_subaccount_code || !split.agreement_id || !split.booking_id
      ) {
        return fail(SERVICE_DOWN);
      }
      /*
       * THE RAIL, exactly as the main checkout resolves it (split-attempt.ts
       * quoteSplit): the policy decides whether this booking may be paid by a
       * Paystack split at all. An escrow answer, no rail, or an unreachable
       * router refuses before any row exists, and the answer is written on
       * the attempt (rail, rail_policy_id), fixed by trigger thereafter.
       */
      const gate = railGate(await railForBooking(admin, split.booking_id), "direct", await escrowRailLive());
      if (!gate.open) return fail(gate.message);
      if (gate.rail !== "direct") return fail(SERVICE_DOWN);
      const railPolicyId = gate.policyId;
      /* D51: the reserve account is demanded only when the split has a reserve leg. */
      const reserve = guarantee > 0 ? currentReserveSubaccount() : null;
      if (guarantee > 0 && !reserve) return fail(SHARE_NOT_PAYABLE.reserve_not_set_up as string);
      // One open attempt per payer and share: a payer who closed the window
      // gets the checkout they already have. Matched on this payer only, so
      // a flatmate never resumes another's checkout, however equal the shares.
      const reused = await reuseLiveAttempt(
        admin,
        split.booking_id,
        {
          amountMinor,
          agreementId: split.agreement_id,
          commissionMinor: commission,
          mode: currentPaystackMode(),
          sharePayerId: session.user.id,
          split: {
            listerSubaccount: split.payee_subaccount_code,
            listerShareMinor: listerShare,
            reserveSubaccount: reserve,
            guaranteeMinor: guarantee,
          },
        },
        { kind: "user", userId: session.user.id },
      );
      if (reused.kind === "checkout") return ok(reused.checkout);
      if (reused.kind === "paid") {
        revalidatePath(`/tenancy/${parsed.data.tenancyId}`);
        return fail(reused.message);
      }
      const reference = bookingReference();
      const attempt = await admin.from("transactions").insert({
        booking_id: split.booking_id,
        provider: "paystack",
        provider_ref: reference,
        amount_minor: amountMinor,
        currency: "NGN",
        status: "PENDING",
        agreement_id: split.agreement_id,
        payee_user_id: split.payee_user_id ?? null,
        payee_subaccount_code: split.payee_subaccount_code,
        reserve_subaccount_code: reserve,
        lister_share_minor: listerShare,
        guarantee_minor: guarantee,
        commission_minor: commission,
        share_payer_id: session.user.id,
        paystack_mode: currentPaystackMode(),
        rail: "direct",
        rail_policy_id: railPolicyId,
        // Joins the attempt lifecycle: the in-flight rule and the sweep time it from here.
        checkout_opened_at: new Date().toISOString(),
      } as never);
      if (attempt.error) return fail(SERVICE_DOWN);
      try {
        const tx = await initializeTransaction({
          email,
          amountMinor,
          reference,
          callbackUrl: `${await siteOrigin()}${returnPath(parsed.data, reference)}`,
          metadata: {
            booking_id: split.booking_id,
            rent_payment_id: parsed.data.tenancyId,
            share_payer_id: session.user.id,
            agreement_id: split.agreement_id,
            purpose: "rent_share_payment",
          },
          split: {
            listerSubaccount: split.payee_subaccount_code,
            listerShareMinor: listerShare,
            reserveSubaccount: reserve,
            guaranteeMinor: guarantee,
          },
        });
        try {
          await recordCheckoutHandle(admin, reference, { accessCode: tx.accessCode, authorizationUrl: tx.authorizationUrl });
        } catch {
          // Best effort: without the handle a retry opens a fresh attempt instead of resuming.
        }
        return ok({ authorizationUrl: tx.authorizationUrl, accessCode: tx.accessCode, reference, amountMinor });
      } catch (e) {
        try {
          await markChargeFailed(admin, reference);
        } catch {
          // Reconciliation settles it against the processor's own records.
        }
        const said = e instanceof PaystackError && e.status !== 401 && e.message.trim() ? ` The payment service said: ${e.message.trim()}` : "";
        return fail(`The secure payment page could not be opened. Nothing was charged.${said}`);
      }
    },
  );
  if (run.status === "in-flight") return fail(IN_FLIGHT_MESSAGE);
  return run.result;
}

export type ShareSettlement = {
  state: "share-settled" | "settled" | "already";
  paidMinor: number | null;
  totalMinor: number | null;
  /** What THIS charge settled, for the receipt. Null when nothing moved on this call. */
  amountMinor: number | null;
};

/**
 * The payer's return from Paystack. Verifies the charge with the processor
 * and calls the same settlement the webhook calls; whichever arrives first
 * does the work. Only the person the share belongs to may settle it here.
 */
export async function settleShareReturn(input: { reference: string; tenancyId: string }): Promise<ActionResult<ShareSettlement | null>> {
  const parsed = validate(z.object({ reference: z.string().min(8).max(100), tenancyId: z.uuid() }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  if (!isBookingReference(parsed.data.reference)) return fail("That payment reference is not recognised. Open your tenancy to see what has been paid, and do not pay again until you have checked.");
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (!isPaystackConfigured()) return fail("We cannot check card payments right now. If you completed the payment, do not pay again: open your tenancy in a few minutes to see it recorded.");
  const admin = getAdminClient();
  if (!admin) return fail(NOT_CONFIGURED_MESSAGE);
  const { data: row } = await admin
    .from("transactions")
    .select("share_payer_id, booking_id")
    .eq("provider_ref", parsed.data.reference)
    .maybeSingle();
  const payer = (row as { share_payer_id?: string | null } | null)?.share_payer_id ?? null;
  if (!payer || payer !== session.user.id) return fail("We could not find that payment on your account. Refresh the page, and if you were charged, contact support.");
  /*
   * AND IT BELONGS TO THE MOVE-IN ON THIS SCREEN. A reference from another of
   * this person's shares, pasted onto this page, would otherwise settle (it is
   * theirs) and draw this move-in's receipt over somebody else's money. The
   * share's booking and this tenancy's booking must be the same one.
   */
  const txBooking = (row as { booking_id?: string | null } | null)?.booking_id ?? null;
  const { data: tenancy } = await admin
    .from("rent_payments")
    .select("booking_id")
    .eq("id", parsed.data.tenancyId)
    .maybeSingle();
  const tenancyBooking = (tenancy as { booking_id?: string | null } | null)?.booking_id ?? null;
  if (!txBooking || !tenancyBooking || txBooking !== tenancyBooking) {
    return fail("That payment is for a different move-in. Open it from its own page.");
  }
  let tx;
  try {
    tx = await verifyTransaction(parsed.data.reference);
  } catch {
    return fail("The payment could not be checked just now. If you completed it, it is recorded automatically in a moment.");
  }
  if (tx.status !== "success") {
    if (tx.status === "failed" || tx.status === "reversed") {
      try {
        await markChargeFailed(admin, parsed.data.reference);
      } catch {
        // Reconciliation settles it.
      }
      return fail("The payment did not go through, so nothing was charged. You can try again.");
    }
    return fail("The payment is still processing. It is recorded the moment it settles.");
  }
  let settlement;
  try {
    settlement = await settleBookingCharge(admin, {
      reference: parsed.data.reference,
      amountMinor: tx.amountMinor,
      processorFeeMinor: tx.feesMinor,
    });
  } catch {
    return fail("The payment succeeded but could not be recorded just now. It is recorded automatically in a moment.");
  }
  const actor = { kind: "user" as const, userId: session.user.id };
  await recordMoneyAudit(admin, {
    actor,
    action: "payment.booking.charge_settled",
    reference: parsed.data.reference,
    amountMinor: tx.amountMinor,
    outcome: settlement.outcome,
    detail: { source: "share_return" },
  });
  if (settlement.outcome === "settled") {
    // The last share completed the move-in on this call: announce it as the
    // webhook and the attempt sweep do, once, with the move-in total.
    await announceConfirmedStay(admin, { bookingId: settlement.bookingId, totalMinor: settlement.totalMinor });
  }
  if (settlement.outcome === "refund-due") {
    const sent = await refundChargeToCard(admin, {
      reference: settlement.reference || parsed.data.reference,
      reason: settlement.reason,
      actor,
    });
    /*
     * WHAT WE MAY PROMISE IS WHAT THE PROCESSOR ACTUALLY TOOK.
     *
     * `settle_booking_charge` has marked the attempt FAILED and raised the
     * desk's high alert ("must be refunded to the card"), and nothing
     * automatic retries from here: the sweep reads PENDING attempts only, and
     * a replay answers `already-settled` with transaction_status REFUND_DUE
     * rather than refunding twice. So a refund the processor refused is one a
     * person has to send, and telling the payer it is already on its way
     * would be a sentence this platform cannot stand behind. The webhook has
     * always read this answer (app/api/paystack/webhook/route.ts); this path
     * threw it away. `REFUND_ALREADY_CLAIMED` is the one refusal that still
     * means yes: the webhook or the sweep is sending the same refund.
     */
    const onItsWay = sent.ok || sent.reason === REFUND_ALREADY_CLAIMED;
    return fail(
      onItsWay
        ? "Your payment went through but could not be applied to this move-in, so the whole amount is being returned to the card or account you paid with. Vallo has kept nothing."
        : "Your payment went through but could not be applied to this move-in, and returning it needs a person. Our team has been told and will return the whole amount to the card or account you paid with. Vallo has kept nothing. Do not pay again.",
    );
  }
  if (settlement.outcome === "unknown-reference") return fail("That payment could not be matched. Our team reconciles it for you.");
  revalidatePath(`/tenancy/${parsed.data.tenancyId}`);
  if (settlement.outcome === "share-settled") {
    return ok({
      state: "share-settled",
      paidMinor: settlement.paidMinor,
      totalMinor: settlement.totalMinor,
      amountMinor: settlement.amountMinor,
    });
  }
  if (settlement.outcome === "settled") {
    return ok({ state: "settled", paidMinor: null, totalMinor: settlement.totalMinor, amountMinor: settlement.amountMinor });
  }
  return ok({ state: "already", paidMinor: null, totalMinor: null, amountMinor: null });
}
