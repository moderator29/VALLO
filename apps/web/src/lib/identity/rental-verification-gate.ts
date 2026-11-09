import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isFeatureEnabled } from "../flags";
import { isQaTester } from "../phone-otp/qa";
import { verificationGateRefusal, type VerificationGateRefusal } from "../actions/envelope";
import { identityOnFile, VERIFY_READ_FAILED } from "./listing-verification-rule";
import { rentalVerificationOwed, tenancyMonths, VERIFY_BEFORE_RENT } from "./rental-verification-rule";

/**
 * THE IDENTITY GATE IN FRONT OF A LONG RENTAL'S FIRST PAYMENT. The rule is
 * `rental-verification-rule.ts`; this reads its facts as the member (RLS):
 * the inspection's listing (rent period, shortest tenancy) and the member's
 * own identity documents.
 *
 * FAILS CLOSED, the payment moment's stance (`phone-otp/core.ts`): a read
 * that fails refuses with the try-again sentence, never with "verify". Null
 * means go ahead. An inspection the member cannot see is left to
 * `open_rent_charge`, which already refuses it in its own words.
 */
export async function rentalVerificationGate(
  supabase: SupabaseClient,
  userId: string,
  inspectionId: string,
): Promise<VerificationGateRefusal | { ok: false; error: string } | null> {
  const [flagOn, qa] = await Promise.all([isFeatureEnabled("rental_verification"), isQaTester(userId)]);
  if (!flagOn || qa) return null;

  try {
    const [inspection, docs] = await Promise.all([
      supabase
        .from("inspection_requests")
        .select("listings ( rent_period, minimum_tenancy_months )")
        .eq("id", inspectionId)
        .maybeSingle(),
      supabase.from("agent_documents").select("review_status").eq("uploader_id", userId).eq("kind", "identity"),
    ]);
    if (inspection.error || docs.error) return { ok: false, error: VERIFY_READ_FAILED };
    if (!inspection.data) return null;
    const joined = (inspection.data as { listings?: unknown }).listings;
    const listing = (Array.isArray(joined) ? joined[0] : joined) as
      | { rent_period?: string | null; minimum_tenancy_months?: number | null }
      | null
      | undefined;
    const statuses = (docs.data ?? []).map((row) => {
      const status = (row as { review_status?: unknown }).review_status;
      return typeof status === "string" ? status : null;
    });
    const owed = rentalVerificationOwed({
      flagOn,
      qa,
      months: tenancyMonths(listing?.rent_period, listing?.minimum_tenancy_months),
      identity: identityOnFile(statuses),
    });
    return owed ? verificationGateRefusal(VERIFY_BEFORE_RENT) : null;
  } catch {
    return { ok: false, error: VERIFY_READ_FAILED };
  }
}
