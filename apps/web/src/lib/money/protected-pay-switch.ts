import "server-only";

import { cache } from "react";
import { isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";

/**
 * THE PROTECTED-PAY SWITCH: the founder's one switch for offering the
 * protected payment rail to members. It FAILS CLOSED: a missing flag, a
 * failed read or a kill switch all mean off.
 *
 * The flag's old key was removed from the live database by the
 * provider-removal SQL (verified live 15 November 2026: the old row, table and
 * function are gone), so only the current key is read.
 */
export const PROTECTED_PAY_FLAG = "payments_protected_pay_on";
export const PROTECTED_PAY_KILL_ENV = "PAYMENTS_KILL_PROTECTED_PAY";

/** The environment stop: set to 1, it stops the rail with no database. */
export function protectedPayKilled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[PROTECTED_PAY_KILL_ENV] === "1";
}

/** Whether the protected-pay switch is on. */
export const protectedPaySwitchOn = cache(async (): Promise<boolean> => {
  if (protectedPayKilled()) return false;
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("feature_flags").select("key, enabled").in("key", [PROTECTED_PAY_FLAG]);
    if (error || !data) return false;
    return (data as { key: string; enabled: boolean }[]).find((r) => r.key === PROTECTED_PAY_FLAG)?.enabled === true;
  } catch {
    return false;
  }
});
