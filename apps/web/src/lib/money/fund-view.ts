import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSession } from "../actions/session";

/** The rail the gate resolves for an agreement, as a party reads it; null when it cannot be read. */
export async function readAgreementRail(agreementId: string): Promise<"escrow" | "direct" | null> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  try {
    const { data, error } = await (session.supabase as unknown as SupabaseClient).rpc("agreement_payable_for", { p_agreement: agreementId });
    if (error) return null;
    const rail = (data as { rail?: unknown } | null)?.rail;
    return rail === "escrow" || rail === "direct" ? rail : null;
  } catch {
    return null;
  }
}
