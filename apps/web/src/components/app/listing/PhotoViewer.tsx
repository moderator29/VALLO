"use client";

import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode, TouchEvent as ReactTouchEvent } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { useOverlay } from "@/lib/ui/use-overlay";
import { useStatusBarHold } from "@/lib/native/status-bar-hold";
import { readSheetMarker } from "@/lib/ui/use-sheet-history";
import type { ListingKind } from "@/lib/listings/types";
import { PhotoFrame } from "./PhotoFrame";
import { clockOf, photosAsMedia, type GalleryMedia } from "./gallery-media";
import { useClientMount } from "@/lib/ui/client-mount";
import { useMotionGate } from "@/components/motion/useMotionGate";
import "@/app/css/catalogue.css";
import { SafeVideo } from "@/components/app/media/SafeVideo";

/**
 * The listing lightbox.
 *
 * Tapping a listing photograph used to do nothing at all - not in the hero, not
 * anywhere else on the platform. This is the one surface that opens the
 * photography full screen, and it is shared rather than duplicated: the hero and
 * the photo grid both sit under one provider and call `open(index)`, so a single
 * viewer instance is mounted per page and the two can never disagree about which
 * photo is showing.
 *
 * It behaves the way a native photo viewer behaves: the track is a real
 * scroll-snapping row so a swipe is the browser's own, arrow keys move between
 * frames, Escape closes, page scroll is locked while it is open, and focus goes
 * back to whatever opened it. The entrance is a fade plus a small scale, and
 * under `prefers-reduced-motion` it collapses to the fade alone.
 *
 * PHOTO OPEN IS A SHARED-ELEMENT ZOOM (MOTION_SYSTEM "Content and feed",
 * north star motion 18). When the opener hands over the rectangle of the
 * thumbnail that was tapped, the photograph grows OUT OF THAT THUMBNAIL into
 * the viewer rather than fading up in the middle of the screen, while the dark
 * ground fades in behind it; closing from inside folds it back into the same
 * rectangle. The person never loses the photograph: that is what the motion
 * says. It is measured, not guessed (`getBoundingClientRect` on both ends),
 * one uniform scale so the photograph is never squashed, on the `land` curve
 * in, `leave` out, transform and opacity only, through the Web Animations API
 * because it is a known track with a known end. Durations and curves are READ
 * FROM THE TOKENS at run time, so reduced motion (which collapses the tokens
 * to 1ms) and the Calm and Off settings (`useMotionGate().quiet`, which skips
 * the morph entirely) are honoured without a second code path.
 */

type ViewerOptions = {
  /** False when the opener is about to disappear (the "Show all" sheet). */
  foldBack?: boolean;
  /**
   * The opener can show any photo in the tapped frame (the hero's own track).
   * On close the viewer asks it to show the photo the reader ended on, and
   * folds into the frame even when that is not the photo first tapped.
   */
  follow?: (index: number) => void;
};

type ViewerApi = {
  /**
   * Opens the viewer on a given photo index. No-op when there is nothing to
   * show. `origin` is the tapped thumbnail's rectangle, for the zoom.
   */
  open(index: number, origin?: DOMRect | null, options?: ViewerOptions): void;
};

const PhotoViewerContext = createContext<ViewerApi | null>(null);

/** The viewer is optional: a listing with no photography renders no provider. */
export function usePhotoViewer(): ViewerApi | null {
  return useContext(PhotoViewerContext);
}

export function PhotoViewerProvider({
  title,
  photos,
  media,
  hue,
  kind,
  children,
}: {
  title: string;
  /** Photo URLs, best first. */
  photos: string[];
  /**
   * Photos and videos in the lister's order (`gallery-media.ts`). Optional:
   * without it the viewer shows `photos`, as it always has.
   */
  media?: GalleryMedia[];
  hue: number;
  /**
   * Which market this is, so the frame drawn behind a missing photograph is a
   * drawing of THIS kind of place rather than the same city skyline every
   * listing used to get. See `MediaFrame`.
   */
  kind: ListingKind;
  children: ReactNode;
}) {
  const items = useMemo(() => (media && media.length > 0 ? media : photosAsMedia(photos)), [media, photos]);
  const [index, setIndex] = useState<number | null>(null);
  const [origin, setOrigin] = useState<DOMRect | null>(null);
  const [foldBack, setFoldBack] = useState(true);
  const [follow, setFollow] = useState<{ to: (index: number) => void } | null>(null);

  const api = useMemo<ViewerApi>(
    () => ({
      open(next: number, from?: DOMRect | null, options?: ViewerOptions) {
        if (items.length === 0) return;
        setOrigin(from ?? null);
        setFoldBack(options?.foldBack !== false);
        setFollow(options?.follow ? { to: options.follow } : null);
        setIndex(Math.max(0, Math.min(items.length - 1, next)));
      },
    }),
    [items.length],
  );

  return (
    <PhotoViewerContext.Provider value={api}>
      {children}
      {index !== null && (
        <Lightbox
          title={title}
          items={items}
          hue={hue}
          kind={kind}
          startIndex={index}
          origin={origin}
          foldBack={foldBack}
          follow={follow?.to ?? null}
          onClose={() => setIndex(null)}
        />
      )}
    </PhotoViewerContext.Provider>
  );
}

const FOCUSABLE = 'button:not([disabled]),[tabindex]:not([tabindex="-1"])';

function Lightbox({
  title,
  items,
  hue,
  kind,
  startIndex,
  origin,
  foldBack,
  follow,
  onClose,
}: {
  title: string;
  items: GalleryMedia[];
  hue: number;
  kind: ListingKind;
  startIndex: number;
  /** The tapped thumbnail's rectangle, or null for a plain fade. */
  origin: DOMRect | null;
  /** False when the opener is about to disappear (the "Show all" sheet). */
  foldBack: boolean;
  /** The opener shows a given photo in the tapped frame, or null. */
  follow: ((index: number) => void) | null;
  onClose(): void;
}) {
  const track = useRef<HTMLDivElement | null>(null);
  const surface = useRef<HTMLDivElement | null>(null);
  /* One hook, four call sites. This was `useState(false)` plus
     `useEffect(() => setMounted(true), [])` in this file and in three others,
     which is a second render scheduled for a fact React already knew. See
     `client-mount.ts`. */
  const mounted = useClientMount();
  const { quiet } = useMotionGate();
  /* Decided once, on open: a zoom needs a rectangle to grow from and a reader
     who has not asked for less motion. Otherwise the existing fade. */
  const [morph] = useState(() => origin !== null && origin.width > 0 && !quiet);
  /* The zoom carries the entrance itself, so the surface starts opaque. */
  const [entered, setEntered] = useState(morph);
  const [active, setActive] = useState(startIndex);
  const [broken, setBroken] = useState<Record<number, true>>({});


  /*
   * The surface mounts at its closed state and flips open on the next frame, so
   * the transition has a starting frame to run from. Without it the browser
   * paints the end state immediately and the viewer materialises rather than
   * arriving - the same reason the Sheet primitive does this.
   */
  useEffect(() => {
    if (!mounted) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [mounted]);

  /*
   * Escape, the Tab trap, the scroll lock and the focus return, from the one
   * shared implementation rather than a fourth copy of three quarters of it.
   *
   * The lock is the reason this matters here in particular. A lightbox opens
   * from inside the "Show all photos" sheet, which is already holding the page
   * still. The version this replaces set `body.style.overflow` outright and
   * restored what it had captured, so closing the photo handed scrolling back
   * to a page nobody could see, underneath a sheet that was still open. The
   * hook counts its openers, so the page only moves again when the last one
   * has gone.
   */
  /*
   * THE VIEWER IS A HISTORY ENTRY, so the way out is always the one a person
   * already knows. Opening pushes an entry on the same address (the App
   * Router's own state spread in, or it reloads on the way back, the same
   * reason `FirstRun` does it), so the browser's back, the iPhone edge swipe
   * and Android's hardware back close the photographs FIRST and leave the
   * listing where it was. Closing from inside (the X, Escape, a swipe down)
   * pops that entry itself, so history never keeps a dead viewer entry that
   * would make the next back press look like it did nothing.
   */
  const pushed = useRef(false);
  /* Read through a ref so a new `onClose` identity from the provider can never
     re-run the effect below and push a second entry. */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!mounted) return;
    try {
      /* Already on our own entry is React's development double-mount, not a
         second opening: pushing again would cost the reader a second back. */
      const current = (window.history.state ?? {}) as Record<string, unknown>;
      if (current.nfPhotoViewer) {
        /* already ours */
      } else if (readSheetMarker(current)) {
        /* Opened from the "Show all" sheet, which closes as this opens. The
           sheet's entry is REUSED rather than stacked on: the sheet's own
           hook only pops its entry while its marker is on top, so pushing
           over it would leave a dead entry behind and cost the reader a
           back press that does nothing. The marker is dropped, so the sheet
           leaves history alone. */
        const { nfSheet: _sheet, ...rest } = current;
        window.history.replaceState({ ...rest, nfPhotoViewer: true }, "");
      } else {
        window.history.pushState({ ...current, nfPhotoViewer: true }, "");
      }
      pushed.current = true;
    } catch {
      /* A sandbox that refuses history still gets the X, Escape and the swipe. */
    }
    const onPop = () => {
      pushed.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [mounted]);

  /* Closing from inside folds the photograph back into its thumbnail; the
     history pop that does the real close waits for the fold.

     ROUND 5. It folded only while the photo on screen was the one first
     tapped and nothing was mid-drag; otherwise the viewer vanished in one
     frame, which is most closes (people swipe, then close; or swipe down).
     Now:
       - a frame that can follow (the hero's own track) is first moved to the
         photo the reader ended on, out of sight under the viewer, and the
         photograph folds into it: the same picture lands where it goes;
       - a dismissing drag folds FROM WHERE THE FINGER LEFT IT. The track is
         still carrying the drag's transform, so the pane's fold is written
         relative to it, and the two compose into one move to the frame,
         with the ground fading on from wherever the drag had taken it. */
  const folding = useRef(false);
  /* The zoom out of the thumbnail still running, and the fold back into it:
     held so a close mid-open measures the pane at rest, and so nothing is
     left animating (or calling back) once the viewer has gone. */
  const opening = useRef<Animation[]>([]);
  const folds = useRef<Animation[]>([]);
  const fold = useCallback((then: () => void, held?: { dy: number; scale: number; fade: number }) => {
    const ground = surface.current;
    const el = track.current;
    const at = el ? Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) : startIndex;
    const pane = el?.children[at];
    const canLand = at === startIndex || follow !== null;
    if (!morph || !foldBack || !origin || !canLand || !(pane instanceof HTMLElement) || !ground || folding.current) {
      then();
      return;
    }
    folding.current = true;
    /* Cancelled BEFORE measuring: a pane caught mid-zoom reports its scaled,
       translated box, and the fold would then fly back from the wrong place. */
    for (const run of opening.current) run.cancel();
    opening.current = [];
    if (at !== startIndex) follow?.(at);
    /* The pane at rest is the viewer's own box (fixed, full screen); measured
       there rather than on the pane, which may be carrying the drag. */
    const f = flightOf(origin, ground.getBoundingClientRect());
    const to = held
      ? `translate(${f.dx / held.scale}px, ${(f.dy - held.dy) / held.scale}px) scale(${f.scale / held.scale})`
      : `translate(${f.dx}px, ${f.dy}px) scale(${f.scale})`;
    const timing = motionToken("--nf-duration-base", "240ms", "--nf-ease-exit", "cubic-bezier(0.4, 0, 1, 1)");
    const fade = ground.animate([{ opacity: held?.fade ?? 1 }, { opacity: 0 }], { ...timing, fill: "forwards", pseudoElement: "::before" });
    const back = pane.animate([{ transform: "none", opacity: 1 }, { transform: to, opacity: 0.6 }], { ...timing, fill: "forwards" });
    folds.current = [fade, back];
    back.onfinish = then;
    back.oncancel = then;
  }, [morph, foldBack, origin, startIndex, follow]);
  /* Gone mid-fold (a route change under the viewer): stop the fold without
     letting its cancel call the close that already happened. */
  useEffect(
    () => () => {
      for (const run of folds.current) {
        run.onfinish = null;
        run.oncancel = null;
        run.cancel();
      }
      folds.current = [];
    },
    [],
  );

  const closeNow = useCallback(() => {
    if (pushed.current && (window.history.state as { nfPhotoViewer?: boolean } | null)?.nfPhotoViewer) {
      pushed.current = false;
      /* popstate above does the actual close, so there is one path out. */
      window.history.back();
      return;
    }
    onClose();
  }, [onClose]);
  /* Where a dismissing drag has the photograph, read through a ref so this
     callback keeps one identity while the finger moves; the fold starts
     from there (above). */
  const dragAt = useRef(0);
  const close = useCallback(() => {
    if (morph && foldBack) {
      const dy = dragAt.current;
      fold(closeNow, dy > 0 ? dragPose(dy) : undefined);
      return;
    }
    closeNow();
  }, [fold, morph, foldBack, closeNow]);
  useOverlay({ open: mounted, onClose: close, panelRef: surface, autoFocus: false });
  /* N2: the ground is near black in both themes, so the clock and battery
     are drawn light over it while it is open. */
  useStatusBarHold(mounted, "light");

  /*
   * SWIPE DOWN TO DISMISS, the gesture every phone photo viewer teaches.
   *
   * The track is `touch-action: pan-x pinch-zoom`, so a sideways swipe is still
   * the browser's own snap scroll and a pinch still zooms, while a vertical drag
   * is left to this handler instead of doing nothing. The photograph follows
   * the finger and the ground fades with the distance; past a quarter of the
   * way (or on a quick flick) it closes, otherwise it springs back. Only
   * `transform` and `opacity` move. Under reduced motion nothing follows the
   * finger: the gesture still closes past the threshold, it just does not
   * animate on the way.
   */
  const [drag, setDrag] = useState(0);
  useEffect(() => {
    dragAt.current = drag;
  }, [drag]);
  const gesture = useRef<{ x: number; y: number; t: number; axis: "x" | "y" | null } | null>(null);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);
  const onTouchStart = useCallback((event: ReactTouchEvent) => {
    /* Pinched in, a vertical drag is the reader panning the enlarged photo,
       never a dismissal. */
    if (event.touches.length !== 1 || (window.visualViewport?.scale ?? 1) > 1.01) {
      gesture.current = null;
      return;
    }
    const t = event.touches[0]!;
    gesture.current = { x: t.clientX, y: t.clientY, t: performance.now(), axis: null };
  }, []);
  const onTouchMove = useCallback((event: ReactTouchEvent) => {
    const g = gesture.current;
    const t = event.touches[0];
    if (!g || !t || event.touches.length !== 1) return;
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (g.axis === null && Math.hypot(dx, dy) > 8) g.axis = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
    if (g.axis !== "y") return;
    if (!reduced.current) setDrag(Math.max(0, dy));
  }, []);
  const onTouchEnd = useCallback(
    (event: ReactTouchEvent) => {
      const g = gesture.current;
      gesture.current = null;
      if (!g || g.axis !== "y") return;
      const t = event.changedTouches[0];
      const dy = t ? t.clientY - g.y : 0;
      const velocity = dy / Math.max(1, performance.now() - g.t);
      const height = surface.current?.clientHeight ?? 800;
      if (dy > height * 0.22 || (dy > 60 && velocity > 0.6)) {
        close();
        return;
      }
      setDrag(0);
    },
    [close],
  );

  /* First focus, with `preventScroll`: the viewer covers the page it opened
     from, and letting the browser scroll to the control it just focused would
     move that page behind it. Putting focus BACK on close is the hook's, which
     captured the opener before this ran. */
  useEffect(() => {
    if (!mounted) return;
    const node = surface.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus({ preventScroll: true });
  }, [mounted]);

  /* The track opens on the photo that was tapped, not on the first one. */
  useEffect(() => {
    if (!mounted) return;
    const el = track.current;
    if (!el) return;
    el.scrollLeft = startIndex * el.clientWidth;
  }, [mounted, startIndex]);

  /* The zoom out of the thumbnail. Runs once, after the track has been
     scrolled to the tapped photo, so the pane it measures is the one shown. */
  useEffect(() => {
    if (!mounted || !morph || !origin) return;
    const pane = track.current?.children[startIndex];
    const ground = surface.current;
    if (!(pane instanceof HTMLElement) || !ground) return;
    const from = flight(origin, pane.getBoundingClientRect());
    const timing = motionToken("--nf-duration-slow", "380ms", "--nf-ease-entrance", "cubic-bezier(0.16, 1, 0.3, 1)");
    const zoom = pane.animate([{ transform: from, opacity: 0.6 }, { transform: "none", opacity: 1 }], timing);
    const fade = ground.animate([{ opacity: 0 }, { opacity: 1 }], { ...timing, pseudoElement: "::before" });
    opening.current = [zoom, fade];
    return () => {
      zoom.cancel();
      fade.cancel();
      opening.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening, by design
  }, [mounted]);

  const go = useCallback((next: number) => {
    const el = track.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(el.children.length - 1, next));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    setActive(clamped);
  }, []);

  /* The arrows, which are this viewer's own and belong to nothing else. Escape
     and Tab are handled by `useOverlay` above. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(active + 1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(active - 1);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [active, go]);

  const onScroll = useCallback(() => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setActive((current) => (current === next ? current : next));
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={surface}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} photos`}
      tabIndex={-1}
      data-testid="listing-lightbox"
      data-theme="dark"
      data-open={entered}
      data-dragging={drag > 0 ? "" : undefined}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={
        drag > 0
          ? ({
              "--nf-viewer-drag": `${drag}px`,
              "--nf-viewer-fade": String(dragPose(drag).fade),
              "--nf-viewer-scale": String(dragPose(drag).scale),
            } as CSSProperties)
          : undefined
      }
      className={[
        // Above the Sheet primitive's 80/81, so a photo opened from the
        // "Show all" sheet is never painted behind the sheet it came from.
        "nf-photo-viewer fixed inset-0 z-[90] outline-none",
        /* The plain fade (no thumbnail to grow from) on the motion tokens,
           not Tailwind's own 200ms and curve (CRAFT-PRINCIPLES 2.1). */
        "transition-opacity duration-[var(--nf-duration-base)] ease-[var(--nf-ease-standard)] motion-reduce:transition-none",
        "motion-safe:transition-[opacity,transform]",
        entered ? "opacity-100 motion-safe:scale-100" : "opacity-0 motion-safe:scale-[0.98]",
      ].join(" ")}
    >
      <div
        ref={track}
        onScroll={onScroll}
        className="nf-scroll-x nf-photo-viewer__track flex h-full w-full snap-x snap-mandatory"
      >
        {items.map((item, i) => (
          <div
            key={`${item.src}-${i}`}
            className="relative h-full w-full shrink-0 snap-center snap-always overflow-hidden"
          >
            {item.kind === "video" ? (
              /* A video opens PLAYING (it was asked for), muted until the
                 viewer unmutes, with its controls. Only the slide on screen
                 holds a player: swiping away unmounts it, which stops it,
                 and the others show their still. */
              i === active ? (
                <SafeVideo
                  src={item.src}
                  poster={item.poster ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={`${title}, video ${i + 1} of ${items.length}${item.durationSeconds ? `, ${clockOf(item.durationSeconds)}` : ""}`}
                  data-testid="lightbox-video"
                  className="h-full w-full object-contain"
                />
              ) : item.poster ? (
                <Image src={item.poster} alt="" fill sizes="100vw" className="object-contain" />
              ) : (
                <PhotoFrame hue={hue} index={i} kind={kind} />
              )
            ) : broken[i] ? (
              <PhotoFrame hue={hue} index={i} kind={kind} />
            ) : (
              <Image
                src={item.src}
                alt={`${title}, photo ${i + 1} of ${items.length}`}
                fill
                sizes="100vw"
                onError={() => setBroken((prev) => ({ ...prev, [i]: true }))}
                className="object-contain"
              />
            )}
          </div>
        ))}
      </div>

      {/* Chrome sits above the track and clears the notch and the home indicator. */}
      <div className="nf-photo-viewer__chrome pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-sm">
        <Button
          variant="glass"
          size="sm"
          iconOnly
          onClick={close}
          aria-label="Close photos"
          data-testid="lightbox-close"
          className="pointer-events-auto grid h-11 w-11 place-items-center text-[var(--nf-content-on-media)] transition-transform active:scale-90 motion-reduce:transition-none"
        >
          <UiIcon name="close" size={20} />
        </Button>
        <p className="nf-numeric pointer-events-none rounded-xs nf-media-chip nf-media-chip--caption px-sm py-xs font-semibold">
          <span className="sr-only">Photo </span>
          {active + 1} / {items.length}
        </p>
      </div>

      {items.length > 1 && (
        <>
          <Button
            variant="glass"
            size="sm"
            iconOnly
            onClick={() => go(active - 1)}
            disabled={active === 0}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center text-[var(--nf-content-on-media)] disabled:opacity-0 sm:grid"
          >
            <UiIcon name="arrow-left" size={20} />
          </Button>
          <Button
            variant="glass"
            size="sm"
            iconOnly
            onClick={() => go(active + 1)}
            disabled={active === items.length - 1}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center text-[var(--nf-content-on-media)] disabled:opacity-0 sm:grid"
          >
            <UiIcon name="arrow-right" size={20} />
          </Button>
        </>
      )}
    </div>,
    document.body,
  );
}

/**
 * The transform that puts a full-screen pane over the thumbnail it came from:
 * one uniform scale (never squashed) about the pane's centre, and the move
 * between the two centres. Measured on both ends, so it is right at any width.
 */
function flightOf(from: DOMRect, pane: DOMRect): { dx: number; dy: number; scale: number } {
  if (pane.width === 0 || pane.height === 0) return { dx: 0, dy: 0, scale: 1 };
  return {
    scale: Math.max(from.width / pane.width, from.height / pane.height),
    dx: from.left + from.width / 2 - (pane.left + pane.width / 2),
    dy: from.top + from.height / 2 - (pane.top + pane.height / 2),
  };
}

function flight(from: DOMRect, pane: DOMRect): string {
  if (pane.width === 0 || pane.height === 0) return "none";
  const f = flightOf(from, pane);
  return `translate(${f.dx}px, ${f.dy}px) scale(${f.scale})`;
}

/** Where a dismissing drag of `dy` pixels has the photograph and its ground. */
function dragPose(dy: number): { dy: number; scale: number; fade: number } {
  return { dy, scale: 1 - Math.min(dy / 3000, 0.12), fade: 1 - Math.min(dy / 520, 0.75) };
}

/**
 * A duration and a curve READ FROM THE MOTION TOKENS, for the Web Animations
 * API, which cannot read a CSS variable itself. Reduced motion collapses the
 * duration tokens to 1ms in tokens.css, and that reaches this too. The
 * fallbacks are the tokens' own values, for a document where they are absent.
 */
function motionToken(duration: string, durationFallback: string, ease: string, easeFallback: string): KeyframeAnimationOptions {
  const root = getComputedStyle(document.documentElement);
  const raw = root.getPropertyValue(duration).trim() || durationFallback;
  const ms = raw.endsWith("ms") ? Number.parseFloat(raw) : Number.parseFloat(raw) * 1000;
  return {
    duration: Number.isFinite(ms) ? ms : Number.parseFloat(durationFallback),
    easing: root.getPropertyValue(ease).trim() || easeFallback,
  };
}
