"use client";

import "@/app/css/calls.css";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { fill, type CallMarkerView } from "@/lib/calls/screen";
import { callNouns, callPillSentence, callRowText, type CallPillWords } from "./call-pill-words";

/**
 * A FINISHED CALL IN THE THREAD, drawn the way X draws one: a quiet, centred,
 * single line of muted text with a small phone or video glyph and the time
 * ("Voice call ended, 12 min · 21:09", "Missed video call · 20:31"). No box, no
 * pill, no filled button. A call this reader missed takes the error ink for
 * the text only.
 *
 * The visible line is short (`callRowText`); the row's spoken label is the
 * full sentence with the name (`callPillSentence`), so a screen reader still
 * hears who and what. "Call back" is a small text action, drawn only where
 * calls are open (the page passes `onCallBack`); it starts the same kind of
 * call through the existing calls feature (`placeCall`), never a second path.
 */
export function CallHistoryRow({
  view,
  name,
  timeLabel,
  words,
  onCallBack,
  busy,
}: {
  view: CallMarkerView;
  /** The other person, as the thread names them. */
  name: string;
  timeLabel: string;
  words: CallPillWords;
  onCallBack?: () => void;
  busy?: boolean;
}) {
  const sentence = callPillSentence(view, name, words);
  const nouns = callNouns(view, words);
  const glyph: UiIconName = view.kind === "VIDEO" ? "video" : view.missed ? "phone-missed" : "phone";
  return (
    <div className="nf-call-event-row" data-testid="call-pill-row">
      <div
        className="nf-call-event"
        role="group"
        aria-label={[nouns.Call, sentence, timeLabel].filter(Boolean).join(". ")}
        data-testid="call-history-row"
        data-kind={view.kind === "VIDEO" ? "video" : "voice"}
        {...(view.missed ? { "data-missed": "" } : {})}
      >
        <span className="nf-call-event__glyph" aria-hidden="true">
          <UiIcon name={glyph} size={14} />
        </span>
        <span className="nf-call-event__text">
          <span className="nf-call-event__line">{callRowText(view, words)}</span>
          {timeLabel ? <span className="nf-call-event__time">{`\u00b7 ${timeLabel}`}</span> : null}
        </span>
        {onCallBack ? (
          <button
            type="button"
            className="nf-call-event__back"
            onClick={onCallBack}
            disabled={busy}
            aria-label={fill(words.callBack, { name, call: nouns.call })}
            data-testid="call-history-callback"
          >
            {words.callBackShort}
          </button>
        ) : null}
      </div>
    </div>
  );
}
