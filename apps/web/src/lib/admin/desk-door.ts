import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { isNotLive } from "@/lib/features/degrade";

import { writeAudit } from "./audit";
import { requireAdmin, type StaffScope } from "./guard";
import { requireCoo } from "./overview/guard";

/**
 * THE DOOR OF THE STAFF DESKS ADDED ON 10 NOVEMBER 2026 (marketing, content,
 * technical, support lead). It is `requireAdmin(scope)` and nothing wider,
 * plus ONE addition for desks with an approval step: the COO (or an admin)
 * who approves a campaign, an item or a policy note does not hold the desk's
 * own scope, so `approverMayEnter` lets the person who passes `requireCoo()`
 * in. That person can read the desk and approve or send back; every write
 * that makes the work itself still needs the desk's scope, and the actions say
 * so with `viaApprover`.
 *
 * Who may approve: an admin or super admin, or the COO or CEO (anybody who
 * holds all five COO scopes, which is what `requireCoo` checks). The person who
 * made a piece of work never approves it, whoever they are.
 */
export type DeskDoor =
  | { state: "unconfigured" | "signed-out" | "not-admin" | "step-up" }
  | {
      state: "ok";
      db: SupabaseClient;
      user: User;
      /** True when this person was let in only to approve (the COO), not by the desk's scope. */
      viaApprover: boolean;
      /** May approve, send back or approve policy: an admin, or the COO or CEO. */
      canApprove: boolean;
      /** An admin role (not a scoped staff member). */
      isAdminRole: boolean;
    };

export async function deskDoor(scope: StaffScope, options: { approverMayEnter?: boolean } = {}): Promise<DeskDoor> {
  const access = await requireAdmin(scope);
  if (access.state === "admin") {
    const canApprove = !access.isStaff || (await requireCoo()).state === "coo";
    return {
      state: "ok",
      db: access.supabase as unknown as SupabaseClient,
      user: access.user,
      viaApprover: false,
      canApprove,
      isAdminRole: !access.isStaff,
    };
  }
  if (options.approverMayEnter) {
    const coo = await requireCoo();
    if (coo.state === "coo") {
      return {
        state: "ok",
        db: coo.supabase,
        user: coo.user,
        viaApprover: true,
        canApprove: true,
        isAdminRole: coo.isSuperAdmin,
      };
    }
  }
  return { state: access.state };
}

/** The sentence a refused caller reads, on the page and from an action. */
export { deskRefusal } from "./desk-refusal";

export const DESK_FAILED = "That did not go through. Try again.";

/** A database error as the sentence the person reads. `notOpen` is the desk's "not set up yet" line. */
export function deskWords(error: unknown, notOpen: string): string {
  if (isNotLive(error)) return notOpen;
  if ((error as { code?: string } | null)?.code === "42501") return "Your staff role does not allow this.";
  return DESK_FAILED;
}

export const AUDIT_NOTE = "Done, but the audit line could not be written. Operations has been alerted.";

/** Writes the audit line for a desk action; returns a note for the banner when it could not be written. */
export async function auditDesk(
  actorId: string,
  entityType: string,
  action: string,
  entityId: string | null,
  detail: Record<string, string | number | boolean | null> = {},
): Promise<string | null> {
  let written = false;
  try {
    written = await writeAudit(createAdminClient(), { actorId, action, entityType, entityId, detail });
  } catch {
    written = false;
  }
  return written ? null : AUDIT_NOTE;
}
