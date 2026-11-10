"use client";

import { consentAllows } from "@/lib/consent/consent";
import { useEffect } from "react";
import { doorFromChapter, VISIT_COOKIE, type FunnelStep } from "@/lib/funnel/steps";

/**
 * A6. THE FRONT DOOR'S FIRST-PARTY BEACON. Draws nothing.
 *
 * Makes the visit id (a random UUID in a session cookie with no expiry, so
 * it is gone when the browser closes), reports `step` once per visit, and on
 * the landing reports "get started" when a link to sign-up is followed,
 * with the room it sat in as the door. No third party, no fingerprint, no
 * account: the server adds one only after verification.
 */
export function FunnelBeacon({ step, watchStart = false }: { step?: FunnelStep; watchStart?: boolean }) {
  useEffect(() => {
    /* Counting is analytics: no visit number, no beacon, until the person agrees. */
    if (!consentAllows("analytics")) return;
    let visit = document.cookie.split("; ").find((c) => c.startsWith(`${VISIT_COOKIE}=`))?.slice(VISIT_COOKIE.length + 1);
    if (!visit && typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      visit = crypto.randomUUID();
      document.cookie = `${VISIT_COOKIE}=${visit}; path=/; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    }
    const send = (payload: { step: FunnelStep; door?: string }) => {
      try {
        const body = JSON.stringify(payload);
        if (!navigator.sendBeacon?.("/api/funnel", new Blob([body], { type: "application/json" }))) {
          void fetch("/api/funnel", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
        }
      } catch {
        /* Never an error for the visitor. */
      }
    };
    if (step) send({ step });
    if (!watchStart) return;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      const href = link?.getAttribute("href") ?? "";
      if (!/^\/(start|sign-up)(\/|\?|$)/.test(href)) return;
      const landmark = link?.closest("header") ? "header" : link?.closest("footer") ? "footer" : null;
      send({ step: "get_started", door: doorFromChapter(link?.closest("[data-chapter]")?.getAttribute("data-chapter"), landmark) });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [step, watchStart]);
  return null;
}
