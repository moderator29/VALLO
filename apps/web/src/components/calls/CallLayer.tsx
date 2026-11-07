"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { heartbeatCall, incomingCallNow, ringDelivered } from "@/lib/calls/actions";
import { callPhase, isTerminal } from "@/lib/calls/lifecycle";
import { callIdFromParam } from "@/lib/calls/screen";
import { incomingChannelHealthy, useIncomingCalls, type CallNudge } from "@/lib/calls/useCallRealtime";
import { callState, mergeSnapshot, showCall, showGone } from "./call-store";
import { CallSurface, IncomingBannerLayer } from "./CallSurface";
import type { CallsCopy } from "./views";

/**
 * THE GLOBAL CALL LAYER, mounted once in each signed-in shell (the member
 * app, the agent workspace, the admin console), and only while the
 * `video_calls` switch is on. It does three things:
 *
 *  1. Listens for calls that reach this person (`useIncomingCalls`): a new
 *     participant row is an invitation. A nudge is never the truth, so each
 *     is resolved with `heartbeatCall`, and only a call that is ringing FOR
 *     this person opens the incoming screen, on whatever page they are on.
 *  2. Resolves a deep link's `?call=<id>` (a push tap, a notification row):
 *     ringing for me opens the incoming screen; live and mine offers Rejoin;
 *     finished shows the plain missed or ended screen with call back; an
 *     unknown, expired or not-mine id shows the same calm "no longer
 *     available" screen, never a 404 that would confirm it exists. The
 *     parameter is then taken out of the address, so a reload does not
 *     replay it.
 *  3. Draws the surface.
 *
 * Nothing here loads the media SDK: that waits for a call to need it.
 */
export function CallLayer({ userId, copy }: { userId: string; copy: CallsCopy }) {
  useIncomingCalls(userId, (nudge) => void resolveNudge(nudge));
  useIncomingCallPoll();
  return (
    <>
      <Suspense fallback={null}>
        <DeepLinkWatcher />
      </Suspense>
      <IncomingBannerLayer copy={copy} />
      <CallSurface copy={copy} />
    </>
  );
}

/**
 * THE FALLBACK FOR A MISSED RING (29 October 2026). The realtime channel is the
 * fast path; this asks the server directly every few seconds while the page is
 * visible (every 3 s when the channel is not confirmed live, every 5 s when it
 * is: "subscribed" is not proof that events arrive, so a ring is never more
 * than a few seconds from being found), and at once when the page comes back to the front or
 * the network returns. It only looks while no call is on screen, and what it
 * finds goes through the same `resolveNudge` the realtime message uses, so the
 * heartbeat still decides whether the call is really ringing.
 */
function useIncomingCallPoll(): void {
  useEffect(() => {
    let stopped = false;
    let timer = 0;
    const tick = async () => {
      window.clearTimeout(timer);
      if (stopped) return;
      if (document.visibilityState === "visible" && navigator.onLine !== false) {
        const active = callState().active;
        if (!active || isTerminal(active.snapshot.state)) {
          const found = await incomingCallNow().catch(() => null);
          if (!stopped && found?.ok && found.data) void resolveNudge({ callId: found.data.callId, state: null, version: null });
        }
      }
      if (!stopped) timer = window.setTimeout(() => void tick(), incomingChannelHealthy() ? 5_000 : 3_000);
    };
    const kick = () => void tick();
    timer = window.setTimeout(() => void tick(), 1_500);
    document.addEventListener("visibilitychange", kick);
    window.addEventListener("focus", kick);
    window.addEventListener("online", kick);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", kick);
      window.removeEventListener("focus", kick);
      window.removeEventListener("online", kick);
    };
  }, []);
}

/** Tell the server this ring is on screen, once per call, so the caller sees "Ringing". */
const acknowledged = new Set<string>();
function ackRing(callId: string): void {
  if (acknowledged.has(callId)) return;
  acknowledged.add(callId);
  void ringDelivered({ callId }).catch(() => acknowledged.delete(callId));
}

async function resolveNudge(nudge: CallNudge): Promise<void> {
  const current = callState().active;
  if (current && current.snapshot.id !== nudge.callId && !current.recovery && !isTerminal(current.snapshot.state)) {
    /* Already on a call: the database answers the new one BUSY by itself. */
    return;
  }
  const answer = await heartbeatCall({ callId: nudge.callId }).catch(() => null);
  if (!answer?.ok) return;
  if (current && current.snapshot.id === nudge.callId) {
    mergeSnapshot(answer.data);
    return;
  }
  if (callPhase(answer.data.state, answer.data.role) === "incoming" && showCall(answer.data)) ackRing(answer.data.id);
}

/** Exported for the e2e harness and the tests; the watcher calls it. */
export async function resolveDeepLink(callId: string | null): Promise<void> {
  if (!callId) {
    showGone();
    return;
  }
  const answer = await heartbeatCall({ callId }).catch(() => null);
  if (!answer?.ok) {
    showGone();
    return;
  }
  const s = answer.data;
  const phase = callPhase(s.state, s.role);
  if (phase === "incoming") {
    if (showCall(s)) ackRing(s.id);
  } else if (phase === "ended") showCall(s, { recovery: "ended" });
  else showCall(s, { resume: true });
}

function DeepLinkWatcher() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("call");
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (raw === null || handled.current === raw) return;
    handled.current = raw;
    const next = new URLSearchParams(params.toString());
    next.delete("call");
    const rest = next.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
    void resolveDeepLink(callIdFromParam(raw));
  }, [raw, params, pathname, router]);
  return null;
}
