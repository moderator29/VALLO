"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { fill } from "@/components/app/threads/when";
import type { Dictionary } from "@vallo/i18n/core";
import { formatDuration, peaksFrom } from "./voice";

/**
 * A VOICE NOTE: A WAVEFORM AND A DURATION (north star 15.4, reference 40).
 *
 * The control is a play button, the waveform as bars, and the length. It is a
 * real audio element underneath, so seeking, the screen reader and the
 * keyboard all work: the bars are covered by a range input named "Playback
 * position", and the button names itself Play or Pause.
 *
 * WHERE THE NUMBERS COME FROM, and why none are invented:
 *   - the duration is the row's `durationMs` when it carries one, otherwise
 *     whatever the audio element reports once it knows (`loadedmetadata`),
 *     otherwise nothing is drawn. It never shows a placeholder length.
 *   - the bars are the row's stored `peaks` when it carries them, otherwise
 *     they are computed from the decoded file when the note scrolls into view
 *     (capped, so a long recording never stalls a phone), otherwise there are
 *     no bars: a plain track, which is what is true.
 *
 * Played is shown by bar colour changing as the position passes it, a state
 * and not an animation, so there is nothing to reduce. Nothing here plays by
 * itself: the person presses play.
 */

type Copy = Dictionary["experienceInbox"]["thread"]["voice"];

/** Decode only what is small enough to decode on a metered phone: about 2 MB. */
const MAX_DECODE_BYTES = 2_000_000;

/**
 * GRADE 1: the speeds a note plays at, as a chat app offers them (1x, 1.5x,
 * 2x), one tap to the next. English only for now; the thread's dictionary
 * has no word for it yet.
 */
export const VOICE_RATES = [1, 1.5, 2] as const;
const RATE_WORDS = { label: "Playback speed {rate}x. Tap to change", short: "{rate}x" };

export type VoiceNoteData = {
  /** A URL the signed-in reader may fetch (a signed storage URL). */
  url: string;
  /** Stored length, when the row has it. */
  durationMs?: number | null;
  /** Stored bars, 0 to 1, when the row has them. */
  peaks?: number[] | null;
};

export function VoiceNote({
  note,
  mine,
  copy,
}: {
  note: VoiceNoteData;
  mine: boolean;
  copy: Copy;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [measured, setMeasured] = useState<number | null>(null);
  const [decoded, setDecoded] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [rate, setRate] = useState<(typeof VOICE_RATES)[number]>(1);

  const durationMs = note.durationMs ?? measured;
  const peaks = note.peaks && note.peaks.length > 0 ? note.peaks : decoded;
  const length = formatDuration(durationMs);
  const progress = durationMs && durationMs > 0 ? Math.min(1, position / durationMs) : 0;

  /* Decode the real file for its bars, once, when it comes into view. */
  useEffect(() => {
    if (note.peaks && note.peaks.length > 0) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      void (async () => {
        try {
          const res = await fetch(note.url);
          const size = Number(res.headers.get("content-length") ?? 0);
          if (!res.ok || size > MAX_DECODE_BYTES) return;
          const bytes = await res.arrayBuffer();
          if (bytes.byteLength > MAX_DECODE_BYTES) return;
          const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!Ctx) return;
          const context = new Ctx();
          try {
            const buffer = await context.decodeAudioData(bytes);
            if (!cancelled) {
              setDecoded(peaksFrom(buffer.getChannelData(0)));
              setMeasured((m) => m ?? Math.round(buffer.duration * 1000));
            }
          } finally {
            void context.close();
          }
        } catch {
          /* No bars is the honest fallback; the track and the player remain. */
        }
      })();
    });
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [note.url, note.peaks]);

  /* While it plays, the bars follow the sound every frame rather than at the
     four-a-second pace of `timeupdate`, so the played colour sweeps. */
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const follow = () => {
      const audio = audioRef.current;
      if (audio) setPosition(Math.round(audio.currentTime * 1000));
      frame = window.requestAnimationFrame(follow);
    };
    frame = window.requestAnimationFrame(follow);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);

  const cycleRate = () => {
    const next = VOICE_RATES[(VOICE_RATES.indexOf(rate) + 1) % VOICE_RATES.length]!;
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.playbackRate = rate;
      void audio.play().catch(() => setFailed(true));
    } else {
      audio.pause();
    }
  }, [rate]);

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !durationMs) return;
    audio.currentTime = (value / 1000) * (durationMs / 1000);
    setPosition((value / 1000) * durationMs);
  };

  const label = length ? fill(copy.label, { duration: length }) : copy.labelUnknown;

  return (
    <div
      ref={rootRef}
      className={`nf-voice${mine ? " nf-voice--mine" : ""}`}
      role="group"
      aria-label={label}
      data-testid="voice-note"
    >
      <button
        type="button"
        className="nf-voice__play"
        onClick={toggle}
        aria-label={playing ? copy.pause : copy.play}
        aria-pressed={playing}
      >
        <UiIcon name={playing ? "circle-pause" : "circle-play"} size={24} />
      </button>

      <div className="nf-voice__wave">
        {peaks ? (
          <div className="nf-voice__bars" aria-hidden="true" data-testid="voice-bars">
            {peaks.map((p, i) => (
              <span
                key={i}
                className="nf-voice__bar"
                data-played={(i + 0.5) / peaks.length <= progress || undefined}
                style={{ height: `${Math.round(p * 100)}%` }}
              />
            ))}
          </div>
        ) : (
          <div className="nf-voice__track" aria-hidden="true">
            <span className="nf-voice__fill" style={{ transform: `scaleX(${progress})` }} />
          </div>
        )}
        {durationMs ? (
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(progress * 1000)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label={copy.position}
            className="nf-voice__seek"
          />
        ) : null}
      </div>

      {length ? (
        <span className="nf-voice__time nf-numeric">
          {playing || position > 0 ? formatDuration(position) : length}
        </span>
      ) : null}

      {playing || position > 0 ? (
        <button
          type="button"
          className="nf-voice__rate nf-numeric"
          onClick={cycleRate}
          aria-label={RATE_WORDS.label.replace("{rate}", String(rate))}
          data-testid="voice-rate"
        >
          {RATE_WORDS.short.replace("{rate}", String(rate))}
        </button>
      ) : null}

      {failed ? (
        <span role="alert" className="nf-voice__failed">
          {copy.unavailable}
        </span>
      ) : null}

      <audio
        ref={audioRef}
        src={note.url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const seconds = e.currentTarget.duration;
          if (Number.isFinite(seconds)) setMeasured(Math.round(seconds * 1000));
        }}
        onTimeUpdate={(e) => setPosition(Math.round(e.currentTarget.currentTime * 1000))}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

