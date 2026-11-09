import { LISTER_FEE_TERMS_VERSION } from "./copy";
import { bpsAsPercentText } from "./percent";

/**
 * THE LISTER'S ARITHMETIC (D51, the agreement gate; corrected by D61), as pure
 * integer maths.
 *
 *   Rent you set                          1,800,000
 *   Platform fee                     36,000 to 72,000
 *     Vallo, 2%                           36,000
 *     Escrow protection, 2%
 *     when a buyer pays into escrow       36,000
 *   You receive                   1,728,000 to 1,764,000
 *
 * WHY A RANGE (D61). The rail is chosen per booking, by how the buyer pays,
 * long after the lister accepts. On the escrow rail the lister bears Vallo's
 * commission and the escrow partner's fee; on the direct rail, Vallo's
 * commission and the payment processor's fee, which the processor caps. So no
 * single percentage is true at acceptance, and the screen shows the worst case
 * as the figure to count on, with the better rail as the top of the range.
 *
 * WHAT THE CODE ASSUMES ABOUT THE DIRECT RAIL. `lib/payments/paystack.ts`
 * builds the split with `bearer_type: "subaccount"` and `bearer_subaccount`
 * set to the lister's subaccount, so the lister bears the processor's fee on
 * the direct rail (VALLO_PRICING.md section 7 says the same). The top of the
 * range is therefore NOT rent minus Vallo's 2 percent: it is that minus the
 * processor's fee at its cap (`directProcessorFeeCapMinor`), which is the
 * least the lister can receive on that rail. With a cap of zero it is exactly
 * D61's 1,764,000; with Paystack's 2,000 naira cap it is 1,762,000. Every
 * figure shown is one the lister receives at least, so a booking can only
 * land above it.
 *
 * Every rate is POLICY DATA, read on the server and handed in
 * (`ListerFeePolicy`), never a constant here: changing a price is a row, not
 * a deploy. Each fee is the split's own rounding, `floor(amount * bps /
 * 10000)` in integer kobo, exactly as `payment_split_for_booking` computes the
 * commission leg. BigInt, so a land price in the billions of kobo cannot lose
 * a digit.
 *
 * Client-safe and pure.
 */

/** The rates in force, as the server read them. Vallo vocabulary only. */
export type ListerFeePolicy = {
  /** The policy row's version, recorded with the acceptance (D51 rule 2). */
  rateVersion: string;
  /** Vallo's commission on both rails, in basis points (`fee_rates` kind `commission`). */
  valloBps: number;
  /** The escrow partner's fee the lister bears when a buyer pays into escrow, in basis points. */
  escrowProtectionBps: number;
  /**
   * The most the payment processor's fee can come to on a direct payment, in
   * kobo, borne by the lister (the split's bearer). Zero when the lister bears
   * none. Never null: without it the worst case is not knowable.
   */
  directProcessorFeeCapMinor: number;
  /** An absolute cap on Vallo's commission in kobo, for the sale and land rows (D51), or null. */
  capMinor: number | null;
  /**
   * Whether the escrow protection row may be DRAWN: the server's
   * `protectedRailLive()` answer, set by `readListerFeePolicy`. Absent or
   * false, the fee screen shows the card rail only (sweep items 7 to 9, 9
   * November 2026). It never changes the figures recorded: `lister_fee_accept`
   * re-derives every figure from the rates in force, the escrow rate among
   * them, so `acceptanceOf` and `acceptanceMatches` keep using every rate.
   */
  escrowShown?: boolean;
};

export type ListerFeeFigures = {
  priceMinor: number;
  /** Vallo's commission, on either rail. */
  valloMinor: number;
  valloPercentText: string;
  /** True when the cap, not the rate, set Vallo's commission. */
  valloCapped: boolean;
  /** The escrow partner's fee, only when a buyer pays into escrow. */
  escrowProtectionMinor: number;
  escrowProtectionPercentText: string;
  /** The most the processor's fee can be on a direct payment. Zero when the lister bears none. */
  processorUpToMinor: number;
  /** The platform fee's range: Vallo alone, to Vallo with escrow protection. */
  platformFeeLowMinor: number;
  platformFeeHighMinor: number;
  /** THE HEADLINE: the least the lister receives, whichever way the buyer pays. */
  receiveLowMinor: number;
  /** The least they receive on the better rail. */
  receiveHighMinor: number;
  /** True when the escrow rail is the worst case (the usual answer; small prices can turn it). */
  escrowIsLowest: boolean;
};

/** floor(amount * bps / 10000) in integer kobo. */
export function feeOf(amountMinor: number, bps: number): number {
  return Number((BigInt(amountMinor) * BigInt(bps)) / BigInt(10_000));
}

const isBps = (bps: number) => Number.isInteger(bps) && bps >= 0 && bps < 10_000;
const isKobo = (minor: number) => Number.isSafeInteger(minor) && minor >= 0;

function validPolicy(policy: ListerFeePolicy): boolean {
  return (
    isBps(policy.valloBps) &&
    isBps(policy.escrowProtectionBps) &&
    policy.valloBps + policy.escrowProtectionBps < 10_000 &&
    isKobo(policy.directProcessorFeeCapMinor) &&
    (policy.capMinor === null || isKobo(policy.capMinor)) &&
    policy.rateVersion.length > 0
  );
}

/**
 * The figures for one price, or null when there is nothing honest to show:
 * no price yet, a price that is not whole kobo, or a policy that does not
 * parse. Null is drawn as a sentence, never as a zero.
 */
export function listerFeeFigures(priceMinor: number | null, policy: ListerFeePolicy | null): ListerFeeFigures | null {
  if (policy === null || !validPolicy(policy)) return null;
  if (priceMinor === null || !Number.isSafeInteger(priceMinor) || priceMinor <= 0) return null;
  const byRate = feeOf(priceMinor, policy.valloBps);
  const valloCapped = policy.capMinor !== null && byRate > policy.capMinor;
  const valloMinor = valloCapped ? (policy.capMinor as number) : byRate;
  const escrowProtectionMinor = feeOf(priceMinor, policy.escrowProtectionBps);
  /* The processor cannot take more than is left after Vallo's share. */
  const processorUpToMinor = Math.min(policy.directProcessorFeeCapMinor, priceMinor - valloMinor);
  const escrowTotal = valloMinor + escrowProtectionMinor;
  const directTotal = valloMinor + processorUpToMinor;
  return {
    priceMinor,
    valloMinor,
    valloPercentText: bpsAsPercentText(policy.valloBps),
    valloCapped,
    escrowProtectionMinor,
    escrowProtectionPercentText: bpsAsPercentText(policy.escrowProtectionBps),
    processorUpToMinor,
    platformFeeLowMinor: valloMinor,
    platformFeeHighMinor: escrowTotal,
    receiveLowMinor: priceMinor - Math.max(escrowTotal, directTotal),
    receiveHighMinor: priceMinor - Math.min(escrowTotal, directTotal),
    escrowIsLowest: escrowTotal >= directTotal,
  };
}

/**
 * WHAT THE FEE SCREEN DRAWS, which is not always what it records.
 *
 * While the protected rail is off (`policy.escrowShown` not true) escrow is not
 * offered, so its row is not drawn and the figures drawn are the card rail's
 * alone: the platform fee is Vallo's, and "You receive" is one figure, the
 * least the lister receives on a card payment (the processor's fee at its
 * cap taken off). With the rail live it is D61's range, exactly as before.
 *
 * The acceptance is NOT derived from this. `lister_fee_accept` (D77 migration)
 * refuses any figure that differs from its own derivation, which always
 * includes the escrow rate in force, so the record is `acceptanceOf(figures,
 * policy)` in both cases. Its worst case is never above the figure drawn here,
 * so the lister is never recorded as accepting more than they were shown.
 */
export type ListerFeeShown = {
  showEscrow: boolean;
  platformFeeLowMinor: number;
  platformFeeHighMinor: number;
  receiveLowMinor: number;
  receiveHighMinor: number;
  escrowIsLowest: boolean;
};

export function listerFeeShown(figures: ListerFeeFigures, policy: ListerFeePolicy): ListerFeeShown {
  if (policy.escrowShown === true) {
    return {
      showEscrow: figures.escrowProtectionMinor > 0,
      platformFeeLowMinor: figures.platformFeeLowMinor,
      platformFeeHighMinor: figures.platformFeeHighMinor,
      receiveLowMinor: figures.receiveLowMinor,
      receiveHighMinor: figures.receiveHighMinor,
      escrowIsLowest: figures.escrowIsLowest,
    };
  }
  const cardReceive = figures.priceMinor - figures.valloMinor - figures.processorUpToMinor;
  return {
    showEscrow: false,
    platformFeeLowMinor: figures.valloMinor,
    platformFeeHighMinor: figures.valloMinor,
    receiveLowMinor: cardReceive,
    receiveHighMinor: cardReceive,
    escrowIsLowest: false,
  };
}

/**
 * Whether "Send for review" waits on the fee gate (D60). Only when the
 * blocking flag (`lister_fee_gate_blocking`, read fail closed) is on AND the
 * figures on screen have not been accepted. With the flag off, which is its
 * state with no row, publishing never waits.
 */
export function feeGateHoldsSend(blocking: boolean, accepted: boolean): boolean {
  return blocking && !accepted;
}

/**
 * What the lister accepted, exactly as they saw it: the terms version, both
 * rates as numbers (never a reference to the live row: a rate change must
 * never alter what somebody agreed to), and every figure the screen drew,
 * including the price they entered. Sent with the publish request when the
 * gate blocks; Session 2's record adds the actor and the timestamp.
 */
export type ListerFeeAcceptance = {
  termsVersion: string;
  rateVersion: string;
  valloBps: number;
  escrowProtectionBps: number;
  directProcessorFeeCapMinor: number;
  capMinor: number | null;
  priceMinor: number;
  valloMinor: number;
  escrowProtectionMinor: number;
  processorUpToMinor: number;
  receiveLowMinor: number;
  receiveHighMinor: number;
};

/** The acceptance of exactly these figures under exactly this policy. */
export function acceptanceOf(figures: ListerFeeFigures, policy: ListerFeePolicy): ListerFeeAcceptance {
  return {
    termsVersion: LISTER_FEE_TERMS_VERSION,
    rateVersion: policy.rateVersion,
    valloBps: policy.valloBps,
    escrowProtectionBps: policy.escrowProtectionBps,
    directProcessorFeeCapMinor: policy.directProcessorFeeCapMinor,
    capMinor: policy.capMinor,
    priceMinor: figures.priceMinor,
    valloMinor: figures.valloMinor,
    escrowProtectionMinor: figures.escrowProtectionMinor,
    processorUpToMinor: figures.processorUpToMinor,
    receiveLowMinor: figures.receiveLowMinor,
    receiveHighMinor: figures.receiveHighMinor,
  };
}

/** Whether an acceptance still matches the figures on screen (a price edit, a new rate or new terms void it). */
export function acceptanceMatches(acceptance: ListerFeeAcceptance | null, figures: ListerFeeFigures | null, policy: ListerFeePolicy | null): boolean {
  if (!acceptance || !figures || !policy) return false;
  const current = acceptanceOf(figures, policy);
  return (Object.keys(current) as (keyof ListerFeeAcceptance)[]).every((key) => acceptance[key] === current[key]);
}

/**
 * Parse the server's answer for the policy (C2 REQUEST 1, revised by D61):
 * one row of `rate_version`, `commission_bps`, `escrow_protection_bps`,
 * `direct_processor_fee_cap_minor` and `cap_minor`. Anything unexpected is
 * null: the gate never guesses a rate.
 */
export function parseListerFeePolicy(value: unknown): ListerFeePolicy | null {
  const row = (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | null | undefined;
  if (!row || typeof row !== "object") return null;
  const capRaw = row.cap_minor;
  let capMinor: number | null = null;
  if (capRaw !== null && capRaw !== undefined) {
    const cap = Number(capRaw);
    if (!Number.isFinite(cap)) return null;
    capMinor = cap;
  }
  const processorRaw = row.direct_processor_fee_cap_minor;
  const version = row.rate_version;
  const policy: ListerFeePolicy = {
    rateVersion: typeof version === "string" || typeof version === "number" ? String(version) : "",
    valloBps: typeof row.commission_bps === "number" ? row.commission_bps : Number.NaN,
    escrowProtectionBps: typeof row.escrow_protection_bps === "number" ? row.escrow_protection_bps : Number.NaN,
    /* A bigint column arrives as a string from PostgREST; anything else is refused. */
    directProcessorFeeCapMinor:
      typeof processorRaw === "number" || (typeof processorRaw === "string" && /^\d+$/.test(processorRaw))
        ? Number(processorRaw)
        : Number.NaN,
    capMinor,
  };
  return validPolicy(policy) ? policy : null;
}
