"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Dictionary } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { fill } from "@/components/app/threads/when";
import { useClientMount } from "@/lib/ui/client-mount";
import { useOverlay } from "@/lib/ui/use-overlay";
import { useSheetHistory } from "@/lib/ui/use-sheet-history";
import { canShareMedia, saveMedia, shareMedia } from "./media-actions";
import {
  DOUBLE_TAP_SCALE,
  MAX_SCALE,
  REST,
  clamp,
  doubleTap,
  legal,
  lockDirection,
  resist,
  settleDismiss,
  settleSwipe,
  zoomAbout,
  type Point,
  type Size,
  type Zoom,
} from "./media-gesture";
import { SafeVideo } from "@/components/app/media/SafeVideo";

/**
 * THE CHAT'S FULL-SCREEN MEDIA VIEWER (founder, 13 October 2026: "tapping a
 * photo does nothing").
 *
 * One dark full-screen surface for every photo and video of a thread, opened
 * from a tap on a photo in a bubble, with the photos in thread order so a swipe
 * moves through them (the message's own group first, then the rest of the
 * thread). It does what the viewers people already know do:
 *
 *   - the photograph is fitted to the screen; pinch or double tap zooms, a
 *     drag pans while zoomed, the wheel and + / - zoom on a desktop;
 *   - swipe left and right (or the arrow keys, or the side buttons on a wide
 *     screen) move between photographs; swipe down, the X or Escape close;
 *   - the sender's name and the time are at the top, with Save (a download)
 *     and Share (the Web Share API, drawn only where the browser has it);
 *   - a video plays in the same viewer, with its own controls.
 *
 * Why not the listing lightbox (`components/app/listing/PhotoViewer.tsx`)? It
 * is built around a listing's frames (a market-drawn placeholder per kind,
 * the shared-element zoom out of a thumbnail) and its pictures are scroll-
 * snapped, so it has no pinch, double tap, pan, caption, Save or Share, and
 * those are the point here. What is shared is the platform plumbing, used as
 * is: `useOverlay` (Escape, the Tab trap, the scroll lock, focus back, and the
 * Android back button through the overlay registry) and `useSheetHistory` (the
 * browser's Back closes the viewer first and leaves the thread where it was).
 * The gesture arithmetic is `media-gesture.ts`.
 *
 * Signed URLs cannot go through the image optimiser, so these are plain
 * `<img>` elements, as the bubble's own photos are.
 */
export type ViewerItem = {
  id: string;
  kind: "photo" | "video";
  src: string;
  /** The photograph's description for a screen reader. */
  alt: string;
  /** Who sent it, as the thread names them. */
  name: string;
  /** When it was sent, in words ("Fri, 9 Oct, 20:21"). */
  when: string;
};

export type ViewerCopy = Dictionary["chatPolish"]["viewer"];

const TAP_MS = 320;
const TAP_SLOP = 8;
const DOUBLE_TAP_SLOP = 40;
const STEP = 1.5;

type Mode = "idle" | "pending" | "swipe" | "dismiss" | "pan" | "pinch" | "none";
type Gesture = {
  mode: Mode;
  sx: number;
  sy: number;
  st: number;
  startZoom: Zoom;
  startMid: Point;
  startDist: number;
};

export function MediaViewer({
  items,
  startId,
  copy,
  onClose,
}: {
  items: readonly ViewerItem[];
  startId: string;
  copy: ViewerCopy;
  onClose(): void;
}) {
  const mounted = useClientMount();
  const first = Math.max(0, items.findIndex((i) => i.id === startId));
  const [index, setIndex] = useState(first);
  const [zoom, setZoomState] = useState<Zoom>(REST);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [gesturing, setGesturing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [broken, setBroken] = useState<Record<string, true>>({});

  const surface = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef<Zoom>(REST);
  const indexRef = useRef(first);
  const naturals = useRef<Record<string, Size>>({});
  const points = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture>({ mode: "idle", sx: 0, sy: 0, st: 0, startZoom: REST, startMid: { x: 0, y: 0 }, startDist: 1 });
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const noteTimer = useRef<number | null>(null);

  const item = items[index];
  const count = items.length;

  const stageSize = useCallback((): Size => {
    const rect = stage.current?.getBoundingClientRect();
    return { width: rect?.width || window.innerWidth, height: rect?.height || window.innerHeight };
  }, []);
  const centred = useCallback((x: number, y: number): Point => {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: x - (rect.left + rect.width / 2), y: y - (rect.top + rect.height / 2) };
  }, []);
  const setZoom = useCallback((next: Zoom) => {
    zoomRef.current = next;
    setZoomState(next);
  }, []);
  const naturalOf = useCallback((id: string | undefined) => (id ? (naturals.current[id] ?? null) : null), []);

  const say = useCallback((text: string) => {
    setNote(text);
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 3200);
  }, []);
  useEffect(
    () => () => {
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    },
    [],
  );

  /* ------------------------------------------------------------- leaving */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const close = useCallback(() => onCloseRef.current(), []);
  useOverlay({ open: mounted, onClose: close, panelRef: surface });
  useSheetHistory(mounted, "media-viewer", close);

  /* ---------------------------------------------------------- navigation */
  const go = useCallback(
    (to: number) => {
      const next = clamp(to, 0, count - 1);
      setDragX(0);
      if (next === indexRef.current) return;
      indexRef.current = next;
      setIndex(next);
      setZoom(REST);
    },
    [count, setZoom],
  );

  const zoomBy = useCallback(
    (factor: number, at?: Point) => {
      const current = zoomRef.current;
      const scale = clamp(current.scale * factor, 1, MAX_SCALE);
      const from = at ?? { x: 0, y: 0 };
      setZoom(legal(zoomAbout(current, scale, from, from), stageSize(), naturalOf(items[indexRef.current]?.id)));
    },
    [items, naturalOf, setZoom, stageSize],
  );

  /* ------------------------------------------------------------ keyboard */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      /* A video's own controls (and any field) keep their keys: the arrows seek. */
      if (target?.closest("video, input, textarea, select")) return;
      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          go(indexRef.current + 1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          go(indexRef.current - 1);
          break;
        case "+":
        case "=":
          if (items[indexRef.current]?.kind !== "photo") return;
          event.preventDefault();
          zoomBy(STEP);
          break;
        case "-":
          if (items[indexRef.current]?.kind !== "photo") return;
          event.preventDefault();
          zoomBy(1 / STEP);
          break;
        case "0":
          event.preventDefault();
          setZoom(REST);
          break;
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [go, items, setZoom, zoomBy]);

  /* The wheel (and a trackpad's pinch, which arrives as ctrl + wheel) zooms
     about the pointer. Bound by hand: React's wheel listener is passive, and
     a passive one cannot stop the page from zooming. */
  useEffect(() => {
    const el = stage.current;
    if (!el || !mounted) return;
    const onWheel = (event: WheelEvent) => {
      if (items[indexRef.current]?.kind !== "photo" || event.deltaY === 0) return;
      event.preventDefault();
      zoomBy(Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002)), centred(event.clientX, event.clientY));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [centred, items, mounted, zoomBy]);

  /* ------------------------------------------------------------- gestures */
  const begin = (mode: Mode, x: number, y: number) => {
    gesture.current = {
      mode,
      sx: x,
      sy: y,
      st: performance.now(),
      startZoom: zoomRef.current,
      startMid: gesture.current.startMid,
      startDist: gesture.current.startDist,
    };
  };

  const beginPinch = () => {
    const [a, b] = [...points.current.values()];
    if (!a || !b) return;
    gesture.current = {
      mode: "pinch",
      sx: a.x,
      sy: a.y,
      st: performance.now(),
      startZoom: zoomRef.current,
      startMid: centred((a.x + b.x) / 2, (a.y + b.y) / 2),
      startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    };
    setDragX(0);
    setDragY(0);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const from = event.target instanceof Element ? event.target : null;
    /* A video's controls and any button are theirs, not the stage's. */
    if (from?.closest("video, button, a")) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* A pointer that cannot be captured still drags while it stays over the stage. */
    }
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setGesturing(true);
    if (points.current.size >= 2 && items[indexRef.current]?.kind === "photo") {
      beginPinch();
      return;
    }
    const zoomedIn = zoomRef.current.scale > 1;
    begin(zoomedIn ? "pan" : "pending", event.clientX, event.clientY);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!points.current.has(event.pointerId)) return;
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    const natural = naturalOf(items[indexRef.current]?.id);
    if (g.mode === "pinch") {
      const [a, b] = [...points.current.values()];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = centred((a.x + b.x) / 2, (a.y + b.y) / 2);
      const scale = clamp(g.startZoom.scale * (dist / g.startDist), 1, MAX_SCALE);
      setZoom(legal(zoomAbout(g.startZoom, scale, g.startMid, mid), stageSize(), natural));
      return;
    }
    const dx = event.clientX - g.sx;
    const dy = event.clientY - g.sy;
    if (g.mode === "pan") {
      setZoom(legal({ ...g.startZoom, x: g.startZoom.x + dx, y: g.startZoom.y + dy }, stageSize(), natural));
      return;
    }
    if (g.mode === "pending") {
      const direction = lockDirection(dx, dy);
      if (direction === "x") g.mode = "swipe";
      else if (direction === "y") g.mode = "dismiss";
      else if (Math.hypot(dx, dy) >= TAP_SLOP) g.mode = "none";
    }
    if (g.mode === "swipe") setDragX(resist(dx, indexRef.current, count));
    else if (g.mode === "dismiss") setDragY(Math.max(0, dy));
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!points.current.has(event.pointerId)) return;
    /* What this gesture was, read before anything below resets it. */
    const g = { ...gesture.current };
    points.current.delete(event.pointerId);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* Already released. */
    }
    const cancelled = event.type === "pointercancel";
    if (g.mode === "pinch") {
      if (zoomRef.current.scale < 1.05) setZoom(REST);
      const rest = [...points.current.values()][0];
      const zoomedIn = zoomRef.current.scale > 1;
      if (rest) begin(zoomedIn ? "pan" : "none", rest.x, rest.y);
      else gesture.current = { ...gesture.current, mode: "idle" };
      if (points.current.size === 0) setGesturing(false);
      return;
    }
    if (points.current.size === 0) setGesturing(false);
    const dx = event.clientX - g.sx;
    const dy = event.clientY - g.sy;
    const ms = performance.now() - g.st;
    gesture.current = { ...gesture.current, mode: "idle" };
    if (g.mode === "swipe") {
      const settle = cancelled ? "stay" : settleSwipe(dx, ms, stageSize().width, indexRef.current, count);
      setDragX(0);
      if (settle === "next") go(indexRef.current + 1);
      else if (settle === "previous") go(indexRef.current - 1);
      return;
    }
    if (g.mode === "dismiss") {
      if (!cancelled && settleDismiss(dy, ms, stageSize().height)) {
        close();
        return;
      }
      setDragY(0);
      return;
    }
    /* A tap that did not move: twice in a row zooms in about the tap, or out. */
    if (!cancelled && (g.mode === "pending" || g.mode === "pan") && Math.hypot(dx, dy) < TAP_SLOP && ms < TAP_MS) {
      if (items[indexRef.current]?.kind !== "photo") return;
      const now = performance.now();
      const before = lastTap.current;
      if (before && now - before.t < TAP_MS && Math.hypot(event.clientX - before.x, event.clientY - before.y) < DOUBLE_TAP_SLOP) {
        lastTap.current = null;
        setZoom(
          doubleTap(
            zoomRef.current,
            centred(event.clientX, event.clientY),
            stageSize(),
            naturalOf(items[indexRef.current]?.id),
          ),
        );
      } else {
        lastTap.current = { t: now, x: event.clientX, y: event.clientY };
      }
    }
  };

  /* -------------------------------------------------------------- actions */
  const save = async () => {
    if (!item) return;
    const answer = await saveMedia(item);
    say(answer === "failed" ? copy.saveFailed : copy.downloadStarted);
  };
  const share = async () => {
    if (!item) return;
    const answer = await shareMedia(item, fill(copy.shareTitle, { name: item.name }));
    if (answer === "failed") await save();
  };

  /* First focus on the first control, without moving the page behind. */
  useEffect(() => {
    if (!mounted) return;
    surface.current?.querySelector<HTMLElement>("[data-first]")?.focus({ preventScroll: true });
  }, [mounted]);

  if (!mounted || !item) return null;

  const pulled = dragY > 0;
  const style = {
    "--nf-mv-x": `${dragX}px`,
    "--nf-mv-y": `${dragY}px`,
    "--nf-mv-fade": String(pulled ? 1 - Math.min(dragY / 520, 0.75) : 1),
    "--nf-mv-shrink": String(pulled ? 1 - Math.min(dragY / 3000, 0.12) : 1),
  } as CSSProperties;
  const zoomed = zoom.scale > 1.01;
  const photo = item.kind === "photo";

  return createPortal(
    <div
      ref={surface}
      role="dialog"
      aria-modal="true"
      aria-label={copy.label}
      tabIndex={-1}
      data-theme="dark"
      data-testid="media-viewer"
      data-gesturing={gesturing || undefined}
      data-zoomed={zoomed || undefined}
      className="nf-media-viewer"
      style={style}
    >
      <div className="nf-media-viewer__top">
        <button type="button" className="nf-media-viewer__btn" onClick={close} aria-label={copy.close} data-first="" data-testid="media-viewer-close">
          <UiIcon name="close" size={20} />
        </button>
        <p className="nf-media-viewer__who" data-testid="media-viewer-who">
          <span className="nf-media-viewer__name">{item.name}</span>
          <span className="nf-media-viewer__when">{item.when}</span>
        </p>
        <button type="button" className="nf-media-viewer__btn" onClick={() => void save()} aria-label={copy.save} data-testid="media-viewer-save">
          <UiIcon name="arrow-down" size={20} />
        </button>
        {canShareMedia() ? (
          <button type="button" className="nf-media-viewer__btn" onClick={() => void share()} aria-label={copy.share} data-testid="media-viewer-share">
            <UiIcon name="share" size={20} />
          </button>
        ) : null}
      </div>

      <div
        ref={stage}
        className="nf-media-viewer__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        data-testid="media-viewer-stage"
      >
        {items.map((slide, i) => {
          if (Math.abs(i - index) > 1) return null;
          const active = i === index;
          return (
            <div
              key={slide.id}
              className="nf-media-viewer__slide"
              style={{ "--nf-mv-i": i - index } as CSSProperties}
              data-active={active || undefined}
              aria-hidden={active ? undefined : true}
              data-testid="media-viewer-slide"
              data-id={slide.id}
            >
              <div
                className="nf-media-viewer__zoom"
                style={active && photo ? { transform: `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})` } : undefined}
              >
                {slide.kind === "video" ? (
                  active ? (
                    <SafeVideo
                      src={slide.src}
                      controls
                      autoPlay
                      playsInline
                      preload="auto"
                      aria-label={`${slide.name}, ${copy.video}`}
                      data-testid="media-viewer-video"
                      className="nf-media-viewer__media"
                    />
                  ) : (
                    <span className="nf-media-viewer__still" aria-hidden="true">
                      <UiIcon name="circle-play" size={48} filled />
                    </span>
                  )
                ) : broken[slide.id] ? (
                  <p className="nf-media-viewer__broken">{copy.loadFailed}</p>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URLs cannot go through the optimiser
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    draggable={false}
                    className="nf-media-viewer__media"
                    onLoad={(e) => {
                      naturals.current[slide.id] = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight };
                    }}
                    onError={() => setBroken((prev) => ({ ...prev, [slide.id]: true }))}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            className="nf-media-viewer__btn nf-media-viewer__side nf-media-viewer__side--prev"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label={copy.previous}
            data-testid="media-viewer-prev"
          >
            <UiIcon name="arrow-left" size={20} />
          </button>
          <button
            type="button"
            className="nf-media-viewer__btn nf-media-viewer__side nf-media-viewer__side--next"
            onClick={() => go(index + 1)}
            disabled={index === count - 1}
            aria-label={copy.next}
            data-testid="media-viewer-next"
          >
            <UiIcon name="arrow-right" size={20} />
          </button>
        </>
      ) : null}

      <div className="nf-media-viewer__foot">
        {photo ? (
          <span className="nf-media-viewer__zoomers">
            <button
              type="button"
              className="nf-media-viewer__btn"
              onClick={() => zoomBy(1 / STEP)}
              disabled={!zoomed}
              aria-label={copy.zoomOut}
              data-testid="media-viewer-zoom-out"
            >
              <UiIcon name="minus" size={20} />
            </button>
            <button
              type="button"
              className="nf-media-viewer__btn"
              onClick={() => zoomBy(zoomRef.current.scale === 1 ? DOUBLE_TAP_SCALE : STEP)}
              disabled={zoom.scale >= MAX_SCALE}
              aria-label={copy.zoomIn}
              data-testid="media-viewer-zoom-in"
            >
              <UiIcon name="plus" size={20} />
            </button>
          </span>
        ) : null}
        {count > 1 ? (
          <p className="nf-media-viewer__position nf-numeric" aria-live="polite" data-testid="media-viewer-position">
            {fill(copy.position, { n: index + 1, total: count })}
          </p>
        ) : null}
        {note ? (
          <p className="nf-media-viewer__note" role="status" data-testid="media-viewer-note">
            {note}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
