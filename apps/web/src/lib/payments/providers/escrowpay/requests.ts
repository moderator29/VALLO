import "server-only";

import { ESCROWPAY_PATHS, type EscrowPayCall } from "./client";

/**
 * THE REQUESTS VALLO SENDS, each built in one place from the provider's own
 * schemas (public OpenAPI, "EscrowPay Merchant API" 0.1.0; the schema name is
 * given on each). Amounts are integer kobo. Every money call carries an
 * `Idempotency-Key` made from Vallo's stored reference and the step, so the
 * same step asked twice is one request to the provider.
 *
 * What Vallo always asks for, and why:
 *  - `funding_mode: "exact"`: a short or over transfer is not accepted as
 *    the payment;
 *  - `release_policy: "manual_only"` and `refund_policy: "manual_only"`:
 *    money moves only on Vallo's instruction, never on a timer (spec screen
 *    6, "no unexpected automatic release countdown");
 *  - `payout_preference: "automatic"` with the lister's verified payout
 *    account: a release goes on to the lister's bank with no second step.
 *    Always, in every deployment (config.ts); "manual" is reachable only
 *    from the sandbox test.
 */

export type IdentityKind = "nin" | "bvn";

/** PartyOnboard: a person not yet known to the provider. The identifier is sent on and never stored by Vallo. */
export function onboardPartyCall(input: {
  kind: IdentityKind;
  identifier: string;
  dateOfBirth: string;
  email: string;
  userId: string;
  name: string | null;
  phone: string | null;
  consentReference: string;
}): EscrowPayCall {
  const body: Record<string, unknown> = {
    type: input.kind,
    identifier: input.identifier,
    date_of_birth: input.dateOfBirth,
    consent: true,
    consent_reference: input.consentReference.slice(0, 120),
    country_code: "NG",
    email: input.email,
    external_reference: input.userId,
  };
  if (input.name) body.name = input.name.slice(0, 255);
  if (input.phone) body.phone = input.phone.slice(0, 32);
  /* No Idempotency-Key on this operation in the provider's document: a
     repeat for a person already bound answers with that party. */
  return { method: "POST", path: ESCROWPAY_PATHS.onboardParty, body };
}

/** PayoutAccountCreate: the lister's bank destination, owned by their party. The provider runs the name enquiry itself. */
export function payoutAccountCall(input: { partyId: string; bankCode: string; accountNumber: string }): EscrowPayCall {
  return {
    method: "POST",
    path: ESCROWPAY_PATHS.payoutAccounts,
    body: { owner_type: "party", owner_id: input.partyId, bank_code: input.bankCode, account_number: input.accountNumber, is_default: true },
  };
}

/** TransactionCreate: a draft, named by Vallo's reference. */
export function createTransactionCall(input: {
  reference: string;
  amountMinor: number;
  payerPartyId: string;
  beneficiaryPartyId: string;
  payoutAccountId: string;
  payoutPreference: "automatic" | "manual";
  fundingDeadline: string;
  description: string;
  metadata: Record<string, string>;
}): EscrowPayCall {
  return {
    method: "POST",
    path: ESCROWPAY_PATHS.create,
    idempotencyKey: `${input.reference}:create`,
    body: {
      type: "standard",
      amount_minor: input.amountMinor,
      currency: "NGN",
      funding_mode: "exact",
      payer: { party_type: "party", party_id: input.payerPartyId },
      beneficiary: { party_type: "party", party_id: input.beneficiaryPartyId },
      release_policy: "manual_only",
      refund_policy: "manual_only",
      payout_preference: input.payoutPreference,
      payout_account_id: input.payoutAccountId,
      funding_deadline: input.fundingDeadline,
      external_reference: input.reference,
      description: input.description.slice(0, 500),
      metadata: input.metadata,
    },
  };
}

/** TransactionActivate: the draft becomes payable. `version` is the provider's own counter on the transaction. */
export function activateTransactionCall(input: { reference: string; transactionId: string; version: number }): EscrowPayCall {
  return {
    method: "POST",
    path: ESCROWPAY_PATHS.activate(input.transactionId),
    idempotencyKey: `${input.reference}:activate`,
    body: { version: input.version },
  };
}

/**
 * PaymentAccountCreate: the account the payer transfers to, made for this
 * one transaction. `attempt` counts the instructions issued for it, so new
 * details after an expiry are a new request and the old ones are never
 * handed out again.
 */
export function paymentAccountCall(input: { reference: string; transactionId: string; amountMinor: number; expiresAt: string; attempt: number }): EscrowPayCall {
  return {
    method: "POST",
    path: ESCROWPAY_PATHS.paymentAccounts(input.transactionId),
    idempotencyKey: `${input.reference}:account:${input.attempt}`,
    body: { type: "transaction_temporary", expected_amount_minor: input.amountMinor, currency: "NGN", expires_at: input.expiresAt },
  };
}

/**
 * CheckoutSessionCreate, with every field left to its default (bank
 * transfer). Its answer carries `payment_instructions`: the payment account
 * above with the account name and the exact total to transfer, which is the
 * amount plus the provider's fee when the payer bears it. Vallo draws its
 * own screen from those and never sends the member to the hosted page.
 */
export function checkoutSessionCall(input: { reference: string; transactionId: string; attempt: number }): EscrowPayCall {
  return {
    method: "POST",
    path: ESCROWPAY_PATHS.checkoutSessions(input.transactionId),
    idempotencyKey: `${input.reference}:checkout:${input.attempt}`,
    body: {},
  };
}

/** `GET /payouts/{id}`: one payout, by the provider's own id. */
export function payoutReadCall(payoutId: string): EscrowPayCall {
  return { method: "GET", path: ESCROWPAY_PATHS.payout(payoutId) };
}

/**
 * `GET /payouts?created_from=`: the payouts made since a moment, for finding
 * the one a release produced when no webhook named it. The list has no
 * transaction filter, so the caller matches `transaction_id` itself.
 */
export function payoutsSinceCall(sinceIso: string): EscrowPayCall {
  return { method: "GET", path: ESCROWPAY_PATHS.payoutsSince(sinceIso) };
}

/** FeeEstimateRequest: the provider's own figure for the money-in fee, and who bears it. */
export function feeEstimateCall(amountMinor: number): EscrowPayCall {
  return { method: "POST", path: ESCROWPAY_PATHS.feeEstimates, body: { amount_minor: amountMinor, currency: "NGN", fee_type: "escrow_service" } };
}

/** TransactionExtend: a later funding deadline, for new transfer details after the first ones lapsed. */
export function extendTransactionCall(input: { reference: string; transactionId: string; version: number; fundingDeadline: string; attempt: number }): EscrowPayCall {
  return {
    method: "POST",
    path: ESCROWPAY_PATHS.extend(input.transactionId),
    idempotencyKey: `${input.reference}:extend:${input.attempt}`,
    body: { version: input.version, funding_deadline: input.fundingDeadline, reason: "The payer asked for new transfer details." },
  };
}

/** TransactionCancel: an unfunded transaction is withdrawn. */
export function cancelTransactionCall(input: { reference: string; transactionId: string; version: number; reason: string }): EscrowPayCall {
  return {
    method: "POST",
    path: ESCROWPAY_PATHS.cancel(input.transactionId),
    idempotencyKey: `${input.reference}:cancel`,
    body: { version: input.version, reason: input.reason.slice(0, 500) },
  };
}

/** ReleaseCreate: the whole held amount to the lister. */
export function releaseCall(input: { reference: string; transactionId: string; amountMinor: number }): EscrowPayCall {
  return {
    method: "POST",
    path: ESCROWPAY_PATHS.release(input.transactionId),
    idempotencyKey: `${input.reference}:release`,
    body: { amount_minor: input.amountMinor, reason: "The payer confirmed the agreed handover on Vallo." },
  };
}

/** RefundCreate: the whole held amount back to the payer, from the bank's hold. */
export function refundCall(input: { reference: string; transactionId: string; amountMinor: number; reason: string }): EscrowPayCall {
  return {
    method: "POST",
    path: ESCROWPAY_PATHS.refund(input.transactionId),
    idempotencyKey: `${input.reference}:refund`,
    body: { amount_minor: input.amountMinor, source: "escrow_held", reason: input.reason.slice(0, 500) },
  };
}
