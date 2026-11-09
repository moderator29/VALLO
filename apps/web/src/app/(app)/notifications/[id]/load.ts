import { reportReadError } from "@/lib/observability/read-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { NotificationRow } from "@/lib/notify/inbox";
import { objectKeyOf } from "../family";
import { reportError } from "@/lib/observability/report";

/**
 * ONE NOTIFICATION AND WHAT CAME BEFORE IT ON THE SAME RECORD.
 *
 * Both reads run under the caller's own RLS (`notifications_select_own`: a
 * person reads their own rows and nobody else's, admins included), so a link
 * to somebody else's notification resolves to "missing", which is the truth
 * from this reader's side and leaks nothing about whether the row exists.
 *
 * THE TIMELINE IS THE REAL ROWS, NOT A RECONSTRUCTION. It is every one of this
 * person's notifications whose link names the same record (same path, query
 * ignored), oldest first, bounded. A notification with no record link (a
 * general page such as /settings) has no timeline, and says so. When the table
 * gains an object id (request W5-2) this becomes an equality on that column.
 */
const COLUMNS = "id, user_id, kind, title, body, href, read_at, archived_at, created_at";
export const TIMELINE_LIMIT = 30;

export type NotificationView =
  | { state: "ok"; row: NotificationRow; before: NotificationRow[]; after: NotificationRow[] }
  | { state: "missing" }
  | { state: "error" };

export async function loadNotificationView(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<NotificationView> {
  try {
    const { data: row, error } = await supabase.from("notifications").select(COLUMNS).eq("id", id).maybeSingle();
    await reportReadError("read.notifications.loadNotificationView", error);
    if (error) return { state: "error" };
    if (!row) return { state: "missing" };

    const key = objectKeyOf(row.href);
    if (!key) return { state: "ok", row, before: [], after: [] };

    /* Same record: the stored link is the path, optionally with a query. */
    const { data: rows, error: timelineError } = await supabase
      .from("notifications")
      .select(COLUMNS)
      .or(`href.eq.${JSON.stringify(key)},href.like.${JSON.stringify(`${key}?*`)}`)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(TIMELINE_LIMIT);
    /* The timeline is a courtesy: a failed read of it never hides the notice. */
    await reportReadError("read.notifications.loadNotificationView", timelineError);
    if (timelineError || !rows) return { state: "ok", row, before: [], after: [] };

    const mine = rows.findIndex((r) => r.id === row.id);
    const at = mine === -1 ? rows.length : mine;
    return {
      state: "ok",
      row,
      before: rows.slice(0, at),
      after: rows.slice(mine === -1 ? rows.length : mine + 1),
    };
  } catch (error) {
    /* A throw here is schema drift or a policy refusing, not "no notice":
       report it so it is visible, then show the error state (D49.3). */
    await reportError({ error, context: { kind: "read.notification_view" } });
    return { state: "error" };
  }
}
