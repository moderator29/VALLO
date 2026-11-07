import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isFeatureEnabled } from "../flags";
import { isQaTester } from "../phone-otp/qa";
import { verificationGateRefusal, type VerificationGateRefusal } from "../actions/envelope";
import {
  identityOnFile,
  listingVerificationOwed,
  VERIFY_BEFORE_SUBMIT,
  VERIFY_READ_FAILED,
} from "./listing-verification-rule";

/**
 * THE IDENTITY GATE IN FRONT OF A LISTING SUBMIT (Platform Grade 1, P0.3).
 * The rule is `listing-verification-rule.ts`; this reads its facts as the
 * member (RLS): the agent's verification tier and their own identity documents.
 *
 * FAILS CLOSED, the listing moment's stance (`phone-otp/core.ts`): a read
 * that fails refuses with the try-again sentence, never with "verify", because
 * the member may well be verified. Null means go ahead.
 */
export async function listingVerificationGate(
  supabase: SupabaseClient,
  userId: string,
  agentId: string,
): Promise<VerificationGateRefusal | { ok: false; error: string } | null> {
  const [flagOn, qa] = await Promise.all([isFeatureEnabled("listing_verification"), isQaTester(userId)]);
  if (!flagOn || qa) return null;

  try {
    const [agent, docs] = await Promise.all([
      /* `agents.verification_tier`, the count of passed rungs from identity
         up (the number `getOwnLadder` reads), visible to its own agent. NOT
         `agent_badges.tier`, which is a display word (none ... platinum). */
      supabase.from("agents").select("verification_tier").eq("id", agentId).maybeSingle(),
      supabase.from("agent_documents").select("review_status").eq("uploader_id", userId).eq("kind", "identity"),
    ]);
    if (docs.error) return { ok: false, error: VERIFY_READ_FAILED };
    if (agent.error) return { ok: false, error: VERIFY_READ_FAILED };
    const tier = Number((agent.data as { verification_tier?: unknown } | null)?.verification_tier ?? 0);
    const statuses = (docs.data ?? []).map((row) => {
      const status = (row as { review_status?: unknown }).review_status;
      return typeof status === "string" ? status : null;
    });
    const owed = listingVerificationOwed({
      flagOn,
      qa,
      tier: Number.isFinite(tier) ? tier : 0,
      identity: identityOnFile(statuses),
    });
    return owed ? verificationGateRefusal(VERIFY_BEFORE_SUBMIT) : null;
  } catch {
    return { ok: false, error: VERIFY_READ_FAILED };
  }
}

/**
 * The same answer for a screen to draw BEFORE the tap: the wizard's last step
 * shows "1 thing to fix: verify your identity" (reference R27). A failed read
 * answers false: the submit itself still refuses, so the card is a courtesy,
 * never the wall.
 */
export async function listingVerificationNeeded(supabase: SupabaseClient, userId: string, agentId: string): Promise<boolean> {
  const refusal = await listingVerificationGate(supabase, userId, agentId);
  return Boolean(refusal && "gate" in refusal && refusal.gate === "verification");
}
