"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ComponentProps } from "react";
import { HOLD_MAX_MS, shouldHold, waitForArrival } from "@/lib/nav/tab-warm";
import { feedback } from "@/lib/ui/feedback";

/**
 * A DOCK TAB THAT KEEPS THE CURRENT SCREEN UP UNTIL THE NEXT ONE IS READY (13
 * October 2026, the startup track).
 *
 * A tap on a tab whose copy is fresh navigates at once and the router draws
 * the tab straight from that copy, inside its own transition, so the old
 * screen stays until the new one paints. `KeepWarm` keeps the tabs that way.
 *
 * A tap on a tab whose copy is NOT fresh (the first second after the app
 * opens or comes back, while `KeepWarm`'s fetch is still on its way) used to
 * swap the screen for the tab's skeleton at once. Now the tap asks for the
 * tab whole and keeps the current screen up until it arrives, HOLD_MAX_MS at
 * most, then navigates: with the copy there, the tab is drawn whole, with no
 * skeleton between. The dock answers the finger at once all the same: the
 * tapped tab takes the pill on the tap (`AutoHideDock`, `data-on`).
 *
 * A second tap on the same tab, or the hold running out, navigates at once,
 * and a tap on another tab replaces the hold. Where the browser's resource
 * timing cannot be read, or holds keep running out on a slow link
 * (`shouldHold`), the tap navigates at once exactly as a plain link does. In
 * development nothing is prefetched, so nothing is held.
 */

/* `router.prefetch`'s option for the whole page, typed from `useRouter`. */
const WHOLE = { kind: "full" } as unknown as NonNullable<Parameters<ReturnType<typeof useRouter>["prefetch"]>[1]>;

/* The one hold in progress, page-wide: a newer tap or a navigation replaces it. */
let current: { href: string; token: number } | null = null;
let tokens = 0;

/** Cancel the hold in progress, if any. */
function releaseHold(): void {
  current = null;
}

export function HoldTabLink(props: ComponentProps<typeof Link>) {
  const router = useRouter();
  const pathname = usePathname();
  const href = typeof props.href === "string" ? props.href : null;
  const { onNavigate } = props;

  /* Arriving anywhere ends whatever hold was running. */
  useEffect(() => releaseHold, [pathname]);

  return (
    <Link
      {...props}
      onNavigate={(event) => {
        let prevented = false;
        onNavigate?.({
          preventDefault: () => {
            prevented = true;
            event.preventDefault();
          },
        });
        /* N7: a light tick when the tab changes (never on the tab already
           open), the feel of a native tab bar. `feedback` stays silent on the
           web where nothing can vibrate, and under reduced motion. */
        if (!prevented && href && href !== pathname) feedback("select");
        if (prevented || !href || process.env.NODE_ENV !== "production") return;
        /* A second tap on a tab already held: go now. */
        if (current?.href === href) {
          releaseHold();
          return;
        }
        if (!shouldHold(href, Date.now())) {
          releaseHold();
          return;
        }
        event.preventDefault();
        const token = ++tokens;
        current = { href, token };
        const since = Date.now();
        router.prefetch(href, WHOLE);
        void waitForArrival(href, HOLD_MAX_MS, since).then(async (arrived) => {
          /* A beat for the router to file what just arrived. */
          if (arrived) await new Promise((resolve) => window.setTimeout(resolve, 32));
          if (current?.token !== token) return;
          releaseHold();
          router.push(href);
        });
      }}
    />
  );
}
