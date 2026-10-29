"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { endCall, getJoinCredentials } from "@/lib/calls/actions";
import { callPhase, hangUpIntent, mayJoin } from "@/lib/calls/lifecycle";
import { looksNative, nativePlatform } from "@/lib/native/platform";
import {
  clockWords,
  endNeedsConfirm,
  mediaErrorKind,
  mediaPlatform,
  returnHref,
  talkSeconds,
  type MediaErrorKind,
} from "@/lib/calls/screen";
import type { CallKind } from "@/lib/calls/types";
import { confirmResume, dismissCall, mergeSnapshot, type ActiveCall } from "./call-store";
import { useCallPulse, useServerClock } from "./use-call-pulse";
import { ConfirmEnd, InCallView, OutgoingView, PermissionView, type CallBanner, type CallsCopy } from "./views";
import { Button } from "@/components/ui/Button";
import { callLog, errorSummary } from "@/lib/calls/diagnostics";
import { EMPTY_MEDIA, type CallMedia, type MediaSnapshot } from "./media/types";

/**
 * THE CALL STAGE: outgoing, connecting, in call and reconnecting, for both
 * people and for a staff review call. A lazy chunk (`CallSurface`), and the
 * media SDK is a second `import()` inside it, after the tap.
 *
 * The server is the truth for the call; the media room is the truth for the
 * pictures. This component holds the two side by side:
 *
 *   the pulse   `heartbeatCall` every 10 s and on every nudge and media event,
 *               merged into the store (`newerSnapshot`)
 *   the media   join when `mayJoin` says so (the caller from RINGING, the
 *               callee after answering), with credentials kept in this
 *               closure only, and a full rejoin with NEW credentials when the
 *               room drops for good while the server still says the call is on
 *   the clock   the server's (`serverNow` offset), never the device's
 *
 * When the call reaches a terminal state the surface swaps this out for the
 * ended screen, and unmounting here stops every track. `pagehide` does the
 * same, and in the iOS shell going to the background pauses the camera
 * (WKWebView stops capture anyway) and offers it back on return.
 */

type Stage =
  | { kind: "waiting" }
  | { kind: "asking" }
  | { kind: "denied"; error: MediaErrorKind; wantedVideo: boolean; detail: string }
  | { kind: "joining" }
  | { kind: "joined" }
  | { kind: "failed"; error: string };

const MAX_REJOINS = 3;

export default function CallStage({ active, copy }: { active: ActiveCall; copy: CallsCopy }) {
  const router = useRouter();
  const pathname = usePathname();
  const snapshot = active.snapshot;
  const callId = snapshot.id;
  const beat = useCallPulse(callId);
  const now = useServerClock(snapshot, active.offsetMs, beat);
  const phase = callPhase(snapshot.state, snapshot.role);

  const [stage, setStage] = useState<Stage>({ kind: "waiting" });
  const [media, setMedia] = useState<MediaSnapshot>(EMPTY_MEDIA);
  const [ending, setEnding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cameraPaused, setCameraPaused] = useState(false);
  const mediaRef = useRef<CallMedia | null>(null);
  const rejoins = useRef(0);
  const joiningRef = useRef(false);
  /* The video elements the views drew; attached again once the session exists. */
  const remoteEl = useRef<HTMLVideoElement | null>(null);
  const localEl = useRef<HTMLVideoElement | null>(null);

  /* What to publish: a video call answered or placed with video publishes the
     camera; "accept with voice" or a voice call publishes the microphone only. */
  const voiceOnlyRef = useRef(active.answeredWith === "AUDIO");

  const join = useCallback(async () => {
    if (joiningRef.current || mediaRef.current) return;
    joiningRef.current = true;
    const video = snapshot.kind === "VIDEO" && !voiceOnlyRef.current;
    setStage({ kind: "asking" });
    callLog("join.start", video ? "video" : "voice");
    try {
      const lib = await import("./media/session");
      let local;
      try {
        local = await lib.captureLocal(video);
        callLog("join.captured", local.map((t) => t.kind).join("+"));
      } catch (error) {
        callLog("join.capture_failed", errorSummary(error));
        setStage({ kind: "denied", error: mediaErrorKind(error), wantedVideo: video, detail: errorSummary(error) });
        return;
      }
      setStage({ kind: "joining" });
      const creds = await getJoinCredentials({ callId });
      if (!creds.ok) {
        callLog("join.token_refused", creds.error.slice(0, 80));
        for (const t of local) t.stop();
        setStage({ kind: "failed", error: creds.error });
        void beat();
        return;
      }
      const session = lib.createCallMedia(local, (next) => setMedia(next));
      mediaRef.current = session;
      callLog("join.token_ok");
      await session.connect(creds.data);
      session.attachLocalVideo(localEl.current);
      session.attachRemoteVideo(remoteEl.current);
      setStage({ kind: "joined" });
      void beat();
    } catch (error) {
      callLog("join.connect_failed", errorSummary(error));
      setStage({ kind: "failed", error: copy.connecting.body });
      const m = mediaRef.current;
      mediaRef.current = null;
      await m?.close();
      void beat();
    } finally {
      joiningRef.current = false;
    }
  }, [callId, snapshot.kind, beat, copy.connecting.body]);

  /* Join as soon as the server allows it and the person has tapped. */
  const allowed = mayJoin(snapshot.state, snapshot.role, snapshot.myState);
  useEffect(() => {
    if (active.resume) return;
    if (allowed && stage.kind === "waiting") void join();
  }, [allowed, stage.kind, join, active.resume]);

  /* The room told us somebody joined or left: ask the server now. */
  const remotePresent = media.remotePresent;
  useEffect(() => {
    if (stage.kind === "joined") void beat();
  }, [remotePresent, stage.kind, beat]);

  /* The room closed. If the server still says the call is on, rejoin with a
     fresh token (re-checked by the server); otherwise the pulse ends it. */
  useEffect(() => {
    if (media.connection !== "disconnected" || media.disconnectReason === "local") return;
    const m = mediaRef.current;
    mediaRef.current = null;
    void m?.close();
    void beat();
    if (media.disconnectReason === "network" && rejoins.current < MAX_REJOINS) {
      rejoins.current += 1;
      setStage({ kind: "waiting" });
    }
  }, [media.connection, media.disconnectReason, beat]);

  /* Leave cleanly: unmount, page hide. */
  useEffect(() => {
    const leave = () => {
      const m = mediaRef.current;
      mediaRef.current = null;
      void m?.close();
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  /* iOS shell: capture stops in the background. Pause the camera ourselves
     and offer it back, rather than show a frozen frame. */
  useEffect(() => {
    if (!looksNative() || nativePlatform() !== "ios") return;
    let wasOn = false;
    const onVisibility = () => {
      const m = mediaRef.current;
      if (!m) return;
      if (document.hidden) {
        wasOn = media.cameraOn;
        if (wasOn) void m.setCamera(false);
      } else if (wasOn) {
        setCameraPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    let remove: (() => void) | null = null;
    void import("@capacitor/app")
      .then(({ App }) => App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) onVisibility();
      }))
      .then((handle) => {
        remove = () => void handle.remove();
      })
      .catch(() => undefined);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      remove?.();
    };
  }, [media.cameraOn]);

  const hangUp = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    setConfirming(false);
    const intent = hangUpIntent(snapshot.state, snapshot.role);
    if (intent === "none") {
      dismissCall();
      return;
    }
    const answer = await endCall({ callId }).catch(() => null);
    const m = mediaRef.current;
    mediaRef.current = null;
    await m?.close();
    if (answer?.ok) mergeSnapshot(answer.data);
    else void beat();
    setEnding(false);
  }, [ending, snapshot.state, snapshot.role, callId, beat]);

  const onEnd = useCallback(() => {
    if (endNeedsConfirm(snapshot)) setConfirming(true);
    else void hangUp();
  }, [snapshot, hangUp]);

  const keepMessaging = useCallback(async () => {
    await endCall({ callId }).catch(() => null);
    dismissCall();
    const href = returnHref(snapshot, pathname);
    if (pathname !== href) router.push(href);
  }, [callId, snapshot, pathname, router]);

  const name = snapshot.otherName ?? "Vallo member";
  const remoteRef = useCallback((el: HTMLVideoElement | null) => {
    remoteEl.current = el;
    mediaRef.current?.attachRemoteVideo(el);
  }, []);
  const localRef = useCallback((el: HTMLVideoElement | null) => {
    localEl.current = el;
    mediaRef.current?.attachLocalVideo(el);
  }, []);

  /* --------------------------------------------------------------- draw */

  if (stage.kind === "denied") {
    return (
      <PermissionView
        copy={copy}
        error={stage.error}
        wantedVideo={stage.wantedVideo}
        detail={stage.detail}
        platform={mediaPlatform(navigator.userAgent, looksNative() ? nativePlatform() : null)}
        onRetry={() => setStage({ kind: "waiting" })}
        onVoiceOnly={() => {
          voiceOnlyRef.current = true;
          setStage({ kind: "waiting" });
        }}
        onKeepMessaging={() => void keepMessaging()}
      />
    );
  }

  if (active.resume) {
    return (
      <OutgoingView
        copy={copy}
        name={name}
        kind={snapshot.kind}
        context={active.context.line}
        status={copy.connecting.title}
        onCancel={() => void hangUp()}
        busy={ending}
        extra={
          <Button variant="primary" size="lg" onClick={() => confirmResume()} data-autofocus data-testid="call-rejoin">
            {copy.connecting.rejoin}
          </Button>
        }
      />
    );
  }

  const live = phase === "in_call" || phase === "reconnecting" || (stage.kind === "joined" && media.remotePresent && phase === "connecting");
  if (phase === "outgoing" || (!live && phase === "connecting")) {
    const status =
      phase === "outgoing"
        ? snapshot.state === "RINGING"
          ? copy.outgoing.ringing
          : copy.outgoing.calling
        : copy.connecting.title;
    return (
      <OutgoingView
        copy={copy}
        name={name}
        kind={snapshot.kind}
        context={active.context.line}
        status={status}
        localVideoRef={localRef}
        localVideoOn={snapshot.kind === "VIDEO" && media.cameraOn && stage.kind === "joined"}
        error={stage.kind === "failed" ? stage.error : null}
        onCancel={() => void hangUp()}
        busy={ending}
      />
    );
  }

  const banner: CallBanner =
    phase === "reconnecting" || media.connection === "reconnecting"
      ? media.remotePresent || media.connection === "reconnecting"
        ? "reconnecting"
        : "remote_left"
      : cameraPaused
        ? "camera_paused"
        : stage.kind === "joined" && !media.remotePresent
          ? "remote_left"
          : media.quality > 0 && media.quality < 2
            ? "weak"
            : null;

  return (
    <InCallView
      copy={copy}
      name={name}
      kind={snapshot.kind}
      clock={clockWords(talkSeconds(snapshot, now))}
      quality={media.quality}
      banner={banner}
      remoteVideoOn={media.remoteVideoOn}
      remoteMicMuted={media.remoteMicMuted}
      remoteVideoRef={remoteRef}
      localVideoRef={localRef}
      micOn={media.micOn}
      cameraOn={media.cameraOn}
      canCamera={snapshot.kind === "VIDEO"}
      canSwitchCamera={media.canSwitchCamera}
      canChooseOutput={media.outputs.length > 1}
      outputLabel={media.outputs.find((o) => o.id === media.outputId)?.label}
      rearCamera={media.rear}
      ending={ending}
      onToggleMic={() => void mediaRef.current?.setMic(!media.micOn)}
      onToggleCamera={() => {
        setCameraPaused(false);
        void mediaRef.current?.setCamera(!media.cameraOn);
      }}
      onSwitchCamera={() => void mediaRef.current?.switchCamera()}
      onNextOutput={() => void mediaRef.current?.nextOutput()}
      onEnd={onEnd}
      onResumeCamera={() => {
        setCameraPaused(false);
        void mediaRef.current?.setCamera(true);
      }}
      confirm={confirming ? <ConfirmEnd copy={copy} onConfirm={() => void hangUp()} onCancel={() => setConfirming(false)} /> : null}
    />
  );
}

/** For the tests: which kind a stage publishes, given how the call was answered. */
export function publishesVideo(kind: CallKind, answeredWith: CallKind | null): boolean {
  return kind === "VIDEO" && answeredWith !== "AUDIO";
}
