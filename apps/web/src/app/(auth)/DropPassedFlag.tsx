"use client";

import { useEffect } from "react";
import { FIRST_RUN_PASSED_PARAM, firstRunCookieFrom, isFirstRunSeen } from "@/components/app/welcome/first-run-seen";

/**
 * The slides hand every door `?welcomed=1` so it can never send the person
 * back to them (`first-run-seen.ts`). Once the door has drawn, the flag has
 * done its job: it leaves the address bar so a copied or shared link stays
 * clean. History is replaced, never pushed, and nothing re-renders. Only
 * when the cookie is really there: a browser that refused it keeps the flag,
 * which is then the only thing standing between a refresh and the slides.
 */
export function DropPassedFlag() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(FIRST_RUN_PASSED_PARAM)) return;
      if (!isFirstRunSeen(firstRunCookieFrom(document.cookie))) return;
      url.searchParams.delete(FIRST_RUN_PASSED_PARAM);
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch {
      /* The address stays as it is; nothing depends on this. */
    }
  }, []);
  return null;
}
