import "server-only";

import { envelopeData } from "./client";

/**
 * THE PROVIDER'S ANSWERS, READ. The public OpenAPI types no response body
 * (every 2xx is "any"), so every field name here was taken from the
 * provider's sandbox itself on 14 November 2026 (the run is recorded in
 * `docs/handoff/ESCROWPAY_INTEGRATION.md`). Each reader takes only the fields
 * Vallo needs, checks each one, and answers null for a record it cannot
 * read. A null is never a state: the caller records "unknown" and a person
 * or the read-back resolves it.
 *
 * Every success is the envelope `{ success, message, data }`; a list is
 * `data.items` (the bank list is `data.banks`). Ids carry the provider's
 * prefixes (`PAR_`, `PAC_`, `TXN_`, `PAM_`, `CSN_`).
 */
type Json = Record<string, unknown>;

const obj = (value: unknown): Json | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);
const int = (value: unknown): number | null => (typeof value === "number" && Number.isSafeInteger(value) ? value : null);

function items(value: unknown): Json[] {
  const data = envelopeData(value);
  const list = Array.isArray(data) ? data : (obj(data)?.items ?? obj(data)?.banks);
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
  /** The name the provider's own enquiry found on the account. */
  accountName: string | null;
  payoutEligible: boolean | null;
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
    accountName: str(record.resolved_account_name) ?? str(record.account_name),
    payoutEligible: typeof record.payout_eligible === "boolean" ? record.payout_eligible : null,
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

/** The id of a payment account just made for a transaction (`PAM_...`). */
export function readPaymentAccountId(value: unknown): string | null {
  const id = str(obj(envelopeData(value))?.id);
  return id && id.startsWith("PAM_") ? id : null;
}

/** What a checkout session tells the payer to do: where to transfer, and exactly how much. */
export type PaymentInstructions = {
  checkoutSessionId: string;
  paymentAccountId: string;
  bankCode: string;
  accountName: string;
  accountNumber: string;
  /** The total to transfer, in kobo: the amount, plus the provider's fee when the payer bears it. */
  amountMinor: number;
  expiresAt: string | null;
};

/**
 * A checkout session's `payment_instructions`. Null unless every field the
 * payer needs is there. A live account number is digits only; the sandbox
 * simulator's is letters and digits, read only when `sandbox` is true.
 */
export function readPaymentInstructions(value: unknown, sandbox: boolean): PaymentInstructions | null {
  const session = obj(envelopeData(value));
  const pi = obj(session?.payment_instructions);
  const sessionId = str(session?.id);
  const accountId = str(pi?.payment_account_id);
  const bankCode = str(pi?.bank_code);
  const name = str(pi?.account_name);
  const number = str(pi?.account_number);
  const amount = int(pi?.amount_minor);
  if (!pi || !sessionId || !accountId || !bankCode || !name || !number || amount === null || amount <= 0) return null;
  if (!(sandbox ? /^[0-9A-Za-z]{6,32}$/ : /^\d{6,32}$/).test(number)) return null;
  return { checkoutSessionId: sessionId, paymentAccountId: accountId, bankCode, accountName: name, accountNumber: number, amountMinor: amount, expiresAt: str(pi.expires_at) };
}

/** The provider's own figure for the money-in fee on an amount, and who bears it at funding. */
export type FeeEstimate = { feeMinor: number; payer: "payer" | "business" };

export function readFeeEstimate(value: unknown): FeeEstimate | null {
  const data = obj(envelopeData(value));
  const fee = int(data?.amount_minor);
  const payer = str(data?.payer);
  if (fee === null || fee < 0 || (payer !== "payer" && payer !== "business")) return null;
  return { feeMinor: fee, payer };
}

/**
 * A payout to a lister's bank, as the provider reports it. Shape seen on the
 * sandbox on 14 November 2026: `POT_...`, `status` "completed", the
 * transaction it settles, the amount and the payout fee, `completed_at`.
 */
export type ProviderPayout = {
  id: string;
  status: string | null;
  transactionId: string | null;
  amountMinor: number | null;
  feeMinor: number | null;
  completedAt: string | null;
};

function payoutOf(record: Json | null): ProviderPayout | null {
  const id = str(record?.id);
  if (!record || !id || !id.startsWith("POT_")) return null;
  return {
    id,
    status: str(record.status)?.toLowerCase() ?? null,
    transactionId: str(record.transaction_id),
    amountMinor: int(record.amount_minor),
    feeMinor: int(record.fee_minor),
    completedAt: str(record.completed_at),
  };
}

export function readPayout(value: unknown): ProviderPayout | null {
  return payoutOf(obj(envelopeData(value)));
}

export function readPayoutList(value: unknown): ProviderPayout[] {
  return items(value).map(payoutOf).filter((p): p is ProviderPayout => p !== null);
}

/* ---------------------------------------------------------------------------
 * VALLO'S OWN WALLET AT THE PROVIDER.
 *
 * Unlike every reader above, these two were NOT run against the sandbox: the
 * wallet endpoints were not exercised on 14 November 2026, and the OpenAPI
 * document types their answers as free-form. So they read widely and judge
 * strictly, and they are built to refuse rather than to guess, because what
 * they feed is a decision to move money.
 *
 * `readAvailableMinor` answers a figure ONLY when the answer plainly carries
 * an available balance in the currency asked for. A shape it has not seen, a
 * figure that is not a whole number of kobo, two candidate figures that
 * disagree, or a currency it did not ask about, all answer null, and the
 * sweep then moves nothing and says the balance could not be read.
 * ------------------------------------------------------------------------- */

export type ProviderWallet = { id: string; currency: string | null; status: string | null };

function walletOf(record: Json | null): ProviderWallet | null {
  const id = str(record?.id) ?? str(record?.wallet_id);
  if (!record || !id) return null;
  return { id, currency: str(record.currency)?.toUpperCase() ?? null, status: str(record.status)?.toLowerCase() ?? null };
}

/** `GET /wallets?currency=`: the business's own wallets. A single wallet answer reads too. */
export function readWallets(value: unknown): ProviderWallet[] {
  const listed = items(value).map(walletOf).filter((w): w is ProviderWallet => w !== null);
  if (listed.length > 0) return listed;
  const single = walletOf(obj(envelopeData(value)));
  return single ? [single] : [];
}

/** The keys the provider might spell an available balance with, widest first. */
const AVAILABLE_KEYS = ["available_minor", "available_balance_minor", "available_amount_minor", "balance_available_minor"] as const;

function availableOf(record: Json): number | null {
  const figures = AVAILABLE_KEYS.map((key) => int(record[key])).filter((n): n is number => n !== null);
  if (figures.length === 0) return null;
  /* Two spellings that disagree is a shape nobody has read yet: refuse. */
  if (figures.some((n) => n !== figures[0])) return null;
  return figures[0]! >= 0 ? figures[0]! : null;
}

function currencyOf(record: Json): string | null {
  return str(record.currency)?.toUpperCase() ?? null;
}

/**
 * `GET /wallets/{id}/balances`: what may be paid out today, in kobo, for one
 * currency. Null when the answer cannot be read plainly.
 */
export function readAvailableMinor(value: unknown, currency: string): number | null {
  const want = currency.toUpperCase();
  const data = envelopeData(value);
  const rows = items(value);
  const top = obj(data);
  /* A list of per-currency lines, which is the commonest shape for balances. */
  const lines = rows.length > 0 ? rows : top ? [top] : [];
  const matching = lines.filter((line) => {
    const found = currencyOf(line);
    return found === null ? lines.length === 1 : found === want;
  });
  if (matching.length !== 1) return null;
  return availableOf(matching[0]!);
}
