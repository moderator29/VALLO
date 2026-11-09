import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveSessionClaims } from "@/lib/actions/session";
import { faults, isNotLive } from "@/lib/features/degrade";
import { reportReadFault } from "@/lib/observability/read-error";
import type { RestrictionKind } from "@/lib/admin/cases/model";

/**
 * ACCOUNT STANDING: what a member sees about themselves (Trust and Safety,
 * 8 November 2026). Their restrictions with the reason and the end date,
 * their appeal on each, and what happened to the reports they made, in
 * outcome words only (never who was reported or what was done to them).
 */

export type StandingRestriction = {
  id: string;
  kind: RestrictionKind;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  liftedAt: string | null;
  active: boolean;
  appeal: { id: string; status: "open" | "upheld" | "overturned" | "withdrawn"; decisionNote: string | null; createdAt: string } | null;
};

export type StandingReport = { number: number; status: string; category: string | null; createdAt: string; outcome: "no_action" | "action_taken" | null };

export type Standing =
  | { state: "not-open" }
  | { state: "signed-out" }
  | { state: "ok"; restrictions: StandingRestriction[]; reports: StandingReport[] };

export async function readMyStanding(): Promise<Standing> {
  const claims = await resolveSessionClaims();
  if (claims.state !== "signed-in") return { state: claims.state === "signed-out" ? "signed-out" : "not-open" };
  const db = claims.supabase as unknown as SupabaseClient;
  const { data, error } = await db.rpc("my_standing");
  if (error) {
    await reportReadFault("read.standing", ...faults(error));
    if (isNotLive(error)) return { state: "not-open" };
    return { state: "ok", restrictions: [], reports: [] };
  }
  const d = (data ?? {}) as { restrictions?: StandingRestriction[]; reports?: StandingReport[] };
  return { state: "ok", restrictions: d.restrictions ?? [], reports: d.reports ?? [] };
}
