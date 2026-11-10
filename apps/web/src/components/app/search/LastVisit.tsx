"use client";

import { consentAllows } from "@/lib/consent/consent";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * "New since your last visit", for the shelf (V-22).
 *
 * The reader's previous visit to the shelf is remembered on this device only:
 * one timestamp in localStorage, nothing sent anywhere, nothing that needs an
 * account. On mount the provider reads the old value (that is the "last
 * visit") and then writes now, so a listing is marked New exactly once per
 * visit after it went live.
 *
 * WHY THE FIRST VISIT MARKS NOTHING. With no previous visit there is nothing
 * for "new" to be new against, and marking the whole shelf New on somebody's
 * first look would be a word that means nothing. Storage that is blocked
 * (a private window, a web view that refuses it) is the same case.
 *
 * The value is read after hydration, so the server render and the first
 * client render agree (nothing is marked), and the marks appear a frame later.
 */
const LAST_VISIT_KEY = "vallo_shelf_last_visit";

const LastVisitContext = createContext<number | null>(null);

export function LastVisitProvider({ children }: { children: ReactNode }) {
  const [previous, setPrevious] = useState<number | null>(null);
  useEffect(() => {
    let before: number | null = null;
    try {
      const raw = window.localStorage.getItem(LAST_VISIT_KEY);
      const parsed = raw === null ? Number.NaN : Number(raw);
      before = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      if (consentAllows("preferences")) window.localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
    } catch {
      before = null;
    }
    /* Read once per mount; a reader who stays on the page keeps the same
       answer rather than watching the marks disappear under them. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrevious(before);
  }, []);
  return <LastVisitContext.Provider value={previous}>{children}</LastVisitContext.Provider>;
}

/** The previous visit in ms since the epoch, or null (none, unknown, or no provider). */
export function useLastVisit(): number | null {
  return useContext(LastVisitContext);
}
