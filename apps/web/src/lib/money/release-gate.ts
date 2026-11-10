import type { Db } from "./member-wallet";
import { isMissingFunction } from "../admin/reads/chargebacks-model";

export type ReleaseGate = "clear" | "held" | "paused" | "not_found" | "error";

/**
 * THE PAYOUT RULE at the moment Vallo would instruct a release to the lister
 * (`public.chargeback_release_gate`, migration cbh01). `held`: the lister has a
 * lost chargeback still owed and finance has not overridden it for this
 * payment; the database has audited the refusal and paused the release
 * where the agreements desk shows it. `paused`: a person at Vallo paused it.
 * Fails closed on any other error. Live since 13 October 2026; should the
 * function ever be missing (a database behind the app) the gate reads
 * `clear`, and the pause trigger and the hold check in it still refuse.
 */
export async function releaseGate(db: Db, arrangementId: string): Promise<ReleaseGate> {
  try {
    const { data, error } = await (db as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
    }).rpc("chargeback_release_gate", { p_arrangement: arrangementId });
    if (error) return isMissingFunction(error) ? "clear" : "error";
    const status = data && typeof data === "object" ? (data as Record<string, unknown>).status : undefined;
    return status === "clear" || status === "held" || status === "paused" || status === "not_found" ? status : "error";
  } catch {
    return "error";
  }
}
