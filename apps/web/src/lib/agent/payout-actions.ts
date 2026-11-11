"use server";

/**
 * Where an agent's money goes.
 *
 * public.payout_accounts has had RLS and a correct owner policy since the
 * agents_core migration and no application code at all, so an approved agent
 * could see what they had earned and had no way to tell us where to send it.
 * This is that missing half.
 *
 * Two rules shape the whole file.
 *
 * First, the stored account_name never comes from the person filing the
 * account. It is re-resolved against the bank inside the same action that
 * inserts, so a tampered form field cannot put a friendly name on a stranger's
 * NUBAN. That is also what gives R-32's payout name check something honest to
 * compare against later.
 *
 * Second, the invariants are the database's: exactly one default per agent, no
 * duplicate NUBAN per agent, ten digits, and rows scoped to the caller's own
 * agent row. None of them is restated here, because a rule enforced twice
 * drifts in one of the two places.
 *
 * Adding an account is the one write made with the service role, for the
 * agent row the signed-in session resolves to (never an id from the form):
 * the agent's own client holds no INSERT, so a direct API call cannot file a
 * NUBAN under a name the bank did not give. Choosing the default and removing
 * an account go through the agent's own RLS-bound client, which may change
 * nothing but `is_default`.
 */

import { ensurePayeeSubaccount } from "../payments/payee-subaccount";
import { moneyHoldRefusal } from "@/lib/money/hold";
import { revalidatePath } from "next/cache";
import { fail, formDataToObject, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE } from "../actions/session";
import { PaystackError, isPaystackConfigured, listBanks, resolveAccountNumber } from "../payments/paystack";
import { createAdminClient } from "../supabase/admin";
import { getAgentContext } from "./listings-queries";
import { moneyLockRefusalFor } from "../security/money-lock-guard";
import { pepQuestionRefusal } from "../compliance/pep-gate";
import { eddGateMessage, isEddGateRefusal } from "../compliance/gate";
import {
  addPayoutAccountInputSchema,
  payoutAccountIdSchema,
  resolveAccountInputSchema,
} from "./payout-schema";

const NOT_AGENT_MESSAGE =
  "Only an approved agent can add a payout account. Apply to host and we will take it from there.";

const SERVICE_DOWN_MESSAGE =
  "We could not save that just then. Nothing was lost, please try again in a moment.";

const UNVERIFIABLE_MESSAGE =
  "We cannot confirm a bank account right now, and we will not store an account we cannot confirm belongs to you.";

export type ResolvedName = { accountName: string };

/**
 * Step one: ask the bank whose account this is.
 *
 * Nothing is stored. The agent sees the real name and decides whether it is
 * theirs, which is how every Nigerian banking app already behaves and the
 * single best mis-transfer prevention available.
 */
export async function resolvePayoutAccount(
  _prev: ActionResult<ResolvedName> | null,
  formData: FormData,
): Promise<ActionResult<ResolvedName>> {
  const context = await getAgentContext();
  if (context.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (context.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (context.state === "not-agent") return fail(NOT_AGENT_MESSAGE);

  if (!isPaystackConfigured()) return fail(UNVERIFIABLE_MESSAGE);

  const parsed = validate(resolveAccountInputSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  try {
    const resolved = await resolveAccountNumber(parsed.data.accountNumber, parsed.data.bankCode);
    return ok({ accountName: resolved.accountName });
  } catch (error) {
    if (error instanceof PaystackError) {
      return fail(
        "That account could not be confirmed. Check the number and the bank, then try again.",
        { accountNumber: "We could not confirm this account." },
      );
    }
    return fail(SERVICE_DOWN_MESSAGE);
  }
}

/**
 * Step two: store it, with the name the bank gave rather than the one the form
 * carried.
 */
export async function addPayoutAccount(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const context = await getAgentContext();
  if (context.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (context.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (context.state === "not-agent") return fail(NOT_AGENT_MESSAGE);

  if (!isPaystackConfigured()) return fail(UNVERIFIABLE_MESSAGE);

  /* SCUML item 20: the PEP question is asked at payout account setup, and an
     account is not added until it has been answered once. */
  const pepFirst = await pepQuestionRefusal(context.supabase);
  if (pepFirst) return fail(pepFirst);

  const parsed = validate(addPayoutAccountInputSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  /* V-81: where payouts go is a money decision; an enrolled phone lock asks first. */
  const payoutLock = await moneyLockRefusalFor(context.user.id, formData.get("stepUp"), {
    kind: "payout_add",
    target: `${parsed.data.bankCode}:${parsed.data.accountNumber}`,
  });
  if (payoutLock) return fail(payoutLock);

  // The name is re-resolved server side and the client's value is discarded.
  let accountName: string;
  try {
    const resolved = await resolveAccountNumber(parsed.data.accountNumber, parsed.data.bankCode);
    accountName = resolved.accountName;
  } catch (error) {
    if (error instanceof PaystackError) {
      return fail(
        "That account could not be confirmed. Check the number and the bank, then try again.",
        { accountNumber: "We could not confirm this account." },
      );
    }
    return fail(SERVICE_DOWN_MESSAGE);
  }

  /* Written by the service role, for the agent row the session resolved to:
     an agent's own client holds no INSERT on payout_accounts, so the name on
     a payout account is only ever the bank's answer above. */
  let writer: ReturnType<typeof createAdminClient>;
  try {
    writer = createAdminClient();
  } catch {
    return fail(SERVICE_DOWN_MESSAGE);
  }
  /*
   * AND THE BANK'S NAME IS THE BANK'S, FOR THE SAME REASON THE ACCOUNT NAME IS.
   *
   * The header above says a tampered form field must not put a friendly name
   * on a stranger's NUBAN, and re-resolves `account_name` to make that true.
   * `bank_name` was left as the browser sent it. It is a hidden input
   * (`components/agent/PayoutAccounts.tsx`) derived from the code on the
   * client, so an edited post can store "Zenith Bank" against a GTBank code.
   * No money follows it: every Paystack call on this path takes `bank_code`
   * (`createSubaccount` sends it as `settlement_bank`, `createTransferRecipient`
   * as `bank_code`). What it does reach is the agent's own payout screen and
   * the support desk's account lookup, where a name that is not the bank the
   * money goes to is exactly the wrong thing to be reading during a payout
   * dispute. So it is taken from the processor's own list by code.
   *
   * Best effort by design: a list that cannot be fetched falls back to the
   * submitted value rather than refusing an agent their payout account. The
   * code is what was verified a moment ago by `resolveAccountNumber`.
   */
  let bankName = parsed.data.bankName;
  try {
    const named = (await listBanks()).find((bank) => bank.code === parsed.data.bankCode)?.name;
    if (named) bankName = named;
  } catch {
    /* The processor's list is a courtesy here, never a gate. */
  }

  const { data: created, error: insertError } = await writer
    .from("payout_accounts")
    .insert({
      agent_id: context.agent.id,
      bank_name: bankName,
      /* The code, not only the name. Paystack resolves an account by code, so
         an account stored without one can never climb the payout rung again
         after this insert: nothing would know which bank to ask. */
      bank_code: parsed.data.bankCode,
      account_number: parsed.data.accountNumber,
      account_name: accountName,
    })
    .select("id")
    .single();

  if (insertError) {
    const held = moneyHoldRefusal(insertError);
    if (held) return fail(held);
    /* SCUML item 15: the gate refused; say nothing that would tip anybody off. */
    if (isEddGateRefusal(insertError)) return fail(eddGateMessage("member"));
    // 23505 is the per-agent unique NUBAN.
    if (insertError.code === "23505") {
      return fail(
        "You have already added that account. It is in your list above, where you can make it the default. Add a different one if you meant another account.",
        { accountNumber: "This account is already on your list." },
      );
    }
    // 23514 is the ten-digit check constraint.
    if (insertError.code === "23514") {
      return fail("A Nigerian account number is exactly ten digits.", {
        accountNumber:
          "A Nigerian account number is exactly ten digits. Check the number on your card or in your bank app, then enter it again.",
      });
    }
    if (insertError.code === "42501") {
      return fail(NOT_AGENT_MESSAGE);
    }
    return fail(SERVICE_DOWN_MESSAGE);
  }

  /*
   * The verification rung, climbed for free, right here.
   *
   * resolveAccountNumber has been exported since the payments work and called
   * by nothing. It is the strongest automated identity check available to this
   * platform: a Nigerian bank has already done KYC on that account and has just
   * told us whose it is. Comparing that against the name on the agent's record
   * is a verification rung that costs one request nobody has to review.
   *
   * WHY THE SERVICE ROLE FOR THIS ONE STEP, in a file whose header says the
   * service role is never used. The rule that header states is about the payout
   * account itself, and it still holds: the row above was written by the
   * agent's own client under their own policy. This call is different in kind.
   * The resolved name IS the evidence, so the rung is worth nothing if a
   * session can supply it, and public.verify_payout_account is therefore
   * granted to service_role alone. The name passed here came from Paystack
   * eleven lines up and never touched the browser.
   *
   * Best effort. A rung that could not be recorded must never cost somebody
   * their payout account, which is already saved and already correct.
   */
  if (created) {
    try {
      const admin = createAdminClient();
      await admin.rpc("verify_payout_account", {
        p_account: created.id,
        p_resolved_name: accountName,
        p_identity_name: context.agent.displayName,
      });
    } catch {
      /* The account is saved. The rung can be recorded by hand from the
         verification queue, which shows the payout rung and its note. */
    }
    /* Track A: the Paystack subaccount the lister's share settles to. */
    await ensurePayeeSubaccount(writer, created.id);
  }

  revalidatePath("/agent/earnings");
  revalidatePath("/agent/verification");
  return ok(null);
}

/** Make one account the one earnings are paid into. The database keeps it single. */
export async function setDefaultPayoutAccount(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const context = await getAgentContext();
  if (context.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (context.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (context.state === "not-agent") return fail(NOT_AGENT_MESSAGE);

  const parsed = validate(payoutAccountIdSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  /* V-81: changing the default changes where payouts go. */
  const defaultLock = await moneyLockRefusalFor(context.user.id, formData.get("stepUp"), {
    kind: "payout_default",
    target: parsed.data.accountId,
  });
  if (defaultLock) return fail(defaultLock);

  const { error, count } = await context.supabase
    .from("payout_accounts")
    .update({ is_default: true }, { count: "exact" })
    .eq("id", parsed.data.accountId)
    .eq("agent_id", context.agent.id);

  if (error) return fail(SERVICE_DOWN_MESSAGE);
  // With RLS a row that is not the caller's simply is not matched, so zero rows
  // changed means "not yours", not "service failure".
  if (count === 0) {
    return fail(
      "We could not find that account on your list. Reload the page to see the accounts you have.",
    );
  }
  /* Track A: the new default must be payable into. */
  try {
    await ensurePayeeSubaccount(createAdminClient(), parsed.data.accountId);
  } catch {
    /* Saved either way; a payment against a lister with no subaccount does not open. */
  }

  revalidatePath("/agent/earnings");
  return ok(null);
}

/** Remove an account. The database promotes the most recent survivor. */
export async function removePayoutAccount(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const context = await getAgentContext();
  if (context.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (context.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (context.state === "not-agent") return fail(NOT_AGENT_MESSAGE);

  const parsed = validate(payoutAccountIdSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  /* V-81: removing the default promotes a survivor, which changes where
     payouts go, so it needs the same proof as choosing a default. */
  const { data: row, error: readError } = await context.supabase
    .from("payout_accounts")
    .select("is_default")
    .eq("id", parsed.data.accountId)
    .eq("agent_id", context.agent.id)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN_MESSAGE);
  if (row?.is_default) {
    const removeLock = await moneyLockRefusalFor(context.user.id, formData.get("stepUp"), {
      kind: "payout_remove",
      target: `payout:${parsed.data.accountId}`,
    });
    if (removeLock) return fail(removeLock);
  }

  const { error, count } = await context.supabase
    .from("payout_accounts")
    .delete({ count: "exact" })
    .eq("id", parsed.data.accountId)
    .eq("agent_id", context.agent.id);

  if (error) return fail(SERVICE_DOWN_MESSAGE);
  if (count === 0) {
    return fail(
      "We could not find that account on your list. Reload the page to see the accounts you have.",
    );
  }

  revalidatePath("/agent/earnings");
  return ok(null);
}
