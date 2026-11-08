"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefCallback, type MouseEvent as RMouseEvent } from "react";
import "@/app/css/calls.css";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { initial } from "@/lib/text/initial";
import { fill, type MediaErrorKind, type MediaPlatform } from "@/lib/calls/screen";
import type { CallKind } from "@/lib/calls/types";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";

export type CallsCopy = Dictionary["calls"];

/**
 * THE CALL SCREENS, AS PICTURES OF PROPS.
 *
 * Every view here draws one state and calls back; none of them knows about
 * the server actions, realtime or LiveKit. The incoming layer and the call
 * stage feed them, the preview harness (`app/(dev)/preview/calls`) feeds them
 * fixtures for screenshots, and the dom tests mount them with spies. Keeping
 * them pure is what lets the same pixels be tested, previewed and shipped.
 *
 * Accessibility: each full screen is a modal dialog with a label, focus moves
 * into it on open, every control has a spoken name (the caption under a
 * round button is the short visible word, the `aria-label` the full one), the
 * toggles say their state with `aria-pressed`, and status changes are read
 * out through a polite live region.
 */

/* -------------------------------------------------------------- parts */

export function CallAvatar({
  name,
  photo,
  ringing = false,
  small = false,
}: {
  name: string;
  /** The person's profile photo (a public URL). The initial shows until it loads, or if it never does. */
  photo?: string | null;
  ringing?: boolean;
  small?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      className={`nf-call__avatar${small ? " nf-call__avatar--sm" : ""}`}
      aria-hidden="true"
      {...(ringing ? { "data-ringing": "" } : {})}
    >
      {initial(name)}
      {photo && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small profile photo that is already a public URL
        <img className="nf-call__avatar-img" src={photo} alt="" decoding="async" onError={() => setBroken(true)} />
      ) : null}
    </span>
  );
}

export function CallControl({
  icon,
  label,
  caption,
  onClick,
  variant = "quiet",
  pressed,
  disabled,
  large,
  filled = true,
  plain,
  testId,
}: {
  icon: UiIconName;
  /** The full spoken name. */
  label: string;
  /** The short visible word under the button. */
  caption: string;
  onClick: () => void;
  variant?: "quiet" | "media" | "accept" | "end";
  /** A toggle's state; leave undefined for a plain button. */
  pressed?: boolean;
  disabled?: boolean;
  large?: boolean;
  filled?: boolean;
  /** An end button whose glyph should not turn into the hung-up handset. */
  plain?: boolean;
  testId?: string;
}) {
  const cls = [
    "nf-call-btn",
    variant === "media" ? "nf-call-btn--media" : "",
    variant === "accept" ? "nf-call-btn--accept" : "",
    variant === "end" ? "nf-call-btn--end" : "",
    large ? "nf-call-btn--lg" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className="nf-call-ctl">
      <button
        type="button"
        className={cls}
        aria-label={label}
        {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
        {...(plain ? { "data-plain": "" } : {})}
        disabled={disabled}
        onClick={onClick}
        data-testid={testId}
      >
        <UiIcon name={icon} size={large ? 28 : 24} filled={filled} weight="bold" />
      </button>
      <span aria-hidden="true">{caption}</span>
    </span>
  );
}

/** A full-screen modal frame that takes focus when it opens. */
export function CallFrame({
  label,
  media = false,
  children,
  testId,
  onKeyDown,
}: {
  label: string;
  media?: boolean;
  children: ReactNode;
  testId?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const previous = document.activeElement as HTMLElement | null;
    /* Focus goes to the dialog itself: a screen reader announces who is
       calling and why, and the next Tab lands on the first control, without
       a focus ring sitting on Decline or End before anybody has touched a key. */
    el.focus({ preventScroll: true });
    return () => {
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className={`nf-call${media ? " nf-call--media" : ""}`}
      {...(media ? { "data-theme": "dark" } : {})}
      data-testid={testId}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}

function Hero({
  name,
  photo,
  ringing,
  context,
  status,
  children,
}: {
  name: string;
  photo?: string | null;
  ringing?: boolean;
  context?: string | null;
  status?: string;
  children?: ReactNode;
}) {
  return (
    <div className="nf-call__hero">
      <CallAvatar name={name} photo={photo} ringing={ringing} />
      <h2 className="nf-call__name">{name}</h2>
      {context ? <p className="nf-call__context">{context}</p> : null}
      {status ? (
        <p className="nf-call__status" role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ incoming */

export function IncomingCallView({
  copy,
  name,
  photo,
  kind,
  review = false,
  context,
  secondsLeft,
  busy = false,
  error,
  onAccept,
  onDecline,
}: {
  copy: CallsCopy;
  name: string;
  photo?: string | null;
  kind: CallKind;
  review?: boolean;
  context?: string | null;
  secondsLeft?: number | null;
  busy?: boolean;
  error?: string | null;
  onAccept: (as: CallKind) => void;
  onDecline: () => void;
}) {
  const title = review ? copy.incoming.review : kind === "VIDEO" ? copy.incoming.video : copy.incoming.voice;
  return (
    <CallFrame label={`${title}: ${name}`} testId="call-incoming">
      <p className="nf-call__top">
        <UiIcon name={kind === "VIDEO" ? "video" : "phone"} size={16} filled />
        {title}
      </p>
      <Hero
        name={name}
        photo={photo}
        ringing={!busy}
        context={context}
        status={busy ? copy.incoming.answering : undefined}
      >
        {review ? <p className="nf-call__note">{copy.review.notVerification}</p> : null}
        {typeof secondsLeft === "number" && secondsLeft > 0 && !busy ? (
          <p className="nf-call__note">{fill(copy.incoming.ringingFor, { seconds: secondsLeft })}</p>
        ) : null}
        {error ? (
          <p className="nf-call__error" role="alert">
            {error}
          </p>
        ) : null}
      </Hero>
      <div className="nf-call__actions">
        <CallControl
          icon="phone"
          label={copy.incoming.decline}
          caption={copy.incoming.decline}
          variant="end"
          large
          disabled={busy}
          onClick={onDecline}
          testId="call-decline"
        />
        {kind === "VIDEO" ? (
          <CallControl
            icon="phone"
            label={copy.incoming.acceptVoice}
            caption={copy.buttons.voice}
            variant="quiet"
            large
            disabled={busy}
            onClick={() => onAccept("AUDIO")}
            testId="call-accept-voice"
          />
        ) : null}
        <CallControl
          icon={kind === "VIDEO" ? "video" : "phone"}
          label={kind === "VIDEO" ? copy.incoming.acceptVideo : copy.incoming.accept}
          caption={copy.incoming.accept}
          variant="accept"
          large
          disabled={busy}
          onClick={() => onAccept(kind)}
          testId="call-accept"
        />
      </div>
    </CallFrame>
  );
}

/* ------------------------------------------------------ outgoing, connecting */

export function OutgoingView({
  copy,
  name,
  photo,
  kind,
  context,
  status,
  localVideoRef,
  localVideoOn = false,
  error,
  onCancel,
  busy = false,
  extra,
}: {
  copy: CallsCopy;
  name: string;
  photo?: string | null;
  kind: CallKind;
  context?: string | null;
  /** "Ringing", "Calling", "Connecting": already worded. */
  status: string;
  localVideoRef?: RefCallback<HTMLVideoElement>;
  localVideoOn?: boolean;
  error?: string | null;
  onCancel: () => void;
  busy?: boolean;
  extra?: ReactNode;
}) {
  const ringing = status === copy.outgoing.ringing || status === copy.outgoing.calling;
  return (
    <CallFrame label={`${kind === "VIDEO" ? copy.outgoing.video : copy.outgoing.voice}: ${name}`} media={localVideoOn} testId="call-outgoing">
      {localVideoOn ? (
        <>
          <video ref={localVideoRef} className="nf-call__remote nf-call__preview" autoPlay playsInline muted aria-label={copy.inCall.selfView} />
          <div className="nf-call__placeholder" style={{ background: "var(--nf-scrim-media)" }} />
        </>
      ) : null}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, zIndex: 1 }}>
        <p className="nf-call__top">
          <UiIcon name={kind === "VIDEO" ? "video" : "phone"} size={16} filled />
          {kind === "VIDEO" ? copy.outgoing.video : copy.outgoing.voice}
        </p>
        <Hero name={name} photo={photo} ringing={ringing} context={context} status={status}>
          {error ? (
            <p className="nf-call__error" role="alert">
              {error}
            </p>
          ) : null}
          {extra}
        </Hero>
        <div className="nf-call__actions">
          <CallControl
            icon="phone"
            label={copy.outgoing.cancel}
            caption={copy.outgoing.cancel}
            variant="end"
            large
            disabled={busy}
            onClick={onCancel}
            testId="call-cancel"
          />
        </div>
      </div>
    </CallFrame>
  );
}

/* ------------------------------------------------------------- in call */

export type Corner = "tl" | "tr" | "bl" | "br";
export type CallBanner = "reconnecting" | "remote_left" | "weak" | "camera_paused" | null;

export type InCallProps = {
  copy: CallsCopy;
  name: string;
  /** The other person's profile photo, drawn while their camera is off. */
  photo?: string | null;
  /** The call's kind: a voice call draws no camera controls at all. */
  kind: CallKind;
  /** "4:12", already counted on the server's clock. */
  clock: string;
  /** 0 (unknown) to 3 (excellent). */
  quality: 0 | 1 | 2 | 3;
  banner: CallBanner;
  remoteVideoOn: boolean;
  remoteMicMuted: boolean;
  remoteVideoRef?: RefCallback<HTMLVideoElement>;
  localVideoRef?: RefCallback<HTMLVideoElement>;
  micOn: boolean;
  cameraOn: boolean;
  /** The token may publish a camera (a video call). */
  canCamera: boolean;
  canSwitchCamera: boolean;
  /** A phone with more than one audio output: the speaker button shows. A computer shows none. */
  canChooseOutput: boolean;
  /** The loudspeaker is the current output: the button is lit. */
  speakerOn?: boolean;
  rearCamera?: boolean;
  ending?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onNextOutput: () => void;
  onEnd: () => void;
  onResumeCamera?: () => void;
  /** The confirm card over the stage (a live review call). */
  confirm?: ReactNode;
};

/** Auto-hide controls for video calls. Tap to show, hide after 5 seconds
 *  of inactivity. Under reduced motion, controls stay visible always. */
function useAutoHide(enabled: boolean): {
  hidden: boolean;
  onInteraction: () => void;
} {
  const [hidden, setHidden] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReduced = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReduced.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      prefersReduced.current = e.matches;
      if (e.matches) setHidden(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    /* Also respect data-motion on the root. */
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const motion = root.dataset.motion;
    if (motion === "calm" || motion === "off") {
      prefersReduced.current = true;
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled || prefersReduced.current) {
      setHidden(false);
      return;
    }
    setHidden(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHidden(true), 5000);
  }, [enabled]);

  useEffect(() => {
    if (enabled && !prefersReduced.current) {
      timer.current = setTimeout(() => setHidden(true), 5000);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled]);

  return { hidden, onInteraction: resetTimer };
}

export function InCallView({
  copy,
  name,
  photo,
  kind,
  clock,
  quality,
  banner,
  remoteVideoOn,
  remoteMicMuted,
  remoteVideoRef,
  localVideoRef,
  micOn,
  cameraOn,
  canCamera,
  canSwitchCamera,
  canChooseOutput,
  speakerOn = false,
  rearCamera,
  ending,
  onToggleMic,
  onToggleCamera,
  onSwitchCamera,
  onNextOutput,
  onEnd,
  onResumeCamera,
  confirm,
}: InCallProps) {
  const statusId = useId();
  const isVideo = kind === "VIDEO";
  const { hidden, onInteraction } = useAutoHide(isVideo && remoteVideoOn);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  /* Close the "More" menu on outside click. */
  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: Event) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [moreOpen]);

  const bannerWords =
    banner === "reconnecting"
      ? { title: copy.inCall.reconnecting, body: copy.inCall.reconnectingBody }
      : banner === "remote_left"
        ? { title: fill(copy.inCall.theyLeft, { name }), body: copy.inCall.theyLeftBody }
        : banner === "weak"
          ? { title: copy.inCall.weak, body: "" }
          : banner === "camera_paused"
            ? { title: copy.inCall.cameraPaused, body: "" }
            : null;

  /* Whether we need a "More" button: only when there are overflow items. */
  const hasMore = isVideo && (canSwitchCamera || true /* placeholder items */);

  return (
    <CallFrame
      label={`${isVideo ? copy.outgoing.video : copy.outgoing.voice}: ${name}`}
      media
      testId="call-in-call"
    >
      {/* Tap anywhere on the stage to show/hide controls in video calls. */}
      <div
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
        onClick={onInteraction}
        role="presentation"
      />
      {remoteVideoOn ? (
        <video
          ref={remoteVideoRef}
          className="nf-call__remote"
          autoPlay
          playsInline
          aria-label={fill(copy.inCall.remoteView, { name })}
          data-testid="call-remote-video"
        />
      ) : (
        <div className="nf-call__placeholder">
          <CallAvatar name={name} photo={photo} />
          <h2 className="nf-call__name">{name}</h2>
          <p className="nf-call__status">{isVideo ? copy.inCall.cameraIsOff : copy.inCall.voiceCall}</p>
        </div>
      )}
      {!remoteVideoOn && remoteVideoRef ? (
        <video ref={remoteVideoRef} hidden autoPlay playsInline muted aria-hidden="true" />
      ) : null}

      <div className="nf-call__bar" {...(hidden ? { "data-hidden": "" } : {})}>
        <p className="nf-call__bar-name">{name}</p>
        <span className="nf-call__clock" aria-label={`${copy.inCall.duration} ${clock}`} id={statusId}>
          <span className="nf-call__live" aria-hidden="true" />
          {clock}
        </span>
        <span className="nf-call__encrypted" aria-label={copy.inCall.encrypted}>
          <UiIcon name="lock" size={14} />
        </span>
        <span className="nf-call__quality" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <i key={n} {...(quality >= n ? { "data-lit": "" } : {})} />
          ))}
        </span>
      </div>

      <div role="status" aria-live="polite" className="contents">
        {bannerWords ? (
          <div className="nf-call__banner" data-testid="call-banner" data-banner={banner ?? ""}>
            <UiIcon name={banner === "camera_paused" ? "video-off" : "alert-triangle"} size={20} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong>{bannerWords.title}</strong>
              {bannerWords.body ? <span>{bannerWords.body}</span> : null}
            </div>
            {banner === "camera_paused" && onResumeCamera ? (
              <button type="button" className="nf-call-row__back" onClick={onResumeCamera} aria-label={copy.inCall.resumeCamera}>
                <UiIcon name="video" size={20} filled />
              </button>
            ) : null}
          </div>
        ) : remoteMicMuted ? (
          <div className="nf-call__banner" data-testid="call-banner" data-banner="remote_muted">
            <UiIcon name="mic-off" size={20} />
            <strong>{fill(copy.inCall.theyMuted, { name })}</strong>
          </div>
        ) : null}
      </div>

      {isVideo ? (
        <SelfView
          copy={copy}
          videoRef={localVideoRef}
          on={cameraOn}
          rear={rearCamera}
        />
      ) : null}

      <div
        className="nf-call__controls"
        role="toolbar"
        aria-label={name}
        {...(hidden ? { "data-hidden": "" } : {})}
      >
        <CallControl
          icon={micOn ? "mic" : "mic-off"}
          label={micOn ? copy.inCall.mute : copy.inCall.unmute}
          caption={micOn ? copy.inCall.mute.split(" ")[0]! : copy.inCall.unmute.split(" ")[0]!}
          variant="media"
          pressed={!micOn}
          onClick={() => { onInteraction(); onToggleMic(); }}
          testId="call-mic"
        />
        {canCamera ? (
          <CallControl
            icon={cameraOn ? "video" : "video-off"}
            label={cameraOn ? copy.inCall.cameraOff : copy.inCall.cameraOn}
            caption={copy.inCall.cameraIsOff.split(" ")[0]!}
            variant="media"
            pressed={!cameraOn}
            onClick={() => { onInteraction(); onToggleCamera(); }}
            testId="call-camera"
          />
        ) : null}
        {canChooseOutput ? (
          <CallControl
            icon="volume"
            label={`${copy.inCall.speaker}: ${speakerOn ? copy.inCall.speakerOn : copy.inCall.speakerOff}`}
            caption={speakerOn ? copy.inCall.speakerOn : copy.inCall.speakerOff}
            variant="media"
            pressed={speakerOn}
            onClick={() => { onInteraction(); onNextOutput(); }}
            testId="call-output"
          />
        ) : null}
        {hasMore ? (
          <span className="nf-call-ctl" style={{ position: "relative" }} ref={moreRef}>
            <button
              type="button"
              className="nf-call-btn nf-call-btn--media"
              aria-label="More"
              aria-expanded={moreOpen}
              onClick={() => { onInteraction(); setMoreOpen((v) => !v); }}
              data-testid="call-more"
            >
              <UiIcon name="more" size={24} />
            </button>
            <span aria-hidden="true">More</span>
            {moreOpen ? (
              <div className="nf-call__more-menu" role="menu">
                {canSwitchCamera && cameraOn ? (
                  <button
                    type="button"
                    className="nf-call__more-item"
                    role="menuitem"
                    onClick={() => { onSwitchCamera(); setMoreOpen(false); }}
                    data-testid="call-switch"
                  >
                    <UiIcon name="switch-camera" size={20} />
                    {copy.inCall.switchCamera}
                  </button>
                ) : null}
                <button type="button" className="nf-call__more-item" role="menuitem" disabled>
                  <UiIcon name="share" size={20} />
                  Share screen
                  <span>Coming soon</span>
                </button>
                <button type="button" className="nf-call__more-item" role="menuitem" disabled>
                  <UiIcon name="users" size={20} />
                  Add to group
                  <span>Coming soon</span>
                </button>
              </div>
            ) : null}
          </span>
        ) : null}
        <CallControl
          icon="phone"
          label={copy.inCall.end}
          caption={copy.inCall.end.split(" ")[0]!}
          variant="end"
          large
          disabled={ending}
          onClick={() => { onInteraction(); onEnd(); }}
          testId="call-end"
        />
      </div>
      {confirm}
    </CallFrame>
  );
}

const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];

/**
 * The small self view. Drag it (finger or mouse) and it settles in the
 * nearest corner; with a keyboard, the arrow keys move it between corners.
 */
export function SelfView({
  copy,
  videoRef,
  on,
  rear,
  initialCorner = "tr",
}: {
  copy: CallsCopy;
  videoRef?: RefCallback<HTMLVideoElement>;
  on: boolean;
  rear?: boolean;
  initialCorner?: Corner;
}) {
  const [corner, setCorner] = useState<Corner>(initialCorner);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ px: number; py: number; left: number; top: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = box.current;
    if (!el) return;
    el.setPointerCapture?.(event.pointerId);
    const rect = el.getBoundingClientRect();
    start.current = { px: event.clientX, py: event.clientY, left: rect.left, top: rect.top };
    setDrag({ x: rect.left, y: rect.top });
  }, []);
  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    setDrag({ x: start.current.left + event.clientX - start.current.px, y: start.current.top + event.clientY - start.current.py });
  }, []);
  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const el = box.current;
    const w = el?.offsetWidth ?? 100;
    const h = el?.offsetHeight ?? 140;
    const cx = s.left + event.clientX - s.px + w / 2;
    const cy = s.top + event.clientY - s.py + h / 2;
    const right = cx > window.innerWidth / 2;
    const bottom = cy > window.innerHeight / 2;
    setCorner(`${bottom ? "b" : "t"}${right ? "r" : "l"}` as Corner);
    setDrag(null);
  }, []);
  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const [v, h] = [corner[0], corner[1]];
    let next: Corner | null = null;
    if (event.key === "ArrowLeft") next = `${v}l` as Corner;
    if (event.key === "ArrowRight") next = `${v}r` as Corner;
    if (event.key === "ArrowUp") next = `t${h}` as Corner;
    if (event.key === "ArrowDown") next = `b${h}` as Corner;
    if (next && CORNERS.includes(next)) {
      event.preventDefault();
      setCorner(next);
    }
  }, [corner]);

  return (
    <div
      ref={box}
      className="nf-call__self"
      data-corner={corner}
      data-testid="call-self-view"
      {...(drag ? { "data-dragging": "" } : {})}
      {...(rear ? { "data-rear": "" } : {})}
      style={drag ? { left: drag.x, top: drag.y, right: "auto", bottom: "auto" } : undefined}
      tabIndex={0}
      role="group"
      aria-label={copy.inCall.moveSelfView}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <video ref={videoRef} autoPlay playsInline muted hidden={!on} aria-hidden="true" />
      {!on ? (
        <span className="nf-call__self-off">
          <UiIcon name="video-off" size={24} filled />
        </span>
      ) : null}
    </div>
  );
}

export function ConfirmEnd({ copy, onConfirm, onCancel }: { copy: CallsCopy; onConfirm: () => void; onCancel: () => void }) {
  const titleId = useId();
  return (
    <div className="nf-call__confirm" role="alertdialog" aria-modal="true" aria-labelledby={titleId} data-theme="dark">
      <div className="nf-call__confirm-card">
        <h2 id={titleId}>{copy.confirmEnd.title}</h2>
        <p>{copy.confirmEnd.body}</p>
        <Button variant="danger" size="md" full onClick={onConfirm} data-autofocus data-testid="call-confirm-end">
          {copy.confirmEnd.confirm}
        </Button>
        <Button variant="secondary" size="md" full onClick={onCancel}>
          {copy.confirmEnd.keep}
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- ended */

export function EndedView({
  copy,
  name,
  photo,
  kind,
  words,
  duration,
  missed = false,
  backLabel,
  onBack,
  onCallBack,
  onClose,
}: {
  copy: CallsCopy;
  name: string;
  photo?: string | null;
  kind: CallKind;
  /** `endReasonWords` for this viewer. */
  words: string;
  /** "4 min 12 s" or empty. */
  duration?: string;
  missed?: boolean;
  backLabel: string;
  onBack: () => void;
  onCallBack?: () => void;
  onClose: () => void;
}) {
  return (
    <CallFrame label={`${words}: ${name}`} testId="call-ended" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <p className="nf-call__top">
        <UiIcon name={missed ? "phone-missed" : kind === "VIDEO" ? "video" : "phone"} size={16} filled />
        {kind === "VIDEO" ? copy.outgoing.video : copy.outgoing.voice}
      </p>
      <Hero name={name} photo={photo} status={words}>
        {duration ? <p className="nf-call__note">{fill(copy.ended.lasted, { duration })}</p> : null}
      </Hero>
      <div className="nf-call__stack">
        <Button variant="primary" size="lg" full onClick={onBack} data-autofocus data-testid="call-back">
          {backLabel}
        </Button>
        {onCallBack ? (
          <Button variant="secondary" size="lg" full onClick={onCallBack} data-testid="call-callback">
            {copy.ended.callBack}
          </Button>
        ) : null}
        <Button variant="ghost" size="md" full onClick={onClose}>
          {copy.ended.close}
        </Button>
      </div>
    </CallFrame>
  );
}

/* ------------------------------------------------------------ recovery */

export function RecoveryView({
  copy,
  title,
  body,
  name,
  photo,
  primaryLabel,
  onPrimary,
  onCallBack,
  onClose,
}: {
  copy: CallsCopy;
  title: string;
  body?: string;
  name?: string;
  photo?: string | null;
  primaryLabel: string;
  onPrimary: () => void;
  onCallBack?: () => void;
  onClose: () => void;
}) {
  return (
    <CallFrame label={title} testId="call-recovery" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="nf-call__hero">
        {name ? <CallAvatar name={name} photo={photo} /> : <span className="nf-call-row__glyph" style={{ width: "4.5rem", height: "4.5rem" }}><UiIcon name="phone-missed" size={32} filled /></span>}
        <h2 className="nf-call__name">{title}</h2>
        {body ? <p className="nf-call__note">{body}</p> : null}
      </div>
      <div className="nf-call__stack">
        {onCallBack ? (
          <Button variant="primary" size="lg" full onClick={onCallBack} data-autofocus>
            {copy.recovery.callBack}
          </Button>
        ) : null}
        <Button variant={onCallBack ? "secondary" : "primary"} size="lg" full onClick={onPrimary} {...(onCallBack ? {} : { "data-autofocus": "" })}>
          {primaryLabel}
        </Button>
        <Button variant="ghost" size="md" full onClick={onClose}>
          {copy.ended.close}
        </Button>
      </div>
    </CallFrame>
  );
}

/* ------------------------------------------- in-app incoming call banner */

export function IncomingCallBanner({
  name,
  photo,
  kind,
  onAccept,
  onDecline,
  onTap,
}: {
  name: string;
  photo?: string | null;
  kind: CallKind;
  onAccept: () => void;
  onDecline: () => void;
  /** Tapping the banner body (not a button) opens the full incoming screen. */
  onTap: () => void;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <div
      className="nf-call-incoming-banner"
      data-testid="call-incoming-banner"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap(); } }}
      onClick={(e: RMouseEvent) => {
        /* Do not open the full screen if a button was tapped. */
        if ((e.target as HTMLElement).closest("button")) return;
        onTap();
      }}
    >
      {photo && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="nf-call-incoming-banner__photo" src={photo} alt="" onError={() => setBroken(true)} />
      ) : (
        <span className="nf-call-incoming-banner__initial" aria-hidden="true">{initial(name)}</span>
      )}
      <div className="nf-call-incoming-banner__text">
        <span className="nf-call-incoming-banner__name">{name}</span>
        <span className="nf-call-incoming-banner__type">
          <UiIcon name={kind === "VIDEO" ? "video" : "phone"} size={14} filled />
          {kind === "VIDEO" ? "Incoming video call" : "Incoming voice call"}
        </span>
      </div>
      <div className="nf-call-incoming-banner__actions">
        <button
          type="button"
          className="nf-call-incoming-banner__btn nf-call-incoming-banner__btn--decline"
          aria-label="Decline"
          onClick={onDecline}
          data-testid="banner-decline"
        >
          <UiIcon name="phone" size={18} filled />
        </button>
        <button
          type="button"
          className="nf-call-incoming-banner__btn nf-call-incoming-banner__btn--accept"
          aria-label="Accept"
          onClick={onAccept}
          data-testid="banner-accept"
        >
          <UiIcon name="phone" size={18} filled />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- permission */

export function PermissionView({
  copy,
  error,
  wantedVideo,
  detail,
  platform,
  onRetry,
  onVoiceOnly,
  onKeepMessaging,
}: {
  copy: CallsCopy;
  error: MediaErrorKind;
  wantedVideo: boolean;
  /** The browser's own error, short and token free, shown when the cause is not one we can name. */
  detail?: string;
  platform: MediaPlatform;
  onRetry: () => void;
  /** Offered when the camera was part of the ask. */
  onVoiceOnly?: () => void;
  onKeepMessaging: () => void;
}) {
  const devices = wantedVideo ? copy.permission.cameraAndMic : copy.permission.microphone;
  const title =
    error === "denied"
      ? fill(copy.permission.deniedTitle, { devices })
      : wantedVideo
        ? copy.permission.askTitle
        : copy.permission.askVoiceTitle;
  const body =
    error === "denied"
      ? copy.permission.deniedBody
      : error === "not_found"
        ? copy.permission.notFound
        : error === "in_use"
          ? copy.permission.inUse
          : error === "insecure"
            ? copy.permission.insecure
            : copy.permission.askBody;
  const steps = copy.permission.steps[platform];
  return (
    <CallFrame label={title} testId="call-permission">
      <div className="nf-call__hero">
        <span className="nf-call-row__glyph" style={{ width: "4.5rem", height: "4.5rem" }} aria-hidden="true">
          <UiIcon name={wantedVideo ? "video-off" : "mic-off"} size={32} filled />
        </span>
        <h2 className="nf-call__name">{title}</h2>
        <p className="nf-call__note">{body}</p>
        {error === "other" && detail ? (
          <p className="nf-caption" data-testid="call-permission-reference">
            {fill(copy.permission.reference, { detail })}
          </p>
        ) : null}
        {error === "denied" ? (
          <>
            <p className="nf-review-call__label">{copy.permission.stepsTitle}</p>
            <ol className="nf-call__steps" data-testid="call-permission-steps">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </>
        ) : null}
      </div>
      <div className="nf-call__stack">
        <Button variant="primary" size="lg" full onClick={onRetry} data-autofocus>
          {copy.permission.tryAgain}
        </Button>
        {wantedVideo && onVoiceOnly ? (
          <Button variant="secondary" size="lg" full onClick={onVoiceOnly}>
            {copy.permission.voiceOnly}
          </Button>
        ) : null}
        <Button variant="ghost" size="md" full onClick={onKeepMessaging}>
          {copy.permission.keepMessaging}
        </Button>
      </div>
    </CallFrame>
  );
}
