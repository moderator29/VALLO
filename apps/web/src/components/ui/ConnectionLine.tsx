"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { agoWords, heldByPasscode, keptCopyAt, keptCopyKind, onFreshCopy } from "@/lib/offline/page-cache";

/**
 * THE CONNECTION LINE (details pass; offline pass, 8 October 2026). A small
 * dark pill at the top of the screen, never a wall: the page under it stays
 * the page, and everything on it that works without the network still works.
 *
 *   offline   the phone says it has no signal. The page on screen is the one
 *             this phone kept (`public/sw.js`), so the line says so: "You are
 *             offline. Showing what you saw last."
 *   kept      the phone has signal, but the network was too slow to wait for,
 *             so the worker answered with the kept copy and carried on
 *             fetching. The line says that, and the moment the fresh copy
 *             lands the page refreshes itself in place and the line goes.
 *   back      the connection returned: green for two seconds, and the page
 *             it was showing from the phone is refreshed in place.
 *
 * THE INSTANT OPEN (13 October 2026, the startup track). The worker now
 * answers a whole, recent copy AT ONCE and refreshes it behind the screen
 * (`public/sw.js`, "instant"). That is the normal way to open the app, not a
 * fault, so the line says nothing: the page refreshes itself in place the
 * moment it runs, inside a transition, so what is on screen stays on screen
 * until the fresh render replaces it. Only when that refresh is still going
 * after INSTANT_SLOW_MS does the line say what the slow answer says, and only
 * when the phone is offline does it say offline. Behind the passcode lock the
 * refresh is left to the unlock, which refreshes the route itself.
 *
 * `navigator.onLine` is optimistic (true behind a captive portal), so this
 * only speaks of being offline when the browser is sure, and never promises a
 * send will work: a send says so on its own button (`lib/offline/send-or-keep`).
 * The server render reads as online, so nothing flashes on first paint. The
 * words are a polite status, never an alert: being offline is a fact about the
 * place, not a failure of the person.
 */
const BACK_MS = 2200;
const EXIT_MS = 220;
/* An instant copy whose refresh is still going after this long is named, like the slow answer. */
const INSTANT_SLOW_MS = 4000;

/* "slow" is an instant copy whose refresh is taking long: drawn as "kept". */
type Phase = "online" | "offline" | "kept" | "slow" | "back" | "leaving";

export function ConnectionLine() {
  const copy = useClientCopy().details.connection;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("online");
  const timers = useRef<number[]>([]);
  /* Whether the page on screen is a kept copy that still wants refreshing. */
  const stale = useRef(false);
  /* The refresh runs in a transition: the copy stays on screen until the
     fresh render replaces it, and `refreshing` says when that has happened. */
  const [refreshing, startRefresh] = useTransition();
  const refreshingRef = useRef(false);
  /* "Updated 2 h ago": how old the copy on screen is, read once the line shows. */
  const [updatedText, setUpdatedText] = useState("");

  const showing = phase !== "online";
  useEffect(() => {
    const at = showing ? keptCopyAt() : null;
    setUpdatedText(at ? `Updated ${agoWords(at, Date.now())}.` : "");
  }, [showing]);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const clear = () => {
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    };
    const refreshIfStale = () => {
      if (!stale.current) return;
      stale.current = false;
      /* Behind the passcode lock, unlocking refreshes the route itself. */
      if (heldByPasscode()) return;
      startRefresh(() => router.refresh());
    };
    const offline = () => {
      clear();
      setPhase("offline");
    };
    const online = () => {
      clear();
      refreshIfStale();
      setPhase((was) => {
        if (was === "offline" || was === "kept") return "back";
        /* A slow refresh still going is a wait that just ended; one that landed was already over. */
        if (was === "slow") return refreshingRef.current ? "back" : "online";
        return was;
      });
      timers.current.push(
        window.setTimeout(() => setPhase((p) => (p === "back" ? "leaving" : p)), BACK_MS),
        window.setTimeout(() => setPhase((p) => (p === "leaving" ? "online" : p)), BACK_MS + EXIT_MS),
      );
    };
    /* The page on screen is the phone's copy: say which kind of wait it is. */
    const kept = () => {
      stale.current = true;
      setPhase(navigator.onLine ? "kept" : "offline");
    };
    const kind = keptCopyKind();
    if (kind === "instant") {
      /* Answered at once from the phone: refresh in place now and say
         nothing, unless the phone is offline or the refresh is slow. */
      stale.current = true;
      if (!navigator.onLine) offline();
      else {
        refreshIfStale();
        timers.current.push(
          window.setTimeout(() => {
            if (refreshingRef.current) setPhase((p) => (p === "online" ? "slow" : p));
          }, INSTANT_SLOW_MS),
        );
      }
    } else if (kind === "instant-light") {
      /* Answered at once on Save-Data or 2G: no second render now. The page
         refreshes once, when the copy the network is already fetching has
         been kept (`onFreshCopy` below), and says nothing meanwhile. */
      stale.current = true;
      if (!navigator.onLine) offline();
    } else if (kind === "kept") kept();
    else if (!navigator.onLine) offline();
    /* The worker kept a fresh copy of this page after showing the old one:
       refresh in place, and the slow-connection line goes. */
    const stopFresh = onFreshCopy(() => {
      refreshIfStale();
      setPhase((p) => (p === "kept" ? "online" : p));
    });
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      clear();
      stopFresh();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [router]);

  /* A slow refresh that has since landed is simply online again. */
  if (phase === "online" || (phase === "slow" && !refreshing)) return null;
  const back = phase === "back" || phase === "leaving";
  const keptLine = phase === "kept" || phase === "slow";
  const updated = !back && updatedText ? ` ${updatedText}` : "";
  return (
    <div
      className="nf-connection"
      data-state={back ? "back" : keptLine ? "kept" : "offline"}
      data-leaving={phase === "leaving" || undefined}
      data-testid="connection-line"
      role="status"
    >
      <span className="nf-connection__pill">
        <span className="nf-connection__dot" aria-hidden="true" />
        {back ? copy.back : (keptLine ? copy.kept : copy.offline) + updated}
      </span>
    </div>
  );
}
