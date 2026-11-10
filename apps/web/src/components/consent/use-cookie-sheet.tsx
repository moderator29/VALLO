"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import type { CookiesCopy } from "./CookieConsent";

const CookieConsent = dynamic(() => import("./CookieConsent"), { ssr: false });

/**
 * Opens the cookie choice sheet from any entry point (the footer, the Settings
 * row, the Cookies page) without shipping its words in the page: on press it
 * fetches them for the reader's language (`/api/cookie-copy`), then loads the
 * sheet lazily. Offline, nothing opens and nothing has changed.
 */
export function useCookieSheet(): { open: () => void; sheet: ReactNode } {
  const [copy, setCopy] = useState<CookiesCopy | null>(null);
  const [busy, setBusy] = useState(false);
  const open = () => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        const response = await fetch("/api/cookie-copy", { headers: { accept: "application/json" } });
        if (response.ok) setCopy((await response.json()) as CookiesCopy);
      } catch {
        /* Offline: the sheet cannot load its words; the control works again on the next press. */
      } finally {
        setBusy(false);
      }
    })();
  };
  const sheet = copy ? <CookieConsent copy={copy} start="sheet" onDone={() => setCopy(null)} /> : null;
  return { open, sheet };
}
