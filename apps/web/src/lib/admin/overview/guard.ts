import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import {
  ADMIN_FORBIDDEN_MESSAGE,
  ADMIN_SIGNED_OUT_MESSAGE,
  ADMIN_STEP_UP_MESSAGE,
  ADMIN_UNCONFIGURED_MESSAGE,
  readStaffAccess,
  requireAdmin,
  type AdminAccess,
} from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";

/**
 * THE COO DESK'S OWN DOOR.
 *
 * There is no single `StaffScope` for "COO": the position holds five
 * scopes at once (`JOB_DESCRIPTIONS.coo.scopes`: listing_approval,
 * moderation, support, agreements, operations), granted together through
 * `admin_grant_staff` exactly like any other staff position. `requireAdmin`
 * takes one scope at a time, so this desk is not a single
 * `requireAdmin(scope)` call: it is a super admin, OR a staff member who
 * holds EVERY one of those five scopes.
 *
 * `requireAdmin("operations")` is called first, both because `operations`
 * is always part of the COO's bundle and because it is the one `requireAdmin`
 * call that gives back a real client plus the caller's own `userClient`
 * (needed to read the full scope list through `readStaffAccess`, the way
 * `/admin/agreements` already reads a second scope through the same
 * caller's client rather than inventing a new path). Nothing here changes
 * `lib/admin/guard.ts` itself.
 */

export type CooAccess =
  | { state: "unconfigured" | "signed-out" | "not-admin" | "step-up" }
  | {
      state: "coo";
      supabase: SupabaseClient;
      userClient: SupabaseClient;
      user: User;
      isSuperAdmin: boolean;
    };

export async function requireCoo(): Promise<CooAccess> {
  const access: AdminAccess = await requireAdmin("operations");
  if (access.state !== "admin") return { state: access.state };
  if (access.isSuperAdmin) {
    return { state: "coo", supabase: access.supabase, userClient: access.userClient, user: access.user, isSuperAdmin: true };
  }
  const staff = await readStaffAccess(access.userClient);
  const required = JOB_DESCRIPTIONS.coo.scopes;
  const holdsAll = !!staff && required.every((scope) => staff.scopes.includes(scope));
  if (!holdsAll) return { state: "not-admin" };
  return { state: "coo", supabase: access.supabase, userClient: access.userClient, user: access.user, isSuperAdmin: false };
}

/** The same honest refusal words the rest of the console uses. */
export function cooRefusal(access: Exclude<CooAccess, { state: "coo" }>): string {
  if (access.state === "unconfigured") return ADMIN_UNCONFIGURED_MESSAGE;
  if (access.state === "signed-out") return ADMIN_SIGNED_OUT_MESSAGE;
  if (access.state === "step-up") return ADMIN_STEP_UP_MESSAGE;
  return ADMIN_FORBIDDEN_MESSAGE;
}
