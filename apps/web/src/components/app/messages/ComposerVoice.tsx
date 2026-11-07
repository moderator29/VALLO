"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { banner } from "@/lib/ui/toast";
import { feedback } from "@/lib/ui/feedback";
import { formatDuration } from "./voice";
import { SLIDE_CANCEL_PX, slideCancels } from "./voice-recorder";
import { useVoiceRecorder, type VoiceRecording } from "./useVoiceRecorder";

/**
 * THE ROUND BUTTON THAT IS A MICROPHONE UNTIL THERE IS SOMETHING TO SEND
 * (Platform Grade 1, P1.3; reference R58).
 *
 * With the field empty and no photo waiting it is the microphone; the moment
 * there are words (or a photo) it is Send, the two glyphs crossing over in
 * place so nothing on the bar moves. As Send it is the form's submit button,
 * exactly the button it replaced.
 *
 * AS THE MICROPHONE it records while it is held:
 *
 *   press       the first press asks for the microphone (never before); from
 *               then on recording starts under the finger at once
 *   hold        the box shows a red dot, the running time, the live bars and
 *               "Slide to cancel"
 *   slide left  past SLIDE_CANCEL_PX throws it away, with one light tap
 *   release     sends it (the thread draws it at once as "Sending")
 *   two minutes it stops and sends by itself
 *   a tap       is not a voice note: the hint says how ("Hold the microphone
 *               to record a voice note.")
 *
 * A keyboard holds it the same way: Space or Enter down records, up sends,
 * Escape throws it away. Every refusal (the microphone not allowed, a device
 * that cannot record) is said in the top banner.
 */

const WORDS = {
  mic: "Record a voice note",
  hold: "Hold the microphone to record a voice note.",
  slide: "Slide to cancel",
  recording: "Recording a voice note",
  cancelled: "Voice note cancelled",
  denied:
    "Microphone access is off. Turn it on for Vallo in your phone's Settings (or for this site in your browser), then hold the microphone again.",
  unsupported: "This device can't record voice notes here. Write a message instead.",
  failed: "The voice note couldn't be recorded. Try again.",
};

export const COMPOSER_VOICE_WORDS = WORDS;

export function ComposerVoice({
  ready,
  sendLabel,
  onVoice,
}: {
  /** There are words or a photo: the button is Send. */
  ready: boolean;
  sendLabel: string;
  /** A finished recording, to be sent. */
  onVoice: (recording: VoiceRecording) => void;
}) {
  const held = useRef<{ x: number; pointerId: number | null } | null>(null);
  const [dx, setDx] = useState(0);
  const finishing = useRef(false);

  const send = useCallback(
    async (finish: () => Promise<VoiceRecording | "tooShort" | null>, wasRecording: boolean) => {
      if (finishing.current) return;
      finishing.current = true;
      try {
        const out = await finish();
        if (out === "tooShort") banner.info(WORDS.hold);
        else if (out) onVoice(out);
        else if (wasRecording) banner.error(WORDS.failed);
      } finally {
        finishing.current = false;
      }
    },
    [onVoice],
  );

  const recorder = useVoiceRecorder({
    /* Two minutes: it stops and sends, whatever the finger is doing. */
    onLimit: () => {
      held.current = null;
      setDx(0);
      void send(recorder.finish, true);
    },
  });
  const recording = recorder.state === "recording";

  const begin = (x: number, pointerId: number | null) => {
    if (held.current || finishing.current) return;
    held.current = { x, pointerId };
    setDx(0);
    void recorder.start(() => held.current !== null).then((result) => {
      if (result.ok) return;
      held.current = null;
      if (result.reason === "denied") banner.error(WORDS.denied);
      else if (result.reason === "unsupported") banner.error(WORDS.unsupported);
      else if (result.reason === "released") banner.info(WORDS.hold);
      else banner.error(WORDS.failed);
    });
  };

  const end = () => {
    if (!held.current) return;
    held.current = null;
    setDx(0);
    /* Still asking for the microphone: `start` sees the finger gone and
       records nothing. Recording: it sends. */
    void send(recorder.finish, recording);
  };

  /* The one place the slide commits: the recording is gone, felt once. */
  const cancelBySlide = () => {
    held.current = null;
    setDx(0);
    recorder.cancel();
    feedback("select");
    banner.info(WORDS.cancelled);
  };

  const down = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (ready) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* A pointer that cannot be captured still records while it stays on the button. */
    }
    begin(event.clientX, event.pointerId);
  };

  const track = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const h = held.current;
    if (!h || h.pointerId !== event.pointerId || !recording) return;
    const next = Math.min(0, event.clientX - h.x);
    if (slideCancels(next)) cancelBySlide();
    else setDx(next);
  };

  const up = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const h = held.current;
    if (!h || h.pointerId !== event.pointerId) return;
    end();
  };

  const lost = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const h = held.current;
    if (!h || h.pointerId !== event.pointerId) return;
    /* The system took the touch (a call, a notification pulled down). */
    held.current = null;
    setDx(0);
    recorder.cancel();
  };

  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (ready) return;
    if (event.key === "Escape" && (held.current || recording)) {
      event.preventDefault();
      held.current = null;
      setDx(0);
      recorder.cancel();
      banner.info(WORDS.cancelled);
      return;
    }
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (event.repeat) return;
    begin(0, null);
  };

  const keyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (ready || (event.key !== " " && event.key !== "Enter")) return;
    event.preventDefault();
    if (held.current?.pointerId === null) end();
  };

  const pull = Math.min(1, Math.abs(dx) / SLIDE_CANCEL_PX);

  return (
    <>
      {recording ? (
        <div className="nf-voice-rec" data-testid="voice-recording" role="status" aria-label={WORDS.recording}>
          <span className="nf-voice-rec__dot" aria-hidden="true" />
          <span className="nf-voice-rec__time nf-numeric" data-testid="voice-recording-time">
            {formatDuration(recorder.elapsedMs) ?? "0:00"}
          </span>
          <span className="nf-voice-rec__bars" aria-hidden="true" data-testid="voice-recording-bars">
            {recorder.bars.map((level, i) => (
              <span key={i} className="nf-voice-rec__bar" style={{ transform: `scaleY(${Math.max(0.12, level)})` }} />
            ))}
          </span>
          <span
            className="nf-voice-rec__slide"
            data-testid="voice-slide"
            style={dx === 0 ? undefined : { transform: `translateX(${Math.round(dx * 0.6)}px)`, opacity: 1 - pull * 0.7 }}
          >
            <UiIcon name="chevron-down" size={16} className="rotate-90" />
            {WORDS.slide}
          </span>
        </div>
      ) : null}
      <button
        type={ready ? "submit" : "button"}
        aria-label={ready ? sendLabel : WORDS.mic}
        className="nf-composer__send nf-composer__action"
        data-mode={ready ? "send" : "mic"}
        data-ready={ready || undefined}
        data-recording={recording || undefined}
        data-testid="composer-action"
        onPointerDown={down}
        onPointerMove={track}
        onPointerUp={up}
        onPointerCancel={lost}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
        onContextMenu={(event) => {
          /* A long press on a phone must not open the browser's own menu. */
          if (!ready) event.preventDefault();
        }}
      >
        <span className="nf-composer__glyph nf-composer__glyph--send" aria-hidden="true">
          <UiIcon name="arrow-up" size={20} />
        </span>
        <span className="nf-composer__glyph nf-composer__glyph--mic" aria-hidden="true">
          <UiIcon name="mic" size={20} />
        </span>
      </button>
    </>
  );
}
