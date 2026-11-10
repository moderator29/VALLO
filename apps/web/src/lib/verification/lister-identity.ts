import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { isFeatureEnabled } from "@/lib/flags";
import { isQaTester } from "@/lib/phone-otp/qa";

/**
 * THE LISTER'S IDENTITY, IN ONE WORD (founder, 10 November 2026: "you can
 * create a listing and not be verified, but before we can publish it the
 * person's identity must be verified").
 *
 * One helper, so every place that publishes something for a person (a
 * listing review, a roommate listing) asks the same question and says the
 * same thing. Stable path: `lib/verification/lister-identity.ts`.
 *
 * WHERE THE FACTS LIVE (read from the real tables, with the service role,
 * after the caller has proved it is an admin or a server job):
 *   - `agents.verification_tier`: the count of passed rungs from identity up.
 *     One or more means the platform already treats the person as verified
 *     (an agent who passed agent verification counts).
 *   - `identity_checks.status`: the Dojah check. approved or passed is
 *     approved; waiting, review or retry is pending; refused is failed.
 *   - `agent_documents` of kind `identity`, `review_status`: approved,
 *     pending or rejected.
 * The best answer wins: approved, then pending, then failed, then none.
 */
export type ListerIdentityStatus = "approved" | "pending" | "failed" | "none";

export type ListerIdentity = {
  status: ListerIdentityStatus;
  /** One plain sentence about the cause, for a banner or a checklist row. */
  reason: string;
  /** What has to happen next, for whoever reads it. */
  nextStep: string;
  /** Where a reviewer opens the person's verification case. */
  caseHref: string;
};

export const IDENTITY_REASON: Record<ListerIdentityStatus, string> = {
  approved: "The identity check is approved.",
  pending: "The ID is still waiting for review.",
  failed: "The ID check failed.",
  none: "No ID sent yet.",
};

export const IDENTITY_NEXT_STEP: Record<ListerIdentityStatus, string> = {
  approved: "Nothing more is needed.",
  pending: "Review the ID in the verification desk, then come back to this listing.",
  failed: "Ask the lister to send a new ID, then review it in the verification desk.",
  none: "Ask the lister to verify their identity. The listing waits on identity until then.",
};

/** The pure half: the best of the three sources' own words. */
export function decideIdentityStatus(facts: {
  tier: number;
  checks: readonly (string | null)[];
  documents: readonly (string | null)[];
}): ListerIdentityStatus {
  if (facts.tier >= 1) return "approved";
  const all = [
    ...facts.checks.map((s) => (s === "passed" ? "approved" : s === "refused" ? "failed" : s === "approved" ? "approved" : "pending")),
    ...facts.documents.map((s) => (s === "approved" ? "approved" : s === "rejected" ? "failed" : "pending")),
  ];
  if (all.includes("approved")) return "approved";
  if (all.includes("pending")) return "pending";
  if (all.includes("failed")) return "failed";
  return "none";
}

export function describeIdentity(status: ListerIdentityStatus, userId: string): ListerIdentity {
  return {
    status,
    reason: IDENTITY_REASON[status],
    nextStep: IDENTITY_NEXT_STEP[status],
    caseHref: `/admin/kyc?q=${encodeURIComponent(userId)}`,
  };
}

/** The refusal an admin reads in the banner when an approval is blocked on identity. */
export function identityRefusal(identity: ListerIdentity): string {
  return `Cannot approve: identity check not approved. ${identity.reason}`;
}

/**
 * Read the lister's identity. Fails closed: a read that fails answers `none`
 * with a reason that says the check could not be read, never "approved".
 * `client` is for tests; the default is the service client.
 */
export async function listerIdentityStatus(userId: string, client?: SupabaseClient): Promise<ListerIdentity & { readFailed?: true }> {
  const db = client ?? (createAdminClient() as unknown as SupabaseClient);
  try {
    const [agents, checks, docs] = await Promise.all([
      db.from("agents").select("verification_tier").eq("user_id", userId),
      db.from("identity_checks").select("status").eq("subject_id", userId),
      db.from("agent_documents").select("review_status").eq("uploader_id", userId).eq("kind", "identity"),
    ]);
    if (agents.error || checks.error || docs.error) throw new Error("identity read failed");
    const tier = Math.max(0, ...((agents.data ?? []) as { verification_tier: number | null }[]).map((r) => Number(r.verification_tier ?? 0)));
    const status = decideIdentityStatus({
      tier: Number.isFinite(tier) ? tier : 0,
      checks: ((checks.data ?? []) as { status: string | null }[]).map((r) => r.status),
      documents: ((docs.data ?? []) as { review_status: string | null }[]).map((r) => r.review_status),
    });
    return describeIdentity(status, userId);
  } catch {
    return { ...describeIdentity("none", userId), reason: "The identity check could not be read just now.", readFailed: true };
  }
}

/**
 * Does a new approval wait on this person's identity? Respects the platform's
 * own switch (`feature_flags.listing_verification`, off means no wall) and the
 * QA accounts, exactly as the lister's submit gate does
 * (`lib/identity/listing-verification-gate.ts`).
 */
export async function identityGateApplies(userId: string): Promise<boolean> {
  const [flagOn, qa] = await Promise.all([isFeatureEnabled("listing_verification"), isQaTester(userId)]);
  return flagOn && !qa;
}
