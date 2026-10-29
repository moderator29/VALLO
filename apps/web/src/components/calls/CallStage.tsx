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
import type { CallKind, CallSnapshot } from "@/lib/calls/types";
import { confirmResume, dismissCall, markLocallyOver, mergeSnapshot, type ActiveCall } from "./call-store";
import { useCallPulse, useServerClock } from "./use-call-pulse";
import { ConfirmEnd, InCallView, OutgoingView, PermissionView, type CallBanner, type CallsCopy } from "./views";
import { Button } from "@/components/ui/Button";
import { callLog, errorSummary } from "@/lib/calls/diagnostics";
import { EMPTY_MEDIA, type CallMedia, type MediaSnapshot } from "./media/types";
/** The part of a captured track the stage touches (the media SDK stays behind its own chunk). */
type LocalTrack = { kind: string; stop(): void; attach(el: HTMLMediaElement): unknown };

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
  /* The caller's own camera, shown the moment it opens and before anybody
     answers (the way Snapchat and WhatsApp do), not after the room connects. */
  const [previewOn, setPreviewOn] = useState(false);
  const localTracksRef = useRef<LocalTrack[]>([]);
  const mediaRef = useRef<CallMedia | null>(null);
  const rejoins = useRef(0);
  const joiningRef = useRef(false);
  /* The video elements the views drew; attached again once the session exists. */
  const remoteEl = useRef<HTMLVideoElement | null>(null);
  const localEl = useRef<HTMLVideoElement | null>(null);

  /* What to publish: a video call answered or placed with video publishes the
     camera; "accept with voice" or a voice call publishes the microphone only. */
  const voiceOnlyRef = useRef(active.answeredWith === "AUDIO");

  /* The callee answers on the tap and the server catches up a moment later:
     the microphone is opened at once, and the join waits here for the server. */
  const allowedRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const answering = phase === "incoming" && active.answeredWith !== null;

  const stopLocal = useCallback(() => {
    for (const t of localTracksRef.current) t.stop();
    localTracksRef.current = [];
    setPreviewOn(false);
  }, []);

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
        localTracksRef.current = local;
        if (local.some((t) => t.kind === "video")) setPreviewOn(true);
        callLog("join.captured", local.map((t) => t.kind).join("+"));
      } catch (error) {
        callLog("join.capture_failed", errorSummary(error));
        setStage({ kind: "denied", error: mediaErrorKind(error), wantedVideo: video, detail: errorSummary(error) });
        return;
      }
      setStage({ kind: "joining" });
      /* The callee's answer is on its way to the server; wait for it (the
         credentials are refused until it lands), but never past the ring. */
      for (let waited = 0; !allowedRef.current && waited < 20_000; waited += 40) {
        if (phaseRef.current === "ended") break;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      if (phaseRef.current === "ended" || !localTracksRef.current.length) {
        stopLocal();
        return;
      }
      const creds = await getJoinCredentials({ callId });
      if (!creds.ok) {
        callLog("join.token_refused", creds.error.slice(0, 80));
        stopLocal();
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
  }, [callId, snapshot.kind, beat, copy.connecting.body, stopLocal]);

  /* Join as soon as the server allows it and the person has tapped; a callee
     who has just tapped Accept starts at once (see `allowedRef`). */
  const allowed = mayJoin(snapshot.state, snapshot.role, snapshot.myState);
  allowedRef.current = allowed;
  useEffect(() => {
    if (active.resume) return;
    if ((allowed || answering) && stage.kind === "waiting") void join();
  }, [allowed, answering, stage.kind, join, active.resume]);

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
      for (const t of localTracksRef.current) t.stop();
      localTracksRef.current = [];
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

  /* INSTANT (29 October 2026): hanging up answers on the tap. The camera and
     microphone stop and the screen changes now; the server hears about it in
     the background, and for a minute no late "still ringing" news can bring
     the call back (`markLocallyOver`). */
  const hangUp = useCallback(() => {
    if (ending) return;
    setConfirming(false);
    const intent = hangUpIntent(snapshot.state, snapshot.role);
    if (intent === "none") {
      dismissCall();
      return;
    }
    setEnding(true);
    markLocallyOver(callId);
    const m = mediaRef.current;
    mediaRef.current = null;
    void m?.close();
    stopLocal();
    const shown: CallSnapshot = {
      ...snapshot,
      state: intent === "cancel" ? "CANCELLED" : intent === "decline" ? "DECLINED" : "ENDED",
      version: snapshot.version + 1,
      endedAt: new Date(Date.now() + active.offsetMs).toISOString(),
      durationSeconds: intent === "end" ? talkSeconds(snapshot, now) : null,
    };
    if (intent === "end") mergeSnapshot(shown);
    else dismissCall();
    void endCall({ callId })
      .then((answer) => {
        if (answer.ok) mergeSnapshot(answer.data);
      })
      .catch(() => undefined)
      .finally(() => setEnding(false));
  }, [ending, snapshot, callId, active.offsetMs, now, stopLocal]);

  const onEnd = useCallback(() => {
    if (endNeedsConfirm(snapshot)) setConfirming(true);
    else hangUp();
  }, [snapshot, hangUp]);

  const keepMessaging = useCallback(async () => {
    markLocallyOver(callId);
    stopLocal();
    dismissCall();
    void endCall({ callId }).catch(() => null);
    const href = returnHref(snapshot, pathname);
    if (pathname !== href) router.push(href);
  }, [callId, snapshot, pathname, router, stopLocal]);

  const name = snapshot.otherName ?? "Vallo member";
  const remoteRef = useCallback((el: HTMLVideoElement | null) => {
    remoteEl.current = el;
    mediaRef.current?.attachRemoteVideo(el);
  }, []);
  const localRef = useCallback((el: HTMLVideoElement | null) => {
    localEl.current = el;
    if (mediaRef.current) {
      mediaRef.current.attachLocalVideo(el);
      return;
    }
    /* Before the room exists: draw the camera the person just opened. */
    const preview = localTracksRef.current.find((t) => t.kind === "video");
    if (el && preview) preview.attach(el);
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
        onCancel={() => hangUp()}
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
  if (phase === "outgoing" || answering || (!live && phase === "connecting")) {
    const status =
      phase === "outgoing" && !answering
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
        localVideoOn={snapshot.kind === "VIDEO" && (stage.kind === "joined" ? media.cameraOn : previewOn)}
        error={stage.kind === "failed" ? stage.error : null}
        onCancel={() => hangUp()}
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
      canChooseOutput={onPhone && media.outputs.length > 1}
      speakerOn={speakerIsOn(media)}
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
      confirm={confirming ? <ConfirmEnd copy={copy} onConfirm={() => hangUp()} onCancel={() => setConfirming(false)} /> : null}
    />
  );
}

/** A phone, where the speaker button belongs. A computer picks its speakers in the system, and never shows a device name here. */
const onPhone =
  typeof navigator !== "undefined" && (looksNative() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

/** Is the loudspeaker the current output? An output with no name counts as the speaker, the phone's default. */
function speakerIsOn(media: MediaSnapshot): boolean {
  const label = media.outputs.find((o) => o.id === media.outputId)?.label ?? "";
  return label === "" || /speaker/i.test(label);
}

/** For the tests: which kind a stage publishes, given how the call was answered. */
export function publishesVideo(kind: CallKind, answeredWith: CallKind | null): boolean {
  return kind === "VIDEO" && answeredWith !== "AUDIO";
}
