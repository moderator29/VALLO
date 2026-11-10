import "server-only";

import type { User } from "@supabase/supabase-js";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { guardMoney } from "../security/money-limits";
import { memberWalletRailLive } from "../payments/providers";
import type { RailFailure } from "../payments/provider";
import { recordMoneyAudit } from "./audit";
import type { AdminClient } from "../supabase/service";
import { REFUSAL } from "./balance-copy";
import {
  normalisePhone,
  onboardingStateFor,
  openFailureKind,
  profileGaps,
  type OnboardingState,
  type OpenFailure,
  type ProfileGap,
} from "./funds";
import { WALLET_PROVIDER_KEY, adminDb, loadAccount, profileFor, walletProvider } from "./member-wallet";

export type OpenResult = { state: OnboardingState; gaps: ProfileGap[]; failure?: OpenFailure | null };

function refusalFor(f: RailFailure): string {
  switch (f.kind) {
    case "rate_limited":
      return REFUSAL.busy;
    case "unavailable":
    case "unreadable":
      return REFUSAL.unavailable;
    case "not_configured":
      return REFUSAL.notLive;
    case "unknown":
      return REFUSAL.submittedUnknown;
    default:
      return REFUSAL.refused;
  }
}

/**
 * OPEN A MEMBER'S WALLET AT THE PROVIDER, AUTOMATICALLY (27 October 2026,
 * founder: "when a number is verified, the wallet must be provisioned, no
 * extra button").
 *
 * Not a server action: it takes a user, so it is never callable from a
 * browser. Its two callers hold a session: `openBalanceAccount` (the wallet
 * screen's own button and its automatic first try) and `confirmPhoneCode`
 * (the moment the number is confirmed).
 *
 * IDEMPOTENT. It looks the customer up before it creates one, every time, so
 * a create that timed out, a double tap or the two callers racing find the
 * account that already exists instead of making another. An account already
 * ACTIVE answers at once with no provider call.
 */
export async function provisionWallet(user: User): Promise<ActionResult<OpenResult>> {
  if ((await memberWalletRailLive()) !== "live") return fail(REFUSAL.notLive);
  const db = adminDb();
  const provider = walletProvider();
  if (!db || !provider) return fail(REFUSAL.notLive);
  const userId = user.id;
  const existing = await loadAccount(db, userId);
  if (existing?.status === "ACTIVE") return ok({ state: "ACTIVE", gaps: [] });
  const verdict = await guardMoney("balanceSetup", userId);
  if (!verdict.allowed) return fail(verdict.message);

  const profile = await profileFor(db, user);
  const gaps = profileGaps(profile);
  if (gaps.length > 0) {
    await db
      .from("financial_provider_accounts")
      .upsert({ user_id: userId, provider: WALLET_PROVIDER_KEY, status: "VERIFICATION_REQUIRED", status_observed_at: new Date().toISOString() }, { onConflict: "user_id,provider" });
    return ok({ state: "VERIFICATION_REQUIRED", gaps });
  }

  const save = async (state: OnboardingState, customerId: string | null, providerStatus: string | null, detail?: string) => {
    await db.from("financial_provider_accounts").upsert(
      {
        user_id: userId,
        provider: WALLET_PROVIDER_KEY,
        provider_customer_id: customerId,
        status: state,
        provider_status: providerStatus,
        status_observed_at: new Date().toISOString(),
        ...(detail ? { metadata: { last_failure: detail } } : {}),
      },
      { onConflict: "user_id,provider" },
    );
  };

  const email = profile.email!.trim().toLowerCase();
  let customer = await provider.findCustomer({ email });
  if (customer.ok && customer.value === null) {
    await save("PENDING", null, null);
    const created = await provider.createCustomer({
      firstName: profile.firstName!.trim(),
      lastName: profile.lastName!.trim(),
      email,
      phone: normalisePhone(profile.phone ?? "")!,
      /* No countryId: the provider's live API refused "NG" (it casts the field to its
         own internal id, despite the docs), and an omitted country inherits the
         merchant account's, which is Nigeria (create-merchant-customer). Seen
         live 9 October 2026: "Cast to ObjectId failed for value NG". */
    });
    if (!created.ok) {
      /* A refusal is a real answer; anything else is not, and the next try looks up first. */
      if (created.kind === "refused") {
        await save("FAILED", null, null, created.detail);
        return ok({ state: "FAILED", gaps: [], failure: openFailureKind(created.detail) });
      }
      return ok({ state: "PENDING", gaps: [] });
    }
    customer = { ok: true, value: created.value };
  }
  if (!customer.ok) return fail(refusalFor(customer));
  const c = customer.value!;
  const state = onboardingStateFor({ account: null, customer: c, gaps: [] });
  await save(state, c.customerId, c.status);
  await recordMoneyAudit(db as unknown as AdminClient, {
    actor: { kind: "user", userId },
    action: "balance.account.opened",
    reference: null,
    subjectUserId: userId,
    outcome: state.toLowerCase(),
  });
  return ok({ state, gaps: [] });
}

