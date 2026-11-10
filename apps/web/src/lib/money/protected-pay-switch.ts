import "server-only";

import { cache } from "react";
import { isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";

/**
 * THE PROTECTED-PAY SWITCH: the founder's one switch for offering the
 * protected payment rail to members. It FAILS CLOSED: a missing flag, a
 * failed read or a kill switch all mean off.
 *
 * Compatibility, until the next deploy settings change and the pending SQL
 * `provider_removal_2026-11-10.sql` has run: the flag is read under its new
 * key first and, only when the new row does not exist, under the old key the
 * live database still holds. The environment stop likewise accepts the new
 * name and the old one. The two lines marked `legacy-name` are the ONLY places the retired
 * provider's name remains in the source; the guard test allows exactly those.
 */
export const PROTECTED_PAY_FLAG = "payments_protected_pay_on";
export const LEGACY_PROTECTED_PAY_FLAG = "payments_payluk_on"; // legacy-name: old live flag key, read for compatibility only
export const PROTECTED_PAY_KILL_ENV = "PAYMENTS_KILL_PROTECTED_PAY";
export const LEGACY_PROTECTED_PAY_KILL_ENV = "PAYMENTS_KILL_PAYLUK"; // legacy-name: old deploy setting, read for compatibility only

/** The environment stop: either name set to 1 stops the rail with no database. */
export function protectedPayKilled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env[PROTECTED_PAY_KILL_ENV] === "1" || env[LEGACY_PROTECTED_PAY_KILL_ENV] === "1";
}

/** Whether the protected-pay switch is on. New key first, old key only when the new row is absent. */
export const protectedPaySwitchOn = cache(async (): Promise<boolean> => {
  if (protectedPayKilled()) return false;
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("feature_flags")
      .select("key, enabled")
      .in("key", [PROTECTED_PAY_FLAG, LEGACY_PROTECTED_PAY_FLAG]);
    if (error || !data) return false;
    const rows = data as { key: string; enabled: boolean }[];
    const current = rows.find((r) => r.key === PROTECTED_PAY_FLAG);
    if (current) return current.enabled === true;
    return rows.find((r) => r.key === LEGACY_PROTECTED_PAY_FLAG)?.enabled === true;
  } catch {
    return false;
  }
});
