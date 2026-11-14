import "server-only";

import type { RailResult } from "../payments/provider";
import { DOCUMENTED, ESCROWPAY_PATHS, escrowPayRequest, type EscrowPayCall } from "../payments/providers/escrowpay/client";
import { escrowPayConfig, type EscrowPayConfig } from "../payments/providers/escrowpay/config";
import { failureCode } from "../payments/providers/escrowpay/errors";
import { readBanks, readFeeEstimate, readOnboarded, readPartyList, readPayoutAccount, readPayoutAccountList, type FeeEstimate, type ProviderBank } from "../payments/providers/escrowpay/read";
import { feeEstimateCall, onboardPartyCall, payoutAccountCall, type IdentityKind } from "../payments/providers/escrowpay/requests";
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

/** The state of a party that may take part in a payment (seen on the sandbox). Anything else (restricted, archived) is not offered one. */
const USABLE_PARTY = new Set(["active"]);

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
  /** The number is already bound to a different party at the provider: another Vallo account used it. */
  | { state: "already_used" }
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
  /* Not this member's own party (the lookup above would have found it): somebody else's. */
  if (code === "identity_already_exists") return { state: "already_used" };
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

type ValloAccount = { bankCode: string | null; bankName: string; accountNumber: string; accountName: string | null };

const USABLE_PAYOUT = new Set(["verified"]);

async function valloPayoutAccount(db: Db, userId: string): Promise<ValloAccount | null | "error"> {
  try {
    const own = await db
      .from("bank_accounts")
      .select("bank_code, bank_name, account_number, resolved_account_name, is_default")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .limit(1);
    if (own.error) return "error";
    const first = (own.data ?? [])[0] as { bank_code: string; bank_name: string; account_number: string; resolved_account_name: string | null } | undefined;
    if (first) return { bankCode: first.bank_code, bankName: first.bank_name, accountNumber: first.account_number, accountName: first.resolved_account_name };
    const agents = await db.from("agents").select("id").eq("user_id", userId);
    if (agents.error) return "error";
    const ids = ((agents.data ?? []) as { id: string }[]).map((a) => a.id);
    if (ids.length === 0) return null;
    const payout = await db
      .from("payout_accounts")
      .select("bank_code, bank_name, account_number, account_name, resolved_account_name, is_default")
      .in("agent_id", ids)
      .order("is_default", { ascending: false })
      .limit(1);
    if (payout.error) return "error";
    const agent = (payout.data ?? [])[0] as
      | { bank_code: string | null; bank_name: string; account_number: string; account_name: string | null; resolved_account_name: string | null }
      | undefined;
    return agent
      ? { bankCode: agent.bank_code, bankName: agent.bank_name, accountNumber: agent.account_number, accountName: agent.resolved_account_name ?? agent.account_name }
      : null;
  } catch {
    return "error";
  }
}

/**
 * THE TWO BANK CODE BOOKS. A bank account on Vallo carries the code its
 * name enquiry used (the card provider's, mostly the three-digit CBN code);
 * the protected-pay provider takes only the six-digit interbank code
 * ("Unknown bank_code" for anything else, seen on the sandbox). This table
 * joins the two for the banks members actually hold accounts at. The six
 * the sandbox's bank list carries (Sterling, UBA, GTBank, Access, Zenith,
 * First Bank) were checked against it on 14 November 2026; the rest are the
 * published interbank codes and are to be checked against the provider's
 * live list before go-live. It is not trusted on its own: the code must be on the provider's own bank list, and
 * on a live account the name the provider's enquiry finds must be the name
 * Vallo's enquiry found, or no payout account is used.
 */
export const INTERBANK_CODE: Readonly<Record<string, string>> = Object.freeze({
  "232": "000001", // Sterling
  "082": "000002", // Keystone
  "214": "000003", // FCMB
  "033": "000004", // UBA
  "301": "000006", // Jaiz
  "070": "000007", // Fidelity
  "076": "000008", // Polaris
  "023": "000009", // Citibank
  "050": "000010", // Ecobank
  "215": "000011", // Unity
  "221": "000012", // Stanbic IBTC
  "058": "000013", // GTBank
  "044": "000014", // Access
  "057": "000015", // Zenith
  "011": "000016", // First Bank
  "035": "000017", // Wema
  "032": "000018", // Union
  "030": "000020", // Heritage
  "068": "000021", // Standard Chartered
  "100": "000022", // SunTrust
  "101": "000023", // Providus
  "102": "000025", // Titan Trust
  "302": "000026", // TAJ
  "00103": "000027", // Globus
  "303": "000029", // Lotus
  "104": "000030", // Parallex
  "105": "000031", // PremiumTrust
  "50211": "090267", // Kuda
  "999992": "100004", // OPay
  "999991": "100033", // PalmPay
  "50515": "090405", // Moniepoint
  "566": "090110", // VFD
  "125": "090175", // Rubies
});

/** The provider's own code for the lister's bank, only when it is on the provider's list. */
export function providerBankCode(banks: readonly ProviderBank[], account: { bankCode: string | null }): string | null {
  if (!account.bankCode) return null;
  const direct = banks.find((b) => b.code === account.bankCode);
  if (direct) return direct.code;
  const mapped = INTERBANK_CODE[account.bankCode];
  return mapped && banks.some((b) => b.code === mapped) ? mapped : null;
}

const nameWords = (name: string): string[] =>
  name
    .toUpperCase()
    .replace(/[^A-Z ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

/**
 * Whether two name enquiries found the same account holder. Banks order and
 * shorten names differently, so the test is two words in common (or the one
 * word of a single-word name), never a loose resemblance.
 */
export function sameAccountHolder(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const first = new Set(nameWords(a));
  const second = nameWords(b);
  if (first.size === 0 || second.length === 0) return false;
  const shared = second.filter((w) => first.has(w)).length;
  return shared >= Math.min(2, first.size, second.length);
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
  /* A live account is used only when the provider's enquiry found the holder Vallo's did. The simulator invents its names. */
  const live = deps.config?.environment === "production";
  const usable = (p: { status: string | null; payoutEligible: boolean | null; accountName: string | null }) =>
    p.status !== null && USABLE_PAYOUT.has(p.status) && p.payoutEligible !== false && (!live || sameAccountHolder(p.accountName, account.accountName));
  const existing = readPayoutAccountList(held.value).find((p) => p.accountTail === tail && usable(p));
  if (existing) return { state: "ready", payoutAccountId: existing.id };

  const listed = await deps.send(deps.config, { method: "GET", path: ESCROWPAY_PATHS.banks });
  if (!listed.ok) return { state: "unavailable" };
  const bankCode = providerBankCode(readBanks(listed.value), account);
  if (!bankCode) return { state: "bank_unsupported" };

  const made = await deps.send(deps.config, payoutAccountCall({ partyId: input.partyId, bankCode, accountNumber: account.accountNumber }));
  if (!made.ok) {
    /* Seen on the sandbox: one bank account is registered once, for one party. Another member already holds this one. */
    if (failureCode(made) === "payout_account_exists") {
      await deps.alert("protected_rail.payout_account_taken", { user_id: input.userId, party_id: input.partyId });
    }
    return made.kind === "refused" ? { state: "not_verified" } : { state: "unavailable" };
  }
  const read = readPayoutAccount(made.value);
  if (!read) return { state: "unavailable" };
  if (usable(read)) return { state: "ready", payoutAccountId: read.id };
  if (live && read.status !== null && USABLE_PAYOUT.has(read.status)) {
    await deps.alert("protected_rail.payout_name_mismatch", { user_id: input.userId, payout_account_id: read.id });
  }
  return { state: "not_verified" };
}

/* ------------------------------------------------------------- the fee */

/** The provider's own money-in fee for an amount, and who bears it. Null when it could not be asked. */
export async function estimateMoneyInFee(deps: ProtectedRailDeps, amountMinor: number): Promise<FeeEstimate | null> {
  if (!providerReachable(deps)) return null;
  const asked = await deps.send(deps.config, feeEstimateCall(amountMinor));
  return asked.ok ? readFeeEstimate(asked.value) : null;
}
