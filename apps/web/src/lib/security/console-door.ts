import "server-only";

import type { User } from "@supabase/supabase-js";
import { reauthMethodFor } from "../account-deletion/reauthenticate";

/**
 * Which proof opens the console for this person (`console-step-up.ts`): a
 * super admin's security key, or for everybody else their own account
 * password, or an emailed code when the account has no password.
 */
export type ConsoleDoor = "key" | "password" | "email-code";

export function consoleDoorFor(staff: { isSuperAdmin: boolean }, user: User): ConsoleDoor {
  return staff.isSuperAdmin ? "key" : reauthMethodFor(user);
}
