"use client";

import { useEffect, useState } from "react";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { NotificationItem } from "@/lib/notify/links";

import { assignFaces, planFaces } from "./faces-plan";

/**
 * Batch-resolve faces (avatars) for notification rows.
 *
 * For each row whose `href` points at a conversation or a profile, or names
 * its sender with `?from=<user id>`, this hook resolves that person's avatar
 * from the database, limited to the first `limit` rows (the visible ones).
 * The result is a Map from notification id to avatar path.
 *
 * The lookup is the same `faceLookup` the banner uses (`faces-plan.ts`), so
 * the Activity Centre and the banner show the same person for the same
 * notification.
 */
export function useNotificationFaces(
  rows: readonly NotificationItem[],
  userId: string | null,
  limit = 20,
): Map<string, string> {
  const [faces, setFaces] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!userId || !isSupabaseConfigured() || rows.length === 0) return;
    let live = true;
    const plan = planFaces(rows, limit);
    if (plan.lookups.length === 0) return;

    void (async () => {
      try {
        const db = await loadBrowserClient();
        if (!db || !live) return;

        /* Batch: resolve thread -> other person's user_id. */
        const threadPerson = new Map<string, string>();
        if (plan.threadIds.length > 0) {
          const { data } = await db
            .from("conversations")
            .select("id, guest_id, agent_id")
            .in("id", plan.threadIds);
          for (const c of data ?? []) {
            const other = c.guest_id === userId ? c.agent_id : c.guest_id;
            if (other) threadPerson.set(c.id, other);
          }
        }

        /* Batch-load avatars by user id (thread people and named senders) and by handle. */
        const userIds = [...new Set([...threadPerson.values(), ...plan.userIds])];
        const byUser = new Map<string, string>();
        if (userIds.length > 0) {
          const { data } = await db
            .from("social_profiles")
            .select("user_id, avatar_path")
            .in("user_id", userIds);
          for (const p of data ?? []) if (p.avatar_path) byUser.set(p.user_id, p.avatar_path);
        }
        const byHandle = new Map<string, string>();
        if (plan.handles.length > 0) {
          const { data } = await db
            .from("social_profiles")
            .select("handle, avatar_path")
            .in("handle", plan.handles);
          for (const p of data ?? []) if (p.avatar_path && p.handle) byHandle.set(p.handle, p.avatar_path);
        }

        if (live) setFaces(assignFaces(plan, threadPerson, byUser, byHandle));
      } catch {
        /* No faces is fine: the family glyphs stay. */
      }
    })();

    return () => { live = false; };
  }, [rows, userId, limit]);

  return faces;
}
