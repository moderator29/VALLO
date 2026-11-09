import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * One page of the caller's notifications, newest first, under their own RLS
 * (`notifications_select_own`: a person reads their own rows and nobody
 * else's, admins included).
 *
 * WHY THIS AND NOT `loadNotifications` IN `lib/messages/live.ts`. That loader
 * returns `data ?? []`, so a failed read and an empty inbox were the same
 * value, and the screen told somebody whose read had failed "You are all
 * caught up". This one says which it was. It also pages: the old read stopped
 * at 100 rows with nothing on the screen saying so, and anything older was
 * unreachable.
 *
 * THE CURSOR IS (created_at, id), NOT created_at ALONE. Every row one
 * transaction writes carries the same `now()`, so two notifications for one
 * person from one statement share a timestamp, and a cursor on the timestamp
 * alone would drop whichever of them fell on the far side of a page break.
 */
/* The columns the inbox selects. `severity` exists on the table but is not read here. */
export type NotificationRow = Omit<Database["public"]["Tables"]["notifications"]["Row"], "severity">;

export const NOTIFICATION_PAGE = 50;

export type NotificationCursor = { createdAt: string; id: string };

export type NotificationPage =
  | { state: "ok"; rows: NotificationRow[]; more: boolean }
  | { state: "error" };

const COLUMNS = "id, user_id, kind, title, body, href, read_at, archived_at, created_at";

/** The PostgREST filter for "older than this row", in (created_at, id) order. */
export function olderThan(cursor: NotificationCursor): string {
  const at = JSON.stringify(cursor.createdAt);
  const id = JSON.stringify(cursor.id);
  return `created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`;
}

export async function loadNotificationPage(
  supabase: SupabaseClient<Database>,
  cursor?: NotificationCursor | null,
  size: number = NOTIFICATION_PAGE,
): Promise<NotificationPage> {
  try {
    let query = supabase
      .from("notifications")
      .select(COLUMNS)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (cursor) query = query.or(olderThan(cursor));
    /* One more than the page, so "is there more" is answered by this read
       rather than by a second one. */
    const { data, error } = await query.limit(size + 1);
    if (error || !data) return { state: "error" };
    return { state: "ok", rows: data.slice(0, size), more: data.length > size };
  } catch {
    return { state: "error" };
  }
}
