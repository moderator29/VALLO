"use client";

/**
 * Realtime subscriptions for the communication loops.
 *
 * Two hooks over Supabase Realtime postgres_changes: new messages in the open
 * thread, and new notifications for the signed-in user. Both are env-guarded:
 * without Supabase config they subscribe to nothing and clean up nothing, so
 * the seed experience carries zero realtime machinery. RLS applies to the
 * change feed exactly as it does to queries, so a client only ever receives
 * rows it could have selected. Delivery is best effort by design: if the
 * socket drops, the next full load renders the truth from the database.
 *
 * THE CLIENT ARRIVES AFTER THE FIRST PAINT (performance audit, 7 November
 * 2026). supabase-js is about 65 KB gzipped, and through the notification
 * banner these hooks put it in the first load of every member page (188
 * routes). Each effect now loads it at the moment it opens its channel
 * (`load-client.ts`), so the page paints first and the socket follows a
 * moment later. A channel opened after the effect was torn down is never
 * opened; one opened before is removed exactly as before.
 */

/** Open a channel once the client has loaded; the returned stop is safe to call at any time. */
export function whenLoaded(open: (supabase: BrowserClient) => () => void): () => void {
  let cancelled = false;
  let stop: (() => void) | null = null;
  void loadBrowserClient()
    .then((supabase) => {
      if (cancelled || !supabase) return;
      stop = open(supabase);
    })
    .catch(() => undefined);
  return () => {
    cancelled = true;
    stop?.();
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { Database } from "../supabase/database.types";
import { isSupabaseConfigured } from "../supabase/env";
import type { createClient } from "../supabase/client";
import { loadBrowserClient, type BrowserClient } from "../supabase/load-client";
import { ownChannelName } from "@/lib/supabase/channel-name";

export type LiveMessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type LiveNotificationRow =
  Database["public"]["Tables"]["notifications"]["Row"];

/**
 * Subscribe to message inserts in one conversation, and to updates of its
 * rows (the other side opening the thread sets `read_at`, which flips my
 * ticks). Pass null to stay inert. The callbacks are kept in refs so a new
 * render never tears the socket down.
 */
export function useThreadRealtime(
  conversationId: string | null,
  onInsert: (row: LiveMessageRow) => void,
  onUpdate?: (row: LiveMessageRow) => void
): void {
  const handler = useRef(onInsert);
  const updateHandler = useRef(onUpdate);
  useEffect(() => {
    handler.current = onInsert;
    updateHandler.current = onUpdate;
  });

  useEffect(() => {
    if (!conversationId || !isSupabaseConfigured()) return;
    return whenLoaded((supabase) => {
      const channel = supabase
        .channel(ownChannelName(`thread-${conversationId}`))
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            handler.current(payload.new as LiveMessageRow);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            updateHandler.current?.(payload.new as LiveMessageRow);
          }
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    });
  }, [conversationId]);
}

/** How long a typing signal is trusted before it decays back to quiet. */
const TYPING_TIMEOUT_MS = 3_000;
/** Floor between our own outgoing pings, so a keystroke storm sends one. */
const TYPING_PING_MS = 1_500;

/**
 * "Someone is typing", the real version: a Realtime broadcast on the thread's
 * own channel, not a postgres row and not a timer with nothing behind it.
 * `ping()` is fired as the local side drafts; the other side's pings flip
 * `typing` on and let it decay after a few quiet seconds, since a broadcast
 * has no natural "stopped" event to listen for. Inert without Supabase
 * config or a conversation id, exactly like the sibling hooks in this file,
 * so seed mode (no counterpart is ever really present) shows nothing rather
 * than a typing indicator with nobody behind it.
 */
export function useThreadTyping(
  conversationId: string | null,
  meId: string | null
): { typing: boolean; ping: () => void } {
  const [typing, setTyping] = useState(false);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  const decayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPing = useRef(0);

  useEffect(() => {
    setTyping(false);
    if (!conversationId || !isSupabaseConfigured()) return;
    return whenLoaded((supabase) => {
      const channel = supabase
        .channel(`typing-${conversationId}`, {
          config: { broadcast: { self: false } },
        })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if ((payload as { from?: string } | null)?.from === meId) return;
          setTyping(true);
          if (decayTimer.current) clearTimeout(decayTimer.current);
          decayTimer.current = setTimeout(
            () => setTyping(false),
            TYPING_TIMEOUT_MS
          );
        })
        .subscribe();
      channelRef.current = channel;
      return () => {
        if (decayTimer.current) clearTimeout(decayTimer.current);
        channelRef.current = null;
        void supabase.removeChannel(channel);
      };
    });
  }, [conversationId, meId]);

  const ping = useCallback(() => {
    const now = Date.now();
    if (now - lastPing.current < TYPING_PING_MS) return;
    lastPing.current = now;
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { from: meId },
    });
  }, [meId]);

  return { typing, ping };
}

/**
 * Subscribe to notification inserts for one user (the badge and inbox feed).
 * Pass null to stay inert.
 */
export function useNotificationsRealtime(
  userId: string | null,
  onInsert: (row: LiveNotificationRow) => void
): void {
  const handler = useRef(onInsert);
  useEffect(() => {
    handler.current = onInsert;
  });

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;
    return whenLoaded((supabase) => {
      const channel = supabase
        .channel(ownChannelName(`notifications-${userId}`))
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            handler.current(payload.new as LiveNotificationRow);
          }
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    });
  }, [userId]);
}

/**
 * "Typing…" in the inbox, for many threads at once.
 *
 * The thread view already broadcasts on `typing-<conversationId>`, so the
 * inbox listens on exactly the same channels rather than inventing a second
 * signal that could disagree with the first. One channel per row is the cost;
 * the list is bounded at fifty conversations and a Realtime channel is cheap,
 * so this is a subscription per visible row and nothing more.
 *
 * Inert without Supabase config, like every hook in this file, so seed mode
 * never shows somebody typing when there is nobody there.
 */
export function useInboxTyping(
  conversationIds: string[],
  meId: string | null
): Set<string> {
  const [typing, setTyping] = useState<Set<string>>(() => new Set());
  // The array identity changes on every render; the ids rarely do.
  const key = conversationIds.join(",");

  useEffect(() => {
    setTyping(new Set());
    const ids = key.length > 0 ? key.split(",") : [];
    if (ids.length === 0 || !isSupabaseConfigured()) return;

    return whenLoaded((supabase) => {
      const timers = new Map<string, ReturnType<typeof setTimeout>>();

      const channels = ids.map((id) =>
        supabase
          .channel(`typing-${id}`, { config: { broadcast: { self: false } } })
          .on("broadcast", { event: "typing" }, ({ payload }) => {
            if ((payload as { from?: string } | null)?.from === meId) return;
            setTyping((current) => {
              if (current.has(id)) return current;
              const next = new Set(current);
              next.add(id);
              return next;
            });
            const existing = timers.get(id);
            if (existing) clearTimeout(existing);
            timers.set(
              id,
              setTimeout(() => {
                setTyping((current) => {
                  if (!current.has(id)) return current;
                  const next = new Set(current);
                  next.delete(id);
                  return next;
                });
              }, TYPING_TIMEOUT_MS)
            );
          })
          .subscribe()
      );

      return () => {
        for (const timer of timers.values()) clearTimeout(timer);
        for (const channel of channels) void supabase.removeChannel(channel);
      };
    });
  }, [key, meId]);

  return typing;
}

/** A change on `message_reactions` as the feed delivers it (`applyReactionChange` reads it). */
export type LiveReactionChange = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: { message_id?: unknown; user_id?: unknown; emoji?: unknown } | null;
  old?: { message_id?: unknown; user_id?: unknown } | null;
};

/**
 * GRADE 1 (P1.3): every reaction added, changed or taken back in one
 * conversation, live. `conversation_id` is written onto each reaction by the
 * table's own trigger, so the feed can be filtered to this thread, and RLS
 * hands a member only the reactions they could read anyway. A database
 * listener, so its channel has a name of its own (`ownChannelName`). Pass
 * null to stay inert (seed mode, or a database without the table yet).
 */
export function useThreadReactions(
  conversationId: string | null,
  onChange: (change: LiveReactionChange) => void
): void {
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  });

  useEffect(() => {
    if (!conversationId || !isSupabaseConfigured()) return;
    return whenLoaded((supabase) => {
      const channel = supabase
        .channel(ownChannelName(`reactions-${conversationId}`))
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "message_reactions",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            handler.current({
              eventType: payload.eventType as LiveReactionChange["eventType"],
              new: (payload.new ?? null) as LiveReactionChange["new"],
              old: (payload.old ?? null) as LiveReactionChange["old"],
            });
          }
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    });
  }, [conversationId]);
}
