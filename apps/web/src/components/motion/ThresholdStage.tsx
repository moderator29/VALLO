"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { THRESHOLD_EVENT, thresholdAllowed, type ThresholdKind } from "@/lib/motion/threshold";
import { useRootFlag } from "@/lib/ui/root-flag";

/*
 * THE SIGN-OUT MARK LOADS WHEN SIGN-OUT PLAYS (speed, 6 October 2026). This
 * stage is mounted in the root layout, so everything it imports statically is
 * first-load JavaScript on every route, and `LogoMark` drew through
 * `next/image`, whose client runtime (about 15 KB raw) was in the chunk every
 * route loads for this one import, among three. The mark it draws now is the
 * inline `LogoMarkLive` (D81), whose towers rise and whose ring sweeps, and it
 * stays a lazy import for the same reason: its geometry is only wanted here. The mark is drawn only by the
 * `leave` threshold, which is rare and starts with 360ms of closing panels
 * before the mark's own entrance (threshold.css), so it is fetched then.
 */
const LogoMarkLive = dynamic(() => import("@/design-system/brand/LogoMarkLive").then((m) => m.LogoMarkLive), {
  ssr: false,
});

/**
 * THE STAGE THE THRESHOLD MOMENTS PLAY ON (Track M, 25 September 2026).
 *
 * Mounted once in the root layout, so it survives the navigation it is
 * covering: the "going" half plays on the page being left, the route changes
 * underneath it, and the "arriving" half plays over the page being entered.
 *
 *   door    A new account, verified. A tick draws, "Welcome to Vallo." comes
 *           out of depth, an arch of light opens from a slit, and the view
 *           moves THROUGH it; on the other side the light falls away and the
 *           first page settles forward out of the glow.
 *   leave   Signing out. The page recedes into depth, two panels close on
 *           the mark, and they part again on the front door.
 *   return  Back after more than ten minutes away. No overlay: the page
 *           settles forward once and a line of light crosses the top. Less
 *           than ten minutes and nothing happens, so it never nags.
 *
 * `playThreshold` (lib/motion/threshold.ts) is how the app asks for one. None
 * of them runs under reduced motion or data saving, and every one is
 * decoration: `aria-hidden`, and `pointer-events: none` once the going half
 * is done, so nothing can be trapped behind it.
 */
const ARRIVE_MS = 900;
const GIVE_UP_MS = 5000;
const RETURN_AFTER_MS = 10 * 60 * 1000;
const RETURN_MS = 900;
const SPLASH_GIVE_UP_MS = 4000;
/* The startup's door: its leaves part over 350ms (`startup.css`, `leave`),
   with a margin for a slow frame. Only the backstop below waits on it. */
const STARTUP_DOOR_MS = 450;

export function ThresholdStage({ welcome }: { welcome: string }) {
  const pathname = usePathname();
  const [play, setPlay] = useState<{ kind: ThresholdKind; from: string; at: number } | null>(null);
  const hiddenAt = useRef<number | null>(null);
  /* Going until the route changes under it, arriving after. Derived rather
     than stored, so the change of phase is the change of route itself. */
  const arriving = play !== null && pathname !== play.from;
  /* Root flags for threshold.css (lib/ui/root-flag.ts): `data-threshold`
     while the stage draws, `data-threshold-leaving` while a sign-out's page
     recedes under it. */
  const drawn = play !== null && play.kind !== "open";
  useRootFlag("threshold", drawn);
  useRootFlag("threshold-leaving", drawn && play.kind === "leave" && !arriving);

  useEffect(() => {
    const onPlay = (event: Event) => {
      const kind = (event as CustomEvent<ThresholdKind>).detail;
      setPlay({ kind, from: window.location.pathname, at: Date.now() });
    };
    window.addEventListener(THRESHOLD_EVENT, onPlay);
    return () => window.removeEventListener(THRESHOLD_EVENT, onPlay);
  }, []);

  /* The arrival ends itself; a navigation that never comes is given up on. */
  useEffect(() => {
    if (play === null) return;
    const root = document.documentElement;
    if (arriving) root.dataset.arrive = play.kind;
    const timer = window.setTimeout(
      () => {
        delete root.dataset.arrive;
        setPlay(null);
      },
      arriving ? ARRIVE_MS : GIVE_UP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [play, arriving]);

  /* The splash (root layout) hands the page back: after its door has opened
     the flag moves to "done", which hides it for good and releases the
     `--nf-splash-hold` delay so later entrances start on time. */
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.splash !== "on") return;
    const splash = document.querySelector(".nf-splash");
    const done = () => {
      root.dataset.splash = "done";
    };
    /*
     * THE STARTUP SEQUENCE RELEASES ITSELF (D31, `components/startup`). Its
     * door is the stylesheet's (`--nf-startup-door`, 1150ms, which its inline
     * script moves for a tap, a key or a page still streaming) and the script
     * moves the flag to "done" on the door's own last keyframe, so this stage
     * must not release it at
     * hydration: a breathing lockup held for a page that has not arrived is
     * the honest wait, and releasing it here would cut it short. It used to
     * need a 600-second placeholder animation on the overlay to stop exactly
     * that; reading the class makes the placeholder unnecessary.
     *
     * The stage stays the BACKSTOP for one failure only: a startup script
     * that never ran (blocked, or thrown before it could listen). Then the
     * overlay would hold, tappable, for the life of the page. So if the flag
     * is still "on" well after hydration, the door is opened here and the
     * flag released once the leaves have had their time to part.
     */
    /* The opening (D68c) has no overlay: it is marked by `data-opening`,
       which its before-paint gate writes beside the flag. */
    if (root.dataset.opening || splash?.classList.contains("nf-startup")) {
      let release = 0;
      const backstop = window.setTimeout(() => {
        if (root.dataset.splash !== "on") return;
        root.dataset.startup = "open";
        release = window.setTimeout(() => {
          if (root.dataset.splash === "on") done();
        }, STARTUP_DOOR_MS);
      }, SPLASH_GIVE_UP_MS);
      return () => {
        window.clearTimeout(backstop);
        window.clearTimeout(release);
      };
    }
    /*
     * ANY OTHER SPLASH IS GONE. The Track M splash (leaves, glow and the
     * assembling raster lockup, released by its `nf-splash-gone` keyframe)
     * was replaced in place by the startup sequence and its rules deleted
     * from threshold.css, so a flag left "on" with no startup overlay (a page
     * that switched it on by hand) is released at once. Releasing promptly
     * matters beyond the flag: while it is "on", `#main` runs a filled
     * entrance, and a filled transform makes `#main` the containing block of
     * every `position: fixed` child (the pinned price bar, sheets), which
     * then sit a whole page down.
     */
    done();
  }, []);

  /* Coming back to the app. */
  useEffect(() => {
    let timer = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
      hiddenAt.current = null;
      if (away < RETURN_AFTER_MS || !thresholdAllowed()) return;
      const root = document.documentElement;
      root.dataset.arrive = "return";
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (root.dataset.arrive === "return") delete root.dataset.arrive;
      }, RETURN_MS);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(timer);
    };
  }, []);

  /* `open` is the passcode unlock asking for the startup's door: the
     arrival is CSS (`:root[data-arrive="open"]`), and the stage draws
     nothing for it rather than the sign-out panels, which are the fallback
     branch below. The cold start itself never dispatches it (threshold.ts). */
  if (play === null || play.kind === "open") return null;

  return (
    <div
      className={`nf-threshold nf-threshold--${play.kind}`}
      data-phase={arriving ? "arriving" : "going"}
      aria-hidden="true"
    >
      <div className="nf-threshold__veil" />
      {play.kind === "door" ? (
        <>
          <div className="nf-threshold__arch" />
          <div className="nf-threshold__center">
            <svg className="nf-threshold__tick" viewBox="0 0 64 64" width="64" height="64">
              <circle cx="32" cy="32" r="29" pathLength={1} />
              <path d="M20 33.5 28.5 42 45 24" pathLength={1} />
            </svg>
            <p className="nf-threshold__words">{welcome}</p>
          </div>
        </>
      ) : (
        <>
          <div className="nf-threshold__panel nf-threshold__panel--a" />
          <div className="nf-threshold__panel nf-threshold__panel--b" />
          <div className="nf-threshold__center">
            <LogoMarkLive size={64} motion="reveal" />
          </div>
        </>
      )}
    </div>
  );
}
