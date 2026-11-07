"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VOICE_MAX_MS, VOICE_MIN_MS, VOICE_STORED_BARS } from "@/lib/messages/voice-note";
import { peaksFrom } from "./voice";
import { isAppleWebKit, levelOf, liveBars, recorderType, uploadType } from "./voice-recorder";

/**
 * THE MICROPHONE, HELD (Platform Grade 1, P1.3).
 *
 * One recording at a time, from the first press to the release:
 *
 *   `start()`   asks for the microphone (only now, on the first hold, never
 *               on arrival), then records with MediaRecorder in the type the
 *               device records best (`recorderType`). While it runs, an
 *               analyser reads the loudness of each frame: the live bars come
 *               from it, and so do the 40 stored bars (`peaksFrom`), so the
 *               waveform the other person sees is this recording's own.
 *   `finish()`  stops and hands back the file, its length and its bars. A
 *               hold under half a second is not a voice note (`tooShort`).
 *   `cancel()`  stops and throws it away.
 *
 * At two minutes it stops by itself and calls `onLimit`, which the composer
 * answers by sending. Leaving the screen cancels whatever was recording, and
 * the microphone is released every time, so the device's recording light goes
 * out the moment the person lets go.
 */

export type VoiceRecording = {
  blob: Blob;
  durationMs: number;
  /** The stored bars, 0 to 1, or null when nothing could be measured. */
  peaks: number[] | null;
  contentType: string;
  ext: string;
};

export type StartRefusal = "unsupported" | "denied" | "failed" | "released";

type Live = {
  stream: MediaStream;
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  levels: number[];
  context: AudioContext | null;
  frame: number;
  limit: number;
  stopped: Promise<void>;
};

export function useVoiceRecorder({ onLimit }: { onLimit?: () => void } = {}) {
  const [state, setState] = useState<"idle" | "asking" | "recording">("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [bars, setBars] = useState<number[]>(() => liveBars([]));
  const live = useRef<Live | null>(null);
  /* A start that is still asking for the microphone, so a cancel can stop it arriving. */
  const asking = useRef<{ cancelled: boolean } | null>(null);
  const limitRef = useRef(onLimit);
  useEffect(() => {
    limitRef.current = onLimit;
  });

  const release = useCallback((rec: Live) => {
    window.cancelAnimationFrame(rec.frame);
    window.clearTimeout(rec.limit);
    for (const track of rec.stream.getTracks?.() ?? []) track.stop();
    if (rec.context) void rec.context.close().catch(() => undefined);
  }, []);

  const start = useCallback(
    async (stillHeld: () => boolean): Promise<{ ok: true } | { ok: false; reason: StartRefusal }> => {
      if (live.current || asking.current) return { ok: false, reason: "failed" };
      const media = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
      if (!media?.getUserMedia || typeof window.MediaRecorder === "undefined") return { ok: false, reason: "unsupported" };
      const ticket = { cancelled: false };
      asking.current = ticket;
      setState("asking");
      let stream: MediaStream;
      try {
        stream = await media.getUserMedia({ audio: true });
      } catch (error) {
        asking.current = null;
        setState("idle");
        const name = (error as { name?: string } | null)?.name ?? "";
        return { ok: false, reason: name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed" };
      }
      asking.current = null;
      /* The permission question took the hold: the finger lifted while it was
         up. Nothing is recorded now; the next hold starts at once. */
      if (ticket.cancelled || !stillHeld()) {
        for (const track of stream.getTracks?.() ?? []) track.stop();
        setState("idle");
        return { ok: false, reason: "released" };
      }

      const apple = isAppleWebKit(navigator.userAgent, navigator.maxTouchPoints ?? 0);
      const wanted = recorderType((t) => window.MediaRecorder.isTypeSupported?.(t) ?? false, apple);
      let recorder: MediaRecorder;
      try {
        recorder = wanted ? new window.MediaRecorder(stream, { mimeType: wanted }) : new window.MediaRecorder(stream);
      } catch {
        for (const track of stream.getTracks?.() ?? []) track.stop();
        setState("idle");
        return { ok: false, reason: "unsupported" };
      }

      const chunks: Blob[] = [];
      let settle: () => void = () => undefined;
      const stopped = new Promise<void>((resolve) => {
        settle = resolve;
      });
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => settle();

      /* The loudness, frame by frame. Best effort: without an analyser the
         stored bars come from decoding the file after it stops. */
      let context: AudioContext | null = null;
      let analyser: AnalyserNode | null = null;
      try {
        const Ctx =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          context = new Ctx();
          analyser = context.createAnalyser();
          analyser.fftSize = 512;
          context.createMediaStreamSource(stream).connect(analyser);
        }
      } catch {
        analyser = null;
      }

      const rec: Live = {
        stream,
        recorder,
        chunks,
        startedAt: performance.now(),
        levels: [],
        context,
        frame: 0,
        limit: 0,
        stopped,
      };
      live.current = rec;
      try {
        recorder.start(250);
      } catch {
        release(rec);
        live.current = null;
        setState("idle");
        return { ok: false, reason: "failed" };
      }

      const frame = new Uint8Array(analyser ? analyser.fftSize : 0);
      let lastPaint = 0;
      const tick = (now: number) => {
        if (live.current !== rec) return;
        if (analyser) {
          analyser.getByteTimeDomainData(frame);
          rec.levels.push(levelOf(frame));
        }
        /* About twelve paints a second: enough for a living timer and bars. */
        if (now - lastPaint > 80) {
          lastPaint = now;
          setElapsedMs(Math.min(VOICE_MAX_MS, now - rec.startedAt));
          setBars(liveBars(rec.levels));
        }
        rec.frame = window.requestAnimationFrame(tick);
      };
      rec.frame = window.requestAnimationFrame(tick);
      rec.limit = window.setTimeout(() => limitRef.current?.(), VOICE_MAX_MS);
      setElapsedMs(0);
      setBars(liveBars([]));
      setState("recording");
      return { ok: true };
    },
    [release],
  );

  const stopRecorder = useCallback(async (rec: Live) => {
    if (rec.recorder.state !== "inactive") {
      try {
        rec.recorder.stop();
      } catch {
        /* Already stopped. */
      }
      /* A recorder that never says it stopped must not hold the composer. */
      await Promise.race([rec.stopped, new Promise((r) => window.setTimeout(r, 1500))]);
    }
  }, []);

  const finish = useCallback(async (): Promise<VoiceRecording | "tooShort" | null> => {
    const rec = live.current;
    if (!rec) {
      if (asking.current) asking.current.cancelled = true;
      return null;
    }
    live.current = null;
    const durationMs = Math.round(Math.min(VOICE_MAX_MS, performance.now() - rec.startedAt));
    window.cancelAnimationFrame(rec.frame);
    await stopRecorder(rec);
    release(rec);
    setState("idle");
    if (durationMs < VOICE_MIN_MS) return "tooShort";
    const mime = rec.recorder.mimeType || rec.chunks[0]?.type || "";
    const apple = isAppleWebKit(navigator.userAgent, navigator.maxTouchPoints ?? 0);
    const { contentType, ext } = uploadType(mime, apple);
    const blob = new Blob(rec.chunks, { type: contentType });
    if (blob.size === 0) return null;
    let peaks = rec.levels.length > 0 ? peaksFrom(rec.levels, VOICE_STORED_BARS) : null;
    if (!peaks) peaks = await decodePeaks(blob);
    return { blob, durationMs, peaks, contentType, ext };
  }, [release, stopRecorder]);

  const cancel = useCallback(() => {
    if (asking.current) asking.current.cancelled = true;
    const rec = live.current;
    live.current = null;
    if (rec) {
      try {
        if (rec.recorder.state !== "inactive") rec.recorder.stop();
      } catch {
        /* Already stopped. */
      }
      release(rec);
    }
    setState("idle");
  }, [release]);

  /* Leaving the screen mid-recording throws it away and frees the microphone. */
  useEffect(
    () => () => {
      const rec = live.current;
      live.current = null;
      if (rec) {
        try {
          if (rec.recorder.state !== "inactive") rec.recorder.stop();
        } catch {
          /* Already stopped. */
        }
        release(rec);
      }
    },
    [release],
  );

  return { state, elapsedMs, bars, start, finish, cancel };
}

/** The stored bars from the file itself, when no analyser ran. Null if it cannot be decoded. */
async function decodePeaks(blob: Blob): Promise<number[] | null> {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const context = new Ctx();
    try {
      const buffer = await context.decodeAudioData(await blob.arrayBuffer());
      return peaksFrom(buffer.getChannelData(0), VOICE_STORED_BARS);
    } finally {
      void context.close().catch(() => undefined);
    }
  } catch {
    return null;
  }
}
