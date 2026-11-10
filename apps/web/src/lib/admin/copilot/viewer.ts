import "server-only";
import { requireConsole, STAFF_SCOPES, STAFF_SCOPE_LABEL, type ConsoleAccess } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import type { CopilotViewer } from "./tools/types";

/**
 * WHO IS ASKING, resolved once per request from the console door. An admin or
 * super admin holds every scope; a staff member holds the scopes the database
 * says they hold and only once they have acknowledged the current handbook.
 */
export type ResolvedViewer =
  | {
      state: "ok";
      viewer: CopilotViewer;
      positionTitle: string | null;
      roleSummary: string | null;
      scopeLabels: string[];
    }
  | { state: "unconfigured" }
  | { state: "refused" };

export function viewerFromConsole(door: Extract<ConsoleAccess, { state: "console" }>, firstName: string): CopilotViewer {
  const staff = door.staff;
  const admin = staff.isAdmin || staff.isSuperAdmin;
  return {
    userId: door.user.id,
    firstName,
    isAdmin: admin,
    isSuperAdmin: staff.isSuperAdmin,
    scopes: admin ? STAFF_SCOPES : staff.scopes,
    position: admin ? null : staff.position,
  };
}

export async function resolveCopilotViewer(): Promise<ResolvedViewer> {
  const door = await requireConsole();
  if (door.state === "unconfigured") return { state: "unconfigured" };
  if (door.state !== "console") return { state: "refused" };
  const staff = door.staff;
  const admin = staff.isAdmin || staff.isSuperAdmin;
  if (!admin && !staff.handbookAcknowledged) return { state: "refused" };
  let first = "";
  try {
    const { data } = await door.supabase.from("profiles").select("first_name, display_name").eq("id", door.user.id).maybeSingle();
    const p = data as { first_name?: string | null; display_name?: string | null } | null;
    first = (p?.first_name ?? p?.display_name ?? "").trim().split(/\s+/)[0] ?? "";
  } catch {
    first = "";
  }
  const viewer = viewerFromConsole(door, first || "there");
  const job = viewer.position ? JOB_DESCRIPTIONS[viewer.position] : null;
  return {
    state: "ok",
    viewer,
    positionTitle: job?.title ?? null,
    roleSummary: job?.summary ?? null,
    scopeLabels: staff.scopes.map((s) => STAFF_SCOPE_LABEL[s]),
  };
}
