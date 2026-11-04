"use server";

/**
 * VALLO PRO AND VALLO BUSINESS: the member's four doors.
 *
 *   startSubscriptionTrial     the free trial, no card, once per member ever.
 *                              The database decides everything
 *                              (`subscription_start_trial`, under the
 *                              member's own session) and grants the plan at
 *                              once through member_entitlement_plans.
 *   startSubscriptionCheckout  opens the Paystack checkout for a plan, at the
 *                              plan row's price, under its Paystack plan code.
 *                              Grants nothing.
 *   subscriptionCheckoutState  where that checkout stands; when Paystack has
 *                              the money and its webhook has not landed, this
 *                              server verifies the charge with Paystack and
 *                              applies it (never the browser's word).
 *   cancelSubscription         Paystack subscription/disable, then the plan
 *                              runs to the end of the period paid for.
 *
 * Every refusal is a fixed reason the page words from the locale; a rate
 * limit's refusal is the complete sentence money-limits.ts writes, as on
 * every other money path.
 */

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, resolveSession } from "../actions/session";
import { phoneGateFor } from "../phone-otp/gate";
import { SUBSCRIPTIONS_CHECKOUT_FLAG, flagIsOn } from "../flags/read";
import { SUBSCRIPTIONS_OPEN } from "./open";
import { recordMoneyAudit } from "../money/audit";
import { logMoney } from "../payments/observability";
import {
  PaystackError,
  PaystackUnknownOutcome,
  currentPaystackMode,
  disableSubscription,
  fetchSubscription,
} from "../payments/paystack";
import { guardMoney } from "../security/money-limits";
import { getAdminClient } from "../supabase/service";
import { confirmSubscriptionCharge, openSubscriptionCheckout, type SubscriptionOpenFailure } from "./checkout";
import type { ConfirmOutcome } from "@/components/app/payments/PaystackCheckout";

export type SubscriptionRefusal =
  | SubscriptionOpenFailure
  | "signed_out"
  | "trial_used"
  | "no_trial"
  | "no_email"
  | "not_cancellable"
  | "cancel_failed";

export type TrialOutcome = { started: true; planKey: string; trialEndsAt: string } | { started: false; reason: SubscriptionRefusal };

export type CheckoutOutcome =
  | { opened: true; reference: string; amountMinor: number; accessCode: string; authorizationUrl: string }
  | { opened: false; reason: SubscriptionRefusal };

export type CancelOutcome = { cancelled: true; endsAt: string | null } | { cancelled: false; reason: SubscriptionRefusal };

const planKeySchema = z.string().regex(/^[a-z][a-z0-9_]{1,40}$/);
const idSchema = z.string().uuid();
const referenceSchema = z.string().regex(/^rm-sub-[0-9a-f-]{36}$/i);

type Rpc = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

async function siteOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (explicit.length > 0) return explicit.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

const TRIAL_REASONS: ReadonlySet<SubscriptionRefusal> = new Set([
  "signed_out",
  "closed",
  "unknown_plan",
  "trial_used",
  "already_subscribed",
  "no_trial",
]);

export async function startSubscriptionTrial(planKey: string): Promise<ActionResult<TrialOutcome>> {
  if (!SUBSCRIPTIONS_OPEN) return ok({ started: false, reason: "unavailable" });
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return ok({ started: false, reason: "signed_out" });
  if (!planKeySchema.safeParse(planKey).success) return ok({ started: false, reason: "unknown_plan" });

  // The member's own session: the database reads auth.uid() and refuses a second trial.
  const { data, error } = await (session.supabase as unknown as Rpc).rpc("subscription_start_trial", { p_plan_key: planKey });
  if (error || !data || typeof data !== "object") return ok({ started: false, reason: "unavailable" });
  const row = data as { ok?: unknown; reason?: unknown; plan_key?: unknown; trial_ends_at?: unknown };
  if (row.ok !== true) {
    const reason = typeof row.reason === "string" ? (row.reason as SubscriptionRefusal) : "unavailable";
    return ok({ started: false, reason: TRIAL_REASONS.has(reason) ? reason : "unavailable" });
  }
  revalidatePath("/pro");
  return ok({
    started: true,
    planKey: typeof row.plan_key === "string" ? row.plan_key : planKey,
    trialEndsAt: typeof row.trial_ends_at === "string" ? row.trial_ends_at : "",
  });
}

export async function startSubscriptionCheckout(planKey: string): Promise<ActionResult<CheckoutOutcome>> {
  if (!SUBSCRIPTIONS_OPEN) return ok({ opened: false, reason: "closed" });
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return ok({ opened: false, reason: "signed_out" });
  if (!planKeySchema.safeParse(planKey).success) return ok({ opened: false, reason: "unknown_plan" });
  if (!(await flagIsOn(SUBSCRIPTIONS_CHECKOUT_FLAG))) return ok({ opened: false, reason: "closed" });
  const email = session.user.email ?? "";
  if (!email.includes("@")) return ok({ opened: false, reason: "no_email" });
  /* FULL GATE (13 October 2026): the first payment needs a confirmed phone,
     flag on; a payment fails closed on a failed read (`phone-otp/core.ts`). */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "payment");
  if (phoneGate) return phoneGate;

  const limit = await guardMoney("startSubscriptionCheckout", session.user.id);
  if (!limit.allowed) return fail(limit.message);

  const admin = getAdminClient();
  if (!admin) return ok({ opened: false, reason: "unavailable" });
  const opened = await openSubscriptionCheckout(admin, {
    memberId: session.user.id,
    email,
    planKey,
    // Paystack appends ?reference=... to the return address itself.
    callbackUrl: `${await siteOrigin()}/pro/confirm`,
  });
  if (!opened.ok) return ok({ opened: false, reason: opened.reason });
  return ok({
    opened: true,
    reference: opened.reference,
    amountMinor: opened.amountMinor,
    accessCode: opened.accessCode,
    authorizationUrl: opened.authorizationUrl,
  });
}

/** For the in-page checkout's poll: "paid" once the plan is active, never on the browser's word. */
export async function subscriptionCheckoutState(reference: string): Promise<ActionResult<ConfirmOutcome>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return ok("pending");
  if (!referenceSchema.safeParse(reference).success) return ok("failed");

  const limit = await guardMoney("subscriptionCheckoutState", session.user.id);
  if (!limit.allowed) return fail(limit.message);

  const admin = getAdminClient();
  if (!admin) return ok("pending");
  const state = await confirmSubscriptionCharge(admin, { memberId: session.user.id, reference });
  if (state === "paid") revalidatePath("/pro");
  return ok(state === "paid" ? "paid" : state === "failed" || state === "not_found" ? "failed" : "pending");
}

type CancelRow = {
  id?: unknown;
  kind?: unknown;
  status?: unknown;
  mode?: unknown;
  provider_subscription_code?: unknown;
  provider_email_token?: unknown;
  current_period_end?: unknown;
};

type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> };
      };
    };
  };
};

export async function cancelSubscription(subscriptionId: string): Promise<ActionResult<CancelOutcome>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return ok({ cancelled: false, reason: "signed_out" });
  if (!idSchema.safeParse(subscriptionId).success) return ok({ cancelled: false, reason: "not_cancellable" });

  const limit = await guardMoney("cancelSubscription", session.user.id);
  if (!limit.allowed) return fail(limit.message);

  const admin = getAdminClient();
  if (!admin) return ok({ cancelled: false, reason: "cancel_failed" });
  const userId = session.user.id;

  /* The management token is not readable by members, so the row is read with
     the service role, filtered to the caller's own subscription. */
  const { data, error } = await (admin as unknown as LooseDb)
    .from("member_subscriptions")
    .select("id, kind, status, mode, provider_subscription_code, provider_email_token, current_period_end")
    .eq("id", subscriptionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return ok({ cancelled: false, reason: "not_cancellable" });
  const row = data as CancelRow;
  if (row.status === "non_renewing") {
    return ok({ cancelled: true, endsAt: typeof row.current_period_end === "string" ? row.current_period_end : null });
  }
  if (row.kind !== "paid" || (row.status !== "active" && row.status !== "past_due")) {
    return ok({ cancelled: false, reason: "not_cancellable" });
  }
  const code = typeof row.provider_subscription_code === "string" ? row.provider_subscription_code : "";
  if (!code || row.mode !== currentPaystackMode()) return ok({ cancelled: false, reason: "cancel_failed" });

  try {
    const token =
      (typeof row.provider_email_token === "string" && row.provider_email_token) || (await fetchSubscription(code)).emailToken;
    if (!token) return ok({ cancelled: false, reason: "cancel_failed" });
    try {
      await disableSubscription({ code, token });
    } catch (e) {
      if (e instanceof PaystackUnknownOutcome || !(e instanceof PaystackError)) throw e;
      /* Paystack refuses to disable what is no longer renewing. Ask it what
         the subscription is now, and stop only if it truly will not renew. */
      const now = await fetchSubscription(code);
      if (now.status === "active" || now.status === "attention") throw e;
    }
  } catch {
    logMoney({ surface: "subscription", outcome: "failed", reason: "subscription_cancel_refused", userId });
    return ok({ cancelled: false, reason: "cancel_failed" });
  }

  const { data: marked, error: markError } = await (admin as unknown as Rpc).rpc("subscription_mark_cancelled", {
    p_user: userId,
    p_subscription: subscriptionId,
  });
  const result = (marked ?? {}) as { ok?: unknown; ends_at?: unknown; status?: unknown };
  if (markError || result.ok !== true) {
    /* Paystack has stopped the renewal; the subscription.disable or
       not_renew webhook moves Vallo's record too. Say so honestly. */
    logMoney({ surface: "subscription", outcome: "failed", reason: "subscription_cancel_not_recorded", userId });
    return ok({ cancelled: true, endsAt: typeof row.current_period_end === "string" ? row.current_period_end : null });
  }
  await recordMoneyAudit(admin, {
    actor: { kind: "user", userId },
    action: "subscription.cancelled",
    reference: code,
    subjectUserId: userId,
    outcome: typeof result.status === "string" ? result.status : "cancelled",
    detail: { source: "member" },
  });
  revalidatePath("/pro");
  return ok({ cancelled: true, endsAt: typeof result.ends_at === "string" ? result.ends_at : null });
}
