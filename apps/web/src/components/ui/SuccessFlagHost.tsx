"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { consumeSuccess } from "@/lib/ui/success-actions";
import { banner } from "@/lib/ui/toast";
import { feedback } from "@/lib/ui/feedback";
import {
  DONE_FLAGS,
  DONE_PARAM,
  SUCCESS_EVENT,
  SUCCESS_HINT_COOKIE,
  isGlobalDoneFlag,
  successCopy,
  type GlobalDoneFlag,
  type SuccessEventDetail,
} from "@/lib/ui/success-moments";

/**
 * THE ACCOUNT MOMENTS, WHEREVER THEY LAND. Mounted once, in the root layout.
 *
 * A sign-up, a confirmed email, a changed password and a passcode belong to
 * the account rather than to a record on a page, and each finishes wherever
 * the person was going. They reach this host two ways, and NEITHER is the
 * address:
 *
 *   - a server action that succeeded calls `rememberSuccess(flag)`, which
 *     sets an HttpOnly one-shot cookie and a readable hint
 *     (lib/ui/success-cookie.ts). On a navigation where the hint is present,
 *     this asks the server (`consumeSuccess`), which answers from the
 *     HttpOnly cookie alone, against the allow-list, and deletes it.
 *   - a client screen that succeeded calls `showSuccess(flag)`.
 *
 * `?done=<account flag>` IS NOT HONOURED. It was forgeable: a link could say
 * "Password changed" to anybody, and it survived a sign-in's `next=`. One
 * found in the address is removed, on every route including the site pages,
 * and nothing opens.
 */
/*
 * GRADE 1: NO SHEET HERE ANY MORE (P0.4, November 2026). Every account moment
 * is now the top banner (`lib/ui/toast.ts`), so this host no longer lazy-loads
 * `SuccessSheet` (speed, 6 October 2026, explained why it was lazy: it sits
 * in the root layout). Record moments on pages keep their sheets.
 */
export function SuccessFlagHost() {
  const copy = useClientCopy().success;
  const pathname = usePathname();
  /* GRADE 1: THE ACCOUNT MOMENTS ARE BANNERS (P0.4, November 2026). The
     founder's brief lists "Account created", "Login successful", "Password
     changed" and "Welcome to Vallo" as top-banner moments, the way reference
     R4 confirms a sign-in, so they no longer cover the page with a sheet. The
     copy is read through a ref so the listeners below never go stale. */
  const copyRef = useRef(copy);
  useEffect(() => {
    copyRef.current = copy;
  }, [copy]);
  function announce(flag: GlobalDoneFlag): void {
    /* The moment's own feel (`momentFeel`): heavy only for a payoff. */
    const { title, haptic } = successCopy(copyRef.current, DONE_FLAGS[flag]);
    banner.success(title, { "data-testid": "banner-account" });
    feedback(haptic);
  }

  useEffect(() => {
    /* A stale or forged account flag in the address goes, silently. The
       history API rather than the router: this changes nothing the page
       renders, so it must not ask the server for anything. */
    const url = new URL(window.location.href);
    if (isGlobalDoneFlag(url.searchParams.get(DONE_PARAM))) {
      url.searchParams.delete(DONE_PARAM);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }

    if (!document.cookie.split("; ").some((part) => part === `${SUCCESS_HINT_COOKIE}=1`)) return;
    /* Not cancelled on a further navigation: the server has already deleted
       the cookie by the time it answers, so dropping the answer would lose
       the moment for good. */
    void consumeSuccess().then(
      (taken) => {
        if (taken) announce(taken);
      },
      () => undefined,
    );
  }, [pathname]);

  useEffect(() => {
    const onSuccess = (event: Event) => {
      const asked = (event as CustomEvent<SuccessEventDetail>).detail?.flag;
      if (isGlobalDoneFlag(asked)) announce(asked);
    };
    window.addEventListener(SUCCESS_EVENT, onSuccess);
    return () => window.removeEventListener(SUCCESS_EVENT, onSuccess);
  }, []);

  return null;
}
