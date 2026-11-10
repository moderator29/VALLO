import "server-only";

import {
  can,
  requireCapability,
  type AnyFiatProvider,
  type ChargeSplit,
  type CollectInput,
  type FiatProviderId,
} from "../provider";
import { providerEnabled } from "./kill-switch";
import { paystackProvider } from "./paystack";
import { escrowPayConfig } from "./escrowpay/config";
import { protectedPaySwitchOn } from "../../money/protected-pay-switch";

export { assertProviderEnabled, FiatProviderDisabled, providerEnabled } from "./kill-switch";

/**
 * Call sites take a provider from here, as `AnyFiatProvider`, and ask `can()`
 * for anything beyond the core, rather than importing an adapter directly and
 * bypassing the capability check. Paystack is the only fiat adapter that
 * takes payments through this seam; the protected rail has its own server
 * module (`lib/money/protected-rail.ts`).
 */
export function fiatProvider(id: FiatProviderId): AnyFiatProvider | null {
  switch (id) {
    case "paystack":
      return paystackProvider;
  }
}

/** Paystack is always registered; this only spares every call site the null check. */
export function paystackSeam(): AnyFiatProvider {
  return fiatProvider("paystack") ?? paystackProvider;
}

/**
 * True only when a protected payment could genuinely be held: the protected
 * rail's provider key is configured for this deployment and the founder's
 * protected-pay switch is on (`protectedPaySwitchOn`, fail closed; the
 * environment stop needs no database). Any error is false.
 */
export async function escrowRailLive(): Promise<boolean> {
  if (escrowPayConfig(process.env) === null) return false;
  return protectedPaySwitchOn();
}

/** The member balance rail has no provider registered: it is not configured. */
export async function memberWalletRailLive(): Promise<"live" | "not_configured" | "switched_off"> {
  return "not_configured";
}

/** The provider's full record of a reference. Read-only, so never gated by the kill switch. */
export async function verifyRecord(p: AnyFiatProvider, reference: string) {
  requireCapability(p, "verify_with_record");
  return p.verifyRecord(reference);
}

export type OpenedCheckout = { reference: string; authorizationUrl: string; accessCode: string };

/**
 * Open a hosted checkout: split when a split is given (which requires
 * `split_at_charge`), plain otherwise. The input reaches the provider exactly
 * as given. The caller gates it with `assertProviderEnabled` first, because
 * this starts money movement.
 */
export async function openCheckout(
  p: AnyFiatProvider,
  input: CollectInput & { split?: ChargeSplit },
): Promise<OpenedCheckout> {
  let done;
  if (input.split) {
    requireCapability(p, "split_at_charge");
    done = await p.collectWithSplit({ ...input, split: input.split });
  } else {
    done = await p.collect(input);
  }
  return { reference: done.reference, authorizationUrl: done.redirectUrl, accessCode: done.accessCode ?? "" };
}
