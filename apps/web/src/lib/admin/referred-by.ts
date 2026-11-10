import "server-only";

import { createAdminClient } from "../supabase/admin";
import { reportReadError } from "../observability/read-error";
import { requireAdmin } from "./guard";
import { isUserId } from "./member-file-rules";

/**
 * WHO REFERRED THIS PERSON, for the person file. One account has at most one
 * referrer (`referrals.referred_id` is unique). Admins only; the service
 * client is used only after the admin check, for the one row, and nothing is
 * written. A failed read answers "unavailable" (and is reported), never "no
 * referrer".
 */
export type ReferredBy =
  | { state: "none" }
  | { state: "unavailable" }
  | { state: "referred"; referrerId: string; referrerName: string | null; status: string; attributedAt: string | null };

export function shapeReferredBy(
  row: { referrer_id: string; status: string; attributed_at: string | null } | null,
  referrerName: string | null,
): ReferredBy {
  if (!row) return { state: "none" };
  return { state: "referred", referrerId: row.referrer_id, referrerName, status: row.status, attributedAt: row.attributed_at };
}

export async function readReferredBy(userId: string): Promise<ReferredBy> {
  if (!isUserId(userId)) return { state: "unavailable" };
  try {
    const access = await requireAdmin();
    if (access.state !== "admin") return { state: "unavailable" };
    const db = createAdminClient();
    const res = await db
      .from("referrals")
      .select("referrer_id, status, attributed_at")
      .eq("referred_id", userId)
      .maybeSingle();
    await reportReadError("read.admin.referred-by", res.error);
    if (res.error) return { state: "unavailable" };
    if (!res.data) return { state: "none" };
    const who = await db.from("profiles").select("display_name").eq("id", res.data.referrer_id).maybeSingle();
    await reportReadError("read.admin.referred-by-name", who.error);
    return shapeReferredBy(res.data, who.error ? null : (who.data?.display_name ?? null));
  } catch (error) {
    await reportReadError("read.admin.referred-by", error);
    return { state: "unavailable" };
  }
}
