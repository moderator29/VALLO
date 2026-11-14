import "server-only";

import type { RailResult } from "../payments/provider";
import { DOCUMENTED, ESCROWPAY_PATHS, escrowPayRequest, type EscrowPayCall } from "../payments/providers/escrowpay/client";
import { escrowPayConfig, type EscrowPayConfig } from "../payments/providers/escrowpay/config";
import { failureCode } from "../payments/providers/escrowpay/errors";
import { readBanks, readOnboarded, readPartyList, readPayoutAccount, readPayoutAccountList, type ProviderBank } from "../payments/providers/escrowpay/read";
import { onboardPartyCall, payoutAccountCall, type IdentityKind } from "../payments/providers/escrowpay/requests";
import { escrowPayEnabled } from "../payments/providers/escrowpay/switch";
import type { Db } from "./member-wallet";

/**
 * THE PROTECTED RAIL'S DOOR TO THE PROVIDER, and the two things the provider
 * must know about a member before any payment can open (its "Getting
 * started" guide): who they are (a PARTY, made once by an identity check
 * against the member's NIN or BVN and date of birth), and, for a lister,
 * where a release is paid (a PAYOUT ACCOUNT the provider has name-checked).
 *
 * Nothing about a member's identity is kept here or anywhere in Vallo: the
 * number goes to the provider over TLS in the one request and is gone. Vallo
 * finds a returning member by the reference it gave the provider, the
 * member's own Vallo id (`GET /parties?external_reference=`).
 */

export type ProtectedRailDeps = {
  db: Db;
  config: EscrowPayConfig | null;
  /** Whether the adapter has been checked against the provider's sandbox (`DOCUMENTED`). */
  documented: boolean;
  send: (config: EscrowPayConfig | null, call: EscrowPayCall) => Promise<RailResult<unknown>>;
  enabled: () => Promise<boolean>;
  alert: (kind: string, detail: Record<string, unknown>) => Promise<void>;
  now: () => number;
};

export function protectedRailDeps(db: Db, alert: ProtectedRailDeps["alert"]): ProtectedRailDeps {
  return { db, config: escrowPayConfig(process.env), documented: DOCUMENTED, send: escrowPayRequest, enabled: escrowPayEnabled, alert, now: Date.now };
}

/** Whether a call to the provider could be made at all (never the switch: reading back is not gated). */
export function providerReachable(deps: ProtectedRailDeps): boolean {
  return deps.documented && deps.config !== null;
}

/**
 * Whether money movement may START: reachable, credentials that may start a
 * member's payment on this deployment (never a test key in production), and
 * the founder's switch on.
 */
export async function protectedRailOpen(deps: ProtectedRailDeps): Promise<boolean> {
  if (!providerReachable(deps) || deps.config?.startsMoney !== true) return false;
  try {
    return await deps.enabled();
  } catch {
    return false;
  }
}

/** A provider failure that provably moved nothing. Anything else may have reached it. */
export function provablyNothing(result: RailResult<unknown>): boolean {
  return !result.ok && (result.kind === "refused" || result.kind === "not_configured" || result.kind === "rate_limited" || result.kind === "not_found");
}

/* ------------------------------------------------------------- parties */

export type PartyLookup = { state: "known"; partyId: string } | { state: "unknown_member" } | { state: "unavailable" };

/** The states of a party that may take part in a payment. Anything else (restricted, archived) is not offered one. */
const USABLE_PARTY = new Set(["active", "verified"]);

/** The member's party at the provider, by the reference Vallo gave it: their own Vallo id. */
export async function findParty(deps: ProtectedRailDeps, userId: string): Promise<PartyLookup> {
  if (!providerReachable(deps)) return { state: "unavailable" };
  const seen = await deps.send(deps.config, { method: "GET", path: ESCROWPAY_PATHS.partiesByReference(userId) });
  if (!seen.ok) return { state: "unavailable" };
  const party = readPartyList(seen.value).find((p) => p.status === null || USABLE_PARTY.has(p.status));
  return party ? { state: "known", partyId: party.id } : { state: "unknown_member" };
}

export type OnboardOutcome =
  | { state: "verified"; partyId: string; maskedIdentifier: string | null; verifiedName: string | null }
  /** The number and the date of birth did not match the record. Nothing was made. */
  | { state: "not_matched" }
  /** The provider wants a person to look at this identity. Nothing was made. */
  | { state: "needs_review" }
  | { state: "bad_input" }
  | { state: "unavailable" };

/**
 * The member's one identity check (PartyOnboard). The identifier is passed
 * straight through and is in no log, no alert and no row. A member the
 * provider already knows is answered from the lookup, with no second check.
 */
export async function onboardMember(
  deps: ProtectedRailDeps,
  input: { userId: string; kind: IdentityKind; identifier: string; dateOfBirth: string; email: string; name: string | null; phone: string | null },
): Promise<OnboardOutcome> {
  if (!providerReachable(deps)) return { state: "unavailable" };
  const known = await findParty(deps, input.userId);
  if (known.state === "known") return { state: "verified", partyId: known.partyId, maskedIdentifier: null, verifiedName: null };
  if (known.state === "unavailable") return { state: "unavailable" };
  const made = await deps.send(
    deps.config,
    onboardPartyCall({ ...input, consentReference: `vallo-consent-${input.userId}-${new Date(deps.now()).toISOString().slice(0, 10)}` }),
  );
  if (made.ok) {
    const read = readOnboarded(made.value);
    if (read) return { state: "verified", partyId: read.party.id, maskedIdentifier: read.maskedIdentifier, verifiedName: read.verifiedName };
    /* Made, and unreadable: the lookup is the provider's own word on it. */
    const again = await findParty(deps, input.userId);
    return again.state === "known" ? { state: "verified", partyId: again.partyId, maskedIdentifier: null, verifiedName: null } : { state: "unavailable" };
  }
  const code = failureCode(made);
  if (code === "identity_verification_failed") return { state: "not_matched" };
  if (code === "identity_requires_review") return { state: "needs_review" };
  if (made.kind === "refused") return { state: "bad_input" };
  return { state: "unavailable" };
}

/* ------------------------------------------------------ payout account */

export type PayoutReadiness =
  | { state: "ready"; payoutAccountId: string }
  /** The lister has no bank account on Vallo to be paid into. */
  | { state: "no_account" }
  /** The lister's bank is not one the provider pays to. */
  | { state: "bank_unsupported" }
  /** The provider's name check on the account did not pass. */
  | { state: "not_verified" }
  | { state: "unavailable" };

type ValloAccount = { bankCode: string | null; bankName: string; accountNumber: string };

const USABLE_PAYOUT = new Set(["active", "verified"]);

async function valloPayoutAccount(db: Db, userId: string): Promise<ValloAccount | null | "error"> {
  try {
    const own = await db
      .from("bank_accounts")
      .select("bank_code, bank_name, account_number, is_default")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .limit(1);
    if (own.error) return "error";
    const first = (own.data ?? [])[0] as { bank_code: string; bank_name: string; account_number: string } | undefined;
    if (first) return { bankCode: first.bank_code, bankName: first.bank_name, accountNumber: first.account_number };
    const agents = await db.from("agents").select("id").eq("user_id", userId);
    if (agents.error) return "error";
    const ids = ((agents.data ?? []) as { id: string }[]).map((a) => a.id);
    if (ids.length === 0) return null;
    const payout = await db
      .from("payout_accounts")
      .select("bank_code, bank_name, account_number, is_default")
      .in("agent_id", ids)
      .order("is_default", { ascending: false })
      .limit(1);
    if (payout.error) return "error";
    const agent = (payout.data ?? [])[0] as { bank_code: string | null; bank_name: string; account_number: string } | undefined;
    return agent ? { bankCode: agent.bank_code, bankName: agent.bank_name, accountNumber: agent.account_number } : null;
  } catch {
    return "error";
  }
}

const bankWords = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["bank", "plc", "ltd", "limited", "nigeria", "of", "the", "microfinance", "mfb"].includes(w))
    .join(" ");

/** The provider's own code for the lister's bank: the same code when it has it, else the same bank by name. Never a near miss. */
export function providerBankCode(banks: readonly ProviderBank[], account: { bankCode: string | null; bankName: string }): string | null {
  if (account.bankCode) {
    const byCode = banks.find((b) => b.code === account.bankCode);
    if (byCode) return byCode.code;
  }
  const wanted = bankWords(account.bankName);
  if (!wanted) return null;
  const byName = banks.filter((b) => bankWords(b.name) === wanted);
  return byName.length === 1 ? byName[0]!.code : null;
}

/**
 * The lister's payout account at the provider, made from the bank account
 * they already keep on Vallo. An account the provider already holds for them
 * (the same last four digits, checked) is used as it is.
 */
export async function ensurePayoutAccount(deps: ProtectedRailDeps, input: { userId: string; partyId: string }): Promise<PayoutReadiness> {
  if (!providerReachable(deps)) return { state: "unavailable" };
  const account = await valloPayoutAccount(deps.db, input.userId);
  if (account === "error") return { state: "unavailable" };
  if (!account) return { state: "no_account" };
  const tail = account.accountNumber.replace(/\D/g, "").slice(-4);

  const held = await deps.send(deps.config, { method: "GET", path: ESCROWPAY_PATHS.payoutAccountsOf(input.partyId) });
  if (!held.ok) return { state: "unavailable" };
  const existing = readPayoutAccountList(held.value).find((p) => p.accountTail === tail && p.status !== null && USABLE_PAYOUT.has(p.status));
  if (existing) return { state: "ready", payoutAccountId: existing.id };

  const listed = await deps.send(deps.config, { method: "GET", path: ESCROWPAY_PATHS.banks });
  if (!listed.ok) return { state: "unavailable" };
  const bankCode = providerBankCode(readBanks(listed.value), account);
  if (!bankCode) return { state: "bank_unsupported" };

  const made = await deps.send(deps.config, payoutAccountCall({ partyId: input.partyId, bankCode, accountNumber: account.accountNumber }));
  if (!made.ok) return made.kind === "refused" ? { state: "not_verified" } : { state: "unavailable" };
  const read = readPayoutAccount(made.value);
  if (!read) return { state: "unavailable" };
  return read.status !== null && USABLE_PAYOUT.has(read.status) ? { state: "ready", payoutAccountId: read.id } : { state: "not_verified" };
}
