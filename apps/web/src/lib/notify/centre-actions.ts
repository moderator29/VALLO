"use server";

/**
 * Activity Centre actions: archive, bulk archive, category counts.
 *
 * Mark-read lives in `lib/messages/notifications-actions.ts` (single + bulk).
 * Pagination lives in `lib/notify/inbox-actions.ts`.
 * This file adds the archive half and the category badge query.
 *
 * Every write runs under the caller's own RLS client, so the update policy
 * is owner-only: a caller can only archive their own rows.
 */

import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import {
  NOT_CONFIGURED_MESSAGE,
  SIGNED_OUT_MESSAGE,
  resolveSession,
} from "../actions/session";
import type { Database } from "../supabase/database.types";

type NotificationKind = Database["public"]["Enums"]["notification_kind"];

const archiveSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
});

const unarchiveSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
});

/**
 * Archive one or more notifications by id. Only the caller's own unarchived
 * rows are touched (RLS + explicit user_id filter).
 */
export async function archiveNotifications(
  input: unknown,
): Promise<ActionResult<{ archived: number }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = validate(archiveSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { data, error } = await session.supabase
    .from("notifications")
    .update({ archived_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .is("archived_at", null)
    .in("id", parsed.data.ids)
    .select("id");

  if (error) {
    return fail("Archiving is unavailable just now. Please try again shortly.");
  }

  return ok({ archived: data?.length ?? 0 });
}

/**
 * Archive every notification the caller has. The "Archive all" button.
 * No ids needed: it sweeps the caller's entire unarchived inbox.
 */
export async function archiveAllNotifications(): Promise<
  ActionResult<{ archived: number }>
> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const { data, error } = await session.supabase
    .from("notifications")
    .update({ archived_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .is("archived_at", null)
    .select("id");

  if (error) {
    return fail("Archiving is unavailable just now. Please try again shortly.");
  }

  return ok({ archived: data?.length ?? 0 });
}

/**
 * Undo an archive: move notifications back into the inbox.
 */
export async function unarchiveNotifications(
  input: unknown,
): Promise<ActionResult<{ restored: number }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = validate(unarchiveSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { data, error } = await session.supabase
    .from("notifications")
    .update({ archived_at: null })
    .eq("user_id", session.user.id)
    .not("archived_at", "is", null)
    .in("id", parsed.data.ids)
    .select("id");

  if (error) {
    return fail(
      "Restoring notifications is unavailable just now. Please try again shortly.",
    );
  }

  return ok({ restored: data?.length ?? 0 });
}

/** One row of the category summary: kind, total, and unread count. */
export type CategoryCount = {
  kind: NotificationKind;
  total: number;
  unread: number;
};

/**
 * Category counts for the Activity Centre tab badges. Returns one row per
 * notification kind that has at least one non-archived notification, with
 * the total and unread count for each.
 *
 * Uses a single query with a group-by so the round trip is one read.
 */
export async function getNotificationCounts(): Promise<
  ActionResult<{ categories: CategoryCount[]; totalUnread: number }>
> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const { data, error } = await session.supabase.rpc(
    "notification_category_counts",
  );

  if (error) {
    return fail(
      "Notification counts could not be loaded just now. Please try again shortly.",
    );
  }

  const categories: CategoryCount[] = (data ?? []).map(
    (row: { kind: NotificationKind; total: number; unread: number }) => ({
      kind: row.kind,
      total: row.total,
      unread: row.unread,
    }),
  );

  const totalUnread = categories.reduce((sum, c) => sum + c.unread, 0);

  return ok({ categories, totalUnread });
}
