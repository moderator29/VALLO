import "server-only";

import { envelopeData } from "./client";

/**
 * THE PROVIDER'S ANSWERS, READ. The public OpenAPI types no response body
 * (every 2xx is "any"), so each reader takes only the fields Vallo needs,
 * checks each one, and answers null for a record it cannot read. A null is
 * never a state: the caller records "unknown" and a person or the read-back
 * resolves it.
 *
 * Every success is the envelope `{ success, message, data }`; a list is
 * `data.items`. Ids carry the provider's prefixes (`PAR_`, `PAC_`, `TXN_`).
 */
type Json = Record<string, unknown>;

const obj = (value: unknown): Json | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);
const int = (value: unknown): number | null => (typeof value === "number" && Number.isSafeInteger(value) ? value : null);

function items(value: unknown): Json[] {
  const data = envelopeData(value);
  const list = Array.isArray(data) ? data : obj(data)?.items;
  return Array.isArray(list) ? list.map(obj).filter((x): x is Json => x !== null) : [];
}

export type ProviderParty = { id: string; status: string | null; payoutEligible: boolean | null };

function partyOf(record: Json | null): ProviderParty | null {
  const id = str(record?.id) ?? str(record?.party_id);
  if (!record || !id || !id.startsWith("PAR_")) return null;
  return { id, status: str(record.status)?.toLowerCase() ?? null, payoutEligible: typeof record.payout_eligible === "boolean" ? record.payout_eligible : null };
}

/** `GET /parties?external_reference=`: the member's party, when the provider knows them. */
export function readPartyList(value: unknown): ProviderParty[] {
  return items(value).map(partyOf).filter((p): p is ProviderParty => p !== null);
}

export type OnboardedParty = {
  party: ProviderParty;
  /** The identifier as the provider masks it. The raw number never comes back and is never kept. */
  maskedIdentifier: string | null;
  verifiedName: string | null;
};

/** PartyOnboardResult (the one response the OpenAPI does type): `{ status, party, identity }`. */
export function readOnboarded(value: unknown): OnboardedParty | null {
  const data = obj(envelopeData(value));
  const party = partyOf(obj(data?.party));
  if (!party) return null;
  const identity = obj(data?.identity);
  const details = obj(identity?.verification_details);
  return { party, maskedIdentifier: str(identity?.masked_identifier), verifiedName: str(details?.full_name) };
}

export type ProviderPayoutAccount = {
  id: string;
  status: string | null;
  bankCode: string | null;
  /** The last digits the provider shows, for matching against the lister's own account. */
  accountTail: string | null;
  accountName: string | null;
};

function payoutAccountOf(record: Json | null): ProviderPayoutAccount | null {
  const id = str(record?.id);
  if (!record || !id || !id.startsWith("PAC_")) return null;
  const shown = str(record.masked_account_number) ?? str(record.account_number);
  const digits = shown ? shown.replace(/\D/g, "") : "";
  return {
    id,
    status: str(record.status)?.toLowerCase() ?? null,
    bankCode: str(record.bank_code),
    accountTail: digits.length >= 4 ? digits.slice(-4) : null,
    accountName: str(record.account_name) ?? str(record.resolved_account_name),
  };
}

export function readPayoutAccount(value: unknown): ProviderPayoutAccount | null {
  return payoutAccountOf(obj(envelopeData(value)));
}

export function readPayoutAccountList(value: unknown): ProviderPayoutAccount[] {
  return items(value).map(payoutAccountOf).filter((p): p is ProviderPayoutAccount => p !== null);
}

export type ProviderBank = { code: string; name: string };

/** `GET /banks`: the provider's own bank codes, which a payout account must use. */
export function readBanks(value: unknown): ProviderBank[] {
  return items(value)
    .map((b) => {
      const code = str(b.code) ?? str(b.bank_code);
      const name = str(b.name) ?? str(b.bank_name);
      return code && name ? { code, name } : null;
    })
    .filter((b): b is ProviderBank => b !== null);
}

export type ProviderTransaction = {
  id: string;
  /** The provider's own status word, lowercased, exactly as it said it otherwise. */
  status: string | null;
  /** The provider's counter on the record, which activate, extend and cancel must send back. */
  version: number | null;
  amountMinor: number | null;
  fundedMinor: number | null;
  releasedMinor: number | null;
  refundedMinor: number | null;
  externalReference: string | null;
};

function transactionOf(record: Json | null): ProviderTransaction | null {
  const id = str(record?.id);
  if (!record || !id || !id.startsWith("TXN_")) return null;
  return {
    id,
    status: str(record.status)?.toLowerCase() ?? null,
    version: int(record.version),
    amountMinor: int(record.amount_minor),
    fundedMinor: int(record.funded_minor),
    releasedMinor: int(record.released_minor),
    refundedMinor: int(record.refunded_minor),
    externalReference: str(record.external_reference),
  };
}

export function readTransaction(value: unknown): ProviderTransaction | null {
  return transactionOf(obj(envelopeData(value)));
}

export function readTransactionList(value: unknown): ProviderTransaction[] {
  return items(value).map(transactionOf).filter((t): t is ProviderTransaction => t !== null);
}

/** The transfer details Vallo shows the payer, exactly the keys `protected-read.ts` draws. */
export type FundingInstructions = {
  bank_name: string;
  account_name: string;
  account_number: string;
  expires_at: string | null;
  payment_account_id: string;
};

/** A payment account made for one transaction. Null unless the bank, the name and the number are all there. */
export function readPaymentAccount(value: unknown): FundingInstructions | null {
  const record = obj(envelopeData(value));
  const id = str(record?.id);
  const bank = str(record?.bank_name);
  const name = str(record?.account_name);
  const number = str(record?.account_number);
  if (!record || !id || !bank || !name || !number || !/^\d{6,32}$/.test(number)) return null;
  return { bank_name: bank, account_name: name, account_number: number, expires_at: str(record.expires_at), payment_account_id: id };
}
