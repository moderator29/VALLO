"use client";

import { useEffect, useRef } from "react";
import { isSupabaseConfigured } from "../supabase/env";
import { loadBrowserClient, type BrowserClient } from "../supabase/load-client";
import type { CallState } from "./types";

/**
 * REALTIME FOR CALLS, the two subscriptions the call screens need. The
 * database publishes `public.calls` and `public.call_participants` (VC1), and
 * Supabase Realtime applies their RLS per subscriber, so a person only ever
 * hears about calls they are on.
 *
 * A change is a NUDGE, not the truth: the row a change carries has no role,
 * no other person's name and no server clock. On every nudge the screen asks
 * `heartbeatCall` for the authoritative snapshot and keeps it with
 * `newerSnapshot` (higher version wins, a finished call never comes back to
 * life). If realtime drops, the heartbeat every `HEARTBEAT_SECONDS` still
 * carries the state, so a stale screen corrects itself within seconds.
 *
 * THE CLIENT IS LOADED, NOT IMPORTED (speed pass, 8 October 2026). The
 * incoming-calls listener is mounted in the signed-in shell, so a static
 * import of `../supabase/client` put supabase-js (about 66 KB gzipped) in the
 * first load of EVERY in-app route, before a single call was ever placed.
 * `loadBrowserClient` fetches it after the shell has painted; a call cannot
 * ring sooner than the channel is open either way.
 */

type Channel = ReturnType<BrowserClient["channel"]>;

/**
 * Open one channel once the client has loaded, and close it on cleanup even
 * when the cleanup comes first. Returns the cleanup.
 */
function openChannel(build: (supabase: BrowserClient) => Channel): () => void {
  let closed = false;
  let opened: { supabase: BrowserClient; channel: Channel } | null = null;
  void loadBrowserClient()
    .then((supabase) => {
      if (closed || !supabase) return;
      opened = { supabase, channel: build(supabase) };
    })
    .catch(() => {
      /* No client (offline, missing env): the heartbeat still carries the state. */
    });
  return () => {
    closed = true;
    if (opened) void opened.supabase.removeChannel(opened.channel);
  };
}

export type CallNudge = { callId: string; state: CallState | null; version: number | null };

function nudgeFrom(row: unknown, idKey: "id" | "call_id"): CallNudge | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = r[idKey];
  if (typeof id !== "string") return null;
  return {
    callId: id,
    state: typeof r.state === "string" && idKey === "id" ? (r.state as CallState) : null,
    version: typeof r.version === "number" ? r.version : null,
  };
}

/** One call's state changes, while its screen is open. */
export function useCallUpdates(callId: string | null, onNudge: (nudge: CallNudge) => void): void {
  const handler = useRef(onNudge);
  useEffect(() => {
    handler.current = onNudge;
  });
  useEffect(() => {
    if (!callId || !isSupabaseConfigured()) return;
    return openChannel((supabase) =>
      supabase
        .channel(`call-${callId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
          (payload) => {
            const nudge = nudgeFrom(payload.new, "id");
            if (nudge) handler.current(nudge);
          },
        )
        .subscribe(),
    );
  }, [callId]);
}

/**
 * Calls that reach this person: a new participant row is an invitation (a
 * ringing call, or a review call), an update is an answer elsewhere (the same
 * person answering on another device). Mount once in the signed-in shell.
 */
/** Whether the incoming-call channel is confirmed live right now (read by the fallback poll). */
let incomingChannelLive = false;
export function incomingChannelHealthy(): boolean {
  return incomingChannelLive;
}

export function useIncomingCalls(userId: string | null, onNudge: (nudge: CallNudge) => void): void {
  const handler = useRef(onNudge);
  useEffect(() => {
    handler.current = onNudge;
  });
  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;
    let closed = false;
    let retry = 0;
    let timer: number | null = null;
    let opened: { supabase: BrowserClient; channel: Channel } | null = null;

    /* The channel is opened again when it errors, times out or closes under
       us (a phone's socket drops when the page sleeps), with a growing pause,
       instead of staying dead until the next page load. A missed message while
       it was down is found by the fallback poll (`incomingCallNow`). */
    const open = () => {
      void loadBrowserClient()
        .then((supabase) => {
          if (closed || !supabase) return;
          const channel = supabase
            .channel(`call-invites-${userId}-${Date.now()}`)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "call_participants", filter: `user_id=eq.${userId}` },
              (payload) => {
                const nudge = nudgeFrom(payload.new, "call_id");
                if (nudge) handler.current(nudge);
              },
            )
            .subscribe((status) => {
              if (status === "SUBSCRIBED") {
                retry = 0;
                incomingChannelLive = true;
                return;
              }
              if (closed) return;
              if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                incomingChannelLive = false;
                void supabase.removeChannel(channel);
                if (timer !== null) window.clearTimeout(timer);
                timer = window.setTimeout(open, Math.min(30_000, 1_000 * 2 ** retry++));
              }
            });
          opened = { supabase, channel };
        })
        .catch(() => {
          if (!closed) timer = window.setTimeout(open, 5_000);
        });
    };
    open();
    return () => {
      closed = true;
      incomingChannelLive = false;
      if (timer !== null) window.clearTimeout(timer);
      if (opened) void opened.supabase.removeChannel(opened.channel);
    };
  }, [userId]);
}
