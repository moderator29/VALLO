"use client";

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { acceptCall, declineCall } from "@/lib/calls/actions";
import { callPhase, durationWords, endReasonWords } from "@/lib/calls/lifecycle";
import { returnHref, ringSecondsLeft } from "@/lib/calls/screen";
import type { CallKind } from "@/lib/calls/types";
import { dismissCall, markLocallyOver, mergeSnapshot, setAnsweredWith, setCallNotice, useCallStore, type ActiveCall } from "./call-store";
import { placeCall } from "./place-call";
import { startRing } from "./ring";
import { useCallPulse, useServerClock } from "./use-call-pulse";
import { EndedView, IncomingCallView, OutgoingView, RecoveryView, type CallsCopy } from "./views";

/**
 * THE CALL SURFACE: the one full-screen layer that draws whatever call the
 * store holds, on any page of the signed-in shell.
 *
 *   incoming (not answered yet)   IncomingCallScreen   light, in this chunk
 *   ended                         EndedScreen          light, in this chunk
 *   anything else                 CallStage            LAZY: its chunk, and the
 *                                                       media SDK behind it, load
 *                                                       only when a call needs them
 *
 * An incoming screen warms the stage chunk while it rings, so Accept does
 * not wait on a download.
 */

const loadStage = () => import("./CallStage");
const CallStage = lazy(loadStage);

export function CallSurface({ copy }: { copy: CallsCopy }) {
  const { active, gone } = useCallStore();
  if (gone) return <GoneScreen copy={copy} />;
  if (!active) return null;
  if (active.recovery) return <RecoveryScreen active={active} copy={copy} />;
  const phase = callPhase(active.snapshot.state, active.snapshot.role);
  if (phase === "ended") return <EndedScreen active={active} copy={copy} />;
  if (phase === "incoming" && !active.answeredWith) return <IncomingCallScreen active={active} copy={copy} />;
  return (
    <Suspense
      fallback={
        <OutgoingView
          copy={copy}
          name={active.snapshot.otherName ?? ""}
          photo={active.snapshot.otherAvatarUrl ?? null}
          kind={active.snapshot.kind}
          context={active.context.line}
          status={copy.connecting.title}
          onCancel={() => undefined}
          busy
        />
      }
    >
      <CallStage active={active} copy={copy} />
    </Suspense>
  );
}

export function IncomingCallScreen({ active, copy }: { active: ActiveCall; copy: CallsCopy }) {
  const s = active.snapshot;
  const beat = useCallPulse(s.id);
  const now = useServerClock(s, active.offsetMs, beat);
  const [busy, setBusy] = useState(false);
  const error = active.notice;

  useEffect(() => startRing(), []);
  useEffect(() => {
    void loadStage().catch(() => undefined);
  }, []);

  /* INSTANT (29 October 2026, the founder: "less than half a second"). The
     screen changes on the tap itself: the answer goes to the server in the
     background while the stage already opens the microphone and shows
     "Connecting". If the server refuses, the incoming screen comes back with
     the reason. */
  const accept = useCallback(
    (as: CallKind) => {
      setCallNotice(null);
      setAnsweredWith(as);
      void acceptCall({ callId: s.id })
        .catch(() => null)
        .then((answer) => {
          if (answer?.ok) {
            mergeSnapshot(answer.data);
            return;
          }
          setAnsweredWith(null);
          setCallNotice(answer ? answer.error : copy.connecting.body);
          void beat();
        });
    },
    [s.id, beat, copy.connecting.body],
  );

  const decline = useCallback(() => {
    setBusy(true);
    markLocallyOver(s.id);
    dismissCall();
    void declineCall({ callId: s.id }).catch(() => null);
  }, [s.id]);

  return (
    <IncomingCallView
      copy={copy}
      name={s.otherName ?? ""}
      photo={s.otherAvatarUrl ?? null}
      kind={s.kind}
      review={s.purpose === "ADMIN_REVIEW"}
      context={active.context.line}
      secondsLeft={ringSecondsLeft(s, now)}
      busy={busy}
      error={error}
      onAccept={(as) => accept(as)}
      onDecline={() => decline()}
    />
  );
}

export function EndedScreen({ active, copy }: { active: ActiveCall; copy: CallsCopy }) {
  const router = useRouter();
  const pathname = usePathname();
  const s = active.snapshot;
  const href = returnHref(s, pathname);
  const missed = !s.isInitiator && (s.state === "MISSED" || s.state === "CANCELLED" || s.state === "BUSY");
  const back = () => {
    dismissCall();
    if (pathname !== href) router.push(href);
  };
  const callBack =
    s.purpose === "CONVERSATION" && s.conversationId
      ? () => {
          dismissCall();
          void placeCall({ conversationId: s.conversationId!, kind: s.kind, context: active.context });
        }
      : undefined;
  return (
    <EndedView
      copy={copy}
      name={s.otherName ?? ""}
      photo={s.otherAvatarUrl ?? null}
      kind={s.kind}
      words={endReasonWords(s)}
      duration={s.state === "ENDED" && s.connectedAt ? durationWords(s.durationSeconds) : ""}
      missed={missed}
      backLabel={s.reviewId ? copy.ended.backReview : copy.ended.back}
      onBack={back}
      onCallBack={callBack}
      onClose={() => dismissCall()}
    />
  );
}

function RecoveryScreen({ active, copy }: { active: ActiveCall; copy: CallsCopy }) {
  const router = useRouter();
  const pathname = usePathname();
  const s = active.snapshot;
  const missed = !s.isInitiator && (s.state === "MISSED" || s.state === "CANCELLED" || s.state === "BUSY");
  const href = returnHref(s, pathname);
  return (
    <RecoveryView
      copy={copy}
      name={s.otherName ?? undefined}
      photo={s.otherAvatarUrl ?? null}
      title={missed ? copy.recovery.missedTitle : copy.recovery.endedTitle}
      body={endReasonWords(s)}
      primaryLabel={s.reviewId ? copy.ended.backReview : copy.ended.back}
      onPrimary={() => {
        dismissCall();
        if (pathname !== href) router.push(href);
      }}
      onCallBack={
        s.purpose === "CONVERSATION" && s.conversationId
          ? () => {
              dismissCall();
              void placeCall({ conversationId: s.conversationId!, kind: s.kind });
            }
          : undefined
      }
      onClose={() => dismissCall()}
    />
  );
}

function GoneScreen({ copy }: { copy: CallsCopy }) {
  const router = useRouter();
  const pathname = usePathname();
  const messages = pathname.startsWith("/agent/") ? "/agent/messages" : "/messages";
  return (
    <RecoveryView
      copy={copy}
      title={copy.recovery.goneTitle}
      body={copy.recovery.goneBody}
      primaryLabel={copy.recovery.openMessages}
      onPrimary={() => {
        dismissCall();
        if (pathname !== messages) router.push(messages);
      }}
      onClose={() => dismissCall()}
    />
  );
}
