import { AdminCopilot } from "@/components/admin/copilot/AdminCopilot";
import { requireConsole, type StaffScope } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";

/**
 * A desk's copilot, for a server page (founder, 10 November 2026). It works
 * out the two things a page does not already hold: whether the signed-in
 * person may use this desk's copilot at all, and their named position (null
 * for an admin or super admin). A staff member who does not hold the scope
 * sees no copilot, because the route would refuse them anyway. The route
 * still re-checks everything; this only chooses what to draw.
 *
 * It renders inside the console layout, so it appears in the restricted
 * staff frame as well as the admin one.
 */
export async function DeskCopilot({
  scope,
  deskName,
  context,
}: {
  scope: StaffScope;
  deskName: string;
  /** From the desk's own `copilotContext` function, or null when nothing is live. */
  context: string | null;
}) {
  const door = await requireConsole();
  if (door.state !== "console") return null;
  const staff = door.staff;
  const isAdmin = staff.isAdmin || staff.isSuperAdmin;
  if (!isAdmin && !staff.scopes.includes(scope)) return null;
  const position = isAdmin ? null : staff.position;
  return (
    <AdminCopilot
      scope={scope}
      position={position}
      deskName={deskName}
      context={context}
      {...(position ? { greeting: JOB_DESCRIPTIONS[position].summary } : {})}
    />
  );
}
