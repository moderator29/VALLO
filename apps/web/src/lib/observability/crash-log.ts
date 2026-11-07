import "server-only";

import { createAdminClient } from "../supabase/admin";
import { isSupabaseConfigured } from "../supabase/env";
import { crashFingerprint, stackTop, type CrashSource } from "./crash-fingerprint";
import { scrubError } from "./scrub";

/**
 * WRITE ONE CRASH TO VALLO'S OWN CRASH LOG (`public.crash_reports` through
 * `public.record_crash`; founder ruling of 7 November 2026). Read on the
 * admin desk at /admin/crashes.
 *
 * The error is scrubbed here, whatever the caller already did, so nothing
 * that names a person reaches the table. Never throws, never reports its own
 * failure through `reportError` (that would be a loop): it answers false and
 * the caller keeps its older fallback (the alert) for that one report.
 */
export async function recordCrash(input: {
  error: unknown;
  source: CrashSource;
  kind: string;
  area?: string | null;
  release?: string | null;
  ref?: string | null;
}): Promise<boolean> {
  if (!isSupabaseConfigured() || (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length === 0) return false;
  try {
    const clean = scrubError(input.error);
    const kind = input.kind.slice(0, 80) || "error";
    const area = input.area ? input.area.slice(0, 80) : null;
    const admin = createAdminClient();
    const { error } = await admin.rpc("record_crash" as never, {
      p_fingerprint: crashFingerprint({ source: input.source, kind, type: clean.type, message: clean.value, area }),
      p_source: input.source,
      p_kind: kind,
      p_type: clean.type,
      p_message: clean.value.slice(0, 600),
      p_stack_top: stackTop(clean.stack),
      p_area: area,
      p_release: input.release ? input.release.slice(0, 60) : null,
      p_ref: input.ref ? input.ref.slice(0, 80) : null,
    } as never);
    return !error;
  } catch {
    return false;
  }
}
