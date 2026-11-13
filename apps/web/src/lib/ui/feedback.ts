/**
 * ONE FEEDBACK GRAMMAR, AND HAPTICS THAT EXIST ON AN IPHONE. V-30.
 *
 * ---------------------------------------------------------------------------
 * WHAT WAS WRONG.
 *
 * `components/ui/Button.tsx` called `navigator.vibrate?.(8)` on every press of
 * every primary and danger button. `navigator.vibrate` does not exist in
 * Safari or in WKWebView, so no iPhone has ever felt Vallo. On Android it
 * buzzed identically for "pressed" and for "paid", and it buzzed on the press,
 * before anybody knew whether the action had been accepted: a declined card
 * felt exactly like a settled one.
 *
 * ---------------------------------------------------------------------------
 * FIVE KINDS AND NOTHING ELSE.
 *
 *   select    a tab, a segment, a chip: a choice was taken
 *   confirm   a primary action was ACCEPTED (not tapped)
 *   success   money settled, an inspection confirmed: a ResultSheet in a good
 *             state
 *   warning   a ResultSheet that is pending or under review
 *   error     a ResultSheet that failed
 *
 * The grammar is the point. A settled payment must feel different from a tap,
 * and a refusal different from both, or the phone is making noise rather than
 * saying something. A sixth kind would need an argument that none of these
 * five says it already.
 *
 * ---------------------------------------------------------------------------
 * THREE CHANNELS, CHOSEN IN ORDER.
 *
 *   1. THE NATIVE SHELL, through Capacitor's `Haptics` plugin: impact light
 *      for select, impact medium for confirm, and the system's own
 *      success / warning / error notification patterns, which are what an
 *      iPhone user already knows from Apple Pay.
 *   2. ANDROID WEB, through `navigator.vibrate`, with a distinct pattern per
 *      kind so a success is two beats and an error is three.
 *   3. EVERYWHERE ELSE, NOTHING. iOS Safari has no vibration API; a desktop
 *      has no motor. Silence there is correct, not a fallback.
 *
 * The plugin is reached through `Capacitor.registerPlugin("Haptics")`, the
 * way `components/app/push/enrol.ts` reaches push, and only after
 * `looksNative()` has said this is the shell, so the website never evaluates
 * `@capacitor/core`. If the shell was built without the plugin,
 * `isPluginAvailable` says so and the call falls through to channel 2 (the
 * Android web view has `navigator.vibrate`) or to silence. `@capacitor/haptics`
 * is in `apps/web/package.json` and synced into both shells
 * (`android/capacitor.settings.gradle`, `ios/App/CapApp-SPM/Package.swift`;
 * `haptic-census.test.ts` holds all three), so in the app a select is a real
 * light impact, a confirm a medium one, and success and error the system's own
 * notification patterns (on Android, amplitude-shaped waveforms at 250 and 180).
 * Nothing of it reaches the website's bundle: the import below is lazy.
 *
 * ---------------------------------------------------------------------------
 * THE WEIGHTS (CRAFT_DOCTRINE 6), AND WHERE EACH IS HELD.
 *
 *   select   light: a digit, a chip, a toggle, a tab, a heart
 *   confirm  medium: a primary action accepted, a sheet landing, an unlock
 *   success  heavy: a payoff only (`HEAVY_SITES` and `PAYOFF_MOMENTS`)
 *   error    the one sharp pattern, for a genuine failure
 *   warning  kept in the grammar for the native mapping and the styleguide;
 *            no call site uses it, because there is one error pattern
 *
 * Nothing in a list, a scroll or a passive state vibrates: the census reads
 * every call site and fails on one inside a scroll or move handler, an
 * observer, a timer or a delivery listener.
 *
 * ---------------------------------------------------------------------------
 * REDUCED MOTION TURNS IT DOWN, NOT OFF.
 *
 * Somebody who asked the system for less motion gets success and error only:
 * the two outcomes worth feeling, and nothing for taps, segments or pending.
 *
 * ---------------------------------------------------------------------------
 * EACH KIND HAS ONE MOTION TOKEN.
 *
 * `FEEDBACK_MOTION` pairs each kind with the duration and curve it should move
 * with, so what is felt and what is seen agree: the press curve for select
 * and confirm, the spring for success, the press curve for warning and error
 * because a failure should not bounce.
 */

import { looksNative, nativePlatform } from "@/lib/native/platform";
import { readMotion } from "@/lib/motion/motion-pref";

export type FeedbackKind = "select" | "confirm" | "success" | "warning" | "error";

export const FEEDBACK_KINDS: readonly FeedbackKind[] = ["select", "confirm", "success", "warning", "error"];

/** Android web patterns, in milliseconds (on, off, on, ...). */
export const VIBRATION: Readonly<Record<FeedbackKind, number | readonly number[]>> = {
  select: 6,
  confirm: 14,
  success: [14, 70, 28],
  warning: [28, 90, 28],
  error: [40, 60, 40, 60, 40],
};

export type NativeCall =
  | { method: "impact"; options: { style: "LIGHT" | "MEDIUM" } }
  | { method: "notification"; options: { type: "SUCCESS" | "WARNING" | "ERROR" } };

export const NATIVE: Readonly<Record<FeedbackKind, NativeCall>> = {
  select: { method: "impact", options: { style: "LIGHT" } },
  confirm: { method: "impact", options: { style: "MEDIUM" } },
  success: { method: "notification", options: { type: "SUCCESS" } },
  warning: { method: "notification", options: { type: "WARNING" } },
  error: { method: "notification", options: { type: "ERROR" } },
};

export const FEEDBACK_MOTION: Readonly<Record<FeedbackKind, { duration: string; ease: string }>> = {
  select: { duration: "var(--nf-duration-press)", ease: "var(--nf-ease-press)" },
  confirm: { duration: "var(--nf-duration-press)", ease: "var(--nf-ease-press)" },
  success: { duration: "var(--nf-duration-press)", ease: "var(--nf-ease-spring)" },
  warning: { duration: "var(--nf-duration-press)", ease: "var(--nf-ease-press)" },
  error: { duration: "var(--nf-duration-press)", ease: "var(--nf-ease-press)" },
};

export type FeedbackEnvironment = {
  /** Inside the Capacitor shell. */
  native: boolean;
  /** The shell answered that it has the Haptics plugin. */
  nativeHaptics: boolean;
  /** `navigator.vibrate` is a function here. */
  canVibrate: boolean;
  /** The platform is iOS (web or shell). iOS web has no vibration at all. */
  ios: boolean;
  reducedMotion: boolean;
};

export type FeedbackPlan =
  | { channel: "native"; call: NativeCall }
  | { channel: "vibrate"; pattern: number | readonly number[] }
  | { channel: "none" };

/** Pure: what one kind should do in one environment. */
export function planFeedback(kind: FeedbackKind, env: FeedbackEnvironment): FeedbackPlan {
  if (env.reducedMotion && kind !== "success" && kind !== "error") return { channel: "none" };
  if (env.native && env.nativeHaptics) return { channel: "native", call: NATIVE[kind] };
  if (env.canVibrate && !env.ios) return { channel: "vibrate", pattern: VIBRATION[kind] };
  return { channel: "none" };
}

type HapticsPlugin = {
  impact(options: { style: string }): Promise<void>;
  notification(options: { type: string }): Promise<void>;
};

/* Held in an object: a Capacitor plugin throws when a promise reads `.then` on
   it, and an async function that returns one does exactly that. */
type HeldHaptics = { readonly plugin: HapticsPlugin } | null;
let nativeHaptics: HeldHaptics | undefined;

/* Resolved once, lazily, and only in the shell. `null` means "asked and the
   shell has no plugin", which is remembered so nothing is asked twice. */
async function haptics(): Promise<HeldHaptics> {
  if (nativeHaptics !== undefined) return nativeHaptics;
  try {
    const { Capacitor } = await import("@capacitor/core");
    nativeHaptics = Capacitor.isPluginAvailable("Haptics")
      ? { plugin: Capacitor.registerPlugin<HapticsPlugin>("Haptics") }
      : null;
  } catch {
    nativeHaptics = null;
  }
  return nativeHaptics;
}

/**
 * THE FIRST TAP IS FELT ON THE TAP (Agent FEEL, 13 November 2026). The plugin
 * is resolved through a dynamic `import()` of `@capacitor/core`, so the very
 * first haptic of a session waited for that chunk to arrive and was felt late,
 * after the heart had already filled. In the shell it is resolved once while
 * the page is idle, so every tap, the first included, goes straight through.
 * Nothing happens on the website.
 */
export function warmFeedback(): void {
  if (typeof window === "undefined" || nativeHaptics !== undefined) return;
  try {
    if (!looksNative()) return;
  } catch {
    return;
  }
  const go = () => void haptics();
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  if (typeof idle === "function") idle(go, { timeout: 2000 });
  else window.setTimeout(go, 1500);
}
if (typeof window !== "undefined") warmFeedback();

function reducedMotion(): boolean {
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true) return true;
    /* B14: the in-app Motion setting says the same thing in the app's own
       words. Calm and Off turn feedback down exactly as the system's
       reduce-motion does: success and error only. */
    const level = readMotion().level;
    return level === "calm" || level === "off";
  } catch {
    return false;
  }
}

/**
 * Say one thing through the hand. Never throws and never awaits anything a
 * caller would notice: feedback is a nicety and a device that refuses it
 * changes nothing.
 */
export function feedback(kind: FeedbackKind): void {
  if (typeof window === "undefined") return;
  const native = looksNative();
  const run = (plugin: HapticsPlugin | null) => {
    try {
      const plan = planFeedback(kind, {
        native,
        nativeHaptics: plugin !== null,
        canVibrate: typeof navigator !== "undefined" && typeof navigator.vibrate === "function",
        ios: nativePlatform() === "ios" || /iPad|iPhone|iPod/.test(navigator.userAgent ?? ""),
        reducedMotion: reducedMotion(),
      });
      if (plan.channel === "native" && plugin) {
        const call = plan.call;
        const done =
          call.method === "impact" ? plugin.impact(call.options) : plugin.notification(call.options);
        void done.catch(() => undefined);
      } else if (plan.channel === "vibrate") {
        navigator.vibrate(plan.pattern as number | number[]);
      }
    } catch {
      /* A device that refuses feedback changes nothing. */
    }
  };
  if (!native) {
    run(null);
    return;
  }
  void haptics().then((held) => run(held ? held.plugin : null), () => run(null));
}

/**
 * VC1: the incoming call's buzz, the one REPEATING pattern the platform has,
 * so it lives here with every other vibration rather than in the call screen.
 * A ring is a call for attention, not a reply to a press, which is why it is
 * outside the five kinds above. Where `navigator.vibrate` exists (Android),
 * never under reduced motion, never while the page is hidden.
 * `ringBuzz(false)` stops it.
 */
export function ringBuzz(on: boolean): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    if (!on) {
      navigator.vibrate(0);
      return;
    }
    if (reducedMotion() || (typeof document !== "undefined" && document.hidden)) return;
    navigator.vibrate([400, 200, 400]);
  } catch {
    /* Not supported. */
  }
}
