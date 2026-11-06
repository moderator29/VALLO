"use client";

/**
 * THE LIVE UNREAD-CONVERSATIONS FIGURE (recommendation B1, 30 September 2026).
 *
 * Messages lives behind the dock's More button, so the person needs to see
 * from the dock whether anybody answered. This store holds one figure: how
 * many conversations have a message addressed to the caller that is still
 * unread. It is read from `public.my_unread_counts()` (SECURITY DEFINER,
 * caller's own threads only, one row per conversation, exact from a partial
 * index) through the browser client, so the database decides what counts.
 *
 * ONE SUBSCRIPTION FOR EVERY READER. The More button, the tray row and the
 * rail row all read the same store, so a page carries one Realtime channel
 * and one read however many places draw the figure. The channel listens to
 * every change on `messages` the caller may see (RLS applies to the change
 * feed exactly as to a select): an INSERT is a new message, an UPDATE is a
 * `read_at` being set when a thread is opened. Each change schedules a
 * re-read rather than doing arithmetic on the payload, so the figure is
 * always the database's own answer. It also re-reads when the tab comes back
 * into view and when the route changes (leaving a thread you just read).
 *
 * THE CLIENT ARRIVES AFTER FIRST PAINT. This store is imported by the dock and
 * the rail, which every signed-in route carries, and a static import of the
 * browser client here put `@supabase/supabase-js` (about 65KB gzipped) in the
 * first load of all of them. The client is loaded with `import()` when the
 * first reader mounts (`start`), so the shell paints without it and the
 * subscription begins a moment later; the figure is `null` until then, which
 * is what it already was until the first read answered.
 *
 * HONEST WHEN IT CANNOT READ: the figure is `null` until the first read
 * answers, and stays at its last good value when a read fails. Nothing draws
 * a count it does not have.
 */
import { useEffect, useSyncExternalStore } from "react";
import { isSupabaseConfigured } from "../supabase/env";
import type { createClient } from "../supabase/client";
import { unreadFromRows } from "./unread";
import { ownChannelName } from "../supabase/channel-name";

type Listener = () => void;

let figure: number | null = null;
const listeners = new Set<Listener>();
let users = 0;
let teardown: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let client: ReturnType<typeof createClient> | null = null;

function emit(next: number | null) {
  if (next === figure) return;
  figure = next;
  for (const listener of listeners) listener();
}

/** Pure: the number of conversations with at least one unread message. */
export function unreadConversationCount(rows: Parameters<typeof unreadFromRows>[0]): number {
  return unreadFromRows(rows).byConversation.size;
}

async function read() {
  if (!client) return;
  try {
    /* No session on this device (a preview harness drawing a signed-in
       dock, or a session that has just ended): there is no caller to count
       for, and the function would only answer 401. The session is read from
       the device, not the network. */
    const { data: auth } = await client.auth.getSession();
    if (!auth.session) return;
    const { data, error } = await client.rpc("my_unread_counts");
    if (error || !Array.isArray(data)) return;
    emit(unreadConversationCount(data));
  } catch {
    /* Keep the last good figure. */
  }
}

/** Schedule a re-read; a burst of changes becomes one read. */
export function refreshUnreadConversations(delay = 350) {
  if (users === 0) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void read();
  }, delay);
}

function start() {
  if (!isSupabaseConfigured()) return;
  /* Released before the client chunk arrives: nothing is ever started. */
  let live = true;
  let stop: (() => void) | null = null;
  teardown = () => {
    live = false;
    stop?.();
    if (timer) clearTimeout(timer);
    timer = null;
    client = null;
  };
  void import("../supabase/client")
    .then(({ createClient: make }) => {
      if (!live) return;
      client = make();
      const supabase = client;
      void read();
      const channel = supabase
        .channel(ownChannelName("unread-conversations"))
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
          refreshUnreadConversations();
        })
        .subscribe();
      const onVisible = () => {
        if (document.visibilityState === "visible") refreshUnreadConversations(0);
      };
      document.addEventListener("visibilitychange", onVisible);
      stop = () => {
        document.removeEventListener("visibilitychange", onVisible);
        void supabase.removeChannel(channel);
      };
    })
    .catch(() => {
      /* A chunk that cannot load leaves the figure unknown, as a failed read does. */
    });
}

function acquire() {
  users += 1;
  if (users === 1) start();
}

function release() {
  users = Math.max(0, users - 1);
  if (users === 0 && teardown) {
    teardown();
    teardown = null;
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => figure;
const serverSnapshot = () => null;

/**
 * The live figure, or `null` while unknown. `enabled` is false for a guest,
 * who has no conversations and no channel. `route` re-reads on navigation.
 */
export function useUnreadConversations(enabled: boolean, route?: string): number | null {
  useEffect(() => {
    if (!enabled) return;
    acquire();
    return release;
  }, [enabled]);

  useEffect(() => {
    if (enabled && route !== undefined) refreshUnreadConversations(600);
  }, [enabled, route]);

  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return enabled ? value : null;
}

/** Tests only: drop the module state. */
export function __resetUnreadConversations() {
  figure = null;
  listeners.clear();
  users = 0;
  teardown?.();
  teardown = null;
}
