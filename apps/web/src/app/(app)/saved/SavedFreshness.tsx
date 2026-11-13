"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { savedChangeVersion, savesInFlight, whenSavesSettle } from "@/lib/saved/save-flow";

/**
 * /saved KEEPS ITSELF HONEST, so a heart does not have to (Agent FEEL,
 * 13 November 2026).
 *
 * The save actions used to `revalidatePath("/saved")`, which in this Next
 * renders the whole page the heart was tapped on into the action's answer
 * (the banner waited for it) and drops every page from the client router
 * cache (going back refetched). They no longer do. What that call was for is
 * here instead: the router may hand /saved back from its cache (going back,
 * or a tab visited under `staleTimes.dynamic` ago), and if this tab saved or
 * removed something after that copy was drawn, the copy is refreshed in the
 * background. The cached list is on screen at once and corrects in place.
 *
 * `render` is a fresh id per server render. The first time a render is shown
 * it is current by definition (it was drawn after every tap so far, because a
 * dynamic page is only ever fetched when it is navigated to); every later
 * time it is shown it is checked against the taps since.
 */
const shownAt = new Map<string, number>();

export function SavedFreshness({ render }: { render: string }) {
  const router = useRouter();
  useEffect(() => {
    let live = true;
    const now = savedChangeVersion();
    const seen = shownAt.get(render);
    shownAt.set(render, now);
    if (seen !== undefined && seen < now) {
      router.refresh();
    } else if (seen === undefined && savesInFlight()) {
      void whenSavesSettle().then(() => {
        if (live) router.refresh();
      });
    }
    return () => {
      live = false;
    };
  }, [render, router]);
  return null;
}
