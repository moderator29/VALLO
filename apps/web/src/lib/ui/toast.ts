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
  "data-testid"?: string;
};

export type ToastOptions = {
  tone?: ToastTone;
  action?: ToastAction;
  /** Sugar for an action labelled "Try again" (`retryLabel` to change the words). */
  retry?: () => void;
  retryLabel?: string;
  durationMs?: number;
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

/** The dwell a message gets when the caller does not name one. */
export function dwellFor(tone: ToastTone, hasAction: boolean): number {
  return tone === "error" || tone === "warning" || hasAction ? TOAST_DWELL_LONG_MS : TOAST_DWELL_MS;
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

  /* The same words again: keep the banner, restart its clock (a new id does
     that in the host), never a second slide-in. */
  if (current && current.message === message && current.tone === tone && !action && !current.action) {
    current = { ...current, id: nextId++, shownAt: now() };
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

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentToast(): ToastItem | null {
  return current;
}

type Toned = (message: string, options?: Omit<ToastOptions, "tone">) => number;

type ToastFn = ((message: string, options?: ToastOptions) => number) & {
  success: Toned;
  info: Toned;
  warning: Toned;
  error: Toned;
  dismiss: typeof dismissToast;
};

export const toast: ToastFn = Object.assign(
  (message: string, options?: ToastOptions) => show(message, options),
  {
    success: ((message, options) => show(message, { ...options, tone: "success" })) as Toned,
    info: ((message, options) => show(message, { ...options, tone: "info" })) as Toned,
    warning: ((message, options) => show(message, { ...options, tone: "warning" })) as Toned,
    error: ((message, options) => show(message, { ...options, tone: "error" })) as Toned,
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
