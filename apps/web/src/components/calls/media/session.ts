"use client";

import {
  AudioPresets,
  ConnectionQuality,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  createLocalTracks,
  type LocalAudioTrack,
  type LocalTrack,
  type LocalVideoTrack,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
} from "livekit-client";
import { callLog, errorSummary } from "@/lib/calls/diagnostics";
import { EMPTY_MEDIA, type CallMedia, type MediaSnapshot } from "./types";

export { EMPTY_MEDIA, type CallMedia, type MediaSnapshot };

/**
 * THE MEDIA SIDE OF ONE CALL, and the ONLY browser module that imports
 * `livekit-client`. It is reached through `import()` from the call stage,
 * which is itself a lazy chunk, so the SDK is downloaded the first time a
 * call screen opens and never by a page that has no call
 * (`media-boundary.test.ts` holds that line).
 *
 * What it does, in order:
 *   1. `captureLocal` asks for the microphone (and the camera on a video
 *      call) BEFORE connecting, so a refusal is known before anybody is put
 *      in a room, and only ever after a tap (start, accept, rejoin).
 *   2. `connect` joins the room with the credentials the server issued
 *      (held here, in memory, and dropped on disconnect) and publishes the
 *      captured tracks.
 *   3. Everything the screen draws is pushed out through `onChange`: who is
 *      there, their video and microphone state, the connection and its
 *      quality, the devices that make the switch and output controls real.
 *   4. `close` stops every local track (the camera light goes off) and leaves.
 *
 * It never decides the call's state. Joins and leaves are reported so the
 * stage can ask the server at once (`heartbeatCall`); the server, fed by the
 * provider, says ACTIVE, INTERRUPTED or ENDED.
 */

const QUALITY: Record<string, 0 | 1 | 2 | 3> = {
  [ConnectionQuality.Excellent]: 3,
  [ConnectionQuality.Good]: 2,
  [ConnectionQuality.Poor]: 1,
  [ConnectionQuality.Lost]: 0,
};

/** `setSinkId` is how a page picks an audio output; WKWebView has none (VIDEO-CALLING-MOBILE-COMPATIBILITY.md). */
export function canPickOutput(): boolean {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}


/**
 * Ask for the devices. Throws the browser's own error (NotAllowedError and
 * the rest), which `mediaErrorKind` turns into the recovery screen.
 */
export async function captureLocal(wantVideo: boolean): Promise<LocalTrack[]> {
  /* Safari and WKWebView refuse the microphone ("AudioSession category is not
     compatible with audio capture") while the page's audio session is still
     playback-only or ambient, which the ring leaves it as. A call plays and
     records, so say so before asking for the devices. */
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "play-and-record";
  } catch {
    /* Read-only on some builds. */
  }
  return createLocalTracks({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: wantVideo ? { facingMode: "user", resolution: VideoPresets.h540.resolution } : false,
  });
}

export function createCallMedia(local: LocalTrack[], onChange: (next: MediaSnapshot) => void): CallMedia {
  let snap: MediaSnapshot = {
    ...EMPTY_MEDIA,
    micOn: local.some((t) => t.kind === Track.Kind.Audio),
    cameraOn: local.some((t) => t.kind === Track.Kind.Video),
  };
  const emit = (patch: Partial<MediaSnapshot>) => {
    snap = { ...snap, ...patch };
    onChange(snap);
  };
  let closed = false;
  let remoteVideoEl: HTMLVideoElement | null = null;
  let localVideoEl: HTMLVideoElement | null = null;
  const audioEls = new Set<HTMLMediaElement>();
  let videoTracks = local.filter((t) => t.kind === Track.Kind.Video) as LocalVideoTrack[];
  const audioTracks = local.filter((t) => t.kind === Track.Kind.Audio) as LocalAudioTrack[];

  /* A phone's WebView plays no sound that a tap did not allow, and the answer
     goes through several network round trips before the first remote audio
     arrives, which is long after the tap. So the room is told to start audio
     once connected, and if the page still refuses, the very next touch,
     click or key anywhere on the screen allows it (LiveKit's own rule:
     `startAudio` must run inside a user gesture). */
  let unlockArmed = false;
  const armAudioUnlock = () => {
    if (unlockArmed || typeof document === "undefined") return;
    unlockArmed = true;
    const events = ["pointerdown", "touchend", "keydown"] as const;
    const unlock = () => {
      for (const name of events) document.removeEventListener(name, unlock, true);
      unlockArmed = false;
      void room
        .startAudio()
        .then(() => callLog("audio.unlocked"))
        .catch((error: unknown) => callLog("audio.unlock_failed", errorSummary(error)));
    };
    for (const name of events) document.addEventListener(name, unlock, { capture: true, passive: true } as AddEventListenerOptions);
  };

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: { facingMode: "user", resolution: VideoPresets.h540.resolution },
    /* Voice first (27 October 2026): the speech preset is Opus at 24 kbps,
       which holds on a weak Nigerian mobile connection where the default
       music preset stutters; DTX stops sending during silence and RED repeats
       the last frame so one lost packet is not a dropped word. Video keeps
       simulcast so the server can step a weak receiver down. */
    publishDefaults: { simulcast: true, audioPreset: AudioPresets.speech, dtx: true, red: true },
    disconnectOnPageLeave: true,
  });

  const remote = (): RemoteParticipant | null => {
    const first = room.remoteParticipants.values().next();
    return first.done ? null : first.value;
  };

  const refreshRemote = () => {
    const p = remote();
    if (!p) {
      emit({ remotePresent: false, remoteVideoOn: false, remoteMicMuted: false });
      return;
    }
    const cam = p.getTrackPublication(Track.Source.Camera);
    const mic = p.getTrackPublication(Track.Source.Microphone);
    const videoOn = Boolean(cam?.track && !cam.isMuted);
    emit({ remotePresent: true, remoteVideoOn: videoOn, remoteMicMuted: Boolean(mic && mic.isMuted) });
    if (cam?.track && remoteVideoEl) cam.track.attach(remoteVideoEl);
  };

  const refreshDevices = async () => {
    try {
      const cams = await Room.getLocalDevices("videoinput", false);
      const outs = canPickOutput() ? await Room.getLocalDevices("audiooutput", false) : [];
      const outputs = outs
        .filter((d) => d.deviceId && d.deviceId !== "communications")
        .map((d, i) => ({ id: d.deviceId, label: d.label || `Output ${i + 1}` }));
      emit({
        canSwitchCamera: cams.length > 1,
        outputs: outputs.length > 1 ? outputs : [],
        outputId: room.getActiveDevice("audiooutput") ?? outputs[0]?.id ?? null,
      });
    } catch {
      /* Device lists are a nicety; the call works without them. */
    }
  };

  room
    .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.setAttribute("data-vallo-call-audio", "");
        el.hidden = true;
        document.body.appendChild(el);
        audioEls.add(el);
        if (snap.outputId && "setSinkId" in el) {
          void (el as HTMLMediaElement & { setSinkId(id: string): Promise<void> }).setSinkId(snap.outputId).catch(() => undefined);
        }
      }
      refreshRemote();
    })
    .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      for (const el of track.detach()) {
        if (audioEls.has(el)) {
          el.remove();
          audioEls.delete(el);
        }
      }
      refreshRemote();
    })
    .on(RoomEvent.TrackMuted, (_pub, participant: Participant) => {
      if (!participant.isLocal) refreshRemote();
    })
    .on(RoomEvent.TrackUnmuted, (_pub, participant: Participant) => {
      if (!participant.isLocal) refreshRemote();
    })
    .on(RoomEvent.ParticipantConnected, () => refreshRemote())
    .on(RoomEvent.ParticipantDisconnected, () => refreshRemote())
    .on(RoomEvent.Reconnecting, () => {
      callLog("room.reconnecting");
      emit({ connection: "reconnecting" });
    })
    .on(RoomEvent.SignalReconnecting, () => emit({ connection: "reconnecting" }))
    .on(RoomEvent.AudioPlaybackStatusChanged, () => {
      callLog("audio.playback", room.canPlaybackAudio ? "allowed" : "blocked");
      if (!room.canPlaybackAudio) armAudioUnlock();
    })
    .on(RoomEvent.Reconnected, () => {
      callLog("room.reconnected");
      emit({ connection: "connected" });
      refreshRemote();
    })
    .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      callLog("room.disconnected", reason === undefined ? "unknown" : (DisconnectReason[reason] ?? String(reason)));
      const why =
        reason === DisconnectReason.CLIENT_INITIATED
          ? "local"
          : reason === DisconnectReason.DUPLICATE_IDENTITY
            ? "duplicate"
            : reason === DisconnectReason.ROOM_DELETED || reason === DisconnectReason.PARTICIPANT_REMOVED || reason === DisconnectReason.SERVER_SHUTDOWN
              ? "server"
              : "network";
      emit({ connection: "disconnected", disconnectReason: closed ? "local" : why, remotePresent: false });
    })
    .on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, participant: Participant) => {
      if (participant.isLocal) emit({ quality: QUALITY[quality] ?? 0 });
    })
    .on(RoomEvent.MediaDevicesChanged, () => void refreshDevices());

  return {
    async connect(credentials) {
      if (closed) return;
      emit({ connection: "connecting", disconnectReason: null });
      callLog("room.connecting");
      await room.connect(credentials.serverUrl, credentials.token, { autoSubscribe: true });
      callLog("room.connected");
      /* Allowed by the answer tap where the platform lets it; otherwise armed
         for the next touch (see `armAudioUnlock`). */
      await room.startAudio().catch(() => undefined);
      if (!room.canPlaybackAudio) armAudioUnlock();
      for (const track of [...audioTracks, ...videoTracks]) {
        if (!credentials.canPublishVideo && track.kind === Track.Kind.Video) {
          track.stop();
          continue;
        }
        await room.localParticipant.publishTrack(track);
      }
      if (!credentials.canPublishVideo) videoTracks = [];
      emit({ connection: "connected", cameraOn: videoTracks.length > 0 && snap.cameraOn });
      refreshRemote();
      void refreshDevices();
    },
    async setMic(on) {
      await room.localParticipant.setMicrophoneEnabled(on);
      emit({ micOn: on });
    },
    async setCamera(on) {
      const pub = await room.localParticipant.setCameraEnabled(on, { facingMode: snap.rear ? "environment" : "user" });
      const track = pub?.videoTrack as LocalVideoTrack | undefined;
      if (on && track && localVideoEl) track.attach(localVideoEl);
      emit({ cameraOn: on });
      if (on) void refreshDevices();
    },
    async switchCamera() {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.videoTrack as LocalVideoTrack | undefined;
      if (!track) return;
      const cams = await Room.getLocalDevices("videoinput", false);
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (mobile || cams.length < 2) {
        const rear = !snap.rear;
        await track.restartTrack({ facingMode: rear ? "environment" : "user" });
        emit({ rear });
      } else {
        const current = room.getActiveDevice("videoinput");
        const index = cams.findIndex((c) => c.deviceId === current);
        const next = cams[(index + 1) % cams.length]!;
        await room.switchActiveDevice("videoinput", next.deviceId);
      }
      if (localVideoEl) track.attach(localVideoEl);
    },
    async nextOutput() {
      if (snap.outputs.length < 2) return;
      const index = snap.outputs.findIndex((o) => o.id === snap.outputId);
      const next = snap.outputs[(index + 1) % snap.outputs.length]!;
      await room.switchActiveDevice("audiooutput", next.id).catch(() => false);
      for (const el of audioEls) {
        if ("setSinkId" in el) {
          await (el as HTMLMediaElement & { setSinkId(id: string): Promise<void> }).setSinkId(next.id).catch(() => undefined);
        }
      }
      emit({ outputId: next.id });
    },
    attachRemoteVideo(el) {
      remoteVideoEl = el;
      const p = remote();
      const track = p?.getTrackPublication(Track.Source.Camera)?.track;
      if (el && track) track.attach(el);
    },
    attachLocalVideo(el) {
      localVideoEl = el;
      const published = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack as LocalVideoTrack | undefined;
      const track = published ?? videoTracks[0];
      if (el && track) track.attach(el);
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const t of [...audioTracks, ...videoTracks]) t.stop();
      room.localParticipant.trackPublications.forEach((pub) => pub.track?.stop());
      for (const el of audioEls) el.remove();
      audioEls.clear();
      await room.disconnect(true).catch(() => undefined);
    },
  };
}
