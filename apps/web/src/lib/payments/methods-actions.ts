"use server";

/**
 * Saved cards: list, choose a default, remove, and start saving one.
 *
 * Every read and every owner write runs under the caller's own RLS-bound
 * client. The database has no insert policy on payment_methods for anybody
 * but the service role, and the column grant limits an owner's UPDATE to
 * is_default and deleted_at, so nothing here could file a card or rewrite a
 * token even if it tried. Removing a card is a soft delete: the row that was
 * charged last month is still the row support answers questions about.
 *
 * Saving a card is a NGN 100 check charge. Paystack only hands out a
 * reusable authorization after a successful charge, so the checkout charges
 * the smallest honest amount under an `rm-fund-` reference. There is no wallet
 * any more (Track A): the webhook refunds every `rm-fund-` charge to the card
 * in full, and nothing is credited anywhere. The card itself is filed by
 * `confirmCardSetup` below, once Paystack's verify says the check succeeded
 * for this person at exactly NGN 100 (B-6; the rules are in `card-setup.ts`).
 */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import {
  NOT_CONFIGURED_MESSAGE,
  SIGNED_OUT_MESSAGE,
  resolveSession,
} from "../actions/session";
import { setupExempt } from "../actions/setup-exempt";
import { isFeatureEnabled } from "../flags";
import { flagIsOn, SAVED_CARDS_FLAG } from "../flags/read";
import { IN_FLIGHT_MESSAGE, withIdempotency } from "../security/idempotency";
import { guardMoney } from "../security/money-limits";
import { subjectForUser } from "../security/rate-limit";
import { recordMoneyAudit } from "@/lib/money/audit";
import { getAdminClient } from "@/lib/supabase/service";
import {
  cardDefaultChangedNotice,
  cardRemovedNotice,
  cardSavedNotice,
} from "./notices";
import {
  CARD_SETUP_AMOUNT_MINOR,
  CARD_SETUP_PURPOSE,
  cardSetupRefusalMessage,
  judgeCardSetupCharge,
} from "./card-setup";
import {
  paymentMethodIdSchema,
  savePaymentMethodFromCharge,
  toPaymentMethod,
  type PaymentMethod,
} from "./methods";
import { logMoney } from "./observability";
import {
  PaystackError,
  initializeTransaction,
  isPaystackConfigured,
  verifyTransaction,
} from "./paystack";
import { FUND_PREFIX, isFundReference } from "./references";

/*
 * SAVING A CARD HAS ITS OWN SWITCH NOW: `saved_cards`, fail-closed (a missing
 * row reads off). It used to be the `wallet` row, which Track A retired as a
 * custody switch and whose database guard refuses to turn on: so saving a card
 * could only ever be on by lifting that guard (the live database lets it be
 * turned on today, probe track-a-custody-retired). While the guard is not yet
 * restored (migration 20261021104403), `wallet` still counts, so nothing changes
 * for a member today. Once it is restored and `wallet` is off, `saved_cards`
 * alone decides; then drop the `wallet` read here.
 */
async function cardSavingOn(): Promise<boolean> {
  if (await flagIsOn(SAVED_CARDS_FLAG)) return true;
  return isFeatureEnabled("wallet");
}

/* What it switches off, said to a member (D48: there is no wallet to switch off). */
const CARD_SETUP_OFF_MESSAGE =
  "Saving a card is switched off for a moment while we make improvements. Please try again shortly.";

const CARDS_DOWN_MESSAGE =
  "We could not reach your saved cards just now. Nothing has changed. Please try again in a moment.";

const NOT_YOUR_CARD_MESSAGE =
  "We could not find that card on your account. Reload the page to see the cards you have.";

/* How many card setups one person may start in an hour is a row of the
   table in lib/security/money-limits.ts ("card_setup"). Fails open. */

/** Where callbacks land: explicit site URL first, else the request's origin. */
async function siteOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (explicit.length > 0) return explicit.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

/** The caller's live saved cards, default first, then newest. */
/* B-2: read-only (or an exit the finish-setup hold never blocks), so it runs
   with the hold lifted. See lib/actions/setup-exempt.ts. */
export async function listPaymentMethods(
  ...args: Parameters<typeof listPaymentMethodsInner>
): Promise<Awaited<ReturnType<typeof listPaymentMethodsInner>>> {
  return setupExempt(() => listPaymentMethodsInner(...args));
}

async function listPaymentMethodsInner(): Promise<ActionResult<PaymentMethod[]>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const { data, error } = await session.supabase
    .from("payment_methods")
    .select("*")
    .eq("user_id", session.user.id)
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return fail(CARDS_DOWN_MESSAGE);
  return ok((data ?? []).map(toPaymentMethod));
}

/**
 * Make one card the one charged by default.
 *
 * THE DATABASE KEEPS IT SINGLE, and that is not a figure of speech. There is a
 * `BEFORE INSERT OR UPDATE` trigger on the table, `payment_methods_single_default`,
 * running `private.soft_deleting_single_default()`, which demotes every other
 * live row for the same person in the same statement; and behind it a partial
 * unique index, `payment_methods_one_default_uq ON (user_id) WHERE is_default
 * AND deleted_at IS NULL`, which would refuse a second default if the trigger
 * ever stopped running. This action therefore sets one flag and lets the
 * database do the rest, which is why it does not clear the old default itself.
 * Both objects were read back off the live database on 22 September 2026.
 *
 * COUNTED, now. No money moves here, but this decides which card the next
 * charge lands on, so it is on the table in `lib/security/money-limits.ts`
 * like everything else that decides where money goes.
 *
 * ANNOUNCED, now. Nothing told anybody their default card had changed.
 */
export async function setDefaultPaymentMethod(id: string): Promise<ActionResult<null>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = validate(paymentMethodIdSchema, { id });
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const limit = await guardMoney("setDefaultPaymentMethod", session.user.id);
  if (!limit.allowed) return fail(limit.message);

  /* Read the row before the write, through the caller's own client, for two
     reasons that are both about honesty. It turns "no rows matched" into a
     sentence about THIS person's cards rather than a database count, and it
     is where the brand and last four for the notice come from: the notice is
     written from the row the database holds, never from anything a caller
     passed in. */
  const { data: card, error: readError } = await session.supabase
    .from("payment_methods")
    .select("id, card_type, last4, is_default, reusable")
    .eq("id", parsed.data.id)
    .eq("user_id", session.user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) return fail(CARDS_DOWN_MESSAGE);
  // Under RLS a row that is not the caller's simply is not there.
  if (!card) return fail(NOT_YOUR_CARD_MESSAGE);
  if (!card.reusable) {
    return fail(
      "That card can no longer be charged, so it cannot be your default one. Add a card to replace it.",
    );
  }
  /* Already the default: nothing to write, and nothing to announce. Saying
     "your default card changed" when it did not is the kind of notification
     that teaches people to ignore the ones that matter. */
  if (card.is_default) {
    revalidatePath("/settings");
    revalidatePath("/settings/payments");
    return ok(null);
  }

  const { error, count } = await session.supabase
    .from("payment_methods")
    .update({ is_default: true }, { count: "exact" })
    .eq("id", parsed.data.id)
    .eq("user_id", session.user.id)
    .is("deleted_at", null);
  if (error) return fail(CARDS_DOWN_MESSAGE);
  if (count === 0) return fail(NOT_YOUR_CARD_MESSAGE);

  const admin = getAdminClient();
  if (admin) {
    await recordMoneyAudit(admin, {
      actor: { kind: "user", userId: session.user.id },
      action: "payments.card.default_changed",
      reference: null,
      subjectUserId: session.user.id,
      outcome: "changed",
      detail: { method_id: parsed.data.id },
    });
    await cardDefaultChangedNotice(admin, session.user.id, {
      cardType: card.card_type,
      last4: card.last4,
    });
  }

  revalidatePath("/settings");
  revalidatePath("/settings/payments");
  return ok(null);
}

/**
 * Remove a card from the account. Soft: the row stays for support.
 *
 * REMOVING THE DEFAULT PROMOTES A SURVIVOR, in the database, in the same
 * statement: `payment_methods_promote_default`, an `AFTER UPDATE` trigger
 * running `private.soft_deleting_promote_default()`, picks the newest
 * remaining live row and makes it the default. So a person who removes the
 * only card they were paying with is not silently left with no default at
 * all. Read off the live database on 22 September 2026.
 *
 * A SECOND TAP IS NOT A SECOND REMOVAL. The `is("deleted_at", null)` filter
 * makes the write idempotent by construction: the second one matches nothing
 * and the person is told the card is not on their account, which is true.
 */
export async function removePaymentMethod(id: string): Promise<ActionResult<null>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = validate(paymentMethodIdSchema, { id });
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const limit = await guardMoney("removePaymentMethod", session.user.id);
  if (!limit.allowed) return fail(limit.message);

  const { data: card, error: readError } = await session.supabase
    .from("payment_methods")
    .select("id, card_type, last4")
    .eq("id", parsed.data.id)
    .eq("user_id", session.user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) return fail(CARDS_DOWN_MESSAGE);
  if (!card) return fail(NOT_YOUR_CARD_MESSAGE);

  const { error, count } = await session.supabase
    .from("payment_methods")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", parsed.data.id)
    .eq("user_id", session.user.id)
    .is("deleted_at", null);
  if (error) return fail(CARDS_DOWN_MESSAGE);
  if (count === 0) return fail(NOT_YOUR_CARD_MESSAGE);

  const admin = getAdminClient();
  if (admin) {
    await recordMoneyAudit(admin, {
      actor: { kind: "user", userId: session.user.id },
      action: "payments.card.removed",
      reference: null,
      subjectUserId: session.user.id,
      outcome: "removed",
      detail: { method_id: parsed.data.id },
    });
    await cardRemovedNotice(admin, session.user.id, {
      cardType: card.card_type,
      last4: card.last4,
    });
  }

  revalidatePath("/settings");
  revalidatePath("/settings/payments");
  return ok(null);
}

/**
 * Start saving a card: a NGN 100 check charge whose metadata marks it as this
 * person's card setup. The in-app checkout resumes it; `confirmCardSetup`
 * files the card once Paystack says it succeeded, and the webhook returns the
 * NGN 100 to the card.
 *
 * Mirrors fundWallet line for line where it matters: the service role client
 * is resolved and refused on BEFORE the charge is opened, so a checkout can
 * never be started that nothing on our side can account for.
 */
export type CardSetup = {
  /**
   * Paystack's hosted page. Kept, and no longer the way this is meant to go:
   * see `accessCode`. It is the recovery route for a browser that cannot run
   * the inline checkout at all, and the honest fallback is still better than
   * a dead button.
   */
  authorizationUrl: string;
  /**
   * The handle that keeps the person on our own page.
   *
   * `PaystackPop.resumeTransaction(accessCode, callbacks)` resumes THIS
   * transaction inside an iframe on our own origin, with our own URL bar.
   * Paystack has returned this field on every transaction this platform has
   * ever initialised and, until this week, nothing read it.
   */
  accessCode: string;
  reference: string;
};

export async function startCardSetup(
  input: { idempotencyKey?: string } = {},
): Promise<ActionResult<CardSetup>> {
  if (!(await cardSavingOn())) return fail(CARD_SETUP_OFF_MESSAGE);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  if (!isPaystackConfigured()) {
    return fail("We cannot save a card right now. Nothing was charged.");
  }

  const admin = getAdminClient();
  if (!admin) {
    logMoney({
      surface: "fund",
      outcome: "unconfigured",
      reason: "service_role_key_missing",
      userId: session.user.id,
    });
    return fail(
      "Saving a card is unavailable just now, so nothing was charged. This is our side, not yours, and it is already flagged. Please try again shortly.",
    );
  }

  const email = session.user.email;
  if (!email) {
    return fail(
      "Your account has no email address, which the card processor needs. Add one to your profile and try again.",
    );
  }

  const limit = await guardMoney("startCardSetup", session.user.id);
  if (!limit.allowed) return fail(limit.message);

  /* IDEMPOTENT FROM THIS LINE DOWN.
     Everything below opens a real NGN 100 charge. A dropped request on a
     Lagos network followed by a second tap used to mint a second reference
     and a second charge, and the person got two hundred naira of wallet they
     did not ask for and two card fees. The key is the client's, one per tap,
     so a genuine retry of the SAME tap replays the first access code and the
     same reference, while a deliberate second attempt carries a new key and
     is allowed through. `shouldRecord: (r) => r.ok` keeps a refusal
     retryable: a rate-limit answer must never be replayed for the whole TTL
     as though it were the outcome of a payment. */
  const run = await withIdempotency<ActionResult<CardSetup>>(
    {
      scope: CARD_SETUP_SCOPE,
      key: input.idempotencyKey ?? null,
      subject: subjectForUser(session.user.id),
      shouldRecord: (result) => result.ok,
    },
    () => openCardSetupCharge(session.user.id, email, admin),
  );
  if (run.status === "in-flight") return fail(IN_FLIGHT_MESSAGE);
  return run.result;
}

/** The action family this desk's retries are remembered under. */
const CARD_SETUP_SCOPE = "payments.card.setup";

/**
 * Open the setup charge. Split out so the whole of it sits inside the
 * idempotency guard and nothing that spends money sits outside it.
 */
async function openCardSetupCharge(
  userId: string,
  email: string,
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
): Promise<ActionResult<CardSetup>> {
  const reference = `${FUND_PREFIX}${randomUUID()}`;
  const callbackUrl = `${await siteOrigin()}/wallet?funded=1&reference=${reference}`;

  try {
    const tx = await initializeTransaction({
      email,
      amountMinor: CARD_SETUP_AMOUNT_MINOR,
      reference,
      callbackUrl,
      /* CARD ONLY, AND ONLY HERE.
         Every other charge on this platform sends no `channels` array at all,
         which is deliberate: Paystack then offers every channel the merchant
         account has, and narrowing that silently would be a revenue decision
         disguised as a technical one. This one charge is different because it
         is not really a payment. Its entire purpose is to make Paystack hand
         back a reusable card authorisation, and a bank transfer or a USSD
         push returns none: the person would pay their hundred naira, watch it
         land in their wallet, and still have no saved card. */
      channels: ["card"],
      metadata: { user_id: userId, purpose: CARD_SETUP_PURPOSE, save_card: true },
    });
    logMoney({
      surface: "fund",
      outcome: "received",
      reason: "card_setup_checkout_opened",
      reference,
      amountMinor: CARD_SETUP_AMOUNT_MINOR,
      userId,
    });
    await recordMoneyAudit(admin, {
      actor: { kind: "user", userId },
      action: "wallet.funding.started",
      reference,
      amountMinor: CARD_SETUP_AMOUNT_MINOR,
      subjectUserId: userId,
      outcome: "started",
      detail: { purpose: "card-setup" },
    });
    /* See the note on CardCheckout.accessCode: the same transaction, resumable
       in a checkout drawn on our own page instead of on Paystack's. */
    return ok({
      authorizationUrl: tx.authorizationUrl,
      accessCode: tx.accessCode,
      reference: tx.reference,
    });
  } catch (e) {
    logMoney({
      surface: "fund",
      outcome: "failed",
      reason: "card_setup_checkout_could_not_open",
      reference,
      amountMinor: CARD_SETUP_AMOUNT_MINOR,
      userId,
    });
    const said =
      e instanceof PaystackError && e.status !== 401 && e.message.trim().length > 0
        ? ` The payment service said: ${e.message.trim()}`
        : "";
    return fail(`The secure payment page could not be opened. Nothing was charged.${said}`);
  }
}

/* ------------------------------------------------------ confirming a setup */

/**
 * Where a card setup stands, as the checkout needs to hear it.
 *
 *  - `saved`: Paystack verified the check for this person at NGN 100 and the
 *    card is on file now. The only answer that opens "Card saved".
 *  - `pending`: not settled yet, or we could not ask. Keep waiting.
 *  - `failed`: Paystack says the charge failed, so nothing was taken.
 *  - `refused`: it settled, but it will not save a card here; `message` says
 *    why and what happens to the NGN 100.
 */
export type CardSetupConfirmation =
  | { state: "saved"; cardType: string | null; last4: string | null }
  | { state: "pending" }
  | { state: "failed" }
  | { state: "refused"; message: string };

const SETUP_PENDING: ActionResult<CardSetupConfirmation> = { ok: true, data: { state: "pending" } };

/**
 * Confirm a card setup with Paystack and, when it checks out, file the card.
 *
 * B-6. This replaces `paymentState` for the card-setup checkout, which could
 * never answer anything but pending for an `rm-fund-` reference (see the
 * header of `card-setup.ts`).
 *
 * WHOSE SETUP. Two independent facts, both required: our own record of the
 * intent (the `wallet.funding.started` audit row `startCardSetup` wrote, with
 * this person as the actor and `purpose: card-setup`), and Paystack's copy of
 * the metadata we set (`user_id` and `purpose`), judged in
 * `judgeCardSetupCharge`. A reference that fails the first is answered
 * `pending`, exactly as an unknown reference is, so this cannot be used to ask
 * about anybody else's charge.
 *
 * WHAT IT NEVER TOUCHES. The NGN 100 itself: the refund stays with the
 * webhook and the sweep, unchanged. No wallet row, no ledger row. The one
 * write is the service-role `payment_methods` upsert that already files every
 * saved card (`savePaymentMethodFromCharge`), fed from the verify response,
 * never from the browser.
 *
 * Counted (`confirmCardSetup`, 30 in ten minutes) because each call is a
 * Paystack verify. Safe to repeat: a second confirm of the same charge finds
 * the card by its signature and refreshes it rather than adding a second.
 */
export async function confirmCardSetup(
  reference: string,
): Promise<ActionResult<CardSetupConfirmation>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const ref = (reference ?? "").trim();
  if (!isFundReference(ref)) return SETUP_PENDING;
  if (!isPaystackConfigured()) return SETUP_PENDING;
  const admin = getAdminClient();
  if (!admin) return SETUP_PENDING;

  const limit = await guardMoney("confirmCardSetup", session.user.id);
  if (!limit.allowed) return fail(limit.message);
  const userId = session.user.id;

  /* Our own record that THIS person opened THIS setup. Read with the service
     role because audit_log is staff-only under RLS; filtered to the caller. */
  const { data: intent, error: intentError } = await admin
    .from("audit_log")
    .select("id")
    .eq("action", "wallet.funding.started")
    .eq("entity_id", ref)
    .eq("actor_id", userId)
    .eq("metadata->>purpose", CARD_SETUP_PURPOSE)
    .limit(1)
    .maybeSingle();
  if (intentError || !intent) return SETUP_PENDING;

  let verdict: ReturnType<typeof judgeCardSetupCharge>;
  let email: string | null;
  try {
    const tx = await verifyTransaction(ref);
    verdict = judgeCardSetupCharge(tx, { reference: ref, userId });
    email = tx.customerEmail ?? session.user.email ?? null;
  } catch {
    /* A verify that did not answer is "we do not know yet", never "failed". */
    return SETUP_PENDING;
  }

  if (verdict.kind === "pending") return SETUP_PENDING;
  if (verdict.kind === "failed") return ok({ state: "failed" });
  if (verdict.kind === "refused") {
    logMoney({
      surface: "fund",
      outcome: "rejected",
      reason: `card_setup_refused:${verdict.reason}`,
      reference: ref,
      userId,
    });
    await recordMoneyAudit(admin, {
      actor: { kind: "user", userId },
      action: "payment_method.setup_refused",
      reference: ref,
      subjectUserId: userId,
      outcome: verdict.reason,
      detail: { source: "setup_confirm" },
    });
    return ok({ state: "refused", message: cardSetupRefusalMessage(verdict.reason, ref) });
  }

  /* The card, filed exactly as every saved card is: service role, keyed on
     the card's signature, from the processor's own authorization object. */
  const filed = await savePaymentMethodFromCharge(admin, {
    userId,
    email,
    metadata: { save_card: true },
    authorization: {
      authorization_code: verdict.authorization.authorizationCode,
      signature: verdict.authorization.signature,
      card_type: verdict.authorization.cardType,
      last4: verdict.authorization.last4,
      exp_month: verdict.authorization.expMonth,
      exp_year: verdict.authorization.expYear,
      bin: verdict.authorization.bin,
      bank: verdict.authorization.bank,
      channel: verdict.authorization.channel,
      reusable: verdict.authorization.reusable,
    },
  });
  if (filed !== "saved" && filed !== "updated") {
    logMoney({
      surface: "fund",
      outcome: "failed",
      reason: `card_setup_not_filed:${filed}`,
      reference: ref,
      userId,
    });
    return ok({ state: "refused", message: cardSetupRefusalMessage("not_filed", ref) });
  }

  await recordMoneyAudit(admin, {
    actor: { kind: "user", userId },
    action: `payment_method.${filed}`,
    reference: ref,
    subjectUserId: userId,
    outcome: filed,
    detail: { source: "setup_confirm" },
  });
  /* Told once, for a card that is new on the account. A refresh of a card
     already on file is not news. */
  if (filed === "saved") {
    await cardSavedNotice(admin, userId, {
      cardType: verdict.authorization.cardType,
      last4: verdict.authorization.last4,
    });
  }

  revalidatePath("/settings");
  revalidatePath("/settings/payments");
  return ok({
    state: "saved",
    cardType: verdict.authorization.cardType,
    last4: verdict.authorization.last4,
  });
}
