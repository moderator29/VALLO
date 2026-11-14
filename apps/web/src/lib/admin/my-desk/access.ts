import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdmin, requireConsole, type StaffScope } from "@/lib/admin/guard";
import type { StaffPosition } from "@/lib/admin/staff-positions";
import { canAssignTasks, canPostAnnouncements, type DeskIdentity } from "./model";

/**
 * THE ONE DOOR INTO MY DESK. Open to anyone with console access: an admin, a
 * super admin, or a staff member with at least one scope who has
 * acknowledged the handbook.
 *
 * `requireAdmin()` with no scope refuses every staff member, and a scoped
 * call needs a scope the person holds, so the door asks the database who
 * the person is first (`requireConsole`) and then asks `requireAdmin` for
 * the first scope a staff member holds. An admin is admitted without a
 * scope. The client handed back is the one that call gives: the admin's own
 * RLS-bound client, or the service client for a scoped staff member, exactly
 * as every other desk.
 */
export type DeskDoor =
  | { state: "unconfigured" | "signed-out" | "not-admin" | "step-up" | "handbook" }
  | {
      state: "ok";
      db: SupabaseClient;
      userClient: SupabaseClient;
      who: DeskIdentity;
      canAssign: boolean;
      canAnnounce: boolean;
      /** The scope the copilot and the guard use for this person. */
      copilotScope: StaffScope;
    };

export async function requireDeskUser(): Promise<DeskDoor> {
  const door = await requireConsole();
  if (door.state === "step-up") return { state: "step-up" };
  if (door.state !== "console") return { state: door.state };
  const staff = door.staff;
  const isAdminRole = staff.isAdmin || staff.isSuperAdmin;
  if (!isAdminRole && !staff.handbookAcknowledged) return { state: "handbook" };
  const scope: StaffScope | undefined = isAdminRole ? undefined : staff.scopes[0];
  if (!isAdminRole && !scope) return { state: "not-admin" };
  const access = await requireAdmin(scope);
  if (access.state !== "admin") return { state: access.state };
  const position: StaffPosition | null = staff.position;
  const who: DeskIdentity = {
    userId: access.user.id,
    isAdmin: isAdminRole,
    isSuperAdmin: access.isSuperAdmin,
    position,
    scopes: staff.scopes,
  };
  return {
    state: "ok",
    db: access.supabase as unknown as SupabaseClient,
    userClient: access.userClient as unknown as SupabaseClient,
    who,
    canAssign: canAssignTasks(who),
    canAnnounce: canPostAnnouncements(who),
    copilotScope: scope ?? staff.scopes[0] ?? "operations",
  };
}

/** The sentence a refused caller reads, on the page and from an action. */
export function doorWords(state: Exclude<DeskDoor["state"], "ok">): string {
  switch (state) {
    case "unconfigured":
      return "We cannot reach the console right now. This is on our side, not yours. Try again in a few minutes.";
    case "signed-out":
      return "Sign in with your operations account to continue.";
    case "step-up":
      return "Confirm it is you to use the console.";
    case "handbook":
      return "Read and acknowledge the staff handbook to open your desk.";
    default:
      return "My Desk is for Vallo staff. Your account does not carry staff access.";
  }
}
