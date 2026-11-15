/**
 * THE FEEDBACK BANNER (Platform Grade 1, P0.4, November 2026). This store is
 * the one global feedback system: success, info, warning and error, drawn by
 * `ToastHost` as a wide rounded banner at the TOP of the screen, under the
 * status bar (docs/UX_SYSTEM.md, "Feedback"). The founder's brief: "Whenever a
 * user successfully performs an action, show a polished notification banner
 * at the top of the current screen", specific words, a retry on failure, no
 * pile of banners. `banner` is the Grade 1 name; `toast` is the same function,
 * so the existing callers keep working. (Not `feedback`: that is the haptics
 * call in `lib/ui/feedback.ts`, which a banner usually fires beside.)
 *
 *   banner.success("Saved to your list")
 *   banner.error("Message couldn't be sent. Check your connection and try again.", { retry })
 *   banner.info("Saved on your device. Price and availability may have changed.")
 *   banner.warning("Your session ends in 2 minutes")
 *   banner.quick("Message copied")     the small pill at the bottom, see below
 *
 * THE QUEUE, AND WHY IT REPLACES. The newest message replaces the one on
 * screen, with two exceptions so nothing important is lost: the same message
 * fired twice restarts its clock instead of re-animating, and an error stays
 * up for at least `ERROR_HOLD_MS` before a calmer message may take its place
 * (that one waits in a single slot, newest wins).
 *
 * HISTORY. ONE TOAST FOR THE WHOLE APP (details pass, 30 September 2026).
 *
 * The component `Toast` gave the platform one material, but every caller
 * still mounted its own copy wherever it happened to sit in the tree, so two
 * toasts could stack, a toast fired inside a sheet was painted where that
 * sheet put it, and nothing could be swiped away. This is the other half: one
 * store, one host (`components/ui/ToastHost.tsx`, mounted once in the root
 * layout), one placement above the dock, one timing, dismiss by swipe.
 *
 *   toast("Link copied")                     neutral, polite
 *   toast("Saved", { tone: "success" })      a check, polite
 *   toast("That failed", { tone: "error" })  announced at once, longer dwell
 *   toast("Hidden", { action: { label: "Undo", run } })
 *
 * The newest message replaces the one on screen: a toast is "what just
 * happened", and a queue of them is a log nobody asked for.
 *
 * Framework free and safe to import on the server (nothing runs until a
 * caller shows something in a browser).
 */

export type ToastTone = "neutral" | "success" | "info" | "warning" | "error";

export type ToastAction = { label: string; run: () => void };

export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
  /** How long it stays, in ms. The host pauses the clock while it is touched. */
  durationMs: number;
  /** When it went up, for the error hold. */
  shownAt: number;
  /** A person's avatar URL, shown as a small circle beside the message. */
  avatarUrl?: string;
  "data-testid"?: string;
};

export type ToastOptions = {
  tone?: ToastTone;
  action?: ToastAction;
  /** Sugar for an action labelled "Try again" (`retryLabel` to change the words). */
  retry?: () => void;
  retryLabel?: string;
  durationMs?: number;
  /** A person's avatar URL, shown as a small circle beside the message. */
  avatarUrl?: string;
  "data-testid"?: string;
};

/** An error is never replaced by a calmer message sooner than this. */
export const ERROR_HOLD_MS = 1500;

/**
 * Long enough to read a short confirmation; an error or an undo gets longer.
 * 2,400ms is the motion inventory's dwell (north star 7.1, moment 8): a toast
 * confirms something the person just did, so it reads at a glance and goes,
 * and the host pauses the clock while it is touched. Anything that needs
 * reading or acting on keeps the longer 6,000ms below.
 */
/* Grade 1: 3,200ms, up from 2,400, because the banner now carries a whole
   sentence at the top of the screen ("Your profile has been updated") rather
   than two words above the dock. */
export const TOAST_DWELL_MS = 3200;
export const TOAST_DWELL_LONG_MS = 6000;

/**
 * A BANNER RAISED THIS CLOSE BEFORE A ROUTE CHANGE IS CARRIED ONTO THE NEXT
 * PAGE; ONE OLDER THAN THIS LEAVES WITH THE PAGE IT WAS ABOUT.
 *
 * The founder (13 November 2026): banners "sometimes take time and sometimes
 * vanish too fast" around going back. Both came from having no rule at all: a
 * banner was free to outlive its page for six seconds, or to be swapped out by
 * whatever the next page said on arrival. The rule now:
 *
 *   - raised under `BANNER_CARRY_MS` before the route changed: it is the
 *     confirmation of the tap that navigated ("Signed in", "Listing
 *     published"), so it stays and keeps its whole dwell on the new page;
 *   - older: it is about the page that is going, so it leaves with it, on its
 *     normal exit (`leave`, never an unmount), after at least a second on
 *     screen, so it never reads as a flicker.
 *
 * Only the path counts as a route change: a filter written into the query
 * string is the same page.
 */
export const BANNER_CARRY_MS = 1000;

/**
 * THE ONE TIMING CONTRACT, in one object, for every surface that drops a
 * banner from the top (the feedback banner here and the notification banner
 * in `components/app/notify`). The visual durations are tokens
 * (`--nf-duration-base` in, `--nf-duration-fast` out, each 1ms under reduced
 * motion and set by the Motion preference); the numbers here are the clocks
 * that JavaScript owns.
 */
export const BANNER_TIMING = {
  /** On screen from the tap: the banner is raised in the same task as the tap, never after a server answer. */
  raise: "on-tap",
  /** A confirmation. */
  dwellMs: TOAST_DWELL_MS,
  /** An error, a warning, or anything with an action (Undo, Try again). */
  dwellLongMs: TOAST_DWELL_LONG_MS,
  /** The least time a paused clock is given back when the finger lifts. */
  minResumeMs: 1200,
  /** How long an error holds the screen before a calmer message may replace it. */
  errorHoldMs: 1500,
  /** See `BANNER_CARRY_MS`. */
  carryAcrossRouteMs: BANNER_CARRY_MS,
  /** The token each phase runs on. */
  enterToken: "--nf-duration-base",
  exitToken: "--nf-duration-fast",
} as const;

/** The dwell a message gets when the caller does not name one. */
export function dwellFor(tone: ToastTone, hasAction: boolean): number {
  return tone === "error" || tone === "warning" || hasAction ? TOAST_DWELL_LONG_MS : TOAST_DWELL_MS;
}

/** The exit token's default, for a server render or a page without tokens. */
const EXIT_FALLBACK_MS = 160;

/**
 * How long a leaving banner stays mounted: the exit token as the page has it
 * right now, so the Motion setting and reduced motion (1ms) are obeyed rather
 * than a number written in JavaScript that only matches the default.
 */
export function bannerExitMs(): number {
  if (typeof window === "undefined" || typeof document === "undefined") return EXIT_FALLBACK_MS;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(BANNER_TIMING.exitToken).trim();
    const value = raw.endsWith("ms") ? parseFloat(raw) : raw.endsWith("s") ? parseFloat(raw) * 1000 : NaN;
    return Number.isFinite(value) && value >= 0 ? Math.min(value, 600) : EXIT_FALLBACK_MS;
  } catch {
    return EXIT_FALLBACK_MS;
  }
}

type Listener = (item: ToastItem | null) => void;

let current: ToastItem | null = null;
/** One message waiting behind an error that has not had its hold yet. */
let waiting: ToastItem | null = null;
let waitTimer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(current);
}

function now(): number {
  return Date.now();
}

function promoteWaiting() {
  if (waitTimer !== null) {
    clearTimeout(waitTimer);
    waitTimer = null;
  }
  if (!waiting) return;
  current = { ...waiting, shownAt: now() };
  waiting = null;
  emit();
}

function show(message: string, options: ToastOptions = {}): number {
  const tone = options.tone ?? "neutral";
  const action: ToastAction | undefined =
    options.action ?? (options.retry ? { label: options.retryLabel ?? "Try again", run: options.retry } : undefined);

  /* The same words again: keep the banner, restart its clock, never a second
     slide-in. The id is KEPT (the host keys the card on it, so a new id was a
     remount and a second entrance); the host restarts the clock on `shownAt`. */
  if (current && current.message === message && current.tone === tone && !action && !current.action) {
    current = { ...current, shownAt: now() };
    emit();
    return current.id;
  }

  const item: ToastItem = {
    id: nextId++,
    message,
    tone,
    durationMs: options.durationMs ?? dwellFor(tone, Boolean(action)),
    shownAt: now(),
    ...(action ? { action } : {}),
    ...(options.avatarUrl ? { avatarUrl: options.avatarUrl } : {}),
    ...(options["data-testid"] ? { "data-testid": options["data-testid"] } : {}),
  };

  /* An error keeps the screen for its hold before something calmer replaces it. */
  if (current && current.tone === "error" && tone !== "error") {
    const left = ERROR_HOLD_MS - (now() - current.shownAt);
    if (left > 0) {
      waiting = item;
      if (waitTimer !== null) clearTimeout(waitTimer);
      waitTimer = setTimeout(promoteWaiting, left);
      return item.id;
    }
  }

  current = item;
  emit();
  return item.id;
}

/** Take a message down. With an id, only if it is still the one showing. */
export function dismissToast(id?: number): void {
  if (waiting && id !== undefined && waiting.id === id) {
    waiting = null;
    return;
  }
  if (!current) return;
  if (id !== undefined && current.id !== id) return;
  current = null;
  if (waiting) {
    promoteWaiting();
    return;
  }
  emit();
}

/**
 * Change what a banner on screen says WITHOUT a second entrance: the same id,
 * so the host keeps the card and its clock. For the case an optimistic banner
 * learns a detail from the server ("Saved" turns out to be "Saved on this
 * device", or the tap was kept for later). A failure is not an update: it is
 * a new `banner.error`, which comes in on its own entrance and dwell.
 * Returns false when that banner is no longer the one showing.
 */
export function updateToast(
  id: number,
  patch: { message?: string; tone?: ToastTone; action?: ToastAction | null },
): boolean {
  if (!current || current.id !== id) return false;
  const next: ToastItem = { ...current };
  if (patch.message !== undefined) next.message = patch.message;
  if (patch.tone !== undefined) next.tone = patch.tone;
  if (patch.action === null) delete next.action;
  else if (patch.action !== undefined) next.action = patch.action;
  current = next;
  emit();
  return true;
}

/**
 * The route changed (the PATH, not the query). Applies `BANNER_CARRY_MS`: a
 * banner raised just before is carried, an older one leaves with its page.
 * Anything waiting behind an error belonged to the old page too.
 */
export function noteRouteChange(at: number = now()): void {
  if (waiting && at - waiting.shownAt >= BANNER_CARRY_MS) {
    waiting = null;
    if (waitTimer !== null) {
      clearTimeout(waitTimer);
      waitTimer = null;
    }
  }
  if (!current) return;
  if (at - current.shownAt < BANNER_CARRY_MS) return;
  current = null;
  if (waiting) {
    promoteWaiting();
    return;
  }
  emit();
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentToast(): ToastItem | null {
  return current;
}

/*
 * THE QUICK PILL (the founder, 14 November 2026, with WhatsApp's "Message
 * copied" as the reference: "built clean sharp and goes back by itself").
 *
 * The second, lighter voice of the same system, for the small things a person
 * just did and does not need to read twice: copied, saved, removed. A compact
 * pill with a tick, at the BOTTOM of the screen above the composer or the
 * dock, drawn by the same `ToastHost`. It has its own slot, so it never takes
 * down a banner that matters (an error at the top stays while "Link copied"
 * comes and goes underneath), and there is one pill at a time.
 *
 *   banner.quick("Message copied")
 *
 * WHAT IT MAY NOT CARRY: an error, a warning, an undo or a retry. A pill is
 * gone before it could be pressed; anything that needs reading or acting on
 * is `banner.error` or a banner with an action, at the top.
 *
 * THE CLOCK. In on `--nf-duration-fast` (160ms), held `holdMs`, out in
 * `exitMs` (his number, 0.4 seconds). The whole pill on screen for 0.4
 * seconds could not be read, so 0.4 is the leaving and 1.4 the staying. The
 * same words again restart the clock in place, with no second entrance.
 */
export type QuickItem = {
  id: number;
  message: string;
  /** When it went up (or was said again), for the hold. */
  shownAt: number;
  "data-testid"?: string;
};

export const QUICK_TIMING = {
  /** The token the entrance runs on. */
  enterToken: "--nf-duration-fast",
  /** How long it stays before it starts to leave. */
  holdMs: 1400,
  /** How long the leaving takes. */
  exitMs: 400,
} as const;

type QuickListener = (item: QuickItem | null) => void;

let quick: QuickItem | null = null;
const quickListeners = new Set<QuickListener>();

function emitQuick() {
  for (const listener of quickListeners) listener(quick);
}

/** Say a small confirmation in the pill. Returns its id. */
export function showQuick(message: string, options: { "data-testid"?: string } = {}): number {
  if (quick && quick.message === message) {
    quick = { ...quick, shownAt: now() };
    emitQuick();
    return quick.id;
  }
  quick = {
    id: nextId++,
    message,
    shownAt: now(),
    ...(options["data-testid"] ? { "data-testid": options["data-testid"] } : {}),
  };
  emitQuick();
  return quick.id;
}

/** Take the pill down. With an id, only if it is still the one showing. */
export function dismissQuick(id?: number): void {
  if (!quick) return;
  if (id !== undefined && quick.id !== id) return;
  quick = null;
  emitQuick();
}

/**
 * Change what the pill on screen says without a second entrance (the same id,
 * and the hold starts again so the new words can be read): "Saved" turns out
 * to be "Saved on this device". False when that pill is no longer showing.
 */
export function updateQuick(id: number, message: string): boolean {
  if (!quick || quick.id !== id) return false;
  quick = { ...quick, message, shownAt: now() };
  emitQuick();
  return true;
}

export function subscribeQuick(listener: QuickListener): () => void {
  quickListeners.add(listener);
  return () => {
    quickListeners.delete(listener);
  };
}

export function currentQuick(): QuickItem | null {
  return quick;
}

type Toned = (message: string, options?: Omit<ToastOptions, "tone">) => number;

type ToastFn = ((message: string, options?: ToastOptions) => number) & {
  success: Toned;
  info: Toned;
  warning: Toned;
  error: Toned;
  /** The quick pill at the bottom: "Message copied". Never an error, an undo or a retry. */
  quick: typeof showQuick;
  dismiss: typeof dismissToast;
};

export const toast: ToastFn = Object.assign(
  (message: string, options?: ToastOptions) => show(message, options),
  {
    success: ((message, options) => show(message, { ...options, tone: "success" })) as Toned,
    info: ((message, options) => show(message, { ...options, tone: "info" })) as Toned,
    warning: ((message, options) => show(message, { ...options, tone: "warning" })) as Toned,
    error: ((message, options) => show(message, { ...options, tone: "error" })) as Toned,
    quick: showQuick,
    dismiss: dismissToast,
  },
);

/** The Grade 1 name for the same system (docs/UX_SYSTEM.md, "Feedback"). */
export const banner = toast;

/**
 * Whether a swipe has gone far enough, or fast enough, to take the toast down.
 * Pure, so the gesture's one decision is tested without a pointer.
 */
export function swipeDismisses(distancePx: number, velocityPxPerMs: number): boolean {
  return Math.abs(distancePx) > 64 || Math.abs(velocityPxPerMs) > 0.45;
}
