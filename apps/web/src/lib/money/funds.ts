/**
 * THE MEMBER BALANCE, AS A MODEL (Part B phases 5 to 10; founder sections 9
 * to 14, 22, 31, 54). Pure: types, tables and arithmetic on figures that
 * already came from the provider. Nothing here invents a figure.
 *
 * Three vocabularies, never mixed (section 54, "store both"):
 *  - the provider's word (`provider_status`, kept as it was said),
 *  - Vallo's record status (`funds_movements.status`),
 *  - the sentence a member reads (`MOVEMENT_STATUS_COPY`), which names no
 *    provider and no backend state (13-provider-must-not-leak, sections 8, 9).
 */

/* --------------------------------------------------------- onboarding */

/** Founder section 9, in his words. */
export const ONBOARDING_STATES = [
  "NOT_STARTED",
  "PENDING",
  "VERIFICATION_REQUIRED",
  "ACTIVE",
  "RESTRICTED",
  "SUSPENDED",
  "FAILED",
] as const;
export type OnboardingState = (typeof ONBOARDING_STATES)[number];

/** What a member must still give before a provider account can open. */
import { normalisePhone as normaliseAnyPhone } from "../phone";
import { countryOfNumber } from "../phone-intl";

export type ProfileGap = "first_name" | "last_name" | "phone" | "email";

export type OnboardingInput = {
  /** Our record, if any. */
  account: { state: OnboardingState; providerCustomerId: string | null } | null;
  /** The provider's customer, when it was read. */
  customer: { status: string; blocked: boolean; canWithdraw: boolean | null; canBuy: boolean | null } | null;
  gaps: readonly ProfileGap[];
};

/**
 * One table from evidence to state. The provider's customer, when read,
 * decides; an unknown provider word is PENDING (we are checking), never
 * ACTIVE, so a status the provider invents later cannot open money movement.
 */
export function onboardingStateFor(input: OnboardingInput): OnboardingState {
  const { account, customer, gaps } = input;
  if (customer) {
    if (customer.blocked || customer.status === "blocked" || customer.status === "suspended") return "SUSPENDED";
    if (customer.status === "active") {
      return customer.canWithdraw === false || customer.canBuy === false ? "RESTRICTED" : "ACTIVE";
    }
    if (customer.status === "inactive" || customer.status === "restricted") return "RESTRICTED";
    return "PENDING";
  }
  if (!account || account.state === "NOT_STARTED") return gaps.length > 0 ? "VERIFICATION_REQUIRED" : "NOT_STARTED";
  if (gaps.length > 0 && account.providerCustomerId === null) return "VERIFICATION_REQUIRED";
  return account.state;
}

/** Whether money may move for this state. Only ACTIVE. */
export function canMoveMoney(state: OnboardingState): boolean {
  return state === "ACTIVE";
}

/** Names as the provider wants them, from a Vallo profile. */
export function profileGaps(p: { firstName: string | null; lastName: string | null; phone: string | null; email: string | null }): ProfileGap[] {
  const gaps: ProfileGap[] = [];
  if (!p.firstName?.trim()) gaps.push("first_name");
  if (!p.lastName?.trim()) gaps.push("last_name");
  if (!paylukPhone(p.phone ?? "")) gaps.push("phone");
  if (!p.email?.trim()) gaps.push("email");
  return gaps;
}

/**
 * A Nigerian mobile number in the local form the provider stores
 * (`08012345678`), from any of the spellings it accepts. Null otherwise.
 * Digits only, never a leading plus (create-merchant-customer).
 */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^0[789][01]\d{8}$/.test(digits)) return digits;
  if (/^234[789][01]\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^[789][01]\d{8}$/.test(digits)) return `0${digits}`;
  return null;
}

/**
 * THE NUMBER THE PAYMENTS PARTNER IS GIVEN (2 November 2026), for any country.
 *
 * A Nigerian mobile goes as before: the local form, no country (Payluk falls
 * back to the merchant account's country, Nigeria). A number from another
 * country goes only when Payluk has given us its internal id for that country
 * (`PAYLUK_COUNTRY_IDS`, `GB:<24-hex id>,US:<id>`): its live API refuses a
 * two-letter code, and which countries it serves is not documented (OPEN in
 * docs/payments/PAYLUK_LIVE_DOCS_FINDINGS.md section 10). Until a country is
 * listed, a member whose profile number is foreign is told the wallet needs a
 * Nigerian number for now, and nothing is sent.
 */
export type PaylukPhone = { phone: string; country?: string };

export function paylukCountryIds(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of (env.PAYLUK_COUNTRY_IDS ?? "").split(",")) {
    const [iso, id] = pair.split(":").map((part) => part.trim());
    if (iso && id && /^[A-Z]{2}$/.test(iso) && /^[0-9a-f]{24}$/i.test(id)) out[iso] = id;
  }
  return out;
}

export function paylukPhone(raw: string, env: Record<string, string | undefined> = process.env): PaylukPhone | null {
  const local = normalisePhone(raw);
  if (local) return { phone: local };
  const e164 = normaliseAnyPhone(raw);
  if (!e164 || e164.startsWith("+234")) return null;
  const country = countryOfNumber(e164);
  const id = country ? paylukCountryIds(env)[country] : undefined;
  return id ? { phone: e164.slice(1), country: id } : null;
}

/** Is this a valid mobile number from outside Nigeria (so the wallet can say why it waits)? */
export function isForeignMobile(raw: string): boolean {
  const e164 = normaliseAnyPhone(raw);
  return e164 !== null && !e164.startsWith("+234");
}

/* ----------------------------------------------------------- movements */

export const MOVEMENT_STATUSES = [
  "preparing",
  "awaiting_confirmation",
  "awaiting_payment",
  "processing",
  "unknown",
  "completed",
  "failed",
  "reversed",
  "cancelled",
  "under_review",
] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];
export type MovementKind = "deposit" | "withdrawal" | "transfer_out" | "transfer_in" | "other";

/**
 * The provider's `payment.*` word onto Vallo's record status. A word nobody
 * has seen is `under_review`, a person looks, and it is never a guess at
 * success or failure (section 54; status.ts does the same for the labels).
 */
export function movementStatusForProvider(word: string): MovementStatus {
  switch (word.trim().toLowerCase()) {
    case "success":
    case "successful":
      return "completed";
    case "failed":
      return "failed";
    case "reversed":
      return "reversed";
    case "pending":
    case "processing":
    case "queued":
      return "processing";
    default:
      return "under_review";
  }
}

/** Still moving, and the last four digits: in `funds-light.ts`, so a client screen can use them without this file's phone rules. */
export { isOpenMovement, lastFour } from "./funds-light";

/** The kind of a movement the provider reported for this member. */
export function movementKindFor(type: string, direction: "credit" | "debit" | null): MovementKind {
  switch (type) {
    case "deposit":
    case "transfer":
      return "deposit";
    case "withdrawal":
      return "withdrawal";
    case "wallet_transfer":
      return direction === "credit" ? "transfer_in" : "transfer_out";
    default:
      return "other";
  }
}

/* --------------------------------------------------------------- limits */

/** VALLO_PRICING.md: the withdrawal minimum is 1,000 naira. */
export const WITHDRAWAL_MIN_KOBO = 1_000_00;
/** The provider's own minimum for a deposit or a transfer intent: 100 naira (create-payment-intent). */
export const INTENT_MIN_KOBO = 100_00;
/**
 * Crypto withdrawal: the provider supports it and the adapter builds it
 * (`withdrawal_crypto`). Founder section 12 and D68b: not exposed until
 * Vallo's product and legal design explicitly enables it. His decision.
 */
export const CRYPTO_WITHDRAWAL_ENABLED = false as const;

/** The largest single movement a form accepts (amount.ts). */
export const MOVE_MAX_KOBO = 10_000_000_00;

/* ------------------------------------------------------- the breakdown */

/**
 * THE SEVEN FIGURES a member sees before a withdrawal is confirmed (section
 * 12): what they asked to withdraw, the processing fee the provider set on
 * this intent, Vallo's fee, VAT, the total that leaves the balance, what
 * reaches the bank, and where it goes. Every fee is a figure that came back;
 * none is a table.
 *
 * VAT: Vallo is not VAT registered and charges none (VALLO_PRICING.md); the
 * provider's fee "may include VAT" and is shown as one figure, so the VAT
 * line says so rather than splitting a number nobody gave us.
 *
 * Vallo's withdrawal fee: zero. No documented route lets Vallo collect a fee
 * from a provider-held balance (the merchant wallet has no API, findings
 * question 6), so a fee would be a figure on a screen that nobody takes.
 * It is a line, so the day it exists it is shown, not slipped in.
 */
export type WithdrawalBreakdown = {
  amountMinor: number;
  providerFeeMinor: number;
  valloFeeMinor: number;
  vatMinor: number;
  totalDebitedMinor: number;
  receivedMinor: number;
};

export function withdrawalBreakdown(input: { amountMinor: number; providerFeeMinor: number; valloFeeMinor?: number; vatMinor?: number }): WithdrawalBreakdown {
  const valloFee = input.valloFeeMinor ?? 0;
  const vat = input.vatMinor ?? 0;
  for (const v of [input.amountMinor, input.providerFeeMinor, valloFee, vat]) {
    if (!Number.isSafeInteger(v) || v < 0) throw new RangeError("A breakdown figure is not whole kobo.");
  }
  return {
    amountMinor: input.amountMinor,
    providerFeeMinor: input.providerFeeMinor,
    valloFeeMinor: valloFee,
    vatMinor: vat,
    /* The provider debits `amount + fee` (create-payment-intent). */
    totalDebitedMinor: input.amountMinor + input.providerFeeMinor + valloFee + vat,
    receivedMinor: input.amountMinor,
  };
}

/* --------------------------------------------------- the four figures */

export type ConfirmedFigure = { minor: number; confirmedAt: string | null };
export type BalanceFigures = {
  available: ConfirmedFigure;
  protected: ConfirmedFigure;
  pending: ConfirmedFigure;
  processing: ConfirmedFigure;
  currency: string;
};

export type MovementForFigures = { kind: MovementKind; status: MovementStatus; amountMinor: number; providerFeeMinor: number | null; observedAt: string };

/**
 * Available and Protected are the provider's `mainBalance` and
 * `escrowBalance`, as reported, with when. Pending and Processing are not
 * balances: they are the sums of this member's own requests the provider has
 * not yet settled, from Vallo's record of them, each with the latest time the
 * provider was heard about any of them. Nothing is subtracted from or added
 * to what the provider reported.
 */
export function balanceFigures(
  reported: { availableMinor: number; protectedMinor: number; currency: string; observedAt: string },
  movements: readonly MovementForFigures[],
): BalanceFigures {
  const sum = (pick: (m: MovementForFigures) => boolean, withFee: boolean): ConfirmedFigure => {
    let minor = 0;
    let latest: string | null = null;
    for (const m of movements) {
      if (!pick(m)) continue;
      minor += m.amountMinor + (withFee ? (m.providerFeeMinor ?? 0) : 0);
      if (latest === null || m.observedAt > latest) latest = m.observedAt;
    }
    return { minor, confirmedAt: latest };
  };
  const inFlight = (s: MovementStatus) => s === "processing" || s === "unknown" || s === "under_review";
  return {
    available: { minor: reported.availableMinor, confirmedAt: reported.observedAt },
    protected: { minor: reported.protectedMinor, confirmedAt: reported.observedAt },
    pending: sum((m) => (m.kind === "deposit" || m.kind === "transfer_in") && (inFlight(m.status) || m.status === "awaiting_payment"), false),
    processing: sum((m) => (m.kind === "withdrawal" || m.kind === "transfer_out") && inFlight(m.status), true),
    currency: reported.currency,
  };
}

/** A reported balance older than this is shown as "last confirmed", and re-read before money moves. */
export const BALANCE_FRESH_MS = 30_000;

export function isFresh(observedAt: string, now: number): boolean {
  const t = Date.parse(observedAt);
  return Number.isFinite(t) && now - t < BALANCE_FRESH_MS;
}

/* ------------------------------------------------------- references */

export const BALANCE_DEPOSIT_PREFIX = "rm-pld-";
export const BALANCE_WITHDRAW_PREFIX = "rm-plw-";
export const BALANCE_SEND_PREFIX = "rm-pls-";

const PREFIX: Record<"deposit" | "withdrawal" | "transfer_out", string> = {
  deposit: BALANCE_DEPOSIT_PREFIX,
  withdrawal: BALANCE_WITHDRAW_PREFIX,
  transfer_out: BALANCE_SEND_PREFIX,
};

/**
 * Vallo's reference for one movement, from the row's own id, so a retry of
 * the same row is the same reference and the provider sees one transaction.
 * Its own prefixes: the Paystack sweep never looks for these.
 */
export function movementReference(kind: "deposit" | "withdrawal" | "transfer_out", movementId: string): string {
  return `${PREFIX[kind]}${movementId}`;
}

/**
 * Why the provider refused to open an account, in the member's terms. Payluk
 * holds one account per mobile number, and a number already on another Payluk
 * account (the founder's own was on Vallo's merchant account, 8 October 2026)
 * is refused; every other refusal is about the details as a whole.
 */
export type OpenFailure = "phone_taken" | "details";

export function openFailureKind(detail: string | null | undefined): OpenFailure {
  const text = (detail ?? "").toLowerCase();
  return /phone/.test(text) && /(already|exist|registered|taken|in use|duplicate|merchant)/.test(text) ? "phone_taken" : "details";
}
