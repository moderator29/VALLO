/**
 * THE ANDROID TOUCH RIPPLE (Agent NATIVE, job 1, 7 November 2026).
 *
 * Brief section 11: Material-inspired touch feedback on Android, while iOS
 * keeps its press highlight and dim. On Android a press is answered the way the
 * platform answers it: a soft ink spreads from under the finger across the
 * pressed control, holds while the finger stays, and fades when it lifts. Icon
 * buttons get the round, centred version. Started only inside the Android
 * shell (`lib/native/boot.ts`), so the website and iOS never load this file.
 *
 * WHY AN OVERLAY AND NOT A CHILD OR A PSEUDO-ELEMENT. A child span inside the
 * pressed control would become its `:last-child` for a third of a second and
 * every `> :last-child` rule in the product would jump; `::before` and
 * `::after` are already taken by the buttons' sheen, the chips' rings and the
 * cards' edges. So the ink is drawn in ONE fixed layer above the control, cut
 * to the control's box and radius, and the control's DOM and styles are never
 * touched.
 *
 * CHEAP ON A BUDGET PHONE. Per press: one `getBoundingClientRect`, one
 * `getComputedStyle`, two nodes, and two compositor-only animations
 * (`transform` and `opacity`). Nothing per frame on the main thread, nothing
 * at all while scrolling.
 *
 * A SCROLL IS NOT A PRESS. Android waits its tap timeout before it draws a
 * press inside a scrolling list, so a fling never lights up every row it
 * passes. The same here: the ink starts `PRESS_DELAY_MS` after the finger lands,
 * or at once when the finger lifts sooner (a quick tap), and a finger that
 * moves past `SLOP_PX` or a `pointercancel` (the browser taking the gesture for
 * a scroll) takes it away.
 *
 * REDUCED MOTION, CALM AND OFF: the ink does not travel. The whole control
 * takes the pressed tint at once and lets it go on release: feedback without
 * movement.
 */

export type Box = { left: number; top: number; width: number; height: number };
export type RippleGeometry = {
  /** The layer: the pressed control's box, cut to what is on screen. */
  host: Box;
  /** The ink circle, in the host's coordinates: its centre and diameter. */
  ink: { x: number; y: number; size: number };
  /** Icon buttons and other small round controls: a centred circle. */
  round: boolean;
};

/** Android's own tap timeout is 100ms; a little less reads as immediate. */
export const PRESS_DELAY_MS = 80;
/** Movement that turns a press into a drag (Android's touch slop is 8dp). */
export const SLOP_PX = 10;
/** The pressed tint at its height, over the control's own text colour. */
export const INK_OPACITY = 0.14;
/** A control bigger than this share of the screen is a surface, not a control. */
const MAX_AREA_SHARE = 0.7;
/** Small and square: an icon button, a round avatar control. */
const ROUND_MAX_PX = 56;
const ROUND_ASPECT_SLACK_PX = 8;
/** A tap that lifts at once still shows its ink for at least this long. */
const MIN_VISIBLE_MS = 140;

/** What takes a ripple. The nearest one to the finger wins. */
export const RIPPLE_TARGETS =
  'a[href], button, summary, label.nf-srow, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="link"], [role="switch"], [role="radio"], [role="checkbox"]';

/** What never takes one: typing, the dock (it has its own ink and haptic), opt outs. */
const RIPPLE_EXCLUDED =
  ':disabled, [aria-disabled="true"], [data-ripple="none"], [data-press="none"], .nf-skip-link, input, textarea, select, [contenteditable="true"]';
const RIPPLE_EXCLUDED_INSIDE = '.nf-tabbar, [data-ripple="none"]';

/**
 * The geometry of one ripple, or null when there is nothing to draw (the
 * control is off screen, empty, or so large that it is a surface).
 */
export function rippleGeometry(rect: Box, point: { x: number; y: number }, viewport: { width: number; height: number }): RippleGeometry | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (rect.width * rect.height > viewport.width * viewport.height * MAX_AREA_SHARE) return null;

  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.left + rect.width, viewport.width);
  const bottom = Math.min(rect.top + rect.height, viewport.height);
  if (right <= left || bottom <= top) return null;
  const host = { left, top, width: right - left, height: bottom - top };

  const round =
    rect.width <= ROUND_MAX_PX && rect.height <= ROUND_MAX_PX && Math.abs(rect.width - rect.height) <= ROUND_ASPECT_SLACK_PX;
  if (round) {
    return {
      host,
      ink: { x: rect.left + rect.width / 2 - left, y: rect.top + rect.height / 2 - top, size: Math.max(rect.width, rect.height) },
      round,
    };
  }

  /* From under the finger, large enough to reach the farthest corner. */
  const x = Math.min(Math.max(point.x, left), right) - left;
  const y = Math.min(Math.max(point.y, top), bottom) - top;
  const reach = Math.max(Math.hypot(x, y), Math.hypot(host.width - x, y), Math.hypot(x, host.height - y), Math.hypot(host.width - x, host.height - y));
  return { host, ink: { x, y, size: Math.ceil(reach * 2) }, round };
}

/** How long the ink takes to spread: a touch longer across a wide card than a chip. */
export function spreadMs(size: number): number {
  return Math.round(Math.min(480, Math.max(260, size * 0.9)));
}

/** The nearest control that takes a ripple, or null. */
export function rippleTarget(from: Element | null): HTMLElement | null {
  const el = from?.closest(RIPPLE_TARGETS);
  if (!(el instanceof HTMLElement)) return null;
  if (el.matches(RIPPLE_EXCLUDED) || el.closest(RIPPLE_EXCLUDED_INSIDE)) return null;
  return el;
}

type Live = {
  host: HTMLElement;
  ink: HTMLElement;
  shownAt: number;
  still: boolean;
};

function quietMotion(reduced: MediaQueryList | null): boolean {
  const level = document.documentElement.dataset.motion;
  return level === "calm" || level === "off" || reduced?.matches === true;
}

function draw(target: HTMLElement, point: { x: number; y: number }, reduced: MediaQueryList | null): Live | null {
  const r = target.getBoundingClientRect();
  const geometry = rippleGeometry(
    { left: r.left, top: r.top, width: r.width, height: r.height },
    point,
    { width: window.innerWidth, height: window.innerHeight },
  );
  if (!geometry) return null;
  const style = getComputedStyle(target);
  /* Inline text (a link inside a sentence) wraps across lines: its box is not
     the shape the reader sees, so it keeps the shared tint only. */
  if (style.display === "inline") return null;

  const host = document.createElement("div");
  host.className = "nf-ripple";
  host.setAttribute("aria-hidden", "true");
  const { left, top, width, height } = geometry.host;
  host.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px;border-radius:${geometry.round ? "50%" : style.borderRadius || "0"}`;

  const ink = document.createElement("span");
  ink.className = "nf-ripple__ink";
  const still = quietMotion(reduced);
  const size = still ? Math.ceil(Math.hypot(width, height)) * 2 : geometry.ink.size;
  const cx = still ? width / 2 : geometry.ink.x;
  const cy = still ? height / 2 : geometry.ink.y;
  ink.style.cssText = `width:${size}px;height:${size}px;left:${cx - size / 2}px;top:${cy - size / 2}px;background-color:${style.color}`;
  host.appendChild(ink);
  document.body.appendChild(host);

  try {
    if (still) {
      ink.animate([{ opacity: 0 }, { opacity: INK_OPACITY }], { duration: 1, fill: "forwards" });
    } else {
      ink.animate([{ transform: "scale(0.12)" }, { transform: "scale(1)" }], {
        duration: spreadMs(size),
        easing: "cubic-bezier(0.2, 0, 0, 1)",
        fill: "forwards",
      });
      ink.animate([{ opacity: 0 }, { opacity: INK_OPACITY }], { duration: 75, easing: "linear", fill: "forwards" });
    }
  } catch {
    /* No Web Animations: the ink shows at its resting style and still goes. */
    ink.style.opacity = String(INK_OPACITY);
  }
  return { host, ink, shownAt: performance.now(), still };
}

function release(live: Live, fast = false): void {
  const held = performance.now() - live.shownAt;
  const wait = fast ? 0 : Math.max(0, MIN_VISIBLE_MS - held);
  const remove = () => live.host.remove();
  window.setTimeout(() => {
    try {
      const fade = live.ink.animate([{ opacity: getComputedStyle(live.ink).opacity }, { opacity: 0 }], {
        duration: fast ? 90 : live.still ? 150 : 220,
        easing: "cubic-bezier(0.4, 0, 1, 1)",
        fill: "forwards",
      });
      fade.onfinish = remove;
      fade.oncancel = remove;
      /* A ceiling, in case the animation never reports back (a hidden tab). */
      window.setTimeout(remove, 600);
    } catch {
      remove();
    }
  }, wait);
}

/**
 * Listen for presses on the whole document and draw the ripple. Returns the
 * teardown, which also takes away any ink still on screen.
 */
export function startRipple(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  let reduced: MediaQueryList | null = null;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  } catch {
    reduced = null;
  }

  type Press = { id: number; target: HTMLElement; x: number; y: number; timer: number; live: Live | null };
  let press: Press | null = null;

  const begin = (p: Press) => {
    window.clearTimeout(p.timer);
    if (!p.live) p.live = draw(p.target, { x: p.x, y: p.y }, reduced);
  };
  const end = (fast: boolean) => {
    const p = press;
    press = null;
    if (!p) return;
    window.clearTimeout(p.timer);
    if (p.live) release(p.live, fast);
  };

  const onDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    end(true);
    const target = rippleTarget(event.target instanceof Element ? event.target : null);
    if (!target) return;
    const next: Press = { id: event.pointerId, target, x: event.clientX, y: event.clientY, timer: 0, live: null };
    next.timer = window.setTimeout(() => begin(next), PRESS_DELAY_MS);
    press = next;
  };
  const onMove = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP_PX) end(true);
  };
  const onUp = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    /* A quick tap: the finger lifted before the press delay. Show it now. */
    begin(press);
    end(false);
  };
  const onCancel = (event: PointerEvent) => {
    if (press && event.pointerId === press.id) end(true);
  };
  /* The page going away mid-press (a navigation, the app backgrounded). */
  const onHide = () => end(true);

  const opts: AddEventListenerOptions = { capture: true, passive: true };
  document.addEventListener("pointerdown", onDown, opts);
  document.addEventListener("pointermove", onMove, opts);
  document.addEventListener("pointerup", onUp, opts);
  document.addEventListener("pointercancel", onCancel, opts);
  document.addEventListener("visibilitychange", onHide);

  return () => {
    end(true);
    document.removeEventListener("pointerdown", onDown, opts);
    document.removeEventListener("pointermove", onMove, opts);
    document.removeEventListener("pointerup", onUp, opts);
    document.removeEventListener("pointercancel", onCancel, opts);
    document.removeEventListener("visibilitychange", onHide);
    document.querySelectorAll(".nf-ripple").forEach((n) => n.remove());
  };
}
