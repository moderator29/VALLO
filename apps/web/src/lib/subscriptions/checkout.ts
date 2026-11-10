import "server-only";

import {
  PaystackError,
  PaystackUnknownOutcome,
  currentPaystackMode,
  initializeTransaction,
  isPaystackConfigured,
  verifyTransaction,
} from "@/lib/payments/paystack";
import { FiatProviderDisabled, assertProviderEnabled } from "@/lib/payments/providers";
import { logMoney } from "@/lib/payments/observability";
import { recordMoneyAudit } from "@/lib/money/audit";
import type { AdminClient } from "@/lib/supabase/service";
import { SUBSCRIPTION_PREFIX, emailSha256, isSubscriptionReference } from "./events";
import { ensurePaystackPlan } from "./plans";
import { applySubscriptionEvent } from "./webhook";

/**
 * OPEN A SUBSCRIPTION CHECKOUT (Vallo Pro, Vallo Business: Vallo's own revenue).
 *
 * A single-party Paystack charge to Vallo's account, initialised with the
 * plan's Paystack plan code so Paystack creates the subscription and charges it
 * every month itself. No split, no subaccount, no escrow; the protected
 * rail is never involved. Vallo stores no card data.
 *
 * THE AMOUNT NEVER COMES FROM THE CLIENT. The caller names a plan key; the
 * price is the plan row's `price_minor`, the Paystack plan is made at that
 * price (`./plans.ts`), and the database (`subscription_checkout_open`)
 * refuses a checkout at any other price or under an unrecorded plan code.
 *
 * NOTHING ACTIVATES HERE. The plan is granted only when Paystack's
 * charge.success is applied (`subscription_apply_event`), from the webhook or
 * from `confirmSubscriptionCharge` below after this server verified the
 * charge with Paystack itself. A returning browser proves nothing.
 *
 * The caller (a server action) resolves the session and passes the member's
 * own id and email. Every failure is one of the fixed reasons below, which the
 * surface words from the locale; the member never sees provider text.
 */

export type SubscriptionOpenFailure =
  | "unknown_plan"
  | "closed"
  | "already_subscribed"
  | "price_changed"
  | "payments_paused"
  | "unavailable"
  /** The provider may have opened the checkout; we do not know. Never "failed". */
  | "outcome_unknown";

export type SubscriptionCheckout = {
  subscriptionId: string;
  reference: string;
  amountMinor: number;
  currency: "NGN";
  authorizationUrl: string;
  accessCode: string;
};

export type SubscriptionOpenResult = ({ ok: true } & SubscriptionCheckout) | { ok: false; reason: SubscriptionOpenFailure };

const PLAN_KEY_RE = /^[a-z][a-z0-9_]{1,40}$/;

const DB_REASONS: ReadonlySet<SubscriptionOpenFailure> = new Set([
  "unknown_plan",
  "closed",
  "already_subscribed",
  "price_changed",
]);

type Rpc = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};
type LooseDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => PromiseLike<{ data: unknown; error: unknown }> & {
        eq: (column: string, value: unknown) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> };
      };
    };
  };
};

type PlanRow = {
  plan_key: string;
  name: string;
  is_default: boolean;
  price_minor: number | null;
  billing_interval: string | null;
  effective_from: string;
  effective_to: string | null;
};

/** The plan on sale now, read from its row: in force, not the default, a monthly price. */
export function planOnSale(rows: readonly PlanRow[], now: number): PlanRow | null {
  return (
    rows
      .filter((p) => {
        const from = Date.parse(p.effective_from);
        const to = p.effective_to == null ? Infinity : Date.parse(p.effective_to);
        return (
          !p.is_default &&
          typeof p.price_minor === "number" &&
          Number.isSafeInteger(p.price_minor) &&
          p.price_minor > 0 &&
          p.billing_interval === "month" &&
          from <= now &&
          to > now
        );
      })
      .sort((a, b) => Date.parse(b.effective_from) - Date.parse(a.effective_from))[0] ?? null
  );
}

type OpenRow = { ok?: unknown; reason?: unknown; subscription_id?: unknown; reference?: unknown; amount_minor?: unknown; currency?: unknown };

export async function openSubscriptionCheckout(
  admin: AdminClient,
  input: { memberId: string; email: string; planKey: string; callbackUrl: string },
): Promise<SubscriptionOpenResult> {
  if (!PLAN_KEY_RE.test(input.planKey)) return { ok: false, reason: "unknown_plan" };

  // The kill switch gates what starts money movement.
  try {
    await assertProviderEnabled("paystack");
  } catch (e) {
    return { ok: false, reason: e instanceof FiatProviderDisabled ? "payments_paused" : "unavailable" };
  }
  if (!isPaystackConfigured()) return { ok: false, reason: "unavailable" };

  const { data: planData, error: planError } = await (admin as unknown as LooseDb)
    .from("entitlement_plans")
    .select("plan_key, name, is_default, price_minor, billing_interval, effective_from, effective_to")
    .eq("plan_key", input.planKey);
  if (planError || !Array.isArray(planData)) return { ok: false, reason: "unavailable" };
  const plan = planOnSale(planData as PlanRow[], Date.now());
  if (!plan || plan.price_minor == null) return { ok: false, reason: "unknown_plan" };
  const amountMinor = plan.price_minor;
  const mode = currentPaystackMode();

  let planCode: string | null;
  try {
    planCode = await ensurePaystackPlan(admin, { planKey: plan.plan_key, planName: plan.name, mode, amountMinor });
  } catch {
    // Making or finding a plan charges nobody; no checkout exists yet.
    logMoney({ surface: "subscription", outcome: "failed", reason: "subscription_plan_code_unavailable", amountMinor });
    return { ok: false, reason: "unavailable" };
  }
  if (!planCode) return { ok: false, reason: "unavailable" };

  let row: OpenRow;
  try {
    const { data, error } = await (admin as unknown as Rpc).rpc("subscription_checkout_open", {
      p_user: input.memberId,
      p_plan_key: plan.plan_key,
      p_mode: mode,
      p_plan_code: planCode,
      p_amount_minor: amountMinor,
      p_email_sha256: emailSha256(input.email),
    });
    if (error || !data || typeof data !== "object") return { ok: false, reason: "unavailable" };
    row = data as OpenRow;
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (row.ok !== true) {
    const reason = typeof row.reason === "string" ? (row.reason as SubscriptionOpenFailure) : "unavailable";
    return { ok: false, reason: DB_REASONS.has(reason) ? reason : "unavailable" };
  }

  const reference = typeof row.reference === "string" ? row.reference : "";
  const subscriptionId = typeof row.subscription_id === "string" ? row.subscription_id : "";
  const frozen = typeof row.amount_minor === "number" ? row.amount_minor : Number(row.amount_minor);
  if (!reference.startsWith(SUBSCRIPTION_PREFIX) || subscriptionId.length === 0 || frozen !== amountMinor || row.currency !== "NGN") {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const opened = await initializeTransaction({
      email: input.email,
      amountMinor,
      reference,
      callbackUrl: input.callbackUrl,
      metadata: { kind: "subscription", subscription_id: subscriptionId, plan_key: plan.plan_key },
      plan: planCode,
      /* The one other place a channel is named: a subscription is charged
         every month by Paystack against a reusable card authorisation, which
         only a card payment produces. A bank transfer would take the first
         month and leave nothing to renew. */
      channels: ["card"],
    });
    logMoney({ surface: "subscription", outcome: "received", reason: "subscription_checkout_opened", reference, amountMinor, userId: input.memberId });
    return {
      ok: true,
      subscriptionId,
      reference,
      amountMinor,
      currency: "NGN",
      authorizationUrl: opened.authorizationUrl,
      accessCode: opened.accessCode,
    };
  } catch (e) {
    if (e instanceof PaystackUnknownOutcome || !(e instanceof PaystackError)) {
      // A timeout is not a failure: the checkout may exist, and a payment on it still activates.
      logMoney({ surface: "subscription", outcome: "failed", reason: "subscription_open_outcome_unknown", reference, amountMinor });
      return { ok: false, reason: "outcome_unknown" };
    }
    // An explicit refusal: no checkout exists, nothing can be paid. The row
    // stays incomplete and the sweep abandons it.
    logMoney({ surface: "subscription", outcome: "rejected", reason: "subscription_open_refused", reference, amountMinor });
    return { ok: false, reason: "unavailable" };
  }
}

export type SubscriptionChargeState = "paid" | "pending" | "failed" | "not_found";

type MineRow = { status?: unknown; mode?: unknown };

/**
 * Where a member's checkout stands, and if Paystack has taken the money but
 * its webhook has not landed, apply it now: this server asks Paystack itself
 * (verify by reference, the processor's own record, never the browser's word)
 * and applies the charge under the SAME event key the webhook uses, so the
 * two can never both apply it. Safe to repeat.
 */
export async function confirmSubscriptionCharge(
  admin: AdminClient,
  input: { memberId: string; reference: string },
): Promise<SubscriptionChargeState> {
  const reference = input.reference.trim();
  if (!isSubscriptionReference(reference)) return "not_found";
  const read = async (): Promise<MineRow | null> => {
    const { data, error } = await (admin as unknown as LooseDb)
      .from("member_subscriptions")
      .select("status, mode")
      .eq("checkout_reference", reference)
      .eq("user_id", input.memberId)
      .maybeSingle();
    return error ? null : ((data as MineRow | null) ?? null);
  };
  const judge = (row: MineRow): SubscriptionChargeState | null => {
    if (row.status === "active" || row.status === "non_renewing" || row.status === "past_due") return "paid";
    if (row.status === "mismatch") return "failed";
    if (row.status === "incomplete" || row.status === "abandoned") return null;
    // cancelled or expired: it was paid once; the page reads the rest.
    return "paid";
  };

  const row = await read();
  if (!row) return "not_found";
  const known = judge(row);
  if (known) return known;
  if (row.mode !== currentPaystackMode() || !isPaystackConfigured()) return "pending";

  let tx: Awaited<ReturnType<typeof verifyTransaction>>;
  try {
    tx = await verifyTransaction(reference);
  } catch {
    // A verify that did not answer is "we do not know yet", never "failed".
    return "pending";
  }
  if (tx.status === "failed") return "failed";
  if (tx.status !== "success") return "pending";

  const applied = await applySubscriptionEvent(admin, currentPaystackMode(), {
    event: "charge.success",
    eventKey: `charge.success:${reference}`,
    data: {
      reference,
      amount_minor: tx.amountMinor,
      currency: tx.currency,
      ...(tx.paidAt && Number.isFinite(Date.parse(tx.paidAt)) ? { paid_at: new Date(Date.parse(tx.paidAt)).toISOString() } : {}),
      ...(tx.customerCode ? { customer_code: tx.customerCode } : {}),
      ...(tx.planCode ? { plan_code: tx.planCode } : {}),
    },
  });
  if (applied.ok && applied.outcome !== "duplicate") {
    await recordMoneyAudit(admin, {
      actor: { kind: "user", userId: input.memberId },
      action: "subscription.charge.success",
      reference,
      amountMinor: tx.amountMinor,
      subjectUserId: input.memberId,
      outcome: applied.outcome,
      detail: { source: "return_verify", status: applied.status },
    });
  }
  const after = await read();
  return (after && judge(after)) ?? "pending";
}
