import "server-only";
import { requireAdmin, type AdminAccess } from "@/lib/admin/guard";
import { ACCOUNT_DELETION_SCOPES } from "./door-scopes";

export async function requireDeletionReasonsDoor(): Promise<AdminAccess> {
  let last: AdminAccess = { state: "not-admin" };
  for (const scope of ACCOUNT_DELETION_SCOPES) {
    last = await requireAdmin(scope);
    if (last.state === "admin" || last.state === "unconfigured" || last.state === "signed-out" || last.state === "step-up") return last;
  }
  return last;
}
