"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cleanWords, fetchSuggest } from "@/lib/intelligence/client";
import type { IntelligenceTab, Suggestion } from "@/lib/intelligence/contract";
import { motionQuiet } from "@/lib/motion/gate";

/** How long typing must pause before the suggestions are asked for. */
export const SUGGEST_DEBOUNCE_MS = 150;

export type SuggestState = {
  /** The words these suggestions answer, so a list is never shown for other words. */
  q: string;
  suggestions: Suggestion[];
  didYouMean?: string;
};

const NONE: SuggestState = { q: "", suggestions: [] };

/**
 * TYPED-AHEAD SUGGESTIONS, ~150ms after the last key.
 *
 * Two guards, because either alone leaks: every new request ABORTS the one
 * before it (so a slow network does not queue answers nobody wants), and
 * every answer carries the number of the request that asked for it, so an
 * answer that arrives after a newer request was sent is dropped even when
 * the abort did not reach it (a cached response, a proxy that ignores the
 * signal). A response never overwrites a newer one.
 */
export function useSuggest(text: string, tab: IntelligenceTab, active: boolean): SuggestState {
  const [state, setState] = useState<SuggestState>(NONE);
  const seq = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const q = cleanWords(text);
  const live = active && q.length > 0;

  useEffect(() => {
    if (!live) {
      /* Nothing to ask: whatever is in flight is now stale. */
      seq.current += 1;
      controller.current?.abort();
      controller.current = null;
      return;
    }
    const timer = window.setTimeout(() => {
      controller.current?.abort();
      const own = new AbortController();
      controller.current = own;
      const mine = ++seq.current;
      fetchSuggest(q, tab, own.signal)
        .then((response) => {
          if (mine !== seq.current) return;
          setState({ q, suggestions: response.suggestions, didYouMean: response.didYouMean });
        })
        .catch(() => {
          if (mine !== seq.current) return;
          /* A failed typed-ahead is not an outcome: the field still submits. */
          setState({ q, suggestions: [] });
        });
    }, SUGGEST_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q, tab, live]);

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  return live ? state : NONE;
}

/** How long each example stays in the empty field, and how many times the list goes round. */
export const HINT_DWELL_MS = 3200;
export const HINT_ROUNDS = 2;

/**
 * THE ROTATING EXAMPLE IN THE EMPTY FIELD, BOUNDED.
 *
 * It moves only while the field is empty and not focused, at most
 * `HINT_ROUNDS` times through the list, then rests on the first example. It
 * never starts for a reader who asked for less motion (`motionQuiet`), and it
 * stops for good the moment the field is focused: an example that changes
 * while somebody is reading it to type is a distraction, not a hint. A
 * timer, not a CSS animation, so there is nothing infinite to allowlist.
 */
export function useRotatingHint(count: number, paused: boolean): number {
  const [index, setIndex] = useState(0);
  const stopped = useRef(false);
  const steps = useRef(0);

  useEffect(() => {
    if (paused) {
      stopped.current = stopped.current || paused;
      return;
    }
    if (stopped.current || count < 2 || motionQuiet()) return;
    const timer = window.setTimeout(() => {
      steps.current += 1;
      if (steps.current >= count * HINT_ROUNDS) {
        stopped.current = true;
        setIndex(0);
        return;
      }
      setIndex((i) => (i + 1) % count);
    }, HINT_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [index, count, paused]);

  return index;
}

/** Whether the browser says it is online; false only when it is sure it is not. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const read = () => setOnline(typeof navigator === "undefined" || navigator.onLine !== false);
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);
  return online;
}

function readMac(): boolean {
  try {
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? "";
    return /mac|iphone|ipad/i.test(platform);
  } catch {
    return false;
  }
}
const noSubscribe = () => () => undefined;

/** "⌘ K" on a Mac, "Ctrl K" elsewhere; the server and the first paint say "Ctrl K", so they agree. */
export function useIsMac(): boolean {
  return useSyncExternalStore(noSubscribe, readMac, () => false);
}

function readFine(): boolean {
  try {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  } catch {
    return false;
  }
}

/** A mouse-and-keyboard machine (where a shortcut hint means something); false on the server and on a phone. */
export function useFinePointer(): boolean {
  return useSyncExternalStore(noSubscribe, readFine, () => false);
}
