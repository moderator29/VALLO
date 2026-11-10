"use client";

import { SplashScreen } from "@capacitor/splash-screen";
import { bootMark } from "./boot-trace";

/**
 * Take the splash down, once the application is genuinely on screen.
 *
 * `capacitor.config.ts` sets `launchAutoHide: false` deliberately, and that
 * decision hands this file the only responsibility that can strand somebody:
 * NOTHING ELSE HIDES THE SPLASH. If this module does not run, or runs and
 * throws, the person is looking at a static navy image with no way past it and
 * no way to know the app is not broken. Every choice below is made against
 * that outcome.
 *
 * WHY NOT A TIMER, WHICH IS WHAT THE DEFAULT DOES. A timer has to guess, and
 * both guesses are wrong. Too short uncovers a blank web view on a slow
 * Nigerian mobile connection, which is the first thing a store reviewer sees
 * and the first thing a new user reads as "this app does not work". Too long
 * holds a frozen image over a page that has been ready for seconds, which is
 * the same app feeling slower than the website it wraps.
 *
 * NOW, NOT AFTER A PAINTED FRAME (October 2026). This used to wait for the
 * window's `load` and then two animation frames, "the earliest honest
 * moment". On Android the splash plugin cancels the web view's draws (an
 * `OnPreDrawListener` answering false) until `hide()` is called, so those
 * frames could not come before the hide that was waiting on them, and the
 * splash came down on the failsafe instead: the founder's "logo for up to
 * eight seconds". By the time this module runs the page has hydrated, and
 * the startup's inline script (`components/startup/startup-script.ts`) has
 * normally hidden the splash already, on the document's first parse; this is
 * the second hand on the same rope, and a second hide is a no-op.
 *
 * THE FAILSAFE. The hide is a bridge call, and a bridge call can be refused
 * or lost. So a plain timer is armed the moment this runs and hides the
 * splash again regardless; whichever arrives first does the work and the
 * second finds it done.
 *
 * WHAT THIS CANNOT COVER, STATED PLAINLY. The failsafe is armed by JavaScript
 * inside the web layer, so it cannot help if the web layer never boots at all,
 * for example if the live origin is unreachable and the shell falls back to
 * the offline card in `native-shell/`. That fallback document has to hide the
 * splash itself, and it is not in this folder.
 */

/**
 * The failsafe window, in milliseconds.
 *
 * Two seconds: short enough that a lost bridge call never reads as a hang,
 * and still ahead of `BRIDGE_FAILSAFE_MS` in `boot.ts`, which only matters
 * for the native chunk that never arrives.
 */
export const FAILSAFE_MS = 2_000;

/**
 * Start the dismissal, and hand back a teardown.
 *
 * The teardown hides the splash rather than leaving it up. If the runtime is
 * being torn down, the one state that must not survive is the one that covers
 * the whole screen.
 */
/**
 * THE MISSING HALF (10 November 2026). The opening screen must not start while
 * the native splash is still covering it: before this, the opening's inline
 * before-paint script began its clock at first parse, the splash came down two
 * to four seconds later on a cold start, and the whole animation had already
 * played underneath it. All anyone saw was the last frame.
 *
 * So the splash says when it is actually gone: a flag for a listener that
 * arrives late, and an event for one already waiting. Fired after the fade
 * rather than when the hide is sent, because the fade is 220ms of splash still
 * on screen. `open-script.ts` is the only consumer.
 */
const SPLASH_DOWN_EVENT = "nf:splash-down";
const FADE_MS = 220;

function markSplashDown(): void {
  try {
    (window as unknown as { __nfSplashDown?: boolean }).__nfSplashDown = true;
    window.dispatchEvent(new Event(SPLASH_DOWN_EVENT));
  } catch {
    /* A runtime without events still gets the flag, or nothing. Either way the
       opening has its own ceiling and is never held up by this. */
  }
}

export function startSplash(): () => void {
  let hidden = false;

  const hide = (): void => {
    if (hidden) return;
    hidden = true;
    window.clearTimeout(timer);
    /* A short cross-fade rather than a cut, because the splash and the page
       behind it are the same navy: a hard swap reads as a flicker, a fade
       reads as one continuous surface. Failure is swallowed on purpose. If the
       plugin refuses, there is nothing useful to say and nothing to retry. */
    bootMark("splash:failsafe-or-teardown-hide");
    void SplashScreen.hide({ fadeOutDuration: FADE_MS }).catch(() => {});
    window.setTimeout(markSplashDown, FADE_MS + 20);
  };

  const timer = window.setTimeout(hide, FAILSAFE_MS);

  /* Straight away: no `load`, no frame. See the note above. */
  bootMark("splash:hide-sent");
  try {
    void SplashScreen.hide({ fadeOutDuration: FADE_MS }).then(
      () => {
        hidden = true;
        bootMark("splash:hide-answered");
        window.clearTimeout(timer);
        window.setTimeout(markSplashDown, FADE_MS + 20);
      },
      () => bootMark("splash:hide-refused"),
    );
  } catch {
    /* The failsafe tries again. */
  }

  return () => {
    hide();
  };
}
