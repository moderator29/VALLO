"use client";

import { useEffect } from "react";
import { banner, type ToastTone } from "@/lib/ui/toast";
import { entrySeq } from "@/lib/ui/history";

/**
 * AN OUTCOME THAT ARRIVES WITH THE PAGE, SAID BY THE ONE BANNER (Grade 1).
 *
 * A server form action that redirects back with its outcome in the address
 * (`?claim=taken`, `?bulk=3-1-0`) used to print it as a status line on the
 * page. The server page names the sentence and its tone; this says it once,
 * at the top, the way every other outcome on the platform is said.
 * Renders nothing.
 *
 * ONCE PER ARRIVAL, NOT ONCE PER MOUNT (Agent FEEL, 13 November 2026). Going
 * back to a page re-mounts it with the same address, and the banner used to
 * be said again, late, about something that happened minutes ago: one of the
 * "banners take time when going back" the founder saw. Each history entry is
 * said at most once: the Navigation API's entry key where the browser has it,
 * otherwise the entry's own stamp in `history.state` (lib/ui/history.ts), so a
 * NEW arrival at the same address with the same sentence is still said.
 */
const SAID_KEY = "nf_arrival_said";

function entryKey(message: string): string {
  let entry = "";
  try {
    const nav = (window as unknown as { navigation?: { currentEntry?: { key?: string } } }).navigation;
    entry = nav?.currentEntry?.key ?? "";
  } catch {
    entry = "";
  }
  if (!entry) {
    const seq = entrySeq();
    entry = seq === null ? "" : `seq:${seq}`;
  }
  return `${entry || window.location.pathname + window.location.search}|${message}`;
}

/** True the first time this entry says this sentence; false on a return. */
export function firstArrival(message: string): boolean {
  if (typeof window === "undefined") return true;
  const key = entryKey(message);
  try {
    const said: string[] = JSON.parse(window.sessionStorage.getItem(SAID_KEY) ?? "[]");
    if (said.includes(key)) return false;
    window.sessionStorage.setItem(SAID_KEY, JSON.stringify([...said, key].slice(-30)));
  } catch {
    /* Storage refused: say it, as before. */
  }
  return true;
}

export function BannerOnArrival({ message, tone = "success" }: { message: string | null; tone?: ToastTone }) {
  useEffect(() => {
    if (message && firstArrival(message)) banner(message, { tone });
  }, [message, tone]);
  return null;
}
