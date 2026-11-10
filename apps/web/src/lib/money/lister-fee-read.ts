import "server-only";
import { reportReadError, reportReadFault } from "@/lib/observability/read-error";

import { resolveSession } from "../actions/session";
import { parseListerFeePolicy, type ListerFeePolicy } from "./lister-fee";
import { protectedRailLive } from "./rail-live";

/**
 * THE RATES IN FORCE FOR ONE LISTING, READ ON THE SERVER (D51, D61).
 *
 * The lister's fees are policy data, in basis points and kobo, with a version
 * recorded against every acceptance. That read does not exist yet: it is C2
 * REQUEST 1 to Session 2, revised by D61, `public.lister_fee_policy(p_listing,
 * p_property_type, p_listing_intent)` returning one row of `rate_version`,
 * `commission_bps` (Vallo, both rails), `escrow_protection_bps` (the escrow
 * partner's fee the lister bears), `direct_processor_fee_cap_minor` (the most
 * the processor's fee can be on a direct payment, borne by the lister as the
 * split's bearer; 0 if not) and `cap_minor` (a cap on Vallo's commission, or
 * null). No `rail`: the rail is not knowable when the lister accepts.
 *
 * Until it lands the call fails and this answers null, and the fee gate says
 * it cannot show the figures. It never falls back to a typed rate: a guessed
 * 400 is exactly the hardcoded number D51 forbids.
 */
export async function readListerFeePolicy(input: {
  listingId: string | null;
  propertyType: string | null;
  listingIntent: "rent" | "sale" | null;
}): Promise<ListerFeePolicy | null> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  try {
    const { data, error } = await session.supabase.rpc("lister_fee_policy" as never, {
      p_listing: input.listingId,
      p_property_type: input.propertyType,
      p_listing_intent: input.listingIntent,
    } as never);
    /* Until C2 REQUEST 1 lands the function is absent and that is the intended
       answer, so only a fault other than "not deployed" is reported. */
    await reportReadFault("read.money.lister_fee_policy", error);
    if (error) return null;
    const policy = parseListerFeePolicy(data);
    /* The escrow row is drawn only while the protected rail is live (sweep
       items 7 to 9); the rates themselves are recorded either way. */
    return policy ? { ...policy, escrowShown: await protectedRailLive() } : null;
  } catch (error) {
    await reportReadError("read.money.lister_fee_policy", error);
    return null;
  }
}
