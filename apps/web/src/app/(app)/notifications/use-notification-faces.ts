"use client";

import { useEffect, useState } from "react";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { faceLookup } from "@/components/app/notify/banner-model";
import type { NotificationItem } from "@/lib/notify/links";

/**
 * Batch-resolve faces (avatars) for notification rows.
 *
 * For each row whose `href` points at a conversation or a profile, this hook
 * resolves the other person's avatar from the database, limited to the first
 * `limit` rows (the visible ones). The result is a Map from notification id
 * to avatar path.
 *
 * The lookup is the same `faceLookup` the banner uses, so the Activity Centre
 * and the banner show the same person for the same notification.
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
    const lookups = rows
      .slice(0, limit)
      .map((n) => ({ id: n.id, look: faceLookup(n.href) }))
      .filter((x) => x.look !== null);

    if (lookups.length === 0) return;

    void (async () => {
      try {
        const db = await loadBrowserClient();
        if (!db || !live) return;

        /* Collect all thread ids and handles to batch the queries. */
        const threadIds: string[] = [];
        const handles: string[] = [];
        for (const { look } of lookups) {
          if (look!.by === "thread") threadIds.push(look!.id);
          else if (look!.by === "user") continue;
          else handles.push(look!.handle);
        }

        /* Batch: resolve thread -> other person's user_id. */
        const personMap = new Map<string, string>();
        if (threadIds.length > 0) {
          const { data } = await db
            .from("conversations")
            .select("id, guest_id, agent_id")
            .in("id", threadIds);
          if (data) {
            for (const c of data) {
              const other = c.guest_id === userId ? c.agent_id : c.guest_id;
              if (other) personMap.set(c.id, other);
            }
          }
        }

        /* Collect all user_ids and handles, then batch-load avatars. A link
           that names its sender (`?from=`) is already a user id. */
        const named = lookups.flatMap(({ look }) => (look!.by === "user" ? [look!.id] : []));
        const userIds = [...new Set([...personMap.values(), ...named])];
        const result = new Map<string, string>();

        if (userIds.length > 0) {
          const { data } = await db
            .from("social_profiles")
            .select("user_id, avatar_path")
            .in("user_id", userIds);
          if (data) {
            const byUserId = new Map(data.filter((p) => p.avatar_path).map((p) => [p.user_id, p.avatar_path!]));
            for (const { id, look } of lookups) {
              if (look!.by === "thread") {
                const uid = personMap.get(look!.id);
                if (uid && byUserId.has(uid)) result.set(id, byUserId.get(uid)!);
              } else if (look!.by === "user" && byUserId.has(look!.id)) {
                result.set(id, byUserId.get(look!.id)!);
              }
            }
          }
        }

        if (handles.length > 0) {
          const { data } = await db
            .from("social_profiles")
            .select("handle, avatar_path")
            .in("handle", handles);
          if (data) {
            const byHandle = new Map(data.filter((p) => p.avatar_path).map((p) => [p.handle, p.avatar_path!]));
            for (const { id, look } of lookups) {
              if (look!.by === "handle" && byHandle.has(look!.handle)) {
                result.set(id, byHandle.get(look!.handle)!);
              }
            }
          }
        }

        if (live) setFaces(result);
      } catch {
        /* No faces is fine: the family glyphs stay. */
      }
    })();

    return () => { live = false; };
  }, [rows, userId, limit]);

  return faces;
}
